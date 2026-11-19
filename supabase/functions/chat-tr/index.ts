// 🌐 채팅 자동 번역 (Claude) — 관리자만
//  손님이 어떤 나라 말로 써도 담당자가 고른 말(한국어 · 베트남어 · 영어)로 보여 주고,
//  담당자가 쓴 답장은 손님 말로 바꿔서 보내요 (채널톡처럼).
//  요청: { items: [{ id?: any, text: string, to: "ko" | "vi" | "ru" | ... }] }  (한 번에 20개까지)
//  답:   { items: [{ id, src: "ru", text: "번역" }] }  — src 가 to 와 같으면 text 는 원문 그대로
//  필요한 비밀값: ANTHROPIC_API_KEY (blog-ai 와 같은 키 · Supabase → Edge Functions → Secrets). 키는 채팅 · 코드에 적지 않아요.
import { createClient } from "jsr:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const MODEL = Deno.env.get("CHAT_TR_MODEL") || "claude-haiku-5-5";
const ALLOW = ["https://www.uncleday.com", "https://uncleday.com"];
const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && (ALLOW.includes(origin) || origin.startsWith("http://localhost")) ? origin : ALLOW[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});
const LANGS: Record<string, string> = { ko: "Korean", vi: "Vietnamese", en: "English", ja: "Japanese", zh: "Simplified Chinese", "zh-TW": "Traditional Chinese",
  ru: "Russian", fr: "French", de: "German", es: "Spanish", hi: "Hindi", th: "Thai", id: "Indonesian" };

const SYSTEM = `You translate chat messages between a customer and the support staff of "Uncle Day", a booking site for spas, massages and beauty shops in Vietnam.
For each item: detect the language of "text" (answer with an ISO code: ko, vi, en, ja, zh, zh-TW, ru, fr, de, es, hi, th, id, or another ISO 639-1 code), then translate it into the target language "to".
Rules:
- Translate faithfully and naturally, in a polite, friendly customer-service tone. Do not add or remove information, do not answer the message.
- Keep emojis, numbers, prices, dates, times, booking codes (like UD-1113-9662), URLs, phone numbers, shop names and people's names exactly as they are.
- If the text is already in the target language, return it unchanged.
- Korean output: polite 해요체. Vietnamese output: polite (anh/chị/bạn as natural).
Output only JSON, no explanation: {"items":[{"i":0,"src":"ru","text":"..."}]}`;

Deno.serve(async (req) => {
  const h = { ...cors(req.headers.get("origin")), "Content-Type": "application/json" };
  const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: h });
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return out({ error: "POST only" }, 405);
  const caller = createClient(URL, ANON, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
  const { data: isAdmin, error: e1 } = await caller.rpc("is_admin");
  if (e1 || isAdmin !== true) return out({ error: "Admins only" }, 403);
  if (!KEY) return out({ error: "ANTHROPIC_API_KEY 비밀값이 아직 없어요 (Supabase → Edge Functions → Secrets)" }, 400);

  const b = await req.json().catch(() => ({}));
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 20)
    .map((x: any, i: number) => ({ i, id: x.id ?? i, text: String(x.text || "").slice(0, 2000), to: LANGS[x.to] ? x.to : "ko" }))
    .filter((x: any) => x.text.trim());
  if (!items.length) return out({ items: [] });
  const user = JSON.stringify({ items: items.map((x: any) => ({ i: x.i, to: `${x.to} (${LANGS[x.to]})`, text: x.text })) });

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, system: SYSTEM, messages: [{ role: "user", content: user }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return out({ error: "AI 호출 실패: " + ((j.error && j.error.message) || r.status) }, 502);
  const text = (j.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("").trim();
  const m = text.match(/\{[\s\S]*\}/);
  try {
    const d = JSON.parse(m ? m[0] : text);
    const got: Record<number, any> = {};
    (Array.isArray(d.items) ? d.items : []).forEach((x: any) => { if (x && typeof x.i === "number") got[x.i] = x; });
    return out({ model: MODEL, items: items.map((x: any) => {
      const g = got[x.i] || {};
      const src = String(g.src || "").slice(0, 8) || null;
      return { id: x.id, src, to: x.to, text: String(g.text || x.text).slice(0, 2000) };
    }) });
  } catch (_) { return out({ error: "AI 답을 읽지 못했어요. 한 번 더 해 주세요" }, 502); }
});

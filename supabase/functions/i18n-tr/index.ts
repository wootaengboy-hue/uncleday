// 🌐 손님 사이트 다국어 번역 (Claude) — 관리자만
//  관리자 → 포털 → 🌐 다국어 번역이 '번역할 글 묶음'을 보내면, 한 언어로 번역해서 돌려줘요. (저장은 관리자 화면이 i18n_tr 표에 해요)
//  요청: { lang: "ja", kind: "ui" | "site" | "shop", items: { "경로": { "en": "...", "ko": "..." } } }   (한 번에 120개까지)
//  답:   { items: { "경로": "번역" }, model }
//  필요한 비밀값: ANTHROPIC_API_KEY (blog-ai · chat-tr 와 같은 키). 키는 채팅 · 코드에 적지 않아요.
import { createClient } from "jsr:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const MODEL_UI = Deno.env.get("I18N_MODEL_UI") || "claude-sonnet-5-5";     // 화면 문구 · 사이트 글: 품질 우선
const MODEL_SHOP = Deno.env.get("I18N_MODEL_SHOP") || "claude-haiku-5-5";  // 업체 내용: 양이 많아서 빠르고 저렴하게
const ALLOW = ["https://www.uncleday.com", "https://uncleday.com"];
const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && (ALLOW.includes(origin) || origin.startsWith("http://localhost")) ? origin : ALLOW[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});
const LANGS: Record<string, string> = { ja: "Japanese", zh: "Simplified Chinese (Mainland China)", "zh-TW": "Traditional Chinese (Taiwan)", ru: "Russian", fr: "French",
  de: "German", es: "Spanish", hi: "Hindi", th: "Thai", id: "Indonesian", ko: "Korean", en: "English", vi: "Vietnamese" };

const system = (lang: string, kind: string) => `You are the localization editor of "Uncle Day" (엉클데이), a website where international travelers book massages, spas, skincare, nails and other beauty services in Vietnam (Da Nang, Nha Trang, Ho Chi Minh City, Hanoi).
Translate each item into ${LANGS[lang]}. Each item gives the English text ("en") and the original Korean ("ko") for context; translate the meaning naturally for travelers from that country.
Rules:
- ${kind === "ui" ? "These are website UI strings (buttons, labels, short notices). Keep them short and natural like a modern booking app. Use the polite/standard register." : kind === "shop" ? "These are a shop's name, description, menu items and notes. Keep proper names of shops, brands, streets and districts in their original Latin form (you may add a common local transliteration in parentheses only for Japanese/Chinese/Thai/Hindi shop names if natural, otherwise keep as is). Translate service names (e.g. 'Full-body oil massage 90 min')." : "These are site texts: city names, service categories, banners, how-it-works steps and FAQ. Use the commonly used local names for Vietnamese cities."}
- Keep placeholders exactly as they are: {n}, {p}, {c}, {shop}, {city}, {cat} and any HTML tags like <b>…</b>. Keep line breaks (\\n).
- Keep emojis, numbers, prices (₫, VND), times, booking codes (UD-1106-1234), URLs and the brand name "Uncle Day" unchanged.
- KakaoTalk, Zalo, WhatsApp, Grab, Google Maps stay as brand names.
- Do not add explanations. Do not skip any item.
Input format: each item starts with a line "@@<number>", then "EN: …" and "KO: …" (either may be empty).
Output format (plain text, no JSON, no code block): for EVERY item write a line "@@<same number>" and on the following line(s) only the ${LANGS[lang]} translation. Nothing else before, between or after.`;

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
  const lang = String(b.lang || ""), kind = ["ui", "site", "shop"].includes(b.kind) ? b.kind : "ui";
  if (!LANGS[lang] || ["ko", "en", "vi"].includes(lang)) return out({ error: "언어 코드가 이상해요" }, 400);
  const src: Record<string, { en?: string; ko?: string }> = {};
  for (const [k, v] of Object.entries(b.items || {}).slice(0, 120)) {
    const x = v as any; const en = String(x?.en || "").slice(0, 1500), ko = String(x?.ko || "").slice(0, 1500);
    if (en || ko) src[String(k).slice(0, 120)] = { en, ko };
  }
  if (!Object.keys(src).length) return out({ items: {} });
  const model = kind === "shop" ? MODEL_SHOP : MODEL_UI;

  // 번호(@@1, @@2 …)로 주고받아요 — JSON 은 따옴표 · 줄바꿈 때문에 깨지기 쉬워서요
  const keys = Object.keys(src);
  const user = keys.map((k, i) => `@@${i + 1}\nEN: ${src[k].en || ""}\nKO: ${src[k].ko || ""}`).join("\n\n");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 16000, system: system(lang, kind), messages: [{ role: "user", content: user }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return out({ error: "AI 호출 실패: " + ((j.error && j.error.message) || r.status) }, 502);
  const text = (j.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("").replace(/```[a-z]*\n?/gi, "").trim();
  const items: Record<string, string> = {};
  const parts = text.split(/^\s*@@\s*(\d+)\s*[:.)]?[ \t]*/m);   // ["앞", "1", "번역…", "2", "번역…"]
  for (let i = 1; i < parts.length; i += 2) {
    const k = keys[+parts[i] - 1], v = (parts[i + 1] || "").replace(/^\s*(?:[A-Z]{2}(?:-[A-Z]{2})?|JA|ZH|RU)\s*:\s*/, "").trim();
    if (k && v) items[k] = v.slice(0, 3000);
  }
  const missing = keys.filter(k => !items[k]).length;
  if (!Object.keys(items).length) return out({ error: "AI 답을 읽지 못했어요 (" + (j.stop_reason || "") + "): " + text.slice(0, 160).replace(/\s+/g, " ") }, 502);
  return out({ items, model, missing });
});

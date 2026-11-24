// 🌐 채팅 자동 번역 (Claude) — 엉클데이 직원만 (관리자 + 현장 영업)
//  손님이 어떤 나라 말로 써도 담당자가 고른 말(한국어 · 베트남어 · 영어)로 보여 주고,
//  담당자가 쓴 답장은 손님 말로 바꿔서 보내요 (채널톡처럼).
//  요청: { items: [{ id?: any, text: string, to: "ko" | "vi" | "ru" | ... }] }  (한 번에 20개까지)
//  📒 { visit: "예약확인증 열쇠", to: "ko" } — 가게가 쓴 시술 기록(손님용 메모)을 손님 말로 번역해 저장 (universe42)
//  📋 { survey: "예약확인증 열쇠" } — 방문 전 질문에 손님이 쓴 글을 베트남어 · 한국어로 번역해 저장 (로그인 필요 없음 · DB 에 있는 글만)
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
Input format: each item starts with a line "@@<number> -> <target code>", followed by the text.
Output format (plain text, no JSON, no code block): for EVERY item write a line "@@<same number> <detected source code>" and on the following line(s) only the translation. Nothing else.`;

Deno.serve(async (req) => {
  const h = { ...cors(req.headers.get("origin")), "Content-Type": "application/json" };
  const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: h });
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return out({ error: "POST only" }, 405);
  const b = await req.json().catch(() => ({}));
  // 📋 방문 전 질문: 손님이 쓴 글을 가게(베트남어) · 엉클데이(한국어)가 읽을 수 있게 번역 (universe38)
  //    예약확인증 열쇠로 DB 에 저장된 손님 글만 번역해요 — 아무 글이나 번역해 주지 않아요
  if (typeof b.survey === "string" && b.survey.length >= 16 && b.survey.length <= 64) {
    if (!KEY) return out({ ok: false });
    const anon = createClient(URL, ANON);
    const { data: sv } = await anon.rpc("survey_get", { t: b.survey });
    if (!sv || !sv.answers) return out({ ok: false });
    const src = String(sv.lang || "");
    const want = ["vi", "ko"].filter(l => l !== src);
    const its: { id: string; text: string; to: string }[] = [];
    for (const [id, a] of Object.entries(sv.answers as Record<string, any>).slice(0, 20)) {
      if (!a || a.tr) continue;
      const text = String(a.d || (typeof a.v === "string" && !["y", "n"].includes(a.v) ? a.v : "")).trim().slice(0, 600);
      if (text) want.forEach(to => its.push({ id, text, to }));
    }
    if (!its.length) return out({ ok: true, n: 0 });
    const ub = its.slice(0, 20).map((x, n) => `@@${n + 1} -> ${x.to} (${LANGS[x.to]})\n${x.text}`).join("\n\n");
    const r2 = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 3000, system: SYSTEM, messages: [{ role: "user", content: ub }] }),
    });
    const j2 = await r2.json().catch(() => ({}));
    if (!r2.ok) return out({ ok: false });
    const txt = (j2.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("").replace(/```[a-z]*\n?/gi, "").trim();
    const parts = txt.split(/^\s*@@\s*(\d+)[ \t]*([A-Za-z]{2}(?:-[A-Za-z]{2})?)?[^\S\n]*(?:\([^)\n]*\))?[ \t]*$/m);
    const tr: Record<string, Record<string, string>> = {};
    for (let k = 1; k < parts.length; k += 3) { const x = its[+parts[k] - 1], t2 = (parts[k + 2] || "").trim(); if (x && t2) (tr[x.id] = tr[x.id] || {})[x.to] = t2.slice(0, 600); }
    if (Object.keys(tr).length) await anon.rpc("survey_tr_save", { t: b.survey, tr });
    return out({ ok: true, n: Object.keys(tr).length });
  }
  // 📒 시술 기록 (universe42): { visit: 예약확인증 열쇠, to: 손님 말 } — 가게가 쓴 '손님용 메모' 를 손님 말로 번역해 저장 (DB 에 있는 글만)
  if (typeof b.visit === "string" && b.visit.length >= 16 && b.visit.length <= 64 && LANGS[b.to]) {
    if (!KEY) return out({ ok: false });
    const anon = createClient(URL, ANON);
    const { data: src } = await anon.rpc("visit_tr_src", { t: b.visit, lg: b.to });
    const its = (Array.isArray(src) ? src : []).slice(0, 15).map((x: any) => ({ id: x.id, text: String(x.text || "").slice(0, 1000) })).filter((x: any) => x.text);
    if (!its.length) return out({ ok: true, n: 0 });
    const ub = its.map((x: any, n: number) => `@@${n + 1} -> ${b.to} (${LANGS[b.to]})\n${x.text}`).join("\n\n");
    const r3 = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 3000, system: SYSTEM, messages: [{ role: "user", content: ub }] }),
    });
    const j3 = await r3.json().catch(() => ({}));
    if (!r3.ok) return out({ ok: false });
    const txt = (j3.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("").replace(/```[a-z]*\n?/gi, "").trim();
    const parts = txt.split(/^\s*@@\s*(\d+)[ \t]*([A-Za-z]{2}(?:-[A-Za-z]{2})?)?[^\S\n]*(?:\([^)\n]*\))?[ \t]*$/m);
    let n = 0;
    for (let k = 1; k < parts.length; k += 3) { const x = its[+parts[k] - 1], t2 = (parts[k + 2] || "").trim(); if (x && t2) { await anon.rpc("visit_tr_save", { t: b.visit, bid: x.id, lg: b.to, txt: t2.slice(0, 1500) }); n++; } }
    return out({ ok: true, n });
  }
  const caller = createClient(URL, ANON, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
  const { data: isStaff, error: e1 } = await caller.rpc("is_staff");
  if (e1 || isStaff !== true) return out({ error: "Staff only" }, 403);
  if (!KEY) return out({ error: "ANTHROPIC_API_KEY 비밀값이 아직 없어요 (Supabase → Edge Functions → Secrets)" }, 400);

  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 20)
    .map((x: any, i: number) => ({ i, id: x.id ?? i, text: String(x.text || "").slice(0, 2000), to: LANGS[x.to] ? x.to : "ko" }))
    .filter((x: any) => x.text.trim());
  if (!items.length) return out({ items: [] });
  // 번호(@@1, @@2 …)로 주고받아요 — JSON 은 따옴표 · 줄바꿈 때문에 깨지기 쉬워서요
  const user = items.map((x: any, n: number) => `@@${n + 1} -> ${x.to} (${LANGS[x.to]})\n${x.text}`).join("\n\n");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, system: SYSTEM, messages: [{ role: "user", content: user }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return out({ error: "AI 호출 실패: " + ((j.error && j.error.message) || r.status) }, 502);
  const text = (j.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("").replace(/```[a-z]*\n?/gi, "").trim();
  const got: Record<number, { src: string | null; text: string }> = {};
  const parts = text.split(/^\s*@@\s*(\d+)[ \t]*([A-Za-z]{2}(?:-[A-Za-z]{2})?)?[^\S\n]*(?:\([^)\n]*\))?[ \t]*$/m);   // ["앞", "1", "ru", "번역…", …]
  for (let k = 1; k < parts.length; k += 3) { const n = +parts[k] - 1, t = (parts[k + 2] || "").trim(); if (t) got[n] = { src: parts[k + 1] ? (/^zh-tw$/i.test(parts[k + 1]) ? "zh-TW" : parts[k + 1].toLowerCase()) : null, text: t }; }
  if (!Object.keys(got).length) return out({ error: "AI 답을 읽지 못했어요: " + text.slice(0, 160).replace(/\s+/g, " ") }, 502);
  return out({ model: MODEL, items: items.map((x: any, n: number) => ({ id: x.id, src: got[n] ? got[n].src : null, to: x.to, text: String(got[n] ? got[n].text : x.text).slice(0, 2000) })) });
});

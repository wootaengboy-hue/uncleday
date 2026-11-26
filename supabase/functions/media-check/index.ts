// 🖼️ 이미지 AI 검수 (Claude) — 엉클데이 직원만
//  포털 🖼️ 이미지 검수에서 [🤖 AI 검사]를 누르면, 작업본 사진을 보고 문제를 찾아 돌려줘요.
//  판정(통과 · 문제 · 보류)은 사람이 해요. AI 결과는 참고만 (자동 공개 없음).
//  🔗 이미지 링크 모드: { fetch: "https://…jpg" } → 다른 사이트 사진을 대신 받아 돌려줘요 (직원만 · 10MB · 사진 파일만)
//  필요한 비밀값: ANTHROPIC_API_KEY (블로그 AI 와 같은 값 · Supabase → Edge Functions → Secrets)
//  배포: Supabase → Edge Functions → Deploy a new function → 이름 media-check → 이 코드 붙여넣기 (Verify JWT 켜 둠)
import { createClient } from "jsr:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const MODEL = Deno.env.get("MEDIA_AI_MODEL") || "claude-sonnet-5-5";
const ALLOW = ["https://www.uncleday.com", "https://uncleday.com"];
const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && (ALLOW.includes(origin) || origin.startsWith("http://localhost")) ? origin : ALLOW[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

const SYSTEM = `당신은 베트남 마사지 · 스파 · 뷰티 · 클리닉 예약 사이트 '엉클데이'의 사진 검수 담당이에요.
가게 소개에 쓸 사진 한 장을 보고, 손님에게 그대로 보여 줘도 되는지 문제를 찾아요. 판정은 사람이 하니, 보이는 사실만 짧게 적어요.
문제 코드 (해당하는 것만):
- text: 사진 안에 큰 글자 · 가격표 · 광고 문구
- watermark: 다른 회사 · 사이트의 워터마크나 로고
- face: 알아볼 수 있는 사람 얼굴 (손님 · 직원)
- body: 노출이 많거나 선정적으로 보일 수 있는 장면
- blur: 흐리거나 어둡거나 너무 작음
- distort: 늘어나거나 찌그러짐, 이상한 비율
- fake: AI 로 만든 것 같거나 과하게 보정해 실제 가게와 달라 보일 수 있음
- stock: 인터넷에서 흔히 쓰는 스톡 사진 같음 (실제 가게 사진이 아닐 수 있음)
- off: 가게와 관계없어 보이는 사진 (음식 · 풍경 · 제품만 등)
반드시 아래 JSON 하나만 출력해요:
{"issues": ["코드", ...], "what": "무엇이 찍혔는지 한 줄 (한국어)", "note": "문제가 있으면 이유 한두 줄, 없으면 빈 문자열"}`;

// 💳 AI 사용량 기록 (universe52 ai_usage · 포털 '💳 AI 사용량'에서 대략 잔액 계산) — 실패해도 본 기능엔 영향 없어요
//  SUPABASE_SERVICE_ROLE_KEY 는 Supabase 가 자동으로 넣어 줘요 (따로 만들거나 채팅에 적지 않아요)
async function logUse(fn: string, model: string, u: any, ref = "") {
  try {
    const k = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "", base = Deno.env.get("SUPABASE_URL") || "";
    if (!k || !base || !u) return;
    const h: Record<string, string> = { apikey: k, "Content-Type": "application/json", Prefer: "return=minimal" };
    if (k.startsWith("eyJ")) h.Authorization = "Bearer " + k;
    await fetch(base + "/rest/v1/ai_usage", { method: "POST", headers: h, body: JSON.stringify({ fn, model: String(model || ""),
      input_tokens: +u.input_tokens || 0, output_tokens: +u.output_tokens || 0, cache_read: +u.cache_read_input_tokens || 0, cache_write: +u.cache_creation_input_tokens || 0, ref: String(ref || "").slice(0, 80) }) });
  } catch (_) { /* 기록 실패는 무시 */ }
}

Deno.serve(async (req) => {
  const h = { ...cors(req.headers.get("origin")), "Content-Type": "application/json" };
  const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: h });
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return out({ error: "POST only" }, 405);
  const caller = createClient(SB_URL, ANON, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
  const { data: staff, error: e1 } = await caller.rpc("is_staff");
  if (e1 || staff !== true) return out({ error: "엉클데이 직원만 쓸 수 있어요" }, 403);

  const b = await req.json().catch(() => ({}));
  // 🔗 이미지 링크 모드: 다른 사이트 사진은 브라우저가 바로 못 가져와서(보안) 서버가 대신 받아 돌려줘요 (저장은 관리자 화면이 해요)
  if (b.fetch) {
    const fu = String(b.fetch);
    if (!/^https?:\/\/[^\s]+$/.test(fu) || /^https?:\/\/(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/i.test(fu)) return out({ error: "사진 주소가 올바르지 않아요" }, 400);
    try {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 15000);
      const r = await fetch(fu, { signal: ctl.signal, redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (UncleDay image review)" } }); clearTimeout(tm);
      if (!r.ok) return out({ error: `사이트가 사진을 주지 않았어요 (${r.status})` }, 502);
      const ct = r.headers.get("content-type") || "";
      if (!/^image\/(jpeg|png|webp|gif|avif)/i.test(ct)) return out({ error: "사진 파일 주소가 아니에요 (사진 위 오른쪽 클릭 → '이미지 주소 복사')" }, 400);
      const buf = new Uint8Array(await r.arrayBuffer());
      if (buf.length > 10 * 1024 * 1024) return out({ error: "10MB 보다 큰 사진은 가져올 수 없어요" }, 400);
      return new Response(buf, { status: 200, headers: { ...cors(req.headers.get("origin")), "Content-Type": ct } });
    } catch (_) { return out({ error: "사진을 가져오지 못했어요 (시간 초과 · 주소 확인)" }, 502); }
  }
  if (!KEY) return out({ error: "ANTHROPIC_API_KEY 비밀값이 아직 없어요 (Supabase → Edge Functions → Secrets)" }, 400);
  const url = String(b.url || "");
  // 우리 저장소에 올린 사진만 검사해요 (아무 주소나 보내지 못하게)
  if (!url.startsWith(SB_URL + "/storage/v1/object/public/images/")) return out({ error: "엉클데이 저장소 사진만 검사할 수 있어요" }, 400);

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 600, system: SYSTEM, messages: [{ role: "user", content: [
      { type: "image", source: { type: "url", url } },
      { type: "text", text: `가게: ${String(b.shop || "").slice(0, 80)} (${String(b.kind || "").slice(0, 30)})` },
    ] }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (r.ok) await logUse("media-check", MODEL, j.usage, String(b.shop || "").slice(0, 60));
  if (!r.ok) return out({ error: "AI 호출 실패: " + ((j.error && j.error.message) || r.status) }, 502);
  const text = (j.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("").trim();
  const m = text.match(/\{[\s\S]*\}/);
  try {
    const d = JSON.parse(m ? m[0] : text);
    const OK = ["text", "watermark", "face", "body", "blur", "distort", "fake", "stock", "off"];
    return out({ issues: (Array.isArray(d.issues) ? d.issues : []).filter((x: string) => OK.includes(x)),
      what: String(d.what || "").slice(0, 120), note: String(d.note || "").slice(0, 300), model: MODEL });
  } catch (_) { return out({ error: "AI 답을 읽지 못했어요. 한 번 더 눌러 주세요" }, 502); }
});

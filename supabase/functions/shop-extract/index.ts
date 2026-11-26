// 📥 업체 정보 가져오기 (Claude) — 엉클데이 직원만
//  포털 🔍 업체 정보 검수에서 업체 홈페이지 · 메뉴(가격표) 페이지 · 가격표 사진 주소를 넣고 [가져오기]를 누르면
//  그 페이지(또는 사진)에서 영업시간 · 주소 · 전화 · 메뉴와 가격을 뽑아 돌려줘요.
//  결과는 '모아 온 정보'(초안)로만 저장돼요. 손님 화면에 넣는 건 사람이 [넣기] · 직접 고치기로 해요.
//  페이스북은 로그인 벽 때문에 대부분 못 읽어요 → 사람이 보고 넣거나, 가격표를 캡처해서 붙여 넣어요.
//  필요한 비밀값: ANTHROPIC_API_KEY (블로그 AI 와 같은 값)
//  배포: Supabase → Edge Functions → Deploy a new function → 이름 shop-extract → 이 코드 (Verify JWT 는 media-check 와 같게)
import { createClient } from "jsr:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const MODEL = Deno.env.get("EXTRACT_AI_MODEL") || "claude-sonnet-5-5";
const ALLOW = ["https://www.uncleday.com", "https://uncleday.com"];
const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && (ALLOW.includes(origin) || origin.startsWith("http://localhost")) ? origin : ALLOW[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

const SYSTEM = `당신은 베트남 마사지 · 스파 · 뷰티 · 클리닉 예약 사이트 '엉클데이'의 정보 정리 담당이에요.
업체 홈페이지 글(또는 가격표 사진)을 받으면, 그 안에 실제로 적힌 사실만 뽑아요.
규칙:
- 적혀 있지 않은 것은 null. 가격 · 시간을 추측하거나 계산해서 만들지 마세요.
- 가격은 원문 그대로 (예: "552.000đ", "từ 630.000đ", "$25", "1,257,000++ VND").
- 같은 코스가 시간별로 가격이 다르면 시간마다 한 줄씩.
- name 은 원문 그대로, name_ko 는 한국 여행객이 알아보기 쉬운 짧은 한국어 이름.
- 메뉴는 대표적인 것 위주로 30개까지.
- features 는 사실만 한국어 짧은 문장 (예: "무료 픽업", "한국어 응대") 3개까지. 광고 문구는 빼요.
- 반영구 화장 · 문신(phun xăm) 시술이 있으면 note 에 꼭 적어요.
반드시 아래 JSON 하나만 출력해요:
{"hours": "09:00 - 22:00" 또는 null, "address": 문자열 또는 null, "phone": 문자열 또는 null,
 "menu": [{"name": "...", "name_ko": "...", "minutes": 숫자 또는 null, "price": "..." 또는 null}],
 "features": ["..."], "note": "확인이 필요한 점 한두 줄 (없으면 빈 문자열)"}`;

const BLOCK = /^https?:\/\/(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[)/i;
function pageText(html: string) {
  // 가격표 그림일 수 있는 사진 주소도 따로 모아요 (이름에 menu · price · bang-gia · bảng giá 등)
  const imgs: string[] = [];
  for (const m of html.matchAll(/<img[^>]+(?:data-src|src)=["']([^"']+)["'][^>]*>/gi)) {
    const tag = m[0].toLowerCase(), src = m[1];
    if (/menu|price|bang-?gia|banggia|gia-|pricelist|brochure|service/.test(src.toLowerCase() + tag)) imgs.push(src);
  }
  const t = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h\d)[^>]*>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#8363;|&#x20ab;/gi, "₫").replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  return { text: t.slice(0, 60000), imgs: [...new Set(imgs)].slice(0, 6) };
}

Deno.serve(async (req) => {
  const h = { ...cors(req.headers.get("origin")), "Content-Type": "application/json" };
  const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: h });
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return out({ error: "POST only" }, 405);
  const caller = createClient(SB_URL, ANON, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
  const { data: staff, error: e1 } = await caller.rpc("is_staff");
  if (e1 || staff !== true) return out({ error: "엉클데이 직원만 쓸 수 있어요" }, 403);
  if (!KEY) return out({ error: "ANTHROPIC_API_KEY 비밀값이 아직 없어요 (Supabase → Edge Functions → Secrets)" }, 400);

  const b = await req.json().catch(() => ({}));
  const url = String(b.url || "").trim();
  if (!/^https?:\/\/\S+$/.test(url) || BLOCK.test(url)) return out({ error: "주소가 올바르지 않아요 (https://… )" }, 400);
  if (/facebook\.com|fb\.com|instagram\.com/i.test(url)) return out({ error: "페이스북 · 인스타그램은 로그인 벽 때문에 자동으로 못 읽어요. 직접 보고 넣거나, 가격표를 캡처해서 붙여 넣어 주세요" }, 400);

  // 1) 주소 열기
  let r: Response;
  try {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 20000);
    r = await fetch(url, { signal: ctl.signal, redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (UncleDay shop info review)", "Accept-Language": "vi,en;q=0.8,ko;q=0.6" } });
    clearTimeout(tm);
  } catch (_) { return out({ error: "페이지를 열지 못했어요 (시간 초과 · 주소 확인)" }, 502); }
  if (!r.ok) return out({ error: `사이트가 페이지를 주지 않았어요 (${r.status})` }, 502);
  const ct = r.headers.get("content-type") || "";

  // 2) Claude 에게 보낼 내용: 사진이면 사진 그대로, 페이지면 글 + 가격표로 보이는 사진 최대 3장
  const content: unknown[] = [];
  let imgsUsed: string[] = [];
  if (/^image\//i.test(ct)) {
    content.push({ type: "image", source: { type: "url", url } }, { type: "text", text: `이 사진은 업체 가격표예요. 업체: ${String(b.shop || "").slice(0, 80)}` });
  } else {
    const html = (await r.text()).slice(0, 2_000_000);
    const { text, imgs } = pageText(html);
    const abs = imgs.map(s => { try { return new URL(s, r.url || url).toString(); } catch (_) { return ""; } }).filter(s => /^https:\/\//.test(s) && !BLOCK.test(s));
    imgsUsed = abs.slice(0, 3);
    for (const s of imgsUsed) content.push({ type: "image", source: { type: "url", url: s } });
    content.push({ type: "text", text: `업체: ${String(b.shop || "").slice(0, 80)}\n주소: ${url}\n${imgsUsed.length ? `(위 사진 ${imgsUsed.length}장은 페이지 안의 가격표로 보이는 사진이에요)\n` : ""}--- 페이지 글 ---\n${text || "(글이 거의 없어요)"}` });
  }

  const ai = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, system: SYSTEM, messages: [{ role: "user", content }] }),
  });
  const j = await ai.json().catch(() => ({}));
  if (!ai.ok) {
    // 사진을 못 읽었으면 글만으로 한 번 더
    if (imgsUsed.length) return out({ error: "AI 호출 실패 (사진을 읽지 못함): " + ((j.error && j.error.message) || ai.status) + " · 가격표 사진 주소를 따로 넣어 보세요" }, 502);
    return out({ error: "AI 호출 실패: " + ((j.error && j.error.message) || ai.status) }, 502);
  }
  const text = (j.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("").trim();
  const m = text.match(/\{[\s\S]*\}/);
  try {
    const d = JSON.parse(m ? m[0] : text);
    const s = (v: unknown, n: number) => (v == null || v === "" ? null : String(v).slice(0, n));
    return out({
      hours: s(d.hours, 120), address: s(d.address, 240), phone: s(d.phone, 60),
      menu: (Array.isArray(d.menu) ? d.menu : []).slice(0, 30).map((x: any) => ({ name: String(x.name || "").slice(0, 120), name_ko: s(x.name_ko, 80), minutes: +x.minutes || null, price: s(x.price, 60) })).filter((x: any) => x.name),
      features: (Array.isArray(d.features) ? d.features : []).slice(0, 3).map((x: unknown) => String(x).slice(0, 80)),
      note: s(d.note, 300) || "", src: [url, ...imgsUsed], model: MODEL,
    });
  } catch (_) { return out({ error: "AI 답을 읽지 못했어요. 한 번 더 눌러 주세요" }, 502); }
});

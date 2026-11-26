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
- 가격표가 분류로 나뉘어 있으면 section 에 원문 분류, section_ko 에 한국어 분류. 분류 안에 또 분류가 있으면 "대분류 > 소분류" (예: section "Nails > Men", section_ko "네일 > 남성"). 마사지 · 스파 코스는 "스파", 네일은 "네일 > 여성"처럼 같은 가게 안에서 이름을 똑같이 맞춰요. 한 가게에 분류가 하나뿐이면 null.
- 메뉴 설명이 적혀 있으면 desc 에 원문 설명을 짧게 (120자 안쪽), desc_ko 에 한국어 설명 한 줄. 한국어 설명이 원문에 있으면 그대로 써요. 없으면 null.
- "851.000 / 70.000" 처럼 가격 옆에 관리사 팁 · 추가 요금이 따로 적혀 있으면 price 는 앞 가격만, tip 에 뒤 금액 (원문 그대로).
- 인원 · 시간대 · 재방문 · 첫 방문 · 리뷰 같은 조건 할인이 적혀 있으면 deals 에 한국어 한 줄씩 (예: "2인 방문 20% 할인", "11:00-13:00 2인 이상 40% 할인"). 5개까지.
- 메뉴는 대표적인 것 위주로 40개까지.
- features 는 사실만 한국어 짧은 문장 (예: "무료 픽업", "한국어 응대") 3개까지. 광고 문구는 빼요.
- 반영구 화장 · 문신(phun xăm) 시술이 있으면 note 에 꼭 적어요.
반드시 아래 JSON 하나만 출력해요:
{"name": "업체 이름 (원문 · 간판에 쓰는 이름)" 또는 null, "name_ko": "한국어로 읽는 이름" 또는 null, "hours": "09:00 - 22:00" 또는 null, "address": 문자열 또는 null, "phone": 문자열 또는 null,
 "menu": [{"name": "...", "name_ko": "...", "minutes": 숫자 또는 null, "price": "..." 또는 null, "tip": "..." 또는 null, "section": "..." 또는 null, "section_ko": "..." 또는 null, "desc": "..." 또는 null, "desc_ko": "..." 또는 null}],
 "features": ["..."], "deals": ["..."], "note": "확인이 필요한 점 한두 줄 (없으면 빈 문자열)"}`;

const BLOCK = /^https?:\/\/(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[)/i;
// 베트남어 글자가 &#7845; 같은 숫자 표기로 들어 있는 사이트가 많아요 → 진짜 글자로 바꿔요 (안 바꾸면 "Võ Nguyên" 이 "V Nguy n" 처럼 깨져요)
const NAMED: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", middot: "·", times: "×", deg: "°",
  agrave: "à", aacute: "á", acirc: "â", atilde: "ã", egrave: "è", eacute: "é", ecirc: "ê", igrave: "ì", iacute: "í", ograve: "ò", oacute: "ó", ocirc: "ô", otilde: "õ", ugrave: "ù", uacute: "ú", yacute: "ý",
  Agrave: "À", Aacute: "Á", Acirc: "Â", Atilde: "Ã", Egrave: "È", Eacute: "É", Ecirc: "Ê", Igrave: "Ì", Iacute: "Í", Ograve: "Ò", Oacute: "Ó", Ocirc: "Ô", Otilde: "Õ", Ugrave: "Ù", Uacute: "Ú", Yacute: "Ý" };
function decode(t: string) {
  return t.replace(/&#x([0-9a-f]+);/gi, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch (_e) { return " "; } })
    .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(+d); } catch (_e) { return " "; } })
    .replace(/&([a-z]+);/gi, (m, n) => NAMED[n] ?? " ");
}
const PRICEY = /menu|price|pricing|bang-?gia|banggia|gia-|pricelist|brochure|service|program|treatment|lieu-trinh|dich-vu|spa-menu|massage|goi|package|combo/;
function pageText(html: string, base: string) {
  // 가격표 그림일 수 있는 사진 (이름 · 설명에 menu · price · bảng giá 등)
  const imgs: string[] = [];
  for (const m of html.matchAll(/<img[^>]+(?:data-src|data-lazy-src|src)=["']([^"']+)["'][^>]*>/gi)) {
    const tag = m[0].toLowerCase(), src = m[1];
    if (/\.svg|logo|icon|avatar|flag/.test(src.toLowerCase())) continue;
    if (PRICEY.test(decodeURIComponent(src).toLowerCase() + tag)) imgs.push(src);
  }
  // 같은 사이트 안의 메뉴 · 가격 · 연락처 페이지 링크
  const links: string[] = []; let host = ""; try { host = new URL(base).host; } catch (_) {}
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let u = ""; try { u = new URL(m[1], base).toString(); } catch (_) { continue; }
    if (!u.startsWith("http") || new URL(u).host !== host) continue;
    const label = decode(m[2].replace(/<[^>]+>/g, " ")).toLowerCase(), path = decodeURIComponent(u).toLowerCase();
    if (/\.(jpg|jpeg|png|webp|pdf|zip)(\?|$)/.test(path)) continue;
    let sc = 0;
    if (/menu|price|pricing|bang-?gia|banggia|gia|program|treatment|lieu-trinh|dich-vu|service|spa-menu|massage|goi|package|combo/.test(path)) sc += 2;
    if (/menu|price|가격|메뉴|프로그램|bảng giá|giá|dịch vụ|liệu trình|treatment|service|program|massage/.test(label)) sc += 2;
    if (/contact|lien-he|about|gioi-thieu|location|chi-nhanh|branch/.test(path) || /contact|liên hệ|연락|오시는|location/.test(label)) sc += 1;
    if (sc) links.push(sc + "|" + u.replace(/#.*$/, ""));
  }
  const top = [...new Set(links.sort((a, b) => +b.split("|")[0] - +a.split("|")[0]).map(x => x.slice(x.indexOf("|") + 1)))].filter(u => u.replace(/\/$/, "") !== base.replace(/\/$/, ""));
  const t = decode(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h\d|\/td)[^>]*>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  return { text: t, imgs: [...new Set(imgs)], links: top };
}
async function getPage(u: string, ms = 15000) {
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(u, { signal: ctl.signal, redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (UncleDay shop info review)", "Accept-Language": "vi,en;q=0.8,ko;q=0.6" } }); return r; }
  finally { clearTimeout(tm); }
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
  try { r = await getPage(url, 20000); } catch (_) { return out({ error: "페이지를 열지 못했어요 (시간 초과 · 주소 확인)" }, 502); }
  if (!r.ok) return out({ error: `사이트가 페이지를 주지 않았어요 (${r.status})` }, 502);
  const ct = r.headers.get("content-type") || "";

  // 2) Claude 에게 보낼 내용
  //    사진이면 사진 그대로
  //    페이지면: 첫 페이지 + 같은 사이트의 메뉴 · 가격 · 연락처 페이지 최대 4개를 더 읽고, 가격표로 보이는 사진 최대 4장
  const content: unknown[] = [];
  let imgsUsed: string[] = [], pagesRead: string[] = [];
  if (/^image\//i.test(ct)) {
    content.push({ type: "image", source: { type: "url", url } }, { type: "text", text: `이 사진은 업체 가격표예요. 업체: ${String(b.shop || "").slice(0, 80)}` });
  } else {
    const base = r.url || url;
    const first = pageText((await r.text()).slice(0, 2_000_000), base);
    const more = await Promise.all(first.links.slice(0, 4).map(async u => {
      try { const x = await getPage(u, 12000); if (!x.ok || !/html/i.test(x.headers.get("content-type") || "")) return null;
        return { u, ...pageText((await x.text()).slice(0, 1_500_000), x.url || u) }; } catch (_) { return null; } }));
    const pages = [{ u: base, ...first }, ...more.filter(Boolean) as { u: string; text: string; imgs: string[] }[]];
    pagesRead = pages.map(p => p.u);
    let budget = 70000; const parts: string[] = [];
    for (const p of pages) { const piece = p.text.slice(0, Math.max(0, Math.min(budget, p === pages[0] ? 30000 : 20000))); budget -= piece.length; parts.push(`--- 페이지: ${p.u} ---\n${piece || "(글이 거의 없어요)"}`); if (budget <= 0) break; }
    const allImgs = pages.flatMap(p => p.imgs.map(s => { try { return new URL(s, p.u).toString(); } catch (_) { return ""; } })).filter(s => /^https:\/\//.test(s) && !BLOCK.test(s));
    imgsUsed = [...new Set(allImgs)].slice(0, 4);
    for (const s of imgsUsed) content.push({ type: "image", source: { type: "url", url: s } });
    content.push({ type: "text", text: `업체: ${String(b.shop || "").slice(0, 80)}\n처음 주소: ${url}\n읽은 페이지 ${pages.length}개${imgsUsed.length ? ` · 위 사진 ${imgsUsed.length}장은 페이지 안의 메뉴 · 가격표로 보이는 사진이에요 (사진 속 가격도 읽어 주세요)` : ""}\n\n${parts.join("\n\n")}` });
  }

  const ask = (c: unknown[]) => fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 8000, system: SYSTEM, messages: [{ role: "user", content: c }] }),
  });
  let ai = await ask(content);
  // 사진 하나라도 못 읽으면 (사이트가 막음 · 너무 큼) 글만으로 한 번 더
  if (!ai.ok && imgsUsed.length && content.some((x: any) => x.type === "text")) { imgsUsed = []; ai = await ask(content.filter((x: any) => x.type === "text")); }
  const j = await ai.json().catch(() => ({}));
  if (!ai.ok) {
    if (imgsUsed.length) return out({ error: "AI 호출 실패 (사진을 읽지 못함): " + ((j.error && j.error.message) || ai.status) + " · 가격표 사진 주소를 따로 넣어 보세요" }, 502);
    return out({ error: "AI 호출 실패: " + ((j.error && j.error.message) || ai.status) }, 502);
  }
  const text = (j.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("").trim();
  const m = text.match(/\{[\s\S]*\}/);
  try {
    const d = JSON.parse(m ? m[0] : text);
    const s = (v: unknown, n: number) => (v == null || v === "" ? null : String(v).slice(0, n));
    return out({
      name: s(d.name, 100), name_ko: s(d.name_ko, 60), hours: s(d.hours, 120), address: s(d.address, 240), phone: s(d.phone, 60),
      menu: (Array.isArray(d.menu) ? d.menu : []).slice(0, 40).map((x: any) => ({ name: String(x.name || "").slice(0, 120), name_ko: s(x.name_ko, 80), minutes: +x.minutes || null, price: s(x.price, 60),
        tip: s(x.tip, 40), section: s(x.section, 40), section_ko: s(x.section_ko, 30), desc: s(x.desc, 200), desc_ko: s(x.desc_ko, 160) })).filter((x: any) => x.name),
      deals: (Array.isArray(d.deals) ? d.deals : []).slice(0, 5).map((x: unknown) => String(x).slice(0, 80)),
      features: (Array.isArray(d.features) ? d.features : []).slice(0, 3).map((x: unknown) => String(x).slice(0, 80)),
      note: s(d.note, 300) || "", src: [...new Set([url, ...pagesRead, ...imgsUsed])].slice(0, 10), model: MODEL,
    });
  } catch (_) { return out({ error: "AI 답을 읽지 못했어요. 한 번 더 눌러 주세요" }, 502); }
});

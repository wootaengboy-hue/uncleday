// 구글 서치 콘솔 숫자 가져오기 (Supabase Edge Function: gsc)
// 관리자 포털 '🔎 검색 유입' · '🔎 엉클데이 서치 콘솔'에서 불러요. 부른 사람이 관리자인지 먼저 확인해요.
//   action 없음 : 노출 · 클릭 · 순위 · 검색어 · 페이지
//   "sitemaps"  : 제출한 사이트맵 상태
//   "inspect"   : 주소 하나의 색인 상태 (URL 검사) → seo_index 표에 저장 (universe24.sql)
//   "sweep"     : 사이트맵의 페이지를 오래된 순으로 n개(기본 70) 확인 → seo_index 저장
//                 깃허브 자동 작업이 매시간 '수집 열쇠'(x-crawl-token)로 불러요. 구글 한도: 하루 2,000건
//   - 구글 검색에서 우리 사이트가 몇 번 보였는지(노출) · 몇 번 눌렸는지(클릭) · 평균 순위 · 검색어 · 페이지
//   - 구글은 보통 2~3일 늦게 숫자를 줘요.
// 필요한 비밀 값 (Supabase → Edge Functions → Secrets 에 사장님이 직접 넣어요. 채팅으로 보내지 마세요):
//   GSC_KEY  : 구글 클라우드 서비스 계정 JSON 키 파일 내용 전체
//   GSC_SITE : (선택) 서치 콘솔 속성 이름. 비워 두면 uncleday 가 들어간 속성을 알아서 찾아요.
// 설정: "Verify JWT" 는 꺼도 돼요. 아래에서 부른 사람의 로그인 정보로 관리자인지 직접 확인해요.

import { createClient } from "jsr:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = "https://www.uncleday.com";
const ALLOW = ["https://www.uncleday.com", "https://uncleday.com"];
const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && (ALLOW.includes(origin) || origin.startsWith("http://localhost")) ? origin : ALLOW[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-crawl-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

const b64url = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === "string" ? new TextEncoder().encode(b) : new Uint8Array(b);
  let s = ""; for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

let cached: { token: string; exp: number } | null = null;
async function googleToken(key: { client_email: string; private_key: string; token_uri?: string }) {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const now = Math.floor(Date.now() / 1000), aud = key.token_uri || "https://oauth2.googleapis.com/token";
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ iss: key.client_email, scope: "https://www.googleapis.com/auth/webmasters.readonly", aud, iat: now, exp: now + 3600 }));
  const pem = key.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const k = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", k, new TextEncoder().encode(`${head}.${body}`));
  const r = await fetch(aud, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${body}.${b64url(sig)}` }) });
  const j = await r.json();
  if (!r.ok) throw new Error("구글 로그인 실패: " + (j.error_description || j.error || r.status));
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return cached.token;
}

const kindOf = (u: string) => {
  const p = u.replace(SITE_URL, "") || "/";
  if (p === "/") return "홈";
  const en = p.startsWith("/en/") ? " (영어)" : ""; const q = p.replace(/^\/en/, "");
  if (q.startsWith("/s/")) return "업체" + en;
  if (q.startsWith("/p/")) return q.includes("/vi/") ? "미입점 (베트남어)" : "미입점";
  if (q.startsWith("/blog/")) return "블로그";
  if (/^\/c\/[a-z]+\/$/.test(q)) return "도시" + en;
  if (/\/guide\/$/.test(q)) return "가이드" + en;
  if (/\/price\//.test(q)) return "가격" + en;
  if (/\/more\/$/.test(q)) return "미입점 목록";
  if (q.startsWith("/c/")) return "주제" + en;
  return "기타";
};

Deno.serve(async (req) => {
  const h = { ...cors(req.headers.get("origin")), "Content-Type": "application/json" };
  const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: h });
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return out({ error: "POST only" }, 405);

  const b = await req.json().catch(() => ({}));
  const db = createClient(URL, SERVICE, { auth: { persistSession: false } });
  // 1) 관리자만 — 단, 'sweep'은 깃허브 자동 작업이 수집 열쇠로도 불러요
  const tok = req.headers.get("x-crawl-token") || "";
  let ok = false;
  if (tok && b.action === "sweep") { const { data } = await db.rpc("crawl_tok_check", { tok }); ok = data === true; }
  if (!ok) {
    const caller = createClient(URL, ANON, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: isAdmin, error: e1 } = await caller.rpc("is_admin");
    if (e1 || isAdmin !== true) return out({ error: "Admins only" }, 403);
  }

  // 2) 키 읽기
  const raw = Deno.env.get("GSC_KEY");
  if (!raw) return out({ error: "setup", step: "key", message: "Supabase Secrets 에 GSC_KEY 가 아직 없어요." }, 200);
  let key; try { key = JSON.parse(raw); } catch { return out({ error: "setup", step: "key", message: "GSC_KEY 가 JSON 키 파일 내용 전체가 아니에요. 파일을 메모장으로 열어 { 부터 } 까지 전부 넣어 주세요." }, 200); }

  try {
    const token = await googleToken(key);
    const g = (path: string, body?: unknown) => fetch("https://www.googleapis.com/webmasters/v3/" + path, {
      method: body ? "POST" : "GET", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error?.message || String(r.status)); return j; });

    // 3) 속성 찾기
    let site = Deno.env.get("GSC_SITE") || "";
    if (!site) {
      const list = await g("sites");
      const mine = (list.siteEntry || []).filter((s: { siteUrl: string; permissionLevel: string }) => /uncleday/.test(s.siteUrl) && s.permissionLevel !== "siteUnverifiedUser");
      site = (mine.find((s: { siteUrl: string }) => s.siteUrl.startsWith("sc-domain:")) || mine[0] || {}).siteUrl || "";
      if (!site) return out({ error: "setup", step: "share", email: key.client_email, message: "서치 콘솔에서 이 서비스 계정을 사용자로 추가해야 해요." }, 200);
    }

    if (b.action === "sitemaps") { const j = await g(`sites/${encodeURIComponent(site)}/sitemaps`); return out({ site, sitemaps: j.sitemap || [] }); }
    if (b.action === "inspect" || b.action === "sweep") {
      const inspect = async (u: string) => {
        const r = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
          body: JSON.stringify({ inspectionUrl: u, siteUrl: site, languageCode: "ko-KR" }) });
        const j = await r.json().catch(() => ({}));
        const row: Record<string, unknown> = { url: u, kind: kindOf(u), checked_at: new Date().toISOString(), in_sitemap: true };
        if (!r.ok) { row.err = String(j.error?.message || r.status).slice(0, 300); if (r.status === 429) throw new Error("구글 하루 검사 한도(2,000건)를 다 썼어요. 내일 이어서 해요."); }
        else { const x = j.inspectionResult?.indexStatusResult || {};
          Object.assign(row, { verdict: x.verdict || null, coverage: x.coverageState || null, indexing: x.indexingState || null, fetch_state: x.pageFetchState || null, robots: x.robotsTxtState || null,
            canonical: x.googleCanonical || null, last_crawl: x.lastCrawlTime || null, err: null }); }
        return row;
      };
      if (b.action === "inspect") {
        const u = String(b.url || "").trim(); if (!u.startsWith(SITE_URL + "/") && u !== SITE_URL) return out({ error: "uncleday.com 주소만 검사할 수 있어요" }, 400);
        const row = await inspect(u); row.in_sitemap = false;
        const prev = await db.from("seo_index").select("in_sitemap").eq("url", u).maybeSingle(); if (prev.data) row.in_sitemap = prev.data.in_sitemap;
        await db.from("seo_index").upsert(row); return out({ row });
      }
      // sweep: 사이트맵 주소 → 확인 안 한 것 → 안 된 것(2일 지남) → 된 것(7일 지남) 순서
      const sm = await fetch(SITE_URL + "/sitemap.xml").then((r) => r.text());
      const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
      const have = new Map<string, { checked_at: string | null; verdict: string | null }>();
      for (let from = 0; ; from += 1000) {
        const r = await db.from("seo_index").select("url,checked_at,verdict").range(from, from + 999); if (r.error) throw new Error("seo_index 표가 없어요 (universe24.sql 실행 전?)");
        for (const x of r.data || []) have.set(x.url, x); if (!r.data || r.data.length < 1000) break;
      }
      const gone = [...have.keys()].filter((u) => !urls.includes(u));
      if (gone.length) await db.from("seo_index").update({ in_sitemap: false }).in("url", gone.slice(0, 500));
      const now = Date.now(), age = (t: string | null) => (t ? (now - Date.parse(t)) / 864e5 : 1e9);
      const pri = (u: string) => { const h = have.get(u); if (!h || !h.checked_at) return 0; if (h.verdict !== "PASS" && age(h.checked_at) > 2) return 1; if (age(h.checked_at) > 7) return 2; return 9; };
      const imp = (u: string) => /\/(s|blog)\/|\/c\/[a-z]+\/(price\/)?$|\/guide\/$/.test(u) ? 0 : /\/c\//.test(u) ? 1 : 2;   // 중요한 페이지 먼저
      const todo = urls.filter((u) => pri(u) < 9).sort((a, c) => pri(a) - pri(c) || imp(a) - imp(c)).slice(0, Math.min(150, Math.max(1, +b.n || 70)));
      const rows: Record<string, unknown>[] = []; let stop = "";
      for (let i = 0; i < todo.length && !stop; i += 5) {
        const part = await Promise.all(todo.slice(i, i + 5).map((u) => inspect(u).catch((e) => { stop = String(e.message || e); return null; })));
        for (const r of part) if (r) rows.push(r);
      }
      if (rows.length) await db.from("seo_index").upsert(rows);
      return out({ site, checked: rows.length, total: urls.length, left: urls.filter((u) => pri(u) < 9).length - rows.length, stop });
    }

    // 4) 기간 (구글은 2~3일 늦어요)
    const days = Math.min(90, Math.max(7, +b.days || 28));
    const ymd = (d: Date) => d.toISOString().slice(0, 10);
    const end = new Date(Date.now() - 2 * 864e5), start = new Date(end.getTime() - (days - 1) * 864e5);
    const q = (dimensions: string[], rowLimit = 50, extra: Record<string, unknown> = {}) =>
      g(`sites/${encodeURIComponent(site)}/searchAnalytics/query`, { startDate: ymd(start), endDate: ymd(end), dimensions, rowLimit, dataState: "all", ...extra }).then((j) => j.rows || []);
    const [byDate, queries, pages, countries, devices] = await Promise.all([
      q(["date"], 100), q(["query"], 100), q(["page"], 100), q(["country"], 10), q(["device"], 5),
    ]);
    return out({ site, start: ymd(start), end: ymd(end), byDate, queries, pages, countries, devices });
  } catch (e) {
    const m = String((e as Error).message || e);
    if (/permission|not have|403|User does not have/i.test(m)) return out({ error: "setup", step: "share", email: key.client_email, message: "서치 콘솔에서 이 서비스 계정을 사용자로 추가해야 해요." }, 200);
    if (/has not been used|disabled|SERVICE_DISABLED|accessNotConfigured/i.test(m)) return out({ error: "setup", step: "api", message: "구글 클라우드에서 'Google Search Console API' 를 사용 설정해야 해요." }, 200);
    return out({ error: m }, 500);
  }
});

/* 🔎 검색 유입 · 리드 — 포털 안 (#ptSeo)
 * - 자동으로 만든 페이지(도시 · 가이드 · 주제 · 미입점 가게 · 업체)에 어디서(구글 · 네이버 · ChatGPT …) 몇 명이 들어왔는지
 * - 미입점 가게 페이지의 '예약 문의' · '사장님 입점 신청' 처리
 * - 영업용: 미입점 가게별 조회수 + 사장님께 보여 줄 문구 복사
 * 서버 함수는 supabase/universe18.sql
 */
/* 🔍 구글 서치 콘솔 (Edge Function "gsc") — 구글 검색 결과 화면에서 보인 수 · 눌린 수 · 순위 · 검색어 */
const GSC = { data: null, days: 0, loading: false, qn: 15, pn: 15 };
const GSC_CC = { kor: "🇰🇷 한국", vnm: "🇻🇳 베트남", usa: "🇺🇸 미국", jpn: "🇯🇵 일본", chn: "🇨🇳 중국", twn: "🇹🇼 대만", aus: "🇦🇺 호주", sgp: "🇸🇬 싱가포르", can: "🇨🇦 캐나다", rus: "🇷🇺 러시아", tha: "🇹🇭 태국", hkg: "🇭🇰 홍콩", deu: "🇩🇪 독일", gbr: "🇬🇧 영국", fra: "🇫🇷 프랑스" };
async function gscLoad() {
  if (GSC.loading) return; GSC.loading = true; GSC.days = SEO.days;
  let d;
  try {
    const r = await sb.functions.invoke("gsc", { body: { days: SEO.days } });
    if (r.error) { let m = r.error.message || ""; try { const j = await r.error.context.json(); m = j.error || m; } catch (e) {}
      d = /Failed to send|not found|404|FunctionsFetchError|FunctionsRelayError/i.test(m + (r.error.name || "")) ? { error: "setup", step: "fn" } : { error: m }; }
    else d = r.data || { error: "빈 응답" };
  } catch (e) { d = { error: e.message }; }
  GSC.data = d; GSC.loading = false; seoDraw();
}
function gscHtml() {
  const d = GSC.data;
  if (!d) return `<p class="hint">구글 서치 콘솔 숫자를 불러오는 중…</p>`;
  if (d.error === "setup") {
    const steps = [["fn", "Supabase 에 gsc 기능(Edge Function) 올리기"], ["key", "구글 클라우드 서비스 계정 키를 Supabase Secrets 에 GSC_KEY 로 넣기"], ["api", "구글 클라우드에서 Google Search Console API 사용 설정"], ["share", "서치 콘솔 → 설정 → 사용자 및 권한 → 서비스 계정 이메일 추가 (제한됨)"]];
    const at = steps.findIndex(x => x[0] === d.step);
    return `<div class="gsc-setup"><p><b>구글 서치 콘솔 연결이 아직 안 끝났어요.</b> ${esc(d.message || "")}</p><ol>${steps.map(([k, l], i) => `<li class="${i < at ? "done" : i === at ? "now" : ""}">${i < at ? "✅ " : i === at ? "👉 " : ""}${l}</li>`).join("")}</ol>
      ${d.email ? `<p>서비스 계정 이메일: <code>${esc(d.email)}</code> <button class="btn sm" data-scopy="${esc(d.email)}">복사</button></p>` : ""}<p class="hint">자세한 순서는 Claude 에게 물어보세요. 키 파일 내용은 채팅으로 보내지 말고 Supabase 에 직접 넣어 주세요.</p></div>`;
  }
  if (!d.error && typeof d === "object") ["byDate", "queries", "pages", "countries", "devices"].forEach(k => { if (!Array.isArray(d[k])) d[k] = []; });
  if (typeof d !== "object") return `<div class="uni-err">서치 콘솔 응답이 이상해요. <button class="btn sm" data-sact="gsc">다시</button></div>`;
  if (d.error) return `<div class="uni-err">서치 콘솔 숫자를 못 가져왔어요: ${esc(d.error)} <button class="btn sm" data-sact="gsc">다시</button></div>`;
  const sum = (rows, k) => rows.reduce((a, r) => a + (+r[k] || 0), 0);
  const imp = sum(d.byDate, "impressions"), clk = sum(d.byDate, "clicks"), pos = imp ? d.byDate.reduce((a, r) => a + r.position * r.impressions, 0) / imp : 0;
  const mx = Math.max(1, ...d.byDate.map(r => r.impressions));
  const pct = x => (x * 100).toFixed(x < 0.1 ? 1 : 0) + "%", p1 = x => (+x || 0).toFixed(1);
  const path = u => u.replace(/^https?:\/\/[^/]+/, "") || "/";
  const tbl = (rows, n, lab, key) => `<div class="gsc-t"><div class="th"><span>${lab}</span><span>클릭</span><span>노출</span><span>CTR</span><span>순위</span></div>${rows.slice(0, n).map(r => `<div><span title="${esc(r.keys[0])}">${key === "page" ? `<a href="${esc(r.keys[0])}" target="_blank" rel="noopener">${esc(seoName(path(r.keys[0])))}</a><small>${esc(path(r.keys[0]))}</small>` : esc(r.keys[0])}</span><span><b>${r.clicks}</b></span><span>${r.impressions}</span><span>${pct(r.ctr)}</span><span>${p1(r.position)}</span></div>`).join("")}</div>${rows.length > n ? `<button class="btn sm" data-gmore="${key}">더 보기 (${rows.length})</button>` : ""}`;
  return `<p class="hint" style="margin-top:0">${esc(d.start)} ~ ${esc(d.end)} · 구글은 2~3일 늦게 알려 줘요 · ${esc(d.site)}</p>
    <div class="seo-kpi"><div><small>👁️ 구글 검색에 보인 수 (노출)</small><b>${imp.toLocaleString()}</b></div><div><small>👆 눌린 수 (클릭)</small><b>${clk.toLocaleString()}</b></div><div><small>클릭률 (CTR)</small><b>${imp ? pct(clk / imp) : "-"}</b></div><div><small>평균 순위</small><b>${imp ? p1(pos) + "위" : "-"}</b></div></div>
    ${d.byDate.length ? `<div class="seo-days gsc-days">${d.byDate.map(r => `<i title="${r.keys[0]} · 노출 ${r.impressions} · 클릭 ${r.clicks}" style="height:${Math.max(4, r.impressions / mx * 100)}%">${r.clicks ? `<em style="height:${Math.max(8, r.clicks / Math.max(1, r.impressions) * 100)}%"></em>` : ""}</i>`).join("")}</div><div class="seo-dl"><span>${d.byDate[0].keys[0].slice(5)}</span><span>막대: 노출 · 진한 부분: 클릭</span><span>${d.byDate[d.byDate.length - 1].keys[0].slice(5)}</span></div>` : `<p class="hint">아직 구글 검색에 보인 기록이 없어요. 색인이 되면 며칠 안에 숫자가 생겨요.</p>`}
    ${d.countries.length ? `<div class="gsc-cc">${d.countries.map(r => `<span>${esc(GSC_CC[r.keys[0]] || r.keys[0].toUpperCase())} <b>${r.impressions}</b></span>`).join("")}${d.devices.map(r => `<span>${r.keys[0] === "MOBILE" ? "📱 휴대폰" : r.keys[0] === "DESKTOP" ? "💻 PC" : "📟 태블릿"} <b>${r.impressions}</b></span>`).join("")}</div>` : ""}
    ${d.queries.length ? `<h5>사람들이 검색한 말</h5>${tbl(d.queries, GSC.qn, "검색어", "query")}` : ""}
    ${d.pages.length ? `<h5>구글에 보인 페이지</h5>${tbl(d.pages, GSC.pn, "페이지", "page")}` : ""}`;
}
const SEO = { days: 30, rep: null, leads: null, err: "", loading: false, lf: "open", pf: "p" };
const SEO_SRC = { google: "구글", naver: "네이버", bing: "빙", daum: "다음", chatgpt: "ChatGPT", perplexity: "Perplexity", claude: "Claude", gemini: "Gemini", kakao: "카카오톡", facebook: "페이스북", instagram: "인스타그램", internal: "사이트 안에서", direct: "직접 · 앱", other: "기타" };
const SEO_AI = ["chatgpt", "perplexity", "claude", "gemini"], SEO_SEARCH = ["google", "naver", "bing", "daum"];
const SEO_ST = [["new", "🆕 새 문의"], ["contacted", "📞 연락함"], ["won", "✅ 성사"], ["lost", "✖️ 안 됨"]];
const seoDay = n => { const d = new Date(Date.now() + 7 * 3600e3 - n * 864e5); return d.toISOString().slice(0, 10); };

async function seoLoad() {
  if (SEO.loading) return; SEO.loading = true;
  const [r, l] = await Promise.all([sb.rpc("seo_report", { d1: seoDay(SEO.days - 1), d2: seoDay(0) }), sb.from("seo_leads").select("*").order("created_at", { ascending: false }).limit(300)]);
  SEO.loading = false;
  const e = r.error || l.error;
  if (e) { SEO.err = /seo_|PGRST20|42P01|42883/.test((e.message || "") + (e.code || "")) ? "setup" : e.message; SEO.rep = { by_src: {}, by_day: [], pages: [] }; SEO.leads = []; }
  else { SEO.err = ""; SEO.rep = r.data || { by_src: {}, by_day: [], pages: [] }; SEO.leads = l.data || []; }
  const hd = await sb.from("osm_hidden").select("*").order("created_at", { ascending: false });
  SEO.hidden = hd.error ? null : (hd.data || []);   // null = universe20.sql 실행 전
  if (typeof TAB !== "undefined" && TAB === "home" && typeof drawPortal === "function") drawPortal(true); else seoDraw();   // '오늘 할 일'의 새 문의 숫자도 같이
}
const SEO_CITY = { danang: "다낭", nhatrang: "나트랑", hcm: "호찌민", hanoi: "하노이" };
const SEO_TOPIC = { korean: "한국어 되는 마사지", late: "밤늦게 하는 마사지", luggage: "짐 보관 마사지", pickup: "픽업 마사지", kids: "키즈 마사지", pregnant: "임산부 마사지", hotstone: "핫스톤", fourhands: "포핸드", thai: "타이 · 건식", foot: "발 마사지", sauna: "사우나 스파", tipfree: "팁 포함", nail: "네일 · 속눈썹", clinic: "성형 · 피부과", guide: "여행 가이드", more: "가게 더 보기 (미입점)" };
const seoName = path => {
  const c = (path || "").match(/^\/(en\/)?c\/([a-z]+)\/(?:([a-z]+)\/)?$/);
  if (c) return `${SEO_CITY[c[2]] || c[2]} ${c[3] ? SEO_TOPIC[c[3]] || c[3] : "도시 페이지"}${c[1] ? " (영어)" : ""}`;
  if (path === "/") return "홈";
  const m = path.match(/^\/p\/([a-z]+)\/(.+)-([nwr]\d+)\/(vi\/)?$/);
  if (m) return m[2].split("-").map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(" ") + (m[4] ? " (사장님용 베트남어)" : "");
  const s = path.match(/^\/s\/([^/]+)\//); if (s) { const x = (typeof shops !== "undefined" ? shops : []).find(v => v.id === s[1]); return x ? (x.name.ko || x.name.en || s[1]) : s[1]; }
  return path;
};
const seoOsm = p => { const m = (p || "").match(/-([nwr]\d+)\/(vi\/)?$/); return m ? m[1] : null; };
const seoKind = p => /^\/p\/.*\/vi\/$/.test(p) ? "미입점 · 사장님용" : /^\/p\//.test(p) ? "미입점" : /^\/s\//.test(p) ? "입점 업체" : /\/guide\//.test(p) ? "가이드" : /^\/(en\/)?c\/[a-z]+\/$/.test(p) ? "도시" : /\/more\/$/.test(p) ? "더 보기" : "주제";
function seoPitch(pg, l) {
  const nm = seoName(pg.path), v = +pg.views || 0, s = +pg.search || 0;
  return l === "vi"
    ? `Chào anh/chị! Trong ${SEO.days} ngày qua, trang "${nm}" trên Uncle Day (uncleday.com) (trang tiếng Hàn cho du khách Hàn Quốc) đã được xem ${v} lượt${s ? `, trong đó ${s} lượt đến từ Google/Naver/AI` : ""}${pg.leads ? ` và ${pg.leads} lượt hỏi đặt chỗ` : ""}. Cửa hàng chưa đăng ký nên chúng tôi chưa thể gửi khách. Đăng ký miễn phí — không phí tháng, chỉ trả hoa hồng khi khách đến và thanh toán. Xem trang: https://www.uncleday.com${pg.path}vi/`
    : `사장님, 지난 ${SEO.days}일 동안 엉클데이(uncleday.com)에서 "${nm}" 페이지(한국인 여행객용 한국어 페이지)가 ${v}번 조회됐어요${s ? ` (그중 구글 · 네이버 · AI 검색으로 ${s}번)` : ""}${pg.leads ? `. 예약 문의도 ${pg.leads}건 들어왔어요` : ""}. 아직 입점 전이라 손님을 보내 드리지 못하고 있어요. 입점비 · 월 고정비 없이 손님이 와서 결제했을 때만 수수료예요. 페이지 보기: https://www.uncleday.com${pg.path}`;
}

function seoDraw() {
  const el = document.getElementById("ptSeo"); if (!el) return;
  if (!SEO.rep) { el.innerHTML = `<div class="uni-empty">불러오는 중…</div>`; seoLoad(); return; }
  if (SEO.err === "setup") { el.innerHTML = `<div class="uni-err">검색 유입 기능을 쓰려면 Supabase SQL 편집기에서 <b>supabase/universe18.sql</b> 을 한 번 실행해 주세요.</div>`; return; }
  const R = SEO.rep, src = R.by_src || {}, tot = Object.values(src).reduce((a, n) => a + n, 0);
  const sum = ks => ks.reduce((a, k) => a + (+src[k] || 0), 0);
  const P = R.pages || [], cta = P.reduce((a, p) => a + (+p.cta || 0), 0);
  const L = SEO.leads || [], lOpen = L.filter(x => x.status === "new" || x.status === "contacted");
  const kpi = [["👀 페이지 조회", tot], ["🔍 검색 (구글 · 네이버 등)", sum(SEO_SEARCH)], ["🤖 AI (ChatGPT 등)", sum(SEO_AI)], ["👆 버튼 클릭", cta], ["📨 문의 · 입점 신청", L.filter(x => x.created_at >= seoDay(SEO.days - 1)).length]];
  const srcRows = Object.entries(src).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...srcRows.map(x => x[1]));
  const days = R.by_day || [], dmax = Math.max(1, ...days.map(x => +x.n));
  const pages = P.filter(p => SEO.pf === "all" || (SEO.pf === "p" ? /^\/p\//.test(p.path) : !/^\/p\//.test(p.path)));
  const leads = SEO.lf === "open" ? lOpen : L;
  const dt = t => new Date(t).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
  el.innerHTML = `
    <div class="seo-bar"><div class="br-cats">${[7, 30, 90].map(n => `<button class="${SEO.days === n ? "on" : ""}" data-sdays="${n}">최근 ${n}일</button>`).join("")}</div><button class="btn sm" data-sact="reload">↻</button></div>
    <div class="seo-kpi">${kpi.map(([l, n]) => `<div><small>${l}</small><b>${(+n || 0).toLocaleString()}</b></div>`).join("")}</div>
    <div class="seo-two">
      <div class="br-box"><h4>어디서 들어왔나요</h4>${srcRows.length ? srcRows.map(([k, n]) => `<div class="seo-src ${SEO_AI.includes(k) ? "ai" : SEO_SEARCH.includes(k) ? "se" : ""}"><span>${esc(SEO_SRC[k] || k)}</span><i style="width:${Math.max(3, n / max * 100)}%"></i><b>${n}</b></div>`).join("") : `<p class="hint">아직 기록이 없어요. 페이지가 검색에 잡히면 숫자가 쌓여요.</p>`}</div>
      <div class="br-box"><h4>날짜별 조회</h4>${days.length ? `<div class="seo-days">${days.map(x => `<i title="${x.day} · ${x.n}" style="height:${Math.max(4, x.n / dmax * 100)}%"></i>`).join("")}</div><div class="seo-dl"><span>${days[0].day.slice(5)}</span><span>${days[days.length - 1].day.slice(5)}</span></div>` : `<p class="hint">아직 기록이 없어요.</p>`}</div>
    </div>
    <div class="br-box" style="margin-top:10px"><h4>🔍 구글 검색 (서치 콘솔) <span class="hint">들어오기 전 단계 — 구글 검색 결과에 몇 번 보였고 몇 번 눌렸는지 · 어떤 검색어로</span></h4>${gscHtml()}</div>
    <div class="br-box" style="margin-top:10px"><h4>📨 문의 · 입점 신청 <span class="hint">연락처는 엉클데이만 봐요 · 업체에 넘기지 마세요</span></h4>
      <div class="br-cats" style="margin-bottom:8px"><button class="${SEO.lf === "open" ? "on" : ""}" data-slf="open">처리 중 <span>${lOpen.length}</span></button><button class="${SEO.lf === "all" ? "on" : ""}" data-slf="all">전체 <span>${L.length}</span></button></div>
      ${leads.length ? `<div class="seo-leads">${leads.map(x => `<div class="seo-lead ${x.kind}">
        <div class="h"><span class="uni-chip ${x.kind === "owner" ? "" : "ok"}">${x.kind === "owner" ? "🏪 사장님 입점 신청" : "💬 손님 예약 문의"}</span><b>${esc(x.shop_name || seoName(x.path || ""))}</b><small>${dt(x.created_at)} · ${esc(SEO_SRC[x.src] || x.src || "")}</small></div>
        <div class="d"><span>👤 ${esc(x.name || "-")}</span><span>📞 <b>${esc(x.contact)}</b> <button class="btn sm" data-scopy="${esc(x.contact)}">복사</button></span>${x.visit_date ? `<span>📅 ${esc(x.visit_date)}</span>` : ""}${x.people ? `<span>👥 ${x.people}명</span>` : ""}${x.path ? `<a href="${esc(x.path)}" target="_blank" rel="noopener">페이지 ↗</a>` : ""}</div>
        ${x.msg ? `<p class="m">${esc(x.msg)}</p>` : ""}
        <div class="f"><select data-slst="${x.id}">${SEO_ST.map(([k, l]) => `<option value="${k}" ${x.status === k ? "selected" : ""}>${l}</option>`).join("")}</select><input data-slnote="${x.id}" value="${esc(x.note || "")}" placeholder="메모 (예: 카톡 보냄, 3/12 예약 잡음)"><button class="btn sm" data-slsave="${x.id}">저장</button>${x.kind === "owner" && x.status !== "won" && !/영업 카드로 옮김/.test(x.note || "") ? `<button class="btn sm main" data-slcrm="${x.id}">🤝 영업 카드로</button>` : ""}<button class="btn sm danger" data-sldel="${x.id}" title="삭제">🗑️</button>${x.updated_by ? `<small>${esc(x.updated_by)}</small>` : ""}</div></div>`).join("")}</div>` : `<p class="hint">${SEO.lf === "open" ? "처리할 문의가 없어요." : "아직 들어온 문의가 없어요."}</p>`}
    </div>
    <div class="br-box" style="margin-top:10px"><h4>📈 페이지별 숫자 <span class="hint">미입점 가게는 조회수 높은 순 = 영업 1순위 · '영업 문구'를 사장님께 보여 주세요</span></h4>
      <div class="br-cats" style="margin-bottom:8px">${[["p", "🗺️ 미입점 가게 (영업용)"], ["ud", "엉클데이 페이지"], ["all", "전체"]].map(([k, l]) => `<button class="${SEO.pf === k ? "on" : ""}" data-spf="${k}">${l}</button>`).join("")}</div>
      ${pages.length ? `<div class="seo-pages"><div class="th"><span>페이지</span><span>조회</span><span>검색</span><span>AI</span><span>클릭</span><span>문의</span><span></span></div>${pages.slice(0, 60).map((p, i) => `<div><span><a href="${esc(p.path)}" target="_blank" rel="noopener">${esc(seoName(p.path))}</a><small>${seoKind(p.path)} · ${esc(p.path)}</small></span><span><b>${+p.views || 0}</b></span><span>${+p.search || 0}</span><span>${+p.ai || 0}</span><span>${+p.cta || 0}</span><span>${+p.leads || 0}</span>
        <span>${/^\/p\//.test(p.path) && !/\/vi\/$/.test(p.path) ? `<button class="btn sm" data-spitch="${i}" data-l="vi">🇻🇳 영업 문구</button><button class="btn sm" data-spitch="${i}" data-l="ko">🇰🇷</button>` : ""}${seoOsm(p.path) && SEO.hidden && !SEO.hidden.some(h => h.ref === seoOsm(p.path)) ? `<button class="btn sm" data-shide="${seoOsm(p.path)}" data-nm="${esc(seoName(p.path))}" title="숨기기">🙈</button>` : ""}</span></div>`).join("")}</div>` : `<p class="hint">이 기간에 기록된 페이지가 없어요.</p>`}
    </div>
    <div class="br-box" style="margin-top:10px"><h4>🙈 숨긴 미입점 가게 <span class="hint">사장님이 원하지 않거나 정보가 틀린 가게 · 다음 자동 갱신(최대 3시간) 때 페이지가 사라져요</span></h4>
      ${SEO.hidden === null ? `<div class="uni-err">숨기기를 쓰려면 <b>supabase/universe20.sql</b> 을 한 번 실행해 주세요.</div>` : `
      <div class="seo-hide"><input id="seoHideIn" placeholder="가게 페이지 주소 붙여넣기 (예: uncleday.com/p/danang/abc-spa-n123/)"><input id="seoHideWhy" placeholder="이유 (예: 사장님 요청)"><button class="btn sm main" data-sact="hide">숨기기</button></div>
      ${SEO.hidden.length ? `<div class="seo-hid">${SEO.hidden.map(h => `<div><b>${esc(h.name || h.ref)}</b><small>${esc(h.ref)}${h.reason ? " · " + esc(h.reason) : ""} · ${dt(h.created_at)} · ${esc(h.created_by || "")}</small><button class="btn sm" data-sunhide="${esc(h.ref)}">다시 보이기</button></div>`).join("")}</div>` : `<p class="hint">숨긴 가게가 없어요.</p>`}`}
    </div>`;
  el.querySelectorAll("[data-sdays]").forEach(b => b.onclick = () => { SEO.days = +b.dataset.sdays; SEO.rep = null; GSC.data = null; seoDraw(); });
  if (!GSC.data && !GSC.loading) gscLoad();
  el.querySelectorAll("[data-sact=gsc]").forEach(b => b.onclick = () => { GSC.data = null; seoDraw(); });
  el.querySelectorAll("[data-gmore]").forEach(b => b.onclick = () => { if (b.dataset.gmore === "query") GSC.qn = 100; else GSC.pn = 100; seoDraw(); });
  el.querySelectorAll("[data-sact=reload]").forEach(b => b.onclick = () => { SEO.rep = null; GSC.data = null; seoDraw(); });
  el.querySelectorAll("[data-slf]").forEach(b => b.onclick = () => { SEO.lf = b.dataset.slf; seoDraw(); });
  el.querySelectorAll("[data-spf]").forEach(b => b.onclick = () => { SEO.pf = b.dataset.spf; seoDraw(); });
  el.querySelectorAll("[data-scopy]").forEach(b => b.onclick = () => portalCopy(b.dataset.scopy));
  el.querySelectorAll("[data-spitch]").forEach(b => b.onclick = () => portalCopy(seoPitch(pages[+b.dataset.spitch], b.dataset.l)));
  const hide = async (ref, name, reason) => {
    const r = await sb.from("osm_hidden").upsert({ ref, name: name || null, reason: reason || null }); if (r.error) { alert("숨기지 못했어요: " + r.error.message); return; }
    if (typeof toast === "function") toast("🙈 숨겼어요. 다음 자동 갱신(최대 3시간) 때 사라져요"); SEO.rep = null; seoDraw();
  };
  el.querySelectorAll("[data-shide]").forEach(b => b.onclick = () => { if (confirm(`'${b.dataset.nm}' 페이지를 숨길까요?`)) hide(b.dataset.shide, b.dataset.nm, "포털에서 숨김"); });
  el.querySelectorAll("[data-sact=hide]").forEach(b => b.onclick = () => {
    const v = (document.getElementById("seoHideIn").value || "").trim(), path = v.replace(/^https?:\/\//, "").replace(/^[^/]*/, "").replace(/[?#].*$/, "").replace(/\/?$/, "/");
    const ref = seoOsm(path) || (/^[nwr]\d+$/i.test(v) ? v.toLowerCase() : null);
    if (!ref) { alert("가게 페이지 주소를 붙여 넣어 주세요. 주소 끝이 -n123/ 처럼 생겼어요."); return; }
    hide(ref, /^\/p\//.test(path) ? seoName(path).replace(" (사장님용 베트남어)", "") : "", document.getElementById("seoHideWhy").value.trim());
  });
  el.querySelectorAll("[data-sunhide]").forEach(b => b.onclick = async () => { const r = await sb.from("osm_hidden").delete().eq("ref", b.dataset.sunhide); if (r.error) { alert(r.error.message); return; } SEO.rep = null; seoDraw(); });
  // 사장님 입점 신청 → 낙서장 '영업' 카드로 (그다음은 영업 카드의 '🏪 사이트에 업체 등록' → 사장님 계정까지 이어져요)
  el.querySelectorAll("[data-slcrm]").forEach(b => b.onclick = async () => {
    const x = SEO.leads.find(v => v.id === b.dataset.slcrm); if (!x) return;
    b.disabled = true;
    const memo = `<p>🔎 검색 페이지에서 입점 신청 · ${esc(new Date(x.created_at).toLocaleDateString("ko-KR"))}</p><p>페이지: <a href="https://www.uncleday.com${esc(x.path || "")}">${esc(x.path || "")}</a></p>${x.msg ? `<p>남긴 말: ${esc(x.msg)}</p>` : ""}`;
    const r = await sb.from("leads").insert({ name: x.shop_name || x.name || "입점 신청", city: x.city || null, person: x.name || null, contact: x.contact, memo, stage: "contacted",
      next_action: "잘로로 연락 · 방문 약속", next_date: seoDay(0), assignee: (typeof ME !== "undefined" && ME && ME.email) || null }).select().single();
    if (r.error) { b.disabled = false; alert("영업 카드를 못 만들었어요: " + r.error.message); return; }
    await sb.from("seo_leads").update({ status: "contacted", note: ((x.note ? x.note + " · " : "") + "영업 카드로 옮김").slice(0, 500) }).eq("id", x.id);
    if (typeof toast === "function") toast("🤝 낙서장 '영업'에 카드를 만들었어요");
    if (typeof loadWork === "function") { try { await loadWork(); } catch (e) {} }
    if (typeof openLead === "function" && typeof leadById === "function" && leadById(r.data.id)) openLead(r.data.id); else { SEO.rep = null; seoDraw(); }
  });
  el.querySelectorAll("[data-sldel]").forEach(b => b.onclick = async () => {
    const x = SEO.leads.find(v => v.id === b.dataset.sldel); if (!x) return;
    if (!confirm(`'${x.shop_name || x.name || "문의"}' 문의를 지울까요?\n되돌릴 수 없어요. 테스트 · 장난 · 중복 문의만 지우고, 진행이 안 된 문의는 '✖️ 안 됨'으로 남겨 두는 걸 권해요.`)) return;
    b.disabled = true; const r = await sb.from("seo_leads").delete().eq("id", x.id);
    if (r.error) { b.disabled = false; alert("지우지 못했어요: " + r.error.message); return; }
    SEO.leads = SEO.leads.filter(v => v.id !== x.id); if (typeof toast === "function") toast("문의를 지웠어요"); seoDraw();
  });
  el.querySelectorAll("[data-slsave]").forEach(b => b.onclick = async () => {
    const id = b.dataset.slsave, st = el.querySelector(`[data-slst="${id}"]`).value, note = el.querySelector(`[data-slnote="${id}"]`).value.trim();
    b.disabled = true; const r = await sb.from("seo_leads").update({ status: st, note }).eq("id", id).select().single(); b.disabled = false;
    if (r.error) { alert("저장 못 했어요: " + r.error.message); return; }
    const i = SEO.leads.findIndex(x => x.id === id); if (i >= 0) SEO.leads[i] = r.data; seoDraw();
  });
}

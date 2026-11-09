/* 엉클데이 관리자 — 로그인, 대시보드, 예약, 정산, 후기, 계정 */
const RECOVERY = /type=recovery/.test(location.hash);   // 비밀번호 재설정 메일의 링크로 들어왔는지 (주소가 지워지기 전에 확인)
const ON = typeof SUPA !== "undefined" && SUPA.url && SUPA.key;
const sb = ON ? supabase.createClient(SUPA.url, SUPA.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
let ME = { email: "", id: "" };
let BOOKINGS = []; window.BOOKINGS = BOOKINGS;
let SETTLES = [], RVS = [];
const ST = {
  requested: "접수 (업체 확인 전)", confirmed: "업체 확정", rejected: "업체 불가", visited: "방문 완료",
  settled: "정산 완료", cancelled: "취소", noshow: "노쇼"
};
const ST_SHORT = { requested: "접수", confirmed: "확정", rejected: "불가", visited: "방문완료", settled: "정산완료", cancelled: "취소", noshow: "노쇼" };
const SRC = { web: "사이트", kakao: "카톡", phone: "전화", etc: "기타" };
const LANG_KO = { ko: "한국어", en: "영어", vi: "베트남어", ja: "일본어", zh: "중국어" };

/* ===== 작은 도구 ===== */
const vnToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
const vnMonth = () => vnToday().slice(0, 7);
const addMonth = (m, d) => { const [y, mo] = m.split("-").map(Number); const x = new Date(Date.UTC(y, mo - 1 + d, 1)); return x.toISOString().slice(0, 7); };
const monthKo = m => m ? `${m.slice(0, 4)}년 ${+m.slice(5, 7)}월` : "";
const vnd = n => n == null || n === "" ? "-" : "₫" + Math.round(+n).toLocaleString("en-US");
const krw = n => { const r = SITE.rates && SITE.rates.ko; return r && n ? `약 ₩${(Math.round(n * r.rate / 100) * 100).toLocaleString("en-US")}` : ""; };
const num = v => { const x = String(v ?? "").replace(/[^\d.]/g, ""); return x === "" ? null : +x; };
const dt = ts => { if (!ts) return ""; const d = new Date(ts); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const dayKo = d => d ? `${+d.slice(5, 7)}/${+d.slice(8, 10)}(${DAYS[new Date(d + "T00:00:00").getDay()]})` : "-";
const shopById = id => shops.find(s => s.id === id);
const shopName = b => { const s = shopById(b.shop_id); return s ? s.name.ko : (b.shop_name || "(업체 없음)"); };
const siteUrl = path => new URL(path, location.href).href;
const copy = async (text, msg = "복사했어요") => { try { await navigator.clipboard.writeText(text); toast(msg); return true; } catch (e) { prompt("복사해서 쓰세요", text); return false; } };
const stBadge = s => `<span class="st ${s}">${ST_SHORT[s] || s}</span>`;
const isOpenSt = s => s === "requested" || s === "confirmed";
const hoursSince = ts => ts ? (Date.now() - new Date(ts).getTime()) / 36e5 : 0;

async function q(promise, what = "저장") {
  const r = await promise;
  if (r.error) { dbErr(r.error, what); throw r.error; }
  return r.data;
}
async function logEvent(id, action, detail = {}) {
  const r = await sb.from("booking_events").insert({ booking_id: id, action, detail });
  if (r.error) console.error(r.error);
}
async function updBooking(id, patch, what) {
  const row = await q(sb.from("bookings").update(patch).eq("id", id).select().single(), what);
  const i = BOOKINGS.findIndex(b => b.id === id); if (i >= 0) BOOKINGS[i] = row; else BOOKINGS.unshift(row);
  return row;
}

/* ===== 불러오기 ===== */
async function loadBookings() {
  BOOKINGS = await q(sb.from("bookings").select("*").order("created_at", { ascending: false }).limit(5000), "예약 불러오기");
  window.BOOKINGS = BOOKINGS;
}
async function loadSettles() { SETTLES = await q(sb.from("settlements").select("*").order("billed_at", { ascending: false }), "정산 불러오기"); }
async function loadReviews() { RVS = await q(sb.from("reviews").select("*").order("created_at", { ascending: false }).limit(500), "후기 불러오기"); }
// 방문 통계 (월별로 불러와 둬요)
const STATS = {};
async function loadStats(m, force) {
  if (STATS[m] && !force) return STATS[m];
  const r = await sb.from("stats_daily").select("day,shop_id,kind,n").gte("day", m + "-01").lt("day", addMonth(m, 1) + "-01").limit(50000);
  STATS[m] = r.error ? [] : r.data;
  return STATS[m];
}
// 방문자 분석 (유입경로·기기·언어·나라)
const DIMS = {};
async function loadDims(m, force) {
  if (DIMS[m] && !force) return DIMS[m];
  const r = await sb.from("stats_dim").select("day,dim,val,n").gte("day", m + "-01").lt("day", addMonth(m, 1) + "-01").limit(50000);
  DIMS[m] = r.error ? [] : r.data;
  return DIMS[m];
}
const DIM_NAMES = {
  src: { kakao: "💬 카카오톡", naver: "🟢 네이버", google: "🔍 구글", instagram: "📸 인스타그램", facebook: "📘 페이스북", youtube: "▶️ 유튜브", tiktok: "🎵 틱톡", threads: "🧵 스레드", x: "✖️ X(트위터)", bing: "🔎 빙", line: "💚 라인", zalo: "🔵 잘로", ai: "🤖 AI 검색(챗GPT 등)", share: "🔗 공유 링크", direct: "⌨️ 직접 방문", etc: "🌐 기타 사이트", unknown: "❔ 알 수 없음" },
  dev: { mobile: "📱 휴대폰", pc: "💻 PC", tablet: "📲 태블릿", unknown: "❔ 알 수 없음" },
  lang: { ko: "🇰🇷 한국어", vi: "🇻🇳 베트남어", en: "🇺🇸 영어", ja: "🇯🇵 일본어", zh: "🇨🇳 중국어", unknown: "❔ 알 수 없음" },
  tz: { kr: "🇰🇷 한국", vn: "🇻🇳 베트남·동남아", etc: "🌏 그 밖의 나라", unknown: "❔ 알 수 없음" }
};
const dimName = (d, v) => (DIM_NAMES[d] || {})[v] || (v.startsWith("utm:") ? "🏷️ 광고 링크: " + v.slice(4) : v);
function dimCard(m, d, title, hint) {
  const sum = {}; (DIMS[m] || []).filter(r => r.dim === d).forEach(r => sum[r.val] = (sum[r.val] || 0) + r.n);
  const rows = Object.entries(sum).sort((a, b) => b[1] - a[1]); const tot = rows.reduce((t, r) => t + r[1], 0);
  return `<div class="dim-card"><h3>${title}</h3>${hint ? `<p class="hint">${hint}</p>` : ""}${rows.length ? rows.map(([v, n]) => {
    const p = Math.round(n / tot * 100);
    return `<div class="dim-row"><span class="dim-l">${esc(dimName(d, v))}</span><span class="dim-bar"><i style="width:${Math.max(2, p)}%"></i></span><span class="dim-n">${n.toLocaleString()}<small>${p}%</small></span></div>`;
  }).join("") : `<p class="empty">아직 기록이 없어요</p>`}</div>`;
}
function dailyChart(m) {
  const days = new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate(); const v = [], h = [];
  for (let i = 1; i <= days; i++) { const d = `${m}-${String(i).padStart(2, "0")}`; v.push(statSum(m, "visit", undefined, d)); h.push(statSum(m, "view", undefined, d)); }
  const max = Math.max(1, ...v);
  return `<div class="dim-card wide"><h3>날짜별 방문자 <small>막대 위에 마우스를 올리면 숫자가 보여요</small></h3><div class="day-chart">${v.map((n, i) => `<div class="day-col" title="${+m.slice(5)}월 ${i + 1}일 · 방문자 ${n}명 · 업체 조회 ${h[i]}회"><i style="height:${n ? Math.max(3, n / max * 100) : 0}%"></i><small>${(i + 1) % 5 === 0 || i === 0 ? i + 1 : ""}</small></div>`).join("")}</div></div>`;
}
const statSum = (m, kind, shop, day) => (STATS[m] || []).filter(r => r.kind === kind && (shop === undefined || r.shop_id === shop) && (!day || r.day === day)).reduce((t, r) => t + r.n, 0);
async function loadAll() { await Promise.all([loadShops(), loadBookings(), loadSettles(), loadReviews(), loadWork()]); }

/* ===== 할 일 (놓치면 안 되는 것) ===== */
const TODO = [
  ["notSent", "📨", "업체에 아직 안 알린 새 예약", b => b.status === "requested" && !b.sent_to_shop_at],
  ["noReply", "⏳", "업체 답이 3시간 넘게 없음", b => b.status === "requested" && b.sent_to_shop_at && hoursSince(b.sent_to_shop_at) > 3],
  ["tellCust", "📣", "확정됐는데 손님에게 안내 안 함", b => b.status === "confirmed" && !b._custTold],
  ["custSaid", "🙋", "손님은 '다녀왔어요'를 눌렀는데 방문 완료 처리가 안 됨", b => b.customer_visit_at && isOpenSt(b.status)],
  ["pastOpen", "📆", "방문일이 지났는데 결과(방문·노쇼)가 없음", b => isOpenSt(b.status) && b.visit_date && b.visit_date < vnToday()],
  ["noAmount", "💸", "방문 완료인데 결제 금액이 비어 있음", b => b.status === "visited" && b.paid_amount == null],
  ["rejected", "🔁", "업체가 불가 — 손님에게 다른 시간·업체 안내 필요", b => b.status === "rejected"]
];

/* ===== 탭 ===== */
let TAB = "dash";
function showTab(t) {
  TAB = t;
  document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === t));
  document.querySelectorAll("[data-pane]").forEach(p => p.hidden = p.dataset.pane !== t);
  if (location.hash.slice(1) !== t) history.replaceState(null, "", "#" + t);
  ({ dash: drawDash, work: drawWork, bk: drawBookings, crm: drawCrm, settle: drawSettle, shops: drawList, rv: drawReviews, acc: drawAccount })[t]();
  drawCounts();
}
function drawCounts() {
  const n = BOOKINGS.filter(b => b.status === "requested").length;
  $("cntBk").textContent = n || "";
  const r = RVS.filter(x => x.status === "pending").length;
  $("cntRv").textContent = r || "";
  document.title = (n ? `(${n}) ` : "") + "엉클데이 관리자";
  const w = workTodos().reduce((t, x) => t + x[3], 0); $("cntWork").textContent = w || "";
}
window.onShopsChanged = () => { if (TAB !== "shops") showTab(TAB); };

/* ===== 대시보드 ===== */
let dashMonth = null;
function monthStats(m, shopId) {
  const inM = BOOKINGS.filter(b => (b.visit_date || "").startsWith(m) && (!shopId || b.shop_id === shopId));
  const done = inM.filter(b => b.status === "visited" || b.status === "settled");
  return {
    all: inM.length,
    active: inM.filter(b => !["cancelled", "rejected"].includes(b.status)).length,
    done: done.length,
    paid: done.reduce((t, b) => t + (+b.paid_amount || 0), 0),
    comm: done.reduce((t, b) => t + (+b.commission || 0), 0),
    unsettled: done.filter(b => b.status === "visited").reduce((t, b) => t + (+b.commission || 0), 0),
    noshow: inM.filter(b => b.status === "noshow").length,
    cancel: inM.filter(b => b.status === "cancelled").length
  };
}
function drawDash() {
  dashMonth = dashMonth || vnMonth();
  const need = [dashMonth, vnMonth()].filter(m => !STATS[m]);
  if (need.length) { Promise.all(need.map(m => loadStats(m))).then(() => { if (TAB === "dash") drawDash(); }); }
  if (!DIMS[dashMonth]) loadDims(dashMonth).then(() => { if (TAB === "dash") drawDash(); });
  const today = vnToday();
  const todays = BOOKINGS.filter(b => b.visit_date === today && !["cancelled", "rejected"].includes(b.status));
  const st = monthStats(dashMonth);
  const owed = BOOKINGS.filter(b => b.status === "visited").reduce((t, b) => t + (+b.commission || 0), 0);
  const billed = SETTLES.filter(s => s.status === "billed").reduce((t, s) => t + (+s.total_commission || 0), 0);
  const months = [...new Set([vnMonth(), ...BOOKINGS.map(b => (b.visit_date || "").slice(0, 7)).filter(Boolean)])].sort().reverse();
  const todos = TODO.map(([k, ic, label, f]) => [k, ic, label, BOOKINGS.filter(f).length]);
  const pendRv = RVS.filter(r => r.status === "pending").length;
  // 업체별 이번 달
  const byShop = {};
  BOOKINGS.filter(b => (b.visit_date || "").startsWith(dashMonth)).forEach(b => { (byShop[b.shop_id || "-"] = byShop[b.shop_id || "-"] || []).push(b); });
  (STATS[dashMonth] || []).forEach(r => { if (r.shop_id && r.kind !== "visit" && !byShop[r.shop_id]) byShop[r.shop_id] = []; });
  const rows = Object.entries(byShop).map(([id, arr]) => ({ id, name: arr[0] ? shopName(arr[0]) : shopName({ shop_id: id, shop_name: id }), ...monthStats(dashMonth, id === "-" ? null : id), rate: rateOf(id),
      views: statSum(dashMonth, "view", id), consult: statSum(dashMonth, "consult", id) }))
    .sort((a, b) => b.comm - a.comm || b.active - a.active || b.views - a.views);
  const hasSt = !!STATS[dashMonth];
  const sv = k => hasSt ? statSum(dashMonth, k).toLocaleString() : "…";
  const consultAll = statSum(dashMonth, "consult");
  $("tab-dash").innerHTML = `
    <h2 class="sec">오늘 <small>${dayKo(today)} · 베트남 시간 기준</small></h2>
    <div class="kpis">
      <div class="kpi click ${BOOKINGS.filter(b => b.status === "requested").length ? "alert" : ""}" data-go="requested"><small>새 예약 (업체 확인 전)</small><b>${BOOKINGS.filter(b => b.status === "requested").length}</b><em>눌러서 보기</em></div>
      <div class="kpi"><small>오늘 사이트 방문</small><b>${STATS[vnMonth()] ? statSum(vnMonth(), "hit", undefined, today).toLocaleString() : "…"}회</b><em>방문자 ${STATS[vnMonth()] ? statSum(vnMonth(), "visit", undefined, today).toLocaleString() : "…"}명 · 업체 조회 ${STATS[vnMonth()] ? statSum(vnMonth(), "view", undefined, today).toLocaleString() : "…"}회</em></div>
      <div class="kpi click" data-go="today"><small>오늘 방문 예정</small><b>${todays.length}</b><em>${todays.reduce((t, b) => t + b.people, 0)}명</em></div>
      <div class="kpi money"><small>받을 수수료 (정산서 전)</small><b>${vnd(owed)}</b><em>${krw(owed)}</em></div>
      <div class="kpi money"><small>청구했는데 입금 전</small><b>${vnd(billed)}</b><em>${krw(billed)}</em></div>
    </div>

    <h2 class="sec">할 일 <small>업체와 손님 사이에서 놓치면 기록이 비는 일이에요</small></h2>
    <div class="todo">${todos.map(([k, ic, label, n]) => `<div class="todo-row ${n ? "" : "zero"}" data-todo="${k}"><span class="ic">${ic}</span><b>${label}</b><span class="n" style="${n ? "color:var(--danger)" : ""}">${n}</span></div>`).join("")}
      ${workTodos().map(([k, ic, label, n]) => `<div class="todo-row ${n ? "" : "zero"}" data-wtodo="${k}"><span class="ic">${ic}</span><b>${label}</b><span class="n" style="${n ? "color:var(--danger)" : ""}">${n}</span></div>`).join("")}
      <div class="todo-row ${pendRv ? "" : "zero"}" data-tab-go="rv"><span class="ic">⭐</span><b>게시를 기다리는 손님 후기</b><span class="n" style="${pendRv ? "color:var(--danger)" : ""}">${pendRv}</span></div></div>

    <h2 class="sec">월별 실적 <select class="month-pick" id="dashMonth">${months.map(m => `<option value="${m}" ${m === dashMonth ? "selected" : ""}>${monthKo(m)}</option>`).join("")}</select> <small>방문일 기준</small></h2>
    <div class="kpis">
      <div class="kpi"><small>예약</small><b>${st.active}</b><em>취소 ${st.cancel} · 노쇼 ${st.noshow}</em></div>
      <div class="kpi"><small>방문 완료</small><b>${st.done}</b><em>${st.active ? Math.round(st.done / st.active * 100) : 0}% 방문</em></div>
      <div class="kpi"><small>손님 결제액 합계</small><b>${vnd(st.paid)}</b><em>${krw(st.paid)}</em></div>
      <div class="kpi money"><small>수수료</small><b>${vnd(st.comm)}</b><em>${krw(st.comm)}${st.unsettled ? ` · 미정산 ${vnd(st.unsettled)}` : ""}</em></div>
    </div>
    <h2 class="sec">사이트 반응 <small>${monthKo(dashMonth)} · 자동 집계 (로봇 제외, 개인정보 없이 숫자만)</small></h2>
    <div class="kpis">
      <div class="kpi"><small>총 방문 수</small><b>${sv("hit")}</b><em>페이지를 연 횟수 (새로고침·재방문 포함)</em></div>
      <div class="kpi"><small>방문자</small><b>${sv("visit")}</b><em>같은 사람은 하루 1명으로 센 합계</em></div>
      <div class="kpi"><small>업체 상세 조회</small><b>${sv("view")}</b><em>업체 페이지를 연 횟수</em></div>
      <div class="kpi"><small>상담하기 클릭</small><b>${sv("consult")}</b><em>카톡 상담 버튼</em></div>
      <div class="kpi"><small>상담 → 예약</small><b>${hasSt && consultAll ? Math.round(st.active / consultAll * 100) + "%" : "-"}</b><em>예약 ${st.active}건 ÷ 상담 클릭</em></div>
    </div>
    <h2 class="sec">방문자 분석 <small>${monthKo(dashMonth)} · 방문자 1명당 하루 1번 · 이름·IP 없이 분류만 저장</small></h2>
    ${DIMS[dashMonth] ? `<div class="dims">
      ${dailyChart(dashMonth)}
      ${dimCard(dashMonth, "src", "어디서 들어왔나요", "링크를 누른 곳이에요. '직접 방문'은 주소를 직접 쳤거나 즐겨찾기·일부 앱에서 열린 경우예요.")}
      ${dimCard(dashMonth, "tz", "지금 어디에 있나요", "휴대폰·PC의 시간대로 봐요. 여행 준비 중(한국)인지, 이미 현지(베트남)인지 알 수 있어요.")}
      ${dimCard(dashMonth, "dev", "어떤 기기로 봤나요")}
      ${dimCard(dashMonth, "lang", "어떤 언어를 쓰나요", "휴대폰·브라우저 기본 언어예요.")}
    </div>` : `<p class="hint">불러오는 중…</p>`}
    <h2 class="sec">업체별 <small>${monthKo(dashMonth)}</small></h2>
    ${rows.length ? `<div class="tscroll"><table class="t"><thead><tr><th>업체</th><th class="num">수수료율</th><th class="num">조회</th><th class="num">상담</th><th class="num">예약</th><th class="num">방문</th><th class="num">결제액</th><th class="num">수수료</th><th class="num">미정산</th><th></th></tr></thead><tbody>
      ${rows.map(r => `<tr class="click" data-shop="${esc(r.id)}"><td><b>${esc(r.name)}</b></td><td class="num">${r.rate ? r.rate + "%" : `<span style="color:var(--danger)">미정</span>`}</td><td class="num">${r.views}</td><td class="num">${r.consult}</td><td class="num">${r.active}</td><td class="num">${r.done}</td><td class="num">${vnd(r.paid)}</td><td class="num"><b>${vnd(r.comm)}</b></td><td class="num">${r.unsettled ? vnd(r.unsettled) : "-"}</td><td class="num">${r.id !== "-" ? `<button class="btn sm" data-rep="${esc(r.id)}">리포트</button>` : ""}</td></tr>`).join("")}
      </tbody><tfoot><tr><td>합계</td><td></td><td class="num">${sv("view")}</td><td class="num">${sv("consult")}</td><td class="num">${st.active}</td><td class="num">${st.done}</td><td class="num">${vnd(st.paid)}</td><td class="num">${vnd(st.comm)}</td><td class="num">${vnd(st.unsettled)}</td><td></td></tr></tfoot></table></div>`
      : `<div class="todo"><div class="empty">이 달에는 예약이 없어요.</div></div>`}
    <p class="hint" style="margin:14px 0 40px">수수료 = 손님이 업체에 낸 금액 × 업체 수수료율. 방문 완료 처리할 때 결제 금액을 넣으면 자동으로 계산돼요.<br>'리포트'는 업체에 보내는 월간 성과 보고서예요 (조회·상담·예약·방문·수수료, 베트남어·영어·한국어).</p>`;
  $("dashMonth").onchange = e => { dashMonth = e.target.value; drawDash(); };
  $("tab-dash").querySelectorAll("[data-todo]").forEach(r => r.onclick = () => { if (r.classList.contains("zero")) return; bkF = { ...BKF0, st: "all", todo: r.dataset.todo }; showTab("bk"); });
  $("tab-dash").querySelectorAll("[data-wtodo]").forEach(r => r.onclick = () => { if (r.classList.contains("zero")) return; const t = workTodos().find(x => x[0] === r.dataset.wtodo); if (t) t[4](); });
  $("tab-dash").querySelectorAll("[data-tab-go]").forEach(r => r.onclick = () => { if (!r.classList.contains("zero")) showTab(r.dataset.tabGo); });
  $("tab-dash").querySelectorAll("[data-go]").forEach(r => r.onclick = () => {
    bkF = r.dataset.go === "today" ? { ...BKF0, st: "all", from: today, to: today } : { ...BKF0, st: "requested" }; showTab("bk"); });
  $("tab-dash").querySelectorAll("[data-rep]").forEach(b => b.onclick = e => { e.stopPropagation(); shopReport(b.dataset.rep, dashMonth); });
  $("tab-dash").querySelectorAll("[data-shop]").forEach(r => r.onclick = () => { bkF = { ...BKF0, st: "all", shop: r.dataset.shop === "-" ? "" : r.dataset.shop, from: dashMonth + "-01", to: dashMonth + "-31" }; showTab("bk"); });
}

/* ===== 예약 목록 ===== */
const BKF0 = { st: "open", shop: "", q: "", from: "", to: "", todo: "" };
let bkF = { ...BKF0 };
const ST_GROUPS = [["open", "진행 중", b => isOpenSt(b.status)], ["requested", "접수", b => b.status === "requested"], ["confirmed", "확정", b => b.status === "confirmed"],
  ["visited", "방문완료·정산 전", b => b.status === "visited"], ["settled", "정산완료", b => b.status === "settled"],
  ["closed", "취소·불가·노쇼", b => ["cancelled", "rejected", "noshow"].includes(b.status)], ["all", "전체", () => true]];
function filteredBookings() {
  const g = ST_GROUPS.find(x => x[0] === bkF.st) || ST_GROUPS[0];
  const qq = bkF.q.trim().toLowerCase().replace(/\s/g, "");
  const td = bkF.todo ? TODO.find(t => t[0] === bkF.todo) : null;
  return BOOKINGS.filter(b => g[2](b) && (!td || td[3](b)) && (!bkF.shop || b.shop_id === bkF.shop) &&
    (!bkF.from || (b.visit_date || "") >= bkF.from) && (!bkF.to || (b.visit_date || "") <= bkF.to) &&
    (!qq || [b.code, b.customer_name, b.contact, shopName(b), b.menu_name].join(" ").toLowerCase().replace(/\s/g, "").includes(qq)));
}
function drawBookings() {
  const list = filteredBookings();
  const sortKey = b => (isOpenSt(b.status) ? "0" : "1") + (b.visit_date || "9999") + (b.visit_time || "");
  if (bkF.st === "open" || bkF.st === "requested" || bkF.st === "confirmed") list.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  const td = bkF.todo ? TODO.find(t => t[0] === bkF.todo) : null;
  const shopOpts = [...new Set(BOOKINGS.map(b => b.shop_id).filter(Boolean))].map(id => [id, shopName({ shop_id: id })]).sort((a, b) => a[1].localeCompare(b[1]));
  $("tab-bk").innerHTML = `
    <div class="pill-filter">${ST_GROUPS.map(([k, n, f]) => `<button data-st="${k}" class="${bkF.st === k && !bkF.todo ? "on" : ""}">${n}<em>${BOOKINGS.filter(f).length}</em></button>`).join("")}</div>
    ${td ? `<div class="notice warn" style="margin:0 0 8px"><span class="grow">${td[1]} <b>${td[2]}</b> 만 보는 중</span><button class="btn sm" id="tdOff">전체 보기</button></div>` : ""}
    <div class="toolbar" style="margin-top:6px">
      <input type="search" id="bkQ" placeholder="예약번호, 손님 이름, 연락처, 업체" value="${esc(bkF.q)}">
      <select id="bkShop"><option value="">업체 전체</option>${shopOpts.map(([id, n]) => `<option value="${esc(id)}" ${bkF.shop === id ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>
      <label class="hint">방문일 <input type="date" id="bkFrom" value="${bkF.from}"> ~ <input type="date" id="bkTo" value="${bkF.to}"></label>
      <button class="btn main" id="bkNew">＋ 예약 직접 등록</button>
      <button class="btn" id="bkExp">⬇ 엑셀(CSV)</button>
    </div>
    <div class="tscroll"><table class="t"><thead><tr><th>예약번호</th><th>방문</th><th>업체</th><th class="hide-m">메뉴</th><th>손님</th><th>상태</th><th title="📨 업체에 알림 · 🏪 업체 답 · 📣 손님 안내 · 🙋 손님 방문 확인 · ⭐ 후기">흔적</th><th class="num">결제 / 수수료</th></tr></thead><tbody>
    ${list.map(b => `<tr class="click" data-b="${b.id}">
      <td><span class="bk-code">${esc(b.code)}</span><br><span class="src">${SRC[b.source] || b.source} · ${dt(b.created_at)}</span></td>
      <td><b>${dayKo(b.visit_date)}</b><br>${esc(b.visit_time || "")}</td>
      <td>${esc(shopName(b))}</td>
      <td class="hide-m">${esc(b.menu_name || "-")} <span class="hint">× ${b.people}</span></td>
      <td>${esc(b.customer_name || "")}<br><span class="hint">${esc(b.contact || "")}</span></td>
      <td>${stBadge(b.status)}</td>
      <td>${marks(b)}</td>
      <td class="num">${b.paid_amount != null ? vnd(b.paid_amount) + `<br><b style="color:var(--main)">${vnd(b.commission)}</b>` : `<span class="hint">${b.list_price ? "예상 " + vnd(b.list_price) : "-"}</span>`}</td>
    </tr>`).join("") || `<tr><td colspan="8"><div class="empty">조건에 맞는 예약이 없어요.</div></td></tr>`}
    </tbody></table></div>
    <p class="hint" style="margin:12px 0 40px">흔적: 📨 업체에 알림 · 🏪 업체가 링크로 답함 · 📣 손님에게 안내 · 🙋 손님이 방문 확인 · ⭐ 후기. 흔적이 많을수록 "엉클데이 손님"이라는 근거가 단단해져요.</p>`;
  $("tab-bk").querySelectorAll("[data-st]").forEach(b => b.onclick = () => { bkF.st = b.dataset.st; bkF.todo = ""; drawBookings(); });
  if ($("tdOff")) $("tdOff").onclick = () => { bkF.todo = ""; drawBookings(); };
  let t; $("bkQ").oninput = e => { clearTimeout(t); t = setTimeout(() => { bkF.q = e.target.value; const pos = e.target.selectionStart; drawBookings(); $("bkQ").focus(); $("bkQ").setSelectionRange(pos, pos); }, 250); };
  $("bkShop").onchange = e => { bkF.shop = e.target.value; drawBookings(); };
  $("bkFrom").onchange = e => { bkF.from = e.target.value; drawBookings(); };
  $("bkTo").onchange = e => { bkF.to = e.target.value; drawBookings(); };
  $("bkNew").onclick = () => newBooking();
  $("bkExp").onclick = () => exportBookings(list);
  $("tab-bk").querySelectorAll("[data-b]").forEach(r => r.onclick = () => openBooking(r.dataset.b));
}
const TOLD = new Set();   // 손님 안내 기록이 있는 예약 (이벤트에서)
function marks(b) {
  const rv = RVS.some(r => r.booking_id === b.id);
  const m = [["📨", b.sent_to_shop_at, "업체에 알림"], ["🏪", b.shop_replied_at, "업체가 링크로 답함"], ["📣", TOLD.has(b.id), "손님에게 안내"], ["🙋", b.customer_visit_at, "손님 방문 확인"], ["⭐", rv, "후기"]];
  return `<span class="marks">${m.map(([i, on, t]) => `<i class="${on ? "on" : ""}" title="${t}${on && typeof on === "string" ? " " + dt(on) : ""}">${i}</i>`).join("")}</span>`;
}
async function loadTold() {
  const r = await sb.from("booking_events").select("booking_id").in("action", ["sent_to_customer"]);
  if (!r.error) { TOLD.clear(); r.data.forEach(x => TOLD.add(x.booking_id)); }
  BOOKINGS.forEach(b => b._custTold = TOLD.has(b.id));
}
function exportBookings(list) {
  const H = [["code", "예약번호"], ["created_at", "접수시각"], ["source", "경로"], ["status", "상태"], ["visit_date", "방문일"], ["visit_time", "시간"], ["shop", "업체"], ["menu_name", "메뉴"], ["people", "인원"],
    ["customer_name", "손님"], ["contact", "연락처"], ["list_price", "예상금액"], ["paid_amount", "결제금액"], ["commission_rate", "수수료율"], ["commission", "수수료"],
    ["sent_to_shop_at", "업체알림"], ["shop_replied_at", "업체답변"], ["customer_visit_at", "손님방문확인"], ["admin_memo", "메모"]];
  const rows = list.map(b => H.map(([k]) => k === "shop" ? shopName(b) : k === "status" ? ST_SHORT[b.status] : k === "source" ? SRC[b.source] || b.source : b[k] ?? "").map(csvCell).join(","));
  saveFile(`엉클데이_예약_${vnToday()}.csv`, "﻿" + H.map(h => h[1]).join(",") + "\r\n" + rows.join("\r\n") + "\r\n");
}

/* ===== 업체·손님에게 보낼 메시지 ===== */
function shopMsg(b, l) {
  const s = shopById(b.shop_id);
  const m = s && (s.menu || []).find(x => x.name.ko === b.menu_name);
  const mn = m ? (m.name[l] || m.name.en || m.name.ko) : b.menu_name;
  const link = siteUrl("partner.html#" + b.shop_token);
  const d = b.visit_date ? b.visit_date.split("-").reverse().join("/") : "-";
  const nat = { ko: { ko: "한국", en: "Korea", vi: "Hàn Quốc" }, en: { ko: "영어권", en: "English", vi: "nói tiếng Anh" }, vi: { ko: "베트남", en: "Vietnam", vi: "Việt Nam" } }[b.lang] || {};
  if (l === "vi") return `[Uncle Day] Đặt lịch mới · ${b.code}
📅 ${d} lúc ${b.visit_time || "-"}
💆 ${mn}${b.menu_min ? ` (${b.menu_min} phút)` : ""} × ${b.people} người
👤 Khách: ${b.customer_name}${nat.vi ? ` (${nat.vi})` : ""}${b.note ? `\n📝 Ghi chú: ${b.note}` : ""}${b.list_price ? `\n💰 Giá dự kiến: ${vnd(b.list_price)}` : ""}

👉 Vui lòng bấm link để NHẬN hoặc TỪ CHỐI lịch:
${link}
Sau khi khách đến, mở lại link này và nhập số tiền khách đã thanh toán. Cảm ơn!`;
  if (l === "en") return `[Uncle Day] New booking · ${b.code}
📅 ${d} at ${b.visit_time || "-"}
💆 ${mn}${b.menu_min ? ` (${b.menu_min} min)` : ""} × ${b.people}
👤 Guest: ${b.customer_name}${nat.en ? ` (${nat.en})` : ""}${b.note ? `\n📝 Notes: ${b.note}` : ""}${b.list_price ? `\n💰 Estimated: ${vnd(b.list_price)}` : ""}

👉 Please tap to ACCEPT or DECLINE:
${link}
After the guest visits, open the link again and enter the amount paid. Thank you!`;
  return `[엉클데이] 새 예약 · ${b.code}
📅 ${dayKo(b.visit_date)} ${b.visit_time || ""}
💆 ${b.menu_name}${b.menu_min ? ` (${b.menu_min}분)` : ""} × ${b.people}명
👤 손님: ${b.customer_name}${b.note ? `\n📝 요청: ${b.note}` : ""}${b.list_price ? `\n💰 예상 금액: ${vnd(b.list_price)}` : ""}

👉 아래 링크에서 수락/불가를 눌러 주세요:
${link}
손님이 다녀간 뒤 같은 링크에서 결제 금액을 넣어 주세요. 감사합니다!`;
}
function custMsg(b) {
  const link = siteUrl("booking.html#" + b.customer_token);
  const s = shopById(b.shop_id);
  const l = ["ko", "en", "vi"].includes(b.lang) ? b.lang : "en";
  const sn = s ? (s.name[l] || s.name.en || s.name.ko) : b.shop_name;
  const ad = s && s.address ? (s.address[l] || s.address.en || s.address.ko || "") : "";
  const d = b.visit_date ? (l === "ko" ? dayKo(b.visit_date) : b.visit_date.split("-").reverse().join("/")) : "-";
  const T = {
    ko: { ok: "예약이 확정됐어요 ✅", req: "예약 요청을 받았어요. 업체에 확인하고 다시 연락드릴게요.", no: "요청하신 시간은 업체 사정으로 예약이 어려워요 🙏 다른 시간이나 비슷한 업체를 안내해 드릴게요.",
      code: "예약번호", shop: "업체", at: "일시", menu: "메뉴", ppl: n => n + "명", vo: "예약확인증", tail: "도착하면 예약확인증을 업체에 보여 주세요. 결제는 업체에서 직접 하시면 돼요." },
    en: { ok: "Your booking is confirmed ✅", req: "We received your request and are checking with the shop.", no: "Sorry, the shop can't take that time 🙏 We'll suggest another time or a similar shop.",
      code: "Booking no.", shop: "Shop", at: "Date", menu: "Service", ppl: n => n + (n > 1 ? " guests" : " guest"), vo: "Voucher", tail: "Show the voucher when you arrive. You pay the shop directly." },
    vi: { ok: "Lịch hẹn đã được xác nhận ✅", req: "Chúng tôi đã nhận yêu cầu và đang kiểm tra với cơ sở.", no: "Xin lỗi, cơ sở không nhận được khung giờ này 🙏 Chúng tôi sẽ đề xuất giờ khác.",
      code: "Mã đặt lịch", shop: "Cơ sở", at: "Thời gian", menu: "Dịch vụ", ppl: n => n + " người", vo: "Phiếu đặt lịch", tail: "Đưa phiếu cho cơ sở khi đến. Thanh toán trực tiếp tại cơ sở." }
  }[l];
  const head = b.status === "confirmed" ? T.ok : b.status === "rejected" ? T.no : T.req;
  return `[Uncle Day] ${head}
${T.code}: ${b.code}
${T.shop}: ${sn}${ad ? `\n📍 ${ad}` : ""}
${T.at}: ${d} ${b.visit_time || ""}
${T.menu}: ${(() => { const m = s && s.menu.find(x => x.name.ko === b.menu_name); return m ? (m.name[l] || m.name.en || m.name.ko) : b.menu_name; })()} · ${T.ppl(b.people)}
${T.vo}: ${link}
${b.status === "confirmed" ? T.tail : ""}`.trim();
}
const zaloLink = v => { const d = String(v || "").replace(/[^\d]/g, ""); return /^https?:/.test(v || "") ? v : d ? `https://zalo.me/${d.startsWith("84") ? "0" + d.slice(2) : d}` : ""; };

/* ===== 예약 상세 ===== */
async function openBooking(id) {
  let b = BOOKINGS.find(x => x.id === id); if (!b) return;
  let evs = [];
  const pv = PRIV[b.shop_id] || { contract: {} };
  const ct = pv.contract || {};
  let msgLang = ct.msgLang || "vi";
  const shop = shopById(b.shop_id);
  $("layer").innerHTML = `<div class="overlay" id="ov"><div class="panel" role="dialog" aria-label="예약 상세">
    <div class="panel-head"><h2><span class="bk-code">${esc(b.code)}</span> · ${esc(b.customer_name || "")}</h2><span id="pSt"></span><button class="btn" id="pCancel">닫기</button></div>
    <div class="panel-body">
      <div class="box"><h3>진행 상태</h3>
        <div class="btn-row" id="stBtns"></div>
        <div class="calc">
          <label class="f"><span>손님이 업체에 낸 금액 (₫)</span><input id="paid" inputmode="numeric" placeholder="${b.list_price ? Number(b.list_price).toLocaleString("en-US") : "0"}"></label>
          <label class="f"><span>수수료율 (%)</span><input id="rate" type="number" min="0" max="100" step="0.5"></label>
          <div class="f"><span>수수료</span><div class="out" id="commOut"></div></div>
        </div>
        <div class="btn-row"><button class="btn sm" id="saveAmt">금액 저장</button><span class="hint" id="amtHint"></span></div>
      </div>

      <div class="box"><h3>🔗 연결 흔적 <small>엉클데이가 연결한 손님이라는 근거</small></h3><div class="trace" id="trace"></div></div>

      <div class="two">
        <div class="box"><h3>🏪 업체에 알리기</h3>
          <div class="hint">${esc(shop ? shop.name.ko : b.shop_name || "")}${ct.person ? " · " + esc(ct.person) : ""}${ct.phone ? " · " + esc(ct.phone) : ""}${!ct.phone && !ct.zalo && !ct.kakao ? ` · <span style="color:var(--danger)">업체 연락처가 없어요 (업체 수정 → 계약·정산)</span>` : ""}</div>
          <div class="btn-row">${[["vi", "베트남어"], ["en", "영어"], ["ko", "한국어"]].map(([k, n]) => `<button class="btn sm ${k === msgLang ? "main" : ""}" data-ml="${k}">${n}</button>`).join("")}</div>
          <pre class="msg-prev" id="shopMsg"></pre>
          <div class="btn-row">
            <button class="btn main" id="copyShop">📋 메시지 복사 (보낸 걸로 기록)</button>
            ${zaloLink(ct.zalo || ct.phone) ? `<a class="btn" href="${esc(zaloLink(ct.zalo || ct.phone))}" target="_blank" rel="noopener">잘로 열기</a>` : ""}
            <a class="btn sm" href="partner.html#${esc(b.shop_token)}" target="_blank" rel="noopener">업체 화면 미리보기</a>
          </div>
          <div class="hint">업체는 링크에서 로그인 없이 <b>수락 / 불가 / 방문 완료(+금액)</b>만 눌러요. 누르면 시간과 함께 아래 기록에 남아요.</div>
        </div>
        <div class="box"><h3>🙋 손님에게 안내</h3>
          <div class="hint">${esc(b.contact || "")} · ${LANG_KO[b.lang] || b.lang}${b.customer_id ? ` · <a href="#" id="toCust">👤 손님 카드 보기</a>` : ""}${b.marketing_ok ? " · ✅ 안내 동의" : ""}</div>
          ${b.coupon_code ? `<div class="warn" style="margin:6px 0">🎟 손님이 쿠폰 코드 <b>${esc(b.coupon_code)}</b>를 적었어요 → 고객 탭 쿠폰 목록에서 확인하고 <b>사용 처리</b>해 주세요</div>` : ""}
          <pre class="msg-prev" id="custMsg"></pre>
          <div class="btn-row">
            <button class="btn main" id="copyCust">📋 안내 메시지 복사 (보낸 걸로 기록)</button>
            <button class="btn sm" id="copyVo">예약확인증 링크만 복사</button>
            <a class="btn sm" href="booking.html#${esc(b.customer_token)}" target="_blank" rel="noopener">예약확인증 보기</a>
          </div>
        </div>
      </div>

      <div class="box"><h3>예약 정보</h3>
        <div class="three">
          <label class="f"><span>업체</span><select id="eShop">${shops.map(s => `<option value="${esc(s.id)}" ${s.id === b.shop_id ? "selected" : ""}>${esc(s.name.ko)}</option>`).join("")}${!shop ? `<option value="" selected>${esc(b.shop_name || "(없음)")}</option>` : ""}</select></label>
          <label class="f"><span>메뉴</span><input id="eMenu" list="eMenuList" value="${esc(b.menu_name || "")}"><datalist id="eMenuList"></datalist></label>
          <label class="f"><span>인원</span><input id="ePeople" type="number" min="1" max="30" value="${b.people}"></label>
        </div>
        <div class="three">
          <label class="f"><span>방문일</span><input id="eDate" type="date" value="${esc(b.visit_date || "")}"></label>
          <label class="f"><span>시간</span><input id="eTime" type="time" value="${esc(b.visit_time || "")}"></label>
          <label class="f"><span>예상 금액 (₫)</span><input id="eList" inputmode="numeric" value="${b.list_price ?? ""}"></label>
        </div>
        <div class="three">
          <label class="f"><span>손님 이름</span><input id="eName" value="${esc(b.customer_name || "")}"></label>
          <label class="f"><span>연락처</span><input id="eContact" value="${esc(b.contact || "")}"></label>
          <label class="f"><span>손님 언어 · 경로</span><div style="display:flex;gap:6px"><select id="eLang">${Object.entries(LANG_KO).map(([k, n]) => `<option value="${k}" ${k === b.lang ? "selected" : ""}>${n}</option>`).join("")}</select><select id="eSrc">${Object.entries(SRC).map(([k, n]) => `<option value="${k}" ${k === b.source ? "selected" : ""}>${n}</option>`).join("")}</select></div></label>
        </div>
        <label class="f"><span>손님 요청사항 (업체에도 보여요)</span><textarea id="eNote">${esc(b.note || "")}</textarea></label>
        <label class="f"><span>관리자 메모 (우리만 봐요)</span><textarea id="eMemo">${esc(b.admin_memo || "")}</textarea></label>
        <div class="btn-row"><button class="btn main" id="saveInfo">정보 저장</button></div>
      </div>

      <div class="box"><h3>기록 <small>누가 언제 무엇을 했는지 — 지울 수 없어요</small></h3>
        <div style="display:flex;gap:8px"><input id="memoIn" placeholder="통화·메시지 내용 등을 남겨요 (예: 업체 매니저와 통화, 14시 확정)" style="flex:1;min-width:0;padding:9px 11px;border:1px solid var(--line);border-radius:9px"><button class="btn" id="memoAdd">남기기</button></div>
        <ul class="tl" id="tl"><li>불러오는 중…</li></ul>
      </div>
    </div></div></div>`;
  const close = () => { $("layer").innerHTML = ""; if (TAB === "bk") drawBookings(); else if (TAB === "dash") drawDash(); drawCounts(); };
  $("pCancel").onclick = close;
  $("ov").onclick = e => { if (e.target.id === "ov") close(); };

  const fillMenus = () => { const s = shopById($("eShop").value); $("eMenuList").innerHTML = s ? s.menu.map(m => `<option value="${esc(m.name.ko)}">`).join("") : ""; };
  fillMenus(); $("eShop").onchange = fillMenus;

  function drawTop() {
    $("pSt").innerHTML = stBadge(b.status);
    const locked = b.status === "settled";
    const btns = [["requested", "접수로"], ["confirmed", "✅ 업체 확정"], ["rejected", "업체 불가"], ["visited", "🙌 방문 완료"], ["noshow", "노쇼"], ["cancelled", "취소"]];
    $("stBtns").innerHTML = locked ? `<span class="hint">정산이 끝난 예약이라 상태와 금액을 바꿀 수 없어요. (정산 탭에서 입금 확인을 취소하면 바꿀 수 있어요)</span>`
      : btns.map(([k, n]) => `<button class="btn st-btn ${b.status === k ? "cur" : ""}" data-st="${k}">${n}</button>`).join("");
    $("paid").value = b.paid_amount != null ? Number(b.paid_amount).toLocaleString("en-US") : "";
    $("rate").value = b.commission_rate;
    $("paid").disabled = $("rate").disabled = $("saveAmt").disabled = locked;
    calc();
    $("amtHint").textContent = b.settlement_id ? "정산서에 들어간 예약이에요." : "";
    $("stBtns").querySelectorAll("[data-st]").forEach(x => x.onclick = () => setStatus(x.dataset.st));
    $("shopMsg").textContent = shopMsg(b, msgLang);
    $("custMsg").textContent = custMsg(b);
    drawTrace();
  }
  function calc() {
    const p = num($("paid").value), r = +$("rate").value || 0;
    $("commOut").textContent = p == null ? "금액을 넣어 주세요" : `${vnd(Math.round(p * r / 100))} ${krw(Math.round(p * r / 100))}`;
  }
  $("paid").oninput = () => { const v = num($("paid").value); $("paid").value = v == null ? "" : v.toLocaleString("en-US"); calc(); };
  $("rate").oninput = calc;
  async function setStatus(st) {
    if (st === b.status) return;
    const patch = { status: st };
    if (st === "visited") {
      const p = num($("paid").value);
      if (p == null) { toast("손님이 낸 금액을 먼저 넣어 주세요. (모르면 0)", 3500); $("paid").focus(); return; }
      patch.paid_amount = p; patch.commission_rate = +$("rate").value || 0;
    }
    try { b = await updBooking(b.id, patch, "상태 변경"); toast(`${ST[st]}(으)로 바꿨어요`); drawTop(); loadEvents(); } catch (e) {}
  }
  $("saveAmt").onclick = async () => {
    try { b = await updBooking(b.id, { paid_amount: num($("paid").value), commission_rate: +$("rate").value || 0 }, "금액 저장"); toast("금액을 저장했어요"); drawTop(); loadEvents(); } catch (e) {}
  };
  document.querySelectorAll("[data-ml]").forEach(x => x.onclick = () => {
    msgLang = x.dataset.ml; document.querySelectorAll("[data-ml]").forEach(y => y.classList.toggle("main", y === x)); $("shopMsg").textContent = shopMsg(b, msgLang); });
  $("copyShop").onclick = async () => {
    await copy(shopMsg(b, msgLang), "업체 메시지를 복사했어요. 잘로·카톡에 붙여 넣어 보내 주세요.");
    if (!b.sent_to_shop_at) b = await updBooking(b.id, { sent_to_shop_at: new Date().toISOString() }).catch(() => b);
    await logEvent(b.id, "sent_to_shop", { lang: msgLang }); drawTop(); loadEvents();
  };
  $("copyCust").onclick = async () => {
    await copy(custMsg(b), "손님 안내 메시지를 복사했어요.");
    await logEvent(b.id, "sent_to_customer", { status: b.status }); TOLD.add(b.id); b._custTold = true; loadEvents(); drawTrace();
  };
  $("copyVo").onclick = () => copy(siteUrl("booking.html#" + b.customer_token), "예약확인증 링크를 복사했어요");
  $("saveInfo").onclick = async () => {
    const sid = $("eShop").value, s = shopById(sid);
    const m = s && s.menu.find(x => x.name.ko === $("eMenu").value.trim());
    const ppl = Math.max(1, +$("ePeople").value || 1);
    const patch = { menu_name: $("eMenu").value.trim(), people: ppl, visit_date: $("eDate").value || null, visit_time: $("eTime").value || null,
      customer_name: $("eName").value.trim(), contact: $("eContact").value.trim(), lang: $("eLang").value, source: $("eSrc").value,
      note: $("eNote").value, admin_memo: $("eMemo").value, list_price: num($("eList").value) };
    if (m) { patch.menu_min = m.min; patch.unit_price = m.price; if (patch.menu_name !== b.menu_name || ppl !== b.people) patch.list_price = m.price * ppl; }
    if (sid && sid !== b.shop_id) { patch.shop_id = sid; patch.shop_name = s.name.ko; if (b.status !== "settled") patch.commission_rate = rateOf(sid); }
    try { b = await updBooking(b.id, patch, "정보 저장"); toast("저장했어요"); $("eList").value = b.list_price ?? ""; drawTop(); loadEvents(); } catch (e) {}
  };
  $("memoAdd").onclick = async () => { const v = $("memoIn").value.trim(); if (!v) return; await logEvent(b.id, "memo", { memo: v }); $("memoIn").value = ""; loadEvents(); };
  $("memoIn").onkeydown = e => { if (e.key === "Enter") $("memoAdd").onclick(); };

  function drawTrace() {
    const rv = RVS.find(r => r.booking_id === b.id);
    const told = evs.find(e => e.action === "sent_to_customer");
    const st = SETTLES.find(s => s.id === b.settlement_id);
    const rows = [
      [true, `예약 접수 — ${SRC[b.source] || b.source} · ${dt(b.created_at)}`],
      [!!b.sent_to_shop_at, b.sent_to_shop_at ? `업체에 예약 알림 · ${dt(b.sent_to_shop_at)}` : "업체에 예약 알림 (아직)"],
      [!!b.shop_replied_at, b.shop_replied_at ? `업체가 링크로 직접 답함 · ${dt(b.shop_replied_at)}` : "업체가 링크로 직접 답함 (아직 — 관리자가 대신 처리해도 돼요)"],
      [!!told, told ? `손님에게 안내 · ${dt(told.at)}` : "손님에게 안내 (아직)"],
      [!!b.customer_visit_at, b.customer_visit_at ? `손님이 직접 '다녀왔어요' · ${dt(b.customer_visit_at)}` : "손님이 직접 방문 확인 (선택)"],
      [!!rv, rv ? `손님 후기 ${"★".repeat(rv.stars)}` : "손님 후기 (선택)"],
      [!!st, st ? `정산서 ${monthKo(st.month)} · ${st.status === "paid" ? "입금 완료" : "청구됨"}` : "정산 (방문 완료 후)"]
    ];
    $("trace").innerHTML = rows.map(([ok, t]) => `<div><span class="${ok ? "y" : "n"}">${ok ? "✓" : "○"}</span><span>${esc(t)}</span></div>`).join("");
  }
  const EVN = { created: "예약 접수", status: "상태 변경", edit: "정보 수정", sent_to_shop: "업체에 메시지 보냄", sent_to_customer: "손님에게 안내 보냄", customer_visited: "손님이 '다녀왔어요' 누름", shop_memo: "업체 메모", memo: "메모" };
  const FN = { status: "상태", paid_amount: "결제 금액", commission_rate: "수수료율", visit_date: "방문일", visit_time: "시간", people: "인원", menu_name: "메뉴", shop_id: "업체", customer_name: "이름", contact: "연락처", settlement_id: "정산서", source: "경로" };
  const fv = (k, v) => v == null ? "없음" : k === "status" ? ST_SHORT[v] || v : k === "paid_amount" ? vnd(v) : k === "commission_rate" ? v + "%" : k === "settlement_id" ? "연결됨" : k === "source" ? SRC[v] || v : String(v);
  async function loadEvents() {
    const r = await sb.from("booking_events").select("*").eq("booking_id", b.id).order("at", { ascending: false });
    evs = r.data || [];
    $("tl").innerHTML = evs.map(e => {
      const who = e.actor === "업체" ? "shop" : e.actor === "손님" ? "cust" : e.actor.startsWith("관리자") ? "adm" : "";
      let d = "";
      if (e.action === "status" || e.action === "edit") d = Object.entries(e.detail || {}).map(([k, [a, c]]) => `${FN[k] || k}: ${esc(fv(k, a))} → <b>${esc(fv(k, c))}</b>`).join("<br>");
      else if (e.detail && e.detail.memo) d = esc(e.detail.memo);
      else if (e.action === "sent_to_shop") d = `${{ vi: "베트남어", en: "영어", ko: "한국어" }[e.detail.lang] || ""} 메시지`;
      else if (e.action === "created") d = `${SRC[e.detail.source] || e.detail.source || ""}`;
      return `<li><time>${dt(e.at)}</time><div><span class="who ${who}">${esc(e.actor)}</span> · ${EVN[e.action] || e.action}${d ? `<br>${d}` : ""}</div></li>`;
    }).join("") || `<li>기록이 없어요</li>`;
    drawTrace();
  }
  drawTop(); loadEvents();
  const tc = document.getElementById("toCust"); if (tc) tc.onclick = async e => { e.preventDefault(); if (CRM_READY === null) await loadCrm(); if (CRM_READY) openCustomer(b.customer_id); else toast("고객 관리 준비(crm.sql)가 아직이에요"); };
}

/* ===== 예약 직접 등록 (카톡·전화로 받은 예약) ===== */
function newBooking() {
  const d = document.createElement("div"); d.className = "overlay center";
  const live = shops.filter(isPub).concat(shops.filter(s => !isPub(s)));
  d.innerHTML = `<div class="modal" style="width:min(720px,calc(100% - 32px))"><h2>예약 직접 등록</h2><p class="hint">카카오톡·전화로 받은 예약도 여기에 넣어야 수수료 기록이 남아요.</p>
    <div style="display:grid;gap:10px;margin-top:10px">
      <div class="two"><label class="f"><span>업체 <em>*</em></span><select id="nShop">${live.map(s => `<option value="${esc(s.id)}">${esc(s.name.ko)} · ${esc(cityName(s.city))}</option>`).join("")}</select></label>
        <label class="f"><span>메뉴 <em>*</em></span><select id="nMenu"></select></label></div>
      <div id="nCustomWrap" class="two" hidden><label class="f"><span>메뉴 이름</span><input id="nMenuName"></label><label class="f"><span>1인 가격 (₫)</span><input id="nPrice" inputmode="numeric"></label></div>
      <div class="three"><label class="f"><span>방문일 <em>*</em></span><input type="date" id="nDate" value="${vnToday()}"></label>
        <label class="f"><span>시간</span><input type="time" id="nTime"></label>
        <label class="f"><span>인원</span><input type="number" id="nPpl" value="1" min="1" max="30"></label></div>
      <div class="three"><label class="f"><span>손님 이름 <em>*</em></span><input id="nName"></label>
        <label class="f"><span>연락처</span><input id="nContact" placeholder="카톡 ID, 전화"></label>
        <label class="f"><span>경로 · 언어</span><div style="display:flex;gap:6px"><select id="nSrc"><option value="kakao">카톡</option><option value="phone">전화</option><option value="etc">기타</option><option value="web">사이트</option></select><select id="nLang">${Object.entries(LANG_KO).map(([k, n]) => `<option value="${k}">${n}</option>`).join("")}</select></div></label></div>
      <label class="f"><span>요청사항</span><textarea id="nNote"></textarea></label>
      <label class="sl-ck"><input type="checkbox" id="nMk"><span><b>손님이 쿠폰·이벤트 안내 받기에 동의함</b><small>카톡·전화에서 손님이 직접 "받을게요"라고 했을 때만 체크</small></span></label>
      <label class="f"><span>상태</span><select id="nSt"><option value="requested">접수 (업체 확인 전)</option><option value="confirmed">업체 확정</option><option value="visited">이미 방문 완료</option></select></label>
      <div class="err-text" id="nErr"></div>
    </div>
    <div class="btns"><button class="btn" data-no>취소</button><button class="btn main" data-yes>등록</button></div></div>`;
  document.body.appendChild(d);
  const $$ = id => d.querySelector("#" + id);
  const fill = () => { const s = shopById($$("nShop").value); $$("nMenu").innerHTML = (s ? s.menu.map((m, i) => `<option value="${i}">${esc(m.name.ko)} · ${m.price ? vnd(m.price) : "가격 상담"}</option>`).join("") : "") + `<option value="custom">직접 입력</option>`; $$("nCustomWrap").hidden = $$("nMenu").value !== "custom"; };
  fill(); $$("nShop").onchange = fill; $$("nMenu").onchange = () => $$("nCustomWrap").hidden = $$("nMenu").value !== "custom";
  d.querySelector("[data-no]").onclick = () => d.remove();
  d.querySelector("[data-yes]").onclick = async () => {
    const s = shopById($$("nShop").value);
    const mi = $$("nMenu").value;
    const m = mi === "custom" ? { name: { ko: $$("nMenuName").value.trim() }, min: null, price: num($$("nPrice").value) } : s.menu[+mi];
    if (!$$("nName").value.trim()) { $$("nErr").textContent = "손님 이름을 적어 주세요."; return; }
    if (!m || !m.name.ko) { $$("nErr").textContent = "메뉴를 골라 주세요."; return; }
    const ppl = Math.max(1, +$$("nPpl").value || 1);
    const row = { shop_id: s.id, shop_name: s.name.ko, menu_name: m.name.ko, menu_min: m.min || null, unit_price: m.price || null, people: ppl,
      list_price: m.price ? m.price * ppl : null, visit_date: $$("nDate").value || null, visit_time: $$("nTime").value || null,
      customer_name: $$("nName").value.trim(), contact: $$("nContact").value.trim(), note: $$("nNote").value, lang: $$("nLang").value,
      source: $$("nSrc").value, status: $$("nSt").value, commission_rate: rateOf(s.id), marketing_ok: $$("nMk").checked };
    try {
      const b = await q(sb.from("bookings").insert(row).select().single(), "예약 등록");
      BOOKINGS.unshift(b); d.remove(); toast(`${b.code} 예약을 등록했어요`); openBooking(b.id);
    } catch (e) {}
  };
}

/* ===== 정산 ===== */
let setMonth = null;
function drawSettle() {
  const months = [...new Set([vnMonth(), addMonth(vnMonth(), -1), ...BOOKINGS.map(b => (b.visit_date || "").slice(0, 7)).filter(Boolean)])].sort().reverse();
  setMonth = setMonth || addMonth(vnMonth(), -1);
  const pend = BOOKINGS.filter(b => b.status === "visited" && !b.settlement_id && (b.visit_date || "").startsWith(setMonth));
  const groups = {};
  pend.forEach(b => (groups[b.shop_id || "-"] = groups[b.shop_id || "-"] || []).push(b));
  const older = BOOKINGS.filter(b => b.status === "visited" && !b.settlement_id && (b.visit_date || "") < setMonth + "-01");
  const openInM = BOOKINGS.filter(b => isOpenSt(b.status) && (b.visit_date || "").startsWith(setMonth) && (b.visit_date || "") < vnToday());
  // 업체별 받을 돈
  const owe = {};
  BOOKINGS.filter(b => b.status === "visited" && !b.settlement_id).forEach(b => { const k = b.shop_id || "-"; owe[k] = owe[k] || { unb: 0, bil: 0 }; owe[k].unb += +b.commission || 0; });
  SETTLES.filter(s => s.status === "billed").forEach(s => { const k = s.shop_id || "-"; owe[k] = owe[k] || { unb: 0, bil: 0 }; owe[k].bil += +s.total_commission || 0; });
  $("tab-settle").innerHTML = `
    <h2 class="sec">정산할 내역 <select class="month-pick" id="setMonth">${months.map(m => `<option value="${m}" ${m === setMonth ? "selected" : ""}>${monthKo(m)}</option>`).join("")}</select> <small>방문 완료 · 아직 정산서에 안 들어간 예약</small></h2>
    ${openInM.length ? `<div class="notice warn" style="margin:0 0 10px"><span class="grow">이 달에 방문일이 지났는데 결과가 없는 예약이 <b>${openInM.length}건</b> 있어요. 방문 완료나 노쇼로 정리해야 정산에 들어가요.</span><button class="btn sm" id="goOpen">보기</button></div>` : ""}
    ${older.length ? `<div class="notice warn" style="margin:0 0 10px"><span class="grow">이전 달에 정산 안 된 방문 완료가 <b>${older.length}건</b> 있어요.</span><button class="btn sm" id="goOlder">그 달로</button></div>` : ""}
    ${Object.keys(groups).length ? `<div class="tscroll"><table class="t"><thead><tr><th>업체</th><th class="num">건수</th><th class="num">결제액 합계</th><th class="num">수수료</th><th></th></tr></thead><tbody>
      ${Object.entries(groups).map(([id, arr]) => {
        const miss = arr.filter(b => b.paid_amount == null).length;
        return `<tr><td><b>${esc(shopName(arr[0]))}</b>${rateOf(id) ? ` <span class="hint">${rateOf(id)}%</span>` : ""}${miss ? `<br><span class="err-text">금액 미입력 ${miss}건 — 먼저 넣어 주세요</span>` : ""}</td>
          <td class="num">${arr.length}</td><td class="num">${vnd(arr.reduce((t, b) => t + (+b.paid_amount || 0), 0))}</td>
          <td class="num"><b>${vnd(arr.reduce((t, b) => t + (+b.commission || 0), 0))}</b></td>
          <td class="num"><button class="btn sm" data-list="${esc(id)}">내역</button> <button class="btn sm main" data-mk="${esc(id)}" ${miss || id === "-" ? "disabled" : ""}>정산서 만들기</button></td></tr>`; }).join("")}
      </tbody></table></div>` : `<div class="todo"><div class="empty">${monthKo(setMonth)}에 정산할 방문 완료 예약이 없어요.</div></div>`}

    <h2 class="sec">업체별 받을 수수료 <small>지금까지 전체</small></h2>
    ${Object.keys(owe).length ? `<div class="tscroll"><table class="t"><thead><tr><th>업체</th><th class="num">정산서 만들기 전</th><th class="num">청구함 · 입금 전</th><th class="num">합계</th></tr></thead><tbody>
      ${Object.entries(owe).map(([id, o]) => `<tr><td>${esc(shopName({ shop_id: id === "-" ? null : id, shop_name: "(업체 없음)" }))}</td><td class="num">${vnd(o.unb)}</td><td class="num">${vnd(o.bil)}</td><td class="num"><b>${vnd(o.unb + o.bil)}</b></td></tr>`).join("")}
      </tbody></table></div>` : `<div class="todo"><div class="empty">받을 수수료가 없어요.</div></div>`}

    <h2 class="sec">정산서 <small>만든 순서</small></h2>
    ${SETTLES.length ? `<div class="tscroll"><table class="t"><thead><tr><th>정산 월</th><th>업체</th><th class="num">건수</th><th class="num">결제액</th><th class="num">수수료</th><th>상태</th><th></th></tr></thead><tbody>
      ${SETTLES.map(s => `<tr style="${s.status === "void" ? "opacity:.45" : ""}"><td>${monthKo(s.month)}</td><td><b>${esc(s.shop_name || s.shop_id || "")}</b><br><span class="hint">${dt(s.billed_at)} 청구</span></td>
        <td class="num">${s.booking_count}</td><td class="num">${vnd(s.total_paid)}</td><td class="num"><b>${vnd(s.total_commission)}</b></td>
        <td>${s.status === "paid" ? `<span class="st settled">입금 완료</span><br><span class="hint">${dt(s.paid_at)}</span>` : s.status === "void" ? `<span class="st cancelled">취소됨</span>` : `<span class="st requested">입금 대기</span>`}</td>
        <td class="num">${s.status !== "void" ? `<button class="btn sm" data-view="${s.id}">정산서</button> ${s.status === "billed" ? `<button class="btn sm main" data-paid="${s.id}">입금 확인</button> <button class="btn sm danger" data-void="${s.id}">취소</button>` : `<button class="btn sm" data-unpaid="${s.id}">입금 취소</button>`}` : ""}</td></tr>`).join("")}
      </tbody></table></div>` : `<div class="todo"><div class="empty">아직 만든 정산서가 없어요.</div></div>`}
    <p class="hint" style="margin:14px 0 40px">순서: 방문 완료(금액 입력) → 월말에 <b>정산서 만들기</b> → 업체에 정산서 보내기 → 수수료가 들어오면 <b>입금 확인</b>. 정산서에 들어간 예약은 금액을 바꿀 수 없어요.</p>`;
  $("setMonth").onchange = e => { setMonth = e.target.value; drawSettle(); };
  if ($("goOlder")) $("goOlder").onclick = () => { setMonth = older.map(b => b.visit_date.slice(0, 7)).sort()[0]; drawSettle(); };
  if ($("goOpen")) $("goOpen").onclick = () => { bkF = { ...BKF0, st: "all", todo: "pastOpen" }; showTab("bk"); };
  $("tab-settle").querySelectorAll("[data-list]").forEach(x => x.onclick = () => { bkF = { ...BKF0, st: "visited", shop: x.dataset.list === "-" ? "" : x.dataset.list, from: setMonth + "-01", to: setMonth + "-31" }; showTab("bk"); });
  $("tab-settle").querySelectorAll("[data-mk]").forEach(x => x.onclick = () => confirmBox(`${shopName({ shop_id: x.dataset.mk })} ${monthKo(setMonth)} 정산서를 만들까요?`, async () => {
    const r = await sb.rpc("create_settlement", { p_shop: x.dataset.mk, p_month: setMonth });
    if (r.error) { dbErr(r.error, "정산서 만들기"); return; }
    await Promise.all([loadSettles(), loadBookings()]); drawSettle(); viewStatement(r.data);
  }, "들어간 예약은 금액을 바꿀 수 없게 잠겨요. 잘못 만들면 '취소'로 풀 수 있어요.", "만들기", false));
  $("tab-settle").querySelectorAll("[data-view]").forEach(x => x.onclick = () => viewStatement(x.dataset.view));
  const rpcThen = async (fn, args, msg) => { const r = await sb.rpc(fn, args); if (r.error) { dbErr(r.error); return; } await Promise.all([loadSettles(), loadBookings()]); drawSettle(); toast(msg); };
  $("tab-settle").querySelectorAll("[data-paid]").forEach(x => x.onclick = () => confirmBox("수수료 입금을 확인했나요?", () => rpcThen("settlement_paid", { p_id: x.dataset.paid, p_paid: true }, "입금 완료로 바꿨어요 ✅"), "들어간 예약이 모두 '정산 완료'로 바뀌어요.", "입금 확인", false));
  $("tab-settle").querySelectorAll("[data-unpaid]").forEach(x => x.onclick = () => confirmBox("입금 확인을 취소할까요?", () => rpcThen("settlement_paid", { p_id: x.dataset.unpaid, p_paid: false }, "입금 전으로 되돌렸어요"), "", "되돌리기"));
  $("tab-settle").querySelectorAll("[data-void]").forEach(x => x.onclick = () => confirmBox("이 정산서를 취소할까요?", () => rpcThen("settlement_void", { p_id: x.dataset.void }, "정산서를 취소했어요. 예약은 다시 '정산할 내역'으로 돌아가요."), "취소 기록은 남아요.", "정산서 취소"));
}
async function viewStatement(id) {
  const s = SETTLES.find(x => x.id === id); if (!s) return;
  await loadStats(s.month);
  const list = BOOKINGS.filter(b => b.settlement_id === id).sort((a, b) => (a.visit_date || "").localeCompare(b.visit_date || ""));
  const ct = (PRIV[s.shop_id] || {}).contract || {};
  let L = ct.msgLang === "ko" ? "ko" : ct.msgLang === "en" ? "en" : "vi";
  const T = {
    vi: { t: "BẢNG QUYẾT TOÁN HOA HỒNG", shop: "Cơ sở", per: "Kỳ", date: "Ngày lập", code: "Mã", day: "Ngày", svc: "Dịch vụ", ppl: "Khách", paid: "Khách trả", rate: "%", comm: "Hoa hồng", tot: "Tổng", due: "Số tiền hoa hồng cần thanh toán", st: "Trạng thái", paidSt: "Đã thanh toán", billed: "Chờ thanh toán", note: "Vui lòng kiểm tra và thanh toán. Mọi thắc mắc xin liên hệ Uncle Day.", ...REP_T.vi },
    en: { t: "COMMISSION STATEMENT", shop: "Shop", per: "Period", date: "Issued", code: "No.", day: "Date", svc: "Service", ppl: "Guests", paid: "Paid", rate: "%", comm: "Commission", tot: "Total", due: "Commission due", st: "Status", paidSt: "Paid", billed: "Awaiting payment", note: "Please review and transfer the commission. Contact Uncle Day with any questions.", ...REP_T.en },
    ko: { t: "수수료 정산서", shop: "업체", per: "정산 기간", date: "발행일", code: "예약번호", day: "방문일", svc: "메뉴", ppl: "인원", paid: "결제액", rate: "%", comm: "수수료", tot: "합계", due: "정산 수수료", st: "상태", paidSt: "입금 완료", billed: "입금 대기", note: "확인 후 입금 부탁드려요. 문의는 엉클데이로 주세요.", ...REP_T.ko }
  };
  const draw = () => {
    const t = T[L];
    const shop = shopById(s.shop_id);
    const sn = shop ? (shop.name[L] || shop.name.en || shop.name.ko) : s.shop_name;
    const html = `<div class="stmt">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><img src="images/logo-full.webp" alt="Uncle Day" style="height:46px"><h1>${t.t}</h1></div>
      <div class="meta"><div><b>${t.shop}:</b> ${esc(sn)}<br><b>${t.per}:</b> ${esc(s.month)}</div><div><b>${t.date}:</b> ${new Date(s.billed_at).toLocaleDateString("en-CA")}<br><b>${t.st}:</b> ${s.status === "paid" ? t.paidSt : t.billed}</div></div>
      <table><thead><tr><th>${t.code}</th><th>${t.day}</th><th>${t.svc}</th><th class="num">${t.ppl}</th><th class="num">${t.paid}</th><th class="num">${t.rate}</th><th class="num">${t.comm}</th></tr></thead>
      <tbody>${list.map(b => { const m = shop && shop.menu.find(x => x.name.ko === b.menu_name); return `<tr><td>${esc(b.code)}</td><td>${esc(b.visit_date || "")}</td><td>${esc(m ? (m.name[L] || m.name.en || m.name.ko) : b.menu_name || "")}</td><td class="num">${b.people}</td><td class="num">${vnd(b.paid_amount)}</td><td class="num">${+b.commission_rate}</td><td class="num">${vnd(b.commission)}</td></tr>`; }).join("")}</tbody>
      <tfoot><tr><td colspan="3">${t.tot}</td><td class="num">${list.reduce((a, b) => a + b.people, 0)}</td><td class="num">${vnd(s.total_paid)}</td><td></td><td class="num">${vnd(s.total_commission)}</td></tr></tfoot></table>
      <p class="sum"><b>${t.due}: ${vnd(s.total_commission)}</b></p>
      <p style="color:#555">${t.note}</p>
      ${perfBlock(s.shop_id, s.month, t)}</div>`;
    $("stmtBody").innerHTML = html; $("printArea").innerHTML = html;
    d.querySelectorAll("[data-l]").forEach(x => x.classList.toggle("main", x.dataset.l === L));
  };
  const d = document.createElement("div"); d.className = "overlay center";
  d.innerHTML = `<div class="modal" style="width:min(820px,calc(100% - 32px))">
    <div class="btns" style="justify-content:space-between;margin:0 0 12px"><div class="btn-row">${[["vi", "베트남어"], ["en", "영어"], ["ko", "한국어"]].map(([k, n]) => `<button class="btn sm" data-l="${k}">${n}</button>`).join("")}</div>
    <div class="btn-row"><button class="btn" data-copy>메시지로 복사</button><button class="btn main" data-print>인쇄 · PDF 저장</button><button class="btn" data-x>닫기</button></div></div>
    <div id="stmtBody"></div></div>`;
  document.body.appendChild(d);
  d.querySelectorAll("[data-l]").forEach(x => x.onclick = () => { L = x.dataset.l; draw(); });
  d.querySelector("[data-x]").onclick = () => { d.remove(); $("printArea").innerHTML = ""; };
  d.querySelector("[data-print]").onclick = () => window.print();
  d.querySelector("[data-copy]").onclick = () => {
    const t = T[L];
    copy(`[Uncle Day] ${t.t} · ${s.month}\n${list.map(b => `${b.code} ${b.visit_date} · ${vnd(b.paid_amount)} × ${+b.commission_rate}% = ${vnd(b.commission)}`).join("\n")}\n—\n${t.due}: ${vnd(s.total_commission)}`, "정산 내용을 복사했어요");
  };
  draw();
}

/* ===== 업체 월간 성과 리포트 ===== */
const REP_T = {
  vi: { rt: "BÁO CÁO HIỆU QUẢ THÁNG", perf: "Hiệu quả trên Uncle Day", views: "Lượt xem trang cơ sở", consult: "Lượt bấm tư vấn (KakaoTalk)", map: "Lượt bấm bản đồ",
    bk: "Lịch hẹn qua Uncle Day", visit: "Khách đã đến", guests: "Tổng số khách", paidT: "Tổng tiền khách thanh toán", commT: "Hoa hồng",
    src: "Số liệu được đếm tự động trên www.uncleday.com (không tính bot).", thanks: "Cảm ơn bạn đã đồng hành cùng Uncle Day!", month: "Tháng", shopL: "Cơ sở" },
  en: { rt: "MONTHLY PERFORMANCE REPORT", perf: "Your results on Uncle Day", views: "Shop page views", consult: "Consultation clicks (KakaoTalk)", map: "Map clicks",
    bk: "Bookings via Uncle Day", visit: "Guests visited", guests: "Total guests", paidT: "Total paid by guests", commT: "Commission",
    src: "Counted automatically on www.uncleday.com (bots excluded).", thanks: "Thank you for partnering with Uncle Day!", month: "Month", shopL: "Shop" },
  ko: { rt: "월간 성과 리포트", perf: "엉클데이 성과", views: "업체 페이지 조회", consult: "상담하기 클릭 (카카오톡)", map: "지도 클릭",
    bk: "엉클데이 예약", visit: "방문 손님 (건)", guests: "방문 인원", paidT: "손님 결제액 합계", commT: "수수료",
    src: "www.uncleday.com에서 자동으로 센 숫자예요 (로봇 제외).", thanks: "엉클데이와 함께해 주셔서 감사합니다!", month: "기간", shopL: "업체" }
};
function perfNums(shopId, m) {
  const inM = BOOKINGS.filter(b => b.shop_id === shopId && (b.visit_date || "").startsWith(m));
  const done = inM.filter(b => b.status === "visited" || b.status === "settled");
  return { views: statSum(m, "view", shopId), consult: statSum(m, "consult", shopId), map: statSum(m, "map", shopId),
    bk: inM.filter(b => !["cancelled", "rejected"].includes(b.status)).length, visit: done.length, guests: done.reduce((t, b) => t + b.people, 0),
    paid: done.reduce((t, b) => t + (+b.paid_amount || 0), 0), comm: done.reduce((t, b) => t + (+b.commission || 0), 0) };
}
function perfBlock(shopId, m, t) {
  const p = perfNums(shopId, m);
  return `<h3 style="margin:22px 0 6px;font-size:15px">${t.perf} · ${esc(m)}</h3>
    <table><tbody>${[[t.views, p.views], [t.consult, p.consult], [t.bk, p.bk], [t.visit, p.visit]].map(([a, b]) => `<tr><td>${a}</td><td class="num"><b>${Number(b).toLocaleString("en-US")}</b></td></tr>`).join("")}</tbody></table>
    <p style="color:#777;font-size:11.5px;margin-top:6px">${t.src}</p>`;
}
async function shopReport(shopId, m) {
  await loadStats(m);
  const shop = shopById(shopId);
  let L = ((PRIV[shopId] || {}).contract || {}).msgLang || "vi";
  const d = document.createElement("div"); d.className = "overlay center";
  d.innerHTML = `<div class="modal" style="width:min(720px,calc(100% - 32px))">
    <div class="btns" style="justify-content:space-between;margin:0 0 12px"><div class="btn-row">${[["vi", "베트남어"], ["en", "영어"], ["ko", "한국어"]].map(([k, n]) => `<button class="btn sm" data-l="${k}">${n}</button>`).join("")}</div>
    <div class="btn-row"><button class="btn" data-copy>메시지로 복사</button><button class="btn main" data-print>인쇄 · PDF 저장</button><button class="btn" data-x>닫기</button></div></div>
    <div id="repBody"></div></div>`;
  document.body.appendChild(d);
  const draw = () => {
    const t = REP_T[L], p = perfNums(shopId, m);
    const sn = shop ? (shop.name[L] || shop.name.en || shop.name.ko) : shopId;
    const rows = [[t.views, p.views], [t.consult, p.consult], [t.map, p.map], [t.bk, p.bk], [t.visit, p.visit], [t.guests, p.guests]];
    const html = `<div class="stmt">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><img src="images/logo-full.webp" alt="Uncle Day" style="height:46px"><h1>${t.rt}</h1></div>
      <div class="meta"><div><b>${t.shopL}:</b> ${esc(sn)}</div><div><b>${t.month}:</b> ${esc(m)}</div></div>
      <table><tbody>${rows.map(([a, b]) => `<tr><td>${a}</td><td class="num"><b style="font-size:16px">${Number(b).toLocaleString("en-US")}</b></td></tr>`).join("")}
        <tr><td>${t.paidT}</td><td class="num"><b>${vnd(p.paid)}</b></td></tr><tr><td>${t.commT}</td><td class="num">${vnd(p.comm)}</td></tr></tbody></table>
      <p style="color:#777;font-size:12px;margin-top:10px">${t.src}</p><p class="sum">${t.thanks}</p></div>`;
    d.querySelector("#repBody").innerHTML = html; $("printArea").innerHTML = html;
    d.querySelectorAll("[data-l]").forEach(x => x.classList.toggle("main", x.dataset.l === L));
    d._text = `[Uncle Day] ${t.rt} · ${m}\n${sn}\n` + rows.map(([a, b]) => `• ${a}: ${Number(b).toLocaleString("en-US")}`).join("\n") + `\n• ${t.paidT}: ${vnd(p.paid)}\n\n${t.thanks}`;
  };
  d.querySelectorAll("[data-l]").forEach(x => x.onclick = () => { L = x.dataset.l; draw(); });
  d.querySelector("[data-x]").onclick = () => { d.remove(); $("printArea").innerHTML = ""; };
  d.querySelector("[data-print]").onclick = () => window.print();
  d.querySelector("[data-copy]").onclick = () => copy(d._text, "리포트 내용을 복사했어요. 잘로로 보내 주세요.");
  draw();
}

/* ===== 후기 ===== */
function drawReviews() {
  const pend = RVS.filter(r => r.status === "pending"), done = RVS.filter(r => r.status !== "pending").slice(0, 30);
  const card = r => { const b = r.booking_id && BOOKINGS.find(x => x.id === r.booking_id); const s = shopById(r.shop_id);
    return `<div class="rv-card"><div class="top"><span class="stars">${"★".repeat(r.stars)}${"☆".repeat(5 - r.stars)}</span><b>${esc(s ? s.name.ko : r.shop_id)}</b>
      ${b ? `<span class="badge vis">✓ 예약 손님 ${esc(b.code)}</span>` : `<span class="badge wait">예약 확인 안 됨</span>`}<span class="hint">${esc(r.name || "")} · ${dt(r.created_at)} · ${LANG_KO[r.lang] || r.lang}${r.contact ? " · " + esc(r.contact) : ""}</span></div>
      ${r.menu ? `<div class="hint">메뉴: ${esc(r.menu)}${r.visit_month ? " · " + esc(r.visit_month) + " 방문" : ""}</div>` : ""}
      <p>${esc(r.body)}</p>
      ${r.status === "pending" ? `<div class="btn-row"><button class="btn sm main" data-ok="${r.id}">게시</button><button class="btn sm danger" data-no="${r.id}">반려</button></div>`
        : `<div class="hint">${r.status === "approved" ? "✅ 게시됨" : "반려됨"} · ${dt(r.decided_at)}</div>`}</div>`; };
  $("tab-rv").innerHTML = `<h2 class="sec">게시 대기 <small>${pend.length}개</small></h2>
    <div style="display:grid;gap:10px">${pend.map(card).join("") || `<div class="todo"><div class="empty">새로 들어온 후기가 없어요.</div></div>`}</div>
    <h2 class="sec">처리한 후기 <small>최근 30개</small></h2><div style="display:grid;gap:10px;margin-bottom:40px">${done.map(card).join("") || `<div class="todo"><div class="empty">아직 없어요.</div></div>`}</div>`;
  $("tab-rv").querySelectorAll("[data-ok]").forEach(x => x.onclick = async () => {
    const r = RVS.find(y => y.id === x.dataset.ok); const s = shopById(r.shop_id);
    if (!s) { toast("업체를 찾을 수 없어요"); return; }
    const ns = clone(s);
    ns.userReviews = [{ stars: r.stars, name: (r.name || "").trim() || "손님", date: r.visit_month || r.created_at.slice(0, 7), menu: r.menu || "", text: r.body.trim(), ...(r.booking_id ? { verified: true } : {}) }, ...(ns.userReviews || [])];
    ns.rating = Math.round(ns.userReviews.reduce((t, v) => t + v.stars, 0) / ns.userReviews.length * 10) / 10; ns.reviews = ns.userReviews.length;
    x.disabled = true;
    try {
      await dbSaveShop(ns); shops[shops.indexOf(s)] = ns;
      await q(sb.from("reviews").update({ status: "approved", decided_at: new Date().toISOString() }).eq("id", r.id));
      r.status = "approved"; r.decided_at = new Date().toISOString(); drawReviews(); drawCounts(); toast("게시했어요 ✅ 사이트에 바로 보여요.");
    } catch (e) { x.disabled = false; dbErr(e, "게시"); }
  });
  $("tab-rv").querySelectorAll("[data-no]").forEach(x => x.onclick = () => confirmBox("이 후기를 반려할까요?", async () => {
    const r = RVS.find(y => y.id === x.dataset.no);
    try { await q(sb.from("reviews").update({ status: "rejected", decided_at: new Date().toISOString() }).eq("id", r.id)); r.status = "rejected"; r.decided_at = new Date().toISOString(); drawReviews(); drawCounts(); } catch (e) {}
  }, "손님 화면에 나오지 않아요.", "반려"));
}

/* ===== 계정 ===== */
const SLACK_EVS = [["booking", "📅 새 예약", "사이트·카톡으로 들어온 예약"], ["shop", "🏪 업체 답", "업체가 링크로 확정·불가·방문 완료(금액)를 눌렀을 때"],
  ["customer", "🙋 손님 행동", "손님이 '다녀왔어요'·취소를 눌렀을 때"], ["review", "⭐ 새 후기", "게시를 기다리는 후기"],
  ["team", "💬 팀 알림", "낙서장 @언급·담당 지정·참조·댓글 (🔔와 같은 내용)"], ["lead", "🤝 영업 단계", "영업 업체 추가·단계 변경"]];
async function drawSlack() {
  const box = $("slackBox"); if (!box) return;
  const r = await sb.from("slack_cfg").select("*").eq("id", 1).maybeSingle();
  if (r.error) { box.innerHTML = `<h3>💬 슬랙 알림</h3><div class="hint">아직 DB 준비가 안 됐어요. 사장님이 Supabase에서 schema.sql을 한 번 실행해 주세요. (📘 사용 안내 → DB 업데이트)</div>`; return; }
  const c = r.data || { enabled: true, events: SLACK_EVS.map(e => e[0]) };
  const on = !!c.webhook;
  box.innerHTML = `<h3>💬 슬랙 알림 ${on ? (c.enabled ? `<span class="sl-pill ok">연결됨</span>` : `<span class="sl-pill">꺼짐</span>`) : ""}</h3>
    <div class="hint">예약·업체 답·후기 같은 일이 생기면 슬랙 채널로 바로 알려 줘요. 관리자가 직접 바꾼 건 보내지 않아요 (본인이 한 일이라서).</div>
    <label class="f"><span>기본 채널 웹후크 주소 (https://hooks.slack.com/… )</span>
      <input id="slHook" type="password" autocomplete="off" placeholder="${on ? "저장돼 있어요 · 바꾸려면 새 주소를 붙여넣기" : "https://hooks.slack.com/services/…"}" style="padding:9px 11px;border:1px solid var(--line);border-radius:9px"></label>
    <div class="hint" style="margin-top:12px"><b>알림 종류별로 다른 채널</b>에 받고 싶으면 아래 칸마다 그 채널의 웹후크 주소를 넣어요. 비워 두면 위 <b>기본 채널</b>로 가요.</div>
    <div class="sl-evs">${SLACK_EVS.map(([k, n, d]) => { const own = !!(c.hooks || {})[k]; return `<div class="sl-ev"><label class="sl-ck"><input type="checkbox" value="${k}" ${(c.events || []).includes(k) ? "checked" : ""}><span><b>${n}</b><small>${d}</small></span></label>
      <div class="sl-ch">${own ? `<span class="sl-pill ok">📢 따로 채널</span><button type="button" class="linkish" data-hk-clear="${k}">기본 채널로</button>` : `<span class="sl-pill">기본 채널</span>`}
      <input type="password" autocomplete="off" data-hook="${k}" placeholder="${own ? "바꾸려면 새 주소 붙여넣기" : "다른 채널 웹후크 (선택)"}"></div></div>`; }).join("")}</div>
    <div class="sl-ev" style="margin-top:6px"><label class="sl-ck"><input type="checkbox" id="slOn" ${c.enabled ? "checked" : ""}><span><b>알림 켜기</b><small>잠깐 끄고 싶을 때 체크를 풀어요</small></span></label></div>
    <div class="btn-row"><button class="btn main" id="slSave">저장</button><button class="btn" id="slTest" ${on ? "" : "disabled"}>테스트 메시지 보내기</button>${on ? `<button class="btn" id="slDel">연결 끊기</button>` : ""}</div>
    ${c.updated_by ? `<div class="hint">마지막 변경: ${esc(c.updated_by)} · ${dt(c.updated_at)}</div>` : ""}`;
  $("slSave").onclick = async () => {
    const hook = $("slHook").value.trim();
    if (hook && !/^https:\/\/hooks\.slack\.com\/services\//.test(hook)) { toast("슬랙 웹후크 주소가 아니에요. https://hooks.slack.com/services/ 로 시작해야 해요"); return; }
    const hooks = { ...(c.hooks || {}) }; let bad = false;
    box.querySelectorAll("[data-hook]").forEach(i => { const v = i.value.trim(); if (!v) return; if (!/^https:\/\/hooks\.slack\.com\/services\//.test(v)) bad = true; else hooks[i.dataset.hook] = v; });
    if (bad) { toast("종류별 칸에 슬랙 웹후크 주소가 아닌 게 있어요. https://hooks.slack.com/services/ 로 시작해야 해요"); return; }
    const upd = { id: 1, enabled: $("slOn").checked, events: [...box.querySelectorAll(".sl-evs input[type=checkbox]:checked")].map(x => x.value), hooks, updated_at: new Date().toISOString(), updated_by: ME.email };
    if (hook) upd.webhook = hook;
    const w = await sb.from("slack_cfg").upsert(upd); if (w.error) return dbErr(w.error);
    toast(hook ? "저장했어요. '테스트 메시지 보내기'로 확인해 보세요" : "저장했어요"); drawSlack();
  };
  box.querySelectorAll("[data-hk-clear]").forEach(x => x.onclick = async () => { const h = { ...(c.hooks || {}) }; delete h[x.dataset.hkClear]; const w = await sb.from("slack_cfg").update({ hooks: h, updated_at: new Date().toISOString(), updated_by: ME.email }).eq("id", 1); if (w.error) return dbErr(w.error); toast("기본 채널로 돌렸어요"); drawSlack(); });
  if ($("slTest")) $("slTest").onclick = async () => { const t = await sb.rpc("slack_test"); if (t.error) return dbErr(t.error); toast("연결된 채널마다 테스트 메시지를 보냈어요 (몇 초 걸려요)"); };
  if ($("slDel")) $("slDel").onclick = async () => { if (!confirm("슬랙 연결을 끊을까요?")) return; const w = await sb.from("slack_cfg").update({ webhook: null, updated_at: new Date().toISOString(), updated_by: ME.email }).eq("id", 1); if (w.error) return dbErr(w.error); drawSlack(); };
}
/* ===== 자동 백업: 열쇠 만들기 · 백업에서 되돌리기 ===== */
const REPO_URL = "https://github.com/wootaengboy-hue/uncleday";
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
async function drawBackup() {
  const box = $("backupBox"); if (!box) return;
  const r = await sb.from("backup_keys").select("*").eq("id", 1).maybeSingle();
  if (r.error) { box.innerHTML = `<h3>🛟 자동 백업</h3><div class="hint">아직 DB 준비가 안 됐어요. 사장님이 Supabase에서 <a href="https://raw.githubusercontent.com/wootaengboy-hue/uncleday/main/supabase/backup.sql" target="_blank">backup.sql</a>을 한 번 실행해 주세요.</div>`; return; }
  const k = r.data || {}, has = !!k.token_hash;
  const late = k.last_run && (Date.now() - new Date(k.last_run)) > 2 * 864e5;
  box.innerHTML = `<h3>🛟 자동 백업 ${has ? (k.last_run ? `<span class="sl-pill ${late ? "" : "ok"}">${late ? "⚠️ 2일 넘게 안 됨" : "작동 중"}</span>` : `<span class="sl-pill">첫 백업 기다림</span>`) : `<span class="sl-pill">꺼짐</span>`}</h3>
    <div class="hint">매일 새벽 4시쯤 DB 전체(업체·예약·정산·후기·할 일·영업)를 받아서 <b>사장님 비밀번호로 잠근 파일</b>로 30일 보관해요. 해킹·실수로 내용이 바뀌면 아래 <b>되돌리기</b>로 복구해요.</div>
    ${has ? `<div style="margin:8px 0">🔑 열쇠 만든 날: ${dt(k.created_at)} · ${esc(who ? who(k.created_by || "") : k.created_by || "")}<br>🕓 마지막 자동 백업: ${k.last_run ? `<b>${dt(k.last_run)}</b> (${Math.round((k.last_size || 0) / 1024)}KB)` : "아직 없음"}</div>` : ""}
    <div class="btn-row"><button class="btn ${has ? "" : "main"}" id="bkKey">🔑 백업 열쇠 ${has ? "다시 " : ""}만들기</button><a class="btn" href="${REPO_URL}/actions/workflows/db-backup.yml" target="_blank">📦 백업 파일 목록 (GitHub)</a><button class="btn main" id="bkRestore">↩️ 백업에서 되돌리기</button></div>`;
  $("bkKey").onclick = () => confirmBox(has ? "열쇠를 다시 만들까요?" : "백업 열쇠를 만들까요?", async () => {
    const tok = hex(crypto.getRandomValues(new Uint8Array(32)));
    const h = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(tok)));
    const w = await sb.from("backup_keys").upsert({ id: 1, token_hash: h, created_at: new Date().toISOString(), created_by: ME.email }); if (w.error) return dbErr(w.error);
    showBackupKey(tok); drawBackup();
  }, has ? "예전 열쇠는 바로 못 쓰게 돼요. GitHub의 BACKUP_TOKEN도 새 열쇠로 바꿔야 해요." : "", "만들기", false);
  $("bkRestore").onclick = openRestore;
}
function showBackupKey(tok) {
  const d = document.createElement("div"); d.className = "overlay center";
  d.innerHTML = `<div class="modal" style="width:min(680px,calc(100% - 32px))"><h2>🔑 백업 열쇠</h2>
    <p class="warn" style="margin:6px 0">이 열쇠는 <b>지금 한 번만</b> 보여요. 아래 순서대로 GitHub에 넣고 창을 닫으세요. 메신저·낙서장·Claude에게 보내지 마세요.</p>
    <div style="display:flex;gap:8px;margin:10px 0"><input readonly value="${tok}" id="bkTok" style="flex:1;font-family:monospace;padding:9px;border:1px solid var(--line);border-radius:9px"><button class="btn main" id="bkCopy">복사</button></div>
    <ol style="line-height:1.8;padding-left:20px;margin:6px 0">
      <li><a href="${REPO_URL}/settings/secrets/actions/new" target="_blank"><b>GitHub 비밀 값 추가 화면</b></a>을 열어요 (GitHub 로그인 필요)</li>
      <li><b>Name</b>: <code>BACKUP_TOKEN</code> · <b>Secret</b>: 위 열쇠 붙여넣기 → <b>Add secret</b></li>
      <li>한 번 더 새로 만들기: <b>Name</b>: <code>BACKUP_PASSWORD</code> · <b>Secret</b>: 사장님이 정한 <b>백업 비밀번호</b> (12자 이상) → <b>Add secret</b></li>
      <li><a href="${REPO_URL}/actions/workflows/db-backup.yml" target="_blank"><b>db-backup</b></a> → <b>Run workflow</b>로 첫 백업 (1분 뒤 이 화면에 '마지막 자동 백업'이 떠요)</li></ol>
    <p class="warn">⚠️ 백업 비밀번호는 <b>종이나 비밀번호 관리 앱에 따로 적어 두세요.</b> 잃어버리면 백업 파일을 열 수 없어요 (저도 열 수 없어요).</p>
    <div class="btns"><button class="btn main" data-no>다 넣었어요, 닫기</button></div></div>`;
  document.body.appendChild(d);
  d.querySelector("#bkCopy").onclick = async () => { const i = d.querySelector("#bkTok"); i.select(); try { await navigator.clipboard.writeText(tok); } catch (e) { document.execCommand("copy"); } toast("복사했어요"); };
  d.querySelector("[data-no]").onclick = () => d.remove();
}
// GitHub에서 받은 zip(또는 안의 .enc)을 브라우저 안에서 풀어요 — 파일은 어디에도 올라가지 않아요
async function unzipFirst(buf) {
  const v = new DataView(buf); let e = buf.byteLength - 22;
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error("zip 아님");
  const cd = v.getUint32(e + 16, true), method = v.getUint16(cd + 10, true), csize = v.getUint32(cd + 20, true), lho = v.getUint32(cd + 42, true);
  const start = lho + 30 + v.getUint16(lho + 26, true) + v.getUint16(lho + 28, true), data = buf.slice(start, start + csize);
  if (method === 0) return data;
  if (method !== 8) throw new Error("압축 방식 모름");
  return await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer();
}
async function openBackupFile(buf, pw) {
  let u = new Uint8Array(buf);
  if (u[0] === 0x50 && u[1] === 0x4b) { buf = await unzipFirst(buf); u = new Uint8Array(buf); }
  if (new TextDecoder().decode(u.slice(0, 8)) !== "Salted__") {   // 잠기지 않은 json
    try { return JSON.parse(new TextDecoder().decode(u)); } catch (e) { throw new Error("백업 파일이 아니에요"); }
  }
  const salt = u.slice(8, 16), body = u.slice(16);
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 200000, hash: "SHA-256" }, base, 384));
  const key = await crypto.subtle.importKey("raw", bits.slice(0, 32), "AES-CBC", false, ["decrypt"]);
  let plain; try { plain = await crypto.subtle.decrypt({ name: "AES-CBC", iv: bits.slice(32, 48) }, key, body); } catch (e) { throw new Error("비밀번호가 틀렸어요"); }
  const txt = await new Response(new Blob([plain]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  return JSON.parse(txt);
}
function openRestore() {
  const d = document.createElement("div"); d.className = "overlay center";
  d.innerHTML = `<div class="modal" style="width:min(720px,calc(100% - 32px))"><h2>↩️ 백업에서 되돌리기</h2>
    <ol style="line-height:1.8;padding-left:20px;margin:6px 0 10px"><li><a href="${REPO_URL}/actions/workflows/db-backup.yml" target="_blank">백업 목록</a>에서 되돌릴 날짜를 눌러 맨 아래 <b>Artifacts</b>의 파일을 내려받아요</li>
      <li>받은 파일(zip 그대로 괜찮아요)을 고르고 백업 비밀번호를 넣어요</li></ol>
    <div style="display:grid;gap:8px"><input type="file" id="rsFile" accept=".zip,.enc,.json"><input type="password" id="rsPw" placeholder="백업 비밀번호" autocomplete="off" style="padding:9px;border:1px solid var(--line);border-radius:9px">
      <button class="btn main" id="rsOpen">열어 보기</button></div>
    <div id="rsBody" style="margin-top:12px"></div>
    <div class="btns"><button class="btn" data-no>닫기</button></div></div>`;
  document.body.appendChild(d);
  d.querySelector("[data-no]").onclick = () => d.remove();
  d.querySelector("#rsOpen").onclick = async () => {
    const f = d.querySelector("#rsFile").files[0]; if (!f) return toast("백업 파일을 골라 주세요");
    const btn = d.querySelector("#rsOpen"); btn.disabled = true; btn.textContent = "여는 중…";
    try { showRestorePlan(d, await openBackupFile(await f.arrayBuffer(), d.querySelector("#rsPw").value)); }
    catch (e) { toast("열지 못했어요: " + e.message); }
    btn.disabled = false; btn.textContent = "열어 보기";
  };
}
function showRestorePlan(d, B) {
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const cur = new Map(shops.map(s => [s.id, s]));
  const shopDiff = (B.shops || []).filter(x => !cur.has(x.id) || !same(splitShop(cur.get(x.id))[0], x.data)).length;
  const missing = (B.shops || []).filter(x => !cur.has(x.id)).length;
  const curTasks = new Set(TASKS.map(t => t.id)), curLeads = new Set(LEADS.map(l => l.id));
  const items = [
    ["shops", `🏪 업체 정보 ${(B.shops || []).length}곳`, `지금과 다른 곳 ${shopDiff}곳 (그중 지금 없는 곳 ${missing}곳) · 비공개 메모·수수료율 포함`, shopDiff > 0],
    ["tasks", `✅ 할 일 ${(B.tasks || []).length}개`, `지금 없는 것 ${(B.tasks || []).filter(t => !curTasks.has(t.id)).length}개`, false],
    ["leads", `🤝 영업 업체 ${(B.leads || []).length}곳`, `지금 없는 곳 ${(B.leads || []).filter(l => !curLeads.has(l.id)).length}곳 · 연락 기록 포함`, false],
    ["templates", `📄 템플릿 ${(B.templates || []).length}개`, "", false],
    ["crm", `👥 손님 카드 ${(B.customers || []).length}명 · 쿠폰 ${(B.coupons || []).length}장`, "메모·태그·안내 동의·연락 기록 포함", false],
    ["catimg", "🖼️ 카테고리 사진 설정", "", false]];
  d.querySelector("#rsBody").innerHTML = `<div class="box" style="background:#f7f4ec"><b>📅 ${dt(B.at)} 백업</b> · 예약 ${(B.bookings || []).length}건 · 정산 ${(B.settlements || []).length}건 · 후기 ${(B.reviews || []).length}개
    <p class="hint" style="margin:6px 0 10px">체크한 것만 <b>백업 때 내용으로 덮어써요</b>. 백업 뒤에 새로 만든 것은 지우지 않아요. 예약·정산은 원래 지울 수 없게 막혀 있어서 되돌리기에서 빠져 있어요 (필요하면 아래 파일로 확인).</p>
    ${items.map(([k, n, s, on]) => `<label style="display:flex;gap:10px;padding:6px 0;align-items:flex-start"><input type="checkbox" data-rs="${k}" ${on ? "checked" : ""} style="margin-top:4px"><span><b>${n}</b>${s ? `<br><small class="hint">${s}</small>` : ""}</span></label>`).join("")}
    <div class="btn-row"><button class="btn main" id="rsGo">선택한 것 되돌리기</button><button class="btn" id="rsDl">⬇ 풀린 파일 받기 (JSON)</button></div></div>`;
  d.querySelector("#rsDl").onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(B, null, 1)], { type: "application/json" })); a.download = `엉클데이_백업_${String(B.at).slice(0, 10)}.json`; a.click(); };
  d.querySelector("#rsGo").onclick = () => {
    const pick = new Set([...d.querySelectorAll("[data-rs]:checked")].map(x => x.dataset.rs)); if (!pick.size) return toast("고른 것이 없어요");
    confirmBox("정말 되돌릴까요?", async () => {
      try {
        if (pick.has("shops")) {
          await q(sb.from("shops").upsert((B.shops || []).map(x => ({ id: x.id, data: x.data, sort: x.sort, published: x.published, updated_by: ME.email }))), "업체 되돌리기");
          if ((B.shop_private || []).length) await q(sb.from("shop_private").upsert(B.shop_private.map(x => ({ shop_id: x.shop_id, notes: x.notes, commission_rate: x.commission_rate, contract: x.contract }))), "비공개 메모 되돌리기");
        }
        if (pick.has("tasks") && (B.tasks || []).length) await q(sb.from("tasks").upsert(B.tasks), "할 일 되돌리기");
        if (pick.has("leads") && (B.leads || []).length) {
          await q(sb.from("leads").upsert(B.leads), "영업 되돌리기");
          if ((B.lead_logs || []).length) await q(sb.from("lead_logs").upsert(B.lead_logs, { onConflict: "id", ignoreDuplicates: true }), "영업 기록 되돌리기");
        }
        if (pick.has("crm") && (B.customers || []).length) {
          await q(sb.from("customers").upsert(B.customers), "손님 카드 되돌리기");
          if ((B.coupons || []).length) await q(sb.from("coupons").upsert(B.coupons), "쿠폰 되돌리기");
          if ((B.customer_logs || []).length) await q(sb.from("customer_logs").upsert(B.customer_logs, { onConflict: "id", ignoreDuplicates: true }), "손님 기록 되돌리기");
          CRM_READY = null;
        }
        if (pick.has("templates") && (B.templates || []).length) await q(sb.from("templates").upsert(B.templates), "템플릿 되돌리기");
        if (pick.has("catimg")) { const c = (B.settings || []).find(x => x.key === "cat_imgs"); if (c) await q(sb.from("settings").upsert({ key: "cat_imgs", value: c.value }), "카테고리 사진 되돌리기"); }
        d.remove(); toast("되돌렸어요 ✅ 사이트 공유 미리보기는 3시간 안에 따라 바뀌어요"); await loadAll(); showTab(TAB);
      } catch (e) { /* q가 오류를 보여 줘요 */ }
    }, "체크한 항목이 백업 때 내용으로 바뀌어요.", "되돌리기", true);
  };
}
async function drawAccount() {
  $("tab-acc").innerHTML = `<div class="two" style="margin-top:16px;align-items:start">
    <div class="box"><h3>내 계정</h3><div>${esc(ME.email)}</div>
      <form id="pwForm" style="display:grid;gap:10px">
        <label class="f"><span>새 비밀번호 (8자 이상)</span><input type="password" id="pw1" minlength="8" autocomplete="new-password" required></label>
        <label class="f"><span>한 번 더</span><input type="password" id="pw2" minlength="8" autocomplete="new-password" required></label>
        <div class="err-text" id="pwErr"></div>
        <div class="btn-row"><button class="btn main">비밀번호 바꾸기</button><button class="btn" type="button" id="logout">로그아웃</button></div></form></div>
    <div class="box"><h3>관리자</h3><div id="adminList" class="hint">불러오는 중…</div>
      <form id="addAdm" style="display:flex;gap:8px"><input type="email" id="admEmail" placeholder="직원 이메일" required style="flex:1;padding:9px 11px;border:1px solid var(--line);border-radius:9px"><button class="btn">추가</button></form>
      <div class="hint">직원 추가 순서: ① 여기에 이메일 추가 → ② Supabase → <b>Authentication → Users → Add user → Create new user</b>에서 같은 이메일과 임시 비밀번호로 계정 만들기 (Auto Confirm 켜기) → ③ 직원이 로그인한 뒤 '비밀번호 바꾸기'.</div></div>
  </div>
  <div class="box" style="margin:14px 0 0" id="backupBox"><h3>🛟 자동 백업</h3><div class="hint">불러오는 중…</div></div>
  <div class="box" style="margin:14px 0 0" id="slackBox"><h3>💬 슬랙 알림</h3><div class="hint">불러오는 중…</div></div>
  <div class="box" style="margin:14px 0 40px"><h3>백업</h3>
    <div class="hint">업체·예약·정산·후기 전체를 파일로 내려받아요. 한 달에 한 번 정도 받아 두면 안전해요.</div>
    <div class="btn-row"><button class="btn" id="bkAll">⬇ 전체 백업 (JSON)</button><button class="btn" id="bkShopsJs">⬇ 사이트 기본 파일 (shops.js)</button></div></div>`;
  $("pwForm").onsubmit = async e => {
    e.preventDefault();
    if ($("pw1").value !== $("pw2").value) { $("pwErr").textContent = "두 비밀번호가 달라요."; return; }
    const r = await sb.auth.updateUser({ password: $("pw1").value });
    if (r.error) { $("pwErr").textContent = "바꾸지 못했어요: " + r.error.message; return; }
    $("pwErr").textContent = ""; e.target.reset(); toast("비밀번호를 바꿨어요 ✅");
  };
  $("logout").onclick = async () => { await sb.auth.signOut(); location.reload(); };
  const drawAdmins = async () => {
    const [a, e] = await Promise.all([sb.from("admins").select("*").order("created_at"), sb.from("admin_emails").select("*").order("created_at")]);
    const active = new Set((a.data || []).map(x => x.email.toLowerCase()));
    $("adminList").innerHTML = `<div class="hint" style="margin:0 0 6px">닉네임: 할 일·댓글·알림에 이메일 대신 보여요. <b>@닉네임</b>으로 부를 수 있어요 (띄어쓰기 없이 12자까지).</div>` + (a.data || []).map(x => `<div class="adm-row">✅ <input class="nick-in" data-nick="${esc(x.user_id)}" value="${esc(x.name || "")}" placeholder="닉네임" maxlength="12"><small>${esc(x.email)}${x.user_id === ME.id ? " (나)" : ""}</small></div>`).join("") +
      (e.data || []).filter(x => !active.has(x.email.toLowerCase())).map(x => `<div>⏳ ${esc(x.email)} <span class="hint">— 아직 로그인 안 함</span> <button class="btn sm danger" data-rm="${esc(x.email)}">빼기</button></div>`).join("");
    $("adminList").querySelectorAll("[data-nick]").forEach(inp => inp.onchange = async () => {
      const v = inp.value.trim();
      if (v && !NICK_RE.test(v)) { toast("닉네임은 띄어쓰기 없이 한글·영문·숫자로 12자까지예요"); inp.value = ""; return; }
      if (v && (a.data || []).some(x => x.user_id !== inp.dataset.nick && ((x.name || "").toLowerCase() === v.toLowerCase() || x.email.split("@")[0].toLowerCase() === v.toLowerCase()))) { toast("다른 사람이 쓰는 이름이에요"); return; }
      const r = await sb.from("admins").update({ name: v || null }).eq("user_id", inp.dataset.nick); if (r.error) return dbErr(r.error);
      const em = (a.data.find(y => y.user_id === inp.dataset.nick) || {}).email, m = ADMINS.find(x => x.email === em); if (m) m.name = v || null;
      toast(v ? `닉네임을 '${v}'(으)로 정했어요` : "닉네임을 지웠어요");
    });
    $("adminList").querySelectorAll("[data-rm]").forEach(b => b.onclick = async () => { await sb.from("admin_emails").delete().eq("email", b.dataset.rm); drawAdmins(); });
  };
  drawAdmins(); drawSlack(); drawBackup();
  $("addAdm").onsubmit = async e => { e.preventDefault(); const r = await sb.from("admin_emails").insert({ email: $("admEmail").value.trim().toLowerCase(), added_by: ME.email }); if (r.error) dbErr(r.error); else { $("admEmail").value = ""; drawAdmins(); toast("추가했어요"); } };
  const dl = (name, text, type) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
  $("bkAll").onclick = async () => {
    const ev = await sb.from("booking_events").select("*").order("id").limit(100000);
    dl(`엉클데이_백업_${vnToday()}.json`, JSON.stringify({ at: new Date().toISOString(), shops: shops.map(s => ({ ...s, _meta: META[s.id], _private: PRIV[s.id] })), catImgs, bookings: BOOKINGS, events: ev.data || [], settlements: SETTLES, reviews: RVS }, null, 1), "application/json");
  };
  $("bkShopsJs").onclick = () => dl("shops.js", "/* 업체 목록 (데이터베이스에 연결되지 않을 때 쓰는 기본 파일) */\nconst SHOPS = " + JSON.stringify(shops.filter(isPub).map(s => splitShop(s)[0])) + ";\n", "text/javascript");
}

/* ===== 처음 한 번: 기존 업체를 데이터베이스로 옮기기 ===== */
async function offerMigration() {
  // 기존 사이트 업체가 하나도 옮겨지지 않았을 때만 (엑셀로 새 업체를 먼저 올렸어도 물어봐요)
  if (typeof SHOPS === "undefined" || !SHOPS.length || SHOPS.some(s => shops.some(x => x.id === s.id))) return;
  const n = notice("warn", `<span class="grow"><b>기존 업체가 아직 데이터베이스에 없어요.</b> 지금 사이트에 있는 업체 ${SHOPS.length}곳(사진, 메뉴, 확인 메모 포함)과 카테고리 사진을 옮길까요?</span><button class="btn main sm" id="migBtn">옮기기</button>`, "nMig");
  $("migBtn").onclick = async () => {
    $("migBtn").disabled = true; $("migBtn").textContent = "옮기는 중…";
    const notes = typeof ADMIN_NOTES !== "undefined" ? ADMIN_NOTES : {};
    try {
      await q(sb.from("shops").upsert(SHOPS.map((s, i) => { const d = clone(s); delete d.review; delete d.checks; return { id: s.id, data: d, sort: i, published: true, updated_by: ME.email }; })), "업체 옮기기");
      await q(sb.from("shop_private").upsert(SHOPS.map(s => ({ shop_id: s.id, notes: notes[s.id] || {}, commission_rate: 0, contract: {} }))), "업체 메모 옮기기");
      if (typeof CAT_IMGS !== "undefined" && Object.keys(CAT_IMGS).length) await q(sb.from("settings").upsert({ key: "cat_imgs", value: CAT_IMGS }), "카테고리 사진 옮기기");
      await loadShops(); n.remove(); showTab("shops"); toast(`업체 ${shops.length}곳을 옮겼어요 ✅ 이제 각 업체에 수수료율을 넣어 주세요.`, 5000);
    } catch (e) { $("migBtn").disabled = false; $("migBtn").textContent = "다시 시도"; }
  };
}

/* ===== 조사한 업체 가져오기 (Claude가 imports/ 폴더에 올려 둔 파일) ===== */
const filled = v => v != null && v !== "" && !(Array.isArray(v) && !v.length) && !(typeof v === "object" && !Array.isArray(v) && !Object.values(v).some(filled));
// 가져온 값이 있는 칸만 바꾸고, 사진·가격표·후기·계약 정보처럼 파일에 없는 건 그대로 둬요
function mergeShop(o, n) {
  const r = clone(o);
  Object.entries(n).forEach(([k, v]) => {
    if (!filled(v)) return;
    if (v && typeof v === "object" && !Array.isArray(v) && r[k] && typeof r[k] === "object" && !Array.isArray(r[k])) {
      r[k] = { ...r[k] }; Object.entries(v).forEach(([kk, vv]) => { if (filled(vv)) r[k][kk] = vv; });
    } else r[k] = clone(v);
  });
  return r;
}
// Claude가 정리한 할 일 목록을 할 일 보드에 한 번에 넣기
function openTaskImport(f, data, note) {
  const PRI_N = { 0: "낮음", 1: "보통", 2: "높음" };
  const d = document.createElement("div"); d.className = "overlay center";
  d.innerHTML = `<div class="modal" style="width:min(760px,calc(100% - 32px))"><h2>📋 ${esc(f.title)}</h2>
    <p class="hint">넣을 것만 체크하세요. 담당자는 나(${esc(typeof who === "function" ? who(ME.email) : ME.email)})로 들어가요. 넣은 뒤에 보드에서 담당자·마감일을 바꿀 수 있어요.</p>
    <div style="max-height:52vh;overflow:auto;border:1px solid var(--line);border-radius:10px">
    ${data.tasks.map((t, i) => `<label style="display:flex;gap:10px;padding:10px 12px;border-bottom:1px solid var(--line);cursor:pointer;align-items:flex-start">
      <input type="checkbox" data-ti="${i}" checked style="margin-top:4px"><span><b>${esc(t.title)}</b> <small class="hint">· ${PRI_N[t.priority ?? 1]}${t.due ? " · 마감 " + esc(t.due) : ""}${t.group ? " · " + esc(t.group) : ""}</small>
      ${t.note ? `<br><small class="hint">${esc(t.note)}</small>` : ""}</span></label>`).join("")}</div>
    <div class="btns"><button class="btn" data-no>닫기</button><button class="btn main" data-yes>할 일 보드에 넣기</button></div></div>`;
  document.body.appendChild(d);
  d.querySelector("[data-no]").onclick = () => d.remove();
  d.querySelector("[data-yes]").onclick = async () => {
    const pick = [...d.querySelectorAll("[data-ti]:checked")].map(x => data.tasks[+x.dataset.ti]);
    if (!pick.length) { toast("고른 할 일이 없어요"); return; }
    const rows = pick.map(t => ({ title: t.title, memo: t.memo || (t.note ? `<p>${esc(t.note)}</p>` : ""), status: "todo", priority: t.priority ?? 1, due: t.due || null, assignee: ME.email, watchers: [] }));
    const r = await sb.from("tasks").insert(rows); if (r.error) return dbErr(r.error, "할 일 넣기");
    await markImport(f.id); d.remove(); if (note) note.remove();
    toast(`할 일 ${rows.length}개를 넣었어요 ✅`);
    if (typeof loadWork === "function") { await loadWork(); if (TAB === "work") drawWork(); else if (TAB === "dash") drawDash(); }
  };
}
async function importsDone() {
  const r = await sb.from("settings").select("value").eq("key", "imports_done");
  return (r.data && r.data[0] && r.data[0].value) || [];
}
async function markImport(id) {
  const done = await importsDone();
  if (!done.includes(id)) await sb.from("settings").upsert({ key: "imports_done", value: [...done, id] });
}
async function checkImports() {
  let idx;
  try { const r = await fetch("imports/index.json?t=" + Date.now(), { cache: "no-store" }); if (!r.ok) return; idx = await r.json(); } catch (e) { return; }
  const done = await importsDone();
  (idx.files || []).filter(f => !done.includes(f.id)).forEach(f => {
    const n = notice("info", `<span class="grow">${f.kind === "tasks" ? `📋 <b>${esc(f.title)}</b> — 할 일 ${f.count}개를 보드에 넣을 수 있어요.` : `🔎 <b>${esc(f.title)}</b> — 조사한 업체 ${f.count}곳 정보가 준비됐어요.`}</span><button class="btn main sm" data-imp>미리보기·가져오기</button><button class="btn sm" data-skip>안 가져오기</button>`, "imp-" + f.id);
    n.querySelector("[data-imp]").onclick = () => openImport(f, n);
    n.querySelector("[data-skip]").onclick = () => confirmBox("이 자료를 가져오지 않을까요?", async () => { await markImport(f.id); n.remove(); toast("알림을 지웠어요"); }, "나중에 다시 보이지 않아요.", "안 가져오기", false);
  });
}
async function openImport(f, note) {
  let data;
  try { data = await (await fetch("imports/" + f.file + "?t=" + Date.now(), { cache: "no-store" })).json(); } catch (e) { toast("파일을 읽지 못했어요"); return; }
  if (data.tasks) return openTaskImport(f, data, note);
  const list = (data.shops || []).filter(s => s.id && s.name && catOf(s.cat) && cityOf(s.city));
  const add = list.filter(s => !shops.some(x => x.id === s.id)), upd = list.filter(s => shops.some(x => x.id === s.id));
  const info = s => [s.address && filled(s.address) ? "주소" : "", s.open ? "영업시간" : "", (s.menu || []).length ? `메뉴 ${s.menu.length}개` : "", (s.tags || []).length ? "태그" : "", s.desc && filled(s.desc) ? "소개" : ""].filter(Boolean).join(" · ") || "이름만";
  const d = document.createElement("div"); d.className = "overlay center";
  d.innerHTML = `<div class="modal" style="width:min(760px,calc(100% - 32px))"><h2>${esc(f.title)}</h2>
    <p>새 업체 <b>${add.length}</b>곳 · 기존 업체 정보 보강 <b>${upd.length}</b>곳</p>
    <p class="hint">기존 업체는 <b>파일에 내용이 있는 칸만</b> 바뀌어요. 사진·가격표·후기·수수료·계약 정보와 사이트 공개 여부는 그대로예요. 확인 필요 메모는 새 내용으로 바뀌어요.</p>
    <div style="max-height:46vh;overflow:auto;border:1px solid var(--line);border-radius:10px">
    <table class="t"><thead><tr><th>업체</th><th>카테고리</th><th>들어가는 정보</th><th class="num">확인 필요</th></tr></thead><tbody>
    ${list.map(s => `<tr><td><b>${esc(s.name.ko)}</b> ${add.includes(s) ? `<span class="badge new">새로</span>` : ""}</td><td>${esc(catName(s.cat))}</td><td class="hint">${esc(info(s))}</td><td class="num">${(s.review || []).length}</td></tr>`).join("")}
    </tbody></table></div>
    <div class="btns"><button class="btn" data-no>닫기</button><button class="btn main" data-yes ${list.length ? "" : "disabled"}>${list.length}곳 가져오기</button></div></div>`;
  document.body.appendChild(d);
  d.querySelector("[data-no]").onclick = () => d.remove();
  d.querySelector("[data-yes]").onclick = async () => {
    const btn = d.querySelector("[data-yes]"); btn.disabled = true; btn.textContent = "저장 중…";
    let sort = Math.max(0, ...Object.values(META).map(m => m.sort || 0)), ok = 0;
    for (const n of list) {
      const o = shops.find(x => x.id === n.id);
      const s = o ? mergeShop(o, n) : mergeShop(blankShop(), n);
      if (!o) META[s.id] = { published: true, sort: ++sort };
      if (n.review) s.review = n.review;
      if (n.contract) {             // 업체 전화 등은 손님 화면이 아니라 관리자용 계약 정보로
        delete s.contract; const pv = PRIV[s.id] || { commission_rate: 0, contract: {} };
        PRIV[s.id] = { ...pv, contract: { ...(pv.contract || {}), ...Object.fromEntries(Object.entries(n.contract).filter(([k, v]) => filled(v) && !filled((pv.contract || {})[k]))) } };
      }
      try { await dbSaveShop(s); ok++; if (o) shops[shops.indexOf(o)] = s; else shops.push(s); } catch (e) { console.error(e); }
    }
    if (ok === list.length) { await markImport(f.id); note.remove(); }
    d.remove(); drawList(); showTab("shops");
    toast(ok === list.length ? `${ok}곳을 가져왔어요 ✅` : `${ok}곳 저장, ${list.length - ok}곳 실패했어요. 다시 눌러 주세요.`, 4500);
  };
}

/* ===== 로그인 ===== */
function gate(html) { $("gate").hidden = false; $("app").hidden = true; $("tabs").hidden = true; $("gate").innerHTML = html; }
function loginForm(msg = "") {
  gate(`<h1>엉클데이 관리자</h1><p class="hint" style="text-align:center">이메일과 비밀번호로 로그인해요</p>
    <form id="lf"><label class="f"><span>이메일</span><input type="email" id="lEmail" autocomplete="username" required></label>
      <label class="f"><span>비밀번호</span><input type="password" id="lPw" autocomplete="current-password" required></label>
      <div class="err-text" id="lErr">${msg}</div>
      <button class="btn main" style="justify-content:center;padding:11px">로그인</button>
      <button type="button" class="lnk" id="forgot">비밀번호를 잊었어요</button></form>
    <p style="text-align:center;margin:16px 0 0"><a href="./" style="color:var(--sub);font-size:13px">사이트로 돌아가기</a></p>`);
  $("lEmail").focus();
  $("lf").onsubmit = async e => {
    e.preventDefault(); $("lErr").textContent = "확인 중…";
    const r = await sb.auth.signInWithPassword({ email: $("lEmail").value.trim(), password: $("lPw").value });
    if (r.error) { $("lErr").textContent = /invalid/i.test(r.error.message) ? "이메일이나 비밀번호가 맞지 않아요." : "로그인하지 못했어요: " + r.error.message; return; }
    afterLogin(r.data.session);
  };
  $("forgot").onclick = async () => {
    const em = $("lEmail").value.trim();
    if (!em) { $("lErr").textContent = "위에 이메일을 먼저 적어 주세요."; return; }
    const r = await sb.auth.resetPasswordForEmail(em, { redirectTo: location.origin + location.pathname });
    $("lErr").textContent = r.error ? "메일을 보내지 못했어요: " + r.error.message : "비밀번호 재설정 메일을 보냈어요. 메일의 링크를 눌러 주세요. (스팸함도 확인)";
  };
}
function newPasswordForm() {
  gate(`<h1>새 비밀번호 정하기</h1><form id="nf"><label class="f"><span>새 비밀번호 (8자 이상)</span><input type="password" id="n1" minlength="8" autocomplete="new-password" required></label>
    <label class="f"><span>한 번 더</span><input type="password" id="n2" minlength="8" autocomplete="new-password" required></label><div class="err-text" id="nErr"></div>
    <button class="btn main" style="justify-content:center;padding:11px">저장하고 들어가기</button></form>`);
  $("nf").onsubmit = async e => {
    e.preventDefault();
    if ($("n1").value !== $("n2").value) { $("nErr").textContent = "두 비밀번호가 달라요."; return; }
    const r = await sb.auth.updateUser({ password: $("n1").value });
    if (r.error) { $("nErr").textContent = r.error.message; return; }
    toast("비밀번호를 바꿨어요 ✅"); const s = await sb.auth.getSession(); afterLogin(s.data.session);
  };
}
let started = false, recovering = false;
async function afterLogin(session) {
  if (!session || started) return;
  ME = { email: session.user.email, id: session.user.id };
  const ok = await sb.rpc("claim_admin");
  if (ok.error || !ok.data) { gate(`<h1>관리자 권한이 없어요</h1><p class="hint" style="text-align:center">${esc(ME.email)} 계정은 관리자로 등록되지 않았어요. 기존 관리자에게 '계정 → 관리자 추가'를 부탁하세요.</p><p style="text-align:center"><button class="btn" id="lo">다른 계정으로 로그인</button></p>`); $("lo").onclick = async () => { await sb.auth.signOut(); location.reload(); }; return; }
  started = true;
  gate(`<h1>불러오는 중…</h1>`);
  try { await loadAll(); await loadTold(); }
  catch (e) { gate(`<h1>불러오지 못했어요</h1><p class="hint" style="text-align:center">${esc(e.message || "")}<br>데이터베이스 설정(schema.sql)을 실행했는지 확인해 주세요.</p>`); started = false; return; }
  $("gate").hidden = true; $("app").hidden = false; $("tabs").hidden = false;
  $("me").textContent = ME.email;
  initShops();
  document.querySelectorAll("#tabs button").forEach(b => b.onclick = () => showTab(b.dataset.tab));
  const h = location.hash.slice(1);
  showTab(["dash", "work", "bk", "settle", "shops", "rv", "acc"].includes(h) ? h : "dash");
  offerMigration();
  checkImports();
  initNotis();
  // 1분마다 새 예약·후기 확인
  setInterval(async () => {
    if (document.hidden || $("layer").innerHTML) return;
    const before = BOOKINGS.length, rvBefore = RVS.length;
    try { await Promise.all([loadBookings(), loadReviews(), loadStats(vnMonth(), true), loadWork()]); await loadTold(); } catch (e) { return; }
    if (BOOKINGS.length > before) toast(`🔔 새 예약 ${BOOKINGS.length - before}건이 들어왔어요`, 5000);
    if (RVS.length > rvBefore) toast(`⭐ 새 후기가 들어왔어요`, 4000);
    const typing = document.activeElement && document.activeElement.closest && document.activeElement.closest("#app input, #app textarea, #app select");
    if (["dash", "bk", "rv", "work"].includes(TAB) && !typing && !document.querySelector(".overlay")) showTab(TAB); else drawCounts();
  }, 60000);
}

(async () => {
  if (!ON) {
    gate(`<h1>데이터베이스 연결이 필요해요</h1><p class="hint">config.js에 Supabase 주소(url)와 공개 키(key)를 넣으면 이 화면이 로그인 화면으로 바뀌어요.</p>`);
    return;
  }
  sb.auth.onAuthStateChange((ev, session) => {
    if (ev === "PASSWORD_RECOVERY") { recovering = true; newPasswordForm(); }
  });
  const { data } = await sb.auth.getSession();
  if (RECOVERY || recovering) { recovering = true; newPasswordForm(); return; }
  if (data.session) afterLogin(data.session); else loginForm();
})();

/* ===== 창 닫기: Esc 키나 창 바깥(어두운 곳)을 누르면 닫혀요. 고친 내용이 있으면 한 번 물어봐요 ===== */
(() => {
  const snap = window.overlaySnap = d => [...d.querySelectorAll("input, select, textarea")].map(i => i.type === "checkbox" || i.type === "radio" ? i.checked : i.value).join("\u0001")
    + "\u0002" + [...d.querySelectorAll("[contenteditable=true]")].map(e => e.innerHTML).join("\u0001");
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => {
    if (n.nodeType === 1 && n.classList.contains("overlay")) setTimeout(() => { n._snap = snap(n); }, 300);   // 내용이 다 그려진 뒤의 모습을 기억
  }))).observe(document.body, { childList: true });
  const top = () => [...document.querySelectorAll("body > .overlay")].filter(o => !o.hidden && o.querySelector("[data-no]")).pop();
  function tryClose(o) {
    const no = o.querySelector("[data-no]"); if (!no) return;
    const dirty = o._snap !== undefined && snap(o) !== o._snap && !/취소|아니/.test(no.textContent);
    if (!dirty) { no.click(); return; }
    confirmBox("저장하지 않고 닫을까요?", () => no.click(), "고친 내용이 사라져요.", "닫기", true);
  }
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape" || e.defaultPrevented || e.isComposing) return;
    const o = top(); if (!o) return;
    if (document.querySelector(".re-big")) return;   // 크게 보기 중이면 먼저 그것만 닫혀요
    e.preventDefault(); tryClose(o);
  });
  let downOn = null;
  document.addEventListener("mousedown", e => { downOn = e.target; }, true);
  document.addEventListener("click", e => {
    const o = e.target;
    if (!o.classList || !o.classList.contains("overlay") || downOn !== o || o !== top()) return;   // 안에서 끌다가 바깥에서 놓은 건 무시
    if (e.offsetX > o.clientWidth || e.offsetY > o.clientHeight) return;   // 스크롤 막대를 누른 건 무시
    tryClose(o);
  });
})();

/* =========================================================
   🏠 엉클데이 사내 포털 (관리자 페이지 첫 화면)
   - 오늘 할 일 모음 · 4개 공간 바로가기 · 매장별 관리 카드 · 대신 수정 기록 · 운영 가이드
   매장 관련 서버 함수는 universe10 · universe11.sql 에 있어요.
   ========================================================= */
let PORTAL = { shops: null, bonus: null, audit: null, err: null, loading: false, guide: false };

async function portalLoad() {
  if (PORTAL.loading) return; PORTAL.loading = true;
  const r = await Promise.allSettled([sb.rpc("admin_universe_shops"), sb.rpc("admin_bonus_list", { st: "pending" }), sb.rpc("admin_audit_list", { lim: 12 })]);
  const val = x => x.status === "fulfilled" && !x.value.error ? x.value.data : null;
  PORTAL.shops = val(r[0]) || []; PORTAL.bonus = val(r[1]); PORTAL.audit = val(r[2]) || [];
  PORTAL.err = r[0].status === "fulfilled" && r[0].value.error ? "매장 정보를 못 불러왔어요 (universe10.sql 실행 여부 확인)" : null;
  PORTAL.loading = false;
  if (TAB === "home") drawPortal(true);
}

const PORTAL_SPACES = [
  { ic: "🌐", nm: "엉클데이 (손님 사이트)", url: "/", who: "손님", how: "로그인 없이 예약 · 카카오/구글 로그인 선택", desc: "업체 찾기 · 예약 · 예약확인증 · 채팅 · 후기 · 담당 테라피스트 후기" },
  { ic: "🛠️", nm: "관리자 페이지 (지금 여기)", url: "/admin.html", who: "엉클데이 운영팀", how: "관리자 이메일 + 비밀번호", desc: "예약 · 채팅 · 고객 · 정산 · 업체 · 후기 · 유니버스 · 계정 · 백업" },
  { ic: "🏪", nm: "사장님 페이지", url: "/owner", who: "업체 사장님 · 카운터 직원", how: "전화번호 + 비밀번호 (업체 → 수정 → 👤 사장님 페이지 계정에서 만들어요)", desc: "예약 답하기 · 일정 · 현황판 · 근무표 · 기록 · 정산" },
  { ic: "👩", nm: "직원 화면", url: "/staff", who: "테라피스트 · 리셉션", how: "전화번호 + PIN 6자리 (사장님 또는 포털의 👩 직원 · PIN에서 만들어요)", desc: "내 근무 · 휴대폰 출퇴근 · 휴무/교대 요청 · 후기 · 보너스 · 경력 동의" },
];
const PORTAL_MSG = {
  owner: { vi: "Uncle Day: Trang chủ cửa hàng www.uncleday.com/owner — đăng nhập bằng số điện thoại và mật khẩu tạm thời chúng tôi gửi. Lần đầu đăng nhập hãy đổi mật khẩu.", ko: "엉클데이: 사장님 페이지 www.uncleday.com/owner — 보내 드린 전화번호와 임시 비밀번호로 로그인하고, 처음 들어오면 비밀번호를 바꿔 주세요." },
  staff: { vi: "Uncle Day: Màn hình nhân viên www.uncleday.com/staff — đăng nhập bằng số điện thoại của bạn và mã PIN 6 số chủ cửa hàng đưa. Xem lịch làm, chấm công, xin nghỉ và đánh giá của bạn.", ko: "엉클데이: 직원 화면 www.uncleday.com/staff — 내 전화번호와 사장님이 알려 준 PIN 6자리로 로그인해요. 근무표 · 출퇴근 · 휴무 요청 · 내 후기를 볼 수 있어요." },
};

// 할 일은 이곳 한 군데에서만 세요 (예약 할 일 = TODO, 팀 일 = workTodos)
function portalTodos() {
  const shops = PORTAL.shops || [], B = (PORTAL.bonus && PORTAL.bonus.counts) || {};
  const bk = TODO.map(([k, ic, label, f]) => [ic, label, BOOKINGS.filter(f).length, () => { bkF = { ...BKF0, st: "all", todo: k }; showTab("bk"); }]);
  const team = workTodos().map(([k, ic, label, n, go]) => [ic, label, n, go]);
  const etc = [
    ["💬", "답 안 한 채팅", typeof chatCount === "function" ? chatCount() : 0, () => showTab("chat")],
    ["⭐", "게시를 기다리는 손님 후기", RVS.filter(x => x.status === "pending").length, () => showTab("rv")],
    ["💌", "승인할 테라피스트 보너스", +B.pending || 0, () => { UNI.seg = "bonus"; UNI.bst = "pending"; UNI.bonus = null; showTab("uni"); }],
    ["🙋", "사장님 승인 기다리는 직원 요청 (매장 카드에서 보기)", shops.reduce((a, s) => a + (+s.pending_req || 0), 0), null],
  ];
  return [["📅 예약 · 손님", bk], ["🌌 매장 · 직원 · 후기", etc], ["📝 팀 일 (낙서장)", team]];
}

function drawPortal(skip) {
  const el = $("tab-home"); if (!el) return;
  if (!skip && !PORTAL.loading) portalLoad();
  const G = portalTodos(), T = G.flatMap(g => g[1]), todoN = T.reduce((a, x) => a + (x[2] || 0), 0);
  const S = PORTAL.shops || [];
  const vnd = n => "₫" + Math.round(+n || 0).toLocaleString("en-US");
  const stTxt = st => ({ before: "영업 전", open_auto: "영업 중", open_manual: "영업 중", after: "영업 종료", closed_manual: "마감", dayoff: "휴무일" })[(st || {}).status] || "-";
  const others = (typeof shops !== "undefined" ? shops : []).filter(s => !S.some(x => x.id === s.id));
  el.innerHTML = `
    <div class="pt-hero"><div><h2>🏠 엉클데이 사내 포털</h2><p>오늘 처리할 일, 4개 공간, 매장 관리, 운영 가이드를 한곳에 모았어요.</p></div><button class="btn sm" data-pact="reload">↻ 새로고침</button></div>
    ${PORTAL.err ? `<div class="uni-err">${esc(PORTAL.err)}</div>` : ""}
    <section class="pt-sec"><h3>✅ 오늘 할 일 <span class="hint">${todoN ? `${todoN}건` : "모두 처리했어요 🎉"}</span></h3>
      ${(() => { let k = -1; return G.map(([gn, items]) => `<h4 class="pt-gh">${gn} <span class="hint">${items.reduce((a, x) => a + (x[2] || 0), 0)}건</span></h4><div class="pt-todos">${items.map(([ic, l, n, go]) => { k++; return `<button class="pt-todo ${n ? "" : "zero"}" data-ptodo="${k}" ${go && n ? "" : "disabled"}><span class="ic">${ic}</span><span class="l">${esc(l)}</span><b>${n || 0}</b></button>`; }).join("")}</div>`).join(""); })()}</section>
    <section class="pt-sec"><h3>🧭 4개 공간 바로가기</h3>
      <div class="pt-spaces">${PORTAL_SPACES.map(s => `<div class="pt-space"><div class="h"><span class="ic">${s.ic}</span><b>${esc(s.nm)}</b></div>
        <small><b>누가</b> ${esc(s.who)}</small><small><b>로그인</b> ${esc(s.how)}</small><small><b>하는 일</b> ${esc(s.desc)}</small>
        <div class="pt-row"><a class="btn sm main" href="${s.url}" target="_blank" rel="noopener">열기 ↗</a><button class="btn sm" data-pcopy="${esc("https://www.uncleday.com" + (s.url === "/" ? "" : s.url))}">주소 복사</button></div></div>`).join("")}</div>
      <div class="pt-msgs"><b>📋 보낼 안내 문구</b>${[["owner", "사장님께"], ["staff", "직원에게"]].map(([k, l]) => `<div class="pt-msg"><span>${l}</span><button class="btn sm" data-pmsg="${k}" data-l="vi">베트남어 복사</button><button class="btn sm" data-pmsg="${k}" data-l="ko">한국어 복사</button></div>`).join("")}</div></section>
    <section class="pt-sec"><h3>🏪 매장별 관리 <span class="hint">현황판 쓰는 매장 ${S.length}곳</span></h3>
      ${S.length ? `<div class="pt-shops">${S.map(s => `<div class="pt-shop"><div class="h"><b>${esc(s.name)}</b><span class="uni-chip ${(s.state || {}).is_open ? "ok" : ""}">${stTxt(s.state)}</span></div>
        <div class="nums"><span>출근 <b>${s.in_now}/${s.staff}</b></span><span>시술 중 <b>${s.working}</b></span><span>대기 <b>${s.waiting}</b></span><span>오늘 <b>${s.done_today}</b> · ${vnd(s.rev_today)}</span>${s.pending_req ? `<span class="warn">요청 대기 <b>${s.pending_req}</b></span>` : ""}<span>📱 ${s.app}명</span></div>
        <div class="pt-row"><button class="btn sm" data-pboard="${esc(s.id)}" data-nm="${esc(s.name)}">🗺️ 보기</button><button class="btn sm" data-pedit="${esc(s.id)}" data-nm="${esc(s.name)}">✏️ 대신 수정</button><button class="btn sm" data-pstaff="${esc(s.id)}" data-nm="${esc(s.name)}">👩 직원 · PIN</button><button class="btn sm" data-pacc="${esc(s.id)}">🔑 사장님 계정</button></div></div>`).join("")}</div>` : `<div class="uni-empty">아직 현황판을 쓰는 매장이 없어요.</div>`}
      ${others.length ? `<div class="pt-start"><span>현황판을 아직 안 쓰는 업체를 대신 설정해 주기:</span><select id="ptOther">${others.map(s => `<option value="${esc(s.id)}">${esc((s.name && (s.name.ko || s.name.en || s.name.vi)) || s.id)}</option>`).join("")}</select><button class="btn sm main" data-pact="start">✏️ 대신 설정 시작</button></div>` : ""}
    </section>
    <section class="pt-sec"><h3>🛠️ 최근 대신 수정 기록 <span class="hint">사장님 화면 '오늘'에도 똑같이 보여요</span></h3>
      ${(PORTAL.audit || []).length ? `<div class="pt-audit">${PORTAL.audit.map(a => `<div><span>${esc(new Date(a.at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }))}</span><b>${esc(a.shop || a.shop_id)}</b> ${esc(a.summary || "")} <small>${esc(a.who || "")}</small></div>`).join("")}</div>` : `<p class="hint">아직 대신 수정한 기록이 없어요.</p>`}</section>
    <section class="pt-sec" id="ptGuide"><h3>📘 운영 가이드 · 매뉴얼 <span class="hint">내용은 📘 사용 안내 한 곳에서만 고쳐요</span></h3>
      ${PORTAL.guide ? `<button class="btn sm" data-pact="guideclose">← 포털 요약으로</button><div id="ptGuideBox" style="margin-top:10px"></div>` : `<div class="pt-guide">
        <div><b>📘 전체 사용 안내</b><small>예약 처리 · 업체 관리 · 채팅 · 백업 · 사장님 페이지 · 유니버스까지 팀원용 설명서 (검색 가능)</small><button class="btn sm main" data-pact="guide">열기</button></div>
        ${portalFaq().map(it => `<div><b>${it.ic || "❓"} ${esc(it.t)}</b><small>${it.b}</small></div>`).join("")}</div>`}</section>`;
  portalBind(el);
  if (PORTAL.guide && $("ptGuideBox")) drawGuide($("ptGuideBox"));
}
// 포털 요약에 보여 줄 질문: 📘 사용 안내의 '🌌 유니버스 · 포털' 묶음에서 가져와요 (따로 쓰지 않아요)
function portalFaq() {
  const sec = (typeof GUIDE !== "undefined" ? GUIDE : []).find(s => /유니버스/.test(s.sec));
  return sec ? sec.items : [];
}

function portalBind(el) {
  const T = portalTodos().flatMap(g => g[1]);
  el.querySelectorAll("[data-ptodo]").forEach(b => b.onclick = () => { const go = T[+b.dataset.ptodo][3]; if (go) go(); });
  el.querySelectorAll("[data-pcopy]").forEach(b => b.onclick = () => portalCopy(b.dataset.pcopy));
  el.querySelectorAll("[data-pmsg]").forEach(b => b.onclick = () => portalCopy(PORTAL_MSG[b.dataset.pmsg][b.dataset.l]));
  el.querySelectorAll("[data-pboard]").forEach(b => b.onclick = () => uniOpenBoard(b.dataset.pboard, b.dataset.nm));
  el.querySelectorAll("[data-pedit]").forEach(b => b.onclick = () => uniOpenBoard(b.dataset.pedit, b.dataset.nm, true));
  el.querySelectorAll("[data-pstaff]").forEach(b => b.onclick = () => portalStaff(b.dataset.pstaff, b.dataset.nm));
  el.querySelectorAll("[data-pacc]").forEach(b => b.onclick = () => { if (typeof openEditor === "function") openEditor(b.dataset.pacc); });
  el.querySelectorAll("[data-pact]").forEach(b => b.onclick = () => {
    const a = b.dataset.pact;
    if (a === "reload") { PORTAL.shops = null; return drawPortal(); }
    if (a === "guide") { PORTAL.guide = true; drawPortal(true); const g = $("ptGuide"); if (g) g.scrollIntoView({ behavior: "smooth" }); return; }
    if (a === "guideclose") { PORTAL.guide = false; return drawPortal(true); }
    if (a === "start") { const s = el.querySelector("#ptOther"); if (!s) return; uniOpenBoard(s.value, s.options[s.selectedIndex].text, true); }
  });
}
async function portalCopy(txt) {
  try { await navigator.clipboard.writeText(txt); toast("복사했어요"); }
  catch (e) { prompt("아래 내용을 복사해 주세요", txt); }
}

// 👩 직원 · PIN (사장님과 연락이 안 될 때 엉클데이가 대신 PIN 만들기 — 기록이 남아요)
async function portalStaff(shopId, name) {
  const ov = document.createElement("div"); ov.className = "uni-ov";
  ov.innerHTML = `<div class="uni-ov-in pt-pin"><div class="uni-ov-h"><b>👩 ${esc(name)} · 직원 · PIN</b><button class="btn sm" data-x>닫기</button></div><div class="uni-ov-b" id="ptPinB"><p class="hint">불러오는 중…</p></div></div>`;
  document.body.appendChild(ov);
  const close = () => { ov.remove(); document.removeEventListener("keydown", onKey); }, onKey = e => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey); ov.querySelector("[data-x]").onclick = close; ov.onclick = e => { if (e.target === ov) close(); };
  const body = ov.querySelector("#ptPinB"); let shown = {};
  const draw = async () => {
    const { data, error } = await sb.rpc("board_get", { shop: shopId });
    if (error) { body.innerHTML = `<div class="uni-err">${esc(error.message)}</div>`; return; }
    const S = data.staff || [];
    body.innerHTML = `<p class="uni-note" style="margin-top:0">PIN은 보통 사장님이 만들어요. 사장님과 연락이 안 될 때만 여기서 새로 만들어 직원에게 보내 주세요. 새로 만들면 그 직원의 예전 PIN과 로그인은 바로 끊기고, 사장님 화면에 기록이 남아요.</p>
      ${S.length ? S.map(s => `<div class="pt-st"><div><b>${esc(s.name)}</b> <small>${s.role === "rcp" ? "리셉션" : "테라피스트"}</small><br><small>${s.has_phone ? "📞 전화번호 있음" : "⚠️ 전화번호 없음 → ✏️ 대신 수정 → ⚙️ → 직원에서 넣어 주세요"} · ${s.app ? "📱 직원 화면 사용 중" : "직원 화면 안 씀"}</small>
          ${shown[s.id] ? `<div class="pt-pinshow">PIN <b>${esc(shown[s.id])}</b> <button class="btn sm" data-cp="${esc(shown[s.id])}" data-nm="${esc(s.name)}">안내 문구 복사</button></div>` : ""}</div>
        <button class="btn sm ${s.app ? "" : "main"}" data-pin="${s.id}" data-nm="${esc(s.name)}" ${s.has_phone ? "" : "disabled"}>${s.app ? "PIN 다시 만들기" : "PIN 만들기"}</button></div>`).join("") : `<p class="hint">직원이 아직 없어요. ✏️ 대신 수정 → ⚙️ 매장 설정 → 직원에서 넣을 수 있어요.</p>`}`;
    body.querySelectorAll("[data-pin]").forEach(b => b.onclick = async () => {
      if (!confirm(`${b.dataset.nm}님 PIN을 새로 만들까요? 예전 PIN은 더 이상 안 돼요.`)) return;
      const r = await sb.rpc("staff_pin_reset", { shop: shopId, sid: b.dataset.pin });
      if (r.error) return toast(r.error.message);
      shown[b.dataset.pin] = r.data; draw();
    });
    body.querySelectorAll("[data-cp]").forEach(b => b.onclick = () => portalCopy(`Uncle Day: ${b.dataset.nm} ơi, mã PIN mới của bạn là ${b.dataset.cp}. Đăng nhập www.uncleday.com/staff bằng số điện thoại của bạn và PIN này. (직원 화면 www.uncleday.com/staff — 새 PIN ${b.dataset.cp})`));
  };
  draw();
}

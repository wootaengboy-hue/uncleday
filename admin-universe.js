/* =========================================================
   🌌 엉클데이 유니버스 (관리자)
   - 매장 현황: 현황판을 쓰는 매장의 오늘 상태, 현황판 읽기 전용 보기
   - 직원 DB: 경력 프로필에 동의한 직원만 (구직 중은 관리자만 봐요)
   - 후기 · 보너스: 테라피스트 후기 확인, 보너스 금액 · 승인 · 지급
   서버 함수는 supabase/universe10.sql 에 있어요.
   ========================================================= */
let UNI = { seg: "shops", shops: null, db: null, bonus: null, bst: "pending", sel: new Set(), err: null, q: "", onlyOpen: false };

async function uniLoad() {
  UNI.err = null;
  try {
    if (UNI.seg === "shops") { const { data, error } = await sb.rpc("admin_universe_shops"); if (error) throw error; UNI.shops = data || []; }
    else if (UNI.seg === "db") { const { data, error } = await sb.rpc("admin_staff_db"); if (error) throw error; UNI.db = data; }
    else { const { data, error } = await sb.rpc("admin_bonus_list", { st: UNI.bst }); if (error) throw error; UNI.bonus = data; UNI.sel = new Set(); }
  } catch (e) { UNI.err = /function|does not exist|schema cache/i.test(e.message || "") ? "준비가 아직이에요. supabase/universe10.sql 까지 실행해 주세요." : (e.message || "불러오지 못했어요"); }
  drawUniverse(true);
}

function drawUniverse(skipLoad) {
  const el = $("tab-uni"); if (!el) return;
  const need = UNI.seg === "shops" ? UNI.shops : UNI.seg === "db" ? UNI.db : UNI.bonus;
  if (!skipLoad && need == null) { el.innerHTML = `<p class="hint">불러오는 중…</p>`; uniLoad(); return; }
  const segs = [["shops", "🏪 매장 현황"], ["db", "👩 직원 DB"], ["bonus", "💌 후기 · 보너스"]];
  let h = `<div class="uni-top"><div class="uni-seg">${segs.map(([k, l]) => `<button class="btn ${UNI.seg === k ? "main" : ""}" data-useg="${k}">${l}</button>`).join("")}</div><button class="btn sm" data-uact="reload">↻ 새로고침</button></div>`;
  if (UNI.err) h += `<div class="uni-err">${esc(UNI.err)}</div>`;
  else if (UNI.seg === "shops") h += uniShops();
  else if (UNI.seg === "db") h += uniDb();
  else h += uniBonus();
  el.innerHTML = h;
  uniBind(el);
}

const uniVnd = n => "₫" + Math.round(+n || 0).toLocaleString("en-US");
const uniDate = s => s ? String(s).slice(0, 10) : "";
const UNI_ST = { before: ["영업 전", ""], open_auto: ["영업 중", "ok"], open_manual: ["영업 중 (직접)", "ok"], after: ["영업 종료", ""], closed_manual: ["마감 (직접)", ""], dayoff: ["휴무일", ""] };

function uniShops() {
  const S = UNI.shops || [];
  if (!S.length) return `<div class="uni-empty">아직 현황판을 쓰는 매장이 없어요. 사장님 페이지 → 현황판 → ⚙️ 매장 설정에서 직원을 넣으면 여기에 나와요.</div>`;
  const tot = k => S.reduce((a, s) => a + (+s[k] || 0), 0);
  return `<div class="kpis">${[["매장", S.length], ["지금 출근", tot("in_now")], ["시술 중", tot("working")], ["대기 손님", tot("waiting")], ["오늘 완료", tot("done_today")], ["오늘 매출 (현황판)", uniVnd(tot("rev_today"))]].map(([l, v]) => `<div class="kpi"><small>${l}</small><b>${v}</b></div>`).join("")}</div>
    <div class="uni-grid">${S.map(s => { const st = UNI_ST[(s.state || {}).status] || ["-", ""];
      return `<div class="uni-card"><div class="uni-h"><b>${esc(s.name)}</b><span class="uni-chip ${st[1]}">${st[0]}${s.state && s.state.open ? ` · ${esc(s.state.open)}–${esc(s.state.close)}` : ""}</span></div>
        <div class="uni-nums"><span><b>${s.in_now}/${s.staff}</b>출근</span><span><b style="color:#C8372D">${s.working}</b>시술 중</span><span><b>${s.waiting}</b>대기</span><span><b>${s.done_today}</b>완료</span><span><b>${uniVnd(s.rev_today)}</b>오늘 매출</span></div>
        <div class="uni-sub">📱 직원 화면 ${s.app}명 · 후기 30일 ${s.rv_30}건${s.rv_avg ? ` · ★${s.rv_avg}` : ""}${s.pending_req ? ` · <b style="color:#9a5208">요청 대기 ${s.pending_req}</b>` : ""}${s.last_used ? ` · 마지막 사용 ${uniDate(s.last_used)}` : ""}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm" data-uboard="${esc(s.id)}" data-uname="${esc(s.name)}">🗺️ 현황판 보기 (읽기 전용)</button><button class="btn sm" data-uedit="${esc(s.id)}" data-uname="${esc(s.name)}">✏️ 대신 수정</button><button class="btn sm" data-ustaff="${esc(s.id)}" data-uname="${esc(s.name)}">👩 직원 · PIN</button></div></div>`; }).join("")}</div>`;
}

function uniDb() {
  const D = UNI.db || {}, q = UNI.q.trim().toLowerCase();
  const P = (D.people || []).filter(p => (!UNI.onlyOpen || p.open) && (!q || (p.name || "").toLowerCase().includes(q) || (p.shops || []).some(s => (s.shop || "").toLowerCase().includes(q))));
  return `<div class="kpis">${[["전체 직원 (근무 중)", D.total || 0], ["경력 프로필 동의", D.consented || 0], ["구직 중 (동의자 중)", D.open || 0]].map(([l, v]) => `<div class="kpi"><small>${l}</small><b>${v}</b></div>`).join("")}</div>
    <div class="uni-note">🔒 직원 본인이 직원 화면에서 <b>경력 프로필 저장</b>에 동의한 사람만 보여요. <b>구직 중</b>은 관리자만 볼 수 있고 사장님 화면에는 절대 나오지 않아요. 연락은 직원 본인 동의 범위 안에서만 해 주세요.</div>
    <div class="toolbar"><input type="search" id="uniQ" placeholder="이름 · 매장 검색" value="${esc(UNI.q)}"><label class="hint"><input type="checkbox" id="uniOpen" ${UNI.onlyOpen ? "checked" : ""}> 구직 중만</label><span class="hint">${P.length}명</span></div>
    ${P.length ? `<div class="uni-tw"><table class="uni-t"><thead><tr><th>이름</th><th>매장 (경력)</th><th>시술</th><th>시술 시간</th><th>후기</th><th>출근일 · 지각</th><th>연락처</th></tr></thead><tbody>${P.map(p => `<tr>
      <td><b>${esc(p.name)}</b>${p.open ? ` <span class="uni-chip open">구직 중</span>` : ""}</td>
      <td>${(p.shops || []).map(s => `${esc(s.shop)} <small>${s.role === "rcp" ? "리셉션" : "테라피스트"} · ${s.years}년${s.active ? "" : " · 퇴사"}</small>`).join("<br>")}</td>
      <td>${p.sessions}</td><td>${Math.round((p.minutes || 0) / 60)}시간</td><td>${p.reviews}${p.avg ? ` · ★${p.avg}` : ""}</td><td>${p.days}일 · ${p.late_n}번</td>
      <td>${p.open ? esc(p.phone || "") : `<small class="hint">구직 중일 때만</small>`}</td></tr>`).join("")}</tbody></table></div>` : `<div class="uni-empty">아직 동의한 직원이 없어요.</div>`}`;
}

function uniBonus() {
  const B = UNI.bonus || {}, C = B.counts || {}, R = B.rows || [];
  const BS = { none: "방문 확인 전", pending: "확인 대기", approved: "지급 예정", paid: "지급 완료", rejected: "인정 안 함" };
  return `<div class="uni-bonus-set"><b>후기 1건당 보너스</b><input id="uniAmt" inputmode="numeric" value="${B.bonus || 0}"><span class="hint">₫ · 별점과 상관없이 같은 금액 · 바꾸면 아직 지급 전인 후기에도 적용돼요</span><button class="btn sm main" data-uact="amt">저장</button></div>
    <div class="uni-note">확인 기준: 엉클데이 예약 + 방문 확인 + 방문 뒤 14일 안. <b>매장 기록</b>(현황판·사장님 입력)에 있거나 그날 <b>출근 기록</b>이 있는 테라피스트면 믿을 만해요. 둘 다 아니면 확인 후 결정해 주세요.</div>
    ${(B.owed || []).length ? `<div class="uni-owed"><b>지급할 보너스 (지급 예정)</b>${B.owed.map(o => `<div class="uni-or"><span>${esc(o.name)} <small>${esc(o.shop)}</small></span><span>${o.n}건 · <b>${uniVnd(o.amount)}</b></span><button class="btn sm main" data-upaid='${esc(JSON.stringify(o.ids))}'>지급 완료로</button></div>`).join("")}</div>` : ""}
    <div class="uni-seg sm">${["pending", "approved", "paid", "rejected", "none", "all"].map(k => `<button class="btn sm ${UNI.bst === k ? "main" : ""}" data-ubst="${k}">${k === "all" ? "전체" : BS[k]}${k !== "all" && C[k] ? ` ${C[k]}` : ""}</button>`).join("")}</div>
    ${UNI.bst === "pending" && R.length ? `<div class="actions"><button class="btn sm" data-uact="selall">전체 선택</button><button class="btn sm main" data-uact="approve">선택 승인 (${UNI.sel.size})</button><button class="btn sm danger" data-uact="reject">선택 인정 안 함</button></div>` : ""}
    ${R.length ? `<div class="uni-rvs">${R.map(v => `<div class="uni-rv ${v.hidden ? "hid" : ""}">
      ${UNI.bst === "pending" ? `<input type="checkbox" data-usel="${v.id}" ${UNI.sel.has(v.id) ? "checked" : ""} aria-label="선택">` : ""}
      <div class="g"><b>${esc(v.staff || "-")} <small>${esc(v.shop)}</small> <span class="st">${"★".repeat(v.stars)}${"☆".repeat(5 - v.stars)}</span></b>
        ${v.body ? `<p>“${esc(v.body)}”</p>` : ""}
        <small>${esc(v.customer || "")} · ${esc(v.code || "")} · 방문 ${esc(uniDate(v.visit_date))} · 작성 ${esc(uniDate(v.created_at))}</small>
        <small>${v.recorded ? "✅ 매장 기록에 있음" : "⚪ 매장 기록 없음 (손님이 고름)"} · ${v.attended ? "✅ 그날 출근" : "⚠️ 그날 출근 기록 없음"} · ${v.verified ? "방문 확인됨" : "방문 확인 전"}</small></div>
      <div class="a"><span class="uni-chip ${v.status}">${BS[v.status] || v.status}</span><b>${uniVnd(v.amount)}</b>
        <button class="btn sm" data-uhide="${v.id}" data-h="${v.hidden ? 0 : 1}">${v.hidden ? "다시 보이기" : "숨기기"}</button></div></div>`).join("")}</div>` : `<div class="uni-empty">해당하는 후기가 없어요.</div>`}`;
}

function uniBind(el) {
  el.querySelectorAll("[data-useg]").forEach(b => b.onclick = () => { UNI.seg = b.dataset.useg; drawUniverse(); });
  el.querySelectorAll("[data-ubst]").forEach(b => b.onclick = () => { UNI.bst = b.dataset.ubst; UNI.bonus = null; drawUniverse(); });
  el.querySelectorAll("[data-usel]").forEach(b => b.onchange = () => { b.checked ? UNI.sel.add(b.dataset.usel) : UNI.sel.delete(b.dataset.usel); const x = el.querySelector('[data-uact="approve"]'); if (x) x.textContent = `선택 승인 (${UNI.sel.size})`; });
  el.querySelectorAll("[data-uboard]").forEach(b => b.onclick = () => uniOpenBoard(b.dataset.uboard, b.dataset.uname));
  el.querySelectorAll("[data-uedit]").forEach(b => b.onclick = () => uniOpenBoard(b.dataset.uedit, b.dataset.uname, true));
  el.querySelectorAll("[data-ustaff]").forEach(b => b.onclick = () => portalStaff(b.dataset.ustaff, b.dataset.uname));
  el.querySelectorAll("[data-uhide]").forEach(b => b.onclick = async () => { const { error } = await sb.rpc("admin_staff_review_hide", { rid: b.dataset.uhide, hide: b.dataset.h === "1" }); if (error) return toast(error.message); uniLoad(); });
  el.querySelectorAll("[data-upaid]").forEach(b => b.onclick = async () => {
    const ids = JSON.parse(b.dataset.upaid); if (!confirm(`${ids.length}건을 '지급 완료'로 바꿀까요? 실제로 돈을 보낸 뒤에 눌러 주세요.`)) return;
    const { error } = await sb.rpc("admin_bonus_set", { ids, st: "paid", memo: null }); if (error) return toast(error.message); toast("지급 완료로 바꿨어요"); uniLoad(); });
  const q = el.querySelector("#uniQ"); if (q) q.oninput = () => { UNI.q = q.value; const pos = q.selectionStart; drawUniverse(true); const q2 = $("tab-uni").querySelector("#uniQ"); if (q2) { q2.focus(); q2.setSelectionRange(pos, pos); } };
  const o = el.querySelector("#uniOpen"); if (o) o.onchange = () => { UNI.onlyOpen = o.checked; drawUniverse(true); };
  el.querySelectorAll("[data-uact]").forEach(b => b.onclick = async () => {
    const a = b.dataset.uact;
    if (a === "reload") { UNI.shops = UNI.db = UNI.bonus = null; return drawUniverse(); }
    if (a === "selall") { (UNI.bonus.rows || []).forEach(v => UNI.sel.add(v.id)); return drawUniverse(true); }
    if (a === "amt") { const v = +String(el.querySelector("#uniAmt").value).replace(/\D/g, ""); const { error } = await sb.rpc("admin_bonus_amount", { amount: v }); if (error) return toast(error.message); toast("보너스 금액을 저장했어요"); return uniLoad(); }
    if (a === "approve" || a === "reject") { if (!UNI.sel.size) return toast("후기를 골라 주세요");
      const { error } = await sb.rpc("admin_bonus_set", { ids: [...UNI.sel], st: a === "approve" ? "approved" : "rejected", memo: null }); if (error) return toast(error.message);
      toast(a === "approve" ? "승인했어요 (지급 예정)" : "인정 안 함으로 바꿨어요"); return uniLoad(); }
  });
}

// 현황판 읽기 전용 (사장님 페이지와 같은 화면)
function uniOpenBoard(shopId, name, edit) {
  if (!window.OwnerBoard) return toast("현황판 파일을 불러오지 못했어요");
  if (edit && !confirm(`${name} 현황판을 사장님 대신 수정할까요?\n\n고친 내용(매장 설정 · 직원 · 근무표 · 손님 · 시술)은 자동으로 기록되고, 사장님 페이지 '오늘' 화면에 "엉클데이 관리자가 대신 수정했어요"로 보여요.`)) return;
  const ov = document.createElement("div"); ov.className = "uni-ov";
  ov.innerHTML = `<div class="uni-ov-in uni-board"><div class="uni-ov-h ${edit ? "edit" : ""}"><b>${edit ? `✏️ ${esc(name)} · 대신 수정 중 <small>고친 내용은 사장님 화면에 기록돼요</small>` : `🗺️ ${esc(name)} · 읽기 전용`}</b><button class="btn sm" data-x>닫기</button></div><div class="uni-ov-b" id="uniBoard"></div></div>`;
  document.body.appendChild(ov); document.body.style.overflow = "hidden";
  const close = () => { try { window.OwnerBoard.unmount(); } catch (e) {} ov.remove(); document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); if (edit && typeof PORTAL !== "undefined") { PORTAL.shops = null; if (TAB === "home") drawPortal(); } };
  const onKey = e => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  ov.querySelector("[data-x]").onclick = close;
  window.OwnerBoard.mount(ov.querySelector("#uniBoard"), {
    view: "board", shopId, lang: "ko", isOwner: !!edit, readOnly: !edit,
    rpc: async (fn, args) => { const { data, error } = await sb.rpc(fn, args || {}); if (error) throw error; return data; },
    toast: m => toast(m), errMsg: e => (e && e.message) || "오류", onPending: () => {}
  });
}

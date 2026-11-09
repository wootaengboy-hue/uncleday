/* =========================================================
   👥 고객 관리 (CRM)
   - 같은 연락처로 들어온 예약을 한 손님으로 자동으로 묶어요 (DB가 해 줘요)
   - 손님 카드: 이용 내역 · 메모 · 태그 · 연락 기록 · 쿠폰
   - 쿠폰·이벤트 안내는 '받을게요'에 동의한 손님에게만
   ========================================================= */
let CUSTOMERS = [], COUPONS = [], CRM_READY = null;
let crmSeg = "all", crmQ = "", crmTag = "", crmSel = new Set();

async function loadCrm() {
  const [c, k] = await Promise.all([
    sb.from("customers").select("*").order("last_at", { ascending: false }).limit(10000),
    sb.from("coupons").select("*").order("created_at", { ascending: false }).limit(10000)]);
  if (c.error) { CRM_READY = false; CUSTOMERS = []; COUPONS = []; return; }
  CRM_READY = true; CUSTOMERS = c.data || []; COUPONS = k.error ? [] : (k.data || []);
}

const CRM_TAGS = ["VIP", "재방문", "가족", "커플", "친구·단체", "출장", "피부관리", "마사지", "주의 필요"];
const DONE_ST = ["visited", "settled"];
const daysAgo = d => d ? Math.floor((Date.now() - new Date(d)) / 864e5) : null;
const maskContact = c => { c = String(c || ""); const d = c.replace(/\D/g, ""); return d.length >= 8 && !/[A-Za-z@]/.test(c) ? c.replace(/\d(?=\d{4})/g, (x, i) => i < c.length - 8 ? x : "•") : c; };

// 손님별 이용 통계 (예약 목록에서 계산)
function custStats(cid) {
  const bs = BOOKINGS.filter(b => b.customer_id === cid);
  const done = bs.filter(b => DONE_ST.includes(b.status));
  const paid = done.reduce((t, b) => t + (+b.paid_amount || 0), 0);
  const cnt = {}; done.forEach(b => { cnt[b.shop_id] = (cnt[b.shop_id] || 0) + 1; });
  const fav = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
  const lastVisit = done.map(b => b.visit_date).filter(Boolean).sort().pop() || null;
  return { bs, all: bs.length, done: done.length, cancel: bs.filter(b => ["cancelled", "noshow"].includes(b.status)).length,
    noshow: bs.filter(b => b.status === "noshow").length, paid, fav: fav ? fav[0] : null, favN: fav ? fav[1] : 0, lastVisit,
    coupons: COUPONS.filter(k => k.customer_id === cid && k.status === "issued").length };
}
const SEGS = [
  ["all", "전체", () => true],
  ["repeat", "🔁 재방문 (2회+)", (c, s) => s.done >= 2],
  ["once", "1️⃣ 한 번 방문", (c, s) => s.done === 1],
  ["never", "⏳ 아직 방문 전", (c, s) => s.done === 0],
  ["ok", "✅ 안내 동의", c => c.marketing_ok],
  ["sleep", "💤 90일 넘게 안 옴", (c, s) => s.lastVisit && daysAgo(s.lastVisit) > 90],
  ["coupon", "🎟 쿠폰 보유", (c, s) => s.coupons > 0],
  ["new", "🆕 이번 달 처음", c => (c.first_at || "").slice(0, 7) === vnToday().slice(0, 7)]];

async function drawCrm() {
  const el = $("tab-crm");
  if (CRM_READY === null) { el.innerHTML = `<p class="hint" style="padding:20px">불러오는 중…</p>`; await loadCrm(); }
  if (!CRM_READY) {
    el.innerHTML = `<div class="box" style="margin-top:16px"><h3>👥 고객 관리 준비가 필요해요</h3><p class="hint">사장님이 Supabase SQL Editor에서 <a href="https://raw.githubusercontent.com/wootaengboy-hue/uncleday/main/supabase/crm.sql" target="_blank">crm.sql</a>을 한 번 실행해 주세요. 실행하면 지금까지의 예약이 손님별로 자동으로 묶여요.</p></div>`;
    return;
  }
  const rows = CUSTOMERS.map(c => ({ c, s: custStats(c.id) }));
  const segFn = (SEGS.find(x => x[0] === crmSeg) || SEGS[0])[2];
  const q = crmQ.trim().toLowerCase();
  const list = rows.filter(({ c, s }) => segFn(c, s) && (!crmTag || (c.tags || []).includes(crmTag))
    && (!q || [c.name, c.contact, (c.tags || []).join(" "), c.memo].join(" ").toLowerCase().includes(q)));
  const tagsAll = [...new Set(CUSTOMERS.flatMap(c => c.tags || []))].sort();
  const sum = k => rows.filter(({ c, s }) => SEGS.find(x => x[0] === k)[2](c, s)).length;
  const totalPaid = rows.reduce((t, r) => t + r.s.paid, 0), repeat = sum("repeat"), visited = rows.filter(r => r.s.done > 0).length;
  el.innerHTML = `
    <div class="kpis" style="margin-top:14px">
      <div class="kpi"><small>손님</small><b>${CUSTOMERS.length.toLocaleString()}명</b><span class="hint">이번 달 처음 ${sum("new")}명</span></div>
      <div class="kpi"><small>재방문율</small><b>${visited ? Math.round(repeat / visited * 100) : 0}%</b><span class="hint">방문 손님 ${visited}명 중 ${repeat}명</span></div>
      <div class="kpi"><small>안내 동의</small><b>${sum("ok")}명</b><span class="hint">쿠폰·이벤트를 보낼 수 있는 손님</span></div>
      <div class="kpi"><small>손님 결제 합계</small><b>${vnd(totalPaid)}</b><span class="hint">1인 평균 ${visited ? vnd(totalPaid / visited) : "-"}</span></div>
    </div>
    <div class="crm-bar">
      <div class="crm-segs">${SEGS.map(([k, n]) => `<button class="chip ${crmSeg === k ? "on" : ""}" data-seg="${k}">${n} <small>${sum(k)}</small></button>`).join("")}</div>
      <div class="crm-filters"><input id="crmQ" placeholder="🔎 이름·연락처·태그·메모 검색" value="${esc(crmQ)}">
        <select id="crmTag"><option value="">태그 전체</option>${tagsAll.map(t => `<option ${t === crmTag ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>
        <button class="btn" id="crmCoupons">🎟 쿠폰 목록 (${COUPONS.filter(k => k.status === "issued").length})</button></div>
    </div>
    <div class="crm-bulk" ${crmSel.size ? "" : "hidden"}><b>${crmSel.size}명 선택</b>
      <button class="btn main sm" id="crmBulkCoupon">🎟 쿠폰 한꺼번에 발급</button><button class="btn sm" id="crmBulkMsg">💬 메시지 만들기</button><button class="btn sm" id="crmBulkClear">선택 풀기</button>
      <span class="hint">동의하지 않은 손님은 자동으로 빠져요</span></div>
    <div class="tscroll"><table class="t crm-tbl"><thead><tr><th class="ck"><input type="checkbox" id="crmAll"></th><th>손님</th><th>연락처</th><th class="num">예약 · 방문</th><th class="num">결제 합계</th><th>마지막 방문</th><th>자주 간 업체</th><th class="c" title="마케팅 수신 동의 · 🎟 쓸 수 있는 쿠폰">안내 동의</th></tr></thead>
    <tbody>${list.slice(0, 500).map(({ c, s }) => `<tr data-cid="${c.id}">
      <td class="ck"><input type="checkbox" data-sel="${c.id}" ${crmSel.has(c.id) ? "checked" : ""}></td>
      <td><b>${esc(c.name || "(이름 없음)")}</b> <small class="hint">${LANG_KO[c.lang] || ""}</small>${(c.tags || []).length ? `<div class="crm-tags">${c.tags.map(t => `<span class="ctag">${esc(t)}</span>`).join("")}</div>` : ""}</td>
      <td class="hint nw">${esc(maskContact(c.contact))}</td>
      <td class="num">${s.all}건 · <b>${s.done}회</b>${s.cancel ? `<br><small class="hint">취소·노쇼 ${s.cancel}</small>` : ""}</td>
      <td class="num">${s.paid ? vnd(s.paid) : `<span class="hint">-</span>`}</td>
      <td>${s.lastVisit ? `${s.lastVisit.slice(5).replace("-", "/")} <small class="hint">${daysAgo(s.lastVisit)}일 전</small>` : `<small class="hint">-</small>`}</td>
      <td>${s.fav ? `${esc((shopById(s.fav) || {}).name ? shopById(s.fav).name.ko : s.fav)} <small class="hint">${s.favN}회</small>` : `<span class="hint">-</span>`}</td>
      <td class="c">${c.marketing_ok ? "✅" : `<span class="hint">—</span>`}${s.coupons ? ` 🎟${s.coupons}` : ""}</td></tr>`).join("")
      || `<tr><td colspan="8" class="hint" style="padding:24px;text-align:center">${CUSTOMERS.length ? "조건에 맞는 손님이 없어요" : "아직 손님이 없어요. 예약이 들어오면 연락처별로 자동으로 생겨요."}</td></tr>`}</tbody></table></div>
    ${list.length > 500 ? `<p class="hint">앞의 500명만 보여요. 검색이나 조건으로 좁혀 주세요.</p>` : ""}
    <p class="hint" style="margin-top:10px">💡 같은 <b>연락처</b>로 들어온 예약은 한 손님으로 자동으로 묶여요 (010-1234-5678 = +82 10 1234 5678, 카톡 ID는 대소문자·띄어쓰기 무시). 연락처가 없는 예약은 묶이지 않아요.</p>`;
  el.querySelectorAll("[data-seg]").forEach(b => b.onclick = () => { crmSeg = b.dataset.seg; drawCrm(); });
  const qi = $("crmQ"); qi.oninput = () => { crmQ = qi.value; clearTimeout(qi._t); qi._t = setTimeout(() => { drawCrm(); const n = $("crmQ"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
  $("crmTag").onchange = e => { crmTag = e.target.value; drawCrm(); };
  $("crmCoupons").onclick = openCouponList;
  el.querySelectorAll("tr[data-cid]").forEach(tr => tr.onclick = e => { if (e.target.closest("input")) return; openCustomer(tr.dataset.cid); });
  el.querySelectorAll("[data-sel]").forEach(x => x.onchange = () => { x.checked ? crmSel.add(x.dataset.sel) : crmSel.delete(x.dataset.sel); drawCrm(); });
  $("crmAll").onchange = e => { list.slice(0, 500).forEach(({ c }) => e.target.checked ? crmSel.add(c.id) : crmSel.delete(c.id)); drawCrm(); };
  if ($("crmBulkClear")) {
    $("crmBulkClear").onclick = () => { crmSel.clear(); drawCrm(); };
    $("crmBulkCoupon").onclick = () => issueCoupon([...crmSel]);
    $("crmBulkMsg").onclick = () => composeMsg([...crmSel]);
  }
}

/* ----- 손님 카드 ----- */
async function openCustomer(cid) {
  const c = CUSTOMERS.find(x => x.id === cid); if (!c) return;
  const s = custStats(cid);
  const logs = await sb.from("customer_logs").select("*").eq("customer_id", cid).order("at", { ascending: false }).limit(300);
  const cps = COUPONS.filter(k => k.customer_id === cid);
  const ST = { requested: "접수", confirmed: "확정", rejected: "불가", visited: "방문 완료", settled: "정산 완료", cancelled: "취소", noshow: "노쇼" };
  const tl = [
    ...s.bs.map(b => ({ at: b.created_at, html: `<span class="tl-ic">📅</span><div><b>${esc(b.shop_name || "")}</b> · ${esc(b.menu_name || "")} · ${b.people}명 <span class="st st-${b.status}">${ST[b.status] || b.status}</span><br><small class="hint">${b.visit_date || ""} ${b.visit_time || ""} · <a href="#" data-bk="${b.id}">${esc(b.code)}</a>${b.paid_amount ? ` · 결제 ${vnd(b.paid_amount)}` : ""}${b.coupon_code ? ` · 🎟 ${esc(b.coupon_code)}` : ""}</small></div>` })),
    ...(logs.data || []).map(l => ({ at: l.at, html: `<span class="tl-ic">${{ note: "📝", message: "💬", coupon: "🎟", consent: "✅", edit: "✏️" }[l.kind] || "•"}</span><div>${esc(l.body || "").replace(/\n/g, "<br>")}<br><small class="hint">${dt(l.at)} · ${esc(typeof who === "function" ? who(String(l.actor || "").replace(/^관리자 /, "")) : l.actor || "")}</small></div>` }))
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const d = document.createElement("div"); d.className = "overlay center";
  d.innerHTML = `<div class="modal" style="width:min(980px,calc(100% - 32px))">
    <div class="crm-head"><div><h2 style="margin:0">👤 <input id="cuName" class="cu-name" value="${esc(c.name || "")}" placeholder="이름"></h2>
      <div class="hint">${esc(c.contact || "")} · ${LANG_KO[c.lang] || c.lang || ""} · 처음 ${dt(c.first_at)} · 최근 ${dt(c.last_at)}</div></div>
      <div class="btn-row" style="margin:0"><button class="btn main" id="cuMsg">💬 메시지</button><button class="btn" id="cuCoupon">🎟 쿠폰 발급</button></div></div>
    <div class="kpis crm-kpis">
      <div class="kpi"><small>예약</small><b>${s.all}건</b></div><div class="kpi"><small>방문</small><b>${s.done}회</b></div>
      <div class="kpi"><small>결제 합계</small><b>${s.paid ? vnd(s.paid) : "-"}</b></div><div class="kpi"><small>취소·노쇼</small><b>${s.cancel}건</b></div>
      <div class="kpi"><small>자주 간 업체</small><b style="font-size:15px">${s.fav ? esc(shopById(s.fav) ? shopById(s.fav).name.ko : s.fav) : "-"}</b></div></div>
    <div class="crm-cols">
      <div>
        <div class="box"><h3>🏷️ 태그</h3><div class="crm-tagpick">${[...new Set([...CRM_TAGS, ...(c.tags || [])])].map(t => `<button class="chip ${(c.tags || []).includes(t) ? "on" : ""}" data-tag="${esc(t)}">${esc(t)}</button>`).join("")}</div>
          <input id="cuNewTag" placeholder="+ 새 태그 입력 후 Enter" class="at-in" style="width:100%"></div>
        <div class="box"><h3>📝 메모 <small class="hint">손님 취향·주의할 점 (팀만 봐요)</small></h3><textarea id="cuMemo" rows="4" style="width:100%;box-sizing:border-box">${esc(c.memo || "")}</textarea></div>
        <div class="box"><h3>📣 쿠폰·이벤트 안내</h3>
          <label class="sl-ck"><input type="checkbox" id="cuOk" ${c.marketing_ok ? "checked" : ""}><span><b>안내 받기에 동의함</b><small>${c.marketing_ok ? `${dt(c.marketing_at)} · ${esc(c.marketing_src || "")}` : "동의한 손님에게만 쿠폰·이벤트 메시지를 보낼 수 있어요"}</small></span></label></div>
        <div class="box"><h3>🎟 쿠폰 <small class="hint">${cps.length}장</small></h3>${cps.length ? cps.map(k => couponRow(k)).join("") : `<p class="hint">아직 없어요</p>`}</div>
      </div>
      <div class="box"><h3>🕓 이용·연락 기록</h3>
        <div style="display:flex;gap:6px;margin-bottom:10px"><input id="cuNote" placeholder="기록 남기기 (예: 카톡으로 재방문 문의함)" style="flex:1;padding:8px 10px;border:1px solid var(--line);border-radius:9px"><button class="btn sm" id="cuNoteAdd">기록</button></div>
        <div class="crm-tl">${tl.map(x => `<div class="tl-row">${x.html}</div>`).join("") || `<p class="hint">기록이 없어요</p>`}</div></div>
    </div>
    <div class="btns"><button class="btn" data-no>닫기</button><button class="btn main" id="cuSave">저장</button></div></div>`;
  document.body.appendChild(d);
  let tags = [...(c.tags || [])];
  const drawTags = () => d.querySelectorAll("[data-tag]").forEach(b => b.classList.toggle("on", tags.includes(b.dataset.tag)));
  d.querySelectorAll("[data-tag]").forEach(b => b.onclick = () => { const t = b.dataset.tag; tags = tags.includes(t) ? tags.filter(x => x !== t) : [...tags, t]; drawTags(); });
  d.querySelector("#cuNewTag").onkeydown = e => { if (e.key !== "Enter" || e.isComposing) return; e.preventDefault(); const t = e.target.value.trim().slice(0, 20); if (!t) return;
    if (!tags.includes(t)) tags.push(t); e.target.value = ""; const box = d.querySelector(".crm-tagpick"); if (!box.querySelector(`[data-tag="${CSS.escape(t)}"]`)) { const b = document.createElement("button"); b.className = "chip on"; b.dataset.tag = t; b.textContent = t; b.onclick = () => { tags = tags.includes(t) ? tags.filter(x => x !== t) : [...tags, t]; drawTags(); }; box.appendChild(b); } drawTags(); };
  d.querySelectorAll("[data-bk]").forEach(a => a.onclick = e => { e.preventDefault(); d.remove(); showTab("bk"); openBooking(a.dataset.bk); });
  d.querySelectorAll("[data-cp-use]").forEach(b => b.onclick = () => useCoupon(b.dataset.cpUse, () => { d.remove(); openCustomer(cid); }));
  d.querySelectorAll("[data-cp-void]").forEach(b => b.onclick = () => voidCoupon(b.dataset.cpVoid, () => { d.remove(); openCustomer(cid); }));
  d.querySelector("[data-no]").onclick = () => d.remove();
  d.querySelector("#cuMsg").onclick = () => composeMsg([cid]);
  d.querySelector("#cuCoupon").onclick = () => issueCoupon([cid], () => { d.remove(); openCustomer(cid); });
  d.querySelector("#cuNoteAdd").onclick = async () => {
    const v = d.querySelector("#cuNote").value.trim(); if (!v) return;
    const r = await sb.from("customer_logs").insert({ customer_id: cid, kind: "note", body: v }); if (r.error) return dbErr(r.error);
    d.remove(); openCustomer(cid);
  };
  d.querySelector("#cuOk").onchange = e => {
    if (!e.target.checked) return;
    const src = prompt("손님이 어디서 동의했나요? (예: 카톡 상담에서 '쿠폰 안내 받을게요'라고 함)");
    if (!src || !src.trim()) { e.target.checked = false; toast("동의 받은 곳을 적어야 켤 수 있어요"); return; }
    e.target.dataset.src = src.trim();
  };
  d.querySelector("#cuSave").onclick = async () => {
    const ok = d.querySelector("#cuOk"), upd = { name: d.querySelector("#cuName").value.trim() || null, tags, memo: d.querySelector("#cuMemo").value.trim() || null, updated_at: new Date().toISOString() };
    const logsAdd = [];
    if (ok.checked !== !!c.marketing_ok) {
      upd.marketing_ok = ok.checked;
      if (ok.checked) { upd.marketing_at = new Date().toISOString(); upd.marketing_src = ok.dataset.src || "관리자 입력"; logsAdd.push({ customer_id: cid, kind: "consent", body: `안내 받기 동의 기록: ${upd.marketing_src}` }); }
      else logsAdd.push({ customer_id: cid, kind: "consent", body: "안내 받기 동의 철회 (더 이상 쿠폰·이벤트를 보내지 않아요)" });
    }
    const r = await sb.from("customers").update(upd).eq("id", cid); if (r.error) return dbErr(r.error);
    if (logsAdd.length) await sb.from("customer_logs").insert(logsAdd);
    Object.assign(c, upd); d.remove(); toast("저장했어요"); if (TAB === "crm") drawCrm();
  };
}

/* ----- 쿠폰 ----- */
const couponState = k => k.status === "used" ? "사용함" : k.status === "void" ? "취소됨" : (k.valid_until && k.valid_until < vnToday() ? "기간 지남" : "사용 가능");
function couponRow(k, withCust) {
  const st = couponState(k), c = withCust && k.customer_id ? CUSTOMERS.find(x => x.id === k.customer_id) : null;
  return `<div class="cp-row ${k.status !== "issued" || st === "기간 지남" ? "dim" : ""}"><code>${esc(k.code)}</code><div><b>${esc(k.title)}</b>${k.benefit ? ` · ${esc(k.benefit)}` : ""}
    <br><small class="hint">${withCust ? (c ? `👤 ${esc(c.name || c.contact)} · ` : "누구나 · ") : ""}${k.shop_id ? "🏪 " + esc(shopById(k.shop_id) ? shopById(k.shop_id).name.ko : k.shop_id) : "모든 업체"}${k.valid_until ? ` · ~${k.valid_until}` : ""} · <b>${st}</b>${k.used_booking ? ` (${esc(k.used_booking)})` : ""}</small></div>
    ${k.status === "issued" ? `<span class="cp-acts"><button class="btn sm" data-cp-use="${k.id}">사용 처리</button><button class="btn sm" data-cp-void="${k.id}">취소</button></span>` : ""}</div>`;
}
const newCode = () => "UD" + [...crypto.getRandomValues(new Uint8Array(6))].map(b => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
function issueCoupon(cids, after) {
  const all = cids.map(id => CUSTOMERS.find(c => c.id === id)).filter(Boolean);
  const ok = all.filter(c => c.marketing_ok), skip = all.length - ok.length;
  const until = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);
  const d = document.createElement("div"); d.className = "overlay center";
  d.innerHTML = `<div class="modal" style="width:min(620px,calc(100% - 32px))"><h2>🎟 쿠폰 발급</h2>
    <p class="hint">${all.length === 1 ? `👤 ${esc(all[0].name || all[0].contact)}` : `${ok.length}명에게 한 장씩`}${skip ? ` · <b style="color:#c0362c">안내 미동의 ${skip}명은 빠져요</b>` : ""}</p>
    ${all.length === 1 && !all[0].marketing_ok ? `<p class="warn">이 손님은 쿠폰·이벤트 안내에 동의하지 않았어요. 손님이 직접 요청했거나 사과·보상용일 때만 발급하세요.</p>` : ""}
    <div style="display:grid;gap:10px;margin-top:10px">
      <label class="f"><span>쿠폰 이름 <em>*</em></span><input id="cpTitle" value="재방문 감사 쿠폰"></label>
      <label class="f"><span>혜택 <em>*</em> <small class="hint">— 업체와 미리 합의한 혜택만 적어 주세요</small></span><input id="cpBenefit" placeholder="예: 10% 할인 / 발마사지 10분 추가 / 음료 서비스"></label>
      <div class="two"><label class="f"><span>사용 기한</span><input type="date" id="cpUntil" value="${until}"></label>
        <label class="f"><span>쓸 수 있는 업체</span><select id="cpShop"><option value="">모든 업체</option>${shops.filter(isPub).map(s => `<option value="${esc(s.id)}">${esc(s.name.ko)}</option>`).join("")}</select></label></div>
      <label class="f"><span>메모 (팀만 봐요)</span><input id="cpMemo" placeholder="예: 11월 재방문 이벤트"></label>
    </div>
    <div class="btns"><button class="btn" data-no>취소</button><button class="btn main" data-yes>${all.length === 1 ? "발급" : ok.length + "장 발급"}</button></div></div>`;
  document.body.appendChild(d);
  d.querySelector("[data-no]").onclick = () => d.remove();
  d.querySelector("[data-yes]").onclick = async () => {
    const title = d.querySelector("#cpTitle").value.trim(), benefit = d.querySelector("#cpBenefit").value.trim();
    if (!title || !benefit) return toast("쿠폰 이름과 혜택을 적어 주세요");
    const targets = all.length === 1 ? all : ok; if (!targets.length) return toast("보낼 수 있는 손님이 없어요 (안내 동의 손님만)");
    const rows = targets.map(c => ({ code: newCode(), title, benefit, customer_id: c.id, valid_until: d.querySelector("#cpUntil").value || null, shop_id: d.querySelector("#cpShop").value || null, memo: d.querySelector("#cpMemo").value.trim() || null }));
    const r = await sb.from("coupons").insert(rows).select(); if (r.error) return dbErr(r.error, "쿠폰 발급");
    await sb.from("customer_logs").insert(r.data.map(k => ({ customer_id: k.customer_id, kind: "coupon", body: `쿠폰 발급: ${k.code} · ${k.title} (${k.benefit})${k.valid_until ? " · ~" + k.valid_until : ""}` })));
    COUPONS = [...r.data, ...COUPONS]; d.remove(); toast(`쿠폰 ${r.data.length}장을 발급했어요. 이제 손님에게 알려 주세요`);
    composeMsg(r.data.map(k => k.customer_id), "coupon", after);
  };
}
function useCoupon(id, after) {
  const k = COUPONS.find(x => x.id === id); if (!k) return;
  const code = prompt(`${k.code} 쿠폰을 사용 처리할게요.\n쓴 예약번호를 적어 주세요 (모르면 비워도 돼요)`, "");
  if (code === null) return;
  sb.from("coupons").update({ status: "used", used_booking: code.trim() || null }).eq("id", id).select().single().then(async r => {
    if (r.error) return dbErr(r.error); Object.assign(k, r.data);
    if (k.customer_id) await sb.from("customer_logs").insert({ customer_id: k.customer_id, kind: "coupon", body: `쿠폰 사용: ${k.code}${code.trim() ? " · " + code.trim() : ""}` });
    toast("사용 처리했어요"); after && after();
  });
}
function voidCoupon(id, after) {
  const k = COUPONS.find(x => x.id === id); if (!k) return;
  confirmBox(`${k.code} 쿠폰을 취소할까요?`, async () => {
    const r = await sb.from("coupons").update({ status: "void" }).eq("id", id).select().single(); if (r.error) return dbErr(r.error); Object.assign(k, r.data);
    if (k.customer_id) await sb.from("customer_logs").insert({ customer_id: k.customer_id, kind: "coupon", body: `쿠폰 취소: ${k.code}` });
    after && after();
  }, "손님이 이 코드를 더 이상 쓸 수 없어요.", "쿠폰 취소", true);
}
function openCouponList() {
  const d = document.createElement("div"); d.className = "overlay center";
  const draw = f => {
    const list = COUPONS.filter(k => !f || couponState(k) === f);
    d.innerHTML = `<div class="modal" style="width:min(820px,calc(100% - 32px))"><h2>🎟 쿠폰 목록</h2>
      <div class="crm-segs" style="margin:8px 0 12px">${["", "사용 가능", "사용함", "기간 지남", "취소됨"].map(s => `<button class="chip ${s === f ? "on" : ""}" data-f="${s}">${s || "전체"} <small>${COUPONS.filter(k => !s || couponState(k) === s).length}</small></button>`).join("")}</div>
      <div style="display:flex;gap:8px;margin-bottom:10px"><input id="cpFind" placeholder="쿠폰 코드로 찾기 (손님이 알려 준 코드)" style="flex:1;padding:8px 10px;border:1px solid var(--line);border-radius:9px;text-transform:uppercase"></div>
      <div id="cpList">${list.map(k => couponRow(k, true)).join("") || `<p class="hint">쿠폰이 없어요</p>`}</div>
      <div class="btns"><button class="btn" data-no>닫기</button></div></div>`;
    d.querySelectorAll("[data-f]").forEach(b => b.onclick = () => draw(b.dataset.f));
    d.querySelector("[data-no]").onclick = () => d.remove();
    d.querySelector("#cpFind").oninput = e => { const v = e.target.value.trim().toUpperCase(); d.querySelector("#cpList").innerHTML = list.filter(k => !v || k.code.includes(v)).map(k => couponRow(k, true)).join("") || `<p class="hint">없는 코드예요</p>`; wire(); };
    const wire = () => { d.querySelectorAll("[data-cp-use]").forEach(b => b.onclick = () => useCoupon(b.dataset.cpUse, () => draw(f))); d.querySelectorAll("[data-cp-void]").forEach(b => b.onclick = () => voidCoupon(b.dataset.cpVoid, () => draw(f))); };
    wire();
  };
  document.body.appendChild(d); draw("사용 가능");
}

/* ----- 메시지 (복사해서 카톡 채널·문자·Zalo로 보내고 기록) ----- */
const MSG_TPL = {
  thanks: { n: "🙏 방문 감사", mk: false, ko: "{이름}님, 엉클데이로 {업체}에 다녀와 주셔서 감사해요! 이용은 어떠셨나요? 불편했던 점이 있으면 편하게 말씀해 주세요 😊", en: "Hi {이름}, thank you for visiting {업체} with Uncle Day! How was it? Let us know anytime if anything could be better 😊", vi: "Chào {이름}, cảm ơn bạn đã ghé {업체} qua Uncle Day! Trải nghiệm thế nào ạ? Có gì chưa ổn cứ nhắn chúng tôi nhé 😊" },
  coupon: { n: "🎟 쿠폰 안내", mk: true, ko: "{이름}님, 엉클데이에서 쿠폰을 드려요 🎁\n\n🎟 {쿠폰이름} — {혜택}\n코드: {코드}\n사용 기한: {기한}\n\n예약하실 때 상담 창이나 예약 요청사항에 코드를 알려 주세요!\n(안내를 원하지 않으시면 '그만'이라고 답해 주세요)", en: "Hi {이름}, here's a coupon from Uncle Day 🎁\n\n🎟 {쿠폰이름} — {혜택}\nCode: {코드}\nValid until: {기한}\n\nJust tell us the code when you book!\n(Reply 'STOP' if you don't want these messages)", vi: "Chào {이름}, Uncle Day gửi bạn một phiếu ưu đãi 🎁\n\n🎟 {쿠폰이름} — {혜택}\nMã: {코드}\nHạn dùng: {기한}\n\nHãy báo mã khi đặt lịch nhé!\n(Trả lời 'DỪNG' nếu bạn không muốn nhận tin)" },
  back: { n: "💌 다시 오세요", mk: true, ko: "{이름}님, 오랜만이에요! 다음 베트남 여행 계획 있으시면 엉클데이가 한국어로 예약 도와드릴게요 😊 www.uncleday.com\n(안내를 원하지 않으시면 '그만'이라고 답해 주세요)", en: "Hi {이름}, it's been a while! Planning another trip to Vietnam? Uncle Day can help you book 😊 www.uncleday.com\n(Reply 'STOP' to opt out)", vi: "Chào {이름}, lâu rồi không gặp! Nếu bạn có kế hoạch đi chơi, Uncle Day luôn sẵn sàng hỗ trợ đặt lịch 😊 www.uncleday.com\n(Trả lời 'DỪNG' để không nhận tin)" },
  free: { n: "✏️ 직접 쓰기", mk: false, ko: "{이름}님, ", en: "Hi {이름}, ", vi: "Chào {이름}, " }
};
function fillMsg(tpl, c, k) {
  const s = custStats(c.id), fav = s.fav && shopById(s.fav) ? (c.lang === "ko" || !c.lang ? shopById(s.fav).name.ko : (shopById(s.fav).name.en || shopById(s.fav).name.ko)) : (c.lang === "en" ? "the shop" : c.lang === "vi" ? "cửa hàng" : "업체");
  return tpl.replace(/\{이름\}/g, c.name || "").replace(/\{업체\}/g, fav).replace(/\{쿠폰이름\}/g, k ? k.title : "").replace(/\{혜택\}/g, k ? k.benefit || "" : "")
    .replace(/\{코드\}/g, k ? k.code : "").replace(/\{기한\}/g, k && k.valid_until ? k.valid_until : "-");
}
function composeMsg(cids, tplKey = "thanks", after) {
  const all = cids.map(id => CUSTOMERS.find(c => c.id === id)).filter(Boolean);
  const d = document.createElement("div"); d.className = "overlay center";
  const draw = key => {
    const T = MSG_TPL[key], list = T.mk ? all.filter(c => c.marketing_ok) : all, out = all.length - list.length;
    const cp = c => COUPONS.filter(k => k.customer_id === c.id && k.status === "issued").sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
    d.innerHTML = `<div class="modal" style="width:min(760px,calc(100% - 32px))"><h2>💬 메시지 만들기</h2>
      <div class="crm-segs" style="margin:8px 0">${Object.entries(MSG_TPL).map(([k, t]) => `<button class="chip ${k === key ? "on" : ""}" data-t="${k}">${t.n}</button>`).join("")}</div>
      <p class="hint">손님 언어(한국어·영어·베트남어)에 맞춰 문구가 바뀌어요. <b>📋 복사</b> → 카톡 채널 관리자센터 1:1 채팅·문자·Zalo에 붙여넣어 보내고 → <b>보냈어요</b>를 누르면 손님 기록에 남아요.
      ${T.mk ? `<br>📣 홍보 메시지라 <b>안내 동의 손님에게만</b> 만들어져요${out ? ` (<b style="color:#c0362c">${out}명 빠짐</b>)` : ""}.` : ""}</p>
      <div class="msg-list">${list.map(c => { const txt = fillMsg(T[c.lang] || T.ko, c, cp(c)); const tel = /^tel:/.test(c.key) ? c.key.slice(4) : "";
        return `<div class="msg-item" data-cid="${c.id}"><div class="msg-top"><b>${esc(c.name || "")}</b> <small class="hint">${esc(c.contact || "")} · ${LANG_KO[c.lang] || ""}</small></div>
        <textarea rows="${Math.min(8, txt.split("\n").length + 1)}">${esc(txt)}</textarea>
        <div class="btn-row" style="margin:6px 0 0"><button class="btn sm" data-copy>📋 복사</button>${tel ? `<a class="btn sm" data-sms href="sms:${tel}">📱 문자</a>` : ""}<a class="btn sm" href="https://center-pf.kakao.com/" target="_blank" rel="noopener">💬 카톡 채널 관리자센터</a><button class="btn sm main" data-sent>보냈어요</button></div></div>`; }).join("") || `<p class="hint">보낼 수 있는 손님이 없어요</p>`}</div>
      <div class="btns"><button class="btn" data-no>닫기</button></div></div>`;
    d.querySelectorAll("[data-t]").forEach(b => b.onclick = () => draw(b.dataset.t));
    d.querySelector("[data-no]").onclick = () => { d.remove(); after && after(); };
    d.querySelectorAll(".msg-item").forEach(it => {
      const ta = it.querySelector("textarea");
      it.querySelector("[data-copy]").onclick = async () => { try { await navigator.clipboard.writeText(ta.value); } catch (e) { ta.select(); document.execCommand("copy"); } toast("복사했어요"); };
      const sms = it.querySelector("[data-sms]"); if (sms) sms.onclick = () => { sms.href = sms.href.split("?")[0] + "?body=" + encodeURIComponent(ta.value); };
      it.querySelector("[data-sent]").onclick = async e => {
        const r = await sb.from("customer_logs").insert({ customer_id: it.dataset.cid, kind: "message", body: `[${T.n.replace(/^\S+\s/, "")}] ${ta.value}` }); if (r.error) return dbErr(r.error);
        e.target.disabled = true; e.target.textContent = "✅ 기록됨"; it.classList.add("sent");
      };
    });
  };
  document.body.appendChild(d); draw(tplKey);
}

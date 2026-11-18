/* 손님 예약확인증 — 주소 뒤의 #열쇠로 예약을 불러와요 */
drawCommon();
const box = $("vbox");
const token = () => decodeURIComponent(location.hash.slice(1));
const tpParam = (() => { try { return new URLSearchParams(location.search).get("tp") || ""; } catch (e) { return ""; } })();
function toastV(t) { const d = document.createElement("div"); d.className = "toast-site"; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2500); }
const fmtDate = (d, t) => {
  if (!d) return "-";
  const x = new Date(d + "T00:00:00");
  const w = ui("days")[x.getDay()];
  return lang === "ko" ? `${x.getFullYear()}년 ${x.getMonth() + 1}월 ${x.getDate()}일 (${w}) ${t || ""}`
    : `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()} (${w}) ${t || ""}`;
};

function findForm(msg) {
  let mine = []; try { mine = JSON.parse(localStorage.getItem("uncleday-my-bookings") || "[]"); } catch (e) {}
  box.innerHTML = `<div class="done voucher">
    <h1>${ui("vFind")}</h1>${msg ? `<p class="pending-box">${msg}</p>` : ""}
    ${tpParam ? `<p class="pending-box">💌 ${ui("tpQrFind")}</p>` : ""}<p>${ui("vFindDesc")}</p>
    <form id="findF" class="form" style="padding:0;box-shadow:none">
      <label>${ui("vFindCode")}<input name="c" required autocomplete="off"></label>
      <label>${ui("vFindContact")}<input name="ct" required></label>
      <button class="btn big-btn" type="submit">${ui("vFindBtn")}</button>
    </form>
    ${mine.length ? `<div class="v-mine">${mine.map(m => `<a class="btn" href="#${esc(m.token)}">${esc(m.code)} · ${esc(m.date || "")}</a>`).join("")}</div>` : ""}
    <p><a href="./">${ui("vHome")}</a></p></div>`;
  $("findF").onsubmit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    try {
      const t = await LIVE.rpc("find_booking", { c: f.c, ct: f.ct });
      if (t) location.hash = t; else toastV(ui("vNotFound"));
    } catch (err) { toastV(/Too many/i.test(err && err.message || "") ? ui("vTooMany") : ui("vNotFound")); }
  };
}

async function load() {
  if (!LIVE.on) { box.innerHTML = `<p class="empty">${ui("vNotFound")}</p>`; return; }
  const t = token();
  if (!t) { findForm(); return; }
  let b = null;
  try { b = await LIVE.rpc("booking_for_customer", { t }); } catch (e) {}
  if (!b) { findForm(ui("vNotFound")); return; }
  draw(b);
  // 로그인한 상태면 이 예약을 내 예약 목록에 연결
  if (typeof ACCT !== "undefined" && ACCT.on) { let done = false; ACCT.onUser(u => { if (u && !done) { done = true; LIVE.rpc("claim_booking", { t }).catch(() => {}); } }); }
}

function draw(b) {
  const t = token();
  const s = b.shop || {};
  const m = (s.menu || []).find(x => x.name && x.name.ko === b.menu_name);
  const menuName = m ? tx(m.name) : b.menu_name;
  const open = ["requested", "shop_ok", "confirmed", "reschedule"].includes(b.status);
  const offers = b.status === "reschedule" ? (b.offer_times || []) : [];
  const past = ["visited", "settled"].includes(b.status);
  const canVisit = !b.customer_visit_at && !["cancelled", "rejected"].includes(b.status);
  // 방문 당일엔 '도착 체크인', 방문 뒤엔 '별점 한 번' (베트남 시간 기준)
  const start = b.visit_date && b.visit_time ? Date.parse(`${b.visit_date}T${b.visit_time}:00+07:00`) : null;
  const end = start ? start + (b.menu_min || 60) * 60000 : null, now = Date.now();
  const checkin = start && b.status === "confirmed" && !b.customer_visit_at && now >= start - 2 * 3600e3 && now < end;
  const inside = start && b.customer_visit_at && now < end;
  const rate = !b.reviewed && (past || (end && now >= end)) && ["confirmed", "visited", "settled", "noshow"].includes(b.status);
  // 담당 테라피스트 (매장 기록) · 고를 수 있는 사람 (기록이 없을 때 그날 출근한 테라피스트)
  const tps = Array.isArray(b.therapists) ? b.therapists : [], tpOpts = tps.length ? tps : (Array.isArray(b.tp_options) ? b.tp_options : []);
  const tpDone = Array.isArray(b.tp_reviewed) ? b.tp_reviewed : [], tpLeft = tpOpts.filter(x => !tpDone.includes(x.id));
  // 💰 결제 확인 페이백: 다녀온 뒤(방문 시간이 지났거나 다녀왔어요를 누른 뒤) 받은 시술 · 결제 금액을 알려 주면 3% 포인트
  const pbCan = !["cancelled", "rejected", "requested", "reschedule"].includes(b.status) && (past || !!b.customer_visit_at || (end && now >= end));
  const tpCan = !!b.tp_window && ["confirmed", "visited", "settled"].includes(b.status) && tpLeft.length > 0 && (past || (end && now >= end));
  document.title = `${ui("vTitle")} ${b.code} | ${tx(SITE.name)}`;
  box.innerHTML = `<div class="done voucher">
    <div class="v-head"><small>${ui("vTitle")}</small><b class="v-code">${esc(b.code)}</b>
      <span class="v-st st-${esc(b.status)}">${ui("st_" + b.status)}</span></div>
    ${checkin ? `<div class="ci-box"><b>📍 ${ui("ciTitle")}</b><p>${ui("ciDesc")}</p><button class="btn big-btn" id="vCheckin">${ui("ciBtn")}</button></div>` : ""}
    ${inside ? `<p class="v-ok">✅ ${ui("ciDone")}</p>` : ""}
    ${rate ? `<div class="rate-box"><b>${ui("rateTitle")}</b><div class="rate-stars">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-rate="${n}" aria-label="${n}">★</button>`).join("")}</div><small>${ui("rateHint")}</small></div>` : ""}
    ${s.img ? `<img class="v-img" src="${esc(s.img)}" alt="" style="object-position:${esc(s.imgPos || "50% 50%")}">` : ""}
    <dl class="v-info">
      <dt>${ui("vShop")}</dt><dd><b>${esc(s.name ? tx(s.name) : b.shop_name)}</b>${s.address ? `<br><small>${esc(tx(s.address))}</small>` : ""}${s.map ? ` <a href="${esc(s.map)}" target="_blank" rel="noopener">${ui("vMap")}</a>` : ""}</dd>
      <dt>${ui("vDate")}</dt><dd>${esc(fmtDate(b.visit_date, b.visit_time))}</dd>
      <dt>${ui("vMenu")}</dt><dd>${esc(menuName)}${b.menu_min ? ` · ${b.menu_min}${ui("min")}` : ""}</dd>
      <dt>${ui("vPeople")}</dt><dd>${ui("vPeopleN", { n: b.people })}</dd>
      <dt>${ui("vPrice")}</dt><dd>${money(b.list_price)}<br><small>${ui("vPriceNote")}</small></dd>
      ${tps.length ? `<dt>${ui("vTp")}</dt><dd><b>${tps.map(x => esc(x.name)).join(", ")}</b>${tps.some(x => x.working) ? ` <small>· ${ui("vTpNow")}</small>` : ""}</dd>` : ""}
      <dt>${ui("vName")}</dt><dd>${esc(b.customer_name)}</dd>
      ${b.note ? `<dt>${ui("vNote")}</dt><dd>${esc(b.note)}</dd>` : ""}
    </dl>
    ${b.status === "reschedule" ? `<div class="res-box"><h3>🔁 ${ui("vResTitle")}</h3><p>${ui("vResDesc")}</p>
      <div class="res-list">${offers.map((o, i) => `<div class="res-opt"><span>${esc(fmtDate(o.date, o.time))}</span><button class="btn" data-pick="${i}">${ui("vResPick")}</button></div>`).join("")}</div>
      <p style="margin:10px 0 0">${ui("vResNone")}</p></div>` : ""}
    ${b.change_count && b.status !== "reschedule" ? `<p class="v-ok" style="background:#fff4e5;color:#9a5208">🔁 ${ui("vChanged", { n: b.change_count })}</p>` : ""}
    ${b.status === "confirmed" ? `<p class="v-show">📱 ${ui("vShow")}</p>` : ""}
    <div class="v-btns">
      ${canVisit && !start && (past || b.status === "confirmed" || b.status === "noshow") ? `<button class="btn big-btn" id="vVisit">${ui("vVisited")}</button>` : ""}
      ${b.customer_visit_at && !inside ? `<p class="v-ok">${ui("vVisitedDone")}</p>` : ""}
      ${!b.reviewed && !rate && (past || (b.customer_visit_at && !inside)) ? `<button class="btn" id="vRv">${ui("vReview")}</button>` : ""}
      ${b.reviewed ? `<p class="v-ok">${ui("vReviewed")}</p>` : ""}
      ${tpDone.length ? `<p class="v-ok">💌 ${ui("tpRvSent")}: ${esc(tpOpts.concat(tps).filter((x, i, a) => tpDone.includes(x.id) && a.findIndex(y => y.id === x.id) === i).map(x => x.name).join(", "))}</p>` : ""}
      <button class="btn" type="button" id="vChat">💬 ${ui("vChat")}</button>
      <a class="btn kakao-link" href="${SITE.kakao}" target="_blank">${ui("vAsk")}</a>
      <button class="btn" id="vLink">${ui("vCopyLink")}</button>
      ${open ? `<button class="btn v-cancel" id="vCancel">${ui("vCancel")}</button>` : ""}
    </div>
    <div id="vRvBox"></div>
    ${pbCan ? `<div class="pb-box" id="pbBox"></div>` : ""}
    ${b.reviewed && tpCan ? `<div class="tp-box" id="tpBox"><b>💌 ${ui("tpRvBoxTitle")}</b><p>${ui("tpRvBoxDesc")}</p>${tpForm(tpLeft)}<button class="btn big-btn" type="button" id="tpSend">${ui("tpRvSend")}</button></div>` : ""}
    <p class="v-save">${ui("vSave")}</p>
  </div>`;
  const act = async (a, pick = null) => { try { draw(await LIVE.rpc("customer_action", pick == null ? { t, action: a } : { t, action: a, pick })); if (a === "pick") toastV(ui("vResDone")); } catch (e) { toastV(e.message); } };
  box.querySelectorAll("[data-pick]").forEach(x => x.onclick = () => {
    const o = offers[+x.dataset.pick]; const d = document.createElement("div"); d.className = "lightbox";
    d.innerHTML = `<div class="done" style="max-width:340px;margin:auto"><h2>${ui("vResAsk")}</h2><p><b>${esc(fmtDate(o.date, o.time))}</b></p><button class="btn big-btn" data-y>${ui("vResPick")}</button> <button class="btn" data-n>${ui("vNo")}</button></div>`;
    d.style.background = "#0009"; d.style.display = "flex"; d.style.alignItems = "center"; d.style.justifyContent = "center";
    document.body.appendChild(d); d.querySelector("[data-n]").onclick = () => d.remove(); d.querySelector("[data-y]").onclick = () => { d.remove(); act("pick", +x.dataset.pick); };
  });
  if ($("vVisit")) $("vVisit").onclick = () => act("visited");
  if ($("vChat")) $("vChat").onclick = () => { if (typeof CHAT !== "undefined" && CHAT) CHAT.open(); };
  if ($("vCheckin")) $("vCheckin").onclick = () => act("visited");
  box.querySelectorAll("[data-rate]").forEach(x => x.onclick = async () => {
    const n = +x.dataset.rate; let nb = b;
    if (!b.customer_visit_at) { try { nb = await LIVE.rpc("customer_action", { t, action: "visited" }); } catch (e) {} }   // 별 한 번 = 방문 확인
    draw({ ...nb, _rate: n }); openRv(n); toastV(ui("rateThanks"));
  });
  $("vLink").onclick = () => { try { navigator.clipboard.writeText(location.href); toastV(ui("vLinkCopied")); } catch (e) {} };
  if ($("vCancel")) $("vCancel").onclick = () => {
    const d = document.createElement("div"); d.className = "lightbox";
    d.innerHTML = `<div class="done" style="max-width:340px;margin:auto"><h2>${ui("vCancelAsk")}</h2><button class="btn v-cancel" data-y>${ui("vYes")}</button> <button class="btn" data-n>${ui("vNo")}</button></div>`;
    d.style.background = "#0009"; d.style.display = "flex"; d.style.alignItems = "center"; d.style.justifyContent = "center";
    document.body.appendChild(d);
    d.querySelector("[data-n]").onclick = () => d.remove();
    d.querySelector("[data-y]").onclick = () => { d.remove(); act("cancel"); };
  };
  if ($("vRv")) $("vRv").onclick = () => openRv(0);
  if (pbCan) pbInit(b, t);
  function tpForm(list) {
    return `<div class="tp-pick"><span>${ui("tpRvWho")}</span><div class="tp-chips">${list.map(x => `<button type="button" class="tp-chip ${x.id === tpParam ? "on" : ""}" data-tpid="${esc(x.id)}" aria-pressed="${x.id === tpParam}">${esc(x.name)}</button>`).join("")}</div>
      <div class="tp-stars" ${b.reviewed ? "" : "hidden"}>${[1, 2, 3, 4, 5].map(n => `<button type="button" data-ts="${n}">★</button>`).join("")}</div>
      <label>${ui("tpRvNote")}<input name="tpnote" maxlength="200" placeholder="${esc(ui("tpRvPh"))}"></label></div>`;
  }
  const tpPicked = root => [...root.querySelectorAll(".tp-chip.on")].map(x => x.dataset.tpid);
  function bindTp(root) {
    root.querySelectorAll(".tp-chip").forEach(x => x.onclick = () => { x.classList.toggle("on"); x.setAttribute("aria-pressed", x.classList.contains("on")); });
    let ts = 5; const paintT = () => root.querySelectorAll("[data-ts]").forEach(y => y.classList.toggle("on", +y.dataset.ts <= ts)); paintT();
    root.querySelectorAll("[data-ts]").forEach(x => x.onclick = () => { ts = +x.dataset.ts; paintT(); });
    return () => ts;
  }
  async function sendTp(root, stars, name) {
    const ids = tpPicked(root); if (!ids.length) return null;
    const note = (root.querySelector('[name="tpnote"]') || {}).value || "";
    try { const nb = await LIVE.rpc("staff_review_submit", { p: { token: t, staff: ids, stars, text: note, name } }); toastV(ui("tpRvDone")); return nb; }
    catch (e) { return null; }
  }
  if ($("tpBox")) { const box2 = $("tpBox"), getTs = bindTp(box2);
    $("tpSend").onclick = async () => { if (!tpPicked(box2).length) { toastV(ui("tpRvNeed")); return; } const nb = await sendTp(box2, getTs(), b.customer_name); if (nb) draw(nb); }; }
  function openRv(preset) {
    if ($("vRv")) $("vRv").hidden = true;
    box.querySelectorAll(".rate-box").forEach(x => x.hidden = true);
    let st = preset || 0;
    $("vRvBox").innerHTML = `<form id="rvForm" class="form">
      <div class="f-stars"><span>${ui("rvStars")}</span><div id="rvStarBtns">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-s="${n}">★</button>`).join("")}</div></div>
      <label>${ui("rvName")}<input name="name" required maxlength="20" value="${esc(b.customer_name || "")}"></label>
      <label>${ui("rvText")}<textarea name="text" rows="4" required minlength="10" maxlength="1000" placeholder="${ui("rvTextPh")}"></textarea></label>
      ${tpCan ? `<div class="tp-box in"><b>💌 ${ui("tpRvTitle")}</b>${tpForm(tpLeft)}</div>` : ""}
      <button class="btn big-btn" type="submit">${ui("rvSend")}</button><small>${ui("rvNotice")}</small></form>`;
    const f = $("rvForm");
    const paint = () => f.querySelectorAll("[data-s]").forEach(y => y.classList.toggle("on", +y.dataset.s <= st)); paint();
    f.querySelectorAll("[data-s]").forEach(x => x.onclick = () => { st = +x.dataset.s; paint(); });
    const tpIn = f.querySelector(".tp-box"); if (tpIn) bindTp(tpIn);
    f.scrollIntoView({ behavior: "smooth" });
    f.onsubmit = async e => {
      e.preventDefault();
      if (!st) { toastV(ui("rvNeedStar")); return; }
      const v = Object.fromEntries(new FormData(f));
      try {
        await LIVE.rpc("submit_review", { p: { token: t, stars: st, name: v.name, text: v.text, menu: menuName, month: (b.visit_date || "").slice(0, 7), lang } });
        if (tpIn) await sendTp(tpIn, st, v.name);
        draw(await LIVE.rpc("booking_for_customer", { t }));
        // ⭐ 구글에도 남기기 (별점과 상관없이 모든 손님에게)
        if (typeof grvPlace === "function") grvPlace(b.shop_id).then(gp => { const at = document.querySelector(".v-ok") || $("vRvBox"); if (!gp || !at) return;
          at.insertAdjacentHTML("afterend", grvHtml(lang)); const box = at.nextElementSibling; grvBind(box, { gplace: gp, text: v.text, shopId: b.shop_id, lg: lang }); box.scrollIntoView({ behavior: "smooth", block: "center" }); });
      } catch (err) { toastV(err.message); }
    };
  }
}
addEventListener("hashchange", load);
load();

/* ===== 💰 결제 확인 페이백 (샵백처럼) =====
   손님이 받은 시술 · 결제 금액 · 영수증(선택)을 알려 주면 결제 금액의 3%를 포인트로 쌓아요 (로그인 필요).
   업체가 적은 금액과 같으면 바로 확정, 다르면 엉클데이가 확인한 뒤 확정해요. 서버 함수: supabase/universe31.sql */
const PB_T = {
  ko: { title: "💰 결제 금액 알려 주고 {p}% 포인트 받기", desc: "가게에서 실제로 받은 시술과 결제한 금액을 알려 주세요. 결제 금액의 {p}%를 엉클데이 포인트로 쌓아 드려요 (1P = 1동).",
    why: "상담 후 메뉴를 바꾸거나 추가했어도 그대로 적어 주세요. 엉클데이가 가게와 정확히 정산하는 데 쓰여요.", login: "로그인하고 포인트 받기", loginHint: "포인트는 계정에 쌓여요. 카카오 · 구글로 10초면 돼요.",
    amt: "결제한 금액 (동)", amtPh: "예: 1,500,000", items: "받은 시술", itemsPh: "예: 아쿠아필 + 재생관리 업그레이드", rc: "영수증 사진 (선택)", rcHint: "영수증이 있으면 더 빨리 확정돼요",
    est: "예상 포인트", send: "알려 주기", edit: "고치기", sending: "보내는 중…", done: "알려 주셔서 고마워요 🙏",
    st_wait: "⏳ 가게가 결제 금액을 적으면 확인해서 바로 쌓아 드려요", st_review: "🔎 엉클데이가 가게와 금액을 확인하고 있어요", st_ok: "✅ 포인트가 쌓였어요", st_no: "확인이 어려워 포인트를 드리지 못했어요",
    you: "알려 준 금액", total: "내 포인트", waiting: "확인 중 {n}건", other: "이 예약은 다른 계정으로 이미 알려 주셨어요.", soon: "포인트 쓰는 방법은 곧 안내해 드릴게요.", rcSaved: "영수증 있음", needAmt: "결제 금액을 적어 주세요", upFail: "영수증을 올리지 못했어요. 금액만 먼저 보낼게요." },
  en: { title: "💰 Tell us what you paid — get {p}% back in points", desc: "Tell us the treatments you actually received and the amount you paid. We'll add {p}% of it as Uncle Day points (1P = 1 VND).",
    why: "If you changed or added treatments after the consultation, please include them. It helps us settle accurately with the shop.", login: "Log in to get points", loginHint: "Points are saved to your account. Takes 10 seconds with Kakao or Google.",
    amt: "Amount paid (VND)", amtPh: "e.g. 1,500,000", items: "Treatments received", itemsPh: "e.g. Aqua peel + recovery upgrade", rc: "Receipt photo (optional)", rcHint: "A receipt helps us confirm faster",
    est: "Estimated points", send: "Send", edit: "Edit", sending: "Sending…", done: "Thank you for letting us know 🙏",
    st_wait: "⏳ We'll confirm as soon as the shop records the amount", st_review: "🔎 We're checking the amount with the shop", st_ok: "✅ Points added", st_no: "We couldn't confirm this one",
    you: "Amount you reported", total: "My points", waiting: "{n} being checked", other: "This booking was already reported from another account.", soon: "We'll let you know soon how to use your points.", rcSaved: "Receipt attached", needAmt: "Please enter the amount you paid", upFail: "Couldn't upload the receipt. Sending the amount first." },
  vi: { title: "💰 Báo số tiền đã trả — nhận lại {p}% điểm", desc: "Hãy cho chúng tôi biết dịch vụ bạn đã làm và số tiền đã trả. Uncle Day tặng {p}% số tiền đó thành điểm (1P = 1 đồng).",
    why: "Nếu bạn đổi hoặc thêm dịch vụ sau khi tư vấn, hãy ghi đầy đủ. Thông tin này giúp Uncle Day đối soát chính xác với cửa hàng.", login: "Đăng nhập để nhận điểm", loginHint: "Điểm được lưu vào tài khoản. Chỉ 10 giây với Kakao hoặc Google.",
    amt: "Số tiền đã trả (đồng)", amtPh: "VD: 1.500.000", items: "Dịch vụ đã làm", itemsPh: "VD: Aqua peel + nâng cấp phục hồi", rc: "Ảnh hóa đơn (không bắt buộc)", rcHint: "Có hóa đơn sẽ được xác nhận nhanh hơn",
    est: "Điểm dự kiến", send: "Gửi", edit: "Sửa", sending: "Đang gửi…", done: "Cảm ơn bạn đã cho biết 🙏",
    st_wait: "⏳ Khi cửa hàng nhập số tiền, chúng tôi sẽ xác nhận ngay", st_review: "🔎 Uncle Day đang kiểm tra số tiền với cửa hàng", st_ok: "✅ Đã cộng điểm", st_no: "Chưa thể xác nhận nên không cộng điểm",
    you: "Số tiền bạn báo", total: "Điểm của tôi", waiting: "{n} đang kiểm tra", other: "Lịch hẹn này đã được báo từ tài khoản khác.", soon: "Cách dùng điểm sẽ được thông báo sớm.", rcSaved: "Đã có hóa đơn", needAmt: "Hãy nhập số tiền đã trả", upFail: "Không tải được hóa đơn. Gửi số tiền trước." } };
function pbT(k, v) { const L = ["ko", "en", "vi"].includes(lang) ? lang : "ko"; let x = PB_T[L][k] || PB_T.ko[k] || k; if (v) Object.keys(v).forEach(n => x = x.replace("{" + n + "}", v[n])); return x; }
const pbNum = v => +(String(v || "").replace(/[^0-9]/g, "")) || 0;
const pbFmt = n => Math.round(+n || 0).toLocaleString("en-US");
let PB_EDIT = false;
async function pbInit(b, t) {
  const box = document.getElementById("pbBox"); if (!box) return;
  const on = typeof ACCT !== "undefined" && ACCT.on;
  PB_CTX = { b, t };
  await pbShow();
  if (on && !PB_SUB) { PB_SUB = true; let last = ACCT.user() ? ACCT.user().id : null; ACCT.onUser(u => { const id = u ? u.id : null; if (id !== last) { last = id; pbShow(); } }); ACCT.load().catch(() => {}); }
}
let PB_CTX = null, PB_SUB = false;
async function pbShow() {
  const box = document.getElementById("pbBox"); if (!box || !PB_CTX) return;
  let d = null; try { d = await LIVE.rpc("payback_get", { t: PB_CTX.t }); } catch (e) {}
  pbRender(box, PB_CTX.b, PB_CTX.t, d);
}
function pbRender(box, b, t, d) {
  const rate = d && d.rate ? Math.round(d.rate * 100) : 3, user = typeof ACCT !== "undefined" && ACCT.on ? ACCT.user() : null;
  const head = `<b class="pb-t">${pbT("title", { p: rate })}</b>`;
  const totalLine = d && d.total != null ? `<p class="pb-tot">${pbT("total")} <b>${pbFmt(d.total)}P</b>${d.waiting ? ` · ${pbT("waiting", { n: d.waiting })}` : ""}</p>` : "";
  if (d && d.other) { box.innerHTML = `${head}<p class="pb-d">${pbT("other")}</p>`; return; }
  if (d && d.mine && !PB_EDIT) {
    const st = d.status, can = st === "wait" || st === "review";
    box.innerHTML = `${head}<div class="pb-st st-${st}"><b>${pbT("st_" + st)}</b>
      <span>${pbT("you")}: <b>${pbFmt(d.amount)}₫</b>${d.items ? ` · ${esc(d.items)}` : ""}${d.receipt ? ` · 🧾 ${pbT("rcSaved")}` : ""}</span>
      ${st === "ok" ? `<span class="pb-pts">+${pbFmt(d.points)}P</span>` : can ? `<span>${pbT("est")}: <b>+${pbFmt(Math.floor(d.amount * (d.rate || 0.03)))}P</b></span>` : ""}
      ${d.note ? `<small>💬 ${esc(d.note)}</small>` : ""}</div>${totalLine}<p class="pb-hint">${pbT("soon")}</p>
      ${can ? `<button class="btn" type="button" id="pbEdit">${pbT("edit")}</button>` : ""}`;
    const e = document.getElementById("pbEdit"); if (e) e.onclick = () => { PB_EDIT = true; pbRender(box, b, t, d); };
    return;
  }
  if (!user) {
    box.innerHTML = `${head}<p class="pb-d">${pbT("desc", { p: rate })}</p><p class="pb-hint">${pbT("why")}</p>
      <button class="btn big-btn" type="button" id="pbLogin">${pbT("login")}</button><p class="pb-hint">${pbT("loginHint")}</p>`;
    document.getElementById("pbLogin").onclick = () => ACCT.openLogin();
    return;
  }
  const pre = d && d.mine ? d : {};
  box.innerHTML = `${head}<p class="pb-d">${pbT("desc", { p: rate })}</p><p class="pb-hint">${pbT("why")}</p>
    <form class="form pb-form" id="pbForm">
      <label>${pbT("amt")}<input name="amt" inputmode="numeric" autocomplete="off" required placeholder="${esc(pbT("amtPh"))}" value="${pre.amount ? pbFmt(pre.amount) : ""}"></label>
      <label>${pbT("items")}<input name="items" maxlength="300" placeholder="${esc(pbT("itemsPh"))}" value="${esc(pre.items || "")}"></label>
      <label>${pbT("rc")}<input name="rc" type="file" accept="image/*"><small>${pbT("rcHint")}</small></label>
      <p class="pb-est">${pbT("est")}: <b id="pbEst">+0P</b></p>
      <button class="btn big-btn" type="submit">${pbT("send")}</button></form>${totalLine}`;
  const f = document.getElementById("pbForm"), est = document.getElementById("pbEst");
  const upd = () => { const n = pbNum(f.amt.value); est.textContent = "+" + pbFmt(Math.floor(n * rate / 100)) + "P"; };
  f.amt.oninput = () => { const n = pbNum(f.amt.value); f.amt.value = n ? pbFmt(n) : ""; upd(); }; upd();
  f.onsubmit = async e => {
    e.preventDefault();
    const amt = pbNum(f.amt.value); if (amt < 1000) { toastV(pbT("needAmt")); return; }
    const btn = f.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = pbT("sending");
    let path = null; const file = f.rc.files && f.rc.files[0];
    if (file) { try { path = await pbUpload(file, b); } catch (err) { toastV(pbT("upFail")); } }
    try { const nd = await LIVE.rpc("payback_submit", { t, amt, items: f.items.value || null, receipt: path }); PB_EDIT = false; toastV(pbT("done")); pbRender(box, b, t, nd); }
    catch (err) { toastV(err.message); btn.disabled = false; btn.textContent = pbT("send"); }
  };
}
// 영수증 사진: 긴 변 1600px JPEG 로 줄여서 비공개 보관함(receipts/내 사용자 번호/)에 올려요
async function pbUpload(file, b) {
  const sb = await ACCT.load(), u = ACCT.user(); if (!sb || !u) throw new Error("login");
  let blob = file;
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(file); });
    const k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    blob = await new Promise(ok => c.toBlob(ok, "image/jpeg", 0.82)) || file;
  } catch (e) {}
  const path = `${u.id}/${(b.code || "bk").replace(/[^A-Za-z0-9-]/g, "")}-${Date.now()}.jpg`;
  const r = await sb.storage.from("receipts").upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (r.error) throw r.error;
  return path;
}


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
  // 📋 시술 전 질문: 확정된 예약 · 방문일 전까지 · 가게가 켜 둔 경우 (universe37)
  const vnToday = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
  const svCan = typeof surveyQs === "function" && ["confirmed", "shop_ok", "reschedule"].includes(b.status) && (b.visit_date || "") >= vnToday && surveyQs(s).length > 0;
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
      ${b.promo ? `<dt>${ui("pm_applied")}</dt><dd>🎁 ${esc([pmName(b.promo), pmOff(b.promo)].filter(Boolean).join(" · "))}${b.promo.orig && b.promo.price < b.promo.orig ? `<br><small><s>₫${Number(b.promo.orig).toLocaleString("en-US")}</s> → ₫${Number(b.promo.price).toLocaleString("en-US")} · ${ui("pm_note")}</small>` : ""}</dd>` : ""}
      ${tps.length ? `<dt>${ui("vTp")}</dt><dd><b>${tps.map(x => esc(x.name)).join(", ")}</b>${tps.some(x => x.working) ? ` <small>· ${ui("vTpNow")}</small>` : ""}</dd>` : ""}
      <dt>${ui("vName")}</dt><dd>${esc(b.customer_name)}</dd>
      ${b.note ? `<dt>${ui("vNote")}</dt><dd>${esc(b.note)}</dd>` : ""}
    </dl>
    ${b.status === "reschedule" ? `<div class="res-box"><h3>🔁 ${ui("vResTitle")}</h3><p>${ui("vResDesc")}</p>
      <div class="res-list">${offers.map((o, i) => `<div class="res-opt"><span>${esc(fmtDate(o.date, o.time))}</span><button class="btn" data-pick="${i}">${ui("vResPick")}</button></div>`).join("")}</div>
      <p style="margin:10px 0 0">${ui("vResNone")}</p></div>` : ""}
    ${b.change_count && b.status !== "reschedule" ? `<p class="v-ok" style="background:#fff4e5;color:#9a5208">🔁 ${ui("vChanged", { n: b.change_count })}</p>` : ""}
    ${b.status === "confirmed" ? `<p class="v-show">📱 ${ui("vShow")}</p>` : ""}
    ${svCan ? `<div class="sv-box" id="svBox"></div>` : ""}
    <div class="vh-box" id="vhBox" hidden></div>
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
  if (svCan) svInit(t, s);
  vhInit(t);
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
// 문구는 i18n.js 의 pb_… (13개 언어 · 번역 안 된 문구는 영어)
function pbT(k, v) { return ui("pb_" + k, v || {}); }
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
  const head = `<b class="pb-t">${SITE.ptsRate ? pbT("title", { p: rate }) : pbT("titleN")}</b>`;   // 비율은 업체와 협의되면 숫자로 (data.js SITE.ptsRate)
  const totalLine = d && d.total != null ? `<p class="pb-tot">${pbT("total")} <b>${pbFmt(d.total)}P</b>${d.waiting ? ` · ${pbT("waiting", { n: d.waiting })}` : ""}</p>` : "";
  if (d && d.other) { box.innerHTML = `${head}<p class="pb-d">${pbT("other")}</p>`; return; }
  if (d && d.mine && !PB_EDIT) {
    const st = d.status, can = st === "wait" || st === "review";
    box.innerHTML = `${head}<div class="pb-st st-${st}"><b>${pbT("st_" + st)}</b>
      <span>${pbT("you")}: <b>${pbFmt(d.amount)}₫</b>${d.items ? ` · ${esc(d.items)}` : ""}${d.receipt ? ` · 🧾 ${pbT("rcSaved")}` : ""}</span>
      ${st === "ok" ? `<span class="pb-pts">+${pbFmt(d.points)}P</span>` : can && SITE.ptsRate ? `<span>${pbT("est")}: <b>+${pbFmt(Math.floor(d.amount * (d.rate || 0.03)))}P</b></span>` : ""}
      ${d.note ? `<small>💬 ${esc(d.note)}</small>` : ""}</div>${totalLine}<p class="pb-hint">${pbT("soon")}</p>
      ${can ? `<button class="btn" type="button" id="pbEdit">${pbT("edit")}</button>` : ""}`;
    const e = document.getElementById("pbEdit"); if (e) e.onclick = () => { PB_EDIT = true; pbRender(box, b, t, d); };
    return;
  }
  if (!user) {
    box.innerHTML = `${head}<p class="pb-d">${SITE.ptsRate ? pbT("desc", { p: rate }) : pbT("descN")}</p><p class="pb-hint">${pbT("why")}</p>
      <button class="btn big-btn" type="button" id="pbLogin">${pbT("login")}</button><p class="pb-hint">${pbT("loginHint")}</p>`;
    document.getElementById("pbLogin").onclick = () => ACCT.openLogin();
    return;
  }
  const pre = d && d.mine ? d : {};
  box.innerHTML = `${head}<p class="pb-d">${SITE.ptsRate ? pbT("desc", { p: rate }) : pbT("descN")}</p><p class="pb-hint">${pbT("why")}</p>
    <form class="form pb-form" id="pbForm">
      <label>${pbT("amt")}<input name="amt" inputmode="numeric" autocomplete="off" required placeholder="${esc(pbT("amtPh"))}" value="${pre.amount ? pbFmt(pre.amount) : ""}"></label>
      <label>${pbT("items")}<input name="items" maxlength="300" placeholder="${esc(pbT("itemsPh"))}" value="${esc(pre.items || "")}"></label>
      <label>${pbT("rc")}<input name="rc" type="file" accept="image/*"><small>${pbT("rcHint")}</small></label>
      ${SITE.ptsRate ? `<p class="pb-est">${pbT("est")}: <b id="pbEst">+0P</b></p>` : ""}
      <button class="btn big-btn" type="submit">${pbT("send")}</button></form>${totalLine}`;
  const f = document.getElementById("pbForm"), est = document.getElementById("pbEst");
  const upd = () => { const n = pbNum(f.amt.value); if (!est) return; est.textContent = "+" + pbFmt(Math.floor(n * rate / 100)) + "P"; };
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


// 📋 시술 전 질문 (예약확인증) — 답은 건강 정보라 동의를 받고, 가게와 엉클데이만 봐요. 방문 30일 뒤 자동 삭제
const SVC = { t: null, shop: null, d: null, edit: false, delAsk: false };
async function svInit(t, shop) {
  SVC.t = t; SVC.shop = shop; SVC.edit = false; SVC.delAsk = false;
  let r = null; try { r = await LIVE.rpc("survey_get", { t }); } catch (e) {}
  if (r) SVC.shop = { ...shop, cat: r.cat || shop.cat, survey: r.survey || shop.survey };
  SVC.d = r && r.answers ? { answers: r.answers, updated_at: r.updated_at } : null;
  if (!surveyQs(SVC.shop).length) { const el = document.getElementById("svBox"); if (el) el.remove(); return; }   // 가게가 질문을 꺼 둠
  svRender();
}
function svRender() {
  const el = document.getElementById("svBox"); if (!el) return;
  const qs = surveyQs(SVC.shop), req = !!(SVC.shop.survey && SVC.shop.survey.req), d = SVC.d, A = (d && d.answers) || {};
  const head = `<b class="sv-t">📋 ${ui("sv_title")}</b>${req ? `<span class="sv-req">${ui("sv_req")}</span>` : ""}`;
  if (d && !SVC.edit) {
    el.innerHTML = `${head}<p class="v-ok">✅ ${ui("sv_done")}</p>
      <dl class="sv-sum">${svRows(A, SVC.shop, lang).map(r => `<dt>${esc(r.q)}</dt><dd>${esc(r.a)}</dd>`).join("")}</dl>
      <div class="sv-btns"><button class="btn" type="button" id="svEdit">${ui("sv_edit")}</button>
      <button class="btn v-cancel" type="button" id="svDel">${SVC.delAsk ? ui("sv_delSure") : ui("sv_del")}</button></div>`;
    el.querySelector("#svEdit").onclick = () => { SVC.edit = true; svRender(); };
    el.querySelector("#svDel").onclick = async () => {
      if (!SVC.delAsk) { SVC.delAsk = true; svRender(); return; }
      try { await LIVE.rpc("survey_delete", { t: SVC.t }); SVC.d = null; SVC.delAsk = false; toastV(ui("sv_deleted")); } catch (e) { toastV(e.message || String(e)); }
      svRender();
    };
    return;
  }
  const yn = (q, a) => `<div class="sv-yn">${["y", "n"].map(v => `<label><input type="radio" name="sv_${q.id}" value="${v}" ${a && a.v === v ? "checked" : ""}> ${ui(v === "y" ? "sv_yes" : "sv_no")}</label>`).join("")}</div>
    ${q.detail ? `<input class="sv-d" data-d="${q.id}" placeholder="${esc(ui("sv_detail"))}" value="${esc((a && a.d) || "")}" ${a && a.v === "y" ? "" : "hidden"} maxlength="200">` : ""}`;
  const pick = (q, a) => `<div class="sv-yn">${q.opts.map((o, i) => `<label><input type="radio" name="sv_${q.id}" value="${i}" ${a && String(a.v) === String(i) ? "checked" : ""}> ${esc(svTx(o, lang))}</label>`).join("")}</div>`;
  const text = (q, a) => `<textarea name="sv_${q.id}" rows="2" maxlength="300" placeholder="${esc(ui("sv_ph"))}">${esc((a && a.v) || "")}</textarea>`;
  el.innerHTML = `${head}<p class="sv-desc">${ui("sv_desc")}</p>
    <form id="svForm">${qs.map(q => `<div class="sv-q"><span>${esc(svTx(q.q, lang))}</span>${q.type === "yn" ? yn(q, A[q.id]) : q.type === "pick" ? pick(q, A[q.id]) : text(q, A[q.id])}</div>`).join("")}
      <label class="sv-ok"><input type="checkbox" name="consent"> <span>${ui("sv_consent")}</span></label>
      <div class="sv-btns"><button class="btn big-btn" type="submit">${ui("sv_send")}</button>${d ? `<button class="btn" type="button" id="svCancel">${ui("back")}</button>` : ""}</div></form>`;
  const f = el.querySelector("#svForm");
  f.querySelectorAll('input[type=radio]').forEach(r => r.onchange = () => { const box = f.querySelector(`[data-d="${r.name.slice(3)}"]`); if (box) box.hidden = !(r.checked && r.value === "y" || f.querySelector(`[name="${r.name}"][value="y"]`).checked); });
  const cancel = el.querySelector("#svCancel"); if (cancel) cancel.onclick = () => { SVC.edit = false; svRender(); };
  f.onsubmit = async e => {
    e.preventDefault();
    const ans = {}; let miss = false;
    qs.forEach(q => {
      if (q.type === "text") { const v = (f.elements["sv_" + q.id].value || "").trim(); if (v) ans[q.id] = { v }; }
      else { const c = f.querySelector(`[name="sv_${q.id}"]:checked`); if (!c) { miss = true; return; } ans[q.id] = { v: q.type === "pick" ? +c.value : c.value }; const dd = f.querySelector(`[data-d="${q.id}"]`); if (dd && c.value === "y" && dd.value.trim()) ans[q.id].d = dd.value.trim(); }
      if (ans[q.id] && !SURVEY_Q[q.id]) { ans[q.id].q = q.q; ans[q.id].t = q.type; }   // 가게가 더한 질문은 질문 글도 같이 (나중에 질문이 바뀌어도 알아볼 수 있게)
    });
    if (miss) { toastV(ui("sv_need")); return; }
    if (!f.consent.checked) { toastV(ui("sv_needConsent")); return; }
    const btn = f.querySelector("[type=submit]"); btn.disabled = true;
    try { SVC.d = await LIVE.rpc("survey_submit", { t: SVC.t, ans, consent: true, lg: lang }); SVC.edit = false; toastV(ui("sv_saved")); svRender(); svTranslate(SVC.t); }
    catch (er) { btn.disabled = false; toastV(er.message || String(er)); }
  };
}

// 손님이 직접 쓴 글은 가게(베트남어) · 엉클데이(한국어)가 읽을 수 있게 번역해 둬요 (Edge Function chat-tr · 저장된 글만 · 실패해도 괜찮아요)
function svTranslate(t) {
  try {
    if (typeof SUPA === "undefined" || !SUPA.url) return;
    const h = { apikey: SUPA.key, "Content-Type": "application/json" }; if (/^eyJ/.test(SUPA.key)) h.Authorization = "Bearer " + SUPA.key;
    fetch(`${SUPA.url}/functions/v1/chat-tr`, { method: "POST", headers: h, body: JSON.stringify({ survey: t }) }).catch(() => {});
  } catch (e) {}
}

// 📒 내 시술 기록 (universe42): 가게가 남긴 손님용 메모 (손님 말로 번역) + 다른 가게와 공유 동의
async function vhInit(t, again) {
  const el = document.getElementById("vhBox"); if (!el || typeof LIVE === "undefined" || !LIVE.on) return;
  let h; try { h = await LIVE.rpc("customer_history", { t }); } catch (e) { return; }
  if (!h) return;
  const list = h.list || [], L = typeof lang !== "undefined" ? lang : "ko";
  const mn = x => (x.mn && typeof x.mn === "object" ? tx(x.mn) : "") || x.menu || "";
  const noteOf = x => !x.pub ? "" : (x.lang && x.lang === L) ? x.pub : (x.tr && x.tr[L]) || x.pub;
  el.hidden = false;
  el.innerHTML = `<h3>${ui("vh_title")}</h3>
    ${list.length ? list.map(x => `<div class="vh-row"><span class="vh-d">${esc(x.date || "")}</span><div><b>${esc(mn(x))}</b><small>${esc(x.shop && typeof x.shop === "object" ? tx(x.shop) : x.shop || "")}</small>
      ${x.pub ? `<p>🧾 ${esc(noteOf(x))}</p>` : ""}</div></div>`).join("") : `<p class="vh-empty">${ui("vh_empty")}</p>`}
    <label class="vh-share"><input type="checkbox" id="vhShare" ${h.share ? "checked" : ""}><span><b>${ui("vh_share")}</b><small>${ui("vh_shareD")}</small></span></label>`;
  const cb = document.getElementById("vhShare");
  cb.onchange = async () => { cb.disabled = true; try { await LIVE.rpc("customer_history_share", { t, on_: cb.checked }); toastV(ui(cb.checked ? "vh_on" : "vh_off")); } catch (e) { cb.checked = !cb.checked; toastV(e.message); } cb.disabled = false; };
  // 아직 손님 말로 번역 안 된 메모가 있으면 한 번 번역해서 다시 그려요 (Edge Function chat-tr · 실패해도 원문은 보여요)
  if (!again && list.some(x => x.pub && x.lang !== L && !(x.tr && x.tr[L]))) {
    try {
      const hd = { apikey: SUPA.key, "Content-Type": "application/json" }; if (/^eyJ/.test(SUPA.key)) hd.Authorization = "Bearer " + SUPA.key;
      const r = await fetch(`${SUPA.url}/functions/v1/chat-tr`, { method: "POST", headers: hd, body: JSON.stringify({ visit: t, to: L }) });
      const j = await r.json().catch(() => ({})); if (j && j.n) vhInit(t, true);
    } catch (e) {}
  }
}

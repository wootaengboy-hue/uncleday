/* 손님 예약확인증 — 주소 뒤의 #열쇠로 예약을 불러와요 */
drawCommon();
const box = $("vbox");
const token = () => decodeURIComponent(location.hash.slice(1));
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
    <p>${ui("vFindDesc")}</p>
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
    } catch (err) { toastV(ui("vNotFound")); }
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
  function tpForm(list) {
    return `<div class="tp-pick"><span>${ui("tpRvWho")}</span><div class="tp-chips">${list.map(x => `<button type="button" class="tp-chip" data-tpid="${esc(x.id)}" aria-pressed="false">${esc(x.name)}</button>`).join("")}</div>
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
      } catch (err) { toastV(err.message); }
    };
  }
}
addEventListener("hashchange", load);
load();

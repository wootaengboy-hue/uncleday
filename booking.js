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
  document.title = `${ui("vTitle")} ${b.code} | ${tx(SITE.name)}`;
  box.innerHTML = `<div class="done voucher">
    <div class="v-head"><small>${ui("vTitle")}</small><b class="v-code">${esc(b.code)}</b>
      <span class="v-st st-${esc(b.status)}">${ui("st_" + b.status)}</span></div>
    ${s.img ? `<img class="v-img" src="${esc(s.img)}" alt="" style="object-position:${esc(s.imgPos || "50% 50%")}">` : ""}
    <dl class="v-info">
      <dt>${ui("vShop")}</dt><dd><b>${esc(s.name ? tx(s.name) : b.shop_name)}</b>${s.address ? `<br><small>${esc(tx(s.address))}</small>` : ""}${s.map ? ` <a href="${esc(s.map)}" target="_blank" rel="noopener">${ui("vMap")}</a>` : ""}</dd>
      <dt>${ui("vDate")}</dt><dd>${esc(fmtDate(b.visit_date, b.visit_time))}</dd>
      <dt>${ui("vMenu")}</dt><dd>${esc(menuName)}${b.menu_min ? ` · ${b.menu_min}${ui("min")}` : ""}</dd>
      <dt>${ui("vPeople")}</dt><dd>${ui("vPeopleN", { n: b.people })}</dd>
      <dt>${ui("vPrice")}</dt><dd>${money(b.list_price)}<br><small>${ui("vPriceNote")}</small></dd>
      <dt>${ui("vName")}</dt><dd>${esc(b.customer_name)}</dd>
      ${b.note ? `<dt>${ui("vNote")}</dt><dd>${esc(b.note)}</dd>` : ""}
    </dl>
    ${b.status === "reschedule" ? `<div class="res-box"><h3>🔁 ${ui("vResTitle")}</h3><p>${ui("vResDesc")}</p>
      <div class="res-list">${offers.map((o, i) => `<div class="res-opt"><span>${esc(fmtDate(o.date, o.time))}</span><button class="btn" data-pick="${i}">${ui("vResPick")}</button></div>`).join("")}</div>
      <p style="margin:10px 0 0">${ui("vResNone")}</p></div>` : ""}
    ${b.change_count && b.status !== "reschedule" ? `<p class="v-ok" style="background:#fff4e5;color:#9a5208">🔁 ${ui("vChanged", { n: b.change_count })}</p>` : ""}
    ${b.status === "confirmed" ? `<p class="v-show">📱 ${ui("vShow")}</p>` : ""}
    <div class="v-btns">
      ${canVisit && (past || b.status === "confirmed" || b.status === "noshow") ? `<button class="btn big-btn" id="vVisit">${ui("vVisited")}</button>` : ""}
      ${b.customer_visit_at ? `<p class="v-ok">${ui("vVisitedDone")}</p>` : ""}
      ${!b.reviewed && (past || b.customer_visit_at) ? `<button class="btn" id="vRv">${ui("vReview")}</button>` : ""}
      ${b.reviewed ? `<p class="v-ok">${ui("vReviewed")}</p>` : ""}
      <a class="btn kakao-link" href="${SITE.kakao}" target="_blank">💬 ${ui("vAsk")}</a>
      <button class="btn" id="vLink">${ui("vCopyLink")}</button>
      ${open ? `<button class="btn v-cancel" id="vCancel">${ui("vCancel")}</button>` : ""}
    </div>
    <div id="vRvBox"></div>
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
  $("vLink").onclick = () => { try { navigator.clipboard.writeText(location.href); toastV(ui("vLinkCopied")); } catch (e) {} };
  if ($("vCancel")) $("vCancel").onclick = () => {
    const d = document.createElement("div"); d.className = "lightbox";
    d.innerHTML = `<div class="done" style="max-width:340px;margin:auto"><h2>${ui("vCancelAsk")}</h2><button class="btn v-cancel" data-y>${ui("vYes")}</button> <button class="btn" data-n>${ui("vNo")}</button></div>`;
    d.style.background = "#0009"; d.style.display = "flex"; d.style.alignItems = "center"; d.style.justifyContent = "center";
    document.body.appendChild(d);
    d.querySelector("[data-n]").onclick = () => d.remove();
    d.querySelector("[data-y]").onclick = () => { d.remove(); act("cancel"); };
  };
  if ($("vRv")) $("vRv").onclick = () => {
    $("vRv").hidden = true;
    let st = 0;
    $("vRvBox").innerHTML = `<form id="rvForm" class="form">
      <div class="f-stars"><span>${ui("rvStars")}</span><div id="rvStarBtns">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-s="${n}">★</button>`).join("")}</div></div>
      <label>${ui("rvName")}<input name="name" required maxlength="20" value="${esc(b.customer_name || "")}"></label>
      <label>${ui("rvText")}<textarea name="text" rows="4" required minlength="10" maxlength="1000" placeholder="${ui("rvTextPh")}"></textarea></label>
      <button class="btn big-btn" type="submit">${ui("rvSend")}</button><small>${ui("rvNotice")}</small></form>`;
    const f = $("rvForm");
    f.querySelectorAll("[data-s]").forEach(x => x.onclick = () => { st = +x.dataset.s; f.querySelectorAll("[data-s]").forEach(y => y.classList.toggle("on", +y.dataset.s <= st)); });
    f.scrollIntoView({ behavior: "smooth" });
    f.onsubmit = async e => {
      e.preventDefault();
      if (!st) { toastV(ui("rvNeedStar")); return; }
      const v = Object.fromEntries(new FormData(f));
      try {
        await LIVE.rpc("submit_review", { p: { token: t, stars: st, name: v.name, text: v.text, menu: menuName, month: (b.visit_date || "").slice(0, 7), lang } });
        draw(await LIVE.rpc("booking_for_customer", { t }));
      } catch (err) { toastV(err.message); }
    };
  };
}
addEventListener("hashchange", load);
load();

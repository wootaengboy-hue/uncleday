/* 업체 상세 + 예약 요청. 메인 화면 안에서 새로고침 없이 그려요 (shop.html 단독으로도 열려요). */
// 업체 주소는 /s/업체id/ (검색엔진이 읽는 진짜 페이지). 메인 화면 안에서는 눌러도 새로고침 없이 열려요 (app.js)
const shopLink = id => `/s/${encodeURIComponent(id)}/`;

// 업체 화면에서 '상담하기'를 누르면: 이 업체 문의 문구를 보여 주고 복사한 뒤, 카톡을 열어요 (카톡 창에 붙여넣기)
function copyText(text) {
  let ok = false;
  try {
    const t = document.createElement("textarea"); t.value = text;
    t.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0";
    document.body.appendChild(t); t.focus(); t.select(); try { t.setSelectionRange(0, 99999); } catch (e) {}
    ok = document.execCommand("copy"); t.remove();
  } catch (err) {}
  return ok;
}
document.addEventListener("click", e => {
  const a = e.target.closest("a.kakao-link"); if (!a || a.id === "bkKakao" || (a.hasAttribute("data-chat") && typeof CHAT !== "undefined" && CHAT)) return;
  const m = (window.SHOP_ID && [0, window.SHOP_ID]) || location.hash.match(/^#\/shop\/(.+)$/) || (/shop\.html$/.test(location.pathname) && [0, location.hash.slice(1)]);
  const shop = m && SHOPS.find(s => s.id === decodeURIComponent(m[1])); if (!shop) return;
  e.preventDefault();
  const c = CITIES.find(x => x.id === shop.city), k = catGroup(shop.cat);
  const text = ui("askMsg", { shop: tx(shop.name), city: c ? tx(c.name) : "", cat: k ? tx(k.name) : "" });
  document.querySelectorAll(".ask-sheet").forEach(x => x.remove());
  const d = document.createElement("div"); d.className = "ask-sheet";
  d.innerHTML = `<div class="ask-box" role="dialog" aria-label="${ui("askTitle")}">
    <b class="ask-title">💬 ${ui("askTitle")}</b>
    <p class="ask-step">${ui("askStep")}</p>
    <textarea class="ask-text" readonly rows="6">${esc(text)}</textarea>
    <p class="ask-st" id="askSt"></p>
    <div class="ask-btns"><button type="button" class="btn ask-copy">${ui("askCopyBtn")}</button>
      <a class="btn ask-open" href="${SITE.kakao}" target="_blank" rel="noopener">${ui("askOpen")}</a></div>
    <button type="button" class="ask-close" aria-label="close">✕</button></div>`;
  document.body.appendChild(d);
  const st = ok => { const el = d.querySelector("#askSt"); el.textContent = ok ? "✅ " + ui("askCopiedShort") : ui("askCopyFail"); el.className = "ask-st " + (ok ? "ok" : "no"); };
  const doCopy = () => {
    const ok = copyText(text); st(ok);
    if (!ok && navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(() => st(true), () => {});
  };
  doCopy();                                   // 누른 순간 바로 복사
  d.querySelector(".ask-copy").onclick = doCopy;
  d.querySelector(".ask-open").addEventListener("click", () => { doCopy(); setTimeout(() => d.remove(), 600); });
  d.querySelector(".ask-close").onclick = () => d.remove();
  d.onclick = ev => { if (ev.target === d) d.remove(); };
}, true);

/* 🚕 그랩으로 가기: 목적지(업체 주소·좌표)를 채운 채로 그랩 앱을 열어요. 출발지는 그랩이 현재 위치로 잡아요.
   그랩 공식 문서가 없는 연결 방식이라, 안 되면 주소 복사로 넘어가요. */
function rideDest(shop) {
  const a = shop.address || {}, c = CITIES.find(x => x.id === shop.city);
  const addr = [a.vi, a.en, a.ko].find(v => v && v.trim() && !/확인 중|to be confirmed|đang xác nhận/i.test(v)) || "";
  const name = (shop.name && (shop.name.vi || shop.name.en || shop.name.ko)) || "";
  const city = c ? (c.name.vi || c.name.en) : "";
  return { name, addr: addr || [name, city].filter(Boolean).join(", "), geo: Array.isArray(shop.geo) && shop.geo.length === 2 ? shop.geo : null };
}
function grabLink(dst) {
  const p = new URLSearchParams({ screenType: "BOOKING" });
  if (dst.geo && isFinite(dst.geo[0]) && isFinite(dst.geo[1])) { p.set("dropOffLatitude", String(dst.geo[0])); p.set("dropOffLongitude", String(dst.geo[1])); }
  p.set("dropOffAddress", dst.addr); p.set("dropOffKeywords", dst.name || dst.addr);
  const u = new URL("https://grab.onelink.me/2695613898");
  u.search = new URLSearchParams({ pid: "organic_web", af_force_deeplink: "true", af_dp: "grab://open?" + p.toString().replace(/\+/g, "%20") }).toString();
  return u.href;
}
function openRide(shop) {
  const dst = rideDest(shop), mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  document.querySelectorAll(".ask-sheet").forEach(x => x.remove());
  const d = document.createElement("div"); d.className = "ask-sheet";
  d.innerHTML = `<div class="ask-box" role="dialog" aria-label="${ui("rideTitle")}">
    <b class="ask-title">🚕 ${ui("rideTitle")}</b>
    <div class="ride-dst"><small>${ui("rideTo")}</small><b>${esc(tx(shop.name))}</b><span>${esc(dst.addr)}</span></div>
    <p class="ask-step">${mobile ? ui("rideStep") : ui("ridePc")}</p>
    <p class="ask-st" id="rideSt"></p>
    <div class="ask-btns"><button type="button" class="btn ride-copy">${ui("rideCopy")}</button>
      ${mobile ? `<a class="btn ride-grab" href="${grabLink(dst)}" rel="noopener">${ui("rideGrab")}</a>` : `<span></span>`}</div>
    <p class="ride-etc">${ui("rideEtc")}</p>
    <button type="button" class="ask-close" aria-label="close">✕</button></div>`;
  document.body.appendChild(d);
  const st = ok => { const el = d.querySelector("#rideSt"); el.textContent = ok ? "✅ " + ui("rideCopied") : ui("askCopyFail"); el.className = "ask-st " + (ok ? "ok" : "no"); };
  const doCopy = () => { const ok = copyText(dst.addr); st(ok); if (!ok && navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(dst.addr).then(() => st(true), () => {}); };
  d.querySelector(".ride-copy").onclick = doCopy;
  const g = d.querySelector(".ride-grab"); if (g) g.addEventListener("click", () => { doCopy(); if (typeof LIVE !== "undefined" && LIVE.track) LIVE.track("map", shop.id); });
  d.querySelector(".ask-close").onclick = () => d.remove();
  d.onclick = ev => { if (ev.target === d) d.remove(); };
}

function renderShop(id) {
const shop = SHOPS.find(s => s.id === id);
const box = $("detail");
if (shop && typeof LIVE !== "undefined") LIVE.view(shop.id);
document.querySelectorAll(".cta-bar").forEach(e => e.remove());
document.body.classList.remove("has-cta");

if (!shop) {
  box.innerHTML = `<p class="empty">${ui("notFound")}</p><a href="${window.SPA ? "#" : "/"}">${ui("back")}</a>`;
} else {
  document.title = tx(shop.name) + " | " + tx(SITE.name);
  const cat = catGroup(shop.cat);
  const img = shop.img ? `<img class="hero" src="${shop.img}" alt="" decoding="async" style="object-position:${shop.imgPos || "50% 50%"}">` : phCard(shop, true);
  const closed = shop.closed.length ? shop.closed.map(d => ui("days")[d]).join(", ") : ui("none");
  const staff = shop.staffLangs.length ? shop.staffLangs.map(l => ui("lang_" + l)).join(", ") : ui("tbd");
  const revs = (shop.userReviews || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const avg = revs.length ? (revs.reduce((t, r) => t + r.stars, 0) / revs.length).toFixed(1) : 0;
  const pending = shop.verified === false || !shop.open || !shop.menu.length;   // 정보 미확인 → 예약 폼 대신 상담 버튼
  const hoursText = shop.open ? `${shop.open} ~ ${shop.close}` : ui("tbd");
  const closedText = shop.open ? closed : ui("tbd");

  const hasPrice = shop.menu.some(m => m.price > 0);
  const addrOk = !/확인 중|to be confirmed/i.test(JSON.stringify(shop.address));
  const checks = [
    [ui("address"), addrOk], [ui("hours"), !!shop.open], [ui("price"), hasPrice],
    [ui("staffLangs"), shop.staffLangs.length > 0], [ui("chkConsent"), shop.verified !== false]
  ];
  const facts = [
    ["📍", ui("address"), addrOk ? tx(shop.address) : ui("tbd"), addrOk],
    ["💰", ui("price"), hasPrice ? priceFrom(shop) : ui("consultPrice"), hasPrice],
    ["🕒", ui("hours"), shop.open ? `${hoursText}<br><small>${ui("closedDays")}: ${closedText}</small>` : ui("tbd"), !!shop.open],
    ["🗣️", ui("staffLangs"), staff, shop.staffLangs.length > 0]
  ];
  // 비슷한 업체: 같은 카테고리 (같은 도시 우선) 최대 3곳
  const similar = SHOPS.filter(s => s.id !== shop.id && s.cat === shop.cat)
    .sort((a, b) => (b.city === shop.city) - (a.city === shop.city)).slice(0, 3);

  box.innerHTML = `
    <a href="${window.SPA ? "#" : "/"}" class="back">${ui("back")}</a>
    ${img}
    <div class="head">
      <div class="chips"><span class="tag cat-tag">${cat ? cat.icon + " " + tx(cat.name) : ""}</span>
        <span class="tag">📍 ${cityName(shop.city)}</span>
        ${shop.rating ? `<span class="tag">⭐ ${shop.rating} (${shop.reviews})</span>` : ""}
        <button type="button" class="tag share-btn" id="shareBtn">🔗 ${ui("shareBtn")}</button></div>
      <h1>${tx(shop.name)}${shop.best ? ` <span class="best-badge"><i>✦</i>${ui("certBadge")}<i>✦</i></span>` : ""}</h1>
      <div class="tags">${shop.tags.map(t => `<span class="tag">#${tx(t)}</span>`).join("")}</div>
    </div>

    <h2>${ui("overview")}</h2>
    <div class="facts">${facts.map(f => `
      <div class="fact ${f[3] ? "" : "tbd"}"><span class="fi">${f[0]}</span><div><small>${f[1]}</small><b>${f[2]}</b></div></div>`).join("")}
    </div>
    <p class="go-row">${shop.map ? `<a class="map-link" href="${shop.map}" target="_blank">🗺️ ${ui("map")}</a>` : ""}<button type="button" class="ride-btn" id="rideBtn">🚕 ${ui("rideBtn")}</button></p>
    <div id="gBox"></div>

    <h2>${ui("about")}</h2><p>${tx(shop.desc)}</p>
    ${shop.recommend && tx(shop.recommend) ? `<p class="reco">👍 <b>${ui("recoFor")}</b> ${tx(shop.recommend)}</p>` : ""}

    ${shop.menu.length ? `<h2>${ui("menu")}</h2>
    <div id="menuList">${shop.menu.map((m, i) => `
      <div class="menu-row"><div><b>${tx(m.name)}</b>${m.min ? `<br><small>${m.min} ${ui("min")}</small>` : ""}</div>
      <div class="price">${money(m.price)}</div>
      ${pending ? "" : `<button class="chip pick" data-i="${i}">${ui("bookBtn")}</button>`}</div>`).join("")}
    </div>` : ""}

    ${(shop.menuImgs || []).length ? `<h2>${ui("menuBoard")}</h2>
    <div class="boards">${shop.menuImgs.map((m, i) => `
      <button class="board" data-b="${i}" type="button"><img src="${m.src}" alt="" loading="lazy">${m.cap ? `<span>${m.cap}</span>` : ""}</button>`).join("")}
    </div><p class="board-hint">${ui("tapZoom")}</p>` : ""}

    <h2 id="rvTitle">${ui("rvTitle")}${revs.length ? ` <small class="rv-sum">★ ${avg} · ${ui("rvCount", { n: revs.length })}</small>` : ""}</h2>
    <div class="rv-list-site">${revs.length ? revs.map(r => `
      <div class="rv-card"><div class="rv-top"><span class="rv-stars">${stars(r.stars)}</span><small>${esc(r.name)}${r.date ? " · " + reviewDate(r.date) : ""}${r.menu ? " · " + esc(r.menu) : ""}</small></div>
      <p>${esc(r.text).replace(/\n/g, "<br>")}</p></div>`).join("") : `<p class="empty">${ui("rvNone")}</p>`}
    </div>
    <button class="btn rv-open" id="rvOpen" type="button">✍️ ${ui("rvWrite")}</button>
    <form id="rvForm" class="form" hidden>
      <div class="f-stars"><span>${ui("rvStars")}</span><div id="rvStarBtns">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-s="${n}" aria-label="${n}">★</button>`).join("")}</div></div>
      <label>${ui("rvName")}<input name="name" required maxlength="20"></label>
      <label>${ui("rvVisit")}<input type="month" name="date" required></label>
      ${shop.menu.length ? `<label>${ui("rvMenu")}<select name="menu"><option value="">-</option>${shop.menu.map(m => `<option>${esc(tx(m.name))}</option>`).join("")}</select></label>` : ""}
      <label>${ui("rvText")}<textarea name="text" rows="4" required minlength="10" maxlength="1000" placeholder="${ui("rvTextPh")}"></textarea></label>
      <label>${ui("rvContact")}<input name="contact" maxlength="60"></label>
      <button class="btn big-btn" type="submit">${ui("rvSend")}</button>
      <small>${ui("rvNotice")}</small>
    </form>
    <div id="rvDone" class="done" hidden></div>

    ${pending ? `<div class="done"><h2>${ui("book")}</h2><p>${ui("askNote")}</p>
      <a class="btn kakao-link" href="${SITE.kakao}" target="_blank">${ui("askBtn")}</a></div>` : ""}

    ${similar.length ? `<h2>${ui("similar")}</h2>
    <div class="sim">${similar.map(s => `<a class="sim-item" href="${shopLink(s.id)}"><b>${tx(s.name)}</b><small>${cityName(s.city)} · ${s.tags.slice(0, 2).map(t => tx(t)).join(", ")}</small></a>`).join("")}</div>` : ""}

    <h2 id="bookTitle" ${pending ? "hidden" : ""}>${ui("book")}</h2>
    <form id="form" class="form" ${pending ? "hidden" : ""}>
      <label>${ui("fMenu")}<select name="menu" id="fMenu">${shop.menu.map((m, i) =>
        `<option value="${i}">${tx(m.name)} – ${money(m.price)}</option>`).join("")}</select></label>
      <div class="bk-pick">
        <button type="button" class="bk-sum" id="bkSum"><span class="bk-ic">📅</span><span id="bkSumT">${ui("pickDT")}</span><span class="bk-car">▾</span></button>
        <div class="bk-panel" id="bkPanel" hidden>
          <div class="cal-head"><button type="button" class="cal-nav" id="calPrev" aria-label="prev">‹</button><b id="calTitle"></b><button type="button" class="cal-nav" id="calNext" aria-label="next">›</button></div>
          <div class="cal-grid" id="calGrid"></div>
          <div class="slots" id="slots"></div>
        </div>
        <input type="hidden" name="date" id="fDate"><input type="hidden" name="time" id="fTime">
      </div>
      <div class="ppl-row"><span>${ui("fPeople")}</span><div class="ppl"><button type="button" id="pplM" aria-label="-">−</button><b id="pplN">1</b><button type="button" id="pplP" aria-label="+">＋</button></div><input type="hidden" name="people" id="fPeople" value="1"></div>
      <label>${ui("fName")}<input name="name" required></label>
      <label>${ui("fContact")}<input name="contact" required></label>
      <label>${ui("fNote")}<textarea name="note" rows="3"></textarea></label>
      <label>${ui("fCoupon")}<input name="coupon" maxlength="20" autocomplete="off" style="text-transform:uppercase" placeholder="UD……"></label>
      <label class="mk-ok"><input type="checkbox" name="marketing" value="1"><span>${ui("fMarketing")}</span></label>
      <button class="btn big-btn" type="submit">${ui("bookBtn")}</button>
      <small>${ui("notice")}</small>
    </form>
    <div id="done" class="done" hidden></div>`;
  if (typeof gplaceBox === "function") gplaceBox(shop);
  if ($("rideBtn")) $("rideBtn").onclick = () => openRide(shop);
  // 메뉴판 크게 보기
  const boards = shop.menuImgs || [];
  function openBoard(i) {
    const lb = document.createElement("div"); lb.className = "lightbox";
    const show = () => {
      const m = boards[i];
      lb.innerHTML = `<button class="lb-x" aria-label="close">✕</button>
        ${boards.length > 1 ? `<button class="lb-nav lb-prev" aria-label="prev">‹</button><button class="lb-nav lb-next" aria-label="next">›</button>` : ""}
        <div class="lb-body"><img src="${m.src}" alt=""></div>
        <div class="lb-cap">${m.cap || ""}${boards.length > 1 ? ` <small>${i + 1} / ${boards.length}</small>` : ""}</div>`;
      lb.querySelector(".lb-x").onclick = () => lb.remove();
      if (lb.querySelector(".lb-prev")) {
        lb.querySelector(".lb-prev").onclick = e => { e.stopPropagation(); i = (i - 1 + boards.length) % boards.length; show(); };
        lb.querySelector(".lb-next").onclick = e => { e.stopPropagation(); i = (i + 1) % boards.length; show(); };
      }
    };
    lb.onclick = e => { if (e.target === lb || e.target.classList.contains("lb-body")) lb.remove(); };
    show(); document.body.appendChild(lb);
  }
  document.querySelectorAll(".board").forEach(b => b.onclick = () => openBoard(+b.dataset.b));

  // 화면 아래에 항상 보이는 문의 버튼
  // 예약 가능 업체: [📅 예약하기] + [💬 상담]  /  준비 중 업체: [💬 상담하기]
  // 예약 폼이 화면에 보이는 동안에는 바를 숨겨서 "예약 요청하기"와 버튼이 겹치지 않게
  // 사이트 채팅이 켜져 있으면 채팅창이 열리고(chat.js), 아니면 카톡 채널로 이동
  const askHtml = `<a class="btn cta-ask" href="${SITE.kakao}" target="_blank" rel="noopener" data-chat>💬 ${ui(pending ? "ctaAskFull" : "ctaAsk")}</a>`;
  document.body.insertAdjacentHTML("beforeend", `<div class="cta-bar ${pending ? "solo" : ""}">${pending ? "" : `<button type="button" class="btn cta-book">📅 ${ui("ctaBook")}</button>`}${askHtml}</div>`);
  document.body.classList.add("has-cta");
  const bar = document.querySelector(".cta-bar");
  const cb = bar.querySelector(".cta-book"); if (cb) cb.onclick = () => { $("bookTitle").scrollIntoView({ behavior: "smooth" }); };
  if (!pending && "IntersectionObserver" in window) {
    const seen = new Set();
    const io = new IntersectionObserver(es => { es.forEach(x => x.isIntersecting ? seen.add(x.target) : seen.delete(x.target)); bar.classList.toggle("away", seen.size > 0); if (typeof CHAT !== "undefined" && CHAT && CHAT.place) CHAT.place(); });
    [$("bookTitle"), $("form")].forEach(el => el && io.observe(el));
  }

  // 이용 후기 보내기 (확인 후 관리자 페이지에서 게시)
  let rvStar = 0;
  const rvForm = $("rvForm");
  $("rvOpen").onclick = () => { rvForm.hidden = false; $("rvOpen").hidden = true; rvForm.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const drawStars = () => rvForm.querySelectorAll("[data-s]").forEach(b => b.classList.toggle("on", +b.dataset.s <= rvStar));
  rvForm.querySelectorAll("[data-s]").forEach(b => b.onclick = () => { rvStar = +b.dataset.s; drawStars(); });
  const mNow = new Date().toISOString().slice(0, 7);
  rvForm.date.max = mNow; rvForm.date.value = mNow;
  rvForm.onsubmit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(rvForm));
    if (!rvStar) { alertBox(ui("rvNeedStar")); return; }
    if ((f.text || "").trim().length < 10) { alertBox(ui("rvShort")); return; }
    const msg =
`[이용 후기]
업체: ${shop.name.ko} (${shop.id})
별점: ${rvStar}점
이름: ${f.name}
방문: ${f.date}
메뉴: ${f.menu || "-"}
연락처: ${f.contact || "-"}
내용:
${f.text}
작성 언어: ${lang.toUpperCase()}`;
    let sent = false;
    if (LIVE.on) {
      try {
        await LIVE.rpc("submit_review", { p: { shop_id: shop.id, stars: rvStar, name: f.name, month: f.date, menu: f.menu, text: f.text, contact: f.contact, lang } });
        sent = true;
      } catch (err) { if (err.server) { alertBox(err.message); return; } }
    } else if (SITE.formEndpoint) {
      try {
        const r = await fetch(SITE.formEndpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ type: "review", shop: shop.id, stars: rvStar, ...f, message: msg }) });
        sent = r.ok;
      } catch (err) {}
    }
    const mail = `mailto:${SITE.email}?subject=${encodeURIComponent("[이용 후기] " + shop.name.ko)}&body=${encodeURIComponent(msg)}`;
    rvForm.hidden = true;
    const d = $("rvDone"); d.hidden = false;
    d.innerHTML = `<h2>${ui("rvWrite")}</h2><p>${sent ? ui("rvDoneSent") : ui("rvDoneManual")}</p><pre id="rvMsg"></pre>
      ${sent ? "" : `<button class="btn" id="rvCopy" type="button">${ui("copy")}</button>
      <a class="btn kakao-link" href="${SITE.kakao}" target="_blank">${ui("viaKakao")}</a>
      <a class="btn" href="${mail}">${ui("viaMail")}</a>`}`;
    $("rvMsg").textContent = msg;
    if ($("rvCopy")) $("rvCopy").onclick = () => navigator.clipboard.writeText(msg).then(() => $("rvCopy").textContent = ui("copied"));
    d.scrollIntoView({ behavior: "smooth" });
  };

  // 공유하기: 카톡·네이버에서 미리보기가 예쁘게 나오는 공유 전용 주소
  $("shareBtn").onclick = async () => {
    const url = `${location.origin}/s/${encodeURIComponent(shop.id)}/`;
    if (navigator.share && /Mobi|Android|iPhone/i.test(navigator.userAgent)) { try { await navigator.share({ title: tx(shop.name) + " | " + tx(SITE.name), url }); return; } catch (e) { if (e.name === "AbortError") return; } }
    let ok = false; try { await navigator.clipboard.writeText(url); ok = true; } catch (e) { ok = copyText(url); }
    const d = document.createElement("div"); d.className = "toast-site"; d.textContent = ok ? ui("shareCopied") : url; document.body.appendChild(d); setTimeout(() => d.remove(), 2600);
  };
  if (pending) { /* 예약 폼은 숨김 */ } else {
  const form = $("form"), fDate = $("fDate"), fTime = $("fTime"), fMenu = $("fMenu");

  // 네이버 예약처럼: 달력에서 날짜 → 30분 단위 시간 버튼 → 인원 −/＋
  const toMin = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);
  const toStr = m => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  const ymd = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  const first = new Date(); first.setHours(0, 0, 0, 0); first.setDate(first.getDate() + 1);   // 내일부터
  const last = new Date(first); last.setDate(last.getDate() + 90);                            // 90일까지
  let view = new Date(first.getFullYear(), first.getMonth(), 1);
  const dayOff = ds => (shop.closed || []).includes(new Date(ds + "T00:00:00").getDay());
  const fmtTime = t => { const m = toMin(t), h = Math.floor(m / 60), mm = String(m % 60).padStart(2, "0"); return lang === "ko" ? `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${mm}` : lang === "vi" ? `${h}:${mm}` : `${h % 12 || 12}:${mm} ${h < 12 ? "AM" : "PM"}`; };
  const fmtDate = ds => { const x = new Date(ds + "T00:00:00"), w = ui("days")[x.getDay()]; return lang === "ko" ? `${x.getMonth() + 1}.${x.getDate()}(${w})` : lang === "vi" ? `${w}, ${x.getDate()}/${x.getMonth() + 1}` : `${w}, ${x.toLocaleString("en-US", { month: "short" })} ${x.getDate()}`; };
  function slotsFor() { const dur = shop.menu[fMenu.value].min || 60, out = []; for (let t = toMin(shop.open); t + dur <= toMin(shop.close); t += 30) out.push(toStr(t)); return out; }
  function drawSum() {
    $("bkSumT").textContent = fDate.value && fTime.value ? `${fmtDate(fDate.value)} ${fmtTime(fTime.value)}` : fDate.value ? `${fmtDate(fDate.value)} · ${ui("pickTime")}` : ui("pickDT");
    $("bkSum").classList.toggle("set", !!(fDate.value && fTime.value));
  }
  function drawCal() {
    const y = view.getFullYear(), m = view.getMonth();
    $("calTitle").textContent = lang === "ko" ? `${y}.${String(m + 1).padStart(2, "0")}` : `${String(m + 1).padStart(2, "0")}/${y}`;
    $("calPrev").disabled = view <= new Date(first.getFullYear(), first.getMonth(), 1);
    $("calNext").disabled = new Date(y, m + 1, 1) > last;
    let h = ui("days").map((w, i) => `<span class="cal-w ${i === 0 ? "sun" : i === 6 ? "sat" : ""}">${w}</span>`).join("");
    const start = new Date(y, m, 1).getDay(), n = new Date(y, m + 1, 0).getDate();
    for (let i = 0; i < start; i++) h += `<span></span>`;
    for (let dd = 1; dd <= n; dd++) {
      const x = new Date(y, m, dd), ds = ymd(x), off = dayOff(ds), out = x < first || x > last;
      h += `<button type="button" class="cal-d ${ds === fDate.value ? "on" : ""} ${x.getDay() === 0 ? "sun" : x.getDay() === 6 ? "sat" : ""} ${off ? "off" : ""}" data-d="${ds}" ${out || off ? "disabled" : ""}>${dd}${off && !out ? `<small>${ui("closedDay")}</small>` : ""}</button>`;
    }
    $("calGrid").innerHTML = h;
    $("calGrid").querySelectorAll("[data-d]").forEach(b => b.onclick = () => { fDate.value = b.dataset.d; if (!slotsFor().includes(fTime.value)) fTime.value = ""; drawCal(); drawSlots(); drawSum(); });
  }
  function drawSlots() {
    if (!fDate.value) { $("slots").innerHTML = `<p class="slot-hint">${ui("pickDateFirst")}</p>`; return; }
    const all = slotsFor();
    const grp = [[ui("am"), all.filter(t => toMin(t) < 720)], [ui("pm"), all.filter(t => toMin(t) >= 720)]].filter(g => g[1].length);
    $("slots").innerHTML = all.length ? grp.map(([n, ts]) => `<div class="slot-g"><h5>${n}</h5><div class="slot-list">${ts.map(t => `<button type="button" class="slot ${t === fTime.value ? "on" : ""}" data-t="${t}">${lang === "ko" ? (h => `${h % 12 || 12}:${t.slice(3)}`)(+t.slice(0, 2)) : fmtTime(t).replace(/ (AM|PM)$/, "")}</button>`).join("")}</div></div>`).join("") : `<p class="slot-hint">${ui("noSlot")}</p>`;
    $("slots").querySelectorAll("[data-t]").forEach(b => b.onclick = () => { fTime.value = b.dataset.t; drawSlots(); drawSum(); setTimeout(() => { $("bkPanel").hidden = true; $("bkSum").classList.remove("open"); }, 180); });
  }
  $("bkSum").onclick = () => { const p = $("bkPanel"); p.hidden = !p.hidden; $("bkSum").classList.toggle("open", !p.hidden); if (!p.hidden) { drawCal(); drawSlots(); } };
  $("calPrev").onclick = () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); drawCal(); };
  $("calNext").onclick = () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); drawCal(); };
  const setPpl = n => { n = Math.max(1, Math.min(10, n)); $("fPeople").value = n; $("pplN").textContent = n; $("pplM").disabled = n <= 1; $("pplP").disabled = n >= 10; };
  $("pplM").onclick = () => setPpl(+$("fPeople").value - 1); $("pplP").onclick = () => setPpl(+$("fPeople").value + 1); setPpl(1);
  fMenu.onchange = () => { if (fTime.value && !slotsFor().includes(fTime.value)) fTime.value = ""; drawSlots(); drawSum(); };
  drawSum();

  document.querySelectorAll(".pick").forEach(btn => btn.onclick = () => {
    fMenu.value = btn.dataset.i; fMenu.onchange();
    $("bookTitle").scrollIntoView({ behavior: "smooth" });
  });

  // 로그인한 손님이면 이름 칸을 미리 채워요
  if (typeof ACCT !== "undefined") ACCT.onUser(u => { const n = form.querySelector('[name="name"]'); if (u && n && !n.value) n.value = ACCT.name(); });
  form.onsubmit = async e => {
    e.preventDefault();
    if (!fDate.value || !fTime.value) { alertBox(ui("pickDTFirst")); $("bkPanel").hidden = false; $("bkSum").classList.add("open"); drawCal(); drawSlots(); $("bkSum").scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    const f = Object.fromEntries(new FormData(form));
    const m = shop.menu[f.menu];
    // 운영자(한국어)가 읽는 메시지
    const msg =
`[예약 요청]
업체: ${shop.name.ko}
메뉴: ${m.name.ko} (${m.min}분, ${m.price ? "₫" + m.price.toLocaleString("en-US") : "상담"})
날짜: ${f.date}  ${f.time}
인원: ${f.people}명
이름: ${f.name}
연락처: ${f.contact}
요청사항: ${f.note || "-"}${f.coupon ? "\n쿠폰: " + f.coupon.toUpperCase() : ""}
고객 언어: ${lang.toUpperCase()}`;

    // 데이터베이스에 바로 접수 → 예약번호와 예약확인증
    if (LIVE.on) {
      const btn = form.querySelector('button[type="submit"]'); btn.disabled = true; btn.textContent = ui("bkSending");
      try {
        const r = await LIVE.rpc("create_booking", { p: { shop_id: shop.id, menu: +f.menu, date: f.date, time: f.time, people: +f.people, name: f.name, contact: f.contact, note: f.note, coupon: f.coupon || "", marketing: f.marketing === "1", lang } });
        const link = `booking.html?v=2#${r.token}`;
        form.hidden = true;
        const done = $("done"); done.hidden = false;
        done.innerHTML = `<h2>✅ ${ui("kAllDone")}</h2>
          <p class="bk-code"><small>${ui("vCode")}</small><b>${esc(r.code)}</b></p>
          <div class="kstep ok"><b>💬 ${ui("chLive")}</b><p>${ui("chLiveDesc")}</p>
            <button class="btn big-btn" type="button" id="bkChat">💬 ${ui("chOpen")}</button></div>
          <a class="btn" href="${link}">${ui("bkVoucher")}</a>`;
        // 예약하는 순간 이 브라우저의 💬 채팅을 이 예약의 대화방으로 바꾸고 바로 열어요 (진행 상황이 실시간으로 쌓여요)
        const openChat = () => { if (typeof CHAT !== "undefined" && CHAT) CHAT.open(); };
        $("bkChat").onclick = openChat;
        LIVE.rpc("chat_get", { bt: r.token }).then(c => {
          if (c && c.token) { try { localStorage.setItem("ud-chat", c.token); } catch (e) {} }
          if (typeof CHAT !== "undefined" && CHAT) { CHAT.poll(true); setTimeout(openChat, 600); }
        }).catch(() => {});
        try { const k = "uncleday-my-bookings"; const a = JSON.parse(localStorage.getItem(k) || "[]"); a.unshift({ code: r.code, token: r.token, shop: shop.id, date: f.date }); localStorage.setItem(k, JSON.stringify(a.slice(0, 20))); } catch (e) {}
        done.scrollIntoView({ behavior: "smooth" });
        return;
      } catch (err) {
        btn.disabled = false; btn.textContent = ui("bookBtn");
        if (err.server) { alertBox(err.message); return; }
      }
    }

    let sent = false;
    if (SITE.formEndpoint) {
      try {
        const r = await fetch(SITE.formEndpoint, {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ message: msg, ...f, shop: shop.id })
        });
        sent = r.ok;
      } catch (err) {}
    }

    const mail = `mailto:${SITE.email}?subject=${encodeURIComponent("[예약 요청] " + shop.name.ko)}&body=${encodeURIComponent(msg)}`;
    form.hidden = true;
    const done = $("done"); done.hidden = false;
    done.innerHTML = `<h2>${ui("doneTitle")}</h2>
      <p>${sent ? ui("doneSent") : LIVE.on ? ui("bkFail") : ui("doneManual")}</p>
      <pre id="msg"></pre>
      ${sent ? "" : `<button class="btn" id="copy">${ui("copy")}</button>
        <a class="btn kakao-link" href="${SITE.kakao}" target="_blank">${ui("viaKakao")}</a>
        <a class="btn" href="${mail}">${ui("viaMail")}</a>`}`;
    $("msg").textContent = msg;
    if ($("copy")) $("copy").onclick = () => {
      navigator.clipboard.writeText(msg).then(() => $("copy").textContent = ui("copied"));
    };
    done.scrollIntoView({ behavior: "smooth" });
  };
  }
}
}

// 브라우저 알림창 대신 쓰는 짧은 안내
function alertBox(t) {
  const d = document.createElement("div"); d.className = "toast-site"; d.textContent = t;
  document.body.appendChild(d); setTimeout(() => d.remove(), 2500);
}

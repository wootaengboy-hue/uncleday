/* 업체 상세 + 예약 요청. 메인 화면 안에서 새로고침 없이 그려요 (shop.html 단독으로도 열려요). */
// 업체 주소는 /s/업체id/ (검색엔진이 읽는 진짜 페이지). 메인 화면 안에서는 눌러도 새로고침 없이 열려요 (app.js)
const shopLink = id => `/s/${encodeURIComponent(id)}/`;

// 업체 화면에서 '상담하기'를 누르면: 이 업체 문의 문구를 보여 주고 복사한 뒤, 카톡을 열어요 (카톡 창에 붙여넣기)
// 🔧 직원 전용: 업체 홈페이지 · 페이스북 버튼 (캐시바이 관리자 '홈페이지' 버튼처럼) — 들어간 내용을 원문과 비교하며 검수 (universe48)
//    손님에게는 안 보여요: 로그인한 사람이 엉클데이 직원일 때만 서버가 링크를 돌려줘요
const STAFF_LK = {};
async function staffLinks(shop) {
  const fill = async () => {
    const box = $("staffLinks"); if (!box || typeof LIVE === "undefined" || !LIVE.on || !window.UD_TOKEN) return;
    let r = STAFF_LK[shop.id];
    if (r === undefined) { try { r = await LIVE.rpc("staff_shop_links", { sid: shop.id }); } catch (e) { r = null; } STAFF_LK[shop.id] = r; }
    if (!r || $("staffLinks") !== box) return;
    const RV = { todo: "정보 검수 대기", done: "정보 검수 완료", skip: "검수 안 함", none: "모아 온 정보 없음" };
    box.innerHTML = `<span class="sl-k">🔧 직원만 보여요</span>${r.web ? `<a class="sl-b" href="${esc(r.web)}" target="_blank" rel="noopener">🌐 홈페이지</a>` : ""}${r.fb ? `<a class="sl-b fb" href="${esc(r.fb)}" target="_blank" rel="noopener">📘 페이스북</a>` : ""}
      ${!r.web && !r.fb ? `<span class="sl-none">등록된 링크 없음</span>` : ""}<span class="sl-st">${RV[r.review] || ""} · 사진 ${r.photo_ok ? "허락 ✓" : "허락 전"}</span><a class="sl-adm" href="admin.html#verify:${encodeURIComponent(shop.id)}">관리자에서 검수 →</a>`;
    box.hidden = false;
  };
  STAFF_LK._cur = fill; fill();
  if (typeof ACCT !== "undefined" && ACCT.onUser && !STAFF_LK._sub) { STAFF_LK._sub = 1; ACCT.onUser(() => { Object.keys(STAFF_LK).forEach(k => { if (k[0] !== "_") delete STAFF_LK[k]; }); STAFF_LK._cur && STAFF_LK._cur(); }); }
}
// 🔎 해시태그: 관리자 검색어 탭에서 '👁 보이기'를 켠 동의어 (universe46) — 한국어 화면에서만
function hashOf(shop) {
  if (typeof lang !== "undefined" && lang !== "ko") return "";
  const x = (window.SEARCH_SYN || []).find(y => y.kind === "shop" && y.target === shop.id);
  const w = ((x && x.shown) || []).filter(Boolean).slice(0, 12); if (!w.length) return "";
  return `<div class="hash-tags" aria-label="이렇게도 찾아요">${w.map(t => `<a class="hash" href="/?q=${encodeURIComponent(t)}">#${esc(t)}</a>`).join("")}</div>`;
}
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
// 🚕 베트남에서 많이 쓰는 다른 차 부르기 앱 (가게 이름 · 로고 그림 없이 글자 버튼만)
// 앱 로고: 주신 로고 파일 (images/ride/ — grab · indrive · maxim · xanhsm)
const RIDE_ICON = "https://is1-ssl.mzstatic.com/image/thumb/";
const GRAB_ICON = RIDE_ICON + "Purple211/v4/b6/ba/e8/b6bae876-ebc9-98f4-6024-ea0bf3ef9379/GrabIcon-0-0-1x_U007emarketing-0-6-0-85-220.png/100x100bb.jpg";
const RIDE_APPS = [
  { id: "indrive", n: "inDrive", c: "#32291E", t: "#fff", logo: 1, pkg: "sinet.startup.inDriver", ios: "https://apps.apple.com/app/id780125801", ic: "Purple221/v4/bf/ae/b6/bfaeb673-c99f-75ce-885d-95c6f9928cd4/AppIcon-0-0-1x_U007ephone-0-1-0-sRGB-85-220.png/100x100bb.jpg" },
  { id: "maxim", n: "Maxim", c: "#F4CD45", t: "#1a1a1a", logo: 1, pkg: "com.taxsee.taxsee", ios: "https://apps.apple.com/app/id579985456", ic: "Purple211/v4/06/38/b1/0638b118-5a7f-96ee-44c8-c3956c0b9d64/AppIcon-0-0-1x_U007epad-0-1-0-sRGB-85-220.png/100x100bb.jpg" },
  { id: "xanhsm", n: "Xanh SM", c: "#67BABE", t: "#fff", logo: 1, pkg: "com.gsm.customer", ios: "https://apps.apple.com/app/id6446425595", ic: "Purple221/v4/4d/d7/1e/4dd71ef3-5dee-a3a9-6a78-4cbfa1fdc9f2/AppIcon-0-0-1x_U007emarketing-0-11-0-85-220.png/100x100bb.jpg" }];
function rideAppLink(a) {
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return a.ios;   // 아이폰: 앱 스토어 화면 (설치돼 있으면 '열기')
  const store = "https://play.google.com/store/apps/details?id=" + a.pkg;   // 안드로이드: 앱 바로 열기 · 없으면 플레이 스토어
  return `intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=${a.pkg};S.browser_fallback_url=${encodeURIComponent(store)};end`;
}
// 🚕 업체 화면에 바로 보이는 차 부르기 버튼 4개 (Grab · inDrive · Maxim · Xanh SM) — 손님이 원하는 앱을 바로 골라요
//  휴대폰: Grab은 목적지가 채워진 채로 열려요 · 나머지는 주소를 복사하고 앱을 열어요 (없으면 설치 화면)
//  PC: 앱을 열 수 없어서 누르면 주소 복사 안내 창이 떠요
const RIDE_ALL = () => [{ id: "grab", n: "Grab", c: "#509A4A" }, ...RIDE_APPS];
function rideRow(shop) {
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent), dst = rideDest(shop);
  return `<div class="ride-row"><small class="rr-h">🚕 ${ui("rideTitle")}</small><div class="rr-btns">${RIDE_ALL().map(a => {
    const inner = `<img src="/images/ride/${a.id}.png?v=1" alt="${a.n}">`, st = `style="--c:${a.c}"`;
    if (!mobile) return `<button type="button" class="rr-b" ${st} data-ride="${a.id}" aria-label="${a.n}">${inner}</button>`;
    return `<a class="rr-b" ${st} data-ride="${a.id}" href="${a.id === "grab" ? grabLink(dst) : rideAppLink(a)}" rel="noopener" aria-label="${a.n}">${inner}</a>`;
  }).join("")}</div></div>`;
}
function rideBind(shop) {
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent), dst = rideDest(shop);
  document.querySelectorAll(".rr-b").forEach(b => b.addEventListener("click", () => {
    if (typeof LIVE !== "undefined" && LIVE.track) LIVE.track("map", shop.id);
    if (!mobile) { openRide(shop); return; }
    let ok = copyText(dst.addr); if (!ok && navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(dst.addr).catch(() => {});
    if (b.dataset.ride !== "grab") alertBox(ui("ridePaste"));
  }));
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
      ${mobile ? `<a class="btn ride-grab" href="${grabLink(dst)}" rel="noopener"><img class="ride-glogo" src="/images/ride/grab.png?v=1" alt="Grab"><span>${ui("rideGrab")}</span></a>` : `<span></span>`}</div>
    ${mobile ? `<div class="ride-apps"><small>${ui("rideOther")}</small><div>${RIDE_APPS.map(a => `<a class="ride-app" style="--c:${a.c};--t:${a.t}" href="${rideAppLink(a)}" rel="noopener" data-app="${a.id}">${a.logo ? `<img class="ride-logo" src="/images/ride/${a.id}.png?v=1" alt="${a.n}">` : `<img class="ride-ic" src="${RIDE_ICON + a.ic}" alt="" onerror="this.remove()"><span>${a.n}</span>`}</a>`).join("")}</div></div>` : ""}
    <p class="ride-etc">${ui(mobile ? "rideEtc2" : "rideEtc")}</p>
    <button type="button" class="ask-close" aria-label="close">✕</button></div>`;
  document.body.appendChild(d);
  const st = ok => { const el = d.querySelector("#rideSt"); el.textContent = ok ? "✅ " + ui("rideCopied") : ui("askCopyFail"); el.className = "ask-st " + (ok ? "ok" : "no"); };
  const doCopy = () => { const ok = copyText(dst.addr); st(ok); if (!ok && navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(dst.addr).then(() => st(true), () => {}); };
  d.querySelector(".ride-copy").onclick = doCopy;
  const g = d.querySelector(".ride-grab"); if (g) g.addEventListener("click", () => { doCopy(); if (typeof LIVE !== "undefined" && LIVE.track) LIVE.track("map", shop.id); });
  // inDrive · Maxim · Xanh SM: 목적지를 채워 여는 공개 방법이 없어서 → 주소를 복사하고 앱을 열어요 (앱이 없으면 스토어)
  d.querySelectorAll(".ride-app").forEach(a => a.addEventListener("click", () => { doCopy(); if (typeof LIVE !== "undefined" && LIVE.track) LIVE.track("map", shop.id); }));
  d.querySelector(".ask-close").onclick = () => d.remove();
  d.onclick = ev => { if (ev.target === d) d.remove(); };
}

function renderShop(id) {
  if (window.UD_VIA === "qr" || /[?&]via=qr\b/.test(location.search)) qrToMenu();   // 가게 QR로 들어오면 한국어 메뉴 · 가격으로 (가게 안 손님의 한국어 메뉴판)
const shop = SHOPS.find(s => s.id === id);
const box = $("detail");
if (shop && typeof LIVE !== "undefined") LIVE.view(shop.id);
document.querySelectorAll(".cta-bar").forEach(e => e.remove());
document.body.classList.remove("has-cta");

if (!shop) {
  box.innerHTML = `<p class="empty">${ui("notFound")}</p><a href="${window.SPA ? "#" : "/"}">${ui("back")}</a>`;
} else {
  // 미리 만든 업체 페이지(s/)의 한국어 제목은 그대로 두고(검색용), 다른 언어로 볼 땐 그 언어 이름 + 다른 이름을 같이
  { const other = lang === "ko" ? (shop.name.en || "") : (shop.name.ko || ""), main = tx(shop.name);
    if (!(window.SHOP_ID && lang === "ko")) document.title = main + (other && other.replace(/\s/g, "").toLowerCase() !== main.replace(/\s/g, "").toLowerCase() ? ` (${other})` : "") + " | " + tx(SITE.name); }
  const cat = catGroup(shop.cat);
  const img = shop.img ? `<img class="hero" src="${shop.img}" alt="" decoding="async" data-fit="${shop.imgFit || ""}" style="object-position:${shop.imgPos || "50% 50%"}">` : phCard(shop, true);
  const closed = shop.closed.length ? shop.closed.map(d => ui("days")[d]).join(", ") : ui("none");
  const staff = shop.staffLangs.length ? shop.staffLangs.map(l => ui("lang_" + l)).join(", ") : ui("tbd");
  const revs = (shop.userReviews || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const avg = revs.length ? (revs.reduce((t, r) => t + r.stars, 0) / revs.length).toFixed(1) : 0;
  const pending = shop.verified === false || !shop.open || !shop.menu.length;   // 정보 미확인 → 예약 폼 대신 상담 버튼
  // 이름이 같은 메뉴(시간만 다른 것)는 하나로 묶어 시간을 골라요 (저장은 시간별 한 줄씩)
  //  분류(m.sec · 예: 스파 / 네일)가 있으면 분류별 제목 아래로 모아요 · 설명(m.desc)은 이름 밑에 작게
  const mSplit = v => { const t = String(v || "").trim(); if (!t) return ["", ""]; const p = t.split(/\s*[>›»]\s*/); return [p[0].trim(), p.slice(1).join(" · ").trim()]; };   // 대분류 · 소분류는 ">"로만 나눠요 ("헤드스파 · 귀 관리"의 "·"는 "와"라서 안 나눠요) · "네일 > 여성" → 대분류 · 소분류
  const mGroups = []; shop.menu.forEach((m, i) => { const n = tx(m.name), sc = tx(m.sec) || ""; let g = mGroups.find(x => x.n === n && x.sc === sc); if (!g) mGroups.push(g = { n, sc, d: "", items: [] }); if (!g.d) g.d = tx(m.desc) || ""; g.items.push(i); });
  const mHasSec = mGroups.some(g => g.sc);
  mGroups.forEach(g => { [g.top, g.sub] = mSplit(g.sc); if (mHasSec && !g.top) g.top = ui("m_other"); });
  if (mHasSec) { const ord = shop.secOrder || [], ko = g => mSplit((shop.menu[g.items[0]].sec || {}).ko || "")[0];   // 관리자가 정한 분류 순서 (없으면 처음 나온 순서)
    const tops = [...new Set(mGroups.slice().sort((a, b) => { const x = ord.indexOf(ko(a)), y = ord.indexOf(ko(b)); return (x < 0 ? 999 : x) - (y < 0 ? 999 : y); }).map(g => g.top))], subs = [...new Set(mGroups.map(g => g.top + "|" + g.sub))];
    mGroups.forEach((g, k) => g.k = k); mGroups.sort((a, b) => tops.indexOf(a.top) - tops.indexOf(b.top) || subs.indexOf(a.top + "|" + a.sub) - subs.indexOf(b.top + "|" + b.sub) || a.k - b.k); }
  const mTops = mHasSec ? [...new Set(mGroups.map(g => g.top))] : [];
  const mSec = (g, k) => !mHasSec ? "" : (k === 0 || mGroups[k - 1].top !== g.top ? `<h3 class="m-sec" data-top="${esc(g.top)}">${esc(g.top)}</h3>` : "") + (g.sub && (k === 0 || mGroups[k - 1].top !== g.top || mGroups[k - 1].sub !== g.sub) ? `<h4 class="m-sub" data-top="${esc(g.top)}">${esc(g.sub)}</h4>` : "");
  const mTabs = () => mTops.length > 1 ? `<div class="m-tabs" role="tablist"><button type="button" class="on" data-mt="">${ui("m_all")}</button>${mTops.map(t => `<button type="button" data-mt="${esc(t)}">${esc(t)}</button>`).join("")}</div>` : "";
  const mDesc = g => g.d ? `<small class="m-desc">${esc(g.d)}</small>` : "";
  const hoursText = shop.open ? `${shop.open} ~ ${shop.close}` : ui("tbd");
  const closedText = shop.open ? closed : ui("tbd");

  const hasPrice = shop.menu.some(m => m.price > 0);
  const pms = promosOn(shop);
  const addrOk = !/확인 중|to be confirmed/i.test(JSON.stringify(shop.address));
  const checks = [
    [ui("address"), addrOk], [ui("hours"), !!shop.open], [ui("price"), hasPrice],
    [ui("staffLangs"), shop.staffLangs.length > 0], [ui("chkConsent"), shop.verified !== false]
  ];
  const facts = [
    ["📍", ui("address"), addrOk ? tx(shop.address) : ui("tbd"), addrOk],
    ["💰", ui("price"), hasPrice ? priceRange(shop) : ui("consultPrice"), hasPrice],
    ["🕒", ui("hours"), shop.open ? `${hoursText} ${openBadge(shop)}<br><small>${ui("closedDays")}: ${closedText}</small>` : ui("tbd"), !!shop.open],
    ["🗣️", ui("staffLangs"), staff, shop.staffLangs.length > 0]
  ];
  // 비슷한 업체: 같은 도시 업체만 (다낭 업체면 다낭만) · 같은 업종 → 같은 큰 분류 → 나머지 순 · 최대 3곳
  const simRank = s => s.cat === shop.cat ? 0 : catGroup(s.cat) === catGroup(shop.cat) ? 1 : 2;
  const similar = SHOPS.filter(s => s.id !== shop.id && s.city === shop.city)
    .sort((a, b) => simRank(a) - simRank(b) || (!!b.best - !!a.best)).slice(0, 3);

  box.innerHTML = `
    <a href="${window.SPA ? "#" : "/"}" class="back">${ui("back")}</a>
    ${img}
    <div class="head">
      <div class="chips"><span class="tag cat-tag">${cat ? cat.icon + " " + tx(cat.name) : ""}</span>
        <span class="tag">📍 ${cityName(shop.city)}</span>
        ${shop.rating ? `<span class="tag">⭐ ${shop.rating} (${shop.reviews})</span>` : ""}
        ${openBadge(shop)}${pmBadge(shop)}${ocBadge(shop)}${ptsBadge(shop)}<span id="spdBadge"></span>
        <button type="button" class="tag share-btn" id="shareBtn">🔗 ${ui("shareBtn")}</button></div>
      <h1>${tx(shop.name)}${shop.best ? ` <span class="best-badge"><i>✦</i>${ui("certBadge")}<i>✦</i></span>` : ""}</h1>
      <div class="tags">${shop.tags.map(t => `<span class="tag">#${tx(t)}</span>`).join("")}</div>
      ${hashOf(shop)}
      <div class="staff-links" id="staffLinks" hidden></div>
    </div>

    <h2>${ui("overview")}</h2>
    <div class="facts">${facts.map(f => `
      <div class="fact ${f[3] ? "" : "tbd"}"><span class="fi">${f[0]}</span><div><small>${f[1]}</small><b>${f[2]}</b></div></div>`).join("")}
    </div>
    <p class="go-row">${shop.map ? `<a class="map-link" href="${shop.map}" target="_blank">🗺️ ${ui("map")}</a>` : ""}</p>
    ${rideRow(shop)}
    <div id="gBox"></div>
    ${guideBar(shop.city, "in-shop")}
    <div id="shopHi"></div>
    <div id="shopGal"></div>

    <h2>${ui("about")}</h2><p>${tx(shop.desc)}</p>
    ${shop.recommend && tx(shop.recommend) ? `<p class="reco">👍 <b>${ui("recoFor")}</b> ${tx(shop.recommend)}</p>` : ""}
    <div id="shopTrust"></div>

    ${shop.menu.length ? `<h2>${ui("menu")}</h2>
    ${pms.length ? `<div class="pm-box"><b class="pm-h">${ui("pm_title")}</b><ul>${pms.map(p => `<li>${esc(pmLine(p, shop))}</li>`).join("")}</ul><small>${ui("pm_note")}</small></div>` : ""}
    ${mTabs()}<div id="menuList">${mGroups.map((g, k) => { if (g.items.length > 1) return `${mSec(g, k)}
      <div class="menu-row menu-grp" data-top="${esc(g.top || "")}"><div class="mg-h"><b>${esc(g.n)}</b><small>${ui("mgPick")}</small></div>${mDesc(g)}
      <div class="mg-opts">${g.items.map(i => { const m = shop.menu[i], pf = promoFor(shop, i), cut = pf && pf.cut; return `<${pending ? "span" : "button type=\"button\""} class="mg-opt${pending ? "" : " pick"}" data-i="${i}"><span class="mg-t">${m.min ? `${m.min} ${ui("min")}` : "-"}</span>${cut ? `<s>₫${m.price.toLocaleString("en-US")}</s>` : ""}${(t => { const k = t.indexOf(" ("); return k < 0 ? `<b>${t}</b>` : `<b>${t.slice(0, k)}</b><small class="mg-ap">${t.slice(k + 1)}</small>`; })(money(cut ? pf.price : m.price))}${cut ? `<span class="pm-tag">${esc(pmTag(pf.p))}</span>` : ""}${extrasFor(shop, i).map(x => `<small class="mg-x">+ ${esc(x.n)} ₫${x.v.toLocaleString("en-US")}</small>`).join("")}</${pending ? "span" : "button"}>`; }).join("")}</div></div>`;
      const i = g.items[0], m = shop.menu[i], pf = promoFor(shop, i); return `${mSec(g, k)}
      <div class="menu-row${pf && pf.cut ? " pm-row" : ""}" data-top="${esc(g.top || "")}"><div><b>${tx(m.name)}</b>${m.min ? `<br><small>${m.min} ${ui("min")}</small>` : ""}${mDesc(g)}</div>
      <div class="price${pf && pf.cut ? " pm" : ""}">${pf && pf.cut ? `<s>₫${m.price.toLocaleString("en-US")}</s><span class="pm-tag">${esc(pmTag(pf.p))}</span><br>${money(pf.price)}` : money(m.price)}${extrasFor(shop, i).map(x => `<br><small class="mg-x">+ ${esc(x.n)} ₫${x.v.toLocaleString("en-US")}</small>`).join("")}</div>
      ${pending ? "" : `<button class="chip pick" data-i="${i}">${ui("bookBtn")}</button>`}</div>`; }).join("")}
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
      ${shop.menu.length ? `<label>${ui("rvMenu")}<select name="menu"><option value="">-</option>${mGroups.map(g => `<option>${esc(g.n)}</option>`).join("")}</select></label>` : ""}
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
    <p class="find-hint" ${pending ? "hidden" : ""}>${ui("vAlready")} <a href="booking.html">🔎 ${ui("vFind")}</a></p>
    <form id="form" class="form" ${pending ? "hidden" : ""}>
      <label>${ui("fMenu")}<select name="menu" id="fMenu">${(() => { const op = (i, lb) => { const m = shop.menu[i]; return `<option value="${i}">${lb} – ${(pf => pf && pf.cut ? money(pf.price) + " 🎁" : money(m.price))(promoFor(shop, i))}</option>`; };
        const ops = g => g.items.map(i => op(i, g.items.length > 1 || shop.menu[i].min ? `${esc(g.n)} · ${shop.menu[i].min || "-"} ${ui("min")}` : esc(g.n))).join("");
        // 분류가 있으면 분류(스파 · 네일 · 여성 …)로 묶고, 없으면 시간만 다른 메뉴끼리 묶어요
        if (mHasSec) { const secs = []; mGroups.forEach(g => { const k = g.top + (g.sub ? " · " + g.sub : ""); let x = secs.find(y => y.k === k); if (!x) secs.push(x = { k, gs: [] }); x.gs.push(g); });
          return secs.map(x => `<optgroup label="${esc(x.k)}">${x.gs.map(ops).join("")}</optgroup>`).join(""); }
        return mGroups.map(g => g.items.length > 1 ? `<optgroup label="${esc(g.n)}">${ops(g)}</optgroup>` : op(g.items[0], tx(shop.menu[g.items[0]].name))).join(""); })()}</select></label>
      <p class="pm-est" id="pmEst" hidden></p>
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
      <div class="bk-total" id="bkTotal" hidden></div>
      <button class="btn big-btn" type="submit">${ui("bookBtn")}</button>
      <small>${ui("notice")}</small>
    </form>
    <div id="done" class="done" hidden></div>`;
  if (typeof gplaceBox === "function") gplaceBox(shop);
  if (typeof shopRich === "function") shopRich(shop);
  rideBind(shop);
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
    if (sent && shop.gplace && typeof grvHtml === "function") { d.insertAdjacentHTML("beforeend", grvHtml(lang)); grvBind(d, { gplace: shop.gplace, text: f.text, shopId: shop.id, lg: lang }); }
    if ($("rvCopy")) $("rvCopy").onclick = () => navigator.clipboard.writeText(msg).then(() => $("rvCopy").textContent = ui("copied"));
    d.scrollIntoView({ behavior: "smooth" });
  };

  // 공유하기: 카톡·네이버에서 미리보기가 예쁘게 나오는 공유 전용 주소
  // ⚡ 실제 기록으로 본 예약 확정 속도 (3건 이상일 때만)
  if (!pending) shopSpeed().then(sp => { const el = document.getElementById("spdBadge"), t = speedText(sp && sp[shop.id]); if (el && t) el.outerHTML = `<span class="spd-b">${t}</span>`; });
  staffLinks(shop);
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
  // 사장님 페이지에서 정한 영업시간·휴무·막은 시간·남은 자리 (없으면 업체 정보의 open/close/closed 그대로)
  let AV = null;
  const avKey = (ds, t) => ds + "|" + t;
  const avWeek = ds => AV && AV.managed && AV.week ? AV.week[(new Date(ds + "T00:00:00").getDay() + 6) % 7] : null;
  const avClosed = (ds, t) => !!AV && (AV.closures || []).some(c => c.day === ds && (t == null ? c.slot == null : c.slot === t));
  if (typeof LIVE !== "undefined" && LIVE.on && shop.id) LIVE.rpc("shop_availability", { shop: shop.id, d1: ymd(first), d2: ymd(last) }).then(r => { AV = r; if (!$("bkPanel").hidden) { drawCal(); drawSlots(); } }).catch(() => {});
  const dayOff = ds => { const w = avWeek(ds); return (w ? !!w.closed : (shop.closed || []).includes(new Date(ds + "T00:00:00").getDay())) || avClosed(ds, null); };
  const fmtTime = t => { const m = toMin(t), h = Math.floor(m / 60), mm = String(m % 60).padStart(2, "0"); return lang === "ko" ? `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${mm}` : lang === "vi" ? `${h}:${mm}` : `${h % 12 || 12}:${mm} ${h < 12 ? "AM" : "PM"}`; };
  const fmtDate = ds => { const x = new Date(ds + "T00:00:00"), w = ui("days")[x.getDay()]; return lang === "ko" ? `${x.getMonth() + 1}.${x.getDate()}(${w})` : lang === "vi" ? `${w}, ${x.getDate()}/${x.getMonth() + 1}` : `${w}, ${x.toLocaleString("en-US", { month: "short" })} ${x.getDate()}`; };
  function slotsFor() {
    const dur = shop.menu[fMenu.value].min || 60, out = [], ds = fDate.value, w = ds ? avWeek(ds) : null;
    const open = w ? w.open : shop.open, close = w ? w.close : shop.close;
    if (!open || !close || (ds && dayOff(ds))) return out;
    const ppl = +($("fPeople") ? $("fPeople").value : 1) || 1, cap = AV ? +AV.capacity || 4 : 99;
    const nowVN = Date.now() + 7 * 3600e3, cut = AV ? (+AV.cutoff_min || 0) * 60e3 : 0;
    for (let t = toMin(open); t + dur <= toMin(close); t += 30) {
      if (ds && AV) {
        if (Date.parse(ds + "T" + toStr(t) + ":00Z") < nowVN + cut) continue;                 // 예약 마감 시간 전
        let ok = true;
        for (let k = t; k < t + Math.max(dur, 30); k += 30) {                                  // 시술 시간 동안 막힌 칸·자리 확인
          const key = avKey(ds, toStr(k));
          if (avClosed(ds, toStr(k)) || ((AV.left || {})[key] != null ? AV.left[key] : cap) < ppl) { ok = false; break; }
        }
        if (!ok) continue;
      }
      out.push(toStr(t));
    }
    return out;
  }
  function drawSum() {
    $("bkSumT").textContent = fDate.value && fTime.value ? `${fmtDate(fDate.value)} ${fmtTime(fTime.value)}` : fDate.value ? `${fmtDate(fDate.value)} · ${ui("pickTime")}` : ui("pickDT");
    $("bkSum").classList.toggle("set", !!(fDate.value && fTime.value));
    const n = +$("fPeople").value || 1, pe = $("pmEst"), pf = pe && promoFor(shop, +fMenu.value, fDate.value || undefined, { ppl: n, tm: fTime.value || "" });   // 🎁 고른 날짜 · 메뉴 · 인원 · 시간의 할인
    const ex = extrasFor(shop, +fMenu.value), base = pf ? pf.price : (shop.menu[+fMenu.value] || {}).price || 0;
    // 💡 아직 조건이 안 맞는 더 큰 조건 할인 (예: 2인 이상 20% · 11:00~13:00 40%)
    const mi = +fMenu.value, m0 = shop.menu[mi] || {}, nowCut = pf ? pf.cut || 0 : 0;
    const tips = promosOn(shop, fDate.value || undefined).filter(p => pmCond(p) && pmFits(p, mi) && !pmOk(p, { ppl: n, tm: fTime.value || "" }) && pmCut(p, m0.price) > nowCut).sort((a, b) => (+a.ppl || 1) - (+b.ppl || 1) || pmCut(b, m0.price) - pmCut(a, m0.price)).slice(0, 2);   // 가까운 조건(적은 인원) 먼저
    if (pe) { pe.hidden = !pf && !ex.length && !tips.length; const L = [];
      if (pf) L.push("🎁 " + pmLine(pf.p, shop) + (pf.cut && !ex.length ? " → " + ui("pm_est") + ": " + money(pf.price * n) : ""));
      tips.forEach(p => L.push("💡 " + pmLine(p, shop)));
      pe.textContent = L.join("\n"); pe.style.whiteSpace = "pre-line"; pe.hidden = !L.length; }
    // 🧾 예상 결제 금액 (가격이 정해진 메뉴만 · 상담 후 안내 메뉴는 안 보여요)
    const bt = $("bkTotal"), list = +m0.price || 0;
    if (bt) { bt.hidden = !list; if (list) { const f = v => "₫" + Math.round(v).toLocaleString("en-US"), cut = pf && pf.cut ? pf.cut : 0, exs = ex.reduce((a, x) => a + x.v, 0), tot = (list - cut + exs) * n;
      bt.innerHTML = `<b class="bt-h">🧾 ${ui("tot_title")}</b>
        <div class="bt-r"><span>${esc(tx(m0.name))}${m0.min ? ` · ${m0.min} ${ui("min")}` : ""}</span><span>${f(list)}${n > 1 ? ` × ${n}` : ""} = ${f(list * n)}</span></div>
        ${cut ? `<div class="bt-r cut"><span>🎁 ${esc(pmName(pf.p) || ui("tot_disc"))} (${esc(pmTag(pf.p))})</span><span>− ${f(cut * n)}</span></div>` : ""}
        ${ex.map(x => `<div class="bt-r ex"><span>+ ${esc(x.n)} <small>${ui("ex_noDisc")}</small></span><span>${f(x.v)}${n > 1 ? ` × ${n}` : ""} = ${f(x.v * n)}</span></div>`).join("")}
        <div class="bt-r sum"><span>${ui("tot_sum")}</span><span>${money(tot)}</span></div>
        <small class="bt-n">${ui("tot_note")}</small>`; } }
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
  const setPpl = n => { n = Math.max(1, Math.min(10, n)); $("fPeople").value = n; $("pplN").textContent = n; $("pplM").disabled = n <= 1; $("pplP").disabled = n >= 10;
    if (AV && fDate.value) { if (fTime.value && !slotsFor().includes(fTime.value)) { fTime.value = ""; drawSum(); } if (!$("bkPanel").hidden) drawSlots(); } };
  $("pplM").onclick = () => { setPpl(+$("fPeople").value - 1); drawSum(); }; $("pplP").onclick = () => { setPpl(+$("fPeople").value + 1); drawSum(); }; setPpl(1);
  fMenu.onchange = () => { if (fTime.value && !slotsFor().includes(fTime.value)) fTime.value = ""; drawSlots(); drawSum();
    document.querySelectorAll(".mg-opt").forEach(b => b.classList.toggle("on", b.dataset.i === fMenu.value)); };
  drawSum();

  document.querySelectorAll(".pick").forEach(btn => btn.onclick = () => {
    fMenu.value = btn.dataset.i; fMenu.onchange();
    $("bookTitle").scrollIntoView({ behavior: "smooth" });
  });

  // 로그인한 손님이면 이름 칸을 미리 채워요
  // 로그인한 손님: 이름과 (있으면) 이메일을 예약 폼에 미리 채워요. 손님이 바꿀 수 있어요
  if (typeof ACCT !== "undefined") ACCT.onUser(u => { if (!u) return; const n = form.querySelector('[name="name"]'), c = form.querySelector('[name="contact"]');
    if (n && !n.value) n.value = ACCT.name(); if (c && !c.value && u.email) c.value = u.email; });
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

function qrToMenu() {
  if (qrToMenu.done) return; qrToMenu.done = true;
  setTimeout(() => { const m = $("menuList"); if (!m) return; const t = m.previousElementSibling || m, hd = document.querySelector("header");
    window.scrollTo({ top: Math.max(0, t.getBoundingClientRect().top + scrollY - (hd ? hd.getBoundingClientRect().height : 0) - 12), behavior: "smooth" }); }, 600);
}

// 브라우저 알림창 대신 쓰는 짧은 안내
function alertBox(t) {
  const d = document.createElement("div"); d.className = "toast-site"; d.textContent = t;
  document.body.appendChild(d); setTimeout(() => d.remove(), 2500);
}

// 메뉴 분류 탭 (전체 · 스파 · 네일 …) — 화면을 다시 그려도, 다른 곳에서 오류가 나도 늘 작동하게 문서 전체에서 받아요
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest(".m-tabs [data-mt]"); if (!b) return;
  const t = b.dataset.mt, list = document.getElementById("menuList"); if (!list) return;
  document.querySelectorAll(".m-tabs [data-mt]").forEach(x => x.classList.toggle("on", x === b));
  list.querySelectorAll("[data-top]").forEach(el => { const hide = !!t && el.dataset.top !== t; el.hidden = hide; el.style.display = hide ? "none" : ""; });
});

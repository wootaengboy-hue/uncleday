/* 메인 페이지를 그려주는 파일. 내용 수정은 data.js에서 하세요. */
window.SPA = true;
const HOME_TITLE = document.title;
const state = { cat: "", city: "all", q: "", from: null, fromName: "" };
// 도시 모아보기(c/<도시>/)에서 들어오면 그 도시를 먼저 보여 줘요: /?city=danang
try { const qc = new URLSearchParams(location.search).get("city"); if (qc && typeof CITIES !== "undefined" && CITIES.some(c => c.id === qc)) state.city = qc; } catch (e) {}

// 두 지점 사이 거리(km)
const distKm = (a, b) => {
  const R = 6371, r = x => x * Math.PI / 180;
  const dLa = r(b[0] - a[0]), dLo = r(b[1] - a[1]);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const distText = km => km < 1 ? Math.round(km * 1000 / 50) * 50 + "m" : km < 100 ? km.toFixed(1) + "km" : Math.round(km) + "km";

// 가까운 순 정렬 칸
function drawNear() {
  const places = PLACES.filter(p => state.city === "all" || p.city === state.city);
  const groups = CITIES.filter(c => places.some(p => p.city === c.id));
  const sel = state.fromName && state.fromName !== "me" ? state.fromName : "";
  $("near").innerHTML = `
    <button class="chip near-me ${state.fromName === "me" ? "on" : ""}" id="nearMe" type="button">${ui("nearBtn")}</button>
    <select id="nearPlace" class="near-sel">
      <option value="">${ui("nearPick")}</option>
      ${groups.map(c => `<optgroup label="${tx(c.name)}">${places.filter(p => p.city === c.id).map(p =>
        `<option value="${PLACES.indexOf(p)}" ${String(PLACES.indexOf(p)) === sel ? "selected" : ""}>${tx(p.name)}</option>`).join("")}</optgroup>`).join("")}
    </select>
    ${state.from ? `<button class="chip" id="nearOff" type="button">${ui("nearOff")}</button>` : ""}
    <div class="near-msg" id="nearMsg">${state.from ? (state.fromName === "me" ? ui("nearFromMe") : ui("nearFromPlace", { p: tx(PLACES[+state.fromName].name) })) + ` · <small>${ui("nearApprox")}</small>` : ""}</div>`;
  $("nearPlace").onchange = e => {
    const v = e.target.value;
    if (v === "") { state.from = null; state.fromName = ""; }
    else { const p = PLACES[+v]; state.from = p.geo; state.fromName = v; state.city = p.city; drawCities(); }
    drawNear(); drawShops();
  };
  if ($("nearOff")) $("nearOff").onclick = () => { state.from = null; state.fromName = ""; drawNear(); drawShops(); };
  $("nearMe").onclick = () => {
    const msg = t => { $("nearMsg").textContent = t; };
    if (!navigator.geolocation) { msg(ui("nearFail")); return; }
    msg(ui("nearWait"));
    try {
      navigator.geolocation.getCurrentPosition(
        pos => { state.from = [pos.coords.latitude, pos.coords.longitude]; state.fromName = "me"; drawNear(); drawShops(); },
        () => msg(ui("nearFail")),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
    } catch (e) { msg(ui("nearFail")); }
  };
}
document.title = HOME_TITLE;
drawCommon();

// 배너 (4초마다 전환)
let b = 0;
function showBanner() {
  const x = BANNERS[b];
  $("banner").style.background = x.color;
  $("banner").innerHTML = `<h1>${tx(x.title)}</h1><p>${tx(x.desc)}</p>`;
  b = (b + 1) % BANNERS.length;
}
// 배너 이미지가 정해져 있으면 그 이미지를 보여주고, 없으면 글자 배너를 돌려요
if (typeof BANNER_IMG !== "undefined" && BANNER_IMG) {
  $("banner").classList.add("img-banner");
  $("banner").innerHTML = `<img src="${BANNER_IMG}" alt="${tx(SITE.name)} - Today is your special day">`;
} else { showBanner(); setInterval(showBanner, 4000); }

function drawCities() {
  const all = [{ id: "all", name: ui("all") }, ...CITIES];
  $("cities").innerHTML = all.map(c =>
    `<button class="chip ${c.id === state.city ? "on" : ""}" data-c="${c.id}">${tx(c.name)}</button>`).join("");
  $("cities").querySelectorAll("button").forEach(el =>
    el.onclick = () => {
      state.city = el.dataset.c;
      if (!$("detail").hidden) location.hash = "";
      // 다른 도시를 고르면 그 도시와 맞지 않는 기준 장소는 해제
      if (state.from && state.fromName !== "me" && state.city !== "all" && PLACES[+state.fromName].city !== state.city) { state.from = null; state.fromName = ""; }
      drawCities(); drawNear(); drawShops(); });
}

function drawCats() {
  const gImg = c => catImg(c.id) || c.members.map(catImg).find(Boolean) || "";
  $("catGrid").classList.toggle("two", CATEGORIES.length <= 3);
  $("catGrid").innerHTML = CATEGORIES.length <= 3
    // 묶음 카테고리: 사진이 카드 전체를 채우고 글자는 사진 위에
    ? CATEGORIES.map(c => { const n = SHOPS.filter(s => catGroup(s.cat).id === c.id).length;
        return `<button class="cat-hero ${c.id === state.cat ? "on" : ""} cat-${c.id}" data-id="${c.id}"${gImg(c) ? ` style="background-image:url('${gImg(c)}')"` : ""}>
          <span class="ch-shade"></span><span class="ch-txt"><b>${tx(c.name)}</b><small>${tx(c.desc)}</small></span>
          ${n ? "" : `<span class="ch-cnt">${ui("soon")}</span>`}${c.id === state.cat ? `<span class="ch-on">✓</span>` : ""}</button>`; }).join("")
    : CATEGORIES.map(c =>
    `<button class="cat ${c.id === state.cat ? "on" : ""} ${gImg(c) ? "has-img" : ""}" data-id="${c.id}">${gImg(c) ? `<i class="cat-img" style="background-image:url('${gImg(c)}')"></i>` : `<span>${c.icon}</span>`}<b class="cat-n">${tx(c.name)}</b>${c.desc ? `<small class="cat-d">${tx(c.desc)}</small>` : ""}${SHOPS.some(s => catGroup(s.cat).id === c.id) ? "" : `<em class="soon">${ui("soon")}</em>`}</button>`).join("");
  $("catGrid").querySelectorAll("button").forEach(el => el.onclick = () => {
    state.cat = state.cat === el.dataset.id ? "" : el.dataset.id;
    drawCats(); drawShops();
  });
  const cur = CATEGORIES.find(c => c.id === state.cat);
  $("subs").innerHTML = cur ? cur.sub.map(s => `<span class="chip">${tx(s)}</span>`).join("") : "";
}

function drawShops() {
  // 검색: 띄어쓰기·대소문자·베트남어 성조 무시, 여러 단어는 모두 들어간 업체만
  const norm = t => String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/\s+/g, "");
  const words = state.q.split(/\s+/).map(norm).filter(Boolean);
  const full = norm(state.q);
  const textOf = s => {
    const cat = catDetail(s.cat) || {}, grp = catGroup(s.cat);
    const city = CITIES.find(c => c.id === s.city) || {};
    return norm(JSON.stringify([s.name, s.tags, s.menu.map(m => m.name), s.desc, s.recommend, s.address, cat.name, cat.sub, grp.name, city.name]));
  };
  // 검색어 전체가 그대로 들어간 업체가 있으면 그것만, 없으면 단어별로 모두 들어간 업체
  const wholeHit = full && SHOPS.some(s => textOf(s).includes(full));
  const list = SHOPS.slice().sort((a, b) => (b.best ? 1 : 0) - (a.best ? 1 : 0)).filter(s => {
    const text = textOf(s);
    return (!state.cat || catGroup(s.cat).id === state.cat) &&
           (state.city === "all" || s.city === state.city) &&
           (!full || (wholeHit ? text.includes(full) : words.every(w => text.includes(w))));
  });
  const cur = CATEGORIES.find(c => c.id === state.cat);
  $("shopTitle").textContent = cur ? ui("shopsOf", { n: tx(cur.name) }) : ui("recommend");
  const card = s => {
    const img = s.img ? `<img src="${s.img}" alt="" loading="lazy" decoding="async" style="object-position:${s.imgPos || "50% 50%"}">` : phCard(s);
    return `<a class="shop ${s.best ? "is-best" : ""}" href="${shopLink(s.id)}"><div class="shop-media">${img}${s.best ? `<span class="best-badge"><i>✦</i>${ui("certBadge")}<i>✦</i></span>` : ""}</div><div class="info">
      <b>${tx(s.name)}</b>
      ${s.rating ? `<div class="rate"><span class="rate-stars">${stars(Math.round(s.rating))}</span><b>${(+s.rating).toFixed(1)}</b><small>(${s.reviews})</small></div>` : ""}
      <div class="meta">${state.from && s.geo ? `<b class="dist">📍 ${distText(distKm(state.from, s.geo))}</b> · ` : ""}${cityName(s.city)}</div>
      <div class="price">${priceFrom(s)}</div>
      <div class="tags card-tags">${s.tags.map(t => `<span class="tag">${tx(t)}</span>`).join("")}</div>
    </div></a>`;
  };
  const grid = arr => `<div class="shop-grid">${arr.map(card).join("")}</div>`;
  // 도시를 골랐고 그 도시 안내 글이 있으면 목록 위에 띠 하나
  const gb = $("cityGuide"); if (gb) gb.innerHTML = state.city !== "all" ? guideBar(state.city) : "";
  if (!list.length) { $("shopGrid").innerHTML = `<p class="empty">${state.q ? ui("empty") : ui("comingSoon")}</p>`; return; }
  // 카테고리를 고르지 않았으면 카테고리별로 묶어서 보여줘요
  if (state.from) {
    const far = list.filter(s => !s.geo);
    const near = list.filter(s => s.geo).sort((a, b) => distKm(state.from, a.geo) - distKm(state.from, b.geo));
    $("shopGrid").innerHTML = grid(near.concat(far));
    return;
  }
  if (!state.cat) {
    $("shopGrid").innerHTML = CATEGORIES.map(c => {
      const arr = list.filter(s => catGroup(s.cat).id === c.id);
      return arr.length ? `<h3 class="cat-title">${c.icon} ${tx(c.name)} <small>${arr.length}</small></h3>${grid(arr)}` : "";
    }).join("");
  } else {
    $("shopGrid").innerHTML = grid(list);
  }
}

$("search").oninput = e => { state.q = e.target.value.trim(); if (!$("detail").hidden) location.hash = ""; drawShops(); };

$("steps").innerHTML = STEPS.map(s => `<div class="card"><div class="big">${s.icon}</div><b>${tx(s.title)}</b><p>${tx(s.desc)}</p></div>`).join("");
// 이용 후기: 업체별로 게시된 후기 중 최신 6개 (없으면 칸을 숨겨요)
function drawReviews() {
  const allRevs = SHOPS.flatMap(s => (s.userReviews || []).map(r => ({ ...r, shop: s })))
    .sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 6);
  $("reviews").closest("section").hidden = !allRevs.length;
  $("reviews").innerHTML = allRevs.map(r => `<a class="card rv-home" href="${shopLink(r.shop.id)}">
    <div class="rv-stars">${stars(r.stars)}</div><p>${esc(r.text.length > 90 ? r.text.slice(0, 90) + "…" : r.text)}</p>
    <small>${esc(r.name)} · ${esc(tx(r.shop.name))}</small></a>`).join("");
}
drawReviews();
$("faq").innerHTML = FAQ.map(f => `<details><summary>${tx(f.q)}</summary><p>${tx(f.a)}</p></details>`).join("");

drawCities(); drawNear(); drawCats(); drawShops();

// ---------- 화면 전환: 업체를 누르면 새로고침 없이 상세 화면으로, 뒤로 가면 보던 위치로
let homeY = 0;
document.addEventListener("click", e => {
  const a = e.target.closest('a[href^="/s/"], a[href^="#/shop/"]'); if (!a) return;
  if ($("detail").hidden) homeY = window.scrollY;
  const m = a.getAttribute("href").match(/^\/s\/([^/]+)\/$/);
  if (m && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0 && a.target !== "_blank") { e.preventDefault(); location.hash = "#/shop/" + m[1]; }
}, true);
function route() {
  const m = location.hash.match(/^#\/shop\/(.+)$/);
  if (m) {
    $("home").hidden = true; $("detail").hidden = false;
    renderShop(decodeURIComponent(m[1]));
    window.scrollTo(0, 0);
  } else {
    if ($("detail").hidden) return;
    $("detail").hidden = true; $("detail").innerHTML = "";
    document.querySelectorAll(".cta-bar").forEach(e => e.remove());
    document.body.classList.remove("has-cta");
    $("home").hidden = false; document.title = HOME_TITLE;
    window.scrollTo(0, homeY);
  }
}
addEventListener("hashchange", route);
route();

// 데이터베이스에서 새 정보가 오면 화면을 다시 그려요
window.onLiveUpdate = () => {
  drawCats(); drawShops(); drawReviews();
  const m = location.hash.match(/^#\/shop\/(.+)$/);
  if (m && !document.querySelector("#detail form:not([hidden]) input:focus, #detail textarea:focus")) renderShop(decodeURIComponent(m[1]));
};

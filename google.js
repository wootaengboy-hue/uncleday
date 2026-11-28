/* 업체 상세페이지의 '구글 지도 정보' (영업시간·평점·사진·지도)
   - 지도(Maps Embed)는 구글 무료(무제한)
   - 영업시간·평점·사진은 하루 30회까지만 불러와요 (구글 월 무료 한도 1,000회 안에서만 쓰도록) */
const GPLACE = (() => {
  const on = () => typeof GMAPS !== "undefined" && GMAPS.key;
  const memo = {};                      // 이 페이지를 보는 동안만 기억해요 (저장하지 않아요)
  async function take(kind) {
    if (typeof LIVE === "undefined" || !LIVE.on || LIVE.bot) return false;   // 검색 로봇은 구글 정보를 안 불러와요 (무료 횟수 아끼기)
    try { return await LIVE.rpc("gquota_take", { k: kind }); } catch (e) { return false; }
  }
  async function details(id) {
    if (memo[id] !== undefined) return memo[id];
    if (!(await take("details"))) return (memo[id] = null);
    try {
      const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?languageCode=${lang === "zh" ? "zh-CN" : lang}`, {
        headers: { "X-Goog-Api-Key": GMAPS.key, "X-Goog-FieldMask": "rating,userRatingCount,regularOpeningHours,photos,googleMapsUri,formattedAddress,reviews,googleMapsLinks" } });
      memo[id] = r.ok ? await r.json() : null;
    } catch (e) { memo[id] = null; }
    return memo[id];
  }
  return { on, details, take };
})();

function gplaceBox(shop) {
  const box = document.getElementById("gBox");
  if (!box || !shop.gplace || !GPLACE.on()) return;
  const id = shop.gplace;
  box.innerHTML = `<div class="g-box"><div class="g-head"><b>${ui("gTitle")}</b><small>${ui("gNote")}</small></div>
    <div id="gRevs"></div>
    <div class="g-info" id="gInfo"></div>
    <iframe class="g-map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen
      src="https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(GMAPS.key)}&q=place_id:${encodeURIComponent(id)}&language=${lang === "zh" ? "zh-CN" : lang}"></iframe></div>`;
  GPLACE.details(id).then(async d => {
    const el = document.getElementById("gInfo"); if (!el) return;
    // 오늘 무료 횟수(하루 30번)를 다 썼거나 못 불러오면 → 숫자 대신 구글 지도 후기 링크 (링크는 무료 · 횟수 제한 없음 · 구글 정보는 저장하지 않아요)
    if (!d) { const nm = (shop.name && (shop.name.en || shop.name.vi || shop.name.ko)) || "";
      el.innerHTML = `<a class="g-rev" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nm)}&query_place_id=${encodeURIComponent(id)}" target="_blank" rel="noopener">${esc(ui("gRev"))} →</a>`; return; }
    gReviews(d, shop);
    let html = "";
    if (d.rating && !document.querySelector("#gRevs .gr")) html += `<div class="g-rate">★ <b>${d.rating.toFixed(1)}</b> <span>(${(d.userRatingCount || 0).toLocaleString()})</span> <small>Google</small></div>`;
    const days = d.regularOpeningHours && d.regularOpeningHours.weekdayDescriptions;
    // 우리 주소가 비어 있으면 구글 주소를 보여 줘요 (화면에만)
    const addrEmpty = !shop.address || !Object.values(shop.address).some(v => v && v.trim());
    if (addrEmpty && d.formattedAddress) {
      const f = [...document.querySelectorAll(".fact")].find(x => (x.querySelector(".fi") || {}).textContent === "📍");
      if (f) { f.classList.remove("tbd"); f.querySelector("b").innerHTML = `${esc(d.formattedAddress)}<br><small>${esc(ui("gAddrNote"))}</small>`; }
    }
    // 우리 영업시간이 비어 있으면 '한눈에 보기'의 영업시간 칸에 구글 기준 오늘 시간을 보여 줘요 (저장하지 않고 화면에만)
    if (days && days.length === 7 && !shop.open) {
      const f = [...document.querySelectorAll("#detail .fact, .fact")].find(x => (x.querySelector(".fi") || {}).textContent === "🕒");
      if (f) {
        const vnDay = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })).getDay();
        const today = days[(vnDay + 6) % 7], t = today.slice(today.indexOf(":") + 1).trim() || today;
        f.classList.remove("tbd");
        f.querySelector("b").innerHTML = `${esc(ui("gToday"))} ${esc(t)}<br><small>${esc(ui("gHoursNote"))}</small>`;
      }
    }
    if (days && days.length) html += `<details class="g-hours"><summary>🕒 ${ui("gHours")}</summary><ul>${days.map(x => `<li>${esc(x)}</li>`).join("")}</ul></details>`;
    // 업체 사진이 없을 때만 구글 사진 한 장 (사진도 하루 30회까지만)
    const ph = !shop.img && d.photos && d.photos[0];
    if (ph && await GPLACE.take("photo")) {
      const who = (ph.authorAttributions || []).map(a => `<a href="${esc(a.uri || "#")}" target="_blank" rel="noopener">${esc(a.displayName || "")}</a>`).join(", ");
      html = `<figure class="g-photo"><img src="https://places.googleapis.com/v1/${esc(ph.name)}/media?maxWidthPx=600&key=${encodeURIComponent(GMAPS.key)}" alt="" loading="lazy"><figcaption>📷 ${who || "Google"} · Google</figcaption></figure><div class="g-side">${html}</div>`;
      el.classList.add("has-photo");
    }
    if (d.googleMapsUri && !el.classList.contains("has-photo")) html += `<a class="g-more" href="${esc(d.googleMapsUri)}" target="_blank" rel="noopener">${ui("gMore")} →</a>`;
    el.innerHTML = html;
    if (d.googleMapsUri && el.classList.contains("has-photo")) el.querySelector(".g-side").insertAdjacentHTML("beforeend", `<a class="g-more" href="${esc(d.googleMapsUri)}" target="_blank" rel="noopener">${ui("gMore")} →</a>`);
  });
}

// ⭐ 구글 리뷰 카드 — 구글에서 그때그때 받아 화면에만 보여 줘요 (저장 · 그림으로 떠 두기 안 함 · 구글 표시 · 작성자 링크 그대로)
function gReviews(d, shop) {
  const el = document.getElementById("gRevs"); if (!el) return;
  const rv = (d.reviews || []).filter(r => (r.text || r.originalText)).slice(0, 5);
  if (!d.rating && !rv.length) return;
  const all = (d.googleMapsLinks && d.googleMapsLinks.reviewsUri) || d.googleMapsUri || "";
  const star = n => `<span class="gr-st" aria-label="${n}">${"★".repeat(Math.round(n || 0))}<i>${"★".repeat(5 - Math.round(n || 0))}</i></span>`;
  const G = `<span class="gr-g" aria-label="Google"><b style="color:#4285F4">G</b><b style="color:#EA4335">o</b><b style="color:#FBBC05">o</b><b style="color:#4285F4">g</b><b style="color:#34A853">l</b><b style="color:#EA4335">e</b></span>`;
  el.innerHTML = `<div class="gr">
    <div class="gr-h"><div>${G} <b class="gr-t">${esc(ui("gRvTitle"))}</b><div class="gr-sum">${d.rating ? `<b>${d.rating.toFixed(1)}</b> ${star(d.rating)} <small>(${(d.userRatingCount || 0).toLocaleString()})</small>` : ""}</div></div>
      ${all ? `<a class="gr-all" href="${esc(all)}" target="_blank" rel="noopener">${esc(ui("gRvAll"))} ↗</a>` : ""}</div>
    ${rv.length ? `<div class="gr-list" id="grList">${rv.map(r => { const a = r.authorAttribution || {}, t = (r.text && r.text.text) || (r.originalText && r.originalText.text) || "";
      return `<article class="gr-c"><div class="gr-a">${a.photoUri ? `<img src="${esc(a.photoUri)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="gr-av">${esc((a.displayName || "?").slice(0, 1))}</span>`}
        <div><a href="${esc(a.uri || all || "#")}" target="_blank" rel="noopener"><b>${esc(a.displayName || "Google user")}</b></a><div>${star(r.rating)} <small>${esc(r.relativePublishTimeDescription || "")}</small></div></div></div>
        <p>${esc(t)}</p></article>`; }).join("")}</div>
      <div class="gr-dots">${rv.map((_, i) => `<i data-i="${i}" class="${i ? "" : "on"}"></i>`).join("")}</div>` : ""}
    <small class="gr-note">${esc(ui("gRvNote"))}</small></div>`;
  const L = el.querySelector("#grList"); if (!L) return;
  const dots = [...el.querySelectorAll(".gr-dots i")];
  L.addEventListener("scroll", () => { const w = L.firstElementChild.offsetWidth + 10, i = Math.round(L.scrollLeft / w); dots.forEach((x, k) => x.classList.toggle("on", k === i)); }, { passive: true });
  dots.forEach(x => x.onclick = () => L.scrollTo({ left: (+x.dataset.i) * (L.firstElementChild.offsetWidth + 10), behavior: "smooth" }));
}

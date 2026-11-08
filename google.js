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
      const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?languageCode=${lang === "vi" ? "vi" : lang === "en" ? "en" : "ko"}`, {
        headers: { "X-Goog-Api-Key": GMAPS.key, "X-Goog-FieldMask": "rating,userRatingCount,regularOpeningHours,photos,googleMapsUri,formattedAddress" } });
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
    <div class="g-info" id="gInfo"></div>
    <iframe class="g-map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen
      src="https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(GMAPS.key)}&q=place_id:${encodeURIComponent(id)}&language=${lang === "vi" ? "vi" : lang === "en" ? "en" : "ko"}"></iframe></div>`;
  GPLACE.details(id).then(async d => {
    const el = document.getElementById("gInfo"); if (!el || !d) { if (el) el.remove(); return; }
    let html = "";
    if (d.rating) html += `<div class="g-rate">★ <b>${d.rating.toFixed(1)}</b> <span>(${(d.userRatingCount || 0).toLocaleString()})</span> <small>Google</small></div>`;
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

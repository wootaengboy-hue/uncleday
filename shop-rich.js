/* ✨ 업체 페이지를 덜 심심하게 — ① 이 가게의 좋은 점 (태그 → 그림 카드) ② 📸 사진 모음 (검수 통과한 사진만) ③ 엉클데이로 예약하면 (안심 포인트)
 *  · 가게 사진은 허락받은 것만: 현장 직원 · 사장님 사진 중 이미지 검수 '통과' (supabase/universe61.sql)
 *  · 다른 사이트 사진 · 구글 사진은 저장하지 않아요
 */
const RICH_ICONS = [
  [/짐|luggage|hành lý/i, "🧳"], [/샤워|shower|tắm/i, "🚿"], [/픽업|샌딩|pickup|airport|sân bay|đón/i, "🚐"], [/욕조|bathtub|bồn/i, "🛁"],
  [/사우나|스팀|찜질|sauna|steam|xông/i, "♨️"], [/자쿠지|jacuzzi/i, "🫧"], [/커플|couple/i, "💑"], [/개별 ?룸|private room|phòng riêng/i, "🚪"],
  [/키즈|아이|kids|trẻ/i, "🧸"], [/임산부|pregnan|bầu/i, "🤰"], [/팁|tip/i, "💵"], [/비치|해변|beach|biển/i, "🏖️"], [/전망|view/i, "🌅"],
  [/시장|market|chợ|마트|mart|롯데|lotte/i, "📍"], [/한국인|korean owner|chủ người hàn|사장/i, "🙋"], [/한국어|korean|tiếng hàn|통역|interpreter|영어|english/i, "🗣️"],
  [/헤드스파|head spa|gội/i, "💆"], [/네일|nail|móng/i, "💅"], [/무료 ?(첫 )?상담|free (first |online )?consult|tư vấn/i, "💬"], [/무료|free|miễn phí/i, "🎁"],
  [/할인|discount|giảm|해피아워|happy hour/i, "🏷️"], [/년|years|since|năm/i, "🏅"], [/원장|의사|doctor|bác sĩ|surgeon/i, "🩺"], [/병원|hospital|bệnh viện/i, "🏥"],
  [/천연|natural|thiên nhiên/i, "🌿"], [/허브|herbal|thảo dược|쑥|mugwort/i, "🌿"], [/대나무|bamboo|tre/i, "🎋"], [/식사|meal|bữa/i, "🍽️"],
  [/리조트|resort|발리|bali/i, "🌴"], [/포핸|four.?hand|bốn tay/i, "👐"], [/족욕|foot|chân/i, "🦶"], [/피부|skin|da|facial|페이셜/i, "✨"],
  [/여드름|acne|mụn|기미|melasma|nám/i, "🧴"], [/필러|보톡스|filler|botox|하이푸|hifu|리프팅|lift/i, "💉"], [/성형|rhinoplasty|eyelid|쌍꺼풀|v-?line|안면거상|facelift/i, "🩺"],
  [/왁싱|wax/i, "🪒"], [/커트|컷|염색|펌|매직|cut|color|perm|hair|tóc/i, "💇"], [/밤|until|đến 2/i, "🌙"], [/후기|reviews|đánh giá/i, "⭐"], [/새|신축|new/i, "🆕"],
  [/시내|center|trung tâm|올드쿼터|old quarter|phố cổ|군|district|quận|서호|west lake|타오디엔|thao dien|탄케|thanh khe|떤빈|tan binh/i, "📍"]];
const richIcon = t => (RICH_ICONS.find(([re]) => re.test(t)) || [, "✨"])[1];

function shopRich(shop) {
  // ① 이 가게의 좋은 점
  const hi = document.getElementById("shopHi");
  if (hi && shop.tags && shop.tags.length) {
    hi.innerHTML = `<h2>${ui("richHi")}</h2><div class="rh-grid">${shop.tags.slice(0, 6).map(t => { const s = tx(t); return `<div class="rh-c"><span class="rh-ic">${richIcon(s + " " + (t.ko || "") + " " + (t.en || ""))}</span><b>${esc(s)}</b></div>`; }).join("")}</div>`;
  }
  // ③ 엉클데이로 예약하면 (안심 포인트)
  const tr = document.getElementById("shopTrust");
  if (tr) tr.innerHTML = `<div class="rt"><h3>${ui("richTrustH")}</h3><div class="rt-grid">${[["💸", "richT1", "richT1d"], ["💬", "richT2", "richT2d"], shop.verified !== false && shop.open ? ["✅", "richT3", "richT3d"] : null, ["💳", "richT4", "richT4d"]].filter(Boolean)
    .map(([i, a, b]) => `<div class="rt-c"><span>${i}</span><div><b>${ui(a)}</b><small>${ui(b)}</small></div></div>`).join("")}</div></div>`;
  // ② 사진 모음 (검수 통과한 가게 사진 2장 이상일 때만)
  const ga = document.getElementById("shopGal");
  if (!ga || typeof LIVE === "undefined" || !LIVE.on) return;
  LIVE.rpc("shop_photos", { p_shop: shop.id }).then(rows => { rows = Array.isArray(rows) ? rows : [];
    const seen = new Set(), urls = [];
    (rows || []).forEach(r => { const k = String(r.url || "").replace(/-w\.(jpg|webp)$/, ""); if (r.url && !seen.has(k)) { seen.add(k); urls.push(r.url); } });
    if (shop.img && !urls.some(u => u === shop.img)) urls.unshift(shop.img);
    if (urls.length < 2) return;
    const more = urls.length > 5 ? urls.length - 5 : 0;
    ga.innerHTML = `<div aria-label="${esc(ui("richGal"))}" class="rg ${urls.length >= 3 ? "big" : ""}">${urls.slice(0, 5).map((u, i) => `<button type="button" class="rg-i" data-gi="${i}" aria-label="photo ${i + 1}"><img src="${esc(u)}" alt="" loading="lazy" decoding="async" onerror="this.parentNode.style.display='none'">${i === 4 && more ? `<span class="rg-more">+${more}</span>` : ""}</button>`).join("")}</div>`;
    ga.querySelectorAll("[data-gi]").forEach(b => b.onclick = () => richLightbox(urls, +b.dataset.gi));
  }).catch(() => {});
}
function richLightbox(urls, i) {
  const lb = document.createElement("div"); lb.className = "lightbox";
  const show = () => {
    lb.innerHTML = `<button class="lb-x" aria-label="close">✕</button>${urls.length > 1 ? `<button class="lb-nav lb-prev" aria-label="prev">‹</button><button class="lb-nav lb-next" aria-label="next">›</button>` : ""}
      <div class="lb-body"><img src="${esc(urls[i])}" alt=""></div><div class="lb-cap"><small>${i + 1} / ${urls.length}</small></div>`;
    lb.querySelector(".lb-x").onclick = () => { lb.remove(); removeEventListener("keydown", key); };
    if (urls.length > 1) { lb.querySelector(".lb-prev").onclick = e => { e.stopPropagation(); i = (i - 1 + urls.length) % urls.length; show(); }; lb.querySelector(".lb-next").onclick = e => { e.stopPropagation(); i = (i + 1) % urls.length; show(); }; }
  };
  const key = e => { if (e.key === "Escape") { lb.remove(); removeEventListener("keydown", key); } else if (e.key === "ArrowRight" && urls.length > 1) { i = (i + 1) % urls.length; show(); } else if (e.key === "ArrowLeft" && urls.length > 1) { i = (i - 1 + urls.length) % urls.length; show(); } };
  let sx = null; lb.addEventListener("touchstart", e => { sx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", e => { if (sx == null || urls.length < 2) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) { i = (i + (dx < 0 ? 1 : -1) + urls.length) % urls.length; show(); } sx = null; });
  addEventListener("keydown", key); show(); document.body.appendChild(lb);
}

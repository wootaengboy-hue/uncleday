/* 📋 가게 정보 채우기 — 포털 안 (#ptFill)
 * 업체마다 검색 · AI 에 중요한 정보가 얼마나 채워졌는지 100점 만점으로 보여 주고, 빈 칸을 바로 고치러 가게 해요.
 *  - 사진 · 가격 · 후기 · 소개 · 영업시간 · 정확한 위치 · 3개 언어 이름 · 주소 · 특징 태그
 *  - 빈 칸 → 업체 편집 창 / 💰 가격 채우기 / 후기 요청으로 바로 이동
 *  - 사장님께 '빈 칸 채워 주세요' 요청문 (베트남어 · 한국어). 사진은 '엉클데이에 올려도 된다'는 허락을 같이 받아요.
 *  - 후기 요청: 다녀간 손님 중 후기 · 안부 메시지가 아직 없는 예약 → 예약 화면과 같은 안부(별점) 메시지
 */
const FIL = { city: "", n: 12, open: null, rq: false };
const FIL_ITEMS = [
  // [키, 이름, 점수, 확인, 왜 중요한지, 고치는 곳]
  ["img", "📷 대표 사진", 20, s => !!s.img, "사진 없는 업체는 검색 · 지도 · 공유 미리보기에 기본 그림만 떠서 눌러 보는 사람이 크게 줄어요", "edit"],
  ["price", "💰 메뉴 가격", 20, s => (s.menu || []).some(m => +m.price > 0), "가격 페이지 · 블로그 · AI 답변이 모두 실제 가격으로 만들어져요", "price"],
  ["rv", "⭐ 손님 후기", 15, s => (s.userReviews || []).length > 0, "후기가 있으면 구글 검색 결과에 별점이 붙을 수 있어요", "review"],
  ["desc", "📝 소개 글", 10, s => ((s.desc || {}).ko || "").trim().length >= 40, "구글 · AI 가 이 가게를 설명할 때 쓰는 글이에요 (40자 이상)", "edit"],
  ["hours", "🕘 영업시간", 10, s => !!(s.open && s.close), "'지금 영업 중' · '늦게까지 하는 곳' 검색에 나와요", "edit"],
  ["geo", "📍 정확한 위치", 10, s => !!(s.geo && s.geo[0]) && !s.geoApprox, "블로그 '○○ 근처' 거리 계산 · 지도에 쓰여요 (지금은 대략 위치)", "edit"],
  ["names", "🔤 이름 3개 언어", 5, s => !!(s.name && s.name.ko && s.name.en && s.name.vi), "'Clover Spa'든 '클로버 스파'든 어느 말로 찾아도 나오게 해요", "edit"],
  ["addr", "🏠 주소", 5, s => !!(s.address && (s.address.ko || s.address.en || s.address.vi)), "구글 지도 · 검색의 가게 정보와 맞춰져요", "edit"],
  ["tags", "🏷️ 특징 태그 3개+", 5, s => (s.tags || []).length >= 3, "'커플룸' · '한국어' · '공항 샌딩' 같은 검색어에 걸려요", "edit"],
];
const filName = s => (s.name && (s.name.ko || s.name.en || s.name.vi)) || s.id;
function filScore(s) { const miss = FIL_ITEMS.filter(it => !it[3](s)); return { score: 100 - miss.reduce((a, it) => a + it[2], 0), miss }; }
const filLive = () => shops.filter(s => !(typeof META !== "undefined" && META[s.id] && META[s.id].published === false));

// 사장님께 보낼 요청문
function filMsg(s, miss, lang) {
  const k = new Set(miss.map(m => m[0])), nm = (s.name && (s.name.vi || s.name.en || s.name.ko)) || s.id;
  if (lang === "vi") {
    const L = [];
    if (k.has("img")) L.push("📷 3–5 ảnh đẹp của cửa hàng (mặt tiền, phòng, quầy). Anh/chị gửi ảnh nghĩa là đồng ý cho Uncle Day đăng trên trang của cửa hàng.");
    if (k.has("price")) L.push("💰 Ảnh bảng giá / menu (giá từng dịch vụ, thời gian)");
    if (k.has("hours")) L.push("🕘 Giờ mở cửa – đóng cửa, ngày nghỉ");
    if (k.has("geo") || k.has("addr")) L.push("📍 Link Google Maps của cửa hàng (để vị trí chính xác)");
    if (k.has("desc") || k.has("tags")) L.push("✨ Điểm nổi bật của cửa hàng (ví dụ: phòng đôi, nhân viên nói tiếng Hàn, đưa đón sân bay, giữ hành lý…)");
    if (k.has("names")) L.push("🔤 Tên cửa hàng chính xác (tiếng Việt / tiếng Anh)");
    if (!L.length) return `Chào anh/chị! Thông tin của ${nm} trên Uncle Day đã đầy đủ rồi. Cảm ơn anh/chị! 🙏`;
    return `Chào anh/chị! Để ${nm} hiện lên tốt hơn trên Google và với khách Hàn Quốc, Uncle Day cần thêm vài thông tin:\n\n${L.map((x, i) => `${i + 1}) ${x}`).join("\n")}\n\nAnh/chị chỉ cần gửi qua Zalo này, Uncle Day sẽ cập nhật giúp. Không mất phí. Cảm ơn anh/chị! 🙏`;
  }
  const L = [];
  if (k.has("img")) L.push("📷 가게 사진 3~5장 (입구 · 룸 · 카운터). 보내 주시면 엉클데이 가게 페이지에 올려도 된다는 뜻으로 받을게요.");
  if (k.has("price")) L.push("💰 가격표 · 메뉴판 사진 (시술별 가격 · 시간)");
  if (k.has("hours")) L.push("🕘 여는 시간 · 닫는 시간 · 쉬는 날");
  if (k.has("geo") || k.has("addr")) L.push("📍 가게 구글 지도 링크 (정확한 위치용)");
  if (k.has("desc") || k.has("tags")) L.push("✨ 가게 자랑거리 (예: 커플룸, 한국어 직원, 공항 샌딩, 짐 보관…)");
  if (k.has("names")) L.push("🔤 정확한 가게 이름 (베트남어 · 영어)");
  if (!L.length) return `[엉클데이] ${filName(s)} 정보가 모두 채워져 있어요. 감사합니다! 🙏`;
  return `[엉클데이] ${filName(s)} 사장님, 구글 검색과 한국 손님께 더 잘 보이도록 몇 가지만 부탁드려요.\n\n${L.map((x, i) => `${i + 1}) ${x}`).join("\n")}\n\n이 잘로로 보내 주시면 저희가 대신 올려 드려요. 비용은 없어요. 감사합니다! 🙏`;
}

// 후기 요청 대상: 다녀간 지 60일 안, 후기 없음, 안부 메시지도 아직 안 보낸 예약
function filRvTargets() {
  const B = (typeof BOOKINGS !== "undefined" ? BOOKINGS : []) || [];
  const done = new Set(((typeof RVS !== "undefined" && RVS) || []).map(r => r.booking_id).filter(Boolean));
  const sent = typeof FOLLOWED !== "undefined" ? FOLLOWED : new Set();
  const d0 = Date.now() - 60 * 864e5;
  return B.filter(b => ["visited", "settled"].includes(b.status) && !done.has(b.id) && !sent.has(b.id) && b.customer_token
    && new Date(b.visited_at || b.visit_date || b.updated_at).getTime() >= d0)
    .sort((a, b) => String(b.visit_date || "").localeCompare(String(a.visit_date || "")));
}

function fillDraw() {
  const el = document.getElementById("ptFill"); if (!el || typeof shops === "undefined") return;
  const live = filLive(), cs = (typeof CITIES !== "undefined" ? CITIES : []).filter(c => live.some(s => s.city === c.id));
  const all = live.map(s => ({ s, ...filScore(s) }));
  const avg = L => L.length ? Math.round(L.reduce((a, x) => a + x.score, 0) / L.length) : 0;
  const have = (L, key) => L.filter(x => !x.miss.some(m => m[0] === key)).length;
  const pool = all.filter(x => !FIL.city || x.s.city === FIL.city);
  // 빈 칸 수가 많은 순 → 같은 점수면 이름순
  const list = pool.filter(x => x.score < 100).sort((a, b) => a.score - b.score || filName(a.s).localeCompare(filName(b.s)));
  const rv = filRvTargets();
  const kpi = FIL_ITEMS.slice(0, 3).concat([FIL_ITEMS[5]]).map(it => { const n = have(pool, it[0]); const pct = pool.length ? Math.round(n / pool.length * 100) : 0;
    return `<div class="fil-k"><small>${it[1]}</small><b>${n}<span>/${pool.length}</span></b><span class="bar"><i style="width:${pct}%"></i></span></div>`; }).join("");
  el.innerHTML = `<p class="hint" style="margin-top:0">업체마다 검색 · AI 에 중요한 정보가 얼마나 채워졌는지 <b>100점 만점</b>으로 보여 줘요. 빈 칸을 누르면 바로 고치는 곳으로 가요. 고친 내용은 1시간 안에 업체 페이지 · 블로그 · 가격 페이지에 자동으로 들어가요.</p>
    <div class="prc-cities"><button class="prc-city ${!FIL.city ? "on" : ""}" data-fcity=""><b>전체 · 평균 ${avg(all)}점</b><span class="bar"><i style="width:${avg(all)}%"></i></span><small>업체 ${all.length}곳 · 100점 ${all.filter(x => x.score === 100).length}곳</small></button>
      ${cs.map(c => { const L = all.filter(x => x.s.city === c.id); return `<button class="prc-city ${FIL.city === c.id ? "on" : ""}" data-fcity="${c.id}"><b>${esc(c.name.ko || c.id)} · 평균 ${avg(L)}점</b><span class="bar"><i style="width:${avg(L)}%"></i></span><small>업체 ${L.length}곳 · 100점 ${L.filter(x => x.score === 100).length}곳</small></button>`; }).join("")}</div>
    <div class="fil-kpi">${kpi}</div>
    <div class="fil-rv ${rv.length ? "" : "zero"}"><button class="fil-rvh" data-frv><b>⭐ 후기 요청할 손님 ${rv.length}명</b><small>다녀간 지 60일 안 · 후기도 안부 메시지도 아직 없는 예약</small><span>${FIL.rq ? "▲" : "▼"}</span></button>
      ${FIL.rq ? (rv.length ? `<div class="fil-rvl">${rv.slice(0, 20).map(b => `<div class="fil-rvr"><span><b>${esc(b.customer_name || "손님")}</b> · ${esc((shops.find(x => x.id === b.shop_id) && filName(shops.find(x => x.id === b.shop_id))) || b.shop_name || "")}<small>${esc(b.visit_date || "")} · ${esc(b.code || "")} · ${{ ko: "🇰🇷", en: "🇬🇧", vi: "🇻🇳" }[b.lang] || ""}</small></span><button class="btn sm main" data-frvc="${esc(b.id)}">📋 안부 · 별점 메시지 복사</button></div>`).join("")}</div>
        <p class="hint">복사한 메시지를 손님께 (카톡 · 잘로 · 채팅) 보내면 '보냄'으로 기록돼서 목록에서 빠져요. 예약 화면의 '안부 메시지'와 같은 문구예요.</p>` : `<p class="hint" style="padding:0 12px 10px">지금은 요청할 손님이 없어요 🎉</p>`) : ""}</div>
    <div class="fil-list">${list.slice(0, FIL.n).map(({ s, score, miss }) => { const open = FIL.open === s.id;
      return `<div class="fil-shop ${open ? "open" : ""}"><div class="fil-h"><button class="fil-name" data-fopen="${esc(s.id)}"><b>${esc(filName(s))}</b><small>${esc((cs.find(c => c.id === s.city) || { name: {} }).name.ko || s.city || "")}</small></button>
        <span class="fil-sc ${score >= 80 ? "ok" : score >= 50 ? "mid" : "low"}">${score}점</span></div>
        <div class="fil-miss">${miss.map(m => `<button data-ffix="${m[5]}" data-id="${esc(s.id)}" title="${esc(m[4])}">${m[1]} <em>+${m[2]}</em></button>`).join("")}</div>
        ${open ? `<div class="fil-body">${miss.map(m => `<div><b>${m[1]}</b> <small>${esc(m[4])}</small></div>`).join("")}
          <div class="br-cats" style="margin:8px 0 6px"><button class="on" data-fl="vi">🇻🇳 베트남어</button><button data-fl="ko">🇰🇷 한국어</button></div>
          <textarea class="fil-msg" rows="9" readonly>${esc(filMsg(s, miss, "vi"))}</textarea>
          <div class="crl-act"><button class="btn sm main" data-fcopy>📋 사장님께 요청문 복사</button><button class="btn sm" data-ffix="edit" data-id="${esc(s.id)}">✏️ 업체 창 열기</button></div></div>` : `<button class="fil-more" data-fopen="${esc(s.id)}">사장님께 요청문 ▼</button>`}</div>`; }).join("") || `<p class="hint">🎉 모든 업체가 100점이에요.</p>`}</div>
    ${list.length > FIL.n ? `<button class="btn sm" data-fmore style="margin-top:8px">더 보기 (${list.length - FIL.n}곳 더)</button>` : ""}`;
  el.querySelectorAll("[data-fcity]").forEach(b => b.onclick = () => { FIL.city = b.dataset.fcity; FIL.n = 12; FIL.open = null; fillDraw(); });
  el.querySelectorAll("[data-fmore]").forEach(b => b.onclick = () => { FIL.n += 30; fillDraw(); });
  el.querySelectorAll("[data-fopen]").forEach(b => b.onclick = () => { FIL.open = FIL.open === b.dataset.fopen ? null : b.dataset.fopen; fillDraw(); });
  el.querySelectorAll("[data-frv]").forEach(b => b.onclick = () => { FIL.rq = !FIL.rq; fillDraw(); });
  el.querySelectorAll("[data-fl]").forEach(b => b.onclick = () => { const box = b.closest(".fil-shop"), s = live.find(x => x.id === FIL.open); if (!s) return;
    box.querySelectorAll("[data-fl]").forEach(x => x.classList.toggle("on", x === b)); box.querySelector(".fil-msg").value = filMsg(s, filScore(s).miss, b.dataset.fl); });
  el.querySelectorAll("[data-fcopy]").forEach(b => b.onclick = () => portalCopy(b.closest(".fil-shop").querySelector(".fil-msg").value));
  el.querySelectorAll("[data-ffix]").forEach(b => b.onclick = () => {
    const id = b.dataset.id, w = b.dataset.ffix;
    if (w === "price" && typeof priceDraw === "function") { PRC.open = id; PRC.only = false; PRC.city = ""; PRC.q = filName(shops.find(x => x.id === id) || {}); priceDraw(); document.getElementById("ptPriceSec").scrollIntoView({ behavior: "smooth" }); return; }
    if (w === "review") { FIL.rq = true; fillDraw(); document.querySelector(".fil-rv").scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    if (typeof openEditor === "function") openEditor(id);
  });
  el.querySelectorAll("[data-frvc]").forEach(b => b.onclick = async () => {
    const bk = (BOOKINGS || []).find(x => x.id === b.dataset.frvc); if (!bk || typeof followMsg !== "function") return;
    await portalCopy(followMsg(bk));
    try { await logEvent(bk.id, "sent_followup", { lang: bk.lang, via: "portal" }); FOLLOWED.add(bk.id); } catch (e) {}
    fillDraw();
  });
}

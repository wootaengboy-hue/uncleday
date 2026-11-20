/* 모든 페이지가 같이 쓰는 도구(언어 전환, 가격 표시). 보통 수정할 일 없어요. */
const $ = id => document.getElementById(id);

// 현재 언어 결정: 주소의 ?lang= → 저장된 값 → 브라우저 언어
let lang = (() => {
  const ids = LANGS.map(l => l.id);
  let v = null;
  try { v = v || localStorage.getItem("lang"); } catch (e) {}
  try { const q = new URLSearchParams(location.search).get("lang"); if (q && ids.includes(q)) { v = q; localStorage.setItem("lang", q); } } catch (e) {}
  if (!v) { const n = navigator.language || ""; v = /^zh-(TW|HK|MO|Hant)/i.test(n) ? "zh-TW" : n.slice(0, 2); }
  return ids.includes(v) ? v : ids.includes("en") && v !== "ko" ? "en" : "ko";
})();
document.documentElement.lang = lang;

// 언어별 글자 꺼내기 (없으면 영어 → 한국어)
// 도시별 안내 글 (c/<도시>/guide/). 새 가이드를 만들면 여기에 한 줄 추가해요 (tools/guides.py 와 같이)
const CITY_GUIDES = {
  danang: { ko: "다낭 마사지 가이드", en: "Da Nang massage guide", vi: "Cẩm nang massage Đà Nẵng" },
  nhatrang: { ko: "나트랑 마사지 가이드", en: "Nha Trang massage guide", vi: "Cẩm nang massage Nha Trang" },
  hcm: { ko: "호치민 마사지 가이드", en: "Ho Chi Minh massage guide", vi: "Cẩm nang massage TP.HCM" },
  hanoi: { ko: "하노이 마사지 가이드", en: "Hanoi massage guide", vi: "Cẩm nang massage Hà Nội" },
};
const guideBar = (city, cls) => { const g = CITY_GUIDES[city]; if (!g) return "";
  return `<a class="guide-bar ${cls || ""}" href="${lang === "ko" ? "" : "/en"}/c/${city}/guide/"><span class="gb-ic">📘</span><span><b>${ui("guide_" + city)}</b><small>${ui("guideSub")}</small></span><span class="gb-go">›</span></a>`; };
const tx = v => (v && typeof v === "object" && !Array.isArray(v)) ? (v[lang] || v.en || v.ko || "") : (v ?? "");
const ui = (k, vars = {}) => {
  let s = (UI[lang] && UI[lang][k]) ?? UI.en[k] ?? UI.ko[k] ?? k;
  if (typeof s === "string") for (const x in vars) s = s.replace("{" + x + "}", vars[x]);
  return s;
};

// 가격: ₫450,000 (약 ₩24,700)
function money(vnd) {
  if (!vnd) return ui("consultPrice");
  let s = "₫" + vnd.toLocaleString("en-US");
  const r = SITE.rates[lang];
  if (r) {
    const v = Math.round(vnd * r.rate / r.round) * r.round;
    s += ` (${ui("approx")} ${r.symbol}${v.toLocaleString("en-US")})`;
  }
  return s;
}
const priceFrom = shop => {
  const ps = shop.menu.map(m => m.price).filter(p => p > 0);
  return ps.length ? money(Math.min(...ps)) + " ~" : ui("consultPrice");
};

// 🟢 지금 영업 중? — 베트남 시간(UTC+7) 기준 · 자정 넘어 끝나는 가게(예: 10:00 ~ 02:00)도 맞게
function openInfo(shop) {
  if (!shop || !shop.open || !shop.close) return null;
  const pm = t => { const [h, m] = String(t).split(":").map(Number); return (h || 0) * 60 + (m || 0); };
  const now = new Date(Date.now() + 7 * 36e5), d = now.getUTCDay(), m = now.getUTCHours() * 60 + now.getUTCMinutes();
  const o = pm(shop.open); let c = pm(shop.close); if (c <= o) c += 1440;
  const off = day => (shop.closed || []).includes(day), hm = x => { x = ((x % 1440) + 1440) % 1440; return String(Math.floor(x / 60)).padStart(2, "0") + ":" + String(x % 60).padStart(2, "0"); };
  if (!off(d) && m >= o && m < c) return { open: true, soon: c - m <= 60, until: hm(c) };
  const yd = (d + 6) % 7;
  if (c > 1440 && !off(yd) && m + 1440 < c) return { open: true, soon: c - 1440 - m <= 60, until: hm(c) };
  if (off(d)) return { open: false, off: true };
  if (m < o) return { open: false, at: hm(o) };
  return { open: false, done: true };
}
function openBadge(shop) {
  const i = openInfo(shop); if (!i) return "";
  if (i.open) return `<span class="op ${i.soon ? "op-soon" : "op-on"}">${i.soon ? ui("op_soon", { t: i.until }) : ui("op_now") + " · " + ui("op_until", { t: i.until })}</span>`;
  return `<span class="op op-off">${i.off ? ui("op_off") : i.at ? ui("op_before", { t: i.at }) : ui("op_closed")}</span>`;
}
const isOpenNow = shop => { const i = openInfo(shop); return !!(i && i.open); };
// 💸 포인트 적립 표시 (비율은 업체와 협의되면 SITE.ptsRate 로 숫자 표시) · 예약 가능한 업체에만
const ptsOn = shop => shop && shop.verified !== false && shop.open && shop.menu && shop.menu.length;
const ptsBadge = shop => ptsOn(shop) ? `<span class="pts-b" title="${esc(ui("pts_hint"))}">${SITE.ptsRate ? ui("pts_badgeN", { p: SITE.ptsRate }) : ui("pts_badge")}</span>` : "";
const ocBadge = shop => shop && shop.outcall ? `<span class="oc-b">${ui("oc_badge")}</span>` : "";
// ⚡ 업체별 예약 확정 속도 (universe35 shop_speed · 실제 기록 3건 이상인 업체만)
let SHOP_SPEED = null;
function shopSpeed() {
  if (SHOP_SPEED) return SHOP_SPEED;
  try { const c = JSON.parse(sessionStorage.getItem("ud-shop-speed") || "null"); if (c) return (SHOP_SPEED = Promise.resolve(c)); } catch (e) {}
  SHOP_SPEED = (typeof LIVE !== "undefined" && LIVE.on ? LIVE.rpc("shop_speed", {}) : Promise.resolve({})).then(j => { j = j || {}; try { sessionStorage.setItem("ud-shop-speed", JSON.stringify(j)); } catch (e) {} return j; }).catch(() => ({}));
  return SHOP_SPEED;
}
function speedText(sp) {
  if (!sp || !(sp.n >= 3) || sp.min == null) return "";
  const m = Math.max(1, +sp.min);
  return m <= 60 ? ui("sp_min", { n: m }) : m <= 12 * 60 ? ui("sp_hr", { n: Math.ceil(m / 60) }) : "";
}

// 📲 홈 화면에 추가 (앱처럼) — 안드로이드 · 크롬은 설치 창, 아이폰은 Safari 안내 문구
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); window.UD_BIP = e; pwaBtn(); });
if ("serviceWorker" in navigator) { try { navigator.serviceWorker.register("/sw.js").catch(() => {}); } catch (e) {} }
function pwaBtn() {
  const fp = document.getElementById("footPriv"); if (!fp) return;
  const standalone = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && /safari/i.test(navigator.userAgent) && !/crios|fxios|kakaotalk|naver|instagram|fban/i.test(navigator.userAgent);
  let w = document.getElementById("pwaWrap");
  if (standalone || !(window.UD_BIP || ios)) { if (w) w.remove(); return; }
  if (!w) { w = document.createElement("div"); w.id = "pwaWrap"; w.className = "pwa-wrap"; fp.after(w); }
  w.innerHTML = `<button type="button" class="pwa-btn">${ui("pwa_btn")}</button><small>${ui("pwa_desc")}</small><p class="pwa-ios" hidden>${ui("pwa_ios")}</p>`;
  w.querySelector(".pwa-btn").onclick = async () => {
    if (window.UD_BIP) { const e = window.UD_BIP; window.UD_BIP = null; try { e.prompt(); await e.userChoice; } catch (er) {} pwaBtn(); }
    else w.querySelector(".pwa-ios").hidden = false;
  };
}

// 공통 머리글/바닥글 채우기
function drawCommon() {
  document.querySelectorAll("[data-i18n]").forEach(e => e.textContent = ui(e.dataset.i18n));
  document.querySelectorAll("[data-i18n-ph]").forEach(e => e.placeholder = ui(e.dataset.i18nPh));
  $("siteName").innerHTML = `<img class="logo-full" src="images/logo-full.webp" alt="Uncle Day - Today is your special day">`;
  if (window.SPA) $("siteName").setAttribute("href", "#");
  $("footName").textContent = tx(SITE.name);
  $("footInfo").textContent = `${tx(SITE.slogan)} · ${SITE.email} · ${tx(SITE.hours)}`;
  { const fi = $("footInfo"); let pl = document.getElementById("footPriv");
    if (!pl) { pl = document.createElement("a"); pl.id = "footPriv"; pl.className = "foot-priv"; pl.href = "privacy.html"; fi.after(pl); }
    pl.textContent = ui("privacy"); }
  pwaBtn();
  document.querySelectorAll(".kakao-link").forEach(a => a.href = SITE.kakao);
  // 언어 고르기: 13개라 버튼 대신 펼침 목록 (국기 + 그 나라 말 이름)
  const cur = LANGS.find(l => l.id === lang) || LANGS[0];
  $("langs").innerHTML = `<button type="button" class="lang-btn" aria-haspopup="listbox" aria-expanded="false" title="${esc(ui("langPick"))}"><span class="lg-flag">${langFlag(cur)}</span><span class="lg-full">${cur.label}</span><span class="lg-short">${cur.id.toUpperCase()}</span><span class="lg-caret">▾</span></button>
    <div class="lang-menu" role="listbox" hidden>${LANGS.map(l => `<button type="button" role="option" class="${l.id === lang ? "on" : ""}" data-l="${l.id}" lang="${l.id}"><span>${langFlag(l)}</span>${l.label}</button>`).join("")}</div>`;
  { const lb = $("langs").querySelector(".lang-btn"), lm = $("langs").querySelector(".lang-menu");
    const shut = () => { lm.hidden = true; lb.setAttribute("aria-expanded", "false"); };
    lb.onclick = e => { e.stopPropagation(); lm.hidden = !lm.hidden; lb.setAttribute("aria-expanded", String(!lm.hidden)); };
    document.addEventListener("click", e => { if (!$("langs").contains(e.target)) shut(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") shut(); });
    lm.querySelectorAll("[data-l]").forEach(b => b.onclick = () => {
      try { localStorage.setItem("lang", b.dataset.l); } catch (e) {}
      try { const u = new URL(location.href); if (u.searchParams.has("lang")) { u.searchParams.set("lang", b.dataset.l); location.href = u.toString(); return; } } catch (e) {}
      location.reload();
    }); }
}
const cityName = id => tx((CITIES.find(c => c.id === id) || {}).name || "");

// 편집 권한이 있는 사람에게만 머리글에 '관리자' 버튼을 보여줘요 (손님에게는 안 보여요)
(async () => {
  try {
    if (!window.claude || !claude.use) return;
    const user = await claude.use("user");
    if (!user || !(await user.canEdit())) return;
    const top = document.querySelector(".top-in");
    if (!top || document.querySelector(".admin-btn")) return;
    const a = document.createElement("a");
    a.className = "btn admin-btn"; a.href = "admin.html"; a.textContent = "⚙️ 관리자";
    top.appendChild(a);
  } catch (e) {}
})();

// 카테고리 사진 주소 (없으면 빈 값)
const catImg = id => (typeof CAT_IMGS !== "undefined" && CAT_IMGS[id]) || "";

// 손님이 쓴 글을 화면에 안전하게 넣기
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const stars = n => "★".repeat(n) + "☆".repeat(5 - n);
const reviewDate = d => d ? d.replace(/^(\d{4})-(\d{2}).*/, lang === "ko" ? "$1년 $2월" : "$2/$1") : "";

/* 사진이 없는 업체: 카테고리 대표 이미지 + 업체 이름 카드 (여러 장이면 업체마다 돌아가며) */
const PH_IMGS = { skin: ["images/ph-skin-1.jpg", "images/ph-skin-2.jpg", "images/ph-skin-3.jpg", "images/ph-skin-4.jpg"] };
function phCard(shop, big) {
  const cat = catGroup(shop.cat);
  const set = PH_IMGS[shop.cat];
  let bg = catImg(shop.cat);
  if (set && set.length) { const i = SHOPS.filter(x => x.cat === shop.cat && !x.img).findIndex(x => x.id === shop.id); bg = set[Math.max(0, i) % set.length]; }
  const lab = cat ? `${cat.icon} ${esc(tx(cat.name))}` : "";
  return `<div class="${big ? "hero " : ""}ph ph-card${bg ? " has-bg" : ""}"${bg ? ` style="background-image:url('${bg}')"` : ""}>
    <span class="ph-cat">${lab}</span>${big ? `<b class="ph-name">${esc(tx(shop.name))}</b><small class="ph-note">${esc(ui("phNote"))}</small>` : ""}</div>`;
}

/* ⭐ 구글에도 후기 남기기 — 엉클데이 후기를 쓴 손님에게 (별점과 상관없이 모두에게 똑같이)
 *  누르면 방금 쓴 글이 복사되고 그 가게의 구글 후기 창이 열려요. 손님이 별을 누르고 붙여 넣어요.
 *  구글은 다른 사이트가 대신 올리는 걸 허락하지 않고, 구글 후기에 보상을 거는 것도 금지해요 → 보상 없음. */
const GRV_T = {
  ko: ["⭐ 구글에도 남겨 주실래요?", "가게에 큰 힘이 돼요. 버튼을 누르면 방금 쓴 글이 복사되고 구글 후기 창이 열려요 — 별을 누르고 붙여 넣기만 하세요.", "⭐ 구글에도 남기기", "📋 글을 복사했어요. 구글 창에 붙여 넣어 주세요"],
  en: ["⭐ Share it on Google too?", "It really helps the shop. Tap the button: your review is copied and the shop's Google review page opens — pick the stars and paste.", "⭐ Post on Google too", "📋 Copied. Paste it on Google"],
  vi: ["⭐ Đánh giá trên Google nữa nhé?", "Điều này giúp cửa hàng rất nhiều. Bấm nút: nội dung vừa viết được sao chép và trang đánh giá Google của cửa hàng sẽ mở — chọn sao và dán vào.", "⭐ Đánh giá trên Google", "📋 Đã sao chép. Hãy dán vào Google"],
};
function grvHtml(lg) { const T = GRV_T[lg] || GRV_T.ko; return `<div class="grv"><b>${T[0]}</b><p>${T[1]}</p><button type="button" class="btn grv-btn">${T[2]}</button></div>`; }
function grvBind(root, { gplace, text, shopId, lg }) {
  const b = root && root.querySelector(".grv-btn"); if (!b || !gplace) return;
  b.onclick = () => {
    try { navigator.clipboard.writeText(text || ""); } catch (e) {}
    try { if (typeof SUPA !== "undefined" && SUPA.url && shopId) fetch(`${SUPA.url}/rest/v1/rpc/seo_hit`, { method: "POST", keepalive: true, headers: { apikey: SUPA.key, ...(String(SUPA.key).startsWith("eyJ") ? { Authorization: "Bearer " + SUPA.key } : {}), "Content-Type": "application/json" }, body: JSON.stringify({ path: `/s/${shopId}/`, src: "review", kind: "grv" }) }).catch(() => {}); } catch (e) {}
    window.open("https://search.google.com/local/writereview?placeid=" + encodeURIComponent(gplace), "_blank", "noopener");
    const T = GRV_T[lg] || GRV_T.ko; b.textContent = T[3];
  };
}
// 예약확인증처럼 가게 정보에 구글 연결이 없을 때: 가게 id로 구글 연결만 가져와요 (공개 정보)
async function grvPlace(shopId) {
  try { if (typeof SUPA === "undefined" || !SUPA.url || !shopId) return null;
    const r = await fetch(`${SUPA.url}/rest/v1/shops?id=eq.${encodeURIComponent(shopId)}&select=gp:data->>gplace`, { headers: { apikey: SUPA.key, ...(String(SUPA.key).startsWith("eyJ") ? { Authorization: "Bearer " + SUPA.key } : {}) } });
    const j = r.ok ? await r.json() : []; return (j[0] && j[0].gp) || null; } catch (e) { return null; }
}

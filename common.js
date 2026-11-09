/* 모든 페이지가 같이 쓰는 도구(언어 전환, 가격 표시). 보통 수정할 일 없어요. */
const $ = id => document.getElementById(id);

// 현재 언어 결정: 주소의 ?lang= → 저장된 값 → 브라우저 언어
let lang = (() => {
  const ids = LANGS.map(l => l.id);
  let v = null;
  try { v = v || localStorage.getItem("lang"); } catch (e) {}
  v = v || (navigator.language || "").slice(0, 2);
  return ids.includes(v) ? v : ids.includes("en") && v !== "ko" ? "en" : "ko";
})();
document.documentElement.lang = lang;

// 언어별 글자 꺼내기 (없으면 영어 → 한국어)
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

// 공통 머리글/바닥글 채우기
function drawCommon() {
  document.querySelectorAll("[data-i18n]").forEach(e => e.textContent = ui(e.dataset.i18n));
  document.querySelectorAll("[data-i18n-ph]").forEach(e => e.placeholder = ui(e.dataset.i18nPh));
  $("siteName").innerHTML = `<img class="logo-full" src="images/logo-full.webp" alt="Uncle Day - Today is your special day">`;
  if (window.SPA) $("siteName").setAttribute("href", "#");
  $("footName").textContent = tx(SITE.name);
  $("footInfo").textContent = `${tx(SITE.slogan)} · ${SITE.email} · ${tx(SITE.hours)}`;
  document.querySelectorAll(".kakao-link").forEach(a => a.href = SITE.kakao);
  $("langs").innerHTML = LANGS.map(l =>
    `<button class="chip ${l.id === lang ? "on" : ""}" data-l="${l.id}" title="${l.label}"><span class="lg-full">${l.label}</span><span class="lg-short">${l.id.toUpperCase()}</span></button>`).join("");
  $("langs").querySelectorAll("button").forEach(b => b.onclick = () => {
    try { localStorage.setItem("lang", b.dataset.l); } catch (e) {}
    location.reload();
  });
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

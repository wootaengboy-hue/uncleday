/* 🎨 브랜드 자료실 (CI) — 포털 안에서 로고 · 명함 · 사진 · 홍보물 · 폰트를 모아 두고 꺼내 써요
 * - 비공개 저장소 'brand' + 표 brand_assets (supabase/universe17.sql)
 * - 열기 · 내려받기는 그때그때 만드는 임시 링크 (외부 공유 링크는 7일)
 */
const BRAND_CATS = [["logo", "🔤 로고"], ["card", "🪪 명함"], ["photo", "📷 사진"], ["promo", "📣 홍보물"], ["doc", "📄 문서"], ["font", "🔠 폰트"], ["etc", "📦 기타"]];
const BRAND_TYPES = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml", heic: "image/heic", psd: "image/vnd.adobe.photoshop",
  pdf: "application/pdf", ai: "application/postscript", eps: "application/postscript", zip: "application/zip",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", ppt: "application/vnd.ms-powerpoint",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", doc: "application/msword",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", hwp: "application/x-hwp", hwpx: "application/vnd.hancom.hwpx",
  ttf: "font/ttf", otf: "font/otf", woff: "font/woff", woff2: "font/woff2", mp4: "video/mp4", fig: "application/octet-stream",
};
const BRAND_MAX = 50 * 1024 * 1024;
// 사이트에 이미 있는 기본 자료 (올리지 않아도 바로 내려받기)
const BRAND_BASE = {
  logos: [["images/logo-full.webp", "가로 로고 (흰 배경)", "710×300"], ["images/logo-og.png", "가로 로고 (투명 배경)", "710×300"], ["images/logo-t.png", "작은 로고 (투명)", "312×132"],
    ["images/owner-512.png", "앱 아이콘", "512×512"], ["images/favicon-180.png", "파비콘", "180×180"], ["images/og-image.jpg", "공유 미리보기 이미지", "1200×630"]],
  colors: [["#2AC1BC", "대표 색 (민트)", "사이트 메인 · 버튼"], ["#222222", "글자", "본문"], ["#F6F7F9", "배경", "사이트 바탕"],
    ["#0E2843", "네이비", "사장님 · 직원 화면"], ["#116241", "초록", "사장님 화면 버튼"], ["#E8590C", "주황", "강조 · 알림"], ["#6B2FA0", "보라", "UD 표시"]],
  fonts: [["Noto Sans KR", "한국어 본문 · 제목", "https://fonts.google.com/noto/specimen/Noto+Sans+KR"], ["Pretendard", "한국어 대체 서체", "https://github.com/orioncactus/pretendard"], ["Be Vietnam Pro", "베트남어 화면", "https://fonts.google.com/specimen/Be+Vietnam+Pro"]],
};
const BRAND = { list: null, err: "", cat: "all", q: "", urls: {}, edit: null, upCat: "logo", busy: false, loading: false };

async function brandLoad() {
  if (BRAND.loading) return; BRAND.loading = true;
  const r = await sb.from("brand_assets").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false });
  BRAND.loading = false;
  if (r.error) { BRAND.err = /brand_assets|PGRST205|42P01/.test(r.error.message + r.error.code) ? "setup" : r.error.message; BRAND.list = []; brandDraw(); return; }
  BRAND.err = ""; BRAND.list = r.data || [];
  // 미리보기 그림: 한 번에 1시간짜리 링크를 받아 둬요
  const imgs = BRAND.list.filter(a => /^image\/(png|jpeg|webp|gif|svg)/.test(a.mime || "") && !BRAND.urls[a.path]).map(a => a.path);
  if (imgs.length) { const s = await sb.storage.from("brand").createSignedUrls(imgs, 3600); (s.data || []).forEach(x => { if (x.signedUrl) BRAND.urls[x.path] = x.signedUrl; }); }
  brandDraw();
}
const brandIcon = a => /^image\//.test(a.mime || "") ? "🖼️" : /pdf/.test(a.mime || "") ? "📕" : /postscript|illustrator/.test(a.mime || "") ? "🎨" : /^font\//.test(a.mime || "") ? "🔠" : /presentation|powerpoint/.test(a.mime || "") ? "📊" : /zip/.test(a.mime || "") ? "🗜️" : /^video/.test(a.mime || "") ? "🎬" : "📄";
const brandSize = n => n >= 1048576 ? (n / 1048576).toFixed(1) + "MB" : Math.max(1, Math.round(n / 1024)) + "KB";

// 포털 안의 자리(#ptBrand)에 그려요. 포털이 다시 그려져도 받아 둔 목록을 그대로 써요
function brandDraw() {
  const host = document.getElementById("ptBrand"); if (!host) return;
  if (BRAND.list === null) { host.innerHTML = `<div class="hint">불러오는 중…</div>`; brandLoad(); return; }
  const cnt = k => BRAND.list.filter(a => k === "all" || a.cat === k).length;
  const q = BRAND.q.trim().toLowerCase();
  const rows = BRAND.list.filter(a => (BRAND.cat === "all" || a.cat === BRAND.cat) && (!q || (a.name + " " + (a.note || "")).toLowerCase().includes(q)));
  const B = BRAND_BASE;
  host.innerHTML = `
    <div class="br-base">
      <div class="br-box"><h4>🔤 기본 로고 <span class="hint">사이트에 있는 원본 · 바로 내려받기</span></h4><div class="br-logos">${B.logos.map(([u, n, s]) => `<a class="br-logo" href="/${u}" download><span class="br-ph ${/owner|favicon|og-image|logo-full/.test(u) ? "" : "chk"}"><img src="/${u}" alt="" loading="lazy"></span><b>${esc(n)}</b><small>${s} · ${u.split(".").pop().toUpperCase()} ⬇️</small></a>`).join("")}</div></div>
      <div class="br-box"><h4>🎨 브랜드 색 <span class="hint">누르면 색 코드가 복사돼요</span></h4><div class="br-colors">${B.colors.map(([c, n, d]) => `<button type="button" class="br-color" data-bcopy="${c}"><i style="background:${c}"></i><b>${c}</b><small>${esc(n)} · ${esc(d)}</small></button>`).join("")}</div>
        <h4 style="margin-top:12px">🔠 글꼴</h4><div class="br-fonts">${B.fonts.map(([f, d, u]) => `<a href="${u}" target="_blank" rel="noopener" class="br-font"><b style="font-family:'${f}',sans-serif">${esc(f)}</b><small>${esc(d)} · 무료 ↗</small></a>`).join("")}</div></div>
    </div>
    <div class="br-lib" id="brLib">
      <div class="br-bar">
        <div class="br-cats">${[["all", "전체"], ...BRAND_CATS].map(([k, l]) => `<button type="button" class="${BRAND.cat === k ? "on" : ""}" data-bcat="${k}">${l} <span>${cnt(k)}</span></button>`).join("")}</div>
        <input class="br-q" id="brQ" placeholder="🔍 이름 · 메모 검색" value="${esc(BRAND.q)}">
      </div>
      <div class="br-up"><span>올릴 분류</span><select id="brUpCat">${BRAND_CATS.map(([k, l]) => `<option value="${k}" ${BRAND.upCat === k ? "selected" : ""}>${l}</option>`).join("")}</select>
        <label class="btn sm main br-upbtn">⬆️ 파일 올리기<input type="file" id="brFile" multiple hidden accept="${Object.keys(BRAND_TYPES).map(e => "." + e).join(",")}"></label>
        <span class="hint">끌어다 놓아도 돼요 · 그림 · PDF · AI · PSD · PPT · 폰트 · ZIP, 한 파일 50MB까지 · 관리자만 열 수 있어요</span>${BRAND.busy ? `<span class="hint">⏳ 올리는 중…</span>` : ""}</div>
      ${BRAND.err === "setup" ? `<div class="hint br-warn">⚠️ 자료실을 쓰려면 Supabase에서 <b>supabase/universe17.sql</b>을 한 번 실행해 주세요.</div>` : BRAND.err ? `<div class="hint br-warn">⚠️ ${esc(BRAND.err)}</div>`
        : rows.length ? `<div class="br-grid">${rows.map(a => brandCard(a)).join("")}</div>` : `<div class="br-empty">${BRAND.list.length ? "찾는 자료가 없어요." : "아직 올린 자료가 없어요. 명함 시안 · AI 원본 · 매장 사진 · 홍보물을 올려 두면 팀 모두가 꺼내 쓸 수 있어요."}</div>`}
    </div>`;
  brandBind(host);
}
function brandCard(a) {
  const u = BRAND.urls[a.path], cat = (BRAND_CATS.find(c => c[0] === a.cat) || BRAND_CATS[6])[1], mine = (a.uploaded_by || "") === ((typeof ME !== "undefined" && ME.email) || "").toLowerCase();
  if (BRAND.edit === a.id) return `<div class="br-card ed" data-bid="${a.id}"><input class="br-in" data-bf="name" value="${esc(a.name)}" maxlength="200">
      <select class="br-in" data-bf="cat">${BRAND_CATS.map(([k, l]) => `<option value="${k}" ${a.cat === k ? "selected" : ""}>${l}</option>`).join("")}</select>
      <textarea class="br-in" data-bf="note" rows="2" maxlength="500" placeholder="메모 (예: 인쇄용 CMYK, 2026년 11월 명함 시안)">${esc(a.note || "")}</textarea>
      <div class="br-act"><button class="btn sm main" data-bsave="${a.id}">저장</button><button class="btn sm" data-bedit="">취소</button></div></div>`;
  return `<div class="br-card" data-bid="${a.id}">
    <button type="button" class="br-th ${u ? "img" : ""}" data-bopen="${a.id}" title="열기">${u ? `<img src="${esc(u)}" alt="" loading="lazy">` : `<span>${brandIcon(a)}</span><small>${esc((a.name.split(".").pop() || "").toUpperCase())}</small>`}</button>
    <div class="br-meta"><b title="${esc(a.name)}">${a.pinned ? "📌 " : ""}${esc(a.name)}</b><small>${cat} · ${brandSize(a.size)}${a.w ? ` · ${a.w}×${a.h}` : ""}</small>
      ${a.note ? `<small class="br-note">${esc(a.note)}</small>` : ""}<small class="br-who">${esc((a.uploaded_by || "").split("@")[0])} · ${new Date(a.created_at).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}</small></div>
    <div class="br-act"><button class="btn sm" data-bdown="${a.id}" title="내려받기">⬇️</button><button class="btn sm" data-blink="${a.id}" title="7일짜리 공유 링크 복사 (인쇄소 · 디자이너에게)">🔗</button>
      <button class="btn sm" data-bpin="${a.id}" title="맨 위에 고정">${a.pinned ? "📍" : "📌"}</button><button class="btn sm" data-bedit="${a.id}" title="이름 · 분류 · 메모">✏️</button>
      <button class="btn sm" data-bdel="${a.id}" title="지우기${mine ? "" : " (다른 사람이 올린 파일)"}">✕</button></div></div>`;
}
function brandBind(host) {
  const find = id => BRAND.list.find(a => a.id === id);
  host.querySelectorAll("[data-bcopy]").forEach(b => b.onclick = () => portalCopy(b.dataset.bcopy));
  host.querySelectorAll("[data-bcat]").forEach(b => b.onclick = () => { BRAND.cat = b.dataset.bcat; brandDraw(); });
  const qi = host.querySelector("#brQ"); if (qi) qi.oninput = () => { BRAND.q = qi.value; clearTimeout(BRAND.qt); BRAND.qt = setTimeout(() => { brandDraw(); const n = document.getElementById("brQ"); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); };
  const uc = host.querySelector("#brUpCat"); if (uc) uc.onchange = () => { BRAND.upCat = uc.value; };
  const fi = host.querySelector("#brFile"); if (fi) fi.onchange = () => { const f = [...fi.files]; fi.value = ""; brandUpload(f); };
  const lib = host.querySelector("#brLib");
  if (lib) {
    lib.addEventListener("dragover", e => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) { e.preventDefault(); lib.classList.add("drop"); } });
    lib.addEventListener("dragleave", e => { if (!lib.contains(e.relatedTarget)) lib.classList.remove("drop"); });
    lib.addEventListener("drop", e => { e.preventDefault(); lib.classList.remove("drop"); brandUpload([...(e.dataTransfer.files || [])]); });
  }
  const signed = async (a, opt, secs) => { const r = await sb.storage.from("brand").createSignedUrl(a.path, secs || 300, opt); if (r.error) { dbErr(r.error, "파일 열기"); return null; } return r.data.signedUrl; };
  host.querySelectorAll("[data-bopen]").forEach(b => b.onclick = async () => { const a = find(b.dataset.bopen); const w = window.open("", "_blank"); const u = await signed(a, /^image\/|pdf/.test(a.mime || "") ? undefined : { download: a.name }); if (!u) { if (w) w.close(); return; } if (w) w.location = u; else location.href = u; });
  host.querySelectorAll("[data-bdown]").forEach(b => b.onclick = async () => { const a = find(b.dataset.bdown); const u = await signed(a, { download: a.name }); if (u) location.href = u; });
  host.querySelectorAll("[data-blink]").forEach(b => b.onclick = async () => { const a = find(b.dataset.blink); const u = await signed(a, { download: a.name }, 7 * 86400); if (u) { portalCopy(u); toast("7일 동안 열리는 링크를 복사했어요 · 인쇄소 · 디자이너에게 보내세요", 3600); } });
  host.querySelectorAll("[data-bpin]").forEach(b => b.onclick = async () => { const a = find(b.dataset.bpin); const r = await sb.from("brand_assets").update({ pinned: !a.pinned }).eq("id", a.id); if (r.error) { dbErr(r.error, "고정"); return; } brandLoad(); });
  host.querySelectorAll("[data-bedit]").forEach(b => b.onclick = () => { BRAND.edit = b.dataset.bedit || null; brandDraw(); });
  host.querySelectorAll("[data-bsave]").forEach(b => b.onclick = async () => {
    const c = host.querySelector(`.br-card[data-bid="${b.dataset.bsave}"]`), v = k => c.querySelector(`[data-bf="${k}"]`).value;
    if (!v("name").trim()) { toast("이름을 넣어 주세요"); return; }
    const r = await sb.from("brand_assets").update({ name: v("name"), cat: v("cat"), note: v("note") }).eq("id", b.dataset.bsave); if (r.error) { dbErr(r.error, "저장"); return; }
    BRAND.edit = null; toast("저장했어요"); brandLoad();
  });
  host.querySelectorAll("[data-bdel]").forEach(b => b.onclick = () => { const a = find(b.dataset.bdel);
    confirmBox(`"${a.name}" 자료를 지울까요?`, async () => {
      const r = await sb.from("brand_assets").delete().eq("id", a.id); if (r.error) { dbErr(r.error, "삭제"); return; }
      await sb.storage.from("brand").remove([a.path]); toast("지웠어요"); brandLoad();
    }, "지운 자료는 되살릴 수 없어요. 팀원 모두의 자료실에서 사라져요.");
  });
}
// 그림이면 가로 × 세로를 재 둬요 (명함 · 인쇄용 크기 확인에 좋아요)
async function brandDims(file) {
  if (!/^image\/(png|jpeg|webp|gif)/.test(file.type)) return [null, null];
  try { const bm = await createImageBitmap(file); const r = [bm.width, bm.height]; bm.close && bm.close(); return r; } catch (e) { return [null, null]; }
}
async function brandUpload(files) {
  if (!files.length || BRAND.busy) return;
  if (BRAND.err === "setup") { toast("먼저 supabase/universe17.sql 을 실행해 주세요", 4000); return; }
  BRAND.busy = true; brandDraw();
  const bad = [], done = [];
  for (const file of files) {
    const ext = (file.name.split(".").pop() || "").toLowerCase(), mime = BRAND_TYPES[ext];
    if (!mime) { bad.push(`${file.name} (올릴 수 없는 종류)`); continue; }
    if (file.size > BRAND_MAX) { bad.push(`${file.name} (50MB 초과: ${brandSize(file.size)})`); continue; }
    const [w, h] = await brandDims(file);
    // 저장소 주소에는 한글을 못 써서 영문 이름으로 저장하고, 원래 이름은 표에 적어요
    const path = `${BRAND.upCat}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const up = await sb.storage.from("brand").upload(path, file, { contentType: mime, upsert: false });
    if (up.error) { bad.push(`${file.name} (${up.error.message})`); continue; }
    const a = await sb.from("brand_assets").insert({ path, name: file.name.slice(0, 200), cat: BRAND.upCat, size: file.size, mime, w, h });
    if (a.error) { await sb.storage.from("brand").remove([path]); bad.push(`${file.name} (${a.error.message})`); continue; }
    done.push(file.name);
  }
  BRAND.busy = false;
  if (bad.length) toast(`못 올린 파일: ${bad.join(", ")}`, 6000); else if (done.length) toast(`🎨 ${done.length}개 올렸어요`);
  if (done.length && BRAND.cat !== "all" && BRAND.cat !== BRAND.upCat) BRAND.cat = BRAND.upCat;
  brandLoad();
}

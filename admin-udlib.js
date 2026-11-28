/* 📁 엉클데이 자료실 — 포털 안 (#ptUdlib)
 *  · 우리 카톡 QR · 채널 주소 · 참고 링크 · 메모 · 파일을 한곳에 (브랜드 자료실 = 로고 · CI 원본과는 따로)
 *  · 링크마다 '🔗 바로가기 바'를 켜면 관리자 화면 · 사이트 아래 바로가기 바에 떠요
 *  · 표 ud_library + 비공개 저장소 brand/udlib/ (supabase/universe60.sql) · 관리자만 열 수 있어요
 */
const UDL_CATS = [["kakao", "💛 카톡 · QR"], ["sns", "📣 블로그 · SNS"], ["ref", "🔖 참고 링크"], ["doc", "📄 문서 · 파일"], ["etc", "📦 기타"]];
const UDL = { list: null, err: "", cat: "all", q: "", urls: {}, edit: null, add: null, busy: false };
const UDL_IMG = /^image\/(png|jpeg|webp|gif|svg\+xml)$/;

async function udlLoad() {
  const r = await sb.from("ud_library").select("*").order("pinned", { ascending: false }).order("cat").order("sort").order("created_at", { ascending: false });
  if (r.error) { UDL.err = /ud_library|PGRST205|42P01/.test(r.error.message + r.error.code) ? "setup" : r.error.message; UDL.list = []; udlDraw(); return; }
  UDL.err = ""; const ci = c => { const i = UDL_CATS.findIndex(x => x[0] === c); return i < 0 ? 9 : i; };
  UDL.list = (r.data || []).sort((a, b) => (b.pinned - a.pinned) || (ci(a.cat) - ci(b.cat)) || (a.sort - b.sort) || (a.created_at < b.created_at ? 1 : -1));
  const imgs = UDL.list.filter(a => a.path && UDL_IMG.test(a.mime || "") && !UDL.urls[a.path]).map(a => a.path);
  if (imgs.length) { const s = await sb.storage.from("brand").createSignedUrls(imgs, 3600); (s.data || []).forEach(x => { if (x.signedUrl) UDL.urls[x.path] = x.signedUrl; }); }
  udlDraw();
}
const udlHost = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } };

function udlDraw() {
  const host = document.getElementById("ptUdlib"); if (!host) return;
  if (UDL.list === null) { host.innerHTML = `<div class="hint">불러오는 중…</div>`; udlLoad(); return; }
  const q = UDL.q.trim().toLowerCase(), cnt = k => UDL.list.filter(a => k === "all" || a.cat === k).length;
  const rows = UDL.list.filter(a => (UDL.cat === "all" || a.cat === UDL.cat) && (!q || [a.title, a.url, a.note].join(" ").toLowerCase().includes(q)));
  const A = UDL.add;
  host.innerHTML = `
    ${UDL.err === "setup" ? `<div class="hint br-warn">⚠️ 자료실을 쓰려면 Supabase에서 <b>supabase/universe60.sql</b>을 한 번 실행해 주세요.</div>` : UDL.err ? `<div class="hint br-warn">${esc(UDL.err)}</div>` : ""}
    <div class="br-bar">
      <div class="br-cats">${[["all", "전체"], ...UDL_CATS].map(([k, l]) => `<button type="button" class="${UDL.cat === k ? "on" : ""}" data-ucat="${k}">${l} <span>${cnt(k)}</span></button>`).join("")}</div>
      <input class="br-q" id="udQ" placeholder="🔍 이름 · 주소 · 메모 검색" value="${esc(UDL.q)}">
    </div>
    <div class="ud-adds"><button class="btn sm main" data-uadd="link">＋ 🔗 링크</button><button class="btn sm" data-uadd="note">＋ 📝 메모</button>
      <label class="btn sm">⬆️ 파일 · QR 그림 올리기<input type="file" id="udFile" multiple hidden accept="image/*,.pdf,.zip,.pptx,.docx,.xlsx,.hwp"></label>
      <span class="hint">카톡 QR · 홍보 문구 · 참고 블로그 · 경쟁사 링크 · 계정 안내(비밀번호는 넣지 마세요)</span>${UDL.busy ? ` <span class="hint">올리는 중…</span>` : ""}</div>
    ${A ? udlForm(A) : ""}
    ${rows.length ? `<div class="ud-grid">${rows.map(udlCard).join("")}</div>` : `<div class="br-empty">${UDL.list.length ? "찾는 자료가 없어요." : "아직 저장한 자료가 없어요. 카톡 QR부터 올려 보세요."}</div>`}`;
  udlBind(host);
}
function udlForm(a) {
  return `<div class="ud-form" data-uform="${esc(a.id || "")}">
    <div class="ud-f2"><input class="br-in" data-uf="icon" value="${esc(a.icon || "")}" placeholder="🔗" maxlength="4" style="width:56px">
      <input class="br-in" data-uf="title" value="${esc(a.title || "")}" placeholder="${a.kind === "note" ? "메모 제목 (예: 카톡 첫 인사 문구)" : "이름 (예: 엉클데이 네이버 블로그)"}" maxlength="200" style="flex:1">
      <select class="br-in" data-uf="cat">${UDL_CATS.map(([k, l]) => `<option value="${k}" ${a.cat === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
    ${a.kind === "link" ? `<input class="br-in" data-uf="url" value="${esc(a.url || "")}" placeholder="https://…">` : ""}
    <textarea class="br-in" data-uf="note" rows="${a.kind === "note" ? 5 : 2}" maxlength="2000" placeholder="${a.kind === "note" ? "내용 (복사해서 쓸 문구 · 안내 등)" : "메모 (선택)"}">${esc(a.note || "")}</textarea>
    ${a.kind === "link" ? `<label class="ud-ck"><input type="checkbox" data-uf="on_bar" ${a.on_bar ? "checked" : ""}> 🔗 관리자 바로가기 바에 띄우기 <span class="hint">(로그인한 관리자에게만 화면 아래에 계속 보여요)</span></label>` : ""}
    <div class="br-act"><button class="btn sm main" data-usave>저장</button><button class="btn sm" data-ucancel>취소</button></div></div>`;
}
function udlCard(a) {
  if (UDL.edit === a.id) return udlForm(a);
  const cat = (UDL_CATS.find(c => c[0] === a.cat) || UDL_CATS[4])[1], u = a.path && UDL.urls[a.path];
  const head = a.kind === "file" ? (u ? `<button type="button" class="ud-th" data-uopen="${a.id}"><img src="${esc(u)}" alt="" loading="lazy"></button>` : `<button type="button" class="ud-th ico" data-uopen="${a.id}">${/pdf/.test(a.mime || "") ? "📕" : "📄"}</button>`) : "";
  return `<div class="ud-card ${a.kind}" data-uid="${a.id}">${head}
    <div class="ud-meta"><b>${a.pinned ? "📌 " : ""}${esc(a.icon || (a.kind === "note" ? "📝" : a.kind === "file" ? "" : "🔗"))} ${esc(a.title)}</b>
      ${a.kind === "link" ? `<a class="ud-url" href="${esc(a.url)}" target="_blank" rel="noopener">${esc(udlHost(a.url) || a.url)} ↗</a>` : ""}
      ${a.note ? `<div class="ud-note ${a.kind === "note" ? "long" : ""}">${esc(a.note)}</div>` : ""}
      <small class="hint">${cat}${a.on_bar ? " · <b style='color:#0e2843'>🔗 바로가기 바</b>" : ""}${a.created_by ? " · " + esc(a.created_by.split("@")[0]) : ""}</small></div>
    <div class="br-act">${a.kind === "link" ? `<button class="btn sm" data-ucopy="${a.id}" title="주소 복사">📋</button><button class="btn sm ${a.on_bar ? "on" : ""}" data-ubar="${a.id}" title="바로가기 바에 띄우기 / 빼기">${a.on_bar ? "🔗 바에서 빼기" : "🔗 바에 띄우기"}</button>` : ""}
      ${a.kind === "note" ? `<button class="btn sm" data-ucopy="${a.id}" title="내용 복사">📋 복사</button>` : ""}
      ${a.kind === "file" ? `<button class="btn sm" data-udown="${a.id}" title="내려받기">⬇️</button>` : ""}
      <button class="btn sm" data-upin="${a.id}" title="맨 위에 고정">${a.pinned ? "📍" : "📌"}</button>${a.kind !== "file" ? `<button class="btn sm" data-uedit="${a.id}" title="고치기">✏️</button>` : ""}<button class="btn sm" data-udel="${a.id}" title="지우기">✕</button></div></div>`;
}
function udlBind(host) {
  const byId = id => UDL.list.find(a => a.id === id);
  host.querySelectorAll("[data-ucat]").forEach(b => b.onclick = () => { UDL.cat = b.dataset.ucat; udlDraw(); });
  const qi = host.querySelector("#udQ"); qi.oninput = () => { UDL.q = qi.value; clearTimeout(qi._t); qi._t = setTimeout(() => { udlDraw(); const x = document.getElementById("udQ"); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 250); };
  host.querySelectorAll("[data-uadd]").forEach(b => b.onclick = () => { UDL.edit = null; UDL.add = { kind: b.dataset.uadd, cat: UDL.cat !== "all" ? UDL.cat : b.dataset.uadd === "note" ? "etc" : "ref", url: b.dataset.uadd === "link" ? "https://" : "" }; udlDraw(); const t = host.querySelector('[data-uf="title"]'); if (t) t.focus(); });
  host.querySelectorAll("[data-uedit]").forEach(b => b.onclick = () => { UDL.add = null; UDL.edit = b.dataset.uedit; udlDraw(); });
  host.querySelectorAll("[data-ucancel]").forEach(b => b.onclick = () => { UDL.add = null; UDL.edit = null; udlDraw(); });
  host.querySelectorAll("[data-usave]").forEach(b => b.onclick = async () => {
    const f = b.closest("[data-uform]"), id = f.dataset.uform, src = id ? byId(id) : UDL.add, v = k => { const el = f.querySelector(`[data-uf="${k}"]`); return el ? (el.type === "checkbox" ? el.checked : el.value.trim()) : undefined; };
    const row = { title: v("title"), cat: v("cat"), icon: v("icon") || null, note: v("note") || null };
    if (src.kind === "link") { row.url = v("url"); row.on_bar = v("on_bar"); if (!/^https?:\/\/\S+\.\S+/.test(row.url || "")) return toast("주소는 https:// 로 시작하게 적어 주세요"); }
    if (!row.title) return toast("이름을 적어 주세요");
    if (/비밀번호|password|passwd|pw\s*[:=]/i.test((row.note || "") + row.title)) return toast("비밀번호는 자료실에 넣지 마세요 (팀 비밀번호 관리 도구를 써요)", 5000);
    const r = id ? await sb.from("ud_library").update(row).eq("id", id) : await sb.from("ud_library").insert({ ...row, kind: src.kind, sort: UDL.list.length + 1 });
    if (r.error) return dbErr(r.error, "자료 저장");
    UDL.add = null; UDL.edit = null; toast("저장했어요"); await udlLoad(); if (window.udlReload) udlReload();
  });
  host.querySelectorAll("[data-ubar]").forEach(b => b.onclick = async () => { const a = byId(b.dataset.ubar); const r = await sb.from("ud_library").update({ on_bar: !a.on_bar }).eq("id", a.id); if (r.error) return dbErr(r.error, "바로가기"); toast(a.on_bar ? "바로가기 바에서 뺐어요" : "바로가기 바에 띄웠어요 (화면 왼쪽 아래)"); await udlLoad(); if (window.udlReload) udlReload(); });
  host.querySelectorAll("[data-upin]").forEach(b => b.onclick = async () => { const a = byId(b.dataset.upin); const r = await sb.from("ud_library").update({ pinned: !a.pinned }).eq("id", a.id); if (r.error) return dbErr(r.error, "고정"); udlLoad(); });
  host.querySelectorAll("[data-ucopy]").forEach(b => b.onclick = () => { const a = byId(b.dataset.ucopy); const t = a.kind === "note" ? a.note || a.title : a.url; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast("복사했어요"), () => prompt("복사해서 쓰세요", t)); });
  host.querySelectorAll("[data-udel]").forEach(b => b.onclick = async () => {
    if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = "정말?"; return; }
    const a = byId(b.dataset.udel); if (a.path) await sb.storage.from("brand").remove([a.path]);
    const r = await sb.from("ud_library").delete().eq("id", a.id); if (r.error) return dbErr(r.error, "지우기"); toast("지웠어요"); await udlLoad(); if (window.udlReload) udlReload(); });
  const fileUrl = async (a, dl) => { const s = await sb.storage.from("brand").createSignedUrl(a.path, 600, dl ? { download: a.title } : undefined); if (s.error) return dbErr(s.error, "파일 열기"); window.open(s.data.signedUrl, "_blank", "noopener"); };
  host.querySelectorAll("[data-uopen]").forEach(b => b.onclick = () => fileUrl(byId(b.dataset.uopen), false));
  host.querySelectorAll("[data-udown]").forEach(b => b.onclick = () => fileUrl(byId(b.dataset.udown), true));
  const fi = host.querySelector("#udFile"); fi.onchange = () => udlUpload([...fi.files]);
  host.ondragover = e => e.preventDefault(); host.ondrop = e => { e.preventDefault(); if (e.dataTransfer.files.length) udlUpload([...e.dataTransfer.files]); };
}
async function udlUpload(files) {
  if (UDL.err === "setup") return toast("먼저 supabase/universe60.sql 을 실행해 주세요");
  UDL.busy = true; udlDraw(); let ok = 0;
  for (const f of files) {
    if (f.size > 50 * 1024 * 1024) { toast(`${f.name}: 50MB보다 커요`); continue; }
    const ext = (f.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, ""), path = `udlib/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const up = await sb.storage.from("brand").upload(path, f, { contentType: f.type || "application/octet-stream", upsert: false });
    if (up.error) { dbErr(up.error, f.name); continue; }
    const cat = /qr|카톡|kakao/i.test(f.name) ? "kakao" : /^image\//.test(f.type) ? (UDL.cat !== "all" ? UDL.cat : "etc") : "doc";
    const r = await sb.from("ud_library").insert({ kind: "file", cat, title: f.name.replace(/\.[^.]+$/, "").slice(0, 200), path, mime: f.type || null, size: f.size });
    if (r.error) { dbErr(r.error, f.name); await sb.storage.from("brand").remove([path]); continue; }
    ok++;
  }
  UDL.busy = false; if (ok) toast(`${ok}개 올렸어요`); await udlLoad();
}

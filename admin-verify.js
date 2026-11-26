/* 🔍 업체 정보 검수 · 🖼️ 이미지 검수 — 포털 안 (#ptVerify · #ptImgqa) · universe48
 *
 * 업체 정보 검수 (캐시바이 '홈페이지' 버튼 + 비교 검수 방식)
 *   - 업체마다 [🌐 홈페이지] [📘 페이스북] [👁 엉클데이 페이지] 버튼 → 원문과 나란히 보며 확인
 *   - '모아 온 정보'(홈페이지 · 공개 검색 결과에서 뽑은 영업시간 · 주소 · 메뉴 가격) | '엉클데이 지금' 을 비교
 *     → 항목마다 [넣기] → 다 봤으면 [검수 완료]
 *   - 모아 온 정보는 초안이에요. 사람이 [넣기]를 눌러야 손님 화면에 나가요
 *
 * 이미지 검수 (캐시바이 이미지 검수 방식)
 *   - 원본 | 작업본(크기 · 밝기 맞춤) | 실제 노출(손님 화면 모양) 3칸 비교 → 판정: 통과 · 문제 · 보류
 *   - 출처: 📷 현장(우리가 찍음) · 🤝 업체 제공 · 🌐 홈페이지 후보
 *   - 공개는 '통과' + (현장 사진 또는 업체가 사진 사용을 허락한 곳)만. 홈페이지 후보는 허락받기 전 보여 주기용
 *   - 🤖 AI 검사: 글자 · 워터마크 · 얼굴 · 흐림 · 과한 보정 등을 찾아 줘요 (판정은 사람이)
 *   - 지금 노출 중인데 출처 기록이 없는 사진은 '출처 확인 필요'로 따로 모아요
 */
const VF = { src: null, err: "", f: "todo", q: "", open: null };
const MQ = { list: null, err: "", shop: "", f: "todo", busy: {}, keep: new Set() };   // keep: 방금 판정한 사진은 목록에서 바로 사라지지 않게
try { const p = location.hash.slice(1).split("/"); if (p[0] === "home" && (p[1] === "verify" || p[1] === "imgqa") && p[2]) { if (p[1] === "verify") VF.open = decodeURIComponent(p[2]); else MQ.shop = decodeURIComponent(p[2]); } } catch (e) {}

const vfTx = n => n && typeof n === "object" ? (n.ko || n.en || n.vi || "") : String(n || "");
const vfMoney = v => (+v || 0).toLocaleString("ko-KR") + "동";
const vfShop = id => (typeof shops !== "undefined" ? shops : []).find(s => s.id === id);
const vfSrc = id => (VF.src || []).find(x => x.shop_id === id) || { shop_id: id, review: "none" };
const vfPage = s => `/s/${encodeURIComponent(s.id)}/`;
const vfName = s => (s.name && (s.name.ko || s.name.en)) || s.id;
const vfLinks = (s, x) => `${x.web ? `<a class="vf-lk" href="${esc(x.web)}" target="_blank" rel="noopener">🌐 홈페이지</a>` : ""}${x.fb ? `<a class="vf-lk fb" href="${esc(x.fb)}" target="_blank" rel="noopener">📘 페이스북</a>` : ""}<a class="vf-lk ud" href="${vfPage(s)}" target="_blank" rel="noopener">👁 엉클데이 페이지</a>`;
// "500,000 VND" · "500k" · "₫500.000" → 500000 (달러는 그대로 두고 표시만)
function vfVnd(p) {
  const t = String(p || "").toLowerCase(); if (!t || /usd|\$/.test(t)) return 0;
  const m = t.replace(/\s/g, "").match(/(\d[\d.,]*)(k|tr|triệu|trieu|million)?/); if (!m) return 0;
  let n = +m[1].replace(/[.,](?=\d{3}(\D|$))/g, "").replace(",", "."); if (!isFinite(n)) return 0;
  if (m[2] === "k") n *= 1000; else if (m[2]) n *= 1e6;
  return n >= 10000 && n < 1e9 ? Math.round(n) : 0;
}
const vfHours = h => { const m = String(h || "").match(/(\d{1,2})[:h.]?(\d{2})?\s*(?:am|AM)?\s*[-–~to]+\s*(\d{1,2})[:h.]?(\d{2})?\s*(pm|PM)?/); if (!m) return null;
  let a = +m[1], b = +m[3]; if (m[5] && b < 12) b += 12; if (b <= a && b < 12) b += 12; if (a > 23 || b > 24) return null;
  const z = (x, y) => String(x % 24).padStart(2, "0") + ":" + (y || "00"); return { open: z(a, m[2]), close: z(b, m[4]) }; };

async function vfLoad() {
  const r = await sb.from("shop_sources").select("*");
  if (r.error) { VF.err = /shop_sources|42P01|PGRST20|schema cache/.test((r.error.message || "") + (r.error.code || "")) ? "setup" : r.error.message; VF.src = []; }
  else { VF.err = ""; VF.src = r.data || []; }
  vfDraw(); if (typeof mqDraw === "function") mqDraw();
}
async function vfSave(id, patch, msg) {
  const cur = vfSrc(id); const row = { ...cur, ...patch, shop_id: id, updated_at: new Date().toISOString() };
  const r = await sb.from("shop_sources").upsert(row).select().single();
  if (r.error) return dbErr(r.error, "검수 저장");
  VF.src = (VF.src || []).filter(x => x.shop_id !== id).concat(r.data); if (msg) toast(msg); vfDraw(); if (typeof mqDraw === "function") mqDraw();
}
async function vfShopSave(s, msg) { try { await dbSaveShop(s); toast(msg); vfDraw(); } catch (e) { dbErr(e, "업체 저장"); } }

function vfDraw() {
  const el = document.getElementById("ptVerify"); if (!el) return;
  if (!VF.src) { el.innerHTML = `<p class="hint">불러오는 중…</p>`; vfLoad(); return; }
  if (VF.err === "setup") { el.innerHTML = `<div class="uni-err">먼저 Supabase SQL 편집기에서 <b>supabase/universe48.sql</b> 을 실행해 주세요. 홈페이지 · 페이스북 링크 41곳이 함께 들어가요.</div>`; return; }
  if (VF.err) { el.innerHTML = `<div class="uni-err">${esc(VF.err)}</div>`; return; }
  const S = (typeof shops !== "undefined" ? shops : []).filter(isPub);
  const rows = S.map(s => ({ s, x: vfSrc(s.id) }));
  const has = x => x.crawled && ((x.crawled.menu || []).length || x.crawled.hours || x.crawled.address);
  const cnt = { all: rows.length, todo: rows.filter(r => r.x.review === "todo").length, done: rows.filter(r => r.x.review === "done").length,
    none: rows.filter(r => !r.x.web && !r.x.fb).length, photo: rows.filter(r => r.x.photo_ok).length };
  const F = { todo: r => r.x.review === "todo", done: r => r.x.review === "done", none: r => !r.x.web && !r.x.fb, all: () => true };
  const q = String(VF.q || "").toLowerCase();
  const list = rows.filter(F[VF.f] || F.all).filter(r => !q || [vfName(r.s), r.s.name.en, r.s.id].join(" ").toLowerCase().includes(q));
  el.innerHTML = `<div class="vf">
    <div class="vf-tiles"><div><small>전체 업체</small><b>${cnt.all}</b></div><div><small>검수 대기</small><b class="w">${cnt.todo}</b></div><div><small>검수 완료</small><b class="g">${cnt.done}</b></div><div><small>링크 없음 · 현장 확인</small><b>${cnt.none}</b></div><div><small>사진 사용 허락</small><b>${cnt.photo}</b></div></div>
    <div class="vf-bar">${[["todo", "검수 대기"], ["done", "완료"], ["none", "링크 없음"], ["all", "전체"]].map(([k, t]) => `<button class="chip ${VF.f === k ? "on" : ""}" data-vff="${k}">${t} ${k === "all" ? cnt.all : cnt[k]}</button>`).join("")}
      <input id="vfQ" placeholder="🔍 업체 이름" value="${esc(VF.q)}"></div>
    <div class="vf-list">${list.map(({ s, x }) => {
      const c = x.crawled || {}, nm = (c.menu || []).length;
      const st = x.review === "done" ? `<span class="vf-st g">✓ 검수 완료</span>` : x.review === "todo" ? `<span class="vf-st w">검수 대기</span>` : `<span class="vf-st">${x.web || x.fb ? "모아 온 정보 없음" : "링크 없음 · 현장 확인"}</span>`;
      return `<div class="vf-row ${VF.open === s.id ? "open" : ""}" data-vfid="${esc(s.id)}">
        <div class="vf-h" data-vfo="${esc(s.id)}"><div class="vf-nm"><b>${esc(vfName(s))}</b><small>${esc(cityName(s.city))} · ${esc(catName(s.cat))}${s.name.en && s.name.en !== vfName(s) ? " · " + esc(s.name.en) : ""}</small></div>
          <div class="vf-lks">${vfLinks(s, x)}</div>
          <div class="vf-meta">${st}<small>${has(x) ? `모아 온 정보: ${c.hours ? "영업시간 · " : ""}${c.address ? "주소 · " : ""}메뉴 ${nm}개` : ""}${x.photo_ok ? " · 📷 사진 허락" : ""}</small></div><span class="vf-arr">${VF.open === s.id ? "▲" : "▼"}</span></div>
        ${VF.open === s.id ? vfDetail(s, x) : ""}</div>`; }).join("") || `<p class="hint" style="padding:14px">해당하는 업체가 없어요</p>`}</div></div>`;
  vfBind(el);
  if (VF.open) { const o = el.querySelector(`.vf-row.open`); if (o && VF._scroll !== VF.open) { VF._scroll = VF.open; setTimeout(() => o.scrollIntoView({ block: "start", behavior: "smooth" }), 80); } }
}

function vfDetail(s, x) {
  const c = x.crawled || {}, hrs = vfHours(c.hours), menu = c.menu || [];
  const cur = `${s.open || "?"} ~ ${s.close || "?"}`;
  const addr = (s.address && (s.address.vi || s.address.en)) || "";
  const usd = menu.some(m => /usd|\$/i.test(m.price || ""));
  return `<div class="vf-d">
    <div class="vf-src">${(c.src || []).length ? `출처: ${(c.src || []).slice(0, 4).map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\/(www\.)?/, "").slice(0, 48))}</a>`).join(" · ")}` : ""}${x.crawled_at ? ` · ${esc(String(x.crawled_at).slice(0, 10))} 모음` : ""}${c.note ? `<br><span class="hint">📝 ${esc(c.note)}</span>` : ""}</div>
    <div class="vf-cmp"><div class="vf-th"><span>항목</span><span>모아 온 정보 (원문)</span><span>엉클데이 지금</span><span></span></div>
      <div class="vf-tr"><span>🕘 영업시간</span><span>${esc(c.hours || "—")}</span><span>${esc(cur)}</span><span>${hrs && (hrs.open !== s.open || hrs.close !== s.close) ? `<button class="btn sm" data-vfhr="${hrs.open}-${hrs.close}">${hrs.open}~${hrs.close} 넣기</button>` : hrs ? "<i class='ok'>같아요</i>" : ""}</span></div>
      <div class="vf-tr"><span>📍 주소</span><span>${esc(c.address || "—")}</span><span>${esc(addr)}</span><span>${c.address && c.address.trim() !== addr.trim() ? `<button class="btn sm" data-vfad>주소 넣기</button>` : c.address ? "<i class='ok'>같아요</i>" : ""}</span></div>
      ${(c.features || []).length ? `<div class="vf-tr"><span>✨ 특징</span><span>${(c.features || []).map(esc).join(" · ")}</span><span>${(s.tags || []).map(t => "#" + esc(t.ko || t.en || "")).join(" ")}</span><span class="hint">태그는 업체 편집에서</span></div>` : ""}
    </div>
    <h5>💰 메뉴 · 가격 <small>모아 온 메뉴 ${menu.length}개 · 엉클데이 메뉴 ${(s.menu || []).length}개${usd ? " · 달러 가격은 동으로 바꿔서 직접 넣어 주세요" : ""}</small></h5>
    <div class="vf-menu">
      <div class="vf-mcol"><small>모아 온 정보</small>${menu.map((m, i) => { const v = vfVnd(m.price);
        return `<div class="vf-mi"><span><b>${esc(m.name)}</b>${m.minutes ? ` · ${m.minutes}분` : ""}</span><span class="pr">${esc(m.price || "가격 없음")}</span>
          <span class="vf-mact">${v ? `<select data-vfto="${i}"><option value="">어디에 넣을까요?</option>${(s.menu || []).map((x, j) => `<option value="${j}" ${vfGuess(x, m) ? "selected" : ""}>${esc(vfTx(x.name).slice(0, 34))}${x.min ? " · " + x.min + "분" : ""}${x.price ? " · " + vfMoney(x.price) : " · 가격 없음"}</option>`).join("")}<option value="new">＋ 새 메뉴로 추가</option></select><button class="btn sm" data-vfmi="${i}">${vfMoney(v)} 넣기</button>` : ""}</span></div>`; }).join("") || `<p class="hint">모아 온 메뉴가 없어요${x.fb && !x.web ? " · 페이스북만 있는 곳은 사람이 보고 넣어 주세요" : ""}</p>`}</div>
      <div class="vf-mcol"><small>엉클데이 지금</small>${(s.menu || []).map(m => `<div class="vf-mi"><span><b>${esc(vfTx(m.name))}</b>${m.min ? ` · ${m.min}분` : ""}</span><span class="pr ${m.price ? "" : "none"}">${m.price ? vfMoney(m.price) : "가격 없음"}</span></div>`).join("") || `<p class="hint">메뉴가 없어요</p>`}</div>
    </div>
    <div class="vf-foot">
      <label class="vf-ph"><input type="checkbox" id="vfPh" ${x.photo_ok ? "checked" : ""}> 📷 업체가 사진 사용을 허락했어요</label><input id="vfPhN" placeholder="허락 받은 방법 · 날짜 (예: 11/26 잘로로 동의)" value="${esc(x.photo_note || "")}">
      <span style="flex:1"></span>
      <button class="btn" data-vfimg>🖼️ 이 업체 사진 검수</button>
      ${x.review === "done" ? `<button class="btn" data-vfrv="todo">다시 검수 대기로</button>` : `<button class="btn main" data-vfrv="done">✓ 검수 완료</button>`}
    </div></div>`;
}
// 시간 · 이름이 비슷한 메뉴를 미리 골라 둬요
function vfGuess(x, m) {
  if (x.price) return false;
  const a = String(vfTx(x.name)).toLowerCase(), b = String(m.name || "").toLowerCase();
  const same = ["aroma", "hot stone", "thai", "foot", "swedish", "four hand", "body", "facial", "scrub", "sauna"].some(k => b.includes(k) && (a.includes(k) || (x.name.en || "").toLowerCase().includes(k)));
  return same && (!m.minutes || !x.min || +m.minutes === +x.min);
}

function vfBind(el) {
  el.querySelectorAll("[data-vff]").forEach(b => b.onclick = () => { VF.f = b.dataset.vff; vfDraw(); });
  const q = el.querySelector("#vfQ"); if (q) q.oninput = () => { VF.q = q.value; const p = q.selectionStart; vfDraw(); const n = document.getElementById("vfQ"); n.focus(); n.setSelectionRange(p, p); };
  el.querySelectorAll("[data-vfo]").forEach(h => h.onclick = e => { if (e.target.closest("a")) return; VF.open = VF.open === h.dataset.vfo ? null : h.dataset.vfo; vfDraw(); });
  const row = el.querySelector(".vf-row.open"); if (!row) return;
  const id = row.dataset.vfid, s = vfShop(id), x = vfSrc(id), c = x.crawled || {};
  const hr = row.querySelector("[data-vfhr]"); if (hr) hr.onclick = () => { const [o, cl] = hr.dataset.vfhr.split("-"); s.open = o; s.close = cl; vfShopSave(s, `영업시간을 ${o}~${cl} 로 바꿨어요`); };
  const ad = row.querySelector("[data-vfad]"); if (ad) ad.onclick = () => { s.address = { ko: c.address, en: c.address, vi: c.address }; vfShopSave(s, "주소를 바꿨어요"); };
  row.querySelectorAll("[data-vfmi]").forEach(b => b.onclick = () => {
    const i = +b.dataset.vfmi, m = (c.menu || [])[i], v = vfVnd(m.price), to = row.querySelector(`[data-vfto="${i}"]`).value;
    if (!to) return toast("어느 메뉴에 넣을지 골라 주세요");
    if (to === "new") { s.menu = (s.menu || []).concat({ name: { ko: m.name, en: m.name, vi: m.name }, min: +m.minutes || 0, price: v }); vfShopSave(s, `‘${m.name}’ 를 새 메뉴로 넣었어요 · 한국어 이름은 업체 편집에서 다듬어 주세요`); }
    else { const t = s.menu[+to]; t.price = v; if (!t.min && m.minutes) t.min = +m.minutes; vfShopSave(s, `${vfTx(t.name)} 가격을 ${vfMoney(v)} 로 넣었어요`); }
  });
  const ph = row.querySelector("#vfPh"), pn = row.querySelector("#vfPhN");
  if (ph) ph.onchange = () => vfSave(id, { photo_ok: ph.checked, photo_note: pn.value.trim() || null }, ph.checked ? "사진 사용 허락으로 표시했어요 · 통과한 사진이 공개될 수 있어요" : "사진 허락을 껐어요 · 업체 제공 · 홈페이지 사진은 공개 안 돼요");
  if (pn) pn.onchange = () => vfSave(id, { photo_note: pn.value.trim() || null }, "메모를 저장했어요");
  const rv = row.querySelector("[data-vfrv]"); if (rv) rv.onclick = () => vfSave(id, { review: rv.dataset.vfrv, reviewed_at: new Date().toISOString(), reviewed_by: ME.email }, rv.dataset.vfrv === "done" ? `${vfName(s)} 검수 완료` : "다시 검수 대기로 돌렸어요");
  const ig = row.querySelector("[data-vfimg]"); if (ig) ig.onclick = () => { MQ.shop = id; MQ.f = "all"; portalGo("imgqa"); mqDraw(); };
}

/* ===================== 🖼️ 이미지 검수 ===================== */
const MQ_SRC = { field: ["📷", "현장 사진", "우리가 찍음 · 공개 가능"], owner: ["🤝", "업체 제공", "사진 허락한 업체만 공개"], site: ["🌐", "홈페이지 후보", "허락 전 보여 주기용 · 공개 안 됨"] };
const MQ_ISS = { fake: "날조 · 과한 보정", distort: "왜곡 · 늘어남", text: "큰 글자 · 가격표", watermark: "워터마크 · 다른 로고", face: "사람 얼굴", body: "노출 · 선정적", blur: "흐림 · 어두움", stock: "스톡 사진 같음", off: "가게와 관계없음" };
const MQ_V = { none: ["판정 없음", ""], pass: ["✓ 통과", "g"], issue: ["⚠ 문제", "r"], hold: ["⏸ 보류", "w"] };
const mqCan = m => m.verdict === "pass" && m.source !== "site" && (m.source === "field" || vfSrc(m.shop_id).photo_ok);
const mqWhy = m => m.source === "site" ? "홈페이지 후보는 공개 안 돼요 (허락받으면 업체에게 원본을 받아 '업체 제공'으로)" : m.verdict !== "pass" ? "판정이 '통과'여야 공개돼요" : !vfSrc(m.shop_id).photo_ok && m.source === "owner" ? "업체 사진 사용 허락이 필요해요 (업체 정보 검수에서 체크)" : "";

async function mqLoad() {
  const r = await sb.from("shop_media").select("*").order("created_at", { ascending: false }).limit(1000);
  if (r.error) { MQ.err = /shop_media|42P01|PGRST20|schema cache/.test((r.error.message || "") + (r.error.code || "")) ? "setup" : r.error.message; MQ.list = []; }
  else { MQ.err = ""; MQ.list = r.data || []; }
  if (!VF.src) await vfLoad(); else mqDraw();
}
function mqDraw() {
  const el = document.getElementById("ptImgqa"); if (!el) return;
  if (!MQ.list) { el.innerHTML = `<p class="hint">불러오는 중…</p>`; mqLoad(); return; }
  if (MQ.err === "setup") { el.innerHTML = `<div class="uni-err">먼저 Supabase SQL 편집기에서 <b>supabase/universe48.sql</b> 을 실행해 주세요.</div>`; return; }
  if (MQ.err) { el.innerHTML = `<div class="uni-err">${esc(MQ.err)}</div>`; return; }
  const S = (typeof shops !== "undefined" ? shops : []).filter(isPub);
  const L = MQ.list;
  // 지금 노출 중인데 기록이 없는 사진 (출처 확인 필요)
  const known = new Set(L.map(m => m.work_url).concat(L.map(m => m.orig_url)));
  const orphan = S.filter(s => s.img && !known.has(s.img));
  const live = S.filter(s => s.img && L.some(m => m.work_url === s.img && mqCan(m))).length;
  const cnt = { all: L.length, todo: L.filter(m => m.verdict === "none").length, pass: L.filter(m => m.verdict === "pass").length, issue: L.filter(m => m.verdict === "issue").length, hold: L.filter(m => m.verdict === "hold").length };
  const F = { todo: m => m.verdict === "none", pass: m => m.verdict === "pass", issue: m => m.verdict === "issue", hold: m => m.verdict === "hold", all: () => true };
  const list = L.filter(m => (F[MQ.f] || F.all)(m) || MQ.keep.has(m.id)).filter(m => !MQ.shop || m.shop_id === MQ.shop);
  const shopOpts = S.map(s => `<option value="${esc(s.id)}" ${MQ.shop === s.id ? "selected" : ""}>${esc(vfName(s))} · ${esc(cityName(s.city))}</option>`).join("");
  el.innerHTML = `<div class="mq">
    <div class="vf-tiles"><div><small>전체 사진</small><b>${cnt.all}</b></div><div><small>판정 대기</small><b class="w">${cnt.todo}</b></div><div><small>통과</small><b class="g">${cnt.pass}</b></div><div><small>문제 표시</small><b class="r">⚠ ${cnt.issue}</b></div><div><small>사진 공개 중인 업체</small><b>${live} / ${S.length}</b></div></div>
    ${orphan.length ? `<div class="mq-orph"><b>🔎 출처 확인 필요 ${orphan.length}곳</b> <small>지금 손님 화면에 나오는데 어디서 온 사진인지 기록이 없어요. 우리가 찍었거나 허락받은 사진이면 출처를 고르고, 아니면 내려 주세요.</small>
      <div class="mq-orl">${orphan.map(s => `<div class="mq-oi"><img src="${esc(s.img)}" alt="" loading="lazy"><b>${esc(vfName(s))}</b><div><select data-mqos="${esc(s.id)}"><option value="">출처 고르기…</option><option value="field">📷 현장 사진 (우리가 찍음)</option><option value="owner">🤝 업체 제공 · 허락</option></select><button class="btn sm" data-mqdown="${esc(s.id)}">내리기</button></div></div>`).join("")}</div></div>` : ""}
    <div class="mq-up"><b>＋ 사진 올리기</b><select id="mqUpShop"><option value="">업체 고르기…</option>${shopOpts}</select>
      <select id="mqUpSrc"><option value="field">📷 현장 사진 (우리가 찍음)</option><option value="owner">🤝 업체가 준 사진</option></select>
      <label class="btn" for="mqFile">사진 고르기 (여러 장)</label><input type="file" id="mqFile" accept="image/*" multiple hidden>
      <span class="hint">또는</span><input id="mqUrl" placeholder="🌐 홈페이지 사진 주소 (후보로만 저장 · 공개 안 됨)"><button class="btn" id="mqUrlGo">후보 추가</button></div>
    <div class="vf-bar"><select id="mqShop"><option value="">모든 업체</option>${shopOpts}</select>
      ${[["todo", "판정 대기"], ["pass", "통과"], ["issue", "문제"], ["hold", "보류"], ["all", "전체"]].map(([k, t]) => `<button class="chip ${MQ.f === k ? "on" : ""}" data-mqf="${k}">${t} ${cnt[k]}</button>`).join("")}</div>
    <div class="mq-list">${list.map(mqCard).join("") || `<p class="hint" style="padding:16px">${MQ.shop ? "이 업체 사진이 아직 없어요 · 위에서 올려 주세요" : "사진이 없어요 · 위에서 올려 주세요"}</p>`}</div></div>`;
  mqBind(el);
}
function mqCard(m) {
  const s = vfShop(m.shop_id) || { id: m.shop_id, name: { ko: m.shop_id }, cat: "" }, x = vfSrc(m.shop_id), [ic, sn, sd] = MQ_SRC[m.source] || ["", m.source, ""];
  const can = mqCan(m), why = mqWhy(m), main = s.img && s.img === m.work_url;
  return `<div class="mq-card" data-mqid="${m.id}">
    <div class="mq-h"><b>${esc(vfName(s))}</b><a href="${vfPage(s)}" target="_blank" rel="noopener" title="엉클데이 페이지">🔗</a>${x.web ? `<a class="vf-lk" href="${esc(x.web)}" target="_blank" rel="noopener">🌐 홈페이지</a>` : ""}${x.fb ? `<a class="vf-lk fb" href="${esc(x.fb)}" target="_blank" rel="noopener">📘 페이스북</a>` : ""}
      <span class="mq-src" title="${esc(sd)}">${ic} ${sn}</span><span class="vf-st ${MQ_V[m.verdict][1]}">${MQ_V[m.verdict][0]}</span>${main ? `<span class="vf-st g">★ 대표 사진 노출 중</span>` : ""}</div>
    <div class="mq-3">
      <div><small>원본</small><div class="mq-img chk">${m.orig_url ? `<img src="${esc(m.orig_url)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-wh>` : "<i>없음</i>"}</div><small class="mq-wh" data-whof="o"></small></div>
      <div><small>작업본</small><div class="mq-img chk">${m.work_url ? `<img src="${esc(m.work_url)}" alt="" loading="lazy" data-wh>` : `<i>${m.source === "site" ? "홈페이지 후보는 작업본을 만들지 않아요" : "없음"}</i>`}</div><small class="mq-wh" data-whof="w"></small></div>
      <div><small>실제 노출 (손님 업체 화면)</small><div class="mq-live ${can ? "" : "off"}">${can && m.work_url ? `<img src="${esc(m.work_url)}" alt="" loading="lazy">` : `<div class="mq-ph">${typeof catGroup === "function" && catGroup(s.cat) ? catGroup(s.cat).icon : "🖼️"}<span>예시 이미지가 나가요</span></div>`}</div><small class="mq-why">${can ? (main ? "대표 사진으로 노출 중" : "공개 가능 · [대표 사진으로]를 누르면 노출돼요") : esc(why)}</small></div>
    </div>
    <div class="mq-act">
      <div class="mq-iss">${Object.entries(MQ_ISS).map(([k, t]) => `<label class="${(m.issues || []).includes(k) ? "on" : ""}"><input type="checkbox" data-mqis="${k}" ${(m.issues || []).includes(k) ? "checked" : ""}>${t}</label>`).join("")}</div>
      ${m.note ? `<p class="mq-note">🤖 ${esc(m.note)}</p>` : ""}
      <div class="mq-btns">${m.work_url ? `<button class="btn sm" data-mqai ${MQ.busy[m.id] ? "disabled" : ""}>${MQ.busy[m.id] ? "검사 중…" : "🤖 AI 검사"}</button>` : ""}
        <button class="btn sm ${m.verdict === "pass" ? "main" : ""}" data-mqv="pass">✓ 통과</button><button class="btn sm ${m.verdict === "issue" ? "bad" : ""}" data-mqv="issue">⚠ 문제</button><button class="btn sm" data-mqv="hold">⏸ 보류</button>
        <span style="flex:1"></span>${can && !main ? `<button class="btn sm main" data-mqmain>★ 대표 사진으로</button>` : ""}${main ? `<button class="btn sm" data-mqunmain>대표에서 내리기</button>` : ""}<button class="btn sm" data-mqdel title="기록 지우기">🗑</button></div>
    </div></div>`;
}

// 작업본: 긴 쪽 1600px · 정보(EXIF) 지움 · 살짝 밝기 맞춤 없이 원본 색 그대로 (과한 보정은 '날조'가 돼요)
function mqShrink(file, max) {
  return new Promise((ok, no) => { const img = new Image(); img.onload = () => {
    const k = Math.min(1, max / Math.max(img.width, img.height)), w = Math.round(img.width * k), h = Math.round(img.height * k);
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h; cv.getContext("2d").drawImage(img, 0, 0, w, h);
    cv.toBlob(b => b ? ok(b) : no(new Error("사진을 줄이지 못했어요")), "image/jpeg", 0.86); URL.revokeObjectURL(img.src); };
    img.onerror = () => no(new Error("사진을 열지 못했어요")); img.src = URL.createObjectURL(file); });
}
async function mqPut(blob, path) {
  const r = await sb.storage.from("images").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
  if (r.error) throw r.error; return sb.storage.from("images").getPublicUrl(path).data.publicUrl;
}
async function mqAdd(row) {
  const r = await sb.from("shop_media").insert({ ...row, created_by: ME.email }).select().single();
  if (r.error) throw r.error; MQ.list.unshift(r.data); return r.data;
}
async function mqUpd(m, patch, msg) {
  const r = await sb.from("shop_media").update({ ...patch, checked_at: new Date().toISOString(), checked_by: ME.email }).eq("id", m.id).select().single();
  if (r.error) return dbErr(r.error, "판정 저장");
  Object.assign(m, r.data); if (msg) toast(msg); mqDraw();
}
async function mqMain(m, on) {
  const s = vfShop(m.shop_id); if (!s) return;
  if (on) { s.img = m.work_url; s.imgPos = "50% 50%"; } else if (s.img === m.work_url) delete s.img;
  try { await dbSaveShop(s); toast(on ? "대표 사진으로 노출해요 (손님 화면 바로 · 검색엔진 페이지는 1시간 안)" : "대표 사진에서 내렸어요 · 예시 이미지가 나가요"); mqDraw(); } catch (e) { dbErr(e, "업체 저장"); }
}

function mqBind(el) {
  el.querySelectorAll("[data-mqf]").forEach(b => b.onclick = () => { MQ.f = b.dataset.mqf; MQ.keep.clear(); mqDraw(); });
  const sh = el.querySelector("#mqShop"); if (sh) sh.onchange = () => { MQ.shop = sh.value; mqDraw(); };
  if (MQ.shop) { const u = el.querySelector("#mqUpShop"); if (u) u.value = MQ.shop; }
  // 사진 크기 표시
  el.querySelectorAll("img[data-wh]").forEach(im => { const f = () => { const w = im.closest("div").parentElement.querySelector(".mq-wh"); if (w && im.naturalWidth) w.textContent = `${im.naturalWidth}×${im.naturalHeight}${im.naturalWidth < 800 ? " · 작아요" : ""}`; }; if (im.complete) f(); else im.onload = f; });
  const fi = el.querySelector("#mqFile");
  if (fi) fi.onchange = async () => {
    const shop = el.querySelector("#mqUpShop").value, src = el.querySelector("#mqUpSrc").value, files = [...fi.files]; fi.value = "";
    if (!shop) return toast("어느 업체 사진인지 먼저 골라 주세요");
    if (src === "owner" && !vfSrc(shop).photo_ok) toast("이 업체는 아직 사진 허락 표시가 없어요 · 올릴 수는 있지만 허락 전엔 공개 안 돼요", 4500);
    let n = 0;
    for (const f of files.slice(0, 20)) {
      try {
        const tag = `media/${shop}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
        const [o, w] = await Promise.all([mqShrink(f, 2400), mqShrink(f, 1600)]);
        const [ou, wu] = await Promise.all([mqPut(o, tag + "-o.jpg"), mqPut(w, tag + "-w.jpg")]);
        await mqAdd({ shop_id: shop, source: src, orig_url: ou, work_url: wu }); n++;
      } catch (e) { dbErr(e, `${f.name} 올리기`); }
    }
    if (n) { toast(`${n}장 올렸어요 · 판정해 주세요`); MQ.shop = shop; MQ.f = "todo"; mqDraw(); }
  };
  const ug = el.querySelector("#mqUrlGo");
  if (ug) ug.onclick = async () => {
    const shop = el.querySelector("#mqUpShop").value, u = el.querySelector("#mqUrl").value.trim();
    if (!shop) return toast("어느 업체 사진인지 먼저 골라 주세요");
    if (!/^https?:\/\/\S+$/.test(u)) return toast("사진 주소(https://…)를 넣어 주세요");
    try { await mqAdd({ shop_id: shop, source: "site", orig_url: u }); toast("홈페이지 후보로 저장했어요 · 허락 전에는 공개 안 돼요"); MQ.shop = shop; mqDraw(); } catch (e) { dbErr(e, "후보 저장"); }
  };
  el.querySelectorAll("[data-mqos]").forEach(sel => sel.onchange = async () => {
    const id = sel.dataset.mqos, s = vfShop(id); if (!sel.value || !s) return;
    try { await mqAdd({ shop_id: id, source: sel.value, orig_url: s.img, work_url: s.img, verdict: "none" }); toast("출처를 기록했어요 · 판정해 주세요"); MQ.shop = id; MQ.f = "all"; mqDraw(); } catch (e) { dbErr(e, "출처 기록"); }
  });
  el.querySelectorAll("[data-mqdown]").forEach(b => b.onclick = () => { const s = vfShop(b.dataset.mqdown); if (!s) return;
    confirmBox(`${vfName(s)} 사진을 내릴까요?`, async () => { delete s.img; try { await dbSaveShop(s); toast("내렸어요 · 예시 이미지가 나가요"); mqDraw(); } catch (e) { dbErr(e, "업체 저장"); } }, "출처를 모르는 사진은 내리는 게 안전해요"); });
  el.querySelectorAll(".mq-card").forEach(card => {
    const m = MQ.list.find(x => x.id === +card.dataset.mqid); if (!m) return;
    card.querySelectorAll("[data-mqv]").forEach(b => b.onclick = () => {
      const v = b.dataset.mqv;
      if (v === "issue" && !(m.issues || []).length) return toast("어떤 문제인지 아래에서 하나 이상 골라 주세요");
      if (v === "pass" && (m.issues || []).some(k => ["fake", "watermark", "body", "off"].includes(k))) return toast("‘날조 · 워터마크 · 노출 · 관계없음’ 표시가 있으면 통과할 수 없어요", 4200);
      MQ.keep.add(m.id); mqUpd(m, { verdict: v }, MQ_V[v][0] + " 으로 판정했어요");
      if (v !== "pass") { const s = vfShop(m.shop_id); if (s && s.img === m.work_url) mqMain(m, false); }
    });
    card.querySelectorAll("[data-mqis]").forEach(c => c.onchange = () => { const k = c.dataset.mqis; const is = new Set(m.issues || []); c.checked ? is.add(k) : is.delete(k); mqUpd(m, { issues: [...is] }); });
    const ai = card.querySelector("[data-mqai]"); if (ai) ai.onclick = () => mqAi(m);
    const mm = card.querySelector("[data-mqmain]"); if (mm) mm.onclick = () => mqMain(m, true);
    const um = card.querySelector("[data-mqunmain]"); if (um) um.onclick = () => mqMain(m, false);
    const dl = card.querySelector("[data-mqdel]"); if (dl) dl.onclick = () => confirmBox("이 사진 기록을 지울까요?", async () => {
      const s = vfShop(m.shop_id); if (s && s.img === m.work_url) await mqMain(m, false);
      const r = await sb.from("shop_media").delete().eq("id", m.id); if (r.error) return dbErr(r.error, "지우기");
      const paths = [m.orig_url, m.work_url].filter(u => u && u.includes("/object/public/images/media/")).map(u => u.split("/object/public/images/")[1]);
      if (paths.length) await sb.storage.from("images").remove(paths);
      MQ.list = MQ.list.filter(x => x.id !== m.id); toast("지웠어요"); mqDraw(); }, "올린 사진 파일도 함께 지워요");
  });
}
async function mqAi(m) {
  MQ.busy[m.id] = 1; mqDraw();
  try {
    const s = vfShop(m.shop_id) || {}; const { data: { session } } = await sb.auth.getSession();
    const r = await fetch(`${SUPA.url}/functions/v1/media-check`, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPA.key, Authorization: "Bearer " + (session && session.access_token) },
      body: JSON.stringify({ url: m.work_url, shop: vfName(s), kind: typeof catName === "function" ? catName(s.cat) : "" }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || (r.status === 404 ? "Edge Function 'media-check' 을 먼저 배포해 주세요" : "error " + r.status));
    const is = [...new Set((m.issues || []).concat(j.issues || []))];
    await mqUpd(m, { issues: is, note: [j.what, j.note].filter(Boolean).join(" · ") }, j.issues && j.issues.length ? `🤖 문제 ${j.issues.length}개를 찾았어요 · 확인해 주세요` : "🤖 눈에 띄는 문제가 없어요 · 판정은 직접 해 주세요");
  } catch (e) { toast("AI 검사 실패: " + e.message, 5000); }
  delete MQ.busy[m.id]; mqDraw();
}

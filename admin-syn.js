/* 🔎 검색 동의어 (universe44) — 캐시바이 '검색 동의어' 방식
   - 업체 · 카테고리마다 다른 이름(칩)을 붙이면, 손님이 그 말로 검색해도 그 업체가 나와요
   - 위쪽 '못 찾은 검색어': 손님이 검색했는데 결과가 0개였던 말 → 눌러서 바로 동의어로 붙여요
   - '검색해 보기': 지금 동의어로 손님 화면에서 무엇이 나오는지 바로 확인 */
let SYN = [], SYN_MISS = [], SYN_MISS_V = [], SYN_READY = false, SYN_ERR = "", SYN_Q = "", SYN_ONLY = false, SYN_TRY = "";
const SYN_STATE = {};   // "kind:target" → "wait" | "ok" | "fail"
const synNorm = t => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/\s+/g, "");
const synKey = (k, t) => k + ":" + t;
const synWords = (k, t) => ((SYN.find(x => x.kind === k && x.target === t) || {}).words || []);
const synShown = (k, t) => ((SYN.find(x => x.kind === k && x.target === t) || {}).shown || []).filter(w => synWords(k, t).includes(w));
const SYN_SHOW_MAX = 10;   // 업체 한 곳 해시태그는 10개까지 (너무 많으면 검색엔진이 도배로 봐요)

async function synLoad() {
  SYN_ERR = "";
  const r = await sb.from("search_synonyms").select("*");
  if (r.error) { SYN_ERR = /relation|does not exist|schema cache/i.test(r.error.message || "") ? "sql" : (r.error.message || "오류"); SYN = []; }
  else SYN = r.data || [];
  const m = await sb.rpc("search_miss_list", { days: 30 });
  SYN_MISS = m.error ? [] : (m.data || []);
  SYN_READY = true;
}

// 손님 화면(app.js)과 같은 방법으로 찾아요
function synTextOf(s) {
  const cat = catDetail(s.cat) || {}, grp = catGroup(s.cat), city = CITIES.find(c => c.id === s.city) || {};
  return synNorm(JSON.stringify([s.name, s.tags, (s.menu || []).map(m => m.name), s.desc, s.recommend, s.address, cat.name, cat.sub, grp.name, city.name,
    synWords("shop", s.id).join(" "), synWords("cat", s.cat).join(" ")]));
}
function synSearch(q) {
  const full = synNorm(q), words = String(q).split(/\s+/).map(synNorm).filter(Boolean);
  if (!full) return [];
  const pub = shops.filter(isPub);
  const whole = pub.filter(s => synTextOf(s).includes(full));
  return whole.length ? whole : pub.filter(s => { const t = synTextOf(s); return words.every(w => t.includes(w)); });
}

function synTargets() {
  const cats = CATEGORY_DETAIL.map(c => ({ kind: "cat", id: c.id, ko: c.name.ko, en: c.name.en, sub: `카테고리 · 업체 ${shops.filter(s => s.cat === c.id).length}곳`, names: [c.name.ko, c.name.en, c.name.vi] }));
  const sh = shops.slice().sort((a, b) => (a.city || "").localeCompare(b.city || "") || (a.name.ko || "").localeCompare(b.name.ko || "", "ko"))
    .map(s => ({ kind: "shop", id: s.id, ko: s.name.ko || s.name.en, en: s.name.en, sub: `업체 · ${cityName(s.city)} · ${catName(s.cat)}${isPub(s) ? "" : " · 숨김"}`, names: [s.name.ko, s.name.en, s.name.vi], hangulMissing: !/[가-힣]/.test(s.name.ko || "") }));
  return cats.concat(sh);
}

async function drawSyn() {
  const box = $("tab-syn");
  if (!SYN_READY) { box.innerHTML = `<p class="hint" style="padding:20px">불러오는 중…</p>`; await synLoad(); }
  if (SYN_ERR === "sql") { box.innerHTML = `<div class="syn"><h2>🔎 검색 동의어</h2><div class="syn-warn">먼저 Supabase → SQL Editor 에서 <b>universe44.sql</b> 을 실행해 주세요. 실행하면 업체 · 카테고리 기본 동의어가 함께 들어가요.</div></div>`; return; }
  const T = synTargets();
  const nWords = SYN.reduce((t, x) => t + (x.words || []).length, 0);
  const q = synNorm(SYN_Q);
  const rows = T.filter(t => (!SYN_ONLY || synWords(t.kind, t.id).length) && (!q || synNorm([t.ko, t.en, t.id, ...synWords(t.kind, t.id)].join(" ")).includes(q)));
  const hits = SYN_TRY ? synSearch(SYN_TRY) : null;
  // 지금은 동의어로 찾아지는 말은 빼고 보여 줘요
  const miss = SYN_MISS.filter(m => !synSearch(m.q).length);
  const missOpts = T.map(t => `<option value="${t.kind}:${esc(t.id)}">${t.kind === "cat" ? "📁 " : ""}${esc(t.ko)}${t.en && t.en !== t.ko ? " · " + esc(t.en) : ""}</option>`).join("");
  SYN_MISS_V = miss;
  box.innerHTML = `<div class="syn">
    <div class="syn-head"><h2>🔎 검색 동의어</h2><p>업체 · 카테고리의 다른 이름을 등록해요. 손님이 그 말로 검색해도 해당 업체가 나와요. <small>(띄어쓰기 · 대소문자 · 베트남어 성조는 원래 무시돼요)</small></p>
      <p class="syn-howto"><b>#</b> 표시가 붙은 초록 칩은 업체 상세 화면과 구글 · 네이버용 업체 페이지에 <b>#해시태그</b>로 보여요. 칩 앞 <b>👁</b>을 누르면 켜고 꺼요. 오타 · 줄임말은 끄고, <b>‘나트랑 커플 스파’</b>처럼 실제 검색어 모양을 켜 두면 외부 검색에 잘 걸려요. (업체마다 ${SYN_SHOW_MAX}개까지)</p></div>
    ${miss.length ? `<div class="syn-miss"><div class="syn-miss-h"><b>🙈 손님이 검색했는데 못 찾은 말</b><small>최근 30일 · 많은 순 · 눌러서 동의어로 붙이기</small></div>
      <div class="syn-miss-list">${miss.slice(0, 40).map((m, i) => `<button type="button" class="syn-mchip" data-mi="${i}">${esc(m.q)} <i>${m.n}회</i></button>`).join("")}</div>
      <div class="syn-pick" id="synPick" hidden><span>‘<b id="synPickW"></b>’ 를 어디에 붙일까요?</span><select id="synPickT"><option value="">고르기…</option>${missOpts}</select><button class="btn main" id="synPickGo">붙이기</button><button class="btn" id="synPickX">닫기</button></div></div>` : ""}
    <div class="syn-try"><label for="synTry">🧪 검색해 보기</label><input id="synTry" placeholder="손님처럼 검색해 보세요 (예: 빈펄, 하버드, 안마)" value="${esc(SYN_TRY)}">
      ${hits ? `<div class="syn-try-r">${hits.length ? `<b>${hits.length}곳 나와요</b> ${hits.slice(0, 12).map(s => `<span class="syn-hit">${esc(s.name.ko || s.name.en)}</span>`).join("")}${hits.length > 12 ? ` <small>외 ${hits.length - 12}곳</small>` : ""}` : `<b class="bad">0곳 · 아무것도 안 나와요</b> <small>아래에서 맞는 업체에 이 말을 동의어로 붙여 주세요</small>`}</div>` : ""}</div>
    <div class="syn-bar"><input id="synQ" placeholder="🔍 업체 또는 카테고리 이름 검색" value="${esc(SYN_Q)}">
      <span class="hint">업체 ${shops.length} · 카테고리 ${CATEGORY_DETAIL.length} · 동의어 ${nWords}개</span>
      <label class="syn-only"><input type="checkbox" id="synOnly" ${SYN_ONLY ? "checked" : ""}> 동의어 있는 것만</label>
      <span class="syn-legend"><i class="ok">✓</i> 적용 완료 <i class="wait">◌</i> 저장 중 <i class="fail">!</i> 실패</span></div>
    <div class="syn-tbl"><div class="syn-tr syn-th"><span>업체 · 카테고리</span><span>동의어</span><span>적용 위치</span><span></span></div>
      ${rows.map(t => synRow(t)).join("") || `<p class="hint" style="padding:16px">맞는 항목이 없어요</p>`}</div></div>`;
  synBind(box);
}

function synRow(t) {
  const w = synWords(t.kind, t.id), st = SYN_STATE[synKey(t.kind, t.id)];
  const sh = synShown(t.kind, t.id);
  const where = t.kind === "cat" ? ["홈 검색 · 이 카테고리 업체 전부", "검색 결과 · 업체"] : ["홈 검색 · 이 업체", "검색 결과 · 업체"];
  const mark = st === "wait" ? `<i class="wait">◌</i>` : st === "fail" ? `<i class="fail">!</i>` : `<i class="ok">✓</i>`;
  return `<div class="syn-tr" data-k="${t.kind}" data-t="${esc(t.id)}">
    <div class="syn-name"><small>${t.kind === "cat" ? "카테고리" : "업체"}</small><b>${esc(t.ko)}</b>${t.en && t.en !== t.ko ? `<span>${esc(t.en)}</span>` : ""}<small class="syn-sub">${esc(t.sub)}</small>${t.hangulMissing && !w.length ? `<em class="syn-tip">한글 이름이 없어요 · 한글로 검색할 말을 붙여 주세요</em>` : ""}</div>
    <div class="syn-chips">${w.map(x => { const on = t.kind === "shop" && sh.includes(x);
        return `<span class="syn-chip ${on ? "shown" : ""}">${t.kind === "shop" ? `<button type="button" class="syn-eye" data-eye="${esc(x)}" title="${on ? "업체 페이지에 #해시태그로 보여요 · 누르면 숨김" : "사이트 안 검색에만 써요 · 누르면 #해시태그로 보이기"}" aria-pressed="${on}">${on ? "#" : "👁"}</button>` : ""}${esc(x)}<button type="button" data-del="${esc(x)}" aria-label="${esc(x)} 지우기">×</button></span>`; }).join("")}
      <span class="syn-add"><button type="button" class="syn-addb">＋ 추가</button><input class="syn-in" placeholder="새 이름 · Enter (쉼표로 여러 개)" hidden></span></div>
    <div class="syn-where">${w.length ? where.map(x => `<span>${mark} ${x}</span>`).join("") + (t.kind === "shop" ? (sh.length ? `<span>${mark} 업체 페이지 · #해시태그 ${sh.length}개 <small>(구글 · 네이버)</small></span>` : `<span class="hint">#해시태그 없음</span>`) : "") : `<span class="hint">동의어 없음</span>`}</div>
    <div>${w.length ? `<button type="button" class="syn-clear" title="동의어 모두 지우기">🗑</button>` : ""}</div></div>`;
}

async function synSave(kind, target, words, msg, shown) {
  const k = synKey(kind, target); SYN_STATE[k] = "wait";
  const old = SYN.find(x => x.kind === kind && x.target === target);
  const sh = (shown || synShown(kind, target)).filter(x => words.includes(x));
  const row = { kind, target, words, shown: sh, updated_at: new Date().toISOString(), updated_by: (ME && ME.email) || null };
  if (old) Object.assign(old, row); else SYN.push(row);
  drawSyn();
  const r = await sb.from("search_synonyms").upsert(row);
  if (r.error) { SYN_STATE[k] = "fail"; drawSyn(); return dbErr(r.error, "동의어 저장"); }
  SYN_STATE[k] = "ok"; drawSyn(); if (msg) toast(msg);
}

// 같은 말이 다른 곳에 이미 붙어 있거나, 원래 이름에 들어 있으면 알려 줘요
function synAddWords(kind, target, raw) {
  const cur = synWords(kind, target).slice();
  const t = synTargets().find(x => x.kind === kind && x.id === target) || { names: [] };
  const own = synNorm(t.names.join(" "));
  const added = [], skipped = [];
  String(raw).split(/[,，、\n]/).map(x => x.trim().slice(0, 30)).filter(Boolean).forEach(w => {
    const n = synNorm(w);
    if (!n || cur.some(x => synNorm(x) === n)) return;
    if (own.includes(n)) { skipped.push(`‘${w}’ 는 이미 이름에 있어서 따로 안 붙여도 나와요`); return; }
    const dup = SYN.find(x => !(x.kind === kind && x.target === target) && (x.words || []).some(y => synNorm(y) === n));
    if (dup) { const d = synTargets().find(x => x.kind === dup.kind && x.id === dup.target); skipped.push(`‘${w}’ 는 ${d ? d.ko : dup.target} 에도 붙어 있어요 (둘 다 나와요)`); }
    cur.push(w); added.push(w);
  });
  if (cur.length > 30) { toast("한 곳에 30개까지 붙일 수 있어요"); return; }
  if (skipped.length) toast(skipped.join(" · "), 4200);
  if (added.length) synSave(kind, target, cur, `‘${added.join(", ")}’ 붙였어요`);
}

function synBind(box) {
  const q = box.querySelector("#synQ"); q.oninput = () => { SYN_Q = q.value; const p = q.selectionStart; drawSyn(); const n = $("synQ"); n.focus(); n.setSelectionRange(p, p); };
  box.querySelector("#synOnly").onchange = e => { SYN_ONLY = e.target.checked; drawSyn(); };
  const tr = box.querySelector("#synTry"); let tt = null;
  tr.oninput = () => { clearTimeout(tt); tt = setTimeout(() => { SYN_TRY = tr.value.trim(); const p = tr.selectionStart; drawSyn(); const n = $("synTry"); n.focus(); n.setSelectionRange(p, p); }, 250); };
  box.querySelectorAll(".syn-tr[data-k]").forEach(row => {
    const kind = row.dataset.k, target = row.dataset.t;
    const b = row.querySelector(".syn-addb"), inp = row.querySelector(".syn-in");
    b.onclick = () => { b.hidden = true; inp.hidden = false; inp.focus(); };
    inp.onkeydown = e => {
      if (e.isComposing) return;
      if (e.key === "Escape") { inp.value = ""; inp.hidden = true; b.hidden = false; }
      if (e.key === "Enter") { e.preventDefault(); const v = inp.value; inp.value = ""; if (v.trim()) synAddWords(kind, target, v); }
    };
    inp.onblur = () => { if (!inp.value.trim()) { inp.hidden = true; b.hidden = false; } };
    row.querySelectorAll("[data-eye]").forEach(x => x.onclick = () => {
      const w = x.dataset.eye, cur = synShown(kind, target), on = cur.includes(w);
      if (!on && cur.length >= SYN_SHOW_MAX) return toast(`해시태그는 업체마다 ${SYN_SHOW_MAX}개까지예요 · 너무 많으면 검색엔진이 도배로 봐요`, 4200);
      synSave(kind, target, synWords(kind, target), on ? `‘${w}’ 해시태그를 숨겼어요 (검색에는 계속 써요)` : `‘${w}’ 를 #해시태그로 보여요`, on ? cur.filter(y => y !== w) : cur.concat(w));
    });
    row.querySelectorAll("[data-del]").forEach(x => x.onclick = () => synSave(kind, target, synWords(kind, target).filter(w => w !== x.dataset.del), `‘${x.dataset.del}’ 뺐어요`));
    const c = row.querySelector(".syn-clear");
    if (c) c.onclick = () => confirmBox("이 항목의 동의어를 모두 지울까요?", () => synSave(kind, target, [], "동의어를 모두 지웠어요"), synWords(kind, target).join(", "));
  });
  // 못 찾은 검색어 → 동의어로
  let pickW = "";
  box.querySelectorAll("[data-mi]").forEach(x => x.onclick = () => {
    pickW = SYN_MISS_V[+x.dataset.mi].q; $("synPick").hidden = false; $("synPickW").textContent = pickW;
    // 비슷한 이름이 있으면 미리 골라 둬요
    const n = synNorm(pickW), guess = synTargets().find(t => synNorm(t.names.join(" ")).includes(n) || n.includes(synNorm(t.ko).slice(0, 3)));
    $("synPickT").value = guess ? `${guess.kind}:${guess.id}` : ""; $("synPickT").focus();
  });
  if ($("synPickGo")) {
    $("synPickGo").onclick = () => { const v = $("synPickT").value; if (!v) return toast("붙일 업체나 카테고리를 골라 주세요"); const i = v.indexOf(":"); synAddWords(v.slice(0, i), v.slice(i + 1), pickW); };
    $("synPickX").onclick = () => { $("synPick").hidden = true; };
  }
}

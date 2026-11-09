/* 엉클데이 관리자 — 업무: 할 일 보드, 업체 영업 진행 */
let TASKS = [], LEADS = [], ADMINS = [], CMT_N = {};
const TASK_COLS = [["todo", "할 일"], ["doing", "진행 중"], ["done", "완료"]];
const LEAD_COLS = [["found", "후보 발굴", "찾아 둔 업체"], ["contacted", "연락함", "첫 연락·답 기다림"], ["meeting", "미팅", "방문·통화 상담"],
  ["negotiating", "계약 협의", "수수료·조건 조율"], ["signed", "계약 완료", "사이트 등록 준비"], ["live", "입점 완료", "사이트에 공개됨"], ["hold", "보류·거절", "나중에 다시"]];
const PRI = [["0", "낮음"], ["1", "보통"], ["2", "높음"]];
const LOGK = { call: "📞 통화", msg: "💬 메시지", visit: "🚶 방문", memo: "📝 메모" };
let workView = "tasks", workWho = "all", showAllDone = false;

async function loadWork() {
  const [t, l, a] = await Promise.all([
    sb.from("tasks").select("*").order("created_at", { ascending: false }).limit(3000),
    sb.from("leads").select("*").order("updated_at", { ascending: false }).limit(3000),
    sb.from("admins").select("email,name").order("created_at")]);
  TASKS = t.error ? [] : t.data; LEADS = l.error ? [] : l.data; ADMINS = a.error ? [] : a.data;
  const c = await sb.from("comments").select("target_id").limit(20000);
  CMT_N = {}; (c.error ? [] : c.data).forEach(x => CMT_N[x.target_id] = (CMT_N[x.target_id] || 0) + 1);
  return !t.error && !l.error;
}
// 사람 이름: 닉네임이 있으면 닉네임, 없으면 이메일 앞부분
const who = e => { if (!e) return "미지정"; const a = ADMINS.find(x => x.email.toLowerCase() === String(e).toLowerCase()); return (a && a.name) || String(e).split("@")[0]; };
const NICK_RE = /^[A-Za-z0-9._\-가-힣]{1,12}$/;
// @ 자동완성: 입력칸에서 @를 치면 사람 목록이 떠요
function atPicker(input, onPick, opts = {}) {
  const box = document.createElement("div"); box.className = "at-pop"; box.hidden = true; input.parentNode.style.position = "relative"; input.parentNode.appendChild(box);
  let list = [], sel = 0, q = null;
  const close = () => { box.hidden = true; q = null; };
  const draw = () => {
    if (!list.length) return close();
    box.innerHTML = list.map((a, i) => `<button type="button" class="${i === sel ? "on" : ""}" data-i="${i}"><span class="av">${esc(who(a.email).slice(0, 1).toUpperCase())}</span><b>${esc(who(a.email))}</b><small>${esc(a.email)}</small></button>`).join("");
    box.hidden = false; box.querySelectorAll("[data-i]").forEach(b => b.onmousedown = e => { e.preventDefault(); pick(list[+b.dataset.i]); });
  };
  const pick = a => { const r = onPick(a, q); close(); return r; };
  input.addEventListener("input", () => {
    const v = input.value.slice(0, input.selectionStart ?? input.value.length);
    const m = opts.whole ? v.match(/^@?([\w.\-가-힣]*)$/) : v.match(/(?:^|\s)@([\w.\-가-힣]*)$/);
    if (!m) return close();
    q = m[1].toLowerCase();
    list = ADMINS.filter(a => (!opts.skip || !opts.skip(a)) && (who(a.email).toLowerCase().includes(q) || a.email.toLowerCase().includes(q))).slice(0, 8); sel = 0; draw();
  });
  input.addEventListener("keydown", e => {
    if (box.hidden || e.isComposing) return;
    if (e.key === "ArrowDown") { e.preventDefault(); sel = (sel + 1) % list.length; draw(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); sel = (sel - 1 + list.length) % list.length; draw(); }
    else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); e.stopImmediatePropagation(); pick(list[sel]); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
  }, true);
  input.addEventListener("blur", () => setTimeout(close, 150));
}
const dueTag = d => { if (!d) return ""; const t = vnToday(); const cls = d < t ? "late" : d === t ? "today" : ""; return `<span class="chip ${cls}">📅 ${dayKo(d)}${d < t ? " 지남" : d === t ? " 오늘" : ""}</span>`; };
const watching = (x, e) => Array.isArray(x.watchers) && x.watchers.includes(e);
const whoOk = x => workWho === "all" || (workWho === "me" ? x.assignee === ME.email || watching(x, ME.email) : workWho === "ref" ? watching(x, ME.email) : workWho === "none" ? !x.assignee : x.assignee === workWho || watching(x, workWho));
const adminOpts = (sel, blank = "미지정") => `<option value="">${blank}</option>` + ADMINS.map(a => `<option value="${esc(a.email)}" ${a.email === sel ? "selected" : ""}>${esc(who(a.email))}${a.email === ME.email ? " (나)" : ""}</option>`).join("");
// 고르기 칸을 노션처럼 색깔 버튼으로 (원래 칸은 숨겨 두고 값만 맞춰요)
function pills(sel, colors) {
  if (!sel) return;
  const box = document.createElement("div"); box.className = "pills";
  const draw = () => { box.innerHTML = [...sel.options].map(o => `<button type="button" class="pill ${colors[o.value] || "gray"} ${o.value === sel.value ? "on" : ""}" data-v="${esc(o.value)}">${esc(o.textContent)}</button>`).join("");
    box.querySelectorAll("[data-v]").forEach(b => b.onclick = e => { e.preventDefault(); sel.value = b.dataset.v; sel.dispatchEvent(new Event("change")); draw(); }); };
  sel.hidden = true; sel.after(box); draw();
}
const leadById = id => LEADS.find(l => l.id === id);

// 대시보드 '할 일'에 쓰는 숫자
function workTodos() {
  const t = vnToday();
  return [
    ["myTask", "✅", "오늘까지 해야 할 내 일", TASKS.filter(x => x.status !== "done" && x.assignee === ME.email && x.due && x.due <= t).length, () => { workView = "tasks"; workWho = "me"; showTab("work"); }],
    ["refMe", "👥", "나를 참조한 진행 중인 일", TASKS.filter(x => x.status !== "done" && watching(x, ME.email)).length, () => { workView = "tasks"; workWho = "ref"; showTab("work"); }],
    ["leadLate", "🤝", "다음 연락일이 지난 영업 업체", LEADS.filter(l => !["live", "hold"].includes(l.stage) && l.next_date && l.next_date < t).length, () => { workView = "leads"; workWho = "all"; showTab("work"); }]
  ];
}

function drawWork() {
  const t = vnToday();
  if (workView === "guide") {
    $("tab-work").innerHTML = `<div class="work-top"><div class="seg"><button data-v="tasks">✅ 할 일 보드</button><button data-v="leads">🤝 업체 영업</button><button data-v="guide" class="on">📘 사용 안내</button></div></div><div id="guideBox"></div>`;
    $("tab-work").querySelectorAll("[data-v]").forEach(b => b.onclick = () => { workView = b.dataset.v; drawWork(); });
    drawGuide($("guideBox")); return;
  }
  $("tab-work").innerHTML = `
    <div class="work-top">
      <div class="seg"><button data-v="tasks" class="${workView === "tasks" ? "on" : ""}">✅ 할 일 보드</button><button data-v="leads" class="${workView === "leads" ? "on" : ""}">🤝 업체 영업</button><button data-v="guide" class="${workView === "guide" ? "on" : ""}">📘 사용 안내</button></div>
      <select id="wWho"><option value="all">담당자 전체</option><option value="me" ${workWho === "me" ? "selected" : ""}>내 것 (담당+참조)</option><option value="ref" ${workWho === "ref" ? "selected" : ""}>나를 참조한 것</option><option value="none" ${workWho === "none" ? "selected" : ""}>미지정</option>${ADMINS.filter(a => a.email !== ME.email).map(a => `<option value="${esc(a.email)}" ${workWho === a.email ? "selected" : ""}>${esc(who(a.email))}</option>`).join("")}</select>
      <span class="grow"></span>
      ${workView === "leads" ? `<button class="btn main" id="leadNew">＋ 영업 업체 추가</button>` : `<button class="btn main" id="taskNew">＋ 할 일</button>`}
    </div>
    ${(ADMINS.find(a => a.email === ME.email) || {}).name ? "" : `<div class="nick-nudge">👋 <b>닉네임</b>을 정하면 팀원들이 이메일 대신 이름으로 보고, <b>@이름</b>으로 부를 수 있어요. <button class="btn sm main" id="nickGo">⚙️ 계정에서 정하기</button></div>`}
    <div class="kanban ${workView}" id="kb"></div>
    <p class="hint" style="margin:10px 0 40px">${workView === "tasks" ? "카드는 <b>작성한 순서</b>로 놓여요. 끌어서 <b>위아래 순서</b>를 바꾸거나 다른 칸에 놓을 수 있고, <b>이동 ▸</b>으로 바로 옮길 수도 있어요 (옮긴 칸의 맨 아래로). 완료는 최근 30일만 보여요." : "업체 카드를 끌거나 <b>이동 ▸</b>을 눌러 단계를 옮겨요. 단계·담당자가 바뀌면 누가 언제 바꿨는지 자동으로 기록돼요. 다음 연락일이 지나면 빨갛게 표시돼요."}</p>`;
  $("tab-work").querySelectorAll("[data-v]").forEach(b => b.onclick = () => { workView = b.dataset.v; drawWork(); });
  if ($("nickGo")) $("nickGo").onclick = () => showTab("acc");
  $("wWho").onchange = e => { workWho = e.target.value; drawWork(); };
  if ($("taskNew")) $("taskNew").onclick = () => editTask(null, { assignee: ME.email });
  if ($("leadNew")) $("leadNew").onclick = () => newLead();
  workView === "tasks" ? drawTasks() : drawLeads();
}

/* ---------- 할 일 보드 ---------- */
function drawTasks() {
  const t = vnToday(), cut = new Date(Date.now() - 30 * 864e5).toISOString();
  const sortT = (a, b) => ordKey(a) - ordKey(b);
  $("kb").innerHTML = TASK_COLS.map(([k, n]) => {
    let list = TASKS.filter(x => x.status === k && whoOk(x));
    const hidden = k === "done" && !showAllDone ? list.filter(x => (x.done_at || x.updated_at) < cut).length : 0;
    if (k === "done") list = list.filter(x => showAllDone || (x.done_at || x.updated_at) >= cut);
    list.sort(sortT);
    return `<div class="kcol" data-col="${k}"><div class="khead"><b>${n}</b><span class="kn">${list.length}</span></div>
      ${k !== "done" ? `<input class="kadd" data-add="${k}" placeholder="＋ 입력하고 Enter">` : ""}
      <div class="kcards">${list.map(x => taskCard(x)).join("") || `<div class="kempty">비어 있어요</div>`}</div>
      ${hidden ? `<button class="btn sm" id="moreDone">완료 ${hidden}개 더 보기</button>` : ""}</div>`;
  }).join("");
  $("kb").querySelectorAll("[data-add]").forEach(inp => inp.onkeydown = async e => {
    if (e.key !== "Enter" || e.isComposing || !inp.value.trim()) return;
    const row = { title: inp.value.trim(), status: inp.dataset.add, assignee: workWho !== "all" && workWho !== "none" ? (workWho === "me" ? ME.email : workWho) : ME.email };
    inp.disabled = true;
    try { TASKS.unshift(await q(sb.from("tasks").insert(row).select().single(), "할 일 추가")); drawTasks(); $("kb").querySelector(`[data-add="${row.status}"]`).focus(); } catch (err) { inp.disabled = false; }
  });
  if ($("moreDone")) $("moreDone").onclick = () => { showAllDone = true; drawTasks(); };
  bindKanban("task", async (id, col, pos) => {
    const x = TASKS.find(y => y.id === id); if (!x) return;
    const patch = { pos }; if (x.status !== col) patch.status = col;
    const r = await movePatch("tasks", id, patch); if (r) { TASKS[TASKS.indexOf(x)] = r; drawTasks(); drawCounts(); }
  }, id => editTask(id));
}
function taskCard(x) {
  const sh = x.shop_id && shopById(x.shop_id), ld = x.lead_id && leadById(x.lead_id);
  return `<div class="kcard pri${x.priority} ${x.status === "done" ? "done" : ""}" draggable="true" data-id="${x.id}" data-k="${ordKey(x)}" title="중요도: ${(PRI.find(p => +p[0] === x.priority) || [, ""])[1]}">
    <div class="kt">${esc(x.title)}</div>
    ${x.memo ? (() => { const t = richText(x.memo); const ck = (x.memo.match(/<li[^>]*>/g) || []).length && /class="check"/.test(x.memo) ? [((x.memo.match(/<ul class="check">[\s\S]*?<\/ul>/g) || []).join("").match(/<li data-done/g) || []).length, ((x.memo.match(/<ul class="check">[\s\S]*?<\/ul>/g) || []).join("").match(/<li/g) || []).length] : null;
      return `${t ? `<div class="km">${esc(t.length > 70 ? t.slice(0, 70) + "…" : t)}</div>` : ""}${ck && ck[1] ? `<div class="km ckp"><span style="width:${Math.round(ck[0] / ck[1] * 100)}%"></span><em>☑ ${ck[0]}/${ck[1]}</em></div>` : ""}`; })() : ""}
    <div class="kchips">${x.status !== "done" ? dueTag(x.due) : ""}<span class="chip">👤 ${esc(who(x.assignee))}</span>${(x.watchers || []).length ? `<span class="chip ref" title="참조: ${esc(x.watchers.join(", "))}">👥 ${esc(x.watchers.map(who).join(", "))}</span>` : ""}${sh ? `<span class="chip">🏪 ${esc(sh.name.ko)}</span>` : ""}${ld ? `<span class="chip">🤝 ${esc(ld.name)}</span>` : ""}${CMT_N[x.id] ? `<span class="chip">💬 ${CMT_N[x.id]}</span>` : ""}</div></div>`;
}
function editTask(id, preset = {}) {
  const x = id ? TASKS.find(y => y.id === id) : { title: "", memo: "", status: "todo", assignee: "", due: null, priority: 1, shop_id: null, lead_id: null, watchers: [], ...preset };
  let refs = [...(x.watchers || [])];
  const d = document.createElement("div"); d.className = "overlay center";
  d.innerHTML = `<div class="modal task-modal" style="width:min(1040px,calc(100% - 24px))"><h2>${id ? "할 일" : "새 할 일"}</h2>
    <div style="display:grid;gap:10px;margin-top:8px">
      <label class="f"><span>제목 <em>*</em></span><input id="tTitle" value="${esc(x.title)}" placeholder="예: 다한스파 계약서 받기"></label>
      <div class="f"><span>내용</span><div id="tMemo" class="re"></div></div>
      <div class="three">
        <label class="f"><span>상태</span><select id="tSt">${TASK_COLS.map(([k, n]) => `<option value="${k}" ${x.status === k ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        <label class="f"><span>마감일</span><input type="date" id="tDue" value="${esc(x.due || "")}"></label>
        <label class="f"><span>중요도</span><select id="tPri">${PRI.map(([k, n]) => `<option value="${k}" ${+k === x.priority ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      </div>
      <div class="three">
        <label class="f"><span>담당자</span><select id="tWho">${adminOpts(x.assignee)}</select></label>
        <label class="f"><span>관련 업체</span><select id="tShop"><option value="">없음</option>${shops.map(s => `<option value="${esc(s.id)}" ${s.id === x.shop_id ? "selected" : ""}>${esc(s.name.ko)}</option>`).join("")}</select></label>
        <label class="f"><span>관련 영업</span><select id="tLead"><option value="">없음</option>${LEADS.map(l => `<option value="${l.id}" ${l.id === x.lead_id ? "selected" : ""}>${esc(l.name)}</option>`).join("")}</select></label>
      </div>
      <div class="f"><span>참조 <small class="hint">— 함께 알아야 하는 사람 (여러 명). 눌러서 고르거나 <b>@이름</b>을 입력하세요</small></span><div class="people" id="tRefs"></div>
        <div class="at-wrap"><input id="tRefAt" class="at-in" placeholder="@이름 입력 → Enter" autocomplete="off"></div></div>
      ${id ? `<div class="f"><span>💬 댓글</span><div id="tCmt"></div></div>` : `<div class="hint">💬 댓글은 저장한 뒤에 달 수 있어요.</div>`}
      ${id ? `<div class="hint">만든 사람: ${esc(x.created_by || "")} · ${dt(x.created_at)}${x.done_at ? ` · 완료 ${dt(x.done_at)}` : ""}</div>` : ""}
    </div>
    <div class="btns">${id ? `<button class="btn danger" data-del style="margin-right:auto">삭제</button>` : ""}<button class="btn" data-no>닫기</button><button class="btn main" data-yes title="Ctrl+S">저장</button></div></div>`;
  document.body.appendChild(d);
  pills(d.querySelector("#tSt"), { todo: "gray", doing: "blue", done: "green" });
  pills(d.querySelector("#tPri"), { 0: "gray", 1: "amber", 2: "red" });
  const ed = richEditor(d.querySelector("#tMemo"), x.memo || "", { onTemplate: t => { const ti = d.querySelector("#tTitle"); if (!ti.value.trim()) ti.value = t.name.replace(/^[^\s가-힣A-Za-z0-9]+\s*/, ""); } });
  d.querySelector("#tTitle").focus();
  const cmtHost = id ? d.querySelector("#tCmt") : null;
  if (id) commentBox(cmtHost, "task", id, { editor: ed, onAnchor: () => save(true) });
  // 메모에서 글자를 고르면 💬 댓글 버튼이 떠요 (노션처럼)
  const fb = document.createElement("button"); fb.type = "button"; fb.className = "sel-cmt"; fb.textContent = "💬 댓글"; fb.hidden = true; d.appendChild(fb);
  const selIn = () => { const s = getSelection(); if (!s.rangeCount || s.isCollapsed) return null; const r = s.getRangeAt(0); return ed.el.contains(r.commonAncestorContainer) && s.toString().trim() ? r : null; };
  const showFb = () => setTimeout(() => { const r = selIn(); if (!r) { fb.hidden = true; return; } const b = r.getBoundingClientRect(); fb.hidden = false;
    fb.style.left = Math.min(innerWidth - 90, Math.max(8, b.left + b.width / 2 - 40)) + "px"; fb.style.top = Math.max(8, b.top - 40) + "px"; }, 0);
  ed.el.addEventListener("mouseup", showFb); ed.el.addEventListener("keyup", e => { if (e.shiftKey) showFb(); });
  d.addEventListener("scroll", () => { fb.hidden = true; }, true);
  document.addEventListener("selectionchange", () => { if (!selIn()) fb.hidden = true; });
  fb.onmousedown = e => e.preventDefault();
  fb.onclick = () => {
    const r = selIn(); fb.hidden = true; if (!r) return;
    if (!id) { toast("먼저 저장하면 문구에 댓글을 달 수 있어요"); return; }
    const qid = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text = r.toString();
    const m = document.createElement("mark"); m.className = "cmark"; m.dataset.c = qid;
    try { r.surroundContents(m); } catch (e) { m.appendChild(r.extractContents()); r.insertNode(m); }
    getSelection().removeAllRanges(); cmtHost._quote(qid, text); cmtHost.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  ed.el.addEventListener("click", e => { const m = e.target.closest("mark.cmark"); if (!m || !cmtHost) return; const c = cmtHost.querySelector(`.cmt[data-q="${m.dataset.c}"]`); if (c) { c.scrollIntoView({ block: "center", behavior: "smooth" }); c.classList.add("flash"); setTimeout(() => c.classList.remove("flash"), 1400); } });
  const drawRefs = () => {
    const box = d.querySelector("#tRefs"), owner = d.querySelector("#tWho").value;
    box.innerHTML = ADMINS.map(a => { const on = refs.includes(a.email), me = a.email === owner;
      return `<button type="button" class="person ${on ? "on" : ""}" data-p="${esc(a.email)}" ${me ? `disabled title="담당자예요"` : ""}><span class="av">${esc(who(a.email).slice(0, 1).toUpperCase())}</span>${esc(who(a.email))}${a.email === ME.email ? " (나)" : ""}${on ? " ✓" : ""}</button>`; }).join("") || `<span class="hint">관리자가 한 명뿐이에요. 계정 탭에서 관리자를 추가하면 참조할 수 있어요.</span>`;
    box.querySelectorAll("[data-p]").forEach(b => b.onclick = () => { const e = b.dataset.p; refs = refs.includes(e) ? refs.filter(v => v !== e) : [...refs, e]; drawRefs(); });
  };
  drawRefs();
  const refIn = d.querySelector("#tRefAt");
  atPicker(refIn, a => { if (!refs.includes(a.email) && a.email !== d.querySelector("#tWho").value) refs = [...refs, a.email]; refIn.value = ""; drawRefs(); refIn.focus(); },
    { whole: true, skip: a => refs.includes(a.email) || a.email === d.querySelector("#tWho").value });
  d.querySelector("#tWho").onchange = () => { refs = refs.filter(v => v !== d.querySelector("#tWho").value); drawRefs(); };
  d.querySelector("[data-no]").onclick = () => { d.remove(); if (TAB === "work") drawWork(); if (preset._after) preset._after(); };
  // 동시 작성 대비: 연 시점의 내용(base)과 저장 직전 최신본을 비교해서 '내가 바꾼 칸'만 저장
  let base = id ? { ...x } : null;
  const FIELDS = ["title", "memo", "status", "due", "priority", "assignee", "shop_id", "lead_id", "watchers"];
  const nv = (k, v) => { if (k === "memo") return richClean(richFrom(v || "")); if (k === "watchers") return JSON.stringify([...(v || [])].sort()); if (k === "priority") return +v; return v === "" || v === undefined ? null : v; };
  const same = (k, a, b) => nv(k, a) === nv(k, b);
  const memoClash = name => new Promise(res => {
    const m = document.createElement("div"); m.className = "overlay center";
    m.innerHTML = `<div class="modal" style="width:min(460px,calc(100% - 24px))"><h2>⚠️ 메모를 동시에 고쳤어요</h2>
      <p class="hint" style="margin:8px 0 14px">내가 이 카드를 열어 둔 사이에 다른 분이 메모를 먼저 저장했어요. 어떻게 할까요?</p>
      <div style="display:grid;gap:8px"><button class="btn main" data-k="both">둘 다 남기기 (추천) — 상대 내용 아래에 내 내용을 붙여요</button>
      <button class="btn" data-k="mine">내 것으로 저장 — 상대가 쓴 메모는 지워져요</button>
      <button class="btn" data-k="theirs">상대 것 유지 — 내 메모 수정은 버려요</button>
      <button class="btn" data-k="">취소</button></div></div>`;
    document.body.appendChild(m); m.querySelectorAll("[data-k]").forEach(b => b.onclick = () => { m.remove(); res(b.dataset.k); });
  });
  if (id) {   // 열어 둔 동안 다른 분이 저장하면 알려 줘요
    const tick = setInterval(async () => {
      if (!d.isConnected) { clearInterval(tick); return; }
      const r = await sb.from("tasks").select("updated_at").eq("id", id).maybeSingle();
      if (r.data && r.data.updated_at !== base.updated_at && !d.querySelector(".clash")) {
        const n = document.createElement("div"); n.className = "clash";
        n.innerHTML = "⚠️ 다른 분이 방금 이 카드를 저장했어요. 그대로 <b>저장</b>하면 서로 고친 부분이 합쳐져요.";
        d.querySelector(".modal h2").after(n);
      }
    }, 15000);
  }
  async function save(silent) {
    const row = { title: d.querySelector("#tTitle").value.trim(), memo: ed.get(), status: d.querySelector("#tSt").value, due: d.querySelector("#tDue").value || null,
      priority: +d.querySelector("#tPri").value, assignee: d.querySelector("#tWho").value || null, shop_id: d.querySelector("#tShop").value || null, lead_id: d.querySelector("#tLead").value || null, watchers: refs.filter(v => v !== (d.querySelector("#tWho").value || "")) };
    if (!row.title) { toast("제목을 적어 주세요"); return false; }
    try {
      if (id) {
        const cur = await q(sb.from("tasks").select("*").eq("id", id).single(), "최신 내용 확인");
        const theirs = cur.updated_at !== base.updated_at ? FIELDS.filter(k => !same(k, cur[k], base[k])) : [];
        const mine = FIELDS.filter(k => !same(k, row[k], base[k]));
        const patch = {}; mine.forEach(k => patch[k] = row[k]);
        let merged = theirs.length > 0;
        if (mine.includes("memo") && theirs.includes("memo") && !same("memo", row.memo, cur.memo)) {
          const how = await memoClash(); if (!how) return false;
          if (how === "both") patch.memo = nv("memo", cur.memo) + `<hr><p><b>✏️ ${esc(who(ME.email))} 님이 동시에 고친 내용</b></p>` + row.memo;
          else if (how === "theirs") delete patch.memo;
        }
        let r = cur;
        if (Object.keys(patch).length) {
          const u = await sb.from("tasks").update(patch).eq("id", id).lt("updated_at", new Date(Date.parse(cur.updated_at) + 1).toISOString()).select();   // 확인한 뒤에 누가 또 저장했으면 0건
          if (u.error) { dbErr(u.error, "저장"); return false; }
          if (!u.data.length) { toast("방금 다른 분도 저장했어요. 저장을 한 번 더 눌러 주세요", 4000); return false; }
          r = u.data[0];
        }
        const i = TASKS.findIndex(y => y.id === id); if (i >= 0) TASKS[i] = r; base = { ...r };
        if (merged) {   // 상대가 바꾼 내용을 화면에 반영하려고 다시 열어요
          d.remove(); if (TAB === "work") drawWork(); drawCounts(); editTask(id, { _after: preset._after });
          toast(Object.keys(patch).length ? "다른 분이 고친 내용과 합쳐서 저장했어요 ✅" : "다른 분이 고친 최신 내용으로 새로 불러왔어요", 4000); return true;
        }
        if (!Object.keys(patch).length) { if (!silent) toast("바뀐 내용이 없어요"); if (window.overlaySnap) d._snap = overlaySnap(d); return true; }
      }
      else {
        const r = await q(sb.from("tasks").insert(row).select().single()); TASKS.unshift(r);
        d.remove(); if (TAB === "work") drawWork(); drawCounts(); editTask(r.id, { _after: preset._after }); toast("저장했어요 · 이제 댓글을 달 수 있어요"); return true;
      }
      if (TAB === "work") drawWork(); drawCounts();
      if (window.overlaySnap) d._snap = overlaySnap(d);   // 저장한 상태를 기준으로 (닫을 때 다시 묻지 않게)
      if (!silent) toast("저장했어요 ✅");
      return true;
    } catch (e) { return false; }
  }
  d.querySelector("[data-yes]").onclick = () => save(false);
  d.addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(false); } });
  if (id) d.querySelector("[data-del]").onclick = () => confirmBox("이 할 일을 지울까요?", async () => {
    const r = await sb.from("tasks").delete().eq("id", id); if (r.error) { dbErr(r.error, "삭제"); return; }
    TASKS = TASKS.filter(y => y.id !== id); d.remove(); drawWork();
  }, "완료로 옮기면 기록이 남아요. 잘못 만든 할 일만 지우세요.");
}

/* ---------- 업체 영업 ---------- */
function drawLeads() {
  const t = vnToday();
  const shopIdsInLeads = new Set(LEADS.map(l => l.shop_id).filter(Boolean));
  const notIn = shops.filter(s => !shopIdsInLeads.has(s.id));
  $("kb").innerHTML = (LEADS.length ? "" : `<div class="notice info" style="grid-column:1/-1;margin:0"><span class="grow">영업 보드가 비어 있어요. 이미 사이트에 등록된 업체 ${notIn.length}곳을 계약 상태에 맞춰 불러올까요? (수수료율이 있고 입점 확인된 곳 → 입점 완료, 나머지 → 후보 발굴)</span><button class="btn main sm" id="leadSeed">불러오기</button></div>`) +
    LEAD_COLS.map(([k, n, sub]) => {
      const list = LEADS.filter(l => l.stage === k && whoOk(l)).sort((a, b) => ordKey(a) - ordKey(b));
      return `<div class="kcol" data-col="${k}"><div class="khead"><b>${n}</b><span class="kn">${list.length}</span><small>${sub}</small></div>
        <div class="kcards">${list.map(l => {
          const late = !["live", "hold"].includes(l.stage) && l.next_date && l.next_date < t;
          const open = TASKS.filter(x => x.lead_id === l.id && x.status !== "done").length;
          return `<div class="kcard ${late ? "late" : ""}" draggable="true" data-id="${l.id}" data-k="${ordKey(l)}">
            <div class="kt">${esc(l.name)}</div>
            <div class="km">${esc([cityName(l.city), l.cat ? catName(l.cat) : ""].filter(x => x && x !== "-").join(" · "))}</div>
            ${l.next_action || l.next_date ? `<div class="km next">➡ ${esc(l.next_action || "다음 연락")} ${l.next_date ? `<b class="${late ? "lt" : ""}">${dayKo(l.next_date)}</b>` : ""}</div>` : ""}
            <div class="kchips"><span class="chip">👤 ${esc(who(l.assignee))}</span>${l.rate ? `<span class="chip">💯 ${+l.rate}%</span>` : ""}${l.shop_id ? `<span class="chip">🏪 등록됨</span>` : ""}${open ? `<span class="chip">✅ ${open}</span>` : ""}${CMT_N[l.id] ? `<span class="chip">💬 ${CMT_N[l.id]}</span>` : ""}</div></div>`;
        }).join("") || `<div class="kempty">-</div>`}</div></div>`;
    }).join("");
  if ($("leadSeed")) $("leadSeed").onclick = async () => {
    $("leadSeed").disabled = true;
    const rows = notIn.map(s => ({ name: s.name.ko, city: s.city, cat: s.cat, map: s.map || null, shop_id: s.id, rate: rateOf(s.id) || null,
      person: ((PRIV[s.id] || {}).contract || {}).person || null, contact: (c => c.phone || c.zalo || c.kakao || null)((PRIV[s.id] || {}).contract || {}),
      stage: isOk(s) && rateOf(s.id) ? "live" : "found", assignee: ME.email }));
    try { await q(sb.from("leads").insert(rows), "불러오기"); await loadWork(); drawWork(); toast(`${rows.length}곳을 불러왔어요`); } catch (e) { $("leadSeed").disabled = false; }
  };
  bindKanban("lead", async (id, col, pos) => {
    const l = leadById(id); if (!l) return;
    const patch = { pos }, moved = l.stage !== col; if (moved) patch.stage = col;
    const r = await movePatch("leads", id, patch); if (!r) return;
    LEADS[LEADS.indexOf(l)] = r; drawLeads(); drawCounts();
    if (moved && col === "signed" && !r.shop_id) toast("계약 완료! 업체 카드를 열어 '사이트에 업체 등록'을 눌러 주세요.", 4500);
  }, id => openLead(id));
}
function newLead() {
  const d = document.createElement("div"); d.className = "overlay center";
  d.innerHTML = `<div class="modal" style="width:min(560px,calc(100% - 32px))"><h2>영업 업체 추가</h2>
    <div style="display:grid;gap:10px;margin-top:8px">
      <label class="f"><span>업체 이름 <em>*</em></span><input id="lName"></label>
      <div class="two"><label class="f"><span>지역</span><select id="lCity">${CITIES.map(c => `<option value="${c.id}">${esc(c.name.ko)}</option>`).join("")}</select></label>
        <label class="f"><span>카테고리</span><select id="lCat">${CATEGORIES.map(c => `<option value="${c.id}">${esc(c.name.ko)}</option>`).join("")}</select></label></div>
      <label class="f"><span>구글 지도 링크</span><input id="lMap" placeholder="https://maps.app.goo.gl/…"></label>
      <div class="two"><label class="f"><span>다음 할 일</span><input id="lNext" placeholder="예: 잘로로 첫 연락"></label><label class="f"><span>날짜</span><input type="date" id="lDate" value="${vnToday()}"></label></div>
    </div><div class="btns"><button class="btn" data-no>닫기</button><button class="btn main" data-yes>추가</button></div></div>`;
  document.body.appendChild(d); d.querySelector("#lName").focus();
  d.querySelector("[data-no]").onclick = () => d.remove();
  d.querySelector("[data-yes]").onclick = async () => {
    const name = d.querySelector("#lName").value.trim(); if (!name) { toast("업체 이름을 적어 주세요"); return; }
    try {
      const r = await q(sb.from("leads").insert({ name, city: d.querySelector("#lCity").value, cat: d.querySelector("#lCat").value, map: d.querySelector("#lMap").value.trim() || null,
        next_action: d.querySelector("#lNext").value.trim() || null, next_date: d.querySelector("#lDate").value || null, assignee: ME.email, stage: "found" }).select().single(), "추가");
      LEADS.unshift(r); d.remove(); drawWork(); openLead(r.id);
    } catch (e) {}
  };
}
async function openLead(id) {
  let l = leadById(id); if (!l) return;
  const LOGN = { created: "영업 시작", stage: "단계 변경", assignee: "담당자 변경", shop: "사이트 업체와 연결" };
  const stName = k => (LEAD_COLS.find(c => c[0] === k) || [k, k])[1];
  $("layer").innerHTML = `<div class="overlay" id="ov"><div class="panel" role="dialog" aria-label="영업 업체">
    <div class="panel-head"><h2>🤝 ${esc(l.name)}</h2><span class="st requested" id="lSt"></span><button class="btn" id="pCancel">닫기</button></div>
    <div class="panel-body">
      <div class="box"><h3>진행 단계</h3><div class="btn-row" id="lStages"></div></div>
      <div class="box"><h3>다음 할 일</h3>
        <div class="two"><label class="f"><span>무엇을</span><input id="lNext" value="${esc(l.next_action || "")}" placeholder="예: 수수료 15% 제안서 보내기"></label>
          <label class="f"><span>언제</span><input type="date" id="lDate" value="${esc(l.next_date || "")}"></label></div></div>
      <div class="box"><h3>업체 정보</h3>
        <div class="three"><label class="f"><span>업체 이름</span><input id="lName" value="${esc(l.name)}"></label>
          <label class="f"><span>지역</span><select id="lCity"><option value="">-</option>${CITIES.map(c => `<option value="${c.id}" ${c.id === l.city ? "selected" : ""}>${esc(c.name.ko)}</option>`).join("")}</select></label>
          <label class="f"><span>카테고리</span><select id="lCat"><option value="">-</option>${CATEGORIES.map(c => `<option value="${c.id}" ${c.id === l.cat ? "selected" : ""}>${esc(c.name.ko)}</option>`).join("")}</select></label></div>
        <div class="three"><label class="f"><span>업체 담당자</span><input id="lPerson" value="${esc(l.person || "")}" placeholder="예: Ms. Linh (매니저)"></label>
          <label class="f"><span>연락처 (전화·잘로·카톡)</span><input id="lContact" value="${esc(l.contact || "")}"></label>
          <label class="f"><span>수수료율 (%)</span><input type="number" id="lRate" min="0" max="100" step="0.5" value="${l.rate ?? ""}" placeholder="제안·합의"></label></div>
        <div class="two"><label class="f"><span>우리 담당자</span><select id="lWho">${adminOpts(l.assignee)}</select></label>
          <label class="f"><span>구글 지도 링크</span><input id="lMap" value="${esc(l.map || "")}"></label></div>
        <div class="f"><span>메모 <small class="hint">— 미팅 노트, 조건 등 ('/' 또는 📄 템플릿)</small></span><div id="lMemo" class="re"></div></div>
        <div class="btn-row"><button class="btn main" id="lSave">저장</button><span class="grow"></span>
          <span id="lShopBox"></span>
          <button class="btn danger sm" id="lDel">삭제</button></div>
      </div>
      <div class="box"><h3>할 일 <small>이 업체와 관련된 일</small></h3><div id="lTasks"></div><div class="btn-row"><button class="btn sm" id="lTaskAdd">＋ 할 일 만들기</button></div></div>
      <div class="box"><h3>💬 댓글 <small>관리자끼리 의견 나누기</small></h3><div id="lCmt"></div></div>
      <div class="box"><h3>연락 기록 <small>업체와 연락한 내역</small></h3>
        <div style="display:flex;gap:6px;flex-wrap:wrap"><select id="logK" style="padding:8px;border:1px solid var(--line);border-radius:9px">${Object.entries(LOGK).map(([k, n]) => `<option value="${k}">${n}</option>`).join("")}</select>
          <input id="logIn" placeholder="예: 매니저와 통화, 다음 주 화요일 방문 약속" style="flex:1;min-width:0;padding:9px 11px;border:1px solid var(--line);border-radius:9px"><button class="btn" id="logAdd">남기기</button></div>
        <ul class="tl" id="lLog"><li>불러오는 중…</li></ul></div>
    </div></div></div>`;
  const close = () => { $("layer").innerHTML = ""; if (TAB === "work") drawWork(); };
  $("pCancel").onclick = close; $("ov").onclick = e => { if (e.target.id === "ov") close(); };
  const led = richEditor($("lMemo"), l.memo || "");
  commentBox($("lCmt"), "lead", l.id);
  const save = async (patch, msg = "저장했어요") => {
    try { const r = await q(sb.from("leads").update(patch).eq("id", l.id).select().single()); LEADS[LEADS.indexOf(l)] = r; l = r; toast(msg); drawHead(); loadLog(); } catch (e) {}
  };
  function drawHead() {
    $("lSt").textContent = stName(l.stage);
    $("lStages").innerHTML = LEAD_COLS.map(([k, n]) => `<button class="btn st-btn ${l.stage === k ? "cur" : ""}" data-s="${k}">${n}</button>`).join("");
    $("lStages").querySelectorAll("[data-s]").forEach(b => b.onclick = () => { if (b.dataset.s !== l.stage) save({ stage: b.dataset.s }, `${stName(b.dataset.s)}(으)로 옮겼어요`); });
    const sh = l.shop_id && shopById(l.shop_id);
    $("lShopBox").innerHTML = sh ? `<button class="btn sm" id="lShopOpen">🏪 ${esc(sh.name.ko)} 업체 정보</button>` : `<button class="btn sm main" id="lShopNew">🏪 사이트에 업체 등록</button> <select id="lShopLink" style="padding:7px;border:1px solid var(--line);border-radius:9px;max-width:180px"><option value="">기존 업체와 연결…</option>${shops.map(s => `<option value="${esc(s.id)}">${esc(s.name.ko)}</option>`).join("")}</select>`;
    if ($("lShopOpen")) $("lShopOpen").onclick = () => { $("layer").innerHTML = ""; showTab("shops"); openEditor(sh.id); };
    if ($("lShopLink")) $("lShopLink").onchange = e => { if (e.target.value) save({ shop_id: e.target.value }, "사이트 업체와 연결했어요"); };
    if ($("lShopNew")) $("lShopNew").onclick = () => {
      const lid = l.id, pre = { ...blankShop(), id: slug(l.name), name: { ko: l.name, en: "", vi: "" }, city: l.city || CITIES[0].id, cat: l.cat || CATEGORIES[0].id, map: l.map || "" };
      $("layer").innerHTML = "";
      openEditor(null, pre, { rate: l.rate, contract: { person: l.person || "", phone: l.contact || "" }, onSaved: async s => {
        const cur = leadById(lid);
        const r = await sb.from("leads").update({ shop_id: s.id, stage: cur && ["found", "contacted", "meeting", "negotiating"].includes(cur.stage) ? "signed" : cur.stage }).eq("id", lid).select().single();
        if (!r.error) LEADS[LEADS.indexOf(cur)] = r.data;
        toast("업체를 등록하고 영업 카드와 연결했어요 ✅ (사이트에는 '보이기'를 켜야 나와요)", 5000);
      } });
    };
    const ts = TASKS.filter(x => x.lead_id === l.id).sort((a, b) => (a.status === "done") - (b.status === "done"));
    $("lTasks").innerHTML = ts.map(x => `<div class="lt-row ${x.status === "done" ? "done" : ""}" data-t="${x.id}"><span>${x.status === "done" ? "☑" : "☐"}</span><b>${esc(x.title)}</b>${x.due ? `<span class="hint">${dayKo(x.due)}</span>` : ""}<span class="hint">${esc(who(x.assignee))}</span></div>`).join("") || `<div class="hint">아직 없어요</div>`;
    $("lTasks").querySelectorAll("[data-t]").forEach(r => r.onclick = () => editTask(r.dataset.t, { _after: drawHead }));
  }
  $("lTaskAdd").onclick = () => editTask(null, { lead_id: l.id, shop_id: l.shop_id, assignee: ME.email, _after: drawHead });
  $("lSave").onclick = () => save({ name: $("lName").value.trim() || l.name, city: $("lCity").value || null, cat: $("lCat").value || null, person: $("lPerson").value.trim() || null,
    contact: $("lContact").value.trim() || null, rate: $("lRate").value === "" ? null : +$("lRate").value, assignee: $("lWho").value || null, map: $("lMap").value.trim() || null,
    memo: led.get(), next_action: $("lNext").value.trim() || null, next_date: $("lDate").value || null });
  $("lNext").onchange = $("lDate").onchange = () => save({ next_action: $("lNext").value.trim() || null, next_date: $("lDate").value || null }, "다음 할 일을 저장했어요");
  $("lDel").onclick = () => confirmBox(`'${l.name}' 영업 카드를 지울까요?`, async () => {
    const r = await sb.from("leads").delete().eq("id", l.id); if (r.error) { dbErr(r.error, "삭제"); return; }
    LEADS = LEADS.filter(x => x.id !== l.id); close();
  }, "연락 기록도 함께 지워져요. 진행을 멈춘 업체는 지우지 말고 '보류·거절'로 옮기는 걸 권해요.");
  const addLog = async () => {
    const v = $("logIn").value.trim(); if (!v) return;
    const r = await sb.from("lead_logs").insert({ lead_id: l.id, kind: $("logK").value, body: v });
    if (r.error) { dbErr(r.error); return; }
    $("logIn").value = ""; await sb.from("leads").update({ memo: l.memo }).eq("id", l.id); loadLog();
  };
  $("logAdd").onclick = addLog; $("logIn").onkeydown = e => { if (e.key === "Enter" && !e.isComposing) addLog(); };
  async function loadLog() {
    const r = await sb.from("lead_logs").select("*").eq("lead_id", l.id).order("at", { ascending: false });
    $("lLog").innerHTML = (r.data || []).map(g => {
      let txt = LOGK[g.kind] || LOGN[g.kind] || g.kind;
      if (g.kind === "stage") txt += `: ${stName(g.detail.from)} → <b>${stName(g.detail.to)}</b>`;
      else if (g.kind === "assignee") txt += `: ${esc(who(g.detail.from))} → <b>${esc(who(g.detail.to))}</b>`;
      else if (g.kind === "shop") { const s = shopById(g.detail.shop_id); txt += `: ${esc(s ? s.name.ko : g.detail.shop_id)}`; }
      return `<li><time>${dt(g.at)}</time><div><span class="who adm">${esc(g.actor)}</span> · ${txt}${g.body ? `<br>${esc(g.body)}` : ""}</div></li>`;
    }).join("") || `<li>기록이 없어요</li>`;
  }
  drawHead(); loadLog();
}

/* ---------- 끌어서 옮기기 ---------- */
// 카드 순서: 사용자가 옮긴 자리(pos)가 있으면 그것, 없으면 작성한 시간 순서
const ordKey = x => x.pos != null ? +x.pos : Date.parse(x.created_at || 0);
let POS_OK = true;
async function movePatch(table, id, patch) {
  if (!POS_OK) delete patch.pos;
  if (!Object.keys(patch).length) return null;
  let r = await sb.from(table).update(patch).eq("id", id).select().single();
  if (r.error && /pos/.test(r.error.message || "") && "pos" in patch) {   // 아직 DB에 순서 칸이 없을 때
    POS_OK = false; toast("순서 저장 칸이 아직 없어요. 사장님이 order.sql을 실행하면 순서가 저장돼요", 4500);
    delete patch.pos; if (!Object.keys(patch).length) return null;
    r = await sb.from(table).update(patch).eq("id", id).select().single();
  }
  if (r.error) { dbErr(r.error); return null; }
  return r.data;
}
// 놓은 자리의 앞뒤 카드 사이 값으로 순서를 정해요
function dropPos(col, y, dragId) {
  const cards = [...col.querySelectorAll(".kcard")].filter(c => c.dataset.id !== dragId);
  const i = cards.findIndex(c => { const r = c.getBoundingClientRect(); return y < r.top + r.height / 2; });
  const k = c => +c.dataset.k;
  if (!cards.length) return { pos: Date.now(), before: null };
  if (i === -1) return { pos: k(cards[cards.length - 1]) + 60000, before: null };
  if (i === 0) return { pos: k(cards[0]) - 60000, before: cards[0] };
  return { pos: (k(cards[i - 1]) + k(cards[i])) / 2, before: cards[i] };
}
function bindKanban(kind, onMove, onOpen) {
  let dragId = null;
  const cols = [...$("kb").querySelectorAll(".kcol")].map(k => [k.dataset.col, (k.querySelector(".khead b") || {}).textContent || k.dataset.col]);
  $("kb").querySelectorAll(".kcard").forEach(c => {
    // ▸ 버튼: 끌지 않고 바로 다른 칸으로 옮기기
    const here = c.closest(".kcol").dataset.col, mv = document.createElement("button");
    mv.type = "button"; mv.className = "kmove"; mv.title = "다른 칸으로 옮기기"; mv.textContent = "이동 ▸"; c.appendChild(mv);
    mv.onclick = e => {
      e.stopPropagation(); document.querySelectorAll(".kmove-menu").forEach(m => m.remove());
      const m = document.createElement("div"); m.className = "kmove-menu";
      m.innerHTML = cols.filter(([k]) => k !== here).map(([k, n]) => `<button type="button" data-to="${esc(k)}">→ ${esc(n)}</button>`).join("");
      document.body.appendChild(m);   // 칸 밖으로 잘리지 않게 화면 위에 띄워요
      const r = mv.getBoundingClientRect(), h = m.offsetHeight;
      m.style.left = Math.max(8, r.right - m.offsetWidth) + "px";
      m.style.top = (r.bottom + 4 + h > innerHeight ? r.top - 4 - h : r.bottom + 4) + "px";
      addEventListener("scroll", () => m.remove(), { once: true, capture: true });
      m.querySelectorAll("[data-to]").forEach(b => b.onclick = ev => { ev.stopPropagation(); m.remove();
        const tc = $("kb").querySelector(`.kcol[data-col="${CSS.escape(b.dataset.to)}"]`), ks = tc ? [...tc.querySelectorAll(".kcard")].map(x => +x.dataset.k) : [];
        onMove(c.dataset.id, b.dataset.to, ks.length ? Math.max(...ks) + 60000 : Date.now()); });
      setTimeout(() => document.addEventListener("click", () => m.remove(), { once: true }), 0);
    };
    c.onclick = () => onOpen(c.dataset.id);
    c.ondragstart = e => { dragId = c.dataset.id; c.classList.add("drag"); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", dragId); } catch (err) {} };
    c.ondragend = () => { c.classList.remove("drag"); clearMarks(); };
  });
  const clearMarks = () => $("kb").querySelectorAll(".kcol").forEach(x => { x.classList.remove("over", "drop-end"); x.querySelectorAll(".drop-before").forEach(y => y.classList.remove("drop-before")); });
  $("kb").querySelectorAll(".kcol").forEach(col => {
    col.ondragover = e => {
      e.preventDefault(); const p = dropPos(col, e.clientY, dragId);
      $("kb").querySelectorAll(".drop-before").forEach(y => { if (y !== p.before) y.classList.remove("drop-before"); });
      $("kb").querySelectorAll(".kcol").forEach(x => { if (x !== col) x.classList.remove("over", "drop-end"); });
      col.classList.add("over"); col.classList.toggle("drop-end", !p.before); if (p.before) p.before.classList.add("drop-before");
    };
    col.ondragleave = e => { if (!col.contains(e.relatedTarget)) { col.classList.remove("over", "drop-end"); col.querySelectorAll(".drop-before").forEach(y => y.classList.remove("drop-before")); } };
    col.ondrop = e => { e.preventDefault(); const id = dragId || e.dataTransfer.getData("text/plain"); const p = dropPos(col, e.clientY, id); clearMarks(); if (id) onMove(id, col.dataset.col, p.pos); };
  });
}

/* ---------- 댓글 ---------- */
// 본문 문구에 단 댓글: 본문에는 <mark class="cmark" data-c="ID">, 댓글 맨 앞에는 ⟦q:ID|인용문⟧
const QRE = /^⟦q:([a-z0-9-]+)\|([^⟧]*)⟧\s*/i;
const cmtQuote = t => { const m = String(t || "").match(QRE); return m ? { id: m[1], quote: m[2], rest: t.slice(m[0].length) } : null; };
const cmtPlain = t => String(t || "").replace(QRE, (m, id, q) => `“${q}” `);
const cmtHtml = t => esc(t).replace(/@([\w.\-가-힣]+)/g, '<b class="mention">@$1</b>').replace(/\n/g, "<br>");
async function commentBox(host, type, id, opts = {}) {
  host.innerHTML = `<div class="cmts"><div class="cmt-list"><div class="hint">불러오는 중…</div></div>
    <div class="cmt-quote" hidden></div>
    <div class="cmt-new"><span class="av me">${esc(who(ME.email).slice(0, 1).toUpperCase())}</span>
      <div class="at-wrap"><textarea rows="1" placeholder="댓글 달기… (@를 치면 사람 목록이 떠요, Ctrl+Enter로 등록)"></textarea></div><button type="button" class="btn sm main">등록</button></div>
    ${ADMINS.length > 1 ? `<div class="hint">언급하기: ${ADMINS.filter(a => a.email !== ME.email).map(a => `<button type="button" class="mention-pick" data-m="${esc(who(a.email))}">@${esc(who(a.email))}</button>`).join(" ")}</div>` : ""}</div>`;
  const list = host.querySelector(".cmt-list"), ta = host.querySelector("textarea"), btn = host.querySelector(".cmt-new .btn");
  ta.oninput = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 160) + "px"; };
  async function load() {
    const r = await sb.from("comments").select("*").eq("target_type", type).eq("target_id", id).order("created_at");
    if (r.error) { list.innerHTML = `<div class="hint">댓글을 불러오지 못했어요. (SQL을 다시 실행했는지 확인해 주세요)</div>`; return; }
    CMT_N[id] = r.data.length;
    const ed = opts.editor && opts.editor.el;
    list.innerHTML = r.data.map(c => {
      const mine = c.author_email === (ME.email || "").toLowerCase(), name = who(c.author_email || (c.author || "").replace(/^관리자 /, ""));
      const qd = cmtQuote(c.body), live = qd && ed && ed.querySelector(`mark.cmark[data-c="${qd.id}"]`);
      return `<div class="cmt" data-c="${c.id}" ${qd ? `data-q="${esc(qd.id)}"` : ""}><span class="av">${esc(name.slice(0, 1).toUpperCase())}</span><div class="cmt-b">
        <div class="cmt-h"><b>${esc(name)}</b><time>${dt(c.created_at)}${c.edited_at ? " · 수정됨" : ""}</time><span class="cmt-act">${live ? `<button type="button" data-res title="본문 형광 표시를 지워요">✓ 해결</button>` : ""}${mine ? `<button type="button" data-e>수정</button><button type="button" data-d>삭제</button>` : ""}</span></div>
        ${qd ? `<div class="cmt-q ${live ? "" : "gone"}" data-goto="${esc(qd.id)}">“${esc(qd.quote)}”${live ? "" : ` <small>(해결됨)</small>`}</div>` : ""}
        <div class="cmt-t">${cmtHtml(qd ? qd.rest : c.body)}</div></div></div>`;
    }).join("") || `<div class="hint">아직 댓글이 없어요. 메모에서 글자를 드래그하면 그 문구에 댓글을 달 수 있어요.</div>`;
    list.querySelectorAll("[data-goto]").forEach(q => q.onclick = () => { const m = ed && ed.querySelector(`mark.cmark[data-c="${q.dataset.goto}"]`); if (!m) return; m.scrollIntoView({ block: "center", behavior: "smooth" }); m.classList.add("flash"); setTimeout(() => m.classList.remove("flash"), 1400); });
    list.querySelectorAll("[data-res]").forEach(b => b.onclick = () => { const qid = b.closest("[data-q]").dataset.q; ed.querySelectorAll(`mark.cmark[data-c="${qid}"]`).forEach(m => m.replaceWith(...m.childNodes)); opts.onAnchor && opts.onAnchor(); load(); });
    list.querySelectorAll("[data-c]").forEach(el => {
      const c = r.data.find(x => x.id === el.dataset.c);
      const e = el.querySelector("[data-e]"), dl = el.querySelector("[data-d]"), qd = cmtQuote(c.body);
      if (e) e.onclick = () => {
        const t = el.querySelector(".cmt-t"); t.innerHTML = `<textarea rows="2" style="width:100%">${esc(qd ? qd.rest : c.body)}</textarea><div class="btn-row"><button type="button" class="btn sm main" data-s>저장</button><button type="button" class="btn sm" data-x>취소</button></div>`;
        t.querySelector("[data-x]").onclick = load;
        t.querySelector("[data-s]").onclick = async () => { const v = t.querySelector("textarea").value.trim(); if (!v) return;
          const u = await sb.from("comments").update({ body: (qd ? `⟦q:${qd.id}|${qd.quote}⟧ ` : "") + v }).eq("id", c.id); if (u.error) { dbErr(u.error); return; } load(); };
      };
      if (dl) dl.onclick = () => confirmBox("이 댓글을 지울까요?", async () => { const u = await sb.from("comments").delete().eq("id", c.id); if (u.error) { dbErr(u.error, "삭제"); return; } load(); });
    });
  }
  // 본문 문구 인용 (메모에서 글자를 드래그 → 💬 댓글)
  const qbox = host.querySelector(".cmt-quote"); let pend = null;
  const setQuote = (qid, text) => { pend = qid ? { id: qid, quote: text.replace(/[|⟦⟧]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) } : null;
    qbox.hidden = !pend; if (pend) { qbox.innerHTML = `<span>💬 “${esc(pend.quote)}” 에 댓글</span><button type="button" title="취소">✕</button>`;
      qbox.querySelector("button").onclick = () => { const ed = opts.editor && opts.editor.el; if (ed) ed.querySelectorAll(`mark.cmark[data-c="${pend.id}"]`).forEach(m => m.replaceWith(...m.childNodes)); setQuote(null); }; ta.focus(); } };
  const send = async () => {
    const v = ta.value.trim(); if (!v) return; btn.disabled = true;
    const body = (pend ? `⟦q:${pend.id}|${pend.quote}⟧ ` : "") + v;
    const r = await sb.from("comments").insert({ target_type: type, target_id: id, body });
    btn.disabled = false; if (r.error) { dbErr(r.error, "댓글 등록"); return; }
    const anchored = !!pend; ta.value = ""; ta.style.height = "auto"; setQuote(null);
    if (anchored && opts.onAnchor) await opts.onAnchor();   // 본문 형광 표시를 바로 저장
    load();
  };
  host._quote = setQuote; host._reload = load;
  host.querySelectorAll(".mention-pick").forEach(m => m.onclick = () => { ta.value = (ta.value && !/\s$/.test(ta.value) ? ta.value + " " : ta.value) + "@" + m.dataset.m + " "; ta.focus(); ta.oninput(); });
  atPicker(ta, (a, q) => { const pos = ta.selectionStart, head = ta.value.slice(0, pos), at = head.lastIndexOf("@");
    const before = head.slice(0, at) + "@" + who(a.email) + " "; ta.value = before + ta.value.slice(pos); ta.selectionStart = ta.selectionEnd = before.length; ta.focus(); ta.oninput(); }, { skip: a => a.email === ME.email });
  btn.onclick = send;
  ta.onkeydown = e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.isComposing) { e.preventDefault(); send(); } };
  load();
}

/* ---------- 알림 ---------- */
let NOTIS = [], notiSeen = null;
const NK = { mention: ["📣", "나를 언급했어요"], assign: ["👤", "담당자로 지정했어요"], ref: ["👥", "참조로 넣었어요"], comment: ["💬", "댓글을 달았어요"], done: ["✅", "완료했어요"] };
async function loadNotis(firstTime) {
  const r = await sb.from("notifications").select("*").order("created_at", { ascending: false }).limit(60);
  if (r.error) return;
  const before = new Set(NOTIS.map(n => n.id));
  NOTIS = r.data; $("bell").hidden = false;
  const unread = NOTIS.filter(n => !n.read_at);
  $("cntBell").textContent = unread.length || "";
  if (!firstTime) unread.filter(n => !before.has(n.id)).slice(0, 3).forEach(n => toast(`${NK[n.kind] ? NK[n.kind][0] : "🔔"} ${who((n.actor || "").replace(/^관리자 /, ""))}님이 ${NK[n.kind] ? NK[n.kind][1] : "알림"}: ${n.title || ""}`, 5000));
  if (!$("noti").hidden) drawNotis();
}
function drawNotis() {
  const box = $("noti");
  box.innerHTML = `<div class="noti-h"><b>알림</b><button id="notiAll">모두 읽음</button></div>` + (NOTIS.map(n => {
    const [ic, txt] = NK[n.kind] || ["🔔", ""];
    return `<div class="ni ${n.read_at ? "" : "unread"}" data-n="${n.id}"><span class="ic">${ic}</span><div class="tx">
      <b>${esc(n.title || (n.target_type === "lead" ? "영업 업체" : "할 일"))}</b>
      <div>${esc(who((n.actor || "").replace(/^관리자 /, "")))}님이 ${txt}</div>${n.body && (n.kind === "mention" || n.kind === "comment") ? `<p>${esc(cmtPlain(n.body))}</p>` : ""}<time>${dt(n.created_at)}</time></div><span class="dot"></span></div>`;
  }).join("") || `<div class="empty" style="padding:24px">알림이 없어요</div>`);
  $("notiAll").onclick = async e => { e.stopPropagation(); await sb.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null); await loadNotis(true); drawNotis(); };
  box.querySelectorAll("[data-n]").forEach(el => el.onclick = async () => {
    const n = NOTIS.find(x => x.id === el.dataset.n);
    box.hidden = true;
    if (!n.read_at) { await sb.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id); n.read_at = new Date().toISOString(); $("cntBell").textContent = NOTIS.filter(x => !x.read_at).length || ""; }
    await loadWork();
    if (n.target_type === "task") { if (!TASKS.find(t => t.id === n.target_id)) { toast("지워진 할 일이에요"); return; } workView = "tasks"; showTab("work"); editTask(n.target_id); }
    else { if (!leadById(n.target_id)) { toast("지워진 영업 카드예요"); return; } workView = "leads"; showTab("work"); openLead(n.target_id); }
  });
}
function initNotis() {
  $("bell").onclick = e => { e.stopPropagation(); const b = $("noti"); b.hidden = !b.hidden; if (!b.hidden) drawNotis(); };
  document.addEventListener("click", e => { if (!$("noti").hidden && !e.target.closest(".bell-wrap")) $("noti").hidden = true; });
  loadNotis(true);
  setInterval(() => { if (!document.hidden) loadNotis(false); }, 30000);
}

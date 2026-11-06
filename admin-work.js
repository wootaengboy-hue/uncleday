/* 엉클데이 관리자 — 업무: 할 일 보드, 업체 영업 진행 */
let TASKS = [], LEADS = [], ADMINS = [];
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
  return !t.error && !l.error;
}
const who = e => e ? (e.split("@")[0]) : "미지정";
const dueTag = d => { if (!d) return ""; const t = vnToday(); const cls = d < t ? "late" : d === t ? "today" : ""; return `<span class="chip ${cls}">📅 ${dayKo(d)}${d < t ? " 지남" : d === t ? " 오늘" : ""}</span>`; };
const whoOk = x => workWho === "all" || (workWho === "me" ? x.assignee === ME.email : workWho === "none" ? !x.assignee : x.assignee === workWho);
const adminOpts = (sel, blank = "미지정") => `<option value="">${blank}</option>` + ADMINS.map(a => `<option value="${esc(a.email)}" ${a.email === sel ? "selected" : ""}>${esc(a.email)}${a.email === ME.email ? " (나)" : ""}</option>`).join("");
const leadById = id => LEADS.find(l => l.id === id);

// 대시보드 '할 일'에 쓰는 숫자
function workTodos() {
  const t = vnToday();
  return [
    ["myTask", "✅", "오늘까지 해야 할 내 일", TASKS.filter(x => x.status !== "done" && x.assignee === ME.email && x.due && x.due <= t).length, () => { workView = "tasks"; workWho = "me"; showTab("work"); }],
    ["leadLate", "🤝", "다음 연락일이 지난 영업 업체", LEADS.filter(l => !["live", "hold"].includes(l.stage) && l.next_date && l.next_date < t).length, () => { workView = "leads"; workWho = "all"; showTab("work"); }]
  ];
}

function drawWork() {
  const t = vnToday();
  $("tab-work").innerHTML = `
    <div class="work-top">
      <div class="seg"><button data-v="tasks" class="${workView === "tasks" ? "on" : ""}">✅ 할 일 보드</button><button data-v="leads" class="${workView === "leads" ? "on" : ""}">🤝 업체 영업</button></div>
      <select id="wWho"><option value="all">담당자 전체</option><option value="me" ${workWho === "me" ? "selected" : ""}>내 것만</option><option value="none" ${workWho === "none" ? "selected" : ""}>미지정</option>${ADMINS.filter(a => a.email !== ME.email).map(a => `<option value="${esc(a.email)}" ${workWho === a.email ? "selected" : ""}>${esc(who(a.email))}</option>`).join("")}</select>
      <span class="grow"></span>
      ${workView === "leads" ? `<button class="btn main" id="leadNew">＋ 영업 업체 추가</button>` : `<button class="btn main" id="taskNew">＋ 할 일</button>`}
    </div>
    <div class="kanban ${workView}" id="kb"></div>
    <p class="hint" style="margin:10px 0 40px">${workView === "tasks" ? "카드를 끌어서 다른 칸에 놓으면 상태가 바뀌어요 (휴대폰은 카드를 눌러 상태를 바꿔요). 완료는 최근 30일만 보여요." : "업체 카드를 끌어서 단계를 옮겨요. 단계·담당자가 바뀌면 누가 언제 바꿨는지 자동으로 기록돼요. 다음 연락일이 지나면 빨갛게 표시돼요."}</p>`;
  $("tab-work").querySelectorAll("[data-v]").forEach(b => b.onclick = () => { workView = b.dataset.v; drawWork(); });
  $("wWho").onchange = e => { workWho = e.target.value; drawWork(); };
  if ($("taskNew")) $("taskNew").onclick = () => editTask(null, { assignee: ME.email });
  if ($("leadNew")) $("leadNew").onclick = () => newLead();
  workView === "tasks" ? drawTasks() : drawLeads();
}

/* ---------- 할 일 보드 ---------- */
function drawTasks() {
  const t = vnToday(), cut = new Date(Date.now() - 30 * 864e5).toISOString();
  const sortT = (a, b) => (b.priority - a.priority) || (a.due || "9999").localeCompare(b.due || "9999") || a.created_at.localeCompare(b.created_at);
  $("kb").innerHTML = TASK_COLS.map(([k, n]) => {
    let list = TASKS.filter(x => x.status === k && whoOk(x));
    const hidden = k === "done" && !showAllDone ? list.filter(x => (x.done_at || x.updated_at) < cut).length : 0;
    if (k === "done") list = list.filter(x => showAllDone || (x.done_at || x.updated_at) >= cut).sort((a, b) => (b.done_at || "").localeCompare(a.done_at || ""));
    else list.sort(sortT);
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
  bindKanban("task", async (id, col) => {
    const x = TASKS.find(y => y.id === id); if (!x || x.status === col) return;
    try { const r = await q(sb.from("tasks").update({ status: col }).eq("id", id).select().single()); TASKS[TASKS.indexOf(x)] = r; drawTasks(); drawCounts(); } catch (e) {}
  }, id => editTask(id));
}
function taskCard(x) {
  const sh = x.shop_id && shopById(x.shop_id), ld = x.lead_id && leadById(x.lead_id);
  return `<div class="kcard pri${x.priority} ${x.status === "done" ? "done" : ""}" draggable="true" data-id="${x.id}">
    <div class="kt">${esc(x.title)}</div>
    ${x.memo ? `<div class="km">${esc(x.memo.length > 70 ? x.memo.slice(0, 70) + "…" : x.memo)}</div>` : ""}
    <div class="kchips">${x.status !== "done" ? dueTag(x.due) : ""}<span class="chip">👤 ${esc(who(x.assignee))}</span>${sh ? `<span class="chip">🏪 ${esc(sh.name.ko)}</span>` : ""}${ld ? `<span class="chip">🤝 ${esc(ld.name)}</span>` : ""}</div></div>`;
}
function editTask(id, preset = {}) {
  const x = id ? TASKS.find(y => y.id === id) : { title: "", memo: "", status: "todo", assignee: "", due: null, priority: 1, shop_id: null, lead_id: null, ...preset };
  const d = document.createElement("div"); d.className = "overlay center";
  d.innerHTML = `<div class="modal" style="width:min(620px,calc(100% - 32px))"><h2>${id ? "할 일" : "새 할 일"}</h2>
    <div style="display:grid;gap:10px;margin-top:8px">
      <label class="f"><span>제목 <em>*</em></span><input id="tTitle" value="${esc(x.title)}" placeholder="예: 다한스파 계약서 받기"></label>
      <label class="f"><span>메모</span><textarea id="tMemo" rows="4">${esc(x.memo || "")}</textarea></label>
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
      ${id ? `<div class="hint">만든 사람: ${esc(x.created_by || "")} · ${dt(x.created_at)}${x.done_at ? ` · 완료 ${dt(x.done_at)}` : ""}</div>` : ""}
    </div>
    <div class="btns">${id ? `<button class="btn danger" data-del style="margin-right:auto">삭제</button>` : ""}<button class="btn" data-no>닫기</button><button class="btn main" data-yes>저장</button></div></div>`;
  document.body.appendChild(d);
  d.querySelector("#tTitle").focus();
  d.querySelector("[data-no]").onclick = () => d.remove();
  d.querySelector("[data-yes]").onclick = async () => {
    const row = { title: d.querySelector("#tTitle").value.trim(), memo: d.querySelector("#tMemo").value, status: d.querySelector("#tSt").value, due: d.querySelector("#tDue").value || null,
      priority: +d.querySelector("#tPri").value, assignee: d.querySelector("#tWho").value || null, shop_id: d.querySelector("#tShop").value || null, lead_id: d.querySelector("#tLead").value || null };
    if (!row.title) { toast("제목을 적어 주세요"); return; }
    try {
      if (id) { const r = await q(sb.from("tasks").update(row).eq("id", id).select().single()); TASKS[TASKS.indexOf(x)] = r; }
      else TASKS.unshift(await q(sb.from("tasks").insert(row).select().single()));
      d.remove(); if (TAB === "work") drawWork(); if (preset._after) preset._after(); drawCounts();
    } catch (e) {}
  };
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
      const list = LEADS.filter(l => l.stage === k && whoOk(l)).sort((a, b) => (a.next_date || "9999").localeCompare(b.next_date || "9999") || b.updated_at.localeCompare(a.updated_at));
      return `<div class="kcol" data-col="${k}"><div class="khead"><b>${n}</b><span class="kn">${list.length}</span><small>${sub}</small></div>
        <div class="kcards">${list.map(l => {
          const late = !["live", "hold"].includes(l.stage) && l.next_date && l.next_date < t;
          const open = TASKS.filter(x => x.lead_id === l.id && x.status !== "done").length;
          return `<div class="kcard ${late ? "late" : ""}" draggable="true" data-id="${l.id}">
            <div class="kt">${esc(l.name)}</div>
            <div class="km">${esc([cityName(l.city), l.cat ? catName(l.cat) : ""].filter(x => x && x !== "-").join(" · "))}</div>
            ${l.next_action || l.next_date ? `<div class="km next">➡ ${esc(l.next_action || "다음 연락")} ${l.next_date ? `<b class="${late ? "lt" : ""}">${dayKo(l.next_date)}</b>` : ""}</div>` : ""}
            <div class="kchips"><span class="chip">👤 ${esc(who(l.assignee))}</span>${l.rate ? `<span class="chip">💯 ${+l.rate}%</span>` : ""}${l.shop_id ? `<span class="chip">🏪 등록됨</span>` : ""}${open ? `<span class="chip">✅ ${open}</span>` : ""}</div></div>`;
        }).join("") || `<div class="kempty">-</div>`}</div></div>`;
    }).join("");
  if ($("leadSeed")) $("leadSeed").onclick = async () => {
    $("leadSeed").disabled = true;
    const rows = notIn.map(s => ({ name: s.name.ko, city: s.city, cat: s.cat, map: s.map || null, shop_id: s.id, rate: rateOf(s.id) || null,
      person: ((PRIV[s.id] || {}).contract || {}).person || null, contact: (c => c.phone || c.zalo || c.kakao || null)((PRIV[s.id] || {}).contract || {}),
      stage: isOk(s) && rateOf(s.id) ? "live" : "found", assignee: ME.email }));
    try { await q(sb.from("leads").insert(rows), "불러오기"); await loadWork(); drawWork(); toast(`${rows.length}곳을 불러왔어요`); } catch (e) { $("leadSeed").disabled = false; }
  };
  bindKanban("lead", async (id, col) => {
    const l = leadById(id); if (!l || l.stage === col) return;
    try { const r = await q(sb.from("leads").update({ stage: col }).eq("id", id).select().single()); LEADS[LEADS.indexOf(l)] = r; drawLeads(); drawCounts();
      if (col === "signed" && !r.shop_id) toast("계약 완료! 업체 카드를 열어 '사이트에 업체 등록'을 눌러 주세요.", 4500); } catch (e) {}
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
        <label class="f"><span>메모</span><textarea id="lMemo" rows="3">${esc(l.memo || "")}</textarea></label>
        <div class="btn-row"><button class="btn main" id="lSave">저장</button><span class="grow"></span>
          <span id="lShopBox"></span>
          <button class="btn danger sm" id="lDel">삭제</button></div>
      </div>
      <div class="box"><h3>할 일 <small>이 업체와 관련된 일</small></h3><div id="lTasks"></div><div class="btn-row"><button class="btn sm" id="lTaskAdd">＋ 할 일 만들기</button></div></div>
      <div class="box"><h3>연락 기록 <small>누가 언제 무엇을 했는지</small></h3>
        <div style="display:flex;gap:6px;flex-wrap:wrap"><select id="logK" style="padding:8px;border:1px solid var(--line);border-radius:9px">${Object.entries(LOGK).map(([k, n]) => `<option value="${k}">${n}</option>`).join("")}</select>
          <input id="logIn" placeholder="예: 매니저와 통화, 다음 주 화요일 방문 약속" style="flex:1;min-width:0;padding:9px 11px;border:1px solid var(--line);border-radius:9px"><button class="btn" id="logAdd">남기기</button></div>
        <ul class="tl" id="lLog"><li>불러오는 중…</li></ul></div>
    </div></div></div>`;
  const close = () => { $("layer").innerHTML = ""; if (TAB === "work") drawWork(); };
  $("pCancel").onclick = close; $("ov").onclick = e => { if (e.target.id === "ov") close(); };
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
    memo: $("lMemo").value, next_action: $("lNext").value.trim() || null, next_date: $("lDate").value || null });
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
function bindKanban(kind, onMove, onOpen) {
  let dragId = null;
  $("kb").querySelectorAll(".kcard").forEach(c => {
    c.onclick = () => onOpen(c.dataset.id);
    c.ondragstart = e => { dragId = c.dataset.id; c.classList.add("drag"); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", dragId); } catch (err) {} };
    c.ondragend = () => { c.classList.remove("drag"); $("kb").querySelectorAll(".kcol").forEach(x => x.classList.remove("over")); };
  });
  $("kb").querySelectorAll(".kcol").forEach(col => {
    col.ondragover = e => { e.preventDefault(); col.classList.add("over"); };
    col.ondragleave = e => { if (!col.contains(e.relatedTarget)) col.classList.remove("over"); };
    col.ondrop = e => { e.preventDefault(); col.classList.remove("over"); const id = dragId || e.dataTransfer.getData("text/plain"); if (id) onMove(id, col.dataset.col); };
  });
}

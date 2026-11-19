/* 💬 사이트 채팅 (관리자) — 손님이 사이트·예약확인증에서 보낸 대화에 답해요 */
let THREADS = [], CHAT_CUR = null, CHAT_MSGS = [], CHAT_TIMER = null, CHAT_READY = true;
const chatUnread = th => th.last_from === "guest" && (!th.admin_seen_at || th.admin_seen_at < th.last_at);
const chatPhone = c => { c = String(c || ""); if (/[a-z]/i.test(c)) return ""; const n = c.replace(/[^\d+]/g, ""); return n.replace("+", "").length >= 9 ? n : ""; };
async function loadThreads() {
  const r = await sb.from("chat_threads").select("*").order("last_at", { ascending: false }).limit(300);
  if (r.error) { CHAT_READY = false; THREADS = []; return; }
  CHAT_READY = true; THREADS = r.data;
}
function chatCount() { const n = THREADS.filter(chatUnread).length; const el = $("cntChat"); if (el) el.textContent = n || ""; return n; }
async function chatLink(th) {
  if (th.booking_id) {
    const b = BOOKINGS.find(x => x.id === th.booking_id);
    if (b && b.customer_token) return siteUrl("booking.html?v=2#" + b.customer_token);
  }
  return siteUrl("./?chat=" + th.token);
}
function chatPingMsg(th, link) {
  const l = ["ko", "en", "vi"].includes(th.lang) ? th.lang : "ko";
  if (l === "en") return `[Uncle Day] You have a new reply in your chat 💬\nTap to read and continue: ${link}`;
  if (l === "vi") return `[Uncle Day] Bạn có tin nhắn trả lời mới 💬\nBấm để xem và tiếp tục: ${link}`;
  return `[엉클데이] 상담 채팅에 답장이 왔어요 💬\n여기서 확인하고 이어서 대화하세요: ${link}`;
}

async function drawChat() {
  const el = $("tab-chat");
  if (!CHAT_READY) { el.innerHTML = `<div class="box"><h3>💬 사이트 채팅</h3><p class="hint">채팅을 쓰려면 Supabase에서 <b>supabase/chat.sql</b>을 한 번 실행해 주세요. (📘 사용 안내 → 채팅)</p></div>`; return; }
  const f = el.dataset.f || "open";
  const list = THREADS.filter(th => f === "all" ? true : f === "unread" ? chatUnread(th) : th.status === "open");
  el.innerHTML = `<div class="chat-wrap ${CHAT_CUR ? "has-cur" : ""}">
    <div class="chat-side"><div class="chat-flt">${[["unread", "안 읽음"], ["open", "진행 중"], ["all", "전체"]].map(([k, n]) => `<button class="pill ${f === k ? "on" : ""}" data-cf="${k}">${n}${k === "unread" && THREADS.filter(chatUnread).length ? ` ${THREADS.filter(chatUnread).length}` : ""}</button>`).join("")}</div>
      <div class="chat-threads">${list.map(th => { const b = th.booking_id && BOOKINGS.find(x => x.id === th.booking_id);
        return `<button class="ct-row ${CHAT_CUR === th.id ? "on" : ""} ${chatUnread(th) ? "new" : ""}" data-th="${th.id}">
          <span class="ct-n">${esc(th.name || "손님")}${b ? ` <small class="badge">${esc(b.code)}</small>` : ""}${th.user_id ? ` <small title="로그인한 손님">👤</small>` : ""}</span>
          <span class="ct-t">${esc(rel(th.last_at))}</span>
          <span class="ct-b">${th.last_from === "admin" ? "↪ " : ""}${esc(th.last_body || "")}</span></button>`; }).join("") || `<p class="hint" style="padding:14px">대화가 없어요.</p>`}</div></div>
    <div class="chat-main" id="chatMain">${CHAT_CUR ? "" : `<div class="hint chat-empty">왼쪽에서 대화를 고르세요.<br>손님이 사이트나 예약확인증에서 💬로 보낸 메시지가 여기 모여요.</div>`}</div></div>`;
  el.querySelectorAll("[data-cf]").forEach(b => b.onclick = () => { el.dataset.f = b.dataset.cf; drawChat(); });
  el.querySelectorAll("[data-th]").forEach(b => b.onclick = () => openThread(b.dataset.th));
  if (CHAT_CUR) drawThread();
}
const rel = d => { const s = (Date.now() - Date.parse(d)) / 1000; return s < 60 ? "방금" : s < 3600 ? `${Math.floor(s / 60)}분 전` : s < 86400 ? `${Math.floor(s / 3600)}시간 전` : dt(d); };

async function openThread(id) {
  CHAT_CUR = id; CHAT_MSGS = [];
  const th = THREADS.find(x => x.id === id);
  if (th && chatUnread(th)) { th.admin_seen_at = new Date().toISOString(); sb.from("chat_threads").update({ admin_seen_at: th.admin_seen_at }).eq("id", id).then(() => {}); chatCount(); }
  await loadMsgs(); drawChat(); if (TAB === "chat") { NAV_QUIET = true; navSync(); NAV_QUIET = false; }
  clearInterval(CHAT_TIMER); CHAT_TIMER = setInterval(async () => { if (TAB !== "chat" || CHAT_CUR !== id) { clearInterval(CHAT_TIMER); return; } const n = CHAT_MSGS.length; await loadMsgs(); if (CHAT_MSGS.length !== n) drawThread(); }, 5000);
}
async function loadMsgs() {
  if (!CHAT_CUR) return;
  const r = await sb.from("chat_messages").select("*").eq("thread_id", CHAT_CUR).order("id");
  if (!r.error) CHAT_MSGS = r.data;
  const t = await sb.from("chat_threads").select("*").eq("id", CHAT_CUR).maybeSingle();
  if (t.data) { const i = THREADS.findIndex(x => x.id === CHAT_CUR); if (i >= 0) THREADS[i] = t.data; else THREADS.unshift(t.data);
    if (chatUnread(t.data)) { THREADS[i >= 0 ? i : 0].admin_seen_at = new Date().toISOString(); sb.from("chat_threads").update({ admin_seen_at: new Date().toISOString() }).eq("id", CHAT_CUR).then(() => {}); } }
  chatCount();
}
// 마무리 인사 기본 문구 (이 브라우저에 저장한 문구가 있으면 그걸 써요)
const CHAT_BYE = {
  ko: "문의해 주셔서 감사합니다 😊\n상담은 여기서 마무리할게요.\n더 궁금한 점이 있으면 언제든 이 창에 다시 남겨 주세요.\n즐거운 베트남 여행 되세요! — 엉클데이",
  en: "Thank you for contacting Uncle Day 😊\nWe'll close this chat for now.\nIf you have any other questions, just send a message here anytime.\nEnjoy your trip in Vietnam!",
  vi: "Cảm ơn bạn đã liên hệ Uncle Day 😊\nCuộc trò chuyện xin tạm kết thúc tại đây.\nNếu còn thắc mắc, bạn cứ nhắn lại vào khung chat này bất cứ lúc nào nhé.\nChúc bạn một ngày tốt lành!" };
function chatByeText(l) { try { const v = localStorage.getItem("ud-chat-bye-" + l); if (v) return v; } catch (e) {} return CHAT_BYE[l] || CHAT_BYE.ko; }
/* ===== 🌐 자동 번역 (채널톡처럼) — Edge Function 'chat-tr' · SQL universe32 =====
   손님 글 → 내가 고른 말로 보여 주기 (한 번 번역하면 저장) · 내 답장 → 손님 말로 바꿔서 보내기 */
const CTR_NAMES = { ko: "한국어", vi: "베트남어", en: "영어", ja: "일본어", zh: "중국어", "zh-TW": "중국어(번체)", ru: "러시아어", fr: "프랑스어", de: "독일어", es: "스페인어", hi: "힌디어", th: "태국어", id: "인도네시아어" };
const CTR = (() => { let v = {}; try { v = JSON.parse(localStorage.getItem("ud-chat-tr") || "{}"); } catch (e) {} return { on: v.on !== false, me: v.me || (typeof ALANG !== "undefined" && ALANG === "vi" ? "vi" : "ko"), busy: false, fail: "" }; })();
const ctrSave = () => { try { localStorage.setItem("ud-chat-tr", JSON.stringify({ on: CTR.on, me: CTR.me })); } catch (e) {} };
const ctrName = l => CTR_NAMES[l] || (l || "").toUpperCase();
// 손님이 쓰는 말: 마지막 손님 글에서 감지한 말 → 없으면 손님이 보던 사이트 언어
const ctrGuestLang = th => { const g = [...CHAT_MSGS].reverse().find(m => m.sender === "guest" && m.src_lang); return (g && g.src_lang) || th.lang || "ko"; };
async function ctrCall(items) {
  const { data: { session } } = await sb.auth.getSession();
  const r = await fetch(`${SUPA.url}/functions/v1/chat-tr`, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPA.key, Authorization: "Bearer " + (session ? session.access_token : SUPA.key) }, body: JSON.stringify({ items }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || ("번역 실패 " + r.status));
  return j.items || [];
}
// 아직 내 말로 번역 안 된 손님 글을 모아서 번역 → 저장 → 다시 그리기
async function ctrFill() {
  if (!CTR.on || CTR.busy || !CHAT_CUR) return;
  const need = CHAT_MSGS.filter(m => m.sender === "guest" && !(m.tr && m.tr[CTR.me]) && m.src_lang !== CTR.me && !m._trFail).slice(-20);
  if (!need.length) return;
  CTR.busy = true; const cur = CHAT_CUR;
  try {
    const out = await ctrCall(need.map(m => ({ id: m.id, text: m.body, to: CTR.me })));
    for (const x of out) {
      const m = CHAT_MSGS.find(y => y.id === x.id); if (!m) continue;
      m.src_lang = x.src || m.src_lang; m.tr = { ...(m.tr || {}), [CTR.me]: x.text };
      sb.rpc("admin_chat_tr_save", { mid: m.id, src: x.src || null, lang: CTR.me, txt: x.text }).then(() => {});
    }
    CTR.fail = "";
  } catch (e) { CTR.fail = e.message; need.forEach(m => m._trFail = true); }
  CTR.busy = false;
  if (CHAT_CUR === cur) drawThread();
}
// 메시지 한 개를 그리기: 손님 글은 번역문(원문 보기), 내 글은 내가 쓴 원문(보낸 번역 보기)
function ctrMsgHtml(m) {
  const br = t => esc(t).replace(/\n/g, "<br>");
  if (m.sender === "guest") {
    const t = CTR.on && m.tr && m.tr[CTR.me] && m.src_lang !== CTR.me ? m.tr[CTR.me] : null;
    if (!t) return `<span>${br(m.body)}</span>${CTR.on && !m.tr?.[CTR.me] && m.src_lang !== CTR.me && !m._trFail && CTR.busy ? `<small class="cm-tr">🌐 번역 중…</small>` : ""}`;
    return `<span>${br(t)}</span><details class="cm-tr"><summary>🌐 ${esc(ctrName(m.src_lang))} 원문</summary>${br(m.body)}</details>`;
  }
  if (m.orig) return `<span>${br(m.orig)}</span><details class="cm-tr"><summary>🌐 ${esc(ctrName(m.src_lang))}로 보냄</summary>${br(m.body)}</details>`;
  return `<span>${br(m.body)}</span>`;
}
function drawThread() {
  const box = $("chatMain"), th = THREADS.find(x => x.id === CHAT_CUR); if (!box || !th) return;
  const b = th.booking_id && BOOKINGS.find(x => x.id === th.booking_id), phone = chatPhone(th.contact || (b && b.contact));
  const lastAdmin = [...CHAT_MSGS].reverse().find(m => m.sender === "admin");
  const read = lastAdmin && th.guest_seen_at && th.guest_seen_at >= lastAdmin.created_at;
  const typed = box.querySelector("textarea") ? box.querySelector("textarea").value : "";
  box.innerHTML = `<div class="cm-head"><button class="btn sm cm-back" type="button">‹ 목록</button>
      <div><b>${esc(th.name || "손님")}</b> <span class="hint">${esc(th.contact || "")}${th.lang ? ` · ${{ ko: "한국어", en: "영어", vi: "베트남어" }[th.lang] || th.lang}` : ""}${th.page && th.page !== "home" ? ` · 시작 화면: ${esc((shopById(th.page) || {}).name ? shopById(th.page).name.ko : th.page)}` : ""}</span></div>
      <div class="cm-acts">${b ? `<button class="btn sm" data-bk="${b.id}">📅 ${esc(b.code)}</button>` : ""}
        <button class="btn sm" data-st>${th.status === "open" ? "✓ 대화 끝내기" : "다시 열기"}</button></div></div>
    <div class="cm-trbar">🌐 <b>자동 번역</b> <button type="button" class="tgl ${CTR.on ? "on" : ""}" data-ctr="on">${CTR.on ? "켜짐" : "꺼짐"}</button>
      <span>내가 볼 말</span><select data-ctr="me">${["ko", "vi", "en"].map(l => `<option value="${l}" ${CTR.me === l ? "selected" : ""}>${ctrName(l)}</option>`).join("")}</select>
      <span class="hint">손님 말: <b>${esc(ctrName(ctrGuestLang(th)))}</b>${CTR.on && ctrGuestLang(th) !== CTR.me ? ` · 내 답장은 ${esc(ctrName(ctrGuestLang(th)))}로 바꿔서 보내요` : ""}</span>
      ${CTR.fail ? `<span class="cm-trerr">번역이 안 돼요: ${esc(CTR.fail)} <button type="button" class="btn sm" data-ctr="retry">다시</button></span>` : ""}</div>
    <div class="cm-list">${CHAT_MSGS.map(m => `<div class="cm ${m.sender === "admin" ? "us" : "them"}">${ctrMsgHtml(m)}<time>${m.sender === "admin" ? esc(m.author || "") + " · " : ""}${esc(dt(m.created_at))}</time></div>`).join("")}
      ${lastAdmin ? `<div class="cm-read">${read ? "✓ 손님이 읽었어요" : "손님이 아직 안 읽었어요"}</div>` : ""}</div>
    <form class="cm-form"><textarea rows="2" placeholder="${CTR.on && ctrGuestLang(th) !== CTR.me ? `${esc(ctrName(CTR.me))}로 쓰면 ${esc(ctrName(ctrGuestLang(th)))}로 바꿔서 보내요 · Enter 보내기` : "답장 입력 · Enter 보내기, Shift+Enter 줄바꿈"}">${esc(typed)}</textarea><button class="btn main">보내기</button></form>
    ${lastAdmin && !read ? `<div class="cm-ping"><span>손님이 사이트를 닫았으면 답장을 못 봐요 →</span>
      ${phone ? `<button class="btn sm" data-ping="sms">📱 답장 알림 문자 (${esc(phone)})</button>` : ""}<button class="btn sm" data-ping="copy">📋 알림 메시지 복사 (카톡 등)</button></div>` : ""}`;
  const list = box.querySelector(".cm-list"); list.scrollTop = list.scrollHeight;
  box.querySelector(".cm-back").onclick = () => { CHAT_CUR = null; clearInterval(CHAT_TIMER); drawChat(); NAV_QUIET = true; navSync(); NAV_QUIET = false; };
  const bk = box.querySelector("[data-bk]"); if (bk) bk.onclick = () => openBooking(bk.dataset.bk);
  const setSt = async st => { const r = await sb.from("chat_threads").update({ status: st }).eq("id", th.id); if (r.error) { dbErr(r.error, "상태 변경"); return false; } th.status = st; return true; };
  box.querySelector("[data-st]").onclick = async () => {
    if (th.status !== "open") { if (await setSt("open")) drawChat(); return; }
    // ✓ 대화 끝내기 → 손님 언어로 된 마무리 인사를 보여 주고, 고쳐서 보내고 끝내거나 그냥 끝내요
    if (box.querySelector(".cm-bye")) return;
    const L = ["ko", "en", "vi"].includes(th.lang) ? th.lang : "ko";
    const bye = document.createElement("div"); bye.className = "cm-bye";
    bye.innerHTML = `<b>👋 마무리 인사 <span class="hint">${{ ko: "한국어", en: "영어", vi: "베트남어" }[L]} · 손님이 다시 메시지를 보내면 대화가 자동으로 다시 열려요</span></b>
      <div class="cm-bye-l">${["ko", "en", "vi"].map(k => `<button type="button" class="${k === L ? "on" : ""}" data-bl="${k}">${{ ko: "한국어", en: "English", vi: "Tiếng Việt" }[k]}</button>`).join("")}</div>
      <textarea rows="5">${esc(chatByeText(L))}</textarea>
      <label class="cm-bye-k"><input type="checkbox"> 이 문구를 이 언어 기본 인사로 저장 (이 브라우저)</label>
      <div class="cm-bye-a"><button class="btn sm main" data-bye="send">보내고 끝내기</button><button class="btn sm" data-bye="close">인사 없이 끝내기</button><button class="btn sm" data-bye="cancel">취소</button></div>`;
    box.querySelector(".cm-head").after(bye);
    const ta2 = bye.querySelector("textarea"); let cur = L; ta2.focus();
    bye.querySelectorAll("[data-bl]").forEach(x => x.onclick = () => { cur = x.dataset.bl; ta2.value = chatByeText(cur); bye.querySelectorAll("[data-bl]").forEach(y => y.classList.toggle("on", y === x)); });
    bye.querySelector("[data-bye=cancel]").onclick = () => bye.remove();
    bye.querySelector("[data-bye=close]").onclick = async () => { if (await setSt("closed")) { toast("대화를 끝냈어요"); drawChat(); } };
    bye.querySelector("[data-bye=send]").onclick = async e => {
      const v = ta2.value.trim(); if (!v) { toast("인사 문구를 적어 주세요"); return; }
      e.target.disabled = true;
      if (bye.querySelector(".cm-bye-k input").checked) { try { localStorage.setItem("ud-chat-bye-" + cur, v); } catch (er) {} }
      const r = await sb.rpc("chat_reply", { thread: th.id, body: v });   // 답장을 보내면 대화가 열린 상태가 되니, 보낸 뒤에 끝내요
      if (r.error) { e.target.disabled = false; dbErr(r.error, "마무리 인사"); return; }
      await setSt("closed"); toast("👋 인사를 보내고 대화를 끝냈어요"); await loadMsgs(); drawChat();
    };
  };
  const f = box.querySelector(".cm-form"), ta = f.querySelector("textarea");
  ta.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); f.requestSubmit(); } };
  f.onsubmit = async e => {
    // 번역 · 보내는 중에 Enter 를 여러 번 눌러도 한 번만 보내요
    e.preventDefault(); if (f.dataset.busy) return; const v = ta.value.trim(); if (!v) return;
    f.dataset.busy = "1"; ta.readOnly = true; f.querySelector("button").disabled = true;
    try { await chatSendNow(v); } finally { delete f.dataset.busy; ta.readOnly = false; const b2 = f.querySelector("button"); if (b2) b2.disabled = false; }
  };
  const chatSendNow = async v => {
    const to = ctrGuestLang(th); let r;
    if (CTR.on && to && to !== CTR.me) {
      // 내 말 → 손님 말로 바꿔서 보내요 (실패하면 원문으로 보낼지 물어봐요)
      f.querySelector("button").textContent = "번역 중…";
      let t = null; try { const o = await ctrCall([{ text: v, to }]); t = o[0] && o[0].text; } catch (er) { CTR.fail = er.message; }
      f.querySelector("button").textContent = "보내기";
      if (!t) { f.querySelector("button").disabled = false; confirmBox(`번역이 안 됐어요 (${CTR.fail || "?"}). 쓴 그대로 보낼까요?`, async () => { const r2 = await sb.rpc("chat_reply", { thread: th.id, body: v }); if (r2.error) return dbErr(r2.error, "답장"); ta.value = ""; await loadMsgs(); drawChat(); }, "그대로 보내기"); return; }
      r = await sb.rpc("chat_reply_tr", { thread: th.id, body: t, orig: v, orig_lang: CTR.me, to_lang: to });
    } else r = await sb.rpc("chat_reply", { thread: th.id, body: v });
    f.querySelector("button").disabled = false;
    if (r.error) { dbErr(r.error, "답장"); return; }
    ta.value = ""; await loadMsgs(); drawChat(); const nt = $("chatMain") && $("chatMain").querySelector("textarea"); if (nt) nt.focus();
  };
  box.querySelectorAll("[data-ping]").forEach(x => x.onclick = async () => {
    const msg = chatPingMsg(th, await chatLink(th));
    await copy(msg, x.dataset.ping === "sms" ? "알림 메시지를 복사했어요. 문자 앱이 열리면 보내세요." : "알림 메시지를 복사했어요. 손님 카톡·잘로 등에 붙여넣어 보내세요.");
    if (x.dataset.ping === "sms") location.href = `sms:${phone}${/iPhone|iPad|Mac/.test(navigator.userAgent) ? "&" : "?"}body=${encodeURIComponent(msg)}`;
  });
  box.querySelector('[data-ctr="on"]').onclick = () => { CTR.on = !CTR.on; CTR.fail = ""; ctrSave(); drawThread(); };
  box.querySelector('[data-ctr="me"]').onchange = e => { CTR.me = e.target.value; CTR.fail = ""; CHAT_MSGS.forEach(m => delete m._trFail); ctrSave(); drawThread(); };
  const rt = box.querySelector('[data-ctr="retry"]'); if (rt) rt.onclick = () => { CTR.fail = ""; CHAT_MSGS.forEach(m => delete m._trFail); drawThread(); };
  if (innerWidth > 800 && !typed) ta.focus();
  ctrFill();
}
// 15초마다 새 채팅 확인 (탭이 아니어도 숫자·알림)
setInterval(async () => {
  if (typeof sb === "undefined" || document.hidden || !ME || !ME.id) return;
  const before = new Set(THREADS.filter(chatUnread).map(x => x.id + x.last_at));
  try { await loadThreads(); } catch (e) { return; }
  const fresh = THREADS.filter(chatUnread).filter(x => !before.has(x.id + x.last_at));
  chatCount();
  if (fresh.length && before.size + fresh.length > 0) toast(`💬 새 채팅: ${fresh[0].name || "손님"} — ${String(fresh[0].last_body || "").slice(0, 30)}`, 5000);
  if (TAB === "chat" && !CHAT_CUR) drawChat();
}, 15000);

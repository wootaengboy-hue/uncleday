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
      <button class="btn sm chat-greet-btn" id="chatGreetBtn" type="button">🤖 자동 인사 설정</button><div class="chat-threads">${list.map(th => { const b = th.booking_id && BOOKINGS.find(x => x.id === th.booking_id);
        return `<button class="ct-row ${CHAT_CUR === th.id ? "on" : ""} ${chatUnread(th) ? "new" : ""}" data-th="${th.id}">
          <span class="ct-n">${esc(th.name || "손님")}${b ? ` <small class="badge">${esc(b.code)}</small>` : ""}${th.user_id ? ` <small title="로그인한 손님">👤</small>` : ""}</span>
          <span class="ct-t">${esc(rel(th.last_at))}</span>
          <span class="ct-b">${th.last_from === "admin" ? "↪ " : ""}${esc(th.last_body || "")}</span></button>`; }).join("") || `<p class="hint" style="padding:14px">대화가 없어요.</p>`}</div></div>
    <div class="chat-main" id="chatMain">${CHAT_CUR ? "" : `<div class="hint chat-empty">왼쪽에서 대화를 고르세요.<br>손님이 사이트나 예약확인증에서 💬로 보낸 메시지가 여기 모여요.</div>`}</div></div>`;
  el.querySelectorAll("[data-cf]").forEach(b => b.onclick = () => { el.dataset.f = b.dataset.cf; drawChat(); });
  el.querySelectorAll("[data-th]").forEach(b => b.onclick = () => openThread(b.dataset.th));
  if ($("chatGreetBtn")) $("chatGreetBtn").onclick = openGreet;
  if (CHAT_CUR) drawThread();
}
const rel = d => { const s = (Date.now() - Date.parse(d)) / 1000; return s < 60 ? "방금" : s < 3600 ? `${Math.floor(s / 60)}분 전` : s < 86400 ? `${Math.floor(s / 3600)}시간 전` : dt(d); };

async function openThread(id) {
  CHAT_CUR = id; CHAT_MSGS = [];
  const th = THREADS.find(x => x.id === id);
  if (th && chatUnread(th)) { th.admin_seen_at = new Date().toISOString(); sb.from("chat_threads").update({ admin_seen_at: th.admin_seen_at }).eq("id", id).then(() => {}); chatCount(); }
  await loadMsgs(); drawChat(); if (TAB === "chat") { NAV_QUIET = true; navSync(); NAV_QUIET = false; }
  clearInterval(CHAT_TIMER); CHAT_TIMER = setInterval(async () => { if (TAB !== "chat" || CHAT_CUR !== id) { clearInterval(CHAT_TIMER); return; } const sig = () => CHAT_MSGS.length + "|" + CHAT_MSGS.filter(m => m.deleted_at).length; const n = sig(); await loadMsgs(); if (sig() !== n) drawThread(); }, 5000);
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
const CTR = (() => { let v = {}; try { v = JSON.parse(localStorage.getItem("ud-chat-tr") || "{}"); } catch (e) {} return { on: v.on !== false, me: v.me || "", busy: false, fail: "" }; })();
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
  if (!CTR.on || CTR.busy || !CHAT_CUR || !CTR.me) return;
  const need = CHAT_MSGS.filter(m => m.sender === "guest" && !m.deleted_at && !chatAttPh(m) && !(m.tr && m.tr[CTR.me]) && m.src_lang !== CTR.me && !m._trFail).slice(-20);
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
// 📎 첨부 (universe40): 비공개 저장소 'chat' → 1시간짜리 주소를 모아서 받아 둬요
let CGAL = [];   // 사진 보기 묶음 (그릴 때마다 새로)
// 한꺼번에 보낸 사진(att.g 같음 · 같은 사람 · 연달아)은 한 칸에 모아요 (카톡처럼)
function chatRows() {   // 사이에 자동 인사 같은 메시지가 끼어도 같은 묶음은 첫 사진 자리에 모아요
  const isImg = m => m.att && m.att.g && (m.deleted_at || /^image\//.test(m.att.m)), key = m => m.sender + "|" + m.att.g + (m.deleted_at ? "|d" : ""), by = {}, out = [];
  CHAT_MSGS.forEach(m => { if (isImg(m)) (by[key(m)] = by[key(m)] || []).push(m); });
  CHAT_MSGS.forEach(m => { if (!isImg(m)) out.push([m]); else if (by[key(m)][0] === m) out.push(by[key(m)]); });
  return out;
}
function chatGridHtml(grp) {
  const us = grp.map(x => CATT[x.att.p] && CATT[x.att.p].u);
  if (us.some(u => !u)) return `<span class="hint">📷 사진 ${grp.length}장 …</span>`;
  const gi = CGAL.push(us) - 1, n = grp.length, cols = n === 2 || n === 4 ? 2 : 3;
  return `<div class="cm-grid" style="--c:${cols}">${us.map((u, k) => `<a href="${esc(u)}" target="_blank" rel="noopener" data-gal="${gi}" data-k="${k}"><img src="${esc(u)}" alt="" loading="lazy"></a>`).join("")}</div>`;
}
// 🖼️ 사진 보기: ‹ › · 키보드 ← → · Esc
function chatGallery(urls, k) {
  let i = k || 0; const z = document.createElement("div"); z.className = "cm-zoom";
  const show = () => { z.innerHTML = `<img src="${esc(urls[i])}" alt="">${urls.length > 1 ? `<button type="button" class="zp">‹</button><button type="button" class="zn">›</button><span class="zc">${i + 1} / ${urls.length}</span>` : ""}<a class="zd" href="${esc(urls[i])}" target="_blank" rel="noopener">원본 새 창</a><button type="button" class="zx">✕</button>`; };
  const go = d => { i = (i + d + urls.length) % urls.length; show(); };
  const close = () => { z.remove(); document.removeEventListener("keydown", key); };
  const key = e => { if (e.key === "Escape") close(); else if (e.key === "ArrowLeft") go(-1); else if (e.key === "ArrowRight") go(1); };
  z.onclick = e => { if (e.target.closest(".zd")) return; if (e.target.closest(".zp")) go(-1); else if (e.target.closest(".zn")) go(1); else if (!e.target.closest("img") || e.target.closest(".zx")) close(); };
  document.addEventListener("keydown", key); show(); document.body.appendChild(z);
}
let CHAT_UP = () => {}, CHAT_STOP = false;   // 지금 열린 대화에 파일 보내기 (drawThread 가 채워요)
const CATT = {};   // 경로 → { u: 주소, x: 만료 시각 }
async function chatAttSign() {
  const need = [...new Set(CHAT_MSGS.filter(m => m.att && m.att.p && !(CATT[m.att.p] && CATT[m.att.p].x > Date.now() + 60000)).map(m => m.att.p))];
  if (!need.length) return false;
  const r = await sb.storage.from("chat").createSignedUrls(need, 3600);
  (r.data || []).forEach(x => { if (x.signedUrl) CATT[x.path] = { u: x.signedUrl, x: Date.now() + 3600e3 }; });
  return true;
}
const chatAttPh = m => m.att && (m.body === "📷" || m.body === "📄 " + m.att.n);
function chatAttHtml(m) {
  const a = m.att; if (!a) return ""; const u = CATT[a.p] && CATT[a.p].u;
  if (!u) return `<span class="hint">📎 ${esc(a.n)} …</span>`;
  if (/^image\//.test(a.m)) return `<a class="cm-img" href="${esc(u)}" target="_blank" rel="noopener" data-gal="${CGAL.push([u]) - 1}" data-k="0"><img src="${esc(u)}" alt="" loading="lazy"${a.w && a.h ? ` width="${a.w}" height="${a.h}"` : ""}></a>`;
  return `<a class="cm-file" href="${esc(u)}" target="_blank" rel="noopener">📄 <b>${esc(a.n)}</b>${a.s ? ` <small>${a.s > 1048576 ? (a.s / 1048576).toFixed(1) + "MB" : Math.max(1, Math.round(a.s / 1024)) + "KB"}</small>` : ""} <small>· 열기</small></a>`;
}
// 사진은 올리기 전에 줄이고(긴 쪽 1600px) 위치 정보를 지워요 · GIF · PDF 는 그대로
async function chatShrink(file) {
  if (!/^image\//.test(file.type) || file.type === "image/gif") return { blob: file, name: file.name, type: file.type };
  try {
    const bm = await createImageBitmap(file, { imageOrientation: "from-image" });
    const k = Math.min(1, 1600 / Math.max(bm.width, bm.height)), w = Math.round(bm.width * k), h = Math.round(bm.height * k);
    const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(bm, 0, 0, w, h);
    const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.85));
    if (blob) return { blob, w, h, name: (file.name || "photo").replace(/\.[^.]*$/, "") + ".jpg", type: "image/jpeg" };
  } catch (e) {}
  return { blob: file, name: file.name, type: file.type };
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
// 답장 칸 안내 문구 (입력칸은 화면 번역이 안 닿아서 여기서 바로 · 현장 영업 베트남어 화면)
function chatPh(th) {
  const vi = typeof IS_FIELD === "function" && IS_FIELD() && typeof ALANG !== "undefined" && ALANG === "vi", g = ctrGuestLang(th);
  if (vi) { const N = l => (typeof ADMIN_VI !== "undefined" && ADMIN_VI[ctrName(l)]) || ctrName(l); return CTR.on && g !== CTR.me ? `Viết bằng ${N(CTR.me)} → tự dịch sang ${N(g)} · Enter để gửi` : "Nhập trả lời · Enter để gửi, Shift+Enter xuống dòng"; }
  return CTR.on && ctrGuestLang(th) !== CTR.me ? `${esc(ctrName(CTR.me))}로 쓰면 ${esc(ctrName(ctrGuestLang(th)))}로 바꿔서 보내요 · Enter 보내기` : "답장 입력 · Enter 보내기, Shift+Enter 줄바꿈";
}
function drawThread() {
  // 내가 볼 말: 고른 적 없으면 현장 영업(베트남어 화면)은 베트남어, 나머지는 한국어
  if (!CTR.me) CTR.me = typeof IS_FIELD === "function" && IS_FIELD() && typeof ALANG !== "undefined" && ALANG === "vi" ? "vi" : "ko";
  const box = $("chatMain"), th = THREADS.find(x => x.id === CHAT_CUR); if (!box || !th) return;
  const b = th.booking_id && BOOKINGS.find(x => x.id === th.booking_id), phone = chatPhone(th.contact || (b && b.contact));
  const lastAdmin = [...CHAT_MSGS].reverse().find(m => m.sender === "admin");
  const read = lastAdmin && th.guest_seen_at && th.guest_seen_at >= lastAdmin.created_at;
  const typed = box.querySelector("textarea") ? box.querySelector("textarea").value : "";
  box.innerHTML = `<div class="cm-head"><button class="btn sm cm-back" type="button">‹ 목록</button>
      <div><b>${esc(th.name || "손님")}</b> <span class="hint">${esc(th.contact || "")}${th.lang ? ` · ${{ ko: "한국어", en: "영어", vi: "베트남어" }[th.lang] || th.lang}` : ""}</span></div>${chatSrcHtml(th.page, th)}
      <div class="cm-acts">${b ? `<button class="btn sm" data-bk="${b.id}">📅 ${esc(b.code)}</button>` : ""}
        <button class="btn sm" data-st>${th.status === "open" ? "✓ 대화 끝내기" : "다시 열기"}</button></div></div>
    <div class="cm-trbar">🌐 <b>자동 번역</b> <button type="button" class="tgl ${CTR.on ? "on" : ""}" data-ctr="on">${CTR.on ? "켜짐" : "꺼짐"}</button>
      <span>내가 볼 말</span><select data-ctr="me">${["ko", "vi", "en"].map(l => `<option value="${l}" ${CTR.me === l ? "selected" : ""}>${ctrName(l)}</option>`).join("")}</select>
      <span class="hint">손님 말: <b>${esc(ctrName(ctrGuestLang(th)))}</b>${CTR.on && ctrGuestLang(th) !== CTR.me ? ` · 내 답장은 ${esc(ctrName(ctrGuestLang(th)))}로 바꿔서 보내요` : ""}</span>
      ${CTR.fail ? `<span class="cm-trerr">번역이 안 돼요: ${esc(CTR.fail)} <button type="button" class="btn sm" data-ctr="retry">다시</button></span>` : ""}</div>
    <div class="cm-list">${(CGAL = [], chatRows()).map(grp => { const m = grp[0], z = grp[grp.length - 1];
      if (m.deleted_at) return `<div class="cm ${m.sender === "admin" ? "us" : "them"}"><span class="cm-del">🚫 ${m.sender === "admin" ? "보내기 취소한 메시지" : "손님이 보내기 취소한 메시지"}</span><time>${m.sender === "admin" ? esc(m.author || "") + " · " : ""}${esc(dt(m.created_at))}</time></div>`;
      const un = m.sender === "admin" && Date.now() - Date.parse(z.created_at) < 24 * 3600e3 ? `<button type="button" class="cm-un" data-un="${m.id}">보내기 취소</button> · ` : "";
      return `<div class="cm ${m.sender === "admin" ? "us" : "them"}">${grp.length > 1 ? chatGridHtml(grp) : chatAttHtml(m)}${chatAttPh(m) ? "" : ctrMsgHtml(m)}<time>${un}${m.sender === "admin" ? esc(m.author || "") + " · " : ""}${grp.length > 1 ? "📷 " + grp.length + "장 · " : ""}${esc(dt(z.created_at))}</time></div>`; }).join("")}
      ${lastAdmin ? `<div class="cm-read">${read ? "✓ 손님이 읽었어요" : "손님이 아직 안 읽었어요"}</div>` : ""}</div>
    <form class="cm-form"><button type="button" class="btn cm-att" title="사진 · PDF 보내기 (10MB까지)">📎</button><input type="file" class="cm-fi" accept="image/*,application/pdf" multiple hidden><textarea rows="2" placeholder="${chatPh(th)}">${esc(typed)}</textarea><button class="btn main">보내기</button></form>
    ${lastAdmin && !read ? `<div class="cm-ping"><span>손님이 사이트를 닫았으면 답장을 못 봐요 →</span>
      ${phone ? `<button class="btn sm" data-ping="sms">📱 답장 알림 문자 (${esc(phone)})</button>` : ""}<button class="btn sm" data-ping="copy">📋 알림 메시지 복사 (카톡 등)</button></div>` : ""}`;
  const list = box.querySelector(".cm-list"); list.scrollTop = list.scrollHeight;
  { const d = box.querySelector("details.ch-src"); if (d) d.ontoggle = () => { CH_SRC_OPEN = d.open; }; }
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
  // 📎 사진 · PDF 보내기 → 저장소 chat/a/… 에 올리고 chat_reply_att
  const fi = f.querySelector(".cm-fi"); f.querySelector(".cm-att").onclick = () => { if (f.dataset.busy) { CHAT_STOP = true; toast("남은 파일은 보내지 않을게요"); } else fi.click(); };   // 보내는 중에 누르면 취소
  fi.onchange = () => { const fl = [...(fi.files || [])]; fi.value = ""; if (fl.length) CHAT_UP(fl); };
  ta.addEventListener("paste", e => { const fl = [...((e.clipboardData && e.clipboardData.files) || [])]; if (fl.length) { e.preventDefault(); CHAT_UP(fl); } });   // 붙여넣기(Ctrl+V)
  // 끌어다 놓기: 대화 화면 위에 사진 · PDF 를 놓으면 바로 보내요 (한 번만 연결)
  if (!box.dataset.drop) { box.dataset.drop = "1";
    box.addEventListener("dragover", e => { if ([...((e.dataTransfer && e.dataTransfer.types) || [])].includes("Files")) { e.preventDefault(); box.classList.add("cm-drop"); } });
    box.addEventListener("dragleave", e => { if (!box.contains(e.relatedTarget)) box.classList.remove("cm-drop"); });
    box.addEventListener("drop", e => { const fl = [...((e.dataTransfer && e.dataTransfer.files) || [])]; box.classList.remove("cm-drop"); if (fl.length && CHAT_CUR) { e.preventDefault(); CHAT_UP(fl); } }); }
  // 여러 장 한꺼번에 (최대 10개) · 사진 2장 이상이면 한 묶음(g) → 손님 화면에서도 카톡처럼 모아서 보여요
  CHAT_UP = async list => {
    if (f.dataset.busy) return;
    let files = list.filter(x => /^image\//.test(x.type) || x.type === "application/pdf");
    if (!files.length) { toast("사진이나 PDF만 보낼 수 있어요"); return; }
    if (files.length > 10) { toast("한 번에 10개까지 보낼 수 있어요. 앞의 10개만 보낼게요.", 3500); files = files.slice(0, 10); }
    const imgs = files.filter(x => /^image\//.test(x.type)).length;
    const grp = imgs > 1 ? [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, "0")).join("") : null;
    f.dataset.busy = "1"; const ab = f.querySelector(".cm-att"); ab.title = "누르면 보내기 취소"; let ok = 0; CHAT_STOP = false;
    for (let k = 0; k < files.length; k++) {
      if (CHAT_STOP) break;
      const file = files[k]; ab.textContent = files.length > 1 ? `${k + 1}/${files.length} ✕` : "⏳ ✕";
      try {
        const x = await chatShrink(file);
        if (x.blob.size > 10 * 1048576) throw new Error("파일이 너무 커요 (10MB까지)");
        const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "application/pdf": "pdf" }[x.type];
        if (!ext) throw new Error("사진(jpg · png · webp · gif)이나 PDF만 보낼 수 있어요");
        const rnd = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, "0")).join("");
        const base = (x.name || "file").replace(/\.[^.]*$/, "").normalize("NFKD").replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "file";
        const path = `a/${rnd}/${base}.${ext}`;
        const up = await sb.storage.from("chat").upload(path, x.blob, { contentType: x.type, upsert: false });
        if (up.error) throw new Error(up.error.message);
        const r = await sb.rpc("chat_reply_att", { thread: th.id, att: { p: path, n: (x.name || file.name || "file").slice(0, 120), m: x.type, s: x.blob.size, w: x.w || null, h: x.h || null, g: grp && /^image\//.test(x.type) ? grp : null }, body: null });
        if (r.error) { await sb.storage.from("chat").remove([path]); throw new Error(r.error.message); }
        ok++;
      } catch (er) { toast(`${file.name}: 보내지 못했어요 — ${er.message}`, 4000); }
    }
    delete f.dataset.busy; if (ok) { await loadMsgs(); drawChat(); }
    const ab2 = $("chatMain") && $("chatMain").querySelector(".cm-att"); if (ab2) { ab2.disabled = false; ab2.textContent = "📎"; }
  };
  box.querySelectorAll("[data-gal]").forEach(x => x.onclick = e => { e.preventDefault(); chatGallery(CGAL[+x.dataset.gal], +x.dataset.k); });
  // 🚫 보내기 취소 (내가 보낸 지 24시간 안 · universe41): 손님 화면에서도 '삭제된 메시지' 로 바뀌고 파일도 지워요
  box.querySelectorAll("[data-un]").forEach(x => x.onclick = () => confirmBox("이 메시지를 지울까요?", async () => {
    const r = await sb.rpc("chat_unsend_admin", { mid: +x.dataset.un });
    if (r.error) return dbErr(r.error, "보내기 취소");
    if ((r.data || []).length) await sb.storage.from("chat").remove(r.data);
    toast("지웠어요"); await loadMsgs(); drawChat();
  }, "손님 화면에서도 '삭제된 메시지'로 바뀌고, 사진 · 파일도 지워져요. 이미 간 슬랙 알림은 그대로예요.", "지우기"));
  f.onsubmit = async e => {
    // 번역 · 보내는 중에 Enter 를 여러 번 눌러도 한 번만 보내요
    e.preventDefault(); if (f.dataset.busy) return; const v = ta.value.trim(); if (!v) return;
    f.dataset.busy = "1"; ta.readOnly = true; f.querySelector("button.main").disabled = true;
    try { await chatSendNow(v); } finally { delete f.dataset.busy; ta.readOnly = false; const b2 = f.querySelector("button.main"); if (b2) b2.disabled = false; }
  };
  const chatSendNow = async v => {
    const to = ctrGuestLang(th); let r;
    if (CTR.on && to && to !== CTR.me) {
      // 내 말 → 손님 말로 바꿔서 보내요 (실패하면 원문으로 보낼지 물어봐요)
      f.querySelector("button.main").textContent = "번역 중…";
      let t = null; try { const o = await ctrCall([{ text: v, to }]); t = o[0] && o[0].text; } catch (er) { CTR.fail = er.message; }
      f.querySelector("button.main").textContent = "보내기";
      if (!t) { f.querySelector("button.main").disabled = false; confirmBox(`번역이 안 됐어요 (${CTR.fail || "?"}). 쓴 그대로 보낼까요?`, async () => { const r2 = await sb.rpc("chat_reply", { thread: th.id, body: v }); if (r2.error) return dbErr(r2.error, "답장"); ta.value = ""; await loadMsgs(); drawChat(); }, "그대로 보내기"); return; }
      r = await sb.rpc("chat_reply_tr", { thread: th.id, body: t, orig: v, orig_lang: CTR.me, to_lang: to });
    } else r = await sb.rpc("chat_reply", { thread: th.id, body: v });
    f.querySelector("button.main").disabled = false;
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
  chatAttSign().then(ch => { if (ch && CHAT_CUR === th.id) drawThread(); }).catch(() => {});
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

// 🤖 손님이 채팅을 걸면 바로 나가는 자동 인사 (universe35 · settings 'chat_greet') — 손님 언어로 나가요
const GREET_LANGS = [["ko", "한국어"], ["en", "English"], ["vi", "Tiếng Việt"], ["ja", "日本語"], ["zh", "简体中文"], ["zh-TW", "繁體中文"], ["ru", "Русский"], ["fr", "Français"], ["de", "Deutsch"], ["es", "Español"], ["hi", "हिन्दी"], ["th", "ไทย"], ["id", "Indonesia"]];
async function openGreet() {
  const r = await sb.from("settings").select("value").eq("key", "chat_greet").maybeSingle();
  if (r.error || !r.data) { toast("자동 인사를 쓰려면 Supabase에서 supabase/universe35.sql을 먼저 실행해 주세요"); return; }
  const G = JSON.parse(JSON.stringify(r.data.value)); G.day = G.day || {}; G.night = G.night || {};
  let cur = "ko";
  const d = document.createElement("div"); d.className = "overlay center";
  d.innerHTML = `<div class="modal" style="width:min(720px,calc(100% - 24px))"><h2>🤖 채팅 자동 인사</h2>
    <p class="hint">손님이 채팅을 걸면 (최근 12시간 안에 우리 쪽 메시지가 없을 때) 손님 언어로 바로 나가요. 밤(한국 시간 23시 ~ 아침 8시)에는 '밤 인사' 한 줄이 더 붙어요. 자동 인사가 나가도 <b>답장 대기</b>는 그대로라, 담당자가 직접 답해 주세요.</p>
    <label class="gr-on"><input type="checkbox" id="grOn" ${G.on === false ? "" : "checked"}> 자동 인사 켜기</label>
    <div class="gr-langs">${GREET_LANGS.map(([k, n]) => `<button type="button" class="pill ${k === cur ? "on" : ""}" data-gl="${k}">${n}</button>`).join("")}</div>
    <label class="f"><span>인사 문구</span><textarea id="grDay" rows="4"></textarea></label>
    <label class="f"><span>밤에 덧붙이는 문구 <small class="hint">— 비우면 안 붙어요</small></span><textarea id="grNight" rows="2"></textarea></label>
    <p class="hint">한국어 · 영어 · 베트남어 말고 다른 언어 문구를 고쳤다면, 번역기로 한 번 확인해 주세요. 손님 언어 문구가 비어 있으면 영어로 나가요.</p>
    <div class="btns"><button class="btn" type="button" id="grClose">닫기</button><button class="btn main" type="button" id="grSave">저장</button></div></div>`;
  document.body.appendChild(d);
  const keep = () => { G.day[cur] = d.querySelector("#grDay").value.trim(); G.night[cur] = d.querySelector("#grNight").value.trim(); };
  const show = () => { d.querySelector("#grDay").value = G.day[cur] || ""; d.querySelector("#grNight").value = G.night[cur] || ""; d.querySelectorAll("[data-gl]").forEach(x => x.classList.toggle("on", x.dataset.gl === cur)); };
  show();
  d.querySelectorAll("[data-gl]").forEach(x => x.onclick = () => { keep(); cur = x.dataset.gl; show(); });
  d.querySelector("#grClose").onclick = () => d.remove();
  d.onclick = e => { if (e.target === d) d.remove(); };
  d.querySelector("#grSave").onclick = async () => {
    keep(); G.on = d.querySelector("#grOn").checked;
    if (!(G.day.ko || "").trim()) { toast("한국어 인사 문구는 비울 수 없어요"); return; }
    const w = await sb.from("settings").upsert({ key: "chat_greet", value: G });
    if (w.error) { toast("저장하지 못했어요: " + w.error.message); return; }
    toast(G.on ? "자동 인사를 저장했어요 ✅" : "자동 인사를 껐어요"); d.remove();
  };
}

// 🚪 이 손님이 어디서 와서 어떤 화면을 보다가 문의했는지 (universe55 · 손님 화면이 보낸 '지금|처음|들어온 곳|최근' )
function chatPageName(p) {
  p = String(p || ""); if (!p) return "";
  const shopNm = id => { const s = typeof shopById === "function" && shopById(id); return s ? `🏪 ${s.name.ko || s.name.en} 업체 화면` : `🏪 업체 화면 (${id})`; };
  let m;
  if ((m = p.match(/#\/shop\/([^/?|]+)/)) || (m = p.match(/^\/(?:(?:en|vi|ja|zh)\/)?s\/([^/]+)/)) || (m = p.match(/shop\.html#([^/?|&]+)/))) return shopNm(decodeURIComponent(m[1]));
  if (/^[a-z0-9-]+$/.test(p) && p !== "home" && p !== "voucher") return shopNm(p);   // 예전 기록 (업체 id 만)
  if ((m = p.match(/^\/(?:(?:en|vi)\/)?p\/([a-z]+)\/([^/]+)/))) return `📍 입점 전 가게 안내 (${decodeURIComponent(m[2]).replace(/-[nw]\d+$/, "").replace(/-/g, " ")})`;
  if ((m = p.match(/^\/(?:(?:en|vi|ja|zh)\/)?c\/([a-z]+)\/?(more)?/))) return `🗺️ ${{ danang: "다낭", hcm: "호치민", hanoi: "하노이", nhatrang: "나트랑" }[m[1]] || m[1]} 가게 목록`;
  if (/^\/blog\//.test(p)) return `📝 블로그 글 (${decodeURIComponent(p.replace(/^\/blog\//, "").replace(/\/$/, "")) || "목록"})`;
  if (/booking\.html|^voucher$/.test(p)) return "🧾 예약 확인증";
  if (/^(home|\/|\/(en|vi|ja|zh)\/?|\/index\.html)?(#.*)?$/.test(p)) return "🏠 첫 화면 (업체 목록)";
  return "📄 " + p;
}
// 🌍 손님 나라 추정 — ① 연락처 국가번호 ② 브라우저 언어의 나라 ③ 기기 시간대 (지금 있는 곳)
const CC_TZ = { "Europe/London": "GB", "Europe/Dublin": "IE", "Europe/Paris": "FR", "Europe/Berlin": "DE", "Europe/Madrid": "ES", "Europe/Rome": "IT", "Europe/Amsterdam": "NL", "Europe/Brussels": "BE", "Europe/Luxembourg": "LU", "Europe/Zurich": "CH", "Europe/Vienna": "AT", "Europe/Stockholm": "SE", "Europe/Oslo": "NO", "Europe/Copenhagen": "DK", "Europe/Helsinki": "FI", "Europe/Warsaw": "PL", "Europe/Prague": "CZ", "Europe/Bratislava": "SK", "Europe/Budapest": "HU", "Europe/Lisbon": "PT", "Europe/Athens": "GR", "Europe/Moscow": "RU", "Europe/Kiev": "UA", "Europe/Kyiv": "UA", "Europe/Bucharest": "RO", "Europe/Sofia": "BG", "Europe/Zagreb": "HR", "Europe/Ljubljana": "SI", "Europe/Istanbul": "TR", "Asia/Seoul": "KR", "Asia/Tokyo": "JP", "Asia/Shanghai": "CN", "Asia/Hong_Kong": "HK", "Asia/Taipei": "TW", "Asia/Singapore": "SG", "Asia/Bangkok": "TH", "Asia/Ho_Chi_Minh": "VN", "Asia/Saigon": "VN", "Asia/Kuala_Lumpur": "MY", "Asia/Manila": "PH", "Asia/Jakarta": "ID", "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Dubai": "AE", "Asia/Jerusalem": "IL", "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Australia/Brisbane": "AU", "Australia/Perth": "AU", "Australia/Adelaide": "AU", "Pacific/Auckland": "NZ", "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US", "America/Los_Angeles": "US", "America/Phoenix": "US", "Pacific/Honolulu": "US", "America/Anchorage": "US", "America/Toronto": "CA", "America/Vancouver": "CA", "America/Edmonton": "CA", "America/Mexico_City": "MX", "America/Sao_Paulo": "BR" };
const CC_TEL = [["420", "CZ"], ["421", "SK"], ["353", "IE"], ["358", "FI"], ["351", "PT"], ["352", "LU"], ["380", "UA"], ["852", "HK"], ["886", "TW"], ["971", "AE"], ["972", "IL"], ["44", "GB"], ["33", "FR"], ["49", "DE"], ["34", "ES"], ["39", "IT"], ["31", "NL"], ["32", "BE"], ["41", "CH"], ["43", "AT"], ["46", "SE"], ["47", "NO"], ["45", "DK"], ["48", "PL"], ["36", "HU"], ["30", "GR"], ["40", "RO"], ["90", "TR"], ["82", "KR"], ["81", "JP"], ["86", "CN"], ["65", "SG"], ["66", "TH"], ["84", "VN"], ["60", "MY"], ["63", "PH"], ["62", "ID"], ["91", "IN"], ["61", "AU"], ["64", "NZ"], ["55", "BR"], ["52", "MX"], ["7", "RU"], ["1", "US"]];
const CC_LANG = { ko: "KR", ja: "JP", vi: "VN", zh: "CN", de: "DE", fr: "FR", it: "IT", es: "ES", nl: "NL", sv: "SE", da: "DK", nb: "NO", no: "NO", fi: "FI", pl: "PL", cs: "CZ", sk: "SK", hu: "HU", ro: "RO", ru: "RU", uk: "UA", pt: "PT", el: "GR", tr: "TR", th: "TH" };
const CC_EU = "GB IE FR DE ES IT NL BE LU CH AT SE NO DK FI PL CZ SK HU PT GR RU UA RO BG HR SI TR".split(" "), CC_AS = "KR JP CN HK TW SG TH VN MY PH ID IN AE IL".split(" "), CC_AM = "US CA MX BR".split(" "), CC_OC = "AU NZ".split(" ");
function ccName(c) { if (!c) return "알 수 없음"; let n = c; try { n = new Intl.DisplayNames(["ko"], { type: "region" }).of(c) || c; } catch (e) {} return n; }
// 윈도우는 국기 이모지가 'RU' 글자로 보여서 작은 국기 그림으로
function ccFlag(c) { return c && /^[A-Z]{2}$/.test(c) ? `<img class="cc-flag" src="https://flagcdn.com/w40/${c.toLowerCase()}.png" alt="${c}" width="20" height="15" loading="lazy">` : "🏳️"; }
const CC_PICK = ["GB", "IE", "FR", "DE", "NL", "BE", "CH", "AT", "IT", "ES", "PT", "SE", "NO", "DK", "FI", "PL", "CZ", "RU", "KR", "JP", "CN", "TW", "HK", "SG", "MY", "TH", "PH", "IN", "VN", "US", "CA", "AU", "NZ"];
function ccArea(c) { return !c ? "알 수 없음" : CC_EU.includes(c) ? "유럽" : CC_AS.includes(c) ? "아시아" : CC_AM.includes(c) ? "미주" : CC_OC.includes(c) ? "오세아니아" : "기타"; }
// 🧪 테스트 채팅 — 이름·연락처에 test / 테스트 / example.com, 또는 관리자가 '테스트'로 지정 (country = ZZ)
function chatIsTest(th) { return th.country === "ZZ" || /test|테스트|テスト|测试|тест|example\.(com|org)/i.test((th.name || "") + " " + (th.contact || "")); }
function chatGeo(th) {
  const parts = String(th.page || "").split("|"); const g = parts.length >= 5 ? parts[parts.length - 1] : ""; const [tz, bl, dv] = g.split("~");
  const here = CC_TZ[tz] || (tz && /^Europe\//.test(tz) ? "EU" : "");
  let home = "", how = "";
  if (th.country) return { home: th.country, how: "관리자 지정", here, tz: tz || "", bl: bl || "", dv: dv || "" };
  const c = String(th.contact || "").replace(/[\s().\-\/]/g, ""); let m;
  if ((m = c.match(/(?:\+|^00)(\d{6,})/))) { const d = m[1]; const hit = CC_TEL.find(([p]) => d.startsWith(p)); if (hit) { home = hit[1]; how = "연락처 국가번호"; } }
  else if (/(^|\D)010\d{7,8}$/.test(c)) { home = "KR"; how = "연락처 (010)"; }
  else if (/(^|\D)07\d{9}$/.test(c)) { home = "GB"; how = "연락처 (영국 07 번호)"; }
  else if (/(^|\D)0[35789]\d{8}$/.test(c)) { home = "VN"; how = "연락처 (베트남 번호)"; }
  else if (/(^|\D)44(7\d{9})$/.test(c)) { home = "GB"; how = "연락처 (44 국가번호)"; }
  if (!home && bl) { const m = bl.match(/^([a-z]{2,3})(?:-([A-Z]{2}))?/i); if (m) { const r = m[2] && m[2].toUpperCase(); const l = m[1].toLowerCase(); home = r && !(l === "en" && r === "US" && here && here !== "US") ? r : CC_LANG[l] || ""; if (home) how = "브라우저 언어 " + bl; } }
  if (!home && here && here !== "EU") { home = here; how = "기기 시간대"; }
  return { home, how, here, tz: tz || "", bl: bl || "", dv: dv || "" };
}
function chatGeoHtml(th) {
  if (chatIsTest(th)) return `<br>🧪 <b>테스트 채팅</b> <small>· 나라별 통계에서 빠져요</small>`;
  const g = chatGeo(th); if (!g.home && !g.tz) return "";
  const where = g.here === "VN" ? "지금 베트남에 있어요 (현지 문의)" : g.here ? `지금 ${g.here === "EU" ? "유럽" : ccName(g.here)} 시간대 (여행 전 문의)` : "";
  return `<br>🌍 손님 나라 (추정): <b>${ccFlag(g.home)} ${esc(ccName(g.home))}</b>${g.how ? ` <small>· ${esc(g.how)}</small>` : ""}${where ? `<br><small>🕒 ${esc(where)}</small>` : ""}`;
}
// 접어 둔 한 줄 요약 (눌러야 자세히) — 채팅 칸이 좁아지지 않게
let CH_SRC_OPEN = false;
function chatSrcWrap(html, page, th) {
  if (!html) return "";
  const p = String(page || "").split("|"), src = p.length >= 3 ? p[2] : "";
  const SRCS = { google: "🔎 구글", naver: "🟢 네이버", direct: "⌨️ 직접 입력", internal: "엉클데이 안", kakao: "💬 카톡", facebook: "페이스북", instagram: "인스타", chatgpt: "🤖 ChatGPT", gbp: "📍 구글 지도", qr: "📱 QR", zalo: "잘로" };
  const g = th ? (chatIsTest(th) ? { test: 1 } : chatGeo(th)) : {};
  const bits = [g.test ? "🧪 테스트" : g.home ? `${ccFlag(g.home)} ${esc(ccName(g.home))}` : "", src ? esc(SRCS[src] || src) : "", p[0] && p[0] !== "home" ? esc(chatPageName(p[0]).replace(/ 업체 화면$| \(업체 목록\)$/, "")) : ""].filter(Boolean);
  return html.replace(/^<div class="ch-src">/, `<details class="ch-src"${CH_SRC_OPEN ? " open" : ""}><summary>${bits.join(" · ") || "🚪 들어온 경로"} <span class="ch-more">자세히</span></summary><div class="ch-src-in">`).replace(/<\/div>$/, "</div></details>");
}
function chatSrcHtml(page, th) { return chatSrcWrap(chatSrcHtml0(page, th), page, th); }
function chatSrcHtml0(page, th) {
  if (!page) return th ? (h => h ? `<div class="ch-src">${h.replace(/^<br>/, "")}</div>` : "")(chatGeoHtml(th)) : "";
  const _p = String(page).split("|"); if (_p.length >= 5) _p.pop();
  const [cur, land, src, pages] = _p;
  if (land === undefined) { const gh = th ? chatGeoHtml(th) : ""; return page === "home" ? (gh ? `<div class="ch-src">${gh.replace(/^<br>/, "")}</div>` : "") : `<div class="ch-src">👀 보고 있던 화면: <b>${esc(chatPageName(cur))}</b>${gh}</div>`; }   // 예전 기록
  const SRC = { google: "🔎 구글 검색", naver: "🟢 네이버", naverblog: "🟢 네이버 블로그", daum: "다음", bing: "빙", direct: "⌨️ 주소 직접 입력 · 즐겨찾기", internal: "엉클데이 안", kakao: "💬 카카오톡", facebook: "페이스북", instagram: "인스타그램", youtube: "유튜브", zalo: "잘로", tiktok: "틱톡", chatgpt: "🤖 ChatGPT", perplexity: "🤖 Perplexity", claude: "🤖 Claude", gemini: "🤖 Gemini", gbp: "📍 구글 지도 업체 프로필", qr: "📱 QR 코드", fb: "페이스북", ig: "인스타그램" };
  const url = p => /^\//.test(p) ? "https://www.uncleday.com" + p : null;
  const a = p => { const u = url(p); return u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(chatPageName(p))}</a>` : esc(chatPageName(p)); };
  const trail = (pages || "").split(",").filter(x => x && x !== cur);
  return `<div class="ch-src">👀 문의할 때 보던 화면: <b>${a(cur)}</b><br>🚪 처음 들어온 곳: <b>${esc(SRC[src] || src || "알 수 없음")}</b> → ${a(land)}${trail.length ? `<br><small>최근 본 화면: ${trail.map(a).join(" · ")}</small>` : ""}${th ? chatGeoHtml(th) : ""}</div>`;
}

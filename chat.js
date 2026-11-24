/* 💬 엉클데이 사이트 채팅
   - 대화방 열쇠: 예약확인증이면 그 예약, 로그인했으면 그 계정, 아니면 이 브라우저에 저장한 열쇠
   - 창을 열어 두면 4초마다, 닫혀 있으면 1분마다 새 답장이 왔는지 봐요 */
const CHAT = (() => {
  if (typeof LIVE === "undefined" || !LIVE.on) return null;
  const KEY = "ud-chat";
  // 문구는 i18n.js 의 cb_… (13개 언어 · 번역 안 된 문구는 영어)
  const L = () => (typeof lang !== "undefined" ? lang : "ko");
  const t = (k, v) => ui("cb_" + k, v || {});

  // 메시지 속 엉클데이 주소는 짧은 버튼 모양 링크로
  const linkify = h => h.replace(/https:\/\/(?:www\.)?uncleday\.com\/[^\s<]*/g, u => `<a class="cb-a" href="${u}">${/booking\.html/.test(u) ? t("voucher") : u}</a>`);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const get = () => { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } };
  // 📎 첨부 (universe40 · Edge Function chat-file): 사진은 대화 안에 바로, PDF 는 눌러서 화면에서 바로 열어요
  const attUrl = m => `${SUPA.url}/functions/v1/chat-file?id=${m.id}&${bt() ? "bt=" + encodeURIComponent(bt()) : "t=" + encodeURIComponent(get())}`;
  const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + "MB" : Math.max(1, Math.round(n / 1024)) + "KB";
  const isPh = (m) => m.att && (m.body === "📷" || m.body === "📄 " + m.att.n);
  function attHtml(m) {
    const a = m.att; if (!a) return "";
    if (/^image\//.test(a.m)) return `<button type="button" class="cb-img" data-zoom="${esc(attUrl(m))}"><img src="${esc(attUrl(m))}" alt="" loading="lazy"${a.w && a.h ? ` width="${a.w}" height="${a.h}"` : ""}></button>`;
    return `<a class="cb-file" href="${esc(attUrl(m))}" target="_blank" rel="noopener"><b>📄 ${esc(a.n)}</b><small>${a.s ? kb(a.s) + " · " : ""}${t("open")}</small></a>`;
  }
  // 사진은 보내기 전에 줄이고(긴 쪽 1600px) 위치 정보를 지워요 (다시 그리면 EXIF 가 빠져요) · GIF 는 그대로
  async function shrink(file) {
    if (!/^image\//.test(file.type) || file.type === "image/gif") return { blob: file, name: file.name };
    try {
      const bm = await createImageBitmap(file, { imageOrientation: "from-image" });
      const k = Math.min(1, 1600 / Math.max(bm.width, bm.height)), w = Math.round(bm.width * k), h = Math.round(bm.height * k);
      const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(bm, 0, 0, w, h);
      const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.85));
      if (blob) return { blob, w, h, name: (file.name || "photo").replace(/\.[^.]*$/, "") + ".jpg" };
    } catch (e) {}
    return { blob: file, name: file.name };
  }
  function zoom(src) {
    const z = document.createElement("div"); z.className = "cb-zoom"; z.innerHTML = `<img src="${esc(src)}" alt=""><button type="button" aria-label="close">✕</button>`;
    z.onclick = () => z.remove(); document.body.appendChild(z);
  }
  const put = v => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch (e) {} };
  // 문자로 받은 "?chat=열쇠" 링크로 들어오면 그 대화를 이어가요
  const q = new URLSearchParams(location.search).get("chat");
  if (q && q.length >= 32) { put(q); history.replaceState(null, "", location.pathname + location.hash); }
  const onVoucher = /booking\.html$/.test(location.pathname);
  const bt = () => onVoucher ? decodeURIComponent(location.hash.slice(1)) : null;

  let open = false, last = 0, msgs = [], timer = null, booking = null, known = false, sending = false;
  const fab = document.createElement("button"); fab.className = "chat-fab"; fab.type = "button"; fab.setAttribute("aria-label", t("title"));
  fab.innerHTML = `<span class="cf-ic">💬</span><span class="cf-dot" hidden></span>`;
  const box = document.createElement("div"); box.className = "chat-box"; box.hidden = true;
  const mount = () => { document.body.appendChild(fab); document.body.appendChild(box); place(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();

  // 아래쪽 고정 버튼(예약하기 바)이 있으면 그 위로
  // 아래 고정 바에 이미 "상담" 버튼이 있으면 💬 동그라미는 숨겨요 (같은 기능 버튼이 두 개 보이지 않게)
  function place() { const bar = [...document.querySelectorAll(".cta-bar")].find(x => !x.classList.contains("away") && x.getBoundingClientRect().height > 0 && getComputedStyle(x).display !== "none" && getComputedStyle(x).visibility !== "hidden"); const up = bar ? bar.offsetHeight + 12 : 0; fab.style.bottom = (18 + up) + "px"; box.style.bottom = (84 + up) + "px"; fab.classList.toggle("by-bar", !!(bar && bar.querySelector("[data-chat]")) && !open); }
  window.addEventListener("resize", place); window.addEventListener("hashchange", () => setTimeout(place, 300)); setInterval(place, 2000);

  // ⚡ 답장 속도: 최근 30일 실제 기록이 10건 이상일 때만 숫자로 (universe35 chat_speed)
  let speed = null;
  try { speed = JSON.parse(sessionStorage.getItem("ud-chat-speed") || "null"); } catch (e) {}
  if (!speed) LIVE.rpc("chat_speed", {}).then(j => { if (j && j.n != null) { speed = j; try { sessionStorage.setItem("ud-chat-speed", JSON.stringify(speed)); } catch (e) {} if (open) draw(); } }).catch(() => {});
  function subText() {
    if (!speed || !(speed.n >= 10) || speed.min == null) return t("sub");
    const m = Math.max(1, +speed.min);
    return m <= 60 ? t("subMin", { n: m }) : m <= 24 * 60 ? t("subHr", { n: Math.ceil(m / 60) }) : t("sub");
  }
  function draw() {
    const fmt = d => { try { return new Date(d).toLocaleTimeString(L(), { hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; } };
    const showForm = !known && !(typeof ACCT !== "undefined" && ACCT.user()) && !onVoucher;
    box.innerHTML = `<div class="cb-head"><div><b>${t("title")}</b><small>${subText()}</small></div><button type="button" class="cb-x" aria-label="close">✕</button></div>
      <div class="cb-list">
        <div class="cb-m us"><span>${booking ? `<b>${esc(t("bk", { c: booking }))}</b><br>` : ""}${esc(t("hello")).replace(/\n/g, "<br>")}</span></div>
        ${msgs.map(m => `<div class="cb-m ${m.from === "admin" ? "us" : "me"}">${attHtml(m)}${isPh(m) ? "" : `<span>${linkify(esc(m.body)).replace(/\n/g, "<br>")}</span>`}<time>${m.auto ? "🌐 " + ({ ko: "자동 번역", vi: "Tự động dịch" }[document.documentElement.lang] || "Auto-translated") + " · " : ""}${fmt(m.at)}</time></div>`).join("")}
      </div>
      <form class="cb-form">
        ${showForm ? `<div class="cb-who"><input name="name" placeholder="${t("name")}" maxlength="60" autocomplete="name"><input name="contact" placeholder="${t("contact")}" maxlength="100" autocomplete="tel"></div>` : ""}
        <div class="cb-row"><button type="button" class="cb-att" aria-label="${esc(t("attach"))}" title="${esc(t("attach"))}">📎</button><input type="file" class="cb-fi" accept="image/*,application/pdf" hidden><textarea name="body" rows="1" placeholder="${t("ph")}" maxlength="2000"></textarea><button class="cb-send" type="submit">${t("send")}</button></div>
        <div class="cb-up" hidden></div>
        <div class="cb-foot">${msgs.length ? `<span>${t("keep")}</span>` : ""}
          ${typeof ACCT !== "undefined" && ACCT.on && !ACCT.user() ? `<button type="button" class="cb-link" data-login>${t("login")}</button>` : ""}
          ${typeof SITE !== "undefined" && SITE.kakao ? `<a class="cb-link" href="${SITE.kakao}" target="_blank" rel="noopener">${t("kakao")}</a>` : ""}</div>
      </form>`;
    const list = box.querySelector(".cb-list"); list.scrollTop = list.scrollHeight;
    box.querySelector(".cb-x").onclick = () => toggle(false);
    const lg = box.querySelector("[data-login]"); if (lg) lg.onclick = () => ACCT.openLogin();
    const f = box.querySelector(".cb-form"), ta = f.body;
    box.querySelectorAll("[data-zoom]").forEach(x => x.onclick = () => zoom(x.dataset.zoom));
    const fi = box.querySelector(".cb-fi"); box.querySelector(".cb-att").onclick = () => fi.click();
    fi.onchange = () => { const file = fi.files && fi.files[0]; fi.value = ""; if (file) sendFile(file); };
    ta.onpaste = e => { const it = [...((e.clipboardData && e.clipboardData.files) || [])][0]; if (it) { e.preventDefault(); sendFile(it); } };   // 붙여넣기(Ctrl+V)로도 보내요
    ta.oninput = () => { ta.style.height = "auto"; ta.style.height = Math.min(120, ta.scrollHeight) + "px"; };
    ta.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); f.requestSubmit(); } };
    f.onsubmit = async e => {
      e.preventDefault(); const body = ta.value.trim(); if (!body || sending) return; sending = true; f.querySelector(".cb-send").disabled = true;
      try {
        const r = await LIVE.rpc("chat_send", { body, t: get() || null, bt: bt(), name: f.name ? f.name.value.trim() || null : null, contact: f.contact ? f.contact.value.trim() || null : null, lang: L(), page: (location.hash.match(/#\/shop\/([^/?]+)/) || [])[1] || (onVoucher ? "voucher" : "home") });
        if (r && r.token && !bt()) put(r.token);
        known = true; take(r, true); ta.value = ""; draw(); box.querySelector(".cb-form textarea").focus();
        if (typeof LIVE.track === "function") LIVE.track("chat");
      } catch (err) { alert(err.server ? err.message : t("err")); }
      sending = false; const sb = box.querySelector(".cb-send"); if (sb) sb.disabled = false;
    };
  }
  async function sendFile(file) {
      const f = box.querySelector(".cb-form"), ta = f && f.body; if (!f || !file || sending) return;
      if (!/^image\//.test(file.type) && file.type !== "application/pdf") { alert(t("type")); return; }
      const up = box.querySelector(".cb-up"); sending = true; up.hidden = false; up.textContent = "📎 " + t("upl");
      try {
        const s1 = await shrink(file);
        if (s1.blob.size > 10 * 1048576) throw new Error(t("big"));
        const fd = new FormData(); fd.append("file", s1.blob, s1.name);
        const add = (k, v) => { if (v) fd.append(k, v); };
        add("t", get()); add("bt", bt()); add("lang", L()); add("page", (location.hash.match(/#\/shop\/([^/?]+)/) || [])[1] || (onVoucher ? "voucher" : "home"));
        add("name", f.name ? f.name.value.trim() : ""); add("contact", f.contact ? f.contact.value.trim() : ""); add("body", ta.value.trim()); if (s1.w) { add("w", String(s1.w)); add("h", String(s1.h)); }
        const hd = { apikey: SUPA.key, Authorization: "Bearer " + (window.UD_TOKEN || SUPA.key) };
        const r = await fetch(`${SUPA.url}/functions/v1/chat-file`, { method: "POST", headers: hd, body: fd });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j.error) throw new Error(j.error || t("err"));
        if (j.token && !bt()) put(j.token);
        known = true; take(j, true); ta.value = ""; draw();
        if (typeof LIVE.track === "function") LIVE.track("chat");
      } catch (err) { alert(err.message || t("err")); }
      sending = false; const u2 = box.querySelector(".cb-up"); if (u2) u2.hidden = true;
    }
  function take(r, reset) {
    if (!r) return;
    if (r.booking) booking = r.booking;
    if (r.token) known = true;
    if (reset) { msgs = r.messages || []; } else (r.messages || []).forEach(m => { if (!msgs.some(x => x.id === m.id)) msgs.push(m); });
    last = msgs.length ? msgs[msgs.length - 1].id : 0;
    fab.querySelector(".cf-dot").hidden = open || !(r.unread > 0);
  }
  async function poll(full) {
    if (!get() && !bt() && !(typeof ACCT !== "undefined" && ACCT.user())) return;
    try {
      const r = await LIVE.rpc("chat_get", { t: get() || null, bt: bt(), since: full ? 0 : last, seen: open });
      if (r && r.token && !bt() && !get()) put(r.token);
      const before = msgs.length; take(r, full);
      if (open && (full || msgs.length !== before)) draw();
    } catch (e) {}
  }
  function toggle(v) {
    open = v; box.hidden = !open; fab.classList.toggle("on", open); place();
    clearInterval(timer);
    if (open) { fab.querySelector(".cf-dot").hidden = true; draw(); poll(true); timer = setInterval(() => poll(false), 4000); setTimeout(() => { const ta = box.querySelector("textarea"); if (ta && innerWidth > 600) ta.focus(); }, 50); }
    else timer = setInterval(() => poll(false), 60000);
  }
  // 끌어다 놓기: 채팅 창 위에 사진 · PDF 를 놓으면 바로 보내요
  box.addEventListener("dragover", e => { if ([...(e.dataTransfer && e.dataTransfer.types || [])].includes("Files")) { e.preventDefault(); box.classList.add("cb-drop"); } });
  box.addEventListener("dragleave", e => { if (!box.contains(e.relatedTarget)) box.classList.remove("cb-drop"); });
  box.addEventListener("drop", e => { const fl = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; box.classList.remove("cb-drop"); if (fl) { e.preventDefault(); sendFile(fl); } });
  fab.onclick = () => toggle(!open);
  // 상단 "상담하기"·업체 화면 아래 "상담" 버튼 → 사이트 채팅 열기
  document.addEventListener("click", e => {
    const a = e.target.closest("[data-chat]"); if (!a) return;
    e.preventDefault(); e.stopPropagation(); toggle(true);
    const m = (window.SHOP_ID && [0, window.SHOP_ID]) || location.hash.match(/^#\/shop\/([^/?]+)/) || (/shop\.html$/.test(location.pathname) && [0, location.hash.slice(1)]);
    const shop = m && typeof SHOPS !== "undefined" && SHOPS.find(s => s.id === decodeURIComponent(m[1]));
    if (shop && !msgs.length) setTimeout(() => { const ta = box.querySelector("textarea[name=body]"); if (ta && !ta.value) { ta.value = t("shopQ", { shop: tx(shop.name) }); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); ta.oninput && ta.oninput(); } }, 80);
  }, true);
  // 처음: 예전 대화가 있으면 안 읽은 답장이 있는지 확인
  setTimeout(() => poll(true), 1500); timer = setInterval(() => poll(false), 60000);
  // 로그아웃하면 이 브라우저의 대화도 지워요 (같은 기기를 다른 사람이 쓸 때 예전 대화가 보이지 않게)
  let wasUser = false;
  if (typeof ACCT !== "undefined") ACCT.onUser(u => {
    if (u) { wasUser = true; if (!open) poll(true); return; }
    if (!wasUser) return; wasUser = false;
    put(""); msgs = []; last = 0; known = false; fab.querySelector(".cf-dot").hidden = true; if (open) toggle(false);
  });
  return { open: () => toggle(true), poll, place };
})();

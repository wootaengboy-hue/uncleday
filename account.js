/* 손님 로그인 (카카오 · 네이버 · 구글 · 페이스북) — Supabase Auth
   로그인은 선택이에요. 안 해도 예약·채팅은 그대로 돼요.
   로그인하면: 내 예약 목록, 어느 기기에서나 이어지는 채팅, 예약 폼 이름 자동 입력 */
const ACCT = (() => {
  const on = typeof SUPA !== "undefined" && SUPA.url && SUPA.key;
  const ref = on ? ((SUPA.url.match(/^https:\/\/([^.]+)\./) || [])[1] || "") : "";
  const SKEY = `sb-${ref}-auth-token`, BACK = "ud-login-back";
  let sb = null, user = null, loading = null; const subs = [];
  // 문구는 i18n.js 의 ac_… (13개 언어 · 번역 안 된 문구는 영어)
  const L = () => (typeof lang !== "undefined" ? lang : "ko");
  const t = (k, v) => ui("ac_" + k, v || {});

  const PROVIDERS = [
    { id: "kakao", cls: "kakao", n: "p_kakao", mark: "K" },
    { id: "custom:naver", off: "naver", cls: "naver", n: "p_naver", mark: "N" },
    { id: "google", cls: "google", n: "p_google", mark: "G" },
    { id: "facebook", off: true, cls: "facebook", n: "p_facebook", mark: "f" }];

  // 승인 전이라 숨긴 로그인(네이버)은 주소에 ?naver=1 을 붙여 들어오면 보여요 (검수 담당자·테스트용, 이 브라우저에 기억)
  const unlocked = id => { try { if (new URLSearchParams(location.search).get(id) === "1") localStorage.setItem("ud-show-" + id, "1"); return localStorage.getItem("ud-show-" + id) === "1"; } catch (e) { return false; } };
  const stored = () => { try { return !!localStorage.getItem(SKEY); } catch (e) { return false; } };
  function set(s) { user = s ? s.user : null; window.UD_TOKEN = s ? s.access_token : null; drawBtn(); subs.forEach(f => { try { f(user); } catch (e) {} }); }
  function load() {
    if (!on) return Promise.resolve(null);
    if (loading) return loading;
    loading = (async () => {
      if (!window.supabase) await new Promise((ok, no) => { const s = document.createElement("script"); s.src = "vendor/supabase.js"; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
      sb = supabase.createClient(SUPA.url, SUPA.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } });
      sb.auth.onAuthStateChange((ev, s) => set(s));
      const hadCode = /[?&]code=/.test(location.search);
      const { data, error: se } = await sb.auth.getSession(); set(data.session);
      if (hadCode && !data.session) setTimeout(() => alert(t("fail") + "\n(" + ((se && se.message) || "code exchange failed") + ")"), 300);
      // 로그인하고 돌아왔으면 주소의 ?code= 를 지우고 원래 보던 화면으로
      // 로그인 실패로 돌아왔으면 이유를 보여줘요 (예전엔 조용히 지워져서 "아무 일도 안 일어난" 것처럼 보였어요)
      const qs = new URLSearchParams(location.search), hs = new URLSearchParams(location.hash.slice(1));
      const err = qs.get("error_description") || qs.get("error") || hs.get("error_description") || (hs.get("error") ? hs.get("error") : "");
      if (err) setTimeout(() => alert(t("fail") + "\n(" + err.replace(/\+/g, " ") + ")"), 300);
      if (hs.get("error")) history.replaceState(null, "", location.pathname + location.search);
      if (/[?&](code|error)=/.test(location.search)) {
        let back = ""; try { back = sessionStorage.getItem(BACK) || ""; sessionStorage.removeItem(BACK); } catch (e) {}
        history.replaceState(null, "", location.pathname + (back || location.hash));
        if (back && back.startsWith("#")) window.dispatchEvent(new HashChangeEvent("hashchange"));
      }
      return sb;
    })().catch(e => { loading = null; throw e; });
    return loading;
  }
  const name = () => { if (!user) return ""; const m = user.user_metadata || {}; return m.full_name || m.name || m.nickname || m.preferred_username || (user.email || "").split("@")[0] || ""; };

  async function login(provider) {
    try {
      await load();
      try { sessionStorage.setItem(BACK, location.hash || ""); } catch (e) {}
      const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: location.origin + location.pathname } });
      if (error) throw error;
    } catch (e) { alert(t("fail") + (e && e.message ? `\n(${e.message})` : "")); }
  }
  async function logout() { await load(); await sb.auth.signOut(); set(null); closeSheet(); }

  // ---- 화면 ----
  let sheet = null;
  function closeSheet() { if (sheet) { sheet.remove(); sheet = null; } }
  function openSheet(html) {
    closeSheet(); sheet = document.createElement("div"); sheet.className = "acct-sheet";
    sheet.innerHTML = `<div class="acct-card" role="dialog" aria-modal="true"><button class="acct-x" aria-label="${t("close")}">✕</button>${html}</div>`;
    document.body.appendChild(sheet);
    sheet.onclick = e => { if (e.target === sheet || e.target.closest(".acct-x")) closeSheet(); };
    document.addEventListener("keydown", function esc(e) { if (e.key === "Escape") { closeSheet(); document.removeEventListener("keydown", esc); } });
    return sheet;
  }
  function openLogin() {
    const s = openSheet(`<h2>${t("title")}</h2><p class="acct-desc">${t("desc")}</p>
      <div class="acct-provs">${PROVIDERS.filter(p => !p.off || (typeof p.off === "string" && unlocked(p.off))).map(p => `<button class="acct-p ${p.cls}" data-p="${p.id}">${t(p.n)}</button>`).join("")}</div>
      <p class="acct-skip">${t("skip")}</p><p class="acct-terms">${t("terms")}</p>`);
    s.querySelectorAll("[data-p]").forEach(b => b.onclick = () => { b.disabled = true; login(b.dataset.p); });
  }
  async function openMine() {
    const s = openSheet(`<h2>${esc(t("hi", { n: name() }))}</h2><p class="acct-desc">${esc(user.email || "")}</p><div class="acct-pts" hidden></div><a class="acct-hist" href="history.html">📒 ${typeof ui === "function" ? ui("hi_open") : "내 시술 기록"} ›</a><h3>${t("my")}</h3><div class="acct-list"><p class="acct-desc">…</p></div>
      <button class="btn acct-out">${t("out")}</button>`);
    s.querySelector(".acct-out").onclick = logout;
    // 💰 결제 확인 페이백 포인트 (universe31.sql 실행 전이면 조용히 숨겨요)
    LIVE.rpc("my_points", {}).then(p => { const el = s.querySelector(".acct-pts"); if (!el || !p) return;
      const W = [t("pts"), t("ptsWait")];
      const wait = (p.list || []).filter(x => x.status === "wait" || x.status === "review").length;
      el.innerHTML = `<b>${W[0]}</b><span><b>${Number(p.total || 0).toLocaleString("en-US")}P</b>${wait ? ` · ${W[1]} ${wait}` : ""}</span>`; el.hidden = false; }).catch(() => {});
    try {
      const list = await LIVE.rpc("my_bookings", {});
      s.querySelector(".acct-list").innerHTML = (list || []).length ? list.map(b => `<a class="acct-bk" href="booking.html?v=2#${encodeURIComponent(b.t)}">
          <b>${esc(b.shop_name || "")}</b><span>${esc(b.visit_date || "")} ${esc(b.visit_time || "")} · ${esc(b.code)}</span>
          <em class="v-st st-${esc(b.status)}">${typeof ui === "function" ? ui("st_" + b.status) : esc(b.status)}</em></a>`).join("") : `<p class="acct-desc">${t("none")}</p>`;
    } catch (e) { s.querySelector(".acct-list").innerHTML = `<p class="acct-desc">${esc(e.message)}</p>`; }
  }
  function drawBtn() {
    let b = document.getElementById("acctBtn");
    if (!b) { const host = document.querySelector(".top-in"); if (!host || !on) return; b = document.createElement("button"); b.id = "acctBtn"; b.className = "acct-btn"; b.type = "button"; const k = host.querySelector(".kakao-link"); host.insertBefore(b, k || null); }
    b.innerHTML = user ? `<span class="acct-av">${esc((name() || "?").slice(0, 1).toUpperCase())}</span><span class="acct-l">${t("my")}</span>` : `<span class="acct-ic">👤</span><span class="acct-l">${t("login")}</span>`;
    b.onclick = () => user ? openMine() : openLogin();
  }
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  if (on) {
    const start = () => { drawBtn(); if (stored() || /[?&](code|error)=/.test(location.search) || /[#&]error=/.test(location.hash)) load().catch(() => {}); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  }
  return { on, load, login, logout, openLogin, user: () => user, name, onUser: f => { subs.push(f); if (user) f(user); }, redraw: drawBtn };
})();

/* 손님 로그인 (카카오 · 네이버 · 구글 · 페이스북) — Supabase Auth
   로그인은 선택이에요. 안 해도 예약·채팅은 그대로 돼요.
   로그인하면: 내 예약 목록, 어느 기기에서나 이어지는 채팅, 예약 폼 이름 자동 입력 */
const ACCT = (() => {
  const on = typeof SUPA !== "undefined" && SUPA.url && SUPA.key;
  const ref = on ? ((SUPA.url.match(/^https:\/\/([^.]+)\./) || [])[1] || "") : "";
  const SKEY = `sb-${ref}-auth-token`, BACK = "ud-login-back";
  let sb = null, user = null, loading = null; const subs = [];
  const L = () => (typeof lang !== "undefined" && ["ko", "en", "vi"].includes(lang) ? lang : "ko");
  const T = {
    ko: { login: "로그인", title: "엉클데이 시작하기", desc: "로그인하면 예약 내역과 상담 대화를 어느 기기에서나 이어서 볼 수 있어요.", skip: "로그인 없이도 예약할 수 있어요.",
      my: "내 예약", out: "로그아웃", none: "아직 예약이 없어요.", hi: n => `${n}님`, vo: "예약확인증", fail: "로그인을 시작하지 못했어요. 잠시 뒤 다시 해 주세요.",
      terms: "로그인하면 예약·상담 관리를 위해 이름과 이메일(제공하는 경우)을 저장해요.", close: "닫기" },
    en: { login: "Log in", title: "Start with Uncle Day", desc: "Log in to see your bookings and chats on any device.", skip: "You can book without logging in.",
      my: "My bookings", out: "Log out", none: "No bookings yet.", hi: n => n, vo: "Voucher", fail: "Couldn't start login. Please try again later.",
      terms: "We store your name and email (if provided) to manage your bookings and chats.", close: "Close" },
    vi: { login: "Đăng nhập", title: "Bắt đầu với Uncle Day", desc: "Đăng nhập để xem lịch hẹn và trò chuyện trên mọi thiết bị.", skip: "Bạn vẫn có thể đặt lịch mà không cần đăng nhập.",
      my: "Lịch hẹn của tôi", out: "Đăng xuất", none: "Chưa có lịch hẹn.", hi: n => n, vo: "Phiếu đặt lịch", fail: "Không thể đăng nhập. Vui lòng thử lại sau.",
      terms: "Chúng tôi lưu tên và email (nếu có) để quản lý lịch hẹn và trò chuyện.", close: "Đóng" } };
  const t = k => T[L()][k];
  const PROVIDERS = [
    { id: "kakao", cls: "kakao", n: { ko: "카카오로 시작하기", en: "Continue with Kakao", vi: "Tiếp tục với Kakao" }, mark: "K" },
    { id: "custom:naver", cls: "naver", n: { ko: "네이버로 시작하기", en: "Continue with Naver", vi: "Tiếp tục với Naver" }, mark: "N" },
    { id: "google", cls: "google", n: { ko: "구글로 시작하기", en: "Continue with Google", vi: "Tiếp tục với Google" }, mark: "G" },
    { id: "facebook", cls: "facebook", n: { ko: "페이스북으로 시작하기", en: "Continue with Facebook", vi: "Tiếp tục với Facebook" }, mark: "f" }];

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
      <div class="acct-provs">${PROVIDERS.map(p => `<button class="acct-p ${p.cls}" data-p="${p.id}">${p.n[L()]}</button>`).join("")}</div>
      <p class="acct-skip">${t("skip")}</p><p class="acct-terms">${t("terms")}</p>`);
    s.querySelectorAll("[data-p]").forEach(b => b.onclick = () => { b.disabled = true; login(b.dataset.p); });
  }
  async function openMine() {
    const s = openSheet(`<h2>${esc(t("hi")(name()))}</h2><p class="acct-desc">${esc(user.email || "")}</p><h3>${t("my")}</h3><div class="acct-list"><p class="acct-desc">…</p></div>
      <button class="btn acct-out">${t("out")}</button>`);
    s.querySelector(".acct-out").onclick = logout;
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

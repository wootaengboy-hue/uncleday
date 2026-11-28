/* 🔗 관리자 바로가기 바 (admin-quick.js) — 관리자로 로그인했을 때만, 화면 왼쪽 아래에 계속 따라다녀요
 *  · 목록은 '엉클데이 자료실'(ud_library)에서 '바로가기 바에 띄우기'를 켠 링크 (universe60.sql)
 *  · 관리자 화면에서는 sb(로그인된 연결), 손님 사이트에서는 저장된 로그인 표로 직접 읽어요
 *  · 관리자가 아니면 서버가 빈 목록을 돌려줘서 아무것도 안 보여요
 */
(function () {
  if (window.UDL_BAR) return; window.UDL_BAR = true;
  const URL0 = (typeof SUPA !== "undefined" && SUPA.url) || "", KEY = (typeof SUPA !== "undefined" && SUPA.key) || "";
  const isAdminPage = typeof sb !== "undefined" && !!sb && !!document.getElementById("tab-dash");
  const e = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const lsGet = k => { try { return localStorage.getItem(k); } catch (x) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (x) {} };
  function token() {
    try { const ref = new URL(URL0).hostname.split(".")[0]; const raw = lsGet(`sb-${ref}-auth-token`); if (!raw) return ""; const j = JSON.parse(raw);
      if (j.expires_at && j.expires_at * 1000 < Date.now()) return ""; return j.access_token || ""; } catch (x) { return ""; }
  }
  async function api(method, q, body) {
    if (isAdminPage) {   // 관리자 화면: 로그인된 연결 그대로
      let r; const t = sb.from("ud_library");
      if (method === "GET") r = await t.select("id,title,url,icon,sort").eq("on_bar", true).eq("kind", "link").order("sort").order("created_at");
      else if (method === "POST") r = await t.insert(body);
      else if (method === "PATCH") r = await t.update(body).eq("id", q);
      if (r.error) throw r.error; return r.data;
    }
    const tk = token(); if (!tk) return null;
    const u = method === "GET" ? `${URL0}/rest/v1/ud_library?select=id,title,url,icon,sort&on_bar=eq.true&kind=eq.link&order=sort,created_at` : `${URL0}/rest/v1/ud_library${method === "PATCH" ? `?id=eq.${q}` : ""}`;
    const r = await fetch(u, { method, headers: { apikey: KEY, Authorization: "Bearer " + tk, "Content-Type": "application/json", Prefer: "return=minimal" }, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) throw new Error(await r.text()); return method === "GET" ? r.json() : null;
  }
  let LINKS = [], OPEN = lsGet("udl-open") !== "0", box = null;
  const css = `.udl{position:fixed;left:12px;bottom:12px;z-index:9000;display:flex;align-items:flex-end;gap:6px;max-width:calc(100vw - 96px);font:13px/1.3 system-ui,-apple-system,"Noto Sans KR",sans-serif}
    .udl-t{flex:none;border:0;border-radius:999px;background:#0e2843;color:#fff;font-weight:800;padding:9px 13px;box-shadow:0 6px 18px #0003;cursor:pointer;font:inherit;font-weight:800}
    .udl-l{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px;border-radius:999px}.udl-l::-webkit-scrollbar{display:none}
    .udl-l a,.udl-l button{flex:none;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;border:1px solid #d7dee8;background:#fff;color:#0e2843;text-decoration:none;border-radius:999px;padding:7px 11px;font:inherit;font-weight:700;box-shadow:0 3px 10px #0e28431f;cursor:pointer}
    .udl-l a:hover{border-color:#0e2843}.udl-l .udl-ed{color:#64748b;font-weight:600}
    .udl.off .udl-l{display:none}
    .udl-m{position:fixed;inset:0;z-index:9001;background:#0007;display:flex;align-items:center;justify-content:center;padding:16px}
    .udl-m>div{background:#fff;border-radius:16px;padding:18px;width:min(560px,100%);max-height:calc(100vh - 32px);overflow:auto;font:14px/1.4 system-ui,"Noto Sans KR",sans-serif;color:#0f172a}
    .udl-m h3{margin:0 0 4px;font-size:17px}.udl-m p{margin:0 0 12px;color:#64748b;font-size:12.5px}
    .udl-r{display:grid;grid-template-columns:44px 1fr 28px 28px 28px;gap:6px;align-items:center;margin-bottom:6px}.udl-r input{width:100%;box-sizing:border-box;padding:7px 8px;border:1px solid #d7dee8;border-radius:8px;font:inherit;font-size:13px}
    .udl-r .udl-u{grid-column:2/3}.udl-r button{border:1px solid #d7dee8;background:#fff;border-radius:8px;height:30px;cursor:pointer}
    .udl-b{display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap}.udl-b button{border:1px solid #d7dee8;background:#fff;border-radius:10px;padding:8px 14px;font:inherit;font-weight:700;cursor:pointer}.udl-b .p{background:#0e2843;color:#fff;border-color:#0e2843}
    @media (max-width:640px){.udl{left:8px;bottom:8px;max-width:calc(100vw - 84px)}.udl-t{padding:8px 11px}}
    @media print{.udl{display:none}}`;
  function draw() {
    if (!box) { const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st); box = document.createElement("div"); box.className = "udl"; document.body.appendChild(box); }
    box.classList.toggle("off", !OPEN);
    box.innerHTML = `<button type="button" class="udl-t" title="관리자 바로가기 (관리자에게만 보여요)">🔗${OPEN ? "" : ` 바로가기 ${LINKS.length || ""}`}</button>
      <div class="udl-l">${LINKS.map(l => `<a href="${e(l.url)}" target="_blank" rel="noopener" title="${e(l.url)}">${e(l.icon || "🔗")} ${e(l.title)}</a>`).join("")}<button type="button" class="udl-ed" title="바로가기 고치기">✏️${LINKS.length ? "" : " 바로가기 추가"}</button></div>`;
    box.querySelector(".udl-t").onclick = () => { OPEN = !OPEN; lsSet("udl-open", OPEN ? "1" : "0"); draw(); };
    box.querySelector(".udl-ed").onclick = edit;
  }
  function edit() {
    const rows = LINKS.map(l => ({ ...l })); const m = document.createElement("div"); m.className = "udl-m";
    const paint = () => { m.innerHTML = `<div><h3>🔗 관리자 바로가기</h3><p>관리자로 로그인했을 때만 화면 아래에 보여요. 네이버 블로그 · 카톡 상담함 · 자주 여는 링크를 넣어 두세요. 전체 자료는 포털 → 📁 엉클데이 자료실에 있어요.</p>
      ${rows.map((r, i) => r.del ? "" : `<div class="udl-r" data-i="${i}"><input data-f="icon" value="${e(r.icon || "")}" placeholder="🔗" maxlength="4"><input data-f="title" value="${e(r.title || "")}" placeholder="이름 (예: 네이버 블로그)" maxlength="40">
        <button data-up="${i}" title="앞으로">↑</button><button data-dn="${i}" title="뒤로">↓</button><button data-x="${i}" title="바에서 빼기">✕</button>
        <input class="udl-u" data-f="url" value="${e(r.url || "")}" placeholder="https://…"></div>`).join("")}
      <button type="button" data-add style="border:1px dashed #94a3b8;background:#f8fafc;border-radius:10px;padding:8px 12px;cursor:pointer;font:inherit">＋ 링크 추가</button>
      <div class="udl-b"><button data-no>취소</button><button class="p" data-ok>저장</button></div></div>`;
      m.querySelectorAll("[data-f]").forEach(inp => inp.oninput = () => { rows[+inp.closest("[data-i]").dataset.i][inp.dataset.f] = inp.value; });
      m.querySelectorAll("[data-up],[data-dn]").forEach(b => b.onclick = () => { const i = +(b.dataset.up ?? b.dataset.dn), j = b.dataset.up != null ? i - 1 : i + 1; if (j < 0 || j >= rows.length) return; [rows[i], rows[j]] = [rows[j], rows[i]]; paint(); });
      m.querySelectorAll("[data-x]").forEach(b => b.onclick = () => { rows[+b.dataset.x].del = true; paint(); });
      m.querySelector("[data-add]").onclick = () => { rows.push({ icon: "🔗", title: "", url: "https://" }); paint(); const ins = m.querySelectorAll('[data-f="title"]'); ins[ins.length - 1].focus(); };
      m.querySelector("[data-no]").onclick = () => m.remove();
      m.querySelector("[data-ok]").onclick = async () => {
        const keep = rows.filter(r => !r.del && (r.title || "").trim() && /^https?:\/\/\S+\.\S+/.test((r.url || "").trim()));
        const bad = rows.filter(r => !r.del && ((r.title || "").trim() || (r.url || "").replace(/^https?:\/\/$/, "").trim()) && !keep.includes(r));
        if (bad.length) { alertBox("이름과 https:// 로 시작하는 주소를 함께 적어 주세요"); return; }
        try {
          for (const r of rows.filter(r => r.del && r.id)) await api("PATCH", r.id, { on_bar: false });
          let n = 0; for (const r of keep) { n++; const body = { title: r.title.trim(), url: r.url.trim(), icon: (r.icon || "").trim() || null, sort: n, on_bar: true };
            if (r.id) await api("PATCH", r.id, body); else await api("POST", null, { ...body, kind: "link", cat: "ref" }); }
          m.remove(); await load(true);
        } catch (x) { alertBox("저장하지 못했어요: " + (x.message || x)); }
      };
    };
    const alertBox = t => { let p = m.querySelector(".udl-err"); if (!p) { p = document.createElement("p"); p.className = "udl-err"; p.style.color = "#b91c1c"; m.querySelector(".udl-b").before(p); } p.textContent = t; };
    paint(); document.body.appendChild(m); m.onclick = ev => { if (ev.target === m) m.remove(); };
  }
  async function load(force) {
    try { const d = await api("GET"); if (d == null) return; LINKS = d; if (LINKS.length || isAdminPage || force) draw(); }
    catch (x) { if (isAdminPage && !/ud_library|PGRST205|42P01/.test(String(x.message || x.code))) console.warn("바로가기", x); }
  }
  window.udlReload = () => load(true);
  if (isAdminPage) { const go = () => (typeof ME !== "undefined" && ME && ME.email) ? load() : setTimeout(go, 800); go(); } else load();
})();

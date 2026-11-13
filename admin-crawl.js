/* 🔗 링크로 가게 가져오기 — 포털 안 (#ptCrawl)
 * 링크를 넣으면 → 깃허브 자동 작업(매시간)이 사실 정보(이름 · 주소 · 영업시간 · 메뉴 가격)를 뽑아 와요 → 여기서 확인 · 수정 → [게시]
 * 게시하면 다음 자동 갱신(1시간 안) 때 미입점 가게 페이지(p/<도시>/<이름>-u<번호>/)로 사이트에 나와요.
 * 서버: supabase/universe21.sql · 수집기: tools/crawl.py
 */
const CRL = { jobs: null, cfg: null, err: "", open: null, token: "" };
const CRL_KIND = ["마사지", "스파 · 사우나", "네일 · 뷰티", "피부 · 클리닉", "뷰티"];
const CRL_ST = { pending: ["⏳ 가져오는 중", "1시간 안에 가져와요"], done: ["✅ 확인 필요", "내용을 확인하고 게시해 주세요"], error: ["⚠️ 실패", ""], published: ["🌐 게시됨", ""], rejected: ["✖️ 버림", ""] };
const crlSlug = t => (String(t || "").toLowerCase().replace(/đ/g, "d").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 50).replace(/-$/, "")) || "shop";
const crlDup = nm => { const k = String(nm || "").toLowerCase().replace(/đ/g, "d").normalize("NFD").replace(/[^a-z0-9]/g, ""); if (k.length < 4) return null;
  return (typeof shops !== "undefined" ? shops : []).find(s => [s.name.en, s.name.vi, s.name.ko, s.id].some(v => { const t = String(v || "").toLowerCase().replace(/đ/g, "d").normalize("NFD").replace(/[^a-z0-9]/g, ""); return t.length >= 4 && (t.includes(k) || k.includes(t)); })) || null; };
const crlPage = j => `/p/${j.city}/${crlSlug((j.data || {}).name)}-u${j.id}/`;

async function crawlLoad() {
  const [a, b] = await Promise.all([sb.from("crawl_jobs").select("*").order("created_at", { ascending: false }).limit(200), sb.from("crawl_cfg").select("made_at,made_by").eq("id", 1)]);
  if (a.error) { CRL.err = /crawl_jobs|42P01|PGRST20/.test((a.error.message || "") + (a.error.code || "")) ? "setup" : a.error.message; CRL.jobs = []; }
  else { CRL.err = ""; CRL.jobs = a.data || []; CRL.cfg = (b.data || [])[0] || null; }
  crawlDraw();
}
function crawlDraw() {
  const el = document.getElementById("ptCrawl"); if (!el) return;
  if (!CRL.jobs) { el.innerHTML = `<p class="hint">불러오는 중…</p>`; crawlLoad(); return; }
  if (CRL.err === "setup") { el.innerHTML = `<div class="uni-err">링크 가져오기를 쓰려면 Supabase SQL 편집기에서 <b>supabase/universe21.sql</b> 을 한 번 실행해 주세요.</div>`; return; }
  if (CRL.err) { el.innerHTML = `<div class="uni-err">${esc(CRL.err)}</div>`; return; }
  const cs = typeof CITIES !== "undefined" ? CITIES : [];
  const cn = id => ((cs.find(c => c.id === id) || {}).name || {}).ko || id || "";
  const keyBox = CRL.token ? `<div class="crl-key"><b>🔑 수집 열쇠 (지금 한 번만 보여요)</b><code>${esc(CRL.token)}</code><button class="btn sm" data-ccopy>복사</button>
      <ol><li>깃허브 저장소 → <b>Settings → Secrets and variables → Actions</b></li><li><b>New repository secret</b> → Name: <code>CRAWL_TOKEN</code> → Secret: 위 열쇠 붙여넣기 → Add secret</li><li>끝! 매시간 자동으로 링크를 가져와요. 이 열쇠는 채팅 · 메일로 보내지 마세요.</li></ol></div>`
    : CRL.cfg ? `<p class="hint">🔑 수집 열쇠: ${dt(CRL.cfg.made_at)} ${esc(CRL.cfg.made_by || "")} 가 만듦 · 깃허브 Secrets 의 CRAWL_TOKEN 으로 쓰여요 <button class="btn sm" data-cnewkey>다시 만들기</button></p>`
    : `<div class="crl-key"><b>처음 한 번: 수집 열쇠 만들기</b><p class="hint">깃허브 자동 작업이 이 목록을 읽고 결과를 넣을 때 쓰는 열쇠예요.</p><button class="btn sm main" data-cnewkey>🔑 수집 열쇠 만들기</button></div>`;
  const J = CRL.jobs;
  el.innerHTML = `${keyBox}
    <div class="crl-add"><input id="crlUrl" placeholder="가게 홈페이지 · 가격표 · 블로그 링크 (https://…)"><select id="crlCity">${cs.map(c => `<option value="${c.id}">${esc(c.name.ko)}</option>`).join("")}</select><select id="crlKind">${CRL_KIND.map(k => `<option>${k}</option>`).join("")}</select><button class="btn sm main" data-cadd>가져오기</button></div>
    <p class="hint">사실 정보(이름 · 주소 · 영업시간 · 메뉴 가격)만 가져와요. 글 · 사진은 안 가져와요. robots.txt 가 막은 곳과 구글 지도 · 페이스북 · 인스타그램 · 네이버 카페 · 트립어드바이저 · 클룩 등은 약관상 가져오지 않아요.</p>
    <div class="crl-list">${J.length ? J.map(j => {
      const st = CRL_ST[j.status] || [j.status, ""], d = j.data || {}, open = CRL.open === j.id, m = d.menu || [];
      return `<div class="crl-job ${j.status} ${open ? "open" : ""}"><button class="crl-h" data-copen="${j.id}"><span class="st">${st[0]}</span><b>${esc(d.name || j.url)}</b><small>${esc(cn(j.city))} · ${esc(j.kind || "")}${m.length ? ` · 메뉴 ${m.length}개` : ""} · ${dt(j.created_at)}</small></button>
        ${j.status === "error" ? `<p class="crl-err">${esc(j.err || "")}</p>` : ""}
        ${open ? `<div class="crl-body" data-cjob="${j.id}">
          <p class="hint"><a href="${esc(j.url)}" target="_blank" rel="noopener">${esc(j.url)}</a>${j.status === "published" ? ` · 사이트 페이지: <a href="${crlPage(j)}" target="_blank" rel="noopener">${crlPage(j)}</a> (게시 후 1시간 안에 생겨요)` : ""}</p>
          ${j.status === "pending" ? `<p class="hint">${st[1]}</p>` : `
          ${(() => { const dup = crlDup(d.name); const g = (j.result || {}).city_guess; return (dup ? `<p class="crl-err">⚠️ 이미 엉클데이 업체예요: <b>${esc(dup.name.ko || dup.id)}</b> (${esc(cn(dup.city))}) — 게시해도 중복이라 페이지가 만들어지지 않아요. 버리기를 권해요.</p>` : "") + (g && g !== j.city ? `<p class="crl-err">📍 주소를 보면 <b>${esc(cn(g))}</b> 가게 같아요. 아래에서 지역을 확인해 주세요.</p>` : ""); })()}
          <div class="crl-two"><label>지역<select data-cj="city">${cs.map(c => `<option value="${c.id}" ${c.id === j.city ? "selected" : ""}>${esc(c.name.ko)}</option>`).join("")}</select></label><label>종류<select data-cj="kind">${CRL_KIND.map(k => `<option ${k === j.kind ? "selected" : ""}>${k}</option>`).join("")}</select></label></div>
          <label>가게 이름<input data-cf="name" value="${esc(d.name || "")}"></label>
          <label>주소<input data-cf="address" value="${esc(d.address || "")}"></label>
          <label>영업시간<input data-cf="hours" value="${esc(d.hours || "")}" placeholder="예: 09:00-23:00"></label>
          <div class="crl-menu"><b>메뉴 · 가격</b>${m.map((x, i) => `<div class="crl-m" data-ci="${i}"><input data-mf="name" value="${esc(x.name)}"><input data-mf="min" inputmode="numeric" value="${x.min || ""}" placeholder="분"><input data-mf="price" inputmode="numeric" value="${x.price || ""}"><button class="btn sm" data-cmdel="${i}" title="빼기">✕</button></div>`).join("") || `<p class="hint">찾은 메뉴가 없어요</p>`}</div>
          <div class="crl-act">${j.status !== "published" ? `<button class="btn sm main" data-cpub="${j.id}">🌐 게시</button>` : `<button class="btn sm main" data-csave="${j.id}">고친 내용 저장</button><button class="btn sm" data-cunpub="${j.id}">게시 내리기</button>`}${j.status !== "published" ? `<button class="btn sm" data-csave="${j.id}">저장만</button>` : ""}`}
          ${j.status !== "pending" ? `<button class="btn sm" data-cretry="${j.id}">↻ 다시 가져오기</button>` : ""}${j.status !== "rejected" && j.status !== "published" ? `<button class="btn sm" data-crej="${j.id}">버리기</button>` : ""}<button class="btn sm danger" data-cdel="${j.id}">🗑️</button>${j.status === "pending" ? "" : "</div>"}
        </div>` : ""}</div>`;
    }).join("") : `<p class="hint">아직 넣은 링크가 없어요.</p>`}</div>`;

  const up = async (id, patch, msg) => { const r = await sb.from("crawl_jobs").update(patch).eq("id", id).select().single(); if (r.error) { alert(r.error.message); return false; } CRL.jobs[CRL.jobs.findIndex(x => x.id === id)] = r.data; if (msg) toast(msg, 3500); crawlDraw(); return true; };
  const collect = id => {
    const box = el.querySelector(`[data-cjob="${id}"]`), j = CRL.jobs.find(x => x.id === id), d = { ...(j.data || {}) };
    box.querySelectorAll("[data-cf]").forEach(i => d[i.dataset.cf] = i.value.trim());
    d.menu = [...box.querySelectorAll(".crl-m")].map(r => ({ name: r.querySelector('[data-mf="name"]').value.trim(), min: +r.querySelector('[data-mf="min"]').value || 0, price: +String(r.querySelector('[data-mf="price"]').value).replace(/\D/g, "") || 0 })).filter(x => x.name && x.price > 0);
    return d;
  };
  el.querySelectorAll("[data-copen]").forEach(b => b.onclick = () => { const id = +b.dataset.copen; CRL.open = CRL.open === id ? null : id; crawlDraw(); });
  el.querySelectorAll("[data-ccopy]").forEach(b => b.onclick = () => portalCopy(CRL.token));
  el.querySelectorAll("[data-cnewkey]").forEach(b => b.onclick = async () => {
    if (CRL.cfg && !confirm("열쇠를 새로 만들면 깃허브에 넣어 둔 예전 열쇠는 더 이상 안 돼요. 새 열쇠로 바꿔 넣어야 해요. 계속할까요?")) return;
    const r = await sb.rpc("crawl_new_token"); if (r.error) { alert(r.error.message); return; } CRL.token = r.data; crawlLoad(); });
  el.querySelectorAll("[data-cadd]").forEach(b => b.onclick = async () => {
    const url = document.getElementById("crlUrl").value.trim(); if (!/^https?:\/\/\S+$/i.test(url)) { toast("http:// 또는 https:// 로 시작하는 링크를 넣어 주세요"); return; }
    if (CRL.jobs.some(x => x.url === url && x.status !== "rejected")) { toast("이미 넣은 링크예요"); return; }
    b.disabled = true; const r = await sb.from("crawl_jobs").insert({ url, city: document.getElementById("crlCity").value, kind: document.getElementById("crlKind").value }).select().single(); b.disabled = false;
    if (r.error) { alert(r.error.message); return; } CRL.jobs.unshift(r.data); toast("⏳ 넣었어요. 1시간 안에 가져와요", 3500); crawlDraw();
  });
  el.querySelectorAll("[data-cmdel]").forEach(b => b.onclick = () => b.closest(".crl-m").remove());
  const ck = id => { const box = el.querySelector(`[data-cjob="${id}"]`); return { city: box.querySelector('[data-cj="city"]').value, kind: box.querySelector('[data-cj="kind"]').value }; };
  el.querySelectorAll("[data-csave]").forEach(b => b.onclick = () => up(+b.dataset.csave, { data: collect(+b.dataset.csave), ...ck(+b.dataset.csave) }, "저장했어요"));
  el.querySelectorAll("[data-cpub]").forEach(b => b.onclick = () => { const id = +b.dataset.cpub, d = collect(id); if (!d.name) { toast("가게 이름을 넣어 주세요"); return; } if (crlDup(d.name) && !confirm("이미 엉클데이 업체와 이름이 같아요. 그래도 게시할까요? (중복이면 페이지가 안 만들어져요)")) return; up(id, { data: d, status: "published", ...ck(id) }, "🌐 게시했어요. 1시간 안에 사이트 페이지가 생겨요"); });
  el.querySelectorAll("[data-cunpub]").forEach(b => b.onclick = () => up(+b.dataset.cunpub, { status: "done" }, "게시를 내렸어요. 1시간 안에 페이지가 사라져요"));
  el.querySelectorAll("[data-cretry]").forEach(b => b.onclick = () => up(+b.dataset.cretry, { status: "pending", err: null }, "⏳ 1시간 안에 다시 가져와요"));
  el.querySelectorAll("[data-crej]").forEach(b => b.onclick = () => up(+b.dataset.crej, { status: "rejected" }, "버렸어요"));
  el.querySelectorAll("[data-cdel]").forEach(b => b.onclick = async () => { if (!confirm("이 링크를 목록에서 지울까요?")) return; const r = await sb.from("crawl_jobs").delete().eq("id", +b.dataset.cdel); if (r.error) { alert(r.error.message); return; } CRL.jobs = CRL.jobs.filter(x => x.id !== +b.dataset.cdel); crawlDraw(); });
}

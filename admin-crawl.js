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
  if (typeof compDraw === "function") compDraw();
  if (CRL.err === "setup") { el.innerHTML = `<div class="uni-err">링크 가져오기를 쓰려면 Supabase SQL 편집기에서 <b>supabase/universe21.sql</b> 을 한 번 실행해 주세요.</div>`; return; }
  if (CRL.err) { el.innerHTML = `<div class="uni-err">${esc(CRL.err)}</div>`; return; }
  const cs = typeof CITIES !== "undefined" ? CITIES : [];
  const cn = id => ((cs.find(c => c.id === id) || {}).name || {}).ko || id || "";
  const keyBox = CRL.token ? `<div class="crl-key"><b>🔑 수집 열쇠 (지금 한 번만 보여요)</b><code>${esc(CRL.token)}</code><button class="btn sm" data-ccopy>복사</button>
      <ol><li>깃허브 저장소 → <b>Settings → Secrets and variables → Actions</b></li><li><b>New repository secret</b> → Name: <code>CRAWL_TOKEN</code> → Secret: 위 열쇠 붙여넣기 → Add secret</li><li>끝! 매시간 자동으로 링크를 가져와요. 이 열쇠는 채팅 · 메일로 보내지 마세요.</li></ol></div>`
    : CRL.cfg ? `<p class="hint">🔑 수집 열쇠: ${dt(CRL.cfg.made_at)} ${esc(CRL.cfg.made_by || "")} 가 만듦 · 깃허브 Secrets 의 CRAWL_TOKEN 으로 쓰여요 <button class="btn sm" data-cnewkey>다시 만들기</button></p>`
    : `<div class="crl-key"><b>처음 한 번: 수집 열쇠 만들기</b><p class="hint">깃허브 자동 작업이 이 목록을 읽고 결과를 넣을 때 쓰는 열쇠예요.</p><button class="btn sm main" data-cnewkey>🔑 수집 열쇠 만들기</button></div>`;
  const J = CRL.jobs.filter(j => (j.job || "shop") === "shop");
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

/* 🔍 경쟁사 분석 — 포털 안 (#ptComp) · universe22.sql (crawl_jobs.job = 'site')
 * 경쟁 사이트의 글 목록 · 제목 · 소제목만 읽어서 ① 노리는 검색어 ② 엉클데이에 그 검색어 페이지가 있는지 ③ 글에 나온 가게가 엉클데이에 있는지 */
const CMP = { open: null, tab: "gap" };
// 이 검색어로 만든 우리 블로그 글 (검색어가 같거나 🔄 바꾼 주제가 같거나, 이 경쟁사 글 하나에서만 나온 검색어로 만든 글)
const cmpNorm = s => String(s || "").replace(/\s+/g, "").toLowerCase();
function cmpBlogOf(k, gap) {
  const P = (typeof BLG !== "undefined" && BLG.posts) || []; if (!P.length) return null;
  const ks = [k.kw, ...(typeof blgReframes === "function" && typeof BLG_OUT !== "undefined" && BLG_OUT.test(k.kw) ? blgReframes(k.kw).map(o => o.kw) : [])].filter(Boolean).map(cmpNorm);
  const solo = k.url && gap.filter(x => x.url === k.url).length === 1;
  const hit = P.filter(p => ks.includes(cmpNorm(p.kw)) || (solo && p.from_url && p.from_url === k.url));
  return hit.find(p => p.status === "published") || hit[0] || null;
}
function compDraw() {
  const el = document.getElementById("ptComp"); if (!el || !CRL.jobs) return;
  if (CRL.err === "setup") { el.innerHTML = `<div class="uni-err">경쟁사 분석을 쓰려면 <b>supabase/universe21.sql</b> · <b>universe22.sql</b> 을 차례로 실행해 주세요.</div>`; return; }
  const J = CRL.jobs.filter(j => j.job === "site");
  const ST = { pending: "⏳ 분석 중 (1시간 안)", done: "✅ 분석 완료", error: "⚠️ 실패", rejected: "보관" };
  const chip = st => st === "partner" ? `<span class="uni-chip ok">✅ 입점</span>` : st === "unclaimed" ? `<span class="uni-chip">🗺️ 미입점 페이지 있음</span>` : `<span class="uni-chip warn">➕ 엉클데이에 없음</span>`;
  el.innerHTML = `<div class="crl-add"><input id="cmpUrl" placeholder="경쟁 사이트 주소 (예: https://xinchaodanang43.com/)"><button class="btn sm main" data-cmpadd>분석하기</button></div>
    <p class="hint">글 목록(사이트맵) · 글 제목 · 소제목만 읽어요. 글 내용은 저장 · 복사하지 않아요. 빠진 검색어는 <b>우리 업체 데이터로</b> 페이지를 만들 때 써요.</p>
    <div class="crl-list">${J.length ? J.map(j => {
      const r = j.result || {}, K = r.keywords || [], S = r.shops || [], gap0 = K.filter(k => !k.ours), bp = k => cmpBlogOf(k, gap0), gap = gap0.filter(k => !(bp(k) && bp(k).status === "published")), have = K.filter(k => k.ours).concat(gap0.filter(k => bp(k) && bp(k).status === "published").map(k => ({ ...k, ours: `/blog/${blgSlug(bp(k))}/`, ours_title: "📝 우리 블로그: " + (bp(k).title || bp(k).kw) }))), open = CMP.open === j.id;
      return `<div class="crl-job ${j.status} ${open ? "open" : ""}"><button class="crl-h" data-cmpopen="${j.id}"><span class="st">${ST[j.status] || j.status}</span><b>${esc(r.name || j.url)}</b><small>${j.status === "done" ? `글 ${r.posts || 0}개 · 빠진 검색어 <b>${gap.length}</b> · 있는 검색어 ${have.length} · 언급된 가게 ${S.length}곳 (엉클데이에 없음 ${S.filter(x => x.status === "none").length})` : ""} · ${dt(j.created_at)}</small></button>
        ${j.status === "error" ? `<p class="crl-err">${esc(j.err || "")}</p>` : ""}
        ${open && j.status === "done" ? `<div class="crl-body">
          <div class="br-cats">${[["gap", `➕ 빠진 검색어 ${gap.length}`], ["have", `✅ 있는 검색어 ${have.length}`], ["shops", `🏪 언급된 가게 ${S.length}`]].map(([k, l]) => `<button class="${CMP.tab === k ? "on" : ""}" data-cmptab="${k}">${l}</button>`).join("")}</div>
          ${CMP.tab === "gap" ? (gap.length ? `<p class="hint">경쟁사는 노리는데 엉클데이에는 맞는 페이지가 없는 검색어예요. 여기 있는 말로 우리 데이터 페이지를 만들면 돼요.</p><div class="cmp-t">${gap.map(k => `<div><b>${esc(k.kw)}</b><small>글 ${k.n}개 · <a href="${esc(k.url)}" target="_blank" rel="noopener nofollow">경쟁사 글 ↗</a></small><button class="btn sm" data-cmpcopy="${esc(k.kw)}">복사</button>${bp(k) ? `<span class="uni-chip warn" title="아래 '📝 블로그'에서 게시하면 이 목록에서 빠져요">📝 초안 있음 · 게시 전</span>` : typeof BLG_OUT !== "undefined" && BLG_OUT.test(k.kw) ? blgFixHtml(blgReframes(k.kw), `data-cmpfix="${esc(k.kw)}" data-u="${esc(k.url)}"`) : `<button class="btn sm main" data-cmpblog="${esc(k.kw)}" data-u="${esc(k.url)}">📝 블로그 글 만들기</button>`}</div>`).join("")}</div><button class="btn sm" data-cmpcopyall="${j.id}">📋 빠진 검색어 전부 복사</button>` : `<p class="hint">🎉 빠진 검색어가 없어요.</p>`)
          : CMP.tab === "have" ? `<div class="cmp-t">${have.map(k => `<div><b>${esc(k.kw)}</b><small>→ <a href="${esc(k.ours)}" target="_blank" rel="noopener">${esc(k.ours_title || k.ours)}</a></small></div>`).join("") || `<p class="hint">없어요.</p>`}</div>`
          : `<p class="hint">경쟁사가 글에서 소개한 가게 = 한국인 손님이 많이 가는 가게일 가능성이 커요. '엉클데이에 없음'은 영업 1순위예요.</p><div class="cmp-t">${S.map((x, i) => `<div><b>${esc(x.name)}</b><small>${chip(x.status)} 글 ${x.n}개 · <a href="${esc(x.url)}" target="_blank" rel="noopener nofollow">경쟁사 글 ↗</a>${x.ours ? ` · <a href="${esc(x.ours)}" target="_blank" rel="noopener">우리 페이지</a>` : ""}</small>${x.status !== "partner" ? `<button class="btn sm" data-cmplead="${j.id}:${i}">🤝 영업 카드로</button>` : ""}</div>`).join("") || `<p class="hint">찾은 가게가 없어요.</p>`}</div>`}
        </div>` : ""}
        ${open ? `<div class="crl-act" style="padding:0 14px 12px"><button class="btn sm" data-cmpretry="${j.id}">↻ 다시 분석</button><button class="btn sm danger" data-cmpdel="${j.id}">🗑️</button></div>` : ""}</div>`;
    }).join("") : `<p class="hint">아직 분석한 사이트가 없어요.</p>`}</div>`;
  const job = id => CRL.jobs.find(x => x.id === +id);
  el.querySelectorAll("[data-cmpopen]").forEach(b => b.onclick = () => { const id = +b.dataset.cmpopen; CMP.open = CMP.open === id ? null : id; compDraw(); });
  el.querySelectorAll("[data-cmptab]").forEach(b => b.onclick = () => { CMP.tab = b.dataset.cmptab; compDraw(); });
  el.querySelectorAll("[data-cmpcopy]").forEach(b => b.onclick = () => portalCopy(b.dataset.cmpcopy));
  el.querySelectorAll("[data-cmpfixall]").forEach(b => b.onclick = async () => { b.disabled = true; if (!(await blogBulk(blgReframes(b.dataset.cmpfixall), { fromUrl: b.dataset.u }))) b.disabled = false; });
  el.querySelectorAll("[data-cmpfix]").forEach(b => b.onclick = async () => { const L = blgReframes(b.dataset.cmpfix), o = L[+b.parentNode.querySelector("[data-fixsel]").value]; if (!o) return; b.disabled = true;
    if (await blogNewP(o, b.dataset.u)) toast("📝 '" + o.kw + "' 초안을 만들었어요. '📝 블로그'에서 확인 · 게시해 주세요", 4000); else b.disabled = false; });
  el.querySelectorAll("[data-cmpblog]").forEach(b => b.onclick = async () => { if (typeof blogNew !== "function") return; b.disabled = true; const r = await blogNew(b.dataset.cmpblog, b.dataset.u); if (r) { b.textContent = "✅ 초안 만듦"; toast("📝 블로그 초안을 만들었어요. '📝 블로그'에서 확인 · 게시해 주세요", 4000); } else b.disabled = false; });
  el.querySelectorAll("[data-cmpcopyall]").forEach(b => b.onclick = () => portalCopy(((job(b.dataset.cmpcopyall).result || {}).keywords || []).filter(k => !k.ours).map(k => k.kw).join("\n")));
  el.querySelectorAll("[data-cmpadd]").forEach(b => b.onclick = async () => {
    let url = document.getElementById("cmpUrl").value.trim(); if (!/^https?:\/\/\S+$/i.test(url)) { toast("http:// 또는 https:// 로 시작하는 주소를 넣어 주세요"); return; }
    b.disabled = true; const r = await sb.from("crawl_jobs").insert({ url, job: "site" }).select().single(); b.disabled = false;
    if (r.error) { alert(/job/.test(r.error.message) ? "universe22.sql 을 먼저 실행해 주세요" : r.error.message); return; } CRL.jobs.unshift(r.data); toast("⏳ 넣었어요. 1시간 안에 분석해요", 3500); compDraw();
  });
  el.querySelectorAll("[data-cmpretry]").forEach(b => b.onclick = async () => { const r = await sb.from("crawl_jobs").update({ status: "pending", err: null }).eq("id", +b.dataset.cmpretry).select().single(); if (r.error) { alert(r.error.message); return; } CRL.jobs[CRL.jobs.findIndex(x => x.id === r.data.id)] = r.data; toast("⏳ 1시간 안에 다시 분석해요"); compDraw(); });
  el.querySelectorAll("[data-cmpdel]").forEach(b => b.onclick = async () => { if (!confirm("이 분석을 지울까요?")) return; const r = await sb.from("crawl_jobs").delete().eq("id", +b.dataset.cmpdel); if (r.error) { alert(r.error.message); return; } CRL.jobs = CRL.jobs.filter(x => x.id !== +b.dataset.cmpdel); compDraw(); });
  el.querySelectorAll("[data-cmplead]").forEach(b => b.onclick = async () => {
    const [jid, i] = b.dataset.cmplead.split(":"), j = job(jid), x = ((j.result || {}).shops || [])[+i]; if (!x) return;
    b.disabled = true;
    const r = await sb.from("leads").insert({ name: x.name, stage: "found", assignee: (typeof ME !== "undefined" && ME && ME.email) || null, next_action: "가게 찾아서 첫 연락",
      memo: `<p>🔍 경쟁사 ${esc((j.result || {}).name || j.url)} 글 ${x.n}개에 소개된 가게</p><p><a href="${esc(x.url)}">${esc(x.url)}</a></p>` }).select().single();
    if (r.error) { b.disabled = false; alert(r.error.message); return; }
    b.textContent = "✅ 카드 만듦"; toast("🤝 낙서장 '영업'에 카드를 만들었어요");
  });
}

/* 🌐 다국어 번역 — 포털 안 (#ptI18n)
 * 손님 사이트의 일본어 · 중국어(간체/번체) · 러시아어 · 프랑스어 · 독일어 · 스페인어 · 힌디어 · 태국어 · 인도네시아어를
 * AI(Claude · Edge Function 'i18n-tr')로 번역해서 Supabase 'i18n_tr' 표에 저장해요 (SQL universe33).
 *  - 화면 문구(i18n.js) · 사이트 글(data.js: 지역 · 카테고리 · 배너 · 이용 방법 · FAQ) · 게시된 업체 내용
 *  - 원문이 바뀐 것만 다시 번역해요 (src_hash 비교) → 업체 정보를 고친 뒤 [빠진 번역 모두 만들기]만 누르면 돼요
 *  - 한국어 · 영어 · 베트남어는 직접 번역한 그대로 (여기서 안 건드려요)
 */
const I18N_ADM = { rows: null, err: "", busy: false, stop: false, log: [], done: 0, total: 0, src: null };
const I18N_TARGETS = () => (typeof LANGS !== "undefined" ? LANGS : []).map(l => l.id).filter(id => !["ko", "en", "vi"].includes(id));
const i18nHash = o => { const s = JSON.stringify(o); let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + "-" + s.length; };
// { ko, en, vi … } 처럼 언어별 글자 묶음인지
const i18nIsLoc = o => o && typeof o === "object" && !Array.isArray(o) && (typeof o.en === "string" || typeof o.ko === "string") &&
  Object.keys(o).every(k => /^[a-z]{2}(-[A-Z]{2})?$/.test(k) && (o[k] == null || typeof o[k] === "string"));
const I18N_SKIP = /^(id|address|addr|img|imgs|photos?|gplace|map|maps?|lat|lng|url|link|phone|zalo|kakao|email|contact|price|prices|sort|best|verified|published|cat|city|icon|members)$/;
function i18nWalk(o, path, out) {
  if (i18nIsLoc(o)) { if ((o.en || o.ko || "").trim()) out[path] = { en: o.en || "", ko: o.ko || "" }; return; }
  if (Array.isArray(o)) o.forEach((x, i) => i18nWalk(x, path ? path + "." + i : String(i), out));
  else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) { if (!I18N_SKIP.test(k)) i18nWalk(v, path ? path + "." + k : k, out); }
}
// 번역할 원문 모으기
async function i18nSources() {
  // 화면 문구: 손님 사이트의 i18n.js 를 그대로 읽어 와요
  const code = await (await fetch("i18n.js?t=" + Date.now(), { cache: "no-store" })).text();
  const U = new Function("LANGS", code + "\n;return UI;")(typeof LANGS !== "undefined" ? LANGS : []);
  const ui = {};
  for (const k of new Set([...Object.keys(U.en || {}), ...Object.keys(U.ko || {})])) {
    const en = U.en[k], ko = U.ko[k];
    if (Array.isArray(en || ko)) (en || ko).forEach((_, i) => ui[k + "." + i] = { en: (en || [])[i] || "", ko: (ko || [])[i] || "" });
    else if (typeof (en ?? ko) === "string" && !/^lang_/.test(k)) ui[k] = { en: en || "", ko: ko || "" };
  }
  // 사이트 글: data.js (관리자 화면에도 같은 파일이 들어와 있어요)
  const site = {};
  const roots = { SITE, CITIES, CATEGORY_DETAIL, CATEGORIES, BANNERS, PLACES, STEPS, FAQ };
  for (const [name, root] of Object.entries(roots)) if (root) i18nWalk(root, name, site);
  ["SITE.rates"].forEach(p => Object.keys(site).filter(k => k.startsWith(p)).forEach(k => delete site[k]));
  // 업체: 게시된 업체의 공개 정보만 (비공개 메모 · 계약 정보는 안 보내요)
  const r = await sb.from("shops").select("id,data,published").eq("published", true);
  if (r.error) throw r.error;
  const shops = {};
  (r.data || []).forEach(x => { const o = {}; i18nWalk(x.data || {}, "", o); if (Object.keys(o).length) shops[x.id] = o; });
  return { ui, site, shops };
}
async function i18nLoad() {
  const r = await sb.from("i18n_tr").select("key,lang,src_hash,updated_at");
  if (r.error) { I18N_ADM.err = /i18n_tr|42P01|PGRST20/.test((r.error.message || "") + (r.error.code || "")) ? "setup" : r.error.message; I18N_ADM.rows = []; }
  else { I18N_ADM.err = ""; I18N_ADM.rows = r.data || []; }
  if (!I18N_ADM.src) { try { I18N_ADM.src = await i18nSources(); } catch (e) { I18N_ADM.err = I18N_ADM.err || ("원문을 읽지 못했어요: " + e.message); } }
  i18nDraw();
}
// 해야 할 일 목록: [{ lang, key, items, hash, kind }]
function i18nJobs(onlyLang) {
  const S = I18N_ADM.src; if (!S) return [];
  const have = {}; (I18N_ADM.rows || []).forEach(r => have[r.key + "|" + r.lang] = r.src_hash);
  const jobs = [];
  for (const lang of I18N_TARGETS()) {
    if (onlyLang && lang !== onlyLang) continue;
    const add = (key, kind, items) => { const hash = i18nHash(items); if (have[key + "|" + lang] !== hash) jobs.push({ lang, key, kind, items, hash }); };
    add("ui", "ui", S.ui); add("site", "site", S.site);
    for (const [id, items] of Object.entries(S.shops)) add("shop:" + id, "shop", items);
  }
  return jobs;
}
function i18nStatus() {
  const S = I18N_ADM.src, have = {}; (I18N_ADM.rows || []).forEach(r => have[r.key + "|" + r.lang] = r.src_hash);
  return I18N_TARGETS().map(lang => {
    const st = (key, items) => !have[key + "|" + lang] ? "none" : have[key + "|" + lang] === i18nHash(items) ? "ok" : "old";
    const shopIds = S ? Object.keys(S.shops) : [];
    return { lang, ui: S ? st("ui", S.ui) : "?", site: S ? st("site", S.site) : "?",
      shopsOk: shopIds.filter(id => st("shop:" + id, S.shops[id]) === "ok").length, shops: shopIds.length };
  });
}
async function i18nCall(lang, kind, items) {
  const { data: { session } } = await sb.auth.getSession();
  const r = await fetch(`${SUPA.url}/functions/v1/i18n-tr`, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPA.key, Authorization: "Bearer " + (session ? session.access_token : SUPA.key) }, body: JSON.stringify({ lang, kind, items }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || ("번역 실패 " + r.status));
  return j;
}
// 한 묶음(ui · site · 업체 하나)을 100개씩 나눠 번역 → 다 되면 저장
async function i18nRunJob(job) {
  const keys = Object.keys(job.items), tr = {}; let model = "";
  for (let i = 0; i < keys.length; i += 60) {
    if (I18N_ADM.stop) throw new Error("멈춤");
    const part = {}; keys.slice(i, i + 60).forEach(k => part[k] = job.items[k]);
    const r = await i18nCall(job.lang, job.kind, part); Object.assign(tr, r.items || {}); model = r.model || model;
  }
  if (Object.keys(tr).length < keys.length * 0.9) throw new Error(`번역이 덜 왔어요 (${Object.keys(tr).length}/${keys.length})`);
  const w = await sb.from("i18n_tr").upsert({ key: job.key, lang: job.lang, tr, src_hash: job.hash, model, updated_at: new Date().toISOString() });
  if (w.error) throw w.error;
}
async function i18nRun(onlyLang) {
  if (I18N_ADM.busy) return;
  const jobs = i18nJobs(onlyLang); if (!jobs.length) { toast("빠진 번역이 없어요 ✅"); return; }
  Object.assign(I18N_ADM, { busy: true, stop: false, done: 0, total: jobs.length, log: [] }); i18nDraw();
  const q = jobs.slice(); let fails = 0;
  const worker = async () => { while (q.length && !I18N_ADM.stop) { const j = q.shift();
    try { await i18nRunJob(j); } catch (e) { fails++; I18N_ADM.log.unshift(`✖ ${j.lang} · ${j.key}: ${e.message}`); }
    I18N_ADM.done++; i18nDraw(); } };
  await Promise.all([worker(), worker(), worker(), worker()]);   // 4개씩 동시에
  I18N_ADM.busy = false; await i18nLoad();
  toast(I18N_ADM.stop ? "멈췄어요" : fails ? `끝났어요 · 실패 ${fails}개 (다시 누르면 실패한 것만 해요)` : "🌐 번역을 모두 만들었어요 ✅");
}
function i18nPending() { try { return I18N_ADM.src ? i18nJobs().length : 0; } catch (e) { return 0; } }
function i18nDraw() {
  const el = document.getElementById("ptI18n"); if (!el) return;
  if (!I18N_ADM.rows) { el.innerHTML = `<div class="uni-empty">불러오는 중…</div>`; i18nLoad(); return; }
  if (I18N_ADM.err === "setup") { el.innerHTML = `<div class="uni-err">다국어 번역을 쓰려면 Supabase SQL 편집기에서 <b>supabase/universe33.sql</b> 을 한 번 실행하고, Edge Function <b>i18n-tr</b> 을 만들어 주세요.</div>`; return; }
  const LN = Object.fromEntries((typeof LANGS !== "undefined" ? LANGS : []).map(l => [l.id, l]));
  const chip = s => s === "ok" ? `<span class="uni-chip ok">✓ 최신</span>` : s === "old" ? `<span class="uni-chip warn">바뀜</span>` : s === "none" ? `<span class="uni-chip">없음</span>` : "-";
  const S = I18N_ADM.src, jobs = S ? i18nJobs() : [];
  el.innerHTML = `${I18N_ADM.err ? `<div class="uni-err">${esc(I18N_ADM.err)}</div>` : ""}
    <p class="hint">한국어 · 영어 · 베트남어는 직접 번역한 그대로예요. 아래 10개 언어는 AI로 번역해서 손님 사이트 위쪽 🌐 언어 목록에 나와요. 번역이 없는 글은 영어로 보여요.<br>
      원문: 화면 문구 <b>${S ? Object.keys(S.ui).length : "?"}</b>개 · 사이트 글 <b>${S ? Object.keys(S.site).length : "?"}</b>개 · 게시된 업체 <b>${S ? Object.keys(S.shops).length : "?"}</b>곳 — 업체 정보를 고치면 그 업체만 '바뀜'이 돼요.</p>
    <div class="i18n-act">
      ${I18N_ADM.busy ? `<div class="i18n-prog"><b>번역 중… ${I18N_ADM.done} / ${I18N_ADM.total}</b><i><em style="width:${Math.round(I18N_ADM.done / Math.max(1, I18N_ADM.total) * 100)}%"></em></i></div><button class="btn sm" data-i18n="stop">멈추기</button>`
        : `<button class="btn main" data-i18n="all" ${jobs.length ? "" : "disabled"}>🌐 빠진 번역 모두 만들기 (${jobs.length}묶음)</button><button class="btn sm" data-i18n="reload">↻ 다시 확인</button>`}
    </div>
    <p class="hint">처음 한 번은 10개 언어 전부라 15~30분쯤 걸려요 (창을 열어 두세요). 비용은 Claude API 기준 대략 몇 달러 이하예요. 그다음부터는 바뀐 것만 해요.</p>
    <div class="i18n-tbl"><div class="th"><span>언어</span><span>화면 문구</span><span>사이트 글</span><span>업체</span><span></span></div>
      ${i18nStatus().map(s => `<div><span>${LN[s.lang] ? langFlag(LN[s.lang]) + " " + esc(LN[s.lang].label) : s.lang}</span><span>${chip(s.ui)}</span><span>${chip(s.site)}</span>
        <span><b>${s.shopsOk}</b> / ${s.shops}</span><span>${I18N_ADM.busy ? "" : `<button class="btn sm" data-i18nl="${s.lang}">이 언어만</button> <a class="btn sm" href="/?lang=${s.lang}" target="_blank" rel="noopener">보기 ↗</a>`}</span></div>`).join("")}</div>
    ${I18N_ADM.log.length ? `<details class="i18n-log" open><summary>실패 ${I18N_ADM.log.length}개</summary>${I18N_ADM.log.slice(0, 30).map(x => `<div>${esc(x)}</div>`).join("")}</details>` : ""}`;
  el.querySelectorAll('[data-i18n="all"]').forEach(b => b.onclick = () => i18nRun());
  el.querySelectorAll('[data-i18n="stop"]').forEach(b => b.onclick = () => { I18N_ADM.stop = true; toast("지금 하던 것까지만 하고 멈춰요"); });
  el.querySelectorAll('[data-i18n="reload"]').forEach(b => b.onclick = () => { I18N_ADM.rows = null; I18N_ADM.src = null; i18nDraw(); });
  el.querySelectorAll("[data-i18nl]").forEach(b => b.onclick = () => i18nRun(b.dataset.i18nl));
}

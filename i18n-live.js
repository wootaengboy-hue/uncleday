/* 🌐 다국어: 직접 번역하지 않은 언어(일본어 · 중국어 · 러시아어 · 프랑스어 …)의 번역을 받아와서 화면에 입혀요.
   - 번역은 관리자 → 포털 → 🌐 다국어 번역에서 AI(Claude)로 만들어 Supabase 'i18n_tr' 표에 저장해 둔 것 (SQL universe33)
   - key 'ui'    : 화면 문구 (i18n.js 의 UI 키 → 번역)
     key 'site'  : 지역 · 카테고리 · 배너 · 이용 방법 · 자주 묻는 질문 (data.js 의 { ko, en, vi } 글자들)
     key 'shop:<업체 id>' : 업체 이름 · 소개 · 메뉴 등
   - 번역이 없으면 영어로 보여요. 이 기기에 저장해 두고(빠르게), 새 번역이 오면 다시 그려요. */
const I18N = (() => {
  const core = typeof CORE_LANGS !== "undefined" ? CORE_LANGS : ["ko", "en", "vi"];
  const on = typeof SUPA !== "undefined" && SUPA.url && SUPA.key && typeof lang !== "undefined" && !core.includes(lang);
  const KEY = "ud-i18n-" + (typeof lang !== "undefined" ? lang : "");
  let rows = null;   // { key: { path: text } }

  // 경로("menu.2.name")로 { ko, en, vi } 글자 묶음을 찾아 이 언어 번역을 넣어요
  const put = (root, path, text) => {
    const ps = path.split("."); let o = root;
    for (const p of ps) { if (o == null) return; o = o[/^\d+$/.test(p) ? +p : p]; }
    if (o && typeof o === "object" && !Array.isArray(o) && typeof text === "string" && text) o[lang] = text;
  };
  const SITE_ROOTS = () => ({ SITE: typeof SITE !== "undefined" ? SITE : null, CITIES: typeof CITIES !== "undefined" ? CITIES : null,
    CATEGORY_DETAIL: typeof CATEGORY_DETAIL !== "undefined" ? CATEGORY_DETAIL : null, CATEGORIES: typeof CATEGORIES !== "undefined" ? CATEGORIES : null,
    BANNERS: typeof BANNERS !== "undefined" ? BANNERS : null, PLACES: typeof PLACES !== "undefined" ? PLACES : null,
    STEPS: typeof STEPS !== "undefined" ? STEPS : null, FAQ: typeof FAQ !== "undefined" ? FAQ : null });

  function apply() {
    if (!rows) return;
    // 화면 문구
    if (rows.ui && typeof UI !== "undefined") { UI[lang] = UI[lang] || {}; for (const [k, v] of Object.entries(rows.ui)) {
      if (/^days\.\d$/.test(k)) { (UI[lang].days = UI[lang].days || [...UI.en.days])[+k.slice(5)] = v; } else UI[lang][k] = v; } }
    // 지역 · 카테고리 등
    if (rows.site) { const R = SITE_ROOTS(); for (const [p, v] of Object.entries(rows.site)) { const i = p.indexOf("."); const r = R[p.slice(0, i)]; if (r) put(r, p.slice(i + 1), v); } }
    // 업체
    if (typeof SHOPS !== "undefined") SHOPS.forEach(s => { const t = rows["shop:" + s.id]; if (t) for (const [p, v] of Object.entries(t)) put(s, p, v); });
  }
  if (on) {
    try { rows = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
    apply();
    window.I18N_APPLY = apply;   // live.js 가 새 업체 정보를 받으면 다시 입혀요
    fetch(`${SUPA.url}/rest/v1/i18n_tr?select=key,tr&lang=eq.${encodeURIComponent(lang)}`, { headers: { apikey: SUPA.key, ...(SUPA.key.startsWith("eyJ") ? { Authorization: "Bearer " + SUPA.key } : {}) } })
      .then(r => r.ok ? r.json() : null).then(list => {
        if (!Array.isArray(list)) return;
        const next = {}; list.forEach(x => next[x.key] = x.tr || {});
        const text = JSON.stringify(next);
        if (text === JSON.stringify(rows)) return;
        const first = !rows;
        rows = next; try { localStorage.setItem(KEY, text); } catch (e) {}
        // 이 언어를 처음 여는 거면 화면 전체를 번역으로 다시 그리려고 한 번만 새로고침해요 (다음부터는 저장해 둔 번역으로 바로 그려요)
        if (first && list.length) { try { if (!sessionStorage.getItem(KEY + "-r")) { sessionStorage.setItem(KEY + "-r", "1"); location.reload(); return; } } catch (e) {} }
        apply();
        if (typeof drawCommon === "function") { try { drawCommon(); } catch (e) {} }
        if (typeof window.onLiveUpdate === "function") window.onLiveUpdate();
        else { try { if (!sessionStorage.getItem(KEY + "-r")) { sessionStorage.setItem(KEY + "-r", "1"); location.reload(); } } catch (e) {} }   // 다시 그리는 기능이 없는 화면은 한 번만 새로고침
      }).catch(() => {});
  }
  return { on, apply };
})();

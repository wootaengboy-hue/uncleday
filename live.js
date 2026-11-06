/* 데이터베이스에서 최신 업체 정보를 받아와요.
   먼저 이 기기에 저장해 둔 최근 정보로 바로 그리고, 새 정보가 오면 화면을 다시 그려요. */
const LIVE = (() => {
  const on = typeof SUPA !== "undefined" && SUPA.url && SUPA.key;
  const KEY = "uncleday-live-v1";
  const headers = on ? { apikey: SUPA.key, ...(SUPA.key.startsWith("eyJ") ? { Authorization: "Bearer " + SUPA.key } : {}) } : {};
  function apply(d) {
    if (!d || !Array.isArray(d.shops) || !d.shops.length) return false;
    SHOPS.length = 0; SHOPS.push(...d.shops);
    if (d.cat && typeof CAT_IMGS !== "undefined") { Object.keys(CAT_IMGS).forEach(k => delete CAT_IMGS[k]); Object.assign(CAT_IMGS, d.cat); }
    return true;
  }
  let cached = null;
  if (on) { try { cached = localStorage.getItem(KEY); apply(JSON.parse(cached || "null")); } catch (e) {} }

  async function rpc(name, args) {
    const r = await fetch(`${SUPA.url}/rest/v1/rpc/${name}`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(args) });
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
    if (!r.ok) { const e = new Error((j && j.message) || "error " + r.status); e.status = r.status; e.server = !!(j && j.message); throw e; }
    return j;
  }
  const ready = !on ? Promise.resolve(false) : (async () => {
    try {
      const [sh, st] = await Promise.all([
        fetch(`${SUPA.url}/rest/v1/shops?select=data&order=sort.asc,id.asc`, { headers }).then(r => r.ok ? r.json() : Promise.reject(r.status)),
        fetch(`${SUPA.url}/rest/v1/settings?select=key,value&key=eq.cat_imgs`, { headers }).then(r => r.ok ? r.json() : []).catch(() => [])
      ]);
      const d = { shops: sh.map(x => x.data), cat: (st[0] || {}).value || null };
      const text = JSON.stringify(d);
      if (!d.shops.length || text === cached) return false;
      try { localStorage.setItem(KEY, text); } catch (e) {}
      apply(d);
      if (typeof window.onLiveUpdate === "function") window.onLiveUpdate();
      return true;
    } catch (e) { return false; }
  })();
  return { on, rpc, ready };
})();

/* 공유 미리보기 만들기 1단계: 업체 데이터를 모아 JSON으로 저장해요.
   DB(수파베이스)에서 공개 업체를 읽고, 안 되면 shops.js 를 써요.
   사용: node tools/share-dump.js out.json */
const fs = require("fs");
const read = f => fs.readFileSync(f, "utf8").replace(/^const /gm, "var ");
eval(read("config.js") + read("data.js") + read("shops.js") + read("catimgs.js"));
(async () => {
  let shops = SHOPS, src = "shops.js", cat = CAT_IMGS;
  try {
    const h = { apikey: SUPA.key }; if (/^eyJ/.test(SUPA.key)) h.Authorization = "Bearer " + SUPA.key;
    // updated_at: 업체 정보를 마지막으로 고친 날 → 페이지의 '정보 확인' 날짜 · 사이트맵 lastmod
    let r = await fetch(`${SUPA.url}/rest/v1/shops?select=data,updated_at&order=sort.asc,id.asc`, { headers: h });
    if (!r.ok) r = await fetch(`${SUPA.url}/rest/v1/shops?select=data&order=sort.asc,id.asc`, { headers: h });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const rows = await r.json();
    if (rows.length) { shops = rows.map(x => x.updated_at ? { ...x.data, _updated: x.updated_at } : x.data); src = "db"; }
    const s = await fetch(`${SUPA.url}/rest/v1/settings?select=value&key=eq.cat_imgs`, { headers: h }).then(r => r.ok ? r.json() : []);
    if (s[0] && s[0].value) cat = { ...cat, ...s[0].value };
  } catch (e) { console.error("DB 읽기 실패, shops.js 사용:", e.message); }
  const common = read("common.js"); const m = common.match(/(?:const|var) PH_IMGS = (\{[^\n]*\});/);
  const ph = m ? eval("(" + m[1] + ")") : {};
  fs.writeFileSync(process.argv[2] || "share.json", JSON.stringify({ src, supa: { url: SUPA.url, key: SUPA.key }, kakao: (typeof SITE !== "undefined" && SITE.kakao) || "", shops, categories: CATEGORIES, cities: CITIES, catImgs: cat, phImgs: ph }));
  console.log(src, shops.length, "곳");
})();

/* 💰 가격 채우기 — 포털 안 (#ptPrice)
 * 업체 메뉴 중 가격이 비어 있는(0 = 상담 시 안내) 것을 모아서 휴대폰에서 바로 숫자만 넣고 저장해요.
 * 가격이 채워지면 1시간 안에 자동으로: 시술별 가격 페이지 · 미입점 가게 '이 근처 가격' · 업체 영어 페이지 · AI 안내문에 반영돼요.
 * 저장은 업체 편집 창과 같은 dbSaveShop 을 써요.
 */
const PRC = { city: "", only: true, open: null, q: "", n: 12 };
const prcCities = () => (typeof CITIES !== "undefined" ? CITIES : []).filter(c => shops.some(s => s.city === c.id));
const prcName = n => (n && (n.ko || n.en || n.vi)) || "";
// "450" → 450,000 / "45만" → 450,000 / "450k" → 450,000 / "450,000" → 450,000
function prcParse(v) {
  v = String(v || "").trim().toLowerCase().replace(/[,\s₫동đvnd]/g, "");
  if (!v) return 0;
  let m = v.match(/^(\d+(?:\.\d+)?)만$/); if (m) return Math.round(+m[1] * 10000);
  m = v.match(/^(\d+(?:\.\d+)?)k$/); if (m) return Math.round(+m[1] * 1000);
  if (!/^\d+$/.test(v)) return NaN;
  const n = +v; return n > 0 && n < 10000 ? n * 1000 : n;   // 4자리 이하는 '천 동' 단위로 봐요 (450 → 450,000)
}
const prcFmt = n => n > 0 ? n.toLocaleString("en-US") + "₫" : "";
function prcStat(list) {
  const items = list.flatMap(s => (s.menu || []).filter(m => prcName(m.name)));
  const ok = items.filter(m => +m.price > 0).length;
  const shopsOk = list.filter(s => (s.menu || []).some(m => +m.price > 0)).length;
  return { items: items.length, ok, shops: list.length, shopsOk };
}

function priceDraw() {
  const el = document.getElementById("ptPrice"); if (!el || typeof shops === "undefined") return;
  const live = shops.filter(s => !(typeof META !== "undefined" && META[s.id] && META[s.id].published === false));
  const cs = prcCities();
  const statRow = cs.map(c => { const st = prcStat(live.filter(s => s.city === c.id)); const pct = st.items ? Math.round(st.ok / st.items * 100) : 0;
    return `<button class="prc-city ${PRC.city === c.id ? "on" : ""}" data-pcity="${c.id}"><b>${esc(c.name.ko || c.name.en || c.id)}</b><span class="bar"><i style="width:${pct}%"></i></span><small>메뉴 ${st.ok}/${st.items} (${pct}%) · 업체 ${st.shopsOk}/${st.shops}</small></button>`; }).join("");
  const q = PRC.q.trim().toLowerCase();
  let list = live.filter(s => (!PRC.city || s.city === PRC.city) && (!q || [s.id, prcName(s.name), s.name.en].join(" ").toLowerCase().includes(q)));
  const missing = s => (s.menu || []).filter(m => prcName(m.name) && !(+m.price > 0)).length;
  if (PRC.only) list = list.filter(s => missing(s) > 0 || !(s.menu || []).length);
  list.sort((a, b) => missing(b) - missing(a) || prcName(a.name).localeCompare(prcName(b.name)));
  el.innerHTML = `
    <p class="hint" style="margin-top:0">가격을 채우면 1시간 안에 <b>시술별 가격 페이지 · 미입점 가게 '이 근처 가격' · 영어 페이지</b>에 자동으로 들어가요. 숫자는 <b>450</b> · <b>45만</b> · <b>450k</b> · <b>450,000</b> 모두 450,000₫로 읽어요.</p>
    <div class="prc-cities"><button class="prc-city ${!PRC.city ? "on" : ""}" data-pcity=""><b>전체</b>${(() => { const st = prcStat(live); const pct = st.items ? Math.round(st.ok / st.items * 100) : 0; return `<span class="bar"><i style="width:${pct}%"></i></span><small>메뉴 ${st.ok}/${st.items} (${pct}%) · 업체 ${st.shopsOk}/${st.shops}</small>`; })()}</button>${statRow}</div>
    <div class="prc-bar"><input id="prcQ" placeholder="업체 이름 찾기" value="${esc(PRC.q)}"><label><input type="checkbox" id="prcOnly" ${PRC.only ? "checked" : ""}> 가격 빈 곳만</label><span class="hint">${list.length}곳</span></div>
    <div class="prc-list">${list.slice(0, PRC.n).map(s => {
      const mi = missing(s), n = (s.menu || []).length, open = PRC.open === s.id;
      return `<div class="prc-shop ${open ? "open" : ""}"><button class="prc-h" data-popen="${esc(s.id)}"><b>${esc(prcName(s.name))}</b><small>${esc((cs.find(c => c.id === s.city) || { name: {} }).name.ko || s.city || "")} · ${n ? (mi ? `가격 빈 메뉴 <em>${mi}</em>/${n}` : `✅ 메뉴 ${n}개 모두 가격 있음`) : "<em>메뉴 없음</em>"}</small><span>${open ? "▲" : "▼"}</span></button>
        ${open ? `<div class="prc-body" data-pshop="${esc(s.id)}">${(s.menu || []).map((m, i) => `<div class="prc-row"><span class="nm">${esc(prcName(m.name))}${m.min ? ` <small>${m.min}분</small>` : ""}</span><input inputmode="decimal" data-pi="${i}" value="${+m.price > 0 ? (+m.price).toLocaleString("en-US") : ""}" placeholder="가격 (예: 450)"><small class="pv" data-pv="${i}">${prcFmt(+m.price)}</small></div>`).join("")}
          <div class="prc-add"><input data-pnew="name" placeholder="+ 새 메뉴 이름 (예: 아로마 마사지 60분)"><input data-pnew="min" inputmode="numeric" placeholder="분"><input data-pnew="price" inputmode="decimal" placeholder="가격"></div>
          <div class="prc-act"><button class="btn sm main" data-psave="${esc(s.id)}">저장</button><button class="btn sm" data-pfull="${esc(s.id)}">업체 창에서 자세히</button><span class="hint">가격을 비우면 '상담 시 안내'로 보여요</span></div></div>` : ""}</div>`;
    }).join("") || `<p class="hint">${PRC.only ? "🎉 가격이 빈 업체가 없어요." : "업체가 없어요."}</p>`}</div>${list.length > PRC.n ? `<button class="btn sm" data-pmore style="margin-top:8px">더 보기 (${list.length - PRC.n}곳 더)</button>` : ""}`;
  el.querySelectorAll("[data-pmore]").forEach(b => b.onclick = () => { PRC.n += 30; priceDraw(); });
  el.querySelectorAll("[data-pcity]").forEach(b => b.onclick = () => { PRC.city = b.dataset.pcity; PRC.open = null; PRC.n = 12; priceDraw(); });
  const qi = document.getElementById("prcQ"); qi.oninput = () => { PRC.q = qi.value; clearTimeout(PRC.t); PRC.t = setTimeout(() => { priceDraw(); const x = document.getElementById("prcQ"); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 250); };
  document.getElementById("prcOnly").onchange = e => { PRC.only = e.target.checked; priceDraw(); };
  el.querySelectorAll("[data-popen]").forEach(b => b.onclick = () => { PRC.open = PRC.open === b.dataset.popen ? null : b.dataset.popen; priceDraw(); });
  el.querySelectorAll("[data-pi]").forEach(inp => inp.oninput = () => {
    const v = prcParse(inp.value), pv = el.querySelector(`[data-pv="${inp.dataset.pi}"]`);
    pv.textContent = inp.value.trim() === "" ? "상담 시 안내" : isNaN(v) ? "⚠️ 숫자만" : "= " + prcFmt(v); pv.classList.toggle("bad", isNaN(v));
  });
  el.querySelectorAll("[data-pfull]").forEach(b => b.onclick = () => { if (typeof openEditor === "function") openEditor(b.dataset.pfull); });
  el.querySelectorAll("[data-psave]").forEach(b => b.onclick = async () => {
    const id = b.dataset.psave, s = shops.find(x => x.id === id), box = el.querySelector(`[data-pshop="${id}"]`); if (!s || !box) return;
    const c = JSON.parse(JSON.stringify(s)); c.menu = c.menu || [];
    for (const inp of box.querySelectorAll("[data-pi]")) {
      const v = prcParse(inp.value); if (isNaN(v)) { toast("가격에 숫자만 넣어 주세요"); inp.focus(); return; }
      c.menu[+inp.dataset.pi].price = v;
    }
    const nn = box.querySelector('[data-pnew="name"]').value.trim();
    if (nn) {
      const pr = prcParse(box.querySelector('[data-pnew="price"]').value); if (isNaN(pr)) { toast("새 메뉴 가격에 숫자만 넣어 주세요"); return; }
      c.menu.push({ name: { ko: nn, en: "", vi: "" }, min: +box.querySelector('[data-pnew="min"]').value || 0, price: pr });
    }
    b.disabled = true; b.textContent = "저장 중…";
    try { await dbSaveShop(c, null); shops[shops.indexOf(s)] = c; toast(`💰 ${prcName(c.name)} 가격을 저장했어요 · 1시간 안에 검색 페이지에도 반영돼요`, 3500);
      if (PRC.only && !c.menu.some(m => prcName(m.name) && !(+m.price > 0))) PRC.open = null; priceDraw(); }
    catch (e) { b.disabled = false; b.textContent = "저장"; dbErr(e, "가격 저장"); }
  });
}

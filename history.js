/* 📒 내 시술 기록 — 예약과 따로, 쇼핑몰의 '구매한 상품'처럼 (universe43)
   어디서 불러오나: ① 주소 뒤 #열쇠(예약확인증에서 넘어옴) ② 로그인한 계정 ③ 이 기기에 저장된 예약
   한 줄: 날짜 · 가게 · 시술 · 가게 메모(손님 말로 번역) · 다시 예약하기
   현장에서는 '🇻🇳 사장님께 보여 주기' — 가게에는 자기 가게 기록만 보이니까 손님이 직접 보여 줘요 */
drawCommon();
const hbox = $("hbox");
let HS = null;   // { t, list }
const CAT_IC = { massage: "💆", spa: "🧖", nail: "💅", hair: "💇", skin: "✨", derma: "🩺", dental: "🦷", lash: "👁️", waxing: "🪒", package: "🎁" };
const hMn = (x, l) => { const n = x.mn; return (n && typeof n === "object" ? n[l] || n.en || n.ko : "") || x.menu || ""; };
const hShop = (x, l) => { const n = x.shop; return n && typeof n === "object" ? n[l] || n.en || n.ko || "" : n || ""; };
const hNote = (x, l) => !x.pub ? "" : (x.lang && x.lang === l) ? x.pub : (x.tr && x.tr[l]) || x.pub;
const hDate = (d, l) => { if (!d) return ""; const x = new Date(d + "T00:00:00"); return l === "ko" || l === "ja" || l === "zh" || l === "zh-tw" ? `${x.getFullYear()}.${x.getMonth() + 1}.${x.getDate()}` : `${x.getDate()}/${x.getMonth() + 1}/${x.getFullYear()}`; };

function hToken() { const h = decodeURIComponent(location.hash.slice(1)); return h.length >= 20 ? h : ""; }
function deviceTokens() { try { return (JSON.parse(localStorage.getItem("uncleday-my-bookings") || "[]") || []).map(x => x.token).filter(Boolean); } catch (e) { return []; } }

async function hLoad() {
  if (!LIVE.on) { hbox.innerHTML = `<p class="empty">${ui("vNotFound")}</p>`; return; }
  let h = null;
  const t = hToken();
  if (t) { try { h = await LIVE.rpc("customer_history", { t }); } catch (e) {} }
  // 로그인한 계정 (예약확인증 열쇠가 없을 때)
  if (!h && typeof ACCT !== "undefined" && ACCT.on) {
    try { await ACCT.load(); } catch (e) {}
    if (ACCT.user()) { try { h = await LIVE.rpc("my_history", {}); if (h) h.me = true; } catch (e) {} }
  }
  // 이 기기에서 한 예약
  if (!h || !(h.list || []).length) for (const tk of deviceTokens().slice(0, 5)) {
    try { const r = await LIVE.rpc("customer_history", { t: tk }); if (r && (r.list || []).length) { h = r; break; } if (!h && r) h = r; } catch (e) {}
  }
  HS = h; hDraw();
  // 아직 손님 말로 번역 안 된 가게 메모가 있으면 한 번 번역해서 다시 그려요
  if (h && h.t && (h.list || []).some(x => x.pub && x.lang !== lang && !(x.tr && x.tr[lang])) && await hTr(h.t, lang)) { await hReload(); hDraw(); }
}
async function hReload() { if (!HS) return; try { const r = HS.me ? await LIVE.rpc("my_history", {}) : await LIVE.rpc("customer_history", { t: HS.t }); if (r) HS = { ...r, me: HS.me }; } catch (e) {} }
async function hTr(t, l) {
  try {
    const hd = { apikey: SUPA.key, "Content-Type": "application/json" }; if (/^eyJ/.test(SUPA.key)) hd.Authorization = "Bearer " + SUPA.key;
    const r = await fetch(`${SUPA.url}/functions/v1/chat-tr`, { method: "POST", headers: hd, body: JSON.stringify({ visit: t, to: l }) });
    const j = await r.json().catch(() => ({})); return !!(j && j.n);
  } catch (e) { return false; }
}

function hDraw() {
  const list = (HS && HS.list) || [];
  const shops = new Set(list.map(x => x.shop_id)).size;
  if (!HS) {
    hbox.innerHTML = `<div class="done voucher hist"><h1>${ui("vh_title")}</h1><p>${ui("hi_none")}</p>
      <div class="hist-go"><a class="btn big-btn" href="booking.html">🔎 ${ui("vFind")}</a>${typeof ACCT !== "undefined" && ACCT.on ? `<button class="btn" type="button" id="hLogin">👤 ${ui("hi_login")}</button>` : ""}</div></div>`;
    const lg = $("hLogin"); if (lg) lg.onclick = () => ACCT.openLogin();
    return;
  }
  hbox.innerHTML = `<div class="done voucher hist">
    <h1>${ui("vh_title")}</h1><p class="hist-sub">${ui("hi_sub")}</p>
    ${list.length ? `<div class="hist-sum"><div><b>${list.length}</b><small>${ui("hi_times")}</small></div><div><b>${shops}</b><small>${ui("hi_shops")}</small></div><div><b>${esc(hDate(list[0].date, lang))}</b><small>${ui("hi_last")}</small></div></div>
      <button type="button" class="vh-show" id="hShow">🇻🇳 ${ui("vh_show")}</button><small class="vh-hint">${ui("vh_showD")}</small>` : ""}
    <div class="hist-list">${list.length ? list.map(x => `<div class="hist-it">
      <div class="hist-top"><span class="hist-d">${esc(hDate(x.date, lang))}</span><a class="hist-shop" href="shop.html#${encodeURIComponent(x.shop_id)}">${CAT_IC[x.cat] || "📍"} ${esc(hShop(x, lang))} ›</a></div>
      <b class="hist-mn">${esc(hMn(x, lang))}</b>${x.people > 1 ? `<small class="hist-p"> · ${esc(ui("vPeopleN", { n: x.people }))}</small>` : ""}
      ${x.pub ? `<p class="hist-note"><span>🧾 ${ui("hi_note")}</span>${esc(hNote(x, lang))}</p>` : ""}
      <div class="hist-act"><a class="btn" href="shop.html#${encodeURIComponent(x.shop_id)}">↻ ${ui("hi_again")}</a>${x.t ? `<a class="hist-v" href="booking.html?v=2#${encodeURIComponent(x.t)}">${ui("hi_voucher")}</a>` : ""}</div>
    </div>`).join("") : `<p class="vh-empty">${ui("vh_empty")}</p>`}</div></div>`;
  const sh = $("hShow"); if (sh) sh.onclick = hShow;
}

// 🇻🇳 사장님께 보여 주기: 화면 가득 베트남어로
async function hShow() {
  const z = document.createElement("div"); z.className = "vh-ov"; document.body.appendChild(z);
  const draw = () => {
    const list = (HS && HS.list) || [];
    z.innerHTML = `<div class="vh-full"><button type="button" class="vh-x" aria-label="close">✕</button>
      <p class="vh-k">Uncle Day</p><h2>Lịch sử dịch vụ của khách</h2><p class="vh-s">${list.length} lần · khách cho bạn xem để bạn gợi ý dịch vụ phù hợp</p>
      ${list.map(x => `<div class="vh-row"><span class="vh-d">${esc(hDate(x.date, "vi"))}</span><div><b>${esc(hMn(x, "vi"))}</b><small>${esc(hShop(x, "vi"))}</small>
        ${x.pub ? `<p>🧾 ${esc(hNote(x, "vi"))}</p>` : ""}</div></div>`).join("")}</div>`;
    z.querySelector(".vh-x").onclick = () => z.remove();
  };
  draw();
  if (HS && HS.t && (HS.list || []).some(x => x.pub && x.lang !== "vi" && !(x.tr && x.tr.vi)) && await hTr(HS.t, "vi")) { await hReload(); if (z.isConnected) draw(); }
}

addEventListener("hashchange", hLoad);
hLoad();

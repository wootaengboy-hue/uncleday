/* 🔗 가게에 엉클데이 링크 달기 — 포털 안 (#ptLinks)
 * 입점 가게의 구글 지도(예약 링크) · 페이스북 · 잘로 · 인스타 · 매장 QR 에 엉클데이 업체 페이지 링크를 달게 해요.
 *  - 다른 사이트가 엉클데이를 가리키면 구글이 엉클데이를 믿을 만한 곳으로 봐요 (검색 노출 1순위)
 *  - 링크 끝의 ?via=gbp · fb · zalo · ig · qr 로 어디서 들어왔는지 '🔎 검색 유입'에 따로 세요 (페이지 주소는 같아서 검색 중복 문제 없음)
 *  - QR: vendor/qrcode-generator-1.4.4.js (MIT)
 */
const LNK = { id: "", q: "" };
const LNK_CH = [
  ["gbp", "📍 구글 지도 · 예약 링크", "가장 중요해요. 가게 이름을 구글에서 찾으면 '예약' 링크로 엉클데이가 떠요."],
  ["fb", "📘 페이스북 페이지 버튼", "페이지의 '지금 예약' 버튼에 넣어요."],
  ["zalo", "💬 잘로 소개", "잘로 공식 계정 · 프로필 소개에 넣어요."],
  ["ig", "📸 인스타그램 소개", "프로필의 링크 칸에 넣어요."],
  ["qr", "🧾 매장 QR (카운터 · 입구)", "한국 손님이 휴대폰으로 찍으면 한국어 예약 화면이 열려요."],
];
const lnkUrl = (id, via) => `https://www.uncleday.com/s/${id}/?via=${via}`;
const lnkName = s => (s && s.name && (s.name.vi || s.name.en || s.name.ko)) || (s && s.id) || "";
function lnkMsg(s) {
  const L = v => lnkUrl(s.id, v);
  const vi = `Chào anh/chị! Đây là link đặt lịch của ${lnkName(s)} trên Uncle Day — khách Hàn Quốc xem giá và đặt lịch bằng tiếng Hàn, Uncle Day xác nhận rồi gửi khách đến cửa hàng. Không mất phí.

1) Google Maps (quan trọng nhất): mở hồ sơ cửa hàng trên Google → Chỉnh sửa hồ sơ → Liên hệ → "Đường liên kết đặt lịch hẹn" (tên mục có thể hơi khác) → dán link → Lưu:
${L("gbp")}

2) Facebook: Trang của bạn → Thêm nút → "Đặt ngay / Đặt lịch" → dán link:
${L("fb")}

3) Zalo / Instagram: dán link vào phần giới thiệu:
Zalo: ${L("zalo")}
Instagram: ${L("ig")}

4) Mã QR: Uncle Day gửi ảnh QR — in ra và đặt ở quầy để khách Hàn Quốc quét.

Cảm ơn anh/chị! 🙏`;
  const ko = `[엉클데이] ${lnkName(s)} 예약 링크 안내 — 한국 손님이 한국어로 가격을 보고 예약해요. 비용 없음.
1) 구글 지도(가장 중요): 구글의 가게 프로필 → 프로필 수정 → 연락처 → 예약 링크 → ${L("gbp")}
2) 페이스북 '지금 예약' 버튼: ${L("fb")}
3) 잘로 · 인스타 소개: ${L("zalo")} / ${L("ig")}
4) 매장 QR: 이미지로 보내 드려요 (카운터에 두기)`;
  return { vi, ko };
}
function lnkQrCanvas(text, size) {
  const qr = qrcode(0, "M"); qr.addData(text); qr.make();
  const n = qr.getModuleCount(), cell = Math.floor(size / (n + 8)), pad = Math.floor((size - cell * n) / 2);
  const c = document.createElement("canvas"); c.width = c.height = size; const x = c.getContext("2d");
  x.fillStyle = "#fff"; x.fillRect(0, 0, size, size); x.fillStyle = "#0E2843";
  for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) if (qr.isDark(r, q)) x.fillRect(pad + q * cell, pad + r * cell, cell, cell);
  return c;
}
// 카운터에 세워 둘 QR 카드 (1080×1350, 인쇄용)
async function lnkCard(s) {
  const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  x.fillStyle = "#FFF8E8"; x.fillRect(0, 0, W, H);
  x.fillStyle = "#0E2843"; x.fillRect(0, 0, W, 210);
  try { const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = "/images/logo-full.webp"; });
    const h = 150, w = img.width * h / img.height; x.fillStyle = "#FAF3E0"; x.beginPath(); x.roundRect((W - w) / 2 - 24, 30, w + 48, h, 30); x.fill(); x.drawImage(img, (W - w) / 2, 30, w, h); } catch (e) {}
  x.textAlign = "center"; x.fillStyle = "#0E2843";
  x.font = "800 64px 'Pretendard Variable', 'Noto Sans KR', sans-serif"; x.fillText("한국어로 예약하기", W / 2, 320);
  x.font = "600 40px 'Pretendard Variable', sans-serif"; x.fillStyle = "#5b6676"; x.fillText("Đặt lịch bằng tiếng Hàn · Book in Korean", W / 2, 380);
  const q = lnkQrCanvas(lnkUrl(s.id, "qr"), 640); x.fillStyle = "#fff"; x.beginPath(); x.roundRect(W / 2 - 350, 430, 700, 700, 40); x.fill(); x.drawImage(q, W / 2 - 320, 460);
  x.fillStyle = "#0E2843"; x.font = "800 52px 'Pretendard Variable', sans-serif"; x.fillText(lnkName(s).slice(0, 30), W / 2, 1210);
  x.fillStyle = "#FD6A00"; x.font = "700 40px 'Pretendard Variable', sans-serif"; x.fillText("www.uncleday.com", W / 2, 1280);
  return c;
}
async function linksDraw() {
  const el = document.getElementById("ptLinks"); if (!el || typeof shops === "undefined") return;
  const live = shops.filter(s => !(typeof META !== "undefined" && META[s.id] && META[s.id].published === false));
  if (!LNK.id && live[0]) LNK.id = live[0].id;
  const s = live.find(x => x.id === LNK.id); const q = LNK.q.trim().toLowerCase();
  const opts = live.filter(x => !q || [x.id, x.name.ko, x.name.en, x.name.vi].join(" ").toLowerCase().includes(q));
  const pv = (typeof PRIV !== "undefined" && PRIV[LNK.id]) || {}, phone = ((pv.contract || {}).phone || "").replace(/\D/g, "");
  const zalo = phone ? "https://zalo.me/" + (phone.startsWith("84") ? "0" + phone.slice(2) : phone) : "";
  const m = s ? lnkMsg(s) : null;
  el.innerHTML = `<p class="hint" style="margin-top:0">입점 가게의 구글 지도 · 페이스북 · 잘로 · 인스타에 <b>엉클데이 예약 링크</b>를 달면, 구글이 엉클데이를 "이 가게의 예약처"로 믿게 돼요 (검색 노출 1순위). 어디서 들어왔는지는 🔎 검색 유입에 따로 세요.</p>
    <div class="crl-add"><input id="lnkQ" placeholder="가게 찾기" value="${esc(LNK.q)}"><select id="lnkSel">${opts.map(x => `<option value="${esc(x.id)}" ${x.id === LNK.id ? "selected" : ""}>${esc(x.name.ko || x.name.en || x.id)}${x.name.en && x.name.en !== x.name.ko ? " · " + esc(x.name.en) : ""}</option>`).join("")}</select></div>
    ${s ? `<div class="lnk-wrap"><div class="lnk-list">${LNK_CH.map(([v, l, h]) => `<div class="lnk-row"><b>${l}</b><small>${h}</small><code>${esc(lnkUrl(s.id, v))}</code><button class="btn sm" data-lcopy="${esc(lnkUrl(s.id, v))}">복사</button></div>`).join("")}
        <div class="lnk-stat" id="lnkStat"><small>불러오는 중…</small></div></div>
      <div class="lnk-qr"><div id="lnkQr"></div><button class="btn sm main" data-lcard>🧾 QR 카드 내려받기 (인쇄용)</button><small class="hint">카운터 · 입구에 세워 두면 한국 손님이 찍어서 한국어로 예약해요</small></div></div>
      <h4 style="margin:14px 0 6px">사장님께 보낼 안내문</h4>
      <div class="br-cats" style="margin-bottom:6px"><button class="on" data-lmsg="vi">🇻🇳 베트남어</button><button data-lmsg="ko">🇰🇷 한국어</button></div>
      <textarea id="lnkMsg" rows="9" readonly>${esc(m.vi)}</textarea>
      <div class="crl-act"><button class="btn sm main" data-lcopymsg>📋 안내문 복사</button>${zalo ? `<a class="btn sm" href="${zalo}" target="_blank" rel="noopener">잘로 열기</a>` : `<span class="hint">업체 담당자 전화가 있으면 '잘로 열기'가 생겨요</span>`}</div>` : `<p class="hint">가게가 없어요.</p>`}`;
  const sel = document.getElementById("lnkSel"); if (sel) sel.onchange = () => { LNK.id = sel.value; linksDraw(); };
  const qi = document.getElementById("lnkQ"); qi.oninput = () => { LNK.q = qi.value; clearTimeout(LNK.t); LNK.t = setTimeout(() => { const f = live.find(x => [x.id, x.name.ko, x.name.en, x.name.vi].join(" ").toLowerCase().includes(LNK.q.trim().toLowerCase())); if (f) LNK.id = f.id; linksDraw(); const n = document.getElementById("lnkQ"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 300); };
  el.querySelectorAll("[data-lcopy]").forEach(b => b.onclick = () => portalCopy(b.dataset.lcopy));
  el.querySelectorAll("[data-lmsg]").forEach(b => b.onclick = () => { el.querySelectorAll("[data-lmsg]").forEach(x => x.classList.toggle("on", x === b)); document.getElementById("lnkMsg").value = m[b.dataset.lmsg]; });
  el.querySelectorAll("[data-lcopymsg]").forEach(b => b.onclick = () => portalCopy(document.getElementById("lnkMsg").value));
  if (!s) return;
  if (typeof qrcode === "function") document.getElementById("lnkQr").appendChild(lnkQrCanvas(lnkUrl(s.id, "qr"), 220));
  el.querySelectorAll("[data-lcard]").forEach(b => b.onclick = async () => { const c = await lnkCard(s); const a = document.createElement("a"); a.download = `uncleday-qr-${s.id}.png`; a.href = c.toDataURL("image/png"); a.click(); toast("🧾 QR 카드를 내려받았어요. 사장님께 잘로로 보내 주세요"); });
  // 최근 30일: 링크별로 들어온 수 (seo_hits · universe18)
  try {
    const d1 = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
    const r = await sb.from("seo_hits").select("src,n").eq("path", `/s/${s.id}/`).eq("kind", "view").gte("day", d1).in("src", LNK_CH.map(c => c[0]));
    const by = {}; (r.data || []).forEach(x => by[x.src] = (by[x.src] || 0) + x.n);
    const st = document.getElementById("lnkStat"); if (st) st.innerHTML = `<b>최근 30일 이 링크들로 들어온 손님</b><small>${LNK_CH.map(([v, l]) => `${l.split(" ")[0]} ${by[v] || 0}`).join(" · ")}</small>`;
  } catch (e) {}
}

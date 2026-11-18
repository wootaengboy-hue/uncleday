/* 💸 결제 확인 · 페이백 — 포털 안 (#ptPayback)
 * - 다녀온 손님이 예약확인증에서 알려 준 '받은 시술 · 결제 금액 · 영수증'과 업체가 적은 결제 금액을 나란히 비교해요
 * - 같으면 자동 확정(결제 금액의 3% 포인트), 다르면 여기서 확인 → 손님 금액으로 확정(예약 결제 금액도 바꾸기 = 수수료도 그 금액) · 업체 금액으로 확정 · 안 됨
 * 서버 함수는 supabase/universe31.sql
 */
const PB = { rows: null, err: "", f: "review", loading: false };
const PB_ST = { wait: ["⏳ 업체 금액 기다림", ""], review: ["⚠️ 금액이 달라요", "bad"], ok: ["✅ 확정", "ok"], no: ["✖️ 안 됨", ""] };
async function pbLoad() {
  if (PB.loading) return; PB.loading = true;
  const r = await sb.from("paybacks").select("*").order("created_at", { ascending: false }).limit(500);
  PB.loading = false;
  if (r.error) { PB.err = /paybacks|PGRST20|42P01/.test((r.error.message || "") + (r.error.code || "")) ? "setup" : r.error.message; PB.rows = []; }
  else { PB.err = ""; PB.rows = r.data || []; }
  if (typeof TAB !== "undefined" && TAB === "home" && typeof drawPortal === "function") drawPortal(true); else pbDraw();
}
const pbBk = p => (typeof BOOKINGS !== "undefined" ? BOOKINGS : []).find(b => b.id === p.booking_id) || {};
const pbVnd = n => n == null ? "-" : "₫" + Math.round(+n).toLocaleString("en-US");
function pbCount() { return (PB.rows || []).filter(p => p.status === "review").length; }
function pbDraw() {
  const el = document.getElementById("ptPayback"); if (!el) return;
  if (!PB.rows) { el.innerHTML = `<div class="uni-empty">불러오는 중…</div>`; pbLoad(); return; }
  if (PB.err === "setup") { el.innerHTML = `<div class="uni-err">결제 확인 · 페이백을 쓰려면 Supabase SQL 편집기에서 <b>supabase/universe31.sql</b> 을 한 번 실행해 주세요.</div>`; return; }
  if (PB.err) { el.innerHTML = `<div class="uni-err">불러오지 못했어요: ${esc(PB.err)} <button class="btn sm" data-pbact="reload">다시</button></div>`; bindPb(el); return; }
  const R = PB.rows, by = s => R.filter(p => p.status === s);
  const ok = by("ok"), mon = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7);
  const okMon = ok.filter(p => (p.decided_at || "").slice(0, 7) === mon);
  // 손님 금액이 업체 금액보다 컸던 건: 손님이 알려 줘서 드러난 금액
  const found = ok.filter(p => p.decided_by !== "auto" && p.shop_amount != null && +p.final_amount > +p.shop_amount);
  const list = PB.f === "all" ? R : by(PB.f);
  el.innerHTML = `
    <div class="seo-kpi">
      <div><small>⚠️ 금액이 달라 확인할 것</small><b style="color:${by("review").length ? "var(--danger)" : "inherit"}">${by("review").length}</b></div>
      <div><small>⏳ 업체 금액 기다림</small><b>${by("wait").length}</b></div>
      <div><small>✅ 이번 달 확정 포인트</small><b>${okMon.reduce((a, p) => a + +p.points, 0).toLocaleString()}P</b></div>
      <div><small>🔎 손님 덕분에 늘어난 결제 금액</small><b>${pbVnd(found.reduce((a, p) => a + (+p.final_amount - +p.shop_amount), 0))}</b></div>
    </div>
    <p class="hint">손님 포인트 = 확정된 결제 금액의 <b>3%</b> (1P = 1동) · 업체 금액과 1,000동 이내로 같으면 자동 확정 · 포인트는 아직 쌓기만 해요</p>
    <div class="br-cats" style="margin:8px 0">${[["review", "⚠️ 확인할 것"], ["wait", "⏳ 기다림"], ["ok", "✅ 확정"], ["no", "✖️ 안 됨"], ["all", "전체"]].map(([k, l]) => `<button class="${PB.f === k ? "on" : ""}" data-pbf="${k}">${l} <span>${k === "all" ? R.length : by(k).length}</span></button>`).join("")}<button class="btn sm" data-pbact="reload" style="margin-left:auto">↻</button></div>
    ${list.length ? `<div class="pb-list">${list.map(p => { const b = pbBk(p), done = p.status === "ok" || p.status === "no", shop = done ? (p.shop_amount == null ? null : +p.shop_amount) : b.paid_amount != null ? +b.paid_amount : p.shop_amount, diff = shop != null ? +p.amount - shop : null, [stl, stc] = PB_ST[p.status] || [p.status, ""];
      return `<div class="pb-row ${p.status}">
        <div class="h"><span class="uni-chip ${stc}">${stl}</span><b>${esc(b.shop_name || "")}</b><small>${esc(b.code || "")} · ${esc(b.visit_date || "")} · ${esc(b.customer_name || "")}</small></div>
        <div class="cmp">
          <div><small>예약한 메뉴</small><b>${esc(b.menu_name || "-")}</b><em>${b.list_price ? "예상 " + pbVnd(b.list_price) : ""}</em></div>
          <div class="cu"><small>🙋 손님이 알려 준 것</small><b>${pbVnd(p.amount)}</b><em>${esc(p.items || "시술 내용 없음")}</em></div>
          <div class="sh"><small>🏪 업체가 적은 금액${done && p.decided_by !== "auto" ? " (확정 전)" : ""}</small><b>${shop != null ? pbVnd(shop) : "아직 안 적음"}</b><em>${diff ? `<span class="${diff > 0 ? "up" : "dn"}">차이 ${diff > 0 ? "+" : ""}${pbVnd(diff).replace("₫-", "-₫")}</span>` : shop != null ? "같아요" : ""}</em></div>
        </div>
        <div class="f">${p.receipt ? `<button class="btn sm" data-pbrc="${esc(p.receipt)}">🧾 영수증 보기</button>` : `<span class="hint">영수증 없음</span>`}
          ${p.status === "ok" ? `<span class="hint">✅ ${pbVnd(p.final_amount)} → <b>${(+p.points).toLocaleString()}P</b> · ${p.decided_by === "auto" ? "자동 확정" : esc(p.decided_by || "")}</span>` : ""}
          ${p.status === "no" ? `<span class="hint">✖️ ${esc(p.note || "")}</span>` : ""}
          ${p.status === "review" || p.status === "wait" ? `<input data-pbnote="${p.id}" placeholder="메모 (손님에게도 보여요 · 예: 업체 확인 결과 패키지 결제 맞음)" value="${esc(p.note || "")}">
            <button class="btn sm main" data-pbok="${p.id}" data-a="${p.amount}" data-fix="1" ${b.status === "settled" ? "disabled title='정산이 끝난 예약'" : ""}>손님 금액으로 확정 (결제 금액도 ${pbVnd(p.amount)}로)</button>
            ${shop != null ? `<button class="btn sm" data-pbok="${p.id}" data-a="${shop}">업체 금액으로 확정</button>` : ""}
            <button class="btn sm" data-pbno="${p.id}">안 됨</button>` : `<button class="btn sm" data-pbre="${p.id}">다시 확인으로</button>`}
          <button class="btn sm" data-pbbk="${esc(p.booking_id)}">예약 열기</button></div></div>`; }).join("")}</div>`
    : `<p class="hint">${PB.f === "review" ? "확인할 것이 없어요 🎉" : "해당하는 요청이 없어요."}</p>`}`;
  bindPb(el);
}
function bindPb(el) {
  const note = id => (el.querySelector(`[data-pbnote="${id}"]`) || {}).value || null;
  const decide = async (id, st, amt, fix) => {
    const r = await sb.rpc("admin_payback_decide", { pid: id, st, amt: amt == null ? null : +amt, note: note(id), fix_booking: !!fix });
    if (r.error) { toast("못 했어요: " + r.error.message); return; }
    toast(st === "ok" ? "✅ 확정했어요" : st === "no" ? "안 됨으로 했어요" : "다시 확인으로 돌렸어요");
    if (fix && typeof loadAll === "function") { try { await loadAll(); } catch (e) {} }
    PB.rows = null; pbDraw();
  };
  el.querySelectorAll("[data-pbf]").forEach(b => b.onclick = () => { PB.f = b.dataset.pbf; pbDraw(); });
  el.querySelectorAll("[data-pbact=reload]").forEach(b => b.onclick = () => { PB.rows = null; pbDraw(); });
  el.querySelectorAll("[data-pbok]").forEach(b => b.onclick = () => decide(b.dataset.pbok, "ok", b.dataset.a, b.dataset.fix === "1"));
  el.querySelectorAll("[data-pbno]").forEach(b => b.onclick = () => decide(b.dataset.pbno, "no", null, false));
  el.querySelectorAll("[data-pbre]").forEach(b => b.onclick = () => decide(b.dataset.pbre, "review", null, false));
  el.querySelectorAll("[data-pbbk]").forEach(b => b.onclick = () => { if (typeof openBooking === "function") openBooking(b.dataset.pbbk); });
  el.querySelectorAll("[data-pbrc]").forEach(b => b.onclick = async () => {
    const r = await sb.storage.from("receipts").createSignedUrl(b.dataset.pbrc, 600);
    if (r.error || !r.data) { toast("영수증을 열지 못했어요"); return; }
    const u = r.data.signedUrl || r.data.signedURL; window.open(/^https?:/.test(u) ? u : SUPA.url + "/storage/v1" + u, "_blank", "noopener");
  });
}

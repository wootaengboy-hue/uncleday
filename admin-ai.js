// 💳 AI 사용량 · 대략 잔액 (universe52)
//  · Edge Function 이 AI 를 부를 때마다 ai_usage 에 토큰을 남겨요 → 여기서 모델 단가로 금액을 계산해요
//  · 콘솔 잔액을 가끔 적어 두면: 대략 잔액 = 마지막으로 적은 잔액 − 그 뒤 사용액
//  · 콘솔 테스트 · 다른 프로젝트에서 쓴 금액은 빠져요 → 가끔 콘솔 잔액을 다시 적어 맞춰요
const AI = { rows: null, bal: null, err: "", busy: false };
// 단가 ($ / 100만 토큰) — Anthropic 가격표 (11/26 확인) · 포털에서 바꿀 수 있어요 (settings 'ai_prices')
const AI_PRICE0 = {
  "claude-sonnet-5-5": { in: 2, out: 10, cw: 2.5, cr: 0.1 },
  "claude-haiku-5-5": { in: 0.1, out: 0.5, cw: 0.125, cr: 0.01, long: { in: 0.5, out: 2.5, cw: 0.625, cr: 0.05 } },   // 입력 10만 토큰 넘으면 long
};
const AI_FN = { "shop-extract": "📥 업체 정보 가져오기", "media-check": "🖼️ 이미지 AI 검사", "blog-ai": "📝 블로그 AI", "i18n-tr": "🌐 다국어 번역", "chat-tr": "💬 채팅 · 질문 번역" };
const AI_KRW = 1400;   // 대략 원화 (1$ ≈ 1,400원)
const aiPrice = m => ({ ...AI_PRICE0, ...(AI.price || {}) })[m] || null;
function aiCost(r) {
  let p = aiPrice(r.model); if (!p) return null;
  if (p.long && (r.input_tokens + r.cache_read + r.cache_write) > 100000) p = p.long;
  return (r.input_tokens * p.in + r.output_tokens * p.out + r.cache_write * (p.cw ?? p.in * 1.25) + r.cache_read * (p.cr ?? p.in * 0.1)) / 1e6;
}
const aiUsd = v => v == null ? "?" : v > 0 && v < 0.001 ? "<$0.001" : "$" + (Math.abs(v) < 0.1 && v !== 0 ? v.toFixed(3) : v.toFixed(2));
const aiWon = v => v == null ? "" : `약 ${Math.round(v * AI_KRW).toLocaleString("ko-KR")}원`;
const aiAt = t => { try { return new Date(t).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }); } catch (e) { return String(t).slice(0, 16); } };
const aiTok = n => n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "k" : String(n);

async function aiLoad() {
  AI.busy = true;
  const since = new Date(Date.now() - 62 * 864e5).toISOString();
  const [b, u, p] = await Promise.all([
    sb.from("ai_balance").select("*").order("at", { ascending: false }).limit(10),
    sb.from("ai_usage").select("*").gte("at", since).order("at", { ascending: false }).limit(5000),
    sb.from("settings").select("value").eq("key", "ai_prices").maybeSingle()]);
  AI.busy = false;
  const bad = [b.error, u.error].find(Boolean);
  if (bad) { AI.err = /ai_usage|ai_balance|42P01|PGRST20|schema cache/.test((bad.message || "") + (bad.code || "")) ? "setup" : bad.message; AI.rows = []; AI.bal = []; }
  else { AI.err = ""; AI.bal = b.data || []; AI.rows = u.data || []; AI.price = (p && p.data && p.data.value) || {}; }
  // 마지막 잔액 기록이 62일보다 예전이면 그 뒤 사용분을 따로 더 불러와요
  const last = AI.bal && AI.bal[0];
  if (last && last.at < since) { const r = await sb.from("ai_usage").select("*").gte("at", last.at).lt("at", since).limit(20000); if (!r.error) AI.older = r.data || []; }
  aiDraw();
}
function aiDraw() {
  const el = document.getElementById("ptAi"); if (!el) return;
  if (!AI.rows) { el.innerHTML = `<p class="hint">불러오는 중…</p>`; if (!AI.busy) aiLoad(); return; }
  if (AI.err === "setup") { el.innerHTML = `<div class="uni-err">먼저 Supabase SQL 편집기에서 <b>supabase/universe52.sql</b> 을 실행하고, Edge Function 5개(shop-extract · media-check · blog-ai · i18n-tr · chat-tr)를 최신 코드로 다시 배포해 주세요.</div>`; return; }
  if (AI.err) { el.innerHTML = `<div class="uni-err">${esc(AI.err)}</div>`; return; }
  const R = AI.rows, all = R.concat(AI.older || []), last = AI.bal[0];
  const sum = rs => rs.reduce((a, r) => { const c = aiCost(r); return a + (c || 0); }, 0);
  const unknown = [...new Set(R.filter(r => aiCost(r) == null).map(r => r.model || "(모델 모름)"))];
  const after = last ? all.filter(r => r.at > last.at) : [], spentAfter = sum(after), est = last ? +last.usd - spentAfter : null;
  const vnNow = new Date(Date.now() + 9 * 36e5), mStart = new Date(Date.UTC(vnNow.getUTCFullYear(), vnNow.getUTCMonth(), 1) - 9 * 36e5).toISOString();
  const month = R.filter(r => r.at >= mStart), mSum = sum(month);
  const today = new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10), dayKey = r => new Date(new Date(r.at).getTime() + 9 * 36e5).toISOString().slice(0, 10);
  const days = [...Array(14)].map((_, k) => { const d = new Date(Date.now() + 9 * 36e5 - (13 - k) * 864e5).toISOString().slice(0, 10); return { d, v: sum(R.filter(r => dayKey(r) === d)) }; });
  const dmax = Math.max(0.0001, ...days.map(x => x.v));
  const byFn = Object.keys(AI_FN).concat([...new Set(month.map(r => r.fn))].filter(f => !AI_FN[f])).map(f => { const rs = month.filter(r => r.fn === f);
    return { f, n: rs.length, i: rs.reduce((a, r) => a + r.input_tokens + r.cache_read + r.cache_write, 0), o: rs.reduce((a, r) => a + r.output_tokens, 0), c: sum(rs) }; }).filter(x => x.n);
  const low = est != null && est < 5;
  el.innerHTML = `<div class="ai">
    <div class="vf-tiles">
      <div class="${low ? "ai-low" : ""}"><small>대략 잔액</small><b>${est == null ? "—" : aiUsd(est)}</b><small>${est == null ? "아래에 콘솔 잔액을 한 번 적어 주세요" : aiWon(est)}</small></div>
      <div><small>마지막으로 적은 잔액</small><b>${last ? aiUsd(+last.usd) : "—"}</b><small>${last ? esc(aiAt(last.at)) : ""}</small></div>
      <div><small>그 뒤 사용</small><b>${last ? aiUsd(spentAfter) : "—"}</b><small>${last ? `${after.length}번 호출` : ""}</small></div>
      <div><small>이번 달 사용 (한국 시간)</small><b>${aiUsd(mSum)}</b><small>${aiWon(mSum)} · ${month.length}번</small></div>
    </div>
    ${low ? `<div class="uni-err">⚠️ 대략 잔액이 $5 아래예요. 콘솔(console.anthropic.com → Billing)에서 충전하고, 충전 뒤 잔액을 아래에 적어 주세요. 잔액이 0이 되면 가져오기 · 번역 · AI 검사가 멈춰요.</div>` : ""}
    <div class="ai-bal"><b>💵 콘솔 잔액 적기</b><span class="hint">콘솔 → Billing 의 남은 크레딧을 그대로 적어요 (충전한 뒤 · 가끔 맞출 때)</span>
      <span>$ <input id="aiUsd" inputmode="decimal" placeholder="예: 48.20"></span><input id="aiNote" placeholder="메모 (예: $50 충전)"><button class="btn sm main" id="aiSave">기록</button>
      ${AI.bal.length ? `<details><summary>지난 기록 ${AI.bal.length}개</summary>${AI.bal.map(b => `<div class="ai-hist">${esc(aiAt(b.at))} · <b>${aiUsd(+b.usd)}</b> ${b.note ? "· " + esc(b.note) : ""} <small>${esc((b.by_email || "").split("@")[0])}</small></div>`).join("")}</details>` : ""}</div>
    <h4>📅 최근 14일 <span class="hint">하루 사용액</span></h4>
    <div class="ai-days">${days.map(x => `<div title="${x.d} · ${aiUsd(x.v)}"><i style="height:${Math.max(2, Math.round(x.v / dmax * 70))}px" class="${x.d === today ? "t" : ""}"></i><small>${+x.d.slice(8)}</small></div>`).join("")}</div>
    <h4>🧩 기능별 (이번 달)</h4>
    ${byFn.length ? `<table class="ai-t"><tr><th>기능</th><th>호출</th><th>읽은 양</th><th>쓴 양</th><th>금액</th></tr>${byFn.map(x => `<tr><td>${esc(AI_FN[x.f] || x.f)}</td><td>${x.n}</td><td>${aiTok(x.i)}</td><td>${aiTok(x.o)}</td><td><b>${aiUsd(x.c)}</b> <small>${aiWon(x.c)}</small></td></tr>`).join("")}</table>` : `<p class="hint">이번 달 기록이 아직 없어요 · Edge Function 을 최신 코드로 다시 배포하면 그 뒤부터 쌓여요</p>`}
    <h4>🕘 최근 호출 30개</h4>
    <div class="ai-recent">${R.slice(0, 30).map(r => `<div><span>${esc(aiAt(r.at))}</span><span>${esc(AI_FN[r.fn] || r.fn)}</span><span class="ref">${esc(r.ref || "")}</span><span>${aiTok(r.input_tokens + r.cache_read + r.cache_write)} → ${aiTok(r.output_tokens)}</span><b>${aiUsd(aiCost(r))}</b></div>`).join("") || `<p class="hint">기록이 없어요</p>`}</div>
    ${unknown.length ? `<div class="uni-err">단가를 모르는 모델이 있어요: ${unknown.map(esc).join(", ")} · 아래 단가에 넣어 주세요 (금액 계산에서 빠져요)</div>` : ""}
    <details class="ai-price"><summary>⚙️ 모델 단가 ($ / 100만 토큰)</summary>
      <p class="hint">Anthropic 가격표 기준 (11/26). 가격이 바뀌면 여기서 고쳐요 · 읽기 = 입력, 쓰기 = 출력. Haiku 는 한 번에 입력 10만 토큰이 넘으면 더 비싼 단가가 붙어요.</p>
      ${[...new Set(Object.keys(AI_PRICE0).concat(Object.keys(AI.price || {}), unknown))].map(m => { const p = aiPrice(m) || {}; return `<div class="ai-pr"><b>${esc(m)}</b> 입력 <input data-aip="${esc(m)}" data-k="in" value="${p.in ?? ""}"> 출력 <input data-aip="${esc(m)}" data-k="out" value="${p.out ?? ""}"></div>`; }).join("")}
      <button class="btn sm" id="aiPriceSave">단가 저장</button></details>
    <p class="hint">ℹ️ 엉클데이 기능이 부른 AI 만 잡혀요 (콘솔에서 직접 테스트하거나 다른 프로젝트에서 쓴 금액은 빠져요). 그래서 '대략'이에요 · 가끔 콘솔 잔액을 다시 적으면 맞춰져요.</p>
  </div>`;
  const sv = el.querySelector("#aiSave"); if (sv) sv.onclick = async () => { const v = +String(el.querySelector("#aiUsd").value).replace(/[^0-9.]/g, "");
    if (!(v >= 0) || el.querySelector("#aiUsd").value.trim() === "") return toast("잔액($)을 숫자로 적어 주세요");
    const r = await sb.from("ai_balance").insert({ usd: v, note: el.querySelector("#aiNote").value.trim() || null, by_email: ME.email }).select().single();
    if (r.error) return dbErr(r.error, "잔액 기록"); AI.bal.unshift(r.data); AI.older = []; toast(`잔액 ${aiUsd(v)} 를 적었어요 · 이제부터 쓴 만큼 빼서 보여 줘요`); aiDraw(); };
  const ps = el.querySelector("#aiPriceSave"); if (ps) ps.onclick = async () => { const pr = { ...(AI.price || {}) };
    el.querySelectorAll("[data-aip]").forEach(i => { const m = i.dataset.aip, v = +i.value; if (!(v >= 0) || i.value === "") return; pr[m] = { ...(aiPrice(m) || {}), ...(pr[m] || {}), [i.dataset.k]: v }; });
    const r = await sb.from("settings").upsert({ key: "ai_prices", value: pr }); if (r.error) return dbErr(r.error, "단가 저장"); AI.price = pr; toast("단가를 저장했어요"); aiDraw(); };
}

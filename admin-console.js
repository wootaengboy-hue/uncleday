/* 🔎 엉클데이 서치 콘솔 — 포털 안 (#ptCon) · universe24.sql + Edge Function gsc (inspect · sweep · sitemaps)
 * 사이트맵의 모든 페이지가 구글에 색인됐는지 (색인됨 / 안 됨 / 확인 전) 페이지 종류별로 봐요.
 * 확인은 깃허브 자동 작업이 매시간 70개씩 해요 (구글 하루 한도 2,000건). [지금 확인]으로 바로 30개 더 할 수도 있어요.
 * 구글은 일반 페이지의 '색인 요청'을 API 로 허락하지 않아요 → 안 된 페이지는 [서치 콘솔에서 열기]로 가서 요청해요.
 */
const CON = { urls: null, rows: null, sm: null, site: "https://www.uncleday.com/", err: "", f: "not", kind: "", n: 100, busy: false, insp: null };
const CON_COV = { "Submitted and indexed": "제출됨 · 색인됨", "Indexed, not submitted in sitemap": "색인됨 (사이트맵 밖)", "Discovered - currently not indexed": "발견됨 · 아직 색인 안 함",
  "Crawled - currently not indexed": "크롤링됨 · 아직 색인 안 함", "URL is unknown to Google": "구글이 아직 모름", "Excluded by ‘noindex’ tag": "noindex 로 제외 (의도된 것)",
  "Duplicate, Google chose different canonical than user": "중복 · 구글이 다른 대표 페이지 선택", "Alternate page with proper canonical tag": "다른 언어 · 대표 페이지 있음 (정상)",
  "Page with redirect": "리디렉션", "Not found (404)": "없음 (404)", "Blocked by robots.txt": "robots.txt 로 막힘", "Duplicate without user-selected canonical": "중복 · 대표 페이지 미지정" };
const conKind = u => { const p = u.replace(/^https?:\/\/[^/]+/, "") || "/"; if (p === "/") return "홈"; const en = p.startsWith("/en/") ? " (영어)" : "", q = p.replace(/^\/en/, "");
  if (q.startsWith("/s/")) return "업체" + en; if (q.startsWith("/p/")) return q.includes("/vi/") ? "미입점 (베트남어)" : "미입점"; if (q.startsWith("/blog/")) return "블로그";
  if (/^\/c\/[a-z]+\/$/.test(q)) return "도시" + en; if (/\/guide\/$/.test(q)) return "가이드" + en; if (/\/price\//.test(q)) return "가격" + en; if (/\/more\/$/.test(q)) return "미입점 목록"; if (q.startsWith("/c/")) return "주제" + en; return "기타"; };
const conState = r => !r || !r.checked_at ? "wait" : r.verdict === "PASS" ? "ok" : "not";
const conGsc = (body) => sb.functions.invoke("gsc", { body }).then(async r => { if (r.error) { let m = r.error.message || ""; try { m = (await r.error.context.json()).error || m; } catch (e) {} throw new Error(m); } return r.data; });

async function conLoad() {
  try {
    const [sm, db] = await Promise.all([fetch("/sitemap.xml", { cache: "no-store" }).then(r => r.text()), (async () => { let all = []; for (let f = 0; ; f += 1000) { const r = await sb.from("seo_index").select("*").range(f, f + 999); if (r.error) throw r.error; all = all.concat(r.data); if (r.data.length < 1000) break; } return all; })()]);
    CON.urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim()); CON.rows = new Map(db.map(r => [r.url, r])); CON.err = "";
  } catch (e) { CON.err = /seo_index|42P01|PGRST20/.test((e.message || "") + (e.code || "")) ? "setup" : e.message; CON.urls = CON.urls || []; CON.rows = CON.rows || new Map(); }
  conDraw();
  if (!CON.sm && !CON.err) conGsc({ action: "sitemaps" }).then(d => { CON.sm = d.sitemaps ? d : { error: d.error === "setup" ? "서치 콘솔 연결(gsc) 설정을 먼저 끝내 주세요" : d.error || "" }; if (d.site) CON.site = d.site; conDraw(); }).catch(e => { CON.sm = { error: /sitemaps|Unknown|action/.test(e.message) ? "gsc 기능을 새 코드로 다시 올려 주세요" : e.message }; conDraw(); });
}
function conDraw() {
  const el = document.getElementById("ptCon"); if (!el) return;
  if (!CON.urls) { el.innerHTML = `<p class="hint">불러오는 중…</p>`; conLoad(); return; }
  if (CON.err === "setup") { el.innerHTML = `<div class="uni-err">엉클데이 서치 콘솔을 쓰려면 Supabase SQL 편집기에서 <b>supabase/universe24.sql</b> 을 실행하고, gsc 기능(Edge Function)을 새 코드로 다시 올려 주세요.</div>`; return; }
  const U = CON.urls, st = u => conState(CON.rows.get(u)), cnt = { ok: 0, not: 0, wait: 0 }; U.forEach(u => cnt[st(u)]++);
  const kinds = {}; U.forEach(u => { const k = conKind(u); (kinds[k] = kinds[k] || { ok: 0, not: 0, wait: 0 })[st(u)]++; });
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0, dt2 = t => t ? new Date(t).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", timeZone: "Asia/Ho_Chi_Minh" }) : "-";
  const list = U.filter(u => (CON.f === "all" || st(u) === CON.f) && (!CON.kind || conKind(u) === CON.kind));
  const lastCheck = [...CON.rows.values()].reduce((m, r) => r.checked_at > m ? r.checked_at : m, "");
  const S = CON.sm || {}, sm0 = (S.sitemaps || [])[0];
  const gscLink = u => `https://search.google.com/search-console/inspect?resource_id=${encodeURIComponent(CON.site)}&id=${encodeURIComponent(u)}`;
  const ir = CON.insp;
  el.innerHTML = `
    <div class="seo-kpi"><div><small>📄 사이트맵 페이지</small><b>${U.length.toLocaleString()}</b></div><div><small>✅ 구글 색인됨</small><b style="color:#116241">${cnt.ok.toLocaleString()}</b></div><div><small>⏳ 아직 색인 안 됨</small><b style="color:#b54708">${cnt.not.toLocaleString()}</b></div><div><small>❔ 확인 전</small><b style="color:#8a94a3">${cnt.wait.toLocaleString()}</b></div></div>
    <div class="con-bar"><i class="ok" style="width:${pct(cnt.ok, U.length)}%"></i><i class="not" style="width:${pct(cnt.not, U.length)}%"></i></div>
    <p class="hint">색인율 <b>${pct(cnt.ok, cnt.ok + cnt.not)}%</b> (확인한 것 중) · 마지막 확인 ${lastCheck ? dt(lastCheck) : "아직 없음"} · 매시간 70개씩 자동 확인 (구글 하루 한도 2,000건) <button class="btn sm" data-cact="sweep" ${CON.busy ? "disabled" : ""}>${CON.busy ? "확인 중…" : "지금 30개 확인"}</button></p>
    <div class="seo-two">
      <div class="br-box"><h4>페이지 종류별</h4>${Object.entries(kinds).sort((a, b) => (b[1].ok + b[1].not + b[1].wait) - (a[1].ok + a[1].not + a[1].wait)).map(([k, v]) => { const t = v.ok + v.not + v.wait;
        return `<button class="con-k ${CON.kind === k ? "on" : ""}" data-ckind="${esc(k)}"><span>${esc(k)}</span><span class="con-bar sm"><i class="ok" style="width:${pct(v.ok, t)}%"></i><i class="not" style="width:${pct(v.not, t)}%"></i></span><small>${v.ok}/${t}</small></button>`; }).join("")}</div>
      <div class="br-box"><h4>사이트맵 (구글 기준)</h4>${CON.sm ? (S.error ? `<p class="hint">${esc(S.error)}</p>` : sm0 ? `<p style="margin:0"><b>${esc(sm0.path.replace(/^https?:\/\/[^/]+/, ""))}</b></p><p class="hint">구글이 마지막으로 읽음: ${esc((sm0.lastDownloaded || "").slice(0, 10) || "-")} · 제출 ${esc(((sm0.contents || [])[0] || {}).submitted || "-")}개 · 오류 ${esc(sm0.errors || "0")} · 경고 ${esc(sm0.warnings || "0")}${sm0.isPending ? " · 처리 중" : ""}</p>` : `<p class="hint">제출된 사이트맵이 없어요. 서치 콘솔 → Sitemaps 에서 sitemap.xml 을 제출해 주세요.</p>`) : `<p class="hint">불러오는 중…</p>`}
        <h4 style="margin-top:12px">URL 검사</h4><div class="seo-hide"><input id="conUrl" placeholder="https://www.uncleday.com/…" value="${esc(ir && ir.url || "")}"><button class="btn sm main" data-cact="insp">검사</button></div>
        ${ir ? (ir.err ? `<p class="crl-err">${esc(ir.err)}</p>` : `<div class="con-ir ${conState(ir)}"><b>${ir.verdict === "PASS" ? "✅ 구글에 색인됐어요" : "⏳ 아직 색인 안 됐어요"}</b><small>${esc(CON_COV[ir.coverage] || ir.coverage || "")} · 구글 방문 ${dt2(ir.last_crawl)}</small>${ir.verdict !== "PASS" ? `<a class="btn sm" href="${gscLink(ir.url)}" target="_blank" rel="noopener">서치 콘솔에서 색인 요청 ↗</a>` : ""}</div>`) : ""}
      </div>
    </div>
    <div class="br-box" style="margin-top:10px"><h4>페이지 목록 ${CON.kind ? `<span class="uni-chip">${esc(CON.kind)} <a href="#" data-ckind="" style="text-decoration:none">✕</a></span>` : ""}</h4>
      <div class="br-cats" style="margin-bottom:8px">${[["not", `⏳ 안 됨 ${cnt.not}`], ["wait", `❔ 확인 전 ${cnt.wait}`], ["ok", `✅ 색인됨 ${cnt.ok}`], ["all", "전체"]].map(([k, l]) => `<button class="${CON.f === k ? "on" : ""}" data-cf="${k}">${l}</button>`).join("")}</div>
      ${CON.f === "not" && cnt.not ? `<p class="hint">"발견됨 · 아직 색인 안 함"은 새 사이트에서 흔해요. 중요한 페이지부터 [요청 ↗]으로 서치 콘솔에 가서 '색인 생성 요청'을 눌러 주세요 (하루 10개 정도).</p>` : ""}
      <div class="con-list">${list.slice(0, CON.n).map(u => { const r = CON.rows.get(u) || {}; const s = st(u);
        return `<div class="${s}"><span><a href="${esc(u)}" target="_blank" rel="noopener">${esc(typeof seoName === "function" ? seoName(u.replace(/^https?:\/\/[^/]+/, "")) : u)}</a><small>${esc(u.replace(/^https?:\/\/[^/]+/, ""))} · ${esc(conKind(u))}</small></span>
          <span class="cv">${s === "wait" ? "확인 전" : esc(CON_COV[r.coverage] || r.coverage || r.err || "")}<small>${s === "wait" ? "" : `확인 ${dt2(r.checked_at)} · 구글 방문 ${dt2(r.last_crawl)}`}</small></span>
          <span>${s !== "ok" ? `<a class="btn sm" href="${gscLink(u)}" target="_blank" rel="noopener">요청 ↗</a>` : ""}<button class="btn sm" data-crecheck="${esc(u)}" title="다시 확인">↻</button></span></div>`; }).join("") || `<p class="hint">해당하는 페이지가 없어요.</p>`}</div>
      ${list.length > CON.n ? `<button class="btn sm" data-cmore>더 보기 (${list.length - CON.n})</button>` : ""}
    </div>`;
  el.querySelectorAll("[data-cf]").forEach(b => b.onclick = () => { CON.f = b.dataset.cf; CON.n = 100; conDraw(); });
  el.querySelectorAll("[data-ckind]").forEach(b => b.onclick = e => { e.preventDefault(); CON.kind = CON.kind === b.dataset.ckind ? "" : b.dataset.ckind; CON.n = 100; conDraw(); });
  el.querySelectorAll("[data-cmore]").forEach(b => b.onclick = () => { CON.n += 200; conDraw(); });
  const inspect = async u => { try { const d = await conGsc({ action: "inspect", url: u }); if (d.error) throw new Error(d.error === "setup" ? "서치 콘솔 연결(gsc) 설정을 먼저 끝내 주세요" : d.error); CON.rows.set(d.row.url, d.row); return d.row; } catch (e) { return { url: u, err: /inspect|action/.test(e.message) ? "gsc 기능을 새 코드로 다시 올려 주세요" : e.message }; } };
  el.querySelectorAll("[data-cact=insp]").forEach(b => b.onclick = async () => { let u = document.getElementById("conUrl").value.trim(); if (!u) return; if (u.startsWith("/")) u = "https://www.uncleday.com" + u; b.disabled = true; CON.insp = await inspect(u); conDraw(); });
  el.querySelectorAll("[data-crecheck]").forEach(b => b.onclick = async () => { b.disabled = true; b.textContent = "…"; await inspect(b.dataset.crecheck); conDraw(); });
  el.querySelectorAll("[data-cact=sweep]").forEach(b => b.onclick = async () => { CON.busy = true; conDraw(); try { const d = await conGsc({ action: "sweep", n: 30 }); toast(d.error ? d.error : `🔎 ${d.checked}개 확인했어요${d.stop ? " · " + d.stop : ""} · 남은 것 ${d.left}개`, 4000); } catch (e) { toast(/sweep|action/.test(e.message) ? "gsc 기능을 새 코드로 다시 올려 주세요" : e.message, 5000); } CON.busy = false; CON.urls = null; conDraw(); });
}

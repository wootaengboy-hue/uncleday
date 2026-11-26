/* 🔍 업체 정보 검수 · 🖼️ 이미지 검수 — 포털 안 (#ptVerify · #ptImgqa) · universe48
 *
 * 업체 정보 검수 (캐시바이 '홈페이지' 버튼 + 비교 검수 방식)
 *   - 업체마다 [🌐 홈페이지] [📘 페이스북] [👁 엉클데이 페이지] 버튼 → 원문과 나란히 보며 확인
 *   - '모아 온 정보'(홈페이지 · 공개 검색 결과에서 뽑은 영업시간 · 주소 · 메뉴 가격) | '엉클데이 지금' 을 비교
 *     → 항목마다 [넣기] → 다 봤으면 [검수 완료]
 *   - 모아 온 정보는 초안이에요. 사람이 [넣기]를 눌러야 손님 화면에 나가요
 *
 * 이미지 검수 (캐시바이 이미지 검수 방식)
 *   - 원본 | 작업본(크기 · 밝기 맞춤) | 실제 노출(손님 화면 모양) 3칸 비교 → 판정: 통과 · 문제 · 보류
 *   - 출처: 📷 현장(우리가 찍음) · 🤝 업체 제공 · 🌐 홈페이지 후보
 *   - 공개는 '통과' + (현장 사진 또는 업체가 사진 사용을 허락한 곳)만. 홈페이지 후보는 허락받기 전 보여 주기용
 *   - 🤖 AI 검사: 글자 · 워터마크 · 얼굴 · 흐림 · 과한 보정 등을 찾아 줘요 (판정은 사람이)
 *   - 지금 노출 중인데 출처 기록이 없는 사진은 '출처 확인 필요'로 따로 모아요
 */
const VF = { src: null, err: "", f: "todo", q: "", open: null };
const MQ = { list: null, err: "", shop: "", f: "todo", busy: {}, keep: new Set(), mode: "file", src: "", pasted: [] };   // keep: 방금 판정한 사진은 목록에서 바로 사라지지 않게
try { MQ.mode = sessionStorage.getItem("mqMode") || "file"; } catch (e) {}
try { const p = location.hash.slice(1).split("/"); if (p[0] === "home" && (p[1] === "verify" || p[1] === "imgqa") && p[2]) { if (p[1] === "verify") VF.open = decodeURIComponent(p[2]); else MQ.shop = decodeURIComponent(p[2]); } } catch (e) {}

const vfTx = n => n && typeof n === "object" ? (n.ko || n.en || n.vi || "") : String(n || "");
const vfMoney = v => (+v || 0).toLocaleString("ko-KR") + "동";
const vfShop = id => (typeof shops !== "undefined" ? shops : []).find(s => s.id === id);
const vfSrc = id => (VF.src || []).find(x => x.shop_id === id) || { shop_id: id, review: "none" };
const vfPage = s => `/s/${encodeURIComponent(s.id)}/`;
const vfName = s => (s.name && (s.name.ko || s.name.en)) || s.id;
const vfLinks = (s, x) => `${x.web ? `<a class="vf-lk" href="${esc(x.web)}" target="_blank" rel="noopener">🌐 홈페이지</a>` : ""}${x.fb ? `<a class="vf-lk fb" href="${esc(x.fb)}" target="_blank" rel="noopener">📘 페이스북</a>` : ""}<a class="vf-lk ud" href="${vfPage(s)}" target="_blank" rel="noopener">👁 엉클데이 페이지</a>`;
// "500,000 VND" · "500k" · "₫500.000" → 500000 (달러는 그대로 두고 표시만)
function vfVnd(p) {
  const t = String(p || "").toLowerCase(); if (!t || /usd|\$/.test(t)) return 0;
  const m = t.replace(/\s/g, "").match(/(\d[\d.,]*)(k|tr|triệu|trieu|million)?/); if (!m) return 0;
  let n = +m[1].replace(/[.,](?=\d{3}(\D|$))/g, "").replace(",", "."); if (!isFinite(n)) return 0;
  if (m[2] === "k") n *= 1000; else if (m[2]) n *= 1e6;
  return n >= 10000 && n < 1e9 ? Math.round(n) : 0;
}
const vfHours = h => { const m = String(h || "").match(/(\d{1,2})[:h.]?(\d{2})?\s*(?:am|AM)?\s*[-–~to]+\s*(\d{1,2})[:h.]?(\d{2})?\s*(pm|PM)?/); if (!m) return null;
  let a = +m[1], b = +m[3]; if (m[5] && b < 12) b += 12; if (b <= a && b < 12) b += 12; if (a > 23 || b > 24) return null;
  const z = (x, y) => String(x % 24).padStart(2, "0") + ":" + (y || "00"); return { open: z(a, m[2]), close: z(b, m[4]) }; };

async function vfLoad() {
  const r = await sb.from("shop_sources").select("*");
  if (r.error) { VF.err = /shop_sources|42P01|PGRST20|schema cache/.test((r.error.message || "") + (r.error.code || "")) ? "setup" : r.error.message; VF.src = []; }
  else { VF.err = ""; VF.src = r.data || []; }
  vfDraw(); if (typeof mqDraw === "function") mqDraw();
}
async function vfSave(id, patch, msg) {
  const cur = vfSrc(id); const row = { ...cur, ...patch, shop_id: id, updated_at: new Date().toISOString() };
  const r = await sb.from("shop_sources").upsert(row).select().single();
  if (r.error) return dbErr(r.error, "검수 저장");
  VF.src = (VF.src || []).filter(x => x.shop_id !== id).concat(r.data); if (msg) toast(msg); vfDraw(); if (typeof mqDraw === "function") mqDraw();
}
async function vfShopSave(s, msg) { try { await dbSaveShop(s); toast(msg); vfDraw(); } catch (e) { dbErr(e, "업체 저장"); } }

function vfDraw() {
  const el = document.getElementById("ptVerify"); if (!el) return;
  if (!VF.src) { el.innerHTML = `<p class="hint">불러오는 중…</p>`; vfLoad(); return; }
  if (VF.err === "setup") { el.innerHTML = `<div class="uni-err">먼저 Supabase SQL 편집기에서 <b>supabase/universe48.sql</b> 을 실행해 주세요. 홈페이지 · 페이스북 링크 41곳이 함께 들어가요.</div>`; return; }
  if (VF.err) { el.innerHTML = `<div class="uni-err">${esc(VF.err)}</div>`; return; }
  const S = (typeof shops !== "undefined" ? shops : []);   // 숨긴(공개 전 새) 업체도 검수할 수 있게
  const rows = S.map(s => ({ s, x: vfSrc(s.id) }));
  const has = x => x.crawled && ((x.crawled.menu || []).length || x.crawled.hours || x.crawled.address);
  const cnt = { all: rows.length, todo: rows.filter(r => r.x.review === "todo").length, done: rows.filter(r => r.x.review === "done").length,
    none: rows.filter(r => !r.x.web && !r.x.fb).length, photo: rows.filter(r => r.x.photo_ok).length };
  const F = { todo: r => r.x.review === "todo", done: r => r.x.review === "done", none: r => !r.x.web && !r.x.fb, all: () => true };
  const q = String(VF.q || "").toLowerCase();
  const list = rows.filter(F[VF.f] || F.all).filter(r => !q || [vfName(r.s), r.s.name.en, r.s.id].join(" ").toLowerCase().includes(q));
  el.innerHTML = `<div class="vf">
    <div class="vf-tiles"><div><small>전체 업체</small><b>${cnt.all}</b></div><div><small>검수 대기</small><b class="w">${cnt.todo}</b></div><div><small>검수 완료</small><b class="g">${cnt.done}</b></div><div><small>링크 없음 · 현장 확인</small><b>${cnt.none}</b></div><div><small>사진 사용 허락</small><b>${cnt.photo}</b></div></div>
    <div class="vf-auto">
      <div class="vf-auto-c"><b>📥 한꺼번에 가져오기</b><small>홈페이지 링크가 있는 업체를 차례로 가져와서 '다른 점'을 만들어 둬요 (한 곳에 30초쯤)</small>
        <div class="vf-get-r"><select id="vfBulkF">${[["todo", "검수 안 끝난 업체"], ["new", "아직 안 가져온 업체만"], ["all", "링크 있는 업체 전부"]].map(([k, t]) => `<option value="${k}" ${VF.bulkF === k ? "selected" : ""}>${t}</option>`).join("")}</select><button class="btn main sm" id="vfBulk" ${VF.bulk ? "disabled" : ""}>${VF.bulk ? `가져오는 중… ${VF.bulk.n}/${VF.bulk.t}` : "시작"}</button>${VF.bulk ? `<button class="btn sm" id="vfBulkX">멈추기</button>` : ""}</div></div>
      <div class="vf-auto-c"><b>＋ 링크로 새 업체 등록</b><small>홈페이지 주소 → 이름 · 주소 · 영업시간 · 메뉴 · 가격을 채운 '숨김' 업체가 만들어져요 → 검수 · 사진 후 공개</small>
        <div class="vf-get-r"><input id="vfNewUrl" placeholder="https://… (업체 홈페이지)"><select id="vfNewCity">${(typeof CITIES !== "undefined" ? CITIES : []).map(c => `<option value="${c.id}">${esc(c.name.ko)}</option>`).join("")}</select>
          <select id="vfNewCat">${(typeof CATEGORY_DETAIL !== "undefined" ? CATEGORY_DETAIL : []).map(c => `<option value="${c.id}">${esc(c.name.ko)}</option>`).join("")}</select><button class="btn main sm" id="vfNew" ${VF.busy ? "disabled" : ""}>${VF.busy === "new" ? "만드는 중…" : "만들기"}</button></div></div>
    </div>
    <div class="vf-bar">${[["todo", "검수 대기"], ["done", "완료"], ["none", "링크 없음"], ["all", "전체"]].map(([k, t]) => `<button class="chip ${VF.f === k ? "on" : ""}" data-vff="${k}">${t} ${k === "all" ? cnt.all : cnt[k]}</button>`).join("")}
      <input id="vfQ" placeholder="🔍 업체 이름" value="${esc(VF.q)}"></div>
    <div class="vf-list">${list.map(({ s, x }) => {
      const c = x.crawled || {}, nm = (c.menu || []).length;
      const st = x.review === "done" ? `<span class="vf-st g">✓ 검수 완료</span>` : x.review === "todo" ? `<span class="vf-st w">검수 대기</span>` : `<span class="vf-st">${x.web || x.fb ? "모아 온 정보 없음" : "링크 없음 · 현장 확인"}</span>`;
      return `<div class="vf-row ${VF.open === s.id ? "open" : ""}" data-vfid="${esc(s.id)}">
        <div class="vf-h" data-vfo="${esc(s.id)}"><div class="vf-nm"><b>${esc(vfName(s))}</b><small>${isPub(s) ? "" : "<em class='vf-hid'>숨김 · 공개 전</em> "}${esc(cityName(s.city))} · ${esc(catName(s.cat))}${s.name.en && s.name.en !== vfName(s) ? " · " + esc(s.name.en) : ""}</small></div>
          <div class="vf-lks">${vfLinks(s, x)}</div>
          <div class="vf-meta">${st}<small>${has(x) ? `모아 온 정보: ${c.hours ? "영업시간 · " : ""}${c.address ? "주소 · " : ""}메뉴 ${nm}개` : ""}${x.photo_ok ? " · 📷 사진 허락" : ""}</small></div><span class="vf-arr">${VF.open === s.id ? "▲" : "▼"}</span></div>
        ${VF.open === s.id ? vfDetail(s, x) : ""}</div>`; }).join("") || `<p class="hint" style="padding:14px">해당하는 업체가 없어요</p>`}</div></div>`;
  vfBind(el);
  if (VF.open) { const o = el.querySelector(`.vf-row.open`); if (o && VF._scroll !== VF.open) { VF._scroll = VF.open; setTimeout(() => o.scrollIntoView({ block: "start", behavior: "smooth" }), 80); } }
}

// 다른 점: 엉클데이 메뉴마다 짝을 찾아 가격이 다르거나 비어 있으면 보여 주고 [한 번에 반영]
function vfDiffs(s, menu) {
  return (s.menu || []).map((sm, j) => { const r = vfMatch(sm, menu); return r && r.v !== (+sm.price || 0) ? { j, sm, ...r } : null; }).filter(Boolean);
}
function vfDiffBox(s, menu) {
  if (!menu.length) return "";
  const d = vfDiffs(s, menu), priced = menu.filter(m => vfVnd(m.price)).length;
  const used = new Set((s.menu || []).map(sm => (vfMatch(sm, menu) || {}).i).filter(i => i != null));
  const extra = menu.map((m, i) => ({ m, i })).filter(o => vfVnd(o.m.price) && !used.has(o.i));
  return `<div class="vf-diff"><div class="vf-diff-h"><b>🔄 엉클데이와 다른 점</b><small>모아 온 메뉴 ${menu.length}개 중 가격 있는 것 ${priced}개 · 이름 · 시간이 비슷한 메뉴끼리 짝지었어요</small></div>
    ${d.length ? `<div class="vf-dtw"><table class="vf-dt"><tr><th></th><th>엉클데이 메뉴</th><th>지금</th><th>모아 온 가격</th><th>짝지은 메뉴 (원문)</th></tr>${d.map(x => `<tr><td><input type="checkbox" data-vfdf="${x.j}" checked></td><td>${esc(vfTx(x.sm.name))}${x.sm.min ? ` · ${x.sm.min}분` : ""}</td><td class="${x.sm.price ? "" : "none"}">${x.sm.price ? vfMoney(x.sm.price) : "가격 없음"}</td><td><b>${vfMoney(x.v)}</b></td><td><small>${esc(x.m.name)}${x.m.minutes ? ` · ${x.m.minutes}분` : ""} · ${esc(x.m.price)}</small></td></tr>`).join("")}</table></div>
      <div class="vf-diff-a"><button class="btn main sm" id="vfDiffGo">✓ 고른 ${d.length}개 가격 반영</button></div>` : `<p class="hint">${priced ? "짝지은 메뉴의 가격이 모두 같아요 ✓" : "모아 온 정보에 가격이 없어서 비교할 게 없어요 · 가격표를 캡처해서 붙여 넣어 보세요"}</p>`}
    ${extra.length ? `<div class="vf-extra"><small>엉클데이에 없는 메뉴 ${extra.length}개</small> ${extra.slice(0, 10).map(o => `<label><input type="checkbox" data-vfex="${o.i}"> ${esc(o.m.name_ko || o.m.name)}${o.m.minutes ? ` ${o.m.minutes}분` : ""} · ${vfMoney(vfVnd(o.m.price))}</label>`).join("")}<button class="btn sm" id="vfExGo">고른 메뉴 추가</button></div>` : ""}
    <div class="vf-diff-a"><button class="btn sm" id="vfReplace" title="엉클데이 메뉴를 모아 온 메뉴로 통째로 바꿔요">♻️ 메뉴를 모아 온 것으로 통째로 바꾸기</button><small class="hint">새로 등록하는 업체 · 엉클데이 메뉴가 너무 다를 때</small></div></div>`;
}
function vfDetail(s, x) {
  const c = x.crawled || {}, hrs = vfHours(c.hours), menu = c.menu || [];
  const cur = `${s.open || "?"} ~ ${s.close || "?"}`;
  const addr = (s.address && (s.address.vi || s.address.en)) || "";
  const usd = menu.some(m => /usd|\$/i.test(m.price || ""));
  return `<div class="vf-d">
    <div class="vf-get">
      <div class="vf-get-r"><label>🌐 홈페이지</label><input id="vfWeb" value="${esc(x.web || "")}" placeholder="https://…"><label>📘 페이스북</label><input id="vfFb" value="${esc(x.fb || "")}" placeholder="https://facebook.com/…"><button class="btn sm" id="vfLinkSave">링크 저장</button></div>
      <div class="vf-get-r"><label>📥 가져올 주소</label><input id="vfUrl" value="${esc(VF.url && VF.url[s.id] || x.web || "")}" placeholder="홈페이지 · 메뉴(가격) 페이지 · 가격표 사진 주소"><button class="btn main sm" id="vfGet" ${VF.busy ? "disabled" : ""}>${VF.busy ? "가져오는 중… (30초쯤)" : "가져오기"}</button></div>
      <div class="vf-paste" id="vfPaste" tabindex="0">📋 가격표가 그림이거나 페이스북만 있으면 → 가격표를 <b>캡처해서 여기에 붙여 넣기</b> (Ctrl+V · 맥 ⌘+V) · 사진 파일을 끌어다 놓아도 돼요</div>
      <small class="hint">가져온 내용은 아래 '모아 온 정보'(초안)로 들어가요. 손님 화면에는 [넣기]를 누르거나 오른쪽 '엉클데이 지금'에서 직접 고쳐야 나가요.</small>
    </div>
    <div class="vf-src">${(c.src || []).length ? `출처: ${(c.src || []).slice(0, 4).map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\/(www\.)?/, "").slice(0, 48))}</a>`).join(" · ")}` : ""}${x.crawled_at ? ` · ${esc(String(x.crawled_at).slice(0, 10))} 모음` : ""}${c.note ? `<br><span class="hint">📝 ${esc(c.note)}</span>` : ""}</div>
    <div class="vf-cmp"><div class="vf-th"><span>항목</span><span>모아 온 정보 (원문)</span><span>엉클데이 지금</span><span></span></div>
      <div class="vf-tr"><span>🕘 영업시간</span><span>${esc(c.hours || "—")}</span><span>${esc(cur)}</span><span>${hrs && (hrs.open !== s.open || hrs.close !== s.close) ? `<button class="btn sm" data-vfhr="${hrs.open}-${hrs.close}">${hrs.open}~${hrs.close} 넣기</button>` : hrs ? "<i class='ok'>같아요</i>" : ""}</span></div>
      <div class="vf-tr"><span>📍 주소</span><span>${esc(c.address || "—")}</span><span>${esc(addr)}</span><span>${c.address && c.address.trim() !== addr.trim() ? `<button class="btn sm" data-vfad>주소 넣기</button>` : c.address ? "<i class='ok'>같아요</i>" : ""}</span></div>
      ${(c.features || []).length ? `<div class="vf-tr"><span>✨ 특징</span><span>${(c.features || []).map(esc).join(" · ")}</span><span>${(s.tags || []).map(t => "#" + esc(t.ko || t.en || "")).join(" ")}</span><span class="hint">태그는 업체 편집에서</span></div>` : ""}
    </div>
    ${vfDiffBox(s, menu)}
    <h5>💰 메뉴 · 가격 <small>모아 온 메뉴 ${menu.length}개 · 엉클데이 메뉴 ${(s.menu || []).length}개${usd ? " · 달러 가격은 동으로 바꿔서 직접 넣어 주세요" : ""}</small></h5>
    <div class="vf-menu">
      <div class="vf-mcol"><small>모아 온 정보</small>${menu.map((m, i) => { const v = vfVnd(m.price);
        return `<div class="vf-mi"><span><b>${esc(m.name)}</b>${m.name_ko ? ` <small class="ko">${esc(m.name_ko)}</small>` : ""}${m.minutes ? ` · ${m.minutes}분` : ""}</span><span class="pr">${esc(m.price || "가격 없음")}</span>
          <span class="vf-mact">${v ? `<select data-vfto="${i}"><option value="">어디에 넣을까요?</option>${(s.menu || []).map((x, j) => `<option value="${j}" ${vfGuess(x, m) ? "selected" : ""}>${esc(vfTx(x.name).slice(0, 34))}${x.min ? " · " + x.min + "분" : ""}${x.price ? " · " + vfMoney(x.price) : " · 가격 없음"}</option>`).join("")}<option value="new">＋ 새 메뉴로 추가</option></select><button class="btn sm" data-vfmi="${i}">${vfMoney(v)} 넣기</button>` : ""}</span></div>`; }).join("") || `<p class="hint">모아 온 메뉴가 없어요${x.fb && !x.web ? " · 페이스북만 있는 곳은 사람이 보고 넣어 주세요" : ""}</p>`}</div>
      <div class="vf-mcol"><small>엉클데이 지금 <span class="hint">· 숫자를 바로 고치면 저장돼요 (동 · 분)</span></small>${(s.menu || []).map((m, j) => `<div class="vf-mi ed"><span><b>${esc(vfTx(m.name))}</b></span>
          <span class="vf-ed"><input type="number" min="0" step="1" data-vfmin="${j}" value="${m.min || ""}" placeholder="분" aria-label="시간(분)">분 <input type="number" min="0" step="1000" data-vfpr="${j}" value="${m.price || ""}" placeholder="가격 없음" aria-label="가격(동)" class="${m.price ? "" : "none"}">동</span></div>`).join("") || `<p class="hint">메뉴가 없어요</p>`}
        <div class="vf-hr"><label>🕘 영업시간</label><input type="time" id="vfOpen" value="${esc(s.open || "")}"> ~ <input type="time" id="vfClose" value="${esc(s.close || "")}"></div></div>
    </div>
    <div class="vf-foot">
      <label class="vf-ph"><input type="checkbox" id="vfPh" ${x.photo_ok ? "checked" : ""}> 📷 업체가 사진 사용을 허락했어요</label><input id="vfPhN" placeholder="허락 받은 방법 · 날짜 (예: 11/26 잘로로 동의)" value="${esc(x.photo_note || "")}">
      <span style="flex:1"></span>
      <button class="btn" data-vfimg>🖼️ 이 업체 사진 검수</button>
      ${x.review === "done" ? `<button class="btn" data-vfrv="todo">다시 검수 대기로</button>` : `<button class="btn main" data-vfrv="done">✓ 검수 완료</button>`}
    </div></div>`;
}
// 시간 · 이름이 비슷한 메뉴를 미리 골라 둬요
// 메뉴 짝 찾기: 같은 뜻 낱말(아로마 = aroma …)이 겹치고 시간이 맞으면 같은 메뉴로 봐요
const VF_KW = [["aroma", "아로마", "tinh dầu", "oil"], ["hot stone", "핫스톤", "đá nóng", "bazan", "stone"], ["thai", "타이", "건식", "dry", "khô"], ["bamboo", "대나무", "tre"],
  ["pregnan", "임산부", "산전", "bầu"], ["kid", "키즈", "아동", "trẻ em", "child"], ["foot", "발", "chân", "reflex"], ["four hand", "포핸드", "4 tay", "bốn tay"],
  ["swedish", "스웨디시", "thụy điển"], ["scrub", "스크럽", "tẩy"], ["facial", "페이셜", "얼굴", "mặt", "skin care"], ["sauna", "사우나", "xông"], ["head", "헤드", "두피", "샴푸", "shampoo", "gội"],
  ["nail", "네일", "móng"], ["gel", "젤"], ["pedi", "페디"], ["signature", "시그니처"], ["vietnam", "베트남", "traditional", "전통"], ["deep", "딥티슈"], ["sport", "스포츠"], ["package", "패키지", "combo", "gói"],
  ["nose", "rhino", "코"], ["facelift", "face lift", "안면거상", "smas"], ["eyelid", "blephar", "쌍꺼풀", "눈", "mí"], ["brow", "눈썹", "이마", "forehead"], ["breast", "가슴", "ngực"],
  ["lipo", "지방흡입", "hút mỡ"], ["fat graft", "지방이식", "fat transfer"], ["chin", "턱"], ["botox", "보톡스"], ["filler", "필러"], ["consult", "상담"], ["laser", "레이저"], ["acne", "여드름"]];
const vfKeys = t => { const x = String(t || "").toLowerCase(); return VF_KW.map((g, i) => g.some(k => x.includes(k)) ? i : -1).filter(i => i >= 0); };
function vfMatch(sm, menu) {   // 엉클데이 메뉴 하나 → 모아 온 메뉴 중 가장 잘 맞는 것 (가격 있는 것만)
  const a = vfKeys([vfTx(sm.name), sm.name && sm.name.en, sm.name && sm.name.vi].join(" ")); if (!a.length) return null;
  let best = null, bs = 0;
  menu.forEach((m, i) => { if (!vfVnd(m.price)) return; const b = vfKeys([m.name, m.name_ko].join(" ")); const hit = a.filter(k => b.includes(k)).length; if (!hit) return;
    let sc = hit * 10 - a.filter(k => !b.includes(k)).length * 20 - b.filter(k => !a.includes(k)).length * 3; /* 아동 아로마 ≠ 아로마 */ if (sm.min && m.minutes) sc += +sm.min === +m.minutes ? 6 : -4; if (sc > bs) { bs = sc; best = i; } });
  return best == null ? null : { i: best, m: menu[best], v: vfVnd(menu[best].price) };
}
function vfGuess(x, m) { return !x.price && !!vfMatch(x, [m]); }

function vfBind(el) {
  const bk = el.querySelector("#vfBulk"); if (bk) bk.onclick = () => { VF.bulkF = el.querySelector("#vfBulkF").value; vfBulk(VF.bulkF); };
  const bx = el.querySelector("#vfBulkX"); if (bx) bx.onclick = () => { if (VF.bulk) VF.bulk.stop = 1; };
  const nw = el.querySelector("#vfNew"); if (nw) nw.onclick = () => vfNewShop(el.querySelector("#vfNewUrl").value.trim(), el.querySelector("#vfNewCity").value, el.querySelector("#vfNewCat").value);

  el.querySelectorAll("[data-vff]").forEach(b => b.onclick = () => { VF.f = b.dataset.vff; vfDraw(); });
  const q = el.querySelector("#vfQ"); if (q) q.oninput = () => { VF.q = q.value; const p = q.selectionStart; vfDraw(); const n = document.getElementById("vfQ"); n.focus(); n.setSelectionRange(p, p); };
  el.querySelectorAll("[data-vfo]").forEach(h => h.onclick = e => { if (e.target.closest("a")) return; VF.open = VF.open === h.dataset.vfo ? null : h.dataset.vfo; vfDraw(); });
  const row = el.querySelector(".vf-row.open"); if (!row) return;
  const id = row.dataset.vfid, s = vfShop(id), x = vfSrc(id), c = x.crawled || {};
  const hr = row.querySelector("[data-vfhr]"); if (hr) hr.onclick = () => { const [o, cl] = hr.dataset.vfhr.split("-"); s.open = o; s.close = cl; vfShopSave(s, `영업시간을 ${o}~${cl} 로 바꿨어요`); };
  const ad = row.querySelector("[data-vfad]"); if (ad) ad.onclick = () => { s.address = { ko: c.address, en: c.address, vi: c.address }; vfShopSave(s, "주소를 바꿨어요"); };
  row.querySelectorAll("[data-vfmi]").forEach(b => b.onclick = () => {
    const i = +b.dataset.vfmi, m = (c.menu || [])[i], v = vfVnd(m.price), to = row.querySelector(`[data-vfto="${i}"]`).value;
    if (!to) return toast("어느 메뉴에 넣을지 골라 주세요");
    if (to === "new") { s.menu = (s.menu || []).concat({ name: { ko: m.name_ko || m.name, en: m.name, vi: m.name }, min: +m.minutes || 0, price: v }); vfShopSave(s, `‘${m.name}’ 를 새 메뉴로 넣었어요 · 한국어 이름은 업체 편집에서 다듬어 주세요`); }
    else { const t = s.menu[+to]; t.price = v; if (!t.min && m.minutes) t.min = +m.minutes; vfShopSave(s, `${vfTx(t.name)} 가격을 ${vfMoney(v)} 로 넣었어요`); }
  });
  const ph = row.querySelector("#vfPh"), pn = row.querySelector("#vfPhN");
  if (ph) ph.onchange = () => vfSave(id, { photo_ok: ph.checked, photo_note: pn.value.trim() || null }, ph.checked ? "사진 사용 허락으로 표시했어요 · 통과한 사진이 공개될 수 있어요" : "사진 허락을 껐어요 · 업체 제공 · 홈페이지 사진은 공개 안 돼요");
  if (pn) pn.onchange = () => vfSave(id, { photo_note: pn.value.trim() || null }, "메모를 저장했어요");
  // 링크 저장
  const ls = row.querySelector("#vfLinkSave"); if (ls) ls.onclick = () => { const w = row.querySelector("#vfWeb").value.trim(), f = row.querySelector("#vfFb").value.trim();
    if ([w, f].some(u => u && !/^https?:\/\/\S+$/.test(u))) return toast("링크는 https:// 로 시작해야 해요");
    vfSave(id, { web: w || null, fb: f || null }, "링크를 저장했어요 · 손님 화면의 직원 버튼에도 바로 나와요"); };
  // 가져오기 (주소 → 서버가 읽고 AI 가 정리)
  const gu = row.querySelector("#vfUrl"); if (gu) gu.oninput = () => { VF.url = VF.url || {}; VF.url[id] = gu.value; };
  const gb = row.querySelector("#vfGet"); if (gb) gb.onclick = () => { const u = gu.value.trim(); if (!/^https?:\/\/\S+$/.test(u)) return toast("가져올 주소(https://…)를 넣어 주세요"); vfExtract(s, u); };
  // 가격표 캡처 붙여넣기 · 끌어다 놓기 → 저장소에 올리고 그 사진에서 가져오기
  const pz = row.querySelector("#vfPaste");
  if (pz) {
    const go = async f => { if (!f || !/^image\//.test(f.type)) return toast("사진만 붙여 넣을 수 있어요");
      try { toast("가격표 사진을 올리는 중…"); const u = await mqPut(await mqShrink(f, 2400), `media/${id}/price-${Date.now().toString(36)}.jpg`); vfExtract(s, u, true); } catch (e) { dbErr(e, "가격표 올리기"); } };
    pz.onpaste = e => { const it = [...((e.clipboardData || {}).items || [])].find(i => /^image\//.test(i.type)); e.preventDefault(); if (!it) return toast("붙여 넣은 것 중에 사진이 없어요"); go(it.getAsFile()); };
    pz.ondragover = e => { e.preventDefault(); pz.classList.add("over"); }; pz.ondragleave = () => pz.classList.remove("over");
    pz.ondrop = e => { e.preventDefault(); pz.classList.remove("over"); go([...e.dataTransfer.files][0]); };
  }
  // 다른 점 한 번에 반영
  const dg = row.querySelector("#vfDiffGo"); if (dg) dg.onclick = () => {
    const d = vfDiffs(s, c.menu || []).filter(x => (row.querySelector(`[data-vfdf="${x.j}"]`) || {}).checked);
    if (!d.length) return toast("반영할 메뉴를 골라 주세요");
    d.forEach(x => { s.menu[x.j].price = x.v; if (!s.menu[x.j].min && x.m.minutes) s.menu[x.j].min = +x.m.minutes; });
    vfShopSave(s, `${d.length}개 메뉴 가격을 반영했어요 · 손님 화면에 바로 나가요`); };
  const eg = row.querySelector("#vfExGo"); if (eg) eg.onclick = () => {
    const add = [...row.querySelectorAll("[data-vfex]")].filter(i => i.checked).map(i => (c.menu || [])[+i.dataset.vfex]).filter(Boolean);
    if (!add.length) return toast("추가할 메뉴를 골라 주세요");
    s.menu = (s.menu || []).concat(add.map(m => ({ name: { ko: m.name_ko || m.name, en: m.name, vi: m.name }, min: +m.minutes || 0, price: vfVnd(m.price) })));
    vfShopSave(s, `메뉴 ${add.length}개를 추가했어요`); };
  const rp = row.querySelector("#vfReplace"); if (rp) rp.onclick = () => {
    const nm = (c.menu || []).filter(m => m.name); if (!nm.length) return toast("모아 온 메뉴가 없어요");
    confirmBox(`${vfName(s)} 메뉴 ${(s.menu || []).length}개를 모아 온 메뉴 ${nm.length}개로 바꿀까요?`, () => {
      s.menu = nm.map(m => ({ name: { ko: m.name_ko || m.name, en: m.name, vi: m.name }, min: +m.minutes || 0, price: vfVnd(m.price) }));
      vfShopSave(s, "메뉴를 통째로 바꿨어요 · 한국어 이름은 업체 편집에서 다듬어 주세요"); }, "지금 메뉴는 없어져요"); };
  // 엉클데이 지금: 가격 · 시간 · 영업시간 직접 고치기
  row.querySelectorAll("[data-vfpr],[data-vfmin]").forEach(inp => inp.onchange = () => {
    const j = +(inp.dataset.vfpr ?? inp.dataset.vfmin), t = s.menu[j], v = Math.max(0, Math.round(+inp.value || 0));
    if (inp.dataset.vfpr !== undefined) { if (v && v < 10000) return toast("가격은 동(VND)으로 넣어 주세요 (예: 550000)"); t.price = v; vfShopSave(s, `${vfTx(t.name)} 가격 ${v ? vfMoney(v) : "없음"} 저장`); }
    else { t.min = v; vfShopSave(s, `${vfTx(t.name)} ${v}분 저장`); }
  });
  const oo = row.querySelector("#vfOpen"), oc = row.querySelector("#vfClose");
  if (oo) [oo, oc].forEach(inp => inp.onchange = () => { if (!oo.value || !oc.value) return; s.open = oo.value; s.close = oc.value; vfShopSave(s, `영업시간 ${s.open}~${s.close} 저장`); });
  const rv = row.querySelector("[data-vfrv]"); if (rv) rv.onclick = () => vfSave(id, { review: rv.dataset.vfrv, reviewed_at: new Date().toISOString(), reviewed_by: ME.email }, rv.dataset.vfrv === "done" ? `${vfName(s)} 검수 완료` : "다시 검수 대기로 돌렸어요");
  const ig = row.querySelector("[data-vfimg]"); if (ig) ig.onclick = () => { MQ.shop = id; MQ.f = "all"; portalGo("imgqa"); mqDraw(); };
}

async function vfCall(url, shopName) {
  const { data: { session } } = await sb.auth.getSession();
  const r = await fetch(`${SUPA.url}/functions/v1/shop-extract`, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPA.key, Authorization: "Bearer " + (session && session.access_token) },
    body: JSON.stringify({ url, shop: shopName || "" }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || (r.status === 404 ? "Edge Function 'shop-extract' 을 먼저 배포해 주세요" : "error " + r.status));
  return j;
}
// 새로 가져온 게 비어 있으면 예전에 모은 걸 지우지 않아요 (메뉴 0개 · 영업시간 없음 → 예전 것 유지)
function vfMerge(prev, n) {
  const keep = []; const o = { ...n };
  if (!(n.menu || []).length && (prev.menu || []).length) { o.menu = prev.menu; keep.push(`메뉴 ${prev.menu.length}개`); }
  ["hours", "address", "phone"].forEach(k => { if (!n[k] && prev[k]) { o[k] = prev[k]; keep.push({ hours: "영업시간", address: "주소", phone: "전화" }[k]); } });
  if (!(n.features || []).length && (prev.features || []).length) o.features = prev.features;
  if (keep.length) { o.src = [...new Set((n.src || []).concat(prev.src || []))]; o.note = [n.note, `이번에 못 찾은 ${keep.join(" · ")} 은(는) 예전에 모은 것을 그대로 뒀어요`].filter(Boolean).join(" · "); }
  return o;
}
const vfCrawled = (j, url) => ({ hours: j.hours, address: j.address, phone: j.phone, menu: j.menu || [], features: j.features || [], note: j.note || "", src: j.src || [url] });
// 📥 한꺼번에: 링크 있는 업체를 차례로 가져와요 (멈추기 가능)
async function vfBulk(f) {
  const S = (typeof shops !== "undefined" ? shops : []).filter(s => { const x = vfSrc(s.id); return x.web && (f === "all" || (f === "todo" && x.review !== "done") || (f === "new" && !x.crawled)); });
  if (!S.length) return toast("가져올 업체가 없어요 (홈페이지 링크가 있는 업체만 돼요)");
  VF.bulk = { n: 0, t: S.length, ok: 0, bad: [] }; vfDraw();
  for (const s of S) {
    if (VF.bulk.stop) break;
    try { const x = vfSrc(s.id), j = await vfCall(x.web, vfName(s));
      await vfSave(s.id, { crawled: vfMerge(x.crawled || {}, vfCrawled(j, x.web)), crawled_at: new Date().toISOString(), review: x.review === "done" ? "done" : "todo" }); VF.bulk.ok++; }
    catch (e) { VF.bulk.bad.push(vfName(s)); if (/배포/.test(e.message)) { toast(e.message, 6000); break; } }
    VF.bulk.n++; vfDraw();
  }
  const b = VF.bulk; delete VF.bulk; vfDraw();
  toast(`${b.ok}곳 가져왔어요${b.bad.length ? ` · 실패 ${b.bad.length}곳 (${b.bad.slice(0, 4).join(", ")}${b.bad.length > 4 ? " …" : ""})` : ""} · 업체를 펼쳐 '다른 점'을 확인해 주세요`, 7000);
}
// ＋ 링크로 새 업체: 가져온 내용으로 '숨김' 업체를 만들어요 (손님에게 안 보임 → 검수 · 사진 · 공개는 사람이)
async function vfNewShop(url, city, cat) {
  if (!/^https?:\/\/\S+$/.test(url)) return toast("새 업체 홈페이지 주소(https://…)를 넣어 주세요");
  const dup = (VF.src || []).find(x => x.web && x.web.replace(/\/$/, "") === url.replace(/\/$/, ""));
  if (dup) { VF.open = dup.shop_id; VF.f = "all"; vfDraw(); return toast("이미 등록된 업체 링크예요 · 그 업체를 열었어요", 4500); }
  VF.busy = "new"; vfDraw();
  try {
    const j = await vfCall(url, "");
    const en = j.name || new URL(url).hostname.replace(/^www\./, "").split(".")[0];
    const base = String(en).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "shop";
    let id = base, k = 2; while (shops.some(x => x.id === id)) id = `${base}-${k++}`;
    const ad = j.address || "", hr = vfHours(j.hours) || {};
    const s = { id, cat, city, verified: false, name: { ko: j.name_ko || en, en, vi: en }, tags: [], desc: { ko: "", en: "", vi: "" }, address: { ko: ad, en: ad, vi: ad },
      open: hr.open || "", close: hr.close || "", menu: (j.menu || []).map(m => ({ name: { ko: m.name_ko || m.name, en: m.name, vi: m.name }, min: +m.minutes || 0, price: vfVnd(m.price) })) };
    META[id] = { published: false, sort: 999 };
    await dbSaveShop(s); shops.push(s);
    await vfSave(id, { web: url, crawled: vfCrawled(j, url), crawled_at: new Date().toISOString(), review: "todo" });
    delete VF.busy; VF.f = "todo"; VF.open = id; VF._scroll = null; vfDraw();
    toast(`‘${vfName(s)}’ 업체를 숨김으로 만들었어요 · 메뉴 ${s.menu.length}개 · 확인 후 업체 편집에서 공개해 주세요`, 7000);
  } catch (e) { delete VF.busy; vfDraw(); toast("새 업체 만들기 실패: " + e.message, 6000); }
}
// 📥 가져오기: Edge Function 'shop-extract' (홈페이지 · 메뉴 페이지 · 가격표 사진 → 영업시간 · 주소 · 메뉴 가격)
async function vfExtract(s, url, isImg) {
  VF.busy = 1; vfDraw();
  try {
    const { data: { session } } = await sb.auth.getSession();
    const r = await fetch(`${SUPA.url}/functions/v1/shop-extract`, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPA.key, Authorization: "Bearer " + (session && session.access_token) },
      body: JSON.stringify({ url, shop: vfName(s) }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || (r.status === 404 ? "Edge Function 'shop-extract' 을 먼저 배포해 주세요" : "error " + r.status));
    const prev = vfSrc(s.id).crawled || {};
    // 가격표 사진에서 가져오면 메뉴만 더하고, 페이지에서 가져오면 새로 바꿔요
    const c = isImg ? { ...prev, menu: (prev.menu || []).concat((j.menu || []).filter(m => !(prev.menu || []).some(o => o.name === m.name && o.minutes === m.minutes && o.price === m.price))), src: (prev.src || []).concat(j.src || []), note: [prev.note, j.note].filter(Boolean).join(" · ") }
      : vfMerge(prev, vfCrawled(j, url));
    delete VF.busy;
    await vfSave(s.id, { crawled: c, crawled_at: new Date().toISOString(), review: "todo" }, `가져왔어요 · 메뉴 ${(j.menu || []).length}개${j.hours ? " · 영업시간" : ""}${j.address ? " · 주소" : ""} — 비교해서 넣어 주세요`);
  } catch (e) { delete VF.busy; vfDraw(); toast("가져오기 실패: " + e.message, 6000); }
}

/* ===================== 🖼️ 이미지 검수 ===================== */
const MQ_SRC = { field: ["📷", "현장 사진", "우리가 찍음 · 공개 가능"], owner: ["🤝", "업체 제공", "사진 허락한 업체만 공개"], site: ["🌐", "홈페이지 · 캡처 후보", "허락 전 보여 주기용 · 공개 안 됨"] };
const MQ_ISS = { fake: "날조 · 과한 보정", distort: "왜곡 · 늘어남", text: "큰 글자 · 가격표", watermark: "워터마크 · 다른 로고", face: "사람 얼굴", body: "노출 · 선정적", blur: "흐림 · 어두움", stock: "스톡 사진 같음", off: "가게와 관계없음" };
const MQ_V = { none: ["판정 없음", ""], pass: ["✓ 통과", "g"], issue: ["⚠ 문제", "r"], hold: ["⏸ 보류", "w"] };
const mqCan = m => m.verdict === "pass" && m.source !== "site" && (m.source === "field" || vfSrc(m.shop_id).photo_ok);
const mqWhy = m => m.source === "site" ? "홈페이지 · 캡처 후보는 공개 안 돼요 (업체가 허락하면 출처를 '업체 제공'으로 바꿔요)" : m.verdict !== "pass" ? "판정이 '통과'여야 공개돼요" : !vfSrc(m.shop_id).photo_ok && m.source === "owner" ? "업체 사진 사용 허락이 필요해요 (업체 정보 검수에서 체크)" : "";

async function mqLoad() {
  const r = await sb.from("shop_media").select("*").order("created_at", { ascending: false }).limit(1000);
  if (r.error) { MQ.err = /shop_media|42P01|PGRST20|schema cache/.test((r.error.message || "") + (r.error.code || "")) ? "setup" : r.error.message; MQ.list = []; }
  else { MQ.err = ""; MQ.list = r.data || []; }
  if (!VF.src) await vfLoad(); else mqDraw();
}
function mqDraw() {
  const el = document.getElementById("ptImgqa"); if (!el) return;
  if (!MQ.list) { el.innerHTML = `<p class="hint">불러오는 중…</p>`; mqLoad(); return; }
  if (MQ.err === "setup") { el.innerHTML = `<div class="uni-err">먼저 Supabase SQL 편집기에서 <b>supabase/universe48.sql</b> 을 실행해 주세요.</div>`; return; }
  if (MQ.err) { el.innerHTML = `<div class="uni-err">${esc(MQ.err)}</div>`; return; }
  const S = (typeof shops !== "undefined" ? shops : []).filter(isPub);
  const L = MQ.list;
  // 지금 노출 중인데 기록이 없는 사진 (출처 확인 필요)
  const known = new Set(L.map(m => m.work_url).concat(L.map(m => m.orig_url)));
  const orphan = S.filter(s => s.img && !known.has(s.img));
  const live = S.filter(s => s.img && L.some(m => m.work_url === s.img && mqCan(m))).length;
  const cnt = { all: L.length, todo: L.filter(m => m.verdict === "none").length, pass: L.filter(m => m.verdict === "pass").length, issue: L.filter(m => m.verdict === "issue").length, hold: L.filter(m => m.verdict === "hold").length };
  const F = { todo: m => m.verdict === "none", pass: m => m.verdict === "pass", issue: m => m.verdict === "issue", hold: m => m.verdict === "hold", all: () => true };
  const list = L.filter(m => (F[MQ.f] || F.all)(m) || MQ.keep.has(m.id)).filter(m => !MQ.shop || m.shop_id === MQ.shop);
  const shopOpts = S.map(s => `<option value="${esc(s.id)}" ${MQ.shop === s.id ? "selected" : ""}>${esc(vfName(s))} · ${esc(cityName(s.city))}</option>`).join("");
  el.innerHTML = `<div class="mq">
    <div class="vf-tiles"><div><small>전체 사진</small><b>${cnt.all}</b></div><div><small>판정 대기</small><b class="w">${cnt.todo}</b></div><div><small>통과</small><b class="g">${cnt.pass}</b></div><div><small>문제 표시</small><b class="r">⚠ ${cnt.issue}</b></div><div><small>사진 공개 중인 업체</small><b>${live} / ${S.length}</b></div></div>
    ${orphan.length ? `<div class="mq-orph"><b>🔎 출처 확인 필요 ${orphan.length}곳</b> <small>지금 손님 화면에 나오는데 어디서 온 사진인지 기록이 없어요. 우리가 찍었거나 허락받은 사진이면 출처를 고르고, 아니면 내려 주세요.</small>
      <div class="mq-orl">${orphan.map(s => `<div class="mq-oi"><img src="${esc(s.img)}" alt="" loading="lazy"><b>${esc(vfName(s))}</b><div><select data-mqos="${esc(s.id)}"><option value="">출처 고르기…</option><option value="field">📷 현장 사진 (우리가 찍음)</option><option value="owner">🤝 업체 제공 · 허락</option></select><button class="btn sm" data-mqdown="${esc(s.id)}">내리기</button></div></div>`).join("")}</div></div>` : ""}
    <div class="mq-up">
      <div class="mq-modes">${[["file", "📁 파일 올리기"], ["paste", "📋 캡처 붙여넣기"], ["link", "🔗 이미지 링크"]].map(([k, t]) => `<button type="button" class="${MQ.mode === k ? "on" : ""}" data-mqmode="${k}">${t}</button>`).join("")}</div>
      <div class="mq-uprow"><select id="mqUpShop"><option value="">업체 고르기…</option>${shopOpts}</select><span class="mq-uplk" id="mqUpLinks"></span>
        <select id="mqUpSrc">${Object.entries(MQ_SRC).map(([k, [ic, nm]]) => `<option value="${k}" ${(MQ.src || (MQ.mode === "file" ? "field" : "site")) === k ? "selected" : ""}>${ic} ${nm}${k === "field" ? " (우리가 찍음)" : k === "owner" ? " (허락받음)" : " (공개 안 됨)"}</option>`).join("")}</select></div>
      ${MQ.mode === "file" ? `<label class="mq-drop" for="mqFile" id="mqDrop"><b>여기를 눌러 사진 고르기</b><small>또는 사진 파일을 여기로 끌어다 놓기 · 여러 장 · 한 번에 20장까지</small></label><input type="file" id="mqFile" accept="image/*" multiple hidden>`
      : MQ.mode === "paste" ? `<div class="mq-drop paste" id="mqPaste" tabindex="0"><b>여기를 누르고 Ctrl+V (맥은 ⌘+V)</b><small>홈페이지 · 페이스북 화면을 캡처(윈도우 Win+Shift+S · 맥 ⌘+Shift+4)한 뒤 붙여 넣어요 · 여러 번 붙여도 돼요</small>
          ${(MQ.pasted || []).length ? `<div class="mq-pv">${MQ.pasted.map((b, i) => `<span><img src="${b.url}" alt=""><button type="button" data-mqpx="${i}" aria-label="빼기">×</button></span>`).join("")}</div>` : ""}</div>
        ${(MQ.pasted || []).length ? `<div class="mq-uprow"><button class="btn main" id="mqPasteGo">붙여 넣은 ${MQ.pasted.length}장 검수에 올리기</button><button class="btn" id="mqPasteX">모두 비우기</button></div>` : ""}`
      : `<div class="mq-uprow"><input id="mqUrl" placeholder="이미지 주소 붙여넣기 (https://… .jpg · .png · .webp) · 여러 개면 줄바꿈이나 띄어쓰기로"><button class="btn main" id="mqUrlGo">가져와서 검수에 올리기</button></div>
        <small class="hint">사진 위에서 오른쪽 클릭 → '이미지 주소 복사'로 얻은 주소를 넣어요. 엉클데이 저장소로 복사해 와서 원본 · 작업본을 만들어요 (원래 주소도 함께 기록).</small>`}
      <small class="mq-rule">ℹ️ <b>홈페이지 후보</b>는 검수만 하고 공개되지 않아요. 업체가 허락하면 카드에서 출처를 <b>업체 제공</b>으로 바꾸면 공개할 수 있어요.</small>
    </div>
    <div class="vf-bar"><select id="mqShop"><option value="">모든 업체</option>${shopOpts}</select>${MQ.shop && vfShop(MQ.shop) ? `<span class="mq-uplk">${vfSrc(MQ.shop).web ? `<a class="vf-lk" href="${esc(vfSrc(MQ.shop).web)}" target="_blank" rel="noopener">🌐 홈페이지</a>` : ""}${vfSrc(MQ.shop).fb ? `<a class="vf-lk fb" href="${esc(vfSrc(MQ.shop).fb)}" target="_blank" rel="noopener">📘 페이스북</a>` : ""}</span>` : ""}
      ${[["todo", "판정 대기"], ["pass", "통과"], ["issue", "문제"], ["hold", "보류"], ["all", "전체"]].map(([k, t]) => `<button class="chip ${MQ.f === k ? "on" : ""}" data-mqf="${k}">${t} ${cnt[k]}</button>`).join("")}</div>
    <div class="mq-list">${list.map(mqCard).join("") || `<p class="hint" style="padding:16px">${MQ.shop ? "이 업체 사진이 아직 없어요 · 위에서 올려 주세요" : "사진이 없어요 · 위에서 올려 주세요"}</p>`}</div></div>`;
  mqBind(el);
}
function mqCard(m) {
  const s = vfShop(m.shop_id) || { id: m.shop_id, name: { ko: m.shop_id }, cat: "" }, x = vfSrc(m.shop_id), [ic, sn, sd] = MQ_SRC[m.source] || ["", m.source, ""];
  const can = mqCan(m), why = mqWhy(m), main = s.img && s.img === m.work_url;
  return `<div class="mq-card" data-mqid="${m.id}">
    <div class="mq-h"><b>${esc(vfName(s))}</b><a href="${vfPage(s)}" target="_blank" rel="noopener" title="엉클데이 페이지">🔗</a>${x.web ? `<a class="vf-lk" href="${esc(x.web)}" target="_blank" rel="noopener">🌐 홈페이지</a>` : ""}${x.fb ? `<a class="vf-lk fb" href="${esc(x.fb)}" target="_blank" rel="noopener">📘 페이스북</a>` : ""}
      <select class="mq-src" data-mqsrc title="${esc(sd)}">${Object.entries(MQ_SRC).map(([k, [i2, n2]]) => `<option value="${k}" ${m.source === k ? "selected" : ""}>${i2} ${n2}</option>`).join("")}</select><span class="vf-st ${MQ_V[m.verdict][1]}">${MQ_V[m.verdict][0]}</span>${main ? `<span class="vf-st g">★ 대표 사진 노출 중</span>` : ""}</div>
    <div class="mq-3">
      <div><small>원본</small><div class="mq-img chk">${m.orig_url ? `<img src="${esc(m.orig_url)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-wh>` : "<i>없음</i>"}</div><small class="mq-wh" data-whof="o"></small></div>
      <div><small>작업본</small><div class="mq-img chk">${m.work_url ? `<img src="${esc(m.work_url)}" alt="" loading="lazy" data-wh>` : `<i>작업본 없음 (예전에 주소만 저장한 후보)</i>`}</div><small class="mq-wh" data-whof="w"></small></div>
      <div><small>실제 노출 (손님 업체 화면)</small><div class="mq-live ${can ? "" : "off"}">${m.work_url ? `<div class="mq-lv"><img class="h" src="${esc(m.work_url)}" alt="" loading="lazy"><small>업체 상세 (16:9)</small></div><div class="mq-lv"><img class="c" src="${esc(m.work_url)}" alt="" loading="lazy"><small>목록 카드 (3:2)</small></div>${can ? "" : `<span class="mq-lock">🔒 아직 공개 안 됨</span>`}` : `<div class="mq-ph">${typeof catGroup === "function" && catGroup(s.cat) ? catGroup(s.cat).icon : "🖼️"}<span>예시 이미지가 나가요</span></div>`}</div><small class="mq-why">${can ? (main ? "대표 사진으로 노출 중" : "공개 가능 · [대표 사진으로]를 누르면 노출돼요") : esc(why)}</small></div>
    </div>
    <div class="mq-act">
      <div class="mq-iss">${Object.entries(MQ_ISS).map(([k, t]) => `<label class="${(m.issues || []).includes(k) ? "on" : ""}"><input type="checkbox" data-mqis="${k}" ${(m.issues || []).includes(k) ? "checked" : ""}>${t}</label>`).join("")}</div>
      ${m.note ? `<p class="mq-note">🤖 ${esc(m.note)}</p>` : ""}
      <div class="mq-btns">${m.orig_url && m.orig_url.includes("/object/public/images/") ? `<button class="btn sm" data-mqstamp title="원본에서 작업본을 다시 만들어요 (16:9 · 글자 · 로고 없이)">🔄 작업본 다시 만들기</button>` : ""}${m.work_url ? `<button class="btn sm" data-mqai ${MQ.busy[m.id] ? "disabled" : ""}>${MQ.busy[m.id] ? "검사 중…" : "🤖 AI 검사"}</button>` : ""}
        <button class="btn sm ${m.verdict === "pass" ? "main" : ""}" data-mqv="pass">✓ 통과</button><button class="btn sm ${m.verdict === "issue" ? "bad" : ""}" data-mqv="issue">⚠ 문제</button><button class="btn sm" data-mqv="hold">⏸ 보류</button>
        <span style="flex:1"></span>${main ? "" : can ? `<button class="btn sm main" data-mqmain>★ 대표 사진으로</button>` : `<span class="mq-nomain" title="${esc(why)}">★ 대표 사진으로 <em>— ${esc(why.replace(/ \(.*\)$/, ""))}</em></span>`}${main ? `<button class="btn sm" data-mqunmain>대표에서 내리기</button>` : ""}<button class="btn sm" data-mqdel title="기록 지우기">🗑</button></div>
    </div></div>`;
}

// 작업본: 긴 쪽 1600px · 정보(EXIF) 지움 · 살짝 밝기 맞춤 없이 원본 색 그대로 (과한 보정은 '날조'가 돼요)
function mqShrink(file, max) {
  return new Promise((ok, no) => { const img = new Image(); img.onload = () => {
    const k = Math.min(1, max / Math.max(img.width, img.height)), w = Math.round(img.width * k), h = Math.round(img.height * k);
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h; cv.getContext("2d").drawImage(img, 0, 0, w, h);
    cv.toBlob(b => b ? ok(b) : no(new Error("사진을 줄이지 못했어요")), "image/jpeg", 0.86); URL.revokeObjectURL(img.src); };
    img.onerror = () => no(new Error("사진을 열지 못했어요")); img.src = URL.createObjectURL(file); });
}
async function mqPut(blob, path) {
  const r = await sb.storage.from("images").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
  if (r.error) throw r.error; return sb.storage.from("images").getPublicUrl(path).data.publicUrl;
}
async function mqAdd(row) {
  const r = await sb.from("shop_media").insert({ ...row, created_by: ME.email }).select().single();
  if (r.error) throw r.error; MQ.list.unshift(r.data); return r.data;
}
async function mqUpd(m, patch, msg) {
  const r = await sb.from("shop_media").update({ ...patch, checked_at: new Date().toISOString(), checked_by: ME.email }).eq("id", m.id).select().single();
  if (r.error) return dbErr(r.error, "판정 저장");
  Object.assign(m, r.data); if (msg) toast(msg); mqDraw();
}
async function mqMain(m, on) {
  const s = vfShop(m.shop_id); if (!s) return;
  if (on) { s.img = m.work_url; s.imgPos = "50% 50%"; } else if (s.img === m.work_url) delete s.img;
  try { await dbSaveShop(s); toast(on ? "대표 사진으로 노출해요 (손님 화면 바로 · 검색엔진 페이지는 1시간 안)" : "대표 사진에서 내렸어요 · 예시 이미지가 나가요"); mqDraw(); } catch (e) { dbErr(e, "업체 저장"); }
}

// 사진 한 장 → 원본(긴 쪽 2400) · 작업본(1600) 저장 → 검수 목록에
// 🏷️ 작업본에 업체명 + 엉클데이 로고 넣기 (원본은 그대로 · 실제 노출은 작업본)
let MQ_LOGO = null;
const mqLogo = () => MQ_LOGO || (MQ_LOGO = new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("로고를 못 불러왔어요")); i.src = "images/logo-t.png"; }));
function mqLoadImg(src) { return new Promise((ok, no) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = () => no(new Error("사진을 열지 못했어요")); i.src = src; }); }
// 손님 화면은 사진을 잘라서 보여 줘요: 업체 상세 = 16:9 · 목록 카드 = 3:2 (가운데 기준)
//  → 작업본을 16:9 로 맞추고, 업체명 · 로고는 3:2 로 잘려도 남는 가운데 안쪽에 넣어요
async function mqStamp(blob, shopName, stamp = true) {
  const u = URL.createObjectURL(blob);
  try {
    const [img, logo] = await Promise.all([mqLoadImg(u), stamp ? mqLogo() : null]);
    // 16:9 로 가운데 자르기 (세로 사진은 위쪽 40% 지점 기준 — 간판 · 실내가 보통 위에 있어요)
    const R = 16 / 9; let sw = img.width, sh = img.height, sx = 0, sy = 0;
    if (sw / sh > R) { sw = Math.round(sh * R); sx = Math.round((img.width - sw) / 2); } else { sh = Math.round(sw / R); sy = Math.round((img.height - sh) * (img.height > img.width ? 0.4 : 0.5)); }
    const w = Math.min(1600, sw), h = Math.round(w / R), cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const x = cv.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    if (!stamp) return await new Promise((ok, no) => cv.toBlob(b => b ? ok(b) : no(new Error("작업본을 만들지 못했어요")), "image/jpeg", 0.86));
    const safeW = h * 1.5, safeL = (w - safeW) / 2, safeR = safeL + safeW;   // 3:2 카드로 잘려도 남는 곳
    const u0 = h / 100, pad = 4 * u0;
    const g = x.createLinearGradient(0, h * 0.68, 0, h); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.6)");
    x.fillStyle = g; x.fillRect(0, h * 0.68, w, h * 0.32);
    // 오른쪽 아래 로고 (하얀 바탕)
    const lh = 9 * u0, lw = lh * logo.width / logo.height, bp = 1.6 * u0;
    const bw = lw + bp * 2, bh = lh + bp * 1.6, bx = safeR - pad - bw, by = h - pad - bh, r = 1.8 * u0;
    x.fillStyle = "rgba(255,255,255,.93)"; x.beginPath(); x.moveTo(bx + r, by); x.arcTo(bx + bw, by, bx + bw, by + bh, r); x.arcTo(bx + bw, by + bh, bx, by + bh, r); x.arcTo(bx, by + bh, bx, by, r); x.arcTo(bx, by, bx + bw, by, r); x.fill();
    x.drawImage(logo, bx + bp, by + bp * 0.8, lw, lh);
    // 왼쪽 아래 업체명 (로고와 같은 줄 가운데)
    const F = s => `800 ${s}px "Pretendard","Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif`;
    const maxW = bx - (safeL + pad) - 2 * u0; let fs = 6.2 * u0; x.font = F(fs);
    while (x.measureText(shopName).width > maxW && fs > 3.4 * u0) { fs -= 0.25 * u0; x.font = F(fs); }
    x.fillStyle = "#fff"; x.shadowColor = "rgba(0,0,0,.6)"; x.shadowBlur = 1.4 * u0; x.textBaseline = "middle";
    x.fillText(shopName, safeL + pad, by + bh / 2, maxW);
    return await new Promise((ok, no) => cv.toBlob(b => b ? ok(b) : no(new Error("작업본을 만들지 못했어요")), "image/jpeg", 0.86));
  } finally { URL.revokeObjectURL(u); }
}
const mqStampOn = () => false;   // 업체명 · 로고 넣기는 껐어요 (11/26 · AI 가 우리 로고를 워터마크로 봐서 통과가 막혔어요) — 16:9 맞춤만 해요

async function mqUpOne(file, p, from) {
  const tag = `media/${p.shop}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  let [o, w] = await Promise.all([mqShrink(file, 2400), mqShrink(file, 1600)]);
  { const s = vfShop(p.shop); try { w = await mqStamp(w, s ? vfName(s) : p.shop, mqStampOn()); } catch (e) { toast("작업본을 다듬지 못해 원래 사진으로 올려요: " + e.message, 4000); } }
  const [ou, wu] = await Promise.all([mqPut(o, tag + "-o.jpg"), mqPut(w, tag + "-w.jpg")]);
  return mqAdd({ shop_id: p.shop, source: p.src, orig_url: ou, work_url: wu, note: from ? (/^https?:/.test(from) ? "원래 주소: " + from : from) : null });
}
async function mqUpFiles(files, p, from) {
  let n = 0;
  for (const f of files.slice(0, 20)) { try { await mqUpOne(f, p, from); n++; } catch (e) { dbErr(e, `${f.name} 올리기`); } }
  if (files.length > 20) toast("한 번에 20장까지 올려요 · 나머지는 다시 올려 주세요", 4000);
  if (n) { toast(`${n}장 올렸어요 · 판정해 주세요`); MQ.shop = p.shop; MQ.f = "all"; mqDraw(); }
}
// 링크 → 사진 파일: 먼저 브라우저에서 바로, 막히면(다른 사이트 보안) 서버(media-check)가 대신 가져와요
async function mqFetch(u) {
  try { const r = await fetch(u, { mode: "cors" }); if (r.ok) { const b = await r.blob(); if (/^image\//.test(b.type)) return b; } } catch (e) {}
  const { data: { session } } = await sb.auth.getSession();
  const r = await fetch(`${SUPA.url}/functions/v1/media-check`, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPA.key, Authorization: "Bearer " + (session && session.access_token) }, body: JSON.stringify({ fetch: u }) });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || (r.status === 404 ? "Edge Function 'media-check' 배포가 필요해요" : "error " + r.status)); }
  const b = await r.blob(); if (!/^image\//.test(b.type)) throw new Error("사진 파일이 아니에요"); return b;
}
function mqBind(el) {
  el.querySelectorAll("[data-mqf]").forEach(b => b.onclick = () => { MQ.f = b.dataset.mqf; MQ.keep.clear(); mqDraw(); });
  const sh = el.querySelector("#mqShop"); if (sh) sh.onchange = () => { MQ.shop = sh.value; if (MQ.shop) MQ.f = "all"; mqDraw(); };   // 업체를 고르면 그 업체 사진은 판정과 상관없이 전부 보여요
  if (MQ.shop) { const u = el.querySelector("#mqUpShop"); if (u) u.value = MQ.shop; }
  // 사진 크기 표시
  el.querySelectorAll("img[data-wh]").forEach(im => { const f = () => { const w = im.closest("div").parentElement.querySelector(".mq-wh"); if (w && im.naturalWidth) w.textContent = `${im.naturalWidth}×${im.naturalHeight}${im.naturalWidth < 800 ? " · 작아요" : ""}`; }; if (im.complete) f(); else im.onload = f; });
  el.querySelectorAll("[data-mqmode]").forEach(b => b.onclick = () => { MQ.mode = b.dataset.mqmode; MQ.src = ""; try { sessionStorage.setItem("mqMode", MQ.mode); } catch (e) {} mqDraw(); });
  const st = el.querySelector("#mqStampOn"); if (st) st.onchange = () => { try { localStorage.setItem("mqStamp", st.checked ? "1" : "0"); } catch (e) {} };
  const us = el.querySelector("#mqUpSrc"); if (us) us.onchange = () => { MQ.src = us.value; };
  const us2 = el.querySelector("#mqUpShop");
  const upLinks = () => { const b = el.querySelector("#mqUpLinks"); if (!b) return; const id = us2.value, s2 = vfShop(id), x2 = vfSrc(id);
    b.innerHTML = !id || !s2 ? "" : `${x2.web ? `<a class="vf-lk" href="${esc(x2.web)}" target="_blank" rel="noopener">🌐 홈페이지</a>` : ""}${x2.fb ? `<a class="vf-lk fb" href="${esc(x2.fb)}" target="_blank" rel="noopener">📘 페이스북</a>` : ""}<a class="vf-lk ud" href="${vfPage(s2)}" target="_blank" rel="noopener">👁 엉클데이</a>${!x2.web && !x2.fb ? `<span class="hint">링크 없음 · 업체 정보 검수에서 넣어요</span>` : ""}`; };
  if (us2) { if (MQ.upShop) us2.value = MQ.upShop; us2.onchange = () => { MQ.upShop = us2.value; upLinks(); }; upLinks(); }
  const pick = () => { const shop = el.querySelector("#mqUpShop").value, src = el.querySelector("#mqUpSrc").value;
    if (!shop) { toast("어느 업체 사진인지 먼저 골라 주세요"); el.querySelector("#mqUpShop").focus(); return null; }
    if (src === "owner" && !vfSrc(shop).photo_ok) toast("이 업체는 아직 사진 허락 표시가 없어요 · 올릴 수는 있지만 허락 전엔 공개 안 돼요", 4500);
    return { shop, src }; };
  // ① 파일 (고르기 · 끌어다 놓기)
  const fi = el.querySelector("#mqFile");
  if (fi) fi.onchange = async () => { const files = [...fi.files]; fi.value = ""; const p = pick(); if (p) mqUpFiles(files, p); };
  const dz = el.querySelector("#mqDrop");
  if (dz && MQ.mode === "file") {
    dz.ondragover = e => { e.preventDefault(); dz.classList.add("over"); }; dz.ondragleave = () => dz.classList.remove("over");
    dz.ondrop = e => { e.preventDefault(); dz.classList.remove("over"); const files = [...e.dataTransfer.files].filter(f => /^image\//.test(f.type)); if (!files.length) return toast("사진 파일만 올릴 수 있어요"); const p = pick(); if (p) mqUpFiles(files, p); };
  }
  // ② 캡처 붙여넣기
  const pz = el.querySelector("#mqPaste");
  if (pz) {
    pz.onpaste = e => { const items = [...(e.clipboardData || {}).items || []].filter(i => /^image\//.test(i.type)); e.preventDefault();
      if (!items.length) return toast("붙여 넣은 것 중에 사진이 없어요 · 화면을 캡처한 뒤 붙여 넣어 주세요");
      items.forEach(i => { const f = i.getAsFile(); if (f) MQ.pasted.push({ file: f, url: URL.createObjectURL(f) }); });
      mqDraw(); const n = document.getElementById("mqPaste"); if (n) n.focus(); };
    pz.onclick = () => pz.focus();
    if (MQ.mode === "paste" && !MQ.pasted.length) setTimeout(() => { try { pz.focus({ preventScroll: true }); } catch (e) {} }, 50);
  }
  el.querySelectorAll("[data-mqpx]").forEach(b => b.onclick = e => { e.stopPropagation(); const i = +b.dataset.mqpx; URL.revokeObjectURL(MQ.pasted[i].url); MQ.pasted.splice(i, 1); mqDraw(); });
  const pg = el.querySelector("#mqPasteGo"); if (pg) pg.onclick = async () => { const p = pick(); if (!p) return; const files = MQ.pasted.map((x, i) => new File([x.file], `capture-${i + 1}.png`, { type: x.file.type })); MQ.pasted.forEach(x => URL.revokeObjectURL(x.url)); MQ.pasted = []; await mqUpFiles(files, p, "캡처"); };
  const px = el.querySelector("#mqPasteX"); if (px) px.onclick = () => { MQ.pasted.forEach(x => URL.revokeObjectURL(x.url)); MQ.pasted = []; mqDraw(); };
  // ③ 이미지 링크
  const ug = el.querySelector("#mqUrlGo");
  if (ug) ug.onclick = async () => {
    const urls = el.querySelector("#mqUrl").value.split(/\s+/).map(x => x.trim()).filter(Boolean);
    if (!urls.length || urls.some(u => !/^https?:\/\/\S+$/.test(u))) return toast("이미지 주소(https://…)를 넣어 주세요");
    const p = pick(); if (!p) return;
    ug.disabled = true; ug.textContent = "가져오는 중…";
    let n = 0;
    for (const u of urls.slice(0, 20)) {
      try { const blob = await mqFetch(u); await mqUpOne(blob, p, u); n++; }
      catch (e) { toast(`가져오지 못했어요: ${u.slice(0, 60)} (${e.message})`, 5000); }
    }
    if (n) { toast(`${n}장 가져왔어요 · 판정해 주세요`); MQ.shop = p.shop; MQ.f = "all"; }
    mqDraw();
  };
  el.querySelectorAll("[data-mqos]").forEach(sel => sel.onchange = async () => {
    const id = sel.dataset.mqos, s = vfShop(id); if (!sel.value || !s) return;
    try { await mqAdd({ shop_id: id, source: sel.value, orig_url: s.img, work_url: s.img, verdict: "none" }); toast("출처를 기록했어요 · 판정해 주세요"); MQ.shop = id; MQ.f = "all"; mqDraw(); } catch (e) { dbErr(e, "출처 기록"); }
  });
  el.querySelectorAll("[data-mqdown]").forEach(b => b.onclick = () => { const s = vfShop(b.dataset.mqdown); if (!s) return;
    confirmBox(`${vfName(s)} 사진을 내릴까요?`, async () => { delete s.img; try { await dbSaveShop(s); toast("내렸어요 · 예시 이미지가 나가요"); mqDraw(); } catch (e) { dbErr(e, "업체 저장"); } }, "출처를 모르는 사진은 내리는 게 안전해요"); });
  el.querySelectorAll(".mq-card").forEach(card => {
    const m = MQ.list.find(x => x.id === +card.dataset.mqid); if (!m) return;
    card.querySelectorAll("[data-mqv]").forEach(b => b.onclick = () => {
      const v = b.dataset.mqv;
      if (v === "issue" && !(m.issues || []).length) return toast("어떤 문제인지 아래에서 하나 이상 골라 주세요");
      const hard = (m.issues || []).filter(k => ["fake", "watermark", "body", "off"].includes(k));
      if (v === "pass" && hard.length) return confirmBox(`‘${hard.map(k => MQ_ISS[k]).join(" · ")}’ 표시가 있어요. 표시를 지우고 통과할까요?`, () => {
        MQ.keep.add(m.id); mqUpd(m, { verdict: "pass", issues: (m.issues || []).filter(k => !hard.includes(k)) }, "표시를 지우고 ✓ 통과로 판정했어요"); }, "AI 표시는 참고예요. 직접 보고 문제없으면 통과해도 돼요");
      MQ.keep.add(m.id); mqUpd(m, { verdict: v }, `${MQ_V[v][0]} 으로 판정했어요 · 다른 탭을 누르면 '${{ pass: "통과", issue: "문제", hold: "보류" }[v]}' 탭에서 볼 수 있어요`);
      if (v !== "pass") { const s = vfShop(m.shop_id); if (s && s.img === m.work_url) mqMain(m, false); }
    });
    card.querySelectorAll("[data-mqis]").forEach(c => c.onchange = () => { const k = c.dataset.mqis; const is = new Set(m.issues || []); c.checked ? is.add(k) : is.delete(k); mqUpd(m, { issues: [...is] }); });
    const sc = card.querySelector("[data-mqsrc]"); if (sc) sc.onchange = () => {
      if (sc.value === "owner" && !vfSrc(m.shop_id).photo_ok) toast("업체 제공으로 바꿨어요 · 업체 정보 검수에서 '사진 사용 허락'을 체크해야 공개돼요", 4500);
      mqUpd(m, { source: sc.value }, `출처를 ${MQ_SRC[sc.value][1]} 로 바꿨어요`);
      if (sc.value === "site") { const s2 = vfShop(m.shop_id); if (s2 && s2.img === m.work_url) mqMain(m, false); } };
    const rs = card.querySelector("[data-mqstamp]"); if (rs) rs.onclick = async () => {
      rs.disabled = true; rs.textContent = "만드는 중…";
      try {
        const s2 = vfShop(m.shop_id), blob = await (await fetch(m.orig_url)).blob();
        const w = await mqStamp(await mqShrink(blob, 2400), s2 ? vfName(s2) : m.shop_id, mqStampOn());
        const wu = await mqPut(w, `media/${m.shop_id}/${Date.now().toString(36)}-w.jpg`), old = m.work_url, wasMain = s2 && s2.img === old;
        await mqUpd(m, { work_url: wu }, "작업본을 다시 만들었어요 (16:9 · 글자 · 로고 없이)");
        if (wasMain) { s2.img = wu; try { await dbSaveShop(s2); } catch (e) { dbErr(e, "대표 사진 바꾸기"); } }
        if (old && old.includes("/object/public/images/media/")) sb.storage.from("images").remove([old.split("/object/public/images/")[1]]);
      } catch (e) { dbErr(e, "작업본 다시 만들기"); mqDraw(); }
    };
    const ai = card.querySelector("[data-mqai]"); if (ai) ai.onclick = () => mqAi(m);
    const mm = card.querySelector("[data-mqmain]"); if (mm) mm.onclick = () => mqMain(m, true);
    const um = card.querySelector("[data-mqunmain]"); if (um) um.onclick = () => mqMain(m, false);
    const dl = card.querySelector("[data-mqdel]"); if (dl) dl.onclick = () => confirmBox("이 사진 기록을 지울까요?", async () => {
      const s = vfShop(m.shop_id); if (s && s.img === m.work_url) await mqMain(m, false);
      const r = await sb.from("shop_media").delete().eq("id", m.id); if (r.error) return dbErr(r.error, "지우기");
      const paths = [m.orig_url, m.work_url].filter(u => u && u.includes("/object/public/images/media/")).map(u => u.split("/object/public/images/")[1]);
      if (paths.length) await sb.storage.from("images").remove(paths);
      MQ.list = MQ.list.filter(x => x.id !== m.id); toast("지웠어요"); mqDraw(); }, "올린 사진 파일도 함께 지워요");
  });
}
async function mqAi(m) {
  MQ.busy[m.id] = 1; mqDraw();
  try {
    const s = vfShop(m.shop_id) || {}; const { data: { session } } = await sb.auth.getSession();
    const r = await fetch(`${SUPA.url}/functions/v1/media-check`, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPA.key, Authorization: "Bearer " + (session && session.access_token) },
      body: JSON.stringify({ url: m.work_url, shop: vfName(s), kind: typeof catName === "function" ? catName(s.cat) : "" }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || (r.status === 404 ? "Edge Function 'media-check' 을 먼저 배포해 주세요" : "error " + r.status));
    const is = [...new Set((m.issues || []).concat(j.issues || []))];
    await mqUpd(m, { issues: is, note: [((m.note || "").match(/^(원래 주소: \S+|캡처)/) || [])[1], j.what, j.note].filter(Boolean).join(" · ") }, j.issues && j.issues.length ? `🤖 문제 ${j.issues.length}개를 찾았어요 · 확인해 주세요` : "🤖 눈에 띄는 문제가 없어요 · 판정은 직접 해 주세요");
  } catch (e) { toast("AI 검사 실패: " + e.message, 5000); }
  delete MQ.busy[m.id]; mqDraw();
}

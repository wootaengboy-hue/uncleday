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
  let t = String(p || "").toLowerCase(); if (!t) return 0;
  if (/usd|\$/.test(t)) { const seg = t.split(/[\/|]/).find(x => !/usd|\$/.test(x) && /\d/.test(x)); if (!seg) return 0; t = seg; }   // "450.000/20$" → 450.000 (동 쪽만)
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
  // 검색: 베트남어 성조 · 띄어쓰기 · 하이픈 무시 (예: 'tam an' → Tâm An · tam-an-medical)
  const fold = t => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[\s\-_.·]+/g, "");
  const q = fold(VF.q);
  const list = rows.filter(F[VF.f] || F.all).filter(r => !q || fold([vfName(r.s), r.s.name.en, r.s.name.vi, r.s.id, vfSrc(r.s.id).web].join(" ")).includes(q));
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
          <div class="vf-meta">${st}<small>${has(x) ? `모아 온 정보: ${c.hours ? "영업시간 · " : ""}${c.address ? "주소 · " : ""}메뉴 ${nm}개` : ""}${x.photo_ok ? " · 📷 사진 허락" : ""}${c.draft && vfDirty(s, c.draft) ? ` · <b class="pend">✏️ 반영 대기 ${vfDirty(s, c.draft)}개</b>` : ""}</small></div><span class="vf-arr">${VF.open === s.id ? "▲" : "▼"}</span></div>
        ${VF.open === s.id ? vfDetail(s, x) : ""}</div>`; }).join("") || `<p class="hint" style="padding:14px">해당하는 업체가 없어요</p>`}</div></div>`;
  vfBind(el);
  if (VF.open) { const o = el.querySelector(`.vf-row.open`); if (o && VF._scroll !== VF.open) { VF._scroll = VF.open; setTimeout(() => o.scrollIntoView({ block: "start", behavior: "smooth" }), 80); } }
}

function vfDetail(s, x) { VF_SECPAL._m = new Map();   // 업체마다 분류 색을 처음부터
  const c = x.crawled || {}, hrs = vfHours(c.hours), menu = c.menu || [];
  const D = VF._D = vfDraftOf(s, c), tg = vfTargets(D, menu), ch = vfChanges(s, D), on = ch.filter(k => vfOn(D, k.key)).length;
  const addr = vfAddr(D.address), liveAddr = vfAddr(s.address), hc = ch.find(k => k.key === "hours"), ac = ch.find(k => k.key === "addr");
  const usd = menu.some(m => /usd|\$/i.test(m.price || ""));
  return `<div class="vf-d">
    <div class="vf-get">
      <div class="vf-get-r"><label>🌐 홈페이지</label><input id="vfWeb" value="${esc(x.web || "")}" placeholder="https://…"><label>📘 페이스북</label><input id="vfFb" value="${esc(x.fb || "")}" placeholder="https://facebook.com/…"><button class="btn sm" id="vfLinkSave">링크 저장</button></div>
      <div class="vf-get-r"><label>📥 가져올 주소</label><input id="vfUrl" value="${esc(VF.url && VF.url[s.id] || x.web || "")}" placeholder="홈페이지 · 메뉴(가격) 페이지 · 가격표 사진 주소"><button class="btn main sm" id="vfGet" ${VF.busy ? "disabled" : ""}>${VF.busy ? "가져오는 중… (30초쯤)" : "가져오기"}</button></div>
      <div class="vf-paste" id="vfPaste" tabindex="0">📋 가격표가 그림이거나 페이스북만 있으면 → 가격표를 <b>캡처해서 여기에 붙여 넣기</b> (Ctrl+V · 맥 ⌘+V) · 사진 파일을 끌어다 놓아도 돼요</div>
      <small class="hint">가져온 내용은 아래 왼쪽 '모아 온 정보'로 들어가요 → 틀린 건 고치고 골라서 ▶ 로 엉클데이 쪽에 보내요 → [✓ 검수 완료]를 누르면 손님 화면 · 업체 정보에 반영돼요.</small>
    </div>
    <div class="vf-src">${(c.src || []).length ? `출처: ${(c.src || []).slice(0, 4).map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\/(www\.)?/, "").slice(0, 48))}</a>`).join(" · ")}` : ""}${x.crawled_at ? ` · ${esc(String(x.crawled_at).slice(0, 10))} 모음` : ""}${c.note ? `<br><span class="hint">📝 ${esc(c.note)}</span>` : ""}</div>
    <div class="vf-cmp"><div class="vf-th"><span>항목</span><span>모아 온 정보 (원문)</span><span>엉클데이 (고치면 검수 완료 때 반영)</span><span>반영</span></div>
      <div class="vf-tr ${hc ? "chg" : ""}"><span>🕘 영업시간</span><span>${esc(c.hours || "—")}${hrs && (hrs.open !== D.open || hrs.close !== D.close) ? ` <button class="btn sm" data-vfhr="${hrs.open}-${hrs.close}">${hrs.open}~${hrs.close} 넣기</button>` : ""}</span>
        <span class="vf-tin"><input type="time" id="vfOpen" value="${esc(D.open || "")}"> ~ <input type="time" id="vfClose" value="${esc(D.close || "")}">${hc ? `<small class="was">지금 손님 화면: ${esc(s.open || "?")}~${esc(s.close || "?")}</small>` : ""}</span>
        <span>${hc ? `<label class="vf-on"><input type="checkbox" data-vfon="hours" ${vfOn(D, "hours") ? "checked" : ""}> 반영</label>` : hrs ? "<i class='ok'>같아요</i>" : ""}</span></div>
      <div class="vf-tr ${ac ? "chg" : ""}"><span>📍 주소</span><span>${esc(c.address || "—")}${c.address && c.address.trim() !== addr.trim() ? ` <button class="btn sm" data-vfad>이 주소 넣기</button>` : ""}</span>
        <span class="vf-tin"><input id="vfAddr" value="${esc(addr)}" placeholder="주소">${ac ? `<small class="was">지금 손님 화면: ${esc(liveAddr || "없음")}</small>` : ""}</span>
        <span>${ac ? `<label class="vf-on"><input type="checkbox" data-vfon="addr" ${vfOn(D, "addr") ? "checked" : ""}> 반영</label>` : c.address ? "<i class='ok'>같아요</i>" : ""}</span></div>
      ${(c.features || []).length ? `<div class="vf-tr"><span>✨ 특징</span><span>${(c.features || []).map(esc).join(" · ")}</span><span>${(s.tags || []).map(t => "#" + esc(t.ko || t.en || "")).join(" ")}</span><span class="hint">태그는 업체 편집에서</span></div>` : ""}
      ${(() => { const ab = c.about || null, dc = ch.find(k => k.key === "desc"), rc = ch.find(k => k.key === "reco"); if (!ab && !D.desc && !s.desc) return "";
        return `<div class="vf-tr ${dc ? "chg" : ""}"><span>📝 소개</span><span>${ab ? `${(ab.facts || []).length ? `<small class="vf-facts">${ab.facts.map(f => "· " + esc(f)).join("<br>")}</small>` : ""}${ab.desc_ko ? `<small class="was">엉클데이 말투로 새로 쓴 소개 (원문을 베끼지 않아요):</small>${esc(ab.desc_ko)} <button class="btn sm" data-vfab="desc">이 소개 넣기</button>` : ""}` : "—"}</span>
          <span class="vf-tin"><textarea id="vfDesc" rows="3" placeholder="소개 (한국어)">${esc((D.desc && D.desc.ko) || "")}</textarea>${dc ? `<small class="was">지금 손님 화면: ${esc(((s.desc && s.desc.ko) || "없음").slice(0, 80))}…</small>` : ""}</span>
          <span>${dc ? `<label class="vf-on"><input type="checkbox" data-vfon="desc" ${vfOn(D, "desc") ? "checked" : ""}> 반영</label>` : ""}</span></div>
        <div class="vf-tr ${rc ? "chg" : ""}"><span>👍 추천</span><span>${ab && ab.reco_ko ? `${esc(ab.reco_ko)} <button class="btn sm" data-vfab="reco">넣기</button>` : "—"}</span>
          <span class="vf-tin"><input id="vfReco" value="${esc((D.reco && D.reco.ko) || "")}" placeholder="이런 분께 좋아요 (한국어)">${rc ? `<small class="was">지금 손님 화면: ${esc((s.recommend && s.recommend.ko) || "없음")}</small>` : ""}</span>
          <span>${rc ? `<label class="vf-on"><input type="checkbox" data-vfon="reco" ${vfOn(D, "reco") ? "checked" : ""}> 반영</label>` : ""}</span></div>`; })()}
    </div>
    <h5>💰 메뉴 · 가격 <small>모아 온 메뉴 ${menu.length}개 · 엉클데이 메뉴 ${D.menu.length}개${usd ? " · 달러 가격은 동으로 바꿔서 넣어 주세요" : ""}</small></h5>
    <div class="vf-menu3">
      <div class="vf-mcol"><small><label class="vf-all"><input type="checkbox" id="vfAll" ${menu.length && menu.every((m, i) => vfPick(m, i, tg)) ? "checked" : ""}> 모아 온 정보</label> <span class="hint">· 이름 · 분 · 가격을 고칠 수 있어요</span>
        ${menu.length ? `<span class="vf-cdel"><button type="button" class="btn sm" id="vfCDel" title="체크한 모아 온 메뉴를 지워요">🗑 고른 것 지우기</button><button type="button" class="btn sm" id="vfCClr" title="모아 온 메뉴를 모두 지워요">모두 비우기</button></span>` : ""}</small>
        ${menu.map((m, i) => { const v = vfP(m), t = tg[i], sc = m.section_ko || m.section || "", pv = i ? (menu[i - 1].section_ko || menu[i - 1].section || "") : null, sn = vfSent(m, D);
        const head = sc !== pv ? `<div class="vf-sh" style="${vfSecStyle(sc)}">${sc ? esc(sc) : "분류 없음"} <small>${menu.filter(q => (q.section_ko || q.section || "") === sc).length}줄</small></div>` : "";
        return `${head}<div class="vf-ci ${vfPick(m, i, tg) ? "on" : ""} ${sn ? "sent" : ""}" style="${vfSecStyle(sc)}"><input type="checkbox" data-vfck="${i}" ${vfPick(m, i, tg) ? "checked" : ""} aria-label="고르기">
          <div class="vf-cb">${sn ? `<em class="tag s">✓ 엉클데이로 넘김</em>` : ""}<input class="nm" data-vfcn="${i}" value="${esc(m.name_ko || m.name || "")}" aria-label="메뉴 이름">${m.name_ko && m.name && m.name_ko !== m.name ? `<small class="org">원문: ${esc(m.name)}</small>` : ""}${m.price && !/^[\d.,\s]+(vnd|đ|동|k)?$/i.test(m.price) ? `<small class="org">가격 원문: ${esc(m.price)}</small>` : ""}${m.desc && m.desc !== m.desc_ko ? `<small class="org">설명 (영어 · 베트남어 칸): ${esc(m.desc)}</small>` : ""}
            <div class="vf-sd"><input data-vfcs="${i}" value="${esc(m.section_ko || m.section || "")}" placeholder="분류 (예: 스파)"><input data-vfcd="${i}" value="${esc(m.desc_ko || m.desc || "")}" placeholder="설명 (손님 화면에 작게)"></div>
            <div class="vf-ed"><input type="number" min="0" data-vfcm="${i}" value="${m.minutes || ""}" placeholder="분">분 <input type="number" min="0" step="1000" data-vfcp="${i}" value="${v || ""}" placeholder="가격 없음" class="${v ? "" : "none"}">동${vfVnd(m.tip) ? ` <span class="tip">+팁 ${vfMoney(vfVnd(m.tip))}</span>` : ""}
              <select data-vfto="${i}" aria-label="어디에 넣을까요"><option value="new" ${t == null ? "selected" : ""}>＋ 새 메뉴로</option>${D.menu.map((x, j) => `<option value="${j}" ${t === j ? "selected" : ""}>→ ${esc(vfTx(x.name).slice(0, 22))}${x.min ? " " + x.min + "분" : ""}</option>`).join("")}</select> <button type="button" class="lnk vf-cx" data-vfcx="${i}" title="이 모아 온 메뉴 지우기 (쓸모없는 것)">🗑</button></div></div></div>`; }).join("") || `<p class="hint">모아 온 메뉴가 없어요${x.fb && !x.web ? " · 페이스북만 있는 곳은 가격표를 캡처해서 붙여 넣어 주세요" : ""}</p>`}</div>
      <div class="vf-mid"><button class="btn main" id="vfSend" title="고른 메뉴를 엉클데이 쪽으로 보내요"><span class="ar">▶</span><span>고른 ${menu.filter((m, i) => vfPick(m, i, tg)).length}개<br> 보내기</span></button>
        <button class="btn sm" id="vfOrig" title="왼쪽 메뉴의 원문 이름을 짝지어진 엉클데이 메뉴에 한 번에 넣어요 (이미 있는 건 그대로)">🔤 원문<br> 옆으로</button>
        <button class="btn sm" id="vfGrid" title="종류 × 시간으로 가격이 정해진 가격표를 한 번에 메뉴로 만들어요">⏱ 시간별<br> 가격표로</button>
        <button class="btn sm" id="vfTime" title="'… 90분' · '… 120분' 처럼 이름에만 시간이 있는 엉클데이 메뉴를 시간 버튼으로 묶어요">🔗 이름 속<br> 시간 묶기</button>
        <button class="btn sm" id="vfReplace" title="엉클데이 메뉴를 고른 메뉴로 통째로 바꿔요">♻️ 통째로<br> 바꾸기</button></div>
      <div class="vf-mcol"><small>엉클데이 <span class="hint">· ☑ 표시한 것만 검수 완료 때 손님 화면에 반영돼요</span></small>
        ${D.menu.map((m, j) => { const k = ch.find(q => q.key === m._k);
        return `<div class="vf-ui ${k ? k.kind : ""}" style="${vfSecStyle(vfTx(m.sec))}">${k ? `<input type="checkbox" data-vfon="${esc(m._k)}" ${vfOn(D, m._k) ? "checked" : ""} title="검수 완료 때 반영" aria-label="반영">` : `<span class="vf-sp"></span>`}<div class="vf-cb"><input class="nm" data-vfun="${j}" value="${esc(vfTx(m.name))}" aria-label="메뉴 이름">${k && k.kind === "new" ? `<em class="tag n">새 메뉴</em>` : k ? `<em class="tag c">바뀜 · 지금 손님 화면: ${esc(vfTx(k.o.name).slice(0, 24))} ${k.o.min || "?"}분 ${k.o.price ? vfMoney(k.o.price) : "가격 없음"}</em>` : ""}
          <div class="vf-og"><span>원문</span><input data-vfuo="${j}" value="${esc(m.orig || "")}" placeholder="${esc(vfOrigOf(menu, tg, j) || "메뉴판 원래 이름 (영어 · 베트남어)")}">${!m.orig && vfOrigOf(menu, tg, j) ? `<button type="button" class="lnk" data-vfog="${j}" title="왼쪽 원문을 가져와요">⤵ 가져오기</button>` : ""}</div>
          <div class="vf-sd"><input data-vfus="${j}" value="${esc(vfTx(m.sec))}" placeholder="분류"><input data-vfud="${j}" value="${esc(vfTx(m.desc))}" placeholder="설명 (손님 화면에 작게)"></div>
          <div class="vf-ed"><input type="number" min="0" data-vfmin="${j}" value="${m.min || ""}" placeholder="분">분 <input type="number" min="0" step="1000" data-vfpr="${j}" value="${m.price || ""}" placeholder="가격 없음" class="${m.price ? "" : "none"}">동 <span class="tip">팁</span><input type="number" min="0" step="1000" data-vftip="${j}" value="${m.tip || ""}" placeholder="0" class="tp"> <button type="button" class="lnk" data-vfdel="${j}" title="이 메뉴 빼기">🗑</button></div></div></div>`; }).join("") || `<p class="hint">메뉴가 없어요 · 왼쪽에서 골라 ▶ 를 눌러요</p>`}
        ${ch.filter(k => k.kind === "del").map(k => `<div class="vf-ui del"><input type="checkbox" data-vfon="${k.key}" ${vfOn(D, k.key) ? "checked" : ""} title="검수 완료 때 빼기" aria-label="빼기 반영"><div class="vf-cb"><s>${esc(vfTx(k.o.name))} · ${k.o.min || "?"}분 · ${k.o.price ? vfMoney(k.o.price) : "가격 없음"}</s><em class="tag d">뺄 메뉴 <button type="button" class="lnk" data-vfback="${k.j}">↩ 되살리기</button></em></div></div>`).join("")}
      </div>
    </div>
    ${(c.deals || []).length ? `<div class="vf-deals"><b>🎁 가격표에 적힌 조건 할인</b> <small class="hint">☑ 하면 검수 완료 때 '문구 이벤트'로 손님 화면 할인 안내에 나가요 (자동 계산은 안 돼요 · 영어 · 베트남어는 업체 편집에서)</small>
      ${c.deals.map((t, i) => { const has = (s.promos || []).some(p => p.t && p.t.ko === t); return `<label class="vf-on"><input type="checkbox" data-vfdeal="${i}" ${has ? "checked disabled" : (D.deals || []).includes(t) ? "checked" : ""}> ${esc(t)}${has ? " <i class='ok'>이미 있어요</i>" : ""}</label>`; }).join("")}</div>` : ""}
    <div class="vf-pend ${ch.length ? "on" : ""}">${ch.length ? `✏️ 바뀐 것 <b>${ch.length}개</b> 중 <b>${on}개</b> 반영 예정 · 아직 손님 화면에는 안 나가요 · [✓ 검수 완료]를 누르면 ☑ 한 것만 손님 화면과 업체 정보에 반영돼요 <button class="btn sm" id="vfUndo">모두 되돌리기</button>` : x.review === "done" ? "✓ 손님 화면과 같아요" : "바뀐 것 없음 · 내용이 맞으면 [✓ 검수 완료]를 눌러요"}</div>
    <div class="vf-foot">
      <label class="vf-ph"><input type="checkbox" id="vfPh" ${x.photo_ok ? "checked" : ""}> 📷 업체가 사진 사용을 허락했어요</label><input id="vfPhN" placeholder="허락 받은 방법 · 날짜 (예: 11/26 잘로로 동의)" value="${esc(x.photo_note || "")}">
      <span style="flex:1"></span>
      <button class="btn" data-vfimg>🖼️ 이 업체 사진 검수</button>
      ${!isPub(s) ? `<label class="vf-ph pub"><input type="checkbox" id="vfPub" checked> 🌏 손님 화면에 공개도 같이</label>` : ""}
      ${x.review === "done" && !ch.length ? `<button class="btn" data-vfrv="todo">다시 검수 대기로</button>` : `<button class="btn main" data-vfrv="done">✓ 검수 완료${on ? ` · ${on}개 반영` : ""}</button>`}
    </div></div>`;
}
// 메뉴 비교용 (이름 · 분 · 가격만)
const vfMn = m => ({ n: vfTx(m.name), m: +m.min || 0, p: +m.price || 0, t: +m.tip || 0, s: vfTx(m.sec), d: vfTx(m.desc), o: String(m.orig || "").trim() });
const vfAddr = a => (a && (a.vi || a.en || a.ko)) || "";
// 모아 온 메뉴 가격: 손으로 고친 값(vnd)이 있으면 그걸 써요
const vfP = m => m.vnd != null ? +m.vnd || 0 : vfVnd(m.price);
// 초안을 만들 때의 손님 화면 메뉴 (그 뒤 SQL 등으로 메뉴가 바뀌면 이 초안으로 검수 완료하지 않아요)
const vfMenuSig = s => (s.menu || []).map(m => [vfTx(m.name), +m.min || 0, +m.price || 0].join("|")).join("\n");
function vfStale(s, D) {
  if (!D) return false; if (D.base != null) return D.base !== vfMenuSig(s);
  const live = s.menu || [], old = D.menu.filter(m => m._o != null);   // 예전 초안(base 없음): 원래 자리 메뉴 이름이 많이 다르면 낡은 초안
  const miss = old.filter(m => !live[m._o] || vfTx(live[m._o].name) !== vfTx(m.name)).length;
  return old.length > 3 && miss / old.length > 0.3;
}
// 엉클데이 쪽 초안 (검수 완료 전까지 손님 화면에 안 나가요) · 줄마다 _o = 원래 몇 번째 메뉴였는지 (새 메뉴는 null)
function vfDraftOf(s, c) {
  const D = c.draft || { menu: JSON.parse(JSON.stringify(s.menu || [])).map((m, j) => ({ ...m, _o: j, _k: "o" + j })), open: s.open || "", close: s.close || "", address: s.address || null, ck: {}, base: vfMenuSig(s) };
  if (D.desc === undefined) D.desc = s.desc ? JSON.parse(JSON.stringify(s.desc)) : null;   // 📝 소개 · 👍 추천 (검수 완료 때 반영)
  if (D.reco === undefined) D.reco = s.recommend ? JSON.parse(JSON.stringify(s.recommend)) : null;
  D.ck = D.ck || {}; const old = !D.menu.some(m => m._k);   // 예전 초안: 순서대로 원래 메뉴로 봐요
  D.menu.forEach((m, j) => { if (!m._k) { m._o = old && j < (s.menu || []).length ? j : m._o != null ? m._o : null; m._k = (m._o != null ? "o" : "n") + j; } });
  return D;
}
const vfOn = (D, key) => !D.ck || D.ck[key] !== false;   // 기본은 반영 (체크 해제한 것만 빼요)
// 손님 화면(지금)과 초안의 다른 점
function vfChanges(s, D) {
  if (!D) return []; const live = s.menu || [], out = [], seen = new Set();
  D.menu.forEach(m => { if (m._o == null || !live[m._o]) out.push({ key: m._k, kind: "new" }); else { seen.add(m._o); if (JSON.stringify(vfMn(live[m._o])) !== JSON.stringify(vfMn(m))) out.push({ key: m._k, kind: "chg", o: live[m._o] }); } });
  live.forEach((o, j) => { if (!seen.has(j)) out.push({ key: "d" + j, kind: "del", o, j }); });
  if ((s.open || "") !== (D.open || "") || (s.close || "") !== (D.close || "")) out.push({ key: "hours", kind: "hours" });
  if (vfAddr(s.address).trim() !== vfAddr(D.address).trim()) out.push({ key: "addr", kind: "addr" });
  const tri = o => JSON.stringify(["ko", "en", "vi"].map(l => ((o && o[l]) || "").trim()));
  if (D.desc !== undefined && tri(s.desc) !== tri(D.desc)) out.push({ key: "desc", kind: "desc" });
  if (D.reco !== undefined && tri(s.recommend) !== tri(D.reco)) out.push({ key: "reco", kind: "reco" });
  (D.deals || []).forEach(t => { if (!(s.promos || []).some(p => p.t && p.t.ko === t)) out.push({ key: "deal:" + t, kind: "deal", t }); });
  return out;
}
const vfDirty = (s, D) => D ? vfChanges(s, vfDraftOf(s, { draft: D })).length : 0;
// 검수 완료: ☑ 한 것만 반영한 최종 메뉴 · 영업시간 · 주소
function vfFinal(s, D) {
  const live = s.menu || [], ch = vfChanges(s, D), on = k => vfOn(D, k), clean = m => { const o = { ...m }; delete o._o; delete o._k; return o; };
  const rows = [];   // [원래 위치(정렬용), 메뉴]
  D.menu.forEach((m, j) => { const c = ch.find(q => q.key === m._k);
    if (!c) rows.push([m._o != null ? m._o : j, clean(m)]);
    else if (c.kind === "new") { if (on(m._k)) rows.push([m._o != null ? m._o : j, clean(m)]); }
    else rows.push([m._o, on(m._k) ? clean(m) : live[m._o]]); });
  ch.filter(c => c.kind === "del" && !on(c.key)).forEach(c => { const at = rows.findIndex(r => r[0] > c.j); rows.splice(at < 0 ? rows.length : at, 0, [c.j, live[c.j]]); });
  return { menu: rows.map(r => r[1]), open: on("hours") ? D.open : s.open, close: on("hours") ? D.close : s.close, address: on("addr") ? D.address : s.address, desc: ch.some(c => c.key === "desc") && on("desc") ? D.desc : s.desc, recommend: ch.some(c => c.key === "reco") && on("reco") ? D.reco : s.recommend, deals: ch.filter(c => c.kind === "deal").map(c => c.t), n: ch.filter(c => on(c.key)).length };
}
// 모아 온 메뉴 i → 엉클데이 메뉴 j (이름 · 시간이 비슷하면)
// 엉클데이 쪽 j번 메뉴와 짝지어진 왼쪽(모아 온) 메뉴의 원문 이름
function vfOrigOf(menu, tg, j) {
  const i = Object.keys(tg || {}).find(k => tg[k] === j); const m = i != null && menu[+i];
  const o = m && String(m.name || "").trim(); return o && o !== String(m.name_ko || "").trim() ? o : "";
}
function vfTargets(D, menu) {
  const t = {}; (D.menu || []).forEach((sm, j) => { const r = vfMatch(sm, menu); if (r && t[r.i] == null) t[r.i] = j; });
  menu.forEach((m, i) => { if (m.to !== undefined) t[i] = m.to === "new" ? null : +m.to; });
  return t;
}
// 기본으로 고를지: 직접 체크했으면 그대로 · 아니면 가격이 있고 엉클데이와 다를 때
// 🎨 분류마다 다른 색 (같은 분류는 왼쪽 · 오른쪽 같은 색)
const VF_SECPAL = ["#0ea5e9", "#f97316", "#16a34a", "#a855f7", "#e11d48", "#ca8a04", "#0d9488", "#6366f1"];
function vfSecStyle(sec) {
  sec = String(sec || "").trim(); if (!sec) return "";
  // 화면에 나온 순서대로 서로 다른 색을 줘요 (분류가 8개를 넘으면 다시 처음 색)
  const M = VF_SECPAL._m || (VF_SECPAL._m = new Map()); if (!M.has(sec)) M.set(sec, VF_SECPAL[M.size % VF_SECPAL.length]);
  const base = M.get(sec); return `--sc:${base};--sb:color-mix(in srgb, ${base} 14%, #fff)`;
}
// 모아 온 메뉴가 이미 엉클데이 쪽으로 넘어갔는지 (▶ 로 보냈거나, 이름 · 시간 · 가격이 같은 줄이 이미 있음)
function vfSent(m, D) {
  if (m.sent) return true; const v = vfP(m), nm = [m.name_ko, m.name].filter(Boolean).map(x => String(x).trim().toLowerCase());
  return !!(D && v && (D.menu || []).some(x => +x.price === v && (+x.min || 0) === (+m.minutes || 0) && [x.name && x.name.ko, x.name && x.name.en, typeof x.name === "string" ? x.name : ""].some(n => n && nm.includes(String(n).trim().toLowerCase()))));
}
function vfPick(m, i, tg) { if (m.ck !== undefined) return !!m.ck; const v = vfP(m); if (!v) return false; const j = tg[i]; return j == null || !VF._D || !VF._D.menu[j] || +VF._D.menu[j].price !== v; }

// ⏱ 시간별 가격표 → 메뉴 (종류 × 시간 = 한 줄씩) · 업체 정보 검수 · 업체 편집 둘 다 써요
//  손님 화면에서는 이름이 같은 메뉴를 하나로 묶고 시간을 골라요
const vfBase = t => String(t || "").replace(/\s*[(（][^)）]*(분|min|phút|')[^)）]*[)）]\s*$/i, "").replace(/\s*\d+\s*(분|min|mins|phút|p)\s*$/i, "").trim();
function vfGrid(menu, seed, onApply) {
  const kinds = [], seen = new Set();
  (seed.kinds || menu.map(m => vfBase(vfTx(m.name)))).forEach(k => { if (k && !seen.has(k)) { seen.add(k); kinds.push(k); } });
  let rows = (seed.rows && seed.rows.length ? seed.rows : [{ min: 60 }, { min: 90 }, { min: 120 }]).slice(0, 8);
  const sel = new Set(seed.sel || []); let extra = "";   // 고른 종류 · 새로 쓴 종류
  const has = k => menu.filter(m => vfBase(vfTx(m.name)) === k);
  const getK = () => kinds.filter(k => sel.has(k)).concat(extra.split(/\n|,/).map(x => x.trim()).filter(x => x && !kinds.includes(x)));
  const d = document.createElement("div"); d.className = "overlay center"; d.style.zIndex = 70;
  const draw = () => {
    d.innerHTML = `<div class="modal vf-grid"><h2>⏱ 시간별 가격표로 메뉴 만들기</h2>
      <p class="hint">업체 가격표처럼 <b>종류는 여러 개, 가격은 시간으로만</b> 정해질 때 써요. 종류 × 시간만큼 메뉴가 한 줄씩 만들어지고, 손님 화면에서는 종류 하나에 시간 버튼(60분 · 90분 …)으로 묶여 보여요.</p>
      <div class="vf-g2"><div><b>종류</b> <small>시간별로 만들 메뉴를 ☑ 골라요 · 없으면 아래에 새로 써요</small>
        <div class="vg-ks">${kinds.length ? `<label class="vg-all"><input type="checkbox" id="vgAll" ${kinds.length && kinds.every(k => sel.has(k)) ? "checked" : ""}> 전체</label>` : ""}${kinds.map((k, i) => { const h = has(k); return `<label class="${sel.has(k) ? "on" : ""}"><input type="checkbox" data-vgk="${i}" ${sel.has(k) ? "checked" : ""}> <span>${esc(k)}</span><small>${h.map(m => m.min ? m.min + "분" : "시간 없음").join(" · ")}</small></label>`; }).join("") || `<p class="hint">지금 메뉴가 없어요 · 아래에 새로 써요</p>`}</div>
        <textarea id="vgK" rows="2" placeholder="새 종류 (한 줄에 하나 · 예: 드라이 마사지)">${esc(extra)}</textarea></div>
        <div><b>시간 · 가격</b> <small>정상가(동) · 할인은 🎁 할인 이벤트로</small>
          <div id="vgR">${rows.map((r, i) => `<div class="vg-r"><input type="number" min="0" step="5" data-vgm="${i}" value="${r.min || ""}" placeholder="분">분 <input type="number" min="0" step="1000" data-vgp="${i}" value="${r.price || ""}" placeholder="가격">동 <button type="button" class="lnk" data-vgx="${i}">✕</button></div>`).join("")}</div>
          <button type="button" class="btn sm" id="vgAdd">＋ 시간 추가</button></div></div>
      <label class="vf-on" style="margin-bottom:6px">분류 <input id="vgS" placeholder="선택 · 예: 스파 · 네일 > 여성" style="padding:5px 8px;border:1px solid var(--line);border-radius:7px;font:inherit;font-size:13px;min-width:220px"> <small class="hint">손님 화면에서 이 제목 아래로 모여요</small></label>
      <label class="vf-on"><input type="checkbox" id="vgRep" checked> 같은 이름의 지금 메뉴는 지우고 이걸로 바꾸기 (예: '아로마 마사지 (60·90·120분)' 한 줄 → 60 · 90 · 120분 세 줄)</label>
      <p class="vg-sum" id="vgSum"></p>
      <div class="btns"><button class="btn" data-no>취소</button><button class="btn main" data-yes>만들기</button></div></div>`;
    const sum = () => { extra = d.querySelector("#vgK").value; const k = getK(), r = rows.filter(x => +x.min > 0);
      d.querySelector("#vgSum").textContent = `종류 ${k.length}개 × 시간 ${r.length}개 = 메뉴 ${k.length * r.length}줄을 만들어요${r.some(x => !+x.price) ? " · 가격이 빈 시간은 '가격 없음'으로 들어가요" : ""}`; };
    d.querySelectorAll("[data-vgm],[data-vgp]").forEach(inp => inp.oninput = () => { const i = +(inp.dataset.vgm ?? inp.dataset.vgp); rows[i][inp.dataset.vgm !== undefined ? "min" : "price"] = Math.max(0, Math.round(+inp.value || 0)); sum(); });
    d.querySelectorAll("[data-vgx]").forEach(b => b.onclick = () => { extra = d.querySelector("#vgK").value; rows.splice(+b.dataset.vgx, 1); draw(); });
    d.querySelector("#vgAdd").onclick = () => { extra = d.querySelector("#vgK").value; rows.push({ min: "" }); draw(); };
    d.querySelectorAll("[data-vgk]").forEach(c => c.onchange = () => { const k = kinds[+c.dataset.vgk]; extra = d.querySelector("#vgK").value;
      if (c.checked) { sel.add(k); const h = has(k).filter(m => +m.min);   // 처음 고른 종류의 시간 · 가격을 미리 채워요 (가격 칸이 비어 있을 때만)
        if (h.length && !rows.some(r => +r.price)) rows = h.map(m => ({ min: +m.min, price: +m.price || "" })).sort((a, b) => a.min - b.min); }
      else sel.delete(k); draw(); });
    const va = d.querySelector("#vgAll"); if (va) va.onchange = () => { extra = d.querySelector("#vgK").value; kinds.forEach(k => va.checked ? sel.add(k) : sel.delete(k)); draw(); };
    d.querySelector("#vgK").oninput = sum; sum();
    d.querySelector("[data-no]").onclick = () => d.remove();
    d.querySelector("[data-yes]").onclick = () => {
      extra = d.querySelector("#vgK").value; const k = getK(), r = rows.filter(x => +x.min > 0).sort((a, b) => a.min - b.min);
      if (!k.length || !r.length) return toast("종류와 시간을 하나 이상 넣어 주세요");
      if (r.some(x => +x.price && +x.price < 10000)) return toast("가격은 동(VND)으로 넣어 주세요 (예: 640000)");
      const rep = d.querySelector("#vgRep").checked, ks = new Set(k), sc = d.querySelector("#vgS").value.trim();
      const old = n => menu.find(m => vfBase(vfTx(m.name)) === n), made = [];
      k.forEach(n => { const o = old(n), nm = o && typeof o.name === "object" ? o.name : {};
        r.forEach(x => made.push({ name: { ko: n, en: vfBase(nm.en || "") || "", vi: vfBase(nm.vi || "") || "" }, min: +x.min, price: +x.price || 0,
          ...(sc ? { sec: { ko: sc } } : o && o.sec ? { sec: o.sec } : {}), ...(o && o.desc ? { desc: o.desc } : {}) })); });
      let out;
      if (rep) { const first = menu.findIndex(m => ks.has(vfBase(vfTx(m.name)))); const keep = menu.filter(m => !ks.has(vfBase(vfTx(m.name))));
        const at = first < 0 ? keep.length : menu.slice(0, first).filter(m => !ks.has(vfBase(vfTx(m.name)))).length; out = keep.slice(0, at).concat(made, keep.slice(at)); }
      else out = menu.concat(made);
      d.remove(); onApply(out, made.length);
    };
  };
  draw(); document.body.appendChild(d);
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
  let best = null, bs = 7;   // 7점 이상만 짝 (여러 메뉴를 묶은 패키지는 새 메뉴로)
  menu.forEach((m, i) => { if (!vfP(m)) return; const b = vfKeys([m.name, m.name_ko].join(" ")); const hit = a.filter(k => b.includes(k)).length; if (!hit) return;
    let sc = hit * 10 - a.filter(k => !b.includes(k)).length * 20 - b.filter(k => !a.includes(k)).length * 6; /* 아동 아로마 ≠ 아로마 */ if (sm.min && m.minutes) sc += +sm.min === +m.minutes ? 6 : -4; if (sc > bs) { bs = sc; best = i; } });
  return best == null ? null : { i: best, m: menu[best], v: vfP(menu[best]) };
}

function vfBind(el) {
  const bk = el.querySelector("#vfBulk"); if (bk) bk.onclick = () => { VF.bulkF = el.querySelector("#vfBulkF").value; vfBulk(VF.bulkF); };
  const bx = el.querySelector("#vfBulkX"); if (bx) bx.onclick = () => { if (VF.bulk) VF.bulk.stop = 1; };
  const nw = el.querySelector("#vfNew"); if (nw) nw.onclick = () => vfNewShop(el.querySelector("#vfNewUrl").value.trim(), el.querySelector("#vfNewCity").value, el.querySelector("#vfNewCat").value);

  el.querySelectorAll("[data-vff]").forEach(b => b.onclick = () => { VF.f = b.dataset.vff; vfDraw(); });
  const q = el.querySelector("#vfQ"); if (q) q.oninput = () => { VF.q = q.value; const p = q.selectionStart; vfDraw(); const n = document.getElementById("vfQ"); n.focus(); n.setSelectionRange(p, p); };
  el.querySelectorAll("[data-vfo]").forEach(h => h.onclick = e => { if (e.target.closest("a")) return; VF.open = VF.open === h.dataset.vfo ? null : h.dataset.vfo; vfDraw(); });
  const row = el.querySelector(".vf-row.open"); if (!row) return;
  const id = row.dataset.vfid, s = vfShop(id), x = vfSrc(id), c = x.crawled || {};
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
  // ── 메뉴: 모아 온 정보 고치기 · 고르기 · ▶ 보내기 · 엉클데이 초안 고치기 · 검수 완료 때 반영 ──
  const D = vfDraftOf(s, c), menu = c.menu || [];
  const saveC = (patch, msg) => vfSave(id, { crawled: { ...c, ...patch } }, msg);
  const saveD = msg => vfSave(id, { crawled: { ...c, draft: D }, review: "todo" }, msg);
  const setM = (i, k, v) => { const mm = menu.slice(); mm[i] = { ...mm[i], [k]: v }; saveC({ menu: mm }); };
  row.querySelectorAll("[data-vfcn]").forEach(inp => inp.onchange = () => setM(+inp.dataset.vfcn, "name_ko", inp.value.trim()));
  row.querySelectorAll("[data-vfcm]").forEach(inp => inp.onchange = () => setM(+inp.dataset.vfcm, "minutes", Math.max(0, Math.round(+inp.value || 0)) || null));
  row.querySelectorAll("[data-vfcp]").forEach(inp => inp.onchange = () => { const v = Math.max(0, Math.round(+inp.value || 0)); if (v && v < 10000) return toast("가격은 동(VND)으로 넣어 주세요 (예: 550000)"); setM(+inp.dataset.vfcp, "vnd", v); });
  row.querySelectorAll("[data-vfcs]").forEach(inp => inp.onchange = () => setM(+inp.dataset.vfcs, "section_ko", inp.value.trim() || null));
  row.querySelectorAll("[data-vfcd]").forEach(inp => inp.onchange = () => setM(+inp.dataset.vfcd, "desc_ko", inp.value.trim() || null));
  row.querySelectorAll("[data-vfus],[data-vfud]").forEach(inp => inp.onchange = () => { const k = inp.dataset.vfus !== undefined ? "sec" : "desc", t = D.menu[+(inp.dataset.vfus ?? inp.dataset.vfud)], v = inp.value.trim();
    if (!v) delete t[k]; else t[k] = k === "sec" ? secI18n(v) : { ...(typeof t[k] === "object" ? t[k] : {}), ko: v }; saveD(); });
  row.querySelectorAll("[data-vftip]").forEach(inp => inp.onchange = () => { const t = D.menu[+inp.dataset.vftip], v = Math.max(0, Math.round(+inp.value || 0)); if (v) t.tip = v; else delete t.tip; saveD(); });
  row.querySelectorAll("[data-vfdeal]").forEach(cb => cb.onchange = () => { const t = (c.deals || [])[+cb.dataset.vfdeal], ds = new Set(D.deals || []); cb.checked ? ds.add(t) : ds.delete(t); D.deals = [...ds]; saveD(); });
  // 🗑 모아 온 메뉴 지우기 (엉클데이 쪽 · 손님 화면은 그대로)
  const cDel = ks => { const set = new Set(ks); c.menu = menu.filter((m, i) => !set.has(i)); vfSave(id, { crawled: { ...c } }, `모아 온 메뉴 ${ks.length}개를 지웠어요 · 엉클데이 쪽 · 손님 화면은 그대로예요`); };
  row.querySelectorAll("[data-vfcx]").forEach(b => b.onclick = () => cDel([+b.dataset.vfcx]));
  const cd = row.querySelector("#vfCDel"); if (cd) cd.onclick = () => { const ks = [...row.querySelectorAll("[data-vfck]")].filter(x => x.checked).map(x => +x.dataset.vfck); if (!ks.length) return toast("지울 메뉴를 체크해 주세요");
    confirmBox(`모아 온 메뉴 ${ks.length}개를 지울까요?`, () => cDel(ks), "모아 온 정보(초안)에서만 지워요 · 엉클데이 쪽 · 손님 화면은 그대로예요 · 다시 가져오기로 되살릴 수 있어요", "지우기"); };
  const cc = row.querySelector("#vfCClr"); if (cc) cc.onclick = () => confirmBox(`모아 온 메뉴 ${menu.length}개를 모두 지울까요?`, () => cDel(menu.map((m, i) => i)), "엉클데이 쪽 · 손님 화면은 그대로예요", "모두 지우기");
  row.querySelectorAll("[data-vfck]").forEach(cb => cb.onchange = () => setM(+cb.dataset.vfck, "ck", cb.checked));
  row.querySelectorAll("[data-vfto]").forEach(se => se.onchange = () => setM(+se.dataset.vfto, "to", se.value));
  const all = row.querySelector("#vfAll"); if (all) all.onchange = () => saveC({ menu: menu.map(m => ({ ...m, ck: all.checked })) });
  const nk = () => "n" + Math.random().toString(36).slice(2, 8);
  const i18 = (o, k) => o ? { ko: k || o, en: o, vi: o } : k ? { ko: k, en: "", vi: "" } : null;   // 원문은 영어 · 베트남어 칸, 한국어는 ko
  const extra = m => { const o = {}, sc = i18(m.section, m.section_ko), ds = i18(m.desc, m.desc_ko); if (sc) o.sec = sc; if (ds) o.desc = ds; if (vfVnd(m.tip)) o.tip = vfVnd(m.tip); return o; };
  const toItem = m => ({ name: { ko: m.name_ko || m.name, en: m.name || m.name_ko, vi: m.name || m.name_ko }, ...(m.name && m.name !== m.name_ko ? { orig: String(m.name).trim() } : {}), min: +m.minutes || 0, price: vfP(m), ...extra(m), _o: null, _k: nk() });
  const sd = row.querySelector("#vfSend"); if (sd) sd.onclick = () => {
    const tg = vfTargets(D, menu), pick = menu.map((m, i) => ({ m, i })).filter(o => vfPick(o.m, o.i, tg));
    if (!pick.length) return toast("왼쪽에서 보낼 메뉴를 골라 주세요");
    let up = 0, add = 0;
    pick.forEach(({ m, i }) => { const j = tg[i], t = j != null && D.menu[j]; menu[i] = { ...m, sent: true, ck: false };
      if (t) { const v = vfP(m); if (v) t.price = v; if (m.minutes) t.min = +m.minutes; const e = extra(m); if (e.tip) t.tip = e.tip; if (e.sec && !t.sec) t.sec = e.sec; if (e.desc && !t.desc) t.desc = e.desc; if (!t.orig && m.name && m.name !== m.name_ko) t.orig = String(m.name).trim(); up++; } else { D.menu.push(toItem(m)); add++; } });
    c.menu = menu.map(m => { const o = { ...m }; delete o.ck; return o; });
    vfSave(id, { crawled: { ...c, draft: D }, review: "todo" }, `엉클데이 쪽에 ${up ? `${up}개 가격 반영` : ""}${up && add ? " · " : ""}${add ? `${add}개 새 메뉴 추가` : ""} · 검수 완료를 누르면 손님 화면에 나가요`); };
  const rp = row.querySelector("#vfReplace"); if (rp) rp.onclick = () => {
    const tg = vfTargets(D, menu), nm = menu.filter((m, i) => vfPick(m, i, tg) && (m.name || m.name_ko)); if (!nm.length) return toast("왼쪽에서 메뉴를 골라 주세요");
    confirmBox(`엉클데이 메뉴 ${D.menu.length}개를 고른 메뉴 ${nm.length}개로 바꿀까요?`, () => { D.menu = nm.map(toItem); saveD("메뉴를 통째로 바꿨어요 · 검수 완료를 누르면 손님 화면에 나가요"); }, "검수 완료 전까지는 손님 화면에 그대로예요 · [되돌리기]로 돌릴 수 있어요", "바꾸기", false); };
  // ⏱ 시간별 가격표: 고른 모아 온 메뉴의 시간 · 가격을 미리 채워요
  const gd = row.querySelector("#vfGrid"); if (gd) gd.onclick = () => {
    const tg = vfTargets(D, menu), by = {};
    menu.forEach((m, i) => { if (vfPick(m, i, tg) && +m.minutes && vfP(m) && !by[+m.minutes]) by[+m.minutes] = vfP(m); });
    if (!Object.keys(by).length) D.menu.forEach(m => { if (+m.min && +m.price && !by[+m.min]) by[+m.min] = +m.price; });
    const rows = Object.keys(by).map(Number).sort((a, b) => a - b).map(k => ({ min: k, price: by[k] }));
    vfGrid(D.menu, { rows }, (out, n) => { D.menu = out.map(m => m._k ? m : { ...m, _o: null, _k: nk() });
      c.menu = menu.map((m, i) => vfPick(m, i, tg) ? { ...m, ck: false } : m);   // 가격표로 쓴 모아 온 메뉴는 체크 해제 (▶ 로 또 보내지 않게)
      saveD(`메뉴 ${n}줄을 만들었어요 · 확인하고 검수 완료를 누르면 손님 화면에 나가요`); }); };
  const tm = row.querySelector("#vfTime"); if (tm) tm.onclick = () => { const r = vfTimeMerge(D.menu);
    if (!r.groups.length) return toast("묶을 메뉴가 없어요 · 오른쪽(엉클데이)에 이름에 '90분' · '120분'이 들어간 같은 메뉴가 2개 이상이어야 해요", 5000);
    confirmBox(`엉클데이 메뉴 ${r.groups.length}종류를 시간 버튼으로 묶을까요?`, () => { D.menu = r.menu; saveD(`${r.groups.length}종류를 묶었어요 · 검수 완료 때 반영돼요`); }, r.groups.map(g => `${g.name} → ${g.mins.join(" · ")}분`).join(" / "), "묶기", false); };
  row.querySelectorAll("[data-vfon]").forEach(cb => cb.onchange = () => { D.ck = { ...(D.ck || {}), [cb.dataset.vfon]: cb.checked }; vfSave(id, { crawled: { ...c, draft: D } }); });
  row.querySelectorAll("[data-vfback]").forEach(b => b.onclick = () => { const j = +b.dataset.vfback, o = (s.menu || [])[j]; if (!o) return;
    const at = D.menu.findIndex(m => m._o != null && m._o > j); D.menu.splice(at < 0 ? D.menu.length : at, 0, { ...JSON.parse(JSON.stringify(o)), _o: j, _k: "o" + j }); saveD("되살렸어요"); });
  // 🔤 원문(메뉴판 원래 이름): 직접 고치기 · ⤵ 하나씩 가져오기 · 🔤 한 번에 옆으로
  row.querySelectorAll("[data-vfuo]").forEach(inp => inp.onchange = () => { const t = D.menu[+inp.dataset.vfuo], v = inp.value.trim(); if (v) t.orig = v; else delete t.orig; saveD(); });
  { const tgO = vfTargets(D, menu);
    row.querySelectorAll("[data-vfog]").forEach(b => b.onclick = () => { const j = +b.dataset.vfog, o = vfOrigOf(menu, tgO, j); if (o) { D.menu[j].orig = o; saveD(); } });
    const ob = row.querySelector("#vfOrig"); if (ob) ob.onclick = () => { let n = 0; D.menu.forEach((t, j) => { const o = vfOrigOf(menu, tgO, j); if (o && !t.orig) { t.orig = o; n++; } });
      if (!n) return toast("가져올 원문이 없어요 (이미 다 있거나 짝지어진 메뉴가 없어요)"); saveD(); toast(`🔤 원문 ${n}개를 옆으로 가져왔어요 · 검수 완료를 누르면 손님 화면에 나가요`); }; }
  row.querySelectorAll("[data-vfun]").forEach(inp => inp.onchange = () => { const t = D.menu[+inp.dataset.vfun], v = inp.value.trim(); if (!v) return;
    t.name = { ...(typeof t.name === "object" ? t.name : {}), ko: v }; saveD(); });
  row.querySelectorAll("[data-vfpr],[data-vfmin]").forEach(inp => inp.onchange = () => {
    const j = +(inp.dataset.vfpr ?? inp.dataset.vfmin), t = D.menu[j], v = Math.max(0, Math.round(+inp.value || 0));
    if (inp.dataset.vfpr !== undefined) { if (v && v < 10000) return toast("가격은 동(VND)으로 넣어 주세요 (예: 550000)"); t.price = v; } else t.min = v;
    saveD(); });
  row.querySelectorAll("[data-vfdel]").forEach(b => b.onclick = () => { const j = +b.dataset.vfdel, m = D.menu[j]; D.menu.splice(j, 1); saveD(`‘${vfTx(m.name)}’ 를 뺐어요 · 검수 완료 전까지 손님 화면은 그대로예요`); });
  // 📝 소개 · 👍 추천: [넣기]는 한 · 영 · 베 세 언어를 함께, 직접 고치면 한국어만 (영어 · 베트남어는 업체 편집에서)
  row.querySelectorAll("[data-vfab]").forEach(b => b.onclick = () => { const ab = c.about || {}, k = b.dataset.vfab;
    if (k === "desc") D.desc = { ko: ab.desc_ko || "", en: ab.desc_en || "", vi: ab.desc_vi || "" }; else D.reco = { ko: ab.reco_ko || "", en: ab.reco_en || "", vi: ab.reco_vi || "" };
    saveD(k === "desc" ? "소개를 넣었어요 (한 · 영 · 베) · 검수 완료 때 반영" : "추천 문구를 넣었어요 · 검수 완료 때 반영"); });
  const dsc = row.querySelector("#vfDesc"); if (dsc) dsc.onchange = () => { D.desc = { ...(D.desc || {}), ko: dsc.value.trim() }; saveD("소개(한국어)를 고쳤어요 · 영어 · 베트남어는 업체 편집에서 확인해 주세요"); };
  const rco = row.querySelector("#vfReco"); if (rco) rco.onchange = () => { D.reco = { ...(D.reco || {}), ko: rco.value.trim() }; saveD(); };
  const aa = row.querySelector("#vfAddr"); if (aa) aa.onchange = () => { const v = aa.value.trim(), o = D.address || {}, same = !o.ko || o.ko === o.vi;
    D.address = { ...o, vi: v, en: !o.en || o.en === o.vi ? v : o.en, ko: same ? v : o.ko }; saveD(); };
  const oo = row.querySelector("#vfOpen"), oc = row.querySelector("#vfClose");
  if (oo) [oo, oc].forEach(inp => inp.onchange = () => { if (!oo.value || !oc.value) return; D.open = oo.value; D.close = oc.value; saveD(); });
  const hr = row.querySelector("[data-vfhr]"); if (hr) hr.onclick = () => { const [o, cl] = hr.dataset.vfhr.split("-"); D.open = o; D.close = cl; saveD(`영업시간 ${o}~${cl} 를 넣었어요 · 검수 완료 때 반영`); };
  const ad = row.querySelector("[data-vfad]"); if (ad) ad.onclick = () => { D.address = { ko: c.address, en: c.address, vi: c.address }; saveD("주소를 넣었어요 · 검수 완료 때 반영"); };
  const ud = row.querySelector("#vfUndo"); if (ud) ud.onclick = () => confirmBox("엉클데이 쪽 바꾼 것을 모두 되돌릴까요?", () => vfSave(id, { crawled: { ...c, draft: null } }, "되돌렸어요 · 손님 화면과 같아요"), "", "되돌리기", false);
  const rv = row.querySelector("[data-vfrv]"); if (rv) rv.onclick = async () => {
    if (rv.dataset.vfrv !== "done") return vfSave(id, { review: "todo" }, "다시 검수 대기로 돌렸어요");
    if (c.draft && vfStale(s, D)) return confirmBox("초안을 만든 뒤 손님 화면 메뉴가 바뀌었어요 (SQL · 다른 관리자)", async () => { await vfSave(id, { crawled: { ...c, draft: null } }, "낡은 초안을 버렸어요 · 지금 손님 화면 메뉴로 다시 시작해요"); }, "이 초안으로 검수 완료하면 바뀐 메뉴가 예전으로 돌아가요. 초안을 버리고 지금 메뉴에서 다시 맞춰 주세요", "초안 버리기", true);
    const pub = row.querySelector("#vfPub"), goPub = pub && pub.checked, F = c.draft ? vfFinal(s, D) : null;
    if (F && F.menu.some(m => !vfTx(m.name).trim())) return toast("이름이 빈 메뉴가 있어요 · 이름을 넣거나 🗑 로 빼 주세요");
    const n = F ? F.n : 0, pm = (s.promos || []).concat(s.extras || []).some(p => (p.menus || []).length);
    const go = async () => { rv.disabled = true;
      try {
        if (n) { s.menu = F.menu; s.open = F.open; s.close = F.close; if (F.address) s.address = F.address; if (F.desc) s.desc = F.desc; if (F.recommend) s.recommend = F.recommend;
          const dl = (F.deals || []).filter(t => vfOn(D, "deal:" + t)); if (dl.length) s.promos = (s.promos || []).concat(dl.map(t => ({ id: "p" + Math.random().toString(36).slice(2, 9), on: true, kind: "text", menus: [], t: { ko: t } }))).slice(0, 10); }
        if (goPub) META[id] = { ...(META[id] || {}), published: true };
        if (n || goPub) await dbSaveShop(s);
        await vfSave(id, { crawled: { ...c, draft: null }, review: "done", reviewed_at: new Date().toISOString(), reviewed_by: ME.email },
          `${vfName(s)} 검수 완료${n ? ` · ${n}개를 손님 화면과 업체 정보에 반영했어요` : ""}${goPub ? " · 손님 화면에 공개했어요" : ""}`);
        if (typeof drawList === "function") try { drawList(); } catch (e) {}
        if (typeof drawStats === "function") try { drawStats(); } catch (e) {}
      } catch (e) { rv.disabled = false; dbErr(e, "검수 완료 반영"); } };
    const left = c.draft ? vfChanges(s, D).length - n : 0;
    if (pm && n && F.menu.length !== (s.menu || []).length) return confirmBox("메뉴 순서가 바뀌어요 · 일부 메뉴에만 거는 🎁 할인 이벤트나 ➕ 추가 요금이 있어요", go, "반영한 뒤 업체 편집 → 할인 이벤트 · 추가 요금에서 적용 메뉴를 다시 확인해 주세요", "반영하기", false);
    if (left > 0) return confirmBox(`☑ 안 한 ${left}개는 버리고 ${n}개만 반영할까요?`, go, "☑ 안 한 것은 지금 손님 화면 그대로 남아요", "반영하기", false);
    go();
  };
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
  const keep = []; const o = { ...n }; if (prev.draft) o.draft = prev.draft;   // 엉클데이 쪽 초안은 그대로
  if (!(n.menu || []).length && (prev.menu || []).length) { o.menu = prev.menu; keep.push(`메뉴 ${prev.menu.length}개`); }
  ["hours", "address", "phone"].forEach(k => { if (!n[k] && prev[k]) { o[k] = prev[k]; keep.push({ hours: "영업시간", address: "주소", phone: "전화" }[k]); } });
  if (!(n.features || []).length && (prev.features || []).length) o.features = prev.features;
  if (!n.about && prev.about) o.about = prev.about;
  if (keep.length) { o.src = [...new Set((n.src || []).concat(prev.src || []))]; o.note = [n.note, `이번에 못 찾은 ${keep.join(" · ")} 은(는) 예전에 모은 것을 그대로 뒀어요`].filter(Boolean).join(" · "); }
  return o;
}
const vfCrawled = (j, url) => ({ hours: j.hours, address: j.address, phone: j.phone, menu: j.menu || [], features: j.features || [], deals: j.deals || [], about: j.about || null, note: j.note || "", src: j.src || [url] });
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
  if (dup) { VF.open = dup.shop_id; VF.f = "all"; VF.q = ""; VF._scroll = null; vfDraw(); return toast("이미 등록된 업체 링크예요 · 그 업체를 열었어요", 4500); }
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
    delete VF.busy; VF.f = "todo"; VF.q = ""; VF.open = id; VF._scroll = null; vfDraw();   // 검색어가 남아 있으면 새 업체가 목록에서 안 보여서 지워요
    const got = [s.menu.length ? `메뉴 ${s.menu.length}개` : "", s.menu.some(m => m.price) ? "" : "가격 없음", j.hours ? "영업시간" : "", j.address ? "주소" : ""].filter(Boolean).join(" · ");
    toast(`‘${vfName(s)}’ 업체를 숨김으로 만들었어요 (목록 맨 아래 · 펼쳐 둠) · ${got}${s.menu.some(m => m.price) ? "" : " — 가격표 페이지 링크나 📋 캡처로 한 번 더 가져와 주세요"}`, 9000);
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
    // 가격표 사진: 같은 메뉴(이름 · 시간)가 이미 있으면 빈 칸(설명 · 분류 · 팁 · 가격)만 채우고, 없으면 더해요
    const fill = (o, m) => { const r = { ...o }; Object.keys(m).forEach(k => { if (m[k] != null && m[k] !== "" && (r[k] == null || r[k] === "")) r[k] = m[k]; }); return r; };
    const same = (o, m) => String(o.name || "").trim().toLowerCase() === String(m.name || "").trim().toLowerCase() && (+o.minutes || 0) === (+m.minutes || 0);
    const mergeImg = () => { const out = (prev.menu || []).slice(); (j.menu || []).forEach(m => { const k = out.findIndex(o => same(o, m)); if (k >= 0) out[k] = fill(out[k], m); else out.push(m); }); return out; };
    const c = isImg ? { ...prev, menu: mergeImg(), deals: [...new Set((prev.deals || []).concat(j.deals || []))], about: prev.about || j.about || null, src: [...new Set((prev.src || []).concat(j.src || []))], note: [prev.note, j.note].filter(Boolean).join(" · ") }
      : vfMerge(prev, vfCrawled(j, url));
    delete VF.busy;
    // 홈페이지 링크가 아직 없으면, 정보를 실제로 가져온 사이트 주소를 홈페이지로 같이 저장해요 (페이스북 · 인스타 · 우리 저장소 사진은 빼요)
    const xs = vfSrc(s.id), got = (j.menu || []).length || j.hours || j.address || j.phone;
    let web = null; try { if (!isImg && !xs.web && got && !/facebook\.com|fb\.com|fb\.me|instagram\.com|supabase\.co/i.test(url)) web = new URL(url).origin + "/"; } catch (e) {}
    await vfSave(s.id, { crawled: c, crawled_at: new Date().toISOString(), review: "todo", ...(web ? { web } : {}) }, (web ? `🌐 홈페이지 링크도 저장했어요 (${web.replace(/^https?:\/\//, "")}) · ` : "") + ((!isImg && !(j.menu || []).length && (c.menu || []).length) ? `이번엔 메뉴를 못 찾아서 예전에 모은 메뉴 ${c.menu.length}개를 그대로 뒀어요 — 메뉴 페이지 링크나 📋 가격표 캡처로 다시 해 보세요` : `가져왔어요 · 메뉴 ${(j.menu || []).length}개${j.hours ? " · 영업시간" : ""}${j.address ? " · 주소" : ""} — 비교해서 넣어 주세요`));
  } catch (e) { delete VF.busy; vfDraw(); toast("가져오기 실패: " + e.message, 6000); }
}

/* ===================== 🖼️ 이미지 검수 ===================== */
const MQ_SRC = { field: ["📷", "현장 사진", "우리가 찍음 · 공개 가능"], owner: ["🤝", "업체 제공", "사진 허락한 업체만 공개"], site: ["🌐", "홈페이지 · 캡처 후보", "허락 전 보여 주기용 · 공개 안 됨"] };
const MQ_ISS = { fake: "날조 · 과한 보정", distort: "왜곡 · 늘어남", text: "큰 글자 · 가격표", watermark: "워터마크 · 다른 로고", face: "사람 얼굴", body: "노출 · 선정적", blur: "흐림 · 어두움", stock: "스톡 사진 같음", off: "가게와 관계없음", logo: "로고 · 그래픽 (사진 아님)" };
const MQ_V = { none: ["판정 없음", ""], pass: ["✓ 통과", "g"], issue: ["⚠ 문제", "r"], hold: ["⏸ 보류", "w"] };
const mqCan = m => m.verdict === "pass" && m.source !== "site" && (m.source === "field" || vfSrc(m.shop_id).photo_ok);
const mqWhy = m => m.source === "site" ? "홈페이지 · 캡처 후보는 공개 안 돼요 (업체가 허락하면 출처를 '업체 제공'으로 바꿔요)" : m.verdict !== "pass" ? "판정이 '통과'여야 공개돼요" : !vfSrc(m.shop_id).photo_ok && m.source === "owner" ? "업체 사진 사용 허락이 필요해요 ([🤝 허락 받았어요]를 눌러요)" : "";

// 📷 사진 사용 허락 — 업체 정보 검수와 같은 값(shop_sources.photo_ok)을 이미지 검수에서도 바로 켜고 꺼요
function mqPerm(id, small) {
  if (!id || !vfShop(id)) return "";
  const x = vfSrc(id);
  return x.photo_ok
    ? `<span class="mq-perm ok" title="${esc(x.photo_note || "")}">📷 사진 허락됨${x.photo_note && !small ? ` <em>${esc(x.photo_note)}</em>` : ""} <button type="button" class="lnk" data-mqperm="${esc(id)}" data-on="0">끄기</button></span>`
    : `<span class="mq-perm no">🔒 사진 허락 없음 ${small ? "" : `<input data-mqpn="${esc(id)}" placeholder="허락 받은 방법 · 날짜 (예: 11/26 잘로)">`}<button type="button" class="btn sm" data-mqperm="${esc(id)}" data-on="1">🤝 허락 받았어요</button></span>`;
}
function mqPermBind(el) {
  if (el._perm) return; el._perm = 1;
  el.addEventListener("click", ev => {
    const b = ev.target.closest("[data-mqperm]"); if (!b) return;
    const id = b.dataset.mqperm, s = vfShop(id), nm = s ? vfName(s) : id;
    if (b.dataset.on === "1") {
      const inp = b.closest(".mq-perm").querySelector("[data-mqpn]"), d = new Date();
      const note = (inp && inp.value.trim()) || `${d.getMonth() + 1}/${d.getDate()} 이미지 검수에서 표시 (${(ME && ME.email || "").split("@")[0]})`;
      confirmBox(`${nm} 사진 사용 허락을 켤까요?`, () => vfSave(id, { photo_ok: true, photo_note: note }, "📷 사진 허락으로 표시했어요 · 통과한 업체 제공 사진을 대표로 쓸 수 있어요"), `메모: ${note} · 업체 정보 검수에도 똑같이 반영돼요`, "허락 켜기", false);
    } else confirmBox(`${nm} 사진 허락을 끌까요?`, () => vfSave(id, { photo_ok: false }, "사진 허락을 껐어요 · 업체 제공 사진은 공개 안 돼요"), "이미 대표로 나가는 업체 제공 사진은 직접 내려 주세요", "끄기");
  });
}

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
  // 업체 고르기: 통과한 사진이 있는 업체는 ✅ 묶음 맨 위에 (대표 사진 공개 중이면 ★)
  const st = x => { const ms = L.filter(m => m.shop_id === x.id), c = k => ms.filter(m => m.verdict === k).length, live = !!x.img && ms.some(m => m.work_url === x.img && mqCan(m));
    return { n: ms.length, pass: c("pass"), todo: c("none"), issue: c("issue"), hold: c("hold"), live }; };
  const opt = x => { const t = st(x), bits = [t.pass ? `✅ 통과 ${t.pass}` : "", t.live ? "★ 대표 공개" : "", t.todo ? `⏳ 검사 전 ${t.todo}` : "", t.issue ? `⚠️ 문제 ${t.issue}` : "", t.hold ? `⏸ 보류 ${t.hold}` : ""].filter(Boolean);
    return `<option value="${esc(x.id)}" ${MQ.shop === x.id ? "selected" : ""}>${t.pass ? "✅ " : ""}${esc(vfName(x))} · ${esc(cityName(x.city))}${bits.length ? " — " + bits.join(" · ") : ""}</option>`; };
  const G = [["✅ 통과한 사진이 있는 업체", S.filter(x => st(x).pass)], ["⏳ 검사 중 (통과 전)", S.filter(x => { const t = st(x); return !t.pass && t.n; })], ["📷 아직 사진 없음", S.filter(x => !st(x).n)]];
  const shopOpts = G.filter(g => g[1].length).map(([lb, xs]) => `<optgroup label="${lb} · ${xs.length}곳">${xs.map(opt).join("")}</optgroup>`).join("");
  el.innerHTML = `<div class="mq">
    <div class="vf-tiles"><div><small>전체 사진</small><b>${cnt.all}</b></div><div><small>판정 대기</small><b class="w">${cnt.todo}</b></div><div><small>통과</small><b class="g">${cnt.pass}</b></div><div><small>문제 표시</small><b class="r">⚠ ${cnt.issue}</b></div><div><small>사진 공개 중인 업체</small><b>${live} / ${S.length}</b></div></div>
    ${(() => { const ex = (typeof shops !== "undefined" ? shops : []).filter(x => typeof isExtImg === "function" && (isExtImg(x.img) || (x.menuImgs || []).some(m => isExtImg(m.src))));
      return ex.length ? `<div class="mq-ext"><b>🔗 바깥 사이트 사진 주소를 쓰는 업체 ${ex.length}곳</b> <small>대표 · 가격표 사진이 다른 사이트 주소 그대로예요 (그 사이트가 지우거나 막으면 깨져요). 엉클데이 저장소로 옮겨 우리 주소로 바꿔요.</small>
        <button class="btn sm main" id="mqExtGo" ${MQ.extBusy ? "disabled" : ""}>${MQ.extBusy ? esc(MQ.extBusy) : `🔄 ${ex.length}곳 모두 엉클데이로 옮기기`}</button></div>` : ""; })()}
    ${(() => { const C = MQ.cut || {}, n = (C.list || []).length;
      return `<div class="mq-ext mq-cut"><b>✂️ 예전에 올린 사진 중 잘린 작업본</b> <small>${C.done == null ? "예전엔 작업본을 무조건 16:9 가운데로 잘랐어요. 로고 · 그래픽이 잘렸는지 모두 살펴봐요 (사진은 꽉 채우는 게 좋아서 그대로 둬요 · 원본은 그대로 남아 있어요)" : n ? `${C.done}장 중 <b>${n}장</b>이 잘린 로고 · 그래픽이에요 — 원본에서 '전체 보이기'로 다시 만들어요` : `${C.done}장 모두 괜찮아요${C.fixed ? ` · 방금 ${C.fixed}장 고쳤어요` : ""}`}</small>
        ${n ? `<button class="btn sm main" id="mqCutFix" ${C.busy ? "disabled" : ""}>${C.busy ? esc(C.busy) : `🖼️ ${n}장 모두 전체 보이기로 다시 만들기`}</button>` : `<button class="btn sm" id="mqCutGo" ${C.busy ? "disabled" : ""}>${C.busy ? esc(C.busy) : C.done == null ? "🔍 잘린 사진 찾기" : "🔍 다시 찾기"}</button>`}</div>`; })()}
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
    <div class="vf-bar"><select id="mqShop"><option value="">모든 업체</option>${shopOpts}</select>${MQ.shop && vfShop(MQ.shop) ? `<span class="mq-uplk">${vfSrc(MQ.shop).web ? `<a class="vf-lk" href="${esc(vfSrc(MQ.shop).web)}" target="_blank" rel="noopener">🌐 홈페이지</a>` : ""}${vfSrc(MQ.shop).fb ? `<a class="vf-lk fb" href="${esc(vfSrc(MQ.shop).fb)}" target="_blank" rel="noopener">📘 페이스북</a>` : ""}</span>${mqPerm(MQ.shop)}` : ""}
      ${(() => { const LS = MQ.shop ? L.filter(m => m.shop_id === MQ.shop) : L, cs = { all: LS.length, todo: LS.filter(m => m.verdict === "none").length, pass: LS.filter(m => m.verdict === "pass").length, issue: LS.filter(m => m.verdict === "issue").length, hold: LS.filter(m => m.verdict === "hold").length };
        // 업체를 골랐으면 숫자도 그 업체 것만 (예전엔 모든 업체 숫자라 '판정 대기 1'인데 목록이 비어 보였어요)
        return [["todo", "판정 대기"], ["pass", "통과"], ["issue", "문제"], ["hold", "보류"], ["all", "전체"]].map(([k, t]) => `<button class="chip ${MQ.f === k ? "on" : ""}" data-mqf="${k}">${t} ${cs[k]}</button>`).join("")
          + (MQ.shop && cnt.todo > cs.todo ? `<span class="hint" style="margin-left:6px">다른 업체에 판정 대기 ${cnt.todo - cs.todo}장 <button class="btn sm" id="mqAllShops">모든 업체 보기</button></span>` : ""); })()}</div>
    <div class="mq-list">${list.map(mqCard).join("") || `<p class="hint" style="padding:16px">${MQ.shop ? "이 업체 사진이 아직 없어요 · 위에서 올려 주세요" : "사진이 없어요 · 위에서 올려 주세요"}</p>`}</div></div>`;
  mqBind(el);
  const as = el.querySelector("#mqAllShops"); if (as) as.onclick = () => { MQ.shop = ""; MQ.f = "todo"; mqDraw(); };
}
// 메모 속 긴 주소는 '사이트 이름 · 열기' 링크로 짧게 (휴대폰에서 화면이 옆으로 밀리지 않게)
const mqNoteHtml = t => esc(t).replace(/https?:\/\/[^\s<]+/g, u => { let h = u; try { h = new URL(u.replace(/&amp;/g, "&")).hostname.replace(/^www\./, "").replace(/^scontent[^.]*\./, ""); } catch (e) {} return `<a href="${u}" target="_blank" rel="noopener noreferrer">${h} 열기 ↗</a>`; });
// ✂️ 자를 위치 고르기: 가로로 긴 사진은 ◀ 왼쪽 ~ 오른쪽 ▶, 세로로 긴 사진은 ▲ 위 ~ 아래 ▼ · 원본 위에 주황 네모(16:9)로 보여 줘요
function mqCropUI(card, a) {
  const wide = a.r > 16 / 9, rg = card.querySelector("[data-mqpos]"); if (!rg) return;
  card.querySelectorAll('[data-mqstamp^="crop:"][data-v]').forEach(b => b.textContent = wide ? b.dataset.h : b.dataset.v);
  card.querySelector("[data-mqsl0]").textContent = wide ? "◀ 왼쪽" : "▲ 위"; card.querySelector("[data-mqsl1]").textContent = wide ? "오른쪽 ▶" : "아래 ▼";
  const sl = card.querySelector(".mq-slide"); if (Math.abs(a.r - 16 / 9) < 0.03) { sl.hidden = true; return; }
  const im = card.querySelector(".mq-3 > div:first-child img"), box = im && im.parentElement; if (!im) return;
  box.style.position = "relative"; let fr = box.querySelector(".mq-cropbox"); if (!fr) { fr = document.createElement("i"); fr.className = "mq-cropbox"; box.appendChild(fr); }
  const draw = () => { const p = rg.value / 100, W = im.offsetWidth, H = im.offsetHeight; if (!W) return;
    let w = W, h = H, x = 0, y = 0; if (wide) { w = H * 16 / 9; x = (W - w) * p; } else { h = W * 9 / 16; y = (H - h) * p; }
    Object.assign(fr.style, { left: im.offsetLeft + x + "px", top: im.offsetTop + y + "px", width: w + "px", height: h + "px" }); };
  rg.oninput = draw; if (im.complete) draw(); else im.addEventListener("load", draw, { once: true });
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
      ${m.note ? `<p class="mq-note">${/^원래 주소:/.test(m.note) ? "🔗" : "🤖"} ${mqNoteHtml(m.note)}</p>` : ""}
      <div class="mq-an" data-mqan><small>🔍 사진 살펴보는 중…</small></div>
      ${m.orig_url ? `<div class="mq-frame"><b>작업본 틀</b><button class="btn sm" data-mqstamp="fit">🖼️ 전체 보이기 (안 잘림)</button>
        ${[["crop:0", "▲ 위쪽", "◀ 왼쪽"], ["crop:.5", "● 가운데", "● 가운데"], ["crop:1", "▼ 아래쪽", "▶ 오른쪽"]].map(([k, v, h]) => `<button class="btn sm" data-mqstamp="${k}" data-v="${v} 남기기" data-h="${h} 남기기">${v} 남기기</button>`).join("")}
        <div class="mq-slide"><span data-mqsl0>▲ 위</span><input type="range" min="0" max="100" value="50" data-mqpos aria-label="자를 위치"><span data-mqsl1>아래 ▼</span><button class="btn sm main" data-mqstamp="crop:pos">✂️ 이 위치로 자르기</button></div>
        <small>원본 위 <b style="color:#f97316">주황 네모</b>가 손님 화면에 보일 부분이에요 · 막대를 밀어 위치를 고른 뒤 [이 위치로 자르기]</small></div>` : ""}
      <div class="mq-btns">${m.work_url ? `<button class="btn sm" data-mqai ${MQ.busy[m.id] ? "disabled" : ""}>${MQ.busy[m.id] ? "검사 중…" : "🤖 AI 검사"}</button>` : ""}
        <button class="btn sm ${m.verdict === "pass" ? "main" : ""}" data-mqv="pass">✓ 통과</button><button class="btn sm ${m.verdict === "issue" ? "bad" : ""}" data-mqv="issue">⚠ 문제</button><button class="btn sm" data-mqv="hold">⏸ 보류</button>
        <span style="flex:1"></span>${main ? "" : can ? `<button class="btn sm main" data-mqmain>★ 대표 사진으로</button>` : `<span class="mq-nomain" title="${esc(why)}">★ 대표 사진으로 <em>— ${esc(why.replace(/ \(.*\)$/, ""))}</em></span>${m.source === "owner" && m.verdict === "pass" && !x.photo_ok ? mqPerm(m.shop_id, 1) : ""}`}${main ? `<button class="btn sm" data-mqunmain>대표에서 내리기</button>` : ""}<label class="btn sm" title="이 카드의 사진을 다른 사진으로 바꿔요 · 판정은 처음부터 다시">📷 다른 사진으로 바꾸기<input type="file" accept="image/*" data-mqrep hidden></label><button class="btn sm" data-mqdel title="기록 지우기">🗑</button></div>
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
// 🔍 사진 살펴보기: 비율 · 16:9로 자르면 잘리는 양 · 로고/그래픽 같은지 (색이 적고 바탕이 한 색)
function mqAnalyze(img) {
  const R = 16 / 9, r = img.width / img.height, loss = 1 - Math.min(r / R, R / r);
  let logo = false, edge = "rgb(243,239,230)";
  try { const c = document.createElement("canvas"), N = 48; c.width = N; c.height = N; const x = c.getContext("2d"); x.drawImage(img, 0, 0, N, N);
    const d = x.getImageData(0, 0, N, N).data, q = new Set(); let er = 0, eg = 0, eb = 0, en = 0;
    for (let i = 0; i < d.length; i += 4) q.add((d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4));
    for (let y = 0; y < N; y++) for (let k = 0; k < N; k++) { if (y > 1 && y < N - 2 && k > 1 && k < N - 2) continue; const p = (y * N + k) * 4; er += d[p]; eg += d[p + 1]; eb += d[p + 2]; en++; }
    er /= en; eg /= en; eb /= en; edge = `rgb(${Math.round(er)},${Math.round(eg)},${Math.round(eb)})`;
    let same = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - er) + Math.abs(d[i + 1] - eg) + Math.abs(d[i + 2] - eb) < 60) same++;
    const bg = same / (N * N); logo = (q.size < 140 && bg > 0.35) || (q.size < 70);
  } catch (e) {}
  return { r, loss, logo, edge, w: img.width, h: img.height };
}
// 작업본이 '전체 보이기'로 만들어졌는지: 원본을 '전체 넣기'로 그린 것과 '16:9로 자른 것'을 작게 그려서 작업본과 어느 쪽이 더 닮았는지 비교해요
function mqIsFit(wk, a, img) {
  try { const N = 64, H = 36, px = (draw) => { const c = document.createElement("canvas"); c.width = N; c.height = H; const x = c.getContext("2d"); draw(x); return x.getImageData(0, 0, N, H).data; };
    const W = px(x => x.drawImage(wk, 0, 0, N, H));
    const mad = (A, rect) => { let t = 0, n = 0; for (let y = rect[1]; y < rect[3]; y++) for (let k = rect[0]; k < rect[2]; k++) { const p = (y * N + k) * 4; t += Math.abs(A[p] - W[p]) + Math.abs(A[p + 1] - W[p + 1]) + Math.abs(A[p + 2] - W[p + 2]); n++; } return n ? t / n : 999; };
    const sc = a.logo ? 0.82 : 1, k = Math.min(N * sc / img.width, H * sc / img.height), dw = img.width * k, dh = img.height * k, fx = (N - dw) / 2, fy = (H - dh) / 2;
    const F = px(x => x.drawImage(img, fx, fy, dw, dh));
    const fitD = mad(F, [Math.ceil(fx) + 1, Math.ceil(fy) + 1, Math.floor(fx + dw) - 1, Math.floor(fy + dh) - 1]);
    const R = 16 / 9; let cropD = 999;
    for (const ay of [0, 0.4, 0.5, 1]) { let sw = img.width, sh = img.height, sx = 0, sy = 0;
      if (sw / sh > R) { sw = sh * R; sx = (img.width - sw) / 2; } else { sh = sw / R; sy = (img.height - sh) * ay; }
      cropD = Math.min(cropD, mad(px(x => x.drawImage(img, sx, sy, sw, sh, 0, 0, N, H)), [0, 0, N, H])); }
    return fitD < cropD; } catch (e) { return false; }
}
const mqRatioTxt = a => { const r = a.r; return Math.abs(r - 1) < 0.06 ? "정사각" : Math.abs(r - 16 / 9) < 0.08 ? "16:9" : Math.abs(r - 4 / 3) < 0.06 ? "4:3" : Math.abs(r - 3 / 2) < 0.06 ? "3:2" : r < 1 ? "세로 사진" : r > 2.2 ? "아주 긴 가로" : "가로 사진"; };
// 작업본 틀: auto = 많이 잘리거나 로고면 '전체 보이기', 아니면 자르기 · crop 의 ay = 위(0) ~ 아래(1) 어디를 남길지
async function mqStamp(blob, shopName, stamp = true, mode = "auto", ay = null) {
  const u = URL.createObjectURL(blob);
  try {
    const [img, logo] = await Promise.all([mqLoadImg(u), stamp ? mqLogo() : null]);
    const R = 16 / 9, an = mqAnalyze(img), fit = mode === "fit" || (mode === "auto" && an.logo && an.loss > 0.1);   // 사진은 꽉 채우고(자르기), 로고 · 그래픽만 전체 보이기
    let w, h, cv, x;
    if (fit) {   // 자르지 않고 전체 넣기 — 로고는 바탕색으로, 사진은 흐린 같은 사진으로 여백을 채워요
      w = 1600; h = Math.round(w / R); cv = document.createElement("canvas"); cv.width = w; cv.height = h; x = cv.getContext("2d"); x.imageSmoothingQuality = "high";
      if (an.logo) { x.fillStyle = an.edge; x.fillRect(0, 0, w, h); }
      else { const k = Math.max(w / img.width, h / img.height); x.filter = "blur(28px) brightness(.8)"; x.drawImage(img, (w - img.width * k) / 2 - 40, (h - img.height * k) / 2 - 40, img.width * k + 80, img.height * k + 80); x.filter = "none"; }
      const m = an.logo ? 0.82 : 1, k = Math.min(w * m / img.width, h * m / img.height), dw = img.width * k, dh = img.height * k;
      x.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } else {
      // 16:9 로 자르기 (세로 사진은 기본 위쪽 40% 지점 기준 — 간판 · 실내가 보통 위에 있어요)
      let sw = img.width, sh = img.height, sx = 0, sy = 0;
      if (sw / sh > R) { sw = Math.round(sh * R); sx = Math.round((img.width - sw) * (ay != null ? ay : 0.5)); } else { sh = Math.round(sw / R); sy = Math.round((img.height - sh) * (ay != null ? ay : img.height > img.width ? 0.4 : 0.5)); }
      w = Math.min(1600, sw); h = Math.round(w / R); cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      x = cv.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    }
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
  const cg = el.querySelector("#mqCutGo"); if (cg) cg.onclick = () => mqScanCut();
  const cf = el.querySelector("#mqCutFix"); if (cf) cf.onclick = () => confirmBox(`${MQ.cut.list.length}장을 원본에서 '전체 보이기'로 다시 만들까요?`, () => mqFixCut(), "자르지 않고 전체가 보이게 · 대표 사진이면 손님 화면도 바뀌어요 · 원본은 그대로", "다시 만들기", false);
  const eg = el.querySelector("#mqExtGo"); if (eg) eg.onclick = async () => {
    const ex = shops.filter(x => isExtImg(x.img) || (x.menuImgs || []).some(m => isExtImg(m.src))); let ok = 0, bad = [];
    for (const [k, x] of ex.entries()) { MQ.extBusy = `옮기는 중… ${k + 1}/${ex.length}`; mqDraw();
      try { if (isExtImg(x.img)) x.img = await toOurImg(x.img, "shops/" + x.id);
        for (const m of x.menuImgs || []) if (isExtImg(m.src)) m.src = await toOurImg(m.src, `shops/${x.id}-menu`, 2000, 0.85);
        await dbSaveShop(x); ok++; } catch (e) { bad.push(vfName(x)); } }
    delete MQ.extBusy; mqDraw(); toast(`${ok}곳을 엉클데이 주소로 바꿨어요${bad.length ? ` · 못 가져온 곳 ${bad.length}곳: ${bad.slice(0, 4).join(", ")} (업체 편집에서 파일로 올려 주세요)` : ""}`, 8000); };
  mqPermBind(el);
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
    b.innerHTML = !id || !s2 ? "" : `${x2.web ? `<a class="vf-lk" href="${esc(x2.web)}" target="_blank" rel="noopener">🌐 홈페이지</a>` : ""}${x2.fb ? `<a class="vf-lk fb" href="${esc(x2.fb)}" target="_blank" rel="noopener">📘 페이스북</a>` : ""}<a class="vf-lk ud" href="${vfPage(s2)}" target="_blank" rel="noopener">👁 엉클데이</a>${!x2.web && !x2.fb ? `<span class="hint">링크 없음 · 업체 정보 검수에서 넣어요</span>` : ""}${mqPerm(id)}`; };
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
      if (sc.value === "owner" && !vfSrc(m.shop_id).photo_ok) toast("업체 제공으로 바꿨어요 · 허락을 받았으면 [🤝 허락 받았어요]를 눌러 주세요", 4500);
      mqUpd(m, { source: sc.value }, `출처를 ${MQ_SRC[sc.value][1]} 로 바꿨어요`);
      if (sc.value === "site") { const s2 = vfShop(m.shop_id); if (s2 && s2.img === m.work_url) mqMain(m, false); } };
    // 🔍 원본 살펴보기 → 몇 % 잘리는지 · 로고 같은지 알려 주고, 작업본이 잘렸으면 '전체 보이기'를 권해요
    const an = card.querySelector("[data-mqan]"); if (an && m.orig_url) Promise.all([mqLoadImg(m.orig_url), m.work_url ? mqLoadImg(m.work_url).catch(() => null) : null]).then(([img, wk]) => { const a = mqAnalyze(img), pct = Math.round(a.loss * 100);
      const need = a.logo && a.loss > 0.1, done = need && wk && mqIsFit(wk, a, img), warn = need && !done;
      an.innerHTML = `<small class="${warn ? "bad" : "ok"}">🔍 원본 ${a.w}×${a.h} · ${mqRatioTxt(a)}${a.loss > 0.05 ? ` · 16:9로 자르면 <b>${pct}%</b> 잘려요` : " · 16:9에 딱 맞아요"}${a.logo ? " · <b>로고 · 그래픽 같아요</b>" : ""}${a.w < 800 ? " · 작아요 (흐리게 보일 수 있어요)" : ""}${warn ? " → <b>[🖼️ 전체 보이기]</b>로 작업본을 만들어 주세요" : done ? " → ✅ 작업본은 전체가 보이게 만들어져 있어요" : !a.logo && a.loss > 0.3 ? " → 사진은 칸에 꽉 채워요 · 간판 · 사람이 잘렸으면 [▲ 위쪽] · [▼ 아래쪽]으로 다시 만들어요" : ""}</small>`;
      mqCropUI(card, a);
      if (a.logo && !(m.issues || []).includes("logo")) { const cb = card.querySelector('[data-mqis="logo"]'); if (cb) cb.closest("label").classList.add("sug"); }
    }).catch(() => { an.innerHTML = `<small>원본을 열지 못해 살펴보지 못했어요</small>`; });
    card.querySelectorAll("[data-mqstamp]").forEach(rs => rs.onclick = async () => {
      let [mode, ay] = rs.dataset.mqstamp.split(":"); if (ay === "pos") ay = String((+card.querySelector("[data-mqpos]").value) / 100);
      card.querySelectorAll("[data-mqstamp]").forEach(b => b.disabled = true); rs.textContent = "만드는 중…";
      try { await mqRemake(m, mode, ay != null ? +ay : null); toast(mode === "fit" ? "작업본을 다시 만들었어요 · 자르지 않고 전체가 보여요" : "작업본을 다시 만들었어요 · 고른 쪽을 남기고 16:9로 잘랐어요"); mqDraw();
      } catch (e) { dbErr(e, "작업본 다시 만들기"); mqDraw(); }
    });
    // 📷 다른 사진으로 바꾸기 — 같은 업체 · 같은 출처 그대로, 원본 · 작업본만 새 사진으로 (판정 · 문제 표시는 처음부터)
    const rp = card.querySelector("[data-mqrep]"); if (rp) rp.onchange = async () => {
      const f = rp.files && rp.files[0]; if (!f) return; const lb = rp.closest("label"); lb.classList.add("busy"); lb.firstChild.textContent = "바꾸는 중… ";
      try {
        const s2 = vfShop(m.shop_id), wasMain = s2 && s2.img === m.work_url, tag = `media/${m.shop_id}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
        let [o2, w2] = await Promise.all([mqShrink(f, 2400), mqShrink(f, 1600)]);
        try { w2 = await mqStamp(w2, s2 ? vfName(s2) : m.shop_id, mqStampOn()); } catch (e) {}
        const [ou, wu] = await Promise.all([mqPut(o2, tag + "-o.jpg"), mqPut(w2, tag + "-w.jpg")]);
        const old = [m.orig_url, m.work_url].filter(u => u && u.includes("/object/public/images/media/")).map(u => u.split("/object/public/images/")[1]);
        if (wasMain) { delete s2.img; delete s2.imgPos; try { await dbSaveShop(s2); } catch (e) { dbErr(e, "대표 사진 내리기"); } }
        const r = await sb.from("shop_media").update({ orig_url: ou, work_url: wu, verdict: "none", issues: [], note: null, checked_at: new Date().toISOString(), checked_by: ME.email }).eq("id", m.id).select().single();
        if (r.error) throw r.error; Object.assign(m, r.data); MQ.keep.add(m.id);
        if (old.length) sb.storage.from("images").remove(old);
        toast(wasMain ? "사진을 바꿨어요 · 대표 사진에서는 내렸어요 · 판정(통과) 후 다시 [★ 대표 사진으로]를 눌러 주세요" : "사진을 바꿨어요 · 판정해 주세요", 6000); mqDraw();
      } catch (e) { dbErr(e, "사진 바꾸기"); mqDraw(); }
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
// 🔄 원본에서 작업본 다시 만들기 (대표 사진이면 업체 사진도 새 작업본으로 바꿔요)
async function mqRemake(m, mode, ay) {
  const s2 = vfShop(m.shop_id), blob = await mqFetch(new URL(m.orig_url, location.href).href);   // 다른 사이트 원본도 서버를 거쳐 가져와요
  const w = await mqStamp(await mqShrink(blob, 2400), s2 ? vfName(s2) : m.shop_id, mqStampOn(), mode, ay);
  const wu = await mqPut(w, `media/${m.shop_id}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}-w.jpg`), old = m.work_url, wasMain = s2 && s2.img === old;
  const r = await sb.from("shop_media").update({ work_url: wu }).eq("id", m.id).select().single(); if (r.error) throw r.error; Object.assign(m, r.data);
  if (wasMain) { s2.img = wu; await dbSaveShop(s2); }
  if (old && old.includes("/object/public/images/media/")) sb.storage.from("images").remove([old.split("/object/public/images/")[1]]);
}
// 🔍 예전에 올린 사진 중 잘린 작업본 찾기 → 한꺼번에 '전체 보이기'로
async function mqScanCut() {
  const L = (MQ.list || []).filter(m => m.orig_url && m.work_url);
  MQ.cut = { busy: `살펴보는 중… 0/${L.length}`, list: [] }; mqDraw(); let i = 0;
  for (const m of L) { i++;
    try { const [img, wk] = await Promise.all([mqLoadImg(m.orig_url), mqLoadImg(m.work_url)]); const a = mqAnalyze(img);
      if (a.logo && a.loss > 0.1 && !mqIsFit(wk, a, img)) MQ.cut.list.push({ id: m.id, pct: Math.round(a.loss * 100), logo: a.logo }); } catch (e) {}
    if (i % 3 === 0 || i === L.length) { MQ.cut.busy = `살펴보는 중… ${i}/${L.length}`; const b = document.getElementById("mqCutGo"); if (b) b.textContent = MQ.cut.busy; } }
  MQ.cut.busy = ""; MQ.cut.done = L.length; mqDraw();
}
async function mqFixCut() {
  const ids = (MQ.cut && MQ.cut.list || []).map(x => x.id); let n = 0, k = 0;
  for (const id of ids) { k++; const m = MQ.list.find(x => x.id === id); if (!m) continue; MQ.cut.busy = `다시 만드는 중… ${k}/${ids.length}`; const b = document.getElementById("mqCutFix"); if (b) b.textContent = MQ.cut.busy;
    try { await mqRemake(m, "fit", null); n++; } catch (e) { dbErr(e, "작업본 다시 만들기"); } }
  MQ.cut = { list: [], done: MQ.cut.done, fixed: n }; toast(`${n}장을 '전체 보이기'로 다시 만들었어요 · 대표 사진이던 건 손님 화면도 바로 바뀌어요`, 6000); mqDraw();
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

// 📂 메뉴 분류 이름 → 영어 · 베트남어 (자주 쓰는 낱말만 · "네일 > 여성" 처럼 대분류 > 소분류)
const SEC_DICT = { "스파": ["Spa", "Spa"], "마사지": ["Massage", "Massage"], "네일": ["Nails", "Nail"], "남성": ["Men", "Nam"], "여성": ["Women", "Nữ"], "남자": ["Men", "Nam"], "여자": ["Women", "Nữ"],
  "페이셜": ["Facial", "Chăm sóc da mặt"], "얼굴": ["Facial", "Da mặt"], "헤어": ["Hair", "Tóc"], "샴푸": ["Hair wash", "Gội đầu"], "왁싱": ["Waxing", "Wax"], "속눈썹": ["Eyelashes", "Mi"], "바디": ["Body", "Body"],
  "패키지": ["Packages", "Gói"], "키즈": ["Kids", "Trẻ em"], "아동": ["Kids", "Trẻ em"], "발": ["Foot", "Chân"], "손": ["Hand", "Tay"], "기타": ["Other", "Khác"], "시술": ["Treatments", "Liệu trình"], "피부": ["Skin", "Da"] };
function secI18n(ko) {
  const t = String(ko || "").trim(); if (!t) return null;
  const parts = t.split(/\s*>\s*/), tr = k => parts.map(x => (SEC_DICT[x] || [])[k] || x).join(" > ");
  return { ko: t, en: tr(0), vi: tr(1) };
}

// 🔗 이름 속 시간으로 묶기: "스크럽 팩 (… 90분)" · "스크럽 팩 (… 120분)" 처럼 이름에만 시간이 있는 메뉴를
//    이름은 같게 (시간 글자 빼고) · 시간 칸은 90 · 120 으로 → 손님 화면에서 시간 버튼으로 묶여요
const vfTimeRx = /\s*(\d{2,3})\s*(분|min(?:s|utes)?|phút|p|')(?![a-z])/i;
const vfNoTime = t => String(t || "").replace(new RegExp(vfTimeRx.source, "gi"), "").replace(/\(\s*\)|\[\s*\]/g, "").replace(/\s*([+&·,])\s*(?=\)|$)/g, "").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").replace(/\s{2,}/g, " ").trim();
function vfTimeMerge(menu) {
  const nm = m => (m.name && typeof m.name === "object" ? m.name.ko || m.name.en || m.name.vi : m.name) || "";
  const cand = menu.map((m, i) => { const x = nm(m).match(vfTimeRx); return x ? { i, min: +x[1], base: vfNoTime(nm(m)) + "|" + ((m.sec && m.sec.ko) || "") } : null; }).filter(Boolean);
  const by = {}; cand.forEach(c => (by[c.base] = by[c.base] || []).push(c));
  const out = menu.map(m => ({ ...m })), groups = [];
  Object.values(by).forEach(g => { if (g.length < 2 || new Set(g.map(c => c.min)).size < 2) return;
    g.forEach(c => { const m = out[c.i]; if (+m.min && +m.min !== c.min) return;
      m.min = c.min; m.name = typeof m.name === "object" ? Object.fromEntries(Object.entries(m.name).map(([k, v]) => [k, vfNoTime(v)])) : vfNoTime(m.name); });
    groups.push({ name: vfNoTime(nm(menu[g[0].i])), mins: g.map(c => c.min).sort((a, b) => a - b) }); });
  return { menu: out, groups };
}

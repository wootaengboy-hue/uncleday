/* 엉클데이 관리자 — 업체 관리 (목록, 편집, 사진, CSV) */
/* ===== 상태 ===== */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const DAYS = ["일","월","화","수","목","금","토"];
const STAFF = [["ko","한국어"],["en","영어"],["vi","베트남어"],["ja","일본어"],["zh","중국어"]];

let shops = [];                  // 업체 (손님 화면 정보 + 관리자 메모 review/checks)
const PRIV = {};                 // 업체별 관리자 전용: 수수료율, 계약 정보
const META = {};                 // 업체별: 사이트 공개 여부, 순서
let catImgs = {};

const catOf = id => CATEGORIES.find(c => c.id === id);
const cityOf = id => CITIES.find(c => c.id === id);
const catName = id => catOf(id) ? catOf(id).name.ko : id || "-";
const cityName = id => cityOf(id) ? cityOf(id).name.ko : id || "-";
const imgSrc = p => p || "";
const isOk = s => s.verified !== false;
const isPub = s => !META[s.id] || META[s.id].published !== false;
const rateOf = id => +((PRIV[id] || {}).commission_rate || 0);
const needsReview = s => Array.isArray(s.review) && s.review.length > 0;
// 정보 확인 체크 항목 (마지막 '입점 동의'는 위의 '입점 확인 완료' 스위치와 같아요)
const CHK = [["address", "주소"], ["hours", "영업시간·휴무"], ["price", "가격"], ["langs", "응대 언어"]];
const chkCount = s => [CHK.filter(([k]) => (s.checks || {})[k]).length + (isOk(s) ? 1 : 0), CHK.length + 1];

function toast(msg, ms = 2600) {
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), ms);
}
function notice(kind, html, id, where = "notices") {
  if (id && document.getElementById(id)) document.getElementById(id).remove();
  const d = document.createElement("div"); d.className = "notice " + kind; if (id) d.id = id;
  d.innerHTML = html; $(where).appendChild(d); return d;
}

/* ===== 데이터베이스 저장 ===== */
const splitShop = s => { const o = clone(s); const notes = {}; ["review", "checks"].forEach(k => { if (o[k] !== undefined) { notes[k] = o[k]; delete o[k]; } }); return [o, notes]; };
async function dbSaveShop(s, oldId) {
  const [data, notes] = splitShop(s);
  if (oldId && oldId !== s.id) {
    const r = await sb.from("shops").update({ id: s.id }).eq("id", oldId); if (r.error) throw r.error;
    META[s.id] = META[oldId]; PRIV[s.id] = PRIV[oldId]; delete META[oldId]; delete PRIV[oldId];
  }
  const m = META[s.id] || { published: true, sort: 0 };
  let r = await sb.from("shops").upsert({ id: s.id, data, published: m.published !== false, sort: m.sort || 0, updated_by: ME.email }); if (r.error) throw r.error;
  const pv = PRIV[s.id] || { commission_rate: 0, contract: {} };
  r = await sb.from("shop_private").upsert({ shop_id: s.id, notes, commission_rate: +pv.commission_rate || 0, contract: pv.contract || {} }); if (r.error) throw r.error;
}
async function loadShops() {
  const [a, b, c] = await Promise.all([
    sb.from("shops").select("id,data,sort,published").order("sort").order("id"),
    sb.from("shop_private").select("shop_id,notes,commission_rate,contract"),
    sb.from("settings").select("key,value").eq("key", "cat_imgs")]);
  if (a.error) throw a.error; if (b.error) throw b.error;
  const pv = Object.fromEntries(b.data.map(x => [x.shop_id, x]));
  shops = a.data.map(x => { META[x.id] = { published: x.published, sort: x.sort }; const p = pv[x.id] || {};
    PRIV[x.id] = { commission_rate: +p.commission_rate || 0, contract: p.contract || {} }; return Object.assign(x.data, p.notes || {}); });
  catImgs = (c.data && c.data[0] && c.data[0].value) || {};
}
// 사진은 고르는 즉시 저장소에 올리고 주소를 돌려줘요
async function uploadImg(file, name, max = 1400, q = 0.82) {
  const blob = await shrink(file, max, q);
  const path = `${name}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}.jpg`;
  const r = await sb.storage.from("images").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
  if (r.error) throw r.error;
  return sb.storage.from("images").getPublicUrl(path).data.publicUrl;
}
const dbErr = (e, what = "저장") => { console.error(e); toast(`${what}에 실패했어요. ${e && e.message ? "(" + e.message + ")" : "인터넷 연결을 확인해 주세요."}`, 5000); };

/* ===== 목록 ===== */
function fillFilters() {
  $("fCity").innerHTML = `<option value="">지역 전체</option>` + CITIES.map(c => `<option value="${c.id}">${esc(c.name.ko)}</option>`).join("");
  $("fCat").innerHTML = `<option value="">카테고리 전체</option>` + CATEGORIES.map(c => `<option value="${c.id}">${c.icon} ${esc(c.name.ko)}</option>`).join("");
  ["q","fCity","fCat","fSt"].forEach(k => $(k).oninput = drawList);
}
function drawStats() {
  const ok = shops.filter(isOk).length;
  $("shopCount") && ($("shopCount").textContent = shops.length);
  const cities = new Set(shops.map(s => s.city)).size;
  $("stats").innerHTML = [
    ["전체 업체", shops.length], ["입점 확인됨", ok], ["정보 확인 중", shops.length - ok], ["⚠ 확인 필요", shops.filter(needsReview).length]
  ].map(([k, v], i) => `<div class="stat ${i === 3 ? "click" : ""}" ${i === 3 ? 'id="statReview" title="눌러서 확인 필요 업체만 보기"' : ""}><small>${k}</small><b>${v}</b></div>`).join("");
  if ($("statReview")) $("statReview").onclick = () => { $("fSt").value = "review"; drawList(); };
}
function drawList() {
  drawStats();
  const q = $("q").value.trim().toLowerCase(), city = $("fCity").value, cat = $("fCat").value, st = $("fSt").value;
  const list = shops.filter(s =>
    (!city || s.city === city) && (!cat || s.cat === cat) &&
    (!st || (st === "review" ? needsReview(s) : st === "hidden" ? !isPub(s) : st === "norate" ? !rateOf(s.id) : (st === "ok") === isOk(s))) &&
    (!q || (s.id + JSON.stringify(s.name) + JSON.stringify(s.tags)).toLowerCase().includes(q)));
  $("shopListCount") && ($("shopListCount").textContent = list.length === shops.length ? `${shops.length}곳` : `${list.length} / ${shops.length}곳`);
  const head = `<div class="row head"><span></span><span>업체</span><span class="c-cat">카테고리</span><span class="c-city">지역</span><span class="c-st">상태</span><span></span></div>`;
  if (!list.length) { $("list").innerHTML = head + `<div class="empty">조건에 맞는 업체가 없어요.</div>`; return; }
  $("list").innerHTML = head + list.map(s => {
    const c = catOf(s.cat);
    return `<div class="row">
      <div class="thumb">${s.img ? `<img src="${esc(imgSrc(s.img))}" alt="" style="object-position:${s.imgPos || "50% 50%"}">` : (c ? c.icon : "✨")}</div>
      <div class="nm"><b>${esc(s.name.ko || s.name.en || "(이름 없음)")}${s.best ? `<span class="badge best">✦ 엉클 인증</span>` : ""}${needsReview(s) ? `<span class="badge chk">⚠ 확인 필요</span>` : ""}${!isPub(s) ? `<span class="badge hid">사이트에서 숨김</span>` : ""}</b><small>${esc(s.name.en || "")} · ${esc(s.id)}</small>${needsReview(s) ? `<ul class="rv-list">${s.review.map(r => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}</div>
      <span class="c-cat">${c ? c.icon + " " : ""}${esc(catName(s.cat))}</span>
      <span class="c-city">${esc(cityName(s.city))}</span>
      <span class="c-st">${isOk(s) ? `<span class="badge ok">입점 확인됨</span>` : `<span class="badge wait">정보 확인 중</span>`}${s.geo && s.geoApprox ? `<br><small class="geo-apx">📍 대략 위치</small>` : !s.geo ? `<br><small class="geo-apx">📍 좌표 없음</small>` : ""}<br><small class="chk-prog ${chkCount(s)[0] === chkCount(s)[1] ? "full" : ""}">확인 ${chkCount(s)[0]}/${chkCount(s)[1]}</small><br><small class="rate-tag ${rateOf(s.id) ? "" : "none"}">수수료 ${rateOf(s.id) ? rateOf(s.id) + "%" : "미정"}</small></span>
      <span class="c-act"><button class="btn sm" data-edit="${esc(s.id)}">수정</button></span>
    </div>`;
  }).join("");
  $("list").querySelectorAll("[data-edit]").forEach(b => b.onclick = () => openEditor(b.dataset.edit));
}

/* ===== 편집 창 ===== */
const blankShop = () => ({
  id: "", cat: CATEGORIES[0].id, city: CITIES[0].id, verified: false,
  name: { ko: "", en: "", vi: "" }, rating: 0, reviews: 0, img: "",
  tags: [], desc: { ko: "", en: "" }, recommend: { ko: "", en: "" },
  address: { ko: "", en: "" }, map: "", open: "", close: "", closed: [], staffLangs: [], menu: []
});
const slug = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

function openEditor(id, preset, opts = {}) {
  const isNew = !id;
  const orig = isNew ? null : shops.find(s => s.id === id);
  const s = isNew ? (preset ? clone(preset) : blankShop()) : clone(orig);
  const pv = clone(PRIV[preset ? preset.id : id] || { commission_rate: 0, contract: {} }); pv.contract = pv.contract || {};
  let pub = isNew ? true : isPub(orig);
  if (preset) { pub = false; }
  if (opts.rate != null) pv.commission_rate = +opts.rate || 0;
  if (opts.contract) Object.assign(pv.contract, opts.contract);
  ["name","desc","recommend","address"].forEach(k => s[k] = s[k] || { ko: "", en: "", vi: "" });
  s.tags = s.tags || []; s.menu = s.menu || []; s.closed = s.closed || []; s.staffLangs = s.staffLangs || [];
  let idTouched = !isNew;

  const LN = [["ko", "한국어"], ["en", "영어"], ["vi", "베트남어"]];
  const pair = (key, label, area, req) => `<div class="three">${LN.map(([l, n], j) => `
    <label class="f"><span>${label} (${n})${req && !j ? " <em>*</em>" : ""}</span>${area
      ? `<textarea data-k="${key}.${l}">${esc(s[key][l] || "")}</textarea>` : `<input data-k="${key}.${l}" value="${esc(s[key][l] || "")}">`}</label>`).join("")}</div>`;

  $("layer").innerHTML = `<div class="overlay" id="ov"><div class="panel" role="dialog" aria-label="업체 편집">
    <div class="panel-head"><h2 id="pTitle"></h2>
      <button class="btn" id="pCancel">닫기</button><button class="btn main" id="pOk">저장</button></div>
    <div class="panel-body">
      ${needsReview(s) ? `<div class="review" id="revBox"><h3>⚠ 확인이 필요해요</h3>
        <ul>${s.review.map(r => `<li>${esc(r)}</li>`).join("")}</ul>
        <div><button class="btn sm" id="revDone" type="button">확인 끝 · 배너 지우기</button> <span class="hint">누른 뒤 '저장'을 눌러야 저장돼요.</span></div></div>` : ""}
      <div class="box">
        <label class="switch best-sw ${s.best ? "on" : ""}" id="bSw"><input type="checkbox" id="bChk" ${s.best ? "checked" : ""}>
          <div><b>✦ 엉클 인증업체 배지 달기</b><div class="hint">켜면 손님 화면의 업체 사진과 이름 옆에 반짝이는 '엉클 인증업체' 배지가 붙고, 목록에서 맨 앞에 보여요.</div></div></label>
        <label class="switch ${isOk(s) ? "on" : ""}" id="vSw"><input type="checkbox" id="vChk" ${isOk(s) ? "checked" : ""}>
          <div><b>입점 확인 완료</b><div class="hint">켜면 손님 화면에서 "정보 확인 중" 표시가 사라지고, 영업시간과 메뉴가 있으면 예약 폼이 열려요.</div></div></label>
        <div class="f"><span>정보 확인 체크 <small style="font-weight:400;color:var(--sub)">업체에 직접 확인한 항목에 체크해요. 손님에게는 안 보여요.</small></span>
          <div class="checks" id="chkList">${CHK.map(([k, n]) => `<label><input type="checkbox" data-chk="${k}" ${(s.checks || {})[k] ? "checked" : ""}>${n}</label>`).join("")}</div>
          <div class="hint" id="chkSum"></div></div>
        <label class="switch pub-sw ${pub ? "on" : ""}" id="pSw"><input type="checkbox" id="pChk" ${pub ? "checked" : ""}>
          <div><b>사이트에 보이기</b><div class="hint">끄면 손님 화면에서 이 업체가 사라져요. 예약·정산 기록은 그대로 남아요. (업체 삭제 대신 이걸 쓰세요)</div></div></label>
      </div>

      <div class="box contract"><h3>💼 계약·정산 <small>관리자만 봐요. 손님 화면에는 안 나와요</small></h3>
        <div class="three">
          <label class="f"><span>수수료율 (%) <em>*</em></span><input type="number" id="cRate" min="0" max="100" step="0.5" value="${pv.commission_rate || ""}" placeholder="예: 15"></label>
          <label class="f"><span>계약일</span><input type="date" data-c="date" value="${esc(pv.contract.date || "")}"></label>
          <label class="f"><span>담당자 이름</span><input data-c="person" value="${esc(pv.contract.person || "")}" placeholder="예: Ms. Linh (매니저)"></label>
        </div>
        <div class="three">
          <label class="f"><span>전화</span><input data-c="phone" value="${esc(pv.contract.phone || "")}" placeholder="+84 …"></label>
          <label class="f"><span>잘로(Zalo)</span><input data-c="zalo" value="${esc(pv.contract.zalo || "")}" placeholder="전화번호 또는 링크"></label>
          <label class="f"><span>카카오톡 / 기타 메신저</span><input data-c="kakao" value="${esc(pv.contract.kakao || "")}"></label>
        </div>
        <div class="two">
          <label class="f"><span>업체 예약 알림 언어</span><select data-c="msgLang">${[["vi", "베트남어"], ["en", "영어"], ["ko", "한국어"]].map(([k, n]) => `<option value="${k}" ${(pv.contract.msgLang || "vi") === k ? "selected" : ""}>${n}</option>`).join("")}</select></label>
          <label class="f"><span>정산 방법 (계좌·주기 등)</span><input data-c="settle" value="${esc(pv.contract.settle || "")}" placeholder="예: 매월 5일 계좌이체, Vietcombank …"></label>
        </div>
        <label class="f"><span>계약 메모</span><textarea data-c="memo" placeholder="예: 계약서 사진 위치, 특이 조건, 프로모션 합의 내용">${esc(pv.contract.memo || "")}</textarea></label>
        <div class="hint">수수료율은 <b>새로 들어오는 예약</b>에 적용돼요. 이미 들어온 예약의 수수료율은 예약 화면에서 따로 고칠 수 있어요.</div>
      </div>

      <div class="box"><h3>기본 정보</h3>
        ${pair("name", "업체명", false, true)}
        <div class="three">
          <label class="f"><span>카테고리 <em>*</em></span><select data-k="cat">${CATEGORIES.map(c => `<option value="${c.id}" ${c.id === s.cat ? "selected" : ""}>${c.icon} ${esc(c.name.ko)}</option>`).join("")}</select></label>
          <label class="f"><span>지역 <em>*</em></span><select data-k="city">${CITIES.map(c => `<option value="${c.id}" ${c.id === s.city ? "selected" : ""}>${esc(c.name.ko)}</option>`).join("")}</select></label>
          <label class="f"><span>아이디 (주소용) <em>*</em></span><input id="idIn" value="${esc(s.id)}" placeholder="예: dahan-spa"></label>
        </div>
        <div class="hint">아이디는 영어 소문자·숫자·- 만 써요. 업체 상세 주소에 쓰여서, 한 번 정하면 되도록 바꾸지 마세요.</div>
        <div class="err-text" id="idErr"></div>
      </div>

      <div class="box"><h3>대표 사진<small>가로 사진이 가장 잘 어울려요</small></h3>
        <div class="img-box">
          <div class="img-prev" id="imgPrev"></div>
          <div style="display:grid;gap:8px">
            <label class="btn" style="justify-content:center">📷 사진 올리기<input type="file" id="imgIn" accept="image/*" hidden></label>
            <button class="btn sm danger" id="imgDel" type="button">사진 빼기</button>
          </div>
        </div>
        <div class="focus-wrap" id="focusWrap" hidden>
          <div class="hint"><b>사진에서 꼭 보여야 하는 곳</b>(간판, 얼굴 등)을 눌러 주세요. 그곳을 중심으로 잘려요.</div>
          <div class="focus-src" id="focusSrc"><img id="focusImg" alt=""><i class="focus-dot" id="focusDot"></i></div>
          <div class="focus-prevs">
            <div><small>목록 카드에서는</small><div class="fp card"><img id="fpCard" alt=""></div></div>
            <div><small>상세 화면에서는</small><div class="fp hero"><img id="fpHero" alt=""></div></div>
            <button class="btn sm" id="focusReset" type="button">가운데로 되돌리기</button>
          </div>
        </div>
        <label class="f"><span>또는 사진 주소 직접 입력</span><input data-k="img" id="imgPath" value="${esc(s.img)}" placeholder="https://… 또는 images/파일명.jpg"></label>
      </div>

      <div class="box"><h3>소개</h3>
        ${pair("desc", "소개글", true)}
        ${pair("recommend", "이런 분께 추천", false)}
        <div><span class="f"><span>태그</span></span><div id="tagList" style="display:grid;gap:8px;margin-top:4px"></div>
          <button class="btn sm" id="tagAdd" type="button" style="margin-top:8px">＋ 태그 추가</button></div>
      </div>

      <div class="box"><h3>위치·영업</h3>
        ${pair("address", "주소", false)}
        <label class="f"><span>지도 링크 (구글맵 공유 주소)</span><input data-k="map" value="${esc(s.map)}" placeholder="https://maps.app.goo.gl/…"></label>
        <div class="f"><span>지도 좌표 (위도, 경도) <small style="font-weight:400;color:var(--sub)">'가까운 순' 정렬에 써요</small></span>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <input id="geoIn" style="flex:1;min-width:200px;padding:9px 11px;border:1px solid var(--line);border-radius:9px" placeholder="예: 16.06812, 108.22441" value="${s.geo ? s.geo.join(", ") : ""}">
            <a class="btn sm" id="geoView" target="_blank" ${s.geo ? `href="https://www.google.com/maps?q=${s.geo.join(",")}"` : "hidden"}>지도에서 확인</a>
            <span class="badge wait" id="geoApx" ${s.geo && s.geoApprox ? "" : "hidden"}>📍 대략 위치</span>
          </div>
          <div class="hint">구글 지도에서 업체 건물을 <b>마우스 오른쪽 클릭</b>(휴대폰은 길게 누르기)하면 맨 위에 숫자 두 개가 나와요. 그걸 복사해서 붙여 넣으면 정확한 위치가 돼요.</div>
          <div class="err-text" id="geoErr"></div></div>
        ${typeof GMAPS !== "undefined" && GMAPS.key ? `<div class="f"><span>구글 지도 연결 <small style="font-weight:400;color:var(--sub)">상세페이지에 구글 영업시간·평점·사진·지도가 자동으로 나와요</small></span>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <input id="gpIn" style="flex:1;min-width:200px;padding:9px 11px;border:1px solid var(--line);border-radius:9px" placeholder="구글 장소 ID (찾기 버튼으로 넣어요)" value="${esc(s.gplace || "")}">
            <button type="button" class="btn sm main" id="gpFind">🔎 구글에서 찾기</button>
            <button type="button" class="btn sm" id="gpClear" ${s.gplace ? "" : "hidden"}>연결 끊기</button>
          </div><div id="gpRes"></div></div>` : ""}
        <div class="two">
          <label class="f"><span>여는 시간</span><input type="time" data-k="open" value="${esc(s.open)}"></label>
          <label class="f"><span>닫는 시간</span><input type="time" data-k="close" value="${esc(s.close)}"></label>
        </div>
        <div class="f"><span>쉬는 요일</span><div class="checks">${DAYS.map((d, i) => `<label><input type="checkbox" data-day="${i}" ${s.closed.includes(i) ? "checked" : ""}>${d}</label>`).join("")}</div></div>
        <div class="f"><span>응대 가능 언어</span><div class="checks">${STAFF.map(([k, v]) => `<label><input type="checkbox" data-lang="${k}" ${s.staffLangs.includes(k) ? "checked" : ""}>${v}</label>`).join("")}</div></div>
        <div class="two">
          <label class="f"><span>평점 (0~5, 없으면 0)</span><input type="number" step="0.1" min="0" max="5" data-k="rating" value="${s.rating || 0}"></label>
          <label class="f"><span>후기 수</span><input type="number" min="0" data-k="reviews" value="${s.reviews || 0}"></label>
        </div>
      </div>

      <div class="box"><h3>메뉴·가격<small>가격은 베트남 동(₫), 숫자만. 0이면 "상담 후 안내"</small></h3>
        <div id="menuList" style="display:grid;gap:10px"></div>
        <button class="btn sm" id="menuAdd" type="button">＋ 메뉴 추가</button>
      </div>

      <div class="box"><h3>가격표 사진<small>업체에서 받은 코스별 가격표를 올려요. 여러 장 한 번에 올릴 수 있어요</small></h3>
        <div class="mb-grid" id="mbList"></div>
        <div><label class="btn" style="display:inline-flex">📄 가격표 사진 올리기<input type="file" id="mbIn" accept="image/*" multiple hidden></label></div>
        <div class="hint">글씨가 잘 보이도록 크게 저장해요. 손님은 상세 화면에서 눌러서 크게 볼 수 있어요. 사진마다 이름(예: 마사지 코스, 패키지)을 달아 두면 찾기 쉬워요.</div>
      </div>

      <div class="box"><h3>이용후기<small>손님이 보낸 후기를 확인하고 붙여 넣어요</small></h3>
        <div id="rvList" style="display:grid;gap:10px"></div>
        <button class="btn sm" id="rvAdd" type="button">＋ 후기 추가</button>
        <div class="hint">손님이 사이트에서 보낸 후기는 <b>후기</b> 탭에서 '게시'를 누르면 여기에 자동으로 들어가요. 카카오톡 등으로 받은 후기는 여기에 직접 넣어요. 후기가 있으면 위의 평점·후기 수는 자동으로 계산돼요. 직접 지어낸 후기는 넣지 마세요.</div>
      </div>

      ${isNew ? "" : `<div class="box"><h3>기타</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn sm" id="dupBtn" type="button">이 업체 복제</button>
          <button class="btn sm danger" id="delBtn" type="button">업체 삭제</button></div></div>`}
    </div></div></div>`;

  const title = () => $("pTitle").textContent = (isNew ? "새 업체 · " : "") + (s.name.ko || s.name.en || "이름 없음");
  title();

  // 일반 칸
  $("layer").querySelectorAll("[data-k]").forEach(el => el.oninput = () => {
    const [a, b] = el.dataset.k.split(".");
    let v = el.value;
    if (a === "rating" || a === "reviews") v = +v || 0;
    if (b) s[a][b] = v; else s[a] = v;
    if (a === "name") {
      title();
      if (!idTouched && (s.name.en || s.name.ko)) { $("idIn").value = slug(s.name.en) || ""; }
    }
    if (a === "img") drawImg();
  });
  $("idIn").oninput = () => { idTouched = true; };
  $("cRate").oninput = () => { pv.commission_rate = Math.min(100, Math.max(0, +$("cRate").value || 0)); };
  $("layer").querySelectorAll("[data-c]").forEach(el => el.oninput = () => { pv.contract[el.dataset.c] = el.value; });
  $("pChk").onchange = () => { pub = $("pChk").checked; $("pSw").classList.toggle("on", pub); };
  if ($("gpIn")) {
    const showMap = id => `<iframe style="width:100%;height:200px;border:0;border-radius:10px" loading="lazy" src="https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(GMAPS.key)}&q=place_id:${encodeURIComponent(id)}&language=ko"></iframe>`;
    if (s.gplace) $("gpRes").innerHTML = showMap(s.gplace);
    $("gpIn").oninput = () => { s.gplace = $("gpIn").value.trim() || undefined; if (!s.gplace) delete s.gplace; };
    $("gpClear").onclick = () => { delete s.gplace; $("gpIn").value = ""; $("gpRes").innerHTML = ""; $("gpClear").hidden = true; };
    $("gpFind").onclick = async () => {
      const q = [s.name.vi || s.name.en || s.name.ko, (s.address && (s.address.vi || s.address.en)) || (cityOf(s.city) ? cityOf(s.city).name.en : "")].filter(Boolean).join(", ");
      $("gpRes").innerHTML = `<div class="hint">"${esc(q)}" 찾는 중…</div>`;
      const ids = await gplaceSearch(q);
      if (!ids.length) { $("gpRes").innerHTML = `<div class="err-text">못 찾았어요. 업체 이름(베트남어·영어)이나 주소를 고친 뒤 다시 눌러 주세요.</div>`; return; }
      $("gpRes").innerHTML = `<div class="hint">맞는 업체의 <b>[이 업체예요]</b>를 눌러 주세요.</div>` + ids.slice(0, 3).map((id, i) => `<div style="margin-top:8px">${showMap(id)}<button type="button" class="btn sm main" data-gp="${esc(id)}" style="margin-top:4px">✅ ${i + 1}번, 이 업체예요</button></div>`).join("");
      $("gpRes").querySelectorAll("[data-gp]").forEach(b => b.onclick = () => { s.gplace = b.dataset.gp; $("gpIn").value = s.gplace; $("gpRes").innerHTML = showMap(s.gplace); $("gpClear").hidden = false; toast("연결했어요. '저장'을 눌러 주세요."); });
    };
  }
  $("geoIn").oninput = () => {
    const v = $("geoIn").value.trim();
    const m = v.match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
    if (!v) { delete s.geo; delete s.geoApprox; $("geoErr").textContent = ""; }
    else if (m && Math.abs(+m[1]) <= 90 && Math.abs(+m[2]) <= 180) {
      s.geo = [+(+m[1]).toFixed(6), +(+m[2]).toFixed(6)]; delete s.geoApprox; $("geoErr").textContent = "";
    } else { $("geoErr").textContent = "숫자 두 개를 쉼표로 적어 주세요. 예: 16.06812, 108.22441"; return; }
    $("geoApx").hidden = !(s.geo && s.geoApprox);
    $("geoView").hidden = !s.geo; if (s.geo) $("geoView").href = `https://www.google.com/maps?q=${s.geo.join(",")}`;
  };
  if ($("revDone")) $("revDone").onclick = () => { delete s.review; $("revBox").remove(); toast("배너를 지웠어요. '저장'을 눌러 주세요."); };
  const drawChk = () => { const [n, t] = chkCount(s); $("chkSum").textContent = `확인 ${n} / ${t}` + (n === t ? " · 모두 확인됐어요" : ""); };
  $("bChk").onchange = () => { if ($("bChk").checked) s.best = true; else delete s.best; $("bSw").classList.toggle("on", !!s.best); };
  $("vChk").onchange = () => { s.verified = $("vChk").checked; $("vSw").classList.toggle("on", s.verified); drawChk(); };
  $("chkList").querySelectorAll("[data-chk]").forEach(el => el.onchange = () => {
    s.checks = s.checks || {}; s.checks[el.dataset.chk] = el.checked; drawChk(); });
  drawChk();
  $("layer").querySelectorAll("[data-day]").forEach(el => el.onchange = () => {
    s.closed = [...$("layer").querySelectorAll("[data-day]:checked")].map(x => +x.dataset.day);
  });
  $("layer").querySelectorAll("[data-lang]").forEach(el => el.onchange = () => {
    s.staffLangs = [...$("layer").querySelectorAll("[data-lang]:checked")].map(x => x.dataset.lang);
  });

  // 사진
  function drawImg() {
    const c = catOf(s.cat);
    const pos = s.imgPos || "50% 50%";
    $("imgPrev").innerHTML = s.img ? `<img src="${esc(imgSrc(s.img))}" alt="" style="object-position:${pos}">` : (c ? c.icon : "✨");
    $("focusWrap").hidden = !s.img;
    if (!s.img) return;
    const src = imgSrc(s.img);
    if ($("focusImg").getAttribute("src") !== src) { $("focusImg").src = src; $("fpCard").src = src; $("fpHero").src = src; }
    $("fpCard").style.objectPosition = pos; $("fpHero").style.objectPosition = pos;
    const [x, y] = pos.split(" ");
    $("focusDot").style.left = x; $("focusDot").style.top = y;
  }
  $("focusSrc").onclick = e => {
    const r = $("focusImg").getBoundingClientRect();
    const x = Math.round(Math.min(100, Math.max(0, (e.clientX - r.left) / r.width * 100)));
    const y = Math.round(Math.min(100, Math.max(0, (e.clientY - r.top) / r.height * 100)));
    s.imgPos = `${x}% ${y}%`; drawImg();
  };
  $("focusReset").onclick = () => { delete s.imgPos; drawImg(); };
  drawImg();
  $("imgIn").onchange = async () => {
    const file = $("imgIn").files[0]; if (!file) return;
    toast("사진을 올리는 중…");
    try {
      const url = await uploadImg(file, "shops/" + (slug($("idIn").value) || "shop"));
      s.img = url; delete s.imgPos; $("imgPath").value = url; drawImg();
      toast("사진을 올렸어요. '저장'을 눌러 주세요.");
    } catch (e) { dbErr(e, "사진 올리기"); }
    $("imgIn").value = "";
  };
  $("imgDel").onclick = () => { s.img = ""; delete s.imgPos; $("imgPath").value = ""; drawImg(); };

  // 태그
  function drawTags() {
    $("tagList").innerHTML = s.tags.map((t, i) => `<div class="tag-edit">
      <input placeholder="한국어 (예: 한국어 매니저)" data-t="${i}.ko" value="${esc(t.ko)}">
      <input placeholder="영어 (예: Korean-speaking)" data-t="${i}.en" value="${esc(t.en)}">
      <input placeholder="베트남어 (예: Nói tiếng Hàn)" data-t="${i}.vi" value="${esc(t.vi || "")}">
      <button class="btn sm danger" data-tdel="${i}" type="button">삭제</button></div>`).join("") || `<span class="hint">태그가 없어요.</span>`;
    $("tagList").querySelectorAll("[data-t]").forEach(el => el.oninput = () => {
      const [i, l] = el.dataset.t.split("."); s.tags[i][l] = el.value; });
    $("tagList").querySelectorAll("[data-tdel]").forEach(el => el.onclick = () => { s.tags.splice(+el.dataset.tdel, 1); drawTags(); });
  }
  drawTags();
  $("tagAdd").onclick = () => { s.tags.push({ ko: "", en: "", vi: "" }); drawTags(); };

  // 메뉴
  function drawMenu() {
    $("menuList").innerHTML = s.menu.map((m, i) => `<div class="menu-item">
      <div class="three"><input placeholder="메뉴명 (한국어)" data-m="${i}.ko" value="${esc(m.name.ko)}">
        <input placeholder="메뉴명 (영어)" data-m="${i}.en" value="${esc(m.name.en)}">
        <input placeholder="메뉴명 (베트남어)" data-m="${i}.vi" value="${esc(m.name.vi || "")}">
        <button class="btn sm danger" data-mdel="${i}" type="button">삭제</button></div>
      <div class="nums"><label class="f"><span>소요 시간 (분)</span><input type="number" min="0" step="5" data-m="${i}.min" value="${m.min || 0}"></label>
        <label class="f"><span>가격 (₫)</span><input type="number" min="0" step="1000" data-m="${i}.price" value="${m.price || 0}"></label></div>
    </div>`).join("") || `<span class="hint">메뉴가 없어요. 메뉴가 없으면 손님 화면에 예약 폼 대신 상담 버튼이 나와요.</span>`;
    $("menuList").querySelectorAll("[data-m]").forEach(el => el.oninput = () => {
      const [i, k] = el.dataset.m.split(".");
      if (k === "ko" || k === "en" || k === "vi") s.menu[i].name[k] = el.value; else s.menu[i][k] = +el.value || 0;
    });
    $("menuList").querySelectorAll("[data-mdel]").forEach(el => el.onclick = () => { s.menu.splice(+el.dataset.mdel, 1); drawMenu(); });
  }
  drawMenu();
  $("menuAdd").onclick = () => { s.menu.push({ name: { ko: "", en: "", vi: "" }, min: 60, price: 0 }); drawMenu(); };

  // 이용후기
  s.userReviews = s.userReviews || [];
  function drawRevs() {
    $("rvList").innerHTML = s.userReviews.map((r, i) => `<div class="rv-item">
      <div class="rv-row">
        <select data-rv="${i}.stars">${[5, 4, 3, 2, 1].map(n => `<option value="${n}" ${n === r.stars ? "selected" : ""}>${"★".repeat(n)}</option>`).join("")}</select>
        <input data-rv="${i}.name" placeholder="이름(닉네임)" value="${esc(r.name || "")}">
        <input type="month" data-rv="${i}.date" value="${esc(r.date || "")}">
        <button class="btn sm danger" data-rvd="${i}" type="button">삭제</button>
      </div>
      <input data-rv="${i}.menu" placeholder="이용한 메뉴 (선택)" value="${esc(r.menu || "")}">
      <textarea data-rv="${i}.text" placeholder="후기 내용">${esc(r.text || "")}</textarea>
    </div>`).join("") || `<span class="hint">아직 게시된 후기가 없어요.</span>`;
    $("rvList").querySelectorAll("[data-rv]").forEach(el => el.oninput = () => {
      const [i, k] = el.dataset.rv.split("."); s.userReviews[i][k] = k === "stars" ? +el.value : el.value; });
    $("rvList").querySelectorAll("[data-rvd]").forEach(el => el.onclick = () => { s.userReviews.splice(+el.dataset.rvd, 1); drawRevs(); });
  }
  drawRevs();
  $("rvAdd").onclick = () => { s.userReviews.unshift({ stars: 5, name: "", date: new Date().toISOString().slice(0, 7), menu: "", text: "" }); drawRevs(); };

  // 가격표 사진
  s.menuImgs = s.menuImgs || [];
  function drawBoards() {
    $("mbList").innerHTML = s.menuImgs.map((m, i) => `<div class="mb-item">
      <div class="mb-img"><img src="${esc(imgSrc(m.src))}" alt=""></div>
      <input placeholder="이름 (예: 마사지 코스)" data-mb="${i}" value="${esc(m.cap || "")}">
      <div class="mb-btns">
        <button class="btn sm" data-mbl="${i}" type="button" ${i === 0 ? "disabled" : ""}>◀</button>
        <button class="btn sm" data-mbr="${i}" type="button" ${i === s.menuImgs.length - 1 ? "disabled" : ""}>▶</button>
        <button class="btn sm danger" data-mbd="${i}" type="button">삭제</button></div>
    </div>`).join("") || `<span class="hint">아직 가격표 사진이 없어요.</span>`;
    $("mbList").querySelectorAll("[data-mb]").forEach(el => el.oninput = () => { s.menuImgs[+el.dataset.mb].cap = el.value; });
    const mv = (i, d) => { const a = s.menuImgs; [a[i], a[i + d]] = [a[i + d], a[i]]; drawBoards(); };
    $("mbList").querySelectorAll("[data-mbl]").forEach(el => el.onclick = () => mv(+el.dataset.mbl, -1));
    $("mbList").querySelectorAll("[data-mbr]").forEach(el => el.onclick = () => mv(+el.dataset.mbr, 1));
    $("mbList").querySelectorAll("[data-mbd]").forEach(el => el.onclick = () => { s.menuImgs.splice(+el.dataset.mbd, 1); drawBoards(); });
  }
  drawBoards();
  $("mbIn").onchange = async () => {
    const files = [...$("mbIn").files]; $("mbIn").value = "";
    const base = slug($("idIn").value) || "shop";
    let n = 0;
    if (files.length) toast("가격표를 올리는 중…");
    for (const f of files) {
      try {
        const url = await uploadImg(f, `shops/${base}-menu`, 2000, 0.85);
        s.menuImgs.push({ src: url, cap: "" }); n++;
      } catch (e) { dbErr(e, `${f.name} 올리기`); }
    }
    drawBoards(); if (n) toast(`가격표 ${n}장을 올렸어요. 이름을 달고 '저장'을 눌러 주세요.`);
  };

  // 닫기·적용
  const close = () => { $("layer").innerHTML = ""; };
  $("pCancel").onclick = close;
  $("ov").onclick = e => { if (e.target.id === "ov") close(); };
  $("pOk").onclick = async () => {
    const newId = slug($("idIn").value);
    $("idIn").value = newId;
    if (!s.name.ko.trim() && !s.name.en.trim()) { $("idErr").textContent = "업체명을 적어 주세요."; return; }
    if (!newId) { $("idErr").textContent = "아이디를 적어 주세요. (영어 소문자, 숫자, -)"; return; }
    if (shops.some(x => x.id === newId && x !== orig)) { $("idErr").textContent = `"${newId}" 아이디는 이미 있어요. 다른 아이디를 써 주세요.`; return; }
    s.id = newId;
    s.tags = s.tags.filter(t => t.ko.trim() || t.en.trim() || (t.vi || "").trim());
    s.menu = s.menu.filter(m => m.name.ko.trim() || m.name.en.trim());
    if (!s.menuImgs.length) delete s.menuImgs;
    s.userReviews = s.userReviews.filter(r => (r.text || "").trim()).map(r => ({ ...r, name: (r.name || "").trim() || "손님", text: r.text.trim() }));
    if (s.userReviews.length) {
      s.rating = Math.round(s.userReviews.reduce((t, r) => t + r.stars, 0) / s.userReviews.length * 10) / 10;
      s.reviews = s.userReviews.length;
    } else delete s.userReviews;
    if (!s.name.en) s.name.en = s.name.ko; if (!s.name.ko) s.name.ko = s.name.en;
    if (!(pv.commission_rate > 0) && !isNew && !rateOf(orig.id)) toast("수수료율이 비어 있어요. 정해지면 꼭 넣어 주세요.", 3500);
    const oldId = orig ? orig.id : null;
    if (isNew) META[s.id] = { published: pub, sort: Math.min(0, ...Object.values(META).map(m => m.sort || 0)) - 1 };
    else { META[oldId] = { ...(META[oldId] || {}), published: pub }; }
    PRIV[oldId || s.id] = pv;
    const btn = $("pOk"); btn.disabled = true; btn.textContent = "저장 중…";
    try { await dbSaveShop(s, oldId); }
    catch (e) { btn.disabled = false; btn.textContent = "저장"; if (isNew) delete META[s.id]; dbErr(e); return; }
    if (isNew) shops.unshift(s); else shops[shops.indexOf(orig)] = s;
    close(); drawList(); if (window.onShopsChanged) onShopsChanged(); if (opts.onSaved) opts.onSaved(s);
    if (!opts.onSaved) toast(!pub ? "저장했어요 ✅ (사이트에는 아직 숨김 — '사이트에 보이기'를 켜면 나와요)" : isNew ? "새 업체를 저장했어요 ✅ 사이트에 바로 반영돼요." : "저장했어요 ✅ 사이트에 바로 반영돼요.");
  };
  if (!isNew) {
    $("delBtn").onclick = () => {
      const nb = (window.BOOKINGS || []).filter(b => b.shop_id === orig.id).length;
      confirmBox(`'${s.name.ko || s.id}' 업체를 삭제할까요?`, async () => {
        const r = await sb.from("shops").delete().eq("id", orig.id);
        if (r.error) { dbErr(r.error, "삭제"); return; }
        shops.splice(shops.indexOf(orig), 1); delete META[orig.id]; delete PRIV[orig.id];
        close(); drawList(); toast("삭제했어요.");
      }, nb ? `이 업체에는 예약 ${nb}건이 있어요. 삭제해도 예약 기록은 남지만 업체 연결이 끊겨요. 보통은 삭제 대신 '사이트에 보이기'를 끄는 걸 권해요.` : "삭제하면 되돌릴 수 없어요. 잠시 내리려면 '사이트에 보이기'를 끄세요.");
    };
    $("dupBtn").onclick = () => {
      const c = clone(s); let n = 2; while (shops.some(x => x.id === `${s.id}-${n}`)) n++;
      c.id = `${s.id}-${n}`; c.name.ko += " (복사본)"; c.verified = false; delete c.userReviews; c.rating = 0; c.reviews = 0;
      close(); openEditor(null, c);
    };
  }
}

/* ===== 카테고리 사진 ===== */
function openCatImgs() {
  $("layer").innerHTML = `<div class="overlay" id="ov"><div class="panel" role="dialog" aria-label="카테고리 사진">
    <div class="panel-head"><h2>카테고리 사진</h2><button class="btn main" id="cClose">완료</button></div>
    <div class="panel-body">
      <div class="box"><div class="hint">사진을 고르면 바로 저장돼요. 메인 화면의 카테고리 칸에 들어가는 사진이에요. 가로 4:3 비율로 잘려 보여요. 업체 사진과는 따로 관리돼요. 업체 사진은 각 업체의 '수정'에서 올려요.<br>사진이 없는 카테고리는 지금처럼 이모지로 보여요.</div></div>
      <div class="box" id="catRows" style="gap:0;padding:6px 16px"></div>
    </div></div></div>`;
  const draw = () => {
    $("catRows").innerHTML = CATEGORIES.map(c => `<div style="display:flex;gap:12px;align-items:center;padding:10px 0;border-top:1px solid var(--line)">
      <div class="img-prev" style="width:96px;height:72px;font-size:28px;flex:none">${catImgs[c.id] ? `<img src="${esc(imgSrc(catImgs[c.id]))}" alt="">` : c.icon}</div>
      <b style="flex:1">${esc(c.name.ko)}</b>
      <label class="btn sm">${catImgs[c.id] ? "바꾸기" : "📷 올리기"}<input type="file" accept="image/*" data-cup="${c.id}" hidden></label>
      ${catImgs[c.id] ? `<button class="btn sm danger" data-cdel="${c.id}">빼기</button>` : ""}
    </div>`).join("");
    $("catRows").querySelectorAll("[data-cup]").forEach(inp => inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return; const id = inp.dataset.cup;
      toast("사진을 올리는 중…");
      try {
        const url = await uploadImg(f, "categories/" + id, 1000);
        const next = { ...catImgs, [id]: url };
        const r = await sb.from("settings").upsert({ key: "cat_imgs", value: next }); if (r.error) throw r.error;
        catImgs = next; draw(); toast("저장했어요 ✅");
      } catch (e) { dbErr(e); }
    });
    $("catRows").querySelectorAll("[data-cdel]").forEach(b => b.onclick = async () => {
      const next = { ...catImgs }; delete next[b.dataset.cdel];
      const r = await sb.from("settings").upsert({ key: "cat_imgs", value: next });
      if (r.error) { dbErr(r.error); return; } catImgs = next; draw(); toast("뺐어요 ✅");
    });
  };
  draw();
  $("cClose").onclick = () => { $("layer").innerHTML = ""; };
  $("ov").onclick = e => { if (e.target.id === "ov") $("cClose").onclick(); };
}

// 확인 창 (브라우저 기본 알림창 대신)
function confirmBox(msg, onYes, desc = "", yes = "삭제", danger = true) {
  const d = document.createElement("div"); d.className = "overlay center"; d.style.zIndex = 70;
  d.innerHTML = `<div class="modal"><h2>${esc(msg)}</h2>${desc ? `<p class="hint" style="font-size:13.5px">${esc(desc)}</p>` : ""}<div class="btns"><button class="btn" data-no>취소</button><button class="btn main" ${danger ? 'style="background:var(--danger);border-color:var(--danger)"' : ""} data-yes>${esc(yes)}</button></div></div>`;
  document.body.appendChild(d);
  d.querySelector("[data-no]").onclick = () => d.remove();
  d.querySelector("[data-yes]").onclick = () => { d.remove(); onYes(); };
  return true;
}

// 사진 줄이기: 긴 변 1400px, JPEG
function shrink(file, max = 1400, q = 0.82) {
  return new Promise((ok, fail) => {
    const img = new Image(); const u = URL.createObjectURL(file);
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(u);
      c.toBlob(b => b ? ok(b) : fail(), "image/jpeg", q);
    };
    img.onerror = () => { URL.revokeObjectURL(u); fail(); };
    img.src = u;
  });
}

/* ===== CSV ===== */
const COLS = [
  ["id", "아이디"], ["cat", "카테고리"], ["city", "지역"], ["name.ko", "업체명(한국어)"], ["name.en", "업체명(영어)"], ["name.vi", "업체명(베트남어)"],
  ["verified", "입점확인(Y/N)"], ["tags.ko", "태그(한국어)"], ["tags.en", "태그(영어)"], ["tags.vi", "태그(베트남어)"],
  ["desc.ko", "소개(한국어)"], ["desc.en", "소개(영어)"], ["desc.vi", "소개(베트남어)"], ["recommend.ko", "추천대상(한국어)"], ["recommend.en", "추천대상(영어)"], ["recommend.vi", "추천대상(베트남어)"],
  ["address.ko", "주소(한국어)"], ["address.en", "주소(영어)"], ["address.vi", "주소(베트남어)"], ["map", "지도링크"], ["geo", "좌표(위도,경도)"],
  ["open", "여는시간"], ["close", "닫는시간"], ["closed", "휴무요일"], ["staffLangs", "응대언어"],
  ["rating", "평점"], ["reviews", "후기수"], ["menu", "메뉴"], ["img", "사진주소"], ["review", "확인필요(;로 구분)"]
];
const csvCell = v => { v = String(v ?? ""); return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
function toRow(s) {
  const langName = Object.fromEntries(STAFF);
  return COLS.map(([k]) => {
    switch (k) {
      case "cat": return catName(s.cat);
      case "city": return cityName(s.city);
      case "verified": return isOk(s) ? "Y" : "N";
      case "tags.ko": return (s.tags || []).map(t => t.ko).join(", ");
      case "tags.en": return (s.tags || []).map(t => t.en).join(", ");
      case "tags.vi": return (s.tags || []).map(t => t.vi || "").join(", ");
      case "geo": return s.geo ? s.geo.join(", ") : "";
      case "closed": return (s.closed || []).map(d => DAYS[d]).join(",");
      case "staffLangs": return (s.staffLangs || []).map(l => langName[l] || l).join(",");
      case "review": return (s.review || []).join(" ; ");
      case "menu": return (s.menu || []).map(m => [m.name.ko, m.name.en, m.name.vi || "", m.min, m.price].join(" | ")).join(" ; ");
      default: { const [a, b] = k.split("."); return b ? (s[a] || {})[b] : s[a]; }
    }
  }).map(csvCell).join(",");
}
const csvText = rows => "﻿" + COLS.map(c => c[1]).join(",") + "\r\n" + rows.join("\r\n") + "\r\n";

function parseCSV(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}
function decode(buf) {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); }
  catch (e) { return new TextDecoder("euc-kr").decode(buf); }   // 엑셀 기본 CSV(한글 깨짐 방지)
}
const findCat = v => { v = v.trim(); return (CATEGORIES.find(c => c.id === v || c.name.ko === v || c.name.en.toLowerCase() === v.toLowerCase()) || {}).id; };
const findCity = v => { v = v.trim(); return (CITIES.find(c => c.id === v || c.name.ko === v || c.name.en.toLowerCase() === v.toLowerCase()) || {}).id; };
const split = (v, re = /[,，]/) => String(v || "").split(re).map(x => x.trim()).filter(Boolean);

function rowToShop(obj, line, errs) {
  const s = blankShop();
  const g = k => (obj[k] ?? "").trim();
  s.name = { ko: g("name.ko"), en: g("name.en") };
  if (!s.name.ko && !s.name.en) { errs.push(`${line}번째 줄: 업체명이 없어서 건너뛰었어요.`); return null; }
  if (!s.name.ko) s.name.ko = s.name.en; if (!s.name.en) s.name.en = s.name.ko;
  s.id = slug(g("id")) || slug(s.name.en) || "shop-" + Date.now().toString(36) + line;
  s.cat = findCat(g("cat")); s.city = findCity(g("city"));
  if (!s.cat) { errs.push(`${line}번째 줄 (${s.name.ko}): 카테고리 "${g("cat")}"를 못 찾았어요.`); return null; }
  if (!s.city) { errs.push(`${line}번째 줄 (${s.name.ko}): 지역 "${g("city")}"를 못 찾았어요.`); return null; }
  s.verified = /^(y|yes|o|확인|true|1)$/i.test(g("verified"));
  const tk = split(g("tags.ko")), te = split(g("tags.en")), tv = split(g("tags.vi"));
  s.tags = Array.from({ length: Math.max(tk.length, te.length) }, (_, i) => ({ ko: tk[i] || te[i] || "", en: te[i] || tk[i] || "", vi: tv[i] || "" }));
  ["desc", "recommend", "address"].forEach(k => s[k] = { ko: g(k + ".ko"), en: g(k + ".en"), vi: g(k + ".vi") });
  s.name.vi = g("name.vi");
  s.map = g("map"); s.img = g("img");
  { const m = g("geo").match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/); if (m) s.geo = [+m[1], +m[2]]; }
  const tm = v => { const m = v.match(/^(\d{1,2}):?(\d{2})$/); return m ? m[1].padStart(2, "0") + ":" + m[2] : ""; };
  s.open = tm(g("open")); s.close = tm(g("close"));
  s.closed = split(g("closed")).map(d => /^\d$/.test(d) ? +d : DAYS.indexOf(d.slice(0, 1))).filter(d => d >= 0 && d <= 6);
  const lmap = { 한국어: "ko", 영어: "en", 베트남어: "vi", 일본어: "ja", 중국어: "zh" };
  s.staffLangs = split(g("staffLangs")).map(l => lmap[l] || l.toLowerCase()).filter(l => STAFF.some(x => x[0] === l));
  s.rating = +g("rating") || 0; s.reviews = parseInt(g("reviews")) || 0;
  s.menu = split(g("menu"), /[;；]/).map(m => {
    const parts = m.split("|").map(x => (x || "").trim());
    // 새 양식: 한국어 | 영어 | 베트남어 | 분 | 가격  (예전 양식: 한국어 | 영어 | 분 | 가격)
    const [ko, en, vi, min, price] = parts.length >= 5 ? parts : [parts[0], parts[1], "", parts[2], parts[3]];
    return { name: { ko: ko || en || "", en: en || ko || "", vi: vi || "" }, min: parseInt(min) || 0, price: parseInt(String(price || "").replace(/[^\d]/g, "")) || 0 };
  }).filter(m => m.name.ko);
  { const rv = split(g("review"), /[;；]/); if (rv.length) s.review = rv; }
  return s;
}

async function importCSV(file) {
  const rows = parseCSV(decode(await file.arrayBuffer()));
  if (rows.length < 2) { toast("CSV에 내용이 없어요."); return; }
  const header = rows[0].map(h => h.replace(/^﻿/, "").trim());
  const keyOf = h => (COLS.find(c => c[1] === h || c[0] === h) || [])[0];
  const keys = header.map(keyOf);
  if (!keys.includes("name.ko") && !keys.includes("name.en")) { toast("양식이 달라요. '업로드 양식 받기'로 받은 파일을 써 주세요.", 4000); return; }
  const errs = [], add = [], upd = [];
  const seen = new Set();
  rows.slice(1).forEach((r, i) => {
    const obj = {}; keys.forEach((k, j) => { if (k) obj[k] = r[j] || ""; });
    const s = rowToShop(obj, i + 2, errs); if (!s) return;
    if (seen.has(s.id)) { errs.push(`${i + 2}번째 줄: 아이디 "${s.id}"가 파일 안에서 겹쳐요.`); return; }
    seen.add(s.id);
    (shops.some(x => x.id === s.id) ? upd : add).push(s);
  });
  const d = document.createElement("div"); d.className = "overlay center";
  d.innerHTML = `<div class="modal"><h2>업로드 미리보기</h2>
    <p>새 업체 <b>${add.length}</b>곳 · 기존 업체 덮어쓰기 <b>${upd.length}</b>곳${errs.length ? ` · 건너뜀 <b style="color:var(--danger)">${errs.length}</b>건` : ""}</p>
    ${add.length ? `<b>새로 추가</b><ul>${add.slice(0, 15).map(s => `<li>${esc(s.name.ko)} <small>(${esc(cityName(s.city))} · ${esc(catName(s.cat))})</small></li>`).join("")}${add.length > 15 ? `<li>외 ${add.length - 15}곳</li>` : ""}</ul>` : ""}
    ${upd.length ? `<b>덮어쓰기</b> <span class="hint">같은 아이디의 기존 정보가 파일 내용으로 바뀌어요. 사진·가격표·후기·계약 정보는 그대로 둬요.</span><ul>${upd.slice(0, 15).map(s => `<li>${esc(s.name.ko)} <small>(${esc(s.id)})</small></li>`).join("")}${upd.length > 15 ? `<li>외 ${upd.length - 15}곳</li>` : ""}</ul>` : ""}
    ${errs.length ? `<b style="color:var(--danger)">확인이 필요한 줄</b><ul class="err-text">${errs.map(e => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
    <div class="btns"><button class="btn" data-no>취소</button><button class="btn main" data-yes ${add.length + upd.length ? "" : "disabled"}>${add.length + upd.length}곳 적용</button></div></div>`;
  document.body.appendChild(d);
  d.querySelector("[data-no]").onclick = () => d.remove();
  d.querySelector("[data-yes]").onclick = async () => {
    const btn = d.querySelector("[data-yes]"); btn.disabled = true; btn.textContent = "저장 중…";
    upd.forEach(s => { const o = shops.find(x => x.id === s.id); if (!s.img) s.img = o.img; if (o.imgPos && s.img === o.img) s.imgPos = o.imgPos; if (o.menuImgs) s.menuImgs = o.menuImgs; if (o.userReviews) { s.userReviews = o.userReviews; s.rating = o.rating; s.reviews = o.reviews; } if (o.best) s.best = true; if (!s.geo && o.geo) { s.geo = o.geo; if (o.geoApprox) s.geoApprox = true; } if (!s.review && o.review) s.review = o.review; if (o.checks) s.checks = o.checks; });
    let sort = Math.max(0, ...Object.values(META).map(m => m.sort || 0));
    add.forEach(s => { META[s.id] = { published: true, sort: ++sort }; });
    let ok = 0;
    for (const s of [...upd, ...add]) {
      try { await dbSaveShop(s); ok++; const i = shops.findIndex(x => x.id === s.id); if (i >= 0) shops[i] = s; else shops.push(s); }
      catch (e) { console.error(e); }
    }
    d.remove(); drawList();
    toast(ok === add.length + upd.length ? `${ok}곳을 저장했어요 ✅` : `${ok}곳 저장, ${add.length + upd.length - ok}곳 실패했어요. 다시 시도해 주세요.`, 4000);
  };
}

async function saveFile(name, text) {
  try {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } catch (e) { toast("이 화면에서는 파일을 받을 수 없어요."); }
}

/* ===== 업체 탭 시작 ===== */
function initShops() {
  fillFilters(); drawList();
  $("addBtn").onclick = () => openEditor(null);
  $("catImgBtn").onclick = openCatImgs;
  $("csvBtn").onclick = () => $("csvFile").click();
  $("csvFile").onchange = () => { const f = $("csvFile").files[0]; if (f) importCSV(f); $("csvFile").value = ""; };
  $("tplBtn").onclick = () => saveFile("엉클데이_업체등록양식.csv", csvText([
    toRow({ ...blankShop(), id: "sample-spa", name: { ko: "샘플 스파", en: "Sample Spa" }, tags: [{ ko: "한국어 가능", en: "Korean OK" }, { ko: "픽업", en: "Pickup" }],
      desc: { ko: "소개글을 적어요", en: "Description" }, address: { ko: "다낭 ○○거리 12", en: "12 ○○ St, Da Nang" },
      open: "10:00", close: "22:00", closed: [0], staffLangs: ["ko", "en"], cat: "massage", city: "danang",
      menu: [{ name: { ko: "전신 마사지 60분", en: "Full body 60 min", vi: "Massage toàn thân 60 phút" }, min: 60, price: 450000 }, { name: { ko: "발 마사지", en: "Foot massage", vi: "Massage chân" }, min: 45, price: 300000 }] })
  ]));
  if (typeof GMAPS !== "undefined" && GMAPS.key) { $("gpBulk").hidden = false; $("gpBulk").onclick = gplaceBulk; }
  $("expBtn").onclick = () => saveFile(`엉클데이_업체목록_${new Date().toISOString().slice(0, 10)}.csv`, csvText(shops.map(toRow)));
  notice("info", `<details class="grow"><summary style="cursor:pointer"><b>엑셀(CSV) 업로드 양식 쓰는 법</b></summary><ul style="margin:8px 0 0;padding-left:18px">
    <li>'업로드 양식 받기'로 받은 파일에 한 줄에 한 업체씩 적어요. 엑셀에서 <b>CSV</b>로 저장해서 올려요.</li>
    <li>카테고리·지역은 한국어 이름 그대로 (예: <code>마사지</code>, <code>다낭</code>)</li>
    <li>아이디가 이미 있는 업체면 <b>덮어쓰기</b>, 없으면 <b>새로 추가</b>돼요. 아이디를 비우면 영어 이름으로 자동으로 만들어요.</li>
    <li>태그는 쉼표로 구분 · 휴무요일 <code>일,토</code> · 응대언어 <code>한국어,영어</code> · 입점확인 <code>Y</code> 또는 <code>N</code></li>
    <li>메뉴: <code>전신 마사지 | Full body | Massage toàn thân | 60 | 450000 ; 발 마사지 | Foot | Massage chân | 45 | 300000</code> (한국어 | 영어 | 베트남어 | 분 | 가격, 메뉴끼리는 <code>;</code>)</li>
    <li>사진·수수료율은 업로드 후 각 업체 '수정'에서 넣어요.</li></ul></details>`, "nHelp", "shopNotices");
}

/* ===== 구글 장소 찾기 (ID만 받는 검색 — 구글 무료·무제한) ===== */
async function gplaceSearch(q) {
  try {
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", { method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": GMAPS.key, "X-Goog-FieldMask": "places.id" },
      body: JSON.stringify({ textQuery: q, languageCode: "vi" }) });
    if (!r.ok) { const e = await r.json().catch(() => ({})); toast("구글 검색 오류: " + ((e.error && e.error.message) || r.status), 6000); return []; }
    const j = await r.json(); return (j.places || []).map(p => p.id);
  } catch (e) { toast("구글에 연결하지 못했어요"); return []; }
}
async function gplaceBulk() {
  const list = shops.filter(s => !s.gplace);
  if (!list.length) { toast("모든 업체가 이미 연결돼 있어요"); return; }
  confirmBox(`구글 지도 연결이 안 된 업체 ${list.length}곳을 자동으로 찾아 연결할까요?`, async () => {
    let ok = 0, miss = [];
    toast(`${list.length}곳 찾는 중… 잠시만요`, 4000);
    for (const s of list) {
      const city = cityOf(s.city) ? cityOf(s.city).name.en : "";
      const q = [s.name.vi || s.name.en || s.name.ko, (s.address && (s.address.vi || s.address.en)) || city].filter(Boolean).join(", ");
      const ids = await gplaceSearch(q);
      if (!ids.length) { miss.push(s.name.ko); continue; }
      const n = clone(s); n.gplace = ids[0];
      n.review = [...(n.review || []).filter(x => !/구글 지도 연결/.test(x)), "구글 지도 자동 연결 — 맞는 업체인지 '위치·영업'에서 지도로 확인해 주세요."];
      try { await dbSaveShop(n); shops[shops.indexOf(s)] = n; ok++; } catch (e) { miss.push(s.name.ko); }
    }
    drawList();
    toast(`${ok}곳 연결했어요${miss.length ? ` · 못 찾은 곳 ${miss.length}곳: ${miss.slice(0, 5).join(", ")}${miss.length > 5 ? " …" : ""}` : ""}`, 8000);
  }, "이름과 주소로 검색해서 첫 번째 결과를 연결해요. 이 검색은 구글 무료(무제한)예요. 잘못 연결된 곳이 있을 수 있으니 업체마다 '확인 필요' 메모를 남겨 둘게요.", "자동 연결", false);
}

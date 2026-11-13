/* 📝 블로그 — 포털 안 (#ptBlog) · universe23.sql
 * 검색어(예: 한시장 근처 마사지 추천)를 넣으면 '조건'(도시 · 장소 · 주제 · 시술)을 알아서 채워요 → 확인 · 고치기 → [게시]
 * 글 내용(업체 목록 · 거리 · 실제 가격 · 영업시간 · FAQ)은 매시간 자동 갱신 때 최신 업체 데이터로 다시 그려요.
 * 경쟁사 분석의 '빠진 검색어'에서 [📝 블로그 글 만들기]로 바로 넘어올 수 있어요.
 * 아래 장소 · 주제 · 시술 목록은 tools/landmarks.py · topics.py · treatments.py 와 같아요.
 */
const BLG_LM = [{"id": "han-market", "city": "danang", "ko": "한시장", "lat": 16.0682, "lon": 108.2242, "names": ["한시장", "한 시장", "han market", "chợ hàn", "cho han"]}, {"id": "my-khe", "city": "danang", "ko": "미케 비치", "lat": 16.0597, "lon": 108.2469, "names": ["미케", "미케비치", "미케 해변", "my khe", "mỹ khê"]}, {"id": "dragon-bridge", "city": "danang", "ko": "용다리", "lat": 16.0611, "lon": 108.2274, "names": ["용다리", "용 다리", "드래곤 브릿지", "dragon bridge", "cầu rồng"]}, {"id": "con-market", "city": "danang", "ko": "꼰시장", "lat": 16.0679, "lon": 108.2145, "names": ["꼰시장", "꼰 시장", "con market", "chợ cồn"]}, {"id": "an-thuong", "city": "danang", "ko": "안트엉", "lat": 16.049, "lon": 108.246, "names": ["안트엉", "안뜨엉", "an thuong", "an thượng"]}, {"id": "danang-airport", "city": "danang", "ko": "다낭 공항", "lat": 16.053, "lon": 108.202, "names": ["공항", "airport", "sân bay"]}, {"id": "lotte-danang", "city": "danang", "ko": "롯데마트 다낭", "lat": 16.0346, "lon": 108.2296, "names": ["롯데마트", "롯데 마트", "lotte mart"]}, {"id": "dam-market", "city": "nhatrang", "ko": "담시장", "lat": 12.2546, "lon": 109.1925, "names": ["담시장", "담 시장", "dam market", "chợ đầm"]}, {"id": "nhatrang-beach", "city": "nhatrang", "ko": "나트랑 해변 (쩐푸 거리)", "lat": 12.242, "lon": 109.1965, "names": ["나트랑 해변", "쩐푸", "tran phu", "trần phú", "해변"]}, {"id": "nhatrang-night-market", "city": "nhatrang", "ko": "나트랑 야시장", "lat": 12.2445, "lon": 109.1958, "names": ["야시장", "night market", "chợ đêm"]}, {"id": "stone-church", "city": "nhatrang", "ko": "나트랑 대성당 (돌성당)", "lat": 12.2466, "lon": 109.1883, "names": ["대성당", "돌성당", "cathedral", "nhà thờ núi"]}, {"id": "ben-thanh", "city": "hcm", "ko": "벤탄시장", "lat": 10.7725, "lon": 106.698, "names": ["벤탄", "벤탄시장", "ben thanh", "bến thành"]}, {"id": "bui-vien", "city": "hcm", "ko": "부이비엔 거리", "lat": 10.7675, "lon": 106.6932, "names": ["부이비엔", "여행자 거리", "bui vien", "bùi viện"]}, {"id": "notre-dame", "city": "hcm", "ko": "노트르담 성당", "lat": 10.7798, "lon": 106.699, "names": ["노트르담", "notre dame", "nhà thờ đức bà"]}, {"id": "thao-dien", "city": "hcm", "ko": "타오디엔 (2군)", "lat": 10.804, "lon": 106.736, "names": ["타오디엔", "2군", "thao dien", "thảo điền"]}, {"id": "phu-my-hung", "city": "hcm", "ko": "푸미흥 (7군)", "lat": 10.729, "lon": 106.719, "names": ["푸미흥", "7군", "phu my hung", "phú mỹ hưng"]}, {"id": "hoan-kiem", "city": "hanoi", "ko": "호안끼엠 호수", "lat": 21.0287, "lon": 105.8524, "names": ["호안끼엠", "호안 끼엠", "hoan kiem", "hoàn kiếm"]}, {"id": "old-quarter", "city": "hanoi", "ko": "하노이 구시가", "lat": 21.0347, "lon": 105.8502, "names": ["구시가", "올드쿼터", "old quarter", "phố cổ"]}, {"id": "west-lake", "city": "hanoi", "ko": "서호", "lat": 21.056, "lon": 105.823, "names": ["서호", "west lake", "hồ tây"]}, {"id": "lotte-hanoi", "city": "hanoi", "ko": "롯데센터 하노이", "lat": 21.0318, "lon": 105.8122, "names": ["롯데센터", "롯데 센터", "lotte center"]}];
const BLG_TOPIC = [["korean", "한국어 되는 마사지"], ["late", "밤늦게 하는 마사지"], ["luggage", "짐 보관 되는 마사지"], ["pickup", "픽업 되는 마사지"], ["couple", "커플 마사지 (커플룸)"], ["family", "가족이 함께 받는 마사지"], ["kids", "아이랑 받는 키즈 마사지"], ["pregnant", "임산부 마사지"], ["hotstone", "핫스톤 마사지"], ["fourhands", "포핸드 마사지"], ["thai", "타이 · 건식 마사지"], ["foot", "발 마사지"], ["sauna", "사우나 있는 스파"], ["tipfree", "팁 포함 마사지"], ["nail", "네일 · 속눈썹"], ["clinic", "한국어 상담 되는 성형 · 피부과"]];
const BLG_TREAT = [["massage", "마사지"], ["foot", "발 마사지"], ["facial", "페이셜 · 피부관리"], ["nail", "젤네일"], ["lash", "속눈썹 연장"], ["hair", "헤어 (커트 · 펌 · 염색)"], ["filler", "필러 · 보톡스"]];
const BLG_TPAT = {"luggage": "짐 보관|짐보관|샤워", "pickup": "픽업|샌딩", "couple": "커플|2인실|부부|커플룸", "family": "가족|키즈|아이 |부모님|단체|패밀리|3인|4인", "kids": "키즈|아동|아이 ", "pregnant": "임산부|산전", "hotstone": "핫스톤|바잘트", "fourhands": "포핸드|four-hands", "thai": "건식|타이|태국|시아추", "foot": "발 마사지|발마사지|발 반사|발·|족욕", "sauna": "사우나|자쿠지|스팀|찜질", "tipfree": "팁 포함|노팁"};   // tools/topics.py 의 pat (미리보기용)
const BLG = { posts: null, err: "", open: null };
const BLG_CITY = { "다낭": "danang", "danang": "danang", "나트랑": "nhatrang", "냐짱": "nhatrang", "호치민": "hcm", "호찌민": "hcm", "사이공": "hcm", "하노이": "hanoi" };
const BLG_TRX = { couple: /커플|신혼|부부|연인|허니문/, family: /가족|부모님|효도|패밀리|단체/, korean: /한국어|한국인/, late: /밤늦게|늦게|24시|심야|야간|새벽/, luggage: /짐 ?보관/, pickup: /픽업|샌딩/, kids: /키즈|아이|아기|어린이/, pregnant: /임산부|임신/, hotstone: /핫스톤/, fourhands: /포핸드/, thai: /타이|건식/, foot: /발 ?마사지/, sauna: /사우나|찜질|자쿠지/, tipfree: /팁 ?포함|노팁/, nail: /네일|속눈썹/, clinic: /성형|피부과|병원|클리닉/ };
const blgSlugTxt = t => (String(t || "").toLowerCase().replace(/đ/g, "d").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 50).replace(/-$/, "")) || "shop";
const blgSlug = b => { if (b.slug) return b.slug; const s = blgSlugTxt(b.kw); return s.length >= 6 && s !== "shop" ? s : [b.city, b.landmark || b.topic || b.treat || "guide"].filter(Boolean).join("-") + "-" + b.id; };
// 검색어 → 조건
function blgParse(kw) {
  const k = String(kw || "").toLowerCase(), r = { city: null, landmark: null, topic: null, treat: null, grp: null };
  for (const [w, c] of Object.entries(BLG_CITY)) if (k.includes(w)) { r.city = c; break; }
  const lm = BLG_LM.find(l => (!r.city || l.city === r.city) && l.names.some(n => k.includes(n.toLowerCase()))); if (lm) { r.landmark = lm.id; r.city = r.city || lm.city; }
  r.topics = Object.entries(BLG_TRX).filter(([, rx]) => rx.test(k)).map(([id]) => id); r.topic = r.topics[0] || null;
  if (/가격|요금|비용|얼마/.test(k)) r.treat = /네일|젤/.test(k) ? "nail" : /페이셜|피부관리|클렌징|스킨|케어|피부/.test(k) ? "facial" : /발/.test(k) ? "foot" : /헤어|커트|펌|이발/.test(k) ? "hair" : /속눈썹/.test(k) ? "lash" : /필러|보톡스/.test(k) ? "filler" : "massage";
  if (r.treat) r.topic = null;
  r.grp = /피부|스킨|케어|페이셜|에스테틱|클리닉|성형|네일|헤어|뷰티|속눈썹|이발|왁싱|skin|facial|nail|hair|beauty|clinic/.test(k) && !/마사지|massage|스파(?!.*(케어|스킨))/.test(k) ? "beauty" : "spabody";
  r.city = r.city || "danang";
  return r;
}
// 엉클데이 데이터에 없는 분야 (맛집 · 숙소 · 투어 …) — 이런 검색어로 마사지 목록을 내면 손님을 속이는 글이 돼요
const BLG_OUT = /맛집|식당|음식|먹거리|카페|커피|베이커리|호텔|숙소|리조트|풀빌라|빌라|에어비앤비|가라오케|노래방|골프|렌트|렌터카|차량|택시|투어|술집|클럽|bar\b|pub\b|restaurant|food|cafe|coffee|hotel|villa|golf|karaoke/i;
// 엉클데이 분야가 아닌 경쟁사 주제를 '같은 손님 · 같은 장소'로 우리 분야 검색어로 바꿔요 (예: 다낭 2룸 풀빌라 추천 – 커플 · 가족 여행 → 커플 · 가족 여행에 좋은 다낭 마사지 추천)
function blgReframe(kw) {
  const k = String(kw || ""), auds = [[/커플|신혼|부부|연인|허니문/, "커플"], [/가족|패밀리/, "가족"], [/부모님|효도/, "부모님과 함께"], [/아이|키즈|아기/, "아이와 함께"], [/친구|우정|여자끼리|남자끼리/, "친구끼리"], [/단체|모임|워크숍|회사/, "단체"], [/혼자|나홀로|1인/, "혼자"], [/골프/, "골프 후"], [/공항|출국|마지막 날/, "출국 전"]];
  const a = [...new Set(auds.filter(([rx]) => rx.test(k)).map(([, l]) => l))].slice(0, 2);
  const cityKo = (Object.entries({ "다낭": "다낭", "나트랑": "나트랑", "냐짱": "나트랑", "호치민": "호찌민", "호찌민": "호찌민", "하노이": "하노이" }).find(([w]) => k.includes(w)) || [, "다낭"])[1];
  const lm = BLG_LM.find(l => l.names.some(n => k.toLowerCase().includes(n.toLowerCase())));
  if (a.includes("출국 전")) return `출국 전 받기 좋은 ${cityKo} 마사지 (짐 보관 · 샤워)`;
  if (a.includes("골프 후")) return `골프 후 받기 좋은 ${cityKo} 마사지 추천`;
  if (a.length) return `${a.join(" · ")} 여행에 좋은 ${cityKo} 마사지 추천`;
  if (lm) return `${cityKo} ${lm.ko} 근처 마사지 추천`;
  return null;
}
const blgKm = (a, b) => { const R = 6371, t = Math.PI / 180, dl = (b[0] - a[0]) * t, dn = (b[1] - a[1]) * t, x = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
// 미리보기: 대략 몇 곳이 나올지 (정확한 결과는 게시 후 사이트 페이지에서)
function blgPreview(b) {
  const live = (typeof shops !== "undefined" ? shops : []).filter(s => s.city === b.city && !(typeof META !== "undefined" && META[s.id] && META[s.id].published === false));
  const blob = s => [...(s.tags || []).map(t => t.ko || ""), ...(s.menu || []).map(m => (m.name || {}).ko || ""), (s.desc || {}).ko || "", (s.address || {}).ko || ""].join(" ");
  let xs = live;
  if (b.topic) { const rx = BLG_TPAT[b.topic] ? new RegExp(BLG_TPAT[b.topic]) : BLG_TRX[b.topic];
    xs = xs.filter(s => b.topic === "korean" ? (s.staffLangs || []).includes("ko") || /한국어|한국인/.test(blob(s)) : b.topic === "late" ? (s.close || "") >= "23:00" || /^24/.test(s.close || "") : b.topic === "nail" ? s.cat === "nail" || /네일|속눈썹/.test(blob(s)) : b.topic === "clinic" ? ["surgery", "derma", "skin", "dental"].includes(s.cat) : rx && rx.test(blob(s))); }
  else if (b.treat) xs = xs.filter(s => (s.menu || []).some(m => +m.price > 0));
  else { const gOf = cat => ((typeof CATEGORIES !== "undefined" ? CATEGORIES : []).find(c => c.id === cat || (c.members || []).includes(cat)) || {}).id || "beauty"; xs = xs.filter(s => gOf(s.cat) === (b.grp || "spabody")); }
  const lm = BLG_LM.find(l => l.id === b.landmark);
  if (lm) { xs = xs.filter(s => s.geo).map(s => ({ s, d: blgKm([lm.lat, lm.lon], s.geo) })).sort((a, c) => a.d - c.d); const near = xs.filter(x => x.d <= 5); xs = (near.length >= 2 ? near : xs.slice(0, 6)).map(x => ({ ...x.s, _d: x.d })); }
  return xs.slice(0, 10);
}
async function blogLoad() {
  const r = await sb.from("blog_posts").select("*").order("created_at", { ascending: false }).limit(300);
  if (r.error) { BLG.err = /blog_posts|42P01|PGRST20/.test((r.error.message || "") + (r.error.code || "")) ? "setup" : r.error.message; BLG.posts = []; } else { BLG.err = ""; BLG.posts = r.data || []; }
  blogDraw();
}
async function blogNew(kw, fromUrl) {
  const p = blgParse(kw);
  if (p.topics.length > 1 && !p.treat) p.topic = p.topics.map(t => [t, blgPreview({ ...p, topic: t }).length]).sort((x, y) => y[1] - x[1])[0][0];   // 주제가 여럿이면 업체가 많이 나오는 쪽
  delete p.topics;
  const r = await sb.from("blog_posts").insert({ kw, ...p, from_url: fromUrl || null }).select().single();
  if (r.error) { alert(/blog_posts/.test(r.error.message) ? "universe23.sql 을 먼저 실행해 주세요" : r.error.message); return null; }
  (BLG.posts = BLG.posts || []).unshift(r.data); BLG.open = r.data.id; blogDraw();
  const sec = document.getElementById("ptBlogSec"); if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
  return r.data;
}
function blogDraw() {
  const el = document.getElementById("ptBlog"); if (!el) return;
  if (!BLG.posts) { el.innerHTML = `<p class="hint">불러오는 중…</p>`; blogLoad(); return; }
  if (BLG.err === "setup") { el.innerHTML = `<div class="uni-err">블로그를 쓰려면 Supabase SQL 편집기에서 <b>supabase/universe23.sql</b> 을 한 번 실행해 주세요.</div>`; return; }
  if (BLG.err) { el.innerHTML = `<div class="uni-err">${esc(BLG.err)}</div>`; return; }
  const cs = typeof CITIES !== "undefined" ? CITIES : [], cn = id => ((cs.find(c => c.id === id) || {}).name || {}).ko || id || "";
  const opt = (list, v, none) => `<option value="">${none}</option>` + list.map(([id, l]) => `<option value="${id}" ${id === v ? "selected" : ""}>${esc(l)}</option>`).join("");
  el.innerHTML = `<div class="crl-add"><input id="blgKw" placeholder="검색어 (예: 한시장 근처 마사지 추천 · 다낭 키즈 마사지 · 나트랑 젤네일 가격)"><button class="btn sm main" data-bnew>📝 글 만들기</button></div>
    <p class="hint">글은 <b>우리 업체 데이터</b>로만 만들어요 (가까운 순 · 실제 가격 · 영업시간 · 한국어 응대 · FAQ). 매시간 최신 정보로 다시 그려지고, 맞는 업체가 2곳보다 적으면 게시해도 페이지가 생기지 않아요.</p>
    <div class="crl-list">${BLG.posts.length ? BLG.posts.map(b => {
      const open = BLG.open === b.id, pv = open ? blgPreview(b) : [], lm = BLG_LM.find(l => l.id === b.landmark);
      const cond = [cn(b.city), lm && "📍 " + lm.ko, b.topic && "🏷️ " + ((BLG_TOPIC.find(t => t[0] === b.topic) || [])[1] || b.topic), b.treat && "💰 " + ((BLG_TREAT.find(t => t[0] === b.treat) || [])[1] || b.treat) + " 가격"].filter(Boolean).join(" · ");
      return `<div class="crl-job ${b.status === "published" ? "published" : "done"} ${open ? "open" : ""}"><button class="crl-h" data-bopen="${b.id}"><span class="st">${b.status === "published" ? (BLG_OUT.test(b.kw) ? "⚠️ 게시됐지만 사이트에 안 나와요 (엉클데이 분야 아님)" : blgPreview(b).length < 2 ? "⚠️ 게시됐지만 업체가 2곳보다 적어 안 나와요" : "🌐 게시됨") : "📝 초안"}</span><b>${esc(b.title || b.kw)}</b><small>${esc(cond)} · ${dt(b.created_at)}</small></button>
        ${open ? `<div class="crl-body" data-bpost="${b.id}">
          <label>노리는 검색어<input data-bf="kw" value="${esc(b.kw)}"></label>
          <label>제목 <small class="hint">비우면 "검색어 — 가까운 순 · 실제 가격 정리 (연도)"처럼 자동</small><input data-bf="title" value="${esc(b.title || "")}"></label>
          <div class="crl-two"><label>도시<select data-bf="city">${cs.map(c => `<option value="${c.id}" ${c.id === b.city ? "selected" : ""}>${esc(c.name.ko)}</option>`).join("")}</select></label>
            <label>기준 장소 (가까운 순)<select data-bf="landmark">${opt(BLG_LM.filter(l => l.city === b.city).map(l => [l.id, l.ko]), b.landmark, "없음")}</select></label></div>
          <div class="crl-two"><label>주제<select data-bf="topic">${opt(BLG_TOPIC, b.topic, "없음")}</select></label><label>시술 가격<select data-bf="treat">${opt(BLG_TREAT, b.treat, "없음")}</select></label></div>
          <label>업체 종류<select data-bf="grp">${opt([["spabody", "마사지 · 스파"], ["beauty", "피부 · 뷰티 · 성형"]], b.grp, "마사지 · 스파")}</select></label>
          <label>첫 문단 <small class="hint">비우면 자동 문장 · 사람이 쓴 한두 줄이 들어가면 더 좋아요</small><textarea data-bf="intro" rows="3">${esc(b.intro || "")}</textarea></label>
          ${BLG_OUT.test(b.kw) ? `<p class="crl-err">⚠️ 이 검색어는 엉클데이 데이터가 없는 분야(맛집 · 숙소 · 투어 등)라 게시할 수 없어요.</p>` : ""}
          <div class="blg-pv"><b>미리보기 (예상 ${pv.length}곳${pv.length < 2 ? " — ⚠️ 2곳보다 적어서 페이지가 안 생겨요. 장소 · 주제를 바꿔 보세요" : ""})</b><ol>${pv.map(s => `<li>${esc((s.name || {}).ko || s.id)}${s._d != null ? ` <small>약 ${s._d.toFixed(1)}km</small>` : ""}</li>`).join("")}</ol></div>
          <p class="hint">주소: <code>/blog/${esc(blgSlug(b))}/</code>${b.status === "published" ? ` · <a href="/blog/${esc(blgSlug(b))}/" target="_blank" rel="noopener">사이트에서 보기 ↗</a> (게시 후 1시간 안에 생겨요)` : ""}${b.from_url ? ` · 주제 얻은 곳: <a href="${esc(b.from_url)}" target="_blank" rel="noopener nofollow">경쟁사 글</a>` : ""}</p>
          <div class="crl-act">${b.status === "published" ? `<button class="btn sm main" data-bsave="${b.id}">고친 내용 저장</button><button class="btn sm" data-bunpub="${b.id}">게시 내리기</button>` : `<button class="btn sm main" data-bpub="${b.id}" ${BLG_OUT.test(b.kw) ? "disabled" : ""}>🌐 게시</button><button class="btn sm" data-bsave="${b.id}">저장만</button>`}<button class="btn sm danger" data-bdel="${b.id}">🗑️</button></div>
        </div>` : ""}</div>`;
    }).join("") : `<p class="hint">아직 글이 없어요. 위에 검색어를 넣거나, 경쟁사 분석의 '빠진 검색어'에서 [📝 블로그 글 만들기]를 눌러 보세요.</p>`}</div>`;
  const collect = id => { const box = el.querySelector(`[data-bpost="${id}"]`), o = {}; box.querySelectorAll("[data-bf]").forEach(i => o[i.dataset.bf] = i.value.trim() || null); o.kw = o.kw || ""; return o; };
  const up = async (id, patch, msg) => { const r = await sb.from("blog_posts").update(patch).eq("id", id).select().single(); if (r.error) { alert(r.error.message); return; } BLG.posts[BLG.posts.findIndex(x => x.id === id)] = r.data; if (msg) toast(msg, 3500); blogDraw(); };
  el.querySelectorAll("[data-bnew]").forEach(b => b.onclick = async () => { const kw = document.getElementById("blgKw").value.trim(); if (kw.length < 2) { toast("검색어를 적어 주세요"); return; }
    if (BLG_OUT.test(kw)) { const rf = blgReframe(kw); if (rf && confirm("'" + kw + "' 는 엉클데이 분야가 아니에요.\n같은 손님을 노리는 우리 분야 검색어로 바꿔 만들까요?\n\n→ " + rf)) { b.disabled = true; await blogNew(rf); b.disabled = false; } else if (!rf) alert("'" + kw + "' 는 엉클데이가 데이터를 가진 분야(마사지 · 스파 · 뷰티 · 피부 · 네일 · 헤어)가 아니라서 글을 만들 수 없어요."); return; } b.disabled = true; await blogNew(kw); b.disabled = false; });
  el.querySelectorAll("[data-bopen]").forEach(b => b.onclick = () => { const id = +b.dataset.bopen; BLG.open = BLG.open === id ? null : id; blogDraw(); });
  el.querySelectorAll("[data-bpost] [data-bf]").forEach(i => i.onchange = () => { const id = +i.closest("[data-bpost]").dataset.bpost, p = BLG.posts.find(x => x.id === id); Object.assign(p, collect(id)); if (i.dataset.bf === "city") p.landmark = null; blogDraw(); });
  el.querySelectorAll("[data-bsave]").forEach(b => b.onclick = () => up(+b.dataset.bsave, collect(+b.dataset.bsave), "저장했어요 · 1시간 안에 사이트에 반영돼요"));
  el.querySelectorAll("[data-bpub]").forEach(b => b.onclick = () => { const id = +b.dataset.bpub, o = collect(id); if (blgPreview({ ...BLG.posts.find(x => x.id === id), ...o }).length < 2 && !confirm("예상 업체가 2곳보다 적어서 페이지가 안 생길 수 있어요. 그래도 게시할까요?")) return; up(id, { ...o, status: "published" }, "🌐 게시했어요. 1시간 안에 블로그 페이지가 생겨요"); });
  el.querySelectorAll("[data-bunpub]").forEach(b => b.onclick = () => up(+b.dataset.bunpub, { status: "draft" }, "게시를 내렸어요. 1시간 안에 페이지가 사라져요"));
  el.querySelectorAll("[data-bdel]").forEach(b => b.onclick = async () => { if (!confirm("이 글을 지울까요?")) return; const r = await sb.from("blog_posts").delete().eq("id", +b.dataset.bdel); if (r.error) { alert(r.error.message); return; } BLG.posts = BLG.posts.filter(x => x.id !== +b.dataset.bdel); blogDraw(); });
}

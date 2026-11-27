/* =========================================================
   💬 문의 기록 (고객 관리 안) — 채팅만 하고 간 손님까지 자동으로 쌓여요
   - 언제 · 누구 · 어느 나라 · 어느 업체 · 무엇을 · 어디서 왔나 · 결과(예약했나)
   - 따로 적을 필요 없음: 채팅 기록(chat_threads · chat_messages)에서 매번 새로 계산
   ========================================================= */
const INQ = { days: 30, q: "", cty: "", shop: "", topic: "", res: "", test: false, rows: null, key: "" };
const INQ_TOPICS = [
  ["price", "💰 가격", /가격|얼마|요금|비용|price|cost|how much|rate|giá|bao nhiêu|цен|сколько|стоим|料金|値段|いくら|价格|多少钱/i],
  ["time", "🕒 예약·시간", /예약|가능|내일|오늘|모레|몇 ?시|시간 ?돼|book|reserv|availab|tomorrow|today|tonight|slot|đặt|lịch|ngày mai|hôm nay|запис|брон|завтра|сегодня|予約|空き|明日|今日|预约|预订|明天|今天/i],
  ["menu", "💆 메뉴·코스", /메뉴|코스|마사지|스파|샴푸|네일|피부|왁싱|menu|course|massage|spa|facial|nail|treatment|package|wax|dịch vụ|gói|массаж|спа|маникюр|マッサージ|スパ|メニュー|コース|按摩|水疗|套餐/i],
  ["loc", "📍 위치·길", /위치|어디|주소|가는 ?길|location|where|address|direction|map|near|địa chỉ|ở đâu|где|адрес|場所|どこ|住所|地址|在哪/i],
  ["pickup", "🚕 픽업·이동", /픽업|택시|그랩|pick ?up|taxi|grab|transfer|shuttle|đón|такси|трансфер|送迎|タクシー|接送|出租车/i],
  ["pay", "💳 결제·환불", /결제|카드|현금|환불|송금|pay|card|cash|refund|deposit|thanh toán|tiền mặt|оплат|карт|налич|支払|カード|現金|付款|现金/i],
  ["deal", "🎟 할인·쿠폰", /할인|쿠폰|이벤트|프로모|바우처|discount|coupon|promo|voucher|deal|offer|giảm|khuyến mãi|скидк|купон|акци|割引|クーポン|优惠|折扣/i],
  ["group", "👥 인원·단체", /\d ?명|인원|단체|가족|커플|people|persons?|pax|group|family|couple|friends|người|человек|групп|\d ?人|名様|家族|カップル/i],
  ["hours", "🏪 영업시간", /영업|몇 ?시까지|문 ?(열|닫)|open|close|hours|giờ mở|mở cửa|часы|открыт|закрыт|営業|何時まで|营业/i],
  ["kids", "👶 아이·임산부", /아이|아기|임산부|kid|child|baby|pregnan|trẻ em|bầu|ребен|беремен|子供|妊娠|孩子|孕妇/i],
  ["lang", "🗣 언어·소통", /한국어|영어|통역|korean|english|speak|language|tiếng|русск|язык|日本語|英語|中文|韩语/i]];
const INQ_SRC = { google: "🔎 구글", naver: "🟢 네이버", naverblog: "🟢 네이버 블로그", daum: "다음", bing: "빙", direct: "⌨️ 직접 입력", internal: "엉클데이 안", kakao: "💬 카톡", facebook: "페이스북", fb: "페이스북", instagram: "인스타", ig: "인스타", youtube: "유튜브", zalo: "잘로", tiktok: "틱톡", chatgpt: "🤖 ChatGPT", perplexity: "🤖 Perplexity", claude: "🤖 Claude", gemini: "🤖 Gemini", gbp: "📍 구글 지도", qr: "📱 QR" };
const INQ_DEV = { m: "📱 휴대폰", t: "📟 태블릿", d: "💻 PC" };
const INQ_RES = { book: "📅 예약함", later: "📅 나중에 예약", only: "💬 문의만", wait: "⏳ 답장 안 함" };

// 채팅이 남긴 '보던 화면' 기록에서 업체 찾기 (문의할 때 보던 업체가 맨 앞)
function inqShops(page) {
  const p = String(page || ""), out = [];
  const add = id => { id = decodeURIComponent(id || "").trim(); if (id && !out.includes(id)) out.push(id); };
  if (/^[a-z0-9-]+$/.test(p) && p !== "home" && p !== "voucher") add(p);
  p.split("|").slice(0, 4).join(",").split(",").forEach(x => { let m;
    if ((m = x.match(/#\/shop\/([^/?&]+)/)) || (m = x.match(/^\/(?:(?:en|vi|ja|zh)\/)?s\/([^/]+)/)) || (m = x.match(/shop\.html#([^/?&]+)/))) add(m[1]); });
  return out;
}
const inqDigits = c => { const d = String(c || "").replace(/\D/g, ""); return d.length >= 8 ? d.slice(-8) : ""; };
function inqTime(iso, tz) { try { const p = {}; new Intl.DateTimeFormat("en-GB", { timeZone: tz || "Asia/Ho_Chi_Minh", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso)).forEach(x => p[x.type] = x.value);
  return `${p.month}/${p.day} ${p.hour}:${p.minute}`; } catch (e) { return String(iso).slice(5, 16).replace("T", " "); } }
// 연락처 가리기: 이메일은 앞 2글자만, 번호는 앞 3 · 뒤 4 숫자만
function inqMask(c) { c = String(c || "").trim(); if (!c) return ""; if (c.includes("@")) return c.replace(/^(.{2})[^@]*/, "$1•••");
  const n = (c.match(/\d/g) || []).length; if (n < 8) return c; let i = 0; return c.replace(/\d/g, d => (i++ < 3 || i > n - 4) ? d : "•"); }

async function loadInq() {
  const key = INQ.days + ""; if (INQ.rows && INQ.key === key) return;
  const get = cols => { let q = sb.from("chat_threads").select(cols).order("created_at", { ascending: false }).limit(3000);
    if (INQ.days) q = q.gte("created_at", new Date(Date.now() - INQ.days * 864e5).toISOString()); return q; };
  let t = await get("id,name,contact,lang,page,created_at,last_at,status,booking_id,country");
  if (t.error) t = await get("id,name,contact,lang,page,created_at,last_at,status,booking_id");
  if (t.error) { INQ.rows = []; INQ.err = t.error.message; return; }
  const ths = t.data || [], ids = ths.map(x => x.id), msgs = {};
  for (let i = 0; i < ids.length; i += 150) {
    const r = await sb.from("chat_messages").select("thread_id,sender,author,body,created_at").in("thread_id", ids.slice(i, i + 150)).order("created_at", { ascending: true }).limit(20000);
    (r.data || []).forEach(m => (msgs[m.thread_id] = msgs[m.thread_id] || []).push(m));
  }
  const bkBy = {}; (BOOKINGS || []).forEach(b => { const d = inqDigits(b.contact) || String(b.contact || "").trim().toLowerCase(); if (d) (bkBy[d] = bkBy[d] || []).push(b); });
  INQ.rows = ths.map(th => {
    const ms = msgs[th.id] || [], guest = ms.filter(m => m.sender === "guest"), real = ms.filter(m => m.sender === "admin" && m.author !== "🤖 자동 인사" && !/^(📥|✅|📋|❌|🔁)/.test(m.body || ""));
    const g0 = guest[0], rep = g0 && real.find(m => m.created_at > g0.created_at);
    const text = guest.map(m => m.body || "").join(" \n ");
    const topics = INQ_TOPICS.filter(x => x[2].test(text)).map(x => x[0]);
    const geo = typeof chatGeo === "function" ? chatGeo(th) : {};
    const pp = String(th.page || "").split("|");
    const bk = th.booking_id && BOOKINGS.find(b => b.id === th.booking_id);
    let shopsSeen = inqShops(th.page); if (bk && !shopsSeen.includes(bk.shop_id)) shopsSeen.unshift(bk.shop_id);
    const key = inqDigits(th.contact) || String(th.contact || "").trim().toLowerCase();
    const later = !bk && key && (bkBy[key] || []).filter(b => b.created_at >= new Date(Date.parse(th.created_at) - 864e5).toISOString()).sort((a, b) => a.created_at < b.created_at ? -1 : 1)[0];
    const res = bk ? "book" : later ? "later" : !rep && guest.length ? "wait" : "only";
    const cust = (bk || later) && (bk || later).customer_id;
    return { th, geo, test: typeof chatIsTest === "function" && chatIsTest(th), shops: shopsSeen, topics, first: g0 ? g0.body : th.last_body || "",
      nG: guest.length, nA: real.length, repMin: rep ? Math.round((Date.parse(rep.created_at) - Date.parse(g0.created_at)) / 6e4) : null,
      src: pp.length >= 3 ? pp[2] : "", land: pp.length >= 3 ? pp[1] : "", res, bk: bk || later || null, cust };
  });
  INQ.key = key;
}

function inqFilter() {
  const q = INQ.q.trim().toLowerCase();
  return INQ.rows.filter(r => (INQ.test || !r.test) && (!INQ.cty || (r.geo.home || "?") === INQ.cty) && (!INQ.shop || r.shops.includes(INQ.shop))
    && (!INQ.topic || r.topics.includes(INQ.topic)) && (!INQ.res || r.res === INQ.res)
    && (!q || [r.th.name, r.th.contact, r.first, ...r.shops.map(id => (shopById(id) || { name: {} }).name.ko || id)].join(" ").toLowerCase().includes(q)));
}
const inqShopNm = id => { const s = shopById(id); return s ? (s.name.ko || s.name.en) : id; };
const inqTop = (rows, f, n = 3) => { const c = {}; rows.forEach(r => [].concat(f(r)).filter(Boolean).forEach(k => c[k] = (c[k] || 0) + 1)); return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, n); };

async function drawInq(el) {
  if (!INQ.rows || INQ.key !== INQ.days + "") { el.innerHTML = `<p class="hint" style="padding:20px">문의 기록 불러오는 중…</p>`; await loadInq(); }
  const base = INQ.rows.filter(r => INQ.test || !r.test), list = inqFilter();
  const n = base.length, conv = base.filter(r => r.res === "book" || r.res === "later").length, wait = base.filter(r => r.res === "wait").length;
  const reps = base.map(r => r.repMin).filter(x => x != null).sort((a, b) => a - b), med = reps.length ? reps[Math.floor(reps.length / 2)] : null;
  const mm = m => m == null ? "-" : m < 1 ? "1분 미만" : m < 60 ? `${m}분` : m < 1440 ? `${(m / 60).toFixed(1)}시간` : `${(m / 1440).toFixed(1)}일`;
  const tTop = inqTop(base, r => r.topics), sTop = inqTop(base, r => r.shops[0]), cTop = inqTop(base, r => r.geo.home);
  const tName = k => (INQ_TOPICS.find(x => x[0] === k) || [, k])[1];
  const ctys = inqTop(base, r => r.geo.home || "?", 50), shopsAll = inqTop(base, r => r.shops, 80);
  const chip = (k, v, label) => `<button class="chip ${INQ[k] === v ? "on" : ""}" data-inq="${k}" data-v="${esc(String(v))}">${label}</button>`;
  el.innerHTML = `
    <div class="kpis" style="margin-top:12px">
      <div class="kpi"><small>문의</small><b>${n}건</b><span class="hint">${INQ.days ? `최근 ${INQ.days}일` : "전체"} · 테스트 ${INQ.test ? "포함" : "뺌"}</span></div>
      <div class="kpi"><small>예약으로 이어짐</small><b>${n ? Math.round(conv / n * 100) : 0}%</b><span class="hint">${conv}건 (같은 연락처 예약 포함)</span></div>
      <div class="kpi ${wait ? "alert" : ""}"><small>답장 안 한 문의</small><b>${wait}건</b><span class="hint">첫 답장 가운데 값 ${mm(med)}</span></div>
      <div class="kpi"><small>많이 물은 것</small><b style="font-size:15px">${tTop.map(([k, c]) => `${tName(k)} ${c}`).join("<br>") || "-"}</b></div>
      <div class="kpi"><small>문의 많은 업체</small><b style="font-size:15px">${sTop.map(([k, c]) => `${esc(inqShopNm(k))} ${c}`).join("<br>") || "-"}</b></div>
      <div class="kpi"><small>나라</small><b style="font-size:15px">${cTop.map(([k, c]) => `${ccFlag(k)} ${esc(ccName(k))} ${c}`).join("<br>") || "-"}</b></div>
    </div>
    <div class="crm-bar">
      <div class="inq-fr"><span class="inq-lb">기간</span><div class="crm-segs">${[7, 30, 90, 0].map(d => chip("days", d, d ? d + "일" : "전체")).join("")}</div></div>
      <div class="inq-fr"><span class="inq-lb">결과</span><div class="crm-segs"><button class="chip ${!INQ.res ? "on" : ""}" data-inq="res" data-v="">전부</button>${Object.entries(INQ_RES).map(([k, v]) => `<button class="chip ${INQ.res === k ? "on" : ""}" data-inq="res" data-v="${INQ.res === k ? "" : k}">${v} <small>${base.filter(r => r.res === k).length}</small></button>`).join("")}</div></div>
      <div class="inq-fr"><span class="inq-lb">물어본 것</span><div class="crm-segs"><button class="chip ${!INQ.topic ? "on" : ""}" data-inq="topic" data-v="">전부</button>${INQ_TOPICS.map(([k, v]) => { const c = base.filter(r => r.topics.includes(k)).length; return c ? `<button class="chip ${INQ.topic === k ? "on" : ""}" data-inq="topic" data-v="${INQ.topic === k ? "" : k}">${v} <small>${c}</small></button>` : ""; }).join("")}</div></div>
      <div class="crm-filters"><input id="inqQ" placeholder="🔎 이름 · 연락처 · 문의 내용 · 업체 검색" value="${esc(INQ.q)}">
        <select id="inqCty"><option value="">나라 전체</option>${ctys.map(([k, c]) => `<option value="${k}" ${INQ.cty === k ? "selected" : ""}>${k === "?" ? "알 수 없음" : esc(ccName(k))} (${c})</option>`).join("")}</select>
        <select id="inqShop"><option value="">업체 전체</option>${shopsAll.map(([k, c]) => `<option value="${esc(k)}" ${INQ.shop === k ? "selected" : ""}>${esc(inqShopNm(k))} (${c})</option>`).join("")}</select>
        <label class="inq-ck"><input type="checkbox" id="inqTest" ${INQ.test ? "checked" : ""}> 🧪 테스트도 보기</label>
        <button class="btn sm" id="inqCsv">⬇️ 엑셀(CSV)</button><button class="btn sm" id="inqReload">↻ 새로고침</button></div>
    </div>
    ${(() => { const on = [INQ.res && ["res", INQ_RES[INQ.res]], INQ.topic && ["topic", tName(INQ.topic)], INQ.cty && ["cty", INQ.cty === "?" ? "나라 모름" : ccName(INQ.cty)], INQ.shop && ["shop", inqShopNm(INQ.shop)], INQ.q && ["q", `"${INQ.q}"`]].filter(Boolean);
      return `<div class="inq-on"><b>${INQ.days ? `최근 ${INQ.days}일` : "전체 기간"} · ${list.length}건</b>${on.length ? ` 보는 중: ${on.map(([k, v]) => `<button class="inq-x" data-inqx="${k}">${esc(v)} ✕</button>`).join("")}<button class="inq-x all" data-inqx="all">모두 풀기</button>` : ` <span class="hint">· 필터 없이 전부 보는 중</span>`}</div>`; })()}
    ${INQ.err ? `<p class="err-text">불러오기 실패: ${esc(INQ.err)}</p>` : ""}
    <div class="inq-list">${list.slice(0, 400).map(r => { const th = r.th, g = r.geo;
      return `<a class="inq-row${r.test ? " is-test" : ""}" href="#chat/${esc(th.id)}" onclick="showTab('chat')">
        <div class="inq-when"><b>${esc(inqTime(th.created_at))}</b><small>베트남 시각${g.tz && g.tz !== "Asia/Ho_Chi_Minh" && g.tz !== "Asia/Saigon" ? `<br>손님 쪽 ${esc(inqTime(th.created_at, g.tz).split(" ").pop())}` : ""}</small></div>
        <div class="inq-who"><b>${esc(th.name || "손님")}</b>${r.test ? ` <span class="ctag">🧪 테스트</span>` : ""}<br><small class="hint">${esc(inqMask(th.contact) || "연락처 없음")}</small>
          <div class="inq-meta">${g.home ? `${ccFlag(g.home)} ${esc(ccName(g.home))}` : "❔ 나라 모름"}${g.here ? ` · ${g.here === "VN" ? "베트남 현지" : "여행 전"}` : ""}${g.dv ? ` · ${INQ_DEV[g.dv] || ""}` : ""}${r.src ? ` · ${esc(INQ_SRC[r.src] || r.src)}` : ""}</div></div>
        <div class="inq-what">${r.shops.length ? `<div class="inq-shops">${r.shops.slice(0, 3).map((id, i) => `<span class="${i ? "inq-s2" : "inq-s1"}">🏪 ${esc(inqShopNm(id))}</span>`).join("")}${r.shops.length > 3 ? ` <small class="hint">+${r.shops.length - 3}</small>` : ""}</div>` : `<div class="hint"><small>업체 화면 없이 문의 (${esc(typeof chatPageName === "function" && r.land ? chatPageName(r.land) : "첫 화면")})</small></div>`}
          <div class="inq-topics">${r.topics.map(k => `<span class="chip">${tName(k)}</span>`).join("")}</div>
          ${String(r.first || "").trim() ? `<div class="inq-first">“${esc(String(r.first).slice(0, 110))}${String(r.first).length > 110 ? "…" : ""}”</div>` : `<div class="hint"><small>(사진 · 예약 알림만 있음)</small></div>`}</div>
        <div class="inq-res"><span class="inq-r ${r.res}">${INQ_RES[r.res]}</span>${r.bk ? `<small>${esc(r.bk.code || "")}${r.bk.visit_date ? ` · ${esc(r.bk.visit_date.slice(5).replace("-", "/"))} 방문` : ""}</small>` : ""}
          <small class="hint">손님 ${r.nG} · 답장 ${r.nA}${r.repMin != null ? ` · ${mm(r.repMin)} 만에` : ""}</small>${r.cust ? `<button type="button" class="btn sm" data-inqcust="${esc(r.cust)}">👤 손님 카드</button>` : ""}</div>
      </a>`; }).join("") || `<div class="todo"><div class="empty">조건에 맞는 문의가 없어요.</div></div>`}</div>
    ${list.length > 400 ? `<p class="hint">앞의 400건만 보여요. 조건으로 좁혀 주세요.</p>` : ""}
    <p class="hint" style="margin:12px 0 30px">💡 따로 적지 않아도 채팅이 들어오면 자동으로 쌓여요. <b>언제 · 누구 · 나라 · 기기 · 들어온 곳 · 보던 업체 · 물어본 것(자동 분류) · 예약했는지 · 답장 속도</b>까지.
      나라 · 기기는 11/27 이후 채팅부터 정확해요. '나중에 예약' = 문의 뒤에 같은 연락처로 들어온 예약이에요. 줄을 누르면 그 채팅이 열려요.</p>`;
  el.querySelectorAll("[data-inq]").forEach(b => b.onclick = () => { const k = b.dataset.inq, v = b.dataset.v; INQ[k] = k === "days" ? +v : v; drawCrm(); });
  const qi = $("inqQ"); qi.oninput = () => { INQ.q = qi.value; clearTimeout(qi._t); qi._t = setTimeout(() => { drawCrm().then(() => { const x = $("inqQ"); if (x) { x.focus(); x.setSelectionRange(x.value.length, x.value.length); } }); }, 250); };
  el.querySelectorAll("[data-inqx]").forEach(b => b.onclick = () => { const k = b.dataset.inqx; if (k === "all") Object.assign(INQ, { res: "", topic: "", cty: "", shop: "", q: "" }); else INQ[k] = ""; drawCrm(); });
  $("inqCty").onchange = e => { INQ.cty = e.target.value; drawCrm(); };
  $("inqShop").onchange = e => { INQ.shop = e.target.value; drawCrm(); };
  $("inqTest").onchange = e => { INQ.test = e.target.checked; drawCrm(); };
  $("inqReload").onclick = () => { INQ.rows = null; drawCrm(); };
  el.querySelectorAll("[data-inqcust]").forEach(b => b.onclick = e => { e.preventDefault(); e.stopPropagation(); openCustomer(b.dataset.inqcust); });
  $("inqCsv").onclick = () => {
    const H = ["문의 시각(베트남)", "이름", "연락처(가림)", "나라", "나라 근거", "위치", "기기", "브라우저 언어", "들어온 곳", "문의 업체", "함께 본 업체", "주제", "첫 문의", "손님 메시지 수", "답장 수", "첫 답장(분)", "결과", "예약 번호"];
    const L = list.map(r => [inqTime(r.th.created_at), r.th.name || "", inqMask(r.th.contact), r.geo.home ? ccName(r.geo.home) : "", r.geo.how || "", r.geo.here === "VN" ? "베트남 현지" : r.geo.here ? "여행 전" : "", (INQ_DEV[r.geo.dv] || "").replace(/^\S+ /, ""), r.geo.bl || "",
      (INQ_SRC[r.src] || r.src || "").replace(/^\S+ /, ""), r.shops[0] ? inqShopNm(r.shops[0]) : "", r.shops.slice(1).map(inqShopNm).join(" / "), r.topics.map(k => tName(k).replace(/^\S+ /, "")).join(" / "), r.first || "", r.nG, r.nA, r.repMin ?? "", INQ_RES[r.res].replace(/^\S+ /, ""), r.bk ? r.bk.code || "" : ""]);
    const csv = "﻿" + [H, ...L].map(row => row.map(v => `"${String(v).replace(/"/g, '""').replace(/\n/g, " ")}"`).join(",")).join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = `엉클데이_문의기록_${vnToday()}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  };
}

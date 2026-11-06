/* 업체 상세 + 예약 요청. 메인 화면 안에서 새로고침 없이 그려요 (shop.html 단독으로도 열려요). */
const shopLink = id => window.SPA ? `#/shop/${encodeURIComponent(id)}` : `shop.html#${id}`;

// 업체 화면에서 '상담하기'를 누르면 어느 업체를 보고 왔는지 문의 문구를 복사해 둬요 (카톡 창에 붙여넣기)
document.addEventListener("click", e => {
  const a = e.target.closest("a.kakao-link"); if (!a || a.id === "bkKakao") return;
  const m = location.hash.match(/^#\/shop\/(.+)$/) || (/shop\.html$/.test(location.pathname) && [0, location.hash.slice(1)]);
  const shop = m && SHOPS.find(s => s.id === decodeURIComponent(m[1])); if (!shop) return;
  const c = CITIES.find(x => x.id === shop.city), k = CATEGORIES.find(x => x.id === shop.cat);
  const text = ui("askMsg", { shop: tx(shop.name), city: c ? tx(c.name) : "", cat: k ? tx(k.name) : "" });
  try { navigator.clipboard.writeText(text).then(() => alertBox(ui("askCopied")), () => {}); } catch (err) {}
}, true);

function renderShop(id) {
const shop = SHOPS.find(s => s.id === id);
const box = $("detail");
if (shop && typeof LIVE !== "undefined") LIVE.view(shop.id);
document.querySelectorAll(".cta-bar").forEach(e => e.remove());
document.body.classList.remove("has-cta");

if (!shop) {
  box.innerHTML = `<p class="empty">${ui("notFound")}</p><a href="${window.SPA ? "#" : "index.html"}">${ui("back")}</a>`;
} else {
  document.title = tx(shop.name) + " | " + tx(SITE.name);
  const cat = CATEGORIES.find(c => c.id === shop.cat);
  const img = shop.img ? `<img class="hero" src="${shop.img}" alt="" decoding="async" style="object-position:${shop.imgPos || "50% 50%"}">` : `<div class="hero ph">${cat ? cat.icon : "✨"}</div>`;
  const closed = shop.closed.length ? shop.closed.map(d => ui("days")[d]).join(", ") : ui("none");
  const staff = shop.staffLangs.length ? shop.staffLangs.map(l => ui("lang_" + l)).join(", ") : ui("tbd");
  const revs = (shop.userReviews || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const avg = revs.length ? (revs.reduce((t, r) => t + r.stars, 0) / revs.length).toFixed(1) : 0;
  const pending = shop.verified === false || !shop.open || !shop.menu.length;   // 정보 미확인 → 예약 폼 대신 상담 버튼
  const hoursText = shop.open ? `${shop.open} ~ ${shop.close}` : ui("tbd");
  const closedText = shop.open ? closed : ui("tbd");

  const hasPrice = shop.menu.some(m => m.price > 0);
  const addrOk = !/확인 중|to be confirmed/i.test(JSON.stringify(shop.address));
  const checks = [
    [ui("address"), addrOk], [ui("hours"), !!shop.open], [ui("price"), hasPrice],
    [ui("staffLangs"), shop.staffLangs.length > 0], [ui("chkConsent"), shop.verified !== false]
  ];
  const facts = [
    ["📍", ui("address"), addrOk ? tx(shop.address) : ui("tbd"), addrOk],
    ["💰", ui("price"), hasPrice ? priceFrom(shop) : ui("consultPrice"), hasPrice],
    ["🕒", ui("hours"), shop.open ? `${hoursText}<br><small>${ui("closedDays")}: ${closedText}</small>` : ui("tbd"), !!shop.open],
    ["🗣️", ui("staffLangs"), staff, shop.staffLangs.length > 0]
  ];
  // 비슷한 업체: 같은 카테고리 (같은 도시 우선) 최대 3곳
  const similar = SHOPS.filter(s => s.id !== shop.id && s.cat === shop.cat)
    .sort((a, b) => (b.city === shop.city) - (a.city === shop.city)).slice(0, 3);

  box.innerHTML = `
    <a href="${window.SPA ? "#" : "index.html"}" class="back">${ui("back")}</a>
    ${img}
    <div class="head">
      <div class="chips"><span class="tag cat-tag">${cat ? cat.icon + " " + tx(cat.name) : ""}</span>
        <span class="tag">📍 ${cityName(shop.city)}</span>
        ${shop.rating ? `<span class="tag">⭐ ${shop.rating} (${shop.reviews})</span>` : ""}
        ${pending ? `<span class="pending">${ui("unverified")}</span>` : ""}</div>
      <h1>${tx(shop.name)}${shop.best ? ` <span class="best-badge"><i>✦</i>${ui("certBadge")}<i>✦</i></span>` : ""}</h1>
      <div class="tags">${shop.tags.map(t => `<span class="tag">#${tx(t)}</span>`).join("")}</div>
    </div>

    <h2>${ui("overview")}</h2>
    <div class="facts">${facts.map(f => `
      <div class="fact ${f[3] ? "" : "tbd"}"><span class="fi">${f[0]}</span><div><small>${f[1]}</small><b>${f[2]}</b></div></div>`).join("")}
    </div>
    ${shop.map ? `<p><a class="map-link" href="${shop.map}" target="_blank">🗺️ ${ui("map")}</a></p>` : ""}

    <h2>${ui("about")}</h2><p>${tx(shop.desc)}</p>
    ${shop.recommend ? `<p class="reco">👍 <b>${ui("recoFor")}</b> ${tx(shop.recommend)}</p>` : ""}

    ${shop.menu.length ? `<h2>${ui("menu")}</h2>
    <div id="menuList">${shop.menu.map((m, i) => `
      <div class="menu-row"><div><b>${tx(m.name)}</b>${m.min ? `<br><small>${m.min} ${ui("min")}</small>` : ""}</div>
      <div class="price">${money(m.price)}</div>
      ${pending ? "" : `<button class="chip pick" data-i="${i}">${ui("bookBtn")}</button>`}</div>`).join("")}
    </div>` : ""}

    ${(shop.menuImgs || []).length ? `<h2>${ui("menuBoard")}</h2>
    <div class="boards">${shop.menuImgs.map((m, i) => `
      <button class="board" data-b="${i}" type="button"><img src="${m.src}" alt="" loading="lazy">${m.cap ? `<span>${m.cap}</span>` : ""}</button>`).join("")}
    </div><p class="board-hint">${ui("tapZoom")}</p>` : ""}

    <h2 id="rvTitle">${ui("rvTitle")}${revs.length ? ` <small class="rv-sum">★ ${avg} · ${ui("rvCount", { n: revs.length })}</small>` : ""}</h2>
    <div class="rv-list-site">${revs.length ? revs.map(r => `
      <div class="rv-card"><div class="rv-top"><span class="rv-stars">${stars(r.stars)}</span><small>${esc(r.name)}${r.date ? " · " + reviewDate(r.date) : ""}${r.menu ? " · " + esc(r.menu) : ""}</small></div>
      <p>${esc(r.text).replace(/\n/g, "<br>")}</p></div>`).join("") : `<p class="empty">${ui("rvNone")}</p>`}
    </div>
    <button class="btn rv-open" id="rvOpen" type="button">✍️ ${ui("rvWrite")}</button>
    <form id="rvForm" class="form" hidden>
      <div class="f-stars"><span>${ui("rvStars")}</span><div id="rvStarBtns">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-s="${n}" aria-label="${n}">★</button>`).join("")}</div></div>
      <label>${ui("rvName")}<input name="name" required maxlength="20"></label>
      <label>${ui("rvVisit")}<input type="month" name="date" required></label>
      ${shop.menu.length ? `<label>${ui("rvMenu")}<select name="menu"><option value="">-</option>${shop.menu.map(m => `<option>${esc(tx(m.name))}</option>`).join("")}</select></label>` : ""}
      <label>${ui("rvText")}<textarea name="text" rows="4" required minlength="10" maxlength="1000" placeholder="${ui("rvTextPh")}"></textarea></label>
      <label>${ui("rvContact")}<input name="contact" maxlength="60"></label>
      <button class="btn big-btn" type="submit">${ui("rvSend")}</button>
      <small>${ui("rvNotice")}</small>
    </form>
    <div id="rvDone" class="done" hidden></div>

    ${pending ? `<p class="pending-box">${ui("unverifiedNote")}</p>
    <div class="done"><h2>${ui("book")}</h2><p>${ui("askNote")}</p>
      <a class="btn kakao-link" href="${SITE.kakao}" target="_blank">${ui("askBtn")}</a></div>` : ""}

    ${similar.length ? `<h2>${ui("similar")}</h2>
    <div class="sim">${similar.map(s => `<a class="sim-item" href="${shopLink(s.id)}"><b>${tx(s.name)}</b><small>${cityName(s.city)} · ${s.tags.slice(0, 2).map(t => tx(t)).join(", ")}</small></a>`).join("")}</div>` : ""}

    <h2 id="bookTitle" ${pending ? "hidden" : ""}>${ui("book")}</h2>
    <form id="form" class="form" ${pending ? "hidden" : ""}>
      <label>${ui("fMenu")}<select name="menu" id="fMenu">${shop.menu.map((m, i) =>
        `<option value="${i}">${tx(m.name)} – ${money(m.price)}</option>`).join("")}</select></label>
      <label>${ui("fDate")}<input type="date" name="date" id="fDate" required></label>
      <label>${ui("fTime")}<select name="time" id="fTime" required></select></label>
      <label>${ui("fPeople")}<input type="number" name="people" value="1" min="1" max="10" required></label>
      <label>${ui("fName")}<input name="name" required></label>
      <label>${ui("fContact")}<input name="contact" required></label>
      <label>${ui("fNote")}<textarea name="note" rows="3"></textarea></label>
      <button class="btn big-btn" type="submit">${ui("bookBtn")}</button>
      <small>${ui("notice")}</small>
    </form>
    <div id="done" class="done" hidden></div>`;
  // 메뉴판 크게 보기
  const boards = shop.menuImgs || [];
  function openBoard(i) {
    const lb = document.createElement("div"); lb.className = "lightbox";
    const show = () => {
      const m = boards[i];
      lb.innerHTML = `<button class="lb-x" aria-label="close">✕</button>
        ${boards.length > 1 ? `<button class="lb-nav lb-prev" aria-label="prev">‹</button><button class="lb-nav lb-next" aria-label="next">›</button>` : ""}
        <div class="lb-body"><img src="${m.src}" alt=""></div>
        <div class="lb-cap">${m.cap || ""}${boards.length > 1 ? ` <small>${i + 1} / ${boards.length}</small>` : ""}</div>`;
      lb.querySelector(".lb-x").onclick = () => lb.remove();
      if (lb.querySelector(".lb-prev")) {
        lb.querySelector(".lb-prev").onclick = e => { e.stopPropagation(); i = (i - 1 + boards.length) % boards.length; show(); };
        lb.querySelector(".lb-next").onclick = e => { e.stopPropagation(); i = (i + 1) % boards.length; show(); };
      }
    };
    lb.onclick = e => { if (e.target === lb || e.target.classList.contains("lb-body")) lb.remove(); };
    show(); document.body.appendChild(lb);
  }
  document.querySelectorAll(".board").forEach(b => b.onclick = () => openBoard(+b.dataset.b));

  // 화면 아래에 항상 보이는 문의 버튼
  document.body.insertAdjacentHTML("beforeend", `<div class="cta-bar"><a class="btn kakao-link" href="${SITE.kakao}" target="_blank">💬 ${ui("askBtn")}</a><small class="cta-hint">${ui("askCopyHint")}</small></div>`);
  document.body.classList.add("has-cta");

  // 이용 후기 보내기 (확인 후 관리자 페이지에서 게시)
  let rvStar = 0;
  const rvForm = $("rvForm");
  $("rvOpen").onclick = () => { rvForm.hidden = false; $("rvOpen").hidden = true; rvForm.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const drawStars = () => rvForm.querySelectorAll("[data-s]").forEach(b => b.classList.toggle("on", +b.dataset.s <= rvStar));
  rvForm.querySelectorAll("[data-s]").forEach(b => b.onclick = () => { rvStar = +b.dataset.s; drawStars(); });
  const mNow = new Date().toISOString().slice(0, 7);
  rvForm.date.max = mNow; rvForm.date.value = mNow;
  rvForm.onsubmit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(rvForm));
    if (!rvStar) { alertBox(ui("rvNeedStar")); return; }
    if ((f.text || "").trim().length < 10) { alertBox(ui("rvShort")); return; }
    const msg =
`[이용 후기]
업체: ${shop.name.ko} (${shop.id})
별점: ${rvStar}점
이름: ${f.name}
방문: ${f.date}
메뉴: ${f.menu || "-"}
연락처: ${f.contact || "-"}
내용:
${f.text}
작성 언어: ${lang.toUpperCase()}`;
    let sent = false;
    if (LIVE.on) {
      try {
        await LIVE.rpc("submit_review", { p: { shop_id: shop.id, stars: rvStar, name: f.name, month: f.date, menu: f.menu, text: f.text, contact: f.contact, lang } });
        sent = true;
      } catch (err) { if (err.server) { alertBox(err.message); return; } }
    } else if (SITE.formEndpoint) {
      try {
        const r = await fetch(SITE.formEndpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ type: "review", shop: shop.id, stars: rvStar, ...f, message: msg }) });
        sent = r.ok;
      } catch (err) {}
    }
    const mail = `mailto:${SITE.email}?subject=${encodeURIComponent("[이용 후기] " + shop.name.ko)}&body=${encodeURIComponent(msg)}`;
    rvForm.hidden = true;
    const d = $("rvDone"); d.hidden = false;
    d.innerHTML = `<h2>${ui("rvWrite")}</h2><p>${sent ? ui("rvDoneSent") : ui("rvDoneManual")}</p><pre id="rvMsg"></pre>
      ${sent ? "" : `<button class="btn" id="rvCopy" type="button">${ui("copy")}</button>
      <a class="btn kakao-link" href="${SITE.kakao}" target="_blank">${ui("viaKakao")}</a>
      <a class="btn" href="${mail}">${ui("viaMail")}</a>`}`;
    $("rvMsg").textContent = msg;
    if ($("rvCopy")) $("rvCopy").onclick = () => navigator.clipboard.writeText(msg).then(() => $("rvCopy").textContent = ui("copied"));
    d.scrollIntoView({ behavior: "smooth" });
  };

  if (pending) { /* 예약 폼은 숨김 */ } else {
  const form = $("form"), fDate = $("fDate"), fTime = $("fTime"), fMenu = $("fMenu");

  // 내일부터 선택 가능
  const d = new Date(); d.setDate(d.getDate() + 1);
  fDate.min = d.toISOString().slice(0, 10);

  const toMin = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);
  const toStr = m => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");

  // 시간 칸: 영업시간 안에서 시술이 끝나는 시간까지만 30분 간격으로
  function drawTimes() {
    const dur = shop.menu[fMenu.value].min;
    let html = "";
    for (let t = toMin(shop.open); t + dur <= toMin(shop.close); t += 30)
      html += `<option>${toStr(t)}</option>`;
    fTime.innerHTML = html;
  }
  drawTimes();
  fMenu.onchange = drawTimes;

  // 쉬는 요일 막기
  fDate.onchange = () => {
    if (fDate.value && shop.closed.includes(new Date(fDate.value + "T00:00:00").getDay())) {
      alert(ui("closedAlert")); fDate.value = "";
    }
  };

  document.querySelectorAll(".pick").forEach(btn => btn.onclick = () => {
    fMenu.value = btn.dataset.i; drawTimes();
    $("bookTitle").scrollIntoView({ behavior: "smooth" });
  });

  form.onsubmit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    const m = shop.menu[f.menu];
    // 운영자(한국어)가 읽는 메시지
    const msg =
`[예약 요청]
업체: ${shop.name.ko}
메뉴: ${m.name.ko} (${m.min}분, ${m.price ? "₫" + m.price.toLocaleString("en-US") : "상담"})
날짜: ${f.date}  ${f.time}
인원: ${f.people}명
이름: ${f.name}
연락처: ${f.contact}
요청사항: ${f.note || "-"}
고객 언어: ${lang.toUpperCase()}`;

    // 데이터베이스에 바로 접수 → 예약번호와 예약확인증
    if (LIVE.on) {
      const btn = form.querySelector('button[type="submit"]'); btn.disabled = true; btn.textContent = ui("bkSending");
      try {
        const r = await LIVE.rpc("create_booking", { p: { shop_id: shop.id, menu: +f.menu, date: f.date, time: f.time, people: +f.people, name: f.name, contact: f.contact, note: f.note, lang } });
        const link = `booking.html#${r.token}`;
        const kmsg = msg.replace("[예약 요청]", `[예약 요청] ${r.code}`);
        form.hidden = true;
        const done = $("done"); done.hidden = false;
        done.innerHTML = `<h2>✅ ${ui("bkDoneTitle")}</h2>
          <p class="bk-code"><small>${ui("vCode")}</small><b>${esc(r.code)}</b></p>
          <p>${ui("bkDoneDesc")}</p>
          <a class="btn big-btn" href="${link}">${ui("bkVoucher")}</a>
          <a class="btn kakao-link" id="bkKakao" href="${SITE.kakao}" target="_blank">${ui("bkKakao")}</a>`;
        $("bkKakao").onclick = () => { try { navigator.clipboard.writeText(kmsg + "\n" + new URL(link, location.href).href); alertBox(ui("bkKakaoCopied")); } catch (e) {} };
        try { const k = "uncleday-my-bookings"; const a = JSON.parse(localStorage.getItem(k) || "[]"); a.unshift({ code: r.code, token: r.token, shop: shop.id, date: f.date }); localStorage.setItem(k, JSON.stringify(a.slice(0, 20))); } catch (e) {}
        done.scrollIntoView({ behavior: "smooth" });
        return;
      } catch (err) {
        btn.disabled = false; btn.textContent = ui("bookBtn");
        if (err.server) { alertBox(err.message); return; }
      }
    }

    let sent = false;
    if (SITE.formEndpoint) {
      try {
        const r = await fetch(SITE.formEndpoint, {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ message: msg, ...f, shop: shop.id })
        });
        sent = r.ok;
      } catch (err) {}
    }

    const mail = `mailto:${SITE.email}?subject=${encodeURIComponent("[예약 요청] " + shop.name.ko)}&body=${encodeURIComponent(msg)}`;
    form.hidden = true;
    const done = $("done"); done.hidden = false;
    done.innerHTML = `<h2>${ui("doneTitle")}</h2>
      <p>${sent ? ui("doneSent") : LIVE.on ? ui("bkFail") : ui("doneManual")}</p>
      <pre id="msg"></pre>
      ${sent ? "" : `<button class="btn" id="copy">${ui("copy")}</button>
        <a class="btn kakao-link" href="${SITE.kakao}" target="_blank">${ui("viaKakao")}</a>
        <a class="btn" href="${mail}">${ui("viaMail")}</a>`}`;
    $("msg").textContent = msg;
    if ($("copy")) $("copy").onclick = () => {
      navigator.clipboard.writeText(msg).then(() => $("copy").textContent = ui("copied"));
    };
    done.scrollIntoView({ behavior: "smooth" });
  };
  }
}
}

// 브라우저 알림창 대신 쓰는 짧은 안내
function alertBox(t) {
  const d = document.createElement("div"); d.className = "toast-site"; d.textContent = t;
  document.body.appendChild(d); setTimeout(() => d.remove(), 2500);
}

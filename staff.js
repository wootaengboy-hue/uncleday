/* 엉클데이 직원 화면 — 전화번호 + PIN 으로 로그인해서 내 근무표 · 출퇴근 · 요청 · 후기 · 보너스 · 경력 동의를 봐요.
   서버 함수(staff_*)는 universe9.sql 에 있어요. 로그인 열쇠는 이 기기에만 저장돼요. */
(function () {
  "use strict";
  const LANGS = ["vi", "ko", "en"];
  const T = {
    title: ["Nhân viên", "직원 화면", "Staff"],
    loginT: ["Đăng nhập nhân viên", "직원 로그인", "Staff login"], loginS: ["Dùng số điện thoại và mã PIN 6 số do chủ cửa hàng đưa.", "사장님이 알려 준 전화번호와 PIN(숫자 6자리)으로 들어와요.", "Use your phone number and the 6-digit PIN from the owner."],
    phone: ["Số điện thoại", "전화번호", "Phone"], pin: ["Mã PIN", "PIN", "PIN"], login: ["Đăng nhập", "로그인", "Log in"], logout: ["Đăng xuất", "로그아웃", "Log out"],
    noPin: ["Chưa có PIN? Hãy nhờ chủ cửa hàng tạo trong Bảng phòng → ⚙️ → Nhân viên.", "PIN이 없으면 사장님께 '현황판 → ⚙️ 매장 설정 → 직원'에서 만들어 달라고 하세요.", "No PIN? Ask the owner to make one in Board → ⚙️ → Staff."],
    today: ["Hôm nay", "오늘", "Today"], myShift: ["Ca của tôi", "내 근무", "My shift"], off: ["Nghỉ", "휴무", "Day off"],
    sh_A: ["Ca mở cửa", "오픈조", "Opening"], sh_B: ["Ca đóng cửa", "마감조", "Closing"], sh_F: ["Cả ngày", "종일", "Full day"], sh_O: ["Nghỉ", "휴무", "Off"], sh_C: ["Giờ riêng", "시간 지정", "Custom"],
    clockIn: ["Chấm công vào", "출근하기", "Clock in"], clockOut: ["Chấm công ra", "퇴근하기", "Clock out"], inAt: ["Vào {t}", "{t} 출근", "In {t}"], outAt: ["Ra {t}", "{t} 퇴근", "Out {t}"],
    late: ["Trễ {n}′", "지각 {n}분", "Late {n}′"], onTime: ["Đúng giờ", "정시", "On time"], notIn: ["Chưa chấm công", "아직 출근 전", "Not clocked in"], doneDay: ["Đã về", "퇴근함", "Clocked out"],
    inSess: ["Đang làm", "시술 중", "In session"], room: ["P.{n}", "{n}호", "Rm {n}"], left: ["còn {n}′", "{n}분 남음", "{n}′ left"], withN: ["cùng {n} người", "{n}명 함께", "with {n}"],
    doneToday: ["Hôm nay", "오늘 시술", "Today"], doneMonth: ["Tháng này", "이번 달", "This month"], times: ["{n} lượt", "{n}건", "{n}"],
    shop_before: ["Chưa mở cửa", "영업 전", "Not open yet"], shop_open: ["Đang mở cửa", "영업 중", "Open"], shop_after: ["Đã đóng cửa", "영업 종료", "Closed"], shop_dayoff: ["Hôm nay nghỉ", "오늘 휴무", "Closed today"],
    rota: ["Lịch làm của tôi", "내 근무표", "My rota"], thisWk: ["Tuần này", "이번 주", "This week"], nextWk: ["Tuần sau", "다음 주", "Next week"], team: ["Xem lịch đồng nghiệp", "동료 근무 보기", "See coworkers"],
    tapDay: ["Bấm vào ngày để xin nghỉ, đổi ca hoặc đổi với đồng nghiệp.", "날짜를 누르면 휴무 · 근무 변경 · 교대를 요청할 수 있어요.", "Tap a day to ask for a day off, a shift change or a swap."],
    reqT: ["Yêu cầu cho {d}", "{d} 요청", "Request for {d}"], rOff: ["Xin nghỉ", "휴무 요청", "Day off"], rShift: ["Đổi ca", "근무 변경", "Change shift"], rSwap: ["Đổi với đồng nghiệp", "동료와 교대", "Swap"],
    want: ["Ca muốn đổi", "바꾸고 싶은 근무", "Shift you want"], mate: ["Đồng nghiệp", "교대할 동료", "Coworker"], reason: ["Lý do (không bắt buộc)", "사유 (선택)", "Reason (optional)"],
    must: ["Rất cần (việc gấp)", "꼭 필요해요 (급한 일)", "Really need it"], send: ["Gửi yêu cầu", "요청 보내기", "Send"], cancel: ["Huỷ", "취소", "Cancel"], close: ["Đóng", "닫기", "Close"],
    swapHow: ["Đồng nghiệp đồng ý trước, sau đó chủ cửa hàng duyệt.", "동료가 먼저 수락하고, 그다음 사장님이 승인해요.", "Your coworker accepts first, then the owner approves."],
    reqs: ["Yêu cầu", "요청", "Requests"], noReq: ["Chưa có yêu cầu.", "보낸 요청이 없어요.", "No requests."], incoming: ["Đồng nghiệp nhờ đổi ca", "동료의 교대 부탁", "Swap asks from coworkers"],
    inMsg: ["{n} muốn đổi ca ngày {d} (bạn: {a} ↔ {n}: {b})", "{n}님이 {d} 교대를 부탁했어요 (나: {a} ↔ {n}: {b})", "{n} asks to swap on {d} (you: {a} ↔ {n}: {b})"],
    accept: ["Đồng ý", "수락", "Accept"], decline: ["Từ chối", "거절", "Decline"],
    st_peer: ["Chờ đồng nghiệp", "동료 수락 대기", "Waiting for coworker"], st_pending: ["Chờ chủ duyệt", "사장님 승인 대기", "Waiting for owner"], st_ok: ["Đã duyệt", "승인됨", "Approved"], st_no: ["Không được", "거절됨", "Declined"], st_cancelled: ["Đã huỷ", "취소됨", "Cancelled"],
    ty_off: ["Nghỉ", "휴무", "Off"], ty_shift: ["Đổi ca → {w}", "근무 변경 → {w}", "Shift → {w}"], ty_swap: ["Đổi với {m}", "{m}님과 교대", "Swap with {m}"],
    rv: ["Đánh giá & thưởng", "후기 · 보너스", "Reviews & bonus"], rvAvg: ["Điểm TB", "평균 별점", "Average"], rvCnt: ["Đánh giá", "받은 후기", "Reviews"], bPend: ["Thưởng chờ trả", "받을 보너스", "Bonus to come"], bPaid: ["Đã nhận", "받은 보너스", "Bonus paid"],
    bEach: ["Mỗi đánh giá được xác nhận: {v} (không phụ thuộc số sao)", "확인된 후기 1건당 {v} (별점과 상관없이 같아요)", "Per verified review: {v} (same for any stars)"],
    bEach0: ["Mức thưởng sẽ sớm được Uncle Day thông báo.", "보너스 금액은 엉클데이가 곧 알려 드려요.", "Uncle Day will announce the bonus amount soon."],
    qr: ["Mã QR xin đánh giá", "후기 부탁 QR", "Review QR"], qrHow: ["Sau khi làm xong, hãy cho khách đặt qua Uncle Day quét mã này. Khách tìm lịch hẹn của mình rồi chọn bạn và viết đánh giá.", "시술이 끝나면 엉클데이 예약 손님에게 이 QR을 보여 주세요. 손님이 자기 예약을 찾은 뒤 나를 골라 후기를 써요.", "After the session, show this to Uncle Day guests. They find their booking, pick you and write a review."],
    qrRule: ["Chỉ khách thật sự được bạn phục vụ mới chọn được bạn. Nhờ khách của người khác sẽ không được tính thưởng.", "실제로 내가 담당한 손님만 나를 고를 수 있어요. 다른 직원 손님에게 부탁하면 보너스가 인정되지 않아요.", "Only guests you actually served can pick you. Reviews from other staff's guests do not earn a bonus."],
    noRv: ["Chưa có đánh giá.", "아직 받은 후기가 없어요.", "No reviews yet."],
    b_pending: ["chờ duyệt", "확인 중", "checking"], b_approved: ["sẽ trả", "지급 예정", "to be paid"], b_paid: ["đã trả", "지급 완료", "paid"], b_rejected: ["không tính", "인정 안 됨", "not counted"], b_none: ["chưa xác nhận lượt đến", "방문 확인 전", "visit not confirmed"],
    me: ["Thông tin của tôi", "내 정보", "My info"],
    career: ["Lưu hồ sơ nghề nghiệp", "경력 프로필 저장", "Keep a career profile"], careerS: ["Uncle Day lưu kinh nghiệm, số lượt làm và đánh giá của bạn để bạn mang theo khi đổi chỗ làm. Bạn tắt lúc nào cũng được.", "엉클데이가 내 경력 · 시술 건수 · 후기를 저장해서, 매장을 옮겨도 이어 갈 수 있게 해요. 언제든 끌 수 있어요.", "Uncle Day keeps your experience, sessions and reviews so they follow you if you change shops. Turn off any time."],
    open: ["Đang tìm việc mới", "새 일자리 찾는 중", "Open to new jobs"], openS: ["Chỉ Uncle Day thấy. Chủ cửa hàng hiện tại KHÔNG bao giờ thấy mục này.", "엉클데이만 봐요. 지금 매장 사장님에게는 절대 보이지 않아요.", "Only Uncle Day sees this. Your current owner never does."],
    openNeed: ["Hãy bật hồ sơ nghề nghiệp trước.", "먼저 경력 프로필 저장을 켜 주세요.", "Turn on the career profile first."],
    pinCh: ["Đổi PIN", "PIN 바꾸기", "Change PIN"], pinOld: ["PIN hiện tại", "지금 PIN", "Current PIN"], pinNew: ["PIN mới (6 số)", "새 PIN (숫자 6자리)", "New PIN (6 digits)"], save: ["Lưu", "저장", "Save"], pinDone: ["Đã đổi PIN.", "PIN을 바꿨어요.", "PIN changed."],
    saved: ["Đã lưu.", "저장했어요.", "Saved."], sent: ["Đã gửi yêu cầu.", "요청을 보냈어요.", "Request sent."], refresh: ["↻", "↻", "↻"],
    tErr: ["Có lỗi. Hãy thử lại.", "문제가 생겼어요. 다시 해 주세요.", "Something went wrong. Try again."],
    install: ["Thêm vào màn hình chính để mở nhanh.", "홈 화면에 추가하면 앱처럼 빨리 열 수 있어요.", "Add to home screen to open it like an app."],
    wd: [["CN", "T2", "T3", "T4", "T5", "T6", "T7"], ["일", "월", "화", "수", "목", "금", "토"], ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]],
  };
  const ERR = {
    "Wrong phone or PIN": ["Sai số điện thoại hoặc PIN.", "전화번호나 PIN이 맞지 않아요.", "Wrong phone or PIN."],
    "Too many tries": ["Sai quá nhiều lần. Hãy đợi 15 phút.", "여러 번 틀려서 15분 동안 잠겼어요.", "Too many tries. Wait 15 minutes."],
    "Please log in again": ["Hãy đăng nhập lại.", "다시 로그인해 주세요.", "Please log in again."],
    "Still in a session": ["Đang làm cho khách, chưa thể chấm ra.", "시술 중이라 퇴근할 수 없어요.", "You are still in a session."],
    "You already asked for this day": ["Ngày này bạn đã gửi yêu cầu rồi.", "이 날은 이미 요청했어요.", "You already asked for this day."],
    "Choose a coworker": ["Hãy chọn đồng nghiệp.", "교대할 동료를 골라 주세요.", "Choose a coworker."],
    "Choose a shift": ["Hãy chọn ca.", "근무를 골라 주세요.", "Choose a shift."],
    "Choose a day": ["Hãy chọn ngày (từ hôm nay).", "오늘 이후 날짜를 골라 주세요.", "Choose a day from today."],
    "Wrong PIN": ["PIN hiện tại không đúng.", "지금 PIN이 맞지 않아요.", "Current PIN is wrong."],
    "PIN must be 6 digits": ["PIN mới phải là 6 số.", "새 PIN은 숫자 6자리여야 해요.", "New PIN must be 6 digits."],
    "Please ask the owner to add your phone number": ["Hãy nhờ chủ cửa hàng thêm số điện thoại của bạn.", "사장님께 내 전화번호를 등록해 달라고 하세요.", "Ask the owner to add your phone number."],
    "Request not found": ["Không tìm thấy yêu cầu.", "요청을 찾을 수 없어요.", "Request not found."],
    "Try again later": ["Hãy thử lại sau.", "잠시 뒤 다시 해 주세요.", "Try again later."],
  };
  const store = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} };
  const read = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  let lang = read("ud-staff-lang") || (navigator.language || "vi").slice(0, 2); if (!LANGS.includes(lang)) lang = "vi";
  const li = () => LANGS.indexOf(lang);
  const t = (k, v) => { let s = (T[k] || [k, k, k])[li()]; if (v) Object.keys(v).forEach(x => { s = s.split("{" + x + "}").join(v[x]); }); return s; };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const vnd = n => String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "₫";
  const fmt = m => { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };
  const hrsTxt = h => h ? fmt(h[0]) + "–" + fmt(h[1]) : "";
  const tm = iso => iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }) : "";
  const dp = ds => { const d = new Date(ds + "T00:00:00Z"); return { m: d.getUTCMonth() + 1, d: d.getUTCDate(), w: T.wd[li()][d.getUTCDay()] }; };
  const dShort = ds => { const p = dp(ds); return lang === "vi" ? `${p.w} ${p.d}/${p.m}` : lang === "ko" ? `${p.m}/${p.d} (${p.w})` : `${p.w} ${p.m}/${p.d}`; };
  const addD = (ds, n) => { const d = new Date(ds + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const shopName = s => { const n = s && s.name; return n ? (typeof n === "string" ? n : n[lang] || n.vi || n.ko || n.en || "") : ""; };
  const errTx = e => { const m = e && e.message || "", k = Object.keys(ERR).find(x => m.indexOf(x) >= 0); return k ? ERR[k][li()] : (/fetch|network/i.test(m) ? t("tErr") : (m || t("tErr"))); };

  const $app = document.getElementById("app");
  let sb = null, tok = read("ud-staff-token"), D = null, wk = 0, showTeam = false, req = null, pinOpen = false, busy = false, toastT = null, qrOpen = false;
  const rpc = async (fn, args) => { const { data, error } = await sb.rpc(fn, args || {}); if (error) throw error; return data; };
  function toast(msg) { let el = document.getElementById("toast"); if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; document.body.appendChild(el); } el.textContent = msg; el.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("on"), 2600); }

  function langBtns() { return `<div class="lang">${LANGS.map(l => `<button data-lang="${l}" class="${l === lang ? "on" : ""}">${l.toUpperCase()}</button>`).join("")}</div>`; }
  function drawLogin(msg) {
    document.title = "Uncle Day · " + t("title");
    $app.innerHTML = `<div class="login"><div class="lhead"><b>Uncle Day</b>${langBtns()}</div>
      <form id="lf" class="card" autocomplete="on"><h1>${t("loginT")}</h1><p class="sub">${t("loginS")}</p>
        <label><span>${t("phone")}</span><input name="phone" inputmode="tel" autocomplete="tel" required placeholder="09xx xxx xxx"></label>
        <label><span>${t("pin")}</span><input name="pin" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="current-password" type="password" required></label>
        ${msg ? `<p class="err">${esc(msg)}</p>` : ""}
        <button class="btn main" type="submit">${t("login")}</button><p class="sub small">${t("noPin")}</p></form></div>`;
    bindLang();
    document.getElementById("lf").onsubmit = async e => {
      e.preventDefault(); if (busy) return; busy = true;
      const f = new FormData(e.target);
      try { const r = await rpc("staff_login", { phone: f.get("phone"), pin: String(f.get("pin") || "").trim() }); tok = r.token; store("ud-staff-token", tok); await load(); }
      catch (err) { drawLogin(errTx(err)); }
      busy = false;
    };
  }
  function bindLang() { $app.querySelectorAll("[data-lang]").forEach(b => b.onclick = () => { lang = b.dataset.lang; store("ud-staff-lang", lang); document.documentElement.lang = lang; D ? draw() : drawLogin(); }); }

  async function load(d1) {
    if (!tok) return drawLogin();
    try { D = await rpc("staff_me", { tok, d1: d1 || null }); draw(); }
    catch (e) { if (/log in/i.test(e && e.message || "")) { tok = null; store("ud-staff-token", null); D = null; drawLogin(errTx(e)); } else { toast(errTx(e)); if (!D) drawLogin(errTx(e)); } }
  }
  async function act(fn, args, okMsg) {
    if (busy) return false; busy = true;
    let ok = false;
    try { const r = await rpc(fn, Object.assign({ tok }, args || {})); if (r && r.me) D = r; if (okMsg) toast(okMsg); ok = true; }
    catch (e) { toast(errTx(e)); }
    busy = false; draw(); return ok;
  }

  const shLbl = (code, h) => code === "C" && h ? hrsTxt(h) : t("sh_" + code);
  function draw() {
    if (!D) return drawLogin();
    const me = D.me, ss = D.shop_state || {}, a = D.att, x = D.session;
    document.title = `${me.name} · Uncle Day`;
    const av = window.OwnerBoard ? `<span class="av" style="background-image:url(${window.OwnerBoard.avatar(me.look, 0)})"></span>` : "";
    const ssK = ss.is_open ? "shop_open" : ss.status === "dayoff" ? "shop_dayoff" : ss.status === "before" ? "shop_before" : "shop_after";
    const code = D.today_code, hrs = D.today_hours;
    const isIn = a && a.in_at && !a.out_at, isOut = a && a.out_at;
    let attTxt = !a || !a.in_at ? t("notIn") : `${t("inAt", { t: tm(a.in_at) })} · ${a.late_min > 0 ? `<span class="late">${t("late", { n: a.late_min })}</span>` : t("onTime")}${a.out_at ? " · " + t("outAt", { t: tm(a.out_at) }) : ""}`;
    const left = x ? Math.max(0, Math.round((Date.parse(x.ends_at) - Date.now()) / 60000)) : 0;
    // 근무표
    const days = Array.from({ length: 7 }, (_, i) => addD(D.from, wk * 7 + i));
    const mine = (D.rota || []).find(r => r.me) || { codes: [], hours: [] };
    const cell = (r, i) => { const c = r.codes[wk * 7 + i], h = r.hours[wk * 7 + i]; return { c, h }; };
    const dayBtns = days.map((ds, i) => { const { c, h } = cell(mine, i), past = ds < D.today, rq = (D.requests || []).find(q => q.day === ds && ["peer", "pending"].includes(q.status));
      return `<button class="day k-${c} ${ds === D.today ? "td" : ""}" data-day="${ds}" ${past ? "disabled" : ""}><small>${esc(dShort(ds))}</small><b>${esc(shLbl(c, h))}</b><i>${c === "O" ? "🌙" : esc(c === "C" ? "" : hrsTxt(h))}</i>${rq ? `<em>⏳</em>` : ""}</button>`; }).join("");
    const team = showTeam ? `<div class="tw"><table class="team"><thead><tr><th></th>${days.map(ds => `<th class="${ds === D.today ? "td" : ""}">${esc(dShort(ds))}</th>`).join("")}</tr></thead><tbody>${(D.rota || []).map(r => `<tr class="${r.me ? "me" : ""}"><th>${esc(r.name)}</th>${days.map((ds, i) => { const { c, h } = cell(r, i); return `<td><span class="k k-${c}">${esc(c === "C" ? hrsTxt(h) : t("sh_" + c))}</span></td>`; }).join("")}</tr>`).join("")}</tbody></table></div>` : "";
    const reqRow = q => { const ty = q.type === "off" ? t("ty_off") : q.type === "shift" ? t("ty_shift", { w: t("sh_" + q.want) }) : t("ty_swap", { m: esc(q.mate || "") });
      return `<div class="rq"><div><b>${esc(dShort(q.day))} · ${ty}</b>${q.reason ? `<small>${esc(q.reason)}</small>` : ""}</div><span class="st st-${q.status}">${t("st_" + q.status)}</span>${["peer", "pending"].includes(q.status) ? `<button class="btn line sm" data-cancel="${q.id}">${t("cancel")}</button>` : ""}</div>`; };
    const inc = (D.incoming || []).map(q => `<div class="rq in"><div><b>${t("inMsg", { n: esc(q.from), d: esc(dShort(q.day)), a: t("sh_" + q.my_code), b: t("sh_" + q.their_code) })}</b>${q.reason ? `<small>${esc(q.reason)}</small>` : ""}</div><div class="row"><button class="btn main sm" data-peer="${q.id}" data-ok="1">${t("accept")}</button><button class="btn line sm" data-peer="${q.id}" data-ok="0">${t("decline")}</button></div></div>`).join("");
    const B = D.bonus || {}, each = +D.bonus_each || 0;
    const rvs = (D.reviews || []).map(v => `<div class="rv"><b><span class="stars">${"★".repeat(v.stars)}${"☆".repeat(5 - v.stars)}</span> <small>${esc(v.customer || "")} · ${esc(dShort(String(v.created_at).slice(0, 10)))}</small></b>${v.body ? `<p>“${esc(v.body)}”</p>` : ""}<span class="bs bs-${v.bonus_status}">${t("b_" + v.bonus_status)}${v.bonus_amount ? " · " + vnd(v.bonus_amount) : ""}</span></div>`).join("");
    const C = D.consent || {};
    $app.innerHTML = `<header class="top">${av}<div class="who"><b>${esc(me.name)}</b><small>${esc(shopName(D.shop))}</small></div>${langBtns()}<button class="btn line sm" data-act="reload" aria-label="refresh">${t("refresh")}</button></header>
      <main class="grid">
        <section class="card today"><div class="h"><h2>${t("today")}</h2><span class="chip ${ss.is_open ? "ok" : ""}">${t(ssK)}${ss.open ? ` · ${esc(ss.open)}–${esc(ss.close)}` : ""}</span></div>
          <div class="shift k-${code}"><small>${t("myShift")}</small><b>${esc(shLbl(code, hrs))}</b>${code !== "O" && hrs ? `<span>${esc(hrsTxt(hrs))}</span>` : ""}</div>
          <p class="att">${attTxt}</p>
          ${!isIn ? `<button class="btn main big" data-clock="in" ${isOut ? "disabled" : ""}>${isOut ? t("doneDay") : t("clockIn")}</button>` : `<button class="btn line big" data-clock="out">${t("clockOut")}</button>`}
          ${x ? `<div class="sess"><b>🔴 ${t("inSess")}${x.station ? " · " + t("room", { n: esc(String(x.station).split("-")[0]) }) : ""}</b><span>${esc(x.guest || "")} · ${esc(x.course || "")}${x.n > 1 ? " · " + t("withN", { n: x.n }) : ""}</span><span class="left">${t("left", { n: left })}</span></div>` : ""}
          <div class="kp"><div><b>${t("times", { n: D.done_today || 0 })}</b><small>${t("doneToday")}</small></div><div><b>${t("times", { n: D.done_month || 0 })}</b><small>${t("doneMonth")}</small></div><div><b>${B.avg ? "★ " + B.avg : "—"}</b><small>${t("rvAvg")}</small></div></div>
        </section>
        <section class="card"><div class="h"><h2>${t("rota")}</h2><div class="seg"><button class="${wk === 0 ? "on" : ""}" data-wk="0">${t("thisWk")}</button><button class="${wk === 1 ? "on" : ""}" data-wk="1">${t("nextWk")}</button></div></div>
          <div class="days">${dayBtns}</div><p class="sub small">${t("tapDay")}</p>
          <button class="btn ghost sm" data-act="team">${showTeam ? "▲ " : "▼ "}${t("team")}</button>${team}
        </section>
        <section class="card"><div class="h"><h2>${t("reqs")}</h2></div>
          ${inc ? `<h3>${t("incoming")}</h3>${inc}` : ""}
          ${(D.requests || []).length ? (D.requests || []).map(reqRow).join("") : `<p class="sub">${t("noReq")}</p>`}
        </section>
        <section class="card"><div class="h"><h2>${t("rv")}</h2><button class="btn main sm" data-act="qr">📱 ${t("qr")}</button></div>
          <div class="kp"><div><b>${B.count || 0}</b><small>${t("rvCnt")}</small></div><div><b>${vnd(B.pending)}</b><small>${t("bPend")}</small></div><div><b>${vnd(B.paid)}</b><small>${t("bPaid")}</small></div></div>
          <p class="sub small">${each > 0 ? t("bEach", { v: vnd(each) }) : t("bEach0")}</p>
          ${qrOpen ? `<div class="qrbox"><div id="qr" class="qr"></div><p class="sub small">${t("qrHow")}</p><p class="sub small warn">${t("qrRule")}</p><button class="btn line sm" data-act="qr">${t("close")}</button></div>` : ""}
          ${rvs || `<p class="sub">${t("noRv")}</p>`}
        </section>
        <section class="card"><div class="h"><h2>${t("me")}</h2></div>
          <label class="tg"><input type="checkbox" data-cons="career" ${C.career ? "checked" : ""}><span><b>${t("career")}</b><small>${t("careerS")}</small></span></label>
          <label class="tg ${C.career ? "" : "dim"}"><input type="checkbox" data-cons="open" ${C.open ? "checked" : ""} ${C.career ? "" : "disabled"}><span><b>${t("open")}</b><small>🔒 ${t("openS")}</small></span></label>
          <button class="btn ghost sm" data-act="pin">${t("pinCh")}</button>
          ${pinOpen ? `<form id="pf" class="pinf"><label><span>${t("pinOld")}</span><input name="o" inputmode="numeric" maxlength="6" type="password" required></label><label><span>${t("pinNew")}</span><input name="n" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" type="password" required></label><button class="btn main sm" type="submit">${t("save")}</button></form>` : ""}
          <p class="sub small">${t("install")}</p>
          <button class="btn line sm" data-act="logout">${t("logout")}</button>
        </section>
      </main>
      ${req ? reqSheet() : ""}`;
    bindLang(); bind();
    if (qrOpen) drawQR();
  }
  function reqSheet() {
    const mates = (D.rota || []).filter(r => !r.me), idx = (D.rota[0] && D.rota[0].codes) ? Math.round((Date.parse(req.day) - Date.parse(D.from)) / 864e5) : -1;
    const mine = (D.rota || []).find(r => r.me), cur = mine && idx >= 0 ? mine.codes[idx] : null;
    return `<div class="ov" data-act="rqx"><div class="sheet" role="dialog" aria-modal="true"><div class="h"><h2>${t("reqT", { d: esc(dShort(req.day)) })}</h2><button class="btn line sm" data-act="rqx">${t("close")}</button></div>
      ${cur ? `<p class="sub">${t("myShift")}: <b>${esc(t("sh_" + cur))}</b></p>` : ""}
      <div class="seg wide">${["off", "shift", "swap"].map(k => `<button class="${req.type === k ? "on" : ""}" data-rt="${k}">${t({ off: "rOff", shift: "rShift", swap: "rSwap" }[k])}</button>`).join("")}</div>
      ${req.type === "shift" ? `<div class="pick"><span>${t("want")}</span>${["A", "B", "F"].filter(c => c !== cur).map(c => `<button class="chip ${req.want === c ? "on" : ""}" data-want="${c}">${t("sh_" + c)}</button>`).join("")}</div>` : ""}
      ${req.type === "swap" ? `<div class="pick"><span>${t("mate")}</span>${mates.map(m => `<button class="chip ${req.mate === m.id ? "on" : ""}" data-mate="${m.id}">${esc(m.name)} · ${esc(idx >= 0 ? t("sh_" + m.codes[idx]) : "")}</button>`).join("")}</div><p class="sub small">${t("swapHow")}</p>` : ""}
      <label class="fl"><span>${t("reason")}</span><input id="rqR" maxlength="200" value="${esc(req.reason || "")}"></label>
      ${req.type === "off" ? `<label class="tg"><input type="checkbox" id="rqM" ${req.must ? "checked" : ""}><span><b>${t("must")}</b></span></label>` : ""}
      <button class="btn main big" data-act="rqsend">${t("send")}</button></div></div>`;
  }
  function drawQR() {
    const el = document.getElementById("qr"); if (!el) return;
    const url = `${location.origin}/booking.html?tp=${encodeURIComponent(D.me.id)}`;
    const paint = () => { try { const q = window.qrcode(0, "M"); q.addData(url); q.make(); el.innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }) + `<small>${esc(url.replace(/^https?:\/\//, ""))}</small>`; } catch (e) { el.innerHTML = `<small>${esc(url)}</small>`; } };
    if (window.qrcode) return paint();
    el.innerHTML = "…";
    const s = document.createElement("script"); s.src = "vendor/qrcode.js"; s.onload = paint; s.onerror = () => { el.innerHTML = `<small>${esc(url)}</small>`; }; document.head.appendChild(s);
  }
  function bind() {
    $app.querySelectorAll("[data-clock]").forEach(b => b.onclick = () => act("staff_clock", { action: b.dataset.clock }));
    $app.querySelectorAll("[data-wk]").forEach(b => b.onclick = () => { wk = +b.dataset.wk; draw(); });
    $app.querySelectorAll("[data-day]").forEach(b => b.onclick = () => { req = { day: b.dataset.day, type: "off", want: null, mate: null, reason: "", must: false }; draw(); });
    $app.querySelectorAll("[data-cancel]").forEach(b => b.onclick = () => act("staff_request_cancel", { rid: +b.dataset.cancel }));
    $app.querySelectorAll("[data-peer]").forEach(b => b.onclick = () => act("staff_peer_answer", { rid: +b.dataset.peer, ok: b.dataset.ok === "1" }));
    $app.querySelectorAll("[data-rt]").forEach(b => b.onclick = () => { keepReason(); req.type = b.dataset.rt; draw(); });
    $app.querySelectorAll("[data-want]").forEach(b => b.onclick = () => { keepReason(); req.want = b.dataset.want; draw(); });
    $app.querySelectorAll("[data-mate]").forEach(b => b.onclick = () => { keepReason(); req.mate = b.dataset.mate; draw(); });
    $app.querySelectorAll("[data-cons]").forEach(b => b.onchange = () => {
      const C = D.consent || {}; let career = !!C.career, open = !!C.open;
      if (b.dataset.cons === "career") { career = b.checked; if (!career) open = false; } else { if (!career) { toast(t("openNeed")); b.checked = false; return; } open = b.checked; }
      act("staff_consent", { career, open_work: open }, t("saved"));
    });
    $app.querySelectorAll("[data-act]").forEach(b => b.onclick = async e => {
      const a = b.dataset.act;
      if (a === "rqx") { if (e.target !== b) return; req = null; draw(); return; }
      if (a === "reload") return load();
      if (a === "team") { showTeam = !showTeam; draw(); return; }
      if (a === "qr") { qrOpen = !qrOpen; draw(); return; }
      if (a === "pin") { pinOpen = !pinOpen; draw(); return; }
      if (a === "logout") { try { await rpc("staff_logout", { tok }); } catch (er) {} tok = null; D = null; store("ud-staff-token", null); drawLogin(); return; }
      if (a === "rqsend") {
        keepReason(); const m = document.getElementById("rqM");
        if (req.type === "shift" && !req.want) { toast(ERR["Choose a shift"][li()]); return; }
        if (req.type === "swap" && !req.mate) { toast(ERR["Choose a coworker"][li()]); return; }
        const p = { type: req.type, day: req.day, want: req.want, mate_id: req.mate, reason: req.reason, must: m ? m.checked : false };
        const r0 = req; req = null; if (!(await act("staff_request", { p }, t("sent")))) { req = r0; draw(); }
      }
    });
    const pf = document.getElementById("pf");
    if (pf) pf.onsubmit = async e => { e.preventDefault(); const f = new FormData(pf); if (busy) return; busy = true;
      try { await rpc("staff_pin_change", { tok, old_pin: String(f.get("o") || ""), new_pin: String(f.get("n") || "") }); pinOpen = false; toast(t("pinDone")); draw(); } catch (er) { toast(errTx(er)); }
      busy = false; };
  }
  function keepReason() { const r = document.getElementById("rqR"); if (r && req) req.reason = r.value; const m = document.getElementById("rqM"); if (m && req) req.must = m.checked; }
  document.addEventListener("keydown", e => { if (e.key === "Escape" && req) { req = null; draw(); } });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && D && !req && !busy) load(); });
  setInterval(() => { if (!document.hidden && D && !req && !busy && !pinOpen) load(); }, 60000);

  function boot() {
    document.documentElement.lang = lang;
    if (typeof supabase === "undefined" || typeof SUPA === "undefined") { $app.innerHTML = `<p class="boot">${t("tErr")}</p>`; return; }
    sb = supabase.createClient(SUPA.url, SUPA.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    tok ? load() : drawLogin();
  }
  boot();
})();

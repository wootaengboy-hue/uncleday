/* 엉클데이 사장님 페이지 체험판 (입점 영업용)
 * - 진짜 현황판(owner-board.js)을 그대로 쓰고, 서버 대신 이 파일 안의 가짜 데이터로 돌아가요.
 * - 아무것도 저장하지 않아요. 새로고침하면 처음부터 다시 시작해요.
 */
(function () {
  "use strict";
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const LANGS = ["vi", "ko", "en"];
  let lang = (() => { try { const q = new URLSearchParams(location.search).get("lang"); if (LANGS.includes(q)) return q; } catch (e) {} return "vi"; })();
  const li = () => LANGS.indexOf(lang);
  const won = n => Math.round(n || 0).toLocaleString("vi-VN") + "₫";
  const RATE = 15; // 예시 수수료율 (%)

  /* ---------- 글자 (베트남어 · 한국어 · 영어) ---------- */
  const T = {
    title: ["Trang chủ cửa hàng · Bản dùng thử", "사장님 페이지 · 체험판", "Shop owner page · Demo"],
    demoTag: ["DEMO", "체험판", "DEMO"],
    restart: ["↺ Làm lại", "↺ 처음부터", "↺ Restart"],
    tBook: ["📩 Đặt lịch", "📩 예약", "📩 Bookings"], tBoard: ["🗺️ Bảng điều hành", "🗺️ 현황판", "🗺️ Live board"], tSettle: ["💰 Đối soát", "💰 정산", "💰 Settlement"],
    prev: ["‹ Trước", "‹ 이전", "‹ Back"], next: ["Tiếp ›", "다음 ›", "Next ›"], done: ["Xong ✓", "끝 ✓", "Done ✓"],
    stepOf: ["Bước {a}/{b}", "{a}/{b} 단계", "Step {a}/{b}"],
    doThis: ["👉 Hãy thử:", "👉 해 보세요:", "👉 Try it:"],
    ok: ["✓ Đã xong bước này", "✓ 이 단계 완료", "✓ Step complete"],
    toastDemo: ["Bản demo: tính năng này có trong trang thật", "체험판이라 실제 페이지에서만 돼요", "Demo: available on the real page"],
    newReq: ["Yêu cầu đặt lịch mới", "새 예약 요청", "New booking request"],
    accept: ["Nhận", "수락", "Accept"], decline: ["Từ chối", "거절", "Decline"],
    accepted: ["Đã nhận", "수락함", "Accepted"], declined: ["Đã từ chối", "거절함", "Declined"],
    people: ["{n} người", "{n}명", "{n} people"], today: ["Hôm nay", "오늘", "Today"],
    priceT: ["Giá niêm yết", "매장 가격", "Shop price"],
    noContact: ["🔒 Số điện thoại, Kakao của khách do Uncle Day giữ. Cửa hàng không cần gọi khách — Uncle Day nhắc lịch và phiên dịch bằng tiếng Hàn.", "🔒 손님 전화번호 · 카카오톡은 엉클데이가 관리해요. 매장은 손님에게 연락할 필요가 없어요. 일정 안내와 한국어 통역은 엉클데이가 해요.", "🔒 Uncle Day keeps the guest's phone and Kakao. The shop never needs to call — Uncle Day sends reminders and translates in Korean."],
    acceptToast: ["Đã nhận đặt lịch. Khách sẽ hiện ở Bảng điều hành hôm nay.", "예약을 수락했어요. 오늘 현황판에 손님이 나타나요.", "Accepted. The guest now appears on today's board."],
    sMonth: ["Tháng này", "이번 달", "This month"],
    sUdRev: ["Doanh thu từ khách Uncle Day", "엉클데이 손님 매출", "Revenue from Uncle Day guests"],
    sFee: ["Hoa hồng Uncle Day (ví dụ {r}%)", "엉클데이 수수료 (예시 {r}%)", "Uncle Day commission (e.g. {r}%)"],
    sWalk: ["Khách vãng lai (không tính hoa hồng)", "워크인 손님 (수수료 없음)", "Walk-in guests (no commission)"],
    sKeep: ["Cửa hàng giữ lại", "매장 몫", "Shop keeps"],
    sList: ["Lượt khách Uncle Day đã đến", "방문 완료된 엉클데이 예약", "Uncle Day visits"],
    sCols: [["Ngày", "Mã", "Khách", "Thanh toán", "Hoa hồng"], ["날짜", "예약번호", "손님", "결제", "수수료"], ["Date", "Code", "Guest", "Paid", "Fee"]],
    sNew: ["mới", "방금", "new"],
    sHow: ["📅 Ngày 5 tháng sau: Uncle Day gửi bảng đối soát · 7 ngày để kiểm tra · chuyển hoa hồng trước ngày 10.", "📅 다음 달 5일: 엉클데이가 정산서를 보내요 · 7일 동안 확인 · 10일까지 수수료 송금.", "📅 By the 5th: Uncle Day sends the statement · 7 days to check · pay the fee by the 10th."],
    sNoShow: ["Khách không đến, hủy lịch → không tính hoa hồng.", "노쇼 · 취소는 수수료가 없어요.", "No-shows and cancellations → no commission."],
    endT: ["Cửa hàng còn có thể…", "이 밖에도 이런 걸 할 수 있어요", "The shop can also…"],
    cta: ["Đăng ký miễn phí với nhân viên Uncle Day", "엉클데이 담당자에게 무료로 입점 신청하세요", "Sign up free with your Uncle Day contact"],
  };
  const t = (k, v) => { let s = (T[k] || [k])[li()] || T[k][0]; if (v) for (const x in v) s = s.split("{" + x + "}").join(v[x]); return s; };

  /* ---------- 안내 단계 ---------- */
  const STEPS = [
    { tab: null, key: "intro",
      h: ["Uncle Day hoạt động thế nào?", "엉클데이는 이렇게 운영돼요", "How Uncle Day works"],
      p: ["Du khách Hàn Quốc tìm spa, massage trên uncleday.com và đặt lịch bằng tiếng Hàn. Uncle Day chuyển lịch cho cửa hàng. Cửa hàng chỉ cần đón khách.", "한국인 여행객이 uncleday.com에서 한국어로 매장을 찾고 예약해요. 엉클데이가 그 예약을 매장에 넘겨 드려요. 매장은 손님을 맞이하기만 하면 돼요.", "Korean travelers find spas on uncleday.com and book in Korean. Uncle Day passes the booking to the shop. The shop just welcomes the guest."],
      flow: true },
    { tab: "book", key: "accept",
      h: ["① Có khách đặt lịch → bấm Nhận", "① 예약이 들어오면 → 수락", "① A booking arrives → Accept"],
      p: ["Điện thoại báo có yêu cầu mới. Xem giờ, số người, dịch vụ rồi bấm Nhận hoặc Từ chối. Chỉ mất vài giây.", "휴대폰으로 새 예약 알림이 와요. 시간 · 인원 · 코스를 보고 수락이나 거절을 누르면 끝이에요.", "Your phone gets a notification. Check time, people and service, then Accept or Decline. Takes seconds."],
      act: ["Bấm Nhận ở yêu cầu của Kim Minji", "김민지 님 예약에서 '수락'을 눌러 보세요", "Press Accept on Kim Minji's booking"] },
    { tab: "board", key: "checkin",
      h: ["② Khách đến → bấm Đã đến", "② 손님이 오면 → 도착", "② Guest arrives → Arrived"],
      p: ["Lịch đã nhận hiện ở 'Khách Uncle Day hôm nay' (nhãn UD). Khách đến thì bấm Đã đến: khách vào ghế chờ trên bản đồ cửa hàng.", "수락한 예약은 '오늘 올 엉클데이 손님'에 UD 표시로 보여요. 손님이 오면 '도착'을 눌러요. 지도에서 손님이 대기석에 앉아요.", "Accepted bookings show under 'Uncle Day guests today' with a UD tag. Press Arrived and the guest sits in the lobby."],
      act: ["Bấm Đã đến cho Kim Minji (2 người)", "김민지 님(2명) 옆 '도착'을 눌러 보세요", "Press Arrived for Kim Minji (2 people)"] },
    { tab: "board", key: "assign",
      h: ["③ Xếp giường và KTV cho từng người", "③ 한 명씩 베드와 테라피스트 배정", "③ Assign a bed and therapist to each person"],
      p: ["Nhóm 2 người được xếp riêng từng người. Chọn KTV (tối đa 4 người cho 1 khách) và giường rồi bấm Bắt đầu. Nhân viên trên bản đồ sẽ đi vào phòng.", "2명 팀은 한 명씩 따로 배정해요. 테라피스트(손님 1명에 최대 4명)와 베드를 고르고 시작을 눌러요. 지도에서 직원이 방으로 걸어가요.", "A group of 2 is assigned one by one. Pick therapists (up to 4 per guest) and a bed, then Start. Staff walk into the room on the map."],
      act: ["Bấm Xếp → chọn KTV → Bắt đầu, làm cho cả 2 khách", "배정 → 테라피스트 선택 → 시작, 두 분 모두 해 보세요", "Assign → pick a therapist → Start, for both guests"] },
    { tab: "board", key: "finish",
      h: ["④ Xong → số tiền tự điền", "④ 끝나면 → 금액이 자동으로", "④ Finish → amount is pre-filled"],
      p: ["Bấm Xong, số tiền theo giá dịch vụ đã điền sẵn. Khi cả nhóm xong, lịch Uncle Day tự chuyển sang 'Đã đến' — không cần gửi ảnh hóa đơn.", "'끝내기'를 누르면 코스 금액이 미리 채워져 있어요. 팀이 모두 끝나면 엉클데이 예약이 자동으로 '방문 완료'가 돼요. 영수증 사진을 따로 보낼 필요가 없어요.", "Press Finish; the price is pre-filled. When the whole group is done, the Uncle Day booking is marked visited automatically — no receipt photos needed."],
      act: ["Bấm Xong → Xác nhận cho cả 2 khách", "두 분 모두 '끝내기' → 확인을 눌러 보세요", "Press Finish → Confirm for both guests"] },
    { tab: "board", key: "walkin",
      h: ["⑤ Khách vãng lai cũng quản lý được", "⑤ 워크인 손님도 같이 관리", "⑤ Walk-in guests too"],
      p: ["Khách tự đến (không qua Uncle Day) nhập ở 'Tiếp nhận khách'. Dùng chung bảng, chung nhân viên — nhưng KHÔNG tính hoa hồng.", "엉클데이를 거치지 않고 직접 온 손님은 '손님 접수'에 넣어요. 같은 현황판 · 같은 직원으로 관리하지만 수수료는 없어요.", "Guests who walk in directly go in 'Add a guest'. Same board, same staff — but NO commission."],
      act: ["Nhập tên bất kỳ → Tiếp nhận", "아무 이름이나 넣고 '접수'를 눌러 보세요", "Type any name → Add"] },
    { tab: "settle", key: "settle",
      h: ["⑥ Cuối tháng: đối soát rõ ràng", "⑥ 월말: 투명한 정산", "⑥ Month end: clear settlement"],
      p: ["Chỉ những lượt khách Uncle Day đã đến và thanh toán mới tính hoa hồng. Mọi con số tự cộng từ bảng điều hành.", "방문해서 결제한 엉클데이 손님만 수수료가 붙어요. 숫자는 현황판에서 자동으로 모여요.", "Only Uncle Day guests who visited and paid are charged. All numbers come from the board automatically."] },
    { tab: null, key: "end",
      h: ["Miễn phí đăng ký · chỉ trả khi có khách", "입점 무료 · 손님이 와야만 수수료", "Free to join · pay only when guests come"],
      p: ["", "", ""], more: true },
  ];
  const MORE = [
    ["🕘", ["Chấm công: nhân viên bấm vào/ra ca bằng điện thoại", "출퇴근: 직원이 휴대폰으로 출근 · 퇴근", "Attendance: staff clock in/out on their phone"]],
    ["📅", ["Lịch làm việc theo tuần, ca sáng/ca tối, đổi ca", "주간 근무표 · 오픈조 · 마감조 · 근무 교환", "Weekly rota, morning/evening shifts, shift swaps"]],
    ["⭐", ["Khách Hàn đánh giá từng KTV · thưởng cho đánh giá thật", "손님이 테라피스트별 후기 · 진짜 후기마다 보너스", "Guests review each therapist · bonus per verified review"]],
    ["🇻🇳🇰🇷", ["Trang cửa hàng bằng tiếng Hàn làm miễn phí, cửa hàng dùng tiếng Việt", "한국어 매장 페이지 무료 제작 · 사장님 화면은 베트남어", "Free Korean shop page · owner screens in Vietnamese"]],
    ["🎟️", ["Coupon do Uncle Day chịu chi phí", "엉클데이 쿠폰 할인은 엉클데이가 부담", "Uncle Day pays for its coupons"]],
    ["🔒", ["Không lộ thông tin khách · không phí cố định hàng tháng", "손님 개인정보 보호 · 월 고정비 없음", "Guest privacy · no monthly fixed fee"]],
  ];

  /* ---------- 가짜 서버 (메모리) ---------- */
  const uid = () => "d" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const vnNow = () => new Date(Date.now() + 7 * 3600e3);
  const vnToday = () => vnNow().toISOString().slice(0, 10);
  const vnMin = () => { const d = vnNow(); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
  const hm = m => String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  const iso = ms => new Date(ms).toISOString();
  const COURSES = [
    { id: "c1", vi: "Massage body Thái", ko: "타이 전신 마사지", min: 60, price: 350000, type: "any", eq: "" },
    { id: "c2", vi: "Massage đá nóng", ko: "핫스톤 마사지", min: 90, price: 500000, type: "any", eq: "" },
    { id: "c3", vi: "Gội đầu dưỡng sinh", ko: "헤드스파", min: 60, price: 250000, type: "any", eq: "" },
  ];
  const LOOK = (hair, c) => ({ hair, hc: c % 5, top: "uniform", tc: c, bottom: "pants", bc: 0 });
  let S;
  function reset() {
    const now = Date.now(), m = vnMin();
    const mk = (id, name, role, look, inAgo) => ({ id, name, role, years: 2, look, def_code: "A", off_day: -1, def_start: null, def_end: null, code: "A", hours: [600, 1320],
      in_at: inAgo == null ? null : iso(now - inAgo * 60e3), out_at: null, late_min: 0, in_via: inAgo == null ? null : "phone", app: true, has_phone: true, stars: 4.8, reviews: 12, done_today: 0, rev_today: 0 });
    S = {
      open: true,
      staff: [mk("s1", "Linh", "tp", LOOK("long", 0), 180), mk("s2", "Mai", "tp", LOOK("pony", 1), 170), mk("s3", "Hạnh", "tp", LOOK("bun", 2), 160), mk("s4", "Thảo", "tp", LOOK("short", 3), null), mk("s5", "Trang", "rcp", LOOK("bun", 4), 200)],
      guests: [], sessions: [],
      bookings: [
        { id: "b1", code: "UD-7K3P", name: "Kim Minji", menu_name: "Massage đá nóng 90′", menu_ko: "핫스톤 마사지 90분", min: 90, people: 2, price: 1000000, time: hm(Math.min(22 * 60, Math.ceil((m + 20) / 10) * 10)), status: "requested", req: true },
        { id: "b2", code: "UD-2M8Q", name: "Park Jisoo", menu_name: "Massage body Thái 60′", menu_ko: "타이 전신 마사지 60분", min: 60, people: 1, price: 350000, time: hm(Math.min(22 * 60, Math.ceil((m + 90) / 10) * 10)), status: "confirmed" },
      ],
      past: [ // 이번 달 이미 방문 완료된 엉클데이 손님 (예시)
        { d: -9, code: "UD-4H2A", name: "Lee Sora", paid: 700000 }, { d: -7, code: "UD-9P1C", name: "Choi Yuna", paid: 350000 },
        { d: -5, code: "UD-3T6E", name: "Jung Hoon", paid: 1500000 }, { d: -3, code: "UD-8B5F", name: "Han Jiwoo", paid: 500000 }, { d: -1, code: "UD-6R7G", name: "Oh Seojin", paid: 750000 },
      ],
      walkPast: 4200000,
      items: [{ k: "plant", fl: 1, id: "i1", rx: 0.1, ry: 0.42 }, { k: "flower", fl: 1, id: "i2", rx: 0.4, ry: 0.42 }, { k: "cat", fl: 1, id: "i3", rx: 0.27, ry: 0.62 }, { k: "lantern", fl: 1, id: "i4", rx: 0.93, ry: 0.36 }],
      done: {},
    };
  }
  const layout = () => ({ kind: "massage", items: S.items, floors: [
      { rooms: [{ n: "201", type: "bed", count: 2, eq: [] }, { n: "202", type: "bed", count: 1, eq: [] }] },
      { rooms: [{ n: "301", type: "bed", count: 2, eq: [] }] }],
    shifts: { A: [600, 1320] }, min_am: 2, min_pm: 2, courses: COURSES });
  const stations = () => ["201-1", "201-2", "202-1", "301-1", "301-2"];
  const taken = gid => [...new Set(S.sessions.filter(x => x.guest_id === gid && (x.status === "working" || x.status === "done")).map(x => x.pno))].sort();
  function boardGet() {
    const d = vnToday();
    const st = S.staff.map(s => {
      const mine = S.sessions.filter(x => x.staff_id === s.id && x.status === "done");
      return Object.assign({}, s, { done_today: mine.length, rev_today: mine.reduce((a, x) => a + (x.paid || 0), 0) });
    });
    return JSON.parse(JSON.stringify({
      today: d, now: new Date().toISOString(), now_min: vnMin(), role: "owner",
      shop: { id: "demo", name: { vi: "Spa Mẫu", ko: "예시 스파", en: "Sample Spa" } },
      shop_state: { open: "10:00", close: "22:00", dayoff: false, status: S.open ? (S.openedAt ? "open_manual" : "open_auto") : "closed_manual", is_open: S.open, opened_at: S.openedAt || null, closed_at: S.closedAt || null },
      layout: layout(), staff: st,
      guests: S.guests.filter(g => g.status === "waiting" || g.status === "in_session").map(g => Object.assign({}, g, { taken: taken(g.id) })),
      expected: S.bookings.filter(b => b.status === "confirmed" && !S.guests.some(g => g.booking_id === b.id)).map(b => ({ id: b.id, code: b.code, name: b.name, menu_name: lang === "ko" ? b.menu_ko : b.menu_name, min: b.min, people: b.people, price: b.price, time: b.time, status: b.status })),
      sessions: S.sessions.filter(x => x.status !== "cancelled").map(x => { const g = S.guests.find(y => y.id === x.guest_id); return Object.assign({}, x, { guest_name: g ? g.name : "", people: g ? g.people : 1, ud: !!x.booking_id }); }).sort((a, b) => b.started_at.localeCompare(a.started_at)),
      pending_req: 0,
    }));
  }
  const err = m => { const e = new Error(m); e.message = m; return e; };
  function closeGuest(gid) {
    const g = S.guests.find(x => x.id === gid);
    if (!g || !["waiting", "in_session"].includes(g.status)) return;
    if (S.sessions.some(x => x.guest_id === gid && x.status === "working")) return;
    if (taken(gid).length < g.people) return;
    g.status = "done";
    const b = g.booking_id && S.bookings.find(x => x.id === g.booking_id);
    if (b) { b.status = "visited"; b.paid = S.sessions.filter(x => x.guest_id === gid && x.status === "done").reduce((a, x) => a + (x.paid || 0), 0); b.at = Date.now(); mark("finish"); }
  }
  const API = {
    board_get: () => boardGet(),
    game_get: () => { throw err("demo"); },
    board_items_save: a => { S.items = a.items; return true; },
    shop_open: a => { S.open = a.action === "open"; if (S.open) S.openedAt = new Date().toISOString(); else S.closedAt = new Date().toISOString(); return boardGet(); },
    staff_attend: a => { const s = S.staff.find(x => x.id === a.sid); if (!s) throw err("Staff not found"); if (a.action === "in") { s.in_at = new Date().toISOString(); s.out_at = null; s.in_via = "board"; } else s.out_at = new Date().toISOString(); return boardGet(); },
    guest_add: a => { if (!String(a.nm || "").trim()) throw err("Please enter a name"); S.guests.push({ id: uid(), name: String(a.nm).trim().slice(0, 40), course: a.course, people: Math.max(1, a.people || 1), status: "waiting", source: "walkin", booking_id: null, created_at: new Date().toISOString() }); mark("walkin"); return boardGet(); },
    guest_checkin: a => { const b = S.bookings.find(x => x.id === a.bid); if (!b) throw err("Booking not found"); if (!S.guests.some(g => g.booking_id === b.id)) S.guests.push({ id: uid(), name: b.name, course: { vi: b.menu_name, ko: b.menu_ko, min: b.min, price: b.price, type: "any", eq: "" }, people: b.people, status: "waiting", source: "ud", booking_id: b.id, created_at: new Date().toISOString() }); if (b.id === "b1") mark("checkin"); return boardGet(); },
    guest_leave: a => { const g = S.guests.find(x => x.id === a.gid && x.status === "waiting"); if (g) { const n = taken(g.id).length; if (!n) g.status = "left"; else { g.people = n; if (S.sessions.some(x => x.guest_id === g.id && x.status === "working")) g.status = "in_session"; closeGuest(g.id); } } return boardGet(); },
    session_begin: a => {
      const g = S.guests.find(x => x.id === a.gid); if (!g || g.status !== "waiting") throw err("This guest is not waiting");
      const tk = taken(g.id); let p = a.pno;
      if (!p) { for (let i = 1; i <= g.people; i++) if (!tk.includes(i)) { p = i; break; } if (!p) throw err("Everyone is assigned"); }
      else if (tk.includes(p)) throw err("This guest is already assigned");
      const ids = [...new Set(a.tps || [])]; if (!ids.length) throw err("Choose a therapist"); if (ids.length > 4) throw err("Up to 4 therapists");
      if (S.sessions.some(x => ids.includes(x.staff_id) && x.status === "working")) throw err("This therapist is busy");
      if (!stations().includes(a.stn)) throw err("Unknown bed");
      if (S.sessions.some(x => x.station === a.stn && x.status === "working")) throw err("This bed is in use");
      const m = Math.max(5, g.course.min || 60), total = g.source === "ud" ? (g.course.price || 0) : (g.course.price || 0) * g.people;
      const per = Math.floor(total / g.people), mine = p === 1 ? total - per * (g.people - 1) : per, each = Math.floor(mine / ids.length), grp = uid(), now = Date.now();
      ids.forEach((sid, k) => { const s = S.staff.find(x => x.id === sid);
        S.sessions.push({ id: k ? uid() : grp, grp, pno: p, guest_id: g.id, booking_id: g.booking_id, staff_id: sid, staff_name: s.name, station: a.stn, course_name: g.course[lang === "ko" ? "ko" : "vi"] || g.course.vi, minutes: m, price: k ? each : mine - each * (ids.length - 1), paid: null, status: "working", started_at: iso(now), ends_at: iso(now + m * 60e3), done_at: null }); });
      if (taken(g.id).length >= g.people) g.status = "in_session";
      if (g.booking_id === "b1" && taken(g.id).length >= g.people) mark("assign");
      return boardGet();
    },
    session_finish: a => {
      const x = S.sessions.find(y => y.id === a.xid && y.status === "working"); if (!x) throw err("Session not found");
      const ms = S.sessions.filter(y => y.grp === x.grp && y.status === "working"), amt = a.paid == null ? ms.reduce((s, y) => s + y.price, 0) : a.paid, each = Math.floor(amt / ms.length);
      ms.sort((p, q) => (q.id === q.grp) - (p.id === p.grp)).forEach((y, k) => { y.status = "done"; y.paid = k ? each : amt - each * (ms.length - 1); y.done_at = new Date().toISOString(); });
      closeGuest(x.guest_id); return boardGet();
    },
    session_cancel: a => { const x = S.sessions.find(y => y.id === a.xid && y.status === "working"); if (x) { S.sessions.filter(y => y.grp === x.grp && y.status === "working").forEach(y => { y.status = "cancelled"; }); const g = S.guests.find(y => y.id === x.guest_id); if (g && g.status === "in_session") g.status = "waiting"; } return boardGet(); },
    session_extend: a => { const x = S.sessions.find(y => y.id === a.xid && y.status === "working"); if (x) S.sessions.filter(y => y.grp === x.grp && y.status === "working").forEach(y => { y.minutes += a.mins || 15; y.ends_at = iso(Date.parse(y.ends_at) + (a.mins || 15) * 60e3); }); return boardGet(); },
  };
  async function rpc(fn, args) {
    await new Promise(r => setTimeout(r, 120));
    if (!API[fn]) throw err(t("toastDemo"));
    return API[fn](args || {});
  }

  /* ---------- 화면 ---------- */
  let step = 0, tab = "board", toastT, gMin = false;
  function toast(m) { const el = $("#dmToast"); el.textContent = m; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2600); }
  function mark(k) { if (S.done[k]) return; S.done[k] = true; const i = STEPS.findIndex(s => s.key === k); if (i === step) setTimeout(renderGuide, 50); }
  function setTab(k) {
    if (k === tab && $("#dmMain").dataset.tab === k) return;
    tab = k; $("#dmMain").dataset.tab = k;
    document.querySelectorAll("[data-tab]").forEach(b => b.classList.toggle("on", b.dataset.tab === k));
    if (window.OwnerBoard) window.OwnerBoard.unmount();
    const m = $("#dmMain");
    if (k === "board") { m.innerHTML = '<div id="dmBoard"></div>'; window.OwnerBoard.mount($("#dmBoard"), { view: "board", rpc, shopId: "demo", lang, isOwner: false, toast, errMsg: e => (e && e.message) || String(e), onPending: () => {} }); }
    else if (k === "book") renderBook();
    else renderSettle();
  }
  function renderBook() {
    const m = $("#dmMain"); if (tab !== "book") return;
    const bs = S.bookings;
    m.innerHTML = `<div class="dm-pane">${bs.map(b => {
      const st = b.status === "requested" ? "req" : b.status === "declined" ? "no" : "ok";
      return `<div class="dm-bk ${st}">${b.req && b.status === "requested" ? `<div class="dm-new">🔔 ${t("newReq")}</div>` : ""}
        <div class="dm-bk-h"><b>${esc(b.name)}</b><span class="dm-ud">UD</span><span class="dm-code">${esc(b.code)}</span></div>
        <div class="dm-bk-g"><span>🕒 ${t("today")} ${esc(b.time)}</span><span>👥 ${t("people", { n: b.people })}</span><span>💆 ${esc(lang === "ko" ? b.menu_ko : b.menu_name)}</span><span>💵 ${won(b.price)}</span></div>
        ${b.status === "requested" ? `<div class="dm-bk-b"><button class="dm-btn l" data-dec="${b.id}">${t("decline")}</button><button class="dm-btn pulse" data-acc="${b.id}">${t("accept")}</button></div>`
          : `<div class="dm-st ${st}">${b.status === "declined" ? t("declined") : b.status === "visited" ? "✓ " + ["Đã đến", "방문 완료", "Visited"][li()] : "✓ " + t("accepted")}</div>`}</div>`;
    }).join("")}<p class="dm-note">${t("noContact")}</p></div>`;
  }
  function renderSettle() {
    const m = $("#dmMain"); if (tab !== "settle") return;
    const today = vnNow(), rows = S.past.map(r => { const d = new Date(today.getTime() + r.d * 864e5); return { day: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`, code: r.code, name: r.name, paid: r.paid }; });
    S.bookings.filter(b => b.status === "visited").forEach(b => rows.push({ day: `${today.getUTCDate()}/${today.getUTCMonth() + 1}`, code: b.code, name: b.name, paid: b.paid, isNew: true }));
    const walk = S.walkPast + S.sessions.filter(x => x.status === "done" && !x.booking_id).reduce((a, x) => a + (x.paid || 0), 0);
    const ud = rows.reduce((a, r) => a + r.paid, 0), fee = Math.round(ud * RATE / 100);
    m.innerHTML = `<div class="dm-pane">
      <div class="dm-sum"><div><small>${t("sUdRev")}</small><b>${won(ud)}</b></div><div class="fee"><small>${t("sFee", { r: RATE })}</small><b>${won(fee)}</b></div>
        <div class="walk"><small>${t("sWalk")}</small><b>${won(walk)}</b></div><div class="keep"><small>${t("sKeep")}</small><b>${won(ud - fee + walk)}</b></div></div>
      <h3 class="dm-h">${t("sList")} · ${t("sMonth")}</h3>
      <div class="dm-tbl"><table><thead><tr>${(T.sCols[li()]).map((c, i) => `<th${i >= 3 ? ' class="r"' : ""}>${c}</th>`).join("")}</tr></thead><tbody>
      ${rows.slice().reverse().map(r => `<tr class="${r.isNew ? "new" : ""}"><td>${r.day}</td><td>${esc(r.code)}</td><td>${esc(r.name)}${r.isNew ? ` <span class="dm-tagn">${t("sNew")}</span>` : ""}</td><td class="r">${won(r.paid)}</td><td class="r">${won(Math.round(r.paid * RATE / 100))}</td></tr>`).join("")}
      </tbody></table></div>
      <p class="dm-note">${t("sHow")}<br>${t("sNoShow")}</p></div>`;
  }
  function renderGuide() {
    const s = STEPS[step], n = STEPS.length, g = $("#dmGuide");
    const done = s.key && S.done[s.key]; g.classList.toggle("min", gMin);
    g.innerHTML = `<div class="dm-g-top"><span class="dm-stepn">${t("stepOf", { a: step + 1, b: n })}</span><button class="dm-min" data-min>${gMin ? "▲" : "▼"} ${gMin ? ["Xem thêm", "펼치기", "More"][li()] : ["Thu gọn", "접기", "Less"][li()]}</button><div class="dm-dots">${STEPS.map((_, i) => `<i class="${i === step ? "on" : i < step ? "past" : ""}" data-go="${i}"></i>`).join("")}</div></div>
      <h2>${esc(s.h[li()])}</h2>${s.p[li()] ? `<p>${esc(s.p[li()])}</p>` : ""}
      ${s.flow ? `<div class="dm-flow"><div><span class="ic">🇰🇷</span><b>${["Khách Hàn", "한국인 손님", "Korean guest"][li()]}</b><small>${["đặt bằng tiếng Hàn", "한국어로 예약", "books in Korean"][li()]}</small></div><i>→</i><div class="ud"><span class="ic">🧡</span><b>Uncle Day</b><small>${["tư vấn · nhắc lịch", "상담 · 알림", "support · reminders"][li()]}</small></div><i>→</i><div><span class="ic">💆</span><b>${["Cửa hàng", "매장", "Your shop"][li()]}</b><small>${["đón khách", "손님 맞이", "welcomes guest"][li()]}</small></div></div>
        <div class="dm-pill">💡 ${["Không phí đăng ký · không phí tháng · chỉ trả hoa hồng khi khách đến và thanh toán", "입점비 · 월 고정비 없음 · 손님이 와서 결제했을 때만 수수료", "No sign-up or monthly fee · commission only when guests visit and pay"][li()]}</div>` : ""}
      ${s.more ? `<h3 class="dm-h">${t("endT")}</h3><ul class="dm-more">${MORE.map(([ic, x]) => `<li><span class="ic">${ic}</span><span>${esc(x[li()])}</span></li>`).join("")}</ul><div class="dm-pill">🤝 ${t("cta")}</div>` : ""}
      ${s.act ? `<div class="dm-act ${done ? "ok" : ""}">${done ? t("ok") : `<b>${t("doThis")}</b> ${esc(s.act[li()])}`}</div>` : ""}
      <div class="dm-nav"><button class="dm-btn l" data-step="-1" ${step ? "" : "disabled"}>${t("prev")}</button><button class="dm-btn ${!s.act || done ? "pulse" : ""}" data-step="1">${step === n - 1 ? t("restart") : t("next")}</button></div>`;
  }
  function goStep(i) {
    if (i >= STEPS.length) { reset(); i = 0; }
    step = Math.max(0, i); const s = STEPS[step];
    // 앞 단계를 건너뛰어도 흐름이 이어지게: 예약은 자동으로 수락
    if (step >= 2) { const b = S.bookings.find(x => x.id === "b1"); if (b.status === "requested") { b.status = "confirmed"; S.done.accept = true; } }
    if (s.tab) setTab(s.tab); else if (!$("#dmMain").dataset.tab) setTab("board");
    renderGuide();
    if (innerWidth < 900) { $("#dmGuide").scrollTop = 0; const a = $(".dm-app"); if (a) window.scrollTo({ top: Math.max(0, a.getBoundingClientRect().top + scrollY - 64), behavior: "smooth" }); }
  }
  function shell() {
    document.documentElement.lang = lang;
    document.title = "Uncle Day · " + t("title");
    $("#dm").innerHTML = `<header class="dm-hdr"><img src="images/owner-180.png" alt=""><div class="dm-t"><b>${t("title")}</b><small>Spa Mẫu · <span class="dm-demo">${t("demoTag")}</span></small></div>
      <div class="dm-langs">${LANGS.map(k => `<button class="${k === lang ? "on" : ""}" data-lang="${k}">${k.toUpperCase()}</button>`).join("")}</div></header>
      <div class="dm-wrap"><aside class="dm-guide" id="dmGuide"></aside>
        <section class="dm-app"><nav class="dm-tabs">${[["book", "tBook"], ["board", "tBoard"], ["settle", "tSettle"]].map(([k, l]) => `<button data-tab="${k}">${t(l)}</button>`).join("")}<button class="dm-rs" data-reset>${t("restart")}</button></nav>
          <div id="dmMain" data-tab=""></div></section></div>
      <div class="dm-toast" id="dmToast" hidden></div>`;
    const cur = tab; tab = null; $("#dmMain").dataset.tab = ""; setTab(STEPS[step].tab || cur || "board"); renderGuide();
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("button, [data-go]"); if (!b) return;
    if (b.dataset.lang) { lang = b.dataset.lang; try { history.replaceState(null, "", "?lang=" + lang); } catch (x) {} shell(); return; }
    if (b.hasAttribute("data-min")) { gMin = !gMin; renderGuide(); return; }
    if (b.dataset.tab) { setTab(b.dataset.tab); return; }
    if (b.dataset.go != null) { goStep(+b.dataset.go); return; }
    if (b.dataset.step) { goStep(step + +b.dataset.step); return; }
    if (b.hasAttribute("data-reset")) { reset(); step = 0; tab = null; $("#dmMain").dataset.tab = ""; goStep(0); return; }
    if (b.dataset.acc) { const x = S.bookings.find(y => y.id === b.dataset.acc); x.status = "confirmed"; toast(t("acceptToast")); renderBook(); mark("accept"); return; }
    if (b.dataset.dec) { toast(["Bản demo: hãy bấm Nhận để xem tiếp", "체험판에서는 '수락'을 눌러 다음으로 가 보세요", "Demo: press Accept to continue"][li()]); return; }
  });
  reset();
  shell();
})();

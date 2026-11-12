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
    title: ["Mô phỏng vận hành Uncle Day", "엉클데이 운영 시뮬레이션", "Uncle Day simulation"],
    demoTag: ["DEMO", "체험판", "DEMO"],
    restart: ["↺ Làm lại", "↺ 처음부터", "↺ Restart"],
    tCust: ["📱 Khách đặt", "📱 손님 화면", "📱 Guest view"], tBook: ["📩 Đặt lịch", "📩 예약", "📩 Bookings"], tBoard: ["🗺️ Bảng điều hành", "🗺️ 현황판", "🗺️ Live board"], tSettle: ["💰 Đối soát", "💰 정산", "💰 Settlement"], tSched: ["📅 Lịch làm", "📅 근무표", "📅 Rota"], tStaff: ["💆 KTV", "💆 테라피스트", "💆 Therapist"], tUd: ["🧡 Uncle Day", "🧡 엉클데이 운영", "🧡 Uncle Day ops"],
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
    acceptToast: ["Đã nhận. Uncle Day sẽ xác nhận với khách, khách hiện ở Bảng điều hành hôm nay.", "수락했어요. 엉클데이가 손님에게 확정 안내를 하고, 오늘 현황판에 손님이 나타나요.", "Accepted. Uncle Day confirms with the guest; they appear on today's board."],
    waitUd: ["Đã nhận · chờ Uncle Day xác nhận", "수락 · 엉클데이 확정 대기", "Accepted · Uncle Day confirming"],
    sMonth: ["Tháng này", "이번 달", "This month"],
    sUdRev: ["Doanh thu từ khách Uncle Day", "엉클데이 손님 매출", "Revenue from Uncle Day guests"],
    sFee: ["Hoa hồng Uncle Day (ví dụ {r}%)", "엉클데이 수수료 (예시 {r}%)", "Uncle Day commission (e.g. {r}%)"],
    sWalk: ["Khách vãng lai (không tính hoa hồng)", "워크인 손님 (수수료 없음)", "Walk-in guests (no commission)"],
    sKeep: ["Cửa hàng giữ lại", "매장 몫", "Shop keeps"],
    sList: ["Lượt khách Uncle Day đã đến", "방문 완료된 엉클데이 예약", "Uncle Day visits"],
    sCols: [["Ngày", "Mã", "Khách", "Thanh toán", "Hoa hồng"], ["날짜", "예약번호", "손님", "결제", "수수료"], ["Date", "Code", "Guest", "Paid", "Fee"]],
    sNew: ["mới", "방금", "new"],
    sHow: ["Cách chuyển hoa hồng (theo từng lượt hay gộp theo tháng) sẽ thống nhất khi ký hợp đồng. Dưới đây là ví dụ minh họa cả hai cách.", "수수료를 건별로 낼지 한 달에 한 번 모아서 낼지는 계약할 때 정해요. 아래는 두 방식의 예시예요.", "Whether the fee is paid per visit or once a month is agreed in the contract. Both are shown as examples."],
    sNoShow: ["Khách không đến, hủy lịch → không tính hoa hồng.", "노쇼 · 취소는 수수료가 없어요.", "No-shows and cancellations → no commission."],
    mPer: ["Theo từng lượt", "건별 정산", "Per visit"], mMon: ["Gộp theo tháng", "월 1회 정산", "Monthly"], mTbd: ["chưa chốt · ví dụ", "미정 · 예시", "TBD · example"],
    perNote: ["Mỗi lượt khách Uncle Day xong là hoa hồng của lượt đó được tính ngay. Cửa hàng chuyển theo từng lượt.", "엉클데이 손님이 방문 완료될 때마다 그 건의 수수료가 바로 계산돼요. 매장은 건마다 송금해요.", "Each finished Uncle Day visit creates its own fee. The shop pays per visit."],
    monNote: ["Cuối tháng Uncle Day tổng hợp tất cả lượt đã đến và gửi một bảng đối soát. Cửa hàng kiểm tra rồi chuyển một lần.", "월말에 엉클데이가 방문 완료 건을 모아 정산서 한 장을 보내요. 매장은 확인한 뒤 한 번에 송금해요.", "At month end Uncle Day sends one statement of all visits. The shop checks it and pays once."],
    stPaid: ["Đã chuyển", "송금 완료", "Paid"], stDue: ["Chờ chuyển", "송금 대기", "To pay"], monDue: ["Tổng hoa hồng tháng này (chuyển 1 lần)", "이번 달 수수료 합계 (한 번에 송금)", "This month's total fee (paid once)"],
    endT: ["Cửa hàng còn có thể…", "이 밖에도 이런 걸 할 수 있어요", "The shop can also…"],
    cta: ["Đăng ký miễn phí với nhân viên Uncle Day", "엉클데이 담당자에게 무료로 입점 신청하세요", "Sign up free with your Uncle Day contact"],
  };
  const t = (k, v) => { let s = (T[k] || [k])[li()] || T[k][0]; if (v) for (const x in v) s = s.split("{" + x + "}").join(v[x]); return s; };

  /* ---------- 안내 단계 ---------- */
  // who: guest 손님 · ud 엉클데이 운영 · owner 업체 사장님 · staff 테라피스트 · all 공통
  const P = (vi, ko, en) => [vi, ko, en];
  const STEPS_ALL = [
    { who: "all", tab: null, key: "intro", intro: true,
      h: P("Uncle Day vận hành thế nào? · 4 góc nhìn", "엉클데이는 이렇게 돌아가요 · 4개의 입장", "How Uncle Day runs · 4 points of view"),
      p: P("Khách Hàn đặt lịch → Uncle Day xác nhận và chăm sóc khách → cửa hàng đón khách → KTV làm dịch vụ và nhận đánh giá. Bấm Tiếp để xem từng bước, hoặc chọn một vai ở trên.", "한국인 손님이 예약 → 엉클데이가 확정 · 안내 → 매장이 손님을 맞이 → 테라피스트가 시술하고 후기를 받아요. '다음'으로 차례대로 보거나, 위에서 한 입장만 골라 볼 수 있어요.", "A Korean guest books → Uncle Day confirms and looks after them → the shop welcomes them → the therapist serves and gets reviewed. Press Next, or pick one role above.") },
    { who: "guest", tab: "cust", key: "send",
      h: P("Khách Hàn đặt lịch trên điện thoại", "손님: 휴대폰으로 예약", "Guest books on their phone"),
      p: P("Màn hình khách nhìn thấy (tiếng Hàn). Khách xem trang cửa hàng, chọn dịch vụ, giờ, số người rồi gửi yêu cầu. Khách trả tiền tại cửa hàng theo đúng giá niêm yết.", "손님이 보는 화면이에요(한국어). 매장 페이지를 보고 코스 · 시간 · 인원을 골라 예약 요청을 보내요. 결제는 매장에서 매장 가격 그대로 해요.", "What the guest sees (in Korean). They view the shop page, pick service, time and party size, and send a request. They pay at the shop at the listed price."),
      act: P("Bấm vào Spa Mẫu → chọn dịch vụ → Gửi yêu cầu", "Spa Mẫu → 코스 선택 → '예약 요청 보내기'를 눌러 보세요", "Tap Spa Mẫu → pick a service → Send request") },
    { who: "ud", tab: "ud", key: "udnew",
      h: P("Uncle Day nhận lịch và chuyển cho cửa hàng", "엉클데이: 예약 접수 → 업체에 자동 전달", "Uncle Day receives it → forwards to the shop"),
      p: P("Lịch mới vào trang quản trị Uncle Day và tự động báo cho cửa hàng. Uncle Day trò chuyện với khách bằng tiếng Hàn (chat, KakaoTalk) và giữ thông tin liên hệ của khách.", "새 예약이 엉클데이 관리자 화면에 들어오고, 업체에는 자동으로 알림이 가요. 손님과의 대화(채팅 · 카카오톡)와 연락처는 엉클데이가 맡아요.", "The booking lands in Uncle Day's admin and the shop is notified automatically. Uncle Day talks with the guest in Korean (chat, KakaoTalk) and keeps their contact.") },
    { who: "owner", tab: "book", key: "accept",
      h: P("Cửa hàng nhận thông báo → bấm Nhận", "업체: 알림 → 수락", "Shop gets notified → Accept"),
      p: P("Yêu cầu hiện ngay trên điện thoại chủ cửa hàng. Xem giờ, số người, dịch vụ rồi bấm Nhận. Nếu giờ đó không được, chọn 'Đề xuất giờ khác' — Uncle Day sẽ hỏi lại khách.", "요청이 사장님 휴대폰에 바로 떠요. 시간 · 인원 · 코스를 보고 '수락'을 눌러요. 그 시간이 안 되면 '다른 시간 제안'을 누르면 엉클데이가 손님에게 다시 물어봐요.", "The request appears on the owner's phone. Check it and press Accept. If the time doesn't work, propose other times — Uncle Day asks the guest."),
      act: P("Bấm Nhận ở yêu cầu mới", "새 요청에서 '수락'을 눌러 보세요", "Press Accept on the new request") },
    { who: "ud", tab: "ud", key: "udconfirm",
      h: P("Uncle Day xác nhận với khách", "엉클데이: 예약 확정 → 손님 안내", "Uncle Day confirms with the guest"),
      p: P("Khi cửa hàng đã nhận, Uncle Day bấm 'Xác nhận đặt lịch'. Khách nhận tin xác nhận bằng tiếng Hàn kèm địa chỉ, và được nhắc lịch trước giờ hẹn.", "업체가 수락하면 엉클데이가 '예약 확정'을 눌러요. 손님에게 한국어 확정 안내 · 주소 · 방문 전 알림이 가요.", "Once the shop accepts, Uncle Day presses Confirm. The guest gets a Korean confirmation with the address and a reminder."),
      act: P("Bấm ✅ 예약 확정 (Xác nhận)", "'✅ 예약 확정'을 눌러 보세요", "Press ✅ Confirm") },
    { who: "guest", tab: "cust", key: "gconf",
      h: P("Khách nhận xác nhận bằng tiếng Hàn", "손님: 한국어 확정 안내 받기", "Guest gets a Korean confirmation"),
      p: P("Cửa hàng không cần nhắn tin hay gọi điện cho khách — Uncle Day lo phần này.", "매장은 손님에게 따로 연락할 필요가 없어요. 엉클데이가 해요.", "The shop never has to message the guest — Uncle Day does it.") },
    { who: "staff", tab: "staff", key: "clockin",
      h: P("KTV chấm công bằng điện thoại", "테라피스트: 휴대폰으로 출근", "Therapist clocks in on their phone"),
      p: P("Mỗi KTV có màn hình riêng (đăng nhập bằng số điện thoại + mã PIN). Xem ca hôm nay và bấm Chấm công vào — bảng điều hành của cửa hàng cập nhật ngay, biết ai đúng giờ, ai trễ.", "테라피스트마다 자기 화면이 있어요(전화번호 + PIN 로그인). 오늘 근무를 보고 '출근하기'를 누르면 매장 현황판에 바로 반영되고, 정시 · 지각도 자동으로 기록돼요.", "Each therapist has their own screen (phone + PIN). They see today's shift and clock in — the shop's board updates instantly, on time or late."),
      act: P("Bấm Chấm công vào", "'출근하기'를 눌러 보세요", "Press Clock in") },
    { who: "owner", tab: "board", key: "checkin",
      h: P("Khách đến → bấm Đã đến", "업체: 손님이 오면 → 도착", "Guest arrives → Arrived"),
      p: P("Lịch đã xác nhận hiện ở 'Khách Uncle Day hôm nay' (nhãn UD). Khách đến thì bấm Đã đến: khách vào ghế chờ trên bản đồ cửa hàng.", "확정된 예약은 '오늘 올 엉클데이 손님'에 UD 표시로 보여요. 손님이 오면 '도착'을 눌러요. 지도에서 손님이 대기석에 앉아요.", "Confirmed bookings show under 'Uncle Day guests today' with a UD tag. Press Arrived and the guest sits in the lobby."),
      act: P("Bấm Đã đến cho khách vừa đặt", "방금 예약한 손님 옆 '도착'을 눌러 보세요", "Press Arrived for the guest who just booked") },
    { who: "owner", tab: "board", key: "assign",
      h: P("Xếp giường và KTV cho từng người", "업체: 한 명씩 베드 · 테라피스트 배정", "Assign a bed and therapist to each person"),
      p: P("Nhóm nhiều người được xếp riêng từng người. Chọn KTV (tối đa 4 người cho 1 khách) và giường rồi bấm Bắt đầu. Nhân viên trên bản đồ sẽ đi vào phòng.", "여러 명 팀은 한 명씩 따로 배정해요. 테라피스트(손님 1명에 최대 4명)와 베드를 고르고 시작을 눌러요. 지도에서 직원이 방으로 걸어가요.", "A group is assigned one by one. Pick therapists (up to 4 per guest) and a bed, then Start. Staff walk into the room on the map."),
      act: P("Bấm Xếp → chọn KTV → Bắt đầu, làm cho từng khách", "배정 → 테라피스트 선택 → 시작, 한 분씩 해 보세요", "Assign → pick a therapist → Start, for each guest") },
    { who: "staff", tab: "staff", key: "swork",
      h: P("KTV thấy mình đang làm phòng nào", "테라피스트: 지금 내 시술 확인", "Therapist sees their current session"),
      p: P("Trên điện thoại, KTV thấy phòng, khách, thời gian còn lại, và số lượt đã làm hôm nay / tháng này.", "테라피스트 휴대폰에 방 · 손님 · 남은 시간, 오늘 · 이번 달 시술 수가 보여요.", "The therapist sees the room, guest, time left, and today's / this month's count.") },
    { who: "owner", tab: "board", key: "finish",
      h: P("Xong → số tiền tự điền", "업체: 끝나면 금액이 자동으로", "Finish → amount is pre-filled"),
      p: P("Bấm Xong, số tiền theo giá dịch vụ đã điền sẵn. Khi cả nhóm xong, lịch Uncle Day tự chuyển sang 'Đã đến' — không cần gửi ảnh hóa đơn.", "'끝내기'를 누르면 코스 금액이 미리 채워져 있어요. 팀이 모두 끝나면 엉클데이 예약이 자동으로 '방문 완료'가 돼요. 영수증 사진을 따로 보낼 필요가 없어요.", "Press Finish; the price is pre-filled. When the whole group is done, the booking is marked visited automatically — no receipt photos."),
      act: P("Bấm Xong → Xác nhận cho từng khách", "한 분씩 '끝내기' → 확인을 눌러 보세요", "Press Finish → Confirm for each guest") },
    { who: "guest", tab: "cust", key: "review",
      h: P("Khách đánh giá từng KTV", "손님: 테라피스트별 후기", "Guest reviews each therapist"),
      p: P("Sau khi về, khách nhận lời mời đánh giá từng KTV đã làm cho mình. Chỉ khách đã thực sự đến mới viết được.", "방문이 끝나면 손님이 담당 테라피스트마다 후기를 남겨요. 실제로 방문한 손님만 쓸 수 있어요.", "After the visit the guest reviews each therapist. Only real visitors can review."),
      act: P("Chấm sao cho từng KTV → Gửi đánh giá", "테라피스트마다 별점을 고르고 '후기 보내기'를 눌러 보세요", "Rate each therapist → Send review") },
    { who: "staff", tab: "staff", key: "srev",
      h: P("KTV nhận đánh giá và thưởng", "테라피스트: 후기 · 보너스 확인", "Therapist sees reviews and bonus"),
      p: P("Mỗi đánh giá thật (đã xác nhận khách có đến) được thưởng như nhau, không phụ thuộc số sao. KTV có mã QR riêng để mời khách đánh giá.", "진짜 후기(방문 확인됨) 1건마다 별점과 상관없이 같은 금액의 보너스가 있어요. 테라피스트마다 후기 부탁용 QR도 있어요.", "Every verified review earns the same bonus regardless of stars. Each therapist has a QR to invite reviews.") },
    { who: "ud", tab: "ud", key: "bonus",
      h: P("Uncle Day duyệt thưởng và đối soát", "엉클데이: 보너스 지급 · 정산", "Uncle Day pays bonuses and settles"),
      p: P("Uncle Day kiểm tra đánh giá (khách có thật sự đến), trả thưởng cho KTV, và tổng hợp hoa hồng của từng cửa hàng.", "엉클데이가 후기(실제 방문 여부)를 확인하고 테라피스트 보너스를 지급해요. 업체별 수수료도 여기서 모아 봐요.", "Uncle Day verifies reviews, pays the therapist bonus, and totals each shop's commission."),
      act: P("Bấm 💸 보너스 지급 (Trả thưởng)", "'💸 보너스 지급'을 눌러 보세요", "Press 💸 Pay bonus") },
    { who: "owner", tab: "board", key: "walkin",
      h: P("Khách vãng lai cũng quản lý được", "업체: 워크인 손님도 같이 관리", "Walk-in guests too"),
      p: P("Khách tự đến (không qua Uncle Day) nhập ở 'Tiếp nhận khách'. Dùng chung bảng, chung nhân viên — nhưng KHÔNG tính hoa hồng.", "엉클데이를 거치지 않고 직접 온 손님은 '손님 접수'에 넣어요. 같은 현황판 · 같은 직원으로 관리하지만 수수료는 없어요.", "Walk-ins go in 'Add a guest'. Same board, same staff — but NO commission."),
      act: P("Nhập tên bất kỳ → Tiếp nhận", "아무 이름이나 넣고 '접수'를 눌러 보세요", "Type any name → Add") },
    { who: "staff", tab: "staff", key: "sreq",
      h: P("KTV xin nghỉ / đổi ca trên điện thoại", "테라피스트: 휴무 · 근무 변경 요청", "Therapist requests a day off / shift change"),
      p: P("Bấm vào ngày trong lịch làm, chọn Xin nghỉ, Đổi ca hoặc Đổi với đồng nghiệp, ghi lý do rồi gửi. Đổi với đồng nghiệp: bạn đồng ý trước, sau đó chủ cửa hàng duyệt.", "근무표에서 날짜를 누르고 휴무 · 근무 변경 · 동료와 교대 중 골라 이유와 함께 보내요. 교대는 동료가 먼저 수락하고 그다음 사장님이 승인해요.", "Tap a day, choose day off, shift change or swap, add a reason and send. Swaps: the coworker agrees first, then the owner approves."),
      act: P("Bấm một ngày → Xin nghỉ → Gửi yêu cầu", "날짜 하나 → 휴무 요청 → '요청 보내기'를 눌러 보세요", "Tap a day → Day off → Send") },
    { who: "owner", tab: "sched", key: "sched",
      h: P("Chủ cửa hàng duyệt yêu cầu, lịch tự cập nhật", "업체: 요청 승인 → 근무표 자동 반영", "Owner approves, the rota updates itself"),
      p: P("Yêu cầu của KTV hiện ở dưới lịch làm. Bấm Duyệt hoặc Từ chối. Bấm vào ô bất kỳ để đổi ca hoặc đặt giờ riêng (ví dụ chỉ làm 4 tiếng). Dòng dưới cùng báo khi ca sáng/tối thiếu người.", "테라피스트 요청이 근무표 아래에 모여요. 승인이나 거절만 누르면 돼요. 칸을 누르면 근무를 바꾸거나 시간을 직접 정할 수 있어요(예: 4시간만 근무). 맨 아래 줄은 오전 · 오후 인원이 모자라면 알려 줘요.", "Requests gather under the rota. Approve or decline. Tap any cell to change a shift or set custom hours. The bottom row warns when short-staffed."),
      act: P("Kéo xuống 'Yêu cầu' → bấm Duyệt", "아래 '요청'에서 '승인'을 눌러 보세요", "Scroll to Requests → Approve") },
    { who: "owner", tab: "settle", key: "settle",
      h: P("Đối soát rõ ràng", "업체: 투명한 정산", "Clear settlement"),
      p: P("Chỉ những lượt khách Uncle Day đã đến và thanh toán mới tính hoa hồng. Mọi con số tự cộng từ bảng điều hành.", "방문해서 결제한 엉클데이 손님만 수수료가 붙어요. 숫자는 현황판에서 자동으로 모여요.", "Only Uncle Day guests who visited and paid are charged. All numbers come from the board automatically.") },
    { who: "all", tab: null, key: "end", more: true,
      h: P("Miễn phí đăng ký · chỉ trả khi có khách", "입점 무료 · 손님이 와야만 수수료", "Free to join · pay only when guests come"),
      p: P("", "", "") },
  ];
  const ROLES = ["all", "guest", "ud", "owner", "staff"];
  const RL = { all: P("Toàn bộ", "전체 흐름", "Full story"), guest: P("🇰🇷 Khách", "🇰🇷 손님", "🇰🇷 Guest"), ud: P("🧡 Uncle Day", "🧡 엉클데이 운영", "🧡 Uncle Day ops"), owner: P("🏪 Cửa hàng", "🏪 업체 사장님", "🏪 Shop owner"), staff: P("💆 KTV", "💆 테라피스트", "💆 Therapist") };
  let role = (() => { try { const q = new URLSearchParams(location.search).get("role"); if (ROLES.includes(q)) return q; } catch (e) {} return "all"; })();
  let STEPS = [];
  const buildFlow = () => { STEPS = STEPS_ALL.filter(x => role === "all" || x.who === "all" || x.who === role); };
  buildFlow();
  const SI = k => STEPS.findIndex(x => x.key === k);
  const MORE = [
    ["🕘", ["Chấm công: nhân viên bấm vào/ra ca bằng điện thoại", "출퇴근: 직원이 휴대폰으로 출근 · 퇴근", "Attendance: staff clock in/out on their phone"]],
    ["🧾", ["Xem lại lịch sử từng ngày/tháng, xuất file Excel (CSV)", "날짜 · 월별 지난 기록, 엑셀(CSV) 내려받기", "Daily/monthly history, Excel (CSV) export"]],
    ["📲", ["Cài như ứng dụng trên điện thoại, nhận thông báo đặt lịch", "휴대폰에 앱처럼 설치 · 예약 알림", "Install like an app, get booking notifications"]],
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
    const mk = (id, name, role, look, inAgo, dc, off, ch) => ({ id, name, role, years: 2, look, def_code: dc || "A", off_day: off == null ? -1 : off, def_start: ch ? ch[0] : null, def_end: ch ? ch[1] : null, code: dc || "A", hours: [600, 1320],
      in_at: inAgo == null ? null : iso(now - inAgo * 60e3), out_at: null, late_min: 0, in_via: inAgo == null ? null : "phone", app: true, has_phone: true, stars: 4.8, reviews: 12, done_today: 0, rev_today: 0 });
    S = {
      open: true,
      staff: [mk("s1", "Linh", "tp", LOOK("long", 0), null, "A", null), mk("s2", "Mai", "tp", LOOK("pony", 1), 170, "F", 3), mk("s3", "Hạnh", "tp", LOOK("bun", 2), 160, "A", 5), mk("s4", "Thảo", "tp", LOOK("short", 3), null, "B", 2), mk("s5", "Trang", "rcp", LOOK("bun", 4), 200, "F", 4), mk("s6", "Vy", "tp", LOOK("pony", 0), null, "C", 0, [1080, 1320])],
      guests: [], sessions: [],
      bookings: [
        { id: "b1", code: "UD-7K3P", name: "Kim Minji", menu_name: "", menu_ko: "", min: 90, people: 2, price: 0, time: "", status: "none", req: true },
        { id: "b2", code: "UD-2M8Q", name: "Park Jisoo", menu_name: "Massage body Thái 60′", menu_ko: "타이 전신 마사지 60분", min: 60, people: 1, price: 350000, time: hm(Math.min(22 * 60, Math.ceil((m + 90) / 10) * 10)), status: "confirmed" },
      ],
      past: [ // 이번 달 이미 방문 완료된 엉클데이 손님 (예시)
        { d: -9, code: "UD-4H2A", name: "Lee Sora", paid: 700000 }, { d: -7, code: "UD-9P1C", name: "Choi Yuna", paid: 350000 },
        { d: -5, code: "UD-3T6E", name: "Jung Hoon", paid: 1500000 }, { d: -3, code: "UD-8B5F", name: "Han Jiwoo", paid: 500000 }, { d: -1, code: "UD-6R7G", name: "Oh Seojin", paid: 750000 },
      ],
      walkPast: 4200000,
      items: [{ k: "plant", fl: 1, id: "i1", rx: 0.1, ry: 0.42 }, { k: "flower", fl: 1, id: "i2", rx: 0.4, ry: 0.42 }, { k: "cat", fl: 1, id: "i3", rx: 0.27, ry: 0.62 }, { k: "lantern", fl: 1, id: "i4", rx: 0.93, ry: 0.36 }],
      done: {},
      cust: { scr: 0, course: "c2", people: 2, time: null, stars: {} },
      smode: "mon", stab: "today", sday: null, sform: { type: "off", reason: "", must: false }, bonusPaid: false, career: false, open2work: false,
      reqs: [], over: {},
    };
    seedSched();
  }
  const layout = () => ({ kind: "massage", items: S.items, floors: [
      { rooms: [{ n: "201", type: "bed", count: 2, eq: [] }, { n: "202", type: "bed", count: 1, eq: [] }] },
      { rooms: [{ n: "301", type: "bed", count: 2, eq: [] }] }],
    shifts: SHIFTS, min_am: 2, min_pm: 2, courses: COURSES });
  const stations = () => ["201-1", "201-2", "202-1", "301-1", "301-2"];
  const taken = gid => [...new Set(S.sessions.filter(x => x.guest_id === gid && (x.status === "working" || x.status === "done")).map(x => x.pno))].sort();
  function boardGet() {
    const d = vnToday();
    const st = S.staff.map(s => {
      const mine = S.sessions.filter(x => x.staff_id === s.id && x.status === "done");
      return Object.assign({}, s, { code: codeOf(s, d), hours: hoursOf(s, d), done_today: mine.length, rev_today: mine.reduce((a, x) => a + (x.paid || 0), 0) });
    });
    return JSON.parse(JSON.stringify({
      today: d, now: new Date().toISOString(), now_min: vnMin(), role: "owner",
      shop: { id: "demo", name: { vi: "Spa Mẫu", ko: "예시 스파", en: "Sample Spa" } },
      shop_state: { open: "10:00", close: "22:00", dayoff: false, status: S.open ? (S.openedAt ? "open_manual" : "open_auto") : "closed_manual", is_open: S.open, opened_at: S.openedAt || null, closed_at: S.closedAt || null },
      layout: layout(), staff: st,
      guests: S.guests.filter(g => g.status === "waiting" || g.status === "in_session").map(g => Object.assign({}, g, { taken: taken(g.id) })),
      expected: S.bookings.filter(b => (b.status === "confirmed" || b.status === "shop_ok") && !S.guests.some(g => g.booking_id === b.id)).map(b => ({ id: b.id, code: b.code, name: b.name, menu_name: lang === "ko" ? b.menu_ko : b.menu_name, min: b.min, people: b.people, price: b.price, time: b.time, status: b.status })),
      sessions: S.sessions.filter(x => x.status !== "cancelled").map(x => { const g = S.guests.find(y => y.id === x.guest_id); return Object.assign({}, x, { guest_name: g ? g.name : "", people: g ? g.people : 1, ud: !!x.booking_id }); }).sort((a, b) => b.started_at.localeCompare(a.started_at)),
      pending_req: S.reqs.filter(q => q.status === "pending").length,
    }));
  }
  const err = m => { const e = new Error(m); e.message = m; return e; };
  /* 근무표: A 오픈조 · B 마감조 · F 종일 · O 휴무 · C 직접 정한 시간 */
  const SHIFTS = { A: [600, 1080], B: [840, 1320], F: [600, 1320] };
  const addDay = (ds, n) => { const d = new Date(ds + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const dow = ds => new Date(ds + "T00:00:00Z").getUTCDay();
  const monday = ds => addDay(ds, -((dow(ds) + 6) % 7));
  function codeOf(st, d) { const o = (S.over[st.id] || {})[d]; if (o) return o.c; if (st.off_day === dow(d)) return "O"; return st.def_code; }
  function hoursOf(st, d) { const o = (S.over[st.id] || {})[d], c = codeOf(st, d); if (c === "O") return null; if (c === "C") return o && o.h ? o.h : [st.def_start, st.def_end]; return SHIFTS[c]; }
  function setCode(sid, d, c, h) { S.over[sid] = S.over[sid] || {}; if (c == null) delete S.over[sid][d]; else S.over[sid][d] = { c, h: h || null }; }
  function seedSched() {
    const td = vnToday(), nx = n => { for (let i = 1; i < 14; i++) { const d = addDay(td, i); if (dow(d) === n) return d; } return addDay(td, 3); };
    const ago = m => new Date(Date.now() - m * 60e3).toISOString();
    S.reqs = [
      { id: 1, staff_id: "s2", day: nx(6), type: "off", must: true, want: null, mate_id: null, reason: ["Đám cưới em gái", "여동생 결혼식", "Sister's wedding"], status: "pending", created_at: ago(35) },
      { id: 2, staff_id: "s3", day: addDay(td, 2), type: "swap", must: false, want: null, mate_id: "s4", reason: ["Đi khám răng buổi sáng (Thảo đã đồng ý đổi)", "오전 치과 진료 (Thảo가 교대 동의함)", "Dentist in the morning (Thảo agreed to swap)"], status: "pending", created_at: ago(80) },
      { id: 3, staff_id: "s6", day: addDay(td, 3), type: "shift", must: false, want: "B", mate_id: null, reason: ["Muốn làm thêm giờ", "근무 시간을 늘리고 싶어요", "Wants more hours"], status: "pending", created_at: ago(140) },
    ];
  }
  function shiftsGet(d1) {
    const days = Array.from({ length: 7 }, (_, i) => addDay(d1, i)), nm = id => (S.staff.find(x => x.id === id) || {}).name || "";
    return JSON.parse(JSON.stringify({ from: d1, layout: { shifts: SHIFTS, min_am: 2, min_pm: 2 },
      staff: S.staff.map(st => ({ id: st.id, name: st.name, role: st.role, look: st.look, def_code: st.def_code, def_start: st.def_start, def_end: st.def_end, codes: days.map(d => codeOf(st, d)), hours: days.map(d => hoursOf(st, d)) })),
      requests: S.reqs.map(q => Object.assign({}, q, { name: nm(q.staff_id), mate: q.mate_id ? nm(q.mate_id) : null, reason: Array.isArray(q.reason) ? q.reason[li()] : q.reason })) }));
  }
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
    shifts_get: a => shiftsGet(a.d1 || monday(vnToday())),
    shift_set: a => { const st = S.staff.find(x => x.id === a.sid); if (!st) throw err("Staff not found"); setCode(a.sid, a.d, a.code); return true; },
    shift_set_custom: a => { if (!(a.e > a.s)) throw err("Check the hours"); setCode(a.sid, a.d, "C", [a.s, a.e]); return true; },
    req_decide: a => {
      const q = S.reqs.find(x => x.id === a.rid && x.status === "pending"); if (!q) throw err("Request not found");
      q.status = a.ok ? "ok" : "no";
      if (a.ok) {
        const A = S.staff.find(x => x.id === q.staff_id);
        if (q.type === "off") setCode(A.id, q.day, "O");
        else if (q.type === "shift") setCode(A.id, q.day, q.want);
        else { const B = S.staff.find(x => x.id === q.mate_id), ca = codeOf(A, q.day), cb = codeOf(B, q.day), ha = hoursOf(A, q.day), hb = hoursOf(B, q.day); setCode(A.id, q.day, cb, hb); setCode(B.id, q.day, ca, ha); }
      }
      mark("sched"); return shiftsGet(monday(q.day));
    },
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
    if (k === tab && $("#dmMain").dataset.tab === k) { ({ cust: renderCust, staff: renderStaff, ud: renderUd, book: renderBook, settle: renderSettle }[k] || (() => {}))(); return; }
    tab = k; $("#dmMain").dataset.tab = k;
    document.querySelectorAll("[data-tab]").forEach(b => b.classList.toggle("on", b.dataset.tab === k));
    if (window.OwnerBoard) window.OwnerBoard.unmount();
    const m = $("#dmMain");
    if (k === "board" || k === "sched") { m.innerHTML = '<div id="dmBoard"></div>'; window.OwnerBoard.mount($("#dmBoard"), { view: k, rpc, shopId: "demo", lang, isOwner: true, toast, errMsg: e => (e && e.message) || String(e), onPending: () => {} }); }
    else if (k === "cust") renderCust();
    else if (k === "staff") renderStaff();
    else if (k === "ud") renderUd();
    else if (k === "book") renderBook();
    else renderSettle();
  }
  /* ---------- 손님 휴대폰 화면 (한국어) ---------- */
  const slots = () => { const m = vnMin(), a = Math.max(600, Math.ceil((m + 30) / 30) * 30); return [0, 30, 60, 120].map(x => hm(Math.min(21 * 60, a + x))); };
  function sendBooking() {
    const c = S.cust, co = COURSES.find(x => x.id === c.course) || COURSES[1], b = S.bookings.find(x => x.id === "b1");
    Object.assign(b, { status: "requested", menu_name: `${co.vi} ${co.min}′`, menu_ko: `${co.ko} ${co.min}분`, min: co.min, people: c.people, price: co.price * c.people, time: c.time || slots()[0] });
    mark("send");
  }
  const CAP = {
    home: ["Khách tìm 'massage Đà Nẵng' trên uncleday.com. Trang cửa hàng bằng tiếng Hàn do Uncle Day làm miễn phí.", "손님이 uncleday.com에서 '다낭 마사지'를 찾아요. 한국어 매장 페이지는 엉클데이가 무료로 만들어 드려요.", "The guest searches 'Da Nang massage' on uncleday.com. Uncle Day builds the Korean shop page for free."],
    shop: ["Khách xem ảnh, menu và giá (đúng giá cửa hàng) rồi chọn dịch vụ.", "손님이 사진 · 메뉴 · 가격(매장 가격 그대로)을 보고 코스를 골라요.", "The guest checks photos, menu and prices (same as in store) and picks a service."],
    form: ["Chọn giờ và số người. Số điện thoại/Kakao của khách chỉ Uncle Day giữ.", "시간과 인원을 골라요. 손님 연락처는 엉클데이만 가지고 있어요.", "Pick time and party size. Only Uncle Day keeps the guest's contact."],
    wait: ["Yêu cầu đã gửi. Giờ đến lượt cửa hàng: xem tab 📩 Đặt lịch.", "요청을 보냈어요. 이제 매장 차례예요: 📩 예약 탭을 보세요.", "Request sent. Now it's the shop's turn: see the 📩 Bookings tab."],
    ok: ["Cửa hàng bấm Nhận → khách nhận tin xác nhận bằng tiếng Hàn ngay, kèm địa chỉ và nhắc lịch.", "매장이 수락하면 손님에게 바로 한국어 확정 안내가 가요. 주소와 방문 전 알림도 같이요.", "Once the shop accepts, the guest instantly gets a Korean confirmation with address and a reminder."],
    rev: ["Sau khi xong, khách đánh giá từng KTV. Đánh giá chỉ đến từ khách đã thực sự đến.", "방문이 끝나면 손님이 테라피스트별로 후기를 남겨요. 실제로 방문한 손님만 쓸 수 있어요.", "After the visit the guest reviews each therapist. Only real visitors can review."],
  };
  function renderCust() {
    const m = $("#dmMain"); if (tab !== "cust") return;
    const c = S.cust, b = S.bookings.find(x => x.id === "b1"), co = COURSES.find(x => x.id === c.course) || COURSES[1];
    const tps = [...new Set(S.sessions.filter(x => x.booking_id === "b1" && x.status === "done").map(x => x.staff_name))];
    let k, ph;
    if (b.status === "none") k = ["home", "shop", "form"][c.scr] || "home";
    else if (b.status === "requested" || b.status === "shop_ok") k = "wait";
    else if (b.status === "visited") k = "rev";
    else k = "ok";
    const bar = (title, back) => `<div class="ph-bar">${back != null ? `<button class="ph-back" data-cs="${back}">‹</button>` : ""}<b>${title}</b></div>`;
    if (k === "home") ph = `<div class="ph-top"><span class="ph-logo">엉클데이</span><span class="ph-sm">Uncle Day</span></div>
        <div class="ph-search">🔍 다낭 · 마사지</div>
        <button class="ph-card on" data-cs="1"><span class="ph-img a">💆</span><span class="ph-ct"><b>Spa Mẫu</b><small>⭐ 4.9 · 후기 128 · 미케비치 5분</small><small class="ph-tags"><i>한국어 예약</i><i>현장 결제</i></small></span></button>
        <button class="ph-card dim" data-cs="x"><span class="ph-img b">🌿</span><span class="ph-ct"><b>Lotus Spa</b><small>⭐ 4.8 · 후기 96</small></span></button>
        <button class="ph-card dim" data-cs="x"><span class="ph-img c">💅</span><span class="ph-ct"><b>Sen Nail & Spa</b><small>⭐ 4.7 · 후기 61</small></span></button>`;
    else if (k === "shop") ph = bar("Spa Mẫu", 0) + `<div class="ph-hero">💆<span>Spa Mẫu</span></div><div class="ph-pad"><small class="ph-sub">⭐ 4.9 (128) · 10:00–22:00 · 한국어 상담</small>
        <h4>코스 고르기</h4>${COURSES.map(x => `<button class="ph-opt ${x.id === c.course ? "on" : ""}" data-cc="${x.id}"><span><b>${esc(x.ko)}</b><small>${x.min}분</small></span><b>${won(x.price)}</b></button>`).join("")}
        <button class="ph-go" data-cs="2">다음</button></div>`;
    else if (k === "form") { const sl = slots(); if (!c.time || !sl.includes(c.time)) c.time = sl[0];
      ph = bar("예약하기", 1) + `<div class="ph-pad"><div class="ph-sum"><b>${esc(co.ko)} ${co.min}분</b><small>Spa Mẫu</small></div>
        <h4>날짜 · 시간</h4><div class="ph-chips"><span class="ph-day">오늘</span>${sl.map(x => `<button class="${x === c.time ? "on" : ""}" data-ct="${x}">${x}</button>`).join("")}</div>
        <h4>인원</h4><div class="ph-step"><button data-cp="-1">−</button><b>${c.people}명</b><button data-cp="1">+</button></div>
        <h4>예약자</h4><div class="ph-in">김민지 (Kim Minji)</div><div class="ph-in sm">💬 카카오톡 · ••••••</div>
        <p class="ph-lock">🔒 연락처는 엉클데이만 보관해요. 매장에는 이름 · 인원 · 시간만 전달돼요.</p>
        <div class="ph-total"><span>현장 결제 예상</span><b>${won(co.price * c.people)}</b></div>
        <button class="ph-go pulse" data-send>예약 요청 보내기</button></div>`; }
    else if (k === "wait") ph = bar("예약 내역") + `<div class="ph-pad ph-c"><div class="ph-big">⏳</div><h4>매장 확인을 기다리고 있어요</h4><p>예약번호 <b>${esc(b.code)}</b><br>${b.status === "shop_ok" ? "매장이 가능하다고 답했어요 👍<br>엉클데이가 곧 확정해 드려요." : "보통 10분 안에 답이 와요."}<br>카카오톡으로 알려 드릴게요.</p>
        <div class="ph-sum"><b>Spa Mẫu · 오늘 ${esc(b.time)}</b><small>${esc(b.menu_ko)} · ${b.people}명</small></div></div>`;
    else if (k === "ok") ph = `<div class="ph-kbar"><b>엉클데이</b><small>카카오톡</small></div><div class="ph-chat">
        <div class="ph-msg"><b>[엉클데이] 예약이 확정됐어요 ✅</b><br>Spa Mẫu<br>📅 오늘 ${esc(b.time)} · ${b.people}명<br>💆 ${esc(b.menu_ko)}<br>🔖 예약번호 ${esc(b.code)}<br>📍 12 Võ Nguyên Giáp, Đà Nẵng<br><span class="ph-link">지도 보기 · 택시 기사님께 보여 주기</span></div>
        <div class="ph-msg">⏰ 방문 1시간 전에 한 번 더 알려 드릴게요. 늦거나 못 가게 되면 여기로 말씀해 주세요.</div></div>`;
    else { const names = tps.length ? tps : ["Linh"];
      ph = bar("후기 쓰기") + (c.reviewed ? `<div class="ph-pad ph-c"><div class="ph-big">💝</div><h4>후기 고마워요!</h4><p>후기는 Spa Mẫu 페이지에 올라가요.<br>담당 테라피스트에게도 전달돼요.</p></div>`
        : (() => { const all = names.every(n => c.stars[n]); return `<div class="ph-pad"><h4>오늘 Spa Mẫu 어떠셨어요?</h4><p class="ph-sub">담당 테라피스트마다 별점을 남겨 주세요</p>
        ${names.map(n => `<div class="ph-tp"><b>${esc(n)}</b><div class="ph-stars">${[1, 2, 3, 4, 5].map(k => `<button class="${k <= (c.stars[n] || 0) ? "on" : ""}" data-star="${k}" data-tp="${esc(n)}" aria-label="${k}">★</button>`).join("")}</div></div>`).join("")}
        <div class="ph-in ta">${all ? "압이 딱 좋았어요. 다음에도 또 올게요!" : "한 줄 후기 (선택)"}</div>
        <button class="ph-go ${all ? "pulse" : ""}" data-rev ${all ? "" : "disabled"}>후기 보내기</button></div>`; })()); }
    m.innerHTML = `<div class="dm-cust"><div class="dm-phone"><div class="ph-notch"></div><div class="ph-scr">${ph}</div></div>
      <div class="dm-cap"><span class="dm-cap-k">🇰🇷 ${["Màn hình của khách (tiếng Hàn)", "손님 화면 (한국어)", "Guest's screen (Korean)"][li()]}</span><p>${esc(CAP[k][li()])}</p>
</div></div>`;
  }
  /* ---------- 자동 진행 (앞 단계를 건너뛸 때) ---------- */
  const b1 = () => S.bookings.find(x => x.id === "b1");
  const linh = () => S.staff.find(x => x.id === "s1");
  function clockIn() { const l = linh(); if (!l.in_at) { l.in_at = new Date().toISOString(); l.in_via = "phone"; l.late_min = 0; } }
  function autoAssign() {
    const g = S.guests.find(x => x.booking_id === "b1" && x.status === "waiting"); if (!g) return;
    for (let k = 0; k < 4; k++) {
      const gg = S.guests.find(x => x.id === g.id); if (!gg || gg.status !== "waiting") break;
      const busy = new Set(S.sessions.filter(x => x.status === "working").map(x => x.staff_id)), used = new Set(S.sessions.filter(x => x.status === "working").map(x => x.station));
      const tp = S.staff.filter(x => x.role === "tp" && x.in_at && !x.out_at && !busy.has(x.id)).sort((a, b) => (b.id === "s1") - (a.id === "s1"))[0], st = stations().find(x => !used.has(x));
      if (!tp || !st) break; API.session_begin({ gid: g.id, tps: [tp.id], stn: st });
    }
  }
  function autoFinish() { const g = S.guests.find(x => x.booking_id === "b1"); if (!g) return; S.sessions.filter(x => x.guest_id === g.id && x.status === "working" && x.id === x.grp).forEach(x => API.session_finish({ xid: x.id })); }
  const EFFECT = {
    send: () => { if (b1().status === "none") sendBooking(); },
    accept: () => { if (b1().status === "requested") b1().status = "shop_ok"; },
    udconfirm: () => { if (b1().status === "shop_ok" || b1().status === "requested") b1().status = "confirmed"; },
    clockin: clockIn,
    checkin: () => { if (!S.guests.some(g => g.booking_id === "b1")) API.guest_checkin({ bid: "b1" }); },
    assign: () => { clockIn(); autoAssign(); },
    finish: autoFinish,
    review: () => { const ns = [...new Set(S.sessions.filter(x => x.booking_id === "b1" && x.status === "done").map(x => x.staff_name))]; ns.forEach(n => { S.cust.stars[n] = S.cust.stars[n] || 5; }); S.cust.reviewed = true; },
    bonus: () => { S.bonusPaid = true; },
    walkin: () => { if (!S.guests.some(g => g.source === "walkin")) API.guest_add({ nm: "Anh Tuấn", course: COURSES[0], people: 1 }); },
    sreq: () => { if (!S.reqs.some(q => q.staff_id === "s1")) addReq(addDay(vnToday(), 4), "off", ["Về quê thăm bố mẹ", "고향에 부모님 뵈러 가요", "Visiting my parents"], false); },
    sched: () => { const q = S.reqs.find(x => x.status === "pending"); if (q) API.req_decide({ rid: q.id, ok: true }); },
  };
  function addReq(day, type, reason, must, want) { S.reqs.unshift({ id: Date.now() % 1e9, staff_id: "s1", day, type, must: !!must, want: want || null, mate_id: null, reason, status: "pending", created_at: new Date().toISOString() }); }

  /* ---------- 테라피스트 휴대폰 화면 (Linh) ---------- */
  const ST = {
    hi: P("Xin chào, Linh 👋", "안녕하세요, Linh 👋", "Hi, Linh 👋"), shop: P("Spa Mẫu · KTV", "Spa Mẫu · 테라피스트", "Spa Mẫu · Therapist"),
    tToday: P("Hôm nay", "오늘", "Today"), tRota: P("Lịch làm", "근무표", "Rota"), tRev: P("Đánh giá", "후기", "Reviews"), tMe: P("Tôi", "내 정보", "Me"),
    myShift: P("Ca hôm nay", "오늘 근무", "Today's shift"), clockIn: P("Chấm công vào", "출근하기", "Clock in"), clockOut: P("Chấm công ra", "퇴근하기", "Clock out"),
    inAt: P("Vào lúc {t} · Đúng giờ ✓", "{t} 출근 · 정시 ✓", "In at {t} · On time ✓"), notIn: P("Chưa chấm công", "아직 출근 전", "Not clocked in"),
    now: P("Đang làm", "지금 시술 중", "In session"), left: P("còn {n}′", "{n}분 남음", "{n}′ left"), idle: P("Đang chờ khách", "손님 대기 중", "Waiting for a guest"),
    dToday: P("Hôm nay", "오늘", "Today"), dMonth: P("Tháng này", "이번 달", "This month"), times: P("{n} lượt", "{n}회", "{n} sessions"),
    tapDay: P("Bấm vào ngày để xin nghỉ, đổi ca hoặc đổi với đồng nghiệp.", "날짜를 누르면 휴무 · 근무 변경 · 교대를 요청할 수 있어요.", "Tap a day to request a day off, shift change or swap."),
    rOff: P("Xin nghỉ", "휴무", "Day off"), rShift: P("Đổi ca", "근무 변경", "Change shift"), rSwap: P("Đổi với đồng nghiệp", "동료와 교대", "Swap"),
    reason: P("Lý do", "이유", "Reason"), must: P("Rất cần (việc gấp)", "꼭 필요해요 (급한 일)", "Really need it"), send: P("Gửi yêu cầu", "요청 보내기", "Send request"),
    myReq: P("Yêu cầu của tôi", "내 요청", "My requests"), pend: P("Chờ duyệt", "승인 대기", "Pending"), okd: P("Đã duyệt ✓", "승인됨 ✓", "Approved ✓"), nod: P("Từ chối", "거절됨", "Declined"),
    avg: P("Điểm TB", "평균 별점", "Average"), cnt: P("Số đánh giá", "후기 수", "Reviews"), bonusT: P("Thưởng đánh giá", "후기 보너스", "Review bonus"),
    bEach: P("Mỗi đánh giá được xác nhận: 20.000₫ (ví dụ) — không phụ thuộc số sao", "확인된 후기 1건당 20,000₫ (예시) — 별점과 상관없어요", "Per verified review: 20,000₫ (example) — regardless of stars"),
    bPend: P("Chờ trả", "지급 대기", "Pending"), bPaid: P("Đã trả", "지급 완료", "Paid"), qr: P("📱 Mã QR mời khách đánh giá", "📱 후기 부탁 QR", "📱 Review QR"),
    noRv: P("Đánh giá mới sẽ hiện ở đây sau khi khách gửi.", "손님이 후기를 보내면 여기에 떠요.", "New reviews appear here after guests send them."),
    career: P("Lưu hồ sơ nghề nghiệp", "경력 프로필 저장", "Keep a career profile"), careerS: P("Uncle Day lưu kinh nghiệm, đánh giá của bạn — mang theo khi đổi chỗ làm.", "엉클데이가 경력 · 후기를 보관해요. 일하는 곳이 바뀌어도 이어져요.", "Uncle Day keeps your experience and reviews — they follow you."),
    o2w: P("Đang tìm việc mới", "새 일자리 찾는 중", "Open to new jobs"), o2wS: P("Chỉ Uncle Day thấy. Chủ cửa hàng KHÔNG thấy.", "엉클데이만 봐요. 사장님에게는 보이지 않아요.", "Only Uncle Day sees this. Your shop owner does NOT."),
    pin: P("Đăng nhập bằng số điện thoại + mã PIN 6 số", "전화번호 + 6자리 PIN으로 로그인", "Log in with phone + 6-digit PIN"),
  };
  const st_ = k => ST[k][li()];
  const stx = (k, v) => { let x = st_(k); for (const q in v || {}) x = x.split("{" + q + "}").join(v[q]); return x; };
  const SHN = { A: P("Ca mở cửa", "오픈조", "Opening"), B: P("Ca đóng cửa", "마감조", "Closing"), F: P("Cả ngày", "종일", "Full day"), O: P("Nghỉ", "휴무", "Off"), C: P("Giờ riêng", "직접 정한 시간", "Custom") };
  function renderStaff() {
    const m = $("#dmMain"); if (tab !== "staff") return;
    const L = linh(), td = vnToday(), code = codeOf(L, td), hh = hoursOf(L, td), stb = S.stab;
    const mine = S.sessions.filter(x => x.staff_id === "s1"), cur = mine.find(x => x.status === "working"), dn = mine.filter(x => x.status === "done").length;
    const nav = `<div class="sp-nav">${[["today", "tToday", "🏠"], ["rota", "tRota", "📅"], ["rev", "tRev", "⭐"], ["me", "tMe", "👤"]].map(([k, l, ic]) => `<button class="${stb === k ? "on" : ""}" data-stab="${k}"><span>${ic}</span>${st_(l)}</button>`).join("")}</div>`;
    let body = "";
    if (stb === "today") {
      const g = cur && S.guests.find(x => x.id === cur.guest_id), left = cur ? Math.max(0, Math.round((Date.parse(cur.ends_at) - Date.now()) / 60e3)) : 0;
      body = `<div class="sp-card"><small>${st_("myShift")} · ${esc(dShort2(td))}</small><b class="sp-big">${SHN[code][li()]}${hh ? ` · ${hm(hh[0])}–${hm(hh[1])}` : ""}</b>
          ${L.in_at ? `<div class="sp-ok">${stx("inAt", { t: hm(Math.round((Date.parse(L.in_at) + 7 * 3600e3) / 60e3) % 1440) })}</div><button class="sp-btn l" data-sclock="out">${st_("clockOut")}</button>`
            : `<div class="sp-muted">${st_("notIn")}</div><button class="sp-btn pulse" data-sclock="in">⏰ ${st_("clockIn")}</button>`}</div>
        <div class="sp-card ${cur ? "work" : ""}"><small>${cur ? st_("now") : "·"}</small>${cur ? `<b class="sp-big">${esc(cur.station.split("-")[0])} · ${esc(g ? g.name : "")}${g && g.people > 1 ? ` (${cur.pno}/${g.people})` : ""}</b><div>${esc(cur.course_name)} · <b>${stx("left", { n: left })}</b></div>` : `<div class="sp-muted">${L.in_at ? st_("idle") : "—"}</div>`}</div>
        <div class="sp-two"><div class="sp-card"><small>${st_("dToday")}</small><b class="sp-big">${stx("times", { n: dn })}</b></div><div class="sp-card"><small>${st_("dMonth")}</small><b class="sp-big">${stx("times", { n: 41 + dn })}</b></div></div>`;
    } else if (stb === "rota") {
      const d0 = monday(td), days = Array.from({ length: 14 }, (_, i) => addDay(d0, i)), wd = [P("CN", "일", "Sun"), P("T2", "월", "Mon"), P("T3", "화", "Tue"), P("T4", "수", "Wed"), P("T5", "목", "Thu"), P("T6", "금", "Fri"), P("T7", "토", "Sat")];
      const reqs = S.reqs.filter(q => q.staff_id === "s1");
      body = `<p class="sp-muted">${st_("tapDay")}</p><div class="sp-week">${days.map(d => { const c = codeOf(L, d), h = hoursOf(L, d); return `<button class="sp-day k-${c} ${d === td ? "td" : ""} ${S.sday === d ? "on" : ""}" data-sday="${d}" ${d < td ? "disabled" : ""}><small>${wd[dow(d)][li()]} ${+d.slice(8)}</small><b>${SHN[c][li()]}</b><i>${h ? hm(h[0]) + "–" + hm(h[1]) : "🌙"}</i></button>`; }).join("")}</div>
        ${S.sday ? `<div class="sp-card"><b>${esc(dShort2(S.sday))}</b><div class="sp-seg">${[["off", "rOff"], ["shift", "rShift"], ["swap", "rSwap"]].map(([k, l]) => `<button class="${S.sform.type === k ? "on" : ""}" data-stype="${k}">${st_(l)}</button>`).join("")}</div>
          <div class="sp-in">${st_("reason")}: ${S.sform.type === "off" ? ["Về quê thăm bố mẹ", "고향에 부모님 뵈러 가요", "Visiting my parents"][li()] : S.sform.type === "shift" ? ["Muốn làm ca tối", "마감조로 하고 싶어요", "Prefer the closing shift"][li()] : ["Đổi với Mai (Mai đồng ý trước)", "Mai와 교대 (Mai가 먼저 수락)", "Swap with Mai (Mai agrees first)"][li()]}</div>
          <label class="sp-chk"><input type="checkbox" data-smust ${S.sform.must ? "checked" : ""}> ${st_("must")}</label><button class="sp-btn pulse" data-ssend>${st_("send")}</button></div>` : ""}
        <h4 class="sp-h">${st_("myReq")}</h4>${reqs.length ? reqs.map(q => `<div class="sp-req"><b>${esc(dShort2(q.day))} · ${q.type === "off" ? st_("rOff") : q.type === "shift" ? st_("rShift") : st_("rSwap")}</b><span class="sp-st ${q.status}">${q.status === "pending" ? st_("pend") : q.status === "ok" ? st_("okd") : st_("nod")}</span></div>`).join("") : `<p class="sp-muted">—</p>`}`;
    } else if (stb === "rev") {
      const got = S.cust.reviewed && S.cust.stars.Linh;
      const list = (got ? [{ n: "Kim Minji", s: S.cust.stars.Linh, ko: "압이 딱 좋았어요. 다음에도 또 올게요!", vi: "Lực vừa phải, lần sau sẽ quay lại!", fresh: true, paid: S.bonusPaid }] : []).concat([{ n: "Lee Sora", s: 5, ko: "친절하고 시원했어요", vi: "Thân thiện, rất dễ chịu", paid: true }, { n: "Choi Yuna", s: 4, ko: "좋았어요", vi: "Tốt", paid: true }]);
      const avg = (list.reduce((a, r) => a + r.s, 0) / list.length).toFixed(1);
      body = `<div class="sp-two"><div class="sp-card"><small>${st_("avg")}</small><b class="sp-big">⭐ ${avg}</b></div><div class="sp-card"><small>${st_("cnt")}</small><b class="sp-big">${list.length + 9}</b></div></div>
        <div class="sp-card"><small>${st_("bonusT")}</small><p class="sp-muted" style="margin:4px 0 0">${st_("bEach")}</p></div>
        ${list.map(r => `<div class="sp-rv ${r.fresh ? "fresh" : ""}"><div><b>${"★".repeat(r.s)}<span class="sp-dim">${"★".repeat(5 - r.s)}</span></b> · ${esc(r.n)}</div><p>${esc(r.ko)}<br><small>🇻🇳 ${esc(r.vi)}</small></p><span class="sp-st ${r.paid ? "ok" : "pending"}">${r.paid ? st_("bPaid") : st_("bPend")} · 20.000₫</span></div>`).join("")}
        ${got ? "" : `<p class="sp-muted">${st_("noRv")}</p>`}<button class="sp-btn l" data-sqr>${st_("qr")}</button>`;
    } else {
      body = `<div class="sp-card"><b>Linh</b><div class="sp-muted">${st_("pin")}</div></div>
        <div class="sp-card"><div class="sp-row"><div><b>${st_("career")}</b><p class="sp-muted">${st_("careerS")}</p></div><button class="sp-sw ${S.career ? "on" : ""}" data-scar><i></i></button></div>
        <div class="sp-row"><div><b>${st_("o2w")}</b><p class="sp-muted">🔒 ${st_("o2wS")}</p></div><button class="sp-sw ${S.open2work ? "on" : ""}" data-so2w ${S.career ? "" : "disabled"}><i></i></button></div></div>`;
    }
    const CAPS = { today: P("Màn hình riêng của KTV: ca hôm nay, chấm công, đang làm phòng nào, đã làm bao nhiêu lượt.", "테라피스트 전용 화면: 오늘 근무 · 출근 · 지금 시술 · 시술 횟수.", "The therapist's own screen: today's shift, clock-in, current session, counts."),
      rota: P("KTV tự xin nghỉ / đổi ca. Yêu cầu đi thẳng đến chủ cửa hàng (tab 📅 Lịch làm).", "테라피스트가 직접 휴무 · 근무 변경을 요청해요. 요청은 사장님 근무표로 바로 가요.", "Therapists request days off / changes; requests go straight to the owner's rota."),
      rev: P("Đánh giá từ khách Hàn có kèm bản dịch tiếng Việt. Thưởng như nhau cho mỗi đánh giá thật.", "한국인 손님 후기에 베트남어 번역이 붙어요. 진짜 후기마다 같은 보너스.", "Korean reviews come with a Vietnamese translation. Same bonus per verified review."),
      me: P("Hồ sơ nghề nghiệp chỉ lưu khi KTV đồng ý. 'Đang tìm việc' chỉ Uncle Day thấy, chủ cửa hàng không thấy.", "경력 프로필은 본인이 동의할 때만 저장돼요. '구직 중'은 엉클데이만 보고 사장님에게는 보이지 않아요.", "The career profile is kept only with consent. 'Open to work' is visible to Uncle Day only, never the owner.") };
    m.innerHTML = `<div class="dm-cust staff"><div class="dm-phone sp"><div class="ph-notch"></div><div class="ph-scr"><div class="sp-top"><b>${st_("hi")}</b><small>${st_("shop")}</small></div><div class="sp-body">${body}</div>${nav}</div></div>
      <div class="dm-cap"><span class="dm-cap-k st">💆 ${["Màn hình của KTV", "테라피스트 화면", "Therapist's screen"][li()]}</span><p>${esc(CAPS[stb][li()])}</p></div></div>`;
  }
  const dShort2 = ds => { const d = new Date(ds + "T00:00:00Z"), w = [P("CN", "일", "Sun"), P("T2", "월", "Mon"), P("T3", "화", "Tue"), P("T4", "수", "Wed"), P("T5", "목", "Thu"), P("T6", "금", "Fri"), P("T7", "토", "Sat")][d.getUTCDay()][li()]; return lang === "ko" ? `${d.getUTCMonth() + 1}/${d.getUTCDate()} (${w})` : `${w}, ${d.getUTCDate()}/${d.getUTCMonth() + 1}`; };

  /* ---------- 엉클데이 운영 화면 (관리자 · 한국어) ---------- */
  function renderUd() {
    const m = $("#dmMain"); if (tab !== "ud") return;
    const b = b1(), stK = { none: "—", requested: "접수 (업체 확인 전)", shop_ok: "업체 가능 (확정 대기)", confirmed: "예약 확정", visited: "방문 완료" }[b.status] || b.status;
    const tps = [...new Set(S.sessions.filter(x => x.booking_id === "b1" && x.status === "done").map(x => x.staff_name))];
    const today = vnNow(), past = S.past.reduce((a, r) => a + r.paid, 0) + (b.status === "visited" ? b.paid : 0), fee = Math.round(past * RATE / 100);
    const rows = [b.status !== "none" ? b : null, S.bookings.find(x => x.id === "b2")].filter(Boolean);
    m.innerHTML = `<div class="ud-wrap"><div class="ud-hd"><span class="ud-logo">엉클데이 관리자</span><span class="ud-tabs"><i class="on">📅 예약</i><i>💬 채팅</i><i>⭐ 후기</i><i>💰 정산</i><i>🌌 유니버스</i></span></div>
      <div class="ud-grid">
        <section class="ud-card ${step === SI("udnew") || step === SI("udconfirm") ? "hl" : ""}"><h4>📅 예약 · 오늘</h4>
          ${rows.length ? rows.map(x => `<div class="ud-bk"><div><b>${esc(x.name)}</b> · ${x.people}명 · ${esc(x.menu_ko)}<br><small>${esc(x.code)} · Spa Mẫu · 오늘 ${esc(x.time)} · ${won(x.price)}</small></div>
            <span class="ud-st s-${x.status}">${x.id === "b1" ? stK : "예약 확정"}</span>
            ${x.id === "b1" && x.status === "shop_ok" ? `<button class="ud-btn pulse" data-udok>✅ 예약 확정</button>` : ""}
            ${x.id === "b1" && x.status === "requested" ? `<small class="ud-hint">업체에 알림이 갔어요 · 업체 답을 기다리는 중 (목표 30분)</small>` : ""}</div>`).join("") : `<p class="ud-muted">아직 새 예약이 없어요. (손님 화면에서 예약을 보내 보세요)</p>`}
          <div class="ud-chat"><b>💬 손님 채팅</b><p>${b.status === "none" ? "—" : b.status === "requested" ? "김민지: 2명 가능할까요? 🙏<br><i>엉클데이: 매장에 확인하고 바로 알려 드릴게요!</i>" : "김민지: 확정 고마워요!<br><i>엉클데이: 택시 기사님께 주소 화면을 보여 주세요 😊</i>"}</p></div></section>
        <section class="ud-card ${step === SI("bonus") ? "hl" : ""}"><h4>⭐ 후기 · 테라피스트 보너스</h4>
          ${S.cust.reviewed ? `<div class="ud-rv"><b>김민지 → ${tps.map(esc).join(", ") || "Linh"}</b> <span class="ud-ok">방문 확인됨 ✓</span><br><small>★ ${Object.values(S.cust.stars).join(" · ") || 5} · "압이 딱 좋았어요"</small></div>
            <div class="ud-bn">보너스: 확인된 후기 ${tps.length || 1}건 × 20,000₫ (예시) = <b>${won((tps.length || 1) * 20000)}</b> ${S.bonusPaid ? `<span class="ud-ok">지급 완료 ✓</span>` : `<button class="ud-btn pulse" data-udbonus>💸 보너스 지급</button>`}</div>`
            : `<p class="ud-muted">손님이 후기를 보내면 여기에 떠요. 실제로 방문한 예약에만 후기가 붙어요.</p>`}
          <small class="ud-muted">보너스는 별점과 상관없이 확인된 후기 1건마다 같은 금액이에요.</small></section>
        <section class="ud-card"><h4>💰 업체 정산 · 이번 달</h4>
          <div class="ud-set"><span>Spa Mẫu</span><span>매출 ${won(past)}</span><b>수수료 ${won(fee)}</b></div>
          <div class="ud-set dim"><span>Lotus Spa</span><span>매출 ${won(6200000)}</span><b>수수료 ${won(930000)}</b></div>
          <small class="ud-muted">정산 방식(건별 / 월 1회)은 계약할 때 정해요 · 예시 수수료율 ${RATE}%</small></section>
        <section class="ud-card"><h4>🌌 유니버스 · 매장 현황</h4><div class="ud-set"><span>Spa Mẫu</span><span>출근 ${S.staff.filter(x => x.in_at && !x.out_at).length}/${S.staff.length}</span><b>시술 중 ${S.sessions.filter(x => x.status === "working" && x.id === x.grp).length}</b></div>
          <small class="ud-muted">엉클데이는 모든 업체의 현황판 · 근무표를 보고, 필요하면 대신 고쳐 줄 수 있어요 (고친 기록은 사장님께 보여요).</small></section>
      </div></div>`;
  }
  function renderBook() {
    const m = $("#dmMain"); if (tab !== "book") return;
    const bs = S.bookings.filter(b => b.status !== "none").sort((a, b) => (b.status === "requested") - (a.status === "requested"));
    m.innerHTML = `<div class="dm-pane">${bs.map(b => {
      const st = b.status === "requested" ? "req" : b.status === "declined" ? "no" : "ok";
      return `<div class="dm-bk ${st}">${b.req && b.status === "requested" ? `<div class="dm-new">🔔 ${t("newReq")}</div>` : ""}
        <div class="dm-bk-h"><b>${esc(b.name)}</b><span class="dm-ud">UD</span><span class="dm-code">${esc(b.code)}</span></div>
        <div class="dm-bk-g"><span>🕒 ${t("today")} ${esc(b.time)}</span><span>👥 ${t("people", { n: b.people })}</span><span>💆 ${esc(lang === "ko" ? b.menu_ko : b.menu_name)}</span><span>💵 ${won(b.price)}</span></div>
        ${b.status === "requested" ? `<div class="dm-bk-b"><button class="dm-btn l" data-dec="${b.id}">${t("decline")}</button><button class="dm-btn pulse" data-acc="${b.id}">${t("accept")}</button></div>`
          : `<div class="dm-st ${st}">${b.status === "declined" ? t("declined") : b.status === "visited" ? "✓ " + ["Đã đến", "방문 완료", "Visited"][li()] : b.status === "shop_ok" ? "⏳ " + t("waitUd") : "✓ " + t("accepted")}</div>`}</div>`;
    }).join("")}<p class="dm-note">${t("noContact")}</p></div>`;
  }
  function renderSettle() {
    const m = $("#dmMain"); if (tab !== "settle") return;
    const today = vnNow(), rows = S.past.map(r => { const d = new Date(today.getTime() + r.d * 864e5); return { day: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`, code: r.code, name: r.name, paid: r.paid }; });
    S.bookings.filter(b => b.status === "visited").forEach(b => rows.push({ day: `${today.getUTCDate()}/${today.getUTCMonth() + 1}`, code: b.code, name: b.name, paid: b.paid, isNew: true }));
    const walk = S.walkPast + S.sessions.filter(x => x.status === "done" && !x.booking_id).reduce((a, x) => a + (x.paid || 0), 0);
    const ud = rows.reduce((a, r) => a + r.paid, 0), fee = Math.round(ud * RATE / 100);
    const per = S.smode === "per", due = r => r.isNew || r.d > -2; // 건별 예시: 최근 건은 아직 송금 전
    rows.forEach((r, k) => { r.d = r.isNew ? 0 : S.past[k] ? S.past[k].d : 0; });
    const dueSum = rows.filter(due).reduce((a, r) => a + Math.round(r.paid * RATE / 100), 0);
    m.innerHTML = `<div class="dm-pane">
      <div class="dm-mode"><span class="dm-mk">${t("mTbd")}</span><div class="dm-seg">${[["per", "mPer"], ["mon", "mMon"]].map(([k, l]) => `<button class="${S.smode === k ? "on" : ""}" data-sm="${k}">${t(l)}</button>`).join("")}</div></div>
      <p class="dm-note">${t("sHow")}<br><b>${t(per ? "mPer" : "mMon")}:</b> ${t(per ? "perNote" : "monNote")}</p>
      <div class="dm-sum"><div><small>${t("sUdRev")}</small><b>${won(ud)}</b></div><div class="fee"><small>${t("sFee", { r: RATE })}</small><b>${won(fee)}</b></div>
        <div class="walk"><small>${t("sWalk")}</small><b>${won(walk)}</b></div><div class="keep"><small>${t("sKeep")}</small><b>${won(ud - fee + walk)}</b></div></div>
      <h3 class="dm-h">${t("sList")} · ${t("sMonth")}</h3>
      <div class="dm-tbl"><table><thead><tr>${(T.sCols[li()]).map((c, i) => `<th${i >= 3 ? ' class="r"' : ""}>${c}</th>`).join("")}${per ? `<th class="r"></th>` : ""}</tr></thead><tbody>
      ${rows.slice().reverse().map(r => `<tr class="${r.isNew ? "new" : ""}"><td>${r.day}</td><td>${esc(r.code)}</td><td>${esc(r.name)}${r.isNew ? ` <span class="dm-tagn">${t("sNew")}</span>` : ""}</td><td class="r">${won(r.paid)}</td><td class="r">${won(Math.round(r.paid * RATE / 100))}</td>${per ? `<td class="r"><span class="dm-st2 ${due(r) ? "due" : "paid"}">${t(due(r) ? "stDue" : "stPaid")}</span></td>` : ""}</tr>`).join("")}
      </tbody>${per ? "" : `<tfoot><tr><td colspan="4">${t("monDue")}</td><td class="r"><b>${won(fee)}</b></td></tr></tfoot>`}</table></div>
      <p class="dm-note">${t("sNoShow")}</p></div>`;
  }
  function renderGuide() {
    const s = STEPS[step], n = STEPS.length, g = $("#dmGuide");
    const done = s.key && S.done[s.key]; g.classList.toggle("min", gMin); g.dataset.key = s.key;
    g.innerHTML = `<div class="dm-g-top"><span class="dm-stepn">${t("stepOf", { a: step + 1, b: n })}</span><button class="dm-min" data-min>${gMin ? "▲" : "▼"} ${gMin ? ["Xem thêm", "펼치기", "More"][li()] : ["Thu gọn", "접기", "Less"][li()]}</button>${STEPS.length > 10 ? `<div class="dm-prog"><i style="width:${Math.round((step + 1) / STEPS.length * 100)}%"></i></div>` : `<div class="dm-dots">${STEPS.map((_, i) => `<i class="${i === step ? "on" : i < step ? "past" : ""}" data-go="${i}"></i>`).join("")}</div>`}</div>
      ${s.who !== "all" ? `<span class="dm-who w-${s.who}">${RL[s.who][li()]}</span>` : ""}<h2>${esc(s.h[li()])}</h2>${s.p[li()] ? `<p>${esc(s.p[li()])}</p>` : ""}
      ${s.intro ? `<div class="dm-4">${[["guest", "🇰🇷", P("Đặt lịch bằng tiếng Hàn, trả tiền tại cửa hàng, đánh giá KTV", "한국어로 예약 · 매장에서 결제 · 테라피스트 후기", "Books in Korean, pays in store, reviews therapists")],
          ["ud", "🧡", P("Tư vấn, xác nhận, nhắc lịch, phiên dịch, đối soát, thưởng KTV", "상담 · 확정 · 알림 · 통역 · 정산 · 테라피스트 보너스", "Support, confirm, remind, translate, settle, bonus")],
          ["owner", "🏪", P("Nhận lịch, bảng điều hành, lịch làm, đối soát", "예약 수락 · 현황판 · 근무표 · 정산", "Accept, live board, rota, settlement")],
          ["staff", "💆", P("Chấm công, xem ca, xin nghỉ, nhận đánh giá & thưởng", "출퇴근 · 근무 확인 · 휴무 요청 · 후기 · 보너스", "Clock in, shifts, requests, reviews & bonus")]].map(([r, ic, d]) => `<button class="dm-4c" data-role="${r}"><span class="ic">${ic}</span><b>${RL[r][li()].replace(/^\S+\s/, "")}</b><small>${esc(d[li()])}</small></button>`).join("")}</div>
        <div class="dm-pill">💡 ${["Không phí đăng ký · không phí tháng · chỉ trả hoa hồng khi khách đến và thanh toán", "입점비 · 월 고정비 없음 · 손님이 와서 결제했을 때만 수수료", "No sign-up or monthly fee · commission only when guests visit and pay"][li()]}</div>` : ""}
      ${s.more ? `<h3 class="dm-h">${t("endT")}</h3><ul class="dm-more">${MORE.map(([ic, x]) => `<li><span class="ic">${ic}</span><span>${esc(x[li()])}</span></li>`).join("")}</ul><div class="dm-pill">🤝 ${t("cta")}</div>` : ""}
      ${s.act ? `<div class="dm-act ${done ? "ok" : ""}">${done ? t("ok") : `<b>${t("doThis")}</b> ${esc(s.act[li()])}`}</div>` : ""}
      <div class="dm-nav"><button class="dm-btn l" data-step="-1" ${step ? "" : "disabled"}>${t("prev")}</button><button class="dm-btn ${!s.act || done ? "pulse" : ""}" data-step="1">${step === n - 1 ? t("restart") : t("next")}</button></div>`;
  }
  function goStep(i) {
    if (i >= STEPS.length) { reset(); i = 0; }
    step = Math.max(0, i); const s = STEPS[step];
    // 앞 단계를 건너뛰어도 흐름이 이어지게: 예약은 자동으로 수락
    // 다른 입장의 앞 단계는 자동으로 진행돼요 (한 입장만 볼 때도 이야기가 이어지게)
    const cur = STEPS_ALL.findIndex(x => x.key === s.key);
    STEPS_ALL.slice(0, cur).forEach(x => { if (!S.done[x.key] && EFFECT[x.key]) { try { EFFECT[x.key](); } catch (e) {} S.done[x.key] = true; } });
    if (s.tab === "staff") { S.stab = { clockin: "today", swork: "today", srev: "rev", sreq: "rota" }[s.key] || S.stab; if (s.key === "sreq" && !S.sday) S.sday = addDay(vnToday(), 4); }
    if (s.tab) setTab(s.tab); else if (!$("#dmMain").dataset.tab) setTab(firstTab()); else if (tab === "cust") renderCust(); else if (tab === "staff") renderStaff(); else if (tab === "ud") renderUd();
    renderGuide();
    if (innerWidth < 900) { $("#dmGuide").scrollTop = 0; const a = $(".dm-app"); if (a) window.scrollTo({ top: Math.max(0, a.getBoundingClientRect().top + scrollY - 64), behavior: "smooth" }); }
  }
  const TABS = [["cust", "tCust", "guest"], ["ud", "tUd", "ud"], ["book", "tBook", "owner"], ["board", "tBoard", "owner"], ["sched", "tSched", "owner"], ["settle", "tSettle", "owner"], ["staff", "tStaff", "staff"]];
  const firstTab = () => (STEPS.find(x => x.tab) || {}).tab || "board";
  function shell() {
    document.documentElement.lang = lang;
    document.title = "Uncle Day · " + t("title");
    $("#dm").innerHTML = `<header class="dm-hdr"><img src="images/owner-180.png" alt=""><div class="dm-t"><b>${t("title")}</b><small>Spa Mẫu · <span class="dm-demo">${t("demoTag")}</span></small></div>
      <div class="dm-roles">${ROLES.map(r => `<button class="${r === role ? "on" : ""}" data-role="${r}">${RL[r][li()]}</button>`).join("")}</div>
      <div class="dm-langs">${LANGS.map(k => `<button class="${k === lang ? "on" : ""}" data-lang="${k}">${k.toUpperCase()}</button>`).join("")}</div></header>
      <div class="dm-wrap"><aside class="dm-guide" id="dmGuide"></aside>
        <section class="dm-app"><nav class="dm-tabs">${TABS.filter(([k, , w]) => role === "all" || w === role).map(([k, l, w]) => `<button data-tab="${k}" class="w-${w}">${t(l)}</button>`).join("")}<button class="dm-rs" data-reset>${t("restart")}</button></nav>
          <div id="dmMain" data-tab=""></div></section></div>
      <div class="dm-toast" id="dmToast" hidden></div>`;
    const cur = tab; tab = null; $("#dmMain").dataset.tab = ""; setTab(STEPS[step].tab || cur || firstTab()); renderGuide();
  }
  document.addEventListener("change", e => { if (e.target.hasAttribute && e.target.hasAttribute("data-smust")) S.sform.must = e.target.checked; });
  document.addEventListener("click", e => {
    const b = e.target.closest("button, [data-go]"); if (!b) return;
    if (b.dataset.lang) { lang = b.dataset.lang; try { history.replaceState(null, "", `?role=${role}&lang=${lang}`); } catch (x) {} shell(); return; }
    if (b.hasAttribute("data-min")) { gMin = !gMin; renderGuide(); return; }
    if (b.dataset.tab) { setTab(b.dataset.tab); return; }
    if (b.dataset.go != null) { goStep(+b.dataset.go); return; }
    if (b.dataset.step) { goStep(step + +b.dataset.step); return; }
    if (b.hasAttribute("data-reset")) { reset(); step = 0; tab = null; $("#dmMain").dataset.tab = ""; goStep(0); return; }
    if (b.dataset.cs != null) { if (b.dataset.cs === "x") { toast(["Bản demo: hãy chọn Spa Mẫu", "체험판에서는 Spa Mẫu를 눌러 보세요", "Demo: tap Spa Mẫu"][li()]); return; } S.cust.scr = +b.dataset.cs; renderCust(); return; }
    if (b.dataset.cc) { S.cust.course = b.dataset.cc; renderCust(); return; }
    if (b.dataset.ct) { S.cust.time = b.dataset.ct; renderCust(); return; }
    if (b.dataset.cp) { S.cust.people = Math.max(1, Math.min(4, S.cust.people + +b.dataset.cp)); renderCust(); return; }
    if (b.hasAttribute("data-send")) { sendBooking(); renderCust(); toast(["🔔 Điện thoại chủ cửa hàng: có yêu cầu đặt lịch mới", "🔔 사장님 휴대폰: 새 예약 요청이 왔어요", "🔔 Owner's phone: new booking request"][li()]); return; }
    if (b.dataset.star) { S.cust.stars[b.dataset.tp] = +b.dataset.star; renderCust(); return; }
    if (b.hasAttribute("data-rev")) { S.cust.reviewed = true; mark("review"); renderCust(); return; }
    if (b.dataset.stab) { S.stab = b.dataset.stab; renderStaff(); return; }
    if (b.dataset.sclock) { const l = linh(); if (b.dataset.sclock === "in") { clockIn(); mark("clockin"); toast(["Đã chấm công vào · Bảng điều hành cập nhật", "출근했어요 · 매장 현황판에 바로 반영돼요", "Clocked in · the shop board updated"][li()]); } else { l.out_at = new Date().toISOString(); } renderStaff(); return; }
    if (b.dataset.sday) { S.sday = S.sday === b.dataset.sday ? null : b.dataset.sday; renderStaff(); return; }
    if (b.dataset.stype) { S.sform.type = b.dataset.stype; renderStaff(); return; }
    if (b.hasAttribute("data-ssend")) { const f = S.sform; addReq(S.sday, f.type === "swap" ? "off" : f.type, f.type === "off" ? ["Về quê thăm bố mẹ", "고향에 부모님 뵈러 가요", "Visiting my parents"] : f.type === "shift" ? ["Muốn làm ca tối", "마감조로 하고 싶어요", "Prefer the closing shift"] : ["Đổi với Mai", "Mai와 교대", "Swap with Mai"], f.must, f.type === "shift" ? "B" : null); S.sday = null; mark("sreq"); toast(["Đã gửi · chủ cửa hàng sẽ thấy ở 📅 Lịch làm", "보냈어요 · 사장님 근무표에 바로 떠요", "Sent · the owner sees it in the rota"][li()]); renderStaff(); return; }
    if (b.hasAttribute("data-sqr")) { toast(["Khách quét QR → chọn đúng KTV đã làm cho mình → viết đánh giá", "손님이 QR을 찍으면 자기 담당 테라피스트를 골라 후기를 써요", "Guest scans → picks their therapist → writes a review"][li()]); return; }
    if (b.hasAttribute("data-scar")) { S.career = !S.career; if (!S.career) S.open2work = false; renderStaff(); return; }
    if (b.hasAttribute("data-so2w")) { S.open2work = !S.open2work; renderStaff(); return; }
    if (b.hasAttribute("data-udok")) { b1().status = "confirmed"; mark("udconfirm"); toast(["Đã xác nhận · khách nhận tin KakaoTalk tiếng Hàn", "확정했어요 · 손님에게 카카오톡 안내가 가요", "Confirmed · guest gets a Korean KakaoTalk"][li()]); renderUd(); return; }
    if (b.hasAttribute("data-udbonus")) { S.bonusPaid = true; mark("bonus"); renderUd(); return; }
    if (b.dataset.role) { role = b.dataset.role; buildFlow(); try { history.replaceState(null, "", `?role=${role}&lang=${lang}`); } catch (x) {} reset(); step = 0; tab = null; shell(); goStep(0); return; }
    if (b.dataset.sm) { S.smode = b.dataset.sm; renderSettle(); return; }
    if (b.dataset.acc) { const x = S.bookings.find(y => y.id === b.dataset.acc); x.status = "shop_ok"; toast(t("acceptToast")); renderBook(); mark("accept"); return; }
    if (b.dataset.dec) { toast(["Bản demo: hãy bấm Nhận để xem tiếp", "체험판에서는 '수락'을 눌러 다음으로 가 보세요", "Demo: press Accept to continue"][li()]); return; }
  });
  reset();
  shell();
})();

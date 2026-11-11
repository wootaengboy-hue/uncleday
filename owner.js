/* 엉클데이 사장님 페이지 (1단계: 예약 받기)
   - 전화번호 + 비밀번호 로그인 (계정은 관리자 페이지에서 만들어요)
   - 오늘 / 예약 / 일정 / 더보기
   - 예약 답하기는 업체 링크(partner.html)와 같은 규칙 (owner_reply → shop_reply)
   - 손님 연락처는 보이지 않아요 */
(() => {
  const $app = document.getElementById("app");
  const LANGS = ["vi", "ko", "en"];
  let lang = (() => { try { const l = localStorage.getItem("ud-owner-lang"); return LANGS.includes(l) ? l : "vi"; } catch (e) { return "vi"; } })();
  const T = {
    title: ["Trang chủ sở hữu", "사장님 페이지", "Owner page"],
    loginTitle: ["Đăng nhập cho chủ cửa hàng", "사장님 로그인", "Owner login"],
    loginNote: ["Uncle Day tạo tài khoản sau khi ký hợp đồng. Lần đầu đăng nhập, hãy đổi mật khẩu.", "계약 후 엉클데이가 계정을 만들어 드려요. 처음 로그인하면 비밀번호를 바꿔 주세요.", "Uncle Day creates your account after signing. Change your password on first login."],
    phone: ["Số điện thoại", "전화번호", "Phone number"],
    pw: ["Mật khẩu", "비밀번호", "Password"],
    loginBtn: ["Đăng nhập", "로그인", "Log in"],
    loginFail: ["Sai số điện thoại hoặc mật khẩu.", "전화번호 또는 비밀번호가 맞지 않아요.", "Wrong phone number or password."],
    forgot: ["Quên mật khẩu? Nhắn Uncle Day qua Zalo để nhận mật khẩu mới.", "비밀번호를 잊었으면 잘로로 엉클데이에 연락해 새 비밀번호를 받으세요.", "Forgot your password? Message Uncle Day on Zalo for a new one."],
    noShop: ["Tài khoản này chưa được gắn với cửa hàng nào. Hãy liên hệ Uncle Day.", "이 계정에 연결된 업체가 없어요. 엉클데이에 문의해 주세요.", "This account isn't linked to a shop yet. Please contact Uncle Day."],
    newPwTitle: ["Đặt mật khẩu mới", "새 비밀번호 정하기", "Set a new password"],
    newPwNote: ["Bạn đang dùng mật khẩu tạm. Hãy đặt mật khẩu riêng (ít nhất 8 ký tự).", "임시 비밀번호로 들어왔어요. 나만의 비밀번호로 바꿔 주세요 (8자 이상).", "You're using a temporary password. Set your own (at least 8 characters)."],
    newPw: ["Mật khẩu mới", "새 비밀번호", "New password"],
    newPw2: ["Nhập lại mật khẩu mới", "새 비밀번호 다시 입력", "Repeat new password"],
    pwShort: ["Mật khẩu cần ít nhất 8 ký tự.", "8자 이상으로 정해 주세요.", "Use at least 8 characters."],
    pwDiff: ["Hai mật khẩu không giống nhau.", "두 비밀번호가 달라요.", "The passwords don't match."],
    save: ["Lưu", "저장", "Save"],
    tabSettle: ["Đối soát", "정산", "Statement"],
    settleTitle: ["Đối soát tháng", "월별 정산", "Monthly statement"],
    sVisits: ["Lượt khách đã đến", "방문 완료", "Completed visits"], sPaid: ["Tổng khách đã trả", "손님 결제 합계", "Total paid by guests"], sFee: ["Phí Uncle Day", "엉클데이 수수료", "Uncle Day fee"],
    sStatus: ["Trạng thái", "상태", "Status"], sOpen: ["Đang tính (chưa lập)", "집계 중 (정산서 전)", "In progress"], sBilled: ["Đã gửi bảng đối soát · chờ thanh toán", "정산서 발송 · 입금 대기", "Statement sent · awaiting payment"], sPaidSt: ["Đã thanh toán", "입금 완료", "Paid"],
    sRows: ["Từng lịch hẹn", "예약별 내역", "Each booking"], sNone: ["Tháng này chưa có khách đến.", "이 달에는 방문 완료된 예약이 없어요.", "No completed visits this month."],
    sOnly: ["Chỉ chủ cửa hàng mới xem được đối soát.", "정산은 사장님 계정만 볼 수 있어요.", "Only the owner can see statements."],
    sNote: ["Phí được tính trên số tiền khách đã trả theo hợp đồng. Nếu số tiền sai, hãy sửa ở lịch hẹn hoặc nhắn Uncle Day trước khi lập bảng đối soát.", "수수료는 계약에 따라 손님 결제 금액으로 계산돼요. 금액이 틀리면 정산서가 나오기 전에 엉클데이에 알려 주세요.", "The fee is calculated from the amount paid, per your contract. If an amount is wrong, tell Uncle Day before the statement is made."],
    sSettled: ["đã đối soát", "정산됨", "settled"],
    sTotal: ["Tổng doanh thu tháng", "이 달 총 매출", "Total sales this month"], sUD: ["Khách Uncle Day", "엉클데이 예약 손님", "Uncle Day bookings"], sWalk: ["Khách vãng lai (tại quầy)", "현장 손님 (워크인)", "Walk-in guests"],
    sWalkN: ["Lượt khách", "손님", "Guests"], sWalkPaid: ["Doanh thu", "매출", "Sales"], sNoFee: ["Không tính phí", "수수료 없음", "No fee"], sWalkNote: ["Doanh thu khách vãng lai lấy từ Bảng phòng (khi bấm Xong). Uncle Day không tính phí phần này.", "현장 손님 매출은 현황판에서 '끝내기'를 누를 때 기록돼요. 엉클데이 수수료는 붙지 않아요.", "Walk-in sales come from the Board (when you tap Finish). No Uncle Day fee."],
    sAll: ["Tất cả", "전체", "All"], tagUD: ["Uncle Day", "엉클데이", "Uncle Day"], tagWalk: ["Tại quầy", "현장", "Walk-in"], sRowsAll: ["Từng lượt khách", "손님별 내역", "Each visit"], sNoneAll: ["Tháng này chưa có lượt khách nào.", "이 달에는 기록된 손님이 없어요.", "No visits this month."],
    sStmt: ["Trong bảng đối soát đã gửi", "보낸 정산서에 포함", "In the sent statement"],
    tabBoard: ["Bảng phòng", "현황판", "Board"],
    shopToday: ["Cửa hàng hôm nay", "오늘 매장", "Shop today"], lgIdle: ["Đang chờ", "대기 중", "Free"], lgWork: ["Đang làm", "시술 중", "In session"], lgOff: ["Chưa vào / đã về", "출근 전 · 퇴근", "Not in / gone"], lgDay: ["Nghỉ", "휴무", "Day off"], ssBefore: ["Mở lúc {n}", "{n} 오픈 예정", "Opens {n}"], ssOpen: ["Đang mở cửa", "영업 중", "Open"], ssAfter: ["Đã đóng cửa", "영업 종료", "Closed"], ssDayoff: ["Nghỉ hôm nay", "오늘 휴무일", "Closed today"], bIn: ["Đi làm", "출근", "Clocked in"], bWork: ["Đang làm", "시술 중", "In session"], bWait: ["Khách chờ", "대기 · 올 손님", "Waiting"], bDone: ["Xong · doanh thu", "완료 · 매출", "Done · revenue"],
    openBoard: ["Mở bảng phòng", "현황판 열기", "Open board"], boardStart: ["Bắt đầu bảng phòng", "현황판 시작하기", "Start the room board"], boardStartS: ["Nhập phòng, dịch vụ và nhân viên một lần", "방 · 코스 · 직원을 한 번만 넣으면 돼요", "Add rooms, services and staff once"], soonT: ["Sắp có", "곧 추가", "Coming soon"],
    rotaT: ["Lịch làm của nhân viên", "직원 근무표", "Staff rota"], rotaS: ["Xếp ca mở cửa · đóng cửa · nghỉ, duyệt yêu cầu", "오픈조 · 마감조 · 휴무 짜기, 요청 승인", "Plan opening · closing · days off, approve requests"],
    tabHome: ["Hôm nay", "오늘", "Today"], tabBookings: ["Đặt lịch", "예약", "Bookings"], tabSchedule: ["Lịch", "일정", "Schedule"], tabMore: ["Thêm", "더보기", "More"],
    install: ["Cài Uncle Day lên màn hình chính để mở nhanh như ứng dụng", "홈 화면에 설치하면 앱처럼 바로 열 수 있어요", "Add Uncle Day to your home screen to open it like an app"],
    installBtn: ["Cách cài", "설치 방법", "How to"],
    installAndroid: ["Android (Chrome): bấm ⋮ ở góc trên → \"Thêm vào màn hình chính\" hoặc \"Cài đặt ứng dụng\".", "안드로이드(크롬): 오른쪽 위 ⋮ → '홈 화면에 추가' 또는 '앱 설치'", "Android (Chrome): tap ⋮ at the top → \"Add to Home screen\" or \"Install app\"."],
    installIos: ["iPhone (Safari): bấm nút Chia sẻ (ô vuông có mũi tên) → \"Thêm vào MH chính\".", "아이폰(사파리): 공유 버튼(네모에 화살표) → '홈 화면에 추가'", "iPhone (Safari): tap Share (square with arrow) → \"Add to Home Screen\"."],
    needReply: ["Cần trả lời", "답해야 할 예약", "Needs your reply"],
    replyGoal: ["Trả lời trong 30 phút", "30분 안에 답해 주세요", "Reply within 30 min"],
    noReqs: ["Không có yêu cầu mới.", "새 예약 요청이 없어요.", "No new requests."],
    todayGuests: ["Khách hôm nay", "오늘 방문", "Today's guests"],
    noToday: ["Hôm nay chưa có khách.", "오늘 방문 예정인 손님이 없어요.", "No guests today."],
    next7: ["7 ngày tới", "앞으로 7일", "Next 7 days"],
    monthTitle: ["Tháng này", "이번 달", "This month"],
    statVisits: ["Khách đã đến", "방문 완료", "Visits"], statPaid: ["Khách đã trả", "결제 합계", "Paid by guests"], statReply: ["Trả lời TB", "평균 답변", "Avg. reply"],
    min: ["phút", "분", "min"],
    dueLeft: ["còn {n}", "{n} 남음", "{n} left"], dueLate: ["trễ {n}", "{n} 지남", "{n} late"],
    mins: ["{n} phút", "{n}분", "{n} min"], hours: ["{n} giờ", "{n}시간", "{n} h"], days: ["{n} ngày", "{n}일", "{n} d"],
    people: ["{n} khách", "{n}명", "{n} guests"],
    today: ["Hôm nay", "오늘", "Today"], tomorrow: ["Ngày mai", "내일", "Tomorrow"],
    st_requested: ["Chờ bạn trả lời", "답변 필요", "Needs reply"],
    st_shop_ok: ["Đã nhận · chờ xác nhận", "수락 · 확정 대기", "Accepted · confirming"],
    st_confirmed: ["Đã xác nhận", "확정", "Confirmed"],
    st_rejected: ["Đã báo không nhận", "불가로 답함", "Declined"],
    st_reschedule: ["Đang hỏi khách giờ mới", "손님에게 새 시간 안내 중", "Asking guest for a new time"],
    st_visited: ["Khách đã đến", "방문 완료", "Visited"],
    st_settled: ["Đã đối soát", "정산 완료", "Settled"],
    st_noshow: ["Không đến", "노쇼", "No-show"],
    st_cancelled: ["Đã huỷ", "취소", "Cancelled"],
    bt_new: ["Mới", "새 요청", "New"], bt_up: ["Sắp tới", "진행 중", "Upcoming"], bt_past: ["Đã qua", "지난 예약", "Past"], bt_closed: ["Huỷ / không nhận", "취소·불가", "Cancelled / declined"],
    emptyList: ["Chưa có đặt lịch nào ở đây.", "여기에 해당하는 예약이 없어요.", "Nothing here yet."],
    code: ["Mã", "예약번호", "Code"], when: ["Thời gian", "방문 시간", "Time"], service: ["Dịch vụ", "메뉴", "Service"], guests: ["Số khách", "인원", "Guests"],
    listPrice: ["Giá dự kiến", "예상 금액", "Expected price"], guestLang: ["Ngôn ngữ khách", "손님 언어", "Guest language"], note: ["Yêu cầu của khách", "손님 요청 사항", "Guest request"],
    langName: { ko: ["Tiếng Hàn", "한국어", "Korean"], en: ["Tiếng Anh", "영어", "English"], vi: ["Tiếng Việt", "베트남어", "Vietnamese"] },
    contactHidden: ["Uncle Day liên lạc với khách thay bạn. Số điện thoại của khách không hiển thị ở đây.", "손님 연락은 엉클데이가 대신해요. 손님 연락처는 여기 보이지 않아요.", "Uncle Day contacts the guest for you. The guest's contact details aren't shown here."],
    accept: ["Nhận lịch này", "이 예약 받을게요", "Accept"],
    cant: ["Giờ này không được → đề xuất giờ khác", "이 시간은 안 돼요 → 다른 시간 제안", "Can't do this time → suggest others"],
    cantLater: ["Có việc đột xuất, không nhận được nữa", "사정이 생겨 받을 수 없어요", "Something came up, can't take it"],
    proposeTitle: ["Chọn giờ khác có thể nhận (tối đa 3)", "가능한 다른 시간을 고르세요 (최대 3개)", "Pick other times you can do (up to 3)"],
    proposeDay: ["Ngày", "날짜", "Day"],
    sendPropose: ["Gửi {n} giờ khác", "다른 시간 {n}개 보내기", "Send {n} other times"],
    pickFirst: ["Chọn ít nhất 1 giờ, hoặc bấm bên dưới", "시간을 1개 이상 고르거나 아래를 눌러 주세요", "Pick at least one time, or tap below"],
    rejectNoTime: ["Không có giờ nào khác được", "다른 시간도 모두 어려워요", "No other time works"],
    back: ["Quay lại", "돌아가기", "Back"],
    memo: ["Ghi chú cho Uncle Day (không bắt buộc)", "엉클데이에 남길 메모 (선택)", "Note for Uncle Day (optional)"],
    waitUD: ["Bạn đã nhận. Uncle Day đang xác nhận với khách và sẽ báo bạn.", "수락했어요. 엉클데이가 손님에게 확정 안내 후 알려 드려요.", "You accepted. Uncle Day is confirming with the guest and will let you know."],
    waitRejected: ["Bạn đã báo không nhận giờ này. Uncle Day đang hỏi khách.", "이 시간은 불가로 답했어요. 엉클데이가 손님에게 확인하고 있어요.", "You declined this time. Uncle Day is checking with the guest."],
    yourTimes: ["Giờ bạn đề xuất", "제안한 시간", "Times you suggested"],
    waitResched: ["Uncle Day đang hỏi khách chọn giờ mới.", "엉클데이가 손님에게 새 시간을 묻고 있어요.", "Uncle Day is asking the guest to pick a new time."],
    offered: ["Giờ đang hỏi khách", "손님에게 안내한 시간", "Times offered to the guest"],
    paidLabel: ["Số tiền khách đã trả (₫)", "손님이 결제한 금액 (₫)", "Amount the guest paid (₫)"],
    paidHint: ["Tổng cho tất cả khách trong lịch này. Dùng để đối soát cuối tháng.", "이 예약 인원 전체 합계예요. 월말 정산에 쓰여요.", "Total for everyone in this booking. Used for the month-end statement."],
    arrived: ["Khách đã đến · lưu số tiền", "방문 완료 · 금액 저장", "Guest arrived · save amount"],
    noshow: ["Khách không đến", "안 오셨어요 (노쇼)", "Guest did not come"],
    noshowAsk: ["Ghi nhận khách không đến?", "노쇼로 기록할까요?", "Record as a no-show?"],
    paidShort: ["Khách đã trả", "결제 금액", "Paid"],
    visitedNote: ["Phí Uncle Day được tính trong bảng đối soát cuối tháng.", "엉클데이 수수료는 월말 정산에 반영돼요.", "Uncle Day's fee goes into the month-end statement."],
    beforeVisit: ["Sau giờ hẹn, bạn sẽ nhập số tiền khách đã trả ở đây.", "방문 시간이 지나면 여기서 결제 금액을 넣어요.", "After the visit, enter the amount paid here."],
    noshowNote: ["Đã ghi nhận khách không đến.", "노쇼로 기록됐어요.", "Recorded as a no-show."],
    cancelNote: ["Lịch này đã huỷ.", "취소된 예약이에요.", "This booking was cancelled."],
    tAccepted: ["Đã nhận lịch. Uncle Day sẽ xác nhận với khách.", "수락했어요. 엉클데이가 손님에게 확정 안내해요.", "Accepted. Uncle Day will confirm with the guest."],
    tProposed: ["Đã gửi giờ khác cho Uncle Day.", "다른 시간을 엉클데이에 보냈어요.", "Other times sent to Uncle Day."],
    tRejected: ["Đã báo không nhận.", "불가로 답했어요.", "Declined."],
    tVisited: ["Đã lưu: khách đã đến.", "방문 완료로 저장했어요.", "Saved as visited."],
    tpOpt: ["KTV phụ trách (không bắt buộc)", "담당 테라피스트 (선택)", "Therapist (optional)"], tpOptHint: ["Không nhớ thì để trống. Có thể thêm sau ở Bảng phòng → Lịch sử.", "모르면 비워 두세요. 나중에 현황판 → 기록에서 넣을 수 있어요.", "Leave empty if unsure. You can add it later in Board → History."],
    tpSave: ["Lưu KTV phụ trách", "담당 저장", "Save therapist"], tpSaved: ["Đã lưu KTV phụ trách.", "담당을 저장했어요.", "Therapist saved."], tpNone: ["Chưa có KTV phụ trách.", "아직 담당이 기록되지 않았어요.", "No therapist recorded yet."], tpMax: ["Tối đa 4 người.", "4명까지 고를 수 있어요.", "Up to 4."],
    tNoshow: ["Đã ghi nhận: khách không đến.", "노쇼로 기록했어요.", "Recorded as a no-show."],
    tSaved: ["Đã lưu.", "저장했어요.", "Saved."],
    tNew: ["Có đặt lịch mới!", "새 예약이 들어왔어요!", "New booking!"],
    tErr: ["Có lỗi, hãy thử lại.", "문제가 생겼어요. 다시 해 주세요.", "Something went wrong. Please try again."],
    needAmount: ["Hãy nhập số tiền khách đã trả.", "결제 금액을 넣어 주세요.", "Please enter the amount paid."],
    dayTitle: ["Lịch theo ngày", "날짜별 시간", "By day"],
    dayOff: ["Nghỉ cả ngày này", "이 날 휴무", "Close this day"],
    weeklyOff: ["Ngày nghỉ hàng tuần (đổi ở Giờ mở cửa bên dưới)", "매주 쉬는 요일이에요 (아래 영업시간에서 바꿔요)", "Weekly day off (change it in Opening hours below)"],
    dayHint: ["Chạm vào giờ để khoá hoặc mở. Giờ đã khoá sẽ không hiện cho khách.", "시간을 누르면 막기·풀기. 막은 시간은 손님에게 안 보여요.", "Tap a time to block or open it. Blocked times are hidden from guests."],
    lgFree: ["Trống", "비어 있음", "Free"], lgBooked: ["Có khách", "예약 있음", "Booked"], lgFull: ["Đầy", "꽉 참", "Full"], lgBlocked: ["Đã khoá", "막음", "Blocked"],
    blocked: ["khoá", "막음", "blocked"],
    hoursTitle: ["Giờ mở cửa", "영업시간", "Opening hours"], closed: ["Nghỉ", "휴무", "Closed"],
    capTitle: ["Số khách cùng lúc", "동시에 받을 수 있는 손님", "Guests at the same time"], capHint: ["Bằng số giường hoặc phòng", "베드·룸 수만큼", "Number of beds or rooms"],
    cutTitle: ["Khách phải đặt trước ít nhất", "예약 마감", "Minimum notice before a booking"],
    cutOpt: ["{n} giờ", "{n}시간 전", "{n} h"],
    saveHours: ["Lưu giờ mở cửa", "영업시간 저장", "Save opening hours"],
    staffOnly: ["Chỉ chủ cửa hàng mới đổi được giờ mở cửa.", "영업시간은 사장님 계정만 바꿀 수 있어요.", "Only the owner can change opening hours."],
    unsaved: ["Chưa lưu", "저장 안 됨", "Not saved"],
    wd: [["T2", "T3", "T4", "T5", "T6", "T7", "CN"], ["월", "화", "수", "목", "금", "토", "일"], ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]],
    wdLong: [["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"], ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"], ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]],
    mShop: ["Cửa hàng", "업체", "Shop"], mLang: ["Ngôn ngữ", "언어", "Language"], mInstall: ["Cài lên màn hình chính", "홈 화면에 설치", "Add to home screen"],
    mPw: ["Đổi mật khẩu", "비밀번호 변경", "Change password"], mLogout: ["Đăng xuất", "로그아웃", "Log out"],
    mAccount: ["Tài khoản", "계정", "Account"], roleOwner: ["Chủ", "사장님", "Owner"], roleStaff: ["Nhân viên", "직원", "Staff"],
    soon: ["Màn hình nhân viên (lịch làm, xin nghỉ), đánh giá KTV, thông báo trên điện thoại.", "직원 화면(근무표·휴무 요청), 테라피스트 후기, 휴대폰 알림", "Staff screen (rota, day-off requests), therapist reviews, phone alerts."],
    contactUD: ["Cần hỗ trợ? Nhắn Uncle Day qua Zalo như trước.", "도움이 필요하면 지금처럼 잘로로 엉클데이에 연락하세요.", "Need help? Message Uncle Day on Zalo as usual."],
    refresh: ["Làm mới", "새로고침", "Refresh"]
  };
  const li = () => LANGS.indexOf(lang);
  const t = (k, n) => { const v = T[k]; const s = Array.isArray(v) ? v[li()] : v; return n != null && typeof s === "string" ? s.replace("{n}", n) : s; };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const vnd = n => String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "₫";
  const digits = s => String(s || "").replace(/\D/g, "");

  // 베트남 시간 기준 날짜·시각
  const vnNow = () => { const d = new Date(Date.now() + 7 * 3600e3); return d; };   // UTC 필드로 읽어요
  const ymd = d => d.toISOString().slice(0, 10);
  const today = () => ymd(vnNow());
  const addDays = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
  const wdIdx = s => (new Date(s + "T00:00:00Z").getUTCDay() + 6) % 7;   // 월=0 … 일=6
  const toMin = x => +x.slice(0, 2) * 60 + +x.slice(3, 5);
  const toStr = m => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  const dateLabel = s => { const td = today(); if (s === td) return t("today"); if (s === addDays(td, 1)) return t("tomorrow"); const d = new Date(s + "T00:00:00Z"); return `${T.wd[li()][wdIdx(s)]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`; };

  // ---- 상태 ----
  let sb = null, me = null, shopId = null, rows = [], sched = null, hoursDraft = null;
  let tab = "home", bTab = "new", detail = null, proposing = false, picks = [], pDay = null, schedDay = null, toastMsg = "", busy = false;
  let knownReq = null, pollTimer = null, boardPending = 0, boardView = null, boardSum = null;
  const store = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };
  const read = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };

  function toast(m) { toastMsg = m; drawToast(); clearTimeout(toast.t); toast.t = setTimeout(() => { toastMsg = ""; drawToast(); }, 2800); }
  function drawToast() { let el = document.getElementById("toast"); if (!toastMsg) { if (el) el.remove(); return; } if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); } el.textContent = toastMsg; }
  const rpc = async (fn, args) => { const { data, error } = await sb.rpc(fn, args || {}); if (error) throw error; return data; };
  const errMsg = e => (e && e.message && !/fetch|network/i.test(e.message)) ? e.message : t("tErr");

  // ---- 공통 조각 ----
  const langBtns = () => `<div class="langs">${LANGS.map(l => `<button class="lg ${l === lang ? "on" : ""}" data-lang="${l}">${l.toUpperCase()}</button>`).join("")}</div>`;
  const shopName = s => s && s.name ? (s.name[lang] || s.name.vi || s.name.en || s.name.ko || s.id) : "";
  const curShop = () => me && me.shops.find(s => s.id === shopId);
  const isOwner = () => { const s = curShop(); return s && s.role === "owner"; };
  const menuLabel = b => { const n = b.menu && b.menu.name ? (b.menu.name[lang] || b.menu.name.vi || b.menu_name) : b.menu_name; return `${n || "-"}${b.menu_min ? ` · ${b.menu_min} ${t("min")}` : ""}`; };
  const badge = st => "bd " + ({ requested: "ask", shop_ok: "wait", confirmed: "ok", rejected: "wait", reschedule: "wait", visited: "done", settled: "done", noshow: "bad", cancelled: "bad" }[st] || "wait");
  const dur = m => m >= 1440 ? t("days", Math.floor(m / 1440)) : m >= 60 ? t("hours", Math.floor(m / 60)) : t("mins", m);
  const dueOf = b => { const base = Date.parse(b.sent_to_shop_at || b.created_at); const left = Math.round((base + 30 * 60e3 - Date.now()) / 60e3); return left >= 0 ? { late: false, text: t("dueLeft", dur(left)) } : { late: true, text: t("dueLate", dur(-left)) }; };
  const row = (b, withDate) => `<button class="trow" data-open="${b.id}"><div class="tm">${esc(b.visit_time || "--:--")}${withDate ? `<small>${esc(dateLabel(b.visit_date))}</small>` : ""}</div>
      <div class="grow"><span class="nm">${esc(b.customer_name || "-")} · ${t("people", b.people)}</span><span class="sub">${esc(menuLabel(b))}</span></div>
      <span class="${badge(b.status)}">${t("st_" + b.status)}</span></button>`;

  // ---- 화면: 로그인 ----
  function drawLogin(err) {
    $app.classList.remove("in");
    $app.innerHTML = `<div class="login">
      <div class="row"><img src="images/owner-192.png" alt="Uncle Day"><div class="grow"></div>${langBtns()}</div>
      <div><h1>${t("loginTitle")}</h1><p class="muted" style="margin:6px 0 0">${t("loginNote")}</p></div>
      <form id="lf" style="display:flex;flex-direction:column;gap:14px">
        <label><span class="lbl">${t("phone")}</span><input class="inp" name="phone" type="tel" inputmode="tel" autocomplete="username" placeholder="0905 123 456" value="${esc(read("ud-owner-phone") || "")}" required></label>
        <label><span class="lbl">${t("pw")}</span><input class="inp" name="pw" type="password" autocomplete="current-password" required></label>
        ${err ? `<p class="err">${esc(err)}</p>` : ""}
        <button class="btn main">${t("loginBtn")}</button>
      </form>
      <p class="muted">${t("forgot")}</p></div>`;
    bindLang();
    const f = document.getElementById("lf");
    f.onsubmit = async e => {
      e.preventDefault();
      let d = digits(f.phone.value); if (d.startsWith("0")) d = "84" + d.slice(1);
      if (d.length < 10) { drawLogin(t("loginFail")); return; }
      f.classList.add("spin");
      const { error } = await sb.auth.signInWithPassword({ email: `${d}@owner.uncleday.com`, password: f.pw.value });
      if (error) { drawLogin(t("loginFail")); return; }
      store("ud-owner-phone", f.phone.value.trim());
      start();
    };
  }

  // ---- 화면: 새 비밀번호 ----
  function drawNewPw(err) {
    $app.classList.remove("in");
    $app.innerHTML = `<div class="login">
      <div class="row"><img src="images/owner-192.png" alt="Uncle Day"><div class="grow"></div>${langBtns()}</div>
      <div><h1>${t("newPwTitle")}</h1><p class="muted" style="margin:6px 0 0">${t("newPwNote")}</p></div>
      <form id="pf" style="display:flex;flex-direction:column;gap:14px">
        <label><span class="lbl">${t("newPw")}</span><input class="inp" name="a" type="password" autocomplete="new-password" minlength="8" required></label>
        <label><span class="lbl">${t("newPw2")}</span><input class="inp" name="b" type="password" autocomplete="new-password" minlength="8" required></label>
        ${err ? `<p class="err">${esc(err)}</p>` : ""}
        <button class="btn main">${t("save")}</button>
      </form>
      ${me && !me.must_change_pw ? `<button class="btn ghost" id="pwBack">${t("back")}</button>` : ""}</div>`;
    bindLang();
    const f = document.getElementById("pf");
    const bk = document.getElementById("pwBack"); if (bk) bk.onclick = () => draw();
    f.onsubmit = async e => {
      e.preventDefault();
      if (f.a.value.length < 8) return drawNewPw(t("pwShort"));
      if (f.a.value !== f.b.value) return drawNewPw(t("pwDiff"));
      f.classList.add("spin");
      const { error } = await sb.auth.updateUser({ password: f.a.value });
      if (error) return drawNewPw(errMsg(error));
      try { await rpc("owner_pw_changed"); } catch (e2) {}
      if (me) me.must_change_pw = false;
      toast(t("tSaved")); begin();
    };
  }

  // ---- 앱 틀 ----
  function draw() {
    if (!me) return;
    const s = curShop(), reqN = rows.filter(b => b.status === "requested").length;
    document.title = (reqN ? `(${reqN}) ` : "") + "Uncle Day · " + shopName(s);
    $app.classList.add("in");
    $app.classList.toggle("wide", tab === "board");
    $app.innerHTML = `<header class="hdr"><img src="images/owner-192.png" alt="Uncle Day">
        <div class="shop"><b>${esc(shopName(s))}</b><small>${t("title")}</small></div>${langBtns()}</header>
      <main class="body" id="main"></main>
      <nav class="tabs" aria-label="menu">
        ${tabBtn("home", t("tabHome"), '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>')}
        ${tabBtn("bookings", t("tabBookings"), '<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/>', reqN)}
        ${window.OwnerBoard ? tabBtn("board", t("tabBoard"), '<rect x="3" y="4" width="8" height="7" rx="1.5"/><rect x="13" y="4" width="8" height="7" rx="1.5"/><rect x="3" y="13" width="8" height="7" rx="1.5"/><rect x="13" y="13" width="8" height="7" rx="1.5"/>', boardPending) : ""}
        ${tabBtn("schedule", t("tabSchedule"), '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')}
        ${tabBtn("settle", t("tabSettle"), '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>')}
        ${tabBtn("more", t("tabMore"), '<path d="M4 7h16M4 12h16M4 17h16"/>')}
      </nav>`;
    bindLang();
    $app.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { tab = b.dataset.tab; if (tab === "home" || tab === "bookings") load(true); if (tab === "schedule" && !sched) loadSched(); if (tab === "settle") loadSettle(settle && settle.month); draw(); window.scrollTo(0, 0); });
    const m = document.getElementById("main");
    if (tab === "board" && window.OwnerBoard) { window.OwnerBoard.mount(m, { view: boardView, rpc, shopId, lang, isOwner: isOwner(), toast, errMsg, onPending: n => { boardView = null; if (n !== boardPending) { boardPending = n; const d = $app.querySelector('[data-tab="board"] .dot'); if (d) d.textContent = n || ""; else if (n) { const b = $app.querySelector('[data-tab="board"]'); if (b) b.insertAdjacentHTML("beforeend", `<span class="dot">${n}</span>`); } } } }); drawDetail(); return; }
    if (window.OwnerBoard) window.OwnerBoard.unmount();
    if (tab === "home") m.innerHTML = homeHtml();
    else if (tab === "bookings") m.innerHTML = bookingsHtml();
    else if (tab === "schedule") m.innerHTML = scheduleHtml();
    else if (tab === "settle") m.innerHTML = settleHtml();
    else m.innerHTML = moreHtml();
    bindMain(m);
    drawDetail();
  }
  const tabBtn = (k, label, path, n) => `<button class="tab ${tab === k ? "on" : ""}" data-tab="${k}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>${label}${n ? `<span class="dot">${n}</span>` : ""}</button>`;
  function bindLang() { $app.querySelectorAll("[data-lang]").forEach(b => b.onclick = () => { lang = b.dataset.lang; store("ud-owner-lang", lang); document.documentElement.lang = lang; me ? (me.must_change_pw ? drawNewPw() : draw()) : drawLogin(); }); }

  // ---- 오늘 ----
  const standalone = () => window.matchMedia && (matchMedia("(display-mode: standalone)").matches || navigator.standalone);
  function homeHtml() {
    const td = today(), reqs = rows.filter(b => b.status === "requested").sort((a, b) => Date.parse(a.sent_to_shop_at || a.created_at) - Date.parse(b.sent_to_shop_at || b.created_at));
    const todays = rows.filter(b => b.visit_date === td && !["cancelled", "rejected"].includes(b.status)).sort((a, b) => (a.visit_time || "").localeCompare(b.visit_time || ""));
    const soon = rows.filter(b => b.visit_date > td && b.visit_date <= addDays(td, 7) && ["shop_ok", "confirmed", "reschedule"].includes(b.status)).sort((a, b) => (a.visit_date + a.visit_time).localeCompare(b.visit_date + b.visit_time));
    const mo = td.slice(0, 7), mine = rows.filter(b => (b.visit_date || "").startsWith(mo) && ["visited", "settled"].includes(b.status));
    const paid = mine.reduce((a, b) => a + (+b.paid_amount || 0), 0);
    const replied = rows.filter(b => b.shop_replied_at && (b.created_at || "").startsWith(mo)).map(b => (Date.parse(b.shop_replied_at) - Date.parse(b.sent_to_shop_at || b.created_at)) / 60e3).filter(x => x >= 0 && x < 24 * 60);
    const avg = replied.length ? Math.round(replied.reduce((a, b) => a + b, 0) / replied.length) : null;
    return `${!standalone() && read("ud-owner-inst") !== "x" ? `<div class="inst"><p>${t("install")}</p><button data-act="inst">${t("installBtn")}</button><button class="x" data-act="instx" aria-label="close">✕</button></div>` : ""}
      <div class="cols"><div class="col">
      <div class="sec"><h2>${t("needReply")} (${reqs.length})</h2><span>${t("replyGoal")}</span></div>
      ${reqs.length ? reqs.map(b => { const d = dueOf(b); return `<button class="req ${d.late ? "late" : ""}" data-open="${b.id}"><div class="tm">${esc(b.visit_time || "--:--")}<small>${esc(dateLabel(b.visit_date))}</small></div>
          <div class="grow"><span class="nm">${esc(b.customer_name || "-")} · ${t("people", b.people)}</span><span class="sub">${esc(menuLabel(b))}</span></div><span class="due ${d.late ? "late" : ""}">${d.text}</span></button>`; }).join("")
        : `<div class="card empty">${t("noReqs")}</div>`}
      <div class="sec"><h2>${t("todayGuests")}</h2><span>${esc(dateLabel(td))}</span></div>
      ${todays.length ? `<div class="list">${todays.map(b => row(b)).join("")}</div>` : `<div class="card empty">${t("noToday")}</div>`}
      </div><div class="col">
      ${soon.length ? `<div class="sec"><h2>${t("next7")}</h2><span></span></div><div class="list">${soon.map(b => row(b, true)).join("")}</div>` : ""}
      <div class="sec"><h2>${t("monthTitle")}</h2><span></span></div>
      <div class="stats"><div class="stat"><b>${mine.length}</b><span>${t("statVisits")}</span></div>
        <div class="stat"><b>${paid >= 1e6 ? (Math.round(paid / 1e5) / 10).toString().replace(".", ",") + "tr₫" : vnd(paid)}</b><span>${t("statPaid")}</span></div>
        <div class="stat"><b>${avg == null ? "-" : avg + " " + t("min")}</b><span>${t("statReply")}</span></div></div>
      ${shopTodayHtml()}
      </div></div>`;
  }
  function shopTodayHtml() {
    if (!window.OwnerBoard) return "";
    const d = boardSum;
    const sec = `<div class="sec"><h2>${t("shopToday")}</h2><span></span></div>`;
    if (!d) return sec + `<div class="card empty">…</div>`;
    if (!d.staff.length) return sec + `<button class="req" data-act="toboard" style="border-color:#B9D6C5;background:#F1F8F3"><div class="tm" style="min-width:auto">🗺️</div><div class="grow"><span class="nm">${t("boardStart")}</span><span class="sub">${t("boardStartS")}</span></div><span class="bd ok">›</span></button>`;
    const work = d.sessions.filter(x => x.status === "working").length, done = d.sessions.filter(x => x.status === "done"), doneG = done.filter(x => (x.grp || x.id) === x.id);
    const wait = d.guests.filter(g => g.status === "waiting").length, inN = d.staff.filter(x => x.in_at && !x.out_at).length;
    const rev = done.reduce((a, x) => a + (+x.paid || 0), 0);
    const st = x => x.code === "O" && !x.in_at ? "🌙" : !x.in_at ? "⚪" : x.out_at ? "⚪" : d.sessions.some(y => y.status === "working" && y.staff_id === x.id) ? "🔴" : "🟢";
    const ss = d.shop_state || {}, stTxt = { before: "⏳ " + t("ssBefore", ss.open || ""), open_auto: "🟢 " + t("ssOpen"), open_manual: "🟢 " + t("ssOpen"), after: "🌙 " + t("ssAfter"), closed_manual: "🌙 " + t("ssAfter"), dayoff: "🌙 " + t("ssDayoff") }[ss.status] || "";
    return `<div class="sec"><h2>${t("shopToday")}</h2><span>${stTxt}${ss.open ? ` · ${esc(ss.open)}–${esc(ss.close)}` : ""}</span></div><div class="stats st4"><div class="stat"><b>${inN}/${d.staff.length}</b><span>${t("bIn")}</span></div><div class="stat"><b>${work}</b><span>${t("bWork")}</span></div><div class="stat"><b>${wait + d.expected.length}</b><span>${t("bWait")}</span></div><div class="stat"><b>${doneG.length} · ${rev >= 1e6 ? (Math.round(rev / 1e5) / 10).toString().replace(".", ",") + "tr₫" : vnd(rev)}</b><span>${t("bDone")}</span></div></div>
      <div class="card"><div class="staffchips">${d.staff.map(x => `<span class="schip">${st(x)} ${esc(x.name)}</span>`).join("")}</div>
      <div class="legend2">${[["🟢", "lgIdle"], ["🔴", "lgWork"], ["⚪", "lgOff"], ["🌙", "lgDay"]].map(([e, k]) => `<span>${e} ${t(k)}</span>`).join("")}</div>
      <button class="btn main" data-act="toboard" style="margin-top:12px">🗺️ ${t("openBoard")}</button></div>`;
  }

  // ---- 예약 목록 ----
  const GROUPS = { new: ["requested"], up: ["shop_ok", "confirmed", "reschedule"], past: ["visited", "settled", "noshow"], closed: ["cancelled", "rejected"] };
  function bookingsHtml() {
    const inTab = k => rows.filter(b => GROUPS[k].includes(b.status));
    let list = inTab(bTab).slice();
    const key = b => (b.visit_date || "") + (b.visit_time || "");
    list.sort((a, b) => ["past", "closed"].includes(bTab) ? key(b).localeCompare(key(a)) : key(a).localeCompare(key(b)));
    return `<div class="chips">${Object.keys(GROUPS).map(k => `<button class="chip ${bTab === k ? "on" : ""}" data-btab="${k}">${t("bt_" + k)}<em>${inTab(k).length}</em></button>`).join("")}</div>
      ${list.length ? `<div class="list blist">${list.map(b => row(b, true)).join("")}</div>` : `<div class="card empty">${t("emptyList")}</div>`}
      <button class="btn ghost" data-act="refresh">↻ ${t("refresh")}</button>`;
  }

  // ---- 일정 ----
  function weekOf() { return (hoursDraft ? hoursDraft.week : sched && sched.week) || []; }
  function slotsOfDay(ds) {
    const w = weekOf()[wdIdx(ds)]; if (!w || w.closed) return [];
    const out = []; for (let m = toMin(w.open); m < toMin(w.close); m += 30) out.push(toStr(m)); return out;
  }
  const closedOf = (ds, slot) => sched && sched.closures.some(c => c.day === ds && (slot == null ? c.slot == null : c.slot === slot));
  function scheduleHtml() {
    if (!sched) return `<div class="card empty">…</div>`;
    const td = today(); if (!schedDay) schedDay = td;
    const days = Array.from({ length: 14 }, (_, i) => addDays(td, i));
    const w = weekOf()[wdIdx(schedDay)] || {}, dayOff = closedOf(schedDay, null), cap = (hoursDraft ? hoursDraft.cap : sched.capacity);
    const slots = slotsOfDay(schedDay);
    const timeOpts = sel => Array.from({ length: 41 }, (_, i) => toStr(360 + i * 30)).map(x => `<option ${x === sel ? "selected" : ""}>${x}</option>`).join("");
    const owner = isOwner(), dirty = !!hoursDraft;
    return `<div class="cols sch"><div class="col">
      ${window.OwnerBoard ? `<button class="req" data-act="rota" style="border-color:#B9D6C5;background:#F1F8F3"><div class="tm" style="min-width:auto">👥</div><div class="grow"><span class="nm">${t("rotaT")}</span><span class="sub">${t("rotaS")}</span></div><span class="bd ok">›</span></button>` : ""}
      <div class="sec"><h2>${t("dayTitle")}</h2><span></span></div>
      <div class="card" style="display:flex;flex-direction:column;gap:12px">
        <div class="days">${days.map(ds => { const d = new Date(ds + "T00:00:00Z"); const off = closedOf(ds, null) || (weekOf()[wdIdx(ds)] || {}).closed; return `<button class="day ${ds === schedDay ? "on" : ""} ${off ? "off" : ""}" data-day="${ds}">${ds === td ? t("today") : T.wd[li()][wdIdx(ds)]}<b>${d.getUTCDate()}</b></button>`; }).join("")}</div>
        ${w.closed ? `<p class="muted" style="margin:0">${t("weeklyOff")}</p>` : `
        <div class="row"><b class="grow">${t("dayOff")}</b><button class="sw ${dayOff ? "on" : ""}" data-act="dayoff" aria-label="${t("dayOff")}"><i></i></button></div>
        <p class="muted" style="margin:0">${t("dayHint")}</p>
        <div class="slots">${slots.map(x => { const n = (sched.booked || {})[schedDay + "|" + x] || 0, blk = dayOff || closedOf(schedDay, x);
          const cls = blk ? "blk" : n >= cap ? "full" : n > 0 ? "busy" : "";
          return `<button class="sl ${cls}" data-slot="${x}" ${dayOff ? "disabled" : ""}><span>${x}</span><small>${blk ? t("blocked") : n + "/" + cap}</small></button>`; }).join("")}</div>
        <div class="legend"><span><i></i>${t("lgFree")}</span><span><i class="b"></i>${t("lgBooked")}</span><span><i class="f"></i>${t("lgFull")}</span><span><i class="k"></i>${t("lgBlocked")}</span></div>`}
      </div></div><div class="col">
      <div class="sec"><h2>${t("hoursTitle")}</h2><span>${dirty ? t("unsaved") : ""}</span></div>
      ${owner ? "" : `<div class="info">${t("staffOnly")}</div>`}
      <div class="list">${weekOf().map((d, i) => `<div class="wk"><span class="d">${T.wdLong[li()][i]}</span>
          <span class="h ${d.closed ? "x" : ""}">${d.closed ? t("closed") : owner ? `<select data-wo="${i}" aria-label="open">${timeOpts(d.open)}</select>–<select data-wc="${i}" aria-label="close">${timeOpts(d.close)}</select>` : `${esc(d.open)} – ${esc(d.close)}`}</span>
          <button class="sw ${d.closed ? "" : "on"}" data-wsw="${i}" ${owner ? "" : "disabled"} aria-label="${T.wdLong[li()][i]}"><i></i></button></div>`).join("")}</div>
      <div class="card row"><div class="grow"><b style="display:block">${t("capTitle")}</b><span class="muted">${t("capHint")}</span></div>
        <div class="step"><button data-act="capd" ${owner ? "" : "disabled"} aria-label="-">−</button><b>${cap}</b><button data-act="capu" ${owner ? "" : "disabled"} aria-label="+">+</button></div></div>
      <div class="card" style="display:flex;flex-direction:column;gap:10px"><b>${t("cutTitle")}</b>
        <div class="chips">${[0, 1, 2, 3, 6, 12, 24].map(h => `<button class="chip ${(hoursDraft ? hoursDraft.cut : sched.cutoff_min) === h * 60 ? "on" : ""}" data-cut="${h * 60}" ${owner ? "" : "disabled"}>${h === 0 ? "0" : t("cutOpt", h)}</button>`).join("")}</div></div>
      ${owner ? `<button class="btn main" data-act="savehours" ${dirty ? "" : "disabled"}>${t("saveHours")}</button>` : ""}</div></div>`;
  }
  function draft() { if (!hoursDraft) hoursDraft = { week: JSON.parse(JSON.stringify(sched.week)), cap: sched.capacity, cut: sched.cutoff_min }; return hoursDraft; }

  // ---- 정산 ----
  let settle = null, sFilter = "all";
  async function loadSettle(mon) {
    if (!isOwner()) { settle = null; return; }
    try { settle = await rpc("owner_settle", { shop: shopId, mon: mon || null }); } catch (e) { toast(errMsg(e)); }
    if (tab === "settle") draw();
  }
  const monLabel = m => { const [y, mm] = m.split("-"); return lang === "ko" ? `${+mm}월` : lang === "vi" ? `T${+mm}/${y}` : new Date(Date.UTC(+y, +mm - 1, 1)).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }); };
  function settleHtml() {
    if (!isOwner()) return `<div class="info">${t("sOnly")}</div>`;
    if (!settle) return `<div class="card empty">…</div>`;
    const cur = today().slice(0, 7), months = [...new Set([cur, ...(settle.months || []).map(x => x.month), settle.month])].sort().reverse().slice(0, 6);
    const sum = (settle.months || []).find(x => x.month === settle.month) || { visits: 0, paid: 0, commission: 0 };
    const wk = (settle.walk_months || []).find(x => x.month === settle.month) || { count: 0, paid: 0 };
    const stm = (settle.statements || []).find(x => x.month === settle.month);
    const stLabel = !stm ? t("sOpen") : stm.status === "paid" ? t("sPaidSt") : t("sBilled");
    const stCls = !stm ? "wait" : stm.status === "paid" ? "ok" : "ask";
    const md = d => { const [, mm, dd] = String(d).split("-"); return lang === "vi" ? `${+dd}/${+mm}` : `${+mm}/${+dd}`; };
    const hm = iso => iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }) : "";
    const ud = (settle.rows || []).map(r => ({ ud: true, date: r.date, time: (r.time || "").slice(0, 5), name: r.name, people: r.people, sub: [r.code, r.menu_name, r.staff].filter(Boolean).join(" · ") + (r.settled ? " · " + t("sSettled") : ""), paid: r.paid, fee: t("sFee") + " " + vnd(r.commission) }));
    const wr = (settle.walk_rows || []).map(r => ({ ud: false, date: r.day, time: hm(r.started_at), name: r.guest, people: r.people || 1, sub: [r.course, r.staff].filter(Boolean).join(" · "), paid: r.paid, fee: t("sNoFee") }));
    const all = ud.concat(wr).filter(r => sFilter === "all" || (sFilter === "ud") === r.ud).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    return `<div class="cols"><div class="col"><div class="sec"><h2>${t("settleTitle")}</h2><span></span></div>
      <div class="chips">${months.map(m => `<button class="chip ${m === settle.month ? "on" : ""}" data-mon="${m}">${esc(monLabel(m))}</button>`).join("")}</div>
      <div class="card"><div class="kv"><span>${t("sTotal")}</span><b style="font-size:20px">${vnd((+sum.paid || 0) + (+wk.paid || 0))}</b></div></div>
      <div class="card"><b style="display:block;margin-bottom:4px"><span class="bd ok">${t("tagUD")}</span> ${t("sUD")}</b>
        <div class="kv"><span>${t("sStatus")}</span><b><span class="bd ${stCls}">${stLabel}</span></b></div>
        <div class="kv"><span>${t("sVisits")}</span><b>${sum.visits}</b></div>
        <div class="kv"><span>${t("sPaid")}</span><b>${vnd(sum.paid)}</b></div>
        <div class="kv"><span>${t("sFee")}</span><b style="font-size:17px">${vnd(sum.commission)}</b></div>
        ${stm ? `<div class="kv"><span>${t("sStmt")}</span><b>${stm.count} · ${vnd(stm.commission)}</b></div>` : ""}
        <p class="muted" style="margin:6px 0 0">${t("sNote")}</p>
      </div>
      <div class="card"><b style="display:block;margin-bottom:4px"><span class="bd wait">${t("tagWalk")}</span> ${t("sWalk")}</b>
        <div class="kv"><span>${t("sWalkN")}</span><b>${wk.count}</b></div>
        <div class="kv"><span>${t("sWalkPaid")}</span><b style="font-size:17px">${vnd(wk.paid)}</b></div>
        <p class="muted" style="margin:6px 0 0">${t("sWalkNote")}</p>
      </div></div><div class="col">
      <div class="sec"><h2>${t("sRowsAll")}</h2><span>${all.length}</span></div>
      <div class="chips">${[["all", t("sAll")], ["ud", t("tagUD")], ["walk", t("tagWalk")]].map(([k, l]) => `<button class="chip ${sFilter === k ? "on" : ""}" data-sf="${k}">${esc(l)}</button>`).join("")}</div>
      ${all.length ? `<div class="list">${all.map(r => `<div class="trow"><div class="tm" style="font-size:15px">${esc(md(r.date))}<small>${esc(r.time || "")}</small></div>
          <div class="grow"><span class="nm"><span class="bd ${r.ud ? "ok" : "wait"}" style="margin-right:4px">${t(r.ud ? "tagUD" : "tagWalk")}</span>${esc(r.name || "-")} · ${t("people", r.people)}</span><span class="sub">${esc(r.sub)}</span></div>
          <div style="text-align:right"><b style="display:block">${vnd(r.paid)}</b><span class="sub">${esc(r.fee)}</span></div></div>`).join("")}</div>` : `<div class="card empty">${t("sNoneAll")}</div>`}</div></div>`;
  }

  // ---- 더보기 ----
  function moreHtml() {
    const s = curShop();
    return `<div class="cols"><div class="col"><div class="list">
        <div class="mrow"><b>${t("mAccount")}</b><span>${esc(me.name || "")} · ${esc(me.phone || "")} · ${t(s && s.role === "staff" ? "roleStaff" : "roleOwner")}</span></div>
        ${me.shops.length > 1 ? me.shops.map(x => `<button class="mrow" data-shop="${esc(x.id)}"><b>${t("mShop")}: ${esc(shopName(x))}</b><span>${x.id === shopId ? "✓" : ""}</span></button>`).join("") : `<div class="mrow"><b>${t("mShop")}</b><span>${esc(shopName(s))}</span></div>`}
        <button class="mrow" data-act="inst"><b>${t("mInstall")}</b><span>›</span></button>
        <button class="mrow" data-act="pw"><b>${t("mPw")}</b><span>›</span></button>
        <button class="mrow" data-act="logout"><b>${t("mLogout")}</b><span>›</span></button>
      </div>
      </div><div class="col"><div class="info">${t("contactUD")}</div>
      <div class="card"><b style="display:block;margin-bottom:6px">${t("soonT")}</b><p class="muted" style="margin:0">${t("soon")}</p></div></div></div>`;
  }

  // ---- 버튼 연결 ----
  function bindMain(m) {
    m.querySelectorAll("[data-open]").forEach(b => b.onclick = () => openDetail(b.dataset.open));
    m.querySelectorAll("[data-btab]").forEach(b => b.onclick = () => { bTab = b.dataset.btab; draw(); });
    m.querySelectorAll("[data-mon]").forEach(b => b.onclick = () => loadSettle(b.dataset.mon));
    m.querySelectorAll("[data-sf]").forEach(b => b.onclick = () => { sFilter = b.dataset.sf; draw(); });
    m.querySelectorAll("[data-day]").forEach(b => b.onclick = () => { schedDay = b.dataset.day; draw(); });
    m.querySelectorAll("[data-slot]").forEach(b => b.onclick = () => toggleClosure(schedDay, b.dataset.slot));
    m.querySelectorAll("[data-shop]").forEach(b => b.onclick = () => { shopId = b.dataset.shop; store("ud-owner-shop", shopId); sched = null; settle = null; hoursDraft = null; load(); });
    m.querySelectorAll("[data-wsw]").forEach(b => b.onclick = () => { const d = draft(), i = +b.dataset.wsw; d.week[i].closed = !d.week[i].closed; draw(); });
    m.querySelectorAll("[data-wo]").forEach(s => s.onchange = () => { draft().week[+s.dataset.wo].open = s.value; draw(); });
    m.querySelectorAll("[data-wc]").forEach(s => s.onchange = () => { draft().week[+s.dataset.wc].close = s.value; draw(); });
    m.querySelectorAll("[data-cut]").forEach(b => b.onclick = () => { draft().cut = +b.dataset.cut; draw(); });
    m.querySelectorAll("[data-act]").forEach(b => b.onclick = () => act(b.dataset.act));
  }
  async function act(a) {
    if (a === "inst") { toast(/iPhone|iPad/.test(navigator.userAgent) ? t("installIos") : t("installAndroid")); return; }
    if (a === "instx") { store("ud-owner-inst", "x"); draw(); return; }
    if (a === "refresh") { await load(); return; }
    if (a === "toboard") { tab = "board"; draw(); window.scrollTo(0, 0); return; }
    if (a === "rota") { tab = "board"; boardView = "sched"; draw(); window.scrollTo(0, 0); return; }
    if (a === "pw") { drawNewPw(); return; }
    if (a === "logout") { await sb.auth.signOut(); me = null; rows = []; sched = null; knownReq = null; drawLogin(); return; }
    if (a === "capu") { const d = draft(); d.cap = Math.min(50, d.cap + 1); draw(); return; }
    if (a === "capd") { const d = draft(); d.cap = Math.max(1, d.cap - 1); draw(); return; }
    if (a === "dayoff") { toggleClosure(schedDay, null); return; }
    if (a === "savehours") {
      const d = hoursDraft; if (!d) return;
      if (d.week.some(x => !x.closed && x.open >= x.close)) { toast(t("tErr")); return; }
      try { const h = await rpc("owner_hours_save", { shop: shopId, week: d.week, capacity: d.cap, cutoff_min: d.cut }); hoursDraft = null; Object.assign(sched, h); toast(t("tSaved")); draw(); }
      catch (e) { toast(errMsg(e)); }
    }
  }
  async function toggleClosure(day, slot) {
    if (busy) return; busy = true;
    const on = !closedOf(day, slot);
    try {
      await rpc("owner_closure", { shop: shopId, day, slot: slot || "", closed: on });
      if (on) sched.closures.push({ day, slot: slot || null }); else sched.closures = sched.closures.filter(c => !(c.day === day && (slot == null ? c.slot == null : c.slot === slot)));
      draw();
    } catch (e) { toast(errMsg(e)); }
    busy = false;
  }

  // ---- 예약 상세 ----
  const wide = () => window.matchMedia && matchMedia("(min-width: 960px)").matches;
  function openDetail(id) { detail = id; proposing = false; picks = []; pDay = null; detTp = null; drawDetail(); }
  // 담당 테라피스트 고르기 (사장님 페이지에서만, 선택)
  let detTp = null;
  async function loadDetTp(b) {
    detTp = { bid: b.id, loading: true, ids: [], staff: [] };
    try { const r = await rpc("booking_staff_get", { shop: shopId, bid: b.id }); if (detTp && detTp.bid === b.id) detTp = { bid: b.id, staff: (r.staff || []).filter(s => s.role === "tp"), ids: r.ids || [], saved: (r.ids || []).slice() }; }
    catch (e) { detTp = { bid: b.id, staff: [], ids: [], err: true }; }
    if (detail === b.id) drawDetail();
  }
  function tpPickHtml(b, withSave) {
    if (!detTp || detTp.bid !== b.id) { loadDetTp(b); return ""; }
    if (detTp.loading || !detTp.staff.length) return "";
    const same = JSON.stringify(detTp.ids) === JSON.stringify(detTp.saved || []);
    return `<div class="card"><span class="lbl">${t("tpOpt")}</span><div class="chips" style="margin:6px 0 0">${detTp.staff.map(s => `<button type="button" class="chip ${detTp.ids.includes(s.id) ? "on" : ""}" data-tp="${s.id}" aria-pressed="${detTp.ids.includes(s.id)}">${detTp.ids.includes(s.id) ? "✓ " : ""}${esc(s.name)}</button>`).join("")}</div>
      <p class="muted" style="margin:6px 0 0">${withSave && !detTp.ids.length && !(detTp.saved || []).length ? t("tpNone") + " " : ""}${t("tpOptHint")}</p>
      ${withSave ? `<button class="btn line" data-d="tpsave" style="margin-top:8px" ${same ? "disabled" : ""}>${t("tpSave")}</button>` : ""}</div>`;
  }
  function closeDetail() { detail = null; proposing = false; drawDetail(); }
  function drawDetail() {
    let ov = document.getElementById("ov");
    const b = detail && rows.find(x => x.id === detail);
    $app.classList.toggle("drawer", !!b);
    if (!b) { if (ov) ov.remove(); document.body.style.overflow = ""; document.querySelectorAll(".trow.sel,.req.sel").forEach(x => x.classList.remove("sel")); return; }
    if (!ov) { ov = document.createElement("div"); ov.id = "ov"; ov.className = "ov"; document.body.appendChild(ov); }
    document.body.style.overflow = wide() ? "" : "hidden";
    document.querySelectorAll(".trow,.req").forEach(x => x.classList.toggle("sel", x.dataset.open === b.id));
    const st = b.status, td = today(), afterVisit = b.visit_date && b.visit_date <= td;
    const ln = T.langName[b.lang] ? T.langName[b.lang][li()] : (b.lang || "-");
    const times = arr => (arr || []).map(x => typeof x === "string" ? x : `${x.date ? dateLabel(x.date) + " " : ""}${x.time || ""}`).filter(Boolean).join(" · ");
    let actions = "";
    if (st === "requested" && !proposing) actions = `<button class="btn main" data-d="accept">${t("accept")}</button><button class="btn line" data-d="propose">${t("cant")}</button>`;
    else if (proposing) {
      if (!pDay) pDay = b.visit_date || td;
      const pdays = Array.from({ length: 7 }, (_, i) => addDays(b.visit_date && b.visit_date >= td ? b.visit_date : td, i - (b.visit_date && b.visit_date > td ? 1 : 0))).filter(d => d >= td);
      const sl = sched ? slotsOfDay(pDay) : [];
      actions = `<div class="card" style="display:flex;flex-direction:column;gap:10px"><b>${t("proposeTitle")}</b>
          <div class="days">${pdays.map(ds => { const d = new Date(ds + "T00:00:00Z"); const n = picks.filter(p => p.date === ds).length; return `<button class="day ${ds === pDay ? "on" : ""}" data-pday="${ds}">${ds === td ? t("today") : T.wd[li()][wdIdx(ds)]}<b>${d.getUTCDate()}</b>${n ? `<small>✓${n}</small>` : ""}</button>`; }).join("")}</div>
          <div class="slots">${sl.length ? sl.map(x => { const on = picks.some(p => p.date === pDay && p.time === x), same = pDay === b.visit_date && x === b.visit_time, blk = closedOf(pDay, x) || closedOf(pDay, null);
            return `<button class="sl ${on ? "on" : blk ? "blk" : ""}" data-pick="${x}" ${same ? "disabled" : ""}><span>${x}</span><small>${on ? "✓" : ""}</small></button>`; }).join("") : `<p class="muted" style="grid-column:1/-1;margin:0">${t("closed")}</p>`}</div>
          ${picks.length ? `<p class="muted" style="margin:0">${esc(picks.map(p => `${dateLabel(p.date)} ${p.time}`).join(" · "))}</p>` : ""}</div>
        <label><span class="lbl">${t("memo")}</span><textarea class="inp" id="memo" maxlength="300"></textarea></label>
        <button class="btn main" data-d="sendp" ${picks.length ? "" : "disabled"}>${picks.length ? t("sendPropose", picks.length) : t("pickFirst")}</button>
        <button class="btn danger" data-d="reject">${t("rejectNoTime")}</button>
        <button class="btn ghost" data-d="cancelp">${t("back")}</button>`;
    } else if (["shop_ok", "confirmed"].includes(st)) {
      actions = (st === "shop_ok" ? `<div class="note">${t("waitUD")}</div>` : "")
        + (afterVisit ? `<div class="card"><label><span class="lbl">${t("paidLabel")}</span><input class="inp" id="amt" inputmode="numeric" value="${b.paid_amount ? vnd(b.paid_amount).replace("₫", "") : b.list_price ? vnd(b.list_price).replace("₫", "") : ""}"></label><p class="muted" style="margin:6px 0 0">${t("paidHint")}</p></div>
            ${tpPickHtml(b, false)}<button class="btn main" data-d="visited">${t("arrived")}</button><button class="btn danger" data-d="noshow">${t("noshow")}</button>`
          : `<p class="muted" style="margin:0 2px">${t("beforeVisit")}</p><button class="btn ghost" data-d="propose">${t("cantLater")}</button>`);
    } else if (st === "rejected") actions = `<div class="note">${t("waitRejected")}${(b.proposed_times || []).length ? `<small>${t("yourTimes")}: ${esc(times(b.proposed_times))}</small>` : ""}</div>`;
    else if (st === "reschedule") actions = `<div class="note">${t("waitResched")}${(b.offer_times || []).length ? `<small>${t("offered")}: ${esc(times(b.offer_times))}</small>` : ""}</div>`;
    else if (["visited", "settled"].includes(st)) actions = `<div class="note"><b>${t("paidShort")}: ${vnd(b.paid_amount)}</b><small>${t("visitedNote")}</small></div>${tpPickHtml(b, true)}`;
    else if (st === "noshow") actions = `<div class="note">${t("noshowNote")}</div>`;
    else if (st === "cancelled") actions = `<div class="note">${t("cancelNote")}</div>`;
    ov.innerHTML = `<div class="ov-in" role="dialog" aria-modal="true">
      <div class="ovh"><button class="back" data-d="close" aria-label="${t("back")}"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
        <div class="grow"><b style="display:block">${esc(b.customer_name || "-")}</b><span class="sub">${t("code")} ${esc(b.code)}</span></div><span class="${badge(st)}">${t("st_" + st)}</span></div>
      <div class="body">
        ${st === "requested" ? `<div class="row"><span class="due ${dueOf(b).late ? "late" : ""}">${dueOf(b).text}</span><span class="muted">${t("replyGoal")}</span></div>` : ""}
        <div class="card"><div class="kv"><span>${t("when")}</span><b style="font-size:17px">${esc(dateLabel(b.visit_date))} · ${esc(b.visit_time || "")}</b></div>
          <div class="kv"><span>${t("service")}</span><b>${esc(menuLabel(b))}</b></div>
          <div class="kv"><span>${t("guests")}</span><b>${t("people", b.people)}</b></div>
          ${b.list_price ? `<div class="kv"><span>${t("listPrice")}</span><b>${vnd(b.list_price)}</b></div>` : ""}
          <div class="kv"><span>${t("guestLang")}</span><b>${esc(ln)}</b></div></div>
        ${b.note ? `<div class="note"><b style="display:block;font-size:13px">${t("note")}</b>${esc(b.note)}</div>` : ""}
        <div class="info">${t("contactHidden")}</div>
        ${actions}
      </div></div>`;
    ov.querySelectorAll("[data-d]").forEach(x => x.onclick = () => detailAct(b, x.dataset.d));
    ov.querySelectorAll("[data-tp]").forEach(x => x.onclick = () => { if (!detTp) return; const id = x.dataset.tp, i = detTp.ids.indexOf(id); if (i >= 0) detTp.ids.splice(i, 1); else if (detTp.ids.length >= 4) { toast(t("tpMax")); return; } else detTp.ids.push(id);
      const a2 = document.getElementById("amt"), av = a2 ? a2.value : null; drawDetail(); const a3 = document.getElementById("amt"); if (a3 && av != null) a3.value = av; });
    ov.querySelectorAll("[data-pday]").forEach(x => x.onclick = () => { pDay = x.dataset.pday; drawDetail(); });
    ov.querySelectorAll("[data-pick]").forEach(x => x.onclick = () => {
      const i = picks.findIndex(p => p.date === pDay && p.time === x.dataset.pick);
      if (i >= 0) picks.splice(i, 1); else if (picks.length < 3) picks.push({ date: pDay, time: x.dataset.pick });
      const memo = document.getElementById("memo"), mv = memo ? memo.value : ""; drawDetail(); const m2 = document.getElementById("memo"); if (m2) m2.value = mv;
    });
    const amt = document.getElementById("amt"); if (amt) amt.oninput = () => { const d = digits(amt.value); amt.value = d ? vnd(d).replace("₫", "") : ""; };
  }
  async function detailAct(b, a) {
    if (a === "close") return closeDetail();
    if (a === "propose") { proposing = true; picks = []; pDay = null; if (!sched) await loadSched(); return drawDetail(); }
    if (a === "cancelp") { proposing = false; return drawDetail(); }
    if (a === "tpsave") { if (!detTp || busy) return; busy = true;
      try { await rpc("booking_staff_set", { shop: shopId, bid: b.id, tps: detTp.ids }); detTp.saved = detTp.ids.slice(); toast(t("tpSaved")); } catch (e) { toast(errMsg(e)); }
      busy = false; return drawDetail(); }
    if (busy) return;
    const memoEl = document.getElementById("memo"), memo = memoEl ? memoEl.value.trim() : null;
    let args = null, msg = "";
    if (a === "accept") { args = { action: "accept" }; msg = t("tAccepted"); }
    else if (a === "sendp") { if (!picks.length) return; args = { action: "reject", times: picks.map(p => ({ date: p.date, time: p.time })) }; msg = t("tProposed"); }
    else if (a === "reject") { args = { action: "reject", times: [] }; msg = t("tRejected"); }
    else if (a === "visited") { const raw = digits((document.getElementById("amt") || {}).value); if (!raw) { toast(t("needAmount")); return; } args = { action: "visited", amount: +raw }; msg = t("tVisited"); }
    else if (a === "noshow") { if (!confirm(t("noshowAsk"))) return; args = { action: "noshow" }; msg = t("tNoshow"); }
    if (!args) return;
    busy = true; const ov = document.getElementById("ov"); if (ov) ov.classList.add("spin");
    try {
      const r = await rpc("owner_reply", { bid: b.id, action: args.action, amount: args.amount == null ? null : args.amount, memo: memo || null, times: args.times || null });
      const i = rows.findIndex(x => x.id === b.id); if (i >= 0) rows[i] = r;
      if (args.action === "visited" && detTp && detTp.bid === b.id && detTp.ids.length) { try { await rpc("booking_staff_set", { shop: shopId, bid: b.id, tps: detTp.ids }); detTp.saved = detTp.ids.slice(); } catch (e) { toast(errMsg(e)); } }
      proposing = false; picks = []; toast(msg); knownReq = new Set(rows.filter(x => x.status === "requested").map(x => x.id));
      if (sched) loadSched();
    } catch (e) { toast(errMsg(e)); }
    busy = false; if (ov) ov.classList.remove("spin");
    draw();
  }

  // ---- 데이터 ----
  async function loadSched() {
    try { const td = today(); sched = await rpc("owner_schedule", { shop: shopId, d1: td, d2: addDays(td, 30) }); sched.closures = sched.closures || []; }
    catch (e) { toast(errMsg(e)); }
    if (tab === "schedule") draw();
  }
  async function load(quiet) {
    try {
      const r = await rpc("owner_bookings", { shop: shopId });
      const req = new Set(r.filter(b => b.status === "requested").map(b => b.id));
      if (knownReq && [...req].some(id => !knownReq.has(id))) ping();
      knownReq = req; rows = r;
    } catch (e) { if (!quiet) toast(errMsg(e)); }
    if (tab === "schedule" && !sched) await loadSched();
    if (window.OwnerBoard && tab === "home") { try { boardSum = await rpc("board_get", { shop: shopId }); } catch (e) { boardSum = null; } }
    // 입력 중이면 화면을 다시 그리지 않아요
    const ae = document.activeElement; if (quiet && ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName)) return;
    if (quiet && detail) return;
    if (quiet && tab === "board") { const b = $app.querySelector('[data-tab="bookings"]'); if (b) { const n = r_req(); const d = b.querySelector(".dot"); if (d) d.textContent = n || ""; } return; }
    draw();
  }
  const r_req = () => rows.filter(b => b.status === "requested").length;
  function ping() {
    toast(t("tNew"));
    try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {}
    try { const ac = new (window.AudioContext || window.webkitAudioContext)(), o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ac.destination); g.gain.setValueAtTime(0.2, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.6); o.start(); o.stop(ac.currentTime + 0.6); } catch (e) {}
  }
  async function start() {
    try { me = await rpc("owner_me"); } catch (e) { me = null; }
    if (!me || !me.shops || !me.shops.length) { await sb.auth.signOut(); me = null; drawLogin(t("noShop")); return; }
    shopId = me.shops.some(s => s.id === read("ud-owner-shop")) ? read("ud-owner-shop") : me.shops[0].id;
    if (me.must_change_pw) { drawNewPw(); return; }
    begin();
  }
  let started = false;
  async function begin() {
    draw(); await load();
    if (started) return; started = true;
    clearInterval(pollTimer);
    pollTimer = setInterval(() => { if (!document.hidden && me && !me.must_change_pw) load(true); }, 30000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden && me) load(true); });
  }

  // ---- 시작 ----
  document.documentElement.lang = lang;
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("owner-sw.js", { scope: "./owner" }).catch(() => {});
  if (typeof SUPA === "undefined" || !SUPA.url || !window.supabase) { $app.innerHTML = `<div class="boot">Uncle Day: setup needed</div>`; return; }
  sb = supabase.createClient(SUPA.url, SUPA.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "ud-owner-auth" } });
  sb.auth.getSession().then(({ data }) => data.session ? start() : drawLogin());
})();

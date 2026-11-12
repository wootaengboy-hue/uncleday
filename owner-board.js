/* 엉클데이 사장님 페이지 · 시술 현황판 (유니버스 2단계)
   - 평면도: 층 · 방 · 베드 · 장비, 1층 카운터 · 직원 대기실, 계단
   - 직원 도트 캐릭터가 출근 · 대기 · 시술 · 퇴근에 따라 걸어 다녀요
   - 엉클데이 손님 도착 · 워크인 접수 · 배정 · 끝내기(금액) · 연장 · 취소
   - 근태(출퇴근 · 지각) · 근무표(요청 승인) · 매장 설정(업종 · 층 · 방 · 장비 · 코스 · 직원)
   데이터는 supabase/universe.sql 의 함수(board_get 등)로만 주고받아요. */
(() => {
  const LANGS = ["vi", "ko", "en"];
  const T = {
    vBoard: ["Bảng phòng", "현황판", "Board"], vHist: ["Lịch sử", "기록", "History"],
    hDay: ["Ngày", "하루", "Day"], hWeek: ["Tuần", "주", "Week"], hMonth: ["Tháng", "월", "Month"], hToday: ["Hôm nay", "오늘", "Today"],
    hGuests: ["Lượt khách", "손님", "Guests"], hSales: ["Doanh thu", "매출 합계", "Sales"], hUD: ["Uncle Day", "엉클데이", "Uncle Day"], hWalk: ["Tại quầy", "현장", "Walk-in"], hLeft: ["Khách bỏ về", "그냥 나간 손님", "Left without service"],
    hRows: ["Từng lượt làm", "시술 기록", "Sessions"], hStaff: ["Theo nhân viên", "직원별", "By staff"], hNone: ["Không có lượt làm nào.", "이 기간에는 끝난 시술이 없어요.", "No finished sessions."],
    hCnt: ["Lượt", "시술", "Sessions"], hMin: ["Phút làm", "시술 시간", "Minutes"], hRev: ["Doanh thu", "매출", "Sales"], hAtt: ["Chấm công", "출퇴근", "Attendance"], hDays: ["{n} ngày", "{n}일 출근", "{n} days"],
    hLateN: ["Trễ {n} lần · {m}′", "지각 {n}번 · {m}분", "Late {n}× · {m}′"], hLate: ["Trễ {m}′", "지각 {m}분", "Late {m}′"], hCsv: ["⬇ Tải Excel (CSV)", "⬇ 엑셀로 받기", "⬇ Excel (CSV)"], hOwner: ["Chỉ chủ cửa hàng mới xem được lịch sử.", "기록은 사장님 계정만 볼 수 있어요.", "Only the owner can see history."],
    hNoStaff: ["Chưa ghi KTV", "담당 미기록", "No therapist"], hSetTp: ["Thêm KTV", "담당 넣기", "Add therapist"], hEditTp: ["Đổi", "바꾸기", "Edit"], hSaveTp: ["Lưu", "저장", "Save"], hTpSaved: ["Đã lưu KTV phụ trách.", "담당을 저장했어요.", "Therapist saved."], hByReview: ["khách xác nhận qua đánh giá", "손님 후기로 확인", "confirmed by guest review"], hRv: ["Đánh giá KTV", "💌 테라피스트 후기", "💌 Therapist reviews"], hRvNone: ["Chưa có đánh giá.", "아직 받은 후기가 없어요.", "No reviews yet."], hRvHint: ["Khách đặt qua Uncle Day có thể viết đánh giá cho KTV sau khi đến. Mỗi đánh giá được xác nhận, Uncle Day thưởng cho KTV.", "엉클데이 예약 손님은 방문 뒤 담당 테라피스트에게 후기를 쓸 수 있어요. 확인된 후기 한 건마다 엉클데이가 테라피스트에게 보너스를 줘요.", "Uncle Day guests can review their therapist after the visit. Uncle Day pays the therapist a bonus per verified review."],
    hByShop: ["nhập tay", "직접 입력", "entered by shop"],
    decoBtn: ["🪴 Trang trí", "🪴 꾸미기", "🪴 Decorate"], decoHint: ["Kéo để di chuyển · bấm 1 lần để xoay/lật/xoá · sofa ở phòng chờ/quầy thêm 3 chỗ ngồi · tối đa 40 món", "끌어서 옮기고, 한 번 누르면 돌리기 · 뒤집기 · 지우기 · 대기실·카운터에 놓은 소파는 자리 +3 · 최대 40개", "Drag to move · tap once to rotate/flip/remove · a sofa in the lounge/counter adds 3 seats · up to 40"],
    gq_done: ["Xong {n} lượt làm", "시술 {n}건 끝내기", "Finish {n} sessions"], gq_water: ["Tưới cây {n} lần", "화분에 물 {n}번 주기", "Water plants {n} times"], gq_care: ["Chăm KTV {n} lần (ăn vặt · khen)", "테라피스트 챙기기 {n}번 (간식 · 칭찬)", "Care for staff {n} times (snack · praise)"],
    gq_ud: ["Đón {n} khách Uncle Day", "엉클데이 손님 {n}팀 모시기", "Serve {n} Uncle Day guests"], gq_ontime: ["Hôm nay không ai đi trễ", "오늘 지각 0명", "Nobody late today"],
    claim: ["Nhận", "받기", "Claim"], claimed: ["Đã nhận ✓", "받음 ✓", "Claimed ✓"], gHint: ["🪴 Bấm chậu cây để tưới, cây nở hoa (✨) thì bấm để thu hoạch · bấm nhân viên đang nghỉ để cho ăn vặt/khen · vuốt ve thú cưng", "🪴 화분을 누르면 물을 줘요. 꽃이 피면(✨) 눌러서 수확해요 · 쉬는 직원을 누르면 간식·칭찬 · 펫을 쓰다듬어 보세요", "🪴 Tap a plant to water it, tap again when it blooms (✨) to harvest · tap a resting staff for a snack/praise · pet the animals"],
    gNoPlant: ["Chưa có chậu cây. Bấm 🪴 Trang trí để đặt chậu cây.", "화분이 아직 없어요. 🪴 꾸미기에서 화분을 놓아 보세요.", "No plants yet. Add one with 🪴 Decorate."],
    lvT: [["Mầm non", "Tiệm khu phố", "Có khách quen", "Được truyền tai", "Điểm hẹn khu phố", "Spa được yêu thích", "Nổi tiếng khu vực", "Uncle Day đề cử", "Uncle Day chứng nhận", "Huyền thoại"], ["새싹 매장", "동네 가게", "단골 생긴 집", "입소문 난 곳", "동네 명소", "인기 스파", "지역 대표", "엉클 추천", "엉클 인증", "전설의 스파"], ["Sprout", "Local shop", "Has regulars", "Word of mouth", "Local spot", "Popular spa", "Area favorite", "Uncle Day pick", "Uncle Day certified", "Legend"]],
    lvUp: ["🎉 Lên cấp! Lv{n} {t}", "🎉 레벨 업! Lv{n} {t}", "🎉 Level up! Lv{n} {t}"], watered: ["💧 +3XP", "💧 물 줬어요 +3XP", "💧 +3XP"], harvested: ["🌸 +10🪙 +8XP", "🌸 수확! +10🪙 +8XP", "🌸 +10🪙 +8XP"], petted: ["❤️ +2XP", "❤️ 좋아해요 +2XP", "❤️ +2XP"],
    snack: ["🍵 Ăn vặt (5🪙)", "🍵 간식 (5🪙)", "🍵 Snack (5🪙)"], praise: ["👏 Khen", "👏 칭찬", "👏 Praise"], snacked: ["🍵 +2XP", "🍵 간식 줬어요 +2XP", "🍵 +2XP"], praised: ["👏 +1XP", "👏 칭찬했어요 +1XP", "👏 +1XP"],
    guard: ["Bảo vệ", "가드", "Guard"],
    dk_sofa: ["Sofa", "소파", "Sofa"], rotate: ["↻ Xoay", "↻ 돌리기", "↻ Rotate"], mirror: ["↔ Lật", "↔ 뒤집기", "↔ Flip"], remove: ["🗑 Xoá", "🗑 지우기", "🗑 Remove"],
    decoSave: ["Lưu trang trí", "꾸미기 저장", "Save"], decoCancel: ["Huỷ", "취소", "Cancel"], decoSaved: ["Đã lưu trang trí.", "꾸민 모습을 저장했어요.", "Decor saved."], decoMax: ["Tối đa 40 món.", "40개까지 놓을 수 있어요.", "Up to 40 items."],
    dk_plant: ["Chậu cây", "화분", "Plant"], dk_palm: ["Cây cọ", "야자수", "Palm"], dk_flower: ["Hoa", "꽃", "Flowers"], dk_fish: ["Bể cá", "어항", "Aquarium"], dk_lantern: ["Đèn lồng", "등불", "Lantern"], dk_candle: ["Nến thơm", "아로마 캔들", "Candle"], dk_cat: ["Mèo", "고양이", "Cat"], dk_dog: ["Chó", "강아지", "Dog"],
    qT: ["🎯 Nhiệm vụ hôm nay", "🎯 오늘의 퀘스트", "🎯 Today's quests"], q1: ["Phục vụ {n} lượt khách", "손님 {n}팀 모시기", "Serve {n} guests"], q2: ["Không ai đi trễ", "지각 0명", "Nobody late"], q3: ["Không để khách chờ", "기다리는 손님 0명", "No one waiting"], q4: ["Mọi người đã chấm công", "근무자 모두 출근", "Everyone clocked in"],
    qDone: ["🎉 Hoàn thành hết! Cả đội làm tốt lắm.", "🎉 오늘 퀘스트 완료! 모두 수고했어요.", "🎉 All done! Great teamwork."],
    roNote: ["Chỉ xem (quản trị Uncle Day).", "읽기 전용이에요 (엉클데이 관리자 보기).", "Read-only (Uncle Day admin view)."],
    sPhoneSet: ["Đã có số ✓ (nhập để đổi)", "전화번호 등록됨 ✓ (바꾸려면 입력)", "Phone saved ✓ (type to change)"],
    appT: ["📱 Màn hình nhân viên", "📱 직원 화면", "📱 Staff app"], appOn: ["Đang dùng", "사용 중", "On"], appOffS: ["Chưa dùng", "안 씀", "Off"], pinMake: ["Tạo PIN", "PIN 만들기", "Make PIN"], pinRe: ["Tạo lại PIN", "PIN 다시 만들기", "New PIN"], pinOff: ["Tắt", "끄기", "Turn off"],
    pinNeedPhone: ["Hãy nhập số điện thoại và lưu trước.", "먼저 전화번호를 넣고 저장해 주세요.", "Add a phone number and save first."],
    pinShow: ["Mã PIN của {n}: {p}", "{n}님 PIN: {p}", "{n}'s PIN: {p}"], pinHow: ["Nhân viên vào www.uncleday.com/staff, đăng nhập bằng số điện thoại + PIN này. PIN chỉ hiện một lần. Nếu quên, hãy tạo lại.", "직원에게 www.uncleday.com/staff 에서 전화번호 + 이 PIN으로 로그인하라고 알려 주세요. PIN은 지금 한 번만 보여요. 잊어버리면 다시 만들면 돼요.", "Tell the staff to log in at www.uncleday.com/staff with their phone + this PIN. Shown only once; make a new one if forgotten."],
    viaPhone: ["chấm công bằng điện thoại", "휴대폰 출근", "clocked in by phone"],
    hFee: ["Phí UD {v}", "수수료 {v}", "Fee {v}"], hNoFee: ["Không phí", "수수료 없음", "No fee"], hWorked: ["Làm {h}", "근무 {h}", "Worked {h}"], hGone: ["đã nghỉ", "퇴사", "left"],
    lgIdle: ["Đang chờ / trực quầy", "대기 중 · 카운터 근무", "Free / at desk"], lgWork: ["Đang làm", "시술 중", "In session"], lgMove: ["Đang đi", "이동 중", "Moving"], lgOff: ["Chưa vào / đã về", "출근 전 · 퇴근", "Not in / gone"], lgDay: ["Nghỉ", "휴무", "Day off"],
    stBefore: ["Chưa mở · mở lúc {n}", "영업 전 · {n} 오픈", "Not open · opens {n}"], stOpen: ["Đang mở cửa", "영업 중", "Open"], stSince: ["mở từ {n}", "{n}부터", "since {n}"],
    stAfter: ["Đã hết giờ · {n}", "영업 종료 · {n}", "Closed · {n}"], stClosed: ["Đã đóng cửa lúc {n}", "{n} 영업 마감", "Closed at {n}"], stDayoff: ["Hôm nay nghỉ", "오늘 휴무일", "Closed today"],
    openEarly: ["Mở cửa ngay", "지금 영업 시작", "Open now"], closeNow: ["Đóng cửa", "영업 마감", "Close"], extend: ["Mở thêm giờ", "영업 연장", "Stay open"], reopen: ["Mở lại", "다시 영업 시작", "Reopen"], openAnyway: ["Vẫn mở cửa", "그래도 영업 시작", "Open anyway"],
    closedOk: ["Đã đóng cửa", "영업을 마감했어요", "Closed"], closedStill: ["Đã đóng cửa · còn {n} nhân viên chưa chấm ra", "영업 마감했어요 · 아직 퇴근 안 한 직원 {n}명", "Closed · {n} staff still clocked in"], closeAll: ["Đóng cửa", "영업 마감", "Close"], openHint: ["Chấm vào cho tất cả nhân viên làm hôm nay", "오늘 근무자를 모두 출근 처리해요", "Clock in everyone working today"],
    openDone: ["Đã chấm vào {n} người", "{n}명 출근 처리했어요", "{n} clocked in"], closeDone: ["Đã chấm ra {n} người", "{n}명 퇴근 처리했어요", "{n} clocked out"], vSched: ["Lịch làm", "근무표", "Rota"], vSet: ["⚙️ Cài đặt", "⚙️ 매장 설정", "⚙️ Setup"], refresh: ["↻", "↻", "↻"],
    kWork: ["Đang làm", "시술 중", "In session"], kWait: ["Khách chờ", "대기 손님", "Waiting"], kDone: ["Xong hôm nay", "오늘 완료", "Done today"], kRev: ["Doanh thu", "오늘 매출", "Revenue"],
    expT: ["Khách Uncle Day hôm nay", "오늘 올 엉클데이 손님", "Uncle Day guests today"], arrive: ["Đã đến", "도착", "Arrived"],
    walkT: ["Tiếp nhận khách", "손님 접수", "Add a guest"], gName: ["Tên khách", "손님 이름", "Guest name"], course: ["Dịch vụ", "코스", "Service"], ppl: ["Số khách", "인원", "Guests"], addG: ["Tiếp nhận", "접수", "Add"],
    waitT: ["Khách đang chờ", "기다리는 손님", "Waiting guests"], noWait: ["Chưa có khách chờ.", "기다리는 손님이 없어요.", "No one is waiting."],
    assign: ["Phân công", "배정", "Assign"], leave: ["Về", "나감", "Left"], tp: ["Kỹ thuật viên", "테라피스트", "Therapist"], bed: ["Giường / ghế", "베드 / 체어", "Bed / chair"], choose: ["Chọn", "선택", "Choose"], start: ["Bắt đầu", "시작", "Start"],
    tpPick: ["Chọn KTV (tối đa 4 người)", "테라피스트 고르기 (최대 4명)", "Therapists (up to 4)"], tpN: ["{n} người", "{n}명", "{n}"], max4: ["Tối đa 4 KTV cho một khách.", "손님 한 명에 테라피스트는 4명까지예요.", "Up to 4 therapists per guest."],
    noTp: ["Không có KTV đang rảnh (chưa chấm vào?).", "대기 중인 테라피스트가 없어요 (출근 처리를 했나요?).", "No free therapist (clocked in?)."], noBed: ["Không có chỗ trống phù hợp.", "이 코스에 맞는 빈 자리가 없어요.", "No suitable free bed."],
    workT: ["Đang làm", "시술 중", "In session"], noWork: ["Chưa có ca nào.", "진행 중인 시술이 없어요.", "Nothing in progress."],
    left: ["còn {n}′", "{n}분 남음", "{n} min left"], over: ["quá {n}′", "{n}분 지남", "{n} min over"], ext: ["+15′", "+15분", "+15 min"], finish: ["Xong", "끝내기", "Finish"], cancel: ["Hủy ca", "시술 취소", "Cancel"],
    paid: ["Số tiền khách trả (₫)", "받은 금액 (₫)", "Amount paid (₫)"], udAuto: ["Lịch Uncle Day: tự ghi đã đến + số tiền.", "엉클데이 예약: 방문 완료 · 금액이 자동으로 기록돼요.", "Uncle Day booking: visit + amount are recorded automatically."], save: ["Lưu", "저장", "Save"],
    attT: ["Chấm công", "근태", "Attendance"], cIn: ["Chấm vào", "출근", "Clock in"], cOut: ["Chấm ra", "퇴근", "Clock out"], late: ["trễ {n}′", "지각 {n}분", "{n} min late"], onTime: ["đúng giờ", "정시", "on time"],
    dayOff: ["🌙 Nghỉ", "🌙 휴무", "🌙 Off"], dayOn: ["☀️ Đi làm", "☀️ 근무", "☀️ Work"],
    doneT: ["Xong hôm nay", "오늘 완료", "Done today"], noDone: ["Chưa có ca xong.", "아직 끝난 시술이 없어요.", "Nothing finished yet."],
    s_off: ["Chưa vào", "출근 전", "Not in"], s_idle: ["Đang chờ", "대기 중", "Free"], s_desk: ["Trực quầy", "카운터 근무", "At desk"], s_work: ["Đang làm", "시술 중", "Working"], s_gone: ["Đã về", "퇴근", "Gone"], s_dayoff: ["Nghỉ", "휴무", "Day off"], s_move: ["Đang đi", "이동 중", "Moving"],
    roleTp: ["KTV", "테라피스트", "Therapist"], roleRcp: ["Lễ tân", "리셉션", "Reception"],
    lounge: ["Phòng chờ NV", "직원 대기실", "Staff lounge"], counter: ["Quầy lễ tân", "카운터", "Reception"], entrance: ["LỐI VÀO", "입구", "ENTRANCE"], stairs: ["CẦU THANG", "계 단", "STAIRS"],
    room: ["P.{n}", "{n}호", "Rm {n}"], free: ["Trống", "비어 있음", "Free"], busyN: ["Đang làm {n}", "시술 중 {n}", "Busy {n}"], fchip: ["Tầng {f} · {a}/{b}", "{f}F · 시술 {a}/{b}", "{f}F · {a}/{b}"],
    sh_A: ["Ca mở cửa", "오픈조", "Opening"], sh_B: ["Ca đóng cửa", "마감조", "Closing"], sh_F: ["Cả ngày", "종일", "Full"], sh_O: ["Nghỉ", "휴무", "Off"], sh_C: ["Giờ riêng", "시간 지정", "Custom"], sh_null: ["Mặc định", "평소대로", "Default"],
    hrsN: ["{n} giờ", "{n}시간", "{n} h"], wkTot: ["Tuần {n}h", "주 {n}시간", "{n}h / wk"], pickT: ["{a} · {b}", "{a} · {b}", "{a} · {b}"], pickC: ["Tự đặt giờ", "시간 직접 정하기", "Set hours"], pickSave: ["Lưu giờ", "이 시간으로", "Save"], nextDay: ["(hôm sau)", "(다음날)", "(+1)"], badHrs: ["Giờ kết thúc phải sau giờ bắt đầu.", "끝나는 시간이 시작 시간보다 늦어야 해요.", "End must be after start."],
    bedW: ["Giường", "베드", "Bed"], chairW: ["Ghế", "체어", "Chair"], anyW: ["Giường·Ghế", "베드·체어", "Bed·Chair"],
    eq_rf: ["Máy RF", "고주파", "RF"], eq_led: ["Đèn LED", "LED", "LED"], eq_hydra: ["Hydra", "아쿠아필", "Hydra"], eq_steam: ["Xông hơi", "스티머", "Steamer"],
    thisWk: ["Tuần này", "이번 주", "This week"], minL: ["Tối thiểu: mở cửa {a} · đóng cửa {b}", "최소 인원 오픈 {a} · 마감 {b}", "Minimum opening {a} · closing {b}"], cov: ["Mở {a} · Đóng {b}", "오픈 {a} · 마감 {b}", "Open {a} · Close {b}"],
    cellHint: ["Bấm ô để chọn ca hoặc tự đặt giờ (vd: làm 4 tiếng)", "칸을 누르면 오픈조 · 마감조 · 종일 · 휴무를 고르거나 시간을 직접 정할 수 있어요 (4시간 근무 등)", "Tap a cell to pick a shift or set custom hours (e.g. 4 hours)"],
    reqT: ["Yêu cầu của nhân viên", "직원 요청", "Staff requests"], noReq: ["Chưa có yêu cầu.", "요청이 없어요.", "No requests."], ok: ["Duyệt", "승인", "Approve"], no: ["Từ chối", "거절", "Decline"],
    r_off: ["Xin nghỉ", "휴무 신청", "Day off"], r_shift: ["Đổi ca → {n}", "근무 변경 → {n}", "Change → {n}"], r_swap: ["Đổi ca với {n}", "{n}와 교대", "Swap with {n}"], must: ["Bắt buộc", "꼭 휴무", "Must"],
    st_peer: ["Chờ đồng nghiệp", "동료 확인 중", "Waiting for colleague"], st_pending: ["Chờ duyệt", "확인 필요", "Pending"], st_ok: ["Đã duyệt", "승인됨", "Approved"], st_no: ["Từ chối", "거절됨", "Declined"], st_cancelled: ["Đã hủy", "취소됨", "Cancelled"],
    staffOnlyReq: ["Nhân viên sẽ gửi yêu cầu từ màn hình riêng (bước tiếp theo).", "직원 화면에서 요청을 보내는 기능은 다음 단계에서 열려요.", "Staff will send requests from their own screen (next step)."],
    setT: ["Cài đặt cửa hàng", "매장 설정", "Shop setup"], close: ["Đóng", "닫기", "Close"], tShop: ["Cửa hàng", "매장", "Shop"], tFloors: ["Tầng · Phòng", "층 · 방", "Floors · Rooms"], tCourses: ["Dịch vụ", "코스", "Services"], tStaff: ["Nhân viên", "직원", "Staff"],
    kind: ["Loại hình", "업종", "Type"], massage: ["Spa massage", "마사지샵", "Massage spa"], skin: ["Chăm sóc da", "피부관리샵", "Skin care"], minAm: ["Tối thiểu ca mở cửa", "오픈 최소 인원", "Min opening"], minPm: ["Tối thiểu ca đóng cửa", "마감 최소 인원", "Min closing"],
    shiftTimes: ["Giờ các ca", "근무 시간", "Shift times"],
    f1Note: ["Tầng 1 là quầy lễ tân và phòng chờ. Phòng làm từ tầng 2. Tối đa 7 giường/ghế mỗi tầng.", "1층은 카운터와 직원 대기실이에요. 시술방은 2층부터, 한 층에 베드·체어 7개까지예요.", "Floor 1 is reception and the staff lounge. Rooms start on floor 2, up to 7 beds per floor."],
    addRoom: ["+ Thêm phòng", "+ 방 추가", "+ Room"], addFloor: ["+ Thêm tầng", "+ 층 추가", "+ Floor"], delFloor: ["Xóa tầng", "층 삭제", "Remove floor"], eqL: ["Máy", "장비", "Equipment"],
    saveLayout: ["Lưu cài đặt", "설정 저장", "Save setup"], addCourse: ["+ Thêm dịch vụ", "+ 코스 추가", "+ Service"], cKo: ["Tên (Hàn)", "이름 (한국어)", "Name (Korean)"], cVi: ["Tên (Việt)", "이름 (베트남어)", "Name (Vietnamese)"],
    cMin: ["Phút", "분", "Min"], cPrice: ["Giá (₫)", "가격 (₫)", "Price (₫)"], cWhere: ["Chỗ", "자리", "Where"], cEq: ["Cần máy", "필요 장비", "Needs"], none: ["Không", "없음", "None"],
    addStaff: ["+ Thêm nhân viên", "+ 직원 추가", "+ Staff"], sName: ["Tên", "이름", "Name"], sPhone: ["SĐT (không bắt buộc)", "전화번호 (선택)", "Phone (optional)"], sYears: ["Năm KN", "경력(년)", "Years"],
    sRole: ["Vai trò", "역할", "Role"], sDef: ["Ca thường", "평소 근무", "Usual shift"], sOff: ["Nghỉ cố định", "정기 휴무", "Weekly off"],
    hair: ["Tóc", "머리", "Hair"], top: ["Áo", "상의", "Top"], bottom: ["Quần/Váy", "하의", "Bottom"],
    hs_short: ["Ngắn", "단발", "Short"], hs_long: ["Dài", "긴 머리", "Long"], hs_bun: ["Búi", "올림머리", "Bun"], hs_pony: ["Đuôi ngựa", "포니테일", "Ponytail"],
    tp_uniform: ["Đồng phục", "유니폼", "Uniform"], tp_tee: ["Áo thun", "티셔츠", "T-shirt"], tp_aodai: ["Áo dài", "아오자이", "Ao dai"], bt_pants: ["Quần", "바지", "Pants"], bt_skirt: ["Váy", "치마", "Skirt"],
    saveStaff: ["Lưu nhân viên", "직원 저장", "Save staff"], removeStaff: ["Nghỉ việc", "퇴사 처리", "Remove"], removeAsk: ["Bấm lần nữa để xác nhận", "한 번 더 누르면 퇴사 처리돼요", "Tap again to confirm"],
    wd: [["CN", "T2", "T3", "T4", "T5", "T6", "T7"], ["일", "월", "화", "수", "목", "금", "토"], ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]],
    saved: ["Đã lưu", "저장했어요", "Saved"], ownerOnly: ["Chỉ chủ cửa hàng mới đổi được.", "사장님 계정만 바꿀 수 있어요.", "Only the owner can change this."],
    firstRun: ["Bắt đầu: vào ⚙️ Cài đặt để nhập phòng, dịch vụ và nhân viên của cửa hàng.", "처음이에요: ⚙️ 매장 설정에서 방 · 코스 · 직원을 먼저 넣어 주세요.", "First time: set up rooms, services and staff in ⚙️ Setup."],
    sent: ["{a} → {b}", "{a} → {b}", "{a} → {b}"], doneToast: ["Xong: {n}", "시술 완료: {n}", "Done: {n}"]
  };
  let lang = "vi";
  const li = () => Math.max(0, LANGS.indexOf(lang));
  const t = (k, v) => { const a = T[k]; let s = Array.isArray(a) ? a[li()] : k; if (v && typeof s === "string") for (const x in v) s = s.split("{" + x + "}").join(v[x]); return s; };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const vnd = n => String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "₫";
  const fmt = m => String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(Math.round(m) % 60).padStart(2, "0");
  const cName = c => (c && (lang === "ko" ? (c.ko || c.vi) : (c.vi || c.ko))) || "";
  const fmtX = m => fmt(m) + (m >= 1440 ? " " + t("nextDay") : "");
  const hrsTxt = h => h ? fmt(h[0]) + "–" + fmt(h[1]) : "";
  const durH = h => h ? Math.round((h[1] - h[0]) / 6) / 10 : 0;
  const TIMESC = Array.from({ length: 43 }, (_, i) => 360 + i * 30);
  // 날짜 표기: 한국어 11/9 (월) · 11월 9일 (월), 베트남어 T2, 9/11, 영어 Mon, Nov 9
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dParts = ds => { const d = new Date(ds + "T00:00:00Z"); return { m: d.getUTCMonth() + 1, d: d.getUTCDate(), w: T.wd[li()][d.getUTCDay()] }; };
  const dShort = ds => { const p = dParts(ds); return lang === "ko" ? `${p.m}/${p.d} (${p.w})` : lang === "vi" ? `${p.w}, ${p.d}/${p.m}` : `${p.w}, ${MON[p.m - 1]} ${p.d}`; };
  const dLong = ds => { const p = dParts(ds); return lang === "ko" ? `${p.m}월 ${p.d}일 (${p.w})` : dShort(ds); };
  const dRange = (a, b) => { const p = dParts(a), q = dParts(b), same = p.m === q.m;
    return lang === "ko" ? `${p.m}월 ${p.d}일 ~ ${same ? "" : q.m + "월 "}${q.d}일` : lang === "vi" ? `${p.d}/${p.m} – ${q.d}/${q.m}` : `${MON[p.m - 1]} ${p.d} – ${same ? "" : MON[q.m - 1] + " "}${q.d}`; };
  const tm = iso => { if (!iso) return ""; const d = new Date(Date.parse(iso) + 7 * 3600e3); return String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0"); };

  /* ---------- 도트 캐릭터 ---------- */
  const TOPC = ["#2E8B62", "#3A7CA5", "#9B4F7A", "#C9821E", "#C2563A", "#5B5BA8", "#3D8C8C", "#F2EEE6"];
  const BOTC = ["#3F3A4F", "#1F2430", "#F2EEE6", "#C9B79A", "#6B4A33", "#7A8290"];
  const HAIRC = ["#2B1D14", "#4A2C1A", "#1E1A1A", "#7A4A28", "#B0784A"];
  const BODY = {
    down: ["...hhhhhh...", "..hhhhhhhh..", ".hhhhhhhhhh.", ".hhsssssshh.", ".hsessssesh.", ".hssssssssh.", "...ssmmss...", "..cccccccc..", ".sccccccccs.", ".sccccccccs.", "..dddddddd..", "..pppppppp.."],
    up: ["...hhhhhh...", "..hhhhhhhh..", ".hhhhhhhhhh.", ".hhhhhhhhhh.", ".hhhhhhhhhh.", ".shhhhhhhhs.", "...hhhhhh...", "..cccccccc..", ".sccccccccs.", ".sccccccccs.", "..dddddddd..", "..pppppppp.."],
    side: ["...hhhhh....", "..hhhhhhh...", ".hhhhhhhhh..", ".hhhhhssss..", ".hhhhssses..", ".hhhhsssss..", "..hhhssmss..", "...cccccc...", "...ccccccc..", "...ccscccc..", "...dddddd...", "...pppppp..."]
  };
  const HAIR = {
    short: { top: {}, rows: {} },
    long: { top: {}, rows: { down: { 6: ".h.ssmmss.h.", 7: ".hcccccccch.", 8: "hsccccccccsh" }, up: { 6: "..hhhhhhhh..", 7: "..chhhhhhc..", 8: ".schhhhhhcs." }, side: { 7: ".hhcccccc...", 8: ".hhccccccc.." } } },
    bun: { top: { down: "....hhhh....", up: "....hhhh....", side: ".hhh........" }, rows: {} },
    pony: { top: {}, rows: { up: { 7: "..ccchhccc..", 8: ".scccchhccs.", 9: ".sccchhcccs." }, side: { 3: "hhhhhhssss..", 4: "hhhhhssses..", 5: "h.hhhsssss.." } } }
  };
  const LEGS = {
    down: [["..ppp..ppp..", "..ppp..ppp..", "..fff..fff..", "............"], ["..ppp..ppp..", "..ppp..fff..", "..fff.......", "............"], ["..ppp..ppp..", "..fff..ppp..", ".......fff..", "............"]],
    side: [["...pp..pp...", "...pp..pp...", "...ff..fff..", "............"], ["...pp...pp..", "..pp....pp..", "..ff.....ff.", "............"], ["....pppp....", "....pppp....", "....fffff...", "............"]]
  };
  LEGS.up = LEGS.down;
  const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const shade = (h, k) => "#" + hex(h).map(v => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, "0")).join("");
  const sCache = {};
  function sheet(o) {
    const key = JSON.stringify(o); if (sCache[key]) return sCache[key];
    const CW = 14, CH = 19, R = 17, cv = document.createElement("canvas"); cv.width = CW * 3; cv.height = CH * 3;
    const ctx = cv.getContext("2d"), img = ctx.createImageData(cv.width, cv.height), d = img.data, W = cv.width;
    const pal = { h: hex(o.hairC), s: hex(o.skin || "#F1C7A0"), e: hex("#2A1E1A"), m: hex("#D9826E"), c: hex(o.topC), d: hex(shade(o.topC, 0.72)), p: hex(o.botC), f: hex("#2B2622"), g: hex("#0D0F12"), w: hex("#F4F4F4"), t: hex("#26292E"), l: hex("#7FA8C9") }, OUT = hex("#2A2220");
    const hs = HAIR[o.hair] || HAIR.short;
    ["down", "up", "side"].forEach((dir, row) => {
      for (let col = 0; col < 3; col++) {
        const body = BODY[dir].slice(), ov = hs.rows[dir] || {}; for (const k in ov) body[k] = ov[k];
        if (o.top !== "uniform") body[10] = body[10].replace(/d/g, "c");
        if (o.guard) {
          if (dir === "down") { body[3] = ".hssssssssh."; body[4] = ".hgglggglgh."; body[6] = "...ssssss..."; body[7] = ".cccwwwwccc."; body[8] = "ccccwttwcccc"; body[9] = "scccctttcccs"; body[10] = ".ddddttdddd."; }
          else if (dir === "side") { body[4] = ".hhhhsgggl.."; body[6] = "..hhhsssss.."; body[7] = "..cccccww..."; body[8] = "..ccccccct.."; body[9] = "..ccsccccc.."; }
          else { body[7] = ".cccccccccc."; body[8] = "cccccccccccc"; body[9] = "sccccccccccs"; body[10] = ".dddddddddd."; }
        }
        const legs = LEGS[dir][col].slice();
        if (o.bottom === "skirt") { legs[0] = dir === "side" ? "..pppppppp.." : ".pppppppppp."; for (let i = 1; i < 3; i++) legs[i] = legs[i].replace(/p/g, "s"); }
        if (o.top === "aodai") { body[11] = body[11].replace(/p/g, "c"); legs[0] = dir === "side" ? "..cccccccc.." : ".cccccccccc."; }
        const map = [hs.top[dir] || "............"].concat(body, legs), ox = col * CW + 1, oy = row * CH + 1;
        const filled = (x, y) => d[((oy + y) * W + ox + x) * 4 + 3] === 255;
        map.forEach((line, y) => { for (let x = 0; x < 12; x++) { const c = pal[line[x]]; if (c) { const i = ((oy + y) * W + ox + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; } } });
        const out = [];
        for (let y = -1; y <= R; y++) for (let x = -1; x <= 12; x++) {
          if (x >= 0 && x < 12 && y >= 0 && y < R && filled(x, y)) continue;
          if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const xx = x + a, yy = y + b; return xx >= 0 && xx < 12 && yy >= 0 && yy < R && filled(xx, yy); })) out.push([x, y]);
        }
        out.forEach(([x, y]) => { const i = ((oy + y) * W + ox + x) * 4; d[i] = OUT[0]; d[i + 1] = OUT[1]; d[i + 2] = OUT[2]; d[i + 3] = 255; });
      }
    });
    ctx.putImageData(img, 0, 0);
    return (sCache[key] = cv.toDataURL());
  }
  const defLook = i => ({ hair: ["long", "pony", "bun", "short"][i % 4], hc: i % 5, top: "uniform", tc: i % 7, bottom: "pants", bc: 0 });
  const lookOf = (l, i) => { l = Object.assign(defLook(i || 0), l || {}); return { hair: l.hair, hairC: HAIRC[l.hc % HAIRC.length], top: l.top, topC: TOPC[l.tc % TOPC.length], bottom: l.bottom, botC: BOTC[l.bc % BOTC.length] }; };
  const avStyle = (st, i) => `background-image:url(${sheet(lookOf(st.look, i))})`;

  const EQSVG = {
    rf: '<svg viewBox="0 0 26 32"><rect x="4" y="9" width="14" height="18" rx="2" fill="#ECE8F6" stroke="#3A2E25" stroke-width="1.5"/><rect x="6" y="11" width="10" height="7" rx="1" fill="#2B2D52"/><path d="M7 15 l2-2 2 3 2-3 2 2" stroke="#9EE6FF" stroke-width="1" fill="none"/><circle cx="8" cy="22" r="1.3" fill="#6C5AA8"/><circle cx="12" cy="22" r="1.3" fill="#C9762A"/><path d="M18 13 q6 2 4 9" stroke="#3A2E25" stroke-width="1.3" fill="none"/><rect x="19.5" y="21" width="4.5" height="7" rx="2" fill="#6C5AA8" stroke="#3A2E25"/><circle cx="7" cy="29.5" r="1.7" fill="#3A2E25"/><circle cx="15" cy="29.5" r="1.7" fill="#3A2E25"/></svg>',
    led: '<svg viewBox="0 0 26 32"><line x1="13" y1="8" x2="13" y2="28" stroke="#3A2E25" stroke-width="2"/><path d="M6 30 h14" stroke="#3A2E25" stroke-width="2.5" stroke-linecap="round"/><path d="M3 12 Q13 1 23 12" stroke="#3A2E25" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M3 12 Q13 1 23 12" stroke="#5A4A3A" stroke-width="3.5" fill="none" stroke-linecap="round"/><g class="glow"><circle cx="5.5" cy="10" r="1.2" fill="#FF6B4A"/><circle cx="9" cy="6.6" r="1.2" fill="#FFB347"/><circle cx="13" cy="5.4" r="1.2" fill="#FF6B4A"/><circle cx="17" cy="6.6" r="1.2" fill="#FFB347"/><circle cx="20.5" cy="10" r="1.2" fill="#FF6B4A"/></g></svg>',
    hydra: '<svg viewBox="0 0 26 32"><rect x="5" y="3" width="4.5" height="10" rx="1.8" fill="#5BC0EB" stroke="#3A2E25"/><rect x="11" y="4" width="4.5" height="9" rx="1.8" fill="#8BD17C" stroke="#3A2E25"/><rect x="3" y="12" width="16" height="16" rx="3" fill="#F4FAFD" stroke="#3A2E25" stroke-width="1.5"/><rect x="6" y="15" width="10" height="5" rx="1" fill="#2C86A8"/><circle cx="11" cy="24" r="1.5" fill="#5BC0EB"/><path d="M19 17 q6 1 4 9" stroke="#3A2E25" stroke-width="1.3" fill="none"/><circle cx="22.5" cy="27" r="2" fill="#2C86A8" stroke="#3A2E25"/><circle cx="6" cy="30" r="1.6" fill="#3A2E25"/><circle cx="16" cy="30" r="1.6" fill="#3A2E25"/></svg>',
    steam: '<svg viewBox="0 0 26 32"><g class="steam"><circle cx="21.5" cy="4.5" r="2.3" fill="#FFFFFF" stroke="#C9D3DA" stroke-width=".6"/><circle cx="24" cy="1.5" r="1.6" fill="#FFFFFF" stroke="#C9D3DA" stroke-width=".6"/></g><circle cx="10" cy="12" r="6.2" fill="#DDE6EC" stroke="#3A2E25" stroke-width="1.5"/><circle cx="8" cy="10" r="1.6" fill="#FFFFFF"/><path d="M14.5 9 L20 6.5" stroke="#3A2E25" stroke-width="2.6" stroke-linecap="round"/><line x1="10" y1="18" x2="10" y2="27" stroke="#3A2E25" stroke-width="2"/><path d="M4 30.5 L10 26.5 L16 30.5" stroke="#3A2E25" stroke-width="2" fill="none" stroke-linecap="round"/></svg>'
  };
  const EQ = ["rf", "led", "hydra", "steam"];

  /* ---------- 상태 ---------- */
  let C = null, root = null, data = null, view = "board", skew = 0, pollT = 0, tickT = 0, emoT = 0, raf = 0, last = 0, anim = 0;
  let geoSig = "", G = null, plan = null, W = new Map(), GW = new Map(), prevSess = new Map(), prevGuest = new Map(), pendOcc = new Set();
  let pinShow = null, hist = null, hpick = null, hp = { mode: "day", d: null }, open = { assign: null, finish: null, tps: [] }, setOpen = false, setTab = "floors", draft = null, staffDraft = null, rmAsk = null, sched = null, weekFrom = null, busy = false;
  const nowMs = () => Date.now() + skew;
  const owner = () => C && C.isOwner;

  // 서버 오류 문구를 화면 언어로
  const ERR = {
    "This therapist is busy": ["KTV này đang làm cho khách khác.", "이 테라피스트는 지금 다른 손님 시술 중이에요.", "This therapist is busy with another guest."],
    "This bed is in use": ["Giường này đang có khách.", "이 베드는 지금 사용 중이에요.", "This bed is in use."],
    "This guest is not waiting": ["Khách này không còn trong danh sách chờ.", "이 손님은 이미 배정됐거나 나갔어요. 새로고침해 주세요.", "This guest is no longer waiting."],
    "Choose a therapist": ["Hãy chọn KTV.", "테라피스트를 골라 주세요.", "Choose a therapist."],
    "Up to 4 therapists": ["Tối đa 4 KTV.", "테라피스트는 4명까지예요.", "Up to 4 therapists."],
    "Unknown bed": ["Không tìm thấy giường.", "베드를 찾을 수 없어요.", "Unknown bed."],
    "Session not found": ["Không tìm thấy lượt làm.", "시술을 찾을 수 없어요. 새로고침해 주세요.", "Session not found."],
    "Still in a session": ["Đang làm cho khách, chưa thể tan ca.", "시술 중이라 퇴근할 수 없어요.", "Still in a session."],
    "Staff not found": ["Không tìm thấy nhân viên.", "직원을 찾을 수 없어요.", "Staff not found."],
    "Please enter a name": ["Hãy nhập tên.", "이름을 넣어 주세요.", "Please enter a name."],
    "Please choose a course": ["Hãy chọn dịch vụ.", "코스를 골라 주세요.", "Please choose a course."],
    "Please enter the amount": ["Hãy nhập số tiền.", "금액을 넣어 주세요.", "Please enter the amount."],
    "Please check the hours": ["Hãy kiểm tra giờ.", "시간을 확인해 주세요.", "Please check the hours."],
    "Request not found": ["Không tìm thấy yêu cầu.", "요청을 찾을 수 없어요.", "Request not found."],
    "This booking is not confirmed": ["Đặt chỗ này chưa được xác nhận.", "아직 확정되지 않은 예약이에요.", "This booking is not confirmed."],
    "Booking not found": ["Không tìm thấy đặt chỗ.", "예약을 찾을 수 없어요.", "Booking not found."],
    "Floors: 1 to 6": ["Số tầng: 1–6.", "층은 1~6층까지예요.", "Floors: 1 to 6."],
    "Rooms: 1 to 40": ["Số phòng: 1–40.", "방은 40개까지예요.", "Rooms: 1 to 40."],
    "Still moist": ["Đất còn ẩm. Tưới lại sau 2 tiếng.", "아직 촉촉해요. 2시간 뒤에 다시 주세요.", "Still moist. Water again in 2 hours."],
    "Ready to harvest": ["Cây đã nở hoa, bấm để thu hoạch.", "꽃이 폈어요. 눌러서 수확하세요.", "It bloomed. Tap to harvest."],
    "Not ready yet": ["Chưa nở hoa.", "아직 꽃이 안 폈어요.", "Not bloomed yet."],
    "Not enough coins": ["Không đủ xu.", "코인이 모자라요.", "Not enough coins."],
    "Praise once an hour": ["Mỗi người khen 1 lần mỗi giờ.", "칭찬은 한 사람에게 1시간에 한 번이에요.", "Praise once an hour per person."],
    "Pet is napping": ["Bé đang ngủ, lát nữa nhé.", "펫이 낮잠 자요. 30분 뒤에 다시 쓰다듬어 주세요.", "Napping. Try again in 30 minutes."],
    "Quest not finished": ["Nhiệm vụ chưa xong.", "아직 퀘스트를 다 못 했어요.", "Quest not finished."],
    "Plant not found": ["Hãy lưu trang trí trước.", "꾸미기를 먼저 저장해 주세요.", "Save the decor first."],
    "Too many items": ["Quá nhiều đồ vật.", "배치한 물건이 너무 많아요.", "Too many items."],
  };
  const errTx = e => { const m = e && e.message, k = m && Object.keys(ERR).find(x => m.indexOf(x) >= 0); return k ? ERR[k][li()] : C.errMsg(e); };
  async function call(fn, args, keep) {
    if (busy) return null; busy = true;
    try { const r = await C.rpc(fn, Object.assign({ shop: C.shopId }, args || {})); if (r && r.layout && !keep) setData(r); return r; }
    catch (e) { C.toast(errTx(e)); return null; }
    finally { busy = false; }
  }
  let gameT = 0;
  async function load() { try { setData(await C.rpc("board_get", { shop: C.shopId })); } catch (e) { C.toast(errTx(e)); return; } if (!game || Date.now() - gameT > 30000) { gameT = Date.now(); loadGame(); } }
  function setData(d) {
    if (!d || !d.layout) return;
    data = d; skew = Date.parse(d.now) - Date.now();
    if (C.onPending) C.onPending(d.pending_req || 0);
    render();
  }

  /* ---------- 상태 계산 ---------- */
  const sessOf = sid => data.sessions.find(x => x.status === "working" && x.staff_id === sid);
  const grpOf = x => x.grp || x.id, isLead = x => grpOf(x) === x.id;
  const mates = x => data.sessions.filter(y => grpOf(y) === grpOf(x) && y.status === x.status).sort((a, b) => (isLead(b) - isLead(a)) || String(a.id).localeCompare(String(b.id)));
  function stOf(s) {
    if (sessOf(s.id)) return "work";
    if (s.code === "O" && !s.in_at) return "dayoff";
    if (!s.in_at) return "off";
    if (s.out_at) return "gone";
    return s.role === "rcp" ? "desk" : "idle";
  }
  const PILL = { off: "ob-p-off", gone: "ob-p-off", dayoff: "ob-p-off", idle: "ob-p-idle", desk: "ob-p-idle", work: "ob-p-work", move: "ob-p-move" };
  const DOT = { off: "⚪", gone: "⚪", dayoff: "🌙", idle: "🟢", desk: "🟢", work: "🔴", move: "🟡" };
  const courseFits = (stn, c) => { const ty = (c && c.type) || "any", eq = c && c.eq; return (ty === "any" || ty === stn.type) && (!eq || stn.room.eq.indexOf(eq) >= 0); };

  /* ---------- 평면도 ---------- */
  function add(cls, x, y, w, h, html, parent) {
    const d = document.createElement("div"); d.className = cls;
    if (x != null) { d.style.left = x + "px"; d.style.top = y + "px"; }
    if (w != null) { d.style.width = w + "px"; d.style.height = h + "px"; }
    if (html) d.innerHTML = html; (parent || plan).appendChild(d); return d;
  }
  function buildPlan(stage) {
    const L = data.layout, floors = L.floors || [];
    G = { floors: [], st: new Map(), rooms: [] };
    const F = floors.length, Hest = 12 + F * 272 + 384;
    let PW = 720;
    const L2 = layoutDims(Hest);
    if (L2.wide) PW = Math.round(Math.max(720, Math.min(1240, L2.planW / L2.sh)));
    const P = PW - 76; G.PW = PW; G.SHX = P + 36; G.DX = P - 40;
    plan.innerHTML = ""; plan.style.width = PW + "px";
    let y = 12;
    for (let i = F - 1; i >= 0; i--) {
      const f = { num: i + 2, y0: y, cy: y + 222, rooms: [] }; G.floors.push(f);
      add("ob-slab", 12, y, P - 12, 256, `<span class="ob-fl">${f.num}F</span>`); G.slabs = (G.slabs || []).concat([{ fl: f.num, x: 12, y, w: P - 12, h: 256 }]);
      add("ob-corr", 15, y + 194, P - 12, 56);
      const rs = floors[i].rooms || [], n = Math.max(1, rs.length), A = P - 24;
      const Tn = Math.max(1, rs.reduce((a, r) => a + (r.count || 1), 0));
      const SW = Math.min(150, (A - 6 * (n - 1)) / Tn), tot = SW * Tn + 6 * (n - 1);
      let x = 18 + (A - tot) / 2;
      rs.forEach(rd => {
        const k = rd.count || 1, w = SW * k, ry = y + 26, rx = x + w / 2;
        const r = { n: rd.n, type: rd.type || "bed", eq: rd.eq || [], floor: f.num, f, x, w, rx, lane: ry + 158, st: [] };
        r.el = add("ob-zone ob-room" + (L.kind === "skin" ? " skin" : ""), x, ry, w, 168, `<span class="ob-zl">${esc(t("room", { n: rd.n }))}</span><span class="ob-rchip"></span>` + (r.eq.length ? `<div class="ob-eqs">${r.eq.map(e => `<span class="ob-eq" title="${esc(t("eq_" + e))}">${EQSVG[e] || ""}</span>`).join("")}</div>` : ""));
        r.chip = r.el.querySelector(".ob-rchip");
        for (let j = 0; j < k; j++) {
          const sx = x + SW * (j + 0.5), id = rd.n + "-" + (j + 1);
          const s = { id, b: j + 1, room: r, type: r.type, tpSpot: { x: sx + 22, y: ry + 108 }, cuSpot: { x: sx - 14, y: ry + 150 } };
          s.furn = add(r.type === "chair" ? "ob-chair" : "ob-bed", SW * (j + 0.5) - 37, r.type === "chair" ? 38 : 40, null, null, '<div class="ob-pt"><span class="h"></span><span class="b"></span></div>', r.el);
          s.bar = add("ob-sbar", SW * (j + 0.5) - 37, 133, null, null, "<i></i>", r.el).firstChild;
          r.st.push(s); G.st.set(id, s);
        }
        add("ob-gap", rx - 26, ry + 165, 52, 6);
        G.rooms.push(r); f.rooms.push(r); x += w + 6;
      });
      add("ob-gap", P - 4, f.cy - 24, 12, 48);
      y += 272;
    }
    const f1 = { y0: y, cy: y + 53 }; G.f1 = f1;
    add("ob-slab", 12, y, P - 12, 340, '<span class="ob-fl">1F</span>'); G.slabs = (G.slabs || []).concat([{ fl: 1, x: 12, y, w: P - 12, h: 340 }]);
    add("ob-corr", 15, y + 26, P - 12, 54);
    add("ob-gap", P - 4, f1.cy - 22, 12, 44);
    const LX = 12 + Math.round((P - 12) * 0.46), lw = LX - 12, CX0 = LX + 6, cwid = P - CX0, DX = G.DX;
    const lz = add("ob-zone ob-lounge big", 12, y + 86, lw, 254, `<span class="ob-zl">${t("lounge")}</span>`);
    add("ob-deco ob-locker", 8, 34, 24, 90, "", lz); add("ob-deco ob-rug", 60, 50, lw - 130, 80, "", lz); add("ob-deco ob-tea", lw - 42, 110, 30, 60, "🍵", lz);
    add("ob-deco ob-sofa", Math.round(lw * 0.3) - 60, 206, 120, 36, "", lz); add("ob-deco ob-sofa", Math.round(lw * 0.73) - 60, 206, 120, 36, "", lz);
    G.LD = 12 + Math.round(lw / 2); add("ob-gap", G.LD - 25, y + 83, 50, 6);
    const cz = add("ob-zone ob-counter big", CX0, y + 86, cwid, 254, `<span class="ob-zl">${t("counter")}</span>`);
    const dw = Math.min(240, Math.max(150, cwid - 150));
    add("ob-deco ob-desk", 24, 80, dw, 40, "<i></i>RECEPTION", cz);
    add("ob-deco ob-sofa c", 72 - 60 + 3, 206, 120, 36, "", cz); add("ob-deco ob-sofa c", 200 - 60 + 3, 206, 120, 36, "", cz);
    add("ob-gap", DX - 28, y + 83, 56, 6); add("ob-gap ent", DX - 28, y + 337, 56, 6);
    add("ob-entl", DX - 50, y + 346, 100, 18, t("entrance"));
    G.H = y + 384; plan.style.height = G.H + "px";
    const top = G.floors.length ? G.floors[0].y0 : y;
    add("ob-stairs", P + 6, top, 60, y + 340 - top);
    G.floors.concat([f1]).forEach(f => add("ob-landing", P + 9, f.cy - 22, 54, 44));
    for (let i = 0; i < G.floors.length; i++) { const a = G.floors[i], b = G.floors[i + 1] || f1; add("ob-stl", P + 46, (a.cy + b.cy) / 2 - 34, null, null, t("stairs")); }
    f1.ly = y + 130; f1.my = y + 252; f1.dy = y + 128;
    const lsx = [Math.round(lw * 0.3) + 12, Math.round(lw * 0.73) + 12];
    f1.slots = []; lsx.forEach(cx => [-40, 0, 40].forEach(o => f1.slots.push({ x: cx + o, y: y + 318 })));
    for (let k = 0; k < 6; k++) f1.slots.push({ x: Math.round(40 + k * ((lw - 60) / 5)), y: y + 250 });
    f1.seats = []; [CX0 + 75, CX0 + 203].forEach(cx => [-40, 0, 40].forEach(o => f1.seats.push({ x: cx + o, y: y + 318 })));
    for (let k = 0; k < 4; k++) f1.seats.push({ x: CX0 + 40 + k * 46, y: y + 280 });
    f1.desk = { x: CX0 + 24 + Math.round(dw / 2), y: y + 230 };
    f1.dspots = [0.28, 0.72, 0.5].map(k => ({ x: CX0 + 27 + Math.round(dw * k), y: y + 164 }));
    f1.ent = { x: DX, y: y + 372 };
    f1.zl = { x0: 12, x1: 12 + lw, y0: y + 86, y1: y + 340 }; f1.zc = { x0: CX0, x1: CX0 + cwid, y0: y + 86, y1: y + 340 };
    f1.baseSlots = f1.slots.slice(); f1.baseSeats = f1.seats.slice();
    guard = null; setTimeout(placeGuard, 0);
    W.forEach(w => w.el.remove()); W.clear(); GW.forEach(w => w.el.remove()); GW.clear(); pendOcc.clear();
    renderItems();
  }

  /* ---------- 6단계: 꾸미기 · 펫 · 대기 중 몸짓 · 오늘의 퀘스트 ---------- */
  const DECO = { sofa: "🛋️", plant: "🪴", palm: "🌴", flower: "💐", fish: "🐠", lantern: "🏮", candle: "🕯️", cat: "🐈", dog: "🐕" };
  const PETS = ["cat", "dog"];
  let deco = null, pets = [], drag = null, itemSig = "", game = null, care = null;
  const rid = () => Math.random().toString(36).slice(2, 9);
  const POTS = ["plant", "palm", "flower"];
  const itemsNow = () => deco ? deco.items : ((data && data.layout && data.layout.items) || []).filter(it => it && DECO[it.k]);
  function slabOf(fl) { return (G.slabs || []).find(s => s.fl === fl) || (G.slabs || [])[(G.slabs || []).length - 1]; }
  function renderItems() {
    if (!plan || !G.slabs) return;
    plan.querySelectorAll(".ob-item, .ob-itbar").forEach(e => e.remove()); pets = [];
    if (G.f1 && G.f1.baseSlots) { G.f1.slots = G.f1.baseSlots.slice(); G.f1.seats = G.f1.baseSeats.slice(); }
    itemsNow().forEach((it, i) => {
      const sl = slabOf(it.fl); if (!sl) return;
      const x = sl.x + Math.max(0.02, Math.min(0.98, +it.rx || 0.5)) * sl.w, y = sl.y + Math.max(0.1, Math.min(0.98, +it.ry || 0.5)) * sl.h;
      const el = document.createElement("div"); el.className = "ob-item" + (PETS.includes(it.k) ? " pet" : "") + (POTS.includes(it.k) ? " pot" : "") + (deco ? " edit" : "") + (!deco && !C.readOnly && it.id && game && (POTS.includes(it.k) || PETS.includes(it.k)) ? " play" : "");
      el.dataset.i = i; if (it.id) el.dataset.gi = it.id;
      const r = ((+it.r || 0) % 360 + 360) % 360, vert = r === 90 || r === 270;
      if (it.k === "sofa") {
        el.classList.add("sofa"); el.innerHTML = `<span class="sf r${r}"></span>`;
        // 대기실 · 카운터에 놓은 소파는 앉을 자리 3개 (대기실 = 직원, 카운터 = 손님)
        const f = G.f1, cy = y - (vert ? 60 : 18);
        if (f && f.zl && it.fl === 1) {
          const spots = vert ? [-40, 0, 40].map(o => ({ x: Math.round(x), y: Math.round(cy + o + 10) })) : [-40, 0, 40].map(o => ({ x: Math.round(x + o), y: Math.round(cy + 10) }));
          const inZ = z => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1 + 6;
          if (inZ(f.zl)) f.slots = spots.concat(f.slots); else if (inZ(f.zc)) f.seats = spots.concat(f.seats);
        }
      } else el.innerHTML = `<span class="e" style="${it.m ? "transform:scaleX(-1)" : ""}">${DECO[it.k]}</span><span class="st"></span>`;
      if (deco && deco.sel === i) el.classList.add("sel"); el.title = t("dk_" + it.k); el.style.left = x + "px"; el.style.top = y + "px";
      plan.appendChild(el);
      if (PETS.includes(it.k) && !deco) pets.push({ el, x, y, hx: x, sl, vx: Math.random() < 0.5 ? -1 : 1, rest: Math.random() * 3 });
    });
    updatePots();
    if (deco && deco.sel != null && deco.items[deco.sel]) {
      const el = plan.querySelector(`.ob-item[data-i="${deco.sel}"]`), it = deco.items[deco.sel];
      if (el) { const bar = document.createElement("div"); bar.className = "ob-itbar"; bar.style.left = el.style.left; bar.style.top = (parseFloat(el.style.top) + 8) + "px";
        bar.innerHTML = `<button data-it="${it.k === "sofa" ? "rot" : "mir"}">${t(it.k === "sofa" ? "rotate" : "mirror")}</button><button data-it="del">${t("remove")}</button>`; plan.appendChild(bar); }
    }
  }
  // 화분 상태: 💧 목마름 · 🌱 자라는 중(●●○) · ✨ 수확
  function updatePots() {
    if (!plan) return;
    plan.querySelectorAll(".ob-item.pot").forEach(el => {
      const p = game && el.dataset.gi ? (game.plants || {})[el.dataset.gi] || {} : null, st = el.querySelector(".st");
      if (!p) { st.textContent = ""; el.classList.remove("ready", "thirsty"); return; }
      const g = +p.g || 0, w = p.w ? Date.parse(p.w) : 0, thirsty = g < 3 && (!w || Date.now() - w > 6 * 3600e3);
      el.classList.toggle("ready", g >= 3); el.classList.toggle("thirsty", thirsty);
      st.textContent = g >= 3 ? "✨" : thirsty ? "💧" : "●".repeat(g) + "○".repeat(3 - g);
    });
  }
  async function loadGame() {
    try { game = await C.rpc("game_get", { shop: C.shopId }); } catch (e) { game = null; return; }
    // 예전에 놓은 꾸미기에 아이디가 없으면 한 번 붙여서 저장 (물 주기 · 쓰다듬기에 필요해요)
    const its = (data && data.layout && data.layout.items) || [];
    if (!C.readOnly && its.some(it => it && !it.id)) {
      const items = its.map(it => Object.assign({}, it, { id: it.id || rid() }));
      try { await C.rpc("board_items_save", { shop: C.shopId, items }); data.layout.items = items; itemSig = JSON.stringify(items); } catch (e) {}
    }
    renderItems(); renderTop(); renderQuests();
  }
  function renderCare() {
    if (!plan) return; plan.querySelectorAll(".ob-care").forEach(e => e.remove()); if (!care) return;
    const el = document.createElement("div"); el.className = "ob-care"; el.style.left = care.at.x + "px"; el.style.top = care.at.y + "px";
    el.innerHTML = `<b>${esc(care.name)}</b><button data-care="snack">${t("snack")}</button><button data-care="praise">${t("praise")}</button>`; plan.appendChild(el);
  }
  /* 😎 입구 가드: 직원이 아니라 재미 요소예요 (선글라스 · 검은 정장) */
  const GUARD_LOOK = { hair: "short", hairC: "#15171A", top: "uniform", topC: "#1E2228", bottom: "pants", botC: "#1E2228", skin: "#E3B48C", guard: true };
  const GUARD_SAY = [["Xin chào quý khách 😎", "어서 오세요 😎", "Welcome 😎"], ["Hôm nay yên bình.", "오늘도 평화롭습니다.", "All quiet today."], ["Khách VIP đến rồi!", "VIP 손님 입장!", "VIP guest arriving!"], ["Cẩn thận bậc thềm.", "계단 조심하세요.", "Mind the step."], ["Tôi đang làm nhiệm vụ.", "근무 중입니다.", "On duty."], ["Massage hôm nay rất tuyệt.", "오늘 마사지 최고래요.", "Great massages today."]];
  let guard = null;
  function placeGuard() {
    if (!plan || !G.f1) return;
    if (guard) guard.el.remove();
    const el = document.createElement("div"); el.className = "ob-w guard"; el.innerHTML = '<div class="ob-spr"></div><div class="ob-tag g">😎 ' + esc(t("guard")) + '</div>'; plan.appendChild(el);
    const spr = el.firstChild; spr.style.backgroundImage = `url(${sheet(GUARD_LOOK)})`;
    guard = { el, spr, tag: el.lastChild, x: G.DX - 48, y: G.f1.ent.y - 34, dir: "down", flip: false, moving: false, work: false, look: 0 };
    drawW(guard);
  }
  function guardSay(txt) {
    if (!guard) return; guard.el.querySelectorAll(".ob-emo").forEach(e => e.remove());
    const b = document.createElement("div"); b.className = "ob-emo say"; b.textContent = txt; guard.el.appendChild(b); setTimeout(() => b.remove(), 2600);
  }
  function guardIdle() {
    if (!guard) return;
    const r = Math.random();
    if (r < 0.35) { guard.dir = "side"; guard.flip = Math.random() < 0.5; } else if (r < 0.8) { guard.dir = "down"; guard.flip = false; } else guardSay("😎");
    drawW(guard);
  }
  function floatAt(x, y, txt) { if (!plan) return; const f = document.createElement("div"); f.className = "ob-float"; f.textContent = txt; f.style.left = x + "px"; f.style.top = y + "px"; plan.appendChild(f); setTimeout(() => f.remove(), 1600); }
  async function gameAct(act, arg, at, okTxt) {
    if (busy || C.readOnly) return; busy = true;
    const lv0 = game && game.level ? game.level.lv : 0;
    try { game = await C.rpc("game_act", { shop: C.shopId, act, arg }); if (at) floatAt(at.x, at.y, okTxt); }
    catch (e) { C.toast(errTx(e)); busy = false; return; }
    busy = false; updatePots(); renderTop(); renderQuests();
    if (game.level && game.level.lv > lv0 && lv0) C.toast(t("lvUp", { n: game.level.lv, t: T.lvT[li()][game.level.lv - 1] || "" }));
  }
  function petStep(dt) {
    pets.forEach(p => {
      if (p.rest > 0) { p.rest -= dt; p.el.classList.toggle("walk", false); return; }
      p.x += p.vx * dt * 22;
      if (Math.abs(p.x - p.hx) > 70 || p.x < p.sl.x + 16 || p.x > p.sl.x + p.sl.w - 16) { p.vx *= -1; p.x += p.vx * 2; p.rest = 1 + Math.random() * 4; }
      if (Math.random() < dt * 0.15) p.rest = 1 + Math.random() * 3;
      p.el.style.left = p.x + "px"; p.el.classList.toggle("flip", p.vx > 0); p.el.classList.add("walk");
    });
  }
  function decoBar() {
    const el = root.querySelector("#obDeco"); if (!el) return;
    el.hidden = !deco;
    if (!deco) { el.innerHTML = ""; return; }
    el.innerHTML = `<div class="ob-deco-bar">${Object.keys(DECO).map(k => `<button class="ob-chip" data-dk="${k}" title="${esc(t("dk_" + k))}">${DECO[k]} <span>${t("dk_" + k)}</span></button>`).join("")}
      <span class="ob-sp"></span><small class="ob-note">${t("decoHint")}</small><button class="ob-btn l" data-dx="cancel">${t("decoCancel")}</button><button class="ob-btn" data-dx="save">${t("decoSave")}</button></div>`;
  }
  function decoStart() { deco = { items: JSON.parse(JSON.stringify(itemsNow())) }; decoBar(); renderItems(); renderTop(); }
  async function decoEnd(save) {
    if (save && deco) {
      const items = deco.items.slice(0, 40).map(it => Object.assign({ id: it.id || rid(), k: it.k, fl: it.fl, rx: Math.round(it.rx * 1000) / 1000, ry: Math.round(it.ry * 1000) / 1000 }, it.r ? { r: it.r } : {}, it.m ? { m: true } : {}));
      if (busy) return; busy = true;
      try { await C.rpc("board_items_save", { shop: C.shopId, items }); data.layout.items = items; C.toast(t("decoSaved")); } catch (e) { C.toast(errTx(e)); busy = false; return; }
      busy = false;
    }
    deco = null; decoBar(); renderItems(); renderTop(); if (data) syncPlan();
  }
  function decoDown(e) {
    const el = e.target.closest(".ob-item.edit"); if (!el || !deco) return;
    e.preventDefault(); drag = { i: +el.dataset.i, el, id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false }; try { el.setPointerCapture(e.pointerId); } catch (er) {}
    el.classList.add("drag");
  }
  function decoMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
    if (!drag.moved) { drag.moved = true; if (deco.sel != null) { deco.sel = null; plan.querySelectorAll(".ob-itbar").forEach(x => x.remove()); } }
    const r = plan.getBoundingClientRect(), sc = r.width / G.PW, px = (e.clientX - r.left) / sc, py = (e.clientY - r.top) / sc;
    const sl = (G.slabs || []).reduce((b, s) => { const d = py < s.y ? s.y - py : py > s.y + s.h ? py - s.y - s.h : 0; return !b || d < b.d ? { s, d } : b; }, null).s;
    const it = deco.items[drag.i]; if (!it) return;
    it.fl = sl.fl; it.rx = Math.max(0.02, Math.min(0.98, (px - sl.x) / sl.w)); it.ry = Math.max(0.1, Math.min(0.98, (py - sl.y) / sl.h));
    drag.el.style.left = (sl.x + it.rx * sl.w) + "px"; drag.el.style.top = (sl.y + it.ry * sl.h) + "px";
  }
  function decoUp(e) {
    if (!drag || e.pointerId !== drag.id) return; drag.el.classList.remove("drag");
    const d = drag; drag = null;
    if (!d.moved) { deco.sel = deco.sel === d.i ? null : d.i; }
    renderItems();
  }
  function decoDbl(e) { const el = e.target.closest(".ob-item.edit"); if (!el || !deco) return; deco.items.splice(+el.dataset.i, 1); deco.sel = null; renderItems(); }
  // 대기 중인 직원이 가끔 하는 몸짓 (말풍선)
  const EMO = ["☕", "💬", "📱", "🎵", "😊", "💪", "🍜", "😴"];
  function emote() {
    if (!data || view !== "board" || document.hidden) return;
    updatePots(); guardIdle();
    const idle = data.staff.filter(s => ["idle", "desk"].includes(stOf(s))).map(s => W.get(s.id)).filter(w => w && !w.moving && !w.el.hidden);
    if (!idle.length) return;
    const w = idle[Math.floor(Math.random() * idle.length)], b = document.createElement("div");
    b.className = "ob-emo"; b.textContent = EMO[Math.floor(Math.random() * EMO.length)]; w.el.appendChild(b); setTimeout(() => b.remove(), 2600);
  }
  function renderQuests() {
    const el = root.querySelector("#obQ"); if (!el || !data) return;
    if (game && Array.isArray(game.quests)) {
      const lv = game.level || { lv: 1, from: 0, to: 60 }, pct = lv.to ? Math.round((game.xp - lv.from) / (lv.to - lv.from) * 100) : 100;
      const hasPot = ((data.layout && data.layout.items) || []).some(it => it && POTS.includes(it.k));
      el.innerHTML = `<h3><span>${t("qT")}</span><small>🪙 ${game.coins}</small></h3>
        <div class="ob-lv"><b>Lv${lv.lv} ${esc(T.lvT[li()][lv.lv - 1] || "")}</b><i style="--p:${pct}%"></i><small>${game.xp}${lv.to ? " / " + lv.to : ""} XP</small></div>
        ${game.quests.map(q => { const ok = q.p >= q.n; return `<div class="ob-q ${q.claimed ? "ok" : ""}"><span>${q.claimed ? "✅" : ok ? "🎁" : "⬜"} ${esc(t("gq_" + q.id, { n: q.n }))}</span>
          ${q.claimed ? `<b>${t("claimed")}</b>` : ok && !C.readOnly ? `<button class="ob-btn" data-claim="${q.id}">${t("claim")} +${q.c}🪙</button>` : `<b>${Math.min(q.p, q.n)}/${q.n}</b>`}<i style="--p:${Math.round(Math.min(1, q.p / q.n) * 100)}%"></i></div>`; }).join("")}
        ${game.quests.every(q => q.claimed) ? `<p class="ob-qdone">${t("qDone")}</p>` : ""}
        <p class="ob-note">${C.readOnly ? "" : hasPot ? t("gHint") : t("gNoPlant")}</p>`;
      return;
    }
    const groups = new Set(data.sessions.filter(x => x.status === "done").map(x => x.grp || x.id)).size;
    const target = Math.max(5, Math.min(30, (G.st ? G.st.size : 4) * 2));
    const sched = data.staff.filter(s => s.code !== "O"), ins = sched.filter(s => s.in_at).length;
    const late = data.staff.filter(s => s.in_at && s.late_min > 0).length, waiting = data.guests.filter(g => g.status === "waiting").length;
    const open = data.shop_state && data.shop_state.is_open;
    const Q = [[t("q1", { n: target }), Math.min(1, groups / target), `${groups}/${target}`],
      [t("q4"), sched.length ? ins / sched.length : 1, `${ins}/${sched.length}`],
      [t("q2"), late ? 0 : (ins ? 1 : 0), late ? `${late}` : (ins ? "✓" : "—")],
      [t("q3"), open ? (waiting ? 0 : 1) : 0, open ? (waiting ? `${waiting}` : "✓") : "—"]];
    const all = Q.every(q => q[1] >= 1);
    el.innerHTML = `<h3><span>${t("qT")}</span></h3>${Q.map(q => `<div class="ob-q ${q[1] >= 1 ? "ok" : ""}"><span>${q[1] >= 1 ? "✅" : "⬜"} ${esc(q[0])}</span><b>${q[2]}</b><i style="--p:${Math.round(q[1] * 100)}%"></i></div>`).join("")}${all ? `<p class="ob-qdone">${t("qDone")}</p>` : ""}`;
  }
  const eqp = (p, q) => p.x === q.x && p.y === q.y;
  function route(a, b) {
    a = a.slice(); b = b.slice();
    while (a.length > 1 && b.length > 1 && eqp(a[a.length - 1], b[b.length - 1])) {
      const a2 = a[a.length - 2], b2 = b[b.length - 2], l = a[a.length - 1];
      if (eqp(a2, b2) || (a2.y === l.y && b2.y === l.y) || (a2.x === l.x && b2.x === l.x)) { a.pop(); b.pop(); } else break;
    }
    const rb = b.reverse(); return eqp(a[a.length - 1], rb[0]) ? a.concat(rb.slice(1)) : a.concat(rb);
  }
  const chEnt = () => { const f = G.f1; return [f.ent, { x: G.DX, y: f.my }, { x: G.DX, y: f.cy }, { x: G.SHX, y: f.cy }]; };
  const chSeat = s => { const f = G.f1; return [s, { x: s.x, y: f.my }, { x: G.DX, y: f.my }, { x: G.DX, y: f.cy }, { x: G.SHX, y: f.cy }]; };
  const chDesk = () => { const f = G.f1; return [f.desk, { x: f.desk.x, y: f.my }, { x: G.DX, y: f.my }, { x: G.DX, y: f.cy }, { x: G.SHX, y: f.cy }]; };
  const chD = p => { const f = G.f1; return [p, { x: p.x, y: f.dy }, { x: G.DX, y: f.dy }, { x: G.DX, y: f.cy }, { x: G.SHX, y: f.cy }]; };
  const chSlot = s => { const f = G.f1; return [s, { x: s.x, y: f.ly }, { x: G.LD, y: f.ly }, { x: G.LD, y: f.cy }, { x: G.SHX, y: f.cy }]; };
  const TPOFF = [[0, 0], [-44, 0], [26, -30], [-70, -30]];
  const tpAt = (s, n) => { const o = TPOFF[(n || 0) % 4]; return { x: s.tpSpot.x + o[0], y: s.tpSpot.y + o[1] }; };
  const chTp = (s, n) => { const r = s.room, p = tpAt(s, n); return [p, { x: p.x, y: r.lane }, { x: r.rx, y: r.lane }, { x: r.rx, y: r.f.cy }, { x: G.SHX, y: r.f.cy }]; };
  const chCu = s => { const r = s.room; return [s.cuSpot, { x: s.cuSpot.x, y: r.lane }, { x: r.rx, y: r.lane }, { x: r.rx, y: r.f.cy }, { x: G.SHX, y: r.f.cy }]; };
  function chainOf(loc) {
    if (!loc || loc.k === "out") return chEnt();
    if (loc.k === "slot") return chSlot(loc.p);
    if (loc.k === "desk") return chD(loc.p);
    if (loc.k === "seat") return chSeat(loc.p);
    if (loc.k === "st") return loc.cu ? chCu(loc.s) : chTp(loc.s, loc.n);
    if (loc.k === "pay") return chDesk();
    return chEnt();
  }
  const ptOf = loc => !loc || loc.k === "out" ? G.f1.ent : loc.k === "st" ? (loc.cu ? loc.s.cuSpot : tpAt(loc.s, loc.n)) : loc.k === "pay" ? G.f1.desk : loc.p;
  const sameLoc = (a, b) => a && b && a.k === b.k && (a.k === "out" || a.k === "pay" || (a.k === "st" ? a.s === b.s && !!a.cu === !!b.cu && (a.n || 0) === (b.n || 0) : eqp(a.p, b.p)));
  function mkW(look, cu) {
    const el = document.createElement("div"); el.className = "ob-w" + (cu ? " cu" : ""); el.hidden = true;
    el.innerHTML = '<div class="ob-spr"></div><div class="ob-tag"></div>'; plan.appendChild(el);
    const spr = el.firstChild; spr.style.backgroundImage = `url(${sheet(look)})`;
    return { el, spr, tag: el.lastChild, x: 0, y: 0, path: [], cb: null, dir: "down", flip: false, moving: false, work: false, loc: null };
  }
  function goTo(w, loc, cb) {
    if (sameLoc(w.loc, loc)) return;
    const from = w.loc;
    if (!from || w.el.hidden) { const p = from ? ptOf(from) : G.f1.ent; w.x = p.x; w.y = p.y; }
    w.path = route(chainOf(from || { k: "out" }), chainOf(loc)); w.loc = loc; w.cb = cb || null; w.moving = true; w.work = false; w.el.hidden = false;
  }
  function placeAt(w, loc) { const p = ptOf(loc); w.x = p.x; w.y = p.y; w.loc = loc; w.path = []; w.moving = false; w.el.hidden = loc.k === "out"; }
  function step(w, dt) {
    if (!w.moving) return;
    let mv = 125 * dt;
    while (mv > 0 && w.path.length) {
      const p = w.path[0], dx = p.x - w.x, dy = p.y - w.y, d = Math.hypot(dx, dy);
      if (d < 0.01) { w.path.shift(); continue; }
      if (Math.abs(dx) > Math.abs(dy)) { w.dir = "side"; w.flip = dx < 0; } else { w.dir = dy > 0 ? "down" : "up"; w.flip = false; }
      if (d <= mv) { w.x = p.x; w.y = p.y; mv -= d; w.path.shift(); } else { w.x += dx / d * mv; w.y += dy / d * mv; mv = 0; }
    }
    if (!w.path.length) { w.moving = false; if (w.loc && w.loc.k === "out") w.el.hidden = true; const cb = w.cb; w.cb = null; if (cb) cb(); }
  }
  const ROWS = { down: 0, up: 1, side: 2 };
  function drawW(w) {
    if (w.el.hidden) return;
    w.el.style.transform = `translate(${w.x.toFixed(1)}px,${w.y.toFixed(1)}px)`;
    const col = w.moving ? 1 + (Math.floor(anim * 7) % 2) : w.work ? Math.floor(anim * 2.5) % 2 : 0;
    w.spr.style.backgroundPosition = `${-col * 35}px ${-ROWS[w.dir] * 47.5}px`;
    w.spr.classList.toggle("flip", w.flip); w.el.style.zIndex = String(10 + Math.round(w.y));
  }
  function loop(ts) {
    const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0); last = ts; anim += dt;
    W.forEach(w => { step(w, dt); drawW(w); }); GW.forEach(w => { step(w, dt); drawW(w); }); petStep(dt);
    raf = requestAnimationFrame(loop);
  }

  /* 데이터 → 캐릭터 위치 */
  function syncPlan() {
    const tps = data.staff.filter(s => s.role === "tp"), rcps = data.staff.filter(s => s.role === "rcp");
    const slotOf = s => G.f1.slots[Math.max(0, tps.indexOf(s)) % G.f1.slots.length];
    const deskOf = s => G.f1.dspots[Math.max(0, rcps.indexOf(s)) % G.f1.dspots.length];
    const seen = new Set();
    data.staff.forEach((s, i) => {
      seen.add(s.id);
      let w = W.get(s.id);
      if (!w) { w = mkW(lookOf(s.look, i)); W.set(s.id, w); w.el.dataset.sid = s.id; if (!C.readOnly) w.el.classList.add("tap"); }
      const state = stOf(s), x = sessOf(s.id);
      w.el.classList.toggle("hi", s.role === "tp" && tps.indexOf(s) % 2 === 1);
      let loc = { k: "out" };
      if (state === "idle") loc = { k: "slot", p: slotOf(s) };
      else if (state === "desk") loc = { k: "desk", p: deskOf(s) };
      else if (state === "work" && G.st.get(x.station)) loc = { k: "st", s: G.st.get(x.station), n: Math.max(0, mates(x).indexOf(x)) };
      const first = !w.loc;
      const fl = !((loc.n || 0) % 2);
      if (loc.k === "st") w.el.classList.toggle("hi", (loc.n || 0) % 2 === 1);
      if (first) { placeAt(w, loc); if (loc.k === "st") { w.dir = "side"; w.flip = fl; w.work = true; } }
      else goTo(w, loc, () => { if (loc.k === "st") { w.dir = "side"; w.flip = fl; w.work = stOf(s) === "work"; } else { w.dir = "down"; w.flip = false; } });
      if (!w.moving && loc.k === "st") w.work = true;
      const lbl = w.moving ? "move" : state, gn = loc.k === "st" ? loc.n || 0 : 0, gm = state === "work" && x ? mates(x).length : 1;
      if (state === "work" && !w.moving && gn > 0) { w.tag.innerHTML = `<span class="r">${esc(s.name)}</span>`; w.tag.classList.add("mini"); return; }
      w.tag.classList.remove("mini");
      w.tag.innerHTML = `<span class="r">${esc(s.name)}<span class="s ${PILL[lbl]}">${DOT[lbl]}${lbl === "idle" ? "" : `<span> ${t("s_" + lbl)}${lbl === "work" && gm > 1 ? " · " + t("tpN", { n: gm }) : ""}</span>`}</span></span>${state === "work" ? '<span class="pb"><i data-end="' + esc(x.ends_at) + '" data-start="' + esc(x.started_at) + '"></i></span>' : ""}`;
    });
    W.forEach((w, id) => { if (!seen.has(id)) { w.el.remove(); W.delete(id); } });
    // 손님
    const waiting = data.guests.filter(g => g.status === "waiting");
    const gSeen = new Set(), greetOk = GW.size > 0 || !!syncPlan._once; syncPlan._once = true;
    waiting.forEach((g, i) => {
      gSeen.add(g.id);
      let w = GW.get(g.id);
      if (!w) { w = mkW(lookOf({ hair: ["short", "long", "bun", "pony"][i % 4], hc: (i + 2) % 5, top: "tee", tc: [7, 1, 2, 3][i % 4], bottom: "pants", bc: (i + 1) % 6 }, i), true); GW.set(g.id, w); if (guard && greetOk) setTimeout(() => guardSay(GUARD_SAY[0][li()]), 300); w.tag.innerHTML = `<span>${esc(g.name)}</span>${g.source === "ud" ? '<span class="ob-ud">UD</span>' : ""}`; }
      const seat = G.f1.seats[i % G.f1.seats.length];
      w.el.classList.toggle("hi", i % 2 === 1);
      if (!w.loc) goTo(w, { k: "seat", p: seat }, () => { w.dir = "up"; }); else goTo(w, { k: "seat", p: seat }, () => { w.dir = "up"; });
    });
    // 시술 시작한 손님: 자리 → 베드로 걸어가고 사라져요
    data.sessions.filter(x => x.status === "working" && isLead(x)).forEach(x => {
      const w = GW.get(x.guest_id), s = G.st.get(x.station);
      if (w && s && !(w.loc && w.loc.k === "st")) { pendOcc.add(x.station); goTo(w, { k: "st", s, cu: true }, () => { w.el.hidden = true; pendOcc.delete(x.station); GW.delete(x.guest_id); w.el.remove(); }); }
      gSeen.add(x.guest_id);
    });
    // 끝난 손님: 베드 → 카운터 → 입구
    data.sessions.filter(x => x.status === "done" && isLead(x) && prevSess.get(x.id) === "working").forEach((x, i) => {
      const s = G.st.get(x.station); if (!s) return;
      const w = mkW(lookOf({ hair: "short", hc: 2, top: "tee", tc: 1, bottom: "pants", bc: 3 }, i), true); w.tag.innerHTML = `<span>${esc(x.guest_name || "")}</span>`;
      const k = "done-" + x.id; GW.set(k, w); placeAt(w, { k: "st", s, cu: true }); w.el.hidden = false;
      goTo(w, { k: "pay" }, () => setTimeout(() => goTo(w, { k: "out" }, () => { w.el.remove(); GW.delete(k); }), 1200));
    });
    GW.forEach((w, id) => { if (!gSeen.has(id) && !String(id).startsWith("done-") && !(w.loc && w.loc.k === "st")) { goTo(w, { k: "out" }, () => { w.el.remove(); GW.delete(id); }); } });
    prevSess = new Map(data.sessions.map(x => [x.id, x.status]));
    // 방 · 베드
    G.rooms.forEach(r => {
      const busyN = r.st.filter(s => data.sessions.some(x => x.status === "working" && x.station === s.id)).length;
      r.chip.className = "ob-rchip " + (busyN ? "ob-c-work" : "ob-c-free"); r.chip.textContent = busyN ? (r.st.length > 1 ? t("busyN", { n: busyN + "/" + r.st.length }) : t("s_work")) : t("free");
      r.st.forEach(s => { const x = data.sessions.find(y => y.status === "working" && y.station === s.id); s.furn.classList.toggle("ob-occ", !!x && !pendOcc.has(s.id)); s.bar.dataset.end = x ? x.ends_at : ""; s.bar.dataset.start = x ? x.started_at : ""; if (!x) s.bar.style.width = "0"; });
    });
  }

  /* ---------- 화면 ---------- */
  function render() {
    if (!root || !data) return;
    const sig = JSON.stringify(data.layout.floors) + data.layout.kind + lang + (window.innerWidth >= 1200);
    if (!root.querySelector(".ob")) shell();
    renderTop();
    if (view === "board") {
      root.querySelector("#obBoard").hidden = false; root.querySelector("#obSched").hidden = true; root.querySelector("#obHist").hidden = true;
      if (sig !== geoSig || !plan || !plan.isConnected) { geoSig = sig; plan = root.querySelector(".ob-plan"); buildPlan(root.querySelector(".ob-stage")); fit(); }
      syncPlan(); renderSide(); renderFloorChips();
      const isg = JSON.stringify(data.layout.items || []); if (!deco && isg !== itemSig) { itemSig = isg; renderItems(); syncPlan(); }
    } else if (view === "hist") { root.querySelector("#obBoard").hidden = true; root.querySelector("#obSched").hidden = true; root.querySelector("#obHist").hidden = false; renderHist(); }
    else { root.querySelector("#obBoard").hidden = true; root.querySelector("#obSched").hidden = false; renderSched(); }
    if (view !== "hist") root.querySelector("#obHist").hidden = true;
    if (setOpen) renderSet();
    tick();
  }
  function shell() {
    root.innerHTML = `<div class="ob ${C.readOnly ? "ro" : ""}"><div class="ob-top" id="obTop"></div>
      <div id="obBoard"><div class="ob-grid"><div><div class="ob-fchips" id="obFl" style="margin-bottom:8px"></div><div id="obLg" style="margin:-2px 0 8px"></div><div id="obDeco" hidden></div><div class="ob-stage"><div class="ob-box"><div class="ob-plan"></div></div></div></div>
        <div class="ob-side">
          <div class="ob-kpis" id="obK"></div>
          <div id="obFirst"></div>
          <div class="ob-card" id="obExp" hidden></div>
          <div class="ob-card" id="obWalk"><h3><span>${t("walkT")}</span></h3>
            <div class="ob-f3"><input class="ob-in" id="obGN" placeholder="${t("gName")}" maxlength="40" autocomplete="off"><select class="ob-in" id="obGC" aria-label="${t("course")}"></select><select class="ob-in" id="obGP" aria-label="${t("ppl")}">${[1, 2, 3, 4, 5, 6].map(n => `<option>${n}</option>`).join("")}</select></div>
            <button class="ob-btn full" data-a="addg">${t("addG")}</button></div>
          <div class="ob-card" id="obWait"></div>
          <div class="ob-card" id="obWork"></div>
          <div class="ob-card" id="obAtt"></div>
          <div class="ob-card" id="obDone"></div>
          <div class="ob-card" id="obQ"></div>
        </div></div></div>
      <div id="obSched" hidden></div><div id="obHist" hidden></div><div id="obSet"></div></div>`;
    plan = root.querySelector(".ob-plan"); geoSig = "";
  }
  function renderTop() {
    const n = data.pending_req || 0;
    root.querySelector("#obTop").innerHTML = `<button class="ob-vt ${view === "board" ? "on" : ""}" data-v="board">🗺️ ${t("vBoard")}</button><button class="ob-vt ${view === "sched" ? "on" : ""}" data-v="sched">📅 ${t("vSched")}${n ? `<span class="n">${n}</span>` : ""}</button>${owner() ? `<button class="ob-vt ${view === "hist" ? "on" : ""}" data-v="hist">📋 ${t("vHist")}</button>` : ""}<span class="ob-sp"></span>${view === "board" && !C.readOnly && !deco ? `<button class="ob-vt" data-a="deco">${t("decoBtn")}</button>` : ""}${openBtn()}${game && game.level && view === "board" ? `<span class="ob-hud" title="XP ${game.xp}">Lv${game.level.lv} ${esc(T.lvT[li()][game.level.lv - 1] || "")} · 🪙${game.coins}</span>` : ""}${owner() ? `<button class="ob-vt" data-a="set">${t("vSet")}</button>` : ""}<button class="ob-vt" data-a="reload" aria-label="refresh">${t("refresh")}</button>`;
  }
  function openBtn() {
    const ss = data.shop_state; if (!ss) return "";
    const hrs = ss.open && ss.close ? ss.open + "–" + ss.close : "";
    const map = {
      before: [`⏳ ${t("stBefore", { n: ss.open || "" })}`, "open", "openEarly", ""],
      open_auto: [`🟢 ${t("stOpen")} · ${hrs}`, "close", "closeNow", "on"],
      open_manual: [`🟢 ${t("stOpen")} · ${t("stSince", { n: tm(ss.opened_at) })}`, "close", "closeNow", "on"],
      after: [`🌙 ${t("stAfter", { n: ss.close || "" })}`, "open", "extend", ""],
      closed_manual: [`🌙 ${t("stClosed", { n: tm(ss.closed_at) })}`, "open", "reopen", ""],
      dayoff: [`🌙 ${t("stDayoff")}`, "open", "openAnyway", ""]
    }[ss.status] || ["", "open", "openEarly", ""];
    return `<span class="ob-vt ${map[3]}" style="cursor:default">${map[0]}</span><button class="ob-vt" data-a="shop${map[1]}">${map[1] === "open" ? "☀️" : "🌙"} ${t(map[2])}</button>`;
  }
  function renderFloorChips() {
    const lg = root.querySelector("#obLg"); if (lg && !lg.innerHTML) lg.innerHTML = legend();
    root.querySelector("#obFl").innerHTML = G.floors.slice().reverse().map(f => { const all = f.rooms.reduce((a, r) => a + r.st.length, 0), a = f.rooms.reduce((nn, r) => nn + r.st.filter(s => data.sessions.some(x => x.status === "working" && x.station === s.id)).length, 0); return `<span class="ob-fchip">${t("fchip", { f: f.num, a: a ? `<b>${a}</b>` : "0", b: all })}</span>`; }).join("");
  }
  /* 반응형: 넓은 화면은 평면도를 화면 높이에 맞추고(최대 66%), 남은 너비는 오른쪽 현황판이 써요.
     현황판이 넓어지면 글씨를 키우고(최대 1.6배), 더 넓으면 두 줄로 나눠요. */
  function layoutDims(Hest) {
    const grid = root.querySelector(".ob-grid"), wide = window.innerWidth >= 1200;
    const TW = grid ? grid.clientWidth : window.innerWidth;
    const availH = Math.max(320, window.innerHeight - 150);
    const planW = Math.max(480, Math.min(TW - 380 - 12, TW * 0.66));
    // 층이 적으면 화면 높이에 맞추고, 층이 많으면 너무 작게 줄이지 않고(넓은 화면일수록 크게) 위아래로 스크롤해요
    const sh = Math.max(0.8, Math.min(1.35, Math.max(availH / Hest, planW / 1000)));
    return { wide, TW, planW, sh, availH };
  }
  function fit() {
    const stage = root.querySelector(".ob-stage"), box = root.querySelector(".ob-box"), grid = root.querySelector(".ob-grid"), side = root.querySelector(".ob-side");
    if (!stage || !G) return;
    const D = layoutDims(G.H);
    let s;
    if (D.wide) {
      s = Math.min(D.planW / G.PW, D.sh);
      const bw = Math.round(G.PW * s);
      grid.style.gridTemplateColumns = `${bw}px minmax(380px, 1fr)`;
      const sw = Math.max(380, D.TW - bw - 12), z = Math.max(1, Math.min(1.6, sw / 420));
      side.style.zoom = z; side.classList.toggle("two", sw / z >= 720);
      side.style.maxHeight = Math.round(D.availH / z) + "px";
      // 위쪽 버튼 · 층 칩 · 상태 설명도 오른쪽 현황판 크기에 맞춰 키워요
      const tz = Math.max(1, Math.min(1.45, z * 0.95));
      ["#obTop", "#obFl", "#obLg", "#obDeco"].forEach(q => { const el = root.querySelector(q); if (el) el.style.zoom = tz; });
    } else {
      grid.style.gridTemplateColumns = ""; side.style.zoom = ""; side.classList.remove("two"); side.style.maxHeight = "";
      ["#obTop", "#obFl", "#obLg", "#obDeco"].forEach(q => { const el = root.querySelector(q); if (el) el.style.zoom = ""; });
      s = Math.max(0.48, stage.clientWidth / G.PW);
    }
    box.style.width = G.PW * s + "px"; box.style.height = G.H * s + "px"; plan.style.transform = `scale(${s})`; plan.classList.toggle("compact", s < 0.78);
  }
  function stationsFree(c) { return [...G.st.values()].filter(s => !data.sessions.some(x => x.status === "working" && x.station === s.id) && courseFits(s, c)); }
  function renderSide() {
    const work = data.sessions.filter(x => x.status === "working" && isLead(x)), done = data.sessions.filter(x => x.status === "done" && isLead(x));
    const names = x => mates(x).map(y => esc(y.staff_name)).join(", "), sumPaid = x => mates(x).reduce((a, y) => a + (+y.paid || 0), 0), sumPrice = x => mates(x).reduce((a, y) => a + (+y.price || 0), 0);
    const waiting = data.guests.filter(g => g.status === "waiting");
    root.querySelector("#obK").innerHTML = [[work.length, "kWork"], [waiting.length, "kWait"], [done.length, "kDone"], [vnd(done.reduce((a, x) => a + sumPaid(x), 0)), "kRev"]].map(([v, k]) => `<div class="ob-kpi"><b>${v}</b><span>${t(k)}</span></div>`).join("");
    root.querySelector("#obFirst").innerHTML = !data.staff.length ? `<p class="info" style="margin:0">${t("firstRun")}</p>` : "";
    const cs = root.querySelector("#obGC"), cv = cs.value;
    cs.innerHTML = (data.layout.courses || []).map((c, i) => `<option value="${i}" ${String(i) === cv ? "selected" : ""}>${esc(cName(c))} · ${c.min}′</option>`).join("");
    const ex = root.querySelector("#obExp");
    ex.hidden = !data.expected.length;
    ex.innerHTML = `<h3><span>${t("expT")}</span><small>${data.expected.length}</small></h3>` + data.expected.map(b => `<div class="ob-row"><div class="g"><b>${esc(b.time || "")} · ${esc(b.name || b.code)}<span class="ob-ud">UD</span></b><small>${esc(b.menu_name || "")} · ${b.people}</small></div><button class="ob-btn" data-a="checkin" data-id="${b.id}">${t("arrive")}</button></div>`).join("");
    const idle = data.staff.filter(s => s.role === "tp" && stOf(s) === "idle");
    root.querySelector("#obWait").innerHTML = `<h3><span>${t("waitT")}</span><small>${waiting.length}</small></h3>` + (waiting.length ? waiting.map(g => {
      let h = `<div class="ob-row"><div class="g"><b>${esc(g.name)}${g.source === "ud" ? '<span class="ob-ud">UD</span>' : ""}</b><small>${esc(cName(g.course))} · ${g.course.min}′ · ${g.people}</small></div><button class="ob-btn" data-a="assign" data-id="${g.id}">${t("assign")}</button><button class="ob-btn l" data-a="leave" data-id="${g.id}">${t("leave")}</button></div>`;
      if (open.assign === g.id) {
        const fr = stationsFree(g.course);
        h += `<div class="ob-sheet">${idle.length ? `<div class="ob-note">${t("tpPick")} · <b>${t("tpN", { n: open.tps.length })}</b></div><div class="ob-tps">${idle.map(s => `<button type="button" class="ob-chip ${open.tps.includes(s.id) ? "on" : ""}" data-a="tpk" data-id="${s.id}" aria-pressed="${open.tps.includes(s.id)}">${open.tps.includes(s.id) ? "✓ " : ""}${esc(s.name)}</button>`).join("")}</div>` : `<p class="ob-note">${t("noTp")}</p>`}
          ${fr.length ? `<select class="ob-in" id="obAS">${fr.map(s => `<option value="${esc(s.id)}">${s.room.floor}F · ${esc(t("room", { n: s.room.n }))}${s.room.st.length > 1 ? " #" + s.b : ""} · ${t(s.type === "chair" ? "chairW" : "bedW")}</option>`).join("")}</select>` : `<p class="ob-note">${t("noBed")}</p>`}
          <button class="ob-btn full" data-a="startx" data-id="${g.id}" ${open.tps.length && fr.length ? "" : "disabled"}>${t("start")}${open.tps.length > 1 ? " · " + t("tpN", { n: open.tps.length }) : ""}</button></div>`;
      }
      return h;
    }).join("") : `<p class="ob-empty">${t("noWait")}</p>`);
    root.querySelector("#obWork").innerHTML = `<h3><span>${t("workT")}</span><small>${work.length}</small></h3>` + (work.length ? work.map(x => {
      const s = G.st.get(x.station);
      let h = `<div class="ob-row"><div class="g"><b>${names(x)} · ${s ? esc(t("room", { n: s.room.n })) + (s.room.st.length > 1 ? " #" + s.b : "") : esc(x.station)}</b><small>${esc(x.guest_name || "")}${x.ud ? '<span class="ob-ud">UD</span>' : ""} · ${esc(x.course_name || "")} · <span data-left="${esc(x.ends_at)}"></span></small><div class="ob-pb"><i data-end="${esc(x.ends_at)}" data-start="${esc(x.started_at)}"></i></div></div>
        <button class="ob-btn l" data-a="ext" data-id="${x.id}">${t("ext")}</button><button class="ob-btn" data-a="fin" data-id="${x.id}">${t("finish")}</button></div>`;
      if (open.finish === x.id) h += `<div class="ob-sheet"><label class="ob-note" for="obPaid">${t("paid")}</label><input class="ob-in" id="obPaid" inputmode="numeric" value="${sumPrice(x) || ""}">${x.ud ? `<p class="ob-note">${t("udAuto")}</p>` : ""}<div class="ob-f2"><button class="ob-btn r" data-a="cancelx" data-id="${x.id}">${t("cancel")}</button><button class="ob-btn" data-a="finx" data-id="${x.id}">${t("save")}</button></div></div>`;
      return h;
    }).join("") : `<p class="ob-empty">${t("noWork")}</p>`);
    root.querySelector("#obAtt").innerHTML = `<h3><span>${t("attT")}</span><small>${data.staff.filter(s => s.in_at).length}/${data.staff.length}</small></h3>${legend()}` + data.staff.map((s, i) => {
      const st = stOf(s);
      const info = [s.code === "C" && s.hours ? hrsTxt(s.hours) : t("sh_" + s.code)].concat(s.in_at ? [`${s.in_via === "phone" ? `<span title="${esc(t("viaPhone"))}">📱</span>` : ""}${tm(s.in_at)} ${s.late_min > 0 ? `<span class="ob-late">${t("late", { n: s.late_min })}</span>` : t("onTime")}`] : []).concat(s.out_at ? ["→ " + tm(s.out_at)] : []).join(" · ");
      const btn = st === "off" || st === "dayoff" || st === "gone" ? `<button class="ob-btn" data-a="in" data-id="${s.id}">${t("cIn")}</button>` : st !== "work" ? `<button class="ob-btn l" data-a="out" data-id="${s.id}">${t("cOut")}</button>` : "";
      const off = owner() && !s.in_at ? `<button class="ob-btn l" data-a="${s.code === "O" ? "on" : "off"}" data-id="${s.id}">${t(s.code === "O" ? "dayOn" : "dayOff")}</button>` : "";
      return `<div class="ob-row"><span class="ob-av" style="${avStyle(s, i)}"></span><div class="g"><b>${esc(s.name)} <span class="ob-pill ${PILL[st]}">${DOT[st]} ${t("s_" + st)}</span></b><small>${t(s.role === "rcp" ? "roleRcp" : "roleTp")}${s.reviews ? ` · ⭐${s.stars} (${s.reviews})` : ""}${s.role === "tp" ? ` · ${s.done_today} · ${vnd(s.rev_today)}` : ""}</small><small>${info}</small></div>${off}${btn}</div>`;
    }).join("");
    renderQuests();
    root.querySelector("#obDone").innerHTML = `<h3><span>${t("doneT")}</span><small>${done.length}</small></h3>` + (done.length ? done.map(x => `<div class="ob-row"><div class="g"><b>[${tm(x.done_at)}] ${names(x)} · ${esc(t("room", { n: (x.station || "").split("-")[0] }))}</b><small>${esc(x.guest_name || "")}${x.ud ? '<span class="ob-ud">UD</span>' : ""} · ${esc(x.course_name || "")}</small></div><b style="font-size:13px">${vnd(sumPaid(x))}</b></div>`).join("") : `<p class="ob-empty">${t("noDone")}</p>`);
  }
  const legend = () => `<div class="ob-legend">${[["🟢", "lgIdle"], ["🔴", "lgWork"], ["🟡", "lgMove"], ["⚪", "lgOff"], ["🌙", "lgDay"]].map(([d, k]) => `<span>${d} ${t(k)}</span>`).join("")}</div>`;
  function tick() {
    if (!root) return; const now = nowMs();
    root.querySelectorAll("[data-end]").forEach(el => { const e = Date.parse(el.dataset.end), s = Date.parse(el.dataset.start); if (!e || !s) return; el.style.width = Math.max(0, Math.min(100, (now - s) / (e - s) * 100)) + "%"; });
    root.querySelectorAll("[data-left]").forEach(el => { const m = Math.round((Date.parse(el.dataset.left) - now) / 60e3); el.textContent = m >= 0 ? t("left", { n: m }) : t("over", { n: -m }); el.className = m < 0 ? "ob-late" : ""; });
  }

  /* ---------- 근무표 ---------- */
  const mondayOf = ds => { const d = new Date(ds + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
  const addD = (ds, n) => { const d = new Date(ds + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  async function loadSched() { if (!weekFrom) weekFrom = mondayOf(data.today); try { sched = await C.rpc("shifts_get", { shop: C.shopId, d1: weekFrom }); } catch (e) { C.toast(C.errMsg(e)); } renderSched(); }
  function renderSched() {
    const el = root.querySelector("#obSched");
    if (!sched) { el.innerHTML = `<p class="ob-empty">…</p>`; return; }
    const days = Array.from({ length: 7 }, (_, i) => addD(weekFrom, i)), td = data.today, L = sched.layout || {};
    const lab = dShort, isThis = days.includes(td);
    const SH = L.shifts || {}, mid = ((SH.B || [780])[0] + (SH.A || [0, 1140])[1]) / 2;
    const hOf = (s, i) => (s.hours || [])[i] || (s.codes[i] === "O" ? null : SH[s.codes[i]]);
    const cov = i => { let a = 0, p = 0; sched.staff.forEach(s => { if (s.role !== "tp") return; const c = s.codes[i], h = hOf(s, i);
      if (c === "C" && h) { if (h[0] < mid) a++; if (h[1] > mid) p++; return; } if (c === "A" || c === "F") a++; if (c === "B" || c === "F") p++; }); return { a, p }; };
    let h = `<div class="ob-card"><div class="ob-top"><button class="ob-vt" data-a="wk-">‹</button><b>${dRange(days[0], days[6])}${isThis ? ` <span class="ob-pill ob-p-idle">${t("thisWk")}</span>` : ""}</b><button class="ob-vt" data-a="wk+">›</button><span class="ob-sp"></span><small class="ob-note">${t("minL", { a: L.min_am, b: L.min_pm })}</small></div>${owner() ? `<p class="ob-note">${t("cellHint")}</p>` : ""}</div>`;
    h += `<div class="ob-tw"><table class="ob-sg"><thead><tr><th></th>${days.map(ds => `<th class="${ds === td ? "td" : ""}">${lab(ds)}</th>`).join("")}</tr></thead><tbody>`;
    sched.staff.forEach((s, si) => {
      const tot = s.codes.reduce((a, c, i) => a + durH(hOf(s, i)), 0);
      h += `<tr><th><span style="display:flex;gap:6px;align-items:center"><span class="ob-av" style="${avStyle(s, si)};width:26px;height:35px;background-size:78px 104.2px"></span><span>${esc(s.name)}<small class="ob-wh">${t("wkTot", { n: Math.round(tot * 10) / 10 })}</small></span></span></th>`;
      s.codes.forEach((c, i) => { const hh = hOf(s, i); h += `<td><button class="ob-cell ob-k-${c}" data-a="cell" data-id="${s.id}" data-i="${i}" data-d="${days[i]}" data-c="${c}" ${owner() ? "" : "disabled"}>${c === "C" ? t("hrsN", { n: durH(hh) }) : t("sh_" + c)}<small>${hh ? hrsTxt(hh) : "🌙"}</small></button></td>`; });
      h += "</tr>";
    });
    h += `<tr><th class="ob-cov"></th>${days.map((_, i) => { const c = cov(i), bad = c.a < L.min_am || c.p < L.min_pm; return `<td class="ob-cov ${bad ? "bad" : ""}">${bad ? "⚠️ " : ""}${t("cov", { a: c.a, b: c.p })}</td>`; }).join("")}</tr></tbody></table></div>`;
    const reqs = sched.requests || [];
    h += `<div class="ob-card"><h3><span>${t("reqT")}</span><small>${reqs.filter(q => q.status === "pending").length}</small></h3>` + (reqs.length ? reqs.map(q => `<div class="ob-row"><div class="g"><b>${esc(q.name)} · ${lab(q.day)} · ${q.type === "off" ? t("r_off") : q.type === "shift" ? t("r_shift", { n: t("sh_" + q.want) }) : t("r_swap", { n: esc(q.mate || "") })}${q.must ? ` <span class="ob-pill ob-p-work">${t("must")}</span>` : ""}</b><small>${q.reason ? "“" + esc(q.reason) + "” · " : ""}${t("st_" + q.status)}</small></div>${q.status === "pending" && owner() ? `<button class="ob-btn l" data-a="rno" data-id="${q.id}">${t("no")}</button><button class="ob-btn" data-a="rok" data-id="${q.id}">${t("ok")}</button>` : ""}</div>`).join("") : `<p class="ob-empty">${t("noReq")}</p><p class="ob-note">${t("staffOnlyReq")}</p>`) + "</div>";
    el.innerHTML = h + `<div id="obPop"></div>`;
    pick = null;
  }
  // 근무표 칸 고르기
  let pick = null;
  function renderPick() {
    const el = root.querySelector("#obPop"); if (!el) return;
    if (!pick) { el.innerHTML = ""; return; }
    const s = sched.staff.find(x => x.id === pick.id), L = sched.layout || {}, SH = L.shifts || {}, d = new Date(pick.d + "T00:00:00Z");
    const ok = pick.e > pick.s;
    el.innerHTML = `<div class="ob-pop" role="dialog" aria-modal="true"><div class="ob-ph"><b>${t("pickT", { a: esc(s ? s.name : ""), b: dLong(pick.d) })}</b><button class="ob-x" data-a="pkclose" aria-label="${t("close")}">×</button></div>
      <div class="ob-pg">${["A", "B", "F", "O", "null"].map(c => `<button class="ob-cell ob-k-${c === "null" ? "N" : c} ${String(pick.c) === c ? "cur" : ""}" data-a="pk" data-c="${c}">${t("sh_" + c)}<small>${c === "O" ? "🌙" : c === "null" ? (s ? (s.def_code === "C" && s.def_start != null ? hrsTxt([s.def_start, s.def_end]) : t("sh_" + s.def_code)) : "") : SH[c] ? hrsTxt(SH[c]) : ""}</small></button>`).join("")}</div>
      <div class="ob-pc"><b>${t("pickC")}</b><div class="ob-srw"><select class="ob-in" id="obPkS">${opt(TIMESC.map(m => [m, fmtX(m)]), pick.s)}</select>–<select class="ob-in" id="obPkE">${opt(TIMESC.map(m => [m, fmtX(m)]), pick.e)}</select><span class="ob-pd ${ok ? "" : "bad"}">${ok ? t("hrsN", { n: durH([pick.s, pick.e]) }) : "⚠️"}</span></div>
        <button class="ob-btn full" data-a="pkx" ${ok ? "" : "disabled"}>${t("pickSave")}</button></div></div>`;
    const pop = el.firstElementChild, wide = window.innerWidth >= 640;
    if (wide && pick.rect) { const r = pick.rect, W = pop.offsetWidth, H = pop.offsetHeight;
      let x = Math.min(Math.max(8, r.left + r.width / 2 - W / 2), window.innerWidth - W - 8), y = r.bottom + 6; if (y + H > window.innerHeight - 8) y = Math.max(8, r.top - H - 6);
      pop.style.left = x + "px"; pop.style.top = y + "px"; } else pop.classList.add("sheet");
  }

  /* ---------- 지난 기록 ---------- */
  function histRange() {
    if (!hp.d) hp.d = data.today;
    if (hp.mode === "day") return [hp.d, hp.d];
    if (hp.mode === "week") { const a = mondayOf(hp.d); return [a, addD(a, 6)]; }
    const a = hp.d.slice(0, 8) + "01", d = new Date(a + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0);
    return [a, d.toISOString().slice(0, 10)];
  }
  async function loadHist() {
    if (!owner()) { hist = { denied: true }; renderHist(); return; }
    const [d1, d2] = histRange(); hpick = null; hist = Object.assign(hist || {}, { loading: true }); renderHist();
    try { hist = await C.rpc("board_history", { shop: C.shopId, d1, d2 }); } catch (e) { hist = null; C.toast(errTx(e)); }
    try { const rv = await C.rpc("staff_reviews_list", { shop: C.shopId, lim: 30 }); if (hist) hist.reviews = rv; } catch (e) { /* 후기 기능 SQL 전이면 숨겨요 */ }
    renderHist();
  }
  const hmVN = iso => iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }) : "";
  const hrsMin = m => { m = Math.round(+m || 0); const h = Math.floor(m / 60), r = m % 60; return lang === "ko" ? `${h}시간${r ? " " + r + "분" : ""}` : `${h}h${r ? String(r).padStart(2, "0") : ""}`; };
  function renderHist() {
    const el = root && root.querySelector("#obHist"); if (!el || view !== "hist") return;
    if (!owner() || (hist && hist.denied)) { el.innerHTML = `<div class="ob-card"><p class="ob-note">${t("hOwner")}</p></div>`; return; }
    const [d1, d2] = histRange();
    const label = hp.mode === "day" ? dLong(d1) : dRange(d1, d2);
    let h = `<div class="ob-card ob-htool"><div class="ob-fchips">${["day", "week", "month"].map(k => `<button class="ob-chip ${hp.mode === k ? "on" : ""}" data-h="${k}">${t("h" + k[0].toUpperCase() + k.slice(1))}</button>`).join("")}</div>
      <div class="ob-hnav"><button class="ob-vt" data-h="prev" aria-label="prev">‹</button><b>${label}</b><button class="ob-vt" data-h="next" aria-label="next" ${d2 >= data.today ? "disabled" : ""}>›</button>
      <button class="ob-vt" data-h="today">${t("hToday")}</button><input type="date" class="ob-in" id="obHD" value="${hp.d}" max="${data.today}" aria-label="date"></div>
      <span class="ob-sp"></span><button class="ob-vt" data-h="csv" ${hist && hist.rows && hist.rows.length ? "" : "disabled"}>${t("hCsv")}</button></div>`;
    if (!hist || hist.loading || !hist.rows) { el.innerHTML = h + `<p class="ob-empty">…</p>`; return; }
    const R = hist.rows, sum = R.reduce((a, r) => a + (+r.paid || 0), 0), udR = R.filter(r => r.ud), wR = R.filter(r => !r.ud);
    const ppl = rs => rs.reduce((a, r) => a + (+r.people || 1), 0);
    h += `<div class="ob-kpis ob-hk">${[[ppl(R), "hGuests"], [vnd(sum), "hSales"], [`${ppl(udR)} · ${vnd(udR.reduce((a, r) => a + (+r.paid || 0), 0))}`, "hUD"], [`${ppl(wR)} · ${vnd(wR.reduce((a, r) => a + (+r.paid || 0), 0))}`, "hWalk"]].map(([v, k]) => `<div class="ob-kpi"><b>${v}</b><span>${t(k)}</span></div>`).join("")}</div>`;
    const multi = d1 !== d2;
    const tpS = (hist.staff || []).filter(s => s.active && s.role === "tp");
    const pickHtml = r => hpick && r.booking_id && hpick.bid === r.booking_id ? `<div class="ob-hpk"><div class="ob-tps">${tpS.map(s => `<button type="button" class="ob-chip ${hpick.ids.includes(s.id) ? "on" : ""}" data-a="hpt" data-id="${s.id}">${hpick.ids.includes(s.id) ? "✓ " : ""}${esc(s.name)}</button>`).join("")}</div>
        <div class="ob-row2"><button class="ob-btn" data-a="hpsave">${t("hSaveTp")}</button><button class="ob-btn l" data-a="hpclose">${t("close")}</button></div></div>` : "";
    const rows = R.slice().reverse().map(r => `<div class="ob-hr"><div class="tm">${multi ? `<small>${esc(dShort(r.day))}</small>` : ""}${hmVN(r.started_at)}<small>~ ${hmVN(r.done_at)}</small></div>
        <div class="g"><b><span class="ob-pill ${r.ud ? "ob-p-idle" : "ob-p-off"}">${t(r.ud ? "hUD" : "hWalk")}</span> ${esc(r.guest || "-")}${(r.people || 1) > 1 ? " · " + t("tpN", { n: r.people }) : ""}</b>
          <small>${esc(r.course || "")} · ${r.nostaff ? `<span class="ob-nost">${t("hNoStaff")}</span>` : esc(r.staff || "")}${r.src === "shop" ? ` <i>(${t("hByShop")})</i>` : r.src === "review" ? ` <i>(💌 ${t("hByReview")})</i>` : ""}${r.booking_id ? ` <button class="ob-lnk" data-a="hpopen" data-id="${r.booking_id}">${t(r.nostaff ? "hSetTp" : "hEditTp")}</button>` : ""}${r.station ? " · " + esc(t("room", { n: String(r.station).split("-")[0] })) : ""}${r.code ? " · " + esc(r.code) : ""}</small></div>
        <div class="a"><b>${vnd(r.paid)}</b><small>${r.ud ? t("hFee", { v: vnd(r.commission) }) : t("hNoFee")}</small></div>${pickHtml(r)}</div>`).join("");
    const st = (hist.staff || []).filter(s => s.active || s.cnt > 0);
    const srow = s => { const att = s.att;
      const attTxt = !multi ? (att && att.in_at ? `${hmVN(att.in_at)} ~ ${att.out_at ? hmVN(att.out_at) : "…"}${att.late_min > 0 ? ` · <span class="late">${t("hLate", { m: att.late_min })}</span>` : ""}` : "—")
        : `${t("hDays", { n: s.days })}${s.work_min ? " · " + t("hWorked", { h: hrsMin(s.work_min) }) : ""}${s.late_n ? ` · <span class="late">${t("hLateN", { n: s.late_n, m: s.late_min })}</span>` : ""}`;
      return `<div class="ob-hs"><b>${esc(s.name)}${s.active ? "" : ` <small>(${t("hGone")})</small>`}<small>${t(s.role === "rcp" ? "roleRcp" : "tp")}</small></b>
        <span class="n"><b>${s.cnt}</b><small>${t("hCnt")}</small></span><span class="n"><b>${hrsMin(s.mins)}</b><small>${t("hMin")}</small></span><span class="n"><b>${vnd(s.rev)}</b><small>${t("hRev")}</small></span>
        <span class="at"><small>${t("hAtt")}</small>${attTxt}</span></div>`; };
    h += `<div class="ob-hgrid"><div class="ob-card"><h3><span>${t("hRows")}</span><small>${R.length}</small></h3>${R.length ? rows : `<p class="ob-note">${t("hNone")}</p>`}${hist.left ? `<p class="ob-note">${t("hLeft")}: ${hist.left}</p>` : ""}</div>
      <div style="display:flex;flex-direction:column;gap:10px"><div class="ob-card"><h3><span>${t("hStaff")}</span><small>${st.length}</small></h3>${st.map(srow).join("")}</div>
      ${Array.isArray(hist.reviews) ? `<div class="ob-card"><h3><span>${t("hRv")}</span><small>${hist.reviews.length}</small></h3>${hist.reviews.length ? hist.reviews.map(v => `<div class="ob-rv"><b>${esc(v.staff_name || "")} <span class="st">${"★".repeat(v.stars)}${"☆".repeat(5 - v.stars)}</span></b>${v.body ? `<p>“${esc(v.body)}”</p>` : ""}<small>${esc(v.customer || "")} · ${esc(dShort(String(v.created_at).slice(0, 10)))}${v.code ? " · " + esc(v.code) : ""}</small></div>`).join("") : `<p class="ob-note">${t("hRvNone")}</p>`}<p class="ob-note">${t("hRvHint")}</p></div>` : ""}</div></div>`;
    el.innerHTML = h;
  }
  function csvHist() {
    if (!hist || !hist.rows) return;
    const q = v => { const x = String(v == null ? "" : v); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
    const H = { ko: ["날짜", "시작", "끝", "구분", "손님", "인원", "코스", "테라피스트", "방", "예약번호", "금액", "엉클데이 수수료"], vi: ["Ngày", "Bắt đầu", "Kết thúc", "Loại", "Khách", "Số người", "Dịch vụ", "KTV", "Phòng", "Mã đặt", "Số tiền", "Phí UD"], en: ["Date", "Start", "End", "Type", "Guest", "People", "Course", "Therapists", "Room", "Booking", "Amount", "UD fee"] }[lang];
    const H2 = { ko: ["직원", "역할", "시술 건수", "시술 시간(분)", "매출", "출근일", "근무 시간(분)", "지각 횟수", "지각(분)"], vi: ["Nhân viên", "Vai trò", "Lượt", "Phút làm", "Doanh thu", "Ngày làm", "Phút có mặt", "Lần trễ", "Phút trễ"], en: ["Staff", "Role", "Sessions", "Minutes", "Sales", "Days", "Worked (min)", "Late count", "Late (min)"] }[lang];
    const lines = [H.map(q).join(",")].concat(hist.rows.map(r => [r.day, hmVN(r.started_at), hmVN(r.done_at), t(r.ud ? "hUD" : "hWalk"), r.guest, r.people || 1, r.course, r.staff, String(r.station || "").split("-")[0], r.code || "", r.paid || 0, r.ud ? (r.commission || 0) : 0].map(q).join(",")));
    lines.push("", H2.map(q).join(","));
    (hist.staff || []).forEach(s => lines.push([s.name, t(s.role === "rcp" ? "roleRcp" : "tp"), s.cnt, s.mins, s.rev, s.days, s.work_min, s.late_n, s.late_min].map(q).join(",")));
    const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `uncleday-${hist.from}${hist.to !== hist.from ? "_" + hist.to : ""}.csv`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ---------- 매장 설정 ---------- */
  function openSet() {
    const L = data.layout;
    draft = { kind: L.kind, floors: JSON.parse(JSON.stringify(L.floors || [])), courses: JSON.parse(JSON.stringify(L.courses || [])), shifts: JSON.parse(JSON.stringify(L.shifts || {})), min_am: L.min_am, min_pm: L.min_pm };
    if (!draft.floors.length) draft.floors.push({ rooms: [{ n: "201", type: "bed", count: 1, eq: [] }] });
    pinShow = null; staffDraft = data.staff.map(s => ({ id: s.id, app: !!s.app, has_phone: !!s.has_phone, name: s.name, role: s.role, years: s.years, phone: "", def_code: s.def_code, def_start: s.def_start != null ? s.def_start : 840, def_end: s.def_end != null ? s.def_end : 1080, off_day: s.off_day, look: Object.assign(defLook(0), s.look || {}), dirty: false }));
    setOpen = true; renderSet();
  }
  const opt = (list, v) => list.map(o => `<option value="${esc(o[0])}" ${String(o[0]) === String(v) ? "selected" : ""}>${esc(o[1])}</option>`).join("");
  const TIMES = Array.from({ length: 37 }, (_, i) => 360 + i * 30);
  const sws = (a, i, list, cur) => `<div class="ob-sw">${list.map((c, k) => `<button type="button" data-sa="${a}" data-i="${i}" data-k="${k}" style="background:${c}" class="${cur === k ? "on" : ""}" aria-label="${k + 1}"></button>`).join("")}</div>`;
  function renderSet() {
    const el = root.querySelector("#obSet"); if (!setOpen) { el.innerHTML = ""; return; }
    let b = "";
    if (setTab === "shop") {
      b += `<div class="ob-card"><b>${t("kind")}</b><div class="ob-top">${["massage", "skin"].map(k => `<button class="ob-chip ${draft.kind === k ? "on" : ""}" data-sa="kind" data-k="${k}">${t(k)}</button>`).join("")}</div>
        <div class="ob-f2"><label class="ob-note">${t("minAm")}<select class="ob-in" data-sf="min_am">${opt([0, 1, 2, 3, 4, 5, 6].map(n => [n, n]), draft.min_am)}</select></label><label class="ob-note">${t("minPm")}<select class="ob-in" data-sf="min_pm">${opt([0, 1, 2, 3, 4, 5, 6].map(n => [n, n]), draft.min_pm)}</select></label></div>
        <b>${t("shiftTimes")}</b>${["A", "B", "F"].map(c => `<div class="ob-srw"><span class="k">${t("sh_" + c)}</span><select class="ob-in" data-sf="sh${c}0">${opt(TIMES.map(m => [m, fmt(m)]), (draft.shifts[c] || [600])[0])}</select>–<select class="ob-in" data-sf="sh${c}1">${opt(TIMES.map(m => [m, fmt(m)]), (draft.shifts[c] || [0, 1140])[1])}</select></div>`).join("")}</div>`;
    } else if (setTab === "floors") {
      b += `<p class="ob-note">${t("f1Note")}</p>`;
      for (let i = draft.floors.length - 1; i >= 0; i--) {
        const f = draft.floors[i], tot = f.rooms.reduce((a, r) => a + (r.count || 1), 0);
        b += `<div class="ob-card"><h3><span>${i + 2}F · ${tot}/7</span> ${draft.floors.length > 1 ? `<button class="ob-btn l" data-sa="delF" data-i="${i}">${t("delFloor")}</button>` : ""}</h3>`;
        f.rooms.forEach((r, j) => {
          b += `<div class="ob-rc"><div class="ob-rr"><input class="ob-in" data-sf="rn" data-i="${i}" data-j="${j}" value="${esc(r.n)}" maxlength="8" aria-label="room"><select class="ob-in" data-sf="rt" data-i="${i}" data-j="${j}">${opt([["bed", t("bedW")], ["chair", t("chairW")]], r.type)}</select><select class="ob-in cnt" data-sf="rc" data-i="${i}" data-j="${j}">${opt([1, 2, 3].map(n => [n, (r.type === "chair" ? t("chairW") : t("bedW")) + " ×" + n]), r.count || 1)}</select><button class="ob-x" data-sa="delR" data-i="${i}" data-j="${j}" ${f.rooms.length < 2 ? "disabled" : ""} aria-label="delete">×</button></div>
            <div class="ob-top"><small class="ob-note">${t("eqL")}</small>${EQ.map(e => `<button class="ob-chip ${(r.eq || []).includes(e) ? "on" : ""}" data-sa="eq" data-i="${i}" data-j="${j}" data-k="${e}">${t("eq_" + e)}</button>`).join("")}</div></div>`;
        });
        b += `<button class="ob-btn l" data-sa="addR" data-i="${i}" ${tot >= 7 ? "disabled" : ""}>${t("addRoom")}</button></div>`;
      }
      if (draft.floors.length < 6) b += `<button class="ob-btn l" data-sa="addF">${t("addFloor")}</button>`;
    } else if (setTab === "courses") {
      draft.courses.forEach((c, i) => {
        b += `<div class="ob-rc"><div class="ob-f2"><input class="ob-in" data-sf="cko" data-i="${i}" value="${esc(c.ko || "")}" placeholder="${t("cKo")}"><input class="ob-in" data-sf="cvi" data-i="${i}" value="${esc(c.vi || "")}" placeholder="${t("cVi")}"></div>
          <div class="ob-rr"><input class="ob-in" data-sf="cpr" data-i="${i}" inputmode="numeric" value="${c.price || 0}" aria-label="${t("cPrice")}"><input class="ob-in" data-sf="cmin" data-i="${i}" inputmode="numeric" value="${c.min || 60}" aria-label="${t("cMin")}"><select class="ob-in cnt" data-sf="cty" data-i="${i}">${opt([["any", t("anyW")], ["bed", t("bedW")], ["chair", t("chairW")]], c.type || "any")}</select><button class="ob-x" data-sa="delC" data-i="${i}" ${draft.courses.length < 2 ? "disabled" : ""} aria-label="delete">×</button></div>
          <select class="ob-in" data-sf="ceq" data-i="${i}">${opt([["", t("cEq") + ": " + t("none")]].concat(EQ.map(e => [e, t("cEq") + ": " + t("eq_" + e)])), c.eq || "")}</select></div>`;
      });
      b += `<button class="ob-btn l" data-sa="addC">${t("addCourse")}</button>`;
    } else {
      staffDraft.forEach((s, i) => {
        const l = s.look;
        b += `<div class="ob-sc"><span class="ob-prev" style="background-image:url(${sheet(lookOf(l, i))})"></span><div style="display:flex;flex-direction:column;gap:6px;min-width:0">
          <div class="ob-srw"><input class="ob-in" data-sf="sn" data-i="${i}" value="${esc(s.name)}" placeholder="${t("sName")}" maxlength="20"><select class="ob-in" data-sf="sr" data-i="${i}">${opt([["tp", t("roleTp")], ["rcp", t("roleRcp")]], s.role)}</select></div>
          <div class="ob-srw"><input class="ob-in" data-sf="sp" data-i="${i}" value="${esc(s.phone)}" placeholder="${s.has_phone ? t("sPhoneSet") : t("sPhone")}" inputmode="tel"><input class="ob-in" data-sf="sy" data-i="${i}" value="${s.years || 0}" inputmode="numeric" style="flex:0 0 70px" aria-label="${t("sYears")}"></div>
          <div class="ob-srw"><span class="k">${t("sDef")}</span><select class="ob-in" data-sf="sd" data-i="${i}">${opt(["A", "B", "F", "C"].map(c => [c, t("sh_" + c) + (draft.shifts[c] ? " " + hrsTxt(draft.shifts[c]) : "")]), s.def_code)}</select><span class="k">${t("sOff")}</span><select class="ob-in" data-sf="so" data-i="${i}">${opt([[-1, t("none")]].concat([1, 2, 3, 4, 5, 6, 0].map(k => [k, T.wd[li()][k]])), s.off_day)}</select></div>
          ${s.def_code === "C" ? `<div class="ob-srw"><span class="k">${t("sh_C")}</span><select class="ob-in" data-sf="sds" data-i="${i}">${opt(TIMESC.map(m => [m, fmtX(m)]), s.def_start)}</select>–<select class="ob-in" data-sf="sde" data-i="${i}">${opt(TIMESC.map(m => [m, fmtX(m)]), s.def_end)}</select><span class="ob-pd ${s.def_end > s.def_start ? "" : "bad"}">${s.def_end > s.def_start ? t("hrsN", { n: durH([s.def_start, s.def_end]) }) : "⚠️"}</span></div>` : ""}
          <div class="ob-srw"><span class="k">${t("hair")}</span><select class="ob-in" data-sf="lh" data-i="${i}">${opt(["short", "long", "bun", "pony"].map(k => [k, t("hs_" + k)]), l.hair)}</select>${sws("lhc", i, HAIRC, l.hc)}</div>
          <div class="ob-srw"><span class="k">${t("top")}</span><select class="ob-in" data-sf="lt" data-i="${i}">${opt(["uniform", "tee", "aodai"].map(k => [k, t("tp_" + k)]), l.top)}</select>${sws("ltc", i, TOPC, l.tc)}</div>
          <div class="ob-srw"><span class="k">${t("bottom")}</span><select class="ob-in" data-sf="lb" data-i="${i}">${opt(["pants", "skirt"].map(k => [k, t("bt_" + k)]), l.bottom)}</select>${sws("lbc", i, BOTC, l.bc)}</div>
          ${s.id ? `<div class="ob-srw ob-app"><span class="k">${t("appT")}</span><span class="ob-pill ${s.app ? "ob-p-idle" : "ob-p-off"}">${t(s.app ? "appOn" : "appOffS")}</span><button class="ob-btn l" data-sa="pin" data-i="${i}">${t(s.app ? "pinRe" : "pinMake")}</button>${s.app ? `<button class="ob-btn l" data-sa="pinoff" data-i="${i}">${t("pinOff")}</button>` : ""}</div>
          ${pinShow && pinShow.id === s.id ? `<div class="ob-pinbox"><b>${t("pinShow", { n: esc(s.name), p: `<span class="pin">${esc(pinShow.pin)}</span>` })}</b><small>${t("pinHow")}</small></div>` : ""}` : ""}
          <div class="ob-f2">${s.id ? `<button class="ob-btn r" data-sa="rmS" data-i="${i}">${rmAsk === s.id ? t("removeAsk") : t("removeStaff")}</button>` : "<span></span>"}<button class="ob-btn" data-sa="saveS" data-i="${i}" ${s.dirty || !s.id ? "" : "disabled"}>${t("saveStaff")}</button></div>
        </div></div>`;
      });
      b += `<button class="ob-btn l" data-sa="addS">${t("addStaff")}</button>`;
    }
    const sc = el.querySelector(".ob-db"), top = sc ? sc.scrollTop : 0;
    el.innerHTML = `<div class="ob-ov" data-sa="ovx"><div class="ob-dr" role="dialog" aria-modal="true"><div class="ob-dh"><b>${t("setT")}</b><button class="ob-btn l" data-sa="close">${t("close")}</button></div>
      <div class="ob-dt">${["floors", "courses", "staff", "shop"].map(k => `<button class="ob-chip ${setTab === k ? "on" : ""}" data-sa="tab" data-k="${k}">${t({ shop: "tShop", floors: "tFloors", courses: "tCourses", staff: "tStaff" }[k])}</button>`).join("")}</div>
      <div class="ob-db">${b}</div>${setTab !== "staff" ? `<div class="ob-df"><button class="ob-btn full" data-sa="saveL">${t("saveLayout")}</button></div>` : ""}</div></div>`;
    const nsc = el.querySelector(".ob-db"); if (nsc) nsc.scrollTop = top;
  }
  async function setAct(b) {
    const a = b.dataset.sa, i = +b.dataset.i, j = +b.dataset.j, k = b.dataset.k;
    if (a === "ovx") { setOpen = false; renderSet(); return; }
    if (a === "close") { setOpen = false; renderSet(); return; }
    if (a === "tab") setTab = k;
    else if (a === "kind") draft.kind = k;
    else if (a === "addF") { const n = draft.floors.length + 2; draft.floors.push({ rooms: [{ n: n + "01", type: "bed", count: 1, eq: [] }] }); }
    else if (a === "delF") draft.floors.splice(i, 1);
    else if (a === "addR") { const f = draft.floors[i]; f.rooms.push({ n: (i + 2) + "0" + (f.rooms.length + 1), type: "bed", count: 1, eq: [] }); }
    else if (a === "delR") draft.floors[i].rooms.splice(j, 1);
    else if (a === "eq") { const r = draft.floors[i].rooms[j]; r.eq = r.eq || []; const x = r.eq.indexOf(k); x >= 0 ? r.eq.splice(x, 1) : r.eq.push(k); }
    else if (a === "addC") draft.courses.push({ id: "c" + Date.now().toString(36), ko: "", vi: "", min: 60, price: 0, type: "any", eq: "" });
    else if (a === "delC") draft.courses.splice(i, 1);
    else if (a === "addS") staffDraft.push({ id: null, name: "", role: "tp", years: 0, phone: "", def_code: "A", def_start: 840, def_end: 1080, off_day: -1, look: defLook(staffDraft.length), dirty: true });
    else if (a === "lhc" || a === "ltc" || a === "lbc") { staffDraft[i].look[{ lhc: "hc", ltc: "tc", lbc: "bc" }[a]] = +k; staffDraft[i].dirty = true; }
    else if (a === "rmS") {
      const s = staffDraft[i]; if (rmAsk !== s.id) { rmAsk = s.id; renderSet(); return; }
      rmAsk = null; const r = await call("staff_remove", { sid: s.id }); if (r) { staffDraft.splice(i, 1); C.toast(t("saved")); }
    }
    else if (a === "pin" || a === "pinoff") {
      const s = staffDraft[i]; if (!s.id) return;
      if (a === "pin" && !s.has_phone && !String(s.phone || "").replace(/\D/g, "")) { C.toast(t("pinNeedPhone")); return; }
      if (a === "pin" && String(s.phone || "").replace(/\D/g, "") && s.dirty) { C.toast(t("pinNeedPhone")); return; }
      if (busy) return; busy = true;
      try {
        if (a === "pin") { const pin = await C.rpc("staff_pin_reset", { shop: C.shopId, sid: s.id }); pinShow = { id: s.id, pin }; s.app = true; }
        else { await C.rpc("staff_pin_off", { shop: C.shopId, sid: s.id }); s.app = false; if (pinShow && pinShow.id === s.id) pinShow = null; }
      } catch (e) { C.toast(/phone/i.test(e && e.message) ? t("pinNeedPhone") : errTx(e)); }
      busy = false;
    }
    else if (a === "saveS") {
      const s = staffDraft[i]; if (!s.name.trim()) return; if (s.def_code === "C" && !(s.def_end > s.def_start)) { C.toast(t("badHrs")); return; }
      const r = await call("staff_upsert", { s: { id: s.id, name: s.name, role: s.role, years: +s.years || 0, phone: s.phone, def_code: s.def_code, def_start: s.def_code === "C" ? +s.def_start : null, def_end: s.def_code === "C" ? +s.def_end : null, off_day: +s.off_day, look: s.look } });
      if (r) { const fresh = r.staff.find(x => x.name === s.name.trim() && (s.id ? x.id === s.id : true)); if (fresh) { s.id = fresh.id; s.has_phone = !!fresh.has_phone; s.app = !!fresh.app; } s.dirty = false; C.toast(t("saved")); }
    }
    else if (a === "saveL") {
      draft.courses.forEach(c => { if (!c.ko && !c.vi) c.ko = c.vi = "?"; });
      const r = await call("board_layout_save", { cfg: draft }); if (r) { C.toast(t("saved")); setOpen = false; }
    }
    renderSet();
  }
  function setField(el) {
    const f = el.dataset.sf; if (!f) return false;
    const i = +el.dataset.i, j = +el.dataset.j, v = el.value;
    if (f === "min_am" || f === "min_pm") draft[f] = +v;
    else if (/^sh[ABF][01]$/.test(f)) { const c = f[2]; draft.shifts[c] = draft.shifts[c] || [600, 1140]; draft.shifts[c][+f[3]] = +v; }
    else if (f === "rn") draft.floors[i].rooms[j].n = v.trim();
    else if (f === "rt") { draft.floors[i].rooms[j].type = v; return true; }
    else if (f === "rc") { const fl = draft.floors[i], other = fl.rooms.reduce((a, r, k) => a + (k === j ? 0 : (r.count || 1)), 0); fl.rooms[j].count = Math.max(1, Math.min(+v, 7 - other)); return true; }
    else if (f === "cko") draft.courses[i].ko = v; else if (f === "cvi") draft.courses[i].vi = v;
    else if (f === "cpr") draft.courses[i].price = Math.max(0, parseInt(v.replace(/\D/g, ""), 10) || 0);
    else if (f === "cmin") draft.courses[i].min = Math.max(5, parseInt(v, 10) || 60);
    else if (f === "cty") draft.courses[i].type = v; else if (f === "ceq") draft.courses[i].eq = v;
    else {
      const s = staffDraft[i]; s.dirty = true;
      if (f === "sn") s.name = v; else if (f === "sr") s.role = v; else if (f === "sp") s.phone = v; else if (f === "sy") s.years = v;
      else if (f === "sd") { s.def_code = v; return true; } else if (f === "so") s.off_day = +v;
      else if (f === "sds" || f === "sde") { s[f === "sds" ? "def_start" : "def_end"] = +v; return true; }
      else if (f === "lh") { s.look.hair = v; return true; } else if (f === "lt") { s.look.top = v; return true; } else if (f === "lb") { s.look.bottom = v; return true; }
      const btn = root.querySelector(`[data-sa="saveS"][data-i="${i}"]`); if (btn) btn.disabled = false;
    }
    return false;
  }

  /* ---------- 버튼 ---------- */
  async function onClick(e) {
    const sb = e.target.closest("[data-sa]"); if (sb) { if (sb.dataset.sa === "ovx" && e.target !== sb) return; e.preventDefault(); return setAct(sb); }
    const vb = e.target.closest("[data-v]"); if (vb) { view = vb.dataset.v; if (view === "sched") { sched = null; loadSched(); } if (view === "hist") { hist = null; loadHist(); } render(); return; }
    const hb = e.target.closest("[data-h]"); if (hb) { const k = hb.dataset.h;
      if (k === "day" || k === "week" || k === "month") hp.mode = k; else if (k === "today") hp.d = data.today;
      else if (k === "prev" || k === "next") { const sg = k === "prev" ? -1 : 1; if (hp.mode === "day") hp.d = addD(hp.d, sg); else if (hp.mode === "week") hp.d = addD(hp.d, 7 * sg); else { const d = new Date(hp.d + "T00:00:00Z"); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + sg); hp.d = d.toISOString().slice(0, 10); } }
      else if (k === "csv") { csvHist(); return; }
      loadHist(); return; }
    const ib = e.target.closest("[data-it]"); if (ib && deco && deco.sel != null) { const it = deco.items[deco.sel];
      if (ib.dataset.it === "rot") it.r = ((+it.r || 0) + 90) % 360; else if (ib.dataset.it === "mir") it.m = !it.m; else { deco.items.splice(deco.sel, 1); deco.sel = null; }
      renderItems(); return; }
    const dk = e.target.closest("[data-dk]"); if (dk && deco) { if (deco.items.length >= 40) { C.toast(t("decoMax")); return; } const r = plan.getBoundingClientRect(), sc = r.width / G.PW, vy = (Math.min(window.innerHeight, r.bottom) + Math.max(0, r.top)) / 2;
      const py = (vy - r.top) / sc, sl = (G.slabs || []).find(q => py >= q.y && py <= q.y + q.h) || slabOf(1);
      deco.items.push({ id: rid(), k: dk.dataset.dk, fl: sl.fl, rx: 0.25 + Math.random() * 0.5, ry: sl.fl === 1 ? 0.2 + Math.random() * 0.15 : 0.82 + Math.random() * 0.1 }); renderItems(); return; }
    const dx = e.target.closest("[data-dx]"); if (dx) { decoEnd(dx.dataset.dx === "save"); return; }
    if (e.target.closest(".ob-w.guard")) { const L = GUARD_SAY[Math.floor(Math.random() * GUARD_SAY.length)]; guardSay(L[li()]); guard.dir = "down"; guard.flip = false; drawW(guard); return; }
    if (!deco && !C.readOnly && game) {
      const cl = e.target.closest("[data-claim]"); if (cl) { gameAct("claim", cl.dataset.claim); return; }
      const cb = e.target.closest("[data-care]"); if (cb && care) { const c0 = care; care = null; renderCare(); gameAct(cb.dataset.care, c0.sid, c0.at, t(cb.dataset.care === "snack" ? "snacked" : "praised")); return; }
      const gi = e.target.closest(".ob-item.play"); if (gi) { const it = itemsNow().find(x => x.id === gi.dataset.gi); if (!it) return;
        const at = { x: parseFloat(gi.style.left), y: parseFloat(gi.style.top) - 34 };
        if (PETS.includes(it.k)) gameAct("pet", it.id, at, t("petted"));
        else { const p = (game.plants || {})[it.id] || {}; (+p.g || 0) >= 3 ? gameAct("harvest", it.id, at, t("harvested")) : gameAct("water", it.id, at, t("watered")); }
        return; }
      const wk = e.target.closest(".ob-w.tap"); if (wk) { const st = data.staff.find(x => x.id === wk.dataset.sid), w = W.get(wk.dataset.sid);
        if (st && w && ["idle", "desk"].includes(stOf(st)) && !w.moving) { care = care && care.sid === st.id ? null : { sid: st.id, name: st.name, at: { x: w.x, y: w.y - 60 } }; renderCare(); return; } }
      if (care && !e.target.closest(".ob-care")) { care = null; renderCare(); }
    }
    if (pick && !e.target.closest(".ob-pop") && !e.target.closest('[data-a="cell"]')) { pick = null; renderPick(); }
    const b = e.target.closest("[data-a]"); if (!b) return;
    const a = b.dataset.a, id = b.dataset.id;
    if (C.readOnly && !["reload", "pkclose", "hpclose"].includes(a)) { C.toast(t("roNote")); return; }
    if (a === "set") { openSet(); return; }
    if (a === "deco") { decoStart(); return; }
    if (a === "shopopen" || a === "shopclose") {
      const r = await call("shop_open", { action: a === "shopopen" ? "open" : "close" });
      if (r && a === "shopclose") { const still = r.staff.filter(x => x.in_at && !x.out_at).length; C.toast(still ? t("closedStill", { n: still }) : t("closedOk")); }
      return;
    }
    if (a === "reload") { await load(); if (view === "sched") loadSched(); if (view === "hist") loadHist(); return; }
    if (a === "addg") {
      const n = root.querySelector("#obGN"), c = (data.layout.courses || [])[+root.querySelector("#obGC").value];
      if (!n.value.trim() || !c) { n.focus(); return; }
      if (await call("guest_add", { nm: n.value.trim(), course: c, people: +root.querySelector("#obGP").value })) n.value = "";
      return;
    }
    if (a === "checkin") { await call("guest_checkin", { bid: id }); return; }
    if (a === "assign") { open.assign = open.assign === id ? null : id; const f = data.staff.find(s => s.role === "tp" && stOf(s) === "idle"); open.tps = f ? [f.id] : []; renderSide(); return; }
    if (a === "tpk") { const k = open.tps.indexOf(id); if (k >= 0) open.tps.splice(k, 1); else if (open.tps.length >= 4) { C.toast(t("max4")); return; } else open.tps.push(id); renderSide(); return; }
    if (a === "leave") { await call("guest_leave", { gid: id }); return; }
    if (a === "startx") {
      const stn = root.querySelector("#obAS"), ids = open.tps.slice(); if (!ids.length || !stn) return;
      const nm = ids.map(i => (data.staff.find(x => x.id === i) || {}).name).filter(Boolean).join(", ");
      if (await call("session_begin", { gid: id, tps: ids, stn: stn.value })) { open.assign = null; open.tps = []; C.toast(t("sent", { a: nm, b: stn.options[stn.selectedIndex].text })); }
      return;
    }
    if (a === "ext") { await call("session_extend", { xid: id, mins: 15 }); return; }
    if (a === "fin") { open.finish = open.finish === id ? null : id; renderSide(); const p = root.querySelector("#obPaid"); if (p) p.focus(); return; }
    if (a === "finx") {
      const v = parseInt(String(root.querySelector("#obPaid").value).replace(/\D/g, ""), 10), x = data.sessions.find(y => y.id === id), xn = x ? mates(x).map(y => y.staff_name).join(", ") : "";
      if (await call("session_finish", { xid: id, paid: isNaN(v) ? null : v })) { open.finish = null; C.toast(t("doneToast", { n: xn })); }
      return;
    }
    if (a === "cancelx") { if (await call("session_cancel", { xid: id })) open.finish = null; return; }
    if (a === "in" || a === "out") { await call("staff_attend", { sid: id, action: a }); return; }
    if (a === "off" || a === "on") { if (await call("shift_set", { sid: id, d: data.today, code: a === "off" ? "O" : null }, true) !== null) await load(); return; }
    if (a === "wk-" || a === "wk+") { weekFrom = addD(weekFrom, a === "wk-" ? -7 : 7); sched = null; renderSched(); loadSched(); return; }
    if (a === "cell") {
      const s = sched.staff.find(x => x.id === id), i = +b.dataset.i, hh = (s.hours || [])[i];
      const base = hh || (s.def_code === "C" && s.def_start != null ? [s.def_start, s.def_end] : null) || [840, 1080];
      const sameCell = pick && pick.id === id && pick.d === b.dataset.d;
      pick = sameCell ? null : { id, d: b.dataset.d, c: b.dataset.c, s: base[0], e: base[1], rect: b.getBoundingClientRect() }; renderPick();
      return;
    }
    if (a === "pkclose") { pick = null; renderPick(); return; }
    if (a === "hpopen") { const r = (hist.rows || []).find(x => x.booking_id === id); hpick = hpick && hpick.bid === id ? null : { bid: id, ids: r && r.staff_ids ? r.staff_ids.filter(Boolean) : [] }; renderHist(); return; }
    if (a === "hpclose") { hpick = null; renderHist(); return; }
    if (a === "hpt") { if (!hpick) return; const k = hpick.ids.indexOf(id); if (k >= 0) hpick.ids.splice(k, 1); else if (hpick.ids.length >= 4) { C.toast(t("max4")); return; } else hpick.ids.push(id); renderHist(); return; }
    if (a === "hpsave") { if (!hpick) return; if (await call("booking_staff_set", { bid: hpick.bid, tps: hpick.ids }, true)) { hpick = null; C.toast(t("hTpSaved")); loadHist(); } return; }
    if (a === "pk" || a === "pkx") {
      const p = pick; if (!p) return; const code = b.dataset.c === "null" ? null : b.dataset.c;
      if (a === "pkx" && !(p.e > p.s)) { C.toast(t("badHrs")); return; }
      const r = a === "pkx" ? await call("shift_set_custom", { sid: p.id, d: p.d, s: p.s, e: p.e }, true) : await call("shift_set", { sid: p.id, d: p.d, code }, true);
      pick = null; await loadSched(); if (p.d === data.today) load();
      return;
    }
    if (a === "rok" || a === "rno") { const r = await call("req_decide", { rid: +id, ok: a === "rok" }, true); if (r) { sched = r; renderSched(); load(); } return; }
  }
  function onKey(e) { if (e.key === "Escape" && pick) { pick = null; renderPick(); } }
  function onChange(e) { if (e.target.id === "obHD" && e.target.value) { hp.d = e.target.value; loadHist(); return; } onChange2(e); }
  function onChange2(e) { if (pick && (e.target.id === "obPkS" || e.target.id === "obPkE")) { pick[e.target.id === "obPkS" ? "s" : "e"] = +e.target.value; renderPick(); return; } if (e.target.dataset.sf && setField(e.target)) renderSet(); }
  function onInput(e) { if (e.target.tagName === "INPUT" && e.target.dataset.sf) setField(e.target); }

  let rz = 0;
  function onResize() { clearTimeout(rz); rz = setTimeout(() => { if (!data || view !== "board") return; const sig = JSON.stringify(data.layout.floors) + data.layout.kind + lang + (window.innerWidth >= 1200); if (sig !== geoSig) render(); else fit(); }, 150); }

  window.OwnerBoard = {
    avatar(look, i) { return sheet(lookOf(look || {}, i || 0)); },
    mount(el, ctx) {
      this.unmount();
      C = ctx; root = el; lang = LANGS.includes(ctx.lang) ? ctx.lang : "vi"; if (ctx.view) { view = ctx.view; sched = null; } plan = null; geoSig = ""; W.clear(); GW.clear(); prevSess = new Map();
      root.addEventListener("click", onClick); root.addEventListener("change", onChange); root.addEventListener("input", onInput);
      window.addEventListener("resize", onResize); window.addEventListener("keydown", onKey);
      if (data && data.shop && data.shop.id === C.shopId) render(); else { data = null; root.innerHTML = `<p class="ob-empty">…</p>`; }
      load().then(() => { if (view === "sched" && !sched) loadSched(); if (view === "hist") loadHist(); });
      pollT = setInterval(() => { if (!document.hidden && !busy && !open.assign && !open.finish && !setOpen && !pick && !deco) load(); }, 10000);
      tickT = setInterval(tick, 1000); emoT = setInterval(emote, 5000);
      root.addEventListener("pointerdown", decoDown); root.addEventListener("pointermove", decoMove); root.addEventListener("pointerup", decoUp); root.addEventListener("pointercancel", decoUp); root.addEventListener("dblclick", decoDbl);
      last = 0; raf = requestAnimationFrame(loop);
    },
    unmount() {
      if (!root) return;
      clearInterval(pollT); clearInterval(tickT); clearInterval(emoT); deco = null; drag = null; pets = [];
      root.removeEventListener("pointerdown", decoDown); root.removeEventListener("pointermove", decoMove); root.removeEventListener("pointerup", decoUp); root.removeEventListener("pointercancel", decoUp); root.removeEventListener("dblclick", decoDbl); cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); window.removeEventListener("keydown", onKey); pick = null;
      root.removeEventListener("click", onClick); root.removeEventListener("change", onChange); root.removeEventListener("input", onInput);
      W.forEach(w => w.el.remove()); W.clear(); GW.forEach(w => w.el.remove()); GW.clear();
      root = null; plan = null; setOpen = false; open = { assign: null, finish: null, tps: [] };
    }
  };
})();

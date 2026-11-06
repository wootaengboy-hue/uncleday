/* =====================================================
   ★ 내용 수정은 이 파일에서만 하세요 ★
   - 글자는 언어별로 적어요:  { ko: "한국어", en: "English" }
   - 일본어 추가할 때: ja: "日本語" 를 같이 적고, 아래 LANGS에 ja 한 줄만 켜면 돼요.
     (일본어를 안 적은 곳은 자동으로 영어 → 한국어 순으로 대신 보여줘요)
   - 항목 추가: { ... }, 한 덩어리를 복사해 붙이세요. 쉼표(,) 꼭 남기기.
   - 항목 삭제: 해당 { ... }, 덩어리를 통째로 지우세요.
   ===================================================== */

// 1) 사이트 기본 정보
const SITE = {
  name: { ko: "엉클데이", en: "Uncle Day", vi: "Uncle Day" },
  slogan: { ko: "베트남 뷰티, 믿을 수 있는 곳만 골라 연결해 드려요",
            en: "Trusted beauty services in Vietnam, booked for you", vi: "Dịch vụ làm đẹp uy tín tại Việt Nam, đặt lịch giúp bạn" },
  kakao: "https://pf.kakao.com/_xgkuxeX/chat",   // 엉클데이 카카오톡 채널 (누르면 바로 1:1 채팅)
  email: "hello@example.com",         // 예약 요청 받을 이메일
  formEndpoint: "",                   // (선택) 예약을 자동 수신할 폼 주소. 비워두면 카톡/이메일 방식. README 참고
  hours: { ko: "매일 09:00 ~ 21:00 (한국시간)", en: "Daily 09:00–21:00 (KST)", vi: "Hằng ngày 07:00–19:00 (giờ Việt Nam)" },
  // 환율: 베트남 동(VND) 1동이 얼마인지. ※ 샘플 값입니다. 가끔 직접 갱신하세요.
  rates: {
    ko: { symbol: "₩", rate: 0.055,    round: 100 },
    en: { symbol: "US$", rate: 0.00004, round: 1 }
    // ja: { symbol: "¥", rate: 0.006, round: 10 }
  }
};

// 2) 사용 언어 (일본어를 켜려면 아래 줄 앞의 // 를 지우세요)
const LANGS = [
  { id: "ko", label: "한국어" },
  { id: "en", label: "English" },
  { id: "vi", label: "Tiếng Việt" }
  // { id: "ja", label: "日本語" }
];

// 3) 지역
const CITIES = [
  { id: "hcm",      name: { ko: "호치민", en: "Ho Chi Minh", vi: "TP. Hồ Chí Minh" } },
  { id: "hanoi",    name: { ko: "하노이", en: "Hanoi", vi: "Hà Nội" } },
  { id: "danang",   name: { ko: "다낭",   en: "Da Nang", vi: "Đà Nẵng" } },
  { id: "nhatrang", name: { ko: "나트랑", en: "Nha Trang", vi: "Nha Trang" } }
];

// 4) 카테고리 (icon은 이모티콘)
const CATEGORIES = [
  { id: "skin", icon: "✨", name: { ko: "피부관리", en: "Facial & Skincare", vi: "Chăm sóc da mặt" }, sub: [
      { ko: "페이셜 케어", en: "Facial", vi: "Chăm sóc da mặt" }, { ko: "여드름 관리", en: "Acne care", vi: "Trị mụn" },
      { ko: "미백·재생", en: "Whitening / Repair", vi: "Dưỡng trắng / Phục hồi" } ] },
  { id: "massage", icon: "💆", name: { ko: "마사지", en: "Massage", vi: "Massage" }, sub: [
      { ko: "전신 마사지", en: "Full-body", vi: "Toàn thân" }, { ko: "발 마사지", en: "Foot", vi: "Chân" },
      { ko: "타이/아로마", en: "Thai / Aroma", vi: "Thái / Tinh dầu" }, { ko: "핫스톤", en: "Hot stone", vi: "Đá nóng" } ] },
  { id: "spa", icon: "🧖", name: { ko: "스파·바디케어", en: "Spa & Body", vi: "Spa & Chăm sóc cơ thể" }, sub: [
      { ko: "바디 스크럽", en: "Body scrub", vi: "Tẩy tế bào chết" }, { ko: "허브 찜질", en: "Herbal steam", vi: "Xông thảo dược" },
      { ko: "커플 스파", en: "Couple spa", vi: "Spa đôi" } ] },
  { id: "derma", icon: "💉", name: { ko: "피부과 시술", en: "Dermatology", vi: "Da liễu thẩm mỹ" }, sub: [
      { ko: "레이저", en: "Laser", vi: "Laser" }, { ko: "보톡스·필러", en: "Botox / Filler", vi: "Botox / Filler" },
      { ko: "실리프팅", en: "Thread lift", vi: "Căng chỉ" }, { ko: "스킨부스터", en: "Skin booster", vi: "Skin booster" } ] },
  { id: "surgery", icon: "🏥", name: { ko: "성형·윤곽", en: "Plastic Surgery", vi: "Phẫu thuật thẩm mỹ" }, sub: [
      { ko: "얼굴윤곽술", en: "Facial contouring", vi: "Gọt mặt" }, { ko: "눈·코 성형", en: "Eyes / Nose", vi: "Mắt / Mũi" },
      { ko: "안면거상", en: "Facelift", vi: "Căng da mặt" } ] },
  { id: "hair", icon: "💇", name: { ko: "헤어", en: "Hair", vi: "Tóc" }, sub: [
      { ko: "커트·펌·염색", en: "Cut / Perm / Color", vi: "Cắt / Uốn / Nhuộm" }, { ko: "두피 케어", en: "Scalp care", vi: "Chăm sóc da đầu" } ] },
  { id: "nail", icon: "💅", name: { ko: "네일·속눈썹", en: "Nail & Lash", vi: "Nail & Mi" }, sub: [
      { ko: "네일 아트", en: "Nail art", vi: "Vẽ móng" }, { ko: "속눈썹 연장", en: "Lash extension", vi: "Nối mi" },
      { ko: "반영구 눈썹", en: "Brow tattoo", vi: "Phun mày" } ] },
  { id: "body", icon: "🪒", name: { ko: "제모·체형", en: "Hair Removal & Body", vi: "Triệt lông & Body" }, sub: [
      { ko: "레이저 제모", en: "Laser hair removal", vi: "Triệt lông laser" }, { ko: "지방분해", en: "Fat reduction", vi: "Giảm mỡ" } ] },
  { id: "dental", icon: "🦷", name: { ko: "치과·미백", en: "Dental", vi: "Nha khoa" }, sub: [
      { ko: "치아 미백", en: "Whitening", vi: "Tẩy trắng răng" }, { ko: "라미네이트", en: "Veneers", vi: "Mặt dán sứ" } ] },
  { id: "package", icon: "🧳", name: { ko: "뷰티 패키지", en: "Beauty Packages", vi: "Gói làm đẹp" }, sub: [
      { ko: "여행+뷰티", en: "Trip + Beauty", vi: "Du lịch + Làm đẹp" }, { ko: "공항 픽업", en: "Airport pickup", vi: "Đón sân bay" },
      { ko: "통역 동행", en: "Interpreter", vi: "Phiên dịch" } ] }
];

// 5) 배너
// 메인 배너 이미지 (비우면 아래 글자 배너가 4초마다 바뀌며 나와요)
const BANNER_IMG = "";

const BANNERS = [
  { title: { ko: "첫 예약 10% 할인", en: "10% off your first booking", vi: "Giảm 10% cho lần đặt đầu tiên" },
    desc:  { ko: "처음 이용하시는 분께 드려요", en: "For new customers", vi: "Dành cho khách hàng mới" }, color: "#116241" },
  { title: { ko: "한국어 통역 동행", en: "Korean-speaking support", vi: "Hỗ trợ tiếng Hàn" },
    desc:  { ko: "말이 안 통해도 걱정 없어요", en: "No language worries", vi: "Không lo rào cản ngôn ngữ" }, color: "#0E2843" }
];

/* 6) 업체 목록은 shops.js 로 옮겼어요. 관리자 페이지(admin.html)에서 수정하세요. */

// 6-1) 가까운 순 정렬에 쓰는 기준 장소 (도시 id, 이름, 위도, 경도)
const PLACES = [
  { city: "danang", name: { ko: "한시장", en: "Han Market", vi: "Chợ Hàn" }, geo: [16.0681, 108.2244] },
  { city: "danang", name: { ko: "미케비치", en: "My Khe Beach", vi: "Biển Mỹ Khê" }, geo: [16.0617, 108.2470] },
  { city: "danang", name: { ko: "용다리", en: "Dragon Bridge", vi: "Cầu Rồng" }, geo: [16.0611, 108.2270] },
  { city: "danang", name: { ko: "롯데마트 다낭", en: "Lotte Mart Da Nang", vi: "Lotte Mart Đà Nẵng" }, geo: [16.0350, 108.2296] },
  { city: "danang", name: { ko: "다낭 공항", en: "Da Nang Airport", vi: "Sân bay Đà Nẵng" }, geo: [16.0556, 108.2022] },
  { city: "hcm", name: { ko: "벤탄시장", en: "Ben Thanh Market", vi: "Chợ Bến Thành" }, geo: [10.7725, 106.6980] },
  { city: "hcm", name: { ko: "부이비엔 거리", en: "Bui Vien Street", vi: "Phố Bùi Viện" }, geo: [10.7675, 106.6930] },
  { city: "hcm", name: { ko: "타오디엔 (2군)", en: "Thao Dien (D2)", vi: "Thảo Điền (Q2)" }, geo: [10.8030, 106.7340] },
  { city: "hcm", name: { ko: "떤선녓 공항", en: "Tan Son Nhat Airport", vi: "Sân bay Tân Sơn Nhất" }, geo: [10.8185, 106.6588] },
  { city: "hanoi", name: { ko: "호안끼엠 호수", en: "Hoan Kiem Lake", vi: "Hồ Hoàn Kiếm" }, geo: [21.0288, 105.8525] },
  { city: "hanoi", name: { ko: "서호", en: "West Lake", vi: "Hồ Tây" }, geo: [21.0560, 105.8220] },
  { city: "hanoi", name: { ko: "노이바이 공항", en: "Noi Bai Airport", vi: "Sân bay Nội Bài" }, geo: [21.2187, 105.8042] },
  { city: "nhatrang", name: { ko: "나트랑 해변 (쩐푸 거리)", en: "Nha Trang Beach (Tran Phu)", vi: "Biển Nha Trang (Trần Phú)" }, geo: [12.2380, 109.1970] },
  { city: "nhatrang", name: { ko: "나트랑 야시장", en: "Nha Trang Night Market", vi: "Chợ đêm Nha Trang" }, geo: [12.2445, 109.1960] },
  { city: "nhatrang", name: { ko: "깜란 공항", en: "Cam Ranh Airport", vi: "Sân bay Cam Ranh" }, geo: [11.9982, 109.2194] }
];

// 7) 이용 방법
const STEPS = [
  { icon: "🔍", title: { ko: "1. 골라요",   en: "1. Choose", vi: "1. Chọn" },  desc: { ko: "카테고리와 지역으로 찾아요", en: "Browse by category and city", vi: "Tìm theo danh mục và thành phố" } },
  { icon: "📅", title: { ko: "2. 예약해요", en: "2. Request", vi: "2. Gửi yêu cầu" }, desc: { ko: "날짜·시간을 골라 요청해요", en: "Pick a date and time", vi: "Chọn ngày và giờ" } },
  { icon: "✅", title: { ko: "3. 확정돼요", en: "3. Confirm", vi: "3. Xác nhận" }, desc: { ko: "확인 후 연락드려요",       en: "We confirm with the shop", vi: "Chúng tôi xác nhận với cơ sở" } },
  { icon: "🌟", title: { ko: "4. 후기",     en: "4. Review", vi: "4. Đánh giá" },  desc: { ko: "다녀온 뒤 후기를 남겨요",  en: "Share your experience", vi: "Chia sẻ trải nghiệm của bạn" } }
];

// 8) 후기
const REVIEWS = [];   // 이용 후기는 이제 관리자 페이지에서 업체별로 관리해요

// 9) 자주 묻는 질문
const FAQ = [
  { q: { ko: "예약은 어떻게 하나요?", en: "How do I book?", vi: "Đặt lịch như thế nào?" },
    a: { ko: "업체를 고르고 날짜·시간·인원을 넣어 예약 요청을 보내 주세요. 저희가 업체에 자리를 확인한 뒤 카카오톡이나 이메일로 확정 연락을 드려요. 확정 연락을 받기 전까지는 예약이 끝난 게 아니에요.",
         en: "Pick a shop and send a request with your date, time and number of guests. We check availability with the shop and confirm via KakaoTalk or email. Your booking is not final until you receive our confirmation.", vi: "Chọn cơ sở và gửi yêu cầu kèm ngày, giờ, số người. Chúng tôi sẽ kiểm tra lịch với cơ sở và xác nhận qua KakaoTalk hoặc email. Lịch hẹn chỉ hoàn tất khi bạn nhận được xác nhận." } },
  { q: { ko: "'정보 확인 중' 업체는 무엇인가요?", en: "What does 'Info pending' mean?", vi: "'Đang xác minh' nghĩa là gì?" },
    a: { ko: "주소·영업시간·가격을 아직 업체와 직접 확인하고 있는 곳이에요. 이런 업체는 예약 폼 대신 카카오톡 상담으로 먼저 이용 가능 여부와 가격을 안내해 드려요.",
         en: "We are still confirming the address, hours and prices directly with the shop. For these shops, please contact us on KakaoTalk first and we will check availability and prices for you.", vi: "Chúng tôi đang xác nhận trực tiếp địa chỉ, giờ mở cửa và giá với cơ sở. Với những cơ sở này, vui lòng liên hệ qua KakaoTalk trước để chúng tôi kiểm tra lịch trống và giá giúp bạn." } },
  { q: { ko: "예약비나 수수료가 따로 있나요?", en: "Is there a booking fee?", vi: "Có mất phí đặt lịch không?" },
    a: { ko: "예약 요청과 상담은 무료예요. 요금은 업체에서 이용하신 만큼 현장에서 내시면 돼요.",
         en: "Booking requests and consultations are free. You pay the shop directly for the services you use.", vi: "Gửi yêu cầu và tư vấn đều miễn phí. Bạn thanh toán trực tiếp tại cơ sở cho dịch vụ đã dùng." } },
  { q: { ko: "가격은 어떤 돈으로, 어떻게 내나요?", en: "What currency and how do I pay?", vi: "Thanh toán bằng tiền gì và như thế nào?" },
    a: { ko: "가격은 베트남 동(₫)으로 적혀 있고, 원화·달러는 참고용 환산 금액이에요. 결제는 현장에서 해요. 현금만 받는 업체도 있으니 베트남 동 현금을 조금 챙기시면 편해요. 카드 가능 여부는 예약 확정 때 함께 알려 드려요.",
         en: "Prices are in Vietnamese dong (₫); KRW/USD amounts are approximate. You pay at the shop. Some shops are cash-only, so carrying some dong is handy. We will tell you whether cards are accepted when we confirm.", vi: "Giá được ghi bằng đồng Việt Nam (₫). Bạn thanh toán tại cơ sở. Một số nơi chỉ nhận tiền mặt, nên hãy mang theo một ít tiền mặt. Chúng tôi sẽ báo việc nhận thẻ khi xác nhận lịch." } },
  { q: { ko: "마사지 팁은 줘야 하나요?", en: "Do I need to tip?", vi: "Có cần tip không?" },
    a: { ko: "베트남 마사지샵은 관리사 팁을 따로 받는 곳이 많아요. 업체마다 팁이 요금에 포함된 곳도 있고, 60분 기준 몇 달러 정도를 따로 내는 곳도 있어요. 예약 확정 때 팁 포함 여부를 알려 드릴게요.",
         en: "Many massage shops in Vietnam expect a separate tip for the therapist. Some include it in the price, others ask for a few dollars per 60 minutes. We will let you know when we confirm your booking.", vi: "Nhiều tiệm massage có thu tiền tip riêng cho kỹ thuật viên. Có nơi đã gồm tip trong giá, có nơi thu thêm. Chúng tôi sẽ báo khi xác nhận lịch." } },
  { q: { ko: "한국어로 이용할 수 있나요?", en: "Can I get service in Korean?", vi: "Có hỗ trợ ngôn ngữ của tôi không?" },
    a: { ko: "예약과 상담은 저희가 한국어로 도와드려요. 업체 직원의 한국어 가능 여부는 업체 상세 화면의 '응대 언어'에서 확인할 수 있어요. 한국어가 안 되는 업체라도 요청사항을 미리 전달해 드려요.",
         en: "We handle booking and consultation in Korean and English. Check 'Languages' on each shop page for staff languages. Even if the staff don't speak your language, we pass on your requests in advance.", vi: "Chúng tôi hỗ trợ đặt lịch và tư vấn bằng tiếng Hàn và tiếng Anh. Ngôn ngữ của nhân viên được ghi ở mục 'Ngôn ngữ hỗ trợ' trên trang từng cơ sở." } },
  { q: { ko: "숙소 픽업이나 공항 샌딩이 되나요?", en: "Do shops offer hotel pickup or airport drop-off?", vi: "Cơ sở có đón tại khách sạn hoặc đưa ra sân bay không?" },
    a: { ko: "업체마다 달라요. 2인 이상이면 시내 숙소 무료 픽업을 해 주는 곳, 짐 보관과 공항 샌딩까지 해 주는 곳이 있어요. 업체 소개와 태그에서 확인하시고, 예약 요청 때 요청사항에 적어 주세요.",
         en: "It depends on the shop. Some offer free hotel pickup for 2+ guests, and some also offer luggage storage and airport drop-off. Check the shop details and add it to your request notes.", vi: "Tùy cơ sở. Có nơi đón miễn phí trong thành phố từ 2 người, có nơi giữ hành lý và đưa ra sân bay. Hãy xem thông tin cơ sở và ghi vào phần yêu cầu thêm." } },
  { q: { ko: "여행 마지막 날 짐을 맡기고 이용할 수 있나요?", en: "Can I store luggage on my last day?", vi: "Ngày cuối có gửi hành lý được không?" },
    a: { ko: "짐 보관과 샤워실이 있는 업체가 많아서 체크아웃 후 비행기 시간 전에 이용하기 좋아요. 업체 태그에 '짐 보관'이 있는지 확인해 주세요.",
         en: "Many shops offer luggage storage and showers, so they are great between check-out and your flight. Look for the 'luggage storage' tag.", vi: "Nhiều cơ sở có giữ hành lý và phòng tắm, rất tiện trong khoảng thời gian sau khi trả phòng và trước chuyến bay." } },
  { q: { ko: "아이나 임산부도 받을 수 있나요?", en: "Are kids and pregnant guests welcome?", vi: "Trẻ em và bà bầu có dùng dịch vụ được không?" },
    a: { ko: "키즈 마사지와 임산부 마사지가 있는 업체가 많아요. 다만 업체마다 나이 기준과 주의사항이 달라서, 예약 요청 때 아이 나이나 임신 주수를 꼭 적어 주세요.",
         en: "Many shops offer kids and pregnancy massages, but age limits and precautions vary. Please include your child's age or how far along you are in the request.", vi: "Nhiều cơ sở có massage cho trẻ em và bà bầu, nhưng giới hạn tuổi và lưu ý khác nhau. Vui lòng ghi tuổi của bé hoặc tuần thai trong yêu cầu." } },
  { q: { ko: "예약을 바꾸거나 취소할 수 있나요?", en: "Can I change or cancel my booking?", vi: "Có thể đổi hoặc hủy lịch không?" },
    a: { ko: "카카오톡으로 최대한 빨리 알려 주세요. 변경·취소 가능 여부와 기한은 업체마다 달라서 예약 확정 때 함께 안내해 드려요. 당일 취소나 연락 없이 오지 않으면 다음 예약이 어려울 수 있어요.",
         en: "Please message us on KakaoTalk as soon as possible. Change and cancellation rules differ by shop, and we will explain them when we confirm. Same-day cancellations or no-shows may limit future bookings.", vi: "Vui lòng nhắn cho chúng tôi qua KakaoTalk càng sớm càng tốt. Quy định đổi/hủy khác nhau theo từng cơ sở và sẽ được báo khi xác nhận. Hủy trong ngày hoặc không đến có thể ảnh hưởng đến lần đặt sau." } },
  { q: { ko: "늦으면 어떻게 되나요?", en: "What if I'm late?", vi: "Nếu đến trễ thì sao?" },
    a: { ko: "예약 시간 10~15분 전에 도착하시는 게 좋아요. 늦으면 뒤 손님 때문에 관리 시간이 줄어들거나 예약이 취소될 수 있어요. 늦을 것 같으면 바로 카카오톡으로 알려 주세요.",
         en: "Please arrive 10–15 minutes early. If you are late, your treatment may be shortened or cancelled because of the next booking. Message us on KakaoTalk right away if you are running late.", vi: "Vui lòng đến sớm 10–15 phút. Nếu đến trễ, thời gian dịch vụ có thể bị rút ngắn hoặc bị hủy vì lịch sau. Hãy nhắn ngay qua KakaoTalk nếu bạn bị trễ." } },
  { q: { ko: "성형·피부과 시술도 예약할 수 있나요?", en: "Can I book cosmetic surgery or dermatology treatments?", vi: "Có đặt lịch phẫu thuật thẩm mỹ hoặc da liễu được không?" },
    a: { ko: "네, 상담 예약부터 도와드려요. 시술·수술은 반드시 병원에서 직접 상담을 받고 결정하세요. 회복 기간과 귀국 일정, 사후 관리 방법을 미리 확인하는 게 좋아요. 가격은 상담 후 병원에서 안내해요.",
         en: "Yes, we can start with a consultation booking. Always consult the clinic in person before deciding on any procedure, and check recovery time, your flight home and aftercare in advance. Prices are given by the clinic after consultation.", vi: "Có, chúng tôi hỗ trợ đặt lịch tư vấn trước. Hãy luôn tư vấn trực tiếp tại cơ sở trước khi quyết định, và kiểm tra trước thời gian hồi phục, lịch bay và chăm sóc sau điều trị. Giá do cơ sở báo sau khi tư vấn." } }
];

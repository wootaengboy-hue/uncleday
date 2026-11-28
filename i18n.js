/* 화면에 고정으로 나오는 문구(버튼, 제목 등)의 번역표입니다.
   일본어를 추가하려면 아래 en 덩어리를 복사해 ja: { ... } 로 만들고 번역하세요. */
const UI = {
  ko: {
    search: "마사지, 얼굴윤곽, 피부관리 검색", consult: "상담하기", all: "전체",
    catTitle: "어떤 케어를 찾으세요?", recommend: "추천 업체", shopsOf: "{n} 업체",
    steps: "이용 방법", reviews: "이용 후기", faq: "자주 묻는 질문",
    partner: "업체 사장님이신가요?", partnerDesc: "입점 문의를 남겨 주세요.", partnerBtn: "입점 문의하기",
    empty: "조건에 맞는 업체가 아직 없어요.", notFound: "업체를 찾을 수 없어요.", back: "← 목록으로",
    about: "소개", info: "이용 안내", address: "주소", hours: "영업시간", closedDays: "휴무", none: "없음",
    staffLangs: "응대 언어", map: "지도 보기", menu: "메뉴", consultPrice: "상담 후 안내", min: "분",
    book: "예약 요청", bookBtn: "예약 요청하기", mgPick: "시간을 골라 예약해요", ex_fee: "추가 요금", ex_tip: "관리사 팁", pm_ppl: "{n}인 이상", m_all: "전체", tot_title: "예상 결제 금액", tot_disc: "할인", tot_sum: "가게에서 낼 금액 (예상)", tot_note: "결제는 가게에서 해요. 인원 · 시간 할인은 실제 방문 인원 · 시간으로 가게가 확인해요.", m_other: "기타", pm_time: "{a}~{b} 예약", ex_total: "가게에서 낼 금액 (예상)", ex_noDisc: "할인 없음", pick: "선택",
    fMenu: "메뉴", fDate: "날짜", fTime: "시간", fPeople: "인원", fName: "이름",
    fContact: "연락처 (전화번호 / 카카오톡 ID / WhatsApp / 이메일)", fNote: "요청사항",
    closedAlert: "이 날은 쉬는 날이에요. 다른 날짜를 골라 주세요.",
    notice: "※ 예약 '요청'입니다. 업체 확인 후 확정 연락을 드려요.",
    doneTitle: "예약 요청이 준비됐어요", doneSent: "요청이 전송되었어요. 확정되면 연락드릴게요.",
    doneManual: "아래 내용을 복사해서 카카오톡이나 이메일로 보내 주세요.",
    copy: "내용 복사", copied: "복사됨!", viaKakao: "카카오톡 열기", viaMail: "이메일로 보내기",
    days: ["일", "월", "화", "수", "목", "금", "토"],
    recoFor: "이런 분께 추천해요:", price: "가격", overview: "한눈에 보기", status: "정보 확인 현황", confirmed: "확인됨", chkConsent: "업체 확인·입점 동의", similar: "비슷한 업체", soon: "준비 중", comingSoon: "아직 준비 중이에요. 곧 만나볼 수 있도록 업체를 모으고 있어요.", unverified: "정보 확인 중", unverifiedNote: "이 업체 정보는 아직 확인 중이에요. 가격·영업시간은 상담 시 안내해 드려요.", tbd: "확인 중", askNote: "예약 가능 여부는 카카오톡 상담으로 먼저 확인해 드려요.", askBtn: "카카오톡으로 문의하기", menuBoard: "가격표", certBadge: "엉클 인증업체", noRating: "아직 후기가 없어요", nearBtn: "📍 내 위치에서 가까운 순", nearPick: "기준 장소 고르기", nearOff: "기본 순서", nearFromMe: "내 위치에서 가까운 순이에요", nearFromPlace: "{p}에서 가까운 순이에요", nearWait: "위치를 확인하고 있어요…", nearFail: "위치를 쓸 수 없어요. 대신 기준 장소를 골라 주세요.", nearApprox: "거리는 대략적인 값이에요", rvTitle: "이용 후기", rvNone: "아직 후기가 없어요. 다녀오셨다면 첫 후기를 남겨 주세요!", rvWrite: "후기 남기기", rvStars: "별점", rvName: "이름 (닉네임)", rvVisit: "방문한 달", rvMenu: "이용한 메뉴 (선택)", rvText: "후기 내용", rvTextPh: "좋았던 점, 아쉬웠던 점을 편하게 적어 주세요", rvContact: "연락처 (선택 · 공개 안 돼요)", rvSend: "후기 보내기", rvNotice: "※ 보내 주신 후기는 확인 후 게시돼요.", rvDoneSent: "후기가 전송되었어요. 확인 후 게시할게요. 감사합니다!", rvDoneManual: "아래 내용을 복사해서 카카오톡이나 이메일로 보내 주시면 확인 후 게시할게요.", rvNeedStar: "별점을 골라 주세요.", rvShort: "후기를 10자 이상 적어 주세요.", rvAt: "이용 업체", rvCount: "후기 {n}개", tapZoom: "가격표를 누르면 크게 볼 수 있어요.",
    approx: "약", lang_ko: "한국어", lang_en: "영어", lang_vi: "베트남어", lang_ja: "일본어", lang_zh: "중국어"
  },
  en: {
    search: "Search massage, facial, contouring…", consult: "Contact us", all: "All",
    catTitle: "What are you looking for?", recommend: "Recommended", shopsOf: "{n} shops",
    steps: "How it works", reviews: "Reviews", faq: "FAQ",
    partner: "Own a shop?", partnerDesc: "Contact us to get listed.", partnerBtn: "Apply to list",
    empty: "No shops match yet.", notFound: "Shop not found.", back: "← Back to list",
    about: "About", info: "Details", address: "Address", hours: "Hours", closedDays: "Closed", none: "None",
    staffLangs: "Languages", map: "View map", menu: "Menu", consultPrice: "Price on consultation", min: "min",
    book: "Booking request", bookBtn: "Send request", mgPick: "Pick a duration to book", ex_fee: "Extra fee", ex_tip: "Therapist tip", pm_ppl: "{n}+ guests", m_all: "All", tot_title: "Estimated total", tot_disc: "Discount", tot_sum: "Pay at the shop (est.)", tot_note: "You pay at the shop. Group and time discounts are confirmed by the shop on your visit.", m_other: "Other", pm_time: "booking {a}–{b}", ex_total: "Pay at the shop (est.)", ex_noDisc: "no discount", pick: "Select",
    fMenu: "Service", fDate: "Date", fTime: "Time", fPeople: "Guests", fName: "Name",
    fContact: "Contact (Phone / KakaoTalk ID / WhatsApp / Email)", fNote: "Notes",
    closedAlert: "The shop is closed that day. Please pick another date.",
    notice: "* This is a request. We will confirm after checking with the shop.",
    doneTitle: "Your request is ready", doneSent: "Request sent. We will contact you once confirmed.",
    doneManual: "Please copy the text below and send it via KakaoTalk or email.",
    copy: "Copy text", copied: "Copied!", viaKakao: "Open KakaoTalk", viaMail: "Send by email",
    days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    recoFor: "Great for:", price: "Price", overview: "At a glance", status: "Verification status", confirmed: "Confirmed", chkConsent: "Shop confirmation", similar: "Similar shops", soon: "Coming soon", comingSoon: "Coming soon. We are lining up shops for this section.", unverified: "Info pending", unverifiedNote: "This shop's details are still being verified. Prices and hours will be confirmed on inquiry.", tbd: "To be confirmed", askNote: "Please contact us first to check availability.", askBtn: "Ask via KakaoTalk", menuBoard: "Price list", certBadge: "Uncle Certified", noRating: "No reviews yet", nearBtn: "📍 Nearest to me", nearPick: "Choose a place", nearOff: "Default order", nearFromMe: "Sorted by distance from you", nearFromPlace: "Sorted by distance from {p}", nearWait: "Finding your location…", nearFail: "Location is unavailable. Please choose a place instead.", nearApprox: "Distances are approximate", rvTitle: "Reviews", rvNone: "No reviews yet. If you have visited, be the first to leave one!", rvWrite: "Write a review", rvStars: "Rating", rvName: "Name (nickname)", rvVisit: "Month of visit", rvMenu: "Service used (optional)", rvText: "Your review", rvTextPh: "Tell us what you liked or what could be better", rvContact: "Contact (optional, not published)", rvSend: "Send review", rvNotice: "* Reviews are published after we check them.", rvDoneSent: "Thanks! Your review was sent and will appear after we check it.", rvDoneManual: "Please copy the text below and send it via KakaoTalk or email. We will publish it after checking.", rvNeedStar: "Please choose a rating.", rvShort: "Please write at least 10 characters.", rvAt: "Shop", rvCount: "{n} reviews", tapZoom: "Tap a price list to enlarge it.",
    approx: "≈", lang_ko: "Korean", lang_en: "English", lang_vi: "Vietnamese", lang_ja: "Japanese", lang_zh: "Chinese"
  },
  vi: {
    search: "Tìm massage, chăm sóc da, gọt mặt…", consult: "Liên hệ", all: "Tất cả",
    catTitle: "Bạn đang tìm dịch vụ gì?", recommend: "Gợi ý cho bạn", shopsOf: "Cơ sở {n}",
    steps: "Cách sử dụng", reviews: "Đánh giá", faq: "Câu hỏi thường gặp",
    partner: "Bạn là chủ cơ sở?", partnerDesc: "Hãy liên hệ để được đăng trên Uncle Day.", partnerBtn: "Đăng ký hợp tác",
    empty: "Chưa có cơ sở phù hợp.", notFound: "Không tìm thấy cơ sở.", back: "← Quay lại danh sách",
    about: "Giới thiệu", info: "Thông tin", address: "Địa chỉ", hours: "Giờ mở cửa", closedDays: "Ngày nghỉ", none: "Không có",
    staffLangs: "Ngôn ngữ hỗ trợ", map: "Xem bản đồ", menu: "Dịch vụ", consultPrice: "Báo giá khi tư vấn", min: "phút",
    book: "Yêu cầu đặt lịch", bookBtn: "Gửi yêu cầu", mgPick: "Chọn thời lượng để đặt", ex_fee: "Phụ phí", ex_tip: "Tiền tip KTV", pm_ppl: "từ {n} khách", m_all: "Tất cả", tot_title: "Tổng dự kiến", tot_disc: "Giảm giá", tot_sum: "Thanh toán tại tiệm (dự kiến)", tot_note: "Bạn thanh toán tại tiệm. Ưu đãi theo số người và giờ sẽ được tiệm xác nhận khi bạn đến.", m_other: "Khác", pm_time: "đặt lúc {a}–{b}", ex_total: "Thanh toán tại tiệm (dự kiến)", ex_noDisc: "không giảm giá", pick: "Chọn",
    fMenu: "Dịch vụ", fDate: "Ngày", fTime: "Giờ", fPeople: "Số người", fName: "Họ tên",
    fContact: "Liên hệ (Số điện thoại / KakaoTalk ID / Zalo / WhatsApp / Email)", fNote: "Yêu cầu thêm",
    closedAlert: "Cơ sở nghỉ vào ngày này. Vui lòng chọn ngày khác.",
    notice: "* Đây là yêu cầu đặt lịch. Chúng tôi sẽ xác nhận sau khi kiểm tra với cơ sở.",
    doneTitle: "Yêu cầu đã sẵn sàng", doneSent: "Đã gửi yêu cầu. Chúng tôi sẽ liên hệ khi lịch được xác nhận.",
    doneManual: "Vui lòng sao chép nội dung bên dưới và gửi qua KakaoTalk hoặc email.",
    copy: "Sao chép", copied: "Đã sao chép!", viaKakao: "Mở KakaoTalk", viaMail: "Gửi email",
    days: ["CN", "T2", "T3", "T4", "T5", "T6", "T7"],
    recoFor: "Phù hợp với:", price: "Giá", overview: "Tổng quan", status: "Tình trạng xác minh", confirmed: "Đã xác nhận", chkConsent: "Cơ sở xác nhận", similar: "Cơ sở tương tự", soon: "Sắp có", comingSoon: "Sắp ra mắt. Chúng tôi đang tìm các cơ sở cho mục này.", unverified: "Đang xác minh", unverifiedNote: "Thông tin cơ sở này đang được xác minh. Giá và giờ mở cửa sẽ được báo khi bạn liên hệ.", tbd: "Đang xác minh", askNote: "Vui lòng liên hệ trước để kiểm tra lịch trống.", askBtn: "Hỏi qua KakaoTalk", menuBoard: "Bảng giá", certBadge: "Uncle chứng nhận", noRating: "Chưa có đánh giá", nearBtn: "📍 Gần tôi nhất", nearPick: "Chọn địa điểm", nearOff: "Thứ tự mặc định", nearFromMe: "Sắp xếp theo khoảng cách từ bạn", nearFromPlace: "Sắp xếp theo khoảng cách từ {p}", nearWait: "Đang xác định vị trí…", nearFail: "Không dùng được vị trí. Vui lòng chọn một địa điểm.", nearApprox: "Khoảng cách chỉ mang tính ước lượng", rvTitle: "Đánh giá", rvNone: "Chưa có đánh giá. Nếu đã ghé, hãy là người đầu tiên đánh giá nhé!", rvWrite: "Viết đánh giá", rvStars: "Chấm điểm", rvName: "Tên (biệt danh)", rvVisit: "Tháng ghé thăm", rvMenu: "Dịch vụ đã dùng (không bắt buộc)", rvText: "Nội dung đánh giá", rvTextPh: "Hãy chia sẻ điều bạn thích hoặc điều cần cải thiện", rvContact: "Liên hệ (không bắt buộc, không công khai)", rvSend: "Gửi đánh giá", rvNotice: "* Đánh giá sẽ được đăng sau khi chúng tôi kiểm tra.", rvDoneSent: "Cảm ơn bạn! Đánh giá đã được gửi và sẽ hiển thị sau khi kiểm tra.", rvDoneManual: "Vui lòng sao chép nội dung bên dưới và gửi qua KakaoTalk hoặc email. Chúng tôi sẽ đăng sau khi kiểm tra.", rvNeedStar: "Vui lòng chọn số sao.", rvShort: "Vui lòng viết ít nhất 10 ký tự.", rvAt: "Cơ sở", rvCount: "{n} đánh giá", tapZoom: "Chạm vào bảng giá để phóng to.",
    approx: "≈", lang_ko: "Tiếng Hàn", lang_en: "Tiếng Anh", lang_vi: "Tiếng Việt", lang_ja: "Tiếng Nhật", lang_zh: "Tiếng Trung"
  }
};

/* 온라인 예약 · 예약확인증 문구 */
Object.assign(UI.ko, {
  bkSending: "보내는 중…", bkDoneTitle: "예약 요청이 접수됐어요",
  bkDoneDesc: "업체에 예약 가능 여부를 확인한 뒤 연락드릴게요. 예약확인증에서 진행 상황을 볼 수 있어요.",
  bkVoucher: "예약확인증 보기", bkKakao: "카카오톡으로 예약번호 보내기", bkKakaoCopied: "예약 내용이 복사됐어요. 카카오톡 채팅창에 붙여 넣어 주세요.",
  bkFail: "온라인 접수가 잠시 안 돼요. 아래 내용을 복사해서 카카오톡으로 보내 주세요.",
  vTitle: "예약확인증", vCode: "예약번호", vStatus: "진행 상황", vShop: "업체", vDate: "방문 일시", vMenu: "메뉴", vPeople: "인원",
  vPeopleN: "{n}명", vPrice: "예상 금액", vPriceNote: "결제는 업체에서 직접 해요. 엉클데이에 따로 내는 돈은 없어요.",
  vName: "예약자", vNote: "요청사항", vShow: "업체에 도착하면 이 화면을 보여 주세요.",
  st_requested: "업체에 확인 중이에요", st_confirmed: "예약이 확정됐어요", st_rejected: "이 시간은 예약이 어려워요. 다른 시간을 안내해 드릴게요",
  st_visited: "방문 완료", st_settled: "방문 완료", st_cancelled: "취소된 예약이에요", st_noshow: "방문하지 않은 예약이에요",
  vVisited: "✅ 다녀왔어요", vVisitedDone: "방문 확인 감사합니다!", vCancel: "예약 취소하기", vCancelAsk: "정말 예약을 취소할까요?", vYes: "네, 취소할게요", vNo: "아니요",
  vReview: "✍️ 후기 남기기", vReviewed: "후기를 보내 주셔서 감사해요. 확인 후 게시할게요.",
  vSave: "이 화면 주소를 저장해 두면 언제든 다시 볼 수 있어요.", vCopyLink: "링크 복사", vLinkCopied: "링크를 복사했어요",
  vNotFound: "예약을 찾을 수 없어요. 예약번호와 연락처로 다시 찾아 주세요.", vFind: "예약 조회", vFindDesc: "예약번호와 예약할 때 적은 연락처를 넣어 주세요.",
  vFindCode: "예약번호 (예: UD-1106-1234)", vFindContact: "연락처", vFindBtn: "찾기", vAsk: "카카오톡 문의", vMap: "지도 보기", vHome: "엉클데이 홈"
});
Object.assign(UI.en, {
  bkSending: "Sending…", bkDoneTitle: "Your booking request is in",
  bkDoneDesc: "We will check availability with the shop and get back to you. You can follow the progress on your booking voucher.",
  bkVoucher: "View booking voucher", bkKakao: "Send booking no. via KakaoTalk", bkKakaoCopied: "Booking details copied. Paste them into the KakaoTalk chat.",
  bkFail: "Online booking is temporarily unavailable. Please copy the text below and send it via KakaoTalk.",
  vTitle: "Booking voucher", vCode: "Booking no.", vStatus: "Status", vShop: "Shop", vDate: "Date & time", vMenu: "Service", vPeople: "Guests",
  vPeopleN: "{n}", vPrice: "Estimated price", vPriceNote: "You pay the shop directly. There is no extra fee to Uncle Day.",
  vName: "Name", vNote: "Requests", vShow: "Show this screen when you arrive at the shop.",
  st_requested: "Checking with the shop", st_confirmed: "Your booking is confirmed", st_rejected: "This time is not available. We will suggest another time",
  st_visited: "Visited", st_settled: "Visited", st_cancelled: "This booking was cancelled", st_noshow: "Marked as not visited",
  vVisited: "✅ I visited", vVisitedDone: "Thanks for confirming your visit!", vCancel: "Cancel booking", vCancelAsk: "Cancel this booking?", vYes: "Yes, cancel", vNo: "No",
  vReview: "✍️ Write a review", vReviewed: "Thanks for your review. It will appear after we check it.",
  vSave: "Save this page's address to come back any time.", vCopyLink: "Copy link", vLinkCopied: "Link copied",
  vNotFound: "Booking not found. Please search with your booking number and contact.", vFind: "Find my booking", vFindDesc: "Enter your booking number and the contact you used.",
  vFindCode: "Booking no. (e.g. UD-1106-1234)", vFindContact: "Contact", vFindBtn: "Find", vAsk: "Ask on KakaoTalk", vMap: "Map", vHome: "Uncle Day home"
});
Object.assign(UI.vi, {
  bkSending: "Đang gửi…", bkDoneTitle: "Đã nhận yêu cầu đặt lịch",
  bkDoneDesc: "Chúng tôi sẽ kiểm tra lịch với cơ sở và liên hệ lại. Bạn có thể theo dõi trên phiếu đặt lịch.",
  bkVoucher: "Xem phiếu đặt lịch", bkKakao: "Gửi mã đặt lịch qua KakaoTalk", bkKakaoCopied: "Đã sao chép nội dung. Hãy dán vào khung chat KakaoTalk.",
  bkFail: "Đặt lịch trực tuyến tạm thời không khả dụng. Vui lòng sao chép nội dung bên dưới và gửi qua KakaoTalk.",
  vTitle: "Phiếu đặt lịch", vCode: "Mã đặt lịch", vStatus: "Trạng thái", vShop: "Cơ sở", vDate: "Ngày giờ", vMenu: "Dịch vụ", vPeople: "Số người",
  vPeopleN: "{n} người", vPrice: "Giá dự kiến", vPriceNote: "Bạn thanh toán trực tiếp tại cơ sở. Không mất thêm phí cho Uncle Day.",
  vName: "Người đặt", vNote: "Yêu cầu", vShow: "Hãy đưa màn hình này cho cơ sở khi bạn đến.",
  st_requested: "Đang kiểm tra với cơ sở", st_confirmed: "Đã xác nhận lịch hẹn", st_rejected: "Khung giờ này không khả dụng. Chúng tôi sẽ đề xuất giờ khác",
  st_visited: "Đã ghé", st_settled: "Đã ghé", st_cancelled: "Lịch hẹn đã hủy", st_noshow: "Không đến",
  vVisited: "✅ Tôi đã ghé", vVisitedDone: "Cảm ơn bạn đã xác nhận!", vCancel: "Hủy lịch hẹn", vCancelAsk: "Bạn muốn hủy lịch hẹn này?", vYes: "Hủy", vNo: "Không",
  vReview: "✍️ Viết đánh giá", vReviewed: "Cảm ơn bạn! Đánh giá sẽ hiển thị sau khi kiểm tra.",
  vSave: "Lưu địa chỉ trang này để xem lại bất cứ lúc nào.", vCopyLink: "Sao chép liên kết", vLinkCopied: "Đã sao chép liên kết",
  vNotFound: "Không tìm thấy lịch hẹn. Hãy tìm bằng mã đặt lịch và thông tin liên hệ.", vFind: "Tra cứu lịch hẹn", vFindDesc: "Nhập mã đặt lịch và thông tin liên hệ bạn đã dùng.",
  vFindCode: "Mã đặt lịch (vd: UD-1106-1234)", vFindContact: "Liên hệ", vFindBtn: "Tìm", vAsk: "Hỏi qua KakaoTalk", vMap: "Bản đồ", vHome: "Trang chủ Uncle Day"
});

/* 업체 페이지에서 상담하기를 누르면 복사되는 문의 문구 */
Object.assign(UI.ko, { askCopied: "문의 문구가 복사됐어요. 카톡 채팅창에 붙여넣기 해 주세요 🙂", askCopyHint: "누르면 이 업체 문의 문구가 자동으로 복사돼요",
  askMsg: "[엉클데이 문의] {shop}\n({city} · {cat})\n\n날짜·시간: \n인원: \n원하는 메뉴: " });
Object.assign(UI.en, { askCopied: "Inquiry text copied. Please paste it into the KakaoTalk chat 🙂", askCopyHint: "Tapping copies an inquiry about this shop",
  askMsg: "[Uncle Day inquiry] {shop}\n({city} · {cat})\n\nDate & time: \nGuests: \nService: " });
Object.assign(UI.vi, { askCopied: "Đã sao chép nội dung hỏi. Hãy dán vào khung chat KakaoTalk 🙂", askCopyHint: "Bấm để tự động sao chép nội dung hỏi về cơ sở này",
  askMsg: "[Hỏi qua Uncle Day] {shop}\n({city} · {cat})\n\nNgày giờ: \nSố người: \nDịch vụ: " });

Object.assign(UI.ko, { askTitle: "카카오톡으로 문의하기", askStep: "아래 문의 문구를 복사했어요. 카톡이 열리면 채팅창에 <b>붙여넣기</b>만 하세요. (날짜·인원을 채워 주시면 더 빨라요)",
  askCopyBtn: "다시 복사", askOpen: "카카오톡 열기 →", askCopiedShort: "복사됐어요. 카톡 채팅창에 붙여넣기 해 주세요.", askCopyFail: "자동 복사가 안 됐어요. 위 글을 길게 눌러 복사해 주세요." });
Object.assign(UI.en, { askTitle: "Ask on KakaoTalk", askStep: "We copied the inquiry below. When KakaoTalk opens, just <b>paste</b> it into the chat. (Adding date and guests helps us reply faster)",
  askCopyBtn: "Copy again", askOpen: "Open KakaoTalk →", askCopiedShort: "Copied. Paste it into the KakaoTalk chat.", askCopyFail: "Couldn't copy automatically. Press and hold the text above to copy it." });
Object.assign(UI.vi, { askTitle: "Hỏi qua KakaoTalk", askStep: "Chúng tôi đã sao chép nội dung bên dưới. Khi KakaoTalk mở, chỉ cần <b>dán</b> vào khung chat. (Điền ngày và số người để được trả lời nhanh hơn)",
  askCopyBtn: "Sao chép lại", askOpen: "Mở KakaoTalk →", askCopiedShort: "Đã sao chép. Hãy dán vào khung chat KakaoTalk.", askCopyFail: "Không tự sao chép được. Hãy nhấn giữ đoạn chữ phía trên để sao chép." });

/* 구글 지도 정보 */
Object.assign(UI.ko, { gTitle: "구글 지도 정보", gNote: "Google 제공", gHours: "영업시간 보기 (구글)", gMore: "구글 지도에서 사진·후기 더 보기", gRev: "⭐ 구글 지도에서 평점·후기 보기" });
Object.assign(UI.en, { gTitle: "On Google Maps", gNote: "Provided by Google", gHours: "Opening hours (Google)", gMore: "More photos & reviews on Google Maps", gRev: "⭐ See rating & reviews on Google Maps" });
Object.assign(UI.vi, { gTitle: "Thông tin Google Maps", gNote: "Do Google cung cấp", gHours: "Giờ mở cửa (Google)", gMore: "Xem thêm ảnh & đánh giá trên Google Maps", gRev: "⭐ Xem điểm & đánh giá trên Google Maps" });
Object.assign(UI.ko, { gToday: "오늘", gHoursNote: "구글 지도 기준 · 아래에서 요일별 시간 보기" });
Object.assign(UI.en, { gToday: "Today", gHoursNote: "From Google Maps · see all days below" });
Object.assign(UI.vi, { gToday: "Hôm nay", gHoursNote: "Theo Google Maps · xem các ngày bên dưới" });
Object.assign(UI.ko, { gAddrNote: "구글 지도 기준" }); Object.assign(UI.en, { gAddrNote: "From Google Maps" }); Object.assign(UI.vi, { gAddrNote: "Theo Google Maps" });
Object.assign(UI.ko, { phNote: "매장 사진 준비 중 · 카테고리 대표 이미지" }); Object.assign(UI.en, { phNote: "Shop photos coming soon · Category image" }); Object.assign(UI.vi, { phNote: "Ảnh cửa hàng sắp có · Ảnh minh họa danh mục" });
Object.assign(UI.ko, { shareBtn: "공유하기", shareCopied: "링크를 복사했어요. 카톡에 붙여넣어 보내세요" }); Object.assign(UI.en, { shareBtn: "Share", shareCopied: "Link copied" }); Object.assign(UI.vi, { shareBtn: "Chia sẻ", shareCopied: "Đã sao chép liên kết" });
Object.assign(UI.ko, { rideBtn: "그랩으로 가기", rideTitle: "그랩으로 이 업체 가기", rideTo: "목적지", rideStep: "‘그랩 열기’를 누르면 목적지가 채워진 채로 그랩이 열려요. 출발지·요금을 확인하고 그랩에서 호출하세요. 목적지가 비어 있으면 주소가 복사돼 있으니 붙여넣으세요.", ridePc: "휴대폰에서 이 페이지를 열면 그랩 앱이 목적지가 채워진 채로 열려요. PC에서는 주소를 복사해 쓰세요.", rideCopy: "주소 복사", rideGrab: "그랩 열기", rideCopied: "주소를 복사했어요", rideEtc: "Xanh SM·be 같은 다른 앱은 주소를 복사해서 목적지에 붙여넣으세요. 요금은 각 앱에서 바로 결제해요." });
Object.assign(UI.en, { rideBtn: "Ride with Grab", rideTitle: "Get there with Grab", rideTo: "Destination", rideStep: "Tap ‘Open Grab’ to open Grab with this destination filled in. Check pickup and fare, then book in Grab. If the destination is empty, the address is already copied — just paste it.", ridePc: "Open this page on your phone to launch Grab with the destination filled in. On a computer, copy the address.", rideCopy: "Copy address", rideGrab: "Open Grab", rideCopied: "Address copied", rideEtc: "For other apps like Xanh SM or be, copy the address and paste it as the destination. You pay in each app." });
Object.assign(UI.vi, { rideBtn: "Đi bằng Grab", rideTitle: "Đến cửa hàng bằng Grab", rideTo: "Điểm đến", rideStep: "Nhấn ‘Mở Grab’ để mở Grab với điểm đến đã điền sẵn. Kiểm tra điểm đón và giá rồi đặt xe trong Grab. Nếu điểm đến trống, địa chỉ đã được sao chép — chỉ cần dán.", ridePc: "Mở trang này trên điện thoại để mở Grab với điểm đến điền sẵn. Trên máy tính, hãy sao chép địa chỉ.", rideCopy: "Sao chép địa chỉ", rideGrab: "Mở Grab", rideCopied: "Đã sao chép địa chỉ", rideEtc: "Với ứng dụng khác như Xanh SM hoặc be, hãy sao chép địa chỉ và dán vào điểm đến. Thanh toán trong từng ứng dụng." });
Object.assign(UI.ko, { fCoupon: "쿠폰 코드 (있으면)", fMarketing: "(선택) 엉클데이 쿠폰·이벤트 소식을 카카오톡·문자로 받을게요. 언제든 '그만'이라고 하면 멈춰요." });
Object.assign(UI.en, { fCoupon: "Coupon code (optional)", fMarketing: "(Optional) Send me Uncle Day coupons and offers by message. Reply 'STOP' anytime." });
Object.assign(UI.vi, { fCoupon: "Mã ưu đãi (nếu có)", fMarketing: "(Không bắt buộc) Gửi cho tôi ưu đãi và sự kiện của Uncle Day qua tin nhắn. Trả lời 'DỪNG' bất cứ lúc nào." });

/* 네이버 예약식 날짜·시간 고르기 + 시간 변경 안내 */
Object.assign(UI.ko, { pickDT: "날짜와 시간을 선택해 주세요", pickTime: "시간을 선택해 주세요", pickDateFirst: "먼저 날짜를 골라 주세요", pickDTFirst: "날짜와 시간을 먼저 골라 주세요",
  am: "오전", pm: "오후", closedDay: "휴무", noSlot: "이 메뉴는 예약 가능한 시간이 없어요. 카톡으로 문의해 주세요.",
  bkDoneDesc: "업체에 예약 가능 여부를 바로 확인하고, 신속하게 예약 확정 안내드릴게요. 예약확인증에서 진행 상황을 볼 수 있어요.",
  st_shop_ok: "업체 확인 완료 · 곧 확정 안내드려요", st_reschedule: "업체 사정으로 시간 변경이 필요해요",
  vResTitle: "다른 시간으로 바꿔 주실 수 있을까요?", vResDesc: "요청하신 시간은 업체 사정으로 어려워요. 아래 시간 중 괜찮은 시간을 골라 주시면 업체에 다시 확인해 확정 안내드릴게요.",
  vResPick: "이 시간으로 변경", vResAsk: "이 시간으로 바꿔서 다시 요청할까요?", vResDone: "변경 요청했어요. 업체 확인 후 신속하게 확정 안내드릴게요.", vResNone: "맞는 시간이 없으면 카톡으로 편한 시간을 알려 주세요.", vChanged: "시간 변경 {n}회" });
Object.assign(UI.en, { pickDT: "Select a date and time", pickTime: "Select a time", pickDateFirst: "Pick a date first", pickDTFirst: "Please pick a date and time first",
  am: "Morning", pm: "Afternoon", closedDay: "Closed", noSlot: "No time slots for this service. Please ask us on KakaoTalk.",
  bkDoneDesc: "We are checking availability with the shop right now and will confirm your booking shortly. You can follow the progress on your booking voucher.",
  st_shop_ok: "Shop checked · confirming shortly", st_reschedule: "The shop needs a different time",
  vResTitle: "Could you pick a different time?", vResDesc: "The shop can't take the time you asked for. Pick one of the times below and we'll check with the shop again and confirm.",
  vResPick: "Change to this time", vResAsk: "Request this time instead?", vResDone: "Change requested. We'll confirm with the shop shortly.", vResNone: "If none of these work, tell us a good time on KakaoTalk.", vChanged: "Time changed {n}×" });
Object.assign(UI.vi, { pickDT: "Chọn ngày và giờ", pickTime: "Chọn giờ", pickDateFirst: "Hãy chọn ngày trước", pickDTFirst: "Vui lòng chọn ngày và giờ trước",
  am: "Buổi sáng", pm: "Buổi chiều", closedDay: "Nghỉ", noSlot: "Dịch vụ này chưa có khung giờ. Vui lòng hỏi qua KakaoTalk.",
  bkDoneDesc: "Chúng tôi đang kiểm tra lịch với cơ sở và sẽ sớm xác nhận lịch hẹn. Bạn có thể theo dõi trên phiếu đặt lịch.",
  st_shop_ok: "Cơ sở đã kiểm tra · sắp xác nhận", st_reschedule: "Cơ sở cần đổi giờ khác",
  vResTitle: "Bạn có thể chọn giờ khác không?", vResDesc: "Cơ sở không nhận được giờ bạn chọn. Hãy chọn một giờ bên dưới, chúng tôi sẽ kiểm tra lại và xác nhận.",
  vResPick: "Đổi sang giờ này", vResAsk: "Gửi yêu cầu đổi sang giờ này?", vResDone: "Đã gửi yêu cầu đổi giờ. Chúng tôi sẽ sớm xác nhận.", vResNone: "Nếu không có giờ phù hợp, hãy nhắn giờ bạn muốn qua KakaoTalk.", vChanged: "Đã đổi giờ {n} lần" });

/* 도착 체크인 · 별점 한 번 */
Object.assign(UI.ko, { ciTitle: "매장에 도착하셨나요?", ciDesc: "직원에게 이 화면을 보여 주고 체크인을 눌러 주세요. 엉클데이 예약으로 오신 게 기록돼서, 혹시 문제가 생기면 저희가 바로 도와드릴 수 있어요.", ciBtn: "📍 도착했어요 · 체크인", ciDone: "체크인했어요. 즐거운 시간 보내세요!",
  rateTitle: "오늘 어떠셨어요?", rateHint: "별을 눌러 주세요. 한 번만 눌러도 다음 손님들께 큰 도움이 돼요.", rateThanks: "고마워요! 한 줄만 더 남겨 주시면 후기로 올라가요." });
Object.assign(UI.en, { ciTitle: "Have you arrived at the shop?", ciDesc: "Show this screen to the staff and tap check-in. It records that you came through Uncle Day, so we can help right away if anything goes wrong.", ciBtn: "📍 I'm here · Check in", ciDone: "You're checked in. Enjoy!",
  rateTitle: "How was it today?", rateHint: "Tap a star. Even one tap really helps the next guests.", rateThanks: "Thank you! Add a line and it becomes a review." });
Object.assign(UI.vi, { ciTitle: "Bạn đã đến cơ sở chưa?", ciDesc: "Đưa màn hình này cho nhân viên và bấm check-in. Việc này ghi nhận bạn đặt qua Uncle Day để chúng tôi hỗ trợ ngay nếu có vấn đề.", ciBtn: "📍 Tôi đã đến · Check-in", ciDone: "Đã check-in. Chúc bạn thư giãn!",
  rateTitle: "Hôm nay thế nào?", rateHint: "Hãy bấm sao. Chỉ một lần bấm cũng giúp ích cho khách sau.", rateThanks: "Cảm ơn bạn! Viết thêm một dòng để thành đánh giá." });

/* 예약 완료 2단계: 카톡으로 확정 받기 */
Object.assign(UI.ko, { bkStep1: "예약 요청 완료 (1/2)", kStepTitle: "마지막 단계 · 카톡으로 확정 받기", kStepDesc: "예약 확정·시간 변경 소식을 카카오톡으로 보내 드려요. 버튼을 누르면 예약번호가 복사되고 엉클데이 채팅이 열려요. 붙여넣고 보내기만 하면 끝이에요.",
  kStepBtn: "카톡으로 확정 받기", kStepNote: "카톡을 안 쓰시면 남겨 주신 번호로 문자를 보내 드려요.", kMsgHead: "예약확인", kAllDone: "예약 요청이 끝났어요", kStepDone: "이제 기다리시면 돼요", kStepDoneDesc: "업체 확인 후 카톡으로 확정 소식을 보내 드릴게요.", kStepAgain: "카톡에 아직 못 보냈다면 · 채팅 다시 열기" });
Object.assign(UI.en, { bkStep1: "Booking request sent (1/2)", kStepTitle: "Last step · Get your confirmation on KakaoTalk", kStepDesc: "We send confirmations and time changes on KakaoTalk. Tap the button: your booking number is copied and our chat opens. Just paste and send.",
  kStepBtn: "Get confirmation on KakaoTalk", kStepNote: "No KakaoTalk? We'll text the number you gave us.", kMsgHead: "Booking", kAllDone: "Your booking request is done", kStepDone: "All set — just wait for us", kStepDoneDesc: "Once the shop confirms, we'll send the confirmation on KakaoTalk.", kStepAgain: "Haven't sent it on KakaoTalk yet? · Open chat again" });
Object.assign(UI.vi, { bkStep1: "Đã gửi yêu cầu đặt lịch (1/2)", kStepTitle: "Bước cuối · Nhận xác nhận qua KakaoTalk", kStepDesc: "Chúng tôi gửi xác nhận và thay đổi giờ qua KakaoTalk. Bấm nút: mã đặt lịch được sao chép và khung chat mở ra. Chỉ cần dán và gửi.",
  kStepBtn: "Nhận xác nhận qua KakaoTalk", kStepNote: "Không dùng KakaoTalk? Chúng tôi sẽ nhắn tin SMS đến số bạn để lại.", kMsgHead: "Đặt lịch", kAllDone: "Đã gửi yêu cầu đặt lịch", kStepDone: "Xong rồi, bạn chỉ cần chờ", kStepDoneDesc: "Khi cơ sở xác nhận, chúng tôi sẽ gửi thông báo qua KakaoTalk.", kStepAgain: "Chưa gửi qua KakaoTalk? · Mở lại chat" });

Object.assign(UI.ko, { vChat: "엉클데이에 채팅으로 문의" }); Object.assign(UI.en, { vChat: "Chat with Uncle Day" }); Object.assign(UI.vi, { vChat: "Nhắn tin với Uncle Day" });

Object.assign(UI.ko, { chLive: "진행 상황은 채팅으로 바로 알려 드려요", chLiveDesc: "업체 확인, 예약 확정, 시간 변경 안내가 오른쪽 아래 💬 채팅창에 실시간으로 남아요. 궁금한 점도 거기서 바로 물어보세요.", chOpen: "채팅창 열기" });
Object.assign(UI.en, { chLive: "We'll update you in the chat", chLiveDesc: "Shop check, confirmation and any time changes show up live in the 💬 chat at the bottom right. Ask us anything there too.", chOpen: "Open chat" });
Object.assign(UI.vi, { chLive: "Chúng tôi sẽ cập nhật trong khung chat", chLiveDesc: "Việc kiểm tra, xác nhận và thay đổi giờ sẽ hiện ngay trong khung chat 💬 ở góc dưới bên phải. Có câu hỏi cũng nhắn tại đó.", chOpen: "Mở chat" });

Object.assign(UI.ko, { ctaBook: "날짜 골라 예약하기", ctaAsk: "상담", ctaAskFull: "엉클데이에 상담하기" });
Object.assign(UI.en, { ctaBook: "Pick a date & book", ctaAsk: "Ask", ctaAskFull: "Chat with Uncle Day" });
Object.assign(UI.vi, { ctaBook: "Chọn ngày & đặt lịch", ctaAsk: "Hỏi", ctaAskFull: "Chat với Uncle Day" });

/* 담당 테라피스트 · 테라피스트 후기 */
Object.assign(UI.ko, { vTp: "담당 테라피스트", vTpNow: "지금 시술 중", tpRvTitle: "담당 테라피스트에게 한마디 (선택)", tpRvWho: "누가 해 주셨나요? (여러 명 고를 수 있어요)",
  tpRvNote: "칭찬 한마디", tpRvPh: "예: 압이 딱 좋았어요", tpRvSend: "테라피스트 후기 보내기", tpRvDone: "테라피스트에게 후기가 전달됐어요. 고마워요!",
  tpRvBoxTitle: "담당 테라피스트도 칭찬해 주세요", tpRvBoxDesc: "고른 테라피스트에게 후기가 전달돼요. 확인된 후기 한 건마다 엉클데이가 테라피스트에게 작은 보너스를 드려요.",
  tpRvNeed: "테라피스트를 골라 주세요.", tpQrFind: "테라피스트 후기를 쓰려면 먼저 내 예약을 찾아 주세요. 예약을 열면 테라피스트를 고를 수 있어요.", tpRvSent: "후기를 남긴 테라피스트" });
Object.assign(UI.en, { vTp: "Your therapist", vTpNow: "in session now", tpRvTitle: "A word for your therapist (optional)", tpRvWho: "Who took care of you? (you can pick more than one)",
  tpRvNote: "A kind word", tpRvPh: "e.g. The pressure was just right", tpRvSend: "Send to therapist", tpRvDone: "Your review reached the therapist. Thank you!",
  tpRvBoxTitle: "Say thanks to your therapist", tpRvBoxDesc: "Your review goes to the therapist you pick. For each verified review, Uncle Day gives the therapist a small bonus.",
  tpRvNeed: "Please pick a therapist.", tpQrFind: "To review your therapist, first find your booking. You can pick the therapist there.", tpRvSent: "Therapists you reviewed" });
Object.assign(UI.vi, { vTp: "Kỹ thuật viên phụ trách", vTpNow: "đang làm", tpRvTitle: "Gửi lời cho kỹ thuật viên (không bắt buộc)", tpRvWho: "Ai đã phục vụ bạn? (có thể chọn nhiều người)",
  tpRvNote: "Một lời khen", tpRvPh: "VD: Lực tay rất vừa", tpRvSend: "Gửi cho kỹ thuật viên", tpRvDone: "Đánh giá đã đến kỹ thuật viên. Cảm ơn bạn!",
  tpRvBoxTitle: "Hãy khen kỹ thuật viên của bạn", tpRvBoxDesc: "Đánh giá sẽ đến kỹ thuật viên bạn chọn. Mỗi đánh giá được xác nhận, Uncle Day tặng kỹ thuật viên một khoản thưởng nhỏ.",
  tpRvNeed: "Hãy chọn kỹ thuật viên.", tpQrFind: "Để đánh giá kỹ thuật viên, hãy tìm lịch hẹn của bạn trước. Mở lịch hẹn là chọn được kỹ thuật viên.", tpRvSent: "Kỹ thuật viên đã được bạn đánh giá" });

/* 예약 조회 입구 */
Object.assign(UI.ko, { vAlready: "이미 예약하셨나요?", vFindFoot: "로그인 없이 예약번호와 연락처로 내 예약을 볼 수 있어요.", vTooMany: "여러 번 틀려서 잠시 막혔어요. 15분 뒤에 다시 해 주세요." });
Object.assign(UI.en, { vAlready: "Already booked?", vFindFoot: "See your booking without logging in — just your booking number and contact.", vTooMany: "Too many tries. Please try again in 15 minutes." });
Object.assign(UI.vi, { vAlready: "Bạn đã đặt lịch rồi?", vFindFoot: "Xem lịch hẹn không cần đăng nhập — chỉ cần mã đặt lịch và thông tin liên hệ.", vTooMany: "Bạn nhập sai nhiều lần. Hãy thử lại sau 15 phút." });

/* 채팅 · 로그인 · 결제 확인 페이백 · 기타 문구 (예전엔 각 파일에 있던 것을 여기로 모았어요 — 다국어 번역이 한 번에 되게) */
Object.assign(UI.ko, {"pb_title":"💰 결제 금액 알려 주고 {p}% 포인트 받기", "pb_desc":"가게에서 실제로 받은 시술과 결제한 금액을 알려 주세요. 결제 금액의 {p}%를 엉클데이 포인트로 쌓아 드려요 (1P = 1동).", "pb_why":"상담 후 메뉴를 바꾸거나 추가했어도 그대로 적어 주세요. 엉클데이가 가게와 정확히 정산하는 데 쓰여요.", "pb_login":"로그인하고 포인트 받기", "pb_loginHint":"포인트는 계정에 쌓여요. 카카오 · 구글로 10초면 돼요.", "pb_amt":"결제한 금액 (동)", "pb_amtPh":"예: 1,500,000", "pb_items":"받은 시술", "pb_itemsPh":"예: 아쿠아필 + 재생관리 업그레이드", "pb_rc":"영수증 사진 (선택)", "pb_rcHint":"영수증이 있으면 더 빨리 확정돼요", "pb_est":"예상 포인트", "pb_send":"알려 주기", "pb_edit":"고치기", "pb_sending":"보내는 중…", "pb_done":"알려 주셔서 고마워요 🙏", "pb_st_wait":"⏳ 가게가 결제 금액을 적으면 확인해서 바로 쌓아 드려요", "pb_st_review":"🔎 엉클데이가 가게와 금액을 확인하고 있어요", "pb_st_ok":"✅ 포인트가 쌓였어요", "pb_st_no":"확인이 어려워 포인트를 드리지 못했어요", "pb_you":"알려 준 금액", "pb_total":"내 포인트", "pb_waiting":"확인 중 {n}건", "pb_other":"이 예약은 다른 계정으로 이미 알려 주셨어요.", "pb_soon":"포인트 쓰는 방법은 곧 안내해 드릴게요.", "pb_rcSaved":"영수증 있음", "pb_needAmt":"결제 금액을 적어 주세요", "pb_upFail":"영수증을 올리지 못했어요. 금액만 먼저 보낼게요.", "cb_title":"엉클데이 상담", "cb_sub":"보통 몇 분 안에 답해 드려요 (한국 시간 기준)", "cb_hello":"안녕하세요! 엉클데이예요 😊\n예약, 메뉴, 가격, 위치 등 궁금한 걸 편하게 물어보세요.", "cb_ph":"메시지를 입력하세요", "cb_send":"보내기", "cb_name":"이름 (선택)", "cb_contact":"답장 알림 받을 휴대폰·카톡 ID (선택)", "cb_keep":"이 창을 닫아도 대화는 남아요. 다시 💬를 누르면 이어서 볼 수 있어요.", "cb_login":"로그인하면 다른 기기에서도 이어져요", "cb_kakao":"카톡으로 상담", "cb_me":"나", "cb_us":"엉클데이", "cb_err":"보내지 못했어요. 잠시 뒤 다시 해 주세요.", "cb_bk":"예약 {c} 문의", "ac_login":"로그인", "ac_title":"엉클데이 시작하기", "ac_desc":"로그인하면 예약 내역과 상담 대화를 어느 기기에서나 이어서 볼 수 있어요.", "ac_skip":"로그인 없이도 예약할 수 있어요.", "ac_my":"내 예약", "ac_out":"로그아웃", "ac_none":"아직 예약이 없어요.", "ac_hi":"{n}님", "ac_vo":"예약확인증", "ac_fail":"로그인을 시작하지 못했어요. 잠시 뒤 다시 해 주세요.", "ac_terms":"로그인하면 예약·상담 관리를 위해 이름과 이메일(제공하는 경우)을 저장해요.", "ac_close":"닫기", "cb_voucher":"📄 예약확인증 열기", "cb_link":"🔗 열기", "cb_shopQ":"[{shop}] 문의드려요\n", "ac_pts":"💰 내 포인트", "ac_ptsWait":"확인 중", "privacy":"개인정보처리방침", "guideSub":"가격 · 팁 · 고르는 법 · 공항 가기 전 꿀팁", "guide_danang":"다낭 마사지 가이드", "guide_nhatrang":"나트랑 마사지 가이드", "guide_hcm":"호치민 마사지 가이드", "guide_hanoi":"하노이 마사지 가이드", "langPick":"언어"});
Object.assign(UI.en, {"pb_title":"💰 Tell us what you paid — get {p}% back in points", "pb_desc":"Tell us the treatments you actually received and the amount you paid. We'll add {p}% of it as Uncle Day points (1P = 1 VND).", "pb_why":"If you changed or added treatments after the consultation, please include them. It helps us settle accurately with the shop.", "pb_login":"Log in to get points", "pb_loginHint":"Points are saved to your account. Takes 10 seconds with Kakao or Google.", "pb_amt":"Amount paid (VND)", "pb_amtPh":"e.g. 1,500,000", "pb_items":"Treatments received", "pb_itemsPh":"e.g. Aqua peel + recovery upgrade", "pb_rc":"Receipt photo (optional)", "pb_rcHint":"A receipt helps us confirm faster", "pb_est":"Estimated points", "pb_send":"Send", "pb_edit":"Edit", "pb_sending":"Sending…", "pb_done":"Thank you for letting us know 🙏", "pb_st_wait":"⏳ We'll confirm as soon as the shop records the amount", "pb_st_review":"🔎 We're checking the amount with the shop", "pb_st_ok":"✅ Points added", "pb_st_no":"We couldn't confirm this one", "pb_you":"Amount you reported", "pb_total":"My points", "pb_waiting":"{n} being checked", "pb_other":"This booking was already reported from another account.", "pb_soon":"We'll let you know soon how to use your points.", "pb_rcSaved":"Receipt attached", "pb_needAmt":"Please enter the amount you paid", "pb_upFail":"Couldn't upload the receipt. Sending the amount first.", "cb_title":"Uncle Day chat", "cb_sub":"We usually reply within minutes (Korea time)", "cb_hello":"Hi! This is Uncle Day 😊\nAsk us anything about bookings, menus, prices or locations.", "cb_ph":"Type a message", "cb_send":"Send", "cb_name":"Name (optional)", "cb_contact":"Phone / KakaoTalk ID for reply alerts (optional)", "cb_keep":"Your chat stays here even if you close this window. Tap 💬 again to continue.", "cb_login":"Log in to continue on other devices", "cb_kakao":"Chat on KakaoTalk", "cb_me":"Me", "cb_us":"Uncle Day", "cb_err":"Couldn't send. Please try again shortly.", "cb_bk":"About booking {c}", "ac_login":"Log in", "ac_title":"Start with Uncle Day", "ac_desc":"Log in to see your bookings and chats on any device.", "ac_skip":"You can book without logging in.", "ac_my":"My bookings", "ac_out":"Log out", "ac_none":"No bookings yet.", "ac_hi":"{n}", "ac_vo":"Voucher", "ac_fail":"Couldn't start login. Please try again later.", "ac_terms":"We store your name and email (if provided) to manage your bookings and chats.", "ac_close":"Close", "cb_voucher":"📄 Open voucher", "cb_link":"🔗 Open", "cb_shopQ":"Question about {shop}\n", "ac_pts":"💰 My points", "ac_ptsWait":"being checked", "privacy":"Privacy Policy", "guideSub":"prices, tipping, how to choose", "guide_danang":"Da Nang massage guide", "guide_nhatrang":"Nha Trang massage guide", "guide_hcm":"Ho Chi Minh massage guide", "guide_hanoi":"Hanoi massage guide", "langPick":"Language"});
Object.assign(UI.vi, {"pb_title":"💰 Báo số tiền đã trả — nhận lại {p}% điểm", "pb_desc":"Hãy cho chúng tôi biết dịch vụ bạn đã làm và số tiền đã trả. Uncle Day tặng {p}% số tiền đó thành điểm (1P = 1 đồng).", "pb_why":"Nếu bạn đổi hoặc thêm dịch vụ sau khi tư vấn, hãy ghi đầy đủ. Thông tin này giúp Uncle Day đối soát chính xác với cửa hàng.", "pb_login":"Đăng nhập để nhận điểm", "pb_loginHint":"Điểm được lưu vào tài khoản. Chỉ 10 giây với Kakao hoặc Google.", "pb_amt":"Số tiền đã trả (đồng)", "pb_amtPh":"VD: 1.500.000", "pb_items":"Dịch vụ đã làm", "pb_itemsPh":"VD: Aqua peel + nâng cấp phục hồi", "pb_rc":"Ảnh hóa đơn (không bắt buộc)", "pb_rcHint":"Có hóa đơn sẽ được xác nhận nhanh hơn", "pb_est":"Điểm dự kiến", "pb_send":"Gửi", "pb_edit":"Sửa", "pb_sending":"Đang gửi…", "pb_done":"Cảm ơn bạn đã cho biết 🙏", "pb_st_wait":"⏳ Khi cửa hàng nhập số tiền, chúng tôi sẽ xác nhận ngay", "pb_st_review":"🔎 Uncle Day đang kiểm tra số tiền với cửa hàng", "pb_st_ok":"✅ Đã cộng điểm", "pb_st_no":"Chưa thể xác nhận nên không cộng điểm", "pb_you":"Số tiền bạn báo", "pb_total":"Điểm của tôi", "pb_waiting":"{n} đang kiểm tra", "pb_other":"Lịch hẹn này đã được báo từ tài khoản khác.", "pb_soon":"Cách dùng điểm sẽ được thông báo sớm.", "pb_rcSaved":"Đã có hóa đơn", "pb_needAmt":"Hãy nhập số tiền đã trả", "pb_upFail":"Không tải được hóa đơn. Gửi số tiền trước.", "cb_title":"Uncle Day hỗ trợ", "cb_sub":"Thường trả lời trong vài phút (giờ Hàn Quốc)", "cb_hello":"Xin chào! Đây là Uncle Day 😊\nHãy hỏi bất cứ điều gì về đặt lịch, dịch vụ, giá hoặc địa điểm.", "cb_ph":"Nhập tin nhắn", "cb_send":"Gửi", "cb_name":"Tên (không bắt buộc)", "cb_contact":"SĐT / Zalo / KakaoTalk để nhận thông báo (không bắt buộc)", "cb_keep":"Cuộc trò chuyện vẫn được lưu khi bạn đóng cửa sổ. Bấm 💬 để tiếp tục.", "cb_login":"Đăng nhập để tiếp tục trên thiết bị khác", "cb_kakao":"Chat KakaoTalk", "cb_me":"Tôi", "cb_us":"Uncle Day", "cb_err":"Không gửi được. Vui lòng thử lại.", "cb_bk":"Hỏi về lịch {c}", "ac_login":"Đăng nhập", "ac_title":"Bắt đầu với Uncle Day", "ac_desc":"Đăng nhập để xem lịch hẹn và trò chuyện trên mọi thiết bị.", "ac_skip":"Bạn vẫn có thể đặt lịch mà không cần đăng nhập.", "ac_my":"Lịch hẹn của tôi", "ac_out":"Đăng xuất", "ac_none":"Chưa có lịch hẹn.", "ac_hi":"{n}", "ac_vo":"Phiếu đặt lịch", "ac_fail":"Không thể đăng nhập. Vui lòng thử lại sau.", "ac_terms":"Chúng tôi lưu tên và email (nếu có) để quản lý lịch hẹn và trò chuyện.", "ac_close":"Đóng", "cb_voucher":"📄 Mở phiếu đặt lịch", "cb_link":"🔗 Mở", "cb_shopQ":"Hỏi về {shop}\n", "ac_pts":"💰 Điểm của tôi", "ac_ptsWait":"đang kiểm tra", "privacy":"Chính sách quyền riêng tư", "guideSub":"giá, tiền tip, cách chọn (tiếng Anh)", "guide_danang":"Cẩm nang massage Đà Nẵng", "guide_nhatrang":"Cẩm nang massage Nha Trang", "guide_hcm":"Cẩm nang massage TP.HCM", "guide_hanoi":"Cẩm nang massage Hà Nội", "langPick":"Ngôn ngữ"});

/* 직접 번역하지 않은 언어(일본어 · 중국어 · 러시아어 등)는 빈 칸으로 두고,
   관리자 → 포털 → 🌐 다국어 번역에서 AI로 번역한 문구를 i18n-live.js 가 채워요 (안 채워진 문구는 영어로 보여요) */
if (typeof LANGS !== "undefined") LANGS.forEach(l => { if (!UI[l.id]) UI[l.id] = {}; });
Object.assign(UI.ko, { ac_p_kakao: "카카오로 시작하기", ac_p_naver: "네이버로 시작하기", ac_p_google: "구글로 시작하기", ac_p_facebook: "페이스북으로 시작하기" });
Object.assign(UI.en, { ac_p_kakao: "Continue with Kakao", ac_p_naver: "Continue with Naver", ac_p_google: "Continue with Google", ac_p_facebook: "Continue with Facebook" });
Object.assign(UI.vi, { ac_p_kakao: "Tiếp tục với Kakao", ac_p_naver: "Tiếp tục với Naver", ac_p_google: "Tiếp tục với Google", ac_p_facebook: "Tiếp tục với Facebook" });

// 11/20: 지금 영업 중 · 포인트 적립 표시 · 호텔 출장 · 확정 속도 · 홈 화면 추가 · 채팅 답장 속도
Object.assign(UI.ko, {"op_now": "🟢 영업 중", "op_until": "{t}까지", "op_soon": "🟠 곧 마감 · {t}", "op_before": "🕘 {t} 오픈", "op_off": "오늘 휴무", "op_closed": "영업 종료", "op_filter": "🟢 지금 영업 중", "op_none": "지금 영업 중인 곳이 없어요. '지금 영업 중'을 끄면 모두 보여요.", "pts_badge": "💸 포인트 적립", "pts_badgeN": "💸 {p}% 포인트 적립", "pts_hint": "엉클데이로 예약하고 방문 후 결제 금액을 알려 주면 엉클데이 포인트가 쌓여요", "oc_badge": "🏨 호텔 출장 가능", "oc_filter": "🏨 호텔 출장", "sp_min": "⚡ 보통 {n}분 안에 예약 확정", "sp_hr": "⚡ 보통 {n}시간 안에 예약 확정", "pwa_btn": "📲 홈 화면에 추가", "pwa_ios": "Safari 아래쪽 공유 버튼(⬆️)을 누르고 '홈 화면에 추가'를 골라 주세요.", "pwa_desc": "앱처럼 바로 열 수 있어요", "pb_titleN": "💰 결제 금액 알려 주고 포인트 받기", "pb_descN": "가게에서 실제로 받은 시술과 결제한 금액을 알려 주세요. 확인되면 엉클데이 포인트를 쌓아 드려요 (1P = 1동).", "cb_sub": "확인하는 대로 바로 답해 드려요", "cb_subMin": "보통 {n}분 안에 답해 드려요 (최근 30일)", "cb_subHr": "보통 {n}시간 안에 답해 드려요 (최근 30일)"});
Object.assign(UI.en, {"op_now": "🟢 Open now", "op_until": "until {t}", "op_soon": "🟠 Closing soon · {t}", "op_before": "🕘 Opens {t}", "op_off": "Closed today", "op_closed": "Closed now", "op_filter": "🟢 Open now", "op_none": "No shops are open right now. Turn off 'Open now' to see all.", "pts_badge": "💸 Earn points", "pts_badgeN": "💸 Earn {p}% points", "pts_hint": "Book with Uncle Day and tell us what you paid after your visit to earn Uncle Day points", "oc_badge": "🏨 Hotel visits available", "oc_filter": "🏨 Hotel visits", "sp_min": "⚡ Usually confirmed within {n} min", "sp_hr": "⚡ Usually confirmed within {n} h", "pwa_btn": "📲 Add to Home Screen", "pwa_ios": "In Safari, tap the Share button (⬆️) and choose 'Add to Home Screen'.", "pwa_desc": "Open it like an app", "pb_titleN": "💰 Tell us what you paid — earn points", "pb_descN": "Tell us the treatments you actually received and the amount you paid. Once confirmed, we'll add Uncle Day points (1P = 1 VND).", "cb_sub": "We reply as soon as we see your message", "cb_subMin": "Usually replies within {n} min (last 30 days)", "cb_subHr": "Usually replies within {n} h (last 30 days)"});
Object.assign(UI.vi, {"op_now": "🟢 Đang mở cửa", "op_until": "đến {t}", "op_soon": "🟠 Sắp đóng cửa · {t}", "op_before": "🕘 Mở cửa lúc {t}", "op_off": "Hôm nay nghỉ", "op_closed": "Đã đóng cửa", "op_filter": "🟢 Đang mở cửa", "op_none": "Hiện không có cơ sở nào đang mở. Tắt 'Đang mở cửa' để xem tất cả.", "pts_badge": "💸 Tích điểm", "pts_badgeN": "💸 Tích {p}% điểm", "pts_hint": "Đặt lịch qua Uncle Day và báo số tiền đã trả sau khi đến để tích điểm Uncle Day", "oc_badge": "🏨 Phục vụ tại khách sạn", "oc_filter": "🏨 Tại khách sạn", "sp_min": "⚡ Thường xác nhận trong {n} phút", "sp_hr": "⚡ Thường xác nhận trong {n} giờ", "pwa_btn": "📲 Thêm vào màn hình chính", "pwa_ios": "Trong Safari, bấm nút Chia sẻ (⬆️) rồi chọn 'Thêm vào MH chính'.", "pwa_desc": "Mở nhanh như một ứng dụng", "pb_titleN": "💰 Báo số tiền đã trả — nhận điểm", "pb_descN": "Hãy cho chúng tôi biết dịch vụ bạn đã làm và số tiền đã trả. Khi xác nhận xong, Uncle Day sẽ cộng điểm cho bạn (1P = 1 đồng).", "cb_sub": "Chúng tôi sẽ trả lời ngay khi nhận được tin nhắn", "cb_subMin": "Thường trả lời trong {n} phút (30 ngày qua)", "cb_subHr": "Thường trả lời trong {n} giờ (30 ngày qua)"});

// 📒 시술 기록 (universe42)
Object.assign(UI.ko, {"hi_sub": "엉클데이로 받은 시술이 예약과 따로 여기에 모여요. 가게가 남긴 메모도 같이 봐요.", "hi_times": "번 방문", "hi_shops": "곳의 가게", "hi_last": "최근 방문", "hi_note": "가게 메모", "hi_again": "다시 예약하기", "hi_voucher": "예약확인증", "hi_none": "이 기기에서 찾은 예약이 없어요. 예약번호로 예약을 찾거나 로그인하면 내 시술 기록이 보여요.", "hi_login": "로그인", "hi_open": "내 시술 기록 보기", "hi_openD": "지금까지 받은 시술 · 가게 메모 · 사장님께 보여 주기", "vh_show": "사장님께 보여 주기", "vh_showD": "가게에서 지난 시술을 물어보면 이 버튼을 눌러 보여 주세요. 베트남어 화면으로 크게 나와요. 가게에는 자기 가게 기록만 보이고, 다른 가게 기록은 내가 보여 줄 때만 볼 수 있어요.", "vh_title": "📒 내 시술 기록", "vh_empty": "방문을 마치면 가게가 남긴 시술 기록(받은 시술 · 다음 추천)이 여기에 쌓여요."});
Object.assign(UI.en, {"hi_sub": "Your Uncle Day treatments, kept separately from bookings — with the shop's notes.", "hi_times": "visits", "hi_shops": "shops", "hi_last": "Last visit", "hi_note": "Shop's note", "hi_again": "Book again", "hi_voucher": "Booking page", "hi_none": "No bookings found on this device. Find your booking by number or log in to see your history.", "hi_login": "Log in", "hi_open": "See my treatment history", "hi_openD": "Past treatments · shop notes · show the shop owner", "vh_show": "Show the shop owner", "vh_showD": "If the shop asks about your past treatments, tap this to show them in Vietnamese. Shops only see their own records — others only when you show this screen.", "vh_title": "📒 My treatment history", "vh_empty": "After your visit, the shop's notes (what was done · next suggestion) will appear here."});
Object.assign(UI.vi, {"hi_sub": "Các dịch vụ bạn đã dùng qua Uncle Day, tách riêng với lịch hẹn — kèm ghi chú của cửa hàng.", "hi_times": "lần", "hi_shops": "cửa hàng", "hi_last": "Lần gần nhất", "hi_note": "Ghi chú cửa hàng", "hi_again": "Đặt lại", "hi_voucher": "Phiếu đặt lịch", "hi_none": "Không tìm thấy lịch hẹn trên thiết bị này. Tìm bằng mã đặt lịch hoặc đăng nhập để xem lịch sử.", "hi_login": "Đăng nhập", "hi_open": "Xem lịch sử dịch vụ", "hi_openD": "Dịch vụ đã dùng · ghi chú cửa hàng · cho chủ cửa hàng xem", "vh_show": "Cho chủ cửa hàng xem", "vh_showD": "Khi cửa hàng hỏi về dịch vụ bạn đã làm, bấm nút này để cho xem bằng tiếng Việt. Mỗi cửa hàng chỉ thấy lịch sử tại cửa hàng mình — nơi khác chỉ khi bạn cho xem.", "vh_title": "📒 Lịch sử dịch vụ của tôi", "vh_empty": "Sau khi bạn đến, ghi chú của cửa hàng (dịch vụ đã làm · gợi ý lần sau) sẽ hiện ở đây."});
// 📎 채팅 사진 · 파일 (universe40)
Object.assign(UI.ko, {"cb_unsend": "보내기 취소", "cb_unsendQ": "이 메시지를 지울까요? 엉클데이 화면에서도 지워져요.", "cb_unsendLate": "보낸 지 5분이 지나서 지울 수 없어요.", "cb_deleted": "삭제된 메시지예요", "cb_cancel": "취소", "cb_max": "한 번에 10개까지 보낼 수 있어요. 앞의 10개만 보낼게요.", "cb_attach": "사진 · 파일 보내기", "cb_upl": "보내는 중…", "cb_big": "파일이 너무 커요 (10MB까지)", "cb_type": "사진이나 PDF만 보낼 수 있어요", "cb_open": "열기"});
Object.assign(UI.en, {"cb_unsend": "Unsend", "cb_unsendQ": "Delete this message? It will also disappear for Uncle Day.", "cb_unsendLate": "You can only unsend within 5 minutes.", "cb_deleted": "This message was deleted", "cb_cancel": "Cancel", "cb_max": "You can send up to 10 at once. Sending the first 10.", "cb_attach": "Send a photo or file", "cb_upl": "Sending…", "cb_big": "The file is too large (max 10MB)", "cb_type": "You can send photos or PDF files", "cb_open": "Open"});
Object.assign(UI.vi, {"cb_unsend": "Thu hồi", "cb_unsendQ": "Thu hồi tin nhắn này? Tin nhắn cũng sẽ bị xóa ở phía Uncle Day.", "cb_unsendLate": "Chỉ thu hồi được trong 5 phút.", "cb_deleted": "Tin nhắn đã bị thu hồi", "cb_cancel": "Hủy", "cb_max": "Gửi tối đa 10 tệp mỗi lần. Sẽ gửi 10 tệp đầu tiên.", "cb_attach": "Gửi ảnh · tệp", "cb_upl": "Đang gửi…", "cb_big": "Tệp quá lớn (tối đa 10MB)", "cb_type": "Chỉ gửi được ảnh hoặc PDF", "cb_open": "Mở"});
// 🎁 할인 이벤트 (universe39)
Object.assign(UI.ko, {"pm_title": "🎁 할인 이벤트", "pm_pct": "{v}% 할인", "pm_amt": "{v} 할인", "pm_all": "전 메뉴", "pm_some": "일부 메뉴", "pm_until": "{d}까지", "pm_from": "{d}부터", "pm_note": "할인은 가게에서 결제할 때 적용돼요. 이벤트 내용은 가게 사정으로 바뀔 수 있어요.", "pm_applied": "적용 이벤트", "pm_est": "할인 적용 예상 금액"});
Object.assign(UI.en, {"pm_title": "🎁 Deals", "pm_pct": "{v}% off", "pm_amt": "{v} off", "pm_all": "All menus", "pm_some": "Selected menus", "pm_until": "until {d}", "pm_from": "from {d}", "pm_note": "The discount is applied when you pay at the shop. Deals may change at the shop's discretion.", "pm_applied": "Deal applied", "pm_est": "Estimated price with deal"});
Object.assign(UI.vi, {"pm_title": "🎁 Ưu đãi", "pm_pct": "giảm {v}%", "pm_amt": "giảm {v}", "pm_all": "Tất cả dịch vụ", "pm_some": "Một số dịch vụ", "pm_until": "đến {d}", "pm_from": "từ {d}", "pm_note": "Giảm giá khi thanh toán tại cửa hàng. Ưu đãi có thể thay đổi theo cửa hàng.", "pm_applied": "Ưu đãi áp dụng", "pm_est": "Giá dự kiến sau ưu đãi"});
// 11/24: 📋 시술 전 질문 (universe37)
Object.assign(UI.ko, {"sv_title": "방문 전 질문", "sv_req": "가게 요청: 방문 전에 꼭 작성", "sv_desc": "가게가 안전한 시술을 위해 미리 알고 싶어 하는 것들이에요. 1분이면 돼요.", "sv_yes": "예", "sv_no": "아니요", "sv_detail": "자세히 적어 주세요 (예: 땅콩, 페니실린)", "sv_ph": "선택 사항", "sv_consent": "작성한 내용(건강 정보 포함)을 안전한 시술을 위해 예약한 가게와 엉클데이에 전달하는 데 동의해요. 방문 30일 뒤 자동으로 지워지고, 언제든 직접 지울 수 있어요.", "sv_send": "제출하기", "sv_done": "작성 완료 — 가게에 전달됐어요", "sv_edit": "고치기", "sv_del": "내 답 지우기", "sv_delSure": "정말 지울까요? 한 번 더 누르면 지워져요", "sv_deleted": "지웠어요", "sv_need": "예/아니요 · 고르기 질문에 모두 답해 주세요", "sv_needConsent": "맨 아래 동의에 체크해 주세요", "sv_saved": "저장했어요. 가게에 전달됐어요 ✅"});
Object.assign(UI.en, {"sv_title": "Pre-visit questions", "sv_req": "The shop asks you to fill this in before your visit", "sv_desc": "The shop would like to know these for a safe treatment. It takes about a minute.", "sv_yes": "Yes", "sv_no": "No", "sv_detail": "Please give details (e.g. peanuts, penicillin)", "sv_ph": "Optional", "sv_consent": "I agree to share these answers (including health information) with the shop I booked and Uncle Day for a safe treatment. They are deleted automatically 30 days after the visit, and I can delete them any time.", "sv_send": "Submit", "sv_done": "Done — sent to the shop", "sv_edit": "Edit", "sv_del": "Delete my answers", "sv_delSure": "Delete for sure? Tap again to delete", "sv_deleted": "Deleted", "sv_need": "Please answer every Yes/No and choice question", "sv_needConsent": "Please tick the consent box at the bottom", "sv_saved": "Saved and sent to the shop ✅"});
Object.assign(UI.vi, {"sv_title": "Câu hỏi trước khi đến", "sv_req": "Cơ sở yêu cầu: vui lòng trả lời trước khi đến", "sv_desc": "Cơ sở muốn biết trước những điều này để thực hiện an toàn. Chỉ mất khoảng 1 phút.", "sv_yes": "Có", "sv_no": "Không", "sv_detail": "Vui lòng ghi rõ (vd: đậu phộng, penicillin)", "sv_ph": "Không bắt buộc", "sv_consent": "Tôi đồng ý chia sẻ câu trả lời (bao gồm thông tin sức khỏe) với cơ sở đã đặt và Uncle Day để thực hiện an toàn. Thông tin tự động xóa sau 30 ngày kể từ ngày đến và tôi có thể tự xóa bất cứ lúc nào.", "sv_send": "Gửi", "sv_done": "Đã trả lời — đã gửi cho cơ sở", "sv_edit": "Sửa", "sv_del": "Xóa câu trả lời", "sv_delSure": "Chắc chắn xóa? Bấm lần nữa để xóa", "sv_deleted": "Đã xóa", "sv_need": "Vui lòng trả lời tất cả câu hỏi Có/Không và câu hỏi chọn", "sv_needConsent": "Vui lòng đánh dấu ô đồng ý ở cuối", "sv_saved": "Đã lưu và gửi cho cơ sở ✅"});

/* 💛 카카오톡 상담 버튼 (머리글 · 사이트 채팅과 따로) */
Object.assign(UI.ko, { kkTalk: "카톡 상담", kkTalkFull: "카카오톡으로 상담하기" });
Object.assign(UI.en, { kkTalk: "KakaoTalk", kkTalkFull: "Chat with us on KakaoTalk" });
Object.assign(UI.vi, { kkTalk: "KakaoTalk", kkTalkFull: "Nhắn tin qua KakaoTalk" });

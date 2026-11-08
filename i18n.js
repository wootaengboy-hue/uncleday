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
    book: "예약 요청", bookBtn: "예약 요청하기", pick: "선택",
    fMenu: "메뉴", fDate: "날짜", fTime: "시간", fPeople: "인원", fName: "이름",
    fContact: "연락처 (카카오톡 ID / WhatsApp / 이메일)", fNote: "요청사항",
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
    book: "Booking request", bookBtn: "Send request", pick: "Select",
    fMenu: "Service", fDate: "Date", fTime: "Time", fPeople: "Guests", fName: "Name",
    fContact: "Contact (KakaoTalk ID / WhatsApp / Email)", fNote: "Notes",
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
    book: "Yêu cầu đặt lịch", bookBtn: "Gửi yêu cầu", pick: "Chọn",
    fMenu: "Dịch vụ", fDate: "Ngày", fTime: "Giờ", fPeople: "Số người", fName: "Họ tên",
    fContact: "Liên hệ (KakaoTalk ID / Zalo / WhatsApp / Email)", fNote: "Yêu cầu thêm",
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
Object.assign(UI.ko, { gTitle: "구글 지도 정보", gNote: "Google 제공", gHours: "영업시간 보기 (구글)", gMore: "구글 지도에서 사진·후기 더 보기" });
Object.assign(UI.en, { gTitle: "On Google Maps", gNote: "Provided by Google", gHours: "Opening hours (Google)", gMore: "More photos & reviews on Google Maps" });
Object.assign(UI.vi, { gTitle: "Thông tin Google Maps", gNote: "Do Google cung cấp", gHours: "Giờ mở cửa (Google)", gMore: "Xem thêm ảnh & đánh giá trên Google Maps" });
Object.assign(UI.ko, { gToday: "오늘", gHoursNote: "구글 지도 기준 · 아래에서 요일별 시간 보기" });
Object.assign(UI.en, { gToday: "Today", gHoursNote: "From Google Maps · see all days below" });
Object.assign(UI.vi, { gToday: "Hôm nay", gHoursNote: "Theo Google Maps · xem các ngày bên dưới" });
Object.assign(UI.ko, { gAddrNote: "구글 지도 기준" }); Object.assign(UI.en, { gAddrNote: "From Google Maps" }); Object.assign(UI.vi, { gAddrNote: "Theo Google Maps" });
Object.assign(UI.ko, { phNote: "매장 사진 준비 중 · 카테고리 대표 이미지" }); Object.assign(UI.en, { phNote: "Shop photos coming soon · Category image" }); Object.assign(UI.vi, { phNote: "Ảnh cửa hàng sắp có · Ảnh minh họa danh mục" });
Object.assign(UI.ko, { shareBtn: "공유하기", shareCopied: "링크를 복사했어요. 카톡에 붙여넣어 보내세요" }); Object.assign(UI.en, { shareBtn: "Share", shareCopied: "Link copied" }); Object.assign(UI.vi, { shareBtn: "Chia sẻ", shareCopied: "Đã sao chép liên kết" });

/* 🇻🇳 관리자 화면 베트남어 — 현장 영업 직원(👷 field)이 보는 화면만 옮겨요
 *  - 화면에 그려진 한국어 문장을 사전(ADMIN_VI)에서 찾아 바꿔요 (새로 그려지는 화면도 자동으로)
 *  - 사용자가 입력한 값(가게 이름 · 메모 · 입력칸)은 건드리지 않아요
 *  - 머리글의 [VI / KO] 버튼으로 바꿔요 (이 브라우저에 기억)
 */
const ADMIN_VI = {};
const ADMIN_VI_RX = [];
let ALANG = (() => { try { return localStorage.getItem("ud-admin-lang") || "vi"; } catch (e) { return "vi"; } })();
const AVI_SKIP = "script,style,textarea,[contenteditable=true],[contenteditable=''],.re,.notranslate,code,pre";
function aviText(t) {
  const k = t.trim(); if (!k || !/[가-힣]/.test(k)) return null;
  if (ADMIN_VI[k] != null) return t.replace(k, ADMIN_VI[k]);
  for (const [rx, to] of ADMIN_VI_RX) { if (rx.test(k)) return t.replace(k, k.replace(rx, to)); }
  return null;
}
function aviNode(n) {
  if (ALANG !== "vi" || !n) return;
  if (n.nodeType === 3) { const p = n.parentElement; if (!p || p.closest(AVI_SKIP)) return; const v = aviText(n.nodeValue); if (v != null && v !== n.nodeValue) n.nodeValue = v; return; }
  if (n.nodeType !== 1 || n.matches(AVI_SKIP)) return;
  for (const a of ["placeholder", "title", "aria-label"]) { const v0 = n.getAttribute(a); if (v0) { const v = aviText(v0); if (v != null && v !== v0) n.setAttribute(a, v); } }
  for (let c = n.firstChild; c; c = c.nextSibling) aviNode(c);
}
function adminLangInit() {
  const me = document.getElementById("me");
  if (me && !document.getElementById("aLang")) {
    const b = document.createElement("span"); b.id = "aLang"; b.className = "a-lang";
    b.innerHTML = `<button data-al="vi" class="${ALANG === "vi" ? "on" : ""}">VI</button><button data-al="ko" class="${ALANG === "ko" ? "on" : ""}">KO</button>`;
    me.parentNode.insertBefore(b, me);
    b.querySelectorAll("[data-al]").forEach(x => x.onclick = () => { if (x.dataset.al === ALANG) return; try { localStorage.setItem("ud-admin-lang", x.dataset.al); } catch (e) {} location.reload(); });
  }
  if (ALANG !== "vi") return;
  document.documentElement.lang = "vi";
  aviNode(document.body);
  new MutationObserver(ms => { for (const m of ms) { if (m.type === "characterData") aviNode(m.target); else m.addedNodes.forEach(aviNode); if (m.type === "attributes") aviNode(m.target); } })
    .observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "title"] });
  // 토스트 · 확인창 문구
  if (typeof toast === "function" && !toast.vi) { const t0 = toast; window.toast = (m, ms) => t0(aviText(String(m)) || m, ms); window.toast.vi = true; }
}

/* ---- 사전 (현장 영업 직원 화면) ---- */
Object.assign(ADMIN_VI, {
  // 머리글 · 탭
  "관리자": "Quản trị", "사이트 보기": "Xem trang web", "🏠 포털": "🏠 Cổng nội bộ", "📝 낙서장": "🤝 Theo dõi cửa hàng", "🏪 업체": "🏪 Cửa hàng", "알림": "Thông báo", "닫기": "Đóng", "저장": "Lưu", "복사": "Sao chép", "추가": "Thêm", "수정": "Sửa", "취소": "Hủy", "확인": "OK", "남기기": "Ghi lại", "날짜": "Ngày", "메모": "Ghi chú", "나": "tôi",
  // 포털
  "포털 홈": "Trang chủ", "← 포털 홈": "← Trang chủ", "🧭 운영": "🧭 Vận hành", "🏪 가게 정보": "🏪 Thông tin cửa hàng", "현장 영업 매뉴얼": "Sổ tay đi thị trường", "가게 정보 채우기": "Bổ sung thông tin cửa hàng", "가격 채우기": "Nhập giá", "가게에 링크 달기": "Gắn link cho cửa hàng",
  "🏠 엉클데이 사내 포털": "🏠 Cổng nội bộ Uncle Day", "가게 정보 · 가격 · 사진 입력, 업체 영업 보드, 링크 · QR, 현장 영업 매뉴얼": "Nhập thông tin · giá · ảnh cửa hàng, bảng theo dõi cửa hàng, link · QR, sổ tay đi thị trường",
  "↻ 새로고침": "↻ Tải lại", "🧩 사내 앱": "🧩 Ứng dụng", "눌러서 들어가요 · 큰 화면은 왼쪽 메뉴로도 이동": "Bấm để mở · màn hình lớn có menu bên trái",
  "베트남 영업 담당자용 · 베/한 · 잘로로 보내기 · 인쇄": "Dành cho nhân viên thị trường · Việt/Hàn · gửi Zalo · in", "업체별 검색 점수 · 빈 칸 · 후기 요청": "Điểm tìm kiếm từng cửa hàng · mục còn thiếu",
  "메뉴 가격을 휴대폰으로 바로": "Nhập giá menu ngay trên điện thoại", "구글 지도 · 페북 · 잘로 · QR": "Google Maps · Facebook · Zalo · QR",
  // 매뉴얼
  "📒 현장 영업 매뉴얼": "📒 Sổ tay đi thị trường", "베트남 현지 영업 담당자용 · 베트남어 / 한국어": "Dành cho nhân viên thị trường · tiếng Việt / tiếng Hàn",
  "🇻🇳 베트남어": "🇻🇳 Tiếng Việt", "🇰🇷 한국어": "🇰🇷 Tiếng Hàn", "📋 잘로로 보낼 글 복사": "📋 Sao chép để gửi Zalo", "🖨️ 인쇄 · PDF": "🖨️ In · PDF", "✉️ 보고 양식 복사": "✉️ Sao chép mẫu báo cáo", "체험판 열기 ↗": "Mở bản dùng thử ↗", "사장님 소개 자료": "Tài liệu giới thiệu cho chủ tiệm", "가게에서 휴대폰으로 넘겨 보여 주는 10장 · 베트남어/한국어 · 사장님께 링크로 보내도 돼요": "10 trang để lướt cho chủ tiệm xem trên điện thoại · tiếng Việt/Hàn · có thể gửi link cho chủ tiệm", "소개 자료 열기 ↗": "Mở tài liệu giới thiệu ↗", "🔗 링크 복사 (잘로로 보내기)": "🔗 Sao chép link (gửi Zalo)",
  "엉클데이는 무엇인가요? (1분 소개)": "Uncle Day là gì? (giới thiệu 1 phút)", "가기 전에": "Trước khi đi", "가게에서 — 이렇게 말해요": "Tại cửa hàng — nói gì?", "받아 올 정보 (하나씩 체크)": "Thông tin cần lấy (đánh dấu từng mục)", "계약서": "Hợp đồng", "링크 · QR 달기": "Gắn link & mã QR", "사장님께 쓰는 법 알려 드리기": "Hướng dẫn chủ tiệm dùng", "가게마다 — 관리자에게 보고 (그날 안에)": "Sau mỗi cửa hàng — báo cáo cho quản lý (trong ngày)", "하면 안 되는 것": "Không được làm", "사장님이 자주 묻는 것": "Chủ tiệm hay hỏi",
  // 가게 정보 채우기
  "📋 가게 정보 채우기": "📋 Bổ sung thông tin cửa hàng", "💰 가격 채우기": "💰 Nhập giá", "🔗 가게에 링크 달기": "🔗 Gắn link cho cửa hàng",
  "업체별 검색 점수 100점 만점 — 사진 · 가격 · 후기 · 소개 · 위치 빈 칸 찾기 · 사장님께 요청 · 후기 요청": "Điểm tìm kiếm (tối đa 100) — tìm mục còn thiếu: ảnh · giá · đánh giá · giới thiệu · vị trí · nhờ chủ tiệm bổ sung",
  "업체마다 검색 · AI 에 중요한 정보가 얼마나 채워졌는지": "Mỗi cửa hàng đã có đủ thông tin quan trọng cho Google · AI chưa — tính theo", "100점 만점": "thang 100 điểm",
  "으로 보여 줘요. 빈 칸을 누르면 바로 고치는 곳으로 가요. 고친 내용은 1시간 안에 업체 페이지 · 블로그 · 가격 페이지에 자동으로 들어가요.": ". Bấm vào mục thiếu để sửa ngay. Nội dung đã sửa sẽ tự cập nhật lên trang cửa hàng · blog · trang giá trong 1 giờ.",
  "📷 대표 사진": "📷 Ảnh đại diện", "💰 메뉴 가격": "💰 Giá menu", "⭐ 손님 후기": "⭐ Đánh giá của khách", "📝 소개 글": "📝 Giới thiệu", "🕘 영업시간": "🕘 Giờ mở cửa", "📍 정확한 위치": "📍 Vị trí chính xác", "🔤 이름 3개 언어": "🔤 Tên 3 ngôn ngữ", "🏠 주소": "🏠 Địa chỉ", "🏷️ 특징 태그 3개+": "🏷️ 3+ thẻ đặc điểm",
  "사장님께 요청문 ▼": "Tin nhắn nhờ chủ tiệm ▼", "📋 사장님께 요청문 복사": "📋 Sao chép tin nhắn cho chủ tiệm", "✏️ 업체 창 열기": "✏️ Mở cửa hàng", "🎉 모든 업체가 100점이에요.": "🎉 Tất cả cửa hàng đều đạt 100 điểm.",
  "사진 없는 업체는 검색 · 지도 · 공유 미리보기에 기본 그림만 떠서 눌러 보는 사람이 크게 줄어요": "Không có ảnh thì Google · bản đồ · ảnh xem trước chỉ hiện hình mặc định, ít người bấm vào hơn",
  "가격 페이지 · 블로그 · AI 답변이 모두 실제 가격으로 만들어져요": "Trang giá · blog · câu trả lời AI đều dùng giá thật", "후기가 있으면 구글 검색 결과에 별점이 붙을 수 있어요": "Có đánh giá thì kết quả Google có thể hiện số sao",
  "구글 · AI 가 이 가게를 설명할 때 쓰는 글이에요 (40자 이상)": "Google · AI dùng đoạn này để giới thiệu cửa hàng (từ 40 ký tự)", "'지금 영업 중' · '늦게까지 하는 곳' 검색에 나와요": "Hiện khi khách tìm “đang mở cửa” · “mở khuya”",
  "블로그 '○○ 근처' 거리 계산 · 지도에 쓰여요 (지금은 대략 위치)": "Dùng để tính khoảng cách “gần ○○” trên blog · bản đồ (hiện là vị trí gần đúng)", "'Clover Spa'든 '클로버 스파'든 어느 말로 찾아도 나오게 해요": "Khách tìm bằng tên nào cũng ra",
  "구글 지도 · 검색의 가게 정보와 맞춰져요": "Khớp với thông tin trên Google Maps", "'커플룸' · '한국어' · '공항 샌딩' 같은 검색어에 걸려요": "Hiện khi khách tìm “phòng đôi” · “tiếng Hàn” · “đưa đón sân bay”",
  // 가격 채우기
  "업체 메뉴 가격 — 채울수록 검색 · AI 에 강해져요 · 영업 현장에서 휴대폰으로": "Giá menu — càng đầy đủ càng hiện tốt trên Google · AI · nhập ngay tại cửa hàng", "가격을 채우면 1시간 안에": "Nhập giá xong, trong 1 giờ sẽ tự cập nhật vào",
  "시술별 가격 페이지 · 미입점 가게 '이 근처 가격' · 영어 페이지": "trang giá theo dịch vụ · “giá gần đây” · trang tiếng Anh", "에 자동으로 들어가요. 숫자는": ". Số", "모두 450,000₫로 읽어요.": "đều được hiểu là 450,000₫.",
  "전체": "Tất cả", "가격 빈 곳만": "Chỉ chỗ thiếu giá", "가격 빈 메뉴": "menu thiếu giá", "업체 창에서 자세히": "Chi tiết trong cửa hàng", "가격을 비우면 '상담 시 안내'로 보여요": "Để trống giá thì hiện “báo giá khi tư vấn”",
  "가격 (예: 450)": "Giá (vd: 450)", "+ 새 메뉴 이름 (예: 아로마 마사지 60분)": "+ Tên menu mới (vd: Massage tinh dầu 60 phút)", "분": "phút", "가격": "Giá",
  // 링크 달기
  "🔗 가게에 엉클데이 링크 달기": "🔗 Gắn link Uncle Day cho cửa hàng", "구글 지도 예약 링크 · 페이스북 · 잘로 · 인스타 · 매장 QR — 검색 노출 1순위": "Link đặt lịch trên Google Maps · Facebook · Zalo · Instagram · QR — ưu tiên số 1",
  "입점 가게의 구글 지도 · 페이스북 · 잘로 · 인스타에": "Khi gắn", "엉클데이 예약 링크": "link đặt lịch Uncle Day", "를 달면, 구글이 엉클데이를 \"이 가게의 예약처\"로 믿게 돼요 (검색 노출 1순위). 어디서 들어왔는지는 🔎 검색 유입에 따로 세요.": "vào Google Maps · Facebook · Zalo · Instagram của cửa hàng, Google sẽ coi Uncle Day là “nơi đặt lịch của cửa hàng”.",
  "📍 구글 지도 · 예약 링크": "📍 Google Maps · link đặt lịch", "가장 중요해요. 가게 이름을 구글에서 찾으면 '예약' 링크로 엉클데이가 떠요.": "Quan trọng nhất. Khi tìm tên cửa hàng trên Google, nút “Đặt lịch” sẽ dẫn tới Uncle Day.",
  "📘 페이스북 페이지 버튼": "📘 Nút trên trang Facebook", "페이지의 '지금 예약' 버튼에 넣어요.": "Gắn vào nút “Đặt ngay” của trang.", "💬 잘로 소개": "💬 Giới thiệu Zalo", "잘로 공식 계정 · 프로필 소개에 넣어요.": "Gắn vào tài khoản Zalo OA · phần giới thiệu.",
  "📸 인스타그램 소개": "📸 Giới thiệu Instagram", "프로필의 링크 칸에 넣어요.": "Gắn vào ô link trên hồ sơ.", "🧾 매장 QR (메뉴판 옆 · 입구)": "🧾 QR tại cửa hàng (cạnh menu · cửa ra vào)",
  "한국 손님이 찍으면 한국어 메뉴 · 가격이 바로 열려요. 다음 방문 예약 · 일행 공유에도 써요.": "Khách Hàn quét là thấy ngay menu · giá bằng tiếng Hàn. Dùng để đặt lịch lần sau · gửi bạn bè.",
  "최근 30일 이 링크들로 들어온 손님": "Khách vào qua các link này (30 ngày)", "🧾 QR 카드 내려받기 (인쇄용)": "🧾 Tải thẻ QR (để in)", "메뉴판 옆 · 입구에 두면 한국 손님이 찍어서 한국어 메뉴 · 가격을 보고, 다음 방문도 예약해요": "Đặt cạnh menu · cửa ra vào: khách Hàn quét để xem menu · giá tiếng Hàn và đặt lịch lần sau",
  "사장님께 보낼 안내문": "Tin nhắn gửi chủ tiệm", "📋 안내문 복사": "📋 Sao chép tin nhắn", "업체 담당자 전화가 있으면 '잘로 열기'가 생겨요": "Có số điện thoại người phụ trách thì sẽ có nút “Mở Zalo”", "잘로 열기": "Mở Zalo", "가게 찾기": "Tìm cửa hàng", "가게가 없어요.": "Không có cửa hàng.", "불러오는 중…": "Đang tải…",
  // 업체 목록
  "전체 업체": "Tất cả cửa hàng", "＋ 새 업체 등록": "＋ Thêm cửa hàng mới", "업체": "Cửa hàng", "카테고리": "Danh mục", "지역": "Khu vực", "상태": "Trạng thái", "📍 좌표 없음": "📍 Chưa có tọa độ", "📍 대략 위치": "📍 Vị trí gần đúng", "✦ 엉클 인증": "✦ Uncle xác nhận",
  "업체명, 아이디, 태그 검색": "Tìm tên, ID, thẻ", "지역 전체": "Tất cả khu vực", "카테고리 전체": "Tất cả danh mục", "상태 전체": "Tất cả trạng thái", "정보 확인 중": "Đang xác minh", "입점 확인됨": "Đã xác nhận", "⚠ 확인 필요": "⚠ Cần kiểm tra", "사이트에서 숨김": "Đang ẩn trên web",
  "'저장'을 누르면 바로 데이터베이스에 저장되고 손님 화면에도 곧바로 반영돼요.": "Bấm “Lưu” là lưu ngay vào hệ thống và hiện lên trang khách.", "업체 이름 찾기": "Tìm tên cửa hàng", "눌러서 확인 필요 업체만 보기": "Bấm để chỉ xem cửa hàng cần kiểm tra",
  "호치민": "TP.HCM", "하노이": "Hà Nội", "다낭": "Đà Nẵng", "나트랑": "Nha Trang",
  "✨ 피부관리": "✨ Chăm sóc da", "💆 마사지": "💆 Massage", "🧖 스파·바디케어": "🧖 Spa · chăm sóc cơ thể", "💉 피부과 시술": "💉 Thẩm mỹ da", "🏥 성형·윤곽": "🏥 Phẫu thuật thẩm mỹ", "💇 헤어": "💇 Tóc", "💅 네일·속눈썹": "💅 Nail · mi", "🪒 제모·체형": "🪒 Triệt lông · body", "🦷 치과·미백": "🦷 Nha khoa · tẩy trắng", "🧳 뷰티 패키지": "🧳 Gói làm đẹp",
  "피부관리": "Chăm sóc da", "마사지": "Massage", "스파·바디케어": "Spa · chăm sóc cơ thể", "피부과 시술": "Thẩm mỹ da", "성형·윤곽": "Phẫu thuật thẩm mỹ", "헤어": "Tóc", "네일·속눈썹": "Nail · mi", "제모·체형": "Triệt lông · body", "치과·미백": "Nha khoa · tẩy trắng", "뷰티 패키지": "Gói làm đẹp",
  // 업체 편집
  "정보 확인 체크": "Đánh dấu thông tin đã xác minh", "업체에 직접 확인한 항목에 체크해요. 손님에게는 안 보여요.": "Đánh dấu mục đã hỏi trực tiếp cửa hàng. Khách không thấy.", "주소": "Địa chỉ", "영업시간·휴무": "Giờ mở cửa · ngày nghỉ", "응대 언어": "Ngôn ngữ phục vụ",
  "🔒 게시(사이트에 보이기)는 관리자가 확인한 뒤에 해요. 새 업체는 숨김 상태로 저장돼요.": "🔒 Việc hiển thị lên web do quản lý duyệt. Cửa hàng mới được lưu ở trạng thái ẩn.",
  "기본 정보": "Thông tin cơ bản", "업체명 (한국어)": "Tên cửa hàng (tiếng Hàn)", "업체명 (영어)": "Tên cửa hàng (tiếng Anh)", "업체명 (베트남어)": "Tên cửa hàng (tiếng Việt)", "세부 카테고리": "Danh mục chi tiết", "사이트엔 Skin & Beauty로 보여요": "Trên web hiện là Skin & Beauty", "아이디 (주소용)": "ID (dùng cho đường dẫn)",
  "아이디는 영어 소문자·숫자·- 만 써요. 업체 상세 주소에 쓰여서, 한 번 정하면 되도록 바꾸지 마세요.": "ID chỉ gồm chữ thường tiếng Anh · số · dấu -. ID dùng trong đường dẫn, đã đặt thì hạn chế đổi.",
  "대표 사진": "Ảnh đại diện", "가로 사진이 가장 잘 어울려요": "Ảnh ngang là đẹp nhất", "📷 사진 올리기": "📷 Tải ảnh lên", "사진 빼기": "Gỡ ảnh", "또는 사진 주소 직접 입력": "hoặc nhập đường dẫn ảnh",
  "소개": "Giới thiệu", "소개글 (한국어)": "Giới thiệu (tiếng Hàn)", "소개글 (영어)": "Giới thiệu (tiếng Anh)", "소개글 (베트남어)": "Giới thiệu (tiếng Việt)", "이런 분께 추천 (한국어)": "Phù hợp với (tiếng Hàn)", "이런 분께 추천 (영어)": "Phù hợp với (tiếng Anh)", "이런 분께 추천 (베트남어)": "Phù hợp với (tiếng Việt)",
  "태그": "Thẻ", "태그가 없어요.": "Chưa có thẻ.", "＋ 태그 추가": "＋ Thêm thẻ", "위치·영업": "Vị trí · giờ mở cửa", "주소 (한국어)": "Địa chỉ (tiếng Hàn)", "주소 (영어)": "Địa chỉ (tiếng Anh)", "주소 (베트남어)": "Địa chỉ (tiếng Việt)",
  "지도 링크 (구글맵 공유 주소)": "Link bản đồ (link chia sẻ Google Maps)", "지도 좌표 (위도, 경도)": "Tọa độ (vĩ độ, kinh độ)", "'가까운 순' 정렬에 써요": "Dùng để sắp xếp “gần nhất”", "구글 지도에서 업체 건물을": "Trên Google Maps,", "마우스 오른쪽 클릭": "nhấp chuột phải vào tòa nhà",
  "(휴대폰은 길게 누르기)하면 맨 위에 숫자 두 개가 나와요. 그걸 복사해서 붙여 넣으면 정확한 위치가 돼요.": "(điện thoại: nhấn giữ) sẽ hiện 2 số ở trên cùng. Sao chép và dán vào đây để có vị trí chính xác.",
  "구글 지도 연결": "Liên kết Google Maps", "상세페이지에 구글 영업시간·평점·사진·지도가 자동으로 나와요": "Trang chi tiết tự hiện giờ mở cửa · điểm · ảnh · bản đồ từ Google", "🔎 구글에서 찾기": "🔎 Tìm trên Google",
  "여는 시간": "Giờ mở cửa", "닫는 시간": "Giờ đóng cửa", "쉬는 요일": "Ngày nghỉ", "일": "CN", "월": "T2", "화": "T3", "수": "T4", "목": "T5", "금": "T6", "토": "T7",
  "응대 가능 언어": "Ngôn ngữ phục vụ", "한국어": "Tiếng Hàn", "영어": "Tiếng Anh", "베트남어": "Tiếng Việt", "일본어": "Tiếng Nhật", "중국어": "Tiếng Trung", "평점 (0~5, 없으면 0)": "Điểm (0~5, không có thì 0)", "후기 수": "Số đánh giá",
  "메뉴·가격": "Menu · giá", "가격은 베트남 동(₫), 숫자만. 0이면 \"상담 후 안내\"": "Giá tính bằng đồng (₫), chỉ nhập số. 0 = “báo giá khi tư vấn”", "메뉴가 없어요. 메뉴가 없으면 손님 화면에 예약 폼 대신 상담 버튼이 나와요.": "Chưa có menu. Không có menu thì trang khách hiện nút tư vấn thay cho form đặt lịch.", "＋ 메뉴 추가": "＋ Thêm menu",
  "가격표 사진": "Ảnh bảng giá", "업체에서 받은 코스별 가격표를 올려요. 여러 장 한 번에 올릴 수 있어요": "Tải ảnh bảng giá của cửa hàng. Có thể tải nhiều ảnh cùng lúc", "아직 가격표 사진이 없어요.": "Chưa có ảnh bảng giá.", "📄 가격표 사진 올리기": "📄 Tải ảnh bảng giá",
  "글씨가 잘 보이도록 크게 저장해요. 손님은 상세 화면에서 눌러서 크게 볼 수 있어요. 사진마다 이름(예: 마사지 코스, 패키지)을 달아 두면 찾기 쉬워요.": "Lưu ảnh lớn để chữ rõ. Khách có thể bấm để phóng to. Đặt tên cho từng ảnh (vd: gói massage) để dễ tìm.",
  "기타": "Khác", "이름 (예: Chị Lan)": "Tên (vd: Chị Lan)", "전화번호 (예: 0905 123 456)": "Số điện thoại (vd: 0905 123 456)", "예: dahan-spa": "vd: dahan-spa", "https://… 또는 images/파일명.jpg": "https://… hoặc images/tên-file.jpg", "예: 16.06812, 108.22441": "vd: 16.06812, 108.22441", "구글 장소 ID (찾기 버튼으로 넣어요)": "Google Place ID (dùng nút Tìm)",
  "새 업체 · 이름 없음": "Cửa hàng mới · chưa có tên", "이름 없음": "chưa có tên",
  // 영업 보드
  "🤝 업체 영업": "🤝 Bảng theo dõi cửa hàng", "담당자 전체": "Tất cả người phụ trách", "내 것 (담당+참조)": "Của tôi", "나를 참조한 것": "Có nhắc đến tôi", "미지정": "Chưa giao", "＋ 영업 업체 추가": "＋ Thêm cửa hàng tiềm năng", "🏪 등록됨": "🏪 Đã đăng ký", "이동 ▸": "Chuyển ▸", "다른 칸으로 옮기기": "Chuyển sang cột khác",
  "후보 발굴": "Tìm cửa hàng", "찾아 둔 업체": "Cửa hàng đã tìm", "연락함": "Đã liên hệ", "첫 연락·답 기다림": "Liên hệ lần đầu · chờ trả lời", "미팅": "Gặp mặt", "방문·통화 상담": "Đến gặp · gọi điện tư vấn", "계약 협의": "Thương lượng hợp đồng", "수수료·조건 조율": "Thỏa thuận hoa hồng · điều kiện", "계약 완료": "Đã ký hợp đồng", "사이트 등록 준비": "Chuẩn bị đăng lên web", "입점 완료": "Đã lên web", "사이트에 공개됨": "Đã hiển thị trên web", "보류·거절": "Tạm dừng · từ chối", "나중에 다시": "Liên hệ lại sau",
  "업체 카드를 끌거나": "Kéo thẻ cửa hàng hoặc bấm", "을 눌러 단계를 옮겨요. 단계·담당자가 바뀌면 누가 언제 바꿨는지 자동으로 기록돼요. 다음 연락일이 지나면 빨갛게 표시돼요.": "để chuyển bước. Hệ thống tự ghi ai đổi, lúc nào. Quá ngày liên hệ tiếp sẽ hiện màu đỏ.",
  "진행 단계": "Bước hiện tại", "다음 할 일": "Việc tiếp theo", "무엇을": "Việc gì", "언제": "Khi nào", "업체 정보": "Thông tin cửa hàng", "업체 이름": "Tên cửa hàng", "업체 담당자": "Người phụ trách (cửa hàng)", "연락처 (전화·잘로·카톡)": "Liên hệ (điện thoại · Zalo · Kakao)", "우리 담당자": "Người phụ trách (Uncle Day)", "구글 지도 링크": "Link Google Maps",
  "— 미팅 노트, 조건 등 ('/' 또는 📄 템플릿)": "— ghi chú cuộc gặp, điều kiện…", "🏪 사이트에 업체 등록": "🏪 Đăng cửa hàng lên web", "기존 업체와 연결…": "Liên kết với cửa hàng có sẵn…", "연락 기록": "Lịch sử liên hệ", "업체와 연락한 내역": "Các lần liên hệ với cửa hàng", "📞 통화": "📞 Gọi điện", "💬 메시지": "💬 Tin nhắn", "🚶 방문": "🚶 Đến gặp", "📝 메모": "📝 Ghi chú", "· 영업 시작": "· Bắt đầu theo dõi",
  "예: 수수료 15% 제안서 보내기": "vd: gửi đề xuất", "예: 매니저와 통화, 다음 주 화요일 방문 약속": "vd: đã gọi quản lý, hẹn đến thứ Ba tuần sau", "영업 업체 추가": "Thêm cửa hàng tiềm năng", "예: 잘로로 첫 연락": "vd: liên hệ lần đầu qua Zalo", "저장했어요": "Đã lưu",
  "큰 제목": "Tiêu đề lớn", "작은 제목": "Tiêu đề nhỏ", "굵게 (Ctrl+B)": "In đậm (Ctrl+B)", "취소선": "Gạch ngang", "글머리 목록": "Danh sách", "번호 목록": "Danh sách số", "체크리스트": "Checklist", "토글": "Thu gọn", "강조 상자": "Hộp nhấn mạnh", "구분선": "Đường kẻ", "사진 넣기 (붙여넣기·끌어 놓기도 돼요)": "Chèn ảnh (dán · kéo thả)", "크게 쓰기": "Mở rộng",
});
// 숫자가 들어간 문장
ADMIN_VI_RX.push(
  [/^(\d+)곳$/, "$1 cửa hàng"], [/^업체 (\d+)곳 · 100점 (\d+)곳$/, "$1 cửa hàng · $2 đạt 100"], [/^(.+) · 평균 (\d+)점$/, (m, a, b) => `${aviPart(a)} · trung bình ${b} điểm`], [/^(\d+)점$/, "$1 điểm"],
  [/^더 보기 \((\d+)곳 더\)$/, "Xem thêm ($1)"], [/^메뉴 (\d+)\/(\d+) \((\d+)%\) · 업체 (\d+)\/(\d+)$/, "Menu $1/$2 ($3%) · cửa hàng $4/$5"], [/^확인 (\d+) ?\/ ?(\d+)$/, "Đã xác minh $1/$2"],
  [/^(\d+)분$/, "$1 phút"], [/^(\d+)\/(\d+)\((.)\)$/, (m, a, b, w) => `${b}/${a} (${ADMIN_VI[w] || w})`], [/^(\d+)만$/, "$1 vạn"], [/^(.+) \(나\)$/, "$1 (tôi)"], [/^관리자 (.+)$/, "$1"],
);
function aviPart(p) { const k = p.trim(); if (!/[가-힣]/.test(k)) return p; if (ADMIN_VI[k] != null) return p.replace(k, ADMIN_VI[k]); for (const [rx, to] of ADMIN_VI_RX) if (rx.test(k)) return p.replace(k, k.replace(rx, to)); return null; }
// '다낭 · 마사지'처럼 ' · '로 이은 짧은 말: 조각이 모두 사전에 있으면 옮겨요
const aviText0 = aviText;
aviText = function (t) { const r = aviText0(t); if (r != null) return r; const k = t.trim(); if (!k.includes(" · ")) return null; const parts = k.split(" · ").map(aviPart); return parts.every(x => x != null) ? t.replace(k, parts.join(" · ")) : null; };
// 직원 화면에서는 가게 · 메뉴 이름을 베트남어 → 영어 → 한국어 순으로
function adminNm(o) { if (!o) return ""; if (typeof o === "string") return o; return ALANG === "vi" && typeof IS_FIELD === "function" && IS_FIELD() ? (o.vi || o.en || o.ko || "") : (o.ko || o.en || o.vi || ""); }

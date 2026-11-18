/* 📒 현장 영업 매뉴얼 — 포털 안 (#ptField)
 * 베트남 현지 영업 담당자가 가게를 돌며 할 일을 베트남어 · 한국어로 정리해요.
 *  - 담당자는 관리자 페이지에 로그인하지 않아요 → [📋 잘로로 보낼 글 복사] · [🖨️ 인쇄 · PDF] 로 전달해요.
 *  - 로그인이 필요한 일(사장님 계정 · 계약서 · QR 카드 · 사진 · 가격 올리기)은 담당자가 받아 온 자료로 관리자가 포털에서 해요 (한국어 '관리자 할 일').
 *  - 수수료율 같은 숫자는 넣지 않아요 (계약서에만).
 */
const FLD = { lang: "vi", open: 0 };
const FLD_DEMO = "https://www.uncleday.com/demo.html?role=owner&lang=vi";
const FLD_INTRO = "https://www.uncleday.com/gioi-thieu.html";   // 사장님께 보여 주는 소개 자료 (베트남어 · 한국어 전환)
const FLD_SECS = [
  { ic: "🧭", go: null,
    vi: ["Uncle Day là gì? (giới thiệu 1 phút)", [
      "Uncle Day là trang đặt lịch bằng tiếng Hàn cho khách du lịch Hàn Quốc ở Việt Nam (massage, spa, nail, tóc, chăm sóc da…).",
      "Khách Hàn xem giá, ảnh và đặt lịch bằng tiếng Hàn. Uncle Day gửi yêu cầu cho cửa hàng qua Zalo.",
      "Cửa hàng chỉ cần bấm “Nhận được” hoặc “Không nhận được”. Khách đến và thanh toán trực tiếp tại cửa hàng.",
      "Phí: cửa hàng trả hoa hồng theo % trên số tiền khách đã thanh toán — chỉ với khách do Uncle Day gửi đến và đã đến cửa hàng. Tỷ lệ ghi trong hợp đồng. Cuối tháng Uncle Day gửi bảng quyết toán.",
      "Cửa hàng còn được: trang giới thiệu bằng tiếng Hàn · Anh · Việt, hiện trên Google, mã QR menu tiếng Hàn, và trang quản lý lịch hẹn miễn phí.",
    ]],
    ko: ["엉클데이는 무엇인가요? (1분 소개)", [
      "베트남을 여행하는 한국 손님이 한국어로 마사지 · 스파 · 네일 · 헤어 · 피부관리를 예약하는 사이트예요.",
      "손님은 한국어로 가격 · 사진을 보고 예약하고, 엉클데이가 가게에 잘로로 요청을 보내요.",
      "가게는 '받을 수 있음 / 없음'만 누르면 돼요. 손님은 가게에 와서 가게에 직접 결제해요.",
      "비용: 엉클데이가 보낸 손님이 실제로 방문해서 결제한 금액의 % 수수료만 받아요. 비율은 계약서에 적어요. 월말에 정산서를 보내요.",
      "가게가 덤으로 얻는 것: 한 · 영 · 베 3개 언어 소개 페이지, 구글 노출, 한국어 메뉴 QR, 무료 예약 관리 화면",
    ]] },
  { ic: "🎒", go: null,
    vi: ["Trước khi đi", [
      "Nhận danh sách cửa hàng cần đến hôm nay từ quản lý (qua Zalo).",
      "Mở sẵn tài liệu giới thiệu để cho chủ tiệm xem (lướt từng trang): " + FLD_INTRO,
      "Mở sẵn trang dùng thử trên điện thoại để cho chủ tiệm xem: " + FLD_DEMO,
      "Nếu cửa hàng đã có trang trên Uncle Day, quản lý sẽ gửi link — cho chủ tiệm xem “Cửa hàng của anh/chị đã có trên Uncle Day”.",
      "Pin điện thoại đầy · mặc gọn gàng · đi vào giờ vắng khách (thường 10–14 giờ).",
    ]],
    ko: ["가기 전에", [
      "오늘 갈 가게 목록을 관리자에게 잘로로 받아요.",
      "사장님께 보여 줄 소개 자료를 휴대폰에 미리 열어 둬요 (한 장씩 넘겨 보기): " + FLD_INTRO,
      "사장님께 보여 줄 체험판을 휴대폰에 미리 열어 둬요: " + FLD_DEMO,
      "이미 엉클데이에 올라가 있는 가게(미입점 페이지)라면 관리자가 그 링크를 보내 줘요 — '사장님 가게가 벌써 엉클데이에 있어요'라고 보여 주기.",
      "휴대폰 충전 · 단정한 옷차림 · 손님 적은 시간(보통 10~14시)에 방문",
    ]],
    admin: "관리자 할 일: 🤝 낙서장 → 업체 영업 보드에서 오늘 갈 가게를 골라 담당자에게 잘로로 보내기. 미입점 가게는 /p/ 페이지 링크를 같이 보내요." },
  { ic: "💬", go: null,
    vi: ["Tại cửa hàng — nói gì?", [
      "“Chào anh/chị, em là … từ Uncle Day. Bên em gửi khách du lịch Hàn Quốc đến cửa hàng. Khách đặt lịch bằng tiếng Hàn, cửa hàng chỉ cần bấm nhận lịch trên Zalo.”",
      "Cho xem trang dùng thử: lịch hẹn mới → bấm “Nhận được” → khách đến → bấm “Đã đến” và nhập số tiền.",
      "Hỏi: “Cửa hàng mình có nhiều khách Hàn không? Có nhân viên nói tiếng Hàn / tiếng Anh không?”",
      "Nếu chủ tiệm chưa quyết: để lại số Zalo, hẹn ngày gọi lại. Không ép.",
    ]],
    ko: ["가게에서 — 이렇게 말해요", [
      "\"안녕하세요, 엉클데이에서 온 ○○예요. 저희는 한국 여행객 손님을 가게로 보내 드려요. 손님은 한국어로 예약하고, 가게는 잘로에서 예약만 받아 주시면 돼요.\"",
      "체험판 보여 주기: 새 예약 → '받을 수 있음' → 손님 방문 → '방문 완료'와 결제 금액 입력",
      "물어보기: \"한국 손님이 많이 오나요? 한국어 · 영어 하는 직원이 있나요?\"",
      "결정을 못 하시면 잘로 번호만 받고 다시 연락할 날을 정해요. 밀어붙이지 않기.",
    ]] },
  { ic: "📝", go: "fill",
    vi: ["Thông tin cần lấy (đánh dấu từng mục)", [
      "☐ Tên cửa hàng chính xác (tiếng Việt + tiếng Anh nếu có)",
      "☐ Link Google Maps của cửa hàng (để vị trí chính xác)",
      "☐ Giờ mở cửa – đóng cửa, ngày nghỉ",
      "☐ Ảnh bảng giá / menu (đủ giá và thời gian từng dịch vụ)",
      "☐ 3–5 ảnh đẹp: mặt tiền, phòng, quầy. HỎI TRƯỚC: “Uncle Day đăng ảnh này lên trang của cửa hàng được không?”",
      "☐ Điểm nổi bật: phòng đôi, nhân viên nói tiếng Hàn/Anh, giữ hành lý, đưa đón, mở khuya…",
      "☐ Số Zalo nhận lịch hẹn + tên người phụ trách",
      "☐ Số chỗ phục vụ cùng lúc (mấy giường / mấy khách cùng lúc)",
    ]],
    ko: ["받아 올 정보 (하나씩 체크)", [
      "☐ 정확한 가게 이름 (베트남어 + 영어 이름 있으면)",
      "☐ 가게 구글 지도 링크 (정확한 위치용)",
      "☐ 여는 시간 · 닫는 시간 · 쉬는 날",
      "☐ 가격표 · 메뉴판 사진 (시술별 가격과 시간이 다 보이게)",
      "☐ 사진 3~5장: 입구 · 룸 · 카운터. 먼저 물어보기: \"이 사진을 엉클데이 가게 페이지에 올려도 될까요?\"",
      "☐ 자랑거리: 커플룸, 한국어 · 영어 직원, 짐 보관, 픽업, 늦게까지 영업 등",
      "☐ 예약 받을 잘로 번호 + 담당자 이름",
      "☐ 동시에 받을 수 있는 인원 (베드 몇 개 / 몇 명까지)",
    ]],
    admin: "관리자 할 일: 받은 자료로 업체 창 열어 이름 · 위치 · 영업시간 · 사진 · 태그 입력, 가격은 💰 가격 채우기. 빈 칸은 📋 가게 정보 채우기에서 확인." },
  { ic: "📄", go: null,
    vi: ["Hợp đồng", [
      "Quản lý sẽ gửi hợp đồng (PDF) qua Zalo hoặc email cho chủ tiệm — đã điền sẵn tên cửa hàng và tỷ lệ hoa hồng.",
      "Khi chủ tiệm ký xong: chụp rõ từng trang và gửi cho quản lý.",
      "Giấy tờ (giấy phép kinh doanh, CCCD…) chỉ gửi riêng cho quản lý. Không gửi vào nhóm chat, không lưu trong điện thoại lâu.",
      "Không tự hứa tỷ lệ hoa hồng khác với hợp đồng.",
    ]],
    ko: ["계약서", [
      "관리자가 가게 이름 · 수수료율이 들어간 계약서 PDF를 사장님께 잘로 · 메일로 보내요.",
      "사장님이 서명하면 모든 쪽을 선명하게 찍어서 관리자에게 보내요.",
      "서류(사업자등록증 · 신분증 등)는 관리자에게만 따로 보내요. 단체방에 올리지 않고, 휴대폰에 오래 두지 않아요.",
      "계약서와 다른 수수료를 약속하지 않아요.",
    ]],
    admin: "관리자 할 일: 업체 편집 → 💼 계약·정산 → 📄 계약서 만들기·보내기. 서명본은 영업 카드 📎에 올리고 '✅ 서명 받음' 표시. 신분증은 비공개 보관함에만." },
  { ic: "🔗", go: "links",
    vi: ["Gắn link & mã QR", [
      "Quản lý gửi cho cửa hàng tin nhắn hướng dẫn + link đặt lịch riêng của cửa hàng.",
      "Giúp chủ tiệm dán link vào Google Maps (mục “Đường liên kết đặt lịch hẹn”), nút “Đặt ngay” trên Facebook, phần giới thiệu Zalo / Instagram.",
      "In thẻ QR (quản lý gửi ảnh) và đặt cạnh menu / ở cửa ra vào. Khách Hàn quét để xem menu và giá bằng tiếng Hàn — nhân viên chỉ cần nhìn món khách chỉ. Khách cũng dùng mã này để đặt lịch lần sau hoặc gửi cho bạn bè.",
      "Việc này giúp cửa hàng hiện tốt hơn trên Google.",
    ]],
    ko: ["링크 · QR 달기", [
      "관리자가 가게 전용 예약 링크와 안내문을 가게에 보내요.",
      "사장님 옆에서 구글 지도('예약 링크' 칸) · 페이스북 '지금 예약' 버튼 · 잘로 · 인스타 소개에 링크 넣는 걸 도와드려요.",
      "QR 카드(관리자가 이미지로 보내 줌)를 인쇄해 메뉴판 옆 · 입구에 둬요. 한국 손님이 찍으면 한국어 메뉴 · 가격이 열려서, 직원은 손님이 가리키는 메뉴만 보면 돼요. 다음 방문 예약 · 일행 공유에도 써요.",
      "이렇게 하면 가게가 구글에 더 잘 나와요.",
    ]],
    admin: "관리자 할 일: 🔗 가게에 링크 달기 → 가게 고르기 → 베트남어 안내문 복사 · 🧾 QR 카드 내려받기 → 담당자 · 사장님께 잘로로 보내기." },
  { ic: "📱", go: "shops",
    vi: ["Hướng dẫn chủ tiệm dùng", [
      "Khi có lịch hẹn mới, cửa hàng nhận tin Zalo → bấm link → “Nhận được” hoặc “Không nhận được” (trả lời trong 30 phút).",
      "Khi khách đã đến: bấm “Đã đến” và nhập số tiền khách thanh toán.",
      "Trang quản lý cửa hàng: www.uncleday.com/owner — đăng nhập bằng số điện thoại + mật khẩu (quản lý gửi riêng). Ở đây đặt giờ mở cửa, ngày nghỉ, khóa giờ kín lịch.",
      "Nhân viên dùng trang nhân viên với mã PIN (quản lý gửi riêng).",
    ]],
    ko: ["사장님께 쓰는 법 알려 드리기", [
      "새 예약이 오면 잘로 메시지 → 링크 누르기 → '받을 수 있음 / 없음' (30분 안에 답하기)",
      "손님이 다녀가면 '방문 완료'를 누르고 결제 금액 입력",
      "사장님 페이지: www.uncleday.com/owner — 전화번호 + 비밀번호로 로그인 (관리자가 따로 보냄). 영업시간 · 휴무 · 꽉 찬 시간 막기",
      "직원은 PIN으로 직원 화면을 써요 (관리자가 따로 보냄)",
    ]],
    admin: "관리자 할 일: 업체 편집 → 👤 사장님 페이지 계정 만들기, 포털 → 🏪 매장별 관리에서 직원 PIN. 비밀번호 · PIN은 사장님께 직접 보내요 (담당자 단체방 X)." },
  { ic: "📤", go: null,
    vi: ["Sau mỗi cửa hàng — báo cáo cho quản lý (trong ngày)", [
      "Gửi qua Zalo theo mẫu ở dưới: tên cửa hàng · kết quả · thông tin đã lấy · ảnh menu · ảnh cửa hàng · ngày hẹn gọi lại.",
      "Kết quả: ✅ Đồng ý / 🤔 Đang suy nghĩ / ❌ Từ chối (ghi lý do).",
    ]],
    ko: ["가게마다 — 관리자에게 보고 (그날 안에)", [
      "아래 양식으로 잘로 보내기: 가게 이름 · 결과 · 받은 정보 · 메뉴판 사진 · 가게 사진 · 다시 연락할 날",
      "결과: ✅ 동의 / 🤔 고민 중 / ❌ 거절 (이유 적기)",
    ]],
    admin: "관리자 할 일: 보고를 받으면 🤝 업체 영업 보드에서 단계 옮기기 · 연락 기록 · 다음 연락일 적기." },
  { ic: "🚫", go: null,
    vi: ["Không được làm", [
      "Không hứa số lượng khách.",
      "Không nói sai về phí, không hứa tỷ lệ khác hợp đồng.",
      "Không chụp ảnh cửa hàng khi chưa xin phép. Không chụp khách đang dùng dịch vụ.",
      "Không nhận tiền mặt của cửa hàng.",
      "Không xin / không ghi thông tin cá nhân của khách hàng.",
      "Không nói xấu cửa hàng khác hay trang khác.",
    ]],
    ko: ["하면 안 되는 것", [
      "손님 수를 약속하지 않기",
      "비용을 다르게 말하거나 계약서와 다른 비율을 약속하지 않기",
      "허락 없이 가게 사진 찍지 않기. 시술 중인 손님 찍지 않기",
      "가게에서 현금 받지 않기",
      "손님 개인정보를 묻거나 적지 않기",
      "다른 가게 · 다른 사이트 험담하지 않기",
    ]] },
  { ic: "❓", go: null,
    vi: ["Chủ tiệm hay hỏi", [
      "“Tôi không biết tiếng Hàn?” → Không sao. Tin nhắn và trang quản lý bằng tiếng Việt; Uncle Day nói chuyện với khách bằng tiếng Hàn.",
      "“Khách hủy thì sao?” → Uncle Day báo cho cửa hàng qua Zalo. Không có phí với lịch bị hủy.",
      "“Có cần máy tính không?” → Không, chỉ cần điện thoại có Zalo.",
      "“Khi nào trả hoa hồng?” → Cuối tháng Uncle Day gửi bảng quyết toán theo số khách đã đến; cửa hàng chuyển khoản.",
      "“Khách Uncle Day có để lại đánh giá Google không?” → Có. Sau khi viết đánh giá trên Uncle Day, khách thấy nút “Đánh giá trên Google” — nội dung được sao chép sẵn, khách chỉ cần chọn sao và dán. Số lần bấm hiện trong trang quản lý cửa hàng.",
      "“Giá trên Uncle Day có khác giá ở cửa hàng không?” → Dùng đúng giá của cửa hàng. Nếu đổi giá, báo quản lý để cập nhật.",
    ]],
    ko: ["사장님이 자주 묻는 것", [
      "\"한국어를 몰라요\" → 괜찮아요. 메시지와 사장님 화면은 베트남어고, 손님과는 엉클데이가 한국어로 이야기해요.",
      "\"손님이 취소하면요?\" → 엉클데이가 잘로로 알려 드려요. 취소된 예약은 수수료가 없어요.",
      "\"컴퓨터가 필요해요?\" → 아니요, 잘로 되는 휴대폰이면 돼요.",
      "\"수수료는 언제 내요?\" → 월말에 방문한 손님 기준으로 정산서를 보내 드리고, 계좌로 보내 주시면 돼요.",
      "\"엉클데이 손님도 구글 후기를 남겨요?\" → 네. 엉클데이에 후기를 쓰면 ‘구글에도 남기기’ 버튼이 떠요. 쓴 글이 복사돼서 손님은 별 누르고 붙여 넣기만 하면 돼요. 누른 수는 사장님 화면에서 보여요.",
      "\"엉클데이 가격이 가게 가격이랑 달라요?\" → 가게 가격 그대로 써요. 가격이 바뀌면 관리자에게 알려 주세요.",
    ]] },
];
const FLD_REPORT = {
  vi: `📋 BÁO CÁO CỬA HÀNG
Tên cửa hàng:
Địa chỉ / link Google Maps:
Kết quả: ✅ Đồng ý / 🤔 Đang suy nghĩ / ❌ Từ chối
Lý do (nếu từ chối / suy nghĩ):
Người phụ trách + số Zalo:
Giờ mở – đóng / ngày nghỉ:
Điểm nổi bật:
Số khách phục vụ cùng lúc:
Đã gửi kèm: ☐ ảnh menu  ☐ ảnh cửa hàng (đã xin phép)  ☐ hợp đồng đã ký
Hẹn gọi lại ngày:`,
  ko: `📋 가게 방문 보고
가게 이름:
주소 / 구글 지도 링크:
결과: ✅ 동의 / 🤔 고민 중 / ❌ 거절
이유 (거절 · 고민일 때):
담당자 + 잘로 번호:
여는 시간 – 닫는 시간 / 쉬는 날:
자랑거리:
동시에 받을 수 있는 인원:
함께 보냄: ☐ 메뉴판 사진  ☐ 가게 사진 (허락받음)  ☐ 서명한 계약서
다시 연락할 날:`,
};
function fldText(l) {
  return `📒 UNCLE DAY — ${l === "vi" ? "SỔ TAY ĐI THỊ TRƯỜNG" : "현장 영업 매뉴얼"}\n\n` + FLD_SECS.map((s, i) => `${s.ic} ${i + 1}. ${s[l][0]}\n` + s[l][1].map(x => (x.startsWith("☐") ? "" : "• ") + x).join("\n")).join("\n\n") + `\n\n${l === "vi" ? "✉️ MẪU BÁO CÁO (sao chép và điền)" : "✉️ 보고 양식 (복사해서 채우기)"}\n${FLD_REPORT[l]}`;
}
function fldPrint(l) {
  const w = window.open("", "_blank"); if (!w) return toast("팝업이 막혀 있어요. 브라우저에서 팝업을 허용해 주세요");
  const e = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  w.document.write(`<!doctype html><html lang="${l}"><head><meta charset="utf-8"><title>Uncle Day — ${l === "vi" ? "Sổ tay đi thị trường" : "현장 영업 매뉴얼"}</title>
    <style>body{font-family:"Be Vietnam Pro","Noto Sans KR",Arial,sans-serif;color:#0E2843;max-width:760px;margin:24px auto;padding:0 18px;line-height:1.55;font-size:14px}h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:18px 0 6px;border-bottom:2px solid #FD6A00;padding-bottom:3px}ul{margin:0;padding-left:18px}li{margin:3px 0}li.ck{list-style:none;margin-left:-18px}pre{white-space:pre-wrap;font:inherit;border:1px dashed #999;border-radius:8px;padding:10px}.sub{color:#5b6676}@media print{h2{break-after:avoid}section{break-inside:avoid}}</style></head><body>
    <h1>📒 Uncle Day — ${l === "vi" ? "Sổ tay đi thị trường" : "현장 영업 매뉴얼"}</h1><p class="sub">www.uncleday.com · ${new Date().toISOString().slice(0, 10)}</p>
    ${FLD_SECS.map((s, i) => `<section><h2>${s.ic} ${i + 1}. ${e(s[l][0])}</h2><ul>${s[l][1].map(x => `<li class="${x.startsWith("☐") ? "ck" : ""}">${e(x)}</li>`).join("")}</ul></section>`).join("")}
    <section><h2>✉️ ${l === "vi" ? "Mẫu báo cáo" : "보고 양식"}</h2><pre>${e(FLD_REPORT[l])}</pre></section>
    <script>setTimeout(function(){print()},400)<\/script></body></html>`);
  w.document.close();
}
function fieldDraw() {
  const el = document.getElementById("ptField"); if (!el) return;
  const l = FLD.lang, o = l === "vi" ? "ko" : "vi";
  el.innerHTML = `<p class="hint" style="margin-top:0">베트남 현지 영업 담당자가 가게를 돌 때 보는 설명서예요. 담당자는 관리자 페이지에 들어오지 않으니 <b>[📋 잘로로 보낼 글 복사]</b>나 <b>[🖨️ 인쇄 · PDF]</b>로 보내 주세요. 회색 '관리자 할 일'은 담당자가 받아 온 자료로 우리가 포털에서 하는 일이에요 (보낼 글에는 안 들어가요).</p>
    <div class="fld-bar"><div class="br-cats"><button class="${l === "vi" ? "on" : ""}" data-flang="vi">🇻🇳 베트남어</button><button class="${l === "ko" ? "on" : ""}" data-flang="ko">🇰🇷 한국어</button></div>
      <span class="fld-act"><button class="btn sm main" data-fcopyall>📋 잘로로 보낼 글 복사</button><button class="btn sm" data-fprint>🖨️ 인쇄 · PDF</button><button class="btn sm" data-freport>✉️ 보고 양식 복사</button><a class="btn sm" href="${FLD_DEMO}" target="_blank" rel="noopener">체험판 열기 ↗</a></span></div>
    <div class="fld-intro"><span>📊 <b>사장님 소개 자료</b> <small>가게에서 휴대폰으로 넘겨 보여 주는 10장 · 베트남어/한국어 · 사장님께 링크로 보내도 돼요</small></span><span class="fld-act"><a class="btn sm main" href="${FLD_INTRO}?lang=${l}" target="_blank" rel="noopener">소개 자료 열기 ↗</a><button class="btn sm" data-fintro>🔗 링크 복사 (잘로로 보내기)</button></span></div>
    <div class="fld-list">${FLD_SECS.map((s, i) => `<div class="fld-s ${FLD.open === i ? "open" : ""}"><button class="fld-h" data-fopen="${i}"><span class="ic">${s.ic}</span><span><b>${i + 1}. ${esc(s[l][0])}</b><small>${esc(s[o][0])}</small></span><i>${FLD.open === i ? "▲" : "▼"}</i></button>
      ${FLD.open === i ? `<div class="fld-b"><ul>${s[l][1].map(x => `<li class="${x.startsWith("☐") ? "ck" : ""}">${esc(x)}</li>`).join("")}</ul>
        ${s.admin ? `<p class="fld-ad">🛠️ ${esc(s.admin)}${s.go ? ` <button class="btn sm" data-fgo="${s.go}">${esc(portalApp(s.go)[1] + " " + portalApp(s.go)[2])} 열기 →</button>` : ""}</p>` : ""}</div>` : ""}</div>`).join("")}</div>`;
  el.querySelectorAll("[data-flang]").forEach(b => b.onclick = () => { FLD.lang = b.dataset.flang; fieldDraw(); });
  el.querySelectorAll("[data-fopen]").forEach(b => b.onclick = () => { const i = +b.dataset.fopen; FLD.open = FLD.open === i ? -1 : i; fieldDraw(); });
  el.querySelectorAll("[data-fgo]").forEach(b => b.onclick = () => portalGo(b.dataset.fgo));
  el.querySelector("[data-fcopyall]").onclick = () => portalCopy(fldText(FLD.lang));
  el.querySelector("[data-freport]").onclick = () => portalCopy(FLD_REPORT[FLD.lang]);
  el.querySelector("[data-fprint]").onclick = () => fldPrint(FLD.lang);
  el.querySelector("[data-fintro]").onclick = () => portalCopy(FLD.lang === "vi" ? `Uncle Day — giới thiệu cho cửa hàng 👉 ${FLD_INTRO}` : `엉클데이 입점 소개 자료 👉 ${FLD_INTRO}?lang=ko`);
}

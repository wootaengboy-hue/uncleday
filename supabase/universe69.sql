-- ===============================================================
-- universe69: 📌 '방문 전 참고사항' (shop.notice) — 닥터 꽝뚜언 성형외과
--  · 새 칸: 업체 편집 → 소개 → '📌 방문 전 참고사항' (한국어 · 영어 · 베트남어) · 비우면 안 나와요
--  · 손님 화면: 영업시간 · 지도 바로 아래 파란 칸
--  · 여러 번 실행해도 같아요 · ⚠️ 실행 뒤 열어 둔 관리자 화면은 새로고침(F5)
-- ===============================================================
update public.shops
   set data = data || jsonb_build_object('notice', jsonb_build_object(
     'ko', E'닥터 꽝뚜언 원장님은 호치민(시티 국제병원 · 협력 클리닉)과 하노이(박하 국제병원)를 오가며 수술과 상담을 해요.\n병원 운영 시간이라도 원장님 수술 일정에 따라 당일 현장 상담이 어려울 수 있어요.\n방문할 날짜와 시간을 먼저 예약하고 오시는 게 가장 정확해요.',
     'en', E'Dr. Quang Tuan works between Ho Chi Minh City (City International Hospital and partner clinics) and Hanoi (Bac Ha International Hospital).\nEven during opening hours, a same-day walk-in consultation may not be possible because of his surgery schedule.\nPlease book your visit date and time in advance.',
     'vi', E'Bác sĩ Quang Tuấn làm việc luân phiên tại TP. Hồ Chí Minh (Bệnh viện Quốc tế City và phòng khám liên kết) và Hà Nội (Bệnh viện Quốc tế Bắc Hà).\nDù trong giờ hoạt động, có thể không tư vấn trực tiếp trong ngày do lịch phẫu thuật của bác sĩ.\nVui lòng đặt lịch ngày giờ đến trước.'))
 where id = 'dr-quang-tuan';

select id, data->'notice'->>'ko' as notice from public.shops where id = 'dr-quang-tuan';

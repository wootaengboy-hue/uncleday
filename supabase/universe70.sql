-- ===============================================================
-- universe70: 🏥 닥터 탄호아 (dr-thanh-hoa) → 닥터 후인 탄 호아 · JW 한국병원 (2026-11-28)
--  출처: JW 병원 공식 의료진 소개 (benhvienjw.vn/en/doctor-profile/dr-huynh-thanh-hoa-…) + 대표님 조사 (진료시간)
--  · 이름 · 주소(1군 JW 병원) · 정확한 좌표 · 구글 지도(JW 병원과 같은 장소) · 요일별 진료시간 · 소개 · 태그 · 메뉴 · 방문 전 참고사항
--  · 의료 광고가 되지 않게 '잘한다 · 안전하다' 같은 말은 빼고 사실만 써요 · 전화번호는 넣지 않아요 (예약은 엉클데이로)
--  · 바꾸기 전 값은 shop_sources.crawled.before_u70 에 통째로 백업
--  ⚠️ 실행 뒤 열어 둔 관리자 화면은 새로고침(F5) 해 주세요
-- ===============================================================
insert into public.shop_sources (shop_id, crawled)
select 'dr-thanh-hoa', '{}'::jsonb where not exists (select 1 from public.shop_sources where shop_id = 'dr-thanh-hoa');
update public.shop_sources src
   set crawled = coalesce(src.crawled, '{}'::jsonb) || jsonb_build_object('before_u70', s.data)
  from public.shops s
 where s.id = src.shop_id and s.id = 'dr-thanh-hoa'
   and not (coalesce(src.crawled, '{}'::jsonb) ? 'before_u70');

update public.shops
   set data = (data - 'geoApprox') || $j${
     "name": {"ko": "닥터 후인 탄 호아 (JW 한국병원)", "en": "Dr. Huynh Thanh Hoa (JW Korea Hospital)", "vi": "ThS.BS. Huỳnh Thanh Hòa (Bệnh viện JW Hàn Quốc)"},
     "address": {
       "ko": "JW 한국병원 · 44–50 Tôn Thất Tùng, Bến Thành, Quận 1, TP. Hồ Chí Minh",
       "en": "JW Korea Hospital · 44–50 Ton That Tung, Ben Thanh, District 1, Ho Chi Minh City",
       "vi": "Bệnh viện JW Hàn Quốc · 44–50 Tôn Thất Tùng, Bến Thành, Quận 1, TP. Hồ Chí Minh"},
     "geo": [10.769773, 106.689188],
     "gplace": "ChIJ6do8IT0vdTERXCEtpaeSgRI",
     "hours": {"1": [["08:00", "18:00"]], "2": [["08:00", "18:00"]], "3": [["08:00", "18:00"]], "4": [["08:00", "18:00"]], "5": [["08:00", "18:00"]], "6": [["08:00", "17:00"]], "0": [["08:00", "12:00"]]},
     "open": "08:00", "close": "18:00", "closed": [],
     "staffLangs": ["vi", "en"],
     "desc": {
       "ko": "호치민 1군 JW 한국병원에서 진료하는 성형외과 전문의예요 (석사 · 1급 전문의).\n성형 · 미용외과와 종양외과를 함께 보고, 가슴 성형 · 눈 성형 · 안면 · 목 거상을 해요.\n개인 의원이 아니라 JW 병원 안의 수술실과 마취과에서 수술해요.",
       "en": "A plastic surgeon (MSc, Specialist Level I) practising at JW Korea Hospital in District 1, Ho Chi Minh City.\nCovers aesthetic and oncologic surgery — breast augmentation, eyelid surgery, face and neck lifts.\nSurgery is done in JW Hospital's own operating rooms with its anaesthesia team, not in a private clinic.",
       "vi": "Bác sĩ phẫu thuật thẩm mỹ (ThS.BS.CKI) làm việc tại Bệnh viện JW Hàn Quốc, Quận 1, TP. Hồ Chí Minh.\nThực hiện phẫu thuật thẩm mỹ và ung bướu — nâng ngực, phẫu thuật mắt, căng da mặt và cổ.\nPhẫu thuật tại phòng mổ và khoa gây mê của Bệnh viện JW."},
     "recommend": {"ko": "가슴 성형 · 눈 성형을 큰 병원에서 받고 싶은 분", "en": "Those who want breast or eyelid surgery at a large hospital", "vi": "Người muốn phẫu thuật ngực, mắt tại bệnh viện lớn"},
     "tags": [
       {"ko": "가슴 성형", "en": "Breast surgery", "vi": "Phẫu thuật ngực"},
       {"ko": "눈 성형", "en": "Eyelid surgery", "vi": "Phẫu thuật mắt"},
       {"ko": "안면 · 목 거상", "en": "Face & neck lift", "vi": "Căng da mặt & cổ"},
       {"ko": "1군 JW 한국병원", "en": "JW Korea Hospital, District 1", "vi": "Bệnh viện JW, Quận 1"}],
     "menu": [
       {"min": 30, "price": 0, "name": {"ko": "상담", "en": "Consultation", "vi": "Tư vấn"},
        "desc": {"ko": "원하는 수술 · 비용 · 일정을 먼저 이야기해요", "en": "Talk through the procedure, cost and schedule first", "vi": "Trao đổi trước về phẫu thuật, chi phí và lịch"}},
       {"min": 0, "price": 0, "name": {"ko": "가슴 성형 (보형물)", "en": "Breast augmentation (implants)", "vi": "Nâng ngực (túi độn)"},
        "desc": {"ko": "몸에 맞춰 크기 · 모양을 정해요", "en": "Size and shape planned to your body", "vi": "Kích thước, hình dáng theo cơ thể"},
        "more": {"ko": "병원이 안내하는 방법 두 가지가 있어요.\n① 유선 조직을 보존하는 방법: 풍선 박리기로 보형물 자리를 만들고, 보형물이 손에 닿지 않게 넣는 깔때기를 써요.\n② 내시경 방법: 내시경 카메라와 3D 시뮬레이션으로 보형물을 고르고 자리를 만들어요.\n어떤 방법이 맞는지는 상담 때 정해요.",
                 "en": "The hospital describes two approaches.\n① Glandular tissue preservation: a balloon dissector creates the implant pocket and a no-touch funnel is used to insert the implant.\n② Endoscopic: an endoscopic camera and 3D simulation help choose the implant and create the pocket.\nThe right approach is decided at consultation.",
                 "vi": "Bệnh viện giới thiệu hai phương pháp.\n① Bảo tồn mô tuyến: dùng bóng bóc tách tạo khoang và phễu đặt túi không chạm.\n② Nội soi: camera nội soi và mô phỏng 3D giúp chọn túi và tạo khoang.\nPhương pháp phù hợp sẽ được quyết định khi tư vấn."}},
       {"min": 0, "price": 0, "name": {"ko": "가슴 재수술 상담", "en": "Breast revision consultation", "vi": "Tư vấn sửa ngực"},
        "desc": {"ko": "구형구축 · 보형물 문제 등 재수술 상담", "en": "For capsular contracture, implant issues and other revisions", "vi": "Co thắt bao xơ, sự cố túi độn…"}},
       {"min": 0, "price": 0, "name": {"ko": "눈 성형 (상 · 하안검)", "en": "Eyelid surgery (upper / lower)", "vi": "Phẫu thuật mí (trên / dưới)"},
        "desc": {"ko": "처진 눈꺼풀 · 눈 밑 지방 · 남는 피부 정리", "en": "Drooping lids, under-eye fat and excess skin", "vi": "Mí sụp, bọng mỡ, da thừa"}},
       {"min": 0, "price": 0, "name": {"ko": "안면 · 목 거상", "en": "Face & neck lift", "vi": "Căng da mặt & cổ"},
        "desc": {"ko": "처진 얼굴 · 목 피부와 깊은 주름 상담", "en": "Sagging face and neck skin, deep lines", "vi": "Da mặt, cổ chảy xệ, nếp nhăn sâu"}}
     ],
     "notice": {
       "ko": "원장님 진료와 수술은 모두 1군 JW 한국병원에서 해요.\n수술 일정이 있어 방문 날짜와 시간을 먼저 예약하고 오시는 게 가장 정확해요.\n한국어 통역은 날짜마다 따로 배정돼요. 필요하면 예약할 때 꼭 말씀해 주세요.",
       "en": "All consultations and surgeries take place at JW Korea Hospital in District 1.\nBecause of the surgery schedule, please book your visit date and time in advance.\nA Korean interpreter is arranged per date — let us know when booking if you need one.",
       "vi": "Mọi buổi tư vấn và phẫu thuật đều tại Bệnh viện JW Hàn Quốc, Quận 1.\nDo lịch phẫu thuật, vui lòng đặt lịch ngày giờ đến trước.\nPhiên dịch tiếng Hàn được sắp xếp theo ngày — vui lòng báo khi đặt lịch nếu cần."}
   }$j$::jsonb
 where id = 'dr-thanh-hoa';

select id, data->'name'->>'ko' as name, data->'address'->>'ko' as address, jsonb_array_length(data->'menu') as menus from public.shops where id = 'dr-thanh-hoa';

-- 되돌리기 (필요할 때만):
-- update public.shops s set data = src.crawled->'before_u70' from public.shop_sources src where src.shop_id = s.id and s.id = 'dr-thanh-hoa' and src.crawled ? 'before_u70';

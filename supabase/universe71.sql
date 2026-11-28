-- ===============================================================
-- universe71: 🔀 같은 병원 두 업체 합치기 — 'JW 코리아 성형외과' + '닥터 후인 탄 호아' → JW 한국병원 하나로 (2026-11-28)
--  · 남는 업체: jw-korea-hospital (이름 → JW 한국병원 성형외과)
--      진료시간 · 정확한 위치 · 소개 · 메뉴 · 태그 · 방문 전 참고사항 · 언어 = universe70 에서 정리한 내용 + 원장님 소개
--      엉덩이 리프팅은 JW 공식 소개에서 확인 전이라 '상담 후 안내'로 남겨요
--  · 숨기는 업체: dr-thanh-hoa (지우지 않아요 · 손님 목록에서만 빠짐)
--      예전 주소(/s/dr-thanh-hoa/ · shop.html#dr-thanh-hoa)로 오면 JW 페이지로 바로 넘어가요 (data.aliases)
--  · 검색어: '탄호아 · 타인호아 · 닥터탄화 …'로 찾아도 JW 가 나오게 옮겨요
--  · 사진: 닥터 탄호아에 올린 사진은 JW 로 옮기고 '보류' + 메모 (예전 주소가 반쩐 병원이라 JW 사진이 맞는지 한 번 봐 주세요)
--  · 바꾸기 전 값은 shop_sources.crawled.before_u71 에 백업 (되돌리기 SQL 은 맨 아래 주석)
--  ⚠️ universe70 을 먼저 실행한 뒤에 실행해 주세요 · 실행 뒤 관리자 화면은 새로고침(F5)
-- ===============================================================

-- 1) 백업 (처음 한 번만)
insert into public.shop_sources (shop_id, crawled)
select x, '{}'::jsonb from unnest(array['jw-korea-hospital', 'dr-thanh-hoa']) x
 where not exists (select 1 from public.shop_sources where shop_id = x);
update public.shop_sources src
   set crawled = coalesce(src.crawled, '{}'::jsonb) || jsonb_build_object('before_u71', jsonb_build_object('data', s.data, 'published', s.published))
  from public.shops s
 where s.id = src.shop_id and s.id in ('jw-korea-hospital', 'dr-thanh-hoa')
   and not (coalesce(src.crawled, '{}'::jsonb) ? 'before_u71');

-- 2) JW 한국병원 하나로 정리 (대표 사진 · 구글 지도 · 후기 숫자는 그대로)
update public.shops
   set data = (data - 'geoApprox') || $j${
     "name": {"ko": "JW 한국병원 성형외과", "en": "JW Korea Hospital (Plastic Surgery)", "vi": "Bệnh viện JW Hàn Quốc (Phẫu thuật thẩm mỹ)"},
     "address": {
       "ko": "44–50 Tôn Thất Tùng, Bến Thành, Quận 1, TP. Hồ Chí Minh",
       "en": "44–50 Ton That Tung, Ben Thanh, District 1, Ho Chi Minh City",
       "vi": "44–50 Tôn Thất Tùng, Bến Thành, Quận 1, TP. Hồ Chí Minh"},
     "geo": [10.769773, 106.689188],
     "gplace": "ChIJ6do8IT0vdTERXCEtpaeSgRI",
     "aliases": ["dr-thanh-hoa"],
     "hours": {"1": [["08:00", "18:00"]], "2": [["08:00", "18:00"]], "3": [["08:00", "18:00"]], "4": [["08:00", "18:00"]], "5": [["08:00", "18:00"]], "6": [["08:00", "17:00"]], "0": [["08:00", "12:00"]]},
     "open": "08:00", "close": "18:00", "closed": [],
     "staffLangs": ["vi", "en"],
     "desc": {
       "ko": "호치민 1군 벤탄 근처에 있는 JW 한국병원의 성형외과예요.\n가슴 성형 · 눈 성형 · 안면 · 목 거상은 후인 탄 호아 원장(석사 · 1급 전문의)이 맡아요.\n원장님은 성형 · 미용외과와 종양외과를 함께 봐요.\n개인 의원이 아니라 병원 안의 수술실과 마취과에서 수술해요.",
       "en": "The plastic surgery department of JW Korea Hospital, near Ben Thanh in District 1, Ho Chi Minh City.\nBreast, eyelid and face/neck lift surgery is handled by Dr. Huynh Thanh Hoa (MSc, Specialist Level I).\nShe covers both aesthetic and oncologic surgery.\nSurgery is done in the hospital's own operating rooms with its anaesthesia team, not in a private clinic.",
       "vi": "Khoa phẫu thuật thẩm mỹ của Bệnh viện JW Hàn Quốc, gần chợ Bến Thành, Quận 1, TP. Hồ Chí Minh.\nPhẫu thuật ngực, mí mắt, căng da mặt và cổ do ThS.BS.CKI Huỳnh Thanh Hòa phụ trách.\nBác sĩ thực hiện cả phẫu thuật thẩm mỹ và ung bướu.\nPhẫu thuật tại phòng mổ và khoa gây mê của bệnh viện."},
     "recommend": {"ko": "가슴 성형 · 눈 성형을 1군 큰 병원에서 받고 싶은 분", "en": "Those who want breast or eyelid surgery at a large hospital in District 1", "vi": "Người muốn phẫu thuật ngực, mắt tại bệnh viện lớn ở Quận 1"},
     "tags": [
       {"ko": "1군 벤탄 근처", "en": "Near Ben Thanh, District 1", "vi": "Gần Bến Thành, Quận 1"},
       {"ko": "가슴 성형", "en": "Breast surgery", "vi": "Phẫu thuật ngực"},
       {"ko": "눈 성형", "en": "Eyelid surgery", "vi": "Phẫu thuật mắt"},
       {"ko": "안면 · 목 거상", "en": "Face & neck lift", "vi": "Căng da mặt & cổ"},
       {"ko": "후인 탄 호아 원장", "en": "Dr. Huynh Thanh Hoa", "vi": "BS. Huỳnh Thanh Hòa"}],
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
        "desc": {"ko": "처진 얼굴 · 목 피부와 깊은 주름 상담", "en": "Sagging face and neck skin, deep lines", "vi": "Da mặt, cổ chảy xệ, nếp nhăn sâu"}},
       {"min": 0, "price": 0, "name": {"ko": "엉덩이 리프팅", "en": "Butt lift", "vi": "Nâng mông"},
        "desc": {"ko": "가능 여부 · 방법은 상담 후 안내해요", "en": "Availability and method confirmed at consultation", "vi": "Thông tin cụ thể sẽ được tư vấn"}}
     ],
     "notice": {
       "ko": "가슴 · 눈 · 안면 거상 상담은 후인 탄 호아 원장님이 봐요.\n수술 일정이 있어 방문 날짜와 시간을 먼저 예약하고 오시는 게 가장 정확해요.\n한국어 통역은 날짜마다 따로 배정돼요. 필요하면 예약할 때 꼭 말씀해 주세요.",
       "en": "Breast, eyelid and facelift consultations are with Dr. Huynh Thanh Hoa.\nBecause of the surgery schedule, please book your visit date and time in advance.\nA Korean interpreter is arranged per date — let us know when booking if you need one.",
       "vi": "Tư vấn ngực, mí mắt, căng da mặt do BS. Huỳnh Thanh Hòa phụ trách.\nDo lịch phẫu thuật, vui lòng đặt lịch ngày giờ đến trước.\nPhiên dịch tiếng Hàn được sắp xếp theo ngày — vui lòng báo khi đặt lịch nếu cần."}
   }$j$::jsonb
 where id = 'jw-korea-hospital';

-- 3) 닥터 후인 탄 호아 숨기기 (지우지 않음)
update public.shops set published = false where id = 'dr-thanh-hoa';

-- 4) 검색어 옮기기 (예전 메뉴였던 '지방이식'은 빼요)
insert into public.search_synonyms (kind, target, words, updated_by)
select 'shop', 'jw-korea-hospital', '{}', 'universe71'
 where not exists (select 1 from public.search_synonyms where kind = 'shop' and target = 'jw-korea-hospital');
update public.search_synonyms j
   set words = (select coalesce(array_agg(distinct w), '{}') from unnest(j.words || coalesce(d.words, '{}') || array['후인탄호아','탄호아','닥터탄호아','JW한국병원','JW병원']) w where w !~ '지방이식'),
       shown = (select coalesce(array_agg(distinct w), '{}') from unnest(coalesce(j.shown, '{}') || coalesce(d.shown, '{}')) w where w !~ '지방이식'),
       updated_at = now(), updated_by = 'universe71'
  from (select words, shown from public.search_synonyms where kind = 'shop' and target = 'dr-thanh-hoa'
        union all select null, null limit 1) d
 where j.kind = 'shop' and j.target = 'jw-korea-hospital';

-- 5) 사진 옮기기 → 보류 + 메모
update public.shop_media
   set shop_id = 'jw-korea-hospital', verdict = 'hold',
       note = trim(coalesce(note, '') || E'\n' || '🔀 예전 닥터 탄호아 업체에서 옮겨 온 사진 · JW 병원 사진이 맞는지 확인해 주세요')
 where shop_id = 'dr-thanh-hoa';

-- 6) 확인
select id, published, data->'name'->>'ko' as name, jsonb_array_length(data->'menu') as menus, data->'aliases' as aliases
  from public.shops where id in ('jw-korea-hospital', 'dr-thanh-hoa');

-- 되돌리기 (필요할 때만 · 사진 · 검색어는 그대로예요):
-- update public.shops s set data = src.crawled->'before_u71'->'data', published = (src.crawled->'before_u71'->>'published')::boolean
--   from public.shop_sources src where src.shop_id = s.id and s.id in ('jw-korea-hospital', 'dr-thanh-hoa') and src.crawled ? 'before_u71';

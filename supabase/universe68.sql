-- ===============================================================
-- universe68: 🕒 닥터 꽝뚜언 성형외과 (dr-quang-tuan) — 요일별 진료시간 · 점심시간 · 주소 정리 (2026-11-28)
--  · 진료: 월~금 07:00~12:00 / 13:00~16:30 (점심 12:00~13:00 휴진) · 토 07:00~12:00 (오전만) · 일 휴진
--  · 새 기능 shop.hours (요일별 여러 칸) — 손님 화면 영업시간 · '지금 진료 중' · 예약 가능 시간에 그대로 써요
--  · open / close / closed 도 맞춰 둬요 (목록 · 정렬용: 07:00 ~ 16:30 · 일요일 휴무)
--  · 주소: 3 đường số 17A 는 시티 국제병원(City International Hospital · CIH) 주소예요 → 병원 이름을 앞에 붙여요
--  · 바꾸기 전 값은 shop_sources.crawled.before_u68 에 백업
--  ⚠️ 실행 뒤 열어 둔 관리자 화면은 새로고침(F5) 해 주세요
-- ===============================================================
insert into public.shop_sources (shop_id, crawled)
select 'dr-quang-tuan', '{}'::jsonb where not exists (select 1 from public.shop_sources where shop_id = 'dr-quang-tuan');
update public.shop_sources src
   set crawled = coalesce(src.crawled, '{}'::jsonb) || jsonb_build_object('before_u68',
         jsonb_build_object('hours', s.data->'hours', 'open', s.data->'open', 'close', s.data->'close', 'closed', s.data->'closed', 'address', s.data->'address'))
  from public.shops s
 where s.id = src.shop_id and s.id = 'dr-quang-tuan'
   and not (coalesce(src.crawled, '{}'::jsonb) ? 'before_u68');

update public.shops
   set data = data || '{
     "hours": {
       "1": [["07:00", "12:00"], ["13:00", "16:30"]],
       "2": [["07:00", "12:00"], ["13:00", "16:30"]],
       "3": [["07:00", "12:00"], ["13:00", "16:30"]],
       "4": [["07:00", "12:00"], ["13:00", "16:30"]],
       "5": [["07:00", "12:00"], ["13:00", "16:30"]],
       "6": [["07:00", "12:00"]]
     },
     "open": "07:00", "close": "16:30", "closed": [0],
     "address": {
       "ko": "시티 국제병원 (City International Hospital) · 3 đường số 17A, Bình Trị Đông B, TP. Hồ Chí Minh (AEON MALL 빈탄 옆)",
       "en": "City International Hospital · 3 Street No. 17A, Binh Tri Dong B, Ho Chi Minh City (next to AEON MALL Binh Tan)",
       "vi": "Bệnh viện Quốc tế City · Số 3 đường số 17A, Bình Trị Đông B, TP. Hồ Chí Minh (cạnh AEON MALL Bình Tân)"
     }
   }'::jsonb
 where id = 'dr-quang-tuan';

select id, data->'hours' as hours, data->>'open' as open, data->>'close' as close, data->'closed' as closed from public.shops where id = 'dr-quang-tuan';

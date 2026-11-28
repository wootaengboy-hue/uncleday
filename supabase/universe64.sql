-- ===============================================================
-- universe64: 🏪 클로버 스파 (clover-spa) — 가게 홈페이지 프로모션 반영 (2026-11-28)
--  출처: cloverspa.vn/kr/-30-.html (상시 프로모션) — 내용만 뽑아 엉클데이 말투로 새로 썼어요
--  · 사전 예약 시 마사지 최대 30% 할인 → '문구 이벤트' (최대 몇 %인지 메뉴마다 달라 자동 계산 없음)
--  · 시술 후 허브 족욕 · 허브 눈 찜질 · 간단한 간식 무료 → 태그 · 소개
--  ※ '11월 골든 위크' (7일 한정 · 4인 요금 5인 · 바우처 증정)는 날짜가 안 나와 있어 넣지 않았어요
--  · 바꾸기 전 값은 shop_sources.crawled.before_u64 에 백업 (되돌리기 SQL 은 맨 아래 주석)
--  · 2026-11-28 추가: 목록 카드 배지용 짧은 문구(b) · 배지와 겹치는 '사전 예약 최대 30% 할인' 태그 뺌 — 다시 실행하면 반영돼요
-- Supabase → SQL Editor 에 붙여 넣고 Run (여러 번 실행해도 결과는 같아요)
-- ===============================================================

-- 1) 백업 (처음 한 번만)
insert into public.shop_sources (shop_id, crawled)
select 'clover-spa', '{}'::jsonb where not exists (select 1 from public.shop_sources where shop_id = 'clover-spa');
update public.shop_sources src
   set crawled = coalesce(src.crawled, '{}'::jsonb) || jsonb_build_object('before_u64',
         jsonb_build_object('tags', s.data->'tags', 'desc', s.data->'desc', 'promos', s.data->'promos'))
  from public.shops s
 where s.id = src.shop_id and s.id = 'clover-spa'
   and not (coalesce(src.crawled, '{}'::jsonb) ? 'before_u64');

-- 2) 태그 · 소개 · 할인 안내
update public.shops
   set data = data
     || jsonb_build_object('tags', '[
          {"ko": "개별 룸", "en": "Private rooms", "vi": "Phòng riêng"},
          {"ko": "허브 족욕 · 눈 찜질 · 간식 무료", "en": "Free herbal foot soak, eye compress & snack", "vi": "Miễn phí ngâm chân, chườm mắt thảo dược & đồ ăn nhẹ"},
          {"ko": "한국어 메뉴판", "en": "Korean menu", "vi": "Menu tiếng Hàn"}
        ]'::jsonb)
     || jsonb_build_object('desc', '{
          "ko": "다낭 시내 쩐푸 거리에 있는 스파예요. 미리 예약하면 마사지를 최대 30% 할인해 줘요. 마사지룸이 따로 나뉘어 있고, 시술이 끝나면 생강 · 레몬그라스 · 계피를 넣은 허브 족욕, 허브 눈 찜질, 간단한 간식을 무료로 줘요. 한국어 메뉴판으로 건강 상태와 불편한 부위를 먼저 확인해요. 샤워룸이 있고, 마지막 입장은 밤 9시예요.",
          "en": "A spa on Tran Phu Street downtown. Book ahead for up to 30% off massages. Private massage rooms, and after your treatment a free herbal foot soak (ginger, lemongrass, cinnamon), herbal eye compress and a light snack. A Korean-language menu is used to check your condition first. Shower room available; last entry 9 PM.",
          "vi": "Spa trên đường Trần Phú, trung tâm thành phố. Đặt trước được giảm đến 30% massage. Phòng massage riêng; sau liệu trình được ngâm chân thảo dược (gừng, sả, quế), chườm mắt thảo dược và đồ ăn nhẹ miễn phí. Có menu tiếng Hàn để hỏi tình trạng sức khỏe trước. Có phòng tắm; nhận khách cuối lúc 21:00."
        }'::jsonb)
     || jsonb_build_object('promos',
          coalesce((select jsonb_agg(p) from jsonb_array_elements(coalesce(data->'promos', '[]'::jsonb)) p where p->>'id' not in ('u64-pre30', 'u64-free')), '[]'::jsonb)
          || '[
            {"id": "u64-pre30", "on": true, "kind": "text", "b": {"ko": "사전 예약 최대 30%", "en": "Up to 30% off", "vi": "Giảm đến 30%"}, "t": {"ko": "사전 예약 시 마사지 최대 30% 할인 (가게 이벤트 · 메뉴마다 할인율이 달라요)", "en": "Up to 30% off massages when booked ahead (shop offer · rate varies by menu)", "vi": "Giảm đến 30% massage khi đặt trước (ưu đãi của tiệm · tùy dịch vụ)"}},
            {"id": "u64-free", "on": true, "kind": "text", "b": {"ko": "족욕 · 간식 무료", "en": "Free foot soak", "vi": "Ngâm chân miễn phí"}, "t": {"ko": "시술 후 허브 족욕 · 허브 눈 찜질 · 간식 무료", "en": "Free herbal foot soak, eye compress & snack after your treatment", "vi": "Miễn phí ngâm chân, chườm mắt thảo dược & đồ ăn nhẹ sau liệu trình"}}
          ]'::jsonb)
 where id = 'clover-spa';

-- 3) 확인
select id, data->'tags' as tags, data->'promos' as promos from public.shops where id = 'clover-spa';

-- 되돌리기 (필요할 때만):
-- update public.shops s set data = s.data || ((src.crawled->'before_u64') - 'promos') || jsonb_build_object('promos', coalesce(src.crawled->'before_u64'->'promos', 'null'::jsonb))
--   from public.shop_sources src where src.shop_id = s.id and s.id = 'clover-spa' and src.crawled ? 'before_u64';

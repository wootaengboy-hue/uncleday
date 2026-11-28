-- ===============================================================
-- universe63: 🏪 빌라 드 스파 (villa-de-spa) 업체 정보 — 가게 안내판 내용 반영 (2026-11-28)
--  · 첫 방문 10% · 재방문 20% 할인 → '문구 이벤트'(자동 계산 없음 · 업체 화면 🎁 할인 안내에 나와요)
--  · 무료 짐 보관 (10:30~22:50) · 다낭 시내 무료 픽업·샌딩 (2인 이상) · 무료 공항 샌딩 (2인 이상) · 무료 샤워
--  · 먼 곳 픽업 · 픽업과 함께 쓰는 공항 샌딩은 소액 추가 요금이 있을 수 있음
--  · 바꾸기 전 값은 shop_sources.crawled.before_u63 에 백업 (되돌리기 SQL 은 맨 아래 주석)
--  · 2026-11-28 추가: 목록 카드 배지용 짧은 문구(b) — 다시 실행하면 배지가 짧게 나와요
-- Supabase → SQL Editor 에 붙여 넣고 Run (여러 번 실행해도 결과는 같아요)
-- ===============================================================

-- 1) 백업 (처음 한 번만)
insert into public.shop_sources (shop_id, crawled)
select 'villa-de-spa', '{}'::jsonb where not exists (select 1 from public.shop_sources where shop_id = 'villa-de-spa');
update public.shop_sources src
   set crawled = coalesce(src.crawled, '{}'::jsonb) || jsonb_build_object('before_u63',
         jsonb_build_object('tags', s.data->'tags', 'desc', s.data->'desc', 'promos', s.data->'promos'))
  from public.shops s
 where s.id = src.shop_id and s.id = 'villa-de-spa'
   and not (coalesce(src.crawled, '{}'::jsonb) ? 'before_u63');

-- 2) 태그 · 소개 · 할인 안내
update public.shops
   set data = data
     || jsonb_build_object('tags', '[
          {"ko": "롯데마트 맞은편", "en": "Opposite Lotte Mart", "vi": "Đối diện Lotte Mart"},
          {"ko": "첫 방문 10% · 재방문 20%", "en": "10% first visit · 20% revisit", "vi": "Lần đầu 10% · Quay lại 20%"},
          {"ko": "무료 짐 보관", "en": "Free luggage storage", "vi": "Giữ hành lý miễn phí"},
          {"ko": "무료 샤워", "en": "Free shower", "vi": "Tắm miễn phí"},
          {"ko": "무료 픽업·샌딩 (2인 이상)", "en": "Free pickup & drop (2+ people)", "vi": "Đón & đưa miễn phí (từ 2 người)"},
          {"ko": "무료 공항 샌딩 (2인 이상)", "en": "Free airport drop (2+ people)", "vi": "Đưa ra sân bay miễn phí (từ 2 người)"}
        ]'::jsonb)
     || jsonb_build_object('desc', '{
          "ko": "롯데마트 바로 앞이라 쇼핑 일정 사이에 들르기 좋아요. 처음 오면 10%, 다시 오면 20% 할인해 줘요. 짐은 10:30~22:50 무료로 맡아 주고, 샤워도 무료예요. 2인 이상이면 다낭 시내 픽업·샌딩과 공항 샌딩이 무료예요 (먼 곳이거나 픽업과 공항 샌딩을 함께 쓰면 소액 추가 요금이 있을 수 있어요). 한국어 가능한 직원이 있어요.",
          "en": "Right in front of Lotte Mart, handy between shopping stops. 10% off on your first visit and 20% off when you come back. Free luggage storage (10:30–22:50) and free shower. For 2 or more people, pickup & drop-off within Da Nang and airport drop-off are free (a small extra charge may apply for long distances or when combined with pickup). Korean-speaking staff.",
          "vi": "Nằm ngay trước Lotte Mart, tiện ghé giữa các điểm mua sắm. Giảm 10% lần đầu và 20% khi quay lại. Giữ hành lý miễn phí (10:30–22:50) và tắm miễn phí. Từ 2 người: đón & đưa trong Đà Nẵng và đưa ra sân bay miễn phí (có thể tính thêm một ít nếu đi xa hoặc dùng kèm đón). Có nhân viên nói tiếng Hàn."
        }'::jsonb)
     || jsonb_build_object('promos',
          coalesce((select jsonb_agg(p) from jsonb_array_elements(coalesce(data->'promos', '[]'::jsonb)) p where p->>'id' not in ('u63-first', 'u63-revisit')), '[]'::jsonb)
          || '[
            {"id": "u63-first", "on": true, "kind": "text", "b": {"ko": "첫 방문 10%", "en": "10% first visit", "vi": "Lần đầu 10%"}, "t": {"ko": "첫 방문 10% 할인 (가게 안내)", "en": "10% off your first visit (shop offer)", "vi": "Giảm 10% lần đầu (ưu đãi của tiệm)"}},
            {"id": "u63-revisit", "on": true, "kind": "text", "b": {"ko": "재방문 20%", "en": "20% revisit", "vi": "Quay lại 20%"}, "t": {"ko": "재방문 20% 할인 (가게 안내)", "en": "20% off when you come back (shop offer)", "vi": "Giảm 20% khi quay lại (ưu đãi của tiệm)"}}
          ]'::jsonb)
 where id = 'villa-de-spa';

-- 3) 확인
select id, data->'tags' as tags, data->'promos' as promos from public.shops where id = 'villa-de-spa';

-- 되돌리기 (필요할 때만):
-- update public.shops s set data = s.data || (src.crawled->'before_u63') - 'promos' || jsonb_build_object('promos', coalesce(src.crawled->'before_u63'->'promos', 'null'::jsonb))
--   from public.shop_sources src where src.shop_id = s.id and s.id = 'villa-de-spa' and src.crawled ? 'before_u63';

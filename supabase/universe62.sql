-- ===============================================================
-- universe62: 🔤 이미 넘긴 메뉴에도 '원래 이름(가게 메뉴판 이름)' 채우기
--  · 업체 정보 검수에서 모아 온 메뉴(shop_sources.crawled.menu)의 원문 이름을
--    손님 화면 메뉴(shops.data.menu)의 같은 메뉴(한국어 이름이 같은 것)에 orig 로 붙여요
--  · 손님 화면: 한국어 메뉴 이름 밑에 원래 이름이 작게 나와요 (shop.js mOrig)
--  · 이미 orig 가 있는 메뉴 · 원문이 없는 메뉴는 그대로 · 가격 · 시간 · 이름은 안 바꿔요
--  · 바꾸기 전 메뉴는 shop_sources.crawled.menu_before_u62 에 백업 (되돌리기 SQL 은 맨 아래 주석)
-- Supabase → SQL Editor 에 붙여 넣고 Run (여러 번 실행해도 결과는 같아요)
-- ===============================================================

-- 1) 백업 (처음 한 번만)
update public.shop_sources src
   set crawled = src.crawled || jsonb_build_object('menu_before_u62', s.data->'menu')
  from public.shops s
 where s.id = src.shop_id
   and jsonb_typeof(src.crawled->'menu') = 'array'
   and jsonb_typeof(s.data->'menu') = 'array'
   and not (src.crawled ? 'menu_before_u62');

-- 2) 원래 이름 붙이기
with src as (
  select shop_id, crawled->'menu' as cm from public.shop_sources where jsonb_typeof(crawled->'menu') = 'array'
), fixed as (
  select s.id,
         jsonb_agg(
           case
             when nullif(trim(m->>'orig'), '') is not null then m
             else coalesce((
               select m || jsonb_build_object('orig', trim(c->>'name'))
                 from jsonb_array_elements(src.cm) c
                where nullif(trim(c->>'name'), '') is not null
                  and trim(c->>'name') <> trim(coalesce(c->>'name_ko', ''))
                  and lower(regexp_replace(coalesce(nullif(c->>'name_ko', ''), c->>'name'), '\s+', '', 'g'))
                    = lower(regexp_replace(coalesce(m->'name'->>'ko', ''), '\s+', '', 'g'))
                limit 1), m)
           end order by ord) as menu
    from public.shops s
    join src on src.shop_id = s.id
    cross join lateral jsonb_array_elements(s.data->'menu') with ordinality t(m, ord)
   where jsonb_typeof(s.data->'menu') = 'array'
   group by s.id
)
update public.shops s
   set data = jsonb_set(s.data, '{menu}', f.menu)
  from fixed f
 where f.id = s.id
   and f.menu is distinct from s.data->'menu';

-- 3) 확인: 업체별로 원래 이름이 붙은 메뉴 수
select id, jsonb_array_length(data->'menu') as menus,
       (select count(*) from jsonb_array_elements(data->'menu') m where m ? 'orig') as with_orig
  from public.shops
 where jsonb_typeof(data->'menu') = 'array'
   and exists (select 1 from jsonb_array_elements(data->'menu') m where m ? 'orig')
 order by with_orig desc;

-- 되돌리기 (필요할 때만):
-- update public.shops s set data = jsonb_set(s.data, '{menu}', src.crawled->'menu_before_u62')
--   from public.shop_sources src where src.shop_id = s.id and src.crawled ? 'menu_before_u62';

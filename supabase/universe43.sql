-- ===============================================================
-- universe43: 📒 '내 시술 기록' 따로 보기 (쇼핑몰의 '구매한 상품'처럼 예약과 별도 페이지)
--  · history.html: 지금까지 받은 시술을 한 곳에 — 날짜 · 가게 · 시술 · 가게 메모(손님 말로 번역) · 다시 예약하기
--  · 로그인한 손님: 내 계정의 예약 + 같은 연락처로 한 예약 전부
--  · 로그인 안 한 손님: 예약확인증 열쇠(이 기기에 저장된 예약)로
-- 먼저 universe42 가 실행돼 있어야 해요
-- Supabase → SQL Editor 에 붙여 넣고 Run (여러 번 실행해도 괜찮아요)
-- ===============================================================

-- 한 줄 모양 (손님용 · 공통)
create or replace function public.history_row(x bookings) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('code', x.code, 'date', x.visit_date, 'menu', x.menu_name, 'min', x.menu_min, 'people', x.people, 'shop_id', x.shop_id,
    'mn', (select m -> 'name' from shops s, jsonb_array_elements(s.data -> 'menu') m where s.id = x.shop_id and m -> 'name' ->> 'ko' = x.menu_name limit 1),
    'shop', coalesce((select s.data -> 'name' from shops s where s.id = x.shop_id), to_jsonb(x.shop_name)),
    'cat', (select s.data ->> 'cat' from shops s where s.id = x.shop_id),
    'pub', v.pub, 'tr', v.pub_tr, 'lang', v.lang, 't', x.customer_token)
  from (select 1) one left join visit_notes v on v.booking_id = x.id
$$;
revoke all on function public.history_row(bookings) from public, anon, authenticated;

-- 손님: 예약확인증 열쇠로 (같은 연락처의 모든 방문)
create or replace function public.customer_history(t text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where customer_token = t;
  if not found or length(coalesce(t, '')) < 20 then return null; end if;
  return jsonb_build_object('t', t, 'list', coalesce((select jsonb_agg(history_row(x) order by x.visit_date desc, x.visit_time desc)
    from bookings x where (x.id = b.id or (b.customer_id is not null and x.customer_id = b.customer_id)) and x.status in ('visited', 'settled')), '[]'::jsonb));
end $$;
grant execute on function public.customer_history(text) to anon, authenticated;

-- 로그인한 손님: 내 계정 예약 + 같은 연락처 예약
create or replace function public.my_history() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); tk text;
begin
  if uid is null then return null; end if;
  select customer_token into tk from bookings where user_id = uid order by created_at desc limit 1;
  return jsonb_build_object('t', tk, 'list', coalesce((select jsonb_agg(history_row(x) order by x.visit_date desc, x.visit_time desc)
    from bookings x where (x.user_id = uid or x.customer_id in (select customer_id from bookings where user_id = uid and customer_id is not null))
      and x.status in ('visited', 'settled')), '[]'::jsonb));
end $$;
revoke all on function public.my_history() from public, anon;
grant execute on function public.my_history() to authenticated;

-- ===============================================================
-- universe39: 🎁 업체별 할인 이벤트
--  · 시술별 할인, 개업 몇 주년 이벤트처럼 가게마다 다른 할인을 가게가 직접 (사장님 페이지) 또는 관리자가 (업체 편집) 넣어요
--  · 저장하면 바로 손님 화면에 보여요 (관리자는 언제든 끄거나 고칠 수 있어요)
--  · shops.data -> 'promos' = [{ id, on, kind: pct(%)|amt(₫)|text(문구만), v, menus: [메뉴 번호…] (비면 전 메뉴), from, to, t: {vi, ko, en} }] (최대 10개)
--  · 예약할 때 그 날짜 · 그 메뉴에 맞는 가장 큰 할인을 골라 예약에 적어 두고 (bookings.promo), 예상 금액도 할인가로 계산해요
--    → 사장님 페이지 · 잘로 예약 확인 화면 · 손님 예약확인증 · 관리자 예약 상세에서 '적용 이벤트'로 보여요
-- Supabase → SQL Editor 에 붙여 넣고 Run (여러 번 실행해도 괜찮아요)
-- ===============================================================

alter table public.bookings add column if not exists promo jsonb;

-- 날짜 · 메뉴에 맞는 할인 고르기 (금액 할인이 가장 큰 것 · 없으면 문구 이벤트)
create or replace function public.promo_pick(promos jsonb, mi int, d date, price bigint) returns jsonb
language plpgsql immutable set search_path = public as $$
declare x jsonb; cut bigint; best jsonb; bcut bigint := 0; txt jsonb;
begin
  if promos is null or jsonb_typeof(promos) <> 'array' then return null; end if;
  for x in select * from jsonb_array_elements(promos) loop
    continue when coalesce((x ->> 'on')::boolean, true) = false;
    continue when nullif(x ->> 'from', '') is not null and d < (x ->> 'from')::date;
    continue when nullif(x ->> 'to', '') is not null and d > (x ->> 'to')::date;
    continue when jsonb_array_length(coalesce(x -> 'menus', '[]'::jsonb)) > 0 and not (x -> 'menus') @> to_jsonb(mi);
    if x ->> 'kind' = 'text' then txt := coalesce(txt, x); continue; end if;
    cut := case when coalesce(price, 0) <= 0 then 0
                when x ->> 'kind' = 'pct' then round(price * least(greatest(coalesce((x ->> 'v')::numeric, 0), 0), 90) / 100 / 1000) * 1000
                when x ->> 'kind' = 'amt' then least(greatest(coalesce((x ->> 'v')::bigint, 0), 0), price) else 0 end;
    if cut > bcut then bcut := cut; best := x; end if;
  end loop;
  if best is not null then
    return jsonb_build_object('id', best ->> 'id', 't', best -> 't', 'kind', best ->> 'kind', 'v', best -> 'v', 'orig', price, 'price', price - bcut);
  elsif txt is not null then
    return jsonb_build_object('id', txt ->> 'id', 't', txt -> 't', 'kind', 'text');
  end if;
  return null;
exception when others then return null;
end $$;

-- 사장님: 할인 이벤트 읽기 · 저장 (저장은 사장님만 · 직원 ✕)
create or replace function public.owner_promo_get(shop text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform owner_check(shop);
  return (select jsonb_build_object('menu', coalesce((select jsonb_agg(jsonb_build_object('name', m -> 'name', 'price', m -> 'price')) from jsonb_array_elements(coalesce(data -> 'menu', '[]'::jsonb)) m), '[]'::jsonb),
    'promos', coalesce(data -> 'promos', '[]'::jsonb)) from shops where id = shop);
end $$;
grant execute on function public.owner_promo_get(text) to authenticated;

create or replace function public.owner_promo_save(shop text, list jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare out jsonb := '[]'::jsonb; x jsonb; i int := 0; k text; v numeric; nm int; ms jsonb; t jsonb;
begin
  perform owner_check(shop, true);
  select jsonb_array_length(coalesce(data -> 'menu', '[]'::jsonb)) into nm from shops where id = shop;
  for x in select * from jsonb_array_elements(coalesce(list, '[]'::jsonb)) loop
    i := i + 1; exit when i > 10;
    k := case when x ->> 'kind' in ('pct', 'amt', 'text') then x ->> 'kind' else 'pct' end;
    v := case when k = 'text' then null else coalesce(nullif(regexp_replace(coalesce(x ->> 'v', ''), '[^0-9.]', '', 'g'), '')::numeric, 0) end;
    if k = 'pct' and (v <= 0 or v > 90) then raise exception 'Discount %% must be 1–90'; end if;
    if k = 'amt' and (v <= 0 or v > 100000000) then raise exception 'Check the discount amount'; end if;
    t := jsonb_strip_nulls(jsonb_build_object('vi', nullif(left(btrim(x -> 't' ->> 'vi'), 80), ''), 'ko', nullif(left(btrim(x -> 't' ->> 'ko'), 80), ''), 'en', nullif(left(btrim(x -> 't' ->> 'en'), 80), '')));
    if k = 'text' and t = '{}'::jsonb then raise exception 'Write the event text'; end if;
    ms := coalesce((select jsonb_agg(distinct e::int) from jsonb_array_elements_text(coalesce(x -> 'menus', '[]'::jsonb)) e where e ~ '^[0-9]{1,3}$' and e::int < nm), '[]'::jsonb);
    if nullif(x ->> 'from', '') is not null and nullif(x ->> 'to', '') is not null and (x ->> 'to')::date < (x ->> 'from')::date then raise exception 'The end date is before the start date'; end if;
    out := out || jsonb_strip_nulls(jsonb_build_object('id', left(coalesce(nullif(x ->> 'id', ''), 'p' || i), 20), 'on', coalesce((x ->> 'on')::boolean, true),
      'kind', k, 'v', v, 'menus', ms, 't', t,
      'from', (nullif(x ->> 'from', ''))::date, 'to', (nullif(x ->> 'to', ''))::date));
  end loop;
  update shops set data = jsonb_set(coalesce(data, '{}'::jsonb), '{promos}', out), updated_at = now() where id = shop;
  return out;
end $$;
grant execute on function public.owner_promo_save(text, jsonb) to authenticated;

-- 예약 접수: 할인 이벤트를 골라 예약에 적어 둬요 (나머지는 그대로)
create or replace function public.create_booking(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s shops; sp shop_private; m jsonb; i int; ppl int; c text; b bookings;
  vd date; nm text; ct text; cp text; pr jsonb; up bigint;
begin
  perform set_config('app.actor', '손님', true);
  select * into s from shops where id = p ->> 'shop_id' and published;
  if not found then raise exception '업체를 찾을 수 없어요'; end if;
  i := coalesce((p ->> 'menu')::int, 0);
  m := s.data -> 'menu' -> i;
  if m is null then raise exception '메뉴를 찾을 수 없어요'; end if;
  ppl := greatest(1, least(10, coalesce((p ->> 'people')::int, 1)));
  vd := (p ->> 'date')::date;
  nm := left(trim(coalesce(p ->> 'name', '')), 60);
  ct := left(trim(coalesce(p ->> 'contact', '')), 80);
  cp := nullif(upper(left(regexp_replace(coalesce(p ->> 'coupon', ''), '[^A-Za-z0-9-]', '', 'g'), 30)), '');
  if vd is null or vd < (now() at time zone 'Asia/Ho_Chi_Minh')::date or vd > (now() at time zone 'Asia/Ho_Chi_Minh')::date + 365 then
    raise exception '날짜를 확인해 주세요';
  end if;
  if nm = '' or ct = '' then raise exception '이름과 연락처를 적어 주세요'; end if;
  if (select count(*) from bookings where contact = ct and created_at > now() - interval '1 hour') >= 5
     or (select count(*) from bookings where source = 'web' and created_at > now() - interval '1 minute') >= 20 then
    raise exception '잠시 후 다시 시도해 주세요';
  end if;
  select * into sp from shop_private where shop_id = s.id;
  pr := promo_pick(s.data -> 'promos', i, vd, (m ->> 'price')::bigint);
  up := coalesce((pr ->> 'price')::bigint, (m ->> 'price')::bigint);
  c := new_booking_code();
  insert into bookings (code, shop_id, shop_name, menu_name, menu_min, unit_price, people, list_price,
                        visit_date, visit_time, customer_name, contact, note, lang, source, commission_rate, marketing_ok, coupon_code, promo)
  values (c, s.id, s.data -> 'name' ->> 'ko', m -> 'name' ->> 'ko', (m ->> 'min')::int, up, ppl,
          up * ppl, vd, left(p ->> 'time', 5), nm, ct, left(p ->> 'note', 500),
          left(coalesce(p ->> 'lang', 'ko'), 2), 'web', coalesce(sp.commission_rate, 0),
          coalesce((p ->> 'marketing')::boolean, false), cp, pr)
  returning * into b;
  return jsonb_build_object('code', b.code, 'token', b.customer_token);
end $$;
revoke all on function public.create_booking(jsonb) from public;
grant execute on function public.create_booking(jsonb) to anon, authenticated;

-- 적용 이벤트를 보여 주는 곳: 잘로 예약 확인 화면 · 손님 예약확인증 · 사장님 페이지
create or replace function public.booking_for_shop(t text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b bookings; s shops;
begin
  select * into b from bookings where shop_token = t;
  if not found or t is null or length(t) < 20 then return null; end if;
  select * into s from shops where id = b.shop_id;
  return jsonb_build_object(
    'code', b.code, 'status', b.status,
    'shop_name', coalesce(s.data -> 'name', to_jsonb(b.shop_name)),
    'menu', (select m from jsonb_array_elements(s.data -> 'menu') m where m -> 'name' ->> 'ko' = b.menu_name limit 1),
    'menu_name', b.menu_name, 'menu_min', b.menu_min, 'people', b.people, 'list_price', b.list_price,
    'visit_date', b.visit_date, 'visit_time', b.visit_time, 'customer_name', b.customer_name,
    'note', b.note, 'lang', b.lang, 'paid_amount', b.paid_amount, 'shop_replied_at', b.shop_replied_at,
    'proposed_times', b.proposed_times, 'change_count', b.change_count, 'promo', b.promo,
    'open', s.data -> 'open', 'close', s.data -> 'close');
end $$;

create or replace function public.booking_for_customer(t text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b bookings; s shops; win boolean;
begin
  select * into b from bookings where customer_token = t;
  if not found or t is null or length(t) < 20 then return null; end if;
  select * into s from shops where id = b.shop_id;
  win := b.visit_date is not null and vn_today() between b.visit_date and b.visit_date + 14;
  return jsonb_build_object(
    'code', b.code, 'status', b.status, 'shop_id', b.shop_id, 'shop_name', b.shop_name,
    'shop', case when s.id is null then null else jsonb_build_object(
       'name', s.data -> 'name', 'address', s.data -> 'address', 'map', s.data -> 'map',
       'img', s.data -> 'img', 'imgPos', s.data -> 'imgPos', 'menu', s.data -> 'menu') end,
    'menu_name', b.menu_name, 'menu_min', b.menu_min, 'people', b.people, 'list_price', b.list_price,
    'visit_date', b.visit_date, 'visit_time', b.visit_time, 'customer_name', b.customer_name,
    'note', b.note, 'lang', b.lang, 'created_at', b.created_at, 'promo', b.promo,
    'customer_visit_at', b.customer_visit_at,
    'offer_times', case when b.status = 'reschedule' then b.offer_times else '[]'::jsonb end, 'change_count', b.change_count,
    'reviewed', exists (select 1 from reviews where booking_id = b.id),
    'therapists', booking_therapists(b.id),
    'tp_options', case when win and b.status in ('confirmed', 'visited', 'settled') then booking_tp_options(b.id) else '[]'::jsonb end,
    'tp_window', win,
    'tp_reviewed', coalesce((select jsonb_agg(v.staff_id) from staff_reviews v where v.booking_id = b.id), '[]'::jsonb));
end $$;

create or replace function public.owner_row(b bookings) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', b.id, 'code', b.code, 'status', b.status, 'menu_name', b.menu_name, 'menu_min', b.menu_min,
    'menu', (select m from shops s, jsonb_array_elements(s.data -> 'menu') m where s.id = b.shop_id and m -> 'name' ->> 'ko' = b.menu_name limit 1),
    'people', b.people, 'list_price', b.list_price, 'visit_date', b.visit_date, 'visit_time', b.visit_time,
    'customer_name', b.customer_name, 'note', b.note, 'lang', b.lang, 'paid_amount', b.paid_amount,
    'proposed_times', b.proposed_times, 'offer_times', b.offer_times, 'created_at', b.created_at,
    'sent_to_shop_at', b.sent_to_shop_at, 'shop_replied_at', b.shop_replied_at, 'promo', b.promo,
    'survey', (select s.answers from booking_surveys s where s.booking_id = b.id),
    'survey_at', (select s.updated_at from booking_surveys s where s.booking_id = b.id))
$$;

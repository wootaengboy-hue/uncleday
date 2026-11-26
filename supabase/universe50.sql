-- ===============================================================
-- universe50: 🎁 조건 할인 (인원 · 시간대)
--  · 할인 이벤트에 조건을 붙여요: ppl = 최소 인원 (예: 2 → 2인 이상), tf ~ tt = 예약 시작 시간대 (예: 11:00 ~ 13:00)
--  · 조건이 여러 개면 모두 맞아야 해요 (골든 타임 + 2인 이상 → 40%)
--  · 이벤트가 여러 개 맞으면 가장 큰 할인 하나만 적용 (2인 20% · 4인 30% · 골든 타임 40% 중 맞는 것 중 최대)
--  · 예약할 때 인원 · 시간으로 골라 예약에 적어 둬요 (bookings.promo · unit_price)
-- Supabase → SQL Editor 에 붙여 넣고 Run (여러 번 실행해도 괜찮아요)
-- ===============================================================

create or replace function public.promo_pick(promos jsonb, mi int, d date, price bigint, ppl int, tm text) returns jsonb
language plpgsql immutable set search_path = public as $$
declare x jsonb; cut bigint; best jsonb; bcut bigint := 0; txt jsonb;
begin
  if promos is null or jsonb_typeof(promos) <> 'array' then return null; end if;
  for x in select * from jsonb_array_elements(promos) loop
    continue when coalesce((x ->> 'on')::boolean, true) = false;
    continue when nullif(x ->> 'from', '') is not null and d < (x ->> 'from')::date;
    continue when nullif(x ->> 'to', '') is not null and d > (x ->> 'to')::date;
    continue when jsonb_array_length(coalesce(x -> 'menus', '[]'::jsonb)) > 0 and not (x -> 'menus') @> to_jsonb(mi);
    -- 조건: 최소 인원 · 시간대 (모르면 조건 할인은 빼요)
    continue when nullif(x ->> 'ppl', '') is not null and coalesce(ppl, 0) < (x ->> 'ppl')::int;
    continue when nullif(x ->> 'tf', '') is not null and (tm is null or tm < (x ->> 'tf') or tm >= coalesce(nullif(x ->> 'tt', ''), '24:00'));
    if x ->> 'kind' = 'text' then txt := coalesce(txt, x); continue; end if;
    cut := case when coalesce(price, 0) <= 0 then 0
                when x ->> 'kind' = 'pct' then round(price * least(greatest(coalesce((x ->> 'v')::numeric, 0), 0), 90) / 100 / 1000) * 1000
                when x ->> 'kind' = 'amt' then least(greatest(coalesce((x ->> 'v')::bigint, 0), 0), price) else 0 end;
    if cut > bcut then bcut := cut; best := x; end if;
  end loop;
  if best is not null then
    return jsonb_strip_nulls(jsonb_build_object('id', best ->> 'id', 't', best -> 't', 'kind', best ->> 'kind', 'v', best -> 'v', 'orig', price, 'price', price - bcut,
      'ppl', best -> 'ppl', 'tf', best -> 'tf', 'tt', best -> 'tt'));
  elsif txt is not null then
    return jsonb_build_object('id', txt ->> 'id', 't', txt -> 't', 'kind', 'text');
  end if;
  return null;
exception when others then return null;
end $$;

-- 예전 모양 (인원 · 시간 모름) → 조건 없는 할인만
create or replace function public.promo_pick(promos jsonb, mi int, d date, price bigint) returns jsonb
language sql immutable set search_path = public as $$ select public.promo_pick(promos, mi, d, price, null::int, null::text) $$;

-- 사장님이 이벤트를 저장해도 조건이 지워지지 않게
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
      'from', (nullif(x ->> 'from', ''))::date, 'to', (nullif(x ->> 'to', ''))::date,
      'ppl', case when (x ->> 'ppl') ~ '^[0-9]{1,2}$' and (x ->> 'ppl')::int between 2 and 20 then (x ->> 'ppl')::int end,
      'tf', case when (x ->> 'tf') ~ '^[0-2][0-9]:[0-5][0-9]$' and (x ->> 'tt') ~ '^[0-2][0-9]:[0-5][0-9]$' then x ->> 'tf' end,
      'tt', case when (x ->> 'tf') ~ '^[0-2][0-9]:[0-5][0-9]$' and (x ->> 'tt') ~ '^[0-2][0-9]:[0-5][0-9]$' then x ->> 'tt' end));
  end loop;
  update shops set data = jsonb_set(coalesce(data, '{}'::jsonb), '{promos}', out), updated_at = now() where id = shop;
  return out;
end $$;
grant execute on function public.owner_promo_save(text, jsonb) to authenticated;

-- 예약 접수: 인원 · 시간까지 보고 할인을 골라요
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
  pr := promo_pick(s.data -> 'promos', i, vd, (m ->> 'price')::bigint, ppl, left(p ->> 'time', 5));   -- universe50: 인원 · 시간 조건 할인
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

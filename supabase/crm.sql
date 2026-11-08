-- 고객 관리(CRM)만 따로 (schema.sql 전체 실행이 'Failed to fetch'로 안 될 때 이것만 실행해도 돼요)

-- ---------------------------------------------------------------
-- 19. 고객 관리 (CRM): 같은 연락처로 들어온 예약을 한 손님으로 묶고, 메모·태그·연락 기록·쿠폰을 관리해요
--     마케팅(쿠폰·이벤트 안내)은 손님이 '받을게요'에 동의한 경우에만 보내요
-- ---------------------------------------------------------------
create table if not exists public.customers (
  id             uuid primary key default gen_random_uuid(),
  key            text unique not null,          -- 연락처를 정리한 값 (tel:01012345678 / id:kakaoid)
  name           text,
  contact        text,
  lang           text,
  tags           text[] not null default '{}',
  memo           text,
  marketing_ok   boolean not null default false,
  marketing_at   timestamptz,
  marketing_src  text,                          -- 어디서 동의했는지 (예약 UD-…, 카톡 등)
  first_at       timestamptz not null default now(),
  last_at        timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.bookings add column if not exists customer_id  uuid references public.customers(id) on delete set null;
alter table public.bookings add column if not exists marketing_ok boolean not null default false;
alter table public.bookings add column if not exists coupon_code  text;
create index if not exists bookings_customer_idx on public.bookings(customer_id);

create table if not exists public.customer_logs (
  id           bigserial primary key,
  customer_id  uuid not null references public.customers(id) on delete cascade,
  kind         text not null check (kind in ('note','message','coupon','consent','edit')),
  body         text,
  actor        text,
  at           timestamptz not null default now()
);
create index if not exists customer_logs_c_idx on public.customer_logs(customer_id, at desc);

create table if not exists public.coupons (
  id           uuid primary key default gen_random_uuid(),
  code         text unique not null,
  title        text not null,                   -- 예: 재방문 감사 10% 할인
  benefit      text,                            -- 예: 10% 할인 / 음료 서비스
  customer_id  uuid references public.customers(id) on delete set null,   -- 비어 있으면 누구나
  shop_id      text references public.shops(id) on update cascade on delete set null,  -- 비어 있으면 모든 업체
  valid_until  date,
  status       text not null default 'issued' check (status in ('issued','used','void')),
  used_booking text,
  used_at      timestamptz,
  memo         text,
  created_by   text,
  created_at   timestamptz not null default now()
);
create index if not exists coupons_c_idx on public.coupons(customer_id);

alter table public.customers     enable row level security;
alter table public.customer_logs enable row level security;
alter table public.coupons       enable row level security;
drop policy if exists admin_all on public.customers;
create policy admin_all on public.customers for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_all on public.customer_logs;
create policy admin_all on public.customer_logs for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_all on public.coupons;
create policy admin_all on public.coupons for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.customer_logs_before() returns trigger language plpgsql security definer set search_path = public as $$
begin new.actor := coalesce(new.actor, actor_name()); new.at := now(); return new; end $$;
drop trigger if exists customer_logs_before on public.customer_logs;
create trigger customer_logs_before before insert on public.customer_logs for each row execute function public.customer_logs_before();
create or replace function public.coupons_before() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then new.created_by := actor_name(); new.created_at := now(); new.code := upper(new.code); end if;
  if new.status = 'used' and new.used_at is null then new.used_at := now(); end if;
  return new;
end $$;
drop trigger if exists coupons_before on public.coupons;
create trigger coupons_before before insert or update on public.coupons for each row execute function public.coupons_before();

-- 연락처 정리: 010-1234-5678 / +82 10 1234 5678 → tel:01012345678, 카톡ID·이메일 → id:소문자
create or replace function public.contact_key(c text) returns text language sql immutable as $$
  select case
    when c is null or btrim(c) = '' then null
    when c !~ '[A-Za-z@]' and length(regexp_replace(c, '\D', '', 'g')) >= 8 then
      'tel:' || (select case when d ~ '^(82|84)' then '0' || substr(d, 3) else d end from (select regexp_replace(c, '\D', '', 'g') as d) x)
    else 'id:' || lower(regexp_replace(regexp_replace(btrim(c), '^(kakao ?talk|kakao|카카오톡|카카오|카톡|zalo|line|라인|email|이메일)\s*(id|아이디)?\s*[:：]?\s*', '', 'i'), '^@|\s+', '', 'g'))
  end $$;

-- 예약이 생기거나 연락처가 바뀌면 손님 카드에 자동으로 묶어요
create or replace function public.bookings_crm() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text; cid uuid;
begin
  k := contact_key(new.contact);
  if k is null then return new; end if;   -- 연락처가 없으면 같은 사람인지 알 수 없어서 묶지 않아요
  insert into customers (key, name, contact, lang, first_at, last_at)
  values (k, nullif(btrim(new.customer_name), ''), new.contact, new.lang, coalesce(new.created_at, now()), coalesce(new.created_at, now()))
  on conflict (key) do update set
    name = coalesce(customers.name, excluded.name), contact = excluded.contact, lang = coalesce(excluded.lang, customers.lang),
    first_at = least(customers.first_at, excluded.first_at), last_at = greatest(customers.last_at, excluded.last_at), updated_at = now()
  returning id into cid;
  new.customer_id := cid;
  if new.marketing_ok and (tg_op = 'INSERT' or not coalesce(old.marketing_ok, false)) then
    update customers set marketing_ok = true, marketing_at = now(), marketing_src = '예약 ' || coalesce(new.code, '') where id = cid and not marketing_ok;
    if found then insert into customer_logs (customer_id, kind, body, actor) values (cid, 'consent', '쿠폰·이벤트 안내 받기에 동의 (예약 ' || coalesce(new.code, '') || ')', '손님'); end if;
  end if;
  return new;
end $$;
drop trigger if exists bookings_crm on public.bookings;
create trigger bookings_crm before insert or update of contact, customer_name, marketing_ok on public.bookings
  for each row execute function public.bookings_crm();

-- 이미 있는 예약도 손님 카드로 묶기 (처음 한 번)
update public.bookings set contact = contact where customer_id is null and coalesce(btrim(contact), '') <> '';

-- 사이트 예약: 마케팅 동의(선택)·쿠폰 코드도 함께 받아요
create or replace function public.create_booking(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s shops; sp shop_private; m jsonb; i int; ppl int; c text; b bookings;
  vd date; nm text; ct text; cp text;
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
  c := new_booking_code();
  insert into bookings (code, shop_id, shop_name, menu_name, menu_min, unit_price, people, list_price,
                        visit_date, visit_time, customer_name, contact, note, lang, source, commission_rate, marketing_ok, coupon_code)
  values (c, s.id, s.data -> 'name' ->> 'ko', m -> 'name' ->> 'ko', (m ->> 'min')::int, (m ->> 'price')::bigint, ppl,
          (m ->> 'price')::bigint * ppl, vd, left(p ->> 'time', 5), nm, ct, left(p ->> 'note', 500),
          left(coalesce(p ->> 'lang', 'ko'), 2), 'web', coalesce(sp.commission_rate, 0),
          coalesce((p ->> 'marketing')::boolean, false), cp)
  returning * into b;
  return jsonb_build_object('code', b.code, 'token', b.customer_token);
end $$;
revoke all on function public.create_booking(jsonb) from public;
grant execute on function public.create_booking(jsonb) to anon, authenticated;


-- 자동 백업에 고객·쿠폰도 포함
create or replace function public.backup_dump(t text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k backup_keys; out jsonb;
begin
  select * into k from backup_keys where id = 1;
  if k.token_hash is null or t is null or length(t) < 32 or encode(sha256(convert_to(t, 'UTF8')), 'hex') <> k.token_hash then
    perform pg_sleep(1); raise exception 'backup key mismatch';
  end if;
  out := jsonb_build_object(
    'version', 1, 'at', now(),
    'shops',          coalesce((select jsonb_agg(to_jsonb(x) order by x.sort, x.id) from shops x), '[]'),
    'shop_private',   coalesce((select jsonb_agg(to_jsonb(x)) from shop_private x), '[]'),
    'settings',       coalesce((select jsonb_agg(to_jsonb(x)) from settings x), '[]'),
    'settlements',    coalesce((select jsonb_agg(to_jsonb(x)) from settlements x), '[]'),
    'bookings',       coalesce((select jsonb_agg(to_jsonb(x)) from bookings x), '[]'),
    'booking_events', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from booking_events x), '[]'),
    'reviews',        coalesce((select jsonb_agg(to_jsonb(x)) from reviews x), '[]'),
    'leads',          coalesce((select jsonb_agg(to_jsonb(x)) from leads x), '[]'),
    'lead_logs',      coalesce((select jsonb_agg(to_jsonb(x)) from lead_logs x), '[]'),
    'tasks',          coalesce((select jsonb_agg(to_jsonb(x)) from tasks x), '[]'),
    'templates',      coalesce((select jsonb_agg(to_jsonb(x)) from templates x), '[]'),
    'comments',       coalesce((select jsonb_agg(to_jsonb(x)) from comments x), '[]'),
    'admins',         coalesce((select jsonb_agg(jsonb_build_object('email', email, 'name', name, 'created_at', created_at)) from admins), '[]'),
    'admin_emails',   coalesce((select jsonb_agg(to_jsonb(x)) from admin_emails x), '[]'),
    'stats_daily',    coalesce((select jsonb_agg(to_jsonb(x)) from stats_daily x), '[]'),
    'stats_dim',      coalesce((select jsonb_agg(to_jsonb(x)) from stats_dim x), '[]'),
    'customers',      coalesce((select jsonb_agg(to_jsonb(x)) from customers x), '[]'),
    'customer_logs',  coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from customer_logs x), '[]'),
    'coupons',        coalesce((select jsonb_agg(to_jsonb(x)) from coupons x), '[]'));
  update backup_keys set last_run = now(), last_size = length(out::text) where id = 1;
  return out;
end $$;
revoke all on function public.backup_dump(text) from public;
grant execute on function public.backup_dump(text) to anon, authenticated;

-- 끝! 'Success. No rows returned' 가 보이면 완료예요.

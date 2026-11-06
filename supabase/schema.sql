-- =====================================================================
-- 엉클데이 데이터베이스 설정
-- Supabase → SQL Editor → New query 에 이 파일 전체를 붙여넣고 Run 하세요.
-- 여러 번 실행해도 괜찮아요 (이미 있는 건 건너뛰거나 새로 고쳐요).
-- =====================================================================

-- ---------------------------------------------------------------
-- 1. 관리자
-- ---------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  name       text,
  created_at timestamptz not null default now()
);
-- 관리자로 들어올 수 있는 이메일 목록 (직원 추가용)
create table if not exists public.admin_emails (
  email      text primary key,
  added_by   text,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid())
$$;

-- 로그인한 사람이 관리자인지 확인. 관리자가 아직 한 명도 없으면 처음 로그인한 사람이 관리자가 돼요.
create or replace function public.claim_admin() returns boolean
language plpgsql security definer set search_path = public as $$
declare em text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from admins where user_id = auth.uid()) then return true; end if;
  if not exists (select 1 from admins) or exists (select 1 from admin_emails where lower(email) = em) then
    insert into admins (user_id, email) values (auth.uid(), em) on conflict do nothing;
    return true;
  end if;
  return false;
end $$;

-- 누가 했는지 기록할 때 쓰는 이름
create or replace function public.actor_name() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(current_setting('app.actor', true), ''),
    (select '관리자 ' || email from admins where user_id = auth.uid()),
    'system')
$$;

-- ---------------------------------------------------------------
-- 2. 업체
-- ---------------------------------------------------------------
create table if not exists public.shops (
  id          text primary key,
  data        jsonb not null,               -- 손님 화면에 보이는 정보 (이름, 메뉴, 사진, 후기 …)
  sort        int not null default 0,       -- 목록 순서
  published   boolean not null default true,-- false면 사이트에서 숨김
  updated_at  timestamptz not null default now(),
  updated_by  text
);

-- 관리자만 보는 업체 정보
create table if not exists public.shop_private (
  shop_id          text primary key references public.shops(id) on update cascade on delete cascade,
  notes            jsonb not null default '{}'::jsonb,  -- 확인 필요 메모, 정보 확인 체크
  commission_rate  numeric(5,2) not null default 0 check (commission_rate between 0 and 100),  -- 수수료율 %
  contract         jsonb not null default '{}'::jsonb,  -- 담당자, 연락처, 계약일, 정산 계좌, 메모
  updated_at       timestamptz not null default now()
);

-- 사이트 설정 (카테고리 사진 등)
create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- 3. 정산 (업체별·월별 수수료 청구)
-- ---------------------------------------------------------------
create table if not exists public.settlements (
  id               uuid primary key default gen_random_uuid(),
  shop_id          text references public.shops(id) on update cascade on delete set null,
  shop_name        text,
  month            text not null,                 -- 2026-11
  booking_count    int not null default 0,
  total_paid       bigint not null default 0,     -- 손님이 업체에 낸 금액 합계 (VND)
  total_commission bigint not null default 0,     -- 수수료 합계 (VND)
  status           text not null default 'billed' check (status in ('billed', 'paid', 'void')),
  billed_at        timestamptz not null default now(),
  paid_at          timestamptz,
  memo             text,
  created_by       text
);

-- ---------------------------------------------------------------
-- 4. 예약
-- ---------------------------------------------------------------
-- 예약번호 만들기: UD-월일-4자리 (베트남 날짜 기준)
create or replace function public.new_booking_code() returns text
language plpgsql volatile set search_path = public as $$
declare c text; n int := 0;
begin
  loop
    c := 'UD-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'MMDD') || '-' || lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when to_regclass('public.bookings') is null or not exists (select 1 from public.bookings where code = c);
    n := n + 1; if n > 50 then raise exception '잠시 후 다시 시도해 주세요'; end if;
  end loop;
  return c;
end $$;

create table if not exists public.bookings (
  id               uuid primary key default gen_random_uuid(),
  code             text unique not null,          -- 예약번호 UD-1106-4821
  shop_id          text references public.shops(id) on update cascade on delete set null,
  shop_name        text,
  menu_name        text,
  menu_min         int,
  unit_price       bigint,                        -- 메뉴 1인 가격 (VND)
  people           int not null default 1 check (people between 1 and 30),
  list_price       bigint,                        -- 메뉴 가격 × 인원 (예상 금액)
  visit_date       date,
  visit_time       text,
  customer_name    text,
  contact          text,
  note             text,
  lang             text not null default 'ko',
  source           text not null default 'web',   -- web 사이트 / kakao 카톡 / phone 전화 / etc 기타
  status           text not null default 'requested'
                   check (status in ('requested','confirmed','rejected','visited','settled','cancelled','noshow')),
  paid_amount      bigint check (paid_amount >= 0),   -- 손님이 업체에 실제로 낸 금액 (VND)
  commission_rate  numeric(5,2) not null default 0,   -- 예약 당시 수수료율
  commission       bigint generated always as (round(coalesce(paid_amount, 0) * commission_rate / 100)) stored,
  shop_token       text unique not null default replace(gen_random_uuid()::text, '-', ''),
  customer_token   text unique not null default replace(gen_random_uuid()::text, '-', ''),
  sent_to_shop_at  timestamptz,   -- 업체에 예약을 알린 시각
  shop_replied_at  timestamptz,   -- 업체가 링크로 답한 시각
  customer_visit_at timestamptz,  -- 손님이 '방문했어요'를 누른 시각
  visited_at       timestamptz,   -- 방문 완료 처리 시각
  settlement_id    uuid references public.settlements(id) on delete set null,
  admin_memo       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.bookings alter column code set default public.new_booking_code();
create index if not exists bookings_shop_idx   on public.bookings (shop_id, visit_date);
create index if not exists bookings_status_idx on public.bookings (status, visit_date);

-- 예약 기록 (누가 언제 무엇을 했는지 — 지울 수 없어요)
create table if not exists public.booking_events (
  id          bigserial primary key,
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  at          timestamptz not null default now(),
  actor       text not null default 'system',
  action      text not null,
  detail      jsonb not null default '{}'::jsonb
);
create index if not exists booking_events_booking_idx on public.booking_events (booking_id, at);

-- ---------------------------------------------------------------
-- 5. 이용 후기 (손님이 보내면 관리자가 확인 후 게시)
-- ---------------------------------------------------------------
create table if not exists public.reviews (
  id           uuid primary key default gen_random_uuid(),
  shop_id      text references public.shops(id) on update cascade on delete cascade,
  booking_id   uuid references public.bookings(id) on delete set null,  -- 예약한 손님이 쓴 후기면 연결
  stars        int not null check (stars between 1 and 5),
  name         text,
  visit_month  text,
  menu         text,
  body         text not null,
  lang         text not null default 'ko',
  contact      text,
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at   timestamptz not null default now(),
  decided_at   timestamptz
);

-- ---------------------------------------------------------------
-- 6. 자동 기록 (트리거)
-- ---------------------------------------------------------------
create or replace function public.touch_updated() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists shops_touch on public.shops;
create trigger shops_touch before update on public.shops for each row execute function public.touch_updated();
drop trigger if exists shop_private_touch on public.shop_private;
create trigger shop_private_touch before update on public.shop_private for each row execute function public.touch_updated();

create or replace function public.bookings_before() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    -- 예약번호와 링크 열쇠는 바꿀 수 없어요
    new.code := old.code; new.shop_token := old.shop_token; new.customer_token := old.customer_token;
    new.created_at := old.created_at;
    if new.status = 'visited' and old.status is distinct from 'visited' and new.visited_at is null then
      new.visited_at := now();
    end if;
    -- 정산이 끝난 예약은 금액을 바꿀 수 없어요
    if old.status = 'settled' and (new.paid_amount is distinct from old.paid_amount
        or new.commission_rate is distinct from old.commission_rate) then
      raise exception '정산이 끝난 예약은 금액을 바꿀 수 없어요';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists bookings_before on public.bookings;
create trigger bookings_before before insert or update on public.bookings
  for each row execute function public.bookings_before();

create or replace function public.bookings_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare ch jsonb := '{}'::jsonb; k text;
begin
  if tg_op = 'INSERT' then
    insert into booking_events (booking_id, actor, action, detail)
    values (new.id, actor_name(), 'created', jsonb_build_object('source', new.source, 'status', new.status));
    return new;
  end if;
  foreach k in array array['status','shop_id','visit_date','visit_time','people','menu_name','paid_amount',
                           'commission_rate','customer_name','contact','settlement_id'] loop
    if (to_jsonb(old) -> k) is distinct from (to_jsonb(new) -> k) then
      ch := ch || jsonb_build_object(k, jsonb_build_array(to_jsonb(old) -> k, to_jsonb(new) -> k));
    end if;
  end loop;
  if ch <> '{}'::jsonb then
    insert into booking_events (booking_id, actor, action, detail)
    values (new.id, actor_name(), case when ch ? 'status' then 'status' else 'edit' end, ch);
  end if;
  return new;
end $$;
drop trigger if exists bookings_log on public.bookings;
create trigger bookings_log after insert or update on public.bookings
  for each row execute function public.bookings_log();

-- 기록의 작성자는 항상 실제로 한 사람으로
create or replace function public.events_before() returns trigger
language plpgsql security definer set search_path = public as $$
begin new.actor := actor_name(); new.at := now(); return new; end $$;
drop trigger if exists events_before on public.booking_events;
create trigger events_before before insert on public.booking_events
  for each row execute function public.events_before();

-- ---------------------------------------------------------------
-- 7. 보안 규칙 (Row Level Security)
-- ---------------------------------------------------------------
alter table public.admins          enable row level security;
alter table public.admin_emails    enable row level security;
alter table public.shops           enable row level security;
alter table public.shop_private    enable row level security;
alter table public.settings        enable row level security;
alter table public.settlements     enable row level security;
alter table public.bookings        enable row level security;
alter table public.booking_events  enable row level security;
alter table public.reviews         enable row level security;

do $$
declare t text;
begin
  -- 관리자는 전부 읽고 쓰기 (단, 기록은 지우거나 고칠 수 없음 — 아래에서 따로)
  foreach t in array array['admins','admin_emails','shops','shop_private','settings','settlements','bookings','reviews'] loop
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- 예약은 지우지 않고 '취소'로 남겨요
drop policy if exists admin_all on public.bookings;
drop policy if exists admin_read on public.bookings;
drop policy if exists admin_insert on public.bookings;
drop policy if exists admin_update on public.bookings;
create policy admin_read   on public.bookings for select to authenticated using (public.is_admin());
create policy admin_insert on public.bookings for insert to authenticated with check (public.is_admin());
create policy admin_update on public.bookings for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists admin_read on public.booking_events;
drop policy if exists admin_insert on public.booking_events;
create policy admin_read   on public.booking_events for select to authenticated using (public.is_admin());
create policy admin_insert on public.booking_events for insert to authenticated with check (public.is_admin());

-- 손님 화면: 공개된 업체와 설정만 읽기
drop policy if exists public_read on public.shops;
create policy public_read on public.shops for select to anon, authenticated using (published);
drop policy if exists public_read on public.settings;
create policy public_read on public.settings for select to anon, authenticated using (key in ('cat_imgs'));

-- ---------------------------------------------------------------
-- 8. 손님·업체가 쓰는 기능 (로그인 없이, 정해진 일만)
-- ---------------------------------------------------------------

-- 손님 예약 요청 → 예약번호와 예약확인증 열쇠를 돌려줘요
create or replace function public.create_booking(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s shops; sp shop_private; m jsonb; i int; ppl int; c text; b bookings; tries int := 0;
  vd date; nm text; ct text;
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
  if vd is null or vd < (now() at time zone 'Asia/Ho_Chi_Minh')::date or vd > (now() at time zone 'Asia/Ho_Chi_Minh')::date + 365 then
    raise exception '날짜를 확인해 주세요';
  end if;
  if nm = '' or ct = '' then raise exception '이름과 연락처를 적어 주세요'; end if;
  -- 장난 예약 막기: 같은 연락처로 1시간에 5건, 전체 1분에 20건까지
  if (select count(*) from bookings where contact = ct and created_at > now() - interval '1 hour') >= 5
     or (select count(*) from bookings where source = 'web' and created_at > now() - interval '1 minute') >= 20 then
    raise exception '잠시 후 다시 시도해 주세요';
  end if;
  select * into sp from shop_private where shop_id = s.id;
  c := new_booking_code();
  insert into bookings (code, shop_id, shop_name, menu_name, menu_min, unit_price, people, list_price,
                        visit_date, visit_time, customer_name, contact, note, lang, source, commission_rate)
  values (c, s.id, s.data -> 'name' ->> 'ko', m -> 'name' ->> 'ko', (m ->> 'min')::int, (m ->> 'price')::bigint, ppl,
          (m ->> 'price')::bigint * ppl, vd, left(p ->> 'time', 5), nm, ct, left(p ->> 'note', 500),
          left(coalesce(p ->> 'lang', 'ko'), 2), 'web', coalesce(sp.commission_rate, 0))
  returning * into b;
  return jsonb_build_object('code', b.code, 'token', b.customer_token);
end $$;

-- 예약확인증 (손님용)
create or replace function public.booking_for_customer(t text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b bookings; s shops;
begin
  select * into b from bookings where customer_token = t;
  if not found or t is null or length(t) < 20 then return null; end if;
  select * into s from shops where id = b.shop_id;
  return jsonb_build_object(
    'code', b.code, 'status', b.status, 'shop_id', b.shop_id, 'shop_name', b.shop_name,
    'shop', case when s.id is null then null else jsonb_build_object(
       'name', s.data -> 'name', 'address', s.data -> 'address', 'map', s.data -> 'map',
       'img', s.data -> 'img', 'imgPos', s.data -> 'imgPos', 'menu', s.data -> 'menu') end,
    'menu_name', b.menu_name, 'menu_min', b.menu_min, 'people', b.people, 'list_price', b.list_price,
    'visit_date', b.visit_date, 'visit_time', b.visit_time, 'customer_name', b.customer_name,
    'note', b.note, 'lang', b.lang, 'created_at', b.created_at,
    'customer_visit_at', b.customer_visit_at,
    'reviewed', exists (select 1 from reviews where booking_id = b.id));
end $$;

-- 손님: 방문했어요 / 예약 취소
create or replace function public.customer_action(t text, action text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  perform set_config('app.actor', '손님', true);
  select * into b from bookings where customer_token = t;
  if not found or t is null or length(t) < 20 then raise exception '예약을 찾을 수 없어요'; end if;
  if action = 'visited' then
    if b.customer_visit_at is null then
      update bookings set customer_visit_at = now() where id = b.id;
      insert into booking_events (booking_id, action, detail) values (b.id, 'customer_visited', '{}');
    end if;
  elsif action = 'cancel' then
    if b.status not in ('requested', 'confirmed') then raise exception '이미 처리된 예약이라 취소할 수 없어요. 상담으로 문의해 주세요'; end if;
    update bookings set status = 'cancelled' where id = b.id;
  else
    raise exception '알 수 없는 요청이에요';
  end if;
  return booking_for_customer(t);
end $$;

-- 예약 찾기 (예약번호 + 연락처)
create or replace function public.find_booking(c text, ct text) returns text
language sql security definer set search_path = public as $$
  select customer_token from bookings
  where upper(trim(code)) = upper(trim(c))
    and regexp_replace(lower(contact), '[^0-9a-z@._]', '', 'g') = regexp_replace(lower(ct), '[^0-9a-z@._]', '', 'g')
  limit 1
$$;

-- 업체용 예약 화면 (손님 연락처는 보여주지 않아요)
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
    'note', b.note, 'lang', b.lang, 'paid_amount', b.paid_amount, 'shop_replied_at', b.shop_replied_at);
end $$;

-- 업체: 예약 가능 / 불가 / 방문 완료(+받은 금액)
create or replace function public.shop_reply(t text, action text, amount bigint default null, memo text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  perform set_config('app.actor', '업체', true);
  select * into b from bookings where shop_token = t;
  if not found or t is null or length(t) < 20 then raise exception 'Booking not found'; end if;
  if b.status in ('settled', 'cancelled') then raise exception 'This booking is closed'; end if;
  if action = 'accept' then
    update bookings set status = 'confirmed', shop_replied_at = now() where id = b.id and status in ('requested', 'rejected');
  elsif action = 'reject' then
    if b.status not in ('requested', 'confirmed') then raise exception 'Cannot change now'; end if;
    update bookings set status = 'rejected', shop_replied_at = now() where id = b.id;
  elsif action = 'visited' then
    if amount is null or amount < 0 then raise exception 'Please enter the amount'; end if;
    update bookings set status = 'visited', paid_amount = amount, shop_replied_at = now() where id = b.id;
  elsif action = 'noshow' then
    update bookings set status = 'noshow', shop_replied_at = now() where id = b.id and status in ('requested', 'confirmed');
  else
    raise exception 'Unknown action';
  end if;
  if coalesce(memo, '') <> '' then
    insert into booking_events (booking_id, action, detail) values (b.id, 'shop_memo', jsonb_build_object('memo', left(memo, 500)));
  end if;
  return booking_for_shop(t);
end $$;

-- 손님 이용 후기 보내기 (예약확인증에서 쓰면 예약과 연결돼요)
create or replace function public.submit_review(p jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare bid uuid; sid text := p ->> 'shop_id'; st int := (p ->> 'stars')::int;
begin
  if coalesce(p ->> 'token', '') <> '' then
    select id, shop_id into bid, sid from bookings where customer_token = p ->> 'token';
    if bid is null then raise exception '예약을 찾을 수 없어요'; end if;
    if exists (select 1 from reviews where booking_id = bid) then raise exception '이미 후기를 보내셨어요'; end if;
  end if;
  if not exists (select 1 from shops where id = sid and published) then raise exception '업체를 찾을 수 없어요'; end if;
  if st is null or st < 1 or st > 5 then raise exception '별점을 골라 주세요'; end if;
  if length(trim(coalesce(p ->> 'text', ''))) < 10 then raise exception '내용을 조금 더 적어 주세요'; end if;
  if (select count(*) from reviews where created_at > now() - interval '1 minute') >= 10 then
    raise exception '잠시 후 다시 시도해 주세요';
  end if;
  insert into reviews (shop_id, booking_id, stars, name, visit_month, menu, body, lang, contact)
  values (sid, bid, st, left(p ->> 'name', 40), left(p ->> 'month', 7), left(p ->> 'menu', 80),
          left(p ->> 'text', 2000), left(coalesce(p ->> 'lang', 'ko'), 2), left(p ->> 'contact', 80));
  return true;
end $$;

-- ---------------------------------------------------------------
-- 9. 관리자 기능: 정산서 만들기 / 입금 확인 / 취소
-- ---------------------------------------------------------------
create or replace function public.create_settlement(p_shop text, p_month text, p_memo text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid; n int; tp bigint; tc bigint;
begin
  if not is_admin() then raise exception '관리자만 할 수 있어요'; end if;
  select count(*), coalesce(sum(paid_amount), 0), coalesce(sum(commission), 0) into n, tp, tc
  from bookings where shop_id = p_shop and status = 'visited' and settlement_id is null
    and to_char(visit_date, 'YYYY-MM') = p_month;
  if n = 0 then raise exception '정산할 방문 완료 예약이 없어요'; end if;
  insert into settlements (shop_id, shop_name, month, booking_count, total_paid, total_commission, memo, created_by)
  values (p_shop, (select data -> 'name' ->> 'ko' from shops where id = p_shop), p_month, n, tp, tc, p_memo, actor_name())
  returning id into sid;
  update bookings set settlement_id = sid
  where shop_id = p_shop and status = 'visited' and settlement_id is null and to_char(visit_date, 'YYYY-MM') = p_month;
  return sid;
end $$;

create or replace function public.settlement_paid(p_id uuid, p_paid boolean default true) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception '관리자만 할 수 있어요'; end if;
  if p_paid then
    update settlements set status = 'paid', paid_at = now() where id = p_id;
    update bookings set status = 'settled' where settlement_id = p_id and status = 'visited';
  else
    update settlements set status = 'billed', paid_at = null where id = p_id;
    update bookings set status = 'visited' where settlement_id = p_id and status = 'settled';
  end if;
end $$;

create or replace function public.settlement_void(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception '관리자만 할 수 있어요'; end if;
  if (select status from settlements where id = p_id) = 'paid' then raise exception '입금 확인된 정산서는 먼저 입금 확인을 취소해 주세요'; end if;
  update settlements set status = 'void' where id = p_id;
  update bookings set settlement_id = null where settlement_id = p_id;
end $$;

-- ---------------------------------------------------------------
-- 10. 권한 정리
-- ---------------------------------------------------------------
revoke all on function public.create_settlement(text, text, text), public.settlement_paid(uuid, boolean),
  public.settlement_void(uuid) from public, anon;
grant execute on function public.create_settlement(text, text, text), public.settlement_paid(uuid, boolean),
  public.settlement_void(uuid) to authenticated;
revoke all on function public.create_booking(jsonb), public.booking_for_customer(text), public.customer_action(text, text),
  public.find_booking(text, text), public.booking_for_shop(text), public.shop_reply(text, text, bigint, text),
  public.submit_review(jsonb) from public;
grant execute on function public.create_booking(jsonb), public.booking_for_customer(text), public.customer_action(text, text),
  public.find_booking(text, text), public.booking_for_shop(text), public.shop_reply(text, text, bigint, text),
  public.submit_review(jsonb), public.claim_admin(), public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------
-- 11. 사진 저장소 (업체 사진, 가격표, 카테고리 사진)
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true;

drop policy if exists "uncleday admin write" on storage.objects;
create policy "uncleday admin write" on storage.objects for all to authenticated
  using (bucket_id = 'images' and public.is_admin()) with check (bucket_id = 'images' and public.is_admin());

-- ---------------------------------------------------------------
-- 12. 방문 통계 (날짜·업체별 숫자만 세요. 개인정보는 저장하지 않아요)
--   visit 방문자(브라우저당 하루 1번) / hit 방문 수(페이지를 열 때마다) / view 업체 상세 조회 / consult 상담하기 클릭 / map 지도 클릭
-- ---------------------------------------------------------------
create table if not exists public.stats_daily (
  day      date not null,
  shop_id  text not null default '',
  kind     text not null,
  n        int  not null default 0,
  primary key (day, shop_id, kind)
);
alter table public.stats_daily enable row level security;
drop policy if exists admin_read on public.stats_daily;
create policy admin_read on public.stats_daily for select to authenticated using (public.is_admin());

create or replace function public.track(k text, s text default null) returns void
language plpgsql security definer set search_path = public as $$
declare sid text := left(coalesce(s, ''), 80);
begin
  if k not in ('visit', 'hit', 'view', 'consult', 'map') then return; end if;
  if sid <> '' and not exists (select 1 from shops where id = sid) then sid := ''; end if;
  insert into stats_daily (day, shop_id, kind, n)
  values ((now() at time zone 'Asia/Ho_Chi_Minh')::date, sid, k, 1)
  on conflict (day, shop_id, kind) do update set n = stats_daily.n + 1;
end $$;
revoke all on function public.track(text, text) from public;
grant execute on function public.track(text, text) to anon, authenticated;

-- ---------------------------------------------------------------
-- 13. 업무 관리: 할 일 보드, 업체 영업 진행
-- ---------------------------------------------------------------
create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  city        text,
  cat         text,
  stage       text not null default 'found'
              check (stage in ('found','contacted','meeting','negotiating','signed','live','hold')),
  person      text,                 -- 업체 담당자
  contact     text,                 -- 전화·잘로·카톡
  map         text,
  assignee    text,                 -- 우리 쪽 담당 (관리자 이메일)
  next_action text,
  next_date   date,
  rate        numeric(5,2),         -- 제안·합의 수수료율
  memo        text,
  shop_id     text references public.shops(id) on update cascade on delete set null,
  sort        double precision not null default 0,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create table if not exists public.lead_logs (
  id       bigserial primary key,
  lead_id  uuid not null references public.leads(id) on delete cascade,
  at       timestamptz not null default now(),
  actor    text not null default 'system',
  kind     text not null default 'memo',
  body     text,
  detail   jsonb not null default '{}'::jsonb
);
create index if not exists lead_logs_lead_idx on public.lead_logs (lead_id, at);
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  memo        text,
  status      text not null default 'todo' check (status in ('todo','doing','done')),
  assignee    text,
  due         date,
  priority    int not null default 1 check (priority between 0 and 2),
  shop_id     text references public.shops(id) on update cascade on delete set null,
  lead_id     uuid references public.leads(id) on delete set null,
  sort        double precision not null default 0,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  done_at     timestamptz
);

-- 참조 담당자 (여러 명)
alter table public.tasks add column if not exists watchers text[] not null default '{}';

create or replace function public.tasks_before() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then new.created_by := actor_name(); new.created_at := now(); end if;
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then new.done_at := now(); end if;
  if new.status <> 'done' then new.done_at := null; end if;
  return new;
end $$;
drop trigger if exists tasks_before on public.tasks;
create trigger tasks_before before insert or update on public.tasks for each row execute function public.tasks_before();

create or replace function public.leads_before() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then new.created_by := actor_name(); new.created_at := now(); end if;
  return new;
end $$;
drop trigger if exists leads_before on public.leads;
create trigger leads_before before insert or update on public.leads for each row execute function public.leads_before();

-- 영업 단계·담당자·업체 연결이 바뀌면 자동으로 기록
create or replace function public.leads_log() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into lead_logs (lead_id, kind, body, detail) values (new.id, 'created', null, jsonb_build_object('stage', new.stage));
  else
    if new.stage is distinct from old.stage then
      insert into lead_logs (lead_id, kind, detail) values (new.id, 'stage', jsonb_build_object('from', old.stage, 'to', new.stage));
    end if;
    if new.assignee is distinct from old.assignee then
      insert into lead_logs (lead_id, kind, detail) values (new.id, 'assignee', jsonb_build_object('from', old.assignee, 'to', new.assignee));
    end if;
    if new.shop_id is distinct from old.shop_id and new.shop_id is not null then
      insert into lead_logs (lead_id, kind, detail) values (new.id, 'shop', jsonb_build_object('shop_id', new.shop_id));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists leads_log on public.leads;
create trigger leads_log after insert or update on public.leads for each row execute function public.leads_log();

create or replace function public.lead_logs_before() returns trigger language plpgsql security definer set search_path = public as $$
begin new.actor := actor_name(); new.at := now(); return new; end $$;
drop trigger if exists lead_logs_before on public.lead_logs;
create trigger lead_logs_before before insert on public.lead_logs for each row execute function public.lead_logs_before();

alter table public.leads     enable row level security;
alter table public.lead_logs enable row level security;
alter table public.tasks     enable row level security;
drop policy if exists admin_all on public.leads;
create policy admin_all on public.leads for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_all on public.tasks;
create policy admin_all on public.tasks for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_read on public.lead_logs;
drop policy if exists admin_insert on public.lead_logs;
create policy admin_read   on public.lead_logs for select to authenticated using (public.is_admin());
create policy admin_insert on public.lead_logs for insert to authenticated with check (public.is_admin());

-- ---------------------------------------------------------------
-- 14. 메모 템플릿 (관리자가 저장해 두고 불러 쓰는 양식)
-- ---------------------------------------------------------------
create table if not exists public.templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  body        text not null,
  created_by  text,
  created_at  timestamptz not null default now()
);
create or replace function public.templates_before() returns trigger language plpgsql security definer set search_path = public as $$
begin new.created_by := actor_name(); new.created_at := now(); return new; end $$;
drop trigger if exists templates_before on public.templates;
create trigger templates_before before insert on public.templates for each row execute function public.templates_before();
alter table public.templates enable row level security;
drop policy if exists admin_all on public.templates;
create policy admin_all on public.templates for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------
-- 15. 댓글 (할 일·영업 카드)
-- ---------------------------------------------------------------
create table if not exists public.comments (
  id            uuid primary key default gen_random_uuid(),
  target_type   text not null check (target_type in ('task', 'lead')),
  target_id     uuid not null,
  body          text not null,
  author        text,
  author_email  text,
  created_at    timestamptz not null default now(),
  edited_at     timestamptz
);
create index if not exists comments_target_idx on public.comments (target_type, target_id, created_at);
create or replace function public.comments_before() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.author := actor_name(); new.author_email := lower(coalesce(auth.jwt() ->> 'email', '')); new.created_at := now(); new.edited_at := null;
  else
    new.author := old.author; new.author_email := old.author_email; new.created_at := old.created_at;
    new.target_type := old.target_type; new.target_id := old.target_id; new.edited_at := now();
  end if;
  return new;
end $$;
drop trigger if exists comments_before on public.comments;
create trigger comments_before before insert or update on public.comments for each row execute function public.comments_before();
alter table public.comments enable row level security;
drop policy if exists admin_read on public.comments;
drop policy if exists admin_insert on public.comments;
drop policy if exists own_update on public.comments;
drop policy if exists own_delete on public.comments;
create policy admin_read   on public.comments for select to authenticated using (public.is_admin());
create policy admin_insert on public.comments for insert to authenticated with check (public.is_admin());
create policy own_update   on public.comments for update to authenticated
  using (public.is_admin() and author_email = lower(auth.jwt() ->> 'email')) with check (public.is_admin());
create policy own_delete   on public.comments for delete to authenticated
  using (public.is_admin() and author_email = lower(auth.jwt() ->> 'email'));

-- ---------------------------------------------------------------
-- 16. 알림 (@언급, 담당자 지정, 참조, 내 일에 달린 댓글)
-- ---------------------------------------------------------------
create table if not exists public.notifications (
  id               uuid primary key default gen_random_uuid(),
  recipient_email  text not null,
  kind             text not null,              -- mention / assign / ref / comment
  target_type      text not null,              -- task / lead
  target_id        uuid not null,
  title            text,
  body             text,
  actor            text,
  created_at       timestamptz not null default now(),
  read_at          timestamptz
);
create index if not exists notifications_rcpt_idx on public.notifications (recipient_email, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists own_read on public.notifications;
drop policy if exists own_update on public.notifications;
drop policy if exists own_delete on public.notifications;
create policy own_read   on public.notifications for select to authenticated using (recipient_email = lower(auth.jwt() ->> 'email'));
create policy own_update on public.notifications for update to authenticated using (recipient_email = lower(auth.jwt() ->> 'email')) with check (recipient_email = lower(auth.jwt() ->> 'email'));
create policy own_delete on public.notifications for delete to authenticated using (recipient_email = lower(auth.jwt() ->> 'email'));

create or replace function public.notify(p_to text, p_kind text, p_type text, p_id uuid, p_title text, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare me text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if p_to is null or lower(p_to) = me then return; end if;              -- 내가 한 일은 나에게 알리지 않아요
  if not exists (select 1 from admins where lower(email) = lower(p_to)) then return; end if;
  insert into notifications (recipient_email, kind, target_type, target_id, title, body, actor)
  values (lower(p_to), p_kind, p_type, p_id, left(p_title, 200), left(p_body, 300), actor_name());
end $$;
revoke all on function public.notify(text, text, text, uuid, text, text) from public, anon, authenticated;

create or replace function public.comments_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare t_title text; owner text; refs text[]; m text; done text[] := '{}';
begin
  if new.target_type = 'task' then select title, assignee, watchers into t_title, owner, refs from tasks where id = new.target_id;
  else select name, assignee, '{}'::text[] into t_title, owner, refs from leads where id = new.target_id; end if;
  -- @이름 언급
  for m in select distinct lower(x[1]) from regexp_matches(new.body, '@([A-Za-z0-9._\-가-힣]+)', 'g') as x loop
    for owner in select email from admins where lower(split_part(email, '@', 1)) = m or lower(coalesce(name, '')) = m loop
      perform notify(owner, 'mention', new.target_type, new.target_id, t_title, new.body); done := done || lower(owner);
    end loop;
  end loop;
  -- 담당자·참조자에게 새 댓글
  if new.target_type = 'task' then select assignee into owner from tasks where id = new.target_id;
  else select assignee into owner from leads where id = new.target_id; end if;
  foreach m in array (array[owner] || coalesce(refs, '{}')) loop
    if m is not null and not (lower(m) = any(done)) then perform notify(m, 'comment', new.target_type, new.target_id, t_title, new.body); done := done || lower(m); end if;
  end loop;
  return new;
end $$;
drop trigger if exists comments_notify on public.comments;
create trigger comments_notify after insert on public.comments for each row execute function public.comments_notify();

create or replace function public.tasks_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare w text;
begin
  if new.assignee is not null and (tg_op = 'INSERT' or new.assignee is distinct from old.assignee) then
    perform notify(new.assignee, 'assign', 'task', new.id, new.title, '할 일 담당자로 지정됐어요');
  end if;
  foreach w in array coalesce(new.watchers, '{}') loop
    if tg_op = 'INSERT' or not (w = any(coalesce(old.watchers, '{}'))) then
      perform notify(w, 'ref', 'task', new.id, new.title, '할 일에 참조됐어요');
    end if;
  end loop;
  if tg_op = 'UPDATE' and new.status = 'done' and old.status <> 'done' then
    foreach w in array (array[new.created_by] || coalesce(new.watchers, '{}')) loop
      perform notify(regexp_replace(coalesce(w, ''), '^관리자 ', ''), 'done', 'task', new.id, new.title, '할 일이 완료됐어요');
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists tasks_notify on public.tasks;
create trigger tasks_notify after insert or update on public.tasks for each row execute function public.tasks_notify();

create or replace function public.leads_notify() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assignee is not null and (tg_op = 'INSERT' or new.assignee is distinct from old.assignee) then
    perform notify(new.assignee, 'assign', 'lead', new.id, new.name, '영업 업체 담당자로 지정됐어요');
  end if;
  return new;
end $$;
drop trigger if exists leads_notify on public.leads;
create trigger leads_notify after insert or update on public.leads for each row execute function public.leads_notify();

-- 끝! 아래에 'Success. No rows returned' 가 보이면 완료예요.

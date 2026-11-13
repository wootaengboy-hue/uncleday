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
revoke all on function public.create_booking(jsonb), public.booking_for_customer(text), 
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

-- 12-1. 방문자 분석: 어디서 왔는지 · 기기 · 언어 · 지금 있는 나라(시간대) — 하루 1번, 숫자만
create table if not exists public.stats_dim (
  day  date not null,
  dim  text not null,   -- src(유입경로) / dev(기기) / lang(언어) / tz(시간대 나라)
  val  text not null,
  n    int  not null default 0,
  primary key (day, dim, val)
);
alter table public.stats_dim enable row level security;
drop policy if exists admin_read on public.stats_dim;
create policy admin_read on public.stats_dim for select to authenticated using (public.is_admin());

create or replace function public.track_src(src text, dev text, lang text, tz text) returns void
language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Asia/Ho_Chi_Minh')::date; k text; v text;
begin
  foreach k in array array['src', 'dev', 'lang', 'tz'] loop
    v := case k when 'src' then src when 'dev' then dev when 'lang' then lang else tz end;
    v := left(regexp_replace(lower(coalesce(v, '')), '[^a-z0-9_.:-]', '', 'g'), 40);
    if v = '' then v := 'unknown'; end if;
    insert into stats_dim (day, dim, val, n) values (d, k, v, 1)
    on conflict (day, dim, val) do update set n = stats_dim.n + 1;
  end loop;
end $$;
revoke all on function public.track_src(text, text, text, text) from public;
grant execute on function public.track_src(text, text, text, text) to anon, authenticated;

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

-- ---------------------------------------------------------------
-- 17. 구글 지도 정보 사용량 제한 (무료 한도 안에서만 쓰도록 하루 횟수를 세요)
--   details: 영업시간·평점 (구글 무료 한도 월 1,000회) / photo: 사진 (월 1,000회)
--   하루 30회씩 → 한 달 최대 930회라서 요금이 나가지 않아요.
-- ---------------------------------------------------------------
create table if not exists public.gquota (
  day   date not null,
  kind  text not null,
  n     int  not null default 0,
  primary key (day, kind)
);
alter table public.gquota enable row level security;
drop policy if exists admin_read on public.gquota;
create policy admin_read on public.gquota for select to authenticated using (public.is_admin());
create or replace function public.gquota_take(k text) returns boolean
language plpgsql security definer set search_path = public as $$
declare lim int := case k when 'details' then 30 when 'photo' then 30 else 0 end; cur int;
begin
  if lim = 0 then return false; end if;
  insert into gquota (day, kind, n) values ((now() at time zone 'UTC')::date, k, 0) on conflict do nothing;
  update gquota set n = n + 1 where day = (now() at time zone 'UTC')::date and kind = k and n < lim returning n into cur;
  return cur is not null;
end $$;
revoke all on function public.gquota_take(text) from public;
grant execute on function public.gquota_take(text) to anon, authenticated;

-- ---------------------------------------------------------------
-- 17. 슬랙 알림: 예약·업체 답·손님·후기·팀(댓글/멘션)·영업 단계를 슬랙 채널로 보내요
--     웹후크 주소는 관리자만 볼 수 있는 칸에 저장돼요. 보내기는 DB 안에서(pg_net) 해요.
-- ---------------------------------------------------------------
do $$ begin create extension if not exists pg_net; exception when others then raise notice 'pg_net 을 켤 수 없어요: %', sqlerrm; end $$;

create table if not exists public.slack_cfg (
  id          int primary key default 1 check (id = 1),
  webhook     text,
  enabled     boolean not null default true,
  events      text[] not null default array['booking','shop','customer','review','team','lead'],
  updated_at  timestamptz not null default now(),
  updated_by  text
);
alter table public.slack_cfg add column if not exists hooks jsonb not null default '{}'::jsonb;   -- 알림 종류별 채널 (비면 기본 채널)
insert into public.slack_cfg (id) values (1) on conflict do nothing;
alter table public.slack_cfg enable row level security;
drop policy if exists admin_all on public.slack_cfg;
create policy admin_all on public.slack_cfg for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.slack_send(ev text, msg text) returns void
language plpgsql security definer set search_path = public as $$
declare c slack_cfg; u text;
begin
  select * into c from slack_cfg where id = 1;
  if c is null or not c.enabled then return; end if;
  if ev <> 'test' and not (ev = any(c.events)) then return; end if;
  u := coalesce(nullif(c.hooks ->> ev, ''), c.webhook);   -- 종류별 채널이 있으면 거기로, 없으면 기본 채널로
  if u is null or u !~ '^https://hooks\.slack\.com/' then return; end if;
  begin
    perform net.http_post(url := u, body := jsonb_build_object('text', msg), headers := '{"Content-Type": "application/json"}'::jsonb);
  exception when others then null;   -- 슬랙이 안 돼도 예약 저장은 절대 막지 않아요
  end;
end $$;
revoke all on function public.slack_send(text, text) from public, anon, authenticated;

create or replace function public.slack_test() returns void
language plpgsql security definer set search_path = public as $$
declare c slack_cfg; u text; names text;
  lbl constant jsonb := '{"booking":"📅 새 예약","shop":"🏪 업체 답","customer":"🙋 손님 행동","review":"⭐ 새 후기","team":"💬 팀 알림","lead":"🤝 영업 단계"}';
begin
  if not is_admin() then raise exception '관리자만 할 수 있어요'; end if;
  select * into c from slack_cfg where id = 1;
  -- 채널(웹후크)마다 한 번씩, 그 채널로 오는 알림 종류를 적어서 보내요
  for u in select distinct coalesce(nullif(c.hooks ->> e, ''), c.webhook) from unnest(c.events) e
           union select c.webhook where c.webhook is not null loop
    continue when u is null or u !~ '^https://hooks\.slack\.com/';
    select string_agg(lbl ->> e, ', ') into names from unnest(c.events) e where coalesce(nullif(c.hooks ->> e, ''), c.webhook) = u;
    begin
      perform net.http_post(url := u, body := jsonb_build_object('text', '✅ 엉클데이 슬랙 연결 테스트예요 (' || nick(actor_name()) || E')\n이 채널로 오는 알림: ' || coalesce(names, '없음 (기본 채널)')),
                            headers := '{"Content-Type": "application/json"}'::jsonb);
    exception when others then null; end;
  end loop;
end $$;
revoke all on function public.slack_test() from public, anon;
grant execute on function public.slack_test() to authenticated;

-- '관리자 someone@mail.com' → 닉네임 (없으면 이메일 앞부분)
create or replace function public.nick(t text) returns text language sql stable security definer set search_path = public as $$
  select coalesce((select coalesce(nullif(name, ''), split_part(email, '@', 1)) from admins where lower(email) = lower(regexp_replace(coalesce(t, ''), '^관리자 ', ''))), t) $$;

create or replace function public.slack_money(v bigint) returns text language sql immutable as $$
  select case when v is null then '' else to_char(v, 'FM999,999,999,999') || '₫' end $$;

-- 예약 기록이 생길 때
create or replace function public.slack_booking_ev() returns trigger
language plpgsql security definer set search_path = public as $$
declare b bookings; head text; ev text; m text; st text;
begin
  select * into b from bookings where id = new.booking_id;
  if b is null then return new; end if;
  head := '`' || b.code || '` *' || coalesce(b.shop_name, '업체 미정') || '* · ' || coalesce(to_char(b.visit_date, 'MM/DD'), '날짜 미정')
          || coalesce(' ' || b.visit_time, '') || ' · ' || b.people || '명';
  st := case new.detail -> 'status' ->> 1 when 'confirmed' then '✅ 확정' when 'rejected' then '❌ 불가' when 'visited' then '🙌 방문 완료'
        when 'cancelled' then '🚫 취소' when 'noshow' then '👻 노쇼' when 'settled' then '💰 정산 완료' when 'requested' then '📥 업체 확인 대기로' when 'shop_ok' then '👍 가능 (엉클데이 확정 대기)' when 'reschedule' then '🔁 시간 변경 안내' else null end;
  if new.action = 'created' then
    ev := 'booking'; m := '📅 새 예약' || case when new.actor = '손님' then ' (사이트에서 손님이 직접)' else ' (' || nick(new.actor) || ' 등록)' end || E'\n' || head;
  elsif new.actor = '업체' then
    ev := 'shop';
    if new.action = 'shop_memo' then m := '🏪 업체 메모: ' || coalesce(new.detail ->> 'memo', '') || E'\n' || head;
    elsif st is not null then m := '🏪 업체가 링크로 답했어요: ' || st || coalesce(' · 결제 ' || slack_money(b.paid_amount), '') || E'\n' || head;
    else return new; end if;
  elsif new.actor = '손님' then
    ev := 'customer';
    if new.action = 'customer_visited' then m := '🙋 손님이 "다녀왔어요"를 눌렀어요' || E'\n' || head;
    elsif st is not null then m := '🙋 손님: ' || st || E'\n' || head;
    else return new; end if;
  else
    return new;   -- 관리자가 바꾼 건 보내지 않아요 (본인이 한 일)
  end if;
  perform slack_send(ev, m || E'\n<https://www.uncleday.com/admin.html|관리자에서 보기>');
  return new;
end $$;
drop trigger if exists slack_booking_ev on public.booking_events;
create trigger slack_booking_ev after insert on public.booking_events for each row execute function public.slack_booking_ev();

-- 손님 후기가 들어올 때
create or replace function public.slack_review() returns trigger
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  select coalesce(data -> 'name' ->> 'ko', data -> 'name' ->> 'en', id) into nm from shops where id = new.shop_id;
  perform slack_send('review', '⭐ 새 후기 (게시 대기) · *' || coalesce(nm, '업체') || '* · ' || repeat('★', new.stars) || E'\n> '
    || left(replace(new.body, E'\n', ' '), 200) || E'\n<https://www.uncleday.com/admin.html|확인하고 게시하기>');
  return new;
end $$;
drop trigger if exists slack_review on public.reviews;
create trigger slack_review after insert on public.reviews for each row execute function public.slack_review();

-- 팀 알림(멘션·담당 지정·참조·댓글)이 생길 때
create or replace function public.slack_team() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text; k text;
begin
  select coalesce(nullif(name, ''), split_part(email, '@', 1)) into who from admins where lower(email) = new.recipient_email;
  k := case new.kind when 'mention' then '💬 언급' when 'assign' then '👉 담당 지정' when 'ref' then '👥 참조' when 'comment' then '🗨️ 새 댓글' else '🔔 알림' end;
  perform slack_send('team', k || ' → *' || coalesce(who, new.recipient_email) || '* · ' || coalesce(nick(new.actor), '') || E'\n'
    || case new.target_type when 'task' then '할 일: ' else '영업: ' end || coalesce(new.title, '')
    || coalesce(E'\n> ' || left(replace(regexp_replace(regexp_replace(new.body, '⟦q:[^|⟧]*\|([^⟧]*)⟧', '“\1” →', 'g'), '<[^>]+>', ' ', 'g'), E'\n', ' '), 200), ''));
  return new;
end $$;
drop trigger if exists slack_team on public.notifications;
create trigger slack_team after insert on public.notifications for each row execute function public.slack_team();

-- 영업 단계가 바뀔 때
create or replace function public.slack_lead() returns trigger
language plpgsql security definer set search_path = public as $$
declare l leads; f text; t text;
begin
  if new.kind not in ('stage', 'created') then return new; end if;
  select * into l from leads where id = new.lead_id;
  f := new.detail ->> 'from'; t := coalesce(new.detail ->> 'to', new.detail ->> 'stage');
  perform slack_send('lead', '🤝 영업 · *' || coalesce(l.name, '') || '* · '
    || case when new.kind = 'created' then '🆕 새 후보 추가' else
         (case f when 'found' then '후보 발굴' when 'contacted' then '연락함' when 'meeting' then '미팅' when 'negotiating' then '계약 협의' when 'signed' then '계약 완료' when 'live' then '입점 완료' when 'hold' then '보류·거절' else coalesce(f, '') end)
         || ' → ' || (case t when 'found' then '후보 발굴' when 'contacted' then '연락함' when 'meeting' then '미팅' when 'negotiating' then '계약 협의' when 'signed' then '🎉 계약 완료' when 'live' then '🎉 입점 완료' when 'hold' then '보류·거절' else coalesce(t, '') end) end
    || ' (' || coalesce(nick(new.actor), '') || ')');
  return new;
end $$;
drop trigger if exists slack_lead on public.lead_logs;
create trigger slack_lead after insert on public.lead_logs for each row execute function public.slack_lead();

-- ---------------------------------------------------------------
-- 18. 자동 백업: 매일 GitHub이 '백업 열쇠'로 DB 전체를 받아 가서 비밀번호로 잠가 보관해요 (30일)
--     열쇠 원본은 저장하지 않고 지문(sha256)만 저장해요. 열쇠는 관리자 ⚙️ 계정에서 만들어요.
-- ---------------------------------------------------------------
create table if not exists public.backup_keys (
  id          int primary key default 1 check (id = 1),
  token_hash  text,
  created_at  timestamptz,
  created_by  text,
  last_run    timestamptz,
  last_size   int
);
insert into public.backup_keys (id) values (1) on conflict do nothing;
alter table public.backup_keys enable row level security;
drop policy if exists admin_all on public.backup_keys;
create policy admin_all on public.backup_keys for all to authenticated using (public.is_admin()) with check (public.is_admin());

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
    'stats_dim',      coalesce((select jsonb_agg(to_jsonb(x)) from stats_dim x), '[]'));
  update backup_keys set last_run = now(), last_size = length(out::text) where id = 1;
  return out;
end $$;
revoke all on function public.backup_dump(text) from public;
grant execute on function public.backup_dump(text) to anon, authenticated;

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


-- 20. 낙서장 칸반 카드 순서
alter table public.tasks add column if not exists pos double precision;
alter table public.leads add column if not exists pos double precision;

-- 끝! 아래에 'Success. No rows returned' 가 보이면 완료예요.

-- ---------------------------------------------------------------
-- 21. 비공개 첨부파일 (supabase/files.sql 과 같아요)
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('files', 'files', false, 10485760, array[
  'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/x-hwp','application/vnd.hancom.hwpx','text/plain','text/csv',
  'image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "uncleday files admin" on storage.objects;
create policy "uncleday files admin" on storage.objects for all to authenticated
  using (bucket_id = 'files' and public.is_admin()) with check (bucket_id = 'files' and public.is_admin());

create table if not exists public.attachments (
  id           uuid primary key default gen_random_uuid(),
  target_type  text not null check (target_type in ('task', 'lead')),
  target_id    uuid not null,
  path         text not null unique,
  name         text not null,
  size         bigint not null default 0,
  mime         text,
  uploaded_by  text,
  created_at   timestamptz not null default now()
);
create index if not exists attachments_target_idx on public.attachments (target_type, target_id, created_at);
alter table public.attachments enable row level security;

create or replace function public.attachments_before() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.uploaded_by := lower(coalesce(auth.jwt() ->> 'email', '')); new.created_at := now();
  return new;
end $$;
drop trigger if exists attachments_before on public.attachments;
create trigger attachments_before before insert on public.attachments for each row execute function public.attachments_before();

drop policy if exists att_read on public.attachments;
create policy att_read on public.attachments for select to authenticated using (public.is_admin());
drop policy if exists att_add on public.attachments;
create policy att_add on public.attachments for insert to authenticated with check (public.is_admin());
drop policy if exists att_del on public.attachments;   -- 올린 사람만 지울 수 있어요
create policy att_del on public.attachments for delete to authenticated
  using (public.is_admin() and uploaded_by = lower(coalesce(auth.jwt() ->> 'email', '')));

-- ---------------------------------------------------------------
-- 22. 예약 흐름 2단계 (supabase/booking2.sql 과 같아요)
-- ---------------------------------------------------------------

-- 상태: requested 업체 확인 대기 → shop_ok 업체 가능(엉클데이 확정 대기) → confirmed 확정
--       업체 불가면 rejected(+업체가 제안한 시간) → reschedule 손님에게 변경 시간 안내 → 손님이 고르면 다시 requested
alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('requested','shop_ok','confirmed','rejected','reschedule','visited','settled','cancelled','noshow'));
alter table public.bookings add column if not exists proposed_times jsonb not null default '[]'::jsonb;  -- 업체가 제안한 가능 시간
alter table public.bookings add column if not exists offer_times    jsonb not null default '[]'::jsonb;  -- 손님에게 안내한 변경 시간
alter table public.bookings add column if not exists change_count   int   not null default 0;           -- 시간 변경 횟수

-- 시간 목록 정리 (최대 3개, {date:'YYYY-MM-DD', time:'HH:MM'})
create or replace function public.clean_times(x jsonb) returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(jsonb_build_object('date', e ->> 'date', 'time', e ->> 'time')), '[]'::jsonb)
  from (select e from jsonb_array_elements(case when jsonb_typeof(x) = 'array' then x else '[]'::jsonb end) e
        where (e ->> 'date') ~ '^\d{4}-\d{2}-\d{2}$' and (e ->> 'time') ~ '^\d{2}:\d{2}$' limit 3) s
$$;

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
    'offer_times', case when b.status = 'reschedule' then b.offer_times else '[]'::jsonb end, 'change_count', b.change_count,
    'reviewed', exists (select 1 from reviews where booking_id = b.id));
end $$;

-- 손님: 방문했어요 / 예약 취소 / 변경 시간 고르기
drop function if exists public.customer_action(text, text);
create or replace function public.customer_action(t text, action text, pick int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b bookings; o jsonb;
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
    if b.status not in ('requested', 'shop_ok', 'confirmed', 'rejected', 'reschedule') then raise exception '이미 처리된 예약이라 취소할 수 없어요. 상담으로 문의해 주세요'; end if;
    update bookings set status = 'cancelled' where id = b.id;
  elsif action = 'kakao' then   -- 손님이 '카톡으로 확정 받기'를 누름 (채널 채팅방이 생겼을 가능성)
    if not exists (select 1 from booking_events e where e.booking_id = b.id and e.action = 'customer_kakao') then
      insert into booking_events (booking_id, action, detail) values (b.id, 'customer_kakao', '{}');
    end if;
  elsif action = 'pick' then
    if b.status <> 'reschedule' then raise exception '지금은 시간을 바꿀 수 없어요. 상담으로 문의해 주세요'; end if;
    o := b.offer_times -> pick;
    if o is null then raise exception '고른 시간을 찾을 수 없어요'; end if;
    update bookings set visit_date = (o ->> 'date')::date, visit_time = o ->> 'time', status = 'requested',
      sent_to_shop_at = null, shop_replied_at = null, change_count = change_count + 1,
      offer_times = '[]'::jsonb, proposed_times = '[]'::jsonb
    where id = b.id;
  else
    raise exception '알 수 없는 요청이에요';
  end if;
  return booking_for_customer(t);
end $$;

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
    'note', b.note, 'lang', b.lang, 'paid_amount', b.paid_amount, 'shop_replied_at', b.shop_replied_at,
    'proposed_times', b.proposed_times, 'change_count', b.change_count,
    'open', s.data -> 'open', 'close', s.data -> 'close');
end $$;

-- 업체: 가능 / 불가(+가능한 시간 제안) / 방문 완료(+받은 금액) / 노쇼
drop function if exists public.shop_reply(text, text, bigint, text);
create or replace function public.shop_reply(t text, action text, amount bigint default null, memo text default null, times jsonb default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  perform set_config('app.actor', '업체', true);
  select * into b from bookings where shop_token = t;
  if not found or t is null or length(t) < 20 then raise exception 'Booking not found'; end if;
  if b.status in ('settled', 'cancelled') then raise exception 'This booking is closed'; end if;
  if action = 'accept' then
    if b.status not in ('requested', 'rejected') then raise exception 'Cannot change now'; end if;
    update bookings set status = 'shop_ok', proposed_times = '[]'::jsonb, shop_replied_at = now() where id = b.id;
  elsif action = 'reject' then
    if b.status not in ('requested', 'shop_ok', 'confirmed', 'rejected') then raise exception 'Cannot change now'; end if;
    update bookings set status = 'rejected', proposed_times = clean_times(times), shop_replied_at = now() where id = b.id;
  elsif action = 'visited' then
    if amount is null or amount < 0 then raise exception 'Please enter the amount'; end if;
    update bookings set status = 'visited', paid_amount = amount, shop_replied_at = now() where id = b.id;
  elsif action = 'noshow' then
    update bookings set status = 'noshow', shop_replied_at = now() where id = b.id and status in ('requested', 'shop_ok', 'confirmed');
  else
    raise exception 'Unknown action';
  end if;
  if coalesce(memo, '') <> '' then
    insert into booking_events (booking_id, action, detail) values (b.id, 'shop_memo', jsonb_build_object('memo', left(memo, 500)));
  end if;
  return booking_for_shop(t);
end $$;

grant execute on function public.booking_for_customer(text), public.customer_action(text, text, int),
  public.booking_for_shop(text), public.shop_reply(text, text, bigint, text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------
-- 23. 사이트 채팅 + 손님 로그인 (supabase/chat.sql 과 같아요)
-- ---------------------------------------------------------------

-- 0) 안전장치: 관리자 자동 등록은 '이메일·비밀번호' 로그인만 (소셜 로그인 이메일로 관리자가 되는 일 막기)
create or replace function public.claim_admin() returns boolean
language plpgsql security definer set search_path = public as $$
declare em text := lower(coalesce(auth.jwt() ->> 'email', ''));
        prov text := coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', 'email');
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from admins where user_id = auth.uid()) then return true; end if;
  if prov <> 'email' then return false; end if;
  if not exists (select 1 from admins) or exists (select 1 from admin_emails where lower(email) = em) then
    insert into admins (user_id, email) values (auth.uid(), em) on conflict do nothing;
    return true;
  end if;
  return false;
end $$;

-- 1) 예약에 '누가 했는지(로그인한 손님)' 기록
alter table public.bookings add column if not exists user_id uuid references auth.users on delete set null;
create index if not exists bookings_user_idx on public.bookings (user_id);
create or replace function public.bookings_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- 사이트 예약 화면(create_booking)으로 들어온 예약만, 그때 로그인한 사람에게 연결 (관리자가 관리자 페이지에서 대신 넣은 예약은 연결 안 함)
  if new.user_id is null and auth.uid() is not null and current_setting('app.actor', true) = '손님' then new.user_id := auth.uid(); end if;
  return new;
end $$;
drop trigger if exists bookings_owner on public.bookings;
create trigger bookings_owner before insert on public.bookings for each row execute function public.bookings_owner();

-- 로그인한 손님의 내 예약 목록
create or replace function public.my_bookings() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('code', code, 'status', status, 'shop_name', shop_name, 'shop_id', shop_id,
    'visit_date', visit_date, 'visit_time', visit_time, 'menu_name', menu_name, 'people', people, 't', customer_token) order by created_at desc), '[]'::jsonb)
  from bookings where auth.uid() is not null and user_id = auth.uid()
$$;

-- 2) 채팅
create table if not exists public.chat_threads (
  id            uuid primary key default gen_random_uuid(),
  token         text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  user_id       uuid references auth.users on delete set null,
  booking_id    uuid references public.bookings on delete set null,
  name          text,
  contact       text,
  lang          text not null default 'ko',
  page          text,
  status        text not null default 'open' check (status in ('open', 'closed')),
  created_at    timestamptz not null default now(),
  last_at       timestamptz not null default now(),
  last_from     text,
  last_body     text,
  guest_seen_at timestamptz,
  admin_seen_at timestamptz
);
create unique index if not exists chat_threads_booking_uq on public.chat_threads (booking_id) where booking_id is not null;
create index if not exists chat_threads_user_idx on public.chat_threads (user_id);
create index if not exists chat_threads_last_idx on public.chat_threads (last_at desc);
create table if not exists public.chat_messages (
  id         bigserial primary key,
  thread_id  uuid not null references public.chat_threads on delete cascade,
  sender     text not null check (sender in ('guest', 'admin')),
  author     text,
  body       text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_thread_idx on public.chat_messages (thread_id, id);
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
drop policy if exists admin_all on public.chat_threads;
create policy admin_all on public.chat_threads for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_all on public.chat_messages;
create policy admin_all on public.chat_messages for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 손님이 볼 대화방 찾기: 예약 링크(bt) > 로그인 > 브라우저에 저장된 열쇠(t)
create or replace function public.chat_find(t text, bt text) returns public.chat_threads
language plpgsql security definer set search_path = public as $$
declare th chat_threads; b bookings;
begin
  if coalesce(bt, '') <> '' then
    select * into b from bookings where customer_token = bt;
    if found then select * into th from chat_threads where booking_id = b.id; return th; end if;
  end if;
  if coalesce(t, '') <> '' and length(t) >= 32 then
    select * into th from chat_threads where token = t;
    if found then return th; end if;
  end if;
  if auth.uid() is not null then
    -- 로그인한 손님: 가장 최근 대화 (예약 진행 안내가 쌓인 예약 대화 포함) → 다른 기기에서도 이어서 봐요
    select * into th from chat_threads where user_id = auth.uid() order by last_at desc limit 1;
  end if;
  return th;
end $$;
revoke all on function public.chat_find(text, text) from public, anon, authenticated;

create or replace function public.chat_view(th public.chat_threads, since bigint) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when th.id is null then jsonb_build_object('token', null, 'messages', '[]'::jsonb) else jsonb_build_object(
    'token', th.token, 'name', th.name, 'contact', th.contact, 'booking', (select code from bookings where id = th.booking_id),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'from', m.sender, 'body', m.body, 'at', m.created_at) order by m.id)
                          from chat_messages m where m.thread_id = th.id and m.id > coalesce(since, 0)), '[]'::jsonb),
    'unread', (select count(*) from chat_messages m where m.thread_id = th.id and m.sender = 'admin' and m.created_at > coalesce(th.guest_seen_at, 'epoch'))) end
$$;
revoke all on function public.chat_view(public.chat_threads, bigint) from public, anon, authenticated;

-- 손님: 대화 불러오기 (seen = 창을 열어 보고 있으면 읽음 처리)
create or replace function public.chat_get(t text default null, bt text default null, since bigint default 0, seen boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare th chat_threads; v jsonb;
begin
  th := chat_find(t, bt);
  if th.id is null then return jsonb_build_object('token', null, 'messages', '[]'::jsonb, 'unread', 0); end if;
  if auth.uid() is not null and th.user_id is null then update chat_threads set user_id = auth.uid() where id = th.id; end if;
  v := chat_view(th, since);
  if seen then update chat_threads set guest_seen_at = now() where id = th.id; v := v || jsonb_build_object('unread', 0); end if;
  return v;
end $$;

-- 손님: 메시지 보내기 (대화방이 없으면 만들어요)
create or replace function public.chat_send(body text, t text default null, bt text default null, name text default null,
  contact text default null, lang text default 'ko', page text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare th chat_threads; b bookings; n int; quiet boolean; bcode text;
begin
  body := btrim(coalesce(body, ''));
  if length(body) = 0 then raise exception '메시지를 적어 주세요'; end if;
  if length(body) > 2000 then raise exception '메시지가 너무 길어요 (2000자까지)'; end if;
  th := chat_find(t, bt);
  if th.id is null then
    if coalesce(bt, '') <> '' then select * into b from bookings where customer_token = bt; end if;
    insert into chat_threads (user_id, booking_id, name, contact, lang, page)
    values (auth.uid(), b.id, left(coalesce(nullif(btrim(name), ''), b.customer_name), 60), left(coalesce(nullif(btrim(contact), ''), b.contact), 100),
            coalesce(nullif(lang, ''), b.lang, 'ko'), left(page, 80))
    returning * into th;
  else
    select count(*) into n from chat_messages where thread_id = th.id and sender = 'guest' and created_at > now() - interval '10 minutes';
    if n >= 30 then raise exception '잠시 뒤에 다시 보내 주세요'; end if;
    update chat_threads set name = coalesce(nullif(left(btrim(chat_send.name), 60), ''), chat_threads.name),
      contact = coalesce(nullif(left(btrim(chat_send.contact), 100), ''), chat_threads.contact),
      user_id = coalesce(chat_threads.user_id, auth.uid())
    where id = th.id;
  end if;
  -- 바로 앞 손님 메시지가 3분 안이고 그사이 관리자 답이 없으면 슬랙은 생략 (도배 방지)
  quiet := exists (select 1 from chat_messages m where m.thread_id = th.id and m.created_at > now() - interval '3 minutes'
                   and m.sender = 'guest' and not exists (select 1 from chat_messages a where a.thread_id = th.id and a.sender = 'admin' and a.id > m.id));
  insert into chat_messages (thread_id, sender, body) values (th.id, 'guest', body);
  update chat_threads set last_at = now(), last_from = 'guest', last_body = left(body, 200), status = 'open', guest_seen_at = now() where id = th.id;
  select * into th from chat_threads where id = th.id;
  if not quiet then
    select code into bcode from bookings where id = th.booking_id;
    perform slack_send('chat', '💬 사이트 채팅 · ' || coalesce(th.name, '손님') || coalesce(' (' || bcode || ')', '') || E'\n> ' || replace(left(body, 200), E'\n', ' '));
  end if;
  return chat_view(th, 0);
end $$;

-- 관리자: 답장 (보낸 사람 이름 기록)
create or replace function public.chat_reply(thread uuid, body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception '관리자만 할 수 있어요'; end if;
  body := btrim(coalesce(body, ''));
  if length(body) = 0 or length(body) > 2000 then raise exception '메시지를 확인해 주세요'; end if;
  insert into chat_messages (thread_id, sender, author, body) values (thread, 'admin', nick(actor_name()), body);
  update chat_threads set last_at = now(), last_from = 'admin', last_body = left(body, 200), admin_seen_at = now() where id = thread;
end $$;

revoke all on function public.chat_get(text, text, bigint, boolean), public.chat_send(text, text, text, text, text, text, text), public.my_bookings() from public;
grant execute on function public.chat_get(text, text, bigint, boolean), public.chat_send(text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.my_bookings() to authenticated;

-- 로그인한 상태로 예약확인증을 열면, 아직 주인이 없는 그 예약을 내 예약에 붙여요 (예전 예약 연결용)
create or replace function public.claim_booking(t text) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  -- 관리자는 손님 예약확인증을 자주 열어 보니까, 남의 예약을 가져가지 않게 제외
  if auth.uid() is null or coalesce(t, '') = '' or is_admin() then return false; end if;
  update bookings set user_id = auth.uid() where customer_token = t and user_id is null;
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.claim_booking(text) from public, anon;
grant execute on function public.claim_booking(text) to authenticated;
revoke all on function public.chat_reply(uuid, text) from public, anon;
grant execute on function public.chat_reply(uuid, text) to authenticated;

-- 3) 예약 진행 상황을 손님의 사이트 채팅창에 자동으로 남기기
create or replace function public.chat_fmt(b public.bookings) returns text
language sql stable set search_path = public as $$
  select case coalesce(b.lang, 'ko')
    when 'en' then coalesce(to_char(b.visit_date, 'Dy, Mon DD'), '-') || ' ' || coalesce(b.visit_time, '')
    when 'vi' then coalesce(to_char(b.visit_date, 'DD/MM'), '-') || ' ' || coalesce(b.visit_time, '')
    else coalesce(to_char(b.visit_date, 'FMMM/FMDD') || '(' || (array['일','월','화','수','목','금','토'])[extract(dow from b.visit_date)::int + 1] || ')', '-') || ' ' ||
         coalesce(case when b.visit_time ~ '^\d{2}:\d{2}$' then (case when left(b.visit_time, 2)::int < 12 then '오전 ' else '오후 ' end) ||
           (case when left(b.visit_time, 2)::int % 12 = 0 then 12 else left(b.visit_time, 2)::int % 12 end)::text || ':' || right(b.visit_time, 2) end, b.visit_time, '')
  end
$$;

-- 예약 대화방을 찾거나 만들고, 엉클데이 이름으로 메시지를 남겨요
create or replace function public.chat_post_booking(bid uuid, body text) returns void
language plpgsql security definer set search_path = public as $$
declare b bookings; th chat_threads;
begin
  select * into b from bookings where id = bid; if not found then return; end if;
  select * into th from chat_threads where booking_id = bid;
  if not found then
    insert into chat_threads (user_id, booking_id, name, contact, lang, page)
    values (b.user_id, b.id, left(b.customer_name, 60), left(b.contact, 100), coalesce(b.lang, 'ko'), b.shop_id)
    returning * into th;
  end if;
  insert into chat_messages (thread_id, sender, author, body) values (th.id, 'admin', '엉클데이 (자동 안내)', left(body, 2000));
  update chat_threads set last_at = now(), last_from = 'admin', last_body = left(body, 200), status = 'open', admin_seen_at = now() where id = th.id;
end $$;
revoke all on function public.chat_post_booking(uuid, text) from public, anon, authenticated;

create or replace function public.chat_booking_msg(b public.bookings, kind text) returns text
language plpgsql stable set search_path = public as $$
declare l text := coalesce(b.lang, 'ko'); link text := 'https://www.uncleday.com/booking.html?v=2#' || b.customer_token;
        d text := chat_fmt(b); s text := coalesce(b.shop_name, ''); offers text;
begin
  select string_agg(x.n::text || ') ' ||
           chat_fmt(jsonb_populate_record(b, jsonb_build_object('visit_date', x.o ->> 'date', 'visit_time', x.o ->> 'time'))), E'\n' order by x.n)
    into offers from jsonb_array_elements(coalesce(b.offer_times, '[]'::jsonb)) with ordinality as x(o, n);
  if kind = 'new' then return case l
    when 'en' then '📥 We got your booking request (' || b.code || E')\n' || s || ' · ' || d || ' · ' || b.people || E' guest(s)\nWe''re checking with the shop now and will confirm shortly. Ask us anything here.'
    when 'vi' then '📥 Đã nhận yêu cầu đặt lịch (' || b.code || E')\n' || s || ' · ' || d || ' · ' || b.people || E' người\nChúng tôi đang kiểm tra với cơ sở và sẽ sớm xác nhận. Có câu hỏi cứ nhắn tại đây.'
    else '📥 예약 요청을 받았어요 (' || b.code || E')\n' || s || ' · ' || d || ' · ' || b.people || E'명\n업체에 바로 확인하고 신속하게 확정 안내드릴게요. 궁금한 점은 여기로 편하게 물어보세요.' end;
  elsif kind = 'confirmed' then return case l
    when 'en' then '✅ Your booking is confirmed! (' || b.code || E')\n' || s || ' · ' || d || ' · ' || b.people || E' guest(s)\nWhen you arrive, show your voucher and tap 📍 Check in.\n' || link
    when 'vi' then '✅ Lịch hẹn đã được xác nhận! (' || b.code || E')\n' || s || ' · ' || d || ' · ' || b.people || E' người\nKhi đến, hãy đưa phiếu và bấm 📍 Check-in.\n' || link
    else '✅ 예약이 확정됐어요! (' || b.code || E')\n' || s || ' · ' || d || ' · ' || b.people || E'명\n도착하면 예약확인증을 업체에 보여 주고 📍 체크인을 눌러 주세요.\n' || link end;
  elsif kind = 'reschedule' then return case l
    when 'en' then '🔁 Sorry, the shop can''t take ' || d || E' 🙏\nAvailable times:\n' || coalesce(offers, '-') || E'\nTap the one you want on your voucher, or reply here.\n' || link
    when 'vi' then '🔁 Xin lỗi, cơ sở không nhận được ' || d || E' 🙏\nGiờ có thể nhận:\n' || coalesce(offers, '-') || E'\nBấm chọn giờ trong phiếu hoặc trả lời tại đây.\n' || link
    else '🔁 요청하신 ' || d || E'은 업체 사정으로 어려워요 🙏\n가능한 시간:\n' || coalesce(offers, '-') || E'\n예약확인증에서 원하는 시간을 누르시거나 여기로 답해 주세요.\n' || link end;
  elsif kind = 'moved' then return case l
    when 'en' then '🔁 We got your new time: ' || d || '. We''re checking with the shop again.'
    when 'vi' then '🔁 Đã nhận giờ mới: ' || d || '. Chúng tôi đang kiểm tra lại với cơ sở.'
    else '🔁 ' || d || '(으)로 변경 요청을 받았어요. 업체에 다시 확인할게요.' end;
  elsif kind = 'cancelled' then return case l
    when 'en' then 'Your booking ' || b.code || ' has been cancelled. If you''d like another date, just tell us here.'
    when 'vi' then 'Lịch hẹn ' || b.code || ' đã được hủy. Nếu muốn đặt ngày khác, hãy nhắn cho chúng tôi.'
    else '예약 ' || b.code || '이(가) 취소됐어요. 다른 날짜로 다시 예약하고 싶으시면 여기로 말씀해 주세요.' end;
  end if;
  return null;
end $$;

create or replace function public.bookings_chat() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if tg_op = 'INSERT' then k := 'new';
  elsif new.status is distinct from old.status then
    k := case new.status when 'confirmed' then 'confirmed' when 'reschedule' then 'reschedule' when 'cancelled' then 'cancelled'
           when 'requested' then case when old.status = 'reschedule' then 'moved' end end;
  end if;
  if k is not null then
    begin perform chat_post_booking(new.id, chat_booking_msg(new, k));
    exception when others then null;   -- 채팅이 안 돼도 예약 처리는 절대 막지 않아요
    end;
  end if;
  return null;
end $$;
drop trigger if exists bookings_chat on public.bookings;
create trigger bookings_chat after insert or update of status on public.bookings for each row execute function public.bookings_chat();

-- 관리자: 예약 대화방에 메시지 남기기 (안부 메시지 등)
create or replace function public.chat_booking_reply(bid uuid, body text) returns void
language plpgsql security definer set search_path = public as $$
declare th chat_threads;
begin
  if not is_admin() then raise exception '관리자만 할 수 있어요'; end if;
  perform chat_post_booking(bid, body);
  select * into th from chat_threads where booking_id = bid;
  update chat_messages set author = nick(actor_name()) where id = (select max(id) from chat_messages where thread_id = th.id);
end $$;
revoke all on function public.chat_booking_reply(uuid, text) from public, anon;
grant execute on function public.chat_booking_reply(uuid, text) to authenticated;

-- 슬랙: 채팅 알림 종류 추가
update public.slack_cfg set events = array_append(events, 'chat') where id = 1 and not ('chat' = any(events));
alter table public.slack_cfg alter column events set default array['booking','shop','customer','review','team','lead','chat'];

-- ============================================================
-- 24. 사장님 페이지 (1단계: 예약 받기)
-- 업체 사장님·직원이 www.uncleday.com/owner 에서 전화번호+비밀번호로 로그인해
-- 예약에 답하고(가능·불가+다른 시간·방문 완료·노쇼), 영업시간·휴무·시간 막기를 관리해요.
-- 계정은 관리자 페이지에서 만들어요 (Edge Function: owner-admin).
-- 여러 번 실행해도 괜찮아요.
-- ============================================================

-- 사장님·직원 계정 ↔ 업체
create table if not exists public.shop_members (
  user_id        uuid not null references auth.users on delete cascade,
  shop_id        text not null references public.shops(id) on update cascade on delete cascade,
  role           text not null default 'owner' check (role in ('owner', 'staff')),
  name           text,
  phone          text,
  active         boolean not null default true,
  must_change_pw boolean not null default true,      -- 임시 비밀번호로 처음 들어오면 바꾸게
  last_seen_at   timestamptz,
  created_at     timestamptz not null default now(),
  primary key (user_id, shop_id)
);
create index if not exists shop_members_shop_idx on public.shop_members (shop_id);

-- 요일별 영업시간 · 동시 수용 인원 · 예약 마감
create table if not exists public.shop_hours (
  shop_id     text primary key references public.shops(id) on update cascade on delete cascade,
  week        jsonb not null,                                   -- 월~일 7개: {"open":"10:00","close":"22:00","closed":false}
  capacity    int not null default 4 check (capacity between 1 and 50),
  cutoff_min  int not null default 120 check (cutoff_min between 0 and 2880),
  updated_at  timestamptz not null default now(),
  updated_by  text
);

-- 휴무일 · 막은 시간 (slot 이 비어 있으면 하루 전체)
create table if not exists public.shop_closures (
  id          bigserial primary key,
  shop_id     text not null references public.shops(id) on update cascade on delete cascade,
  day         date not null,
  slot        text check (slot is null or slot ~ '^\d{2}:\d{2}$'),
  created_by  text,
  created_at  timestamptz not null default now()
);
create unique index if not exists shop_closures_uniq on public.shop_closures (shop_id, day, coalesce(slot, ''));

alter table public.shop_members  enable row level security;
alter table public.shop_hours    enable row level security;
alter table public.shop_closures enable row level security;
drop policy if exists "shop_members admin"  on public.shop_members;
drop policy if exists "shop_hours admin"    on public.shop_hours;
drop policy if exists "shop_closures admin" on public.shop_closures;
create policy "shop_members admin"  on public.shop_members  for all to authenticated using (is_admin()) with check (is_admin());
create policy "shop_hours admin"    on public.shop_hours    for all to authenticated using (is_admin()) with check (is_admin());
create policy "shop_closures admin" on public.shop_closures for all to authenticated using (is_admin()) with check (is_admin());
grant select, insert, update, delete on public.shop_members, public.shop_hours, public.shop_closures to authenticated;
grant usage, select on sequence public.shop_closures_id_seq to authenticated;

-- 사장님 계정(…@owner.uncleday.com)은 절대 관리자가 될 수 없어요
create or replace function public.claim_admin() returns boolean
language plpgsql security definer set search_path = public as $$
declare em text := lower(coalesce(auth.jwt() ->> 'email', ''));
        prov text := coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', 'email');
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from admins where user_id = auth.uid()) then return true; end if;
  if prov <> 'email' or em like '%@owner.uncleday.com' then return false; end if;
  if not exists (select 1 from admins) or exists (select 1 from admin_emails where lower(email) = em) then
    insert into admins (user_id, email) values (auth.uid(), em) on conflict do nothing;
    return true;
  end if;
  return false;
end $$;

-- 로그인한 사람이 이 업체의 (활성) 멤버인지 확인. need_owner = 사장님만 가능한 일
create or replace function public.owner_role(shop text) returns text
language sql stable security definer set search_path = public as $$
  select role from shop_members where user_id = auth.uid() and shop_id = shop and active limit 1
$$;
create or replace function public.owner_check(shop text, need_owner boolean default false) returns text
language plpgsql stable security definer set search_path = public as $$
declare r text := owner_role(shop);
begin
  if auth.uid() is null then raise exception 'Please log in'; end if;
  if r is null and not is_admin() then raise exception 'No access to this shop'; end if;
  if need_owner and r = 'staff' and not is_admin() then raise exception 'Only the owner can change this'; end if;
  return coalesce(r, 'admin');
end $$;

-- 영업시간: 저장된 게 없으면 업체 정보(open/close/closed 요일)에서 만들어요
create or replace function public.shop_hours_of(shop text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare h shop_hours; s shops; o text; c text; cl jsonb; wk jsonb := '[]'::jsonb; i int;
begin
  select * into h from shop_hours where shop_id = shop;
  if found then return jsonb_build_object('week', h.week, 'capacity', h.capacity, 'cutoff_min', h.cutoff_min, 'managed', true); end if;
  select * into s from shops where id = shop;
  o := coalesce(nullif(s.data ->> 'open', ''), '10:00'); c := coalesce(nullif(s.data ->> 'close', ''), '22:00');
  cl := coalesce(s.data -> 'closed', '[]'::jsonb);   -- 0=일 … 6=토
  for i in 0..6 loop   -- 월(0)~일(6)
    wk := wk || jsonb_build_object('open', o, 'close', c, 'closed', cl @> to_jsonb((i + 1) % 7));
  end loop;
  return jsonb_build_object('week', wk, 'capacity', 4, 'cutoff_min', 120, 'managed', false);
end $$;

-- 시간 칸(30분)별 예약 인원: {"2026-11-12|15:00": 2, …}
create or replace function public.shop_booked(shop text, d1 date, d2 date) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (
    select to_char(b.visit_date, 'YYYY-MM-DD') || '|' || to_char(s, 'HH24:MI') k, sum(b.people)::int n
    from bookings b,
         generate_series(b.visit_date + b.visit_time::time,
                         b.visit_date + b.visit_time::time + make_interval(mins => greatest(coalesce(b.menu_min, 60), 30) - 1),
                         interval '30 minutes') s
    where b.shop_id = shop and b.visit_date between d1 and d2
      and b.visit_time ~ '^\d{1,2}:\d{2}$'
      and b.status in ('requested', 'shop_ok', 'confirmed', 'reschedule')
    group by 1) x
$$;

-- 손님 예약 달력용 (로그인 필요 없음): 영업시간 + 휴무·막은 시간 + 칸별 남은 자리
create or replace function public.shop_availability(shop text, d1 date, d2 date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare h jsonb := shop_hours_of(shop); cap int; bk jsonb; lf jsonb := '{}'::jsonb; k text; v jsonb;
begin
  if d2 - d1 > 120 then d2 := d1 + 120; end if;
  cap := (h ->> 'capacity')::int;
  bk := shop_booked(shop, d1, d2);
  for k, v in select * from jsonb_each(bk) loop lf := lf || jsonb_build_object(k, greatest(cap - v::int, 0)); end loop;
  return jsonb_build_object(
    'week', h -> 'week', 'capacity', cap, 'cutoff_min', h -> 'cutoff_min', 'managed', h -> 'managed',
    'closures', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'slot', slot)) from shop_closures where shop_id = shop and day between d1 and d2), '[]'::jsonb),
    'left', lf);
end $$;

-- 내 정보 + 내 업체 목록 (로그인할 때마다 불러요)
create or replace function public.owner_me() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return null; end if;
  update shop_members set last_seen_at = now() where user_id = auth.uid();
  return (select jsonb_build_object(
      'name', max(m.name), 'phone', max(m.phone), 'must_change_pw', bool_or(m.must_change_pw),
      'shops', jsonb_agg(jsonb_build_object('id', s.id, 'name', s.data -> 'name', 'area', s.data -> 'area', 'role', m.role) order by s.sort))
    from shop_members m join shops s on s.id = m.shop_id
    where m.user_id = auth.uid() and m.active
    having count(*) > 0);
end $$;

create or replace function public.owner_pw_changed() returns void
language sql security definer set search_path = public as $$
  update shop_members set must_change_pw = false where user_id = auth.uid()
$$;

-- 사장님이 보는 예약 한 건 (손님 연락처·확인증 열쇠는 빼요)
create or replace function public.owner_row(b bookings) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', b.id, 'code', b.code, 'status', b.status, 'menu_name', b.menu_name, 'menu_min', b.menu_min,
    'menu', (select m from shops s, jsonb_array_elements(s.data -> 'menu') m where s.id = b.shop_id and m -> 'name' ->> 'ko' = b.menu_name limit 1),
    'people', b.people, 'list_price', b.list_price, 'visit_date', b.visit_date, 'visit_time', b.visit_time,
    'customer_name', b.customer_name, 'note', b.note, 'lang', b.lang, 'paid_amount', b.paid_amount,
    'proposed_times', b.proposed_times, 'offer_times', b.offer_times, 'created_at', b.created_at,
    'sent_to_shop_at', b.sent_to_shop_at, 'shop_replied_at', b.shop_replied_at)
$$;

-- 예약 목록: 답할 예약은 날짜와 상관없이 전부 + 지난 30일 ~ 앞으로 120일
create or replace function public.owner_bookings(shop text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform owner_check(shop);
  return coalesce((select jsonb_agg(owner_row(b) order by b.visit_date, b.visit_time) from bookings b
    where b.shop_id = shop and (b.status = 'requested' or b.visit_date between current_date - 30 and current_date + 120)), '[]'::jsonb);
end $$;

-- 예약에 답하기: 업체 링크(shop_reply)와 같은 규칙을 그대로 써요
create or replace function public.owner_reply(bid uuid, action text, amount bigint default null, memo text default null, times jsonb default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where id = bid;
  if not found then raise exception 'Booking not found'; end if;
  perform owner_check(b.shop_id);
  perform shop_reply(b.shop_token, action, amount, memo, times);
  insert into booking_events (booking_id, action, detail)
    values (b.id, 'owner_page', jsonb_build_object('action', action, 'by', coalesce((select name from shop_members where user_id = auth.uid() and shop_id = b.shop_id), 'owner')));
  select * into b from bookings where id = bid;
  return owner_row(b);
end $$;

-- 일정 화면: 영업시간 + 휴무·막은 시간 + 칸별 예약 인원
create or replace function public.owner_schedule(shop text, d1 date, d2 date) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform owner_check(shop);
  if d2 - d1 > 62 then d2 := d1 + 62; end if;
  return shop_hours_of(shop) || jsonb_build_object(
    'closures', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'slot', slot)) from shop_closures where shop_id = shop and day between d1 and d2), '[]'::jsonb),
    'booked', shop_booked(shop, d1, d2));
end $$;

-- 영업시간·수용 인원·마감 저장 (사장님만)
create or replace function public.owner_hours_save(shop text, week jsonb, capacity int, cutoff_min int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d jsonb;
begin
  perform owner_check(shop, true);
  if jsonb_typeof(week) <> 'array' or jsonb_array_length(week) <> 7 then raise exception 'Need 7 days'; end if;
  for d in select * from jsonb_array_elements(week) loop
    if not coalesce((d ->> 'closed')::boolean, false) and not ((d ->> 'open') ~ '^\d{2}:\d{2}$' and (d ->> 'close') ~ '^\d{2}:\d{2}$' and d ->> 'open' < d ->> 'close') then
      raise exception 'Please check the opening hours'; end if;
  end loop;
  insert into shop_hours (shop_id, week, capacity, cutoff_min, updated_at, updated_by)
  values (shop, week, capacity, cutoff_min, now(), 'owner:' || auth.uid())
  on conflict (shop_id) do update set week = excluded.week, capacity = excluded.capacity, cutoff_min = excluded.cutoff_min, updated_at = now(), updated_by = excluded.updated_by;
  return shop_hours_of(shop);
end $$;

-- 휴무일·시간 막기 켜기/끄기 (직원도 가능)
create or replace function public.owner_closure(shop text, day date, slot text, closed boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform owner_check(shop);
  if closed then
    insert into shop_closures (shop_id, day, slot, created_by) values (shop, day, nullif(slot, ''), 'owner:' || auth.uid())
    on conflict do nothing;
  else
    delete from shop_closures c where c.shop_id = shop and c.day = owner_closure.day and coalesce(c.slot, '') = coalesce(nullif(owner_closure.slot, ''), '');
  end if;
end $$;

revoke all on function public.owner_role(text), public.owner_check(text, boolean), public.shop_booked(text, date, date), public.owner_row(bookings) from public, anon;
grant execute on function public.shop_hours_of(text), public.shop_availability(text, date, date) to anon, authenticated;
grant execute on function public.owner_me(), public.owner_pw_changed(), public.owner_bookings(text),
  public.owner_reply(uuid, text, bigint, text, jsonb), public.owner_schedule(text, date, date),
  public.owner_hours_save(text, jsonb, int, int), public.owner_closure(text, date, text, boolean) to authenticated;

-- 정산 보기 (사장님만): 최근 6개월 월별 방문·결제·수수료 + 엉클데이가 보낸 정산서 + 고른 달의 예약별 내역
create or replace function public.owner_settle(shop text, mon text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m text := coalesce(nullif(mon, ''), to_char((now() at time zone 'Asia/Ho_Chi_Minh')::date, 'YYYY-MM'));
begin
  perform owner_check(shop, true);
  if m !~ '^\d{4}-\d{2}$' then raise exception 'Bad month'; end if;
  return jsonb_build_object(
    'month', m,
    'months', coalesce((select jsonb_agg(x order by x ->> 'month' desc) from (
        select jsonb_build_object('month', to_char(visit_date, 'YYYY-MM'), 'visits', count(*), 'paid', coalesce(sum(paid_amount), 0), 'commission', coalesce(sum(commission), 0)) x
        from bookings where shop_id = shop and status in ('visited', 'settled') and visit_date >= (date_trunc('month', now()) - interval '5 months')::date
        group by to_char(visit_date, 'YYYY-MM')) y), '[]'::jsonb),
    'statements', coalesce((select jsonb_agg(jsonb_build_object('month', s.month, 'count', s.booking_count, 'paid', s.total_paid, 'commission', s.total_commission,
        'status', s.status, 'billed_at', s.billed_at, 'paid_at', s.paid_at) order by s.month desc)
        from settlements s where s.shop_id = shop and s.status <> 'void'), '[]'::jsonb),
    'rows', coalesce((select jsonb_agg(jsonb_build_object('code', b.code, 'date', b.visit_date, 'time', b.visit_time, 'name', b.customer_name, 'people', b.people,
        'menu_name', b.menu_name, 'paid', b.paid_amount, 'commission', b.commission, 'settled', b.status = 'settled') order by b.visit_date, b.visit_time)
        from bookings b where b.shop_id = shop and b.status in ('visited', 'settled') and to_char(b.visit_date, 'YYYY-MM') = m), '[]'::jsonb));
end $$;
grant execute on function public.owner_settle(text, text) to authenticated;

-- ============================================================
-- 25. 엉클데이 유니버스 1단계: 시술 현황판 데이터
-- 층·방·베드·장비, 직원(테라피스트·리셉션), 근무표·요청, 출퇴근,
-- 오늘 손님(워크인·엉클데이), 시술 기록, 테라피스트 후기.
-- 사장님 페이지(현황판 탭)는 아래 함수로만 읽고 써요. 표는 관리자만 직접 볼 수 있어요.
-- owner.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

-- 베트남 시간 기준 오늘 · 지금(분)
create or replace function public.vn_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Ho_Chi_Minh')::date $$;
create or replace function public.vn_min_now() returns int
language sql stable as $$ select extract(hour from now() at time zone 'Asia/Ho_Chi_Minh')::int * 60 + extract(minute from now() at time zone 'Asia/Ho_Chi_Minh')::int $$;

-- 매장 배치: 업종 · 층(방 · 베드 수 · 장비) · 현황판 코스 · 근무 시간 종류 · 최소 인원 · 꾸미기 물건
create table if not exists public.shop_layout (
  shop_id    text primary key references public.shops(id) on update cascade on delete cascade,
  kind       text not null default 'massage' check (kind in ('massage', 'skin')),
  floors     jsonb not null default '[]'::jsonb,     -- [{rooms:[{n:"201",type:"bed",count:1,eq:["rf"]}]}]  (2층부터)
  courses    jsonb not null default '[]'::jsonb,     -- [{id,ko,vi,min,price,type:"bed|chair|any",eq:""}]
  shifts     jsonb not null default '{"A":[600,1140],"B":[780,1320],"F":[600,1320]}'::jsonb,
  min_am     int not null default 2 check (min_am between 0 and 20),
  min_pm     int not null default 2 check (min_pm between 0 and 20),
  items      jsonb not null default '[]'::jsonb,     -- 소파 · 화분 · 장식 위치 (6단계)
  updated_at timestamptz not null default now(),
  updated_by text
);

-- 사람 (여러 업체를 옮겨 다녀도 같은 사람). 경력 프로필 · 구직은 본인이 동의해야만 써요.
create table if not exists public.staff_people (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  phone          text unique,                       -- 숫자만 (84…)
  career_consent boolean not null default false,
  consent_at     timestamptz,
  open_to_work   boolean not null default false,
  created_at     timestamptz not null default now()
);

-- 업체 직원
create table if not exists public.shop_staff (
  id         uuid primary key default gen_random_uuid(),
  shop_id    text not null references public.shops(id) on update cascade on delete cascade,
  person_id  uuid references public.staff_people(id) on delete set null,
  user_id    uuid references auth.users on delete set null,     -- 직원 로그인 (4단계)
  name       text not null,
  role       text not null default 'tp' check (role in ('tp', 'rcp')),   -- 테라피스트 · 리셉션
  years      int not null default 0 check (years between 0 and 60),
  phone      text,
  look       jsonb not null default '{}'::jsonb,                 -- 도트 캐릭터 (머리 · 상의 · 하의)
  def_code   text not null default 'A' check (def_code in ('A', 'B', 'F')),  -- 평소 근무: 오전 · 오후 · 종일
  off_day    int not null default -1 check (off_day between -1 and 6),       -- 정기 휴무 0=일 … 6=토, -1 없음
  sort       int not null default 0,
  active     boolean not null default true,
  joined_at  date not null default current_date,
  left_at    date,
  created_at timestamptz not null default now()
);
create index if not exists shop_staff_shop_idx on public.shop_staff (shop_id, active);

-- 날짜별 근무 (없으면 평소 근무 · 정기 휴무를 따라요)
create table if not exists public.staff_shifts (
  staff_id   uuid not null references public.shop_staff(id) on delete cascade,
  day        date not null,
  shop_id    text not null references public.shops(id) on update cascade on delete cascade,
  code       text not null check (code in ('A', 'B', 'F', 'O')),
  updated_by text,
  updated_at timestamptz not null default now(),
  primary key (staff_id, day)
);
create index if not exists staff_shifts_shop_idx on public.staff_shifts (shop_id, day);

-- 직원 요청 (휴무 · 근무 변경 · 동료 교대)
create table if not exists public.staff_requests (
  id          bigserial primary key,
  shop_id     text not null references public.shops(id) on update cascade on delete cascade,
  staff_id    uuid not null references public.shop_staff(id) on delete cascade,
  day         date not null,
  type        text not null check (type in ('off', 'shift', 'swap')),
  must        boolean not null default false,
  want        text check (want in ('A', 'B', 'F')),
  mate_id     uuid references public.shop_staff(id) on delete cascade,
  reason      text,
  status      text not null default 'pending' check (status in ('peer', 'pending', 'ok', 'no', 'cancelled')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  decided_by  text
);
create index if not exists staff_requests_shop_idx on public.staff_requests (shop_id, status);

-- 출퇴근
create table if not exists public.staff_attendance (
  staff_id  uuid not null references public.shop_staff(id) on delete cascade,
  day       date not null,
  shop_id   text not null references public.shops(id) on update cascade on delete cascade,
  in_at     timestamptz,
  out_at    timestamptz,
  late_min  int not null default 0,
  primary key (staff_id, day)
);

-- 오늘 손님 (워크인 · 엉클데이 예약)
create table if not exists public.board_guests (
  id         uuid primary key default gen_random_uuid(),
  shop_id    text not null references public.shops(id) on update cascade on delete cascade,
  day        date not null,
  name       text not null,
  course     jsonb not null,                        -- {id,ko,vi,min,price,type,eq}
  people     int not null default 1 check (people between 1 and 30),
  booking_id uuid unique references public.bookings(id) on delete set null,
  source     text not null default 'walkin' check (source in ('walkin', 'ud')),
  status     text not null default 'waiting' check (status in ('waiting', 'in_session', 'done', 'left')),
  created_at timestamptz not null default now()
);
create index if not exists board_guests_shop_idx on public.board_guests (shop_id, day);

-- 시술 기록 (누가 · 어느 베드에서 · 무엇을 · 얼마)
create table if not exists public.board_sessions (
  id          uuid primary key default gen_random_uuid(),
  shop_id     text not null references public.shops(id) on update cascade on delete cascade,
  day         date not null,
  guest_id    uuid references public.board_guests(id) on delete set null,
  booking_id  uuid references public.bookings(id) on delete set null,
  staff_id    uuid references public.shop_staff(id) on delete set null,
  staff_name  text,
  station     text not null,                        -- "201-2" = 201호 2번 베드
  course_name text,
  minutes     int not null check (minutes between 5 and 600),
  price       bigint not null default 0,
  paid        bigint,
  status      text not null default 'working' check (status in ('working', 'done', 'cancelled')),
  started_at  timestamptz not null default now(),
  ends_at     timestamptz not null,
  done_at     timestamptz,
  created_by  text
);
create index if not exists board_sessions_shop_idx on public.board_sessions (shop_id, day);
create index if not exists board_sessions_staff_idx on public.board_sessions (staff_id, day);
create index if not exists board_sessions_booking_idx on public.board_sessions (booking_id);

-- 테라피스트 후기 (엉클데이 예약 1건에 1개, 3단계에서 손님이 남겨요)
create table if not exists public.staff_reviews (
  id             uuid primary key default gen_random_uuid(),
  booking_id     uuid unique references public.bookings(id) on delete set null,
  session_id     uuid references public.board_sessions(id) on delete set null,
  shop_id        text not null references public.shops(id) on update cascade on delete cascade,
  staff_id       uuid references public.shop_staff(id) on delete set null,
  stars          int not null check (stars between 1 and 5),
  tags           int[] not null default '{}',
  body           text,
  customer_label text,
  user_id        uuid,
  hidden         boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists staff_reviews_staff_idx on public.staff_reviews (staff_id);

-- 표는 관리자만 직접 (사장님 · 직원은 아래 함수로만)
do $$ declare t text; begin
  foreach t in array array['shop_layout','staff_people','shop_staff','staff_shifts','staff_requests','staff_attendance','board_guests','board_sessions','staff_reviews'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s admin" on public.%I', t, t);
    execute format('create policy "%s admin" on public.%I for all to authenticated using (is_admin()) with check (is_admin())', t, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
grant usage, select on sequence public.staff_requests_id_seq to authenticated;

-- ---------- 도우미 ----------
-- 그날 근무 코드: 날짜별 근무 > 정기 휴무 > 평소 근무
create or replace function public.staff_code(st shop_staff, d date) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select code from staff_shifts where staff_id = st.id and day = d),
                  case when st.off_day = extract(dow from d)::int then 'O' else st.def_code end)
$$;

-- 처음 열면 업체 메뉴로 코스를, 방 3개로 배치를 만들어 둬요
create or replace function public.layout_ensure(shop text) returns shop_layout
language plpgsql security definer set search_path = public as $$
declare l shop_layout;
begin
  select * into l from shop_layout where shop_id = shop;
  if found then return l; end if;
  insert into shop_layout (shop_id, floors, courses)
  values (shop,
    '[{"rooms":[{"n":"201","type":"bed","count":1,"eq":[]},{"n":"202","type":"bed","count":1,"eq":[]},{"n":"203","type":"bed","count":2,"eq":[]}]}]'::jsonb,
    coalesce((select jsonb_agg(jsonb_build_object('id', 'm' || o, 'ko', m -> 'name' ->> 'ko', 'vi', coalesce(m -> 'name' ->> 'vi', m -> 'name' ->> 'ko'),
        'min', coalesce((m ->> 'min')::int, 60), 'price', coalesce((m ->> 'price')::bigint, 0), 'type', 'any', 'eq', '') order by o)
      from shops s, jsonb_array_elements(s.data -> 'menu') with ordinality as x(m, o) where s.id = shop), '[]'::jsonb))
  on conflict (shop_id) do nothing;
  select * into l from shop_layout where shop_id = shop;
  return l;
end $$;

-- 배치 안의 베드 · 체어 id 목록 ("201-1" …)
create or replace function public.layout_stations(l shop_layout) returns text[]
language sql immutable as $$
  select coalesce(array_agg((r ->> 'n') || '-' || i), '{}')
  from jsonb_array_elements(l.floors) f, jsonb_array_elements(f -> 'rooms') r, generate_series(1, greatest(1, coalesce((r ->> 'count')::int, 1))) i
$$;

create or replace function public.actor_name(shop text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select name from shop_members where user_id = auth.uid() and shop_id = shop limit 1), case when is_admin() then 'admin' else 'owner' end)
$$;

-- ---------- 현황판 한 번에 읽기 ----------
create or replace function public.board_get(shop text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d date := vn_today(); l shop_layout; r text;
begin
  r := owner_check(shop);
  l := layout_ensure(shop);
  return jsonb_build_object(
    'today', d, 'now', now(), 'now_min', vn_min_now(), 'role', r,
    'shop', (select jsonb_build_object('id', s.id, 'name', s.data -> 'name') from shops s where s.id = shop),
    'layout', to_jsonb(l) - 'shop_id',
    'staff', coalesce((select jsonb_agg(jsonb_build_object(
        'id', st.id, 'name', st.name, 'role', st.role, 'years', st.years, 'look', st.look, 'def_code', st.def_code, 'off_day', st.off_day,
        'code', staff_code(st, d),
        'in_at', a.in_at, 'out_at', a.out_at, 'late_min', a.late_min,
        'stars', (select round(avg(v.stars)::numeric, 1) from staff_reviews v where v.staff_id = st.id and not v.hidden),
        'reviews', (select count(*) from staff_reviews v where v.staff_id = st.id and not v.hidden),
        'done_today', (select count(*) from board_sessions x where x.staff_id = st.id and x.day = d and x.status = 'done'),
        'rev_today', (select coalesce(sum(coalesce(x.paid, x.price)), 0) from board_sessions x where x.staff_id = st.id and x.day = d and x.status = 'done'))
        order by st.sort, st.created_at)
      from shop_staff st left join staff_attendance a on a.staff_id = st.id and a.day = d
      where st.shop_id = shop and st.active), '[]'::jsonb),
    'guests', coalesce((select jsonb_agg(to_jsonb(g) order by g.created_at) from board_guests g
      where g.shop_id = shop and g.day = d and g.status in ('waiting', 'in_session')), '[]'::jsonb),
    'expected', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'code', b.code, 'name', b.customer_name, 'menu_name', b.menu_name,
        'min', b.menu_min, 'people', b.people, 'price', b.list_price, 'time', b.visit_time, 'status', b.status) order by b.visit_time)
      from bookings b where b.shop_id = shop and b.visit_date = d and b.status in ('shop_ok', 'confirmed')
        and not exists (select 1 from board_guests g where g.booking_id = b.id)), '[]'::jsonb),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'guest_id', x.guest_id, 'booking_id', x.booking_id, 'staff_id', x.staff_id,
        'staff_name', x.staff_name, 'station', x.station, 'course_name', x.course_name, 'minutes', x.minutes, 'price', x.price, 'paid', x.paid,
        'status', x.status, 'started_at', x.started_at, 'ends_at', x.ends_at, 'done_at', x.done_at,
        'guest_name', (select g.name from board_guests g where g.id = x.guest_id), 'ud', x.booking_id is not null) order by x.started_at desc)
      from board_sessions x where x.shop_id = shop and x.day = d and x.status <> 'cancelled'), '[]'::jsonb),
    'pending_req', (select count(*) from staff_requests q where q.shop_id = shop and q.status = 'pending'));
end $$;

-- ---------- 매장 설정 (사장님만) ----------
create or replace function public.board_layout_save(shop text, cfg jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform owner_check(shop, true);
  perform layout_ensure(shop);
  if jsonb_typeof(cfg -> 'floors') <> 'array' or jsonb_array_length(cfg -> 'floors') not between 1 and 6 then raise exception 'Floors: 1 to 6'; end if;
  select count(*) into n from jsonb_array_elements(cfg -> 'floors') f, jsonb_array_elements(f -> 'rooms') r;
  if n < 1 or n > 40 then raise exception 'Rooms: 1 to 40'; end if;
  update shop_layout set
    kind = coalesce(cfg ->> 'kind', kind),
    floors = cfg -> 'floors',
    courses = coalesce(cfg -> 'courses', courses),
    shifts = coalesce(cfg -> 'shifts', shifts),
    min_am = coalesce((cfg ->> 'min_am')::int, min_am),
    min_pm = coalesce((cfg ->> 'min_pm')::int, min_pm),
    updated_at = now(), updated_by = actor_name(shop)
  where shop_id = shop;
  return board_get(shop);
end $$;

-- 꾸미기 물건 위치 (멤버 누구나)
create or replace function public.board_items_save(shop text, items jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform owner_check(shop);
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 80 then raise exception 'Too many items'; end if;
  perform layout_ensure(shop);
  update shop_layout set items = board_items_save.items, updated_at = now() where shop_id = shop;
end $$;

-- 직원 추가 · 수정 (사장님만). 전화번호가 있으면 같은 사람으로 이어 줘요.
create or replace function public.staff_upsert(shop text, s jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sid uuid := nullif(s ->> 'id', '')::uuid; ph text := nullif(regexp_replace(coalesce(s ->> 'phone', ''), '\D', '', 'g'), ''); pid uuid; nm text := btrim(coalesce(s ->> 'name', ''));
begin
  perform owner_check(shop, true);
  if nm = '' then raise exception 'Please enter a name'; end if;
  if ph is not null then
    if left(ph, 1) = '0' then ph := '84' || substr(ph, 2); end if;
    insert into staff_people (name, phone) values (nm, ph) on conflict (phone) do update set name = staff_people.name returning id into pid;
  end if;
  if sid is null then
    insert into shop_staff (shop_id, person_id, name, role, years, phone, look, def_code, off_day, sort)
    values (shop, pid, nm, coalesce(s ->> 'role', 'tp'), coalesce((s ->> 'years')::int, 0), ph, coalesce(s -> 'look', '{}'::jsonb),
            coalesce(s ->> 'def_code', 'A'), coalesce((s ->> 'off_day')::int, -1),
            coalesce((s ->> 'sort')::int, (select coalesce(max(sort), 0) + 1 from shop_staff where shop_id = shop)))
    returning id into sid;
  else
    update shop_staff set name = nm, role = coalesce(s ->> 'role', role), years = coalesce((s ->> 'years')::int, years),
      phone = coalesce(ph, phone), person_id = coalesce(pid, person_id), look = coalesce(s -> 'look', look),
      def_code = coalesce(s ->> 'def_code', def_code), off_day = coalesce((s ->> 'off_day')::int, off_day), sort = coalesce((s ->> 'sort')::int, sort)
    where id = sid and shop_id = shop;
    if not found then raise exception 'Staff not found'; end if;
  end if;
  return board_get(shop);
end $$;

-- 퇴사 처리 (기록은 남겨요)
create or replace function public.staff_remove(shop text, sid uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform owner_check(shop, true);
  update shop_staff set active = false, left_at = vn_today() where id = sid and shop_id = shop;
  update shop_members set active = false where shop_id = shop and user_id = (select user_id from shop_staff where id = sid);
  return board_get(shop);
end $$;

-- ---------- 손님 ----------
create or replace function public.guest_add(shop text, nm text, course jsonb, people int default 1) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform owner_check(shop);
  if coalesce(btrim(nm), '') = '' then raise exception 'Please enter a name'; end if;
  if course is null or coalesce((course ->> 'min')::int, 0) < 5 then raise exception 'Please choose a course'; end if;
  insert into board_guests (shop_id, day, name, course, people) values (shop, vn_today(), left(btrim(nm), 40), course, greatest(1, coalesce(people, 1)));
  return board_get(shop);
end $$;

-- 엉클데이 예약 손님 도착
create or replace function public.guest_checkin(shop text, bid uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  perform owner_check(shop);
  select * into b from bookings where id = bid and shop_id = shop;
  if not found then raise exception 'Booking not found'; end if;
  if b.status not in ('shop_ok', 'confirmed') then raise exception 'This booking is not confirmed'; end if;
  insert into board_guests (shop_id, day, name, course, people, booking_id, source)
  values (shop, vn_today(), coalesce(b.customer_name, b.code), jsonb_build_object('ko', b.menu_name, 'vi', b.menu_name, 'min', coalesce(b.menu_min, 60), 'price', coalesce(b.list_price, 0), 'type', 'any', 'eq', ''),
          b.people, b.id, 'ud')
  on conflict (booking_id) do nothing;
  return board_get(shop);
end $$;

create or replace function public.guest_leave(shop text, gid uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform owner_check(shop);
  update board_guests set status = 'left' where id = gid and shop_id = shop and status = 'waiting';
  return board_get(shop);
end $$;

-- ---------- 시술 ----------
drop function if exists public.session_start(text, uuid, uuid, text);
create or replace function public.session_start(shop text, gid uuid, sid uuid, stn text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g board_guests; st shop_staff; l shop_layout; m int; d date := vn_today();
begin
  perform owner_check(shop);
  select * into g from board_guests where id = gid and shop_id = shop for update;
  if not found or g.status <> 'waiting' then raise exception 'This guest is not waiting'; end if;
  select * into st from shop_staff where id = sid and shop_id = shop and active;
  if not found or st.role <> 'tp' then raise exception 'Choose a therapist'; end if;
  if exists (select 1 from board_sessions where staff_id = sid and status = 'working') then raise exception 'This therapist is busy'; end if;
  l := layout_ensure(shop);
  if not (stn = any(layout_stations(l))) then raise exception 'Unknown bed'; end if;
  if exists (select 1 from board_sessions x where x.shop_id = shop and x.station = stn and x.status = 'working') then raise exception 'This bed is in use'; end if;
  m := greatest(5, coalesce((g.course ->> 'min')::int, 60));
  insert into board_sessions (shop_id, day, guest_id, booking_id, staff_id, staff_name, station, course_name, minutes, price, ends_at, created_by)
  values (shop, d, g.id, g.booking_id, st.id, st.name, stn, coalesce(g.course ->> 'ko', g.course ->> 'vi'), m,
          case when g.source = 'ud' then coalesce((g.course ->> 'price')::bigint, 0) else coalesce((g.course ->> 'price')::bigint, 0) * g.people end,
          now() + make_interval(mins => m), actor_name(shop));
  update board_guests set status = 'in_session' where id = g.id;
  return board_get(shop);
end $$;

-- 시술 끝: 받은 금액 기록. 엉클데이 예약이면 방문 완료 + 금액이 예약에 자동으로 들어가요.
create or replace function public.session_finish(shop text, xid uuid, paid bigint default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare x board_sessions; amt bigint;
begin
  perform owner_check(shop);
  select * into x from board_sessions where id = xid and shop_id = shop for update;
  if not found or x.status <> 'working' then raise exception 'Session not found'; end if;
  amt := coalesce(paid, x.price);
  if amt < 0 then raise exception 'Please enter the amount'; end if;
  update board_sessions set status = 'done', paid = amt, done_at = now() where id = x.id;
  update board_guests set status = 'done' where id = x.guest_id
    and not exists (select 1 from board_sessions y where y.guest_id = x.guest_id and y.status = 'working' and y.id <> x.id);
  if x.booking_id is not null and exists (select 1 from bookings where id = x.booking_id and status in ('shop_ok', 'confirmed', 'requested')) then
    perform owner_reply(x.booking_id, 'visited', amt, null, null);
  end if;
  return board_get(shop);
end $$;

create or replace function public.session_extend(shop text, xid uuid, mins int) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform owner_check(shop);
  update board_sessions set ends_at = ends_at + make_interval(mins => least(120, greatest(5, mins))), minutes = minutes + least(120, greatest(5, mins))
    where id = xid and shop_id = shop and status = 'working';
  return board_get(shop);
end $$;

create or replace function public.session_cancel(shop text, xid uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare x board_sessions;
begin
  perform owner_check(shop);
  update board_sessions set status = 'cancelled', done_at = now() where id = xid and shop_id = shop and status = 'working' returning * into x;
  if found then update board_guests set status = 'waiting' where id = x.guest_id and status = 'in_session'; end if;
  return board_get(shop);
end $$;

-- ---------- 출퇴근 · 휴무 ----------
create or replace function public.staff_attend(shop text, sid uuid, action text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare st shop_staff; d date := vn_today(); l shop_layout; code text; startm int;
begin
  perform owner_check(shop);
  select * into st from shop_staff where id = sid and shop_id = shop and active;
  if not found then raise exception 'Staff not found'; end if;
  if action = 'in' then
    l := layout_ensure(shop); code := staff_code(st, d);
    startm := case when code = 'O' then null else coalesce((l.shifts -> code ->> 0)::int, 600) end;
    insert into staff_attendance (staff_id, day, shop_id, in_at, late_min)
    values (sid, d, shop, now(), greatest(0, vn_min_now() - coalesce(startm, vn_min_now())))
    on conflict (staff_id, day) do update set in_at = coalesce(staff_attendance.in_at, excluded.in_at), out_at = null;
  elsif action = 'out' then
    if exists (select 1 from board_sessions where staff_id = sid and status = 'working') then raise exception 'Still in a session'; end if;
    update staff_attendance set out_at = now() where staff_id = sid and day = d;
  else raise exception 'Unknown action';
  end if;
  return board_get(shop);
end $$;

-- 근무 코드 바꾸기 (사장님). code = A · B · F · O, null = 평소대로
create or replace function public.shift_set(shop text, sid uuid, d date, code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform owner_check(shop, true);
  if not exists (select 1 from shop_staff where id = sid and shop_id = shop) then raise exception 'Staff not found'; end if;
  if code is null then delete from staff_shifts where staff_id = sid and day = d;
  else
    insert into staff_shifts (staff_id, day, shop_id, code, updated_by) values (sid, d, shop, code, actor_name(shop))
    on conflict (staff_id, day) do update set code = excluded.code, updated_by = excluded.updated_by, updated_at = now();
  end if;
end $$;

-- 근무표 (d1부터 7일) + 요청
create or replace function public.shifts_get(shop text, d1 date) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform owner_check(shop);
  return jsonb_build_object(
    'from', d1,
    'layout', (select jsonb_build_object('shifts', shifts, 'min_am', min_am, 'min_pm', min_pm) from shop_layout where shop_id = shop),
    'staff', coalesce((select jsonb_agg(jsonb_build_object('id', st.id, 'name', st.name, 'role', st.role, 'look', st.look,
        'codes', (select jsonb_agg(staff_code(st, d1 + i) order by i) from generate_series(0, 6) i)) order by st.sort, st.created_at)
      from shop_staff st where st.shop_id = shop and st.active), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'staff_id', q.staff_id, 'name', s1.name, 'day', q.day, 'type', q.type, 'must', q.must,
        'want', q.want, 'mate_id', q.mate_id, 'mate', s2.name, 'reason', q.reason, 'status', q.status, 'created_at', q.created_at) order by q.created_at desc)
      from staff_requests q join shop_staff s1 on s1.id = q.staff_id left join shop_staff s2 on s2.id = q.mate_id
      where q.shop_id = shop and (q.status in ('peer', 'pending') or q.created_at > now() - interval '30 days')), '[]'::jsonb));
end $$;

-- 요청 승인 · 거절 (사장님)
create or replace function public.req_decide(shop text, rid bigint, ok boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q staff_requests; a shop_staff; b shop_staff; ca text; cb text;
begin
  perform owner_check(shop, true);
  select * into q from staff_requests where id = rid and shop_id = shop for update;
  if not found or q.status <> 'pending' then raise exception 'Request not found'; end if;
  update staff_requests set status = case when ok then 'ok' else 'no' end, decided_at = now(), decided_by = actor_name(shop) where id = rid;
  if ok then
    select * into a from shop_staff where id = q.staff_id;
    if q.type = 'off' then perform shift_set(shop, q.staff_id, q.day, 'O');
    elsif q.type = 'shift' then perform shift_set(shop, q.staff_id, q.day, q.want);
    else
      select * into b from shop_staff where id = q.mate_id;
      ca := staff_code(a, q.day); cb := staff_code(b, q.day);
      perform shift_set(shop, a.id, q.day, cb); perform shift_set(shop, b.id, q.day, ca);
    end if;
  end if;
  return shifts_get(shop, q.day - ((extract(isodow from q.day)::int) - 1));
end $$;

grant execute on function public.board_get(text), public.board_layout_save(text, jsonb), public.board_items_save(text, jsonb),
  public.staff_upsert(text, jsonb), public.staff_remove(text, uuid), public.guest_add(text, text, jsonb, int), public.guest_checkin(text, uuid),
  public.guest_leave(text, uuid), public.session_start(text, uuid, uuid, text), public.session_finish(text, uuid, bigint),
  public.session_extend(text, uuid, int), public.session_cancel(text, uuid), public.staff_attend(text, uuid, text),
  public.shift_set(text, uuid, date, text), public.shifts_get(text, date), public.req_decide(text, bigint, boolean) to authenticated;

-- ============================================================
-- 26. 엉클데이 유니버스: 영업 시작 · 마감 (출퇴근과 따로)
-- 영업은 사장님 페이지 '영업시간' 설정대로 시간이 되면 자동으로 시작 · 종료돼요.
-- 그 전에 일찍 열거나(지금 영업 시작), 일찍 닫거나(영업 마감), 늦게까지 연장할 수 있어요.
-- 직원 출근 · 퇴근은 이것과 상관없이 직원마다 따로 기록해요.
-- universe.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

create table if not exists public.shop_days (
  shop_id    text not null references public.shops(id) on update cascade on delete cascade,
  day        date not null,
  opened_at  timestamptz,
  closed_at  timestamptz,
  opened_by  text,
  closed_by  text,
  primary key (shop_id, day)
);
alter table public.shop_days enable row level security;
drop policy if exists "shop_days admin" on public.shop_days;
create policy "shop_days admin" on public.shop_days for all to authenticated using (is_admin()) with check (is_admin());
grant select, insert, update, delete on public.shop_days to authenticated;

-- 오늘 영업 상태
--  before(오픈 전) · open_auto(영업시간 안) · open_manual(직접 시작) · after(영업 종료) · closed_manual(직접 마감) · dayoff(휴무일)
create or replace function public.shop_state(shop text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d date := vn_today(); nowm int := vn_min_now(); h jsonb; w jsonb; o int; c int; sd shop_days; st text; off boolean;
begin
  h := shop_hours_of(shop);
  w := h -> 'week' -> (extract(isodow from d)::int - 1);
  off := coalesce((w ->> 'closed')::boolean, false) or exists (select 1 from shop_closures where shop_id = shop and day = d and slot is null);
  o := coalesce(split_part(w ->> 'open', ':', 1)::int * 60 + split_part(w ->> 'open', ':', 2)::int, 600);
  c := coalesce(split_part(w ->> 'close', ':', 1)::int * 60 + split_part(w ->> 'close', ':', 2)::int, 1320);
  if c <= o then c := c + 1440; end if;
  select * into sd from shop_days where shop_id = shop and day = d;
  if found and sd.closed_at is not null and (sd.opened_at is null or sd.closed_at >= sd.opened_at) then st := 'closed_manual';
  elsif found and sd.opened_at is not null then
    -- 영업시간 전에 일찍 열었으면 마감 시간에 자동 종료, 마감 뒤에 연 거면(연장) 직접 닫을 때까지
    if not off and nowm >= c and extract(hour from sd.opened_at at time zone 'Asia/Ho_Chi_Minh')::int * 60 + extract(minute from sd.opened_at at time zone 'Asia/Ho_Chi_Minh')::int < c then st := 'after';
    else st := 'open_manual'; end if;
  elsif off then st := 'dayoff';
  elsif nowm < o then st := 'before';
  elsif nowm < c then st := 'open_auto';
  else st := 'after';
  end if;
  return jsonb_build_object('status', st, 'open', w ->> 'open', 'close', w ->> 'close', 'dayoff', off,
    'opened_at', sd.opened_at, 'closed_at', sd.closed_at, 'opened_by', sd.opened_by, 'closed_by', sd.closed_by,
    'is_open', st in ('open_auto', 'open_manual'));
end $$;

-- 지금 영업 시작 / 영업 마감 (사장님 · 카운터 직원)
create or replace function public.shop_open(shop text, action text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d date := vn_today(); who text;
begin
  perform owner_check(shop);
  who := actor_name(shop);
  if action = 'open' then
    insert into shop_days (shop_id, day, opened_at, opened_by) values (shop, d, now(), who)
    on conflict (shop_id, day) do update set opened_at = now(), opened_by = who, closed_at = null, closed_by = null;
  elsif action = 'close' then
    insert into shop_days (shop_id, day, closed_at, closed_by) values (shop, d, now(), who)
    on conflict (shop_id, day) do update set closed_at = now(), closed_by = who;
  else raise exception 'Unknown action';
  end if;
  return board_get(shop);
end $$;

-- 현황판에 영업 상태를 같이 보내요
create or replace function public.board_get(shop text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d date := vn_today(); l shop_layout; r text;
begin
  r := owner_check(shop);
  l := layout_ensure(shop);
  return jsonb_build_object(
    'today', d, 'now', now(), 'now_min', vn_min_now(), 'role', r,
    'shop', (select jsonb_build_object('id', s.id, 'name', s.data -> 'name') from shops s where s.id = shop),
    'shop_state', shop_state(shop),
    'layout', to_jsonb(l) - 'shop_id',
    'staff', coalesce((select jsonb_agg(jsonb_build_object(
        'id', st.id, 'name', st.name, 'role', st.role, 'years', st.years, 'look', st.look, 'def_code', st.def_code, 'off_day', st.off_day,
        'code', staff_code(st, d),
        'in_at', a.in_at, 'out_at', a.out_at, 'late_min', a.late_min,
        'stars', (select round(avg(v.stars)::numeric, 1) from staff_reviews v where v.staff_id = st.id and not v.hidden),
        'reviews', (select count(*) from staff_reviews v where v.staff_id = st.id and not v.hidden),
        'done_today', (select count(*) from board_sessions x where x.staff_id = st.id and x.day = d and x.status = 'done'),
        'rev_today', (select coalesce(sum(coalesce(x.paid, x.price)), 0) from board_sessions x where x.staff_id = st.id and x.day = d and x.status = 'done'))
        order by st.sort, st.created_at)
      from shop_staff st left join staff_attendance a on a.staff_id = st.id and a.day = d
      where st.shop_id = shop and st.active), '[]'::jsonb),
    'guests', coalesce((select jsonb_agg(to_jsonb(g) order by g.created_at) from board_guests g
      where g.shop_id = shop and g.day = d and g.status in ('waiting', 'in_session')), '[]'::jsonb),
    'expected', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'code', b.code, 'name', b.customer_name, 'menu_name', b.menu_name,
        'min', b.menu_min, 'people', b.people, 'price', b.list_price, 'time', b.visit_time, 'status', b.status) order by b.visit_time)
      from bookings b where b.shop_id = shop and b.visit_date = d and b.status in ('shop_ok', 'confirmed')
        and not exists (select 1 from board_guests g where g.booking_id = b.id)), '[]'::jsonb),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'guest_id', x.guest_id, 'booking_id', x.booking_id, 'staff_id', x.staff_id,
        'staff_name', x.staff_name, 'station', x.station, 'course_name', x.course_name, 'minutes', x.minutes, 'price', x.price, 'paid', x.paid,
        'status', x.status, 'started_at', x.started_at, 'ends_at', x.ends_at, 'done_at', x.done_at,
        'guest_name', (select g.name from board_guests g where g.id = x.guest_id), 'ud', x.booking_id is not null) order by x.started_at desc)
      from board_sessions x where x.shop_id = shop and x.day = d and x.status <> 'cancelled'), '[]'::jsonb),
    'pending_req', (select count(*) from staff_requests q where q.shop_id = shop and q.status = 'pending'));
end $$;

grant execute on function public.shop_state(text), public.shop_open(text, text) to authenticated;
-- ============================================================
-- 27. 엉클데이 유니버스: 직원마다 근무 시간 직접 정하기
-- 오전 · 오후 · 종일 말고, 4시간만 일하는 직원처럼 시간을 직접 정할 수 있어요 (근무 코드 C).
--  · 평소 근무: 직원 설정에서 "직접 정하기" + 시작 · 끝 시간
--  · 하루만: 근무표 칸에서 시작 · 끝 시간
-- 지각 계산, 근무표 인원 계산도 이 시간을 따라요.
-- universe2.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

alter table public.shop_staff add column if not exists def_start int;
alter table public.shop_staff add column if not exists def_end int;
alter table public.staff_shifts add column if not exists start_min int;
alter table public.staff_shifts add column if not exists end_min int;

alter table public.shop_staff drop constraint if exists shop_staff_def_code_check;
alter table public.shop_staff add constraint shop_staff_def_code_check check (def_code in ('A', 'B', 'F', 'C'));
alter table public.shop_staff drop constraint if exists shop_staff_def_hours_check;
alter table public.shop_staff add constraint shop_staff_def_hours_check
  check (def_code <> 'C' or (def_start between 0 and 1680 and def_end > def_start and def_end <= 1800));
alter table public.staff_shifts drop constraint if exists staff_shifts_code_check;
alter table public.staff_shifts add constraint staff_shifts_code_check check (code in ('A', 'B', 'F', 'O', 'C'));
alter table public.staff_shifts drop constraint if exists staff_shifts_hours_check;
alter table public.staff_shifts add constraint staff_shifts_hours_check
  check (code <> 'C' or (start_min between 0 and 1680 and end_min > start_min and end_min <= 1800));

-- 그날 근무 시간 [시작분, 끝분]. 휴무면 null
create or replace function public.staff_hours(st shop_staff, d date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r staff_shifts; c text; sh jsonb;
begin
  select * into r from staff_shifts where staff_id = st.id and day = d;
  if found then
    c := r.code;
    if c = 'C' then return jsonb_build_array(r.start_min, r.end_min); end if;
  else
    c := case when st.off_day = extract(dow from d)::int then 'O' else st.def_code end;
    if c = 'C' then return jsonb_build_array(st.def_start, st.def_end); end if;
  end if;
  if c = 'O' then return null; end if;
  select shifts -> c into sh from shop_layout where shop_id = st.shop_id;
  return coalesce(sh, case c when 'A' then '[600,1140]' when 'B' then '[780,1320]' else '[600,1320]' end::jsonb);
end $$;

-- 하루만 시간 직접 정하기 (사장님)
create or replace function public.shift_set_custom(shop text, sid uuid, d date, s int, e int) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform owner_check(shop, true);
  if not exists (select 1 from shop_staff where id = sid and shop_id = shop) then raise exception 'Staff not found'; end if;
  if s is null or e is null or s < 0 or e <= s or e > 1800 then raise exception 'Please check the hours'; end if;
  insert into staff_shifts (staff_id, day, shop_id, code, start_min, end_min, updated_by) values (sid, d, shop, 'C', s, e, actor_name(shop))
  on conflict (staff_id, day) do update set code = 'C', start_min = s, end_min = e, updated_by = excluded.updated_by, updated_at = now();
end $$;

-- 오전 · 오후 · 종일 · 휴무로 바꾸면 직접 정한 시간은 지워요
create or replace function public.shift_set(shop text, sid uuid, d date, code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform owner_check(shop, true);
  if not exists (select 1 from shop_staff where id = sid and shop_id = shop) then raise exception 'Staff not found'; end if;
  if code is null then delete from staff_shifts where staff_id = sid and day = d;
  elsif code not in ('A', 'B', 'F', 'O') then raise exception 'Unknown shift';
  else
    insert into staff_shifts (staff_id, day, shop_id, code, updated_by) values (sid, d, shop, code, actor_name(shop))
    on conflict (staff_id, day) do update set code = excluded.code, start_min = null, end_min = null, updated_by = excluded.updated_by, updated_at = now();
  end if;
end $$;

-- 직원 추가 · 수정: 평소 근무 시간(def_start · def_end)도 받아요
create or replace function public.staff_upsert(shop text, s jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sid uuid := nullif(s ->> 'id', '')::uuid; ph text := nullif(regexp_replace(coalesce(s ->> 'phone', ''), '\D', '', 'g'), ''); pid uuid;
  nm text := btrim(coalesce(s ->> 'name', '')); dc text := s ->> 'def_code'; ds int := (s ->> 'def_start')::int; de int := (s ->> 'def_end')::int;
begin
  perform owner_check(shop, true);
  if nm = '' then raise exception 'Please enter a name'; end if;
  if dc = 'C' and (ds is null or de is null or de <= ds) then raise exception 'Please check the hours'; end if;
  if dc is not null and dc <> 'C' then ds := null; de := null; end if;
  if ph is not null then
    if left(ph, 1) = '0' then ph := '84' || substr(ph, 2); end if;
    insert into staff_people (name, phone) values (nm, ph) on conflict (phone) do update set name = staff_people.name returning id into pid;
  end if;
  if sid is null then
    insert into shop_staff (shop_id, person_id, name, role, years, phone, look, def_code, def_start, def_end, off_day, sort)
    values (shop, pid, nm, coalesce(s ->> 'role', 'tp'), coalesce((s ->> 'years')::int, 0), ph, coalesce(s -> 'look', '{}'::jsonb),
            coalesce(dc, 'A'), ds, de, coalesce((s ->> 'off_day')::int, -1),
            coalesce((s ->> 'sort')::int, (select coalesce(max(sort), 0) + 1 from shop_staff where shop_id = shop)))
    returning id into sid;
  else
    update shop_staff set name = nm, role = coalesce(s ->> 'role', role), years = coalesce((s ->> 'years')::int, years),
      phone = coalesce(ph, phone), person_id = coalesce(pid, person_id), look = coalesce(s -> 'look', look),
      def_code = coalesce(dc, def_code),
      def_start = case when dc is null then def_start else ds end, def_end = case when dc is null then def_end else de end,
      off_day = coalesce((s ->> 'off_day')::int, off_day), sort = coalesce((s ->> 'sort')::int, sort)
    where id = sid and shop_id = shop;
    if not found then raise exception 'Staff not found'; end if;
  end if;
  return board_get(shop);
end $$;

-- 출근: 지각은 그날 근무 시작 시간 기준
create or replace function public.staff_attend(shop text, sid uuid, action text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare st shop_staff; d date := vn_today(); hrs jsonb; startm int;
begin
  perform owner_check(shop);
  select * into st from shop_staff where id = sid and shop_id = shop and active;
  if not found then raise exception 'Staff not found'; end if;
  if action = 'in' then
    hrs := staff_hours(st, d);
    startm := (hrs ->> 0)::int;
    insert into staff_attendance (staff_id, day, shop_id, in_at, late_min)
    values (sid, d, shop, now(), greatest(0, vn_min_now() - coalesce(startm, vn_min_now())))
    on conflict (staff_id, day) do update set in_at = coalesce(staff_attendance.in_at, excluded.in_at), out_at = null;
  elsif action = 'out' then
    if exists (select 1 from board_sessions where staff_id = sid and status = 'working') then raise exception 'Still in a session'; end if;
    update staff_attendance set out_at = now() where staff_id = sid and day = d;
  else raise exception 'Unknown action';
  end if;
  return board_get(shop);
end $$;

-- 근무표 (d1부터 7일): 날마다 근무 시간도 같이
create or replace function public.shifts_get(shop text, d1 date) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform owner_check(shop);
  return jsonb_build_object(
    'from', d1,
    'layout', (select jsonb_build_object('shifts', shifts, 'min_am', min_am, 'min_pm', min_pm) from shop_layout where shop_id = shop),
    'staff', coalesce((select jsonb_agg(jsonb_build_object('id', st.id, 'name', st.name, 'role', st.role, 'look', st.look,
        'def_code', st.def_code, 'def_start', st.def_start, 'def_end', st.def_end,
        'codes', (select jsonb_agg(staff_code(st, d1 + i) order by i) from generate_series(0, 6) i),
        'hours', (select jsonb_agg(staff_hours(st, d1 + i) order by i) from generate_series(0, 6) i)) order by st.sort, st.created_at)
      from shop_staff st where st.shop_id = shop and st.active), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'staff_id', q.staff_id, 'name', s1.name, 'day', q.day, 'type', q.type, 'must', q.must,
        'want', q.want, 'mate_id', q.mate_id, 'mate', s2.name, 'reason', q.reason, 'status', q.status, 'created_at', q.created_at) order by q.created_at desc)
      from staff_requests q join shop_staff s1 on s1.id = q.staff_id left join shop_staff s2 on s2.id = q.mate_id
      where q.shop_id = shop and (q.status in ('peer', 'pending') or q.created_at > now() - interval '30 days')), '[]'::jsonb));
end $$;

-- 요청 승인: 교대면 직접 정한 시간까지 서로 바꿔요
create or replace function public.req_decide(shop text, rid bigint, ok boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q staff_requests; a shop_staff; b shop_staff; ca text; cb text; ha jsonb; hb jsonb;
begin
  perform owner_check(shop, true);
  select * into q from staff_requests where id = rid and shop_id = shop for update;
  if not found or q.status <> 'pending' then raise exception 'Request not found'; end if;
  update staff_requests set status = case when ok then 'ok' else 'no' end, decided_at = now(), decided_by = actor_name(shop) where id = rid;
  if ok then
    select * into a from shop_staff where id = q.staff_id;
    if q.type = 'off' then perform shift_set(shop, q.staff_id, q.day, 'O');
    elsif q.type = 'shift' then perform shift_set(shop, q.staff_id, q.day, q.want);
    else
      select * into b from shop_staff where id = q.mate_id;
      ca := staff_code(a, q.day); cb := staff_code(b, q.day); ha := staff_hours(a, q.day); hb := staff_hours(b, q.day);
      if cb = 'C' then perform shift_set_custom(shop, a.id, q.day, (hb ->> 0)::int, (hb ->> 1)::int); else perform shift_set(shop, a.id, q.day, cb); end if;
      if ca = 'C' then perform shift_set_custom(shop, b.id, q.day, (ha ->> 0)::int, (ha ->> 1)::int); else perform shift_set(shop, b.id, q.day, ca); end if;
    end if;
  end if;
  return shifts_get(shop, q.day - ((extract(isodow from q.day)::int) - 1));
end $$;

-- 현황판: 직원마다 오늘 근무 시간(hours)과 평소 근무 시간도 같이
create or replace function public.board_get(shop text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d date := vn_today(); l shop_layout; r text;
begin
  r := owner_check(shop);
  l := layout_ensure(shop);
  return jsonb_build_object(
    'today', d, 'now', now(), 'now_min', vn_min_now(), 'role', r,
    'shop', (select jsonb_build_object('id', s.id, 'name', s.data -> 'name') from shops s where s.id = shop),
    'shop_state', shop_state(shop),
    'layout', to_jsonb(l) - 'shop_id',
    'staff', coalesce((select jsonb_agg(jsonb_build_object(
        'id', st.id, 'name', st.name, 'role', st.role, 'years', st.years, 'look', st.look, 'def_code', st.def_code, 'off_day', st.off_day,
        'def_start', st.def_start, 'def_end', st.def_end,
        'code', staff_code(st, d), 'hours', staff_hours(st, d),
        'in_at', a.in_at, 'out_at', a.out_at, 'late_min', a.late_min,
        'stars', (select round(avg(v.stars)::numeric, 1) from staff_reviews v where v.staff_id = st.id and not v.hidden),
        'reviews', (select count(*) from staff_reviews v where v.staff_id = st.id and not v.hidden),
        'done_today', (select count(*) from board_sessions x where x.staff_id = st.id and x.day = d and x.status = 'done'),
        'rev_today', (select coalesce(sum(coalesce(x.paid, x.price)), 0) from board_sessions x where x.staff_id = st.id and x.day = d and x.status = 'done'))
        order by st.sort, st.created_at)
      from shop_staff st left join staff_attendance a on a.staff_id = st.id and a.day = d
      where st.shop_id = shop and st.active), '[]'::jsonb),
    'guests', coalesce((select jsonb_agg(to_jsonb(g) order by g.created_at) from board_guests g
      where g.shop_id = shop and g.day = d and g.status in ('waiting', 'in_session')), '[]'::jsonb),
    'expected', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'code', b.code, 'name', b.customer_name, 'menu_name', b.menu_name,
        'min', b.menu_min, 'people', b.people, 'price', b.list_price, 'time', b.visit_time, 'status', b.status) order by b.visit_time)
      from bookings b where b.shop_id = shop and b.visit_date = d and b.status in ('shop_ok', 'confirmed')
        and not exists (select 1 from board_guests g where g.booking_id = b.id)), '[]'::jsonb),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'guest_id', x.guest_id, 'booking_id', x.booking_id, 'staff_id', x.staff_id,
        'staff_name', x.staff_name, 'station', x.station, 'course_name', x.course_name, 'minutes', x.minutes, 'price', x.price, 'paid', x.paid,
        'status', x.status, 'started_at', x.started_at, 'ends_at', x.ends_at, 'done_at', x.done_at,
        'guest_name', (select g.name from board_guests g where g.id = x.guest_id), 'ud', x.booking_id is not null) order by x.started_at desc)
      from board_sessions x where x.shop_id = shop and x.day = d and x.status <> 'cancelled'), '[]'::jsonb),
    'pending_req', (select count(*) from staff_requests q where q.shop_id = shop and q.status = 'pending'));
end $$;

grant execute on function public.staff_hours(shop_staff, date), public.shift_set_custom(text, uuid, date, int, int) to authenticated;
-- ============================================================
-- 28. 엉클데이 유니버스: 손님 한 명에 테라피스트 여러 명 (최대 4명, 포핸즈 등)
-- 같은 베드에 여러 명이 같이 들어가요. 시술은 직원마다 한 줄씩 기록하고 grp로 묶어요.
-- 금액은 같이 들어간 직원 수로 나눠서 직원별 매출에 들어가요 (합계는 그대로).
-- 끝내기 · 15분 연장 · 취소는 같이 들어간 직원 모두에게 한 번에 적용돼요.
-- universe3.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

alter table public.board_sessions add column if not exists grp uuid;
create index if not exists board_sessions_grp_idx on public.board_sessions (grp);

-- 시술 시작: 테라피스트 1~4명
drop function if exists public.session_begin(text, uuid, uuid[], text);
create or replace function public.session_begin(shop text, gid uuid, tps jsonb, stn text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g board_guests; l shop_layout; m int; d date := vn_today(); n int; total bigint; each bigint; g_id uuid; st shop_staff; k int := 0; nid uuid; sids uuid[];
begin
  perform owner_check(shop);
  select * into g from board_guests where id = gid and shop_id = shop for update;
  if not found or g.status <> 'waiting' then raise exception 'This guest is not waiting'; end if;
  if jsonb_typeof(tps) <> 'array' then raise exception 'Choose a therapist'; end if;
  select array_agg(v::uuid order by o) into sids from (select v, min(o) o from jsonb_array_elements_text(tps) with ordinality e(v, o) where v <> '' group by v) q;
  n := coalesce(array_length(sids, 1), 0);
  if n < 1 then raise exception 'Choose a therapist'; end if;
  if n > 4 then raise exception 'Up to 4 therapists'; end if;
  if (select count(*) from shop_staff where id = any(sids) and shop_id = shop and active and role = 'tp') <> n then raise exception 'Choose a therapist'; end if;
  if exists (select 1 from board_sessions where staff_id = any(sids) and status = 'working') then raise exception 'This therapist is busy'; end if;
  l := layout_ensure(shop);
  if not (stn = any(layout_stations(l))) then raise exception 'Unknown bed'; end if;
  if exists (select 1 from board_sessions x where x.shop_id = shop and x.station = stn and x.status = 'working') then raise exception 'This bed is in use'; end if;
  m := greatest(5, coalesce((g.course ->> 'min')::int, 60));
  total := case when g.source = 'ud' then coalesce((g.course ->> 'price')::bigint, 0) else coalesce((g.course ->> 'price')::bigint, 0) * g.people end;
  each := total / n;
  g_id := gen_random_uuid();
  for st in select * from shop_staff where id = any(sids) order by array_position(sids, id) loop
    nid := case when k = 0 then g_id else gen_random_uuid() end;
    insert into board_sessions (id, grp, shop_id, day, guest_id, booking_id, staff_id, staff_name, station, course_name, minutes, price, ends_at, created_by)
    values (nid, g_id, shop, d, g.id, g.booking_id, st.id, st.name, stn, coalesce(g.course ->> 'ko', g.course ->> 'vi'), m,
            case when k = 0 then total - each * (n - 1) else each end, now() + make_interval(mins => m), actor_name(shop));
    k := k + 1;
  end loop;
  update board_guests set status = 'in_session' where id = g.id;
  return board_get(shop);
end $$;

-- 시술 끝: 같이 들어간 직원 모두 끝. 받은 금액은 나눠서 기록, 엉클데이 예약이면 합계로 방문 완료
create or replace function public.session_finish(shop text, xid uuid, paid bigint default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare x board_sessions; gp uuid; n int; amt bigint; each bigint; r record; k int := 0;
begin
  perform owner_check(shop);
  select * into x from board_sessions where id = xid and shop_id = shop for update;
  if not found or x.status <> 'working' then raise exception 'Session not found'; end if;
  gp := coalesce(x.grp, x.id);
  select count(*), sum(price) into n, amt from board_sessions where coalesce(grp, id) = gp and shop_id = shop and status = 'working';
  amt := coalesce(session_finish.paid, amt);
  if amt < 0 then raise exception 'Please enter the amount'; end if;
  each := amt / n;
  for r in select id from board_sessions where coalesce(grp, id) = gp and shop_id = shop and status = 'working' order by (id = gp) desc, started_at, id loop
    update board_sessions set status = 'done', paid = case when k = 0 then amt - each * (n - 1) else each end, done_at = now() where id = r.id;
    k := k + 1;
  end loop;
  update board_guests set status = 'done' where id = x.guest_id
    and not exists (select 1 from board_sessions y where y.guest_id = x.guest_id and y.status = 'working');
  if x.booking_id is not null and exists (select 1 from bookings where id = x.booking_id and status in ('shop_ok', 'confirmed', 'requested')) then
    perform owner_reply(x.booking_id, 'visited', amt, null, null);
  end if;
  return board_get(shop);
end $$;

create or replace function public.session_extend(shop text, xid uuid, mins int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare gp uuid; mm int := least(120, greatest(5, mins));
begin
  perform owner_check(shop);
  select coalesce(grp, id) into gp from board_sessions where id = xid and shop_id = shop;
  update board_sessions set ends_at = ends_at + make_interval(mins => mm), minutes = minutes + mm
    where coalesce(grp, id) = gp and shop_id = shop and status = 'working';
  return board_get(shop);
end $$;

create or replace function public.session_cancel(shop text, xid uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare gp uuid; gid uuid;
begin
  perform owner_check(shop);
  select coalesce(grp, id), guest_id into gp, gid from board_sessions where id = xid and shop_id = shop and status = 'working';
  if gp is null then return board_get(shop); end if;
  update board_sessions set status = 'cancelled', done_at = now() where coalesce(grp, id) = gp and shop_id = shop and status = 'working';
  update board_guests set status = 'waiting' where id = gid and status = 'in_session';
  return board_get(shop);
end $$;

-- 현황판: 시술마다 같이 들어간 팀(grp)도 보내요
create or replace function public.board_get(shop text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d date := vn_today(); l shop_layout; r text;
begin
  r := owner_check(shop);
  l := layout_ensure(shop);
  return jsonb_build_object(
    'today', d, 'now', now(), 'now_min', vn_min_now(), 'role', r,
    'shop', (select jsonb_build_object('id', s.id, 'name', s.data -> 'name') from shops s where s.id = shop),
    'shop_state', shop_state(shop),
    'layout', to_jsonb(l) - 'shop_id',
    'staff', coalesce((select jsonb_agg(jsonb_build_object(
        'id', st.id, 'name', st.name, 'role', st.role, 'years', st.years, 'look', st.look, 'def_code', st.def_code, 'off_day', st.off_day,
        'def_start', st.def_start, 'def_end', st.def_end,
        'code', staff_code(st, d), 'hours', staff_hours(st, d),
        'in_at', a.in_at, 'out_at', a.out_at, 'late_min', a.late_min,
        'stars', (select round(avg(v.stars)::numeric, 1) from staff_reviews v where v.staff_id = st.id and not v.hidden),
        'reviews', (select count(*) from staff_reviews v where v.staff_id = st.id and not v.hidden),
        'done_today', (select count(*) from board_sessions x where x.staff_id = st.id and x.day = d and x.status = 'done'),
        'rev_today', (select coalesce(sum(coalesce(x.paid, x.price)), 0) from board_sessions x where x.staff_id = st.id and x.day = d and x.status = 'done'))
        order by st.sort, st.created_at)
      from shop_staff st left join staff_attendance a on a.staff_id = st.id and a.day = d
      where st.shop_id = shop and st.active), '[]'::jsonb),
    'guests', coalesce((select jsonb_agg(to_jsonb(g) order by g.created_at) from board_guests g
      where g.shop_id = shop and g.day = d and g.status in ('waiting', 'in_session')), '[]'::jsonb),
    'expected', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'code', b.code, 'name', b.customer_name, 'menu_name', b.menu_name,
        'min', b.menu_min, 'people', b.people, 'price', b.list_price, 'time', b.visit_time, 'status', b.status) order by b.visit_time)
      from bookings b where b.shop_id = shop and b.visit_date = d and b.status in ('shop_ok', 'confirmed')
        and not exists (select 1 from board_guests g where g.booking_id = b.id)), '[]'::jsonb),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'guest_id', x.guest_id, 'booking_id', x.booking_id, 'staff_id', x.staff_id,
        'staff_name', x.staff_name, 'station', x.station, 'course_name', x.course_name, 'minutes', x.minutes, 'price', x.price, 'paid', x.paid,
        'status', x.status, 'grp', coalesce(x.grp, x.id), 'started_at', x.started_at, 'ends_at', x.ends_at, 'done_at', x.done_at,
        'guest_name', (select g.name from board_guests g where g.id = x.guest_id), 'ud', x.booking_id is not null) order by x.started_at desc)
      from board_sessions x where x.shop_id = shop and x.day = d and x.status <> 'cancelled'), '[]'::jsonb),
    'pending_req', (select count(*) from staff_requests q where q.shop_id = shop and q.status = 'pending'));
end $$;

grant execute on function public.session_begin(text, uuid, jsonb, text) to authenticated;
-- ============================================================
-- 29. 엉클데이 유니버스: 자정을 넘긴 시술도 현황판에 보이게
-- 베트남 시간 자정이 지나면 날짜가 바뀌어서, 어제 시작해 아직 안 끝난 시술이 현황판에서 사라졌어요.
-- 그런데 그 직원은 계속 '시술 중'으로 잡혀서 배정할 때 "This therapist is busy"가 떴어요.
-- 이제 끝나지 않은 시술과 기다리는 손님은 날짜가 바뀌어도 끝낼 때까지 현황판에 보여요.
-- 어제 출근해서 아직 퇴근 안 한 직원도 자정 뒤에 '근무 중'으로 보이고, 퇴근을 누르면 그 기록에 퇴근이 찍혀요.
-- universe4.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

create or replace function public.board_get(shop text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d date := vn_today(); l shop_layout; r text;
begin
  r := owner_check(shop);
  l := layout_ensure(shop);
  return jsonb_build_object(
    'today', d, 'now', now(), 'now_min', vn_min_now(), 'role', r,
    'shop', (select jsonb_build_object('id', s.id, 'name', s.data -> 'name') from shops s where s.id = shop),
    'shop_state', shop_state(shop),
    'layout', to_jsonb(l) - 'shop_id',
    'staff', coalesce((select jsonb_agg(jsonb_build_object(
        'id', st.id, 'name', st.name, 'role', st.role, 'years', st.years, 'look', st.look, 'def_code', st.def_code, 'off_day', st.off_day,
        'def_start', st.def_start, 'def_end', st.def_end,
        'code', staff_code(st, d), 'hours', staff_hours(st, d),
        'in_at', a.in_at, 'out_at', a.out_at, 'late_min', a.late_min,
        'stars', (select round(avg(v.stars)::numeric, 1) from staff_reviews v where v.staff_id = st.id and not v.hidden),
        'reviews', (select count(*) from staff_reviews v where v.staff_id = st.id and not v.hidden),
        'done_today', (select count(*) from board_sessions x where x.staff_id = st.id and x.day = d and x.status = 'done'),
        'rev_today', (select coalesce(sum(coalesce(x.paid, x.price)), 0) from board_sessions x where x.staff_id = st.id and x.day = d and x.status = 'done'))
        order by st.sort, st.created_at)
      from shop_staff st left join lateral (select * from staff_attendance a0 where a0.staff_id = st.id and (a0.day = d or (a0.day = d - 1 and a0.out_at is null)) order by a0.day desc limit 1) a on true
      where st.shop_id = shop and st.active), '[]'::jsonb),
    'guests', coalesce((select jsonb_agg(to_jsonb(g) order by g.created_at) from board_guests g
      where g.shop_id = shop and g.status in ('waiting', 'in_session') and (g.day = d or g.day >= d - 1)), '[]'::jsonb),
    'expected', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'code', b.code, 'name', b.customer_name, 'menu_name', b.menu_name,
        'min', b.menu_min, 'people', b.people, 'price', b.list_price, 'time', b.visit_time, 'status', b.status) order by b.visit_time)
      from bookings b where b.shop_id = shop and b.visit_date = d and b.status in ('shop_ok', 'confirmed')
        and not exists (select 1 from board_guests g where g.booking_id = b.id)), '[]'::jsonb),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'guest_id', x.guest_id, 'booking_id', x.booking_id, 'staff_id', x.staff_id,
        'staff_name', x.staff_name, 'station', x.station, 'course_name', x.course_name, 'minutes', x.minutes, 'price', x.price, 'paid', x.paid,
        'status', x.status, 'grp', coalesce(x.grp, x.id), 'started_at', x.started_at, 'ends_at', x.ends_at, 'done_at', x.done_at,
        'guest_name', (select g.name from board_guests g where g.id = x.guest_id), 'ud', x.booking_id is not null) order by x.started_at desc)
      from board_sessions x where x.shop_id = shop and ((x.day = d and x.status <> 'cancelled') or x.status = 'working')), '[]'::jsonb),
    'pending_req', (select count(*) from staff_requests q where q.shop_id = shop and q.status = 'pending'));
end $$;


-- 출근 · 퇴근: 퇴근은 아직 안 끝난 출근 기록(오늘 또는 어제)에 찍어요
create or replace function public.staff_attend(shop text, sid uuid, action text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare st shop_staff; d date := vn_today(); hrs jsonb; startm int;
begin
  perform owner_check(shop);
  select * into st from shop_staff where id = sid and shop_id = shop and active;
  if not found then raise exception 'Staff not found'; end if;
  if action = 'in' then
    hrs := staff_hours(st, d);
    startm := (hrs ->> 0)::int;
    insert into staff_attendance (staff_id, day, shop_id, in_at, late_min)
    values (sid, d, shop, now(), greatest(0, vn_min_now() - coalesce(startm, vn_min_now())))
    on conflict (staff_id, day) do update set in_at = coalesce(staff_attendance.in_at, excluded.in_at), out_at = null;
  elsif action = 'out' then
    if exists (select 1 from board_sessions where staff_id = sid and status = 'working') then raise exception 'Still in a session'; end if;
    update staff_attendance set out_at = now() where staff_id = sid and out_at is null and in_at is not null and day in (d, d - 1);
  else raise exception 'Unknown action';
  end if;
  return board_get(shop);
end $$;

-- ============================================================
-- 30. 엉클데이 유니버스: 지난 기록 · 정산에 현장 손님 매출
--  · board_history(shop, d1, d2): 기간별 시술 기록, 직원별 건수 · 매출 · 출퇴근 (사장님만)
--  · owner_settle: 엉클데이 예약(수수료 대상)에 더해 현장 손님(워크인) 매출도 같이 보여 줘요.
--    현장 손님 매출에는 엉클데이 수수료가 붙지 않아요.
-- universe5.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

-- 시술 한 건(같이 들어간 테라피스트는 한 건으로 묶어요)
create or replace function public.board_rows(shop text, d1 date, d2 date, walk_only boolean default false) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(r order by r ->> 'day', r ->> 'done_at'), '[]'::jsonb) from (
    select jsonb_build_object(
      'grp', coalesce(x.grp, x.id), 'day', min(x.day), 'started_at', min(x.started_at), 'done_at', max(x.done_at),
      'guest', max(g.name), 'people', max(g.people), 'course', max(x.course_name), 'minutes', max(x.minutes), 'station', max(x.station),
      'staff', string_agg(x.staff_name, ', ' order by (x.id = coalesce(x.grp, x.id)) desc, x.staff_name), 'n', count(*),
      'paid', sum(coalesce(x.paid, x.price, 0)), 'ud', bool_or(x.booking_id is not null),
      'code', max(b.code), 'commission', max(b.commission)) r
    from board_sessions x
    left join board_guests g on g.id = x.guest_id
    left join bookings b on b.id = x.booking_id
    where x.shop_id = shop and x.status = 'done' and x.day between d1 and d2 and (not walk_only or x.booking_id is null)
    group by coalesce(x.grp, x.id)) q
$$;
revoke execute on function public.board_rows(text, date, date, boolean) from public, anon, authenticated;

-- 지난 기록 (최대 93일)
create or replace function public.board_history(shop text, d1 date, d2 date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform owner_check(shop, true);
  if d1 is null or d2 is null or d2 < d1 or d2 - d1 > 92 then raise exception 'Bad period'; end if;
  return jsonb_build_object(
    'from', d1, 'to', d2, 'today', vn_today(),
    'rows', board_rows(shop, d1, d2),
    'left', (select count(*) from board_guests g where g.shop_id = shop and g.day between d1 and d2 and g.status = 'left'),
    'staff', coalesce((select jsonb_agg(jsonb_build_object(
        'id', st.id, 'name', st.name, 'role', st.role, 'active', st.active,
        'cnt', (select count(*) from board_sessions x where x.staff_id = st.id and x.status = 'done' and x.day between d1 and d2),
        'rev', (select coalesce(sum(coalesce(x.paid, x.price, 0)), 0) from board_sessions x where x.staff_id = st.id and x.status = 'done' and x.day between d1 and d2),
        'mins', (select coalesce(sum(x.minutes), 0) from board_sessions x where x.staff_id = st.id and x.status = 'done' and x.day between d1 and d2),
        'days', (select count(*) from staff_attendance a where a.staff_id = st.id and a.day between d1 and d2 and a.in_at is not null),
        'work_min', (select coalesce(sum(extract(epoch from (a.out_at - a.in_at)) / 60), 0)::int from staff_attendance a
                     where a.staff_id = st.id and a.day between d1 and d2 and a.in_at is not null and a.out_at is not null),
        'late_n', (select count(*) from staff_attendance a where a.staff_id = st.id and a.day between d1 and d2 and a.late_min > 0),
        'late_min', (select coalesce(sum(a.late_min), 0) from staff_attendance a where a.staff_id = st.id and a.day between d1 and d2),
        'att', case when d1 = d2 then (select jsonb_build_object('in_at', a.in_at, 'out_at', a.out_at, 'late_min', a.late_min)
                     from staff_attendance a where a.staff_id = st.id and a.day = d1) end)
        order by st.active desc, st.sort, st.created_at)
      from shop_staff st where st.shop_id = shop
        and (st.active or exists (select 1 from board_sessions x where x.staff_id = st.id and x.day between d1 and d2))), '[]'::jsonb));
end $$;
grant execute on function public.board_history(text, date, date) to authenticated;

-- 정산: 엉클데이 예약 + 현장 손님 매출
create or replace function public.owner_settle(shop text, mon text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m text := coalesce(nullif(mon, ''), to_char((now() at time zone 'Asia/Ho_Chi_Minh')::date, 'YYYY-MM')); md date;
begin
  perform owner_check(shop, true);
  if m !~ '^\d{4}-\d{2}$' then raise exception 'Bad month'; end if;
  md := (m || '-01')::date;
  return jsonb_build_object(
    'month', m,
    'months', coalesce((select jsonb_agg(x order by x ->> 'month' desc) from (
        select jsonb_build_object('month', to_char(visit_date, 'YYYY-MM'), 'visits', count(*), 'paid', coalesce(sum(paid_amount), 0), 'commission', coalesce(sum(commission), 0)) x
        from bookings where shop_id = shop and status in ('visited', 'settled') and visit_date >= (date_trunc('month', now()) - interval '5 months')::date
        group by to_char(visit_date, 'YYYY-MM')) y), '[]'::jsonb),
    'walk_months', coalesce((select jsonb_agg(x order by x ->> 'month' desc) from (
        select jsonb_build_object('month', to_char(day, 'YYYY-MM'), 'count', count(distinct coalesce(grp, id)), 'paid', coalesce(sum(coalesce(paid, price, 0)), 0)) x
        from board_sessions where shop_id = shop and status = 'done' and booking_id is null and day >= (date_trunc('month', now()) - interval '5 months')::date
        group by to_char(day, 'YYYY-MM')) y), '[]'::jsonb),
    'statements', coalesce((select jsonb_agg(jsonb_build_object('month', s.month, 'count', s.booking_count, 'paid', s.total_paid, 'commission', s.total_commission,
        'status', s.status, 'billed_at', s.billed_at, 'paid_at', s.paid_at) order by s.month desc)
        from settlements s where s.shop_id = shop and s.status <> 'void'), '[]'::jsonb),
    'rows', coalesce((select jsonb_agg(jsonb_build_object('code', b.code, 'date', b.visit_date, 'time', b.visit_time, 'name', b.customer_name, 'people', b.people,
        'menu_name', b.menu_name, 'paid', b.paid_amount, 'commission', b.commission, 'settled', b.status = 'settled',
        'staff', (select string_agg(x.staff_name, ', ' order by (x.id = coalesce(x.grp, x.id)) desc, x.staff_name) from board_sessions x where x.booking_id = b.id and x.status = 'done'))
        order by b.visit_date, b.visit_time)
        from bookings b where b.shop_id = shop and b.status in ('visited', 'settled') and to_char(b.visit_date, 'YYYY-MM') = m), '[]'::jsonb),
    'walk_rows', board_rows(shop, md, (md + interval '1 month' - interval '1 day')::date, true));
end $$;
grant execute on function public.owner_settle(text, text) to authenticated;
-- ============================================================
-- 31. 엉클데이 유니버스: 현황판 없이 '방문 완료'한 예약도 기록에
--  · 예약 탭 · 링크 · 관리자 페이지에서 방문 완료한 예약도 기록 탭에 나와요 ('담당 미기록').
--  · 사장님 페이지에서 담당 테라피스트를 고르거나 나중에 채울 수 있어요 (booking_staff_set).
--  · 시술 기록마다 담당을 누가 정했는지 남겨요 (src: board 현황판 · shop 사장님이 입력 · review 손님 후기).
-- universe6.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

alter table public.board_sessions add column if not exists src text not null default 'board';
alter table public.board_sessions drop constraint if exists board_sessions_src_check;
alter table public.board_sessions add constraint board_sessions_src_check check (src in ('board', 'shop', 'review'));

-- 담당 고르기용 직원 목록 (사장님 · 카운터 직원)
create or replace function public.staff_list(shop text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform owner_check(shop);
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'role', role) order by sort, created_at)
    from shop_staff where shop_id = shop and active), '[]'::jsonb);
end $$;

-- 방문 완료한 엉클데이 예약의 담당 테라피스트 넣기 · 바꾸기 (빈 배열이면 담당 지우기)
create or replace function public.booking_staff_set(shop text, bid uuid, tps jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b bookings; sids uuid[]; n int; amt bigint; each bigint; st shop_staff; k int := 0; g_id uuid; nid uuid;
  t0 timestamptz; t1 timestamptz; stn text := ''; gid uuid; m int;
begin
  perform owner_check(shop);
  select * into b from bookings where id = bid and shop_id = shop;
  if not found then raise exception 'Booking not found'; end if;
  if b.status not in ('visited', 'settled') then raise exception 'This booking is not visited yet'; end if;
  if jsonb_typeof(coalesce(tps, '[]'::jsonb)) <> 'array' then raise exception 'Choose a therapist'; end if;
  select array_agg(v::uuid order by o) into sids from (select v, min(o) o from jsonb_array_elements_text(coalesce(tps, '[]'::jsonb)) with ordinality e(v, o) where v <> '' group by v) q;
  n := coalesce(array_length(sids, 1), 0);
  if n > 4 then raise exception 'Up to 4 therapists'; end if;
  if n > 0 and (select count(*) from shop_staff where id = any(sids) and shop_id = shop) <> n then raise exception 'Staff not found'; end if;
  -- 현황판에서 기록된 시간 · 방은 그대로 쓰고, 없으면 예약 시간으로
  select min(started_at), max(coalesce(done_at, ends_at)), max(station), max(guest_id::text)::uuid, max(minutes)
    into t0, t1, stn, gid, m from board_sessions where booking_id = bid and status = 'done';
  m := coalesce(m, b.menu_min, 60);
  t0 := coalesce(t0, ((b.visit_date + coalesce(nullif(b.visit_time, ''), '12:00')::time) at time zone 'Asia/Ho_Chi_Minh'));
  t1 := coalesce(t1, t0 + make_interval(mins => m));
  delete from board_sessions where booking_id = bid and status = 'done';
  if n = 0 then return jsonb_build_object('ok', true, 'n', 0); end if;
  amt := coalesce(b.paid_amount, 0); each := amt / n; g_id := gen_random_uuid();
  for st in select * from shop_staff where id = any(sids) order by array_position(sids, id) loop
    nid := case when k = 0 then g_id else gen_random_uuid() end;
    insert into board_sessions (id, grp, shop_id, day, guest_id, booking_id, staff_id, staff_name, station, course_name, minutes, price, paid, status, started_at, ends_at, done_at, created_by, src)
    values (nid, g_id, shop, b.visit_date, gid, bid, st.id, st.name, coalesce(stn, ''), b.menu_name, m,
            case when k = 0 then amt - each * (n - 1) else each end, case when k = 0 then amt - each * (n - 1) else each end,
            'done', t0, t1, t1, actor_name(shop), 'shop');
    k := k + 1;
  end loop;
  return jsonb_build_object('ok', true, 'n', n);
end $$;

-- 엉클데이 예약 금액이 바뀌면(방문 완료 금액 수정) 담당 기록 금액도 다시 나눠요
create or replace function public.board_sessions_repaid() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; each bigint; r record; k int := 0;
begin
  if new.paid_amount is distinct from old.paid_amount and new.status in ('visited', 'settled') then
    select count(*) into n from board_sessions where booking_id = new.id and status = 'done';
    if n > 0 then
      each := coalesce(new.paid_amount, 0) / n;
      for r in select id, (id = coalesce(grp, id)) lead from board_sessions where booking_id = new.id and status = 'done' order by (id = coalesce(grp, id)) desc, id loop
        update board_sessions set paid = case when k = 0 then coalesce(new.paid_amount, 0) - each * (n - 1) else each end where id = r.id;
        k := k + 1;
      end loop;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists bookings_repaid on public.bookings;
create trigger bookings_repaid after update of paid_amount on public.bookings for each row execute function public.board_sessions_repaid();

-- 시술 기록: 현황판 기록 + 담당 없이 방문 완료한 엉클데이 예약
create or replace function public.board_rows(shop text, d1 date, d2 date, walk_only boolean default false) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(r order by r ->> 'day', r ->> 'started_at'), '[]'::jsonb) from (
    select jsonb_build_object(
      'grp', coalesce(x.grp, x.id), 'day', min(x.day), 'started_at', min(x.started_at), 'done_at', max(x.done_at),
      'guest', coalesce(max(g.name), max(b.customer_name)), 'people', coalesce(max(g.people), max(b.people)), 'course', max(x.course_name),
      'minutes', max(x.minutes), 'station', nullif(max(x.station), ''),
      'staff', string_agg(x.staff_name, ', ' order by (x.id = coalesce(x.grp, x.id)) desc, x.staff_name),
      'staff_ids', jsonb_agg(x.staff_id order by (x.id = coalesce(x.grp, x.id)) desc, x.staff_name), 'n', count(*),
      'paid', sum(coalesce(x.paid, x.price, 0)), 'ud', bool_or(x.booking_id is not null), 'booking_id', max(x.booking_id::text),
      'code', max(b.code), 'commission', max(b.commission), 'src', max(x.src)) r
    from board_sessions x
    left join board_guests g on g.id = x.guest_id
    left join bookings b on b.id = x.booking_id
    where x.shop_id = shop and x.status = 'done' and x.day between d1 and d2 and (not walk_only or x.booking_id is null)
    group by coalesce(x.grp, x.id)
    union all
    select jsonb_build_object(
      'grp', null, 'day', b.visit_date,
      'started_at', ((b.visit_date + coalesce(nullif(b.visit_time, ''), '12:00')::time) at time zone 'Asia/Ho_Chi_Minh'),
      'done_at', ((b.visit_date + coalesce(nullif(b.visit_time, ''), '12:00')::time) at time zone 'Asia/Ho_Chi_Minh') + make_interval(mins => coalesce(b.menu_min, 60)),
      'guest', b.customer_name, 'people', b.people, 'course', b.menu_name, 'minutes', coalesce(b.menu_min, 60), 'station', null,
      'staff', null, 'staff_ids', '[]'::jsonb, 'n', 0, 'paid', coalesce(b.paid_amount, 0), 'ud', true, 'booking_id', b.id,
      'code', b.code, 'commission', b.commission, 'src', null, 'nostaff', true)
    from bookings b
    where not walk_only and b.shop_id = shop and b.status in ('visited', 'settled') and b.visit_date between d1 and d2
      and not exists (select 1 from board_sessions x where x.booking_id = b.id and x.status = 'done')) q
$$;
revoke execute on function public.board_rows(text, date, date, boolean) from public, anon, authenticated;

grant execute on function public.staff_list(text), public.booking_staff_set(text, uuid, jsonb) to authenticated;

-- 엉클데이 예약의 지금 담당 테라피스트
create or replace function public.booking_staff_get(shop text, bid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform owner_check(shop);
  return jsonb_build_object(
    'staff', staff_list(shop),
    'ids', coalesce((select jsonb_agg(x.staff_id order by (x.id = coalesce(x.grp, x.id)) desc, x.staff_name) from board_sessions x
      where x.booking_id = bid and x.shop_id = shop and x.status = 'done' and x.staff_id is not null), '[]'::jsonb),
    'src', (select max(src) from board_sessions x where x.booking_id = bid and x.shop_id = shop and x.status = 'done'));
end $$;
grant execute on function public.booking_staff_get(text, uuid) to authenticated;
-- ============================================================
-- 32. 엉클데이 유니버스 3단계: 담당 테라피스트 후기 · 후기 보너스
--  · 손님 예약확인증에 담당 테라피스트 이름이 보여요 (시술 중이면 '지금 담당').
--  · 후기를 쓸 때 담당 테라피스트를 골라 한마디를 남길 수 있어요 (같이 들어간 사람은 여러 명).
--  · 담당 규칙: 매장 기록이 먼저. 매장 기록이 없으면 그날 출근한 테라피스트 중에서 손님이 골라요.
--    손님이 고른 담당은 시술 기록에 '손님 후기로 확인'(src=review)으로 채워져요. 사장님이 바꿀 수 있어요.
--  · 보너스: 확인된 후기 1개당 같은 금액 (별점과 상관없음).
--    확인된 후기 = 엉클데이 예약 + 방문 확인 + 방문 뒤 14일 안 + (매장 기록에 있거나 그날 출근한 테라피스트).
--    금액은 관리자 페이지에서 정해요 (universe_config.review_bonus, 처음엔 0₫).
-- universe7.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

-- 설정값 (관리자만)
create table if not exists public.universe_config (
  key        text primary key,
  val        jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.universe_config enable row level security;
drop policy if exists "universe_config admin" on public.universe_config;
create policy "universe_config admin" on public.universe_config for all to authenticated using (is_admin()) with check (is_admin());
grant select, insert, update, delete on public.universe_config to authenticated;
insert into public.universe_config (key, val) values ('review_bonus', '0'::jsonb) on conflict (key) do nothing;

-- 후기: 예약 한 건에 테라피스트 여러 명 가능 (예약 + 직원마다 1개)
alter table public.staff_reviews drop constraint if exists staff_reviews_booking_id_key;
create unique index if not exists staff_reviews_booking_staff_uq on public.staff_reviews (booking_id, staff_id);
alter table public.staff_reviews add column if not exists verified boolean not null default false;
alter table public.staff_reviews add column if not exists via text not null default 'booking';
alter table public.staff_reviews add column if not exists bonus_status text not null default 'none';
alter table public.staff_reviews drop constraint if exists staff_reviews_bonus_status_check;
alter table public.staff_reviews add constraint staff_reviews_bonus_status_check check (bonus_status in ('none', 'pending', 'approved', 'paid', 'rejected'));
alter table public.staff_reviews add column if not exists bonus_amount bigint not null default 0;
alter table public.staff_reviews add column if not exists bonus_decided_at timestamptz;
alter table public.staff_reviews add column if not exists bonus_paid_at timestamptz;
alter table public.staff_reviews add column if not exists bonus_memo text;
alter table public.staff_reviews add column if not exists staff_name text;
create index if not exists staff_reviews_bonus_idx on public.staff_reviews (bonus_status);

-- 이 예약의 담당 테라피스트 (기록 순서: 대표 먼저)
create or replace function public.booking_therapists(bid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', q.staff_id, 'name', q.staff_name, 'look', q.look, 'working', q.working) order by q.lead desc, q.staff_name), '[]'::jsonb)
  from (select distinct on (x.staff_id) x.staff_id, coalesce(st.name, x.staff_name) staff_name, st.look, x.status = 'working' working, (x.id = coalesce(x.grp, x.id)) lead
        from board_sessions x left join shop_staff st on st.id = x.staff_id
        where x.booking_id = bid and x.status in ('working', 'done') and x.staff_id is not null
        order by x.staff_id, (x.status = 'working') desc) q
$$;
revoke execute on function public.booking_therapists(uuid) from public, anon, authenticated;

-- 손님이 고를 수 있는 테라피스트: 매장 기록이 없을 때만, 그날 출근한 테라피스트
create or replace function public.booking_tp_options(bid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', st.id, 'name', st.name, 'look', st.look) order by st.sort, st.created_at), '[]'::jsonb)
  from bookings b join shop_staff st on st.shop_id = b.shop_id and st.role = 'tp'
  where b.id = bid
    and not exists (select 1 from board_sessions x where x.booking_id = b.id and x.status in ('working', 'done'))
    and exists (select 1 from staff_attendance a where a.staff_id = st.id and a.day = b.visit_date and a.in_at is not null)
$$;
revoke execute on function public.booking_tp_options(uuid) from public, anon, authenticated;

-- 손님 예약확인증: 담당 테라피스트 · 테라피스트 후기 정보 추가
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
    'note', b.note, 'lang', b.lang, 'created_at', b.created_at,
    'customer_visit_at', b.customer_visit_at,
    'offer_times', case when b.status = 'reschedule' then b.offer_times else '[]'::jsonb end, 'change_count', b.change_count,
    'reviewed', exists (select 1 from reviews where booking_id = b.id),
    'therapists', booking_therapists(b.id),
    'tp_options', case when win and b.status in ('confirmed', 'visited', 'settled') then booking_tp_options(b.id) else '[]'::jsonb end,
    'tp_window', win,
    'tp_reviewed', coalesce((select jsonb_agg(v.staff_id) from staff_reviews v where v.booking_id = b.id), '[]'::jsonb));
end $$;

-- 손님: 담당 테라피스트 후기 (예약확인증 열쇠로)
-- p = {token, staff:[id…], stars, text, name}
create or replace function public.staff_review_submit(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b bookings; rec jsonb; opt jsonb; ids uuid[]; sid uuid; st shop_staff; n int; stars int := (p ->> 'stars')::int;
  body text := left(btrim(coalesce(p ->> 'text', '')), 500); bonus bigint; ok boolean; filled boolean := false; amt bigint; each bigint; k int := 0; g_id uuid; nid uuid;
begin
  select * into b from bookings where customer_token = p ->> 'token';
  if not found or length(coalesce(p ->> 'token', '')) < 20 then raise exception 'Booking not found'; end if;
  if b.status not in ('confirmed', 'visited', 'settled') then raise exception 'Not visited yet'; end if;
  if b.visit_date is null or vn_today() not between b.visit_date and b.visit_date + 14 then raise exception 'Review window closed'; end if;
  if stars is null or stars < 1 or stars > 5 then raise exception 'Choose stars'; end if;
  if (select count(*) from staff_reviews where created_at > now() - interval '1 minute') >= 20 then raise exception 'Try again later'; end if;
  rec := booking_therapists(b.id);
  opt := booking_tp_options(b.id);
  if jsonb_typeof(p -> 'staff') = 'string' then p := jsonb_set(p, '{staff}', jsonb_build_array(p -> 'staff')); end if;
  if coalesce(jsonb_typeof(p -> 'staff'), 'null') <> 'array' then raise exception 'Choose a therapist'; end if;
  select array_agg(distinct v::uuid) into ids from jsonb_array_elements_text(coalesce(p -> 'staff', '[]'::jsonb)) v where v <> '';
  n := coalesce(array_length(ids, 1), 0);
  if n = 0 then raise exception 'Choose a therapist'; end if;
  if n > 4 then raise exception 'Up to 4 therapists'; end if;
  bonus := coalesce((select (val #>> '{}')::bigint from universe_config where key = 'review_bonus'), 0);
  foreach sid in array ids loop
    -- 매장 기록이 있으면 그 사람들만, 없으면 그날 출근한 테라피스트만
    if jsonb_array_length(rec) > 0 then
      if not exists (select 1 from jsonb_array_elements(rec) r where (r ->> 'id')::uuid = sid) then raise exception 'Choose a therapist'; end if;
    elsif not exists (select 1 from jsonb_array_elements(opt) r where (r ->> 'id')::uuid = sid) then raise exception 'Choose a therapist';
    end if;
    select * into st from shop_staff where id = sid and shop_id = b.shop_id;
    ok := b.customer_visit_at is not null or b.status in ('visited', 'settled');
    insert into staff_reviews (booking_id, shop_id, staff_id, staff_name, stars, body, customer_label, verified, via, bonus_status, bonus_amount)
    values (b.id, b.shop_id, sid, st.name, stars, nullif(body, ''), left(nullif(btrim(coalesce(p ->> 'name', b.customer_name, '')), ''), 20),
            ok, 'booking', case when ok then 'pending' else 'none' end, case when ok then bonus else 0 end)
    on conflict (booking_id, staff_id) do nothing;
  end loop;
  -- 매장 기록이 없고 방문 완료된 예약이면, 손님이 고른 사람으로 담당 채우기 (사장님이 나중에 바꿀 수 있어요)
  if jsonb_array_length(rec) = 0 and b.status in ('visited', 'settled') then
    amt := coalesce(b.paid_amount, 0); each := amt / n; g_id := gen_random_uuid();
    for st in select * from shop_staff where id = any(ids) order by sort, created_at loop
      nid := case when k = 0 then g_id else gen_random_uuid() end;
      insert into board_sessions (id, grp, shop_id, day, booking_id, staff_id, staff_name, station, course_name, minutes, price, paid, status, started_at, ends_at, done_at, created_by, src)
      values (nid, g_id, b.shop_id, b.visit_date, b.id, st.id, st.name, '', b.menu_name, coalesce(b.menu_min, 60),
              case when k = 0 then amt - each * (n - 1) else each end, case when k = 0 then amt - each * (n - 1) else each end, 'done',
              (b.visit_date + coalesce(nullif(b.visit_time, ''), '12:00')::time) at time zone 'Asia/Ho_Chi_Minh',
              ((b.visit_date + coalesce(nullif(b.visit_time, ''), '12:00')::time) at time zone 'Asia/Ho_Chi_Minh') + make_interval(mins => coalesce(b.menu_min, 60)),
              ((b.visit_date + coalesce(nullif(b.visit_time, ''), '12:00')::time) at time zone 'Asia/Ho_Chi_Minh') + make_interval(mins => coalesce(b.menu_min, 60)),
              '손님 후기', 'review');
      k := k + 1;
    end loop;
    filled := true;
  end if;
  return booking_for_customer(b.customer_token) || jsonb_build_object('filled', filled);
end $$;

-- 사장님 · 카운터: 테라피스트 후기 목록 (손님 연락처는 안 보여요)
create or replace function public.staff_reviews_list(shop text, lim int default 50) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform owner_check(shop);
  return coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'staff_id', v.staff_id, 'staff_name', coalesce(st.name, v.staff_name), 'stars', v.stars,
      'body', v.body, 'customer', v.customer_label, 'created_at', v.created_at, 'verified', v.verified, 'code', b.code, 'visit_date', b.visit_date) order by v.created_at desc)
    from (select * from staff_reviews where shop_id = shop and not hidden order by created_at desc limit least(greatest(coalesce(lim, 50), 1), 200)) v
    left join shop_staff st on st.id = v.staff_id left join bookings b on b.id = v.booking_id), '[]'::jsonb);
end $$;

-- 현황판 · 기록 탭: 시술 기록이 손님 후기로 채워진 경우 표시 (board_rows 의 src 로 이미 나가요)

grant execute on function public.staff_review_submit(jsonb) to anon, authenticated;
grant execute on function public.booking_for_customer(text) to anon, authenticated;
grant execute on function public.staff_reviews_list(text, int) to authenticated;
-- ============================================================
-- 33. 엉클데이 유니버스 4단계: 직원 화면 (www.uncleday.com/staff)
--  · 직원은 전화번호 + PIN(숫자 6자리)으로 로그인해요. PIN 은 사장님이 직원 설정에서 만들어 줘요.
--  · 내 근무표 · 오늘 근무 · 휴대폰 출퇴근 · 휴무/근무 변경/교대 요청 · 받은 후기와 보너스 · 경력 동의를 봐요.
--  · 휴대폰으로 출근하면 현황판에 📱 표시가 붙어요.
--  · '구직 중'은 본인만 켜고 끌 수 있고, 사장님 화면에는 절대 나오지 않아요.
--  · 로그인 열쇠는 원문을 저장하지 않고 해시만 저장해요. PIN 을 5번 틀리면 15분 잠겨요.
-- universe8.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

alter table public.shop_staff add column if not exists pin_hash text;
alter table public.shop_staff add column if not exists pin_salt text;
alter table public.shop_staff add column if not exists pin_set_at timestamptz;
alter table public.shop_staff add column if not exists pin_fail int not null default 0;
alter table public.shop_staff add column if not exists pin_locked_until timestamptz;
alter table public.shop_staff add column if not exists last_login_at timestamptz;
alter table public.staff_attendance add column if not exists in_via text;
alter table public.staff_attendance add column if not exists out_via text;

create table if not exists public.staff_tokens (
  token_hash   text primary key,
  staff_id     uuid not null references public.shop_staff(id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '60 days'
);
create index if not exists staff_tokens_staff_idx on public.staff_tokens (staff_id);
alter table public.staff_tokens enable row level security;
drop policy if exists "staff_tokens admin" on public.staff_tokens;
create policy "staff_tokens admin" on public.staff_tokens for all to authenticated using (is_admin()) with check (is_admin());

create or replace function public.ud_hash(s text) returns text
language sql immutable as $$ select encode(sha256(convert_to(s, 'UTF8')), 'hex') $$;
create or replace function public.ud_rand() returns text
language sql volatile as $$ select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') $$;
create or replace function public.ud_phone(p text) returns text
language sql immutable as $$
  select case when d = '' then null when left(d, 1) = '0' then '84' || substr(d, 2) else d end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') d) x
$$;

-- 사장님: 직원 화면 PIN 새로 만들기 (한 번만 보여 줘요) · 끄기
create or replace function public.staff_pin_reset(shop text, sid uuid) returns text
language plpgsql security definer set search_path = public as $$
declare st shop_staff; pin text; salt text := ud_rand();
begin
  perform owner_check(shop, true);
  select * into st from shop_staff where id = sid and shop_id = shop and active;
  if not found then raise exception 'Staff not found'; end if;
  if coalesce(st.phone, '') = '' then raise exception 'Please add a phone number first'; end if;
  pin := lpad((floor(random() * 1000000))::int::text, 6, '0');
  update shop_staff set pin_salt = salt, pin_hash = ud_hash(salt || pin), pin_set_at = now(), pin_fail = 0, pin_locked_until = null where id = sid;
  delete from staff_tokens where staff_id = sid;
  return pin;
end $$;
create or replace function public.staff_pin_off(shop text, sid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform owner_check(shop, true);
  update shop_staff set pin_hash = null, pin_salt = null where id = sid and shop_id = shop;
  delete from staff_tokens where staff_id = sid;
end $$;

-- 직원 로그인: 전화번호 + PIN → 열쇠
create or replace function public.staff_login(phone text, pin text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare ph text := ud_phone(phone); st shop_staff; tok text := ud_rand(); hit uuid;
begin
  if ph is null or coalesce(pin, '') !~ '^\d{4,6}$' then raise exception 'Wrong phone or PIN'; end if;
  if exists (select 1 from shop_staff where shop_staff.phone = ph and active and pin_locked_until > now()) then raise exception 'Too many tries. Wait 15 minutes'; end if;
  for st in select * from shop_staff where shop_staff.phone = ph and active and pin_hash is not null order by last_login_at desc nulls last loop
    if st.pin_hash = ud_hash(st.pin_salt || pin) then hit := st.id; exit; end if;
  end loop;
  if hit is null then
    update shop_staff set pin_fail = pin_fail + 1,
      pin_locked_until = case when pin_fail + 1 >= 5 then now() + interval '15 minutes' else pin_locked_until end
      where shop_staff.phone = ph and active and pin_hash is not null;
    perform pg_sleep(0.4);
    raise exception 'Wrong phone or PIN';
  end if;
  update shop_staff set pin_fail = 0, pin_locked_until = null, last_login_at = now() where id = hit;
  update shop_staff set pin_fail = 0 where shop_staff.phone = ph;
  delete from staff_tokens where staff_id = hit and expires_at < now();
  insert into staff_tokens (token_hash, staff_id) values (ud_hash(tok), hit);
  return jsonb_build_object('token', tok);
end $$;

-- 열쇠 확인 (내부용)
create or replace function public.staff_auth(tok text) returns shop_staff
language plpgsql security definer set search_path = public as $$
declare st shop_staff; th text := ud_hash(coalesce(tok, ''));
begin
  select s.* into st from staff_tokens k join shop_staff s on s.id = k.staff_id
  where k.token_hash = th and k.expires_at > now() and s.active and s.pin_hash is not null;
  if not found then raise exception 'Please log in again'; end if;
  update staff_tokens set last_used_at = now(), expires_at = greatest(expires_at, now() + interval '30 days') where token_hash = th and last_used_at < now() - interval '1 hour';
  return st;
end $$;
revoke execute on function public.staff_auth(text) from public, anon, authenticated;

create or replace function public.staff_logout(tok text) returns void
language sql security definer set search_path = public as $$ delete from staff_tokens where token_hash = ud_hash(coalesce(tok, '')) $$;

-- 내 화면 데이터
create or replace function public.staff_me(tok text, d1 date default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me shop_staff; d date := vn_today(); w1 date; p staff_people; a staff_attendance; l shop_layout;
begin
  me := staff_auth(tok);
  w1 := coalesce(d1, d - (extract(isodow from d)::int - 1));
  select * into p from staff_people where id = me.person_id;
  select * into a from staff_attendance x where x.staff_id = me.id and (x.day = d or (x.day = d - 1 and x.out_at is null and x.in_at is not null)) order by x.day desc limit 1;
  l := layout_ensure(me.shop_id);
  return jsonb_build_object(
    'today', d, 'now', now(), 'from', w1,
    'me', jsonb_build_object('id', me.id, 'name', me.name, 'role', me.role, 'look', me.look, 'years', me.years, 'phone', me.phone,
        'def_code', me.def_code, 'def_start', me.def_start, 'def_end', me.def_end, 'off_day', me.off_day),
    'shop', (select jsonb_build_object('id', s.id, 'name', s.data -> 'name') from shops s where s.id = me.shop_id),
    'shop_state', shop_state(me.shop_id),
    'shifts', l.shifts,
    'today_code', staff_code(me, d), 'today_hours', staff_hours(me, d),
    'att', case when a.staff_id is null then null else jsonb_build_object('day', a.day, 'in_at', a.in_at, 'out_at', a.out_at, 'late_min', a.late_min, 'in_via', a.in_via) end,
    'session', (select jsonb_build_object('station', x.station, 'course', x.course_name, 'ends_at', x.ends_at, 'started_at', x.started_at,
        'guest', (select g.name from board_guests g where g.id = x.guest_id), 'n', (select count(*) from board_sessions y where coalesce(y.grp, y.id) = coalesce(x.grp, x.id) and y.status = 'working'))
      from board_sessions x where x.staff_id = me.id and x.status = 'working' order by x.started_at desc limit 1),
    'done_today', (select count(*) from board_sessions x where x.staff_id = me.id and x.day = d and x.status = 'done'),
    'done_month', (select count(*) from board_sessions x where x.staff_id = me.id and x.status = 'done' and x.day >= date_trunc('month', d)::date),
    -- 2주 근무표: 나 + 같은 매장 동료 (교대 요청용)
    'rota', coalesce((select jsonb_agg(jsonb_build_object('id', st.id, 'name', st.name, 'role', st.role, 'me', st.id = me.id,
        'codes', (select jsonb_agg(staff_code(st, w1 + i) order by i) from generate_series(0, 13) i),
        'hours', (select jsonb_agg(staff_hours(st, w1 + i) order by i) from generate_series(0, 13) i)) order by (st.id = me.id) desc, st.sort, st.created_at)
      from shop_staff st where st.shop_id = me.shop_id and st.active), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'day', q.day, 'type', q.type, 'want', q.want, 'mate', s2.name, 'mate_id', q.mate_id,
        'reason', q.reason, 'status', q.status, 'created_at', q.created_at) order by q.day desc, q.created_at desc)
      from staff_requests q left join shop_staff s2 on s2.id = q.mate_id
      where q.staff_id = me.id and (q.status in ('peer', 'pending') or q.day >= d - 30)), '[]'::jsonb),
    'incoming', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'day', q.day, 'from', s1.name, 'reason', q.reason,
        'their_code', staff_code(s1, q.day), 'my_code', staff_code(me, q.day)) order by q.day)
      from staff_requests q join shop_staff s1 on s1.id = q.staff_id
      where q.mate_id = me.id and q.status = 'peer' and q.day >= d), '[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object('stars', v.stars, 'body', v.body, 'customer', v.customer_label, 'created_at', v.created_at,
        'bonus_status', v.bonus_status, 'bonus_amount', v.bonus_amount) order by v.created_at desc)
      from (select * from staff_reviews where staff_id = me.id and not hidden order by created_at desc limit 50) v), '[]'::jsonb),
    'bonus', (select jsonb_build_object(
        'pending', coalesce(sum(bonus_amount) filter (where bonus_status in ('pending', 'approved')), 0),
        'paid', coalesce(sum(bonus_amount) filter (where bonus_status = 'paid'), 0),
        'count', count(*), 'avg', round(avg(stars)::numeric, 1)) from staff_reviews where staff_id = me.id and not hidden),
    'bonus_each', coalesce((select (val #>> '{}')::bigint from universe_config where key = 'review_bonus'), 0),
    'consent', jsonb_build_object('career', coalesce(p.career_consent, false), 'open', coalesce(p.open_to_work, false), 'at', p.consent_at));
end $$;

-- 휴대폰 출근 · 퇴근
create or replace function public.staff_clock(tok text, action text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me shop_staff; d date := vn_today(); hrs jsonb; startm int;
begin
  me := staff_auth(tok);
  if action = 'in' then
    hrs := staff_hours(me, d); startm := (hrs ->> 0)::int;
    insert into staff_attendance (staff_id, day, shop_id, in_at, late_min, in_via)
    values (me.id, d, me.shop_id, now(), greatest(0, vn_min_now() - coalesce(startm, vn_min_now())), 'phone')
    on conflict (staff_id, day) do update set in_at = coalesce(staff_attendance.in_at, excluded.in_at), in_via = coalesce(staff_attendance.in_via, 'phone'), out_at = null;
  elsif action = 'out' then
    if exists (select 1 from board_sessions where staff_id = me.id and status = 'working') then raise exception 'Still in a session'; end if;
    update staff_attendance set out_at = now(), out_via = 'phone' where staff_id = me.id and out_at is null and in_at is not null and day in (d, d - 1);
  else raise exception 'Unknown action';
  end if;
  return staff_me(tok);
end $$;

-- 요청 보내기: p = {type: off|shift|swap, day, want, mate_id, reason, must}
create or replace function public.staff_request(tok text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me shop_staff; d date := (p ->> 'day')::date; ty text := p ->> 'type'; mate uuid := nullif(p ->> 'mate_id', '')::uuid; wt text := nullif(p ->> 'want', '');
begin
  me := staff_auth(tok);
  if d is null or d < vn_today() or d > vn_today() + 60 then raise exception 'Choose a day'; end if;
  if ty not in ('off', 'shift', 'swap') then raise exception 'Unknown request'; end if;
  if ty = 'shift' and (wt is null or wt not in ('A', 'B', 'F')) then raise exception 'Choose a shift'; end if;
  if ty = 'swap' and (mate is null or mate = me.id or not exists (select 1 from shop_staff where id = mate and shop_id = me.shop_id and active)) then raise exception 'Choose a coworker'; end if;
  if exists (select 1 from staff_requests where staff_id = me.id and day = d and status in ('peer', 'pending')) then raise exception 'You already asked for this day'; end if;
  if (select count(*) from staff_requests where staff_id = me.id and created_at > now() - interval '1 day') >= 10 then raise exception 'Try again later'; end if;
  insert into staff_requests (shop_id, staff_id, day, type, must, want, mate_id, reason, status)
  values (me.shop_id, me.id, d, ty, coalesce((p ->> 'must')::boolean, false), case when ty = 'shift' then wt end, case when ty = 'swap' then mate end,
          left(nullif(btrim(coalesce(p ->> 'reason', '')), ''), 200), case when ty = 'swap' then 'peer' else 'pending' end);
  return staff_me(tok);
end $$;

create or replace function public.staff_request_cancel(tok text, rid bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me shop_staff;
begin
  me := staff_auth(tok);
  update staff_requests set status = 'cancelled', decided_at = now(), decided_by = me.name where id = rid and staff_id = me.id and status in ('peer', 'pending');
  return staff_me(tok);
end $$;

-- 교대 요청 받은 동료: 수락하면 사장님 승인으로 넘어가요
create or replace function public.staff_peer_answer(tok text, rid bigint, ok boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me shop_staff;
begin
  me := staff_auth(tok);
  update staff_requests set status = case when ok then 'pending' else 'no' end,
    decided_at = case when ok then null else now() end, decided_by = case when ok then null else me.name end
  where id = rid and mate_id = me.id and status = 'peer';
  if not found then raise exception 'Request not found'; end if;
  return staff_me(tok);
end $$;

create or replace function public.staff_pin_change(tok text, old_pin text, new_pin text) returns boolean
language plpgsql security definer set search_path = public as $$
declare me shop_staff; salt text := ud_rand();
begin
  me := staff_auth(tok);
  if me.pin_hash <> ud_hash(me.pin_salt || coalesce(old_pin, '')) then raise exception 'Wrong PIN'; end if;
  if coalesce(new_pin, '') !~ '^\d{6}$' then raise exception 'PIN must be 6 digits'; end if;
  update shop_staff set pin_salt = salt, pin_hash = ud_hash(salt || new_pin), pin_set_at = now() where id = me.id;
  delete from staff_tokens where staff_id = me.id and token_hash <> ud_hash(tok);
  return true;
end $$;

-- 경력 프로필 동의 · 구직 중 (본인만. 사장님 화면에는 안 나와요)
create or replace function public.staff_consent(tok text, career boolean, open_work boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me shop_staff; pid uuid;
begin
  me := staff_auth(tok);
  pid := me.person_id;
  if pid is null then
    if coalesce(me.phone, '') = '' then raise exception 'Please ask the owner to add your phone number'; end if;
    insert into staff_people (name, phone) values (me.name, me.phone) on conflict (phone) do update set name = staff_people.name returning id into pid;
    update shop_staff set person_id = pid where id = me.id;
  end if;
  update staff_people set career_consent = coalesce(career, false), open_to_work = coalesce(career, false) and coalesce(open_work, false),
    consent_at = case when coalesce(career, false) then now() else null end where id = pid;
  return staff_me(tok);
end $$;

-- 사장님 · 카운터가 누른 출퇴근은 via = 'board'
create or replace function public.staff_attend(shop text, sid uuid, action text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare st shop_staff; d date := vn_today(); hrs jsonb; startm int;
begin
  perform owner_check(shop);
  select * into st from shop_staff where id = sid and shop_id = shop and active;
  if not found then raise exception 'Staff not found'; end if;
  if action = 'in' then
    hrs := staff_hours(st, d);
    startm := (hrs ->> 0)::int;
    insert into staff_attendance (staff_id, day, shop_id, in_at, late_min, in_via)
    values (sid, d, shop, now(), greatest(0, vn_min_now() - coalesce(startm, vn_min_now())), 'board')
    on conflict (staff_id, day) do update set in_at = coalesce(staff_attendance.in_at, excluded.in_at), out_at = null;
  elsif action = 'out' then
    if exists (select 1 from board_sessions where staff_id = sid and status = 'working') then raise exception 'Still in a session'; end if;
    update staff_attendance set out_at = now() where staff_id = sid and out_at is null and in_at is not null and day in (d, d - 1);
  else raise exception 'Unknown action';
  end if;
  return board_get(shop);
end $$;

-- 현황판: 휴대폰 출근(📱) · 직원 화면 사용 여부
create or replace function public.board_get(shop text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d date := vn_today(); l shop_layout; r text;
begin
  r := owner_check(shop);
  l := layout_ensure(shop);
  return jsonb_build_object(
    'today', d, 'now', now(), 'now_min', vn_min_now(), 'role', r,
    'shop', (select jsonb_build_object('id', s.id, 'name', s.data -> 'name') from shops s where s.id = shop),
    'shop_state', shop_state(shop),
    'layout', to_jsonb(l) - 'shop_id',
    'staff', coalesce((select jsonb_agg(jsonb_build_object(
        'id', st.id, 'name', st.name, 'role', st.role, 'years', st.years, 'look', st.look, 'def_code', st.def_code, 'off_day', st.off_day,
        'def_start', st.def_start, 'def_end', st.def_end,
        'code', staff_code(st, d), 'hours', staff_hours(st, d),
        'in_at', a.in_at, 'out_at', a.out_at, 'late_min', a.late_min, 'in_via', a.in_via, 'app', st.pin_hash is not null, 'has_phone', coalesce(st.phone, '') <> '',
        'stars', (select round(avg(v.stars)::numeric, 1) from staff_reviews v where v.staff_id = st.id and not v.hidden),
        'reviews', (select count(*) from staff_reviews v where v.staff_id = st.id and not v.hidden),
        'done_today', (select count(*) from board_sessions x where x.staff_id = st.id and x.day = d and x.status = 'done'),
        'rev_today', (select coalesce(sum(coalesce(x.paid, x.price)), 0) from board_sessions x where x.staff_id = st.id and x.day = d and x.status = 'done'))
        order by st.sort, st.created_at)
      from shop_staff st left join lateral (select * from staff_attendance a0 where a0.staff_id = st.id and (a0.day = d or (a0.day = d - 1 and a0.out_at is null)) order by a0.day desc limit 1) a on true
      where st.shop_id = shop and st.active), '[]'::jsonb),
    'guests', coalesce((select jsonb_agg(to_jsonb(g) order by g.created_at) from board_guests g
      where g.shop_id = shop and g.status in ('waiting', 'in_session') and (g.day = d or g.day >= d - 1)), '[]'::jsonb),
    'expected', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'code', b.code, 'name', b.customer_name, 'menu_name', b.menu_name,
        'min', b.menu_min, 'people', b.people, 'price', b.list_price, 'time', b.visit_time, 'status', b.status) order by b.visit_time)
      from bookings b where b.shop_id = shop and b.visit_date = d and b.status in ('shop_ok', 'confirmed')
        and not exists (select 1 from board_guests g where g.booking_id = b.id)), '[]'::jsonb),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'guest_id', x.guest_id, 'booking_id', x.booking_id, 'staff_id', x.staff_id,
        'staff_name', x.staff_name, 'station', x.station, 'course_name', x.course_name, 'minutes', x.minutes, 'price', x.price, 'paid', x.paid,
        'status', x.status, 'grp', coalesce(x.grp, x.id), 'started_at', x.started_at, 'ends_at', x.ends_at, 'done_at', x.done_at,
        'guest_name', (select g.name from board_guests g where g.id = x.guest_id), 'ud', x.booking_id is not null) order by x.started_at desc)
      from board_sessions x where x.shop_id = shop and ((x.day = d and x.status <> 'cancelled') or x.status = 'working')), '[]'::jsonb),
    'pending_req', (select count(*) from staff_requests q where q.shop_id = shop and q.status = 'pending'));
end $$;

revoke execute on function public.ud_hash(text), public.ud_rand(), public.ud_phone(text) from public, anon;
grant execute on function public.ud_hash(text), public.ud_rand(), public.ud_phone(text) to authenticated;
grant execute on function public.staff_login(text, text), public.staff_logout(text), public.staff_me(text, date), public.staff_clock(text, text),
  public.staff_request(text, jsonb), public.staff_request_cancel(text, bigint), public.staff_peer_answer(text, bigint, boolean),
  public.staff_pin_change(text, text, text), public.staff_consent(text, boolean, boolean) to anon, authenticated;
grant execute on function public.staff_pin_reset(text, uuid), public.staff_pin_off(text, uuid) to authenticated;
-- ============================================================
-- 34. 엉클데이 유니버스 5단계: 관리자 페이지 연동 (관리자만)
--  · 매장 현황: 현황판을 쓰는 매장들의 오늘 상태 (현황판은 읽기 전용으로 열어요)
--  · 직원 DB: 경력 프로필에 동의한 직원만 이름 · 경력 · 실적 · 후기를 봐요. 동의 안 한 직원은 숫자로만 세요.
--    '구직 중'은 관리자만 봐요 (사장님 화면에는 절대 안 나와요).
--  · 평판 · 후기 보너스: 보너스 금액 정하기, 확인 → 지급 처리, 후기 숨기기
-- universe9.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

create or replace function public.admin_universe_shops() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d date := vn_today();
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return coalesce((select jsonb_agg(x order by (x ->> 'working')::int desc, (x ->> 'in_now')::int desc, x ->> 'name') from (
    select jsonb_build_object('id', s.id, 'name', coalesce(s.data -> 'name' ->> 'ko', s.data -> 'name' ->> 'vi', s.id), 'area', s.data -> 'area',
      'state', shop_state(s.id),
      'staff', (select count(*) from shop_staff st where st.shop_id = s.id and st.active),
      'app', (select count(*) from shop_staff st where st.shop_id = s.id and st.active and st.pin_hash is not null),
      'in_now', (select count(*) from staff_attendance a join shop_staff st on st.id = a.staff_id and st.active
                 where a.shop_id = s.id and a.in_at is not null and a.out_at is null and a.day >= d - 1),
      'working', (select count(*) from board_sessions x where x.shop_id = s.id and x.status = 'working'),
      'waiting', (select count(*) from board_guests g where g.shop_id = s.id and g.status = 'waiting' and g.day >= d - 1),
      'done_today', (select count(distinct coalesce(x.grp, x.id)) from board_sessions x where x.shop_id = s.id and x.day = d and x.status = 'done'),
      'rev_today', (select coalesce(sum(coalesce(x.paid, x.price, 0)), 0) from board_sessions x where x.shop_id = s.id and x.day = d and x.status = 'done'),
      'pending_req', (select count(*) from staff_requests q where q.shop_id = s.id and q.status = 'pending'),
      'rv_30', (select count(*) from staff_reviews v where v.shop_id = s.id and v.created_at > now() - interval '30 days'),
      'rv_avg', (select round(avg(v.stars)::numeric, 1) from staff_reviews v where v.shop_id = s.id and not v.hidden),
      'last_used', (select max(x.started_at) from board_sessions x where x.shop_id = s.id)) x
    from shops s
    where exists (select 1 from shop_layout l where l.shop_id = s.id) or exists (select 1 from shop_staff st where st.shop_id = s.id)) q), '[]'::jsonb);
end $$;

-- 직원 DB (동의한 사람만 자세히)
create or replace function public.admin_staff_db() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return jsonb_build_object(
    'total', (select count(*) from shop_staff where active),
    'consented', (select count(*) from staff_people where career_consent),
    'open', (select count(*) from staff_people where career_consent and open_to_work),
    'people', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'phone', p.phone, 'open', p.open_to_work, 'consent_at', p.consent_at,
        'shops', (select jsonb_agg(jsonb_build_object('shop', coalesce(s.data -> 'name' ->> 'ko', s.id), 'shop_id', st.shop_id, 'role', st.role, 'years', st.years,
             'joined', st.joined_at, 'left', st.left_at, 'active', st.active) order by st.active desc, st.joined_at desc)
           from shop_staff st join shops s on s.id = st.shop_id where st.person_id = p.id),
        'years', (select max(st.years) from shop_staff st where st.person_id = p.id),
        'sessions', (select count(*) from board_sessions x join shop_staff st on st.id = x.staff_id where st.person_id = p.id and x.status = 'done'),
        'minutes', (select coalesce(sum(x.minutes), 0) from board_sessions x join shop_staff st on st.id = x.staff_id where st.person_id = p.id and x.status = 'done'),
        'reviews', (select count(*) from staff_reviews v join shop_staff st on st.id = v.staff_id where st.person_id = p.id and not v.hidden),
        'avg', (select round(avg(v.stars)::numeric, 1) from staff_reviews v join shop_staff st on st.id = v.staff_id where st.person_id = p.id and not v.hidden),
        'late_n', (select count(*) from staff_attendance a join shop_staff st on st.id = a.staff_id where st.person_id = p.id and a.late_min > 0),
        'days', (select count(*) from staff_attendance a join shop_staff st on st.id = a.staff_id where st.person_id = p.id and a.in_at is not null))
      order by p.open_to_work desc, p.name)
      from staff_people p where p.career_consent), '[]'::jsonb));
end $$;

-- 후기 · 보너스 목록
create or replace function public.admin_bonus_list(st text default 'pending') returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return jsonb_build_object(
    'bonus', coalesce((select (val #>> '{}')::bigint from universe_config where key = 'review_bonus'), 0),
    'counts', (select jsonb_object_agg(bonus_status, n) from (select bonus_status, count(*) n from staff_reviews group by bonus_status) c),
    'owed', coalesce((select jsonb_agg(o order by (o ->> 'amount')::bigint desc) from (
        select jsonb_build_object('staff_id', v.staff_id, 'name', coalesce(s2.name, v.staff_name), 'shop', coalesce(s.data -> 'name' ->> 'ko', v.shop_id),
          'n', count(*), 'amount', sum(v.bonus_amount), 'ids', jsonb_agg(v.id)) o
        from staff_reviews v left join shop_staff s2 on s2.id = v.staff_id left join shops s on s.id = v.shop_id
        where v.bonus_status = 'approved' group by v.staff_id, coalesce(s2.name, v.staff_name), coalesce(s.data -> 'name' ->> 'ko', v.shop_id)) oo), '[]'::jsonb),
    'rows', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'staff_id', v.staff_id, 'staff', coalesce(s2.name, v.staff_name), 'shop', coalesce(s.data -> 'name' ->> 'ko', v.shop_id),
        'stars', v.stars, 'body', v.body, 'customer', v.customer_label, 'created_at', v.created_at, 'hidden', v.hidden, 'verified', v.verified,
        'status', v.bonus_status, 'amount', v.bonus_amount, 'memo', v.bonus_memo, 'paid_at', v.bonus_paid_at,
        'code', b.code, 'visit_date', b.visit_date,
        'recorded', exists (select 1 from board_sessions x where x.booking_id = v.booking_id and x.staff_id = v.staff_id and x.src <> 'review'),
        'attended', exists (select 1 from staff_attendance a where a.staff_id = v.staff_id and a.day = b.visit_date and a.in_at is not null))
        order by v.created_at desc)
      from (select * from staff_reviews where st = 'all' or bonus_status = st order by created_at desc limit 300) v
      left join shop_staff s2 on s2.id = v.staff_id left join shops s on s.id = v.shop_id left join bookings b on b.id = v.booking_id), '[]'::jsonb));
end $$;

-- 보너스 처리: pending → approved / rejected, approved → paid
create or replace function public.admin_bonus_set(ids jsonb, st text, memo text default null) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if st not in ('approved', 'rejected', 'paid', 'pending') then raise exception 'Unknown status'; end if;
  update staff_reviews v set bonus_status = st, bonus_memo = coalesce(memo, v.bonus_memo),
    bonus_decided_at = case when st in ('approved', 'rejected') then now() else v.bonus_decided_at end,
    bonus_paid_at = case when st = 'paid' then now() else null end
  where v.id in (select (x)::uuid from jsonb_array_elements_text(ids) x)
    and ((st in ('approved', 'rejected') and v.bonus_status in ('pending', 'none', 'rejected', 'approved'))
      or (st = 'paid' and v.bonus_status = 'approved') or (st = 'pending' and v.bonus_status in ('approved', 'rejected')));
  get diagnostics n = row_count;
  return n;
end $$;

-- 보너스 금액 (아직 지급 전인 후기에도 새 금액을 적용해요)
create or replace function public.admin_bonus_amount(amount bigint) returns bigint
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if amount is null or amount < 0 or amount > 10000000 then raise exception 'Bad amount'; end if;
  insert into universe_config (key, val, updated_at) values ('review_bonus', to_jsonb(amount), now())
  on conflict (key) do update set val = excluded.val, updated_at = now();
  update staff_reviews set bonus_amount = amount where bonus_status in ('pending', 'approved') and verified;
  return amount;
end $$;

create or replace function public.admin_staff_review_hide(rid uuid, hide boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  update staff_reviews set hidden = hide, bonus_status = case when hide and bonus_status in ('pending', 'approved') then 'rejected' else bonus_status end where id = rid;
end $$;

grant execute on function public.admin_universe_shops(), public.admin_staff_db(), public.admin_bonus_list(text),
  public.admin_bonus_set(jsonb, text, text), public.admin_bonus_amount(bigint), public.admin_staff_review_hide(uuid, boolean) to authenticated;
-- ============================================================
-- 35. 엉클데이 관리자 '대신 수정' 기록
--  · 엉클데이 관리자가 사장님 대신 현황판 · 근무표 · 직원 · 매장 배치를 고치면 자동으로 기록돼요.
--  · 사장님 페이지 '오늘' 화면에 "엉클데이 관리자가 대신 수정했어요"로 보여요.
--  · 관리자도 그 매장의 사장님 · 카운터 계정이면(직접 쓰는 경우) 기록하지 않아요.
--  · 직원 PIN 은 관리자도 사장님과 같은 버튼(staff_pin_reset)으로 새로 만들 수 있어요. 이것도 기록돼요.
-- universe10.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

create table if not exists public.board_audit (
  id       bigserial primary key,
  shop_id  text not null,
  at       timestamptz not null default now(),
  actor    uuid,
  tbl      text not null,
  op       text not null,
  summary  text,
  data     jsonb
);
create index if not exists board_audit_shop_idx on public.board_audit (shop_id, at desc);
alter table public.board_audit enable row level security;
drop policy if exists "board_audit admin" on public.board_audit;
create policy "board_audit admin" on public.board_audit for all to authenticated using (is_admin()) with check (is_admin());

create or replace function public.board_audit_tg() returns trigger
language plpgsql security definer set search_path = public as $$
declare r jsonb := to_jsonb(coalesce(new, old)); o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end; sid text; sm text; nm text;
begin
  if auth.uid() is null or not is_admin() then return coalesce(new, old); end if;
  sid := r ->> 'shop_id';
  if sid is null or exists (select 1 from shop_members m where m.user_id = auth.uid() and m.shop_id = sid and m.active) then return coalesce(new, old); end if;
  nm := coalesce(r ->> 'staff_name', r ->> 'name', (select s.name from shop_staff s where s.id = nullif(r ->> 'staff_id', '')::uuid), '');
  sm := case tg_table_name
    when 'shop_layout' then '매장 설정 (층 · 방 · 코스 · 근무 시간 · 꾸미기)'
    when 'shop_staff' then case tg_op when 'INSERT' then '직원 추가: ' || nm
        when 'DELETE' then '직원 삭제: ' || nm
        else case when (o ->> 'pin_hash') is distinct from (r ->> 'pin_hash') then '직원 화면 PIN: ' || nm
                  when (o ->> 'active') = 'true' and (r ->> 'active') = 'false' then '직원 퇴사 처리: ' || nm
                  else '직원 정보 수정: ' || nm end end
    when 'staff_shifts' then '근무표: ' || nm || ' ' || (r ->> 'day') || ' → ' || case when tg_op = 'DELETE' then '평소대로' else coalesce(case r ->> 'code' when 'A' then '오픈조' when 'B' then '마감조' when 'F' then '종일' when 'O' then '휴무' when 'C' then '시간 지정' end, '') end
    when 'staff_requests' then '직원 요청 처리: ' || nm || ' ' || (r ->> 'day') || ' (' || coalesce(r ->> 'status', '') || ')'
    when 'board_guests' then '손님 접수 · 상태: ' || coalesce(r ->> 'name', '') || ' (' || coalesce(r ->> 'status', '') || ')'
    when 'board_sessions' then '시술: ' || nm || ' (' || coalesce(r ->> 'status', '') || ')'
    when 'staff_attendance' then '출퇴근: ' || nm
    when 'shop_days' then '영업 시작 · 마감'
    else tg_table_name end;
  -- 같은 사람이 1분 안에 같은 내용을 여러 번 바꾸면 한 줄로
  if exists (select 1 from board_audit a where a.shop_id = sid and a.actor = auth.uid() and a.summary = sm and a.at > now() - interval '1 minute') then return coalesce(new, old); end if;
  insert into board_audit (shop_id, actor, tbl, op, summary, data) values (sid, auth.uid(), tg_table_name, tg_op, sm, r - 'pin_hash' - 'pin_salt' - 'phone');
  return coalesce(new, old);
end $$;
revoke execute on function public.board_audit_tg() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['shop_layout', 'shop_staff', 'staff_shifts', 'staff_requests', 'board_guests', 'board_sessions', 'staff_attendance', 'shop_days'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.board_audit_tg()', t || '_audit', t);
  end loop;
end $$;

-- 사장님 · 카운터: 우리 매장을 엉클데이 관리자가 대신 고친 기록 (최근 30일)
create or replace function public.board_audit_list(shop text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform owner_check(shop);
  return coalesce((select jsonb_agg(jsonb_build_object('at', a.at, 'summary', a.summary) order by a.at desc)
    from (select * from board_audit where shop_id = shop and at > now() - interval '30 days' order by at desc limit 50) a), '[]'::jsonb);
end $$;

-- 관리자: 모든 매장의 대신 수정 기록
create or replace function public.admin_audit_list(lim int default 50) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('at', a.at, 'summary', a.summary, 'shop_id', a.shop_id,
      'shop', (select coalesce(s.data -> 'name' ->> 'ko', s.id) from shops s where s.id = a.shop_id),
      'who', (select u.email from auth.users u where u.id = a.actor)) order by a.at desc)
    from (select * from board_audit order by at desc limit least(greatest(coalesce(lim, 50), 1), 300)) a), '[]'::jsonb);
end $$;

grant execute on function public.board_audit_list(text), public.admin_audit_list(int) to authenticated;
-- ============================================================
-- 36. 낙서장 📓 노트 (칸반 말고 자유롭게 쓰는 문서)
--  · 관리자끼리 같이 보는 노트, 또는 '나만 보기' 노트
--  · 폴더 · 📌 고정 · 마지막으로 고친 사람/시간
-- universe11.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default '',
  body        text,
  folder      text,
  pinned      boolean not null default false,
  private     boolean not null default false,
  owner       text,
  created_by  text,
  updated_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists notes_updated_idx on public.notes (updated_at desc);
alter table public.notes enable row level security;
drop policy if exists notes_admin on public.notes;
create policy notes_admin on public.notes for all to authenticated
  using (public.is_admin() and (not private or lower(owner) = lower(coalesce(auth.jwt() ->> 'email', ''))))
  with check (public.is_admin() and (not private or lower(owner) = lower(coalesce(auth.jwt() ->> 'email', ''))));
grant select, insert, update, delete on public.notes to authenticated;

create or replace function public.notes_before() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now(); new.updated_by := actor_name();
  if tg_op = 'INSERT' then
    new.owner := lower(coalesce(auth.jwt() ->> 'email', '')); new.created_by := actor_name(); new.created_at := now();
  else
    new.owner := old.owner; new.created_by := old.created_by; new.created_at := old.created_at;
    -- 비공개 노트는 만든 사람만 공개/비공개를 바꿀 수 있어요
    if new.private is distinct from old.private and lower(coalesce(old.owner, '')) <> lower(coalesce(auth.jwt() ->> 'email', '')) then new.private := old.private; end if;
  end if;
  new.title := left(btrim(coalesce(new.title, '')), 200); new.folder := nullif(left(btrim(coalesce(new.folder, '')), 40), '');
  return new;
end $$;
drop trigger if exists notes_before on public.notes;
create trigger notes_before before insert or update on public.notes for each row execute function public.notes_before();
-- ============================================================
-- 37. 엉클데이 유니버스 게임: 화분 물 주기 · 수확 · 테라피스트 챙기기 · 펫 · 오늘의 퀘스트 · 매장 레벨
--  · 매장마다 코인 · 경험치(XP) · 레벨을 서버에 저장해요 (사장님 · 카운터 어느 기기에서 해도 같아요).
--  · 퀘스트는 베트남 날짜로 매일 새로 시작해요. 완료하면 '받기'로 코인 · XP 를 받아요.
-- universe12.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

create table if not exists public.shop_game (
  shop_id    text primary key references public.shops(id) on update cascade on delete cascade,
  coins      int not null default 50,
  xp         int not null default 0,
  day        date,
  prog       jsonb not null default '{}'::jsonb,   -- {water, care, pet, claimed:[]}
  plants     jsonb not null default '{}'::jsonb,   -- {아이템id: {g: 0~3, w: 마지막 물 준 시각}}
  cool       jsonb not null default '{}'::jsonb,   -- {praise:{직원id: 시각}, pet:{아이템id: 시각}}
  updated_at timestamptz not null default now()
);
alter table public.shop_game enable row level security;
drop policy if exists "shop_game admin" on public.shop_game;
create policy "shop_game admin" on public.shop_game for all to authenticated using (is_admin()) with check (is_admin());

-- 오늘 줄 · 매일 초기화 (내부용)
create or replace function public.game_row(shop text) returns shop_game
language plpgsql security definer set search_path = public as $$
declare g shop_game; d date := vn_today();
begin
  insert into shop_game (shop_id, day) values (shop, d) on conflict (shop_id) do nothing;
  select * into g from shop_game where shop_id = shop for update;
  if g.day is distinct from d then
    update shop_game set day = d, prog = '{}'::jsonb, updated_at = now() where shop_id = shop returning * into g;
  end if;
  return g;
end $$;
revoke execute on function public.game_row(text) from public, anon, authenticated;

-- 레벨: 필요한 누적 XP
create or replace function public.game_level(xp int) returns jsonb
language sql immutable as $$
  select jsonb_build_object('lv', lv, 'from', a[lv], 'to', case when lv < array_length(a, 1) then a[lv + 1] end)
  from (select array[0, 60, 160, 320, 540, 840, 1240, 1760, 2400, 3200] a) x,
       lateral (select max(i) lv from generate_subscripts(x.a, 1) i where x.a[i] <= greatest(0, xp)) y
$$;

-- 오늘의 퀘스트 진행 (내부용)
create or replace function public.game_quests(shop text, g shop_game) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d date := vn_today(); l shop_layout; nst int; done int; ud int; late int; ins int;
begin
  select * into l from shop_layout where shop_id = shop;
  nst := coalesce(array_length(layout_stations(l), 1), 3);
  select count(distinct coalesce(grp, id)), count(distinct coalesce(grp, id)) filter (where booking_id is not null) into done, ud
    from board_sessions where shop_id = shop and day = d and status = 'done';
  select count(*) filter (where late_min > 0), count(*) filter (where in_at is not null) into late, ins from staff_attendance where shop_id = shop and day = d;
  return jsonb_build_array(
    jsonb_build_object('id', 'done', 'n', greatest(5, least(30, nst * 2)), 'p', done, 'c', 20, 'x', 15),
    jsonb_build_object('id', 'water', 'n', 3, 'p', coalesce((g.prog ->> 'water')::int, 0), 'c', 10, 'x', 8),
    jsonb_build_object('id', 'care', 'n', 3, 'p', coalesce((g.prog ->> 'care')::int, 0), 'c', 10, 'x', 8),
    jsonb_build_object('id', 'ud', 'n', 2, 'p', ud, 'c', 15, 'x', 10),
    jsonb_build_object('id', 'ontime', 'n', 1, 'p', case when ins > 0 and late = 0 then 1 else 0 end, 'c', 10, 'x', 5, 'live', true)
  );
end $$;
revoke execute on function public.game_quests(text, shop_game) from public, anon, authenticated;

create or replace function public.game_out(shop text, g shop_game) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare q jsonb; cl jsonb := coalesce(g.prog -> 'claimed', '[]'::jsonb);
begin
  select coalesce(jsonb_agg(x || jsonb_build_object('claimed', cl ? (x ->> 'id'))), '[]'::jsonb) into q from jsonb_array_elements(game_quests(shop, g)) x;
  return jsonb_build_object('coins', g.coins, 'xp', g.xp, 'level', game_level(g.xp), 'day', g.day, 'prog', g.prog,
    'plants', g.plants, 'cool', g.cool, 'quests', q, 'now', now());
end $$;
revoke execute on function public.game_out(text, shop_game) from public, anon, authenticated;

create or replace function public.game_get(shop text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g shop_game;
begin
  perform owner_check(shop);
  g := game_row(shop);
  return game_out(shop, g);
end $$;

-- 놀이: water(화분) · harvest(화분) · snack(직원) · praise(직원) · pet(펫) · claim(퀘스트)
create or replace function public.game_act(shop text, act text, arg text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g shop_game; p jsonb; t timestamptz; gr int; q jsonb; its jsonb;
begin
  perform owner_check(shop);
  g := game_row(shop);
  select coalesce(l.items, '[]'::jsonb) into its from shop_layout l where l.shop_id = shop;
  if act in ('water', 'harvest') then
    if arg is null or not exists (select 1 from jsonb_array_elements(its) e where coalesce(e ->> 'id', '') = arg and e ->> 'k' in ('plant', 'palm', 'flower', 'bamboo')) then raise exception 'Plant not found'; end if;
    p := coalesce(g.plants -> arg, '{}'::jsonb); gr := coalesce((p ->> 'g')::int, 0); t := (p ->> 'w')::timestamptz;
    if act = 'water' then
      if gr >= 3 then raise exception 'Ready to harvest'; end if;
      if t is not null and t > now() - interval '2 hours' then raise exception 'Still moist'; end if;
      g.plants := jsonb_set(g.plants, array[arg], jsonb_build_object('g', gr + 1, 'w', now()));
      g.xp := g.xp + 3; g.prog := jsonb_set(g.prog, '{water}', to_jsonb(coalesce((g.prog ->> 'water')::int, 0) + 1));
    else
      if gr < 3 then raise exception 'Not ready yet'; end if;
      g.plants := jsonb_set(g.plants, array[arg], jsonb_build_object('g', 0, 'w', now()));
      g.coins := g.coins + 10; g.xp := g.xp + 8;
    end if;
  elsif act in ('snack', 'praise') then
    if arg is null or not exists (select 1 from shop_staff where id = arg::uuid and shop_id = shop and active) then raise exception 'Staff not found'; end if;
    if act = 'snack' then
      if g.coins < 5 then raise exception 'Not enough coins'; end if;
      g.coins := g.coins - 5; g.xp := g.xp + 2;
    else
      t := (g.cool #>> array['praise', arg])::timestamptz;
      if t is not null and t > now() - interval '1 hour' then raise exception 'Praise once an hour'; end if;
      g.cool := jsonb_set(case when g.cool ? 'praise' then g.cool else g.cool || '{"praise":{}}'::jsonb end, array['praise', arg], to_jsonb(now()));
      g.xp := g.xp + 1;
    end if;
    g.prog := jsonb_set(g.prog, '{care}', to_jsonb(coalesce((g.prog ->> 'care')::int, 0) + 1));
  elsif act = 'pet' then
    t := (g.cool #>> array['pet', coalesce(arg, '')])::timestamptz;
    if t is not null and t > now() - interval '30 minutes' then raise exception 'Pet is napping'; end if;
    g.cool := jsonb_set(case when g.cool ? 'pet' then g.cool else g.cool || '{"pet":{}}'::jsonb end, array['pet', coalesce(arg, '')], to_jsonb(now()));
    g.xp := g.xp + 2; g.prog := jsonb_set(g.prog, '{pet}', to_jsonb(coalesce((g.prog ->> 'pet')::int, 0) + 1));
  elsif act = 'claim' then
    select x into q from jsonb_array_elements(game_quests(shop, g)) x where x ->> 'id' = arg;
    if q is null then raise exception 'Quest not found'; end if;
    if coalesce(g.prog -> 'claimed', '[]'::jsonb) ? arg then raise exception 'Already claimed'; end if;
    if (q ->> 'p')::int < (q ->> 'n')::int then raise exception 'Quest not finished'; end if;
    g.coins := g.coins + (q ->> 'c')::int; g.xp := g.xp + (q ->> 'x')::int;
    g.prog := jsonb_set(g.prog, '{claimed}', coalesce(g.prog -> 'claimed', '[]'::jsonb) || to_jsonb(arg));
  else raise exception 'Unknown action';
  end if;
  update shop_game set coins = g.coins, xp = g.xp, prog = g.prog, plants = g.plants, cool = g.cool, updated_at = now() where shop_id = shop;
  return game_out(shop, g);
end $$;

grant execute on function public.game_get(text), public.game_act(text, text, text) to authenticated;
-- ============================================================
-- 38. 방문자 분석: '그 밖의 나라'를 자세히 (시간대 이름까지)
--  · 지금까지는 시간대를 한국 / 베트남·동남아 / 그 밖 세 칸으로만 셌어요.
--  · 이제 휴대폰·PC의 시간대 이름(예: Asia/Tokyo, America/Los_Angeles)도 숫자로만 함께 세요 (dim = zone).
--  · IP 주소나 개인 정보는 저장하지 않아요. 이 SQL 실행 전 기록은 '그 밖'으로만 남아 있어요.
-- universe13.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================
drop function if exists public.track_src(text, text, text, text);
create or replace function public.track_src(src text, dev text, lang text, tz text, zone text default null) returns void
language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Asia/Ho_Chi_Minh')::date; k text; v text;
begin
  foreach k in array array['src', 'dev', 'lang', 'tz', 'zone'] loop
    v := case k when 'src' then src when 'dev' then dev when 'lang' then lang when 'tz' then tz else zone end;
    if k = 'zone' then
      if zone is null then continue; end if;
      v := left(regexp_replace(coalesce(v, ''), '[^A-Za-z0-9_/+-]', '', 'g'), 48);
    else
      v := left(regexp_replace(lower(coalesce(v, '')), '[^a-z0-9_.:-]', '', 'g'), 40);
    end if;
    if v = '' then v := 'unknown'; end if;
    insert into stats_dim (day, dim, val, n) values (d, k, v, 1)
    on conflict (day, dim, val) do update set n = stats_dim.n + 1;
  end loop;
end $$;
revoke all on function public.track_src(text, text, text, text, text) from public;
grant execute on function public.track_src(text, text, text, text, text) to anon, authenticated;
-- ============================================================
-- 39. 예약 조회 보안: 예약번호 + 연락처를 여러 번 틀리면 잠시 막아요
--  · 같은 예약번호로 15분에 5번 틀리면, 또는 같은 접속(IP)에서 15분에 20번 틀리면 15분 동안 막혀요.
--  · 맞게 넣은 사람은 영향이 없어요. 틀린 기록은 하루 지나면 지워요. (IP 는 해시로만 저장)
-- universe14.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================
create table if not exists public.find_attempts (
  id  bigserial primary key,
  k   text not null,
  at  timestamptz not null default now()
);
create index if not exists find_attempts_k_idx on public.find_attempts (k, at desc);
alter table public.find_attempts enable row level security;
drop policy if exists "find_attempts admin" on public.find_attempts;
create policy "find_attempts admin" on public.find_attempts for select to authenticated using (is_admin());

create or replace function public.find_booking(c text, ct text) returns text
language plpgsql security definer set search_path = public as $$
declare tok text; kc text := 'c:' || upper(btrim(coalesce(c, ''))); ip text; ki text;
begin
  begin ip := split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1); exception when others then ip := ''; end;
  ki := 'i:' || encode(sha256(convert_to(coalesce(nullif(btrim(ip), ''), 'none'), 'UTF8')), 'hex');
  if (select count(*) from find_attempts where k = kc and at > now() - interval '15 minutes') >= 5
     or (ip <> '' and (select count(*) from find_attempts where k = ki and at > now() - interval '15 minutes') >= 20) then
    raise exception 'Too many tries';
  end if;
  select customer_token into tok from bookings
  where upper(trim(code)) = upper(trim(c))
    and regexp_replace(lower(contact), '[^0-9a-z@._]', '', 'g') = regexp_replace(lower(ct), '[^0-9a-z@._]', '', 'g')
  limit 1;
  if tok is null then
    insert into find_attempts (k) values (kc); if ip <> '' then insert into find_attempts (k) values (ki); end if;
    if random() < 0.05 then delete from find_attempts where at < now() - interval '1 day'; end if;
  end if;
  return tok;
end $$;
grant execute on function public.find_booking(text, text) to anon, authenticated;

-- ============================================================
-- 40. 엉클데이 유니버스: 단체 손님 (홍길동 외 2명 = 3명)
--  · 손님 한 팀을 접수하면 인원수만큼 한 명씩 따로 배정해요 (1번 · 2번 · 3번 손님).
--  · 사람마다 베드 하나 + 테라피스트 1~4명을 따로 골라요.
--  · 금액: 팀 전체 금액을 인원수로 나눠요 (나머지는 1번 손님에게).
--  · 모두 끝나야 팀이 '완료'가 되고, 엉클데이 예약이면 그때 합계 금액으로 방문 완료돼요.
--  · '안 받음'을 누르면 아직 배정 안 된 분만 빠지고, 이미 받은 분 기록은 그대로 남아요.
-- universe15.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

alter table public.board_sessions add column if not exists pno int not null default 1;

-- 이 팀에서 이미 배정된(진행 중 · 끝난) 사람 번호들 (내부용)
create or replace function public.guest_taken(gid uuid) returns int[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct pno order by pno), '{}') from board_sessions where guest_id = gid and status in ('working', 'done')
$$;
revoke execute on function public.guest_taken(uuid) from public, anon, authenticated;

-- 팀이 다 끝났으면 완료 처리 + 엉클데이 예약이면 합계로 방문 완료 (내부용)
create or replace function public.guest_close(gid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g board_guests; amt bigint;
begin
  select * into g from board_guests where id = gid for update;
  if not found or g.status not in ('waiting', 'in_session') then return; end if;
  if exists (select 1 from board_sessions where guest_id = gid and status = 'working') then return; end if;
  if coalesce(array_length(guest_taken(gid), 1), 0) < g.people then return; end if;
  update board_guests set status = 'done' where id = gid;
  if g.booking_id is not null and exists (select 1 from bookings where id = g.booking_id and status in ('shop_ok', 'confirmed', 'requested')) then
    select coalesce(sum(coalesce(paid, price, 0)), 0) into amt from board_sessions where guest_id = gid and status = 'done';
    perform owner_reply(g.booking_id, 'visited', amt, null, null);
  end if;
end $$;
revoke execute on function public.guest_close(uuid) from public, anon, authenticated;

-- 시술 시작: 팀에서 한 사람(pno) + 테라피스트 1~4명. pno 를 안 주면 다음 차례 사람
drop function if exists public.session_begin(text, uuid, jsonb, text);
create or replace function public.session_begin(shop text, gid uuid, tps jsonb, stn text, pno int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g board_guests; l shop_layout; m int; d date := vn_today(); n int; total bigint; per bigint; mine bigint; each bigint;
        g_id uuid; st shop_staff; k int := 0; nid uuid; sids uuid[]; taken int[]; p int := session_begin.pno;
begin
  perform owner_check(shop);
  select * into g from board_guests where id = gid and shop_id = shop for update;
  if not found or g.status <> 'waiting' then raise exception 'This guest is not waiting'; end if;
  taken := guest_taken(g.id);
  if p is null then
    select min(i) into p from generate_series(1, greatest(1, g.people)) i where not (i = any(taken));
    if p is null then raise exception 'Everyone is assigned'; end if;
  elsif p < 1 or p > greatest(1, g.people) then raise exception 'Unknown guest number';
  elsif p = any(taken) then raise exception 'This guest is already assigned';
  end if;
  if jsonb_typeof(tps) <> 'array' then raise exception 'Choose a therapist'; end if;
  select array_agg(v::uuid order by o) into sids from (select v, min(o) o from jsonb_array_elements_text(tps) with ordinality e(v, o) where v <> '' group by v) q;
  n := coalesce(array_length(sids, 1), 0);
  if n < 1 then raise exception 'Choose a therapist'; end if;
  if n > 4 then raise exception 'Up to 4 therapists'; end if;
  if (select count(*) from shop_staff where id = any(sids) and shop_id = shop and active and role = 'tp') <> n then raise exception 'Choose a therapist'; end if;
  if exists (select 1 from board_sessions where staff_id = any(sids) and status = 'working') then raise exception 'This therapist is busy'; end if;
  l := layout_ensure(shop);
  if not (stn = any(layout_stations(l))) then raise exception 'Unknown bed'; end if;
  if exists (select 1 from board_sessions x where x.shop_id = shop and x.station = stn and x.status = 'working') then raise exception 'This bed is in use'; end if;
  m := greatest(5, coalesce((g.course ->> 'min')::int, 60));
  -- 팀 전체 금액 → 한 사람 몫 (나머지는 1번 손님)
  total := case when g.source = 'ud' then coalesce((g.course ->> 'price')::bigint, 0) else coalesce((g.course ->> 'price')::bigint, 0) * greatest(1, g.people) end;
  per := total / greatest(1, g.people);
  mine := case when p = 1 then total - per * (greatest(1, g.people) - 1) else per end;
  each := mine / n;
  g_id := gen_random_uuid();
  for st in select * from shop_staff where id = any(sids) order by array_position(sids, id) loop
    nid := case when k = 0 then g_id else gen_random_uuid() end;
    insert into board_sessions (id, grp, pno, shop_id, day, guest_id, booking_id, staff_id, staff_name, station, course_name, minutes, price, ends_at, created_by)
    values (nid, g_id, p, shop, d, g.id, g.booking_id, st.id, st.name, stn, coalesce(g.course ->> 'ko', g.course ->> 'vi'), m,
            case when k = 0 then mine - each * (n - 1) else each end, now() + make_interval(mins => m), actor_name(shop));
    k := k + 1;
  end loop;
  if coalesce(array_length(guest_taken(g.id), 1), 0) >= g.people then
    update board_guests set status = 'in_session' where id = g.id;
  end if;
  return board_get(shop);
end $$;
grant execute on function public.session_begin(text, uuid, jsonb, text, int) to authenticated;

-- 시술 끝: 이 사람(같이 들어간 테라피스트 모두)만 끝. 팀이 다 끝나면 팀 완료
create or replace function public.session_finish(shop text, xid uuid, paid bigint default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare x board_sessions; gp uuid; n int; amt bigint; each bigint; r record; k int := 0;
begin
  perform owner_check(shop);
  select * into x from board_sessions where id = xid and shop_id = shop for update;
  if not found or x.status <> 'working' then raise exception 'Session not found'; end if;
  gp := coalesce(x.grp, x.id);
  select count(*), sum(price) into n, amt from board_sessions where coalesce(grp, id) = gp and shop_id = shop and status = 'working';
  amt := coalesce(session_finish.paid, amt);
  if amt < 0 then raise exception 'Please enter the amount'; end if;
  each := amt / n;
  for r in select id from board_sessions where coalesce(grp, id) = gp and shop_id = shop and status = 'working' order by (id = gp) desc, started_at, id loop
    update board_sessions set status = 'done', paid = case when k = 0 then amt - each * (n - 1) else each end, done_at = now() where id = r.id;
    k := k + 1;
  end loop;
  if x.guest_id is not null then
    perform guest_close(x.guest_id);
  elsif x.booking_id is not null and exists (select 1 from bookings where id = x.booking_id and status in ('shop_ok', 'confirmed', 'requested')) then
    perform owner_reply(x.booking_id, 'visited', amt, null, null);
  end if;
  return board_get(shop);
end $$;

-- 시술 취소: 이 사람만 다시 대기로
create or replace function public.session_cancel(shop text, xid uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare gp uuid; gid uuid;
begin
  perform owner_check(shop);
  select coalesce(grp, id), guest_id into gp, gid from board_sessions where id = xid and shop_id = shop and status = 'working';
  if gp is null then return board_get(shop); end if;
  update board_sessions set status = 'cancelled', done_at = now() where coalesce(grp, id) = gp and shop_id = shop and status = 'working';
  update board_guests set status = 'waiting' where id = gid and status = 'in_session';
  return board_get(shop);
end $$;

-- 안 받음: 아직 배정 안 된 분만 빼요. 이미 받은 분이 있으면 그분들 기록은 남기고 팀 인원을 줄여요
create or replace function public.guest_leave(shop text, gid uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g board_guests; nt int;
begin
  perform owner_check(shop);
  select * into g from board_guests where id = gid and shop_id = shop and status = 'waiting' for update;
  if not found then return board_get(shop); end if;
  nt := coalesce(array_length(guest_taken(gid), 1), 0);
  if nt = 0 then
    update board_guests set status = 'left' where id = gid;
  else
    update board_guests set people = nt, status = case when exists (select 1 from board_sessions where guest_id = gid and status = 'working') then 'in_session' else status end where id = gid;
    perform guest_close(gid);
  end if;
  return board_get(shop);
end $$;

-- 지난 기록: 같은 팀(단체 손님)은 한 줄로 묶어요
create or replace function public.board_rows(shop text, d1 date, d2 date, walk_only boolean default false) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(r order by r ->> 'day', r ->> 'started_at'), '[]'::jsonb) from (
    select jsonb_build_object(
      'grp', min(coalesce(x.grp, x.id)::text)::uuid, 'day', min(x.day), 'started_at', min(x.started_at), 'done_at', max(x.done_at),
      'guest', coalesce(max(g.name), max(b.customer_name)), 'people', coalesce(max(g.people), max(b.people)), 'course', max(x.course_name),
      'minutes', max(x.minutes), 'station', nullif(string_agg(distinct x.station, ', '), ''),
      'staff', string_agg(x.staff_name, ', ' order by x.pno, (x.id = coalesce(x.grp, x.id)) desc, x.staff_name),
      'staff_ids', jsonb_agg(x.staff_id order by x.pno, (x.id = coalesce(x.grp, x.id)) desc, x.staff_name), 'n', count(*),
      'paid', sum(coalesce(x.paid, x.price, 0)), 'ud', bool_or(x.booking_id is not null), 'booking_id', max(x.booking_id::text),
      'code', max(b.code), 'commission', max(b.commission), 'src', max(x.src)) r
    from board_sessions x
    left join board_guests g on g.id = x.guest_id
    left join bookings b on b.id = x.booking_id
    where x.shop_id = shop and x.status = 'done' and x.day between d1 and d2 and (not walk_only or x.booking_id is null)
    group by coalesce(x.guest_id, x.grp, x.id)
    union all
    select jsonb_build_object(
      'grp', null, 'day', b.visit_date,
      'started_at', ((b.visit_date + coalesce(nullif(b.visit_time, ''), '12:00')::time) at time zone 'Asia/Ho_Chi_Minh'),
      'done_at', ((b.visit_date + coalesce(nullif(b.visit_time, ''), '12:00')::time) at time zone 'Asia/Ho_Chi_Minh') + make_interval(mins => coalesce(b.menu_min, 60)),
      'guest', b.customer_name, 'people', b.people, 'course', b.menu_name, 'minutes', coalesce(b.menu_min, 60), 'station', null,
      'staff', null, 'staff_ids', '[]'::jsonb, 'n', 0, 'paid', coalesce(b.paid_amount, 0), 'ud', true, 'booking_id', b.id,
      'code', b.code, 'commission', b.commission, 'src', null, 'nostaff', true)
    from bookings b
    where not walk_only and b.shop_id = shop and b.status in ('visited', 'settled') and b.visit_date between d1 and d2
      and not exists (select 1 from board_sessions x where x.booking_id = b.id and x.status = 'done')) q
$$;
revoke execute on function public.board_rows(text, date, date, boolean) from public, anon, authenticated;

-- 현황판: 시술마다 몇 번 손님인지(pno), 대기 팀마다 이미 배정된 번호(taken)
create or replace function public.board_get(shop text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d date := vn_today(); l shop_layout; r text;
begin
  r := owner_check(shop);
  l := layout_ensure(shop);
  return jsonb_build_object(
    'today', d, 'now', now(), 'now_min', vn_min_now(), 'role', r,
    'shop', (select jsonb_build_object('id', s.id, 'name', s.data -> 'name') from shops s where s.id = shop),
    'shop_state', shop_state(shop),
    'layout', to_jsonb(l) - 'shop_id',
    'staff', coalesce((select jsonb_agg(jsonb_build_object(
        'id', st.id, 'name', st.name, 'role', st.role, 'years', st.years, 'look', st.look, 'def_code', st.def_code, 'off_day', st.off_day,
        'def_start', st.def_start, 'def_end', st.def_end,
        'code', staff_code(st, d), 'hours', staff_hours(st, d),
        'in_at', a.in_at, 'out_at', a.out_at, 'late_min', a.late_min, 'in_via', a.in_via, 'app', st.pin_hash is not null, 'has_phone', coalesce(st.phone, '') <> '',
        'stars', (select round(avg(v.stars)::numeric, 1) from staff_reviews v where v.staff_id = st.id and not v.hidden),
        'reviews', (select count(*) from staff_reviews v where v.staff_id = st.id and not v.hidden),
        'done_today', (select count(*) from board_sessions x where x.staff_id = st.id and x.day = d and x.status = 'done'),
        'rev_today', (select coalesce(sum(coalesce(x.paid, x.price)), 0) from board_sessions x where x.staff_id = st.id and x.day = d and x.status = 'done'))
        order by st.sort, st.created_at)
      from shop_staff st left join lateral (select * from staff_attendance a0 where a0.staff_id = st.id and (a0.day = d or (a0.day = d - 1 and a0.out_at is null)) order by a0.day desc limit 1) a on true
      where st.shop_id = shop and st.active), '[]'::jsonb),
    'guests', coalesce((select jsonb_agg(to_jsonb(g) || jsonb_build_object('taken', to_jsonb(guest_taken(g.id))) order by g.created_at) from board_guests g
      where g.shop_id = shop and g.status in ('waiting', 'in_session') and (g.day = d or g.day >= d - 1)), '[]'::jsonb),
    'expected', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'code', b.code, 'name', b.customer_name, 'menu_name', b.menu_name,
        'min', b.menu_min, 'people', b.people, 'price', b.list_price, 'time', b.visit_time, 'status', b.status) order by b.visit_time)
      from bookings b where b.shop_id = shop and b.visit_date = d and b.status in ('shop_ok', 'confirmed')
        and not exists (select 1 from board_guests g where g.booking_id = b.id)), '[]'::jsonb),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'guest_id', x.guest_id, 'booking_id', x.booking_id, 'staff_id', x.staff_id,
        'staff_name', x.staff_name, 'station', x.station, 'course_name', x.course_name, 'minutes', x.minutes, 'price', x.price, 'paid', x.paid,
        'status', x.status, 'grp', coalesce(x.grp, x.id), 'pno', x.pno, 'started_at', x.started_at, 'ends_at', x.ends_at, 'done_at', x.done_at,
        'guest_name', (select g.name from board_guests g where g.id = x.guest_id),
        'people', (select g.people from board_guests g where g.id = x.guest_id), 'ud', x.booking_id is not null) order by x.started_at desc)
      from board_sessions x where x.shop_id = shop and ((x.day = d and x.status <> 'cancelled') or x.status = 'working')), '[]'::jsonb),
    'pending_req', (select count(*) from staff_requests q where q.shop_id = shop and q.status = 'pending'));
end $$;

-- ============================================================
-- 41. 🎨 브랜드 자료실 (CI) — 사내에서 쓰는 로고 · 명함 · 사진 · 홍보물 · 폰트 보관함
--  · 관리자만 볼 수 있는 비공개 저장소예요 (밖에서 주소만 알아도 못 열어요).
--  · 열기 · 내려받기는 그때그때 만든 임시 링크로 돼요. 한 파일 50MB까지.
-- universe16.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand', 'brand', false, 52428800, array[
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'image/heic', 'image/vnd.adobe.photoshop',
  'application/pdf', 'application/postscript', 'application/illustrator', 'application/zip',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/x-hwp', 'application/vnd.hancom.hwpx',
  'font/ttf', 'font/otf', 'font/woff', 'font/woff2', 'video/mp4', 'application/octet-stream'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "uncleday brand admin" on storage.objects;
create policy "uncleday brand admin" on storage.objects for all to authenticated
  using (bucket_id = 'brand' and public.is_admin()) with check (bucket_id = 'brand' and public.is_admin());

create table if not exists public.brand_assets (
  id          uuid primary key default gen_random_uuid(),
  path        text not null unique,
  name        text not null,
  cat         text not null default 'etc' check (cat in ('logo', 'card', 'photo', 'promo', 'doc', 'font', 'etc')),
  note        text,
  size        bigint not null default 0,
  mime        text,
  w           int,
  h           int,
  pinned      boolean not null default false,
  uploaded_by text,
  created_at  timestamptz not null default now()
);
create index if not exists brand_assets_cat_idx on public.brand_assets (cat, created_at desc);
alter table public.brand_assets enable row level security;
drop policy if exists brand_assets_admin on public.brand_assets;
create policy brand_assets_admin on public.brand_assets for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.brand_assets to authenticated;

create or replace function public.brand_assets_before() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then new.uploaded_by := lower(coalesce(auth.jwt() ->> 'email', '')); new.created_at := now();
  else new.uploaded_by := old.uploaded_by; new.created_at := old.created_at; new.path := old.path; end if;
  new.name := left(btrim(coalesce(new.name, '')), 200); new.note := nullif(left(btrim(coalesce(new.note, '')), 500), '');
  return new;
end $$;
drop trigger if exists brand_assets_before on public.brand_assets;
create trigger brand_assets_before before insert or update on public.brand_assets for each row execute function public.brand_assets_before();

-- ============================================================
-- 42. 🔎 검색 유입 · 리드
--  · 자동으로 만든 페이지(도시 · 가이드 · 주제 · 미입점 업체 · 업체)에 누가 어디서(구글 · 네이버 · ChatGPT …) 들어왔는지 날짜별 숫자로만 세요.
--    IP · 개인 정보는 저장하지 않아요.
--  · 미입점 업체 페이지의 '예약 문의' · '사장님 입점 신청'을 리드로 받아 관리자 포털에서 처리해요.
--    같은 접속(IP)에서 1시간에 5건까지만 받아요 (IP 는 해시로만 잠깐 저장).
-- universe17.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

create table if not exists public.seo_hits (
  day  date not null,
  path text not null,
  src  text not null,
  kind text not null,
  n    int  not null default 0,
  primary key (day, path, src, kind)
);
alter table public.seo_hits enable row level security;
drop policy if exists "seo_hits admin" on public.seo_hits;
create policy "seo_hits admin" on public.seo_hits for select to authenticated using (is_admin());

create or replace function public.seo_hit(path text, src text, kind text) returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare d date := (now() at time zone 'Asia/Ho_Chi_Minh')::date; p text; s text; k text;
begin
  p := lower(left(coalesce(seo_hit.path, ''), 160));
  if p !~ '^/(c|en|p|s)/[a-z0-9/_-]*$' then return; end if;
  s := left(regexp_replace(lower(coalesce(seo_hit.src, '')), '[^a-z0-9_.-]', '', 'g'), 24); if s = '' then s := 'direct'; end if;
  k := lower(coalesce(seo_hit.kind, ''));
  if k not in ('view', 'book', 'shop', 'guide', 'lead_guest', 'lead_owner', 'kakao', 'map') then return; end if;
  insert into seo_hits (day, path, src, kind, n) values (d, p, s, k, 1)
  on conflict (day, path, src, kind) do update set n = seo_hits.n + 1;
end $$;
revoke all on function public.seo_hit(text, text, text) from public;
grant execute on function public.seo_hit(text, text, text) to anon, authenticated;

create table if not exists public.seo_leads (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind       text not null check (kind in ('guest', 'owner')),
  path       text,
  ref        text,            -- 미입점 업체 id (예: osm:n123) 또는 업체 id
  shop_name  text,
  city       text,
  name       text,
  contact    text,            -- 카톡 ID · 전화 · 잘로 (엉클데이만 봐요)
  msg        text,
  visit_date text,
  people     int,
  lang       text,
  src        text,
  status     text not null default 'new' check (status in ('new', 'contacted', 'won', 'lost')),
  note       text,
  updated_by text
);
create index if not exists seo_leads_at_idx on public.seo_leads (created_at desc);
alter table public.seo_leads enable row level security;
drop policy if exists "seo_leads admin" on public.seo_leads;
create policy "seo_leads admin" on public.seo_leads for all to authenticated using (is_admin()) with check (is_admin());
grant select, update, delete on public.seo_leads to authenticated;

create or replace function public.seo_lead(p jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare ip text; ki text; k text := lower(coalesce(p ->> 'kind', '')); c text := btrim(coalesce(p ->> 'contact', ''));
begin
  if k not in ('guest', 'owner') then raise exception 'Bad request'; end if;
  if length(c) < 3 then raise exception 'Please enter your contact'; end if;
  begin ip := split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1); exception when others then ip := ''; end;
  ki := 'lead:' || encode(sha256(convert_to(coalesce(nullif(btrim(ip), ''), 'none'), 'UTF8')), 'hex');
  if (select count(*) from find_attempts where find_attempts.k = ki and at > now() - interval '1 hour') >= 5 then raise exception 'Too many tries'; end if;
  insert into find_attempts (k) values (ki);
  insert into seo_leads (kind, path, ref, shop_name, city, name, contact, msg, visit_date, people, lang, src)
  values (k, left(p ->> 'path', 160), left(p ->> 'ref', 80), left(p ->> 'shop_name', 120), left(p ->> 'city', 20), left(btrim(coalesce(p ->> 'name', '')), 60),
          left(c, 120), left(p ->> 'msg', 1000), left(p ->> 'visit_date', 40), least(20, greatest(0, coalesce((p ->> 'people')::int, 0))), left(p ->> 'lang', 5), left(p ->> 'src', 24));
  begin perform seo_hit(p ->> 'path', p ->> 'src', 'lead_' || k); exception when others then null; end;
  return 'ok';
end $$;
revoke all on function public.seo_lead(jsonb) from public;
grant execute on function public.seo_lead(jsonb) to anon, authenticated;

-- 관리자: 기간 안의 페이지별 숫자
create or replace function public.seo_report(d1 date, d2 date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return jsonb_build_object(
    'by_src', coalesce((select jsonb_object_agg(src, n) from (select src, sum(n) n from seo_hits where day between d1 and d2 and kind = 'view' group by src) x), '{}'::jsonb),
    'by_day', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'n', n) order by day) from (select day, sum(n) n from seo_hits where day between d1 and d2 and kind = 'view' group by day) x), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(x order by (x ->> 'views')::int desc) from (
        select jsonb_build_object('path', path, 'views', sum(n) filter (where kind = 'view'),
          'search', sum(n) filter (where kind = 'view' and src in ('google', 'naver', 'bing', 'daum', 'chatgpt', 'perplexity', 'claude', 'gemini')),
          'ai', sum(n) filter (where kind = 'view' and src in ('chatgpt', 'perplexity', 'claude', 'gemini')),
          'cta', sum(n) filter (where kind not in ('view', 'lead_guest', 'lead_owner')),
          'leads', sum(n) filter (where kind in ('lead_guest', 'lead_owner'))) x
        from seo_hits where day between d1 and d2 group by path) y(x)), '[]'::jsonb));
end $$;
grant execute on function public.seo_report(date, date) to authenticated;

create or replace function public.seo_leads_before() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_by := actor_name(); return new;
end $$;
drop trigger if exists seo_leads_before on public.seo_leads;
create trigger seo_leads_before before update on public.seo_leads for each row execute function public.seo_leads_before();

-- ============================================================
-- 43. 📨 검색 문의 알림 + 📈 사장님 리포트
--  · 미입점 가게 페이지에서 손님 예약 문의 · 사장님 입점 신청이 들어오면 슬랙으로 바로 알려요 (알림 종류 'seo').
--    연락처는 슬랙에 보내지 않아요. 관리자 포털에서만 봐요.
--  · 사장님 페이지 '오늘' 화면에 "엉클데이에서 내 가게" 최근 30일 숫자를 보여 줘요.
--    (가게 조회 · 검색으로 들어온 수 · 상담 버튼 · 예약) — 개인 정보 없이 숫자만
-- universe18.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

update public.slack_cfg set events = array_append(events, 'seo') where id = 1 and not ('seo' = any(events));
alter table public.slack_cfg alter column events set default array['booking','shop','customer','review','team','lead','chat','seo'];

create or replace function public.slack_seo_lead() returns trigger
language plpgsql security definer set search_path = public as $$
declare cnm text; s text;
begin
  cnm := case new.city when 'danang' then '다낭' when 'nhatrang' then '나트랑' when 'hcm' then '호찌민' when 'hanoi' then '하노이' else new.city end;
  s := case new.src when 'google' then '구글' when 'naver' then '네이버' when 'chatgpt' then 'ChatGPT' when 'perplexity' then 'Perplexity' when 'gemini' then 'Gemini'
       when 'claude' then 'Claude' when 'kakao' then '카카오톡' when 'direct' then '직접' when 'internal' then '사이트 안' else new.src end;
  perform slack_send('seo',
    case new.kind when 'owner' then '🏪 사장님 입점 신청' else '💬 미입점 가게 예약 문의' end
    || ' · *' || coalesce(nullif(new.shop_name, ''), '가게 미상') || '*' || coalesce(' (' || cnm || ')', '')
    || case when new.kind = 'guest' then coalesce(E'\n📅 ' || nullif(new.visit_date, ''), '') || case when new.people > 0 then ' · ' || new.people || '명' else '' end else '' end
    || coalesce(' · ' || s || '에서 들어옴', '')
    || coalesce(E'\n> ' || left(replace(nullif(new.msg, ''), E'\n', ' '), 200), '')
    || E'\n<https://www.uncleday.com/admin.html|포털에서 연락처 보고 처리하기>');
  return new;
end $$;
drop trigger if exists slack_seo_lead on public.seo_leads;
create trigger slack_seo_lead after insert on public.seo_leads for each row execute function public.slack_seo_lead();

-- 사장님 리포트: 최근 30일 + 그 전 30일 (비교용)
create or replace function public.owner_report(shop text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d date := (now() at time zone 'Asia/Ho_Chi_Minh')::date; p text := '/s/' || lower(shop) || '/';
  f constant text[] := array['google', 'naver', 'bing', 'daum', 'chatgpt', 'perplexity', 'claude', 'gemini'];
begin
  perform owner_check(shop);
  return (select jsonb_object_agg(k, v) from (
    select k || r.sfx k, v from (values ('', d - 29, d), ('_prev', d - 59, d - 30)) r(sfx, a, b),
    lateral (values
      ('views',   (select coalesce(sum(n), 0) from stats_daily where shop_id = shop and kind = 'view' and day between r.a and r.b)),
      ('consult', (select coalesce(sum(n), 0) from stats_daily where shop_id = shop and kind = 'consult' and day between r.a and r.b)),
      ('map',     (select coalesce(sum(n), 0) from stats_daily where shop_id = shop and kind = 'map' and day between r.a and r.b)),
      ('search',  (select coalesce(sum(n), 0) from seo_hits where path = p and kind = 'view' and src = any(f) and day between r.a and r.b)),
      ('bookings',(select count(*) from bookings where shop_id = shop and (created_at at time zone 'Asia/Ho_Chi_Minh')::date between r.a and r.b))
    ) x(k, v)) y);
end $$;
revoke all on function public.owner_report(text) from public, anon;
grant execute on function public.owner_report(text) to authenticated;

-- ============================================================
-- 44. 🗺️ 미입점 가게: 조회수 공개 · 숨기기
--  · 사장님용 베트남어 페이지(p/…/vi/)에 "최근 30일 조회수"를 보여 줘요.
--    미입점 가게(/p/…) 페이지 숫자만, 조회수 하나만 돌려줘요. 개인 정보 없음.
--  · 사장님이 원하지 않거나 정보가 틀린 가게는 관리자 포털에서 숨겨요.
--    숨긴 가게는 다음 자동 갱신(최대 3시간) 때 페이지 · 목록 · 사이트맵에서 빠져요.
-- universe19.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

create or replace function public.seo_page_views(path text) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(n), 0)::int from seo_hits
  where seo_hits.path = lower(seo_page_views.path) and seo_hits.path ~ '^/p/[a-z]+/[a-z0-9-]+/$' and kind = 'view'
    and day >= (now() at time zone 'Asia/Ho_Chi_Minh')::date - 29 $$;
revoke all on function public.seo_page_views(text) from public;
grant execute on function public.seo_page_views(text) to anon, authenticated;

create table if not exists public.osm_hidden (
  ref        text primary key,          -- 오픈스트리트맵 id (예: n12345, w678)
  name       text,
  reason     text,
  created_at timestamptz not null default now(),
  created_by text
);
alter table public.osm_hidden enable row level security;
drop policy if exists "osm_hidden admin" on public.osm_hidden;
create policy "osm_hidden admin" on public.osm_hidden for all to authenticated using (is_admin()) with check (is_admin());
grant select, insert, update, delete on public.osm_hidden to authenticated;

create or replace function public.osm_hidden_before() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.ref := lower(btrim(new.ref));
  if new.ref !~ '^[nwr][0-9]+$' then raise exception 'Bad id'; end if;
  new.created_by := actor_name(); return new;
end $$;
drop trigger if exists osm_hidden_before on public.osm_hidden;
create trigger osm_hidden_before before insert or update on public.osm_hidden for each row execute function public.osm_hidden_before();

-- 자동 갱신(깃허브)이 읽어 가는 숨김 목록: id 만
create or replace function public.osm_hidden_ids() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(ref order by ref), '{}') from osm_hidden $$;
revoke all on function public.osm_hidden_ids() from public;
grant execute on function public.osm_hidden_ids() to anon, authenticated;

-- ============================================================
-- 45. 🔗 링크로 가게 가져오기 (크롤링)
--  · 관리자가 포털에 링크(가게 홈페이지 · 가격표 · 블로그 등)를 넣으면
--    깃허브 자동 작업이 1시간 안에 그 페이지에서 사실 정보(이름 · 주소 · 영업시간 · 메뉴 가격)만 뽑아 와요.
--  · 관리자가 확인 · 수정하고 [게시]하면 다음 자동 갱신 때 미입점 가게 페이지처럼 사이트에 나와요.
--  · 깃허브는 '수집 열쇠'(토큰)로만 이 표에 접근해요. 열쇠는 포털에서 만들고(한 번만 보여요) 깃허브 Secrets 에 직접 넣어요.
-- universe20.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

create table if not exists public.crawl_jobs (
  id           bigserial primary key,
  url          text not null,
  city         text,
  kind         text,                         -- 마사지 · 스파 · 네일 · 뷰티 …
  status       text not null default 'pending' check (status in ('pending', 'done', 'error', 'published', 'rejected')),
  result       jsonb,                        -- 자동으로 뽑은 그대로
  data         jsonb,                        -- 관리자가 확인 · 고친 최종 내용 (게시용)
  err          text,
  created_by   text,
  updated_by   text,
  created_at   timestamptz not null default now(),
  crawled_at   timestamptz,
  published_at timestamptz
);
create index if not exists crawl_jobs_status_idx on public.crawl_jobs (status, created_at);
alter table public.crawl_jobs enable row level security;
drop policy if exists "crawl_jobs admin" on public.crawl_jobs;
create policy "crawl_jobs admin" on public.crawl_jobs for all to authenticated using (is_admin()) with check (is_admin());
grant select, insert, update, delete on public.crawl_jobs to authenticated;
grant usage, select on sequence public.crawl_jobs_id_seq to authenticated;

create or replace function public.crawl_jobs_before() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.url := btrim(new.url);
    if new.url !~* '^https?://[^ ]+$' then raise exception '링크는 http:// 또는 https:// 로 시작해야 해요'; end if;
    new.created_by := actor_name();
  end if;
  new.updated_by := actor_name();
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then new.published_at := now(); end if;
  return new;
end $$;
drop trigger if exists crawl_jobs_before on public.crawl_jobs;
create trigger crawl_jobs_before before insert or update on public.crawl_jobs for each row execute function public.crawl_jobs_before();

-- 수집 열쇠 (해시만 저장)
create table if not exists public.crawl_cfg (id int primary key default 1 check (id = 1), token_hash text, made_at timestamptz, made_by text);
alter table public.crawl_cfg enable row level security;
drop policy if exists "crawl_cfg admin" on public.crawl_cfg;
create policy "crawl_cfg admin" on public.crawl_cfg for select to authenticated using (is_admin());

create or replace function public.crawl_new_token() returns text
language plpgsql security definer set search_path = public as $$
declare t text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  insert into crawl_cfg (id, token_hash, made_at, made_by) values (1, encode(sha256(convert_to(t, 'UTF8')), 'hex'), now(), actor_name())
  on conflict (id) do update set token_hash = excluded.token_hash, made_at = now(), made_by = excluded.made_by;
  return t;
end $$;
revoke all on function public.crawl_new_token() from public, anon;
grant execute on function public.crawl_new_token() to authenticated;

create or replace function public.crawl_tok_ok(tok text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select token_hash = encode(sha256(convert_to(coalesce(tok, ''), 'UTF8')), 'hex') from crawl_cfg where id = 1 and token_hash is not null), false) $$;
revoke all on function public.crawl_tok_ok(text) from public, anon, authenticated;

-- 깃허브: 가져올 링크 목록
create or replace function public.crawl_pending(tok text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not crawl_tok_ok(tok) then raise exception 'Bad token'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'url', url, 'city', city, 'kind', kind) order by created_at)
                   from (select * from crawl_jobs where status = 'pending' order by created_at limit 20) x), '[]'::jsonb);
end $$;
revoke all on function public.crawl_pending(text) from public;
grant execute on function public.crawl_pending(text) to anon, authenticated;

-- 깃허브: 결과 저장
create or replace function public.crawl_result(tok text, job bigint, res jsonb, error text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not crawl_tok_ok(tok) then raise exception 'Bad token'; end if;
  update crawl_jobs set status = case when error is null or error = '' then 'done' else 'error' end,
    result = res, data = coalesce(data, res), err = nullif(left(error, 500), ''), crawled_at = now()
  where id = crawl_result.job and status = 'pending';
end $$;
revoke all on function public.crawl_result(text, bigint, jsonb, text) from public;
grant execute on function public.crawl_result(text, bigint, jsonb, text) to anon, authenticated;

-- 사이트 만들기: 게시된 것만 (어차피 공개 페이지가 될 내용)
create or replace function public.crawl_published() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'url', url, 'city', city, 'kind', kind, 'data', data, 'checked', to_char(coalesce(crawled_at, published_at), 'YYYY-MM-DD')) order by id), '[]'::jsonb)
  from crawl_jobs where status = 'published' and data is not null $$;
revoke all on function public.crawl_published() from public;
grant execute on function public.crawl_published() to anon, authenticated;

-- ============================================================
-- 46. 🔍 경쟁사 분석
--  · 포털에 경쟁 사이트 주소를 넣으면 깃허브 자동 작업이 그 사이트의 글 목록(사이트맵) · 글 제목 · 소제목만 읽어서
--    ① 어떤 검색어를 노리는지 ② 엉클데이에 그 검색어 페이지가 있는지 ③ 글에 나온 가게가 엉클데이에 있는지 알려 줘요.
--  · 글 내용은 저장하지 않아요 (제목 · 소제목 · 주소만). robots.txt 를 지켜요.
--  · universe21 의 crawl_jobs 를 같이 써요 (job = 'site').
-- universe21.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

alter table public.crawl_jobs add column if not exists job text not null default 'shop';
do $$ begin
  alter table public.crawl_jobs add constraint crawl_jobs_job_chk check (job in ('shop', 'site'));
exception when duplicate_object then null; end $$;

create or replace function public.crawl_pending(tok text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not crawl_tok_ok(tok) then raise exception 'Bad token'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'url', url, 'city', city, 'kind', kind, 'job', job) order by created_at)
                   from (select * from crawl_jobs where status = 'pending' order by created_at limit 20) x), '[]'::jsonb);
end $$;

create or replace function public.crawl_published() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'url', url, 'city', city, 'kind', kind, 'data', data, 'checked', to_char(coalesce(crawled_at, published_at), 'YYYY-MM-DD')) order by id), '[]'::jsonb)
  from crawl_jobs where status = 'published' and data is not null and job = 'shop' $$;

-- 결과 저장: 새 job 열과 이름이 겹치지 않게 다시 만들어요
create or replace function public.crawl_result(tok text, job bigint, res jsonb, error text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not crawl_tok_ok(tok) then raise exception 'Bad token'; end if;
  update crawl_jobs set status = case when error is null or error = '' then 'done' else 'error' end,
    result = res, data = coalesce(data, res), err = nullif(left(error, 500), ''), crawled_at = now()
  where id = crawl_result.job and status = 'pending';
end $$;
revoke all on function public.crawl_result(text, bigint, jsonb, text) from public;
grant execute on function public.crawl_result(text, bigint, jsonb, text) to anon, authenticated;


-- ============================================================
-- 47. 📝 블로그 (우리 데이터로 만드는 글)
--  · 관리자가 검색어(예: 한시장 근처 마사지 추천)로 글을 만들면, 글의 '조건'(도시 · 장소 · 주제 · 시술)만 저장해요.
--  · 내용(업체 목록 · 거리 · 실제 가격 · 영업시간 · FAQ)은 매시간 자동 갱신 때 최신 업체 데이터로 다시 그려요.
--    그래서 가격이 바뀌어도 글이 저절로 최신이 돼요.
--  · 조건에 맞는 업체가 2곳보다 적으면 페이지를 만들지 않아요 (빈 글 = 구글 스팸 판정 위험).
-- universe22.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

create table if not exists public.blog_posts (
  id           bigserial primary key,
  slug         text unique,
  kw           text not null,               -- 노리는 검색어
  title        text,
  city         text,
  landmark     text,                        -- tools/landmarks.py 의 id
  topic        text,                        -- tools/topics.py 의 id
  treat        text,                        -- tools/treatments.py 의 id
  grp          text,                        -- spabody · beauty · clinic (비우면 마사지 · 스파)
  intro        text,                        -- 관리자가 쓴 첫 문단 (비우면 자동 문장)
  status       text not null default 'draft' check (status in ('draft', 'published')),
  from_url     text,                        -- 어느 경쟁사 글에서 주제를 얻었는지 (참고용, 페이지에는 안 나와요)
  created_by   text,
  updated_by   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  published_at timestamptz
);
alter table public.blog_posts enable row level security;
drop policy if exists "blog_posts admin" on public.blog_posts;
create policy "blog_posts admin" on public.blog_posts for all to authenticated using (is_admin()) with check (is_admin());
grant select, insert, update, delete on public.blog_posts to authenticated;
grant usage, select on sequence public.blog_posts_id_seq to authenticated;

create or replace function public.blog_posts_before() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.kw := btrim(new.kw);
  if length(new.kw) < 2 then raise exception '검색어를 적어 주세요'; end if;
  new.slug := nullif(btrim(lower(new.slug)), '');
  if new.slug is not null and new.slug !~ '^[a-z0-9-]{2,80}$' then raise exception '주소는 영어 소문자 · 숫자 · - 만 써요'; end if;
  if tg_op = 'INSERT' then new.created_by := actor_name(); end if;
  new.updated_by := actor_name(); new.updated_at := now();
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then new.published_at := now(); end if;
  return new;
end $$;
drop trigger if exists blog_posts_before on public.blog_posts;
create trigger blog_posts_before before insert or update on public.blog_posts for each row execute function public.blog_posts_before();

-- 사이트 만들기: 게시된 글의 조건만 (공개 페이지가 될 내용)
create or replace function public.blog_published() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'slug', slug, 'kw', kw, 'title', title, 'city', city, 'landmark', landmark, 'topic', topic, 'treat', treat, 'grp', grp, 'intro', intro,
    'published', to_char(published_at, 'YYYY-MM-DD'), 'updated', to_char(updated_at, 'YYYY-MM-DD')) order by id), '[]'::jsonb)
  from blog_posts where status = 'published' $$;
revoke all on function public.blog_published() from public;
grant execute on function public.blog_published() to anon, authenticated;

-- ============================================================
-- 48. 🔎 엉클데이 서치 콘솔 — 페이지별 구글 색인 상태
--  · Edge Function gsc 가 구글 'URL 검사'로 사이트맵의 페이지를 매시간 70개씩 확인해서 여기에 적어요 (하루 구글 한도 2,000건 안).
--  · 관리자 포털 '🔎 엉클데이 서치 콘솔'에서 색인됨 / 안 됨 / 확인 전을 페이지 종류별로 봐요.
--  · 쓰기는 gsc 기능(서비스 키)만 해요. 관리자는 읽기만.
-- universe23.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

create table if not exists public.seo_index (
  url         text primary key,
  kind        text,                 -- 업체 · 도시 · 주제 · 가격 · 가이드 · 미입점 · 블로그 · 영어 …
  verdict     text,                 -- PASS · NEUTRAL · FAIL (구글 판정)
  coverage    text,                 -- 예: Submitted and indexed / Discovered - currently not indexed
  indexing    text,
  fetch_state text,
  robots      text,
  canonical   text,
  last_crawl  timestamptz,
  checked_at  timestamptz,
  in_sitemap  boolean not null default true,
  err         text
);
create index if not exists seo_index_checked_idx on public.seo_index (checked_at nulls first);
alter table public.seo_index enable row level security;
drop policy if exists "seo_index admin read" on public.seo_index;
create policy "seo_index admin read" on public.seo_index for select to authenticated using (is_admin());
grant select on public.seo_index to authenticated;

-- gsc 기능이 수집 열쇠(깃허브 CRAWL_TOKEN)로 불렸는지 확인할 때 써요 (서비스 키로만 호출)
create or replace function public.crawl_tok_check(tok text) returns boolean
language sql stable security definer set search_path = public as $$ select crawl_tok_ok(tok) $$;
revoke all on function public.crawl_tok_check(text) from public, anon, authenticated;
grant execute on function public.crawl_tok_check(text) to service_role;

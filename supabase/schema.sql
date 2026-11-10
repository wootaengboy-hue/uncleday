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
  if new.user_id is null and auth.uid() is not null and not is_admin() then new.user_id := auth.uid(); end if;
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
    select * into th from chat_threads where user_id = auth.uid() and booking_id is null order by last_at desc limit 1;
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
    when 'en' then '✅ Your booking is confirmed! (' || b.code || E')\n' || s || ' · ' || d || ' · ' || b.people || E' guest(s)\nWhen you arrive, show your voucher and tap 📍 Check in.\nVoucher: ' || link
    when 'vi' then '✅ Lịch hẹn đã được xác nhận! (' || b.code || E')\n' || s || ' · ' || d || ' · ' || b.people || E' người\nKhi đến, hãy đưa phiếu và bấm 📍 Check-in.\nPhiếu: ' || link
    else '✅ 예약이 확정됐어요! (' || b.code || E')\n' || s || ' · ' || d || ' · ' || b.people || E'명\n도착하면 예약확인증을 업체에 보여 주고 📍 체크인을 눌러 주세요.\n예약확인증: ' || link end;
  elsif kind = 'reschedule' then return case l
    when 'en' then '🔁 Sorry, the shop can''t take ' || d || E' 🙏\nAvailable times:\n' || coalesce(offers, '-') || E'\nTap the one you want on your voucher, or reply here: ' || link
    when 'vi' then '🔁 Xin lỗi, cơ sở không nhận được ' || d || E' 🙏\nGiờ có thể nhận:\n' || coalesce(offers, '-') || E'\nBấm chọn giờ trong phiếu hoặc trả lời tại đây: ' || link
    else '🔁 요청하신 ' || d || E'은 업체 사정으로 어려워요 🙏\n가능한 시간:\n' || coalesce(offers, '-') || E'\n예약확인증에서 원하는 시간을 누르시거나 여기로 답해 주세요: ' || link end;
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

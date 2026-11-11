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

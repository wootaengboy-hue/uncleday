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

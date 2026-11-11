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


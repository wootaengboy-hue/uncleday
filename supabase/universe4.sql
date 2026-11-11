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

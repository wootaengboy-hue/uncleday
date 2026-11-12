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

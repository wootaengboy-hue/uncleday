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

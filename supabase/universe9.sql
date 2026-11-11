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

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

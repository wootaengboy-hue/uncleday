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

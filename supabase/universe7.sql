-- ============================================================
-- 31. 엉클데이 유니버스: 현황판 없이 '방문 완료'한 예약도 기록에
--  · 예약 탭 · 링크 · 관리자 페이지에서 방문 완료한 예약도 기록 탭에 나와요 ('담당 미기록').
--  · 사장님 페이지에서 담당 테라피스트를 고르거나 나중에 채울 수 있어요 (booking_staff_set).
--  · 시술 기록마다 담당을 누가 정했는지 남겨요 (src: board 현황판 · shop 사장님이 입력 · review 손님 후기).
-- universe6.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

alter table public.board_sessions add column if not exists src text not null default 'board';
alter table public.board_sessions drop constraint if exists board_sessions_src_check;
alter table public.board_sessions add constraint board_sessions_src_check check (src in ('board', 'shop', 'review'));

-- 담당 고르기용 직원 목록 (사장님 · 카운터 직원)
create or replace function public.staff_list(shop text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform owner_check(shop);
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'role', role) order by sort, created_at)
    from shop_staff where shop_id = shop and active), '[]'::jsonb);
end $$;

-- 방문 완료한 엉클데이 예약의 담당 테라피스트 넣기 · 바꾸기 (빈 배열이면 담당 지우기)
create or replace function public.booking_staff_set(shop text, bid uuid, tps jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b bookings; sids uuid[]; n int; amt bigint; each bigint; st shop_staff; k int := 0; g_id uuid; nid uuid;
  t0 timestamptz; t1 timestamptz; stn text := ''; gid uuid; m int;
begin
  perform owner_check(shop);
  select * into b from bookings where id = bid and shop_id = shop;
  if not found then raise exception 'Booking not found'; end if;
  if b.status not in ('visited', 'settled') then raise exception 'This booking is not visited yet'; end if;
  if jsonb_typeof(coalesce(tps, '[]'::jsonb)) <> 'array' then raise exception 'Choose a therapist'; end if;
  select array_agg(v::uuid order by o) into sids from (select v, min(o) o from jsonb_array_elements_text(coalesce(tps, '[]'::jsonb)) with ordinality e(v, o) where v <> '' group by v) q;
  n := coalesce(array_length(sids, 1), 0);
  if n > 4 then raise exception 'Up to 4 therapists'; end if;
  if n > 0 and (select count(*) from shop_staff where id = any(sids) and shop_id = shop) <> n then raise exception 'Staff not found'; end if;
  -- 현황판에서 기록된 시간 · 방은 그대로 쓰고, 없으면 예약 시간으로
  select min(started_at), max(coalesce(done_at, ends_at)), max(station), max(guest_id::text)::uuid, max(minutes)
    into t0, t1, stn, gid, m from board_sessions where booking_id = bid and status = 'done';
  m := coalesce(m, b.menu_min, 60);
  t0 := coalesce(t0, ((b.visit_date + coalesce(nullif(b.visit_time, ''), '12:00')::time) at time zone 'Asia/Ho_Chi_Minh'));
  t1 := coalesce(t1, t0 + make_interval(mins => m));
  delete from board_sessions where booking_id = bid and status = 'done';
  if n = 0 then return jsonb_build_object('ok', true, 'n', 0); end if;
  amt := coalesce(b.paid_amount, 0); each := amt / n; g_id := gen_random_uuid();
  for st in select * from shop_staff where id = any(sids) order by array_position(sids, id) loop
    nid := case when k = 0 then g_id else gen_random_uuid() end;
    insert into board_sessions (id, grp, shop_id, day, guest_id, booking_id, staff_id, staff_name, station, course_name, minutes, price, paid, status, started_at, ends_at, done_at, created_by, src)
    values (nid, g_id, shop, b.visit_date, gid, bid, st.id, st.name, coalesce(stn, ''), b.menu_name, m,
            case when k = 0 then amt - each * (n - 1) else each end, case when k = 0 then amt - each * (n - 1) else each end,
            'done', t0, t1, t1, actor_name(shop), 'shop');
    k := k + 1;
  end loop;
  return jsonb_build_object('ok', true, 'n', n);
end $$;

-- 엉클데이 예약 금액이 바뀌면(방문 완료 금액 수정) 담당 기록 금액도 다시 나눠요
create or replace function public.board_sessions_repaid() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; each bigint; r record; k int := 0;
begin
  if new.paid_amount is distinct from old.paid_amount and new.status in ('visited', 'settled') then
    select count(*) into n from board_sessions where booking_id = new.id and status = 'done';
    if n > 0 then
      each := coalesce(new.paid_amount, 0) / n;
      for r in select id, (id = coalesce(grp, id)) lead from board_sessions where booking_id = new.id and status = 'done' order by (id = coalesce(grp, id)) desc, id loop
        update board_sessions set paid = case when k = 0 then coalesce(new.paid_amount, 0) - each * (n - 1) else each end where id = r.id;
        k := k + 1;
      end loop;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists bookings_repaid on public.bookings;
create trigger bookings_repaid after update of paid_amount on public.bookings for each row execute function public.board_sessions_repaid();

-- 시술 기록: 현황판 기록 + 담당 없이 방문 완료한 엉클데이 예약
create or replace function public.board_rows(shop text, d1 date, d2 date, walk_only boolean default false) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(r order by r ->> 'day', r ->> 'started_at'), '[]'::jsonb) from (
    select jsonb_build_object(
      'grp', coalesce(x.grp, x.id), 'day', min(x.day), 'started_at', min(x.started_at), 'done_at', max(x.done_at),
      'guest', coalesce(max(g.name), max(b.customer_name)), 'people', coalesce(max(g.people), max(b.people)), 'course', max(x.course_name),
      'minutes', max(x.minutes), 'station', nullif(max(x.station), ''),
      'staff', string_agg(x.staff_name, ', ' order by (x.id = coalesce(x.grp, x.id)) desc, x.staff_name),
      'staff_ids', jsonb_agg(x.staff_id order by (x.id = coalesce(x.grp, x.id)) desc, x.staff_name), 'n', count(*),
      'paid', sum(coalesce(x.paid, x.price, 0)), 'ud', bool_or(x.booking_id is not null), 'booking_id', max(x.booking_id::text),
      'code', max(b.code), 'commission', max(b.commission), 'src', max(x.src)) r
    from board_sessions x
    left join board_guests g on g.id = x.guest_id
    left join bookings b on b.id = x.booking_id
    where x.shop_id = shop and x.status = 'done' and x.day between d1 and d2 and (not walk_only or x.booking_id is null)
    group by coalesce(x.grp, x.id)
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

grant execute on function public.staff_list(text), public.booking_staff_set(text, uuid, jsonb) to authenticated;

-- 엉클데이 예약의 지금 담당 테라피스트
create or replace function public.booking_staff_get(shop text, bid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform owner_check(shop);
  return jsonb_build_object(
    'staff', staff_list(shop),
    'ids', coalesce((select jsonb_agg(x.staff_id order by (x.id = coalesce(x.grp, x.id)) desc, x.staff_name) from board_sessions x
      where x.booking_id = bid and x.shop_id = shop and x.status = 'done' and x.staff_id is not null), '[]'::jsonb),
    'src', (select max(src) from board_sessions x where x.booking_id = bid and x.shop_id = shop and x.status = 'done'));
end $$;
grant execute on function public.booking_staff_get(text, uuid) to authenticated;

-- ============================================================
-- 30. 엉클데이 유니버스: 지난 기록 · 정산에 현장 손님 매출
--  · board_history(shop, d1, d2): 기간별 시술 기록, 직원별 건수 · 매출 · 출퇴근 (사장님만)
--  · owner_settle: 엉클데이 예약(수수료 대상)에 더해 현장 손님(워크인) 매출도 같이 보여 줘요.
--    현장 손님 매출에는 엉클데이 수수료가 붙지 않아요.
-- universe5.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

-- 시술 한 건(같이 들어간 테라피스트는 한 건으로 묶어요)
create or replace function public.board_rows(shop text, d1 date, d2 date, walk_only boolean default false) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(r order by r ->> 'day', r ->> 'done_at'), '[]'::jsonb) from (
    select jsonb_build_object(
      'grp', coalesce(x.grp, x.id), 'day', min(x.day), 'started_at', min(x.started_at), 'done_at', max(x.done_at),
      'guest', max(g.name), 'people', max(g.people), 'course', max(x.course_name), 'minutes', max(x.minutes), 'station', max(x.station),
      'staff', string_agg(x.staff_name, ', ' order by (x.id = coalesce(x.grp, x.id)) desc, x.staff_name), 'n', count(*),
      'paid', sum(coalesce(x.paid, x.price, 0)), 'ud', bool_or(x.booking_id is not null),
      'code', max(b.code), 'commission', max(b.commission)) r
    from board_sessions x
    left join board_guests g on g.id = x.guest_id
    left join bookings b on b.id = x.booking_id
    where x.shop_id = shop and x.status = 'done' and x.day between d1 and d2 and (not walk_only or x.booking_id is null)
    group by coalesce(x.grp, x.id)) q
$$;
revoke execute on function public.board_rows(text, date, date, boolean) from public, anon, authenticated;

-- 지난 기록 (최대 93일)
create or replace function public.board_history(shop text, d1 date, d2 date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform owner_check(shop, true);
  if d1 is null or d2 is null or d2 < d1 or d2 - d1 > 92 then raise exception 'Bad period'; end if;
  return jsonb_build_object(
    'from', d1, 'to', d2, 'today', vn_today(),
    'rows', board_rows(shop, d1, d2),
    'left', (select count(*) from board_guests g where g.shop_id = shop and g.day between d1 and d2 and g.status = 'left'),
    'staff', coalesce((select jsonb_agg(jsonb_build_object(
        'id', st.id, 'name', st.name, 'role', st.role, 'active', st.active,
        'cnt', (select count(*) from board_sessions x where x.staff_id = st.id and x.status = 'done' and x.day between d1 and d2),
        'rev', (select coalesce(sum(coalesce(x.paid, x.price, 0)), 0) from board_sessions x where x.staff_id = st.id and x.status = 'done' and x.day between d1 and d2),
        'mins', (select coalesce(sum(x.minutes), 0) from board_sessions x where x.staff_id = st.id and x.status = 'done' and x.day between d1 and d2),
        'days', (select count(*) from staff_attendance a where a.staff_id = st.id and a.day between d1 and d2 and a.in_at is not null),
        'work_min', (select coalesce(sum(extract(epoch from (a.out_at - a.in_at)) / 60), 0)::int from staff_attendance a
                     where a.staff_id = st.id and a.day between d1 and d2 and a.in_at is not null and a.out_at is not null),
        'late_n', (select count(*) from staff_attendance a where a.staff_id = st.id and a.day between d1 and d2 and a.late_min > 0),
        'late_min', (select coalesce(sum(a.late_min), 0) from staff_attendance a where a.staff_id = st.id and a.day between d1 and d2),
        'att', case when d1 = d2 then (select jsonb_build_object('in_at', a.in_at, 'out_at', a.out_at, 'late_min', a.late_min)
                     from staff_attendance a where a.staff_id = st.id and a.day = d1) end)
        order by st.active desc, st.sort, st.created_at)
      from shop_staff st where st.shop_id = shop
        and (st.active or exists (select 1 from board_sessions x where x.staff_id = st.id and x.day between d1 and d2))), '[]'::jsonb));
end $$;
grant execute on function public.board_history(text, date, date) to authenticated;

-- 정산: 엉클데이 예약 + 현장 손님 매출
create or replace function public.owner_settle(shop text, mon text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m text := coalesce(nullif(mon, ''), to_char((now() at time zone 'Asia/Ho_Chi_Minh')::date, 'YYYY-MM')); md date;
begin
  perform owner_check(shop, true);
  if m !~ '^\d{4}-\d{2}$' then raise exception 'Bad month'; end if;
  md := (m || '-01')::date;
  return jsonb_build_object(
    'month', m,
    'months', coalesce((select jsonb_agg(x order by x ->> 'month' desc) from (
        select jsonb_build_object('month', to_char(visit_date, 'YYYY-MM'), 'visits', count(*), 'paid', coalesce(sum(paid_amount), 0), 'commission', coalesce(sum(commission), 0)) x
        from bookings where shop_id = shop and status in ('visited', 'settled') and visit_date >= (date_trunc('month', now()) - interval '5 months')::date
        group by to_char(visit_date, 'YYYY-MM')) y), '[]'::jsonb),
    'walk_months', coalesce((select jsonb_agg(x order by x ->> 'month' desc) from (
        select jsonb_build_object('month', to_char(day, 'YYYY-MM'), 'count', count(distinct coalesce(grp, id)), 'paid', coalesce(sum(coalesce(paid, price, 0)), 0)) x
        from board_sessions where shop_id = shop and status = 'done' and booking_id is null and day >= (date_trunc('month', now()) - interval '5 months')::date
        group by to_char(day, 'YYYY-MM')) y), '[]'::jsonb),
    'statements', coalesce((select jsonb_agg(jsonb_build_object('month', s.month, 'count', s.booking_count, 'paid', s.total_paid, 'commission', s.total_commission,
        'status', s.status, 'billed_at', s.billed_at, 'paid_at', s.paid_at) order by s.month desc)
        from settlements s where s.shop_id = shop and s.status <> 'void'), '[]'::jsonb),
    'rows', coalesce((select jsonb_agg(jsonb_build_object('code', b.code, 'date', b.visit_date, 'time', b.visit_time, 'name', b.customer_name, 'people', b.people,
        'menu_name', b.menu_name, 'paid', b.paid_amount, 'commission', b.commission, 'settled', b.status = 'settled',
        'staff', (select string_agg(x.staff_name, ', ' order by (x.id = coalesce(x.grp, x.id)) desc, x.staff_name) from board_sessions x where x.booking_id = b.id and x.status = 'done'))
        order by b.visit_date, b.visit_time)
        from bookings b where b.shop_id = shop and b.status in ('visited', 'settled') and to_char(b.visit_date, 'YYYY-MM') = m), '[]'::jsonb),
    'walk_rows', board_rows(shop, md, (md + interval '1 month' - interval '1 day')::date, true));
end $$;
grant execute on function public.owner_settle(text, text) to authenticated;

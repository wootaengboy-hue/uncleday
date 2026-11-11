-- ============================================================
-- 34. 엉클데이 유니버스 5단계: 관리자 페이지 연동 (관리자만)
--  · 매장 현황: 현황판을 쓰는 매장들의 오늘 상태 (현황판은 읽기 전용으로 열어요)
--  · 직원 DB: 경력 프로필에 동의한 직원만 이름 · 경력 · 실적 · 후기를 봐요. 동의 안 한 직원은 숫자로만 세요.
--    '구직 중'은 관리자만 봐요 (사장님 화면에는 절대 안 나와요).
--  · 평판 · 후기 보너스: 보너스 금액 정하기, 확인 → 지급 처리, 후기 숨기기
-- universe9.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

create or replace function public.admin_universe_shops() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d date := vn_today();
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return coalesce((select jsonb_agg(x order by (x ->> 'working')::int desc, (x ->> 'in_now')::int desc, x ->> 'name') from (
    select jsonb_build_object('id', s.id, 'name', coalesce(s.data -> 'name' ->> 'ko', s.data -> 'name' ->> 'vi', s.id), 'area', s.data -> 'area',
      'state', shop_state(s.id),
      'staff', (select count(*) from shop_staff st where st.shop_id = s.id and st.active),
      'app', (select count(*) from shop_staff st where st.shop_id = s.id and st.active and st.pin_hash is not null),
      'in_now', (select count(*) from staff_attendance a join shop_staff st on st.id = a.staff_id and st.active
                 where a.shop_id = s.id and a.in_at is not null and a.out_at is null and a.day >= d - 1),
      'working', (select count(*) from board_sessions x where x.shop_id = s.id and x.status = 'working'),
      'waiting', (select count(*) from board_guests g where g.shop_id = s.id and g.status = 'waiting' and g.day >= d - 1),
      'done_today', (select count(distinct coalesce(x.grp, x.id)) from board_sessions x where x.shop_id = s.id and x.day = d and x.status = 'done'),
      'rev_today', (select coalesce(sum(coalesce(x.paid, x.price, 0)), 0) from board_sessions x where x.shop_id = s.id and x.day = d and x.status = 'done'),
      'pending_req', (select count(*) from staff_requests q where q.shop_id = s.id and q.status = 'pending'),
      'rv_30', (select count(*) from staff_reviews v where v.shop_id = s.id and v.created_at > now() - interval '30 days'),
      'rv_avg', (select round(avg(v.stars)::numeric, 1) from staff_reviews v where v.shop_id = s.id and not v.hidden),
      'last_used', (select max(x.started_at) from board_sessions x where x.shop_id = s.id)) x
    from shops s
    where exists (select 1 from shop_layout l where l.shop_id = s.id) or exists (select 1 from shop_staff st where st.shop_id = s.id)) q), '[]'::jsonb);
end $$;

-- 직원 DB (동의한 사람만 자세히)
create or replace function public.admin_staff_db() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return jsonb_build_object(
    'total', (select count(*) from shop_staff where active),
    'consented', (select count(*) from staff_people where career_consent),
    'open', (select count(*) from staff_people where career_consent and open_to_work),
    'people', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'phone', p.phone, 'open', p.open_to_work, 'consent_at', p.consent_at,
        'shops', (select jsonb_agg(jsonb_build_object('shop', coalesce(s.data -> 'name' ->> 'ko', s.id), 'shop_id', st.shop_id, 'role', st.role, 'years', st.years,
             'joined', st.joined_at, 'left', st.left_at, 'active', st.active) order by st.active desc, st.joined_at desc)
           from shop_staff st join shops s on s.id = st.shop_id where st.person_id = p.id),
        'years', (select max(st.years) from shop_staff st where st.person_id = p.id),
        'sessions', (select count(*) from board_sessions x join shop_staff st on st.id = x.staff_id where st.person_id = p.id and x.status = 'done'),
        'minutes', (select coalesce(sum(x.minutes), 0) from board_sessions x join shop_staff st on st.id = x.staff_id where st.person_id = p.id and x.status = 'done'),
        'reviews', (select count(*) from staff_reviews v join shop_staff st on st.id = v.staff_id where st.person_id = p.id and not v.hidden),
        'avg', (select round(avg(v.stars)::numeric, 1) from staff_reviews v join shop_staff st on st.id = v.staff_id where st.person_id = p.id and not v.hidden),
        'late_n', (select count(*) from staff_attendance a join shop_staff st on st.id = a.staff_id where st.person_id = p.id and a.late_min > 0),
        'days', (select count(*) from staff_attendance a join shop_staff st on st.id = a.staff_id where st.person_id = p.id and a.in_at is not null))
      order by p.open_to_work desc, p.name)
      from staff_people p where p.career_consent), '[]'::jsonb));
end $$;

-- 후기 · 보너스 목록
create or replace function public.admin_bonus_list(st text default 'pending') returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return jsonb_build_object(
    'bonus', coalesce((select (val #>> '{}')::bigint from universe_config where key = 'review_bonus'), 0),
    'counts', (select jsonb_object_agg(bonus_status, n) from (select bonus_status, count(*) n from staff_reviews group by bonus_status) c),
    'owed', coalesce((select jsonb_agg(o order by (o ->> 'amount')::bigint desc) from (
        select jsonb_build_object('staff_id', v.staff_id, 'name', coalesce(s2.name, v.staff_name), 'shop', coalesce(s.data -> 'name' ->> 'ko', v.shop_id),
          'n', count(*), 'amount', sum(v.bonus_amount), 'ids', jsonb_agg(v.id)) o
        from staff_reviews v left join shop_staff s2 on s2.id = v.staff_id left join shops s on s.id = v.shop_id
        where v.bonus_status = 'approved' group by v.staff_id, coalesce(s2.name, v.staff_name), coalesce(s.data -> 'name' ->> 'ko', v.shop_id)) oo), '[]'::jsonb),
    'rows', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'staff_id', v.staff_id, 'staff', coalesce(s2.name, v.staff_name), 'shop', coalesce(s.data -> 'name' ->> 'ko', v.shop_id),
        'stars', v.stars, 'body', v.body, 'customer', v.customer_label, 'created_at', v.created_at, 'hidden', v.hidden, 'verified', v.verified,
        'status', v.bonus_status, 'amount', v.bonus_amount, 'memo', v.bonus_memo, 'paid_at', v.bonus_paid_at,
        'code', b.code, 'visit_date', b.visit_date,
        'recorded', exists (select 1 from board_sessions x where x.booking_id = v.booking_id and x.staff_id = v.staff_id and x.src <> 'review'),
        'attended', exists (select 1 from staff_attendance a where a.staff_id = v.staff_id and a.day = b.visit_date and a.in_at is not null))
        order by v.created_at desc)
      from (select * from staff_reviews where st = 'all' or bonus_status = st order by created_at desc limit 300) v
      left join shop_staff s2 on s2.id = v.staff_id left join shops s on s.id = v.shop_id left join bookings b on b.id = v.booking_id), '[]'::jsonb));
end $$;

-- 보너스 처리: pending → approved / rejected, approved → paid
create or replace function public.admin_bonus_set(ids jsonb, st text, memo text default null) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if st not in ('approved', 'rejected', 'paid', 'pending') then raise exception 'Unknown status'; end if;
  update staff_reviews v set bonus_status = st, bonus_memo = coalesce(memo, v.bonus_memo),
    bonus_decided_at = case when st in ('approved', 'rejected') then now() else v.bonus_decided_at end,
    bonus_paid_at = case when st = 'paid' then now() else null end
  where v.id in (select (x)::uuid from jsonb_array_elements_text(ids) x)
    and ((st in ('approved', 'rejected') and v.bonus_status in ('pending', 'none', 'rejected', 'approved'))
      or (st = 'paid' and v.bonus_status = 'approved') or (st = 'pending' and v.bonus_status in ('approved', 'rejected')));
  get diagnostics n = row_count;
  return n;
end $$;

-- 보너스 금액 (아직 지급 전인 후기에도 새 금액을 적용해요)
create or replace function public.admin_bonus_amount(amount bigint) returns bigint
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if amount is null or amount < 0 or amount > 10000000 then raise exception 'Bad amount'; end if;
  insert into universe_config (key, val, updated_at) values ('review_bonus', to_jsonb(amount), now())
  on conflict (key) do update set val = excluded.val, updated_at = now();
  update staff_reviews set bonus_amount = amount where bonus_status in ('pending', 'approved') and verified;
  return amount;
end $$;

create or replace function public.admin_staff_review_hide(rid uuid, hide boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  update staff_reviews set hidden = hide, bonus_status = case when hide and bonus_status in ('pending', 'approved') then 'rejected' else bonus_status end where id = rid;
end $$;

grant execute on function public.admin_universe_shops(), public.admin_staff_db(), public.admin_bonus_list(text),
  public.admin_bonus_set(jsonb, text, text), public.admin_bonus_amount(bigint), public.admin_staff_review_hide(uuid, boolean) to authenticated;

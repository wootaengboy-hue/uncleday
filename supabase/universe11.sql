-- ============================================================
-- 35. 엉클데이 관리자 '대신 수정' 기록
--  · 엉클데이 관리자가 사장님 대신 현황판 · 근무표 · 직원 · 매장 배치를 고치면 자동으로 기록돼요.
--  · 사장님 페이지 '오늘' 화면에 "엉클데이 관리자가 대신 수정했어요"로 보여요.
--  · 관리자도 그 매장의 사장님 · 카운터 계정이면(직접 쓰는 경우) 기록하지 않아요.
--  · 직원 PIN 은 관리자도 사장님과 같은 버튼(staff_pin_reset)으로 새로 만들 수 있어요. 이것도 기록돼요.
-- universe10.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

create table if not exists public.board_audit (
  id       bigserial primary key,
  shop_id  text not null,
  at       timestamptz not null default now(),
  actor    uuid,
  tbl      text not null,
  op       text not null,
  summary  text,
  data     jsonb
);
create index if not exists board_audit_shop_idx on public.board_audit (shop_id, at desc);
alter table public.board_audit enable row level security;
drop policy if exists "board_audit admin" on public.board_audit;
create policy "board_audit admin" on public.board_audit for all to authenticated using (is_admin()) with check (is_admin());

create or replace function public.board_audit_tg() returns trigger
language plpgsql security definer set search_path = public as $$
declare r jsonb := to_jsonb(coalesce(new, old)); o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end; sid text; sm text; nm text;
begin
  if auth.uid() is null or not is_admin() then return coalesce(new, old); end if;
  sid := r ->> 'shop_id';
  if sid is null or exists (select 1 from shop_members m where m.user_id = auth.uid() and m.shop_id = sid and m.active) then return coalesce(new, old); end if;
  nm := coalesce(r ->> 'staff_name', r ->> 'name', (select s.name from shop_staff s where s.id = nullif(r ->> 'staff_id', '')::uuid), '');
  sm := case tg_table_name
    when 'shop_layout' then '매장 설정 (층 · 방 · 코스 · 근무 시간 · 꾸미기)'
    when 'shop_staff' then case tg_op when 'INSERT' then '직원 추가: ' || nm
        when 'DELETE' then '직원 삭제: ' || nm
        else case when (o ->> 'pin_hash') is distinct from (r ->> 'pin_hash') then '직원 화면 PIN: ' || nm
                  when (o ->> 'active') = 'true' and (r ->> 'active') = 'false' then '직원 퇴사 처리: ' || nm
                  else '직원 정보 수정: ' || nm end end
    when 'staff_shifts' then '근무표: ' || nm || ' ' || (r ->> 'day') || ' → ' || case when tg_op = 'DELETE' then '평소대로' else coalesce(case r ->> 'code' when 'A' then '오픈조' when 'B' then '마감조' when 'F' then '종일' when 'O' then '휴무' when 'C' then '시간 지정' end, '') end
    when 'staff_requests' then '직원 요청 처리: ' || nm || ' ' || (r ->> 'day') || ' (' || coalesce(r ->> 'status', '') || ')'
    when 'board_guests' then '손님 접수 · 상태: ' || coalesce(r ->> 'name', '') || ' (' || coalesce(r ->> 'status', '') || ')'
    when 'board_sessions' then '시술: ' || nm || ' (' || coalesce(r ->> 'status', '') || ')'
    when 'staff_attendance' then '출퇴근: ' || nm
    when 'shop_days' then '영업 시작 · 마감'
    else tg_table_name end;
  -- 같은 사람이 1분 안에 같은 내용을 여러 번 바꾸면 한 줄로
  if exists (select 1 from board_audit a where a.shop_id = sid and a.actor = auth.uid() and a.summary = sm and a.at > now() - interval '1 minute') then return coalesce(new, old); end if;
  insert into board_audit (shop_id, actor, tbl, op, summary, data) values (sid, auth.uid(), tg_table_name, tg_op, sm, r - 'pin_hash' - 'pin_salt' - 'phone');
  return coalesce(new, old);
end $$;
revoke execute on function public.board_audit_tg() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['shop_layout', 'shop_staff', 'staff_shifts', 'staff_requests', 'board_guests', 'board_sessions', 'staff_attendance', 'shop_days'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.board_audit_tg()', t || '_audit', t);
  end loop;
end $$;

-- 사장님 · 카운터: 우리 매장을 엉클데이 관리자가 대신 고친 기록 (최근 30일)
create or replace function public.board_audit_list(shop text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform owner_check(shop);
  return coalesce((select jsonb_agg(jsonb_build_object('at', a.at, 'summary', a.summary) order by a.at desc)
    from (select * from board_audit where shop_id = shop and at > now() - interval '30 days' order by at desc limit 50) a), '[]'::jsonb);
end $$;

-- 관리자: 모든 매장의 대신 수정 기록
create or replace function public.admin_audit_list(lim int default 50) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('at', a.at, 'summary', a.summary, 'shop_id', a.shop_id,
      'shop', (select coalesce(s.data -> 'name' ->> 'ko', s.id) from shops s where s.id = a.shop_id),
      'who', (select u.email from auth.users u where u.id = a.actor)) order by a.at desc)
    from (select * from board_audit order by at desc limit least(greatest(coalesce(lim, 50), 1), 300)) a), '[]'::jsonb);
end $$;

grant execute on function public.board_audit_list(text), public.admin_audit_list(int) to authenticated;

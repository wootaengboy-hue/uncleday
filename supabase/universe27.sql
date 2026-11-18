-- ============================================================
-- 51. 👷 직원 권한 나누기 — '현장 영업 직원(field)'
--  · 관리자(full): 지금처럼 전부.
--  · 현장 영업 직원(field): 업체 정보 · 가격 · 사진 입력, 업체 영업 보드, 링크 · QR, 영업 매뉴얼만.
--    예약 · 손님 · 채팅 · 정산 · 후기 · 유니버스 · 계약서 · 사장님 계정 · 설정은 화면도 데이터도 잠겨요.
--  · 직원은 '게시' · '엉클 인증 배지' · '입점 확인 완료'를 바꿀 수 없어요 (새 업체는 숨김으로 만들어지고, 관리자가 확인 후 게시).
--  · 직원 추가: 관리자 → ⚙️ 계정 → 관리자 목록에서 이메일 추가할 때 '현장 영업 직원'을 고르기.
-- universe26.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

alter table public.admins add column if not exists role text not null default 'full';
alter table public.admins drop constraint if exists admins_role_chk;
alter table public.admins add constraint admins_role_chk check (role in ('full', 'field'));
alter table public.admin_emails add column if not exists role text not null default 'full';
alter table public.admin_emails drop constraint if exists admin_emails_role_chk;
alter table public.admin_emails add constraint admin_emails_role_chk check (role in ('full', 'field'));

-- 관리자(전부 볼 수 있는 사람)만 true — 기존 모든 잠금(RLS · 기능)이 이걸 써요
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid() and role = 'full')
$$;
-- 관리자 + 현장 영업 직원
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid())
$$;
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from admins where user_id = auth.uid()
$$;
revoke all on function public.is_staff(), public.my_role() from public, anon;
grant execute on function public.is_staff(), public.my_role() to authenticated;

-- 처음 로그인: 이메일 목록에 적힌 권한으로 들어와요
create or replace function public.claim_admin() returns boolean
language plpgsql security definer set search_path = public as $$
declare em text := lower(coalesce(auth.jwt() ->> 'email', '')); r text;
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from admins where user_id = auth.uid()) then return true; end if;
  if not exists (select 1 from admins) then
    insert into admins (user_id, email, role) values (auth.uid(), em, 'full') on conflict do nothing; return true;
  end if;
  select role into r from admin_emails where lower(email) = em;
  if r is not null then
    insert into admins (user_id, email, role) values (auth.uid(), em, r) on conflict do nothing; return true;
  end if;
  return false;
end $$;

-- 관리자가 직원 권한 바꾸기 (이미 들어온 사람 + 이메일 목록 둘 다)
create or replace function public.admin_set_role(em text, r text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception '관리자만 할 수 있어요'; end if;
  if r not in ('full', 'field') then raise exception '권한 이름이 이상해요'; end if;
  if lower(em) = lower(coalesce(auth.jwt() ->> 'email', '')) and r <> 'full' then raise exception '내 권한은 내릴 수 없어요'; end if;
  update admins set role = r where lower(email) = lower(em);
  update admin_emails set role = r where lower(email) = lower(em);
end $$;
revoke all on function public.admin_set_role(text, text) from public, anon;
grant execute on function public.admin_set_role(text, text) to authenticated;

-- ---- 현장 영업 직원이 쓸 수 있는 것 ----
-- 업체: 보기 · 추가 · 고치기 (지우기 X). 게시 상태는 못 바꿔요.
drop policy if exists staff_read on public.shops;
drop policy if exists staff_insert on public.shops;
drop policy if exists staff_update on public.shops;
create policy staff_read   on public.shops for select to authenticated using (public.is_staff());
create policy staff_insert on public.shops for insert to authenticated with check (public.is_staff());
create policy staff_update on public.shops for update to authenticated using (public.is_staff()) with check (public.is_staff());
create or replace function public.shops_field_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_staff() and not public.is_admin() then
    -- 게시 · 엉클 인증 배지 · 입점 확인 완료는 관리자만 바꿔요
    if tg_op = 'INSERT' then new.published := false; new.data := coalesce(new.data, '{}'::jsonb) - 'best' - 'verified';
    else new.published := old.published;
      new.data := (coalesce(new.data, '{}'::jsonb) - 'best' - 'verified') || jsonb_strip_nulls(jsonb_build_object('best', old.data -> 'best', 'verified', old.data -> 'verified'));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists shops_field_guard on public.shops;
create trigger shops_field_guard before insert or update on public.shops for each row execute function public.shops_field_guard();

-- 업체 영업 보드: 보기 · 추가 · 단계 옮기기 (지우기 X)
drop policy if exists staff_read on public.leads;
drop policy if exists staff_insert on public.leads;
drop policy if exists staff_update on public.leads;
create policy staff_read   on public.leads for select to authenticated using (public.is_staff());
create policy staff_insert on public.leads for insert to authenticated with check (public.is_staff());
create policy staff_update on public.leads for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists staff_read on public.lead_logs;
drop policy if exists staff_insert on public.lead_logs;
create policy staff_read   on public.lead_logs for select to authenticated using (public.is_staff());
create policy staff_insert on public.lead_logs for insert to authenticated with check (public.is_staff());

-- 팀원 이름 (담당자 표시용) · 링크 유입 숫자
drop policy if exists staff_read on public.admins;
create policy staff_read on public.admins for select to authenticated using (public.is_staff());
drop policy if exists "seo_hits staff" on public.seo_hits;
create policy "seo_hits staff" on public.seo_hits for select to authenticated using (public.is_staff());

-- 업체 사진 올리기 (공개 사진 보관함만 · 지우기 X)
drop policy if exists "uncleday staff images" on storage.objects;
create policy "uncleday staff images" on storage.objects for insert to authenticated with check (bucket_id = 'images' and public.is_staff());
drop policy if exists "uncleday staff images upd" on storage.objects;
create policy "uncleday staff images upd" on storage.objects for update to authenticated using (bucket_id = 'images' and public.is_staff()) with check (bucket_id = 'images' and public.is_staff());

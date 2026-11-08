-- 자동 백업만 따로 (schema.sql 전체 실행이 'Failed to fetch'로 안 될 때 이것만 실행해도 돼요)

-- ---------------------------------------------------------------
-- 18. 자동 백업: 매일 GitHub이 '백업 열쇠'로 DB 전체를 받아 가서 비밀번호로 잠가 보관해요 (30일)
--     열쇠 원본은 저장하지 않고 지문(sha256)만 저장해요. 열쇠는 관리자 ⚙️ 계정에서 만들어요.
-- ---------------------------------------------------------------
create table if not exists public.backup_keys (
  id          int primary key default 1 check (id = 1),
  token_hash  text,
  created_at  timestamptz,
  created_by  text,
  last_run    timestamptz,
  last_size   int
);
insert into public.backup_keys (id) values (1) on conflict do nothing;
alter table public.backup_keys enable row level security;
drop policy if exists admin_all on public.backup_keys;
create policy admin_all on public.backup_keys for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.backup_dump(t text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k backup_keys; out jsonb;
begin
  select * into k from backup_keys where id = 1;
  if k.token_hash is null or t is null or length(t) < 32 or encode(sha256(convert_to(t, 'UTF8')), 'hex') <> k.token_hash then
    perform pg_sleep(1); raise exception 'backup key mismatch';
  end if;
  out := jsonb_build_object(
    'version', 1, 'at', now(),
    'shops',          coalesce((select jsonb_agg(to_jsonb(x) order by x.sort, x.id) from shops x), '[]'),
    'shop_private',   coalesce((select jsonb_agg(to_jsonb(x)) from shop_private x), '[]'),
    'settings',       coalesce((select jsonb_agg(to_jsonb(x)) from settings x), '[]'),
    'settlements',    coalesce((select jsonb_agg(to_jsonb(x)) from settlements x), '[]'),
    'bookings',       coalesce((select jsonb_agg(to_jsonb(x)) from bookings x), '[]'),
    'booking_events', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from booking_events x), '[]'),
    'reviews',        coalesce((select jsonb_agg(to_jsonb(x)) from reviews x), '[]'),
    'leads',          coalesce((select jsonb_agg(to_jsonb(x)) from leads x), '[]'),
    'lead_logs',      coalesce((select jsonb_agg(to_jsonb(x)) from lead_logs x), '[]'),
    'tasks',          coalesce((select jsonb_agg(to_jsonb(x)) from tasks x), '[]'),
    'templates',      coalesce((select jsonb_agg(to_jsonb(x)) from templates x), '[]'),
    'comments',       coalesce((select jsonb_agg(to_jsonb(x)) from comments x), '[]'),
    'admins',         coalesce((select jsonb_agg(jsonb_build_object('email', email, 'name', name, 'created_at', created_at)) from admins), '[]'),
    'admin_emails',   coalesce((select jsonb_agg(to_jsonb(x)) from admin_emails x), '[]'),
    'stats_daily',    coalesce((select jsonb_agg(to_jsonb(x)) from stats_daily x), '[]'),
    'stats_dim',      coalesce((select jsonb_agg(to_jsonb(x)) from stats_dim x), '[]'));
  update backup_keys set last_run = now(), last_size = length(out::text) where id = 1;
  return out;
end $$;
revoke all on function public.backup_dump(text) from public;
grant execute on function public.backup_dump(text) to anon, authenticated;

-- 끝! 'Success. No rows returned' 가 보이면 완료예요.

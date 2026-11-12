-- ============================================================
-- 44. 🗺️ 미입점 가게: 조회수 공개 · 숨기기
--  · 사장님용 베트남어 페이지(p/…/vi/)에 "최근 30일 조회수"를 보여 줘요.
--    미입점 가게(/p/…) 페이지 숫자만, 조회수 하나만 돌려줘요. 개인 정보 없음.
--  · 사장님이 원하지 않거나 정보가 틀린 가게는 관리자 포털에서 숨겨요.
--    숨긴 가게는 다음 자동 갱신(최대 3시간) 때 페이지 · 목록 · 사이트맵에서 빠져요.
-- universe19.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

create or replace function public.seo_page_views(path text) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(n), 0)::int from seo_hits
  where seo_hits.path = lower(seo_page_views.path) and seo_hits.path ~ '^/p/[a-z]+/[a-z0-9-]+/$' and kind = 'view'
    and day >= (now() at time zone 'Asia/Ho_Chi_Minh')::date - 29 $$;
revoke all on function public.seo_page_views(text) from public;
grant execute on function public.seo_page_views(text) to anon, authenticated;

create table if not exists public.osm_hidden (
  ref        text primary key,          -- 오픈스트리트맵 id (예: n12345, w678)
  name       text,
  reason     text,
  created_at timestamptz not null default now(),
  created_by text
);
alter table public.osm_hidden enable row level security;
drop policy if exists "osm_hidden admin" on public.osm_hidden;
create policy "osm_hidden admin" on public.osm_hidden for all to authenticated using (is_admin()) with check (is_admin());
grant select, insert, update, delete on public.osm_hidden to authenticated;

create or replace function public.osm_hidden_before() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.ref := lower(btrim(new.ref));
  if new.ref !~ '^[nwr][0-9]+$' then raise exception 'Bad id'; end if;
  new.created_by := actor_name(); return new;
end $$;
drop trigger if exists osm_hidden_before on public.osm_hidden;
create trigger osm_hidden_before before insert or update on public.osm_hidden for each row execute function public.osm_hidden_before();

-- 자동 갱신(깃허브)이 읽어 가는 숨김 목록: id 만
create or replace function public.osm_hidden_ids() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(ref order by ref), '{}') from osm_hidden $$;
revoke all on function public.osm_hidden_ids() from public;
grant execute on function public.osm_hidden_ids() to anon, authenticated;

-- ============================================================
-- 45. 🔗 링크로 가게 가져오기 (크롤링)
--  · 관리자가 포털에 링크(가게 홈페이지 · 가격표 · 블로그 등)를 넣으면
--    깃허브 자동 작업이 1시간 안에 그 페이지에서 사실 정보(이름 · 주소 · 영업시간 · 메뉴 가격)만 뽑아 와요.
--  · 관리자가 확인 · 수정하고 [게시]하면 다음 자동 갱신 때 미입점 가게 페이지처럼 사이트에 나와요.
--  · 깃허브는 '수집 열쇠'(토큰)로만 이 표에 접근해요. 열쇠는 포털에서 만들고(한 번만 보여요) 깃허브 Secrets 에 직접 넣어요.
-- universe20.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

create table if not exists public.crawl_jobs (
  id           bigserial primary key,
  url          text not null,
  city         text,
  kind         text,                         -- 마사지 · 스파 · 네일 · 뷰티 …
  status       text not null default 'pending' check (status in ('pending', 'done', 'error', 'published', 'rejected')),
  result       jsonb,                        -- 자동으로 뽑은 그대로
  data         jsonb,                        -- 관리자가 확인 · 고친 최종 내용 (게시용)
  err          text,
  created_by   text,
  updated_by   text,
  created_at   timestamptz not null default now(),
  crawled_at   timestamptz,
  published_at timestamptz
);
create index if not exists crawl_jobs_status_idx on public.crawl_jobs (status, created_at);
alter table public.crawl_jobs enable row level security;
drop policy if exists "crawl_jobs admin" on public.crawl_jobs;
create policy "crawl_jobs admin" on public.crawl_jobs for all to authenticated using (is_admin()) with check (is_admin());
grant select, insert, update, delete on public.crawl_jobs to authenticated;
grant usage, select on sequence public.crawl_jobs_id_seq to authenticated;

create or replace function public.crawl_jobs_before() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.url := btrim(new.url);
    if new.url !~* '^https?://[^ ]+$' then raise exception '링크는 http:// 또는 https:// 로 시작해야 해요'; end if;
    new.created_by := actor_name();
  end if;
  new.updated_by := actor_name();
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then new.published_at := now(); end if;
  return new;
end $$;
drop trigger if exists crawl_jobs_before on public.crawl_jobs;
create trigger crawl_jobs_before before insert or update on public.crawl_jobs for each row execute function public.crawl_jobs_before();

-- 수집 열쇠 (해시만 저장)
create table if not exists public.crawl_cfg (id int primary key default 1 check (id = 1), token_hash text, made_at timestamptz, made_by text);
alter table public.crawl_cfg enable row level security;
drop policy if exists "crawl_cfg admin" on public.crawl_cfg;
create policy "crawl_cfg admin" on public.crawl_cfg for select to authenticated using (is_admin());

create or replace function public.crawl_new_token() returns text
language plpgsql security definer set search_path = public as $$
declare t text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  insert into crawl_cfg (id, token_hash, made_at, made_by) values (1, encode(sha256(convert_to(t, 'UTF8')), 'hex'), now(), actor_name())
  on conflict (id) do update set token_hash = excluded.token_hash, made_at = now(), made_by = excluded.made_by;
  return t;
end $$;
revoke all on function public.crawl_new_token() from public, anon;
grant execute on function public.crawl_new_token() to authenticated;

create or replace function public.crawl_tok_ok(tok text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select token_hash = encode(sha256(convert_to(coalesce(tok, ''), 'UTF8')), 'hex') from crawl_cfg where id = 1 and token_hash is not null), false) $$;
revoke all on function public.crawl_tok_ok(text) from public, anon, authenticated;

-- 깃허브: 가져올 링크 목록
create or replace function public.crawl_pending(tok text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not crawl_tok_ok(tok) then raise exception 'Bad token'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'url', url, 'city', city, 'kind', kind) order by created_at)
                   from (select * from crawl_jobs where status = 'pending' order by created_at limit 20) x), '[]'::jsonb);
end $$;
revoke all on function public.crawl_pending(text) from public;
grant execute on function public.crawl_pending(text) to anon, authenticated;

-- 깃허브: 결과 저장
create or replace function public.crawl_result(tok text, job bigint, res jsonb, error text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not crawl_tok_ok(tok) then raise exception 'Bad token'; end if;
  update crawl_jobs set status = case when error is null or error = '' then 'done' else 'error' end,
    result = res, data = coalesce(data, res), err = nullif(left(error, 500), ''), crawled_at = now()
  where id = job and status = 'pending';
end $$;
revoke all on function public.crawl_result(text, bigint, jsonb, text) from public;
grant execute on function public.crawl_result(text, bigint, jsonb, text) to anon, authenticated;

-- 사이트 만들기: 게시된 것만 (어차피 공개 페이지가 될 내용)
create or replace function public.crawl_published() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'url', url, 'city', city, 'kind', kind, 'data', data, 'checked', to_char(coalesce(crawled_at, published_at), 'YYYY-MM-DD')) order by id), '[]'::jsonb)
  from crawl_jobs where status = 'published' and data is not null $$;
revoke all on function public.crawl_published() from public;
grant execute on function public.crawl_published() to anon, authenticated;

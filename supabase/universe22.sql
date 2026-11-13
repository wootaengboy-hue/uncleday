-- ============================================================
-- 46. 🔍 경쟁사 분석
--  · 포털에 경쟁 사이트 주소를 넣으면 깃허브 자동 작업이 그 사이트의 글 목록(사이트맵) · 글 제목 · 소제목만 읽어서
--    ① 어떤 검색어를 노리는지 ② 엉클데이에 그 검색어 페이지가 있는지 ③ 글에 나온 가게가 엉클데이에 있는지 알려 줘요.
--  · 글 내용은 저장하지 않아요 (제목 · 소제목 · 주소만). robots.txt 를 지켜요.
--  · universe21 의 crawl_jobs 를 같이 써요 (job = 'site').
-- universe21.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

alter table public.crawl_jobs add column if not exists job text not null default 'shop';
do $$ begin
  alter table public.crawl_jobs add constraint crawl_jobs_job_chk check (job in ('shop', 'site'));
exception when duplicate_object then null; end $$;

create or replace function public.crawl_pending(tok text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not crawl_tok_ok(tok) then raise exception 'Bad token'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'url', url, 'city', city, 'kind', kind, 'job', job) order by created_at)
                   from (select * from crawl_jobs where status = 'pending' order by created_at limit 20) x), '[]'::jsonb);
end $$;

create or replace function public.crawl_published() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'url', url, 'city', city, 'kind', kind, 'data', data, 'checked', to_char(coalesce(crawled_at, published_at), 'YYYY-MM-DD')) order by id), '[]'::jsonb)
  from crawl_jobs where status = 'published' and data is not null and job = 'shop' $$;

-- 결과 저장: 새 job 열과 이름이 겹치지 않게 다시 만들어요
create or replace function public.crawl_result(tok text, job bigint, res jsonb, error text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not crawl_tok_ok(tok) then raise exception 'Bad token'; end if;
  update crawl_jobs set status = case when error is null or error = '' then 'done' else 'error' end,
    result = res, data = coalesce(data, res), err = nullif(left(error, 500), ''), crawled_at = now()
  where id = crawl_result.job and status = 'pending';
end $$;
revoke all on function public.crawl_result(text, bigint, jsonb, text) from public;
grant execute on function public.crawl_result(text, bigint, jsonb, text) to anon, authenticated;


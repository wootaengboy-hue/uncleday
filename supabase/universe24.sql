-- ============================================================
-- 48. 🔎 엉클데이 서치 콘솔 — 페이지별 구글 색인 상태
--  · Edge Function gsc 가 구글 'URL 검사'로 사이트맵의 페이지를 매시간 70개씩 확인해서 여기에 적어요 (하루 구글 한도 2,000건 안).
--  · 관리자 포털 '🔎 엉클데이 서치 콘솔'에서 색인됨 / 안 됨 / 확인 전을 페이지 종류별로 봐요.
--  · 쓰기는 gsc 기능(서비스 키)만 해요. 관리자는 읽기만.
-- universe23.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

create table if not exists public.seo_index (
  url         text primary key,
  kind        text,                 -- 업체 · 도시 · 주제 · 가격 · 가이드 · 미입점 · 블로그 · 영어 …
  verdict     text,                 -- PASS · NEUTRAL · FAIL (구글 판정)
  coverage    text,                 -- 예: Submitted and indexed / Discovered - currently not indexed
  indexing    text,
  fetch_state text,
  robots      text,
  canonical   text,
  last_crawl  timestamptz,
  checked_at  timestamptz,
  in_sitemap  boolean not null default true,
  err         text
);
create index if not exists seo_index_checked_idx on public.seo_index (checked_at nulls first);
alter table public.seo_index enable row level security;
drop policy if exists "seo_index admin read" on public.seo_index;
create policy "seo_index admin read" on public.seo_index for select to authenticated using (is_admin());
grant select on public.seo_index to authenticated;

-- gsc 기능이 수집 열쇠(깃허브 CRAWL_TOKEN)로 불렸는지 확인할 때 써요 (서비스 키로만 호출)
create or replace function public.crawl_tok_check(tok text) returns boolean
language sql stable security definer set search_path = public as $$ select crawl_tok_ok(tok) $$;
revoke all on function public.crawl_tok_check(text) from public, anon, authenticated;
grant execute on function public.crawl_tok_check(text) to service_role;

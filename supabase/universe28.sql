-- ============================================================
-- 52. ✍️ 블로그 정보 본문 — 검색어 주제 자체를 설명하는 글 (AI 초안 → 사람이 확인 · 고친 뒤 게시)
--  · blog_posts 에 본문(body) · 자주 묻는 질문(faq) 칸을 더해요
--  · 사이트 글은 '정보 본문 → 관련 업체 목록' 순서로 만들어져요
-- universe27.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================
alter table public.blog_posts add column if not exists body text;
alter table public.blog_posts add column if not exists faq jsonb not null default '[]'::jsonb;

create or replace function public.blog_published() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'slug', slug, 'kw', kw, 'title', title, 'city', city, 'landmark', landmark, 'topic', topic, 'treat', treat, 'grp', grp, 'intro', intro,
    'body', body, 'faq', faq,
    'published', to_char(published_at, 'YYYY-MM-DD'), 'updated', to_char(updated_at, 'YYYY-MM-DD')) order by id), '[]'::jsonb)
  from blog_posts where status = 'published' $$;
revoke all on function public.blog_published() from public;
grant execute on function public.blog_published() to anon, authenticated;

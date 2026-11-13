-- ============================================================
-- 47. 📝 블로그 (우리 데이터로 만드는 글)
--  · 관리자가 검색어(예: 한시장 근처 마사지 추천)로 글을 만들면, 글의 '조건'(도시 · 장소 · 주제 · 시술)만 저장해요.
--  · 내용(업체 목록 · 거리 · 실제 가격 · 영업시간 · FAQ)은 매시간 자동 갱신 때 최신 업체 데이터로 다시 그려요.
--    그래서 가격이 바뀌어도 글이 저절로 최신이 돼요.
--  · 조건에 맞는 업체가 2곳보다 적으면 페이지를 만들지 않아요 (빈 글 = 구글 스팸 판정 위험).
-- universe22.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

create table if not exists public.blog_posts (
  id           bigserial primary key,
  slug         text unique,
  kw           text not null,               -- 노리는 검색어
  title        text,
  city         text,
  landmark     text,                        -- tools/landmarks.py 의 id
  topic        text,                        -- tools/topics.py 의 id
  treat        text,                        -- tools/treatments.py 의 id
  grp          text,                        -- spabody · beauty · clinic (비우면 마사지 · 스파)
  intro        text,                        -- 관리자가 쓴 첫 문단 (비우면 자동 문장)
  status       text not null default 'draft' check (status in ('draft', 'published')),
  from_url     text,                        -- 어느 경쟁사 글에서 주제를 얻었는지 (참고용, 페이지에는 안 나와요)
  created_by   text,
  updated_by   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  published_at timestamptz
);
alter table public.blog_posts enable row level security;
drop policy if exists "blog_posts admin" on public.blog_posts;
create policy "blog_posts admin" on public.blog_posts for all to authenticated using (is_admin()) with check (is_admin());
grant select, insert, update, delete on public.blog_posts to authenticated;
grant usage, select on sequence public.blog_posts_id_seq to authenticated;

create or replace function public.blog_posts_before() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.kw := btrim(new.kw);
  if length(new.kw) < 2 then raise exception '검색어를 적어 주세요'; end if;
  new.slug := nullif(btrim(lower(new.slug)), '');
  if new.slug is not null and new.slug !~ '^[a-z0-9-]{2,80}$' then raise exception '주소는 영어 소문자 · 숫자 · - 만 써요'; end if;
  if tg_op = 'INSERT' then new.created_by := actor_name(); end if;
  new.updated_by := actor_name(); new.updated_at := now();
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then new.published_at := now(); end if;
  return new;
end $$;
drop trigger if exists blog_posts_before on public.blog_posts;
create trigger blog_posts_before before insert or update on public.blog_posts for each row execute function public.blog_posts_before();

-- 사이트 만들기: 게시된 글의 조건만 (공개 페이지가 될 내용)
create or replace function public.blog_published() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'slug', slug, 'kw', kw, 'title', title, 'city', city, 'landmark', landmark, 'topic', topic, 'treat', treat, 'grp', grp, 'intro', intro,
    'published', to_char(published_at, 'YYYY-MM-DD'), 'updated', to_char(updated_at, 'YYYY-MM-DD')) order by id), '[]'::jsonb)
  from blog_posts where status = 'published' $$;
revoke all on function public.blog_published() from public;
grant execute on function public.blog_published() to anon, authenticated;

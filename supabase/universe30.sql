-- ============================================================
-- 53. 🟢 네이버 · 다음 · 빙 검색어 세기
--  · 네이버 서치어드바이저는 구글처럼 숫자를 가져오는 연결(API)이 없어서,
--    손님이 네이버 · 다음 · 빙 검색 결과에서 우리 페이지를 눌러 들어올 때 '무슨 말로 검색했는지'를 우리가 직접 세요.
--  · 검색어 · 날짜 · 들어온 페이지 · 횟수만 저장해요 (이름 · IP · 기기 정보 없음). 검색엔진이 검색어를 넘겨줄 때만 잡혀요.
--  · 관리자만 볼 수 있어요.
-- universe29.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

create table if not exists public.seo_kw (
  day date not null,
  src text not null,
  q text not null,
  path text not null,
  n integer not null default 0,
  primary key (day, src, q, path)
);
alter table public.seo_kw enable row level security;
drop policy if exists "seo_kw admin" on public.seo_kw;
create policy "seo_kw admin" on public.seo_kw for select to authenticated using (public.is_admin());

create or replace function public.seo_kw_hit(q text, src text, path text) returns void
language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Asia/Ho_Chi_Minh')::date; k text; s text; p text;
begin
  k := left(lower(regexp_replace(btrim(coalesce(q, '')), '\s+', ' ', 'g')), 80);
  s := lower(coalesce(src, ''));
  p := left(coalesce(path, '/'), 200);
  if length(k) < 1 or s not in ('naver', 'daum', 'bing') or p !~ '^/' then return; end if;
  -- 이상하게 많이 들어오면(도배) 그날은 그만 세요
  if (select count(*) from seo_kw where day = d) > 3000 then return; end if;
  insert into seo_kw (day, src, q, path, n) values (d, s, k, p, 1)
  on conflict on constraint seo_kw_pkey do update set n = seo_kw.n + 1;
end $$;
revoke all on function public.seo_kw_hit(text, text, text) from public;
grant execute on function public.seo_kw_hit(text, text, text) to anon, authenticated;

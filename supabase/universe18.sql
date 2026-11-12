-- ============================================================
-- 42. 🔎 검색 유입 · 리드
--  · 자동으로 만든 페이지(도시 · 가이드 · 주제 · 미입점 업체 · 업체)에 누가 어디서(구글 · 네이버 · ChatGPT …) 들어왔는지 날짜별 숫자로만 세요.
--    IP · 개인 정보는 저장하지 않아요.
--  · 미입점 업체 페이지의 '예약 문의' · '사장님 입점 신청'을 리드로 받아 관리자 포털에서 처리해요.
--    같은 접속(IP)에서 1시간에 5건까지만 받아요 (IP 는 해시로만 잠깐 저장).
-- universe17.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

create table if not exists public.seo_hits (
  day  date not null,
  path text not null,
  src  text not null,
  kind text not null,
  n    int  not null default 0,
  primary key (day, path, src, kind)
);
alter table public.seo_hits enable row level security;
drop policy if exists "seo_hits admin" on public.seo_hits;
create policy "seo_hits admin" on public.seo_hits for select to authenticated using (is_admin());

create or replace function public.seo_hit(path text, src text, kind text) returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare d date := (now() at time zone 'Asia/Ho_Chi_Minh')::date; p text; s text; k text;
begin
  p := lower(left(coalesce(seo_hit.path, ''), 160));
  if p !~ '^/(c|en|p|s)/[a-z0-9/_-]*$' then return; end if;
  s := left(regexp_replace(lower(coalesce(seo_hit.src, '')), '[^a-z0-9_.-]', '', 'g'), 24); if s = '' then s := 'direct'; end if;
  k := lower(coalesce(seo_hit.kind, ''));
  if k not in ('view', 'book', 'shop', 'guide', 'lead_guest', 'lead_owner', 'kakao', 'map') then return; end if;
  insert into seo_hits (day, path, src, kind, n) values (d, p, s, k, 1)
  on conflict (day, path, src, kind) do update set n = seo_hits.n + 1;
end $$;
revoke all on function public.seo_hit(text, text, text) from public;
grant execute on function public.seo_hit(text, text, text) to anon, authenticated;

create table if not exists public.seo_leads (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind       text not null check (kind in ('guest', 'owner')),
  path       text,
  ref        text,            -- 미입점 업체 id (예: osm:n123) 또는 업체 id
  shop_name  text,
  city       text,
  name       text,
  contact    text,            -- 카톡 ID · 전화 · 잘로 (엉클데이만 봐요)
  msg        text,
  visit_date text,
  people     int,
  lang       text,
  src        text,
  status     text not null default 'new' check (status in ('new', 'contacted', 'won', 'lost')),
  note       text,
  updated_by text
);
create index if not exists seo_leads_at_idx on public.seo_leads (created_at desc);
alter table public.seo_leads enable row level security;
drop policy if exists "seo_leads admin" on public.seo_leads;
create policy "seo_leads admin" on public.seo_leads for all to authenticated using (is_admin()) with check (is_admin());
grant select, update, delete on public.seo_leads to authenticated;

create or replace function public.seo_lead(p jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare ip text; ki text; k text := lower(coalesce(p ->> 'kind', '')); c text := btrim(coalesce(p ->> 'contact', ''));
begin
  if k not in ('guest', 'owner') then raise exception 'Bad request'; end if;
  if length(c) < 3 then raise exception 'Please enter your contact'; end if;
  begin ip := split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1); exception when others then ip := ''; end;
  ki := 'lead:' || encode(sha256(convert_to(coalesce(nullif(btrim(ip), ''), 'none'), 'UTF8')), 'hex');
  if (select count(*) from find_attempts where find_attempts.k = ki and at > now() - interval '1 hour') >= 5 then raise exception 'Too many tries'; end if;
  insert into find_attempts (k) values (ki);
  insert into seo_leads (kind, path, ref, shop_name, city, name, contact, msg, visit_date, people, lang, src)
  values (k, left(p ->> 'path', 160), left(p ->> 'ref', 80), left(p ->> 'shop_name', 120), left(p ->> 'city', 20), left(btrim(coalesce(p ->> 'name', '')), 60),
          left(c, 120), left(p ->> 'msg', 1000), left(p ->> 'visit_date', 40), least(20, greatest(0, coalesce((p ->> 'people')::int, 0))), left(p ->> 'lang', 5), left(p ->> 'src', 24));
  begin perform seo_hit(p ->> 'path', p ->> 'src', 'lead_' || k); exception when others then null; end;
  return 'ok';
end $$;
revoke all on function public.seo_lead(jsonb) from public;
grant execute on function public.seo_lead(jsonb) to anon, authenticated;

-- 관리자: 기간 안의 페이지별 숫자
create or replace function public.seo_report(d1 date, d2 date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return jsonb_build_object(
    'by_src', coalesce((select jsonb_object_agg(src, n) from (select src, sum(n) n from seo_hits where day between d1 and d2 and kind = 'view' group by src) x), '{}'::jsonb),
    'by_day', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'n', n) order by day) from (select day, sum(n) n from seo_hits where day between d1 and d2 and kind = 'view' group by day) x), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(x order by (x ->> 'views')::int desc) from (
        select jsonb_build_object('path', path, 'views', sum(n) filter (where kind = 'view'),
          'search', sum(n) filter (where kind = 'view' and src in ('google', 'naver', 'bing', 'daum', 'chatgpt', 'perplexity', 'claude', 'gemini')),
          'ai', sum(n) filter (where kind = 'view' and src in ('chatgpt', 'perplexity', 'claude', 'gemini')),
          'cta', sum(n) filter (where kind not in ('view', 'lead_guest', 'lead_owner')),
          'leads', sum(n) filter (where kind in ('lead_guest', 'lead_owner'))) x
        from seo_hits where day between d1 and d2 group by path) y(x)), '[]'::jsonb));
end $$;
grant execute on function public.seo_report(date, date) to authenticated;

create or replace function public.seo_leads_before() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_by := actor_name(); return new;
end $$;
drop trigger if exists seo_leads_before on public.seo_leads;
create trigger seo_leads_before before update on public.seo_leads for each row execute function public.seo_leads_before();

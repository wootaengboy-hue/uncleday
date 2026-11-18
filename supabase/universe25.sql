-- ============================================================
-- 49. ⭐ 구글에도 후기 남기기
--  · 손님이 엉클데이 후기를 쓴 뒤 [⭐ 구글에도 남기기]를 누르면, 쓴 글이 복사되고 그 가게의 구글 후기 창이 열려요.
--    (구글은 다른 사이트가 대신 후기를 올리는 걸 허락하지 않아서, 손님이 직접 붙여 넣어요)
--  · 누른 수를 seo_hits(kind = 'grv')로 세고, 사장님 리포트에 '구글 후기 버튼' 숫자로 보여 줘요.
--  · 구글 정책: 별점과 상관없이 모든 손님에게 똑같이 보여 주고, 구글 후기에는 보상을 걸지 않아요.
-- universe24.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

create or replace function public.seo_hit(path text, src text, kind text) returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare d date := (now() at time zone 'Asia/Ho_Chi_Minh')::date; p text; s text; k text;
begin
  p := lower(left(coalesce(seo_hit.path, ''), 160));
  if p !~ '^/(c|en|p|s)/[a-z0-9/_-]*$' then return; end if;
  s := left(regexp_replace(lower(coalesce(seo_hit.src, '')), '[^a-z0-9_.-]', '', 'g'), 24); if s = '' then s := 'direct'; end if;
  k := lower(coalesce(seo_hit.kind, ''));
  if k not in ('view', 'book', 'shop', 'guide', 'lead_guest', 'lead_owner', 'kakao', 'map', 'grv') then return; end if;
  insert into seo_hits (day, path, src, kind, n) values (d, p, s, k, 1)
  on conflict (day, path, src, kind) do update set n = seo_hits.n + 1;
end $$;
revoke all on function public.seo_hit(text, text, text) from public;
grant execute on function public.seo_hit(text, text, text) to anon, authenticated;

create or replace function public.owner_report(shop text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d date := (now() at time zone 'Asia/Ho_Chi_Minh')::date; p text := '/s/' || lower(shop) || '/';
  f constant text[] := array['google', 'naver', 'bing', 'daum', 'chatgpt', 'perplexity', 'claude', 'gemini'];
begin
  perform owner_check(shop);
  return (select jsonb_object_agg(k, v) from (
    select k || r.sfx k, v from (values ('', d - 29, d), ('_prev', d - 59, d - 30)) r(sfx, a, b),
    lateral (values
      ('views',   (select coalesce(sum(n), 0) from stats_daily where shop_id = shop and kind = 'view' and day between r.a and r.b)),
      ('consult', (select coalesce(sum(n), 0) from stats_daily where shop_id = shop and kind = 'consult' and day between r.a and r.b)),
      ('map',     (select coalesce(sum(n), 0) from stats_daily where shop_id = shop and kind = 'map' and day between r.a and r.b)),
      ('search',  (select coalesce(sum(n), 0) from seo_hits where path = p and kind = 'view' and src = any(f) and day between r.a and r.b)),
      ('grv',     (select coalesce(sum(n), 0) from seo_hits where path = p and kind = 'grv' and day between r.a and r.b)),
      ('bookings',(select count(*) from bookings where shop_id = shop and (created_at at time zone 'Asia/Ho_Chi_Minh')::date between r.a and r.b))
    ) x(k, v)) y);
end $$;
revoke all on function public.owner_report(text) from public, anon;
grant execute on function public.owner_report(text) to authenticated;

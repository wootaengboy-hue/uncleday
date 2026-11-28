-- universe61 · 업체 페이지 📸 사진 모음 — 검수 통과한 사진만 손님 화면에
--  · 현장 직원이 찍은 사진(field) · 사장님이 올린 사진(owner) 중 이미지 검수에서 '통과'한 것만
--  · 홈페이지에서 찾은 후보(site)는 허락을 받기 전이라 나오지 않아요
--  · 사진 주소만 돌려줘요 (메모 · 검수자 · 문제 표시는 안 보여요)
drop function if exists public.shop_photos(text);
create or replace function public.shop_photos(p_shop text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('url', x.url, 'main', x.is_main) order by x.is_main desc, x.created_at), '[]'::jsonb)
  from (select coalesce(nullif(m.work_url, ''), m.orig_url) as url, m.is_main, m.created_at
        from public.shop_media m
        where m.shop_id = p_shop and m.verdict = 'pass' and m.source in ('field', 'owner')
          and coalesce(nullif(m.work_url, ''), m.orig_url) ~* '^https://'
        order by m.is_main desc, m.created_at limit 12) x
$$;
revoke all on function public.shop_photos(text) from public;
grant execute on function public.shop_photos(text) to anon, authenticated;

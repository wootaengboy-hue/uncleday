-- ===============================================================
-- universe45: 📋 피부 · 의료 가게는 '방문 전에 꼭 작성'을 기본으로 켜요
--  · 업종이 피부과(derma) · 성형(surgery) · 피부관리(skin) 인 가게
--  · 아직 아무도 정하지 않은 가게만 켜요 — 관리자나 사장님이 한 번이라도 켜고 끈 가게는 그대로 둬요
--  · 앞으로 새로 넣는 피부 · 의료 가게도 자동으로 켜져요 (관리자 → 업체 편집 → 📋 방문 전 질문에서 끌 수 있어요)
-- Supabase → SQL Editor 에 붙여 넣고 Run (여러 번 실행해도 괜찮아요)
-- ===============================================================

create or replace function public.shop_survey_req_default() returns trigger
language plpgsql as $$
begin
  if new.data ->> 'cat' in ('derma', 'surgery', 'skin') and not coalesce(new.data -> 'survey', '{}'::jsonb) ? 'req' then
    new.data := jsonb_set(new.data, '{survey}', coalesce(new.data -> 'survey', '{}'::jsonb) || '{"req": true}'::jsonb);
  end if;
  return new;
end $$;

drop trigger if exists shop_survey_req_default on public.shops;
create trigger shop_survey_req_default before insert or update of data on public.shops
  for each row execute function public.shop_survey_req_default();

-- 지금 있는 가게
update public.shops set data = data
where data ->> 'cat' in ('derma', 'surgery', 'skin') and not coalesce(data -> 'survey', '{}'::jsonb) ? 'req';

-- 확인: 켜진 가게 수
select data ->> 'cat' as 업종, count(*) filter (where (data -> 'survey' ->> 'req')::boolean) as 꼭작성_켜짐, count(*) as 전체
from public.shops where data ->> 'cat' in ('derma', 'surgery', 'skin') group by 1 order by 1;

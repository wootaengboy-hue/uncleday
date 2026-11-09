-- 낙서장 칸반 카드 순서 저장 (끌어서 위아래로 옮긴 자리)
alter table public.tasks add column if not exists pos double precision;
alter table public.leads add column if not exists pos double precision;
-- 끝! 'Success. No rows returned' 가 보이면 완료예요.

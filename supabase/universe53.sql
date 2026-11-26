-- ===============================================================
-- universe53: 💳 AI 사용량 — 콘솔에 있던 지난 사용액(11/18~11/26)을 포털에 넣어요
--  · 콘솔은 날짜 · 모델별 금액만 보여 줘서 기능(가져오기 · 번역 …) · 업체 구분은 없어요 → '📊 콘솔 기록'으로 표시
--  · ai_usage 에 금액을 바로 적는 칸(usd)을 더해요 (토큰 대신 금액이 정해진 줄)
--  · 대략 잔액 계산엔 영향 없어요 (잔액은 '콘솔 잔액을 적은 뒤' 사용분만 빼요)
--  · universe52 다음에 실행 · 여러 번 실행해도 같은 결과예요
-- ===============================================================
alter table public.ai_usage add column if not exists usd numeric(12, 6);

delete from public.ai_usage where fn = 'console-past';
insert into public.ai_usage (at, fn, model, usd, ref) values
  ('2026-11-18 12:00+00', 'console-past', 'claude-sonnet-5-5', 0.25,     '콘솔 11/18 (UTC)'),
  ('2026-11-19 12:00+00', 'console-past', 'claude-sonnet-5-5', 1.81,     '콘솔 11/19 (UTC)'),
  ('2026-11-19 12:00+00', 'console-past', 'claude-haiku-5-5',  0.33,     '콘솔 11/19 (UTC)'),
  ('2026-11-20 12:00+00', 'console-past', 'claude-sonnet-5-5', 1.03,     '콘솔 11/20 (UTC)'),
  ('2026-11-23 12:00+00', 'console-past', 'claude-sonnet-5-5', 0.04,     '콘솔 11/23 (UTC)'),
  ('2026-11-24 12:00+00', 'console-past', 'claude-sonnet-5-5', 2.71,     '콘솔 11/24 (UTC)'),
  ('2026-11-24 12:00+00', 'console-past', 'claude-haiku-5-5',  0.00042,  '콘솔 11/24 (UTC)'),
  ('2026-11-26 12:00+00', 'console-past', 'claude-sonnet-5-5', 0.33,     '콘솔 11/26 (UTC) · 기록 시작 전까지'),
  ('2026-11-26 12:00+00', 'console-past', 'claude-haiku-5-5',  0.000049, '콘솔 11/26 (UTC) · 기록 시작 전까지');

select round(sum(usd), 2) as "콘솔 지난 사용 합계 ($)" from public.ai_usage where fn = 'console-past';

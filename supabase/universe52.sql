-- ===============================================================
-- universe52: 💳 AI 사용량 · 대략 잔액
--  · ai_usage: Edge Function(가져오기 · 이미지 AI 검사 · 블로그 AI · 다국어 번역 · 채팅 번역)이 AI 를 부를 때마다
--      쓴 토큰을 한 줄씩 남겨요 (금액은 포털에서 모델 단가로 계산)
--  · ai_balance: 콘솔에서 본 잔액을 직원이 적어 둬요 → 대략 잔액 = 마지막으로 적은 잔액 − 그 뒤 사용액
--  · 직원만 읽어요. 기록은 Edge Function 이 서버 키로만 써요 (손님 · 브라우저는 못 써요)
-- Supabase → SQL Editor 에 붙여 넣고 Run (여러 번 실행해도 괜찮아요)
-- ===============================================================

create table if not exists public.ai_usage (
  id            bigserial primary key,
  at            timestamptz not null default now(),
  fn            text not null,                -- shop-extract · media-check · blog-ai · i18n-tr · chat-tr
  model         text,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  cache_read    integer not null default 0,
  cache_write   integer not null default 0,
  ref           text                          -- 어느 업체 · 검색어 등 (짧게)
);
create index if not exists ai_usage_at on public.ai_usage (at desc);
alter table public.ai_usage enable row level security;
drop policy if exists ai_usage_staff on public.ai_usage;
create policy ai_usage_staff on public.ai_usage for select to authenticated using (public.is_staff());

create table if not exists public.ai_balance (
  id    bigserial primary key,
  at    timestamptz not null default now(),
  usd   numeric(10, 2) not null check (usd >= 0),   -- 콘솔에서 본 잔액 ($)
  note  text,
  by_email text
);
alter table public.ai_balance enable row level security;
drop policy if exists ai_balance_staff on public.ai_balance;
create policy ai_balance_staff on public.ai_balance for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- universe57 · 문의 기록 넓히기
--  ① 채팅마다 '어느 업체 문의인지' 관리자가 직접 고르기 (chat_threads.shop_id)
--  ② 카톡 · 잘로 · 왓츠앱 · 전화 등 사이트 밖에서 온 문의를 직접 입력 (inquiries 표)
--  손님 연락처가 들어 있어서 관리자 · 직원만 읽고 쓸 수 있어요 (손님 · 업체는 못 봐요)

alter table public.chat_threads add column if not exists shop_id text;

create table if not exists public.inquiries (
  id          uuid primary key default gen_random_uuid(),
  asked_at    timestamptz not null default now(),          -- 손님이 문의한 시각
  channel     text not null default 'kakao' check (channel in ('kakao', 'zalo', 'whatsapp', 'line', 'instagram', 'facebook', 'phone', 'email', 'visit', 'other')),
  name        text,
  contact     text,
  country     text check (country is null or country ~ '^[A-Z]{2}$'),
  shop_id     text,
  topics      text[] not null default '{}',
  body        text check (body is null or length(body) <= 4000),
  result      text not null default 'only' check (result in ('book', 'later', 'only', 'wait')),
  booking_code text,
  memo        text,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists inquiries_asked_idx on public.inquiries (asked_at desc);
alter table public.inquiries enable row level security;
drop policy if exists admin_all on public.inquiries;
create policy admin_all on public.inquiries for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists staff_all on public.inquiries;
create policy staff_all on public.inquiries for all to authenticated using (public.is_staff()) with check (public.is_staff());
revoke all on public.inquiries from anon;

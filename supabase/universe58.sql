-- universe58 · 문의 종류 (손님 문의 / 입점·제휴 / 사업 협의 / 채용 / 기타)
--  · 사이트 채팅(chat_threads)과 직접 입력한 문의(inquiries) 둘 다
alter table public.chat_threads add column if not exists kind text check (kind is null or kind in ('guest', 'partner', 'biz', 'job', 'other'));
alter table public.inquiries   add column if not exists kind text not null default 'guest' check (kind in ('guest', 'partner', 'biz', 'job', 'other'));

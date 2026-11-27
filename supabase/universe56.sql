-- universe56 · 채팅 손님 나라를 관리자가 직접 지정 (대시보드 🌍 나라별 카드의 '알 수 없음' 정리용)
--  · chat_threads.country : 두 글자 나라 코드 (GB, DE, KR ...) · 비어 있으면 자동 추정
alter table public.chat_threads add column if not exists country text check (country is null or country ~ '^[A-Z]{2}$');

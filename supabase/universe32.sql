-- ============================================================
-- 55. 🌐 채팅 자동 번역 (채널톡처럼)
--  · 손님이 러시아어 · 일본어 등 어떤 말로 써도, 담당자는 내가 고른 말(한국어 · 베트남어 · 영어)로 봐요.
--  · 담당자가 한국어로 답하면 손님 말로 바꿔서 보내요. 손님에게는 번역된 글만 보이고, 담당자는 내가 쓴 원문을 봐요.
--  · 번역은 Edge Function 'chat-tr' (Claude) 이 하고, 한 번 번역한 건 여기에 저장해서 다시 돈이 들지 않아요.
-- universe31.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

alter table public.chat_messages add column if not exists src_lang text;              -- 이 메시지가 쓰인 말 (손님 글: 감지한 말 · 담당자 글: 손님에게 보낸 말)
alter table public.chat_messages add column if not exists tr jsonb not null default '{}'::jsonb;   -- 담당자용 번역 {"ko": "...", "vi": "..."}
alter table public.chat_messages add column if not exists orig text;                  -- 담당자가 실제로 쓴 글 (번역해서 보낸 경우)
alter table public.chat_messages add column if not exists orig_lang text;

-- 관리자: 번역 결과 저장 (손님 글을 담당자 말로)
create or replace function public.admin_chat_tr_save(mid bigint, src text, lang text, txt text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception '관리자만 할 수 있어요'; end if;
  if lang !~ '^[a-z]{2}(-[A-Z]{2})?$' then raise exception '언어 코드가 이상해요'; end if;
  update chat_messages set src_lang = coalesce(nullif(left(src, 8), ''), src_lang),
    tr = tr || jsonb_build_object(lang, left(coalesce(txt, ''), 2000))
  where id = mid;
end $$;

-- 관리자: 번역해서 답장 (손님에게는 body = 번역문, 담당자에게는 orig = 내가 쓴 글)
create or replace function public.chat_reply_tr(thread uuid, body text, orig text, orig_lang text, to_lang text) returns void
language plpgsql security definer set search_path = public as $$
declare mid bigint;
begin
  if not is_admin() then raise exception '관리자만 할 수 있어요'; end if;
  perform chat_reply(thread, body);
  select max(id) into mid from chat_messages where thread_id = thread and sender = 'admin';
  update chat_messages set orig = left(chat_reply_tr.orig, 2000), orig_lang = left(chat_reply_tr.orig_lang, 8), src_lang = left(to_lang, 8)
  where id = mid;
end $$;

revoke all on function public.admin_chat_tr_save(bigint, text, text, text) from public, anon;
grant execute on function public.admin_chat_tr_save(bigint, text, text, text) to authenticated;
revoke all on function public.chat_reply_tr(uuid, text, text, text, text) from public, anon;
grant execute on function public.chat_reply_tr(uuid, text, text, text, text) to authenticated;

-- 손님 화면: 번역해서 보낸 답장에는 '🌐 자동 번역' 표시를 붙일 수 있게 (담당자 원문은 손님에게 보내지 않아요)
create or replace function public.chat_view(th public.chat_threads, since bigint) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when th.id is null then jsonb_build_object('token', null, 'messages', '[]'::jsonb) else jsonb_build_object(
    'token', th.token, 'name', th.name, 'contact', th.contact, 'booking', (select code from bookings where id = th.booking_id),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'from', m.sender, 'body', m.body, 'at', m.created_at, 'auto', m.orig is not null) order by m.id)
                          from chat_messages m where m.thread_id = th.id and m.id > coalesce(since, 0)), '[]'::jsonb),
    'unread', (select count(*) from chat_messages m where m.thread_id = th.id and m.sender = 'admin' and m.created_at > coalesce(th.guest_seen_at, 'epoch'))) end
$$;
revoke all on function public.chat_view(public.chat_threads, bigint) from public, anon, authenticated;

-- ===============================================================
-- universe36: 👷 현장 영업 직원도 💬 채팅을 보고 답할 수 있게
--  · chat_threads / chat_messages 읽기 · 상태 바꾸기: 관리자 + 현장 영업 (is_staff)
--  · 답장 보내기(chat_reply · 번역 답장 chat_reply_tr · 번역 저장): 관리자 + 현장 영업
--  · 🤖 자동 인사 문구 설정(settings)은 그대로 관리자만
-- Supabase → SQL Editor 에 붙여 넣고 Run (여러 번 실행해도 괜찮아요)
-- ===============================================================
drop policy if exists staff_chat on public.chat_threads;
create policy staff_chat on public.chat_threads for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists staff_chat on public.chat_messages;
create policy staff_chat on public.chat_messages for select to authenticated using (public.is_staff());

create or replace function public.chat_reply(thread uuid, body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception '엉클데이 직원만 할 수 있어요'; end if;
  body := btrim(coalesce(body, ''));
  if length(body) = 0 or length(body) > 2000 then raise exception '메시지를 확인해 주세요'; end if;
  insert into chat_messages (thread_id, sender, author, body) values (thread, 'admin', nick(actor_name()), body);
  update chat_threads set last_at = now(), last_from = 'admin', last_body = left(body, 200), admin_seen_at = now() where id = thread;
end $$;

create or replace function public.chat_reply_tr(thread uuid, body text, orig text, orig_lang text, to_lang text) returns void
language plpgsql security definer set search_path = public as $$
declare mid bigint;
begin
  if not is_staff() then raise exception '엉클데이 직원만 할 수 있어요'; end if;
  perform chat_reply(thread, body);
  select max(id) into mid from chat_messages where thread_id = thread and sender = 'admin';
  update chat_messages set orig = left(chat_reply_tr.orig, 2000), orig_lang = left(chat_reply_tr.orig_lang, 8), src_lang = left(to_lang, 8)
  where id = mid;
end $$;

create or replace function public.admin_chat_tr_save(mid bigint, src text, lang text, txt text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception '엉클데이 직원만 할 수 있어요'; end if;
  if lang !~ '^[a-z]{2}(-[A-Z]{2})?$' then raise exception '언어 코드가 이상해요'; end if;
  update chat_messages set src_lang = coalesce(nullif(left(src, 8), ''), src_lang),
    tr = tr || jsonb_build_object(lang, left(coalesce(txt, ''), 2000))
  where id = mid;
end $$;

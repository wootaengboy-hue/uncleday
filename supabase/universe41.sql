-- ===============================================================
-- universe41: 🚫 채팅 '보내기 취소' (카톡처럼 보낸 메시지 · 사진 · 파일 지우기)
--  · 손님: 보낸 지 5분 안에만 지울 수 있어요
--  · 엉클데이 직원(관리자 · 현장 영업): 내가 보낸 메시지는 24시간 안에 지울 수 있어요 (다른 손님에게 잘못 보낸 사진 등)
--  · 지운 메시지는 양쪽 화면에 "삭제된 메시지예요" 로 남고, 글 · 번역 · 파일은 정말 지워요
--    (손님 파일은 Edge Function 'chat-file' 이 저장소에서 지우고, 직원 파일은 관리자 화면이 바로 지워요)
--  · 같이 보낸 사진 묶음은 한 번에 다 지워요
--  · 이미 간 슬랙 알림은 되돌릴 수 없어요
-- 먼저 universe40 이 실행돼 있어야 해요. Edge Function 'chat-file' 도 최신 코드로 다시 배포해 주세요
-- Supabase → SQL Editor 에 붙여 넣고 Run (여러 번 실행해도 괜찮아요)
-- ===============================================================

alter table public.chat_messages add column if not exists deleted_at timestamptz;

-- 직원은 내가 올린 파일(chat/a/…)을 지울 수 있어요
drop policy if exists "uncleday chat files staff del" on storage.objects;
create policy "uncleday chat files staff del" on storage.objects for delete to authenticated using (bucket_id = 'chat' and public.is_staff() and name like 'a/%');

-- 공통: 메시지(와 같은 묶음 사진)를 지우고, 저장소에서 지울 파일 경로를 돌려줘요
create or replace function public.chat_unsend_do(m chat_messages) returns jsonb
language plpgsql security definer set search_path = public as $$
declare paths jsonb;
begin
  with t as (
    select id, att ->> 'p' p from chat_messages
    where thread_id = m.thread_id and sender = m.sender and deleted_at is null
      and (id = m.id or (m.att ? 'g' and att ->> 'g' = m.att ->> 'g')))
  , u as (
    update chat_messages c set deleted_at = now(), body = '🚫', tr = '{}'::jsonb, orig = null, orig_lang = null,
      att = case when c.att ? 'g' then jsonb_build_object('g', c.att ->> 'g') end   -- 묶음 번호만 남겨서 '삭제된 메시지' 도 한 줄로 보여요
    from t where c.id = t.id returning t.p)
  select coalesce(jsonb_agg(p) filter (where p is not null), '[]'::jsonb) into paths from u;
  -- 대화 목록 미리보기도 바꿔요 (마지막 메시지였으면)
  update chat_threads th set last_body = '🚫 삭제된 메시지'
  where th.id = m.thread_id and not exists (select 1 from chat_messages x where x.thread_id = m.thread_id and x.deleted_at is null and x.id > m.id);
  return paths;
end $$;
revoke all on function public.chat_unsend_do(chat_messages) from public, anon, authenticated;

-- 손님: 5분 안에 보내기 취소 (글만 있는 메시지는 여기서 바로 · 파일이 있으면 Edge Function 'chat-file' 을 거쳐요)
create or replace function public.chat_unsend(t text, bt text, mid bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare th chat_threads; m chat_messages; paths jsonb;
begin
  th := chat_find(t, bt);
  if th.id is null then raise exception 'Chat not found'; end if;
  select * into m from chat_messages where id = mid and thread_id = th.id and sender = 'guest' and deleted_at is null;
  if not found then raise exception 'Message not found'; end if;
  if m.created_at < now() - interval '5 minutes' then raise exception 'You can only unsend within 5 minutes'; end if;
  if m.att is not null and coalesce(auth.role(), '') <> 'service_role' then raise exception 'Use chat-file to unsend files'; end if;
  paths := chat_unsend_do(m);
  return jsonb_build_object('paths', paths, 'view', chat_view(th, 0));
end $$;
revoke all on function public.chat_unsend(text, text, bigint) from public;
grant execute on function public.chat_unsend(text, text, bigint) to anon, authenticated, service_role;

-- 직원: 내가 보낸 메시지 24시간 안에 지우기 → 지울 파일 경로를 돌려줘요 (관리자 화면이 저장소에서 지워요)
create or replace function public.chat_unsend_admin(mid bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m chat_messages;
begin
  if not is_staff() then raise exception '엉클데이 직원만 할 수 있어요'; end if;
  select * into m from chat_messages where id = mid and sender = 'admin' and deleted_at is null;
  if not found then raise exception '메시지를 찾지 못했어요'; end if;
  if m.created_at < now() - interval '24 hours' then raise exception '보낸 지 24시간이 지난 메시지는 지울 수 없어요'; end if;
  return chat_unsend_do(m);
end $$;
revoke all on function public.chat_unsend_admin(bigint) from public, anon;
grant execute on function public.chat_unsend_admin(bigint) to authenticated;

-- 손님 화면: 지운 메시지 표시 (del) — 나머지는 그대로
create or replace function public.chat_view(th public.chat_threads, since bigint) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when th.id is null then jsonb_build_object('token', null, 'messages', '[]'::jsonb) else jsonb_build_object(
    'token', th.token, 'name', th.name, 'contact', th.contact, 'booking', (select code from bookings where id = th.booking_id),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'from', m.sender, 'body', m.body, 'at', m.created_at, 'auto', m.orig is not null,
                                                              'att', case when m.att is null then null else m.att - 'p' end, 'del', m.deleted_at is not null) order by m.id)
                          from chat_messages m where m.thread_id = th.id and (m.id > coalesce(since, 0) or m.deleted_at > now() - interval '1 minute')), '[]'::jsonb),
    'unread', (select count(*) from chat_messages m where m.thread_id = th.id and m.sender = 'admin' and m.deleted_at is null and m.created_at > coalesce(th.guest_seen_at, 'epoch'))) end
$$;
revoke all on function public.chat_view(public.chat_threads, bigint) from public, anon, authenticated;

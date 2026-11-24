-- ===============================================================
-- universe40: 📎 채팅 사진 · 파일 보내기 (손님 ↔ 엉클데이)
--  · 사진(jpg · png · webp · gif)과 PDF를 채팅으로 주고받아요. 사진은 대화 안에 바로 보이고, PDF는 눌렀을 때 화면에서 바로 열려요
--  · 파일은 비공개 저장소 'chat' 에 보관해요. 그 대화방 손님(대화 열쇠 · 예약확인증 열쇠)과 엉클데이 직원만 볼 수 있어요
--    - 손님: Edge Function 'chat-file' 이 올리고 (POST), 볼 때도 'chat-file' 이 그 대화 손님인지 확인한 뒤 10분짜리 주소로 보내 줘요 (GET)
--    - 직원(관리자 · 현장 영업): 관리자 화면에서 바로 올리고 봐요 (아래 저장소 규칙)
--  · 사진은 올리기 전에 휴대폰 · 브라우저에서 줄이고(긴 쪽 1600px) 위치 정보(GPS)를 지워요. 파일 하나 10MB까지
--  · 손님이 파일만 보내도 슬랙 알림이 가요 ("📎 사진을 보냈어요")
-- 이 SQL을 실행한 뒤 Edge Function 'chat-file' 을 배포해 주세요 (supabase/functions/chat-file/index.ts)
-- Supabase → SQL Editor 에 붙여 넣고 Run (여러 번 실행해도 괜찮아요)
-- ===============================================================

alter table public.chat_messages add column if not exists att jsonb;   -- 첨부: { p: 저장 경로, n: 파일 이름, m: 종류, s: 크기, w, h }

-- 비공개 저장소 (10MB · 사진 + PDF)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat', 'chat', false, 10485760, array['image/jpeg','image/png','image/webp','image/gif','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','application/pdf'];

-- 직원(관리자 + 현장 영업)만 직접 올리고 · 읽어요. 손님은 Edge Function 을 거쳐요
drop policy if exists "uncleday chat files staff read" on storage.objects;
create policy "uncleday chat files staff read" on storage.objects for select to authenticated using (bucket_id = 'chat' and public.is_staff());
drop policy if exists "uncleday chat files staff add" on storage.objects;
create policy "uncleday chat files staff add" on storage.objects for insert to authenticated with check (bucket_id = 'chat' and public.is_staff() and name like 'a/%');

-- 첨부 정보 다듬기 (경로 · 이름 · 종류만 남겨요)
create or replace function public.chat_att_clean(a jsonb, pre text) returns jsonb
language plpgsql immutable set search_path = public as $$
begin
  if a is null or coalesce(a ->> 'p', '') !~ ('^' || pre || '/[0-9a-f]{32}/[^/]{1,120}$') then raise exception '파일을 확인해 주세요'; end if;
  if coalesce(a ->> 'm', '') not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf') then raise exception '사진이나 PDF만 보낼 수 있어요'; end if;
  return jsonb_strip_nulls(jsonb_build_object('p', a ->> 'p', 'n', left(coalesce(nullif(btrim(a ->> 'n'), ''), 'file'), 120), 'm', a ->> 'm',
    's', nullif(regexp_replace(coalesce(a ->> 's', ''), '[^0-9]', '', 'g'), '')::bigint,
    'w', nullif(regexp_replace(coalesce(a ->> 'w', ''), '[^0-9]', '', 'g'), '')::int,
    'h', nullif(regexp_replace(coalesce(a ->> 'h', ''), '[^0-9]', '', 'g'), '')::int));
end $$;

-- 손님: 파일 메시지 남기기 — Edge Function 'chat-file' 만 불러요 (파일을 올린 직후 · service_role)
-- p = { att, body(같이 쓴 글, 없어도 됨), t, bt, uid, name, contact, lang, page }
create or replace function public.chat_send_att(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare th chat_threads; b bookings; n int; a jsonb; body text; bcode text; img boolean;
begin
  a := chat_att_clean(p -> 'att', 'g');
  img := (a ->> 'm') like 'image/%';
  body := left(btrim(coalesce(p ->> 'body', '')), 2000);
  if body = '' then body := case when img then '📷' else '📄 ' || (a ->> 'n') end; end if;
  th := chat_find(p ->> 't', p ->> 'bt');
  if th.id is null and nullif(p ->> 'uid', '') is not null then
    select * into th from chat_threads where user_id = (p ->> 'uid')::uuid order by last_at desc limit 1;
  end if;
  if th.id is null then
    if coalesce(p ->> 'bt', '') <> '' then select * into b from bookings where customer_token = p ->> 'bt'; end if;
    insert into chat_threads (user_id, booking_id, name, contact, lang, page)
    values (nullif(p ->> 'uid', '')::uuid, b.id, left(coalesce(nullif(btrim(p ->> 'name'), ''), b.customer_name), 60), left(coalesce(nullif(btrim(p ->> 'contact'), ''), b.contact), 100),
            coalesce(nullif(p ->> 'lang', ''), b.lang, 'ko'), left(p ->> 'page', 80))
    returning * into th;
  else
    select count(*) into n from chat_messages where thread_id = th.id and sender = 'guest' and created_at > now() - interval '10 minutes';
    if n >= 30 then raise exception '잠시 뒤에 다시 보내 주세요'; end if;
    select count(*) into n from chat_messages where thread_id = th.id and sender = 'guest' and att is not null and created_at > now() - interval '1 hour';
    if n >= 20 then raise exception '파일은 1시간에 20개까지 보낼 수 있어요'; end if;
  end if;
  insert into chat_messages (thread_id, sender, body, att) values (th.id, 'guest', body, a);
  perform chat_greet(th.id, th.lang);
  update chat_threads set last_at = now(), last_from = 'guest', last_body = left(case when body = '📷' then '📷 사진' when body like '📄 %' then body when img then '📷 ' || body else '📄 ' || body end, 200), status = 'open', guest_seen_at = now() where id = th.id;
  select * into th from chat_threads where id = th.id;
  select code into bcode from bookings where id = th.booking_id;
  perform slack_send('chat', '💬 사이트 채팅 · *' || coalesce(th.name, '손님') || '*' || coalesce(' (' || bcode || ')', '')
    || E'\n> 📎 ' || case when img then '사진을 보냈어요' else '파일을 보냈어요: ' || (a ->> 'n') end
    || case when body not in ('📷') and body not like '📄 %' then E'\n> ' || replace(left(body, 300), E'\n', E'\n> ') else '' end
    || E'\n<https://www.uncleday.com/admin.html#chat/' || th.id || '|👉 이 손님 대화 바로 열기>');
  return chat_view(th, 0);
end $$;
revoke all on function public.chat_send_att(jsonb) from public, anon, authenticated;
grant execute on function public.chat_send_att(jsonb) to service_role;

-- 손님: 이 메시지의 파일 경로 (그 대화방 손님인지 확인) — Edge Function 'chat-file' (GET) 만 불러요
create or replace function public.chat_att_path(t text, bt text, mid bigint) returns text
language plpgsql stable security definer set search_path = public as $$
declare th chat_threads;
begin
  th := chat_find(t, bt);
  if th.id is null then return null; end if;
  return (select att ->> 'p' from chat_messages where id = mid and thread_id = th.id and att is not null);
end $$;
revoke all on function public.chat_att_path(text, text, bigint) from public, anon, authenticated;
grant execute on function public.chat_att_path(text, text, bigint) to service_role;

-- 직원: 사진 · 파일 보내기 (관리자 화면에서 저장소 'chat/a/…' 에 올린 뒤)
create or replace function public.chat_reply_att(thread uuid, att jsonb, body text default null) returns void
language plpgsql security definer set search_path = public as $$
declare a jsonb; img boolean; bd text;
begin
  if not is_staff() then raise exception '엉클데이 직원만 할 수 있어요'; end if;
  a := chat_att_clean(att, 'a');
  img := (a ->> 'm') like 'image/%';
  bd := left(btrim(coalesce(body, '')), 2000);
  if bd = '' then bd := case when img then '📷' else '📄 ' || (a ->> 'n') end; end if;
  insert into chat_messages (thread_id, sender, author, body, att) values (thread, 'admin', nick(actor_name()), bd, a);
  update chat_threads set last_at = now(), last_from = 'admin', last_body = left(case when bd = '📷' then '📷 사진' when bd like '📄 %' then bd when img then '📷 ' || bd else '📄 ' || bd end, 200), admin_seen_at = now() where id = thread;
end $$;
revoke all on function public.chat_reply_att(uuid, jsonb, text) from public, anon;
grant execute on function public.chat_reply_att(uuid, jsonb, text) to authenticated;

-- 손님 화면에 첨부 정보도 내려줘요 (나머지는 그대로)
create or replace function public.chat_view(th public.chat_threads, since bigint) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when th.id is null then jsonb_build_object('token', null, 'messages', '[]'::jsonb) else jsonb_build_object(
    'token', th.token, 'name', th.name, 'contact', th.contact, 'booking', (select code from bookings where id = th.booking_id),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'from', m.sender, 'body', m.body, 'at', m.created_at, 'auto', m.orig is not null,
                                                              'att', case when m.att is null then null else m.att - 'p' end) order by m.id)
                          from chat_messages m where m.thread_id = th.id and m.id > coalesce(since, 0)), '[]'::jsonb),
    'unread', (select count(*) from chat_messages m where m.thread_id = th.id and m.sender = 'admin' and m.created_at > coalesce(th.guest_seen_at, 'epoch'))) end
$$;
revoke all on function public.chat_view(public.chat_threads, bigint) from public, anon, authenticated;

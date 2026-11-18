-- ============================================================
-- 50. 💬 사이트 채팅 → 슬랙 알림 놓치지 않기
--  · 손님이 연달아 보낸 메시지도 하나씩 모두 슬랙으로 보내요 (예전엔 3분 안의 두 번째 메시지부터 생략)
--  · 알림에 손님 언어 표시와 '관리자에서 답장하기' 링크를 붙여요
--  · 채널은 관리자 → 설정 → 슬랙 알림에서 '💬 사이트 채팅' 줄에 새 채널의 웹후크 주소를 넣어요
-- universe25.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

create or replace function public.chat_send(body text, t text default null, bt text default null, name text default null,
  contact text default null, lang text default 'ko', page text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare th chat_threads; b bookings; n int; quiet boolean; bcode text;
begin
  body := btrim(coalesce(body, ''));
  if length(body) = 0 then raise exception '메시지를 적어 주세요'; end if;
  if length(body) > 2000 then raise exception '메시지가 너무 길어요 (2000자까지)'; end if;
  th := chat_find(t, bt);
  if th.id is null then
    if coalesce(bt, '') <> '' then select * into b from bookings where customer_token = bt; end if;
    insert into chat_threads (user_id, booking_id, name, contact, lang, page)
    values (auth.uid(), b.id, left(coalesce(nullif(btrim(name), ''), b.customer_name), 60), left(coalesce(nullif(btrim(contact), ''), b.contact), 100),
            coalesce(nullif(lang, ''), b.lang, 'ko'), left(page, 80))
    returning * into th;
  else
    select count(*) into n from chat_messages where thread_id = th.id and sender = 'guest' and created_at > now() - interval '10 minutes';
    if n >= 30 then raise exception '잠시 뒤에 다시 보내 주세요'; end if;
    update chat_threads set name = coalesce(nullif(left(btrim(chat_send.name), 60), ''), chat_threads.name),
      contact = coalesce(nullif(left(btrim(chat_send.contact), 100), ''), chat_threads.contact),
      user_id = coalesce(chat_threads.user_id, auth.uid())
    where id = th.id;
  end if;
  -- 손님 메시지는 하나도 빠짐없이 슬랙으로 보내요 (예전: 3분 안에 연달아 보내면 생략 → 알림을 놓치는 일이 있었어요)
  -- 도배는 위의 '10분에 30개' 제한이 막아요
  quiet := false;
  insert into chat_messages (thread_id, sender, body) values (th.id, 'guest', body);
  update chat_threads set last_at = now(), last_from = 'guest', last_body = left(body, 200), status = 'open', guest_seen_at = now() where id = th.id;
  select * into th from chat_threads where id = th.id;
  if not quiet then
    select code into bcode from bookings where id = th.booking_id;
    perform slack_send('chat', '💬 사이트 채팅 · *' || coalesce(th.name, '손님') || '*' || coalesce(' (' || bcode || ')', '')
      || ' · ' || case th.lang when 'en' then '🇬🇧' when 'vi' then '🇻🇳' else '🇰🇷' end
      || E'\n> ' || replace(left(body, 300), E'\n', E'\n> ')
      || E'\n<https://www.uncleday.com/admin.html#chat|👉 관리자에서 답장하기>');
  end if;
  return chat_view(th, 0);
end $$;
revoke all on function public.chat_send(text, text, text, text, text, text, text) from public;
grant execute on function public.chat_send(text, text, text, text, text, text, text) to anon, authenticated;
update public.slack_cfg set events = array_append(events, 'chat') where id = 1 and not ('chat' = any(events));

-- ===============================================================
-- universe55: 💬 채팅 손님이 어떤 화면을 보다가 문의했는지 · 어디서 왔는지 (구글 · 네이버 · 카톡 …)
--  · 손님 화면이 '지금 화면 | 처음 들어온 화면 | 들어온 곳 | 최근 본 화면' 을 보내요 → 관리자 채팅 위쪽에 표시
--  · 바뀐 것: page 칸 길이 80 → 300 자 (함수 내용은 그대로)
-- Supabase → SQL Editor 에 붙여 넣고 Run (여러 번 실행해도 괜찮아요)
-- ===============================================================

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
            coalesce(nullif(lang, ''), b.lang, 'ko'), left(page, 300))
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
  -- 🤖 자동 인사: 손님이 말을 걸었는데 최근 12시간 안에 엉클데이 쪽 메시지가 없으면 바로 인사를 보내요 (손님 언어로)
  perform chat_greet(th.id, th.lang);
  update chat_threads set last_at = now(), last_from = 'guest', last_body = left(body, 200), status = 'open', guest_seen_at = now() where id = th.id;
  select * into th from chat_threads where id = th.id;
  if not quiet then
    select code into bcode from bookings where id = th.booking_id;
    perform slack_send('chat', '💬 사이트 채팅 · *' || coalesce(th.name, '손님') || '*' || coalesce(' (' || bcode || ')', '')
      || ' · ' || case th.lang when 'en' then '🇬🇧' when 'vi' then '🇻🇳' when 'ko' then '🇰🇷' when 'ja' then '🇯🇵' when 'zh' then '🇨🇳' when 'zh-TW' then '🇹🇼' when 'ru' then '🇷🇺' when 'fr' then '🇫🇷' when 'de' then '🇩🇪' when 'es' then '🇪🇸' when 'hi' then '🇮🇳' when 'th' then '🇹🇭' when 'id' then '🇮🇩' else '🌐 ' || coalesce(th.lang, '') end
      || E'\n> ' || replace(left(body, 300), E'\n', E'\n> ')
      || E'\n<https://www.uncleday.com/admin.html#chat/' || th.id || '|👉 이 손님 대화 바로 열기>');
  end if;
  return chat_view(th, 0);
end $$;

create or replace function public.chat_send_att(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare th chat_threads; b bookings; n int; a jsonb; body text; bcode text; img boolean; quiet boolean; gn int;
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
            coalesce(nullif(p ->> 'lang', ''), b.lang, 'ko'), left(p ->> 'page', 300))
    returning * into th;
  else
    select count(*) into n from chat_messages where thread_id = th.id and sender = 'guest' and created_at > now() - interval '10 minutes';
    if n >= 30 then raise exception '잠시 뒤에 다시 보내 주세요'; end if;
    select count(*) into n from chat_messages where thread_id = th.id and sender = 'guest' and att is not null and created_at > now() - interval '1 hour';
    if n >= 40 then raise exception '파일은 1시간에 40개까지 보낼 수 있어요'; end if;
  end if;
  -- 묶음의 두 번째 사진부터는 슬랙 알림을 또 보내지 않아요 (첫 장에서 "사진 N장" 으로 한 번만)
  quiet := (a ? 'g') and exists (select 1 from chat_messages where thread_id = th.id and att ->> 'g' = a ->> 'g');
  insert into chat_messages (thread_id, sender, body, att) values (th.id, 'guest', body, a);
  perform chat_greet(th.id, th.lang);
  update chat_threads set last_at = now(), last_from = 'guest', last_body = left(case when body = '📷' then '📷 사진' when body like '📄 %' then body when img then '📷 ' || body else '📄 ' || body end, 200), status = 'open', guest_seen_at = now() where id = th.id;
  select * into th from chat_threads where id = th.id;
  if quiet then return chat_view(th, 0); end if;
  gn := least(greatest(coalesce(nullif(regexp_replace(coalesce(p ->> 'gn', ''), '[^0-9]', '', 'g'), '')::int, 1), 1), 30);
  select code into bcode from bookings where id = th.booking_id;
  perform slack_send('chat', '💬 사이트 채팅 · *' || coalesce(th.name, '손님') || '*' || coalesce(' (' || bcode || ')', '')
    || E'\n> 📎 ' || case when img and gn > 1 then '사진 ' || gn || '장을 보냈어요' when img then '사진을 보냈어요' else '파일을 보냈어요: ' || (a ->> 'n') end
    || case when body not in ('📷') and body not like '📄 %' then E'\n> ' || replace(left(body, 300), E'\n', E'\n> ') else '' end
    || E'\n<https://www.uncleday.com/admin.html#chat/' || th.id || '|👉 이 손님 대화 바로 열기>');
  return chat_view(th, 0);
end $$;

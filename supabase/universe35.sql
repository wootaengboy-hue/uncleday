-- ===============================================================
-- universe35: 🤖 채팅 자동 인사 + ⚡ 답장 · 예약 확정 속도 (실제 기록으로만)
--  · 손님이 채팅을 걸면 (최근 12시간 안에 엉클데이 쪽 메시지가 없을 때) 손님 언어로 인사가 바로 나가요
--    밤(한국 시간 23시 ~ 아침 8시)에는 '아침에 먼저 확인할게요' 한 줄을 더해요
--    문구는 관리자 → 채팅 → ⚙️ 자동 인사에서 고치거나 끌 수 있어요 (settings 'chat_greet')
--  · 자동 인사는 '답장 대기' 상태를 바꾸지 않아요 (담당자가 직접 답해야 처리됨)
--  · chat_speed(): 최근 30일 손님 메시지 → 담당자 첫 답장까지 걸린 시간의 가운데 값 (자동 인사 제외)
--  · shop_speed(): 최근 120일 예약 요청 → 확정까지 걸린 시간의 가운데 값 (업체별, 3건 이상만)
-- Supabase → SQL Editor 에 붙여 넣고 Run (여러 번 실행해도 괜찮아요)
-- ===============================================================

insert into public.settings (key, value) values ('chat_greet', '{"on": true, "day": {"ko": "안녕하세요, 엉클데이예요 😊 메시지 잘 받았어요. 담당자가 확인하고 곧 답해 드릴게요. 이 창을 닫아도 대화는 그대로 남아요.", "en": "Hi, this is Uncle Day 😊 We got your message. Our team will check it and reply shortly. You can close this window — the conversation stays here.", "vi": "Xin chào, Uncle Day đây ạ 😊 Chúng tôi đã nhận được tin nhắn. Nhân viên sẽ kiểm tra và trả lời ngay. Bạn có thể đóng cửa sổ này — cuộc trò chuyện vẫn được lưu lại.", "ja": "こんにちは、Uncle Day です 😊 メッセージを受け取りました。担当者が確認して、すぐにお返事します。この画面を閉じても会話は残ります。", "zh": "您好，这里是 Uncle Day 😊 我们已收到您的消息，工作人员确认后会尽快回复。关闭此窗口后对话也会保留。", "zh-TW": "您好，這裡是 Uncle Day 😊 我們已收到您的訊息，工作人員確認後會盡快回覆。關閉此視窗後對話也會保留。", "ru": "Здравствуйте, это Uncle Day 😊 Мы получили ваше сообщение. Сотрудник проверит его и скоро ответит. Окно можно закрыть — переписка сохранится.", "fr": "Bonjour, ici Uncle Day 😊 Nous avons bien reçu votre message. Notre équipe le vérifie et vous répond très vite. Vous pouvez fermer cette fenêtre : la conversation est conservée.", "de": "Hallo, hier ist Uncle Day 😊 Wir haben Ihre Nachricht erhalten. Unser Team prüft sie und antwortet in Kürze. Sie können dieses Fenster schließen – der Chat bleibt gespeichert.", "es": "Hola, somos Uncle Day 😊 Hemos recibido tu mensaje. Nuestro equipo lo revisará y te responderá enseguida. Puedes cerrar esta ventana: la conversación se guarda.", "hi": "नमस्ते, यह Uncle Day है 😊 हमें आपका संदेश मिल गया है। हमारी टीम इसे देखकर जल्द ही जवाब देगी। आप यह विंडो बंद कर सकते हैं — बातचीत सेव रहेगी।", "th": "สวัสดีค่ะ Uncle Day ยินดีให้บริการ 😊 เราได้รับข้อความของคุณแล้ว เจ้าหน้าที่จะตรวจสอบและตอบกลับโดยเร็ว ปิดหน้าต่างนี้ได้เลย บทสนทนาจะยังอยู่", "id": "Halo, ini Uncle Day 😊 Pesan Anda sudah kami terima. Tim kami akan mengecek dan segera membalas. Anda boleh menutup jendela ini — percakapan tetap tersimpan."}, "night": {"ko": "지금은 밤 시간이라 답장이 조금 늦을 수 있어요. 아침에 가장 먼저 확인해 드릴게요.", "en": "It''s night time here, so our reply may take a little longer. We''ll check it first thing in the morning.", "vi": "Bây giờ là ban đêm nên có thể trả lời chậm hơn một chút. Sáng mai chúng tôi sẽ kiểm tra đầu tiên.", "ja": "現在は夜間のため、お返事が少し遅れることがあります。朝いちばんに確認します。", "zh": "现在是夜间，回复可能会稍晚一些，我们早上会第一时间处理。", "zh-TW": "現在是夜間，回覆可能會稍晚一些，我們早上會第一時間處理。", "ru": "Сейчас ночь, поэтому ответ может занять чуть больше времени. Утром мы проверим его в первую очередь.", "fr": "Il fait nuit chez nous, la réponse peut prendre un peu plus de temps. Nous la traiterons en priorité demain matin.", "de": "Bei uns ist gerade Nacht, daher kann die Antwort etwas länger dauern. Wir kümmern uns morgen früh als Erstes darum.", "es": "Ahora es de noche aquí, así que la respuesta puede tardar un poco más. Lo revisaremos a primera hora de la mañana.", "hi": "अभी यहाँ रात है, इसलिए जवाब में थोड़ा समय लग सकता है। सुबह सबसे पहले हम इसे देखेंगे।", "th": "ตอนนี้เป็นเวลากลางคืน อาจตอบช้ากว่าปกติเล็กน้อย เราจะตรวจสอบเป็นอันดับแรกในตอนเช้า", "id": "Saat ini sudah malam di sini, jadi balasan mungkin sedikit lebih lama. Kami akan mengeceknya pertama kali besok pagi."}}'::jsonb)
on conflict (key) do nothing;

create or replace function public.chat_greet(p_thread uuid, p_lang text) returns void
language plpgsql security definer set search_path = public as $$
declare g jsonb; l text; txt text; hr int;
begin
  select value into g from settings where key = 'chat_greet';
  if g is null or coalesce((g ->> 'on')::boolean, true) = false then return; end if;
  if exists (select 1 from chat_messages where thread_id = p_thread and sender = 'admin' and created_at > now() - interval '12 hours') then return; end if;
  l := case when g -> 'day' ? coalesce(p_lang, '') then p_lang when g -> 'day' ? 'en' and coalesce(p_lang, 'ko') <> 'ko' then 'en' else 'ko' end;
  txt := nullif(btrim(g -> 'day' ->> l), '');
  if txt is null then return; end if;
  hr := extract(hour from now() at time zone 'Asia/Seoul');
  if (hr >= 23 or hr < 8) and nullif(btrim(g -> 'night' ->> l), '') is not null then txt := txt || E'\n' || (g -> 'night' ->> l); end if;
  insert into chat_messages (thread_id, sender, author, body) values (p_thread, 'admin', '🤖 자동 인사', left(txt, 2000));
end $$;
revoke all on function public.chat_greet(uuid, text) from public, anon, authenticated;

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

-- ⚡ 채팅 답장 속도 (누구나 읽기 · 숫자만)
create or replace function public.chat_speed() returns jsonb
language sql stable security definer set search_path = public as $$
  with g as (   -- 손님이 말을 시작한 메시지 (바로 앞이 손님 메시지가 아닌 것)
    select m.id, m.thread_id, m.created_at from chat_messages m
    where m.sender = 'guest' and m.created_at > now() - interval '30 days'
      and coalesce((select p.sender from chat_messages p where p.thread_id = m.thread_id and p.id < m.id order by p.id desc limit 1), 'admin') <> 'guest'
  ), r as (
    select g.id, extract(epoch from (select min(a.created_at) from chat_messages a
      where a.thread_id = g.thread_id and a.id > g.id and a.sender = 'admin' and coalesce(a.author, '') <> '🤖 자동 인사') - g.created_at) / 60 as mins
    from g
  )
  select jsonb_build_object('n', count(mins), 'min', round(percentile_cont(0.5) within group (order by mins)::numeric, 0))
  from r where mins is not null and mins < 7 * 24 * 60
$$;
grant execute on function public.chat_speed() to anon, authenticated;

-- ⚡ 업체별 예약 확정 속도 (누구나 읽기 · 3건 이상인 업체만)
create or replace function public.shop_speed() returns jsonb
language sql stable security definer set search_path = public as $$
  with c as (
    select b.shop_id, extract(epoch from (min(e.at) - b.created_at)) / 60 as mins
    from bookings b join booking_events e on e.booking_id = b.id and e.action = 'status' and e.detail -> 'status' ->> 1 = 'confirmed'
    where b.created_at > now() - interval '120 days' and b.shop_id is not null
    group by b.id, b.shop_id, b.created_at
  ), s as (
    select shop_id, count(*) n, round(percentile_cont(0.5) within group (order by mins)::numeric, 0) m from c where mins >= 0 and mins < 7 * 24 * 60 group by shop_id
  )
  select coalesce(jsonb_object_agg(shop_id, jsonb_build_object('n', n, 'min', m)), '{}'::jsonb) from s where n >= 3
$$;
grant execute on function public.shop_speed() to anon, authenticated;

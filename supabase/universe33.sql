-- ============================================================
-- 56. 🌐 손님 사이트 다국어 (일본어 · 중국어 간체/번체 · 러시아어 · 프랑스어 · 독일어 · 스페인어 · 힌디어 · 태국어 · 인도네시아어)
--  · 한국어 · 영어 · 베트남어는 직접 번역해 둔 그대로 쓰고, 나머지 10개 언어는 AI(Claude)로 번역해 여기에 저장해요.
--  · 관리자 → 포털 → 🌐 다국어 번역에서 [빠진 번역 모두 만들기]를 누르면 채워져요 (Edge Function 'i18n-tr').
--  · 누구나 읽을 수 있어요 (손님 화면이 읽어야 하니까) · 쓰기는 관리자만.
--  · key: 'ui' 화면 문구 · 'site' 지역/카테고리 등 · 'shop:<업체 id>' 업체 내용 / src_hash: 원문이 바뀌었는지 비교용
-- universe32.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

create table if not exists public.i18n_tr (
  key        text not null,
  lang       text not null check (lang ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  tr         jsonb not null default '{}'::jsonb,
  src_hash   text,
  model      text,
  updated_at timestamptz not null default now(),
  primary key (key, lang)
);
alter table public.i18n_tr enable row level security;
drop policy if exists "i18n_tr read" on public.i18n_tr;
create policy "i18n_tr read" on public.i18n_tr for select to anon, authenticated using (true);
drop policy if exists "i18n_tr admin" on public.i18n_tr;
create policy "i18n_tr admin" on public.i18n_tr for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.i18n_tr to anon, authenticated;
grant insert, update, delete on public.i18n_tr to authenticated;


-- 새 언어(일본어 · 러시아어 등)로 예약한 손님에게는 예약 진행 메시지를 영어로 보내요 (예전엔 한국어로 갔어요)
-- 채팅 담당자는 🌐 자동 번역으로 손님 말로 답할 수 있어요. 슬랙 알림에는 그 나라 국기가 붙어요.
create or replace function public.chat_fmt(b public.bookings) returns text
language sql stable set search_path = public as $$
  select case case when b.lang is null or b.lang in ('ko', 'vi') then coalesce(b.lang, 'ko') else 'en' end
    when 'en' then coalesce(to_char(b.visit_date, 'Dy, Mon DD'), '-') || ' ' || coalesce(b.visit_time, '')
    when 'vi' then coalesce(to_char(b.visit_date, 'DD/MM'), '-') || ' ' || coalesce(b.visit_time, '')
    else coalesce(to_char(b.visit_date, 'FMMM/FMDD') || '(' || (array['일','월','화','수','목','금','토'])[extract(dow from b.visit_date)::int + 1] || ')', '-') || ' ' ||
         coalesce(case when b.visit_time ~ '^\d{2}:\d{2}$' then (case when left(b.visit_time, 2)::int < 12 then '오전 ' else '오후 ' end) ||
           (case when left(b.visit_time, 2)::int % 12 = 0 then 12 else left(b.visit_time, 2)::int % 12 end)::text || ':' || right(b.visit_time, 2) end, b.visit_time, '')
  end
$$;

create or replace function public.chat_booking_msg(b public.bookings, kind text) returns text
language plpgsql stable set search_path = public as $$
declare l text := case when b.lang is null or b.lang in ('ko', 'vi') then coalesce(b.lang, 'ko') else 'en' end; link text := 'https://www.uncleday.com/booking.html?v=2#' || b.customer_token;
        d text := chat_fmt(b); s text := coalesce(b.shop_name, ''); offers text;
begin
  select string_agg(x.n::text || ') ' ||
           chat_fmt(jsonb_populate_record(b, jsonb_build_object('visit_date', x.o ->> 'date', 'visit_time', x.o ->> 'time'))), E'\n' order by x.n)
    into offers from jsonb_array_elements(coalesce(b.offer_times, '[]'::jsonb)) with ordinality as x(o, n);
  if kind = 'new' then return case l
    when 'en' then '📥 We got your booking request (' || b.code || E')\n' || s || ' · ' || d || ' · ' || b.people || E' guest(s)\nWe''re checking with the shop now and will confirm shortly. Ask us anything here.'
    when 'vi' then '📥 Đã nhận yêu cầu đặt lịch (' || b.code || E')\n' || s || ' · ' || d || ' · ' || b.people || E' người\nChúng tôi đang kiểm tra với cơ sở và sẽ sớm xác nhận. Có câu hỏi cứ nhắn tại đây.'
    else '📥 예약 요청을 받았어요 (' || b.code || E')\n' || s || ' · ' || d || ' · ' || b.people || E'명\n업체에 바로 확인하고 신속하게 확정 안내드릴게요. 궁금한 점은 여기로 편하게 물어보세요.' end;
  elsif kind = 'confirmed' then return case l
    when 'en' then '✅ Your booking is confirmed! (' || b.code || E')\n' || s || ' · ' || d || ' · ' || b.people || E' guest(s)\nWhen you arrive, show your voucher and tap 📍 Check in.\n' || link
    when 'vi' then '✅ Lịch hẹn đã được xác nhận! (' || b.code || E')\n' || s || ' · ' || d || ' · ' || b.people || E' người\nKhi đến, hãy đưa phiếu và bấm 📍 Check-in.\n' || link
    else '✅ 예약이 확정됐어요! (' || b.code || E')\n' || s || ' · ' || d || ' · ' || b.people || E'명\n도착하면 예약확인증을 업체에 보여 주고 📍 체크인을 눌러 주세요.\n' || link end;
  elsif kind = 'reschedule' then return case l
    when 'en' then '🔁 Sorry, the shop can''t take ' || d || E' 🙏\nAvailable times:\n' || coalesce(offers, '-') || E'\nTap the one you want on your voucher, or reply here.\n' || link
    when 'vi' then '🔁 Xin lỗi, cơ sở không nhận được ' || d || E' 🙏\nGiờ có thể nhận:\n' || coalesce(offers, '-') || E'\nBấm chọn giờ trong phiếu hoặc trả lời tại đây.\n' || link
    else '🔁 요청하신 ' || d || E'은 업체 사정으로 어려워요 🙏\n가능한 시간:\n' || coalesce(offers, '-') || E'\n예약확인증에서 원하는 시간을 누르시거나 여기로 답해 주세요.\n' || link end;
  elsif kind = 'moved' then return case l
    when 'en' then '🔁 We got your new time: ' || d || '. We''re checking with the shop again.'
    when 'vi' then '🔁 Đã nhận giờ mới: ' || d || '. Chúng tôi đang kiểm tra lại với cơ sở.'
    else '🔁 ' || d || '(으)로 변경 요청을 받았어요. 업체에 다시 확인할게요.' end;
  elsif kind = 'cancelled' then return case l
    when 'en' then 'Your booking ' || b.code || ' has been cancelled. If you''d like another date, just tell us here.'
    when 'vi' then 'Lịch hẹn ' || b.code || ' đã được hủy. Nếu muốn đặt ngày khác, hãy nhắn cho chúng tôi.'
    else '예약 ' || b.code || '이(가) 취소됐어요. 다른 날짜로 다시 예약하고 싶으시면 여기로 말씀해 주세요.' end;
  end if;
  return null;
end $$;

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
      || ' · ' || case th.lang when 'en' then '🇬🇧' when 'vi' then '🇻🇳' when 'ko' then '🇰🇷' when 'ja' then '🇯🇵' when 'zh' then '🇨🇳' when 'zh-TW' then '🇹🇼' when 'ru' then '🇷🇺' when 'fr' then '🇫🇷' when 'de' then '🇩🇪' when 'es' then '🇪🇸' when 'hi' then '🇮🇳' when 'th' then '🇹🇭' when 'id' then '🇮🇩' else '🌐 ' || coalesce(th.lang, '') end
      || E'\n> ' || replace(left(body, 300), E'\n', E'\n> ')
      || E'\n<https://www.uncleday.com/admin.html#chat/' || th.id || '|👉 이 손님 대화 바로 열기>');
  end if;
  return chat_view(th, 0);
end $$;

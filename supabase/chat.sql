-- 사이트 채팅 + 손님 로그인(카카오·페이스북·구글·네이버)
-- Supabase SQL Editor에 통째로 붙여 넣고 Run 하세요. 여러 번 실행해도 괜찮아요.

-- 0) 안전장치: 관리자 자동 등록은 '이메일·비밀번호' 로그인만 (소셜 로그인 이메일로 관리자가 되는 일 막기)
create or replace function public.claim_admin() returns boolean
language plpgsql security definer set search_path = public as $$
declare em text := lower(coalesce(auth.jwt() ->> 'email', ''));
        prov text := coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', 'email');
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from admins where user_id = auth.uid()) then return true; end if;
  if prov <> 'email' then return false; end if;
  if not exists (select 1 from admins) or exists (select 1 from admin_emails where lower(email) = em) then
    insert into admins (user_id, email) values (auth.uid(), em) on conflict do nothing;
    return true;
  end if;
  return false;
end $$;

-- 1) 예약에 '누가 했는지(로그인한 손님)' 기록
alter table public.bookings add column if not exists user_id uuid references auth.users on delete set null;
create index if not exists bookings_user_idx on public.bookings (user_id);
create or replace function public.bookings_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is null and auth.uid() is not null and not is_admin() then new.user_id := auth.uid(); end if;
  return new;
end $$;
drop trigger if exists bookings_owner on public.bookings;
create trigger bookings_owner before insert on public.bookings for each row execute function public.bookings_owner();

-- 로그인한 손님의 내 예약 목록
create or replace function public.my_bookings() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('code', code, 'status', status, 'shop_name', shop_name, 'shop_id', shop_id,
    'visit_date', visit_date, 'visit_time', visit_time, 'menu_name', menu_name, 'people', people, 't', customer_token) order by created_at desc), '[]'::jsonb)
  from bookings where auth.uid() is not null and user_id = auth.uid()
$$;

-- 2) 채팅
create table if not exists public.chat_threads (
  id            uuid primary key default gen_random_uuid(),
  token         text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  user_id       uuid references auth.users on delete set null,
  booking_id    uuid references public.bookings on delete set null,
  name          text,
  contact       text,
  lang          text not null default 'ko',
  page          text,
  status        text not null default 'open' check (status in ('open', 'closed')),
  created_at    timestamptz not null default now(),
  last_at       timestamptz not null default now(),
  last_from     text,
  last_body     text,
  guest_seen_at timestamptz,
  admin_seen_at timestamptz
);
create unique index if not exists chat_threads_booking_uq on public.chat_threads (booking_id) where booking_id is not null;
create index if not exists chat_threads_user_idx on public.chat_threads (user_id);
create index if not exists chat_threads_last_idx on public.chat_threads (last_at desc);
create table if not exists public.chat_messages (
  id         bigserial primary key,
  thread_id  uuid not null references public.chat_threads on delete cascade,
  sender     text not null check (sender in ('guest', 'admin')),
  author     text,
  body       text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_thread_idx on public.chat_messages (thread_id, id);
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
drop policy if exists admin_all on public.chat_threads;
create policy admin_all on public.chat_threads for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_all on public.chat_messages;
create policy admin_all on public.chat_messages for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 손님이 볼 대화방 찾기: 예약 링크(bt) > 로그인 > 브라우저에 저장된 열쇠(t)
create or replace function public.chat_find(t text, bt text) returns public.chat_threads
language plpgsql security definer set search_path = public as $$
declare th chat_threads; b bookings;
begin
  if coalesce(bt, '') <> '' then
    select * into b from bookings where customer_token = bt;
    if found then select * into th from chat_threads where booking_id = b.id; return th; end if;
  end if;
  if coalesce(t, '') <> '' and length(t) >= 32 then
    select * into th from chat_threads where token = t;
    if found then return th; end if;
  end if;
  if auth.uid() is not null then
    select * into th from chat_threads where user_id = auth.uid() and booking_id is null order by last_at desc limit 1;
  end if;
  return th;
end $$;
revoke all on function public.chat_find(text, text) from public, anon, authenticated;

create or replace function public.chat_view(th public.chat_threads, since bigint) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when th.id is null then jsonb_build_object('token', null, 'messages', '[]'::jsonb) else jsonb_build_object(
    'token', th.token, 'name', th.name, 'contact', th.contact, 'booking', (select code from bookings where id = th.booking_id),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'from', m.sender, 'body', m.body, 'at', m.created_at) order by m.id)
                          from chat_messages m where m.thread_id = th.id and m.id > coalesce(since, 0)), '[]'::jsonb),
    'unread', (select count(*) from chat_messages m where m.thread_id = th.id and m.sender = 'admin' and m.created_at > coalesce(th.guest_seen_at, 'epoch'))) end
$$;
revoke all on function public.chat_view(public.chat_threads, bigint) from public, anon, authenticated;

-- 손님: 대화 불러오기 (seen = 창을 열어 보고 있으면 읽음 처리)
create or replace function public.chat_get(t text default null, bt text default null, since bigint default 0, seen boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare th chat_threads; v jsonb;
begin
  th := chat_find(t, bt);
  if th.id is null then return jsonb_build_object('token', null, 'messages', '[]'::jsonb, 'unread', 0); end if;
  if auth.uid() is not null and th.user_id is null then update chat_threads set user_id = auth.uid() where id = th.id; end if;
  v := chat_view(th, since);
  if seen then update chat_threads set guest_seen_at = now() where id = th.id; v := v || jsonb_build_object('unread', 0); end if;
  return v;
end $$;

-- 손님: 메시지 보내기 (대화방이 없으면 만들어요)
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
  -- 바로 앞 손님 메시지가 3분 안이고 그사이 관리자 답이 없으면 슬랙은 생략 (도배 방지)
  quiet := exists (select 1 from chat_messages m where m.thread_id = th.id and m.created_at > now() - interval '3 minutes'
                   and m.sender = 'guest' and not exists (select 1 from chat_messages a where a.thread_id = th.id and a.sender = 'admin' and a.id > m.id));
  insert into chat_messages (thread_id, sender, body) values (th.id, 'guest', body);
  update chat_threads set last_at = now(), last_from = 'guest', last_body = left(body, 200), status = 'open', guest_seen_at = now() where id = th.id;
  select * into th from chat_threads where id = th.id;
  if not quiet then
    select code into bcode from bookings where id = th.booking_id;
    perform slack_send('chat', '💬 사이트 채팅 · ' || coalesce(th.name, '손님') || coalesce(' (' || bcode || ')', '') || E'\n> ' || replace(left(body, 200), E'\n', ' '));
  end if;
  return chat_view(th, 0);
end $$;

-- 관리자: 답장 (보낸 사람 이름 기록)
create or replace function public.chat_reply(thread uuid, body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception '관리자만 할 수 있어요'; end if;
  body := btrim(coalesce(body, ''));
  if length(body) = 0 or length(body) > 2000 then raise exception '메시지를 확인해 주세요'; end if;
  insert into chat_messages (thread_id, sender, author, body) values (thread, 'admin', nick(actor_name()), body);
  update chat_threads set last_at = now(), last_from = 'admin', last_body = left(body, 200), admin_seen_at = now() where id = thread;
end $$;

revoke all on function public.chat_get(text, text, bigint, boolean), public.chat_send(text, text, text, text, text, text, text), public.my_bookings() from public;
grant execute on function public.chat_get(text, text, bigint, boolean), public.chat_send(text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.my_bookings() to authenticated;
revoke all on function public.chat_reply(uuid, text) from public, anon;
grant execute on function public.chat_reply(uuid, text) to authenticated;

-- 3) 예약 진행 상황을 손님의 사이트 채팅창에 자동으로 남기기
create or replace function public.chat_fmt(b public.bookings) returns text
language sql stable set search_path = public as $$
  select case coalesce(b.lang, 'ko')
    when 'en' then coalesce(to_char(b.visit_date, 'Dy, Mon DD'), '-') || ' ' || coalesce(b.visit_time, '')
    when 'vi' then coalesce(to_char(b.visit_date, 'DD/MM'), '-') || ' ' || coalesce(b.visit_time, '')
    else coalesce(to_char(b.visit_date, 'FMMM/FMDD') || '(' || (array['일','월','화','수','목','금','토'])[extract(dow from b.visit_date)::int + 1] || ')', '-') || ' ' ||
         coalesce(case when b.visit_time ~ '^\d{2}:\d{2}$' then (case when left(b.visit_time, 2)::int < 12 then '오전 ' else '오후 ' end) ||
           (case when left(b.visit_time, 2)::int % 12 = 0 then 12 else left(b.visit_time, 2)::int % 12 end)::text || ':' || right(b.visit_time, 2) end, b.visit_time, '')
  end
$$;

-- 예약 대화방을 찾거나 만들고, 엉클데이 이름으로 메시지를 남겨요
create or replace function public.chat_post_booking(bid uuid, body text) returns void
language plpgsql security definer set search_path = public as $$
declare b bookings; th chat_threads;
begin
  select * into b from bookings where id = bid; if not found then return; end if;
  select * into th from chat_threads where booking_id = bid;
  if not found then
    insert into chat_threads (user_id, booking_id, name, contact, lang, page)
    values (b.user_id, b.id, left(b.customer_name, 60), left(b.contact, 100), coalesce(b.lang, 'ko'), b.shop_id)
    returning * into th;
  end if;
  insert into chat_messages (thread_id, sender, author, body) values (th.id, 'admin', '엉클데이 (자동 안내)', left(body, 2000));
  update chat_threads set last_at = now(), last_from = 'admin', last_body = left(body, 200), status = 'open', admin_seen_at = now() where id = th.id;
end $$;
revoke all on function public.chat_post_booking(uuid, text) from public, anon, authenticated;

create or replace function public.chat_booking_msg(b public.bookings, kind text) returns text
language plpgsql stable set search_path = public as $$
declare l text := coalesce(b.lang, 'ko'); link text := 'https://www.uncleday.com/booking.html?v=2#' || b.customer_token;
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

create or replace function public.bookings_chat() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if tg_op = 'INSERT' then k := 'new';
  elsif new.status is distinct from old.status then
    k := case new.status when 'confirmed' then 'confirmed' when 'reschedule' then 'reschedule' when 'cancelled' then 'cancelled'
           when 'requested' then case when old.status = 'reschedule' then 'moved' end end;
  end if;
  if k is not null then
    begin perform chat_post_booking(new.id, chat_booking_msg(new, k));
    exception when others then null;   -- 채팅이 안 돼도 예약 처리는 절대 막지 않아요
    end;
  end if;
  return null;
end $$;
drop trigger if exists bookings_chat on public.bookings;
create trigger bookings_chat after insert or update of status on public.bookings for each row execute function public.bookings_chat();

-- 관리자: 예약 대화방에 메시지 남기기 (안부 메시지 등)
create or replace function public.chat_booking_reply(bid uuid, body text) returns void
language plpgsql security definer set search_path = public as $$
declare th chat_threads;
begin
  if not is_admin() then raise exception '관리자만 할 수 있어요'; end if;
  perform chat_post_booking(bid, body);
  select * into th from chat_threads where booking_id = bid;
  update chat_messages set author = nick(actor_name()) where id = (select max(id) from chat_messages where thread_id = th.id);
end $$;
revoke all on function public.chat_booking_reply(uuid, text) from public, anon;
grant execute on function public.chat_booking_reply(uuid, text) to authenticated;

-- 슬랙: 채팅 알림 종류 추가
update public.slack_cfg set events = array_append(events, 'chat') where id = 1 and not ('chat' = any(events));
alter table public.slack_cfg alter column events set default array['booking','shop','customer','review','team','lead','chat'];

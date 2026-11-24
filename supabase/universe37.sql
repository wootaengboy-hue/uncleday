-- ===============================================================
-- universe37: 📋 시술 전 질문 (손님 → 가게)
--  · 예약이 확정되면 손님이 예약확인증에서 알레르기 · 복용 약 · 임신 여부 등 가게가 정한 질문에 답해요
--  · 질문: 업종별 기본 질문(data.js SURVEY_TPL) + 가게가 끄거나 더한 질문 (shops.data -> 'survey')
--      { on: 켜기(기본 켜짐), req: 꼭 작성, off: [끈 기본 질문], custom: [가게가 더한 질문] }
--  · 답은 건강 정보라 따로 잠가 둬요: 손님 본인(예약확인증 열쇠) · 그 가게 사장님/직원 · 관리자(전부)만. 현장 영업 직원은 못 봐요
--  · 손님이 '동의'해야 저장돼요. 방문일 30일 뒤 자동으로 지워지고, 예약이 취소되면 바로 지워져요. 손님이 직접 지울 수도 있어요
-- Supabase → SQL Editor 에 붙여 넣고 Run (여러 번 실행해도 괜찮아요)
-- ===============================================================

create table if not exists public.booking_surveys (
  booking_id  uuid primary key references public.bookings(id) on delete cascade,
  shop_id     text,
  answers     jsonb not null default '{}'::jsonb,
  lang        text,
  consent_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.booking_surveys enable row level security;
drop policy if exists admin_read on public.booking_surveys;
create policy admin_read on public.booking_surveys for select to authenticated using (public.is_admin());

-- 오래된 답 지우기 (방문 30일 뒤 · 취소/거절된 예약)
create or replace function public.survey_purge() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from booking_surveys s using bookings b
   where b.id = s.booking_id and (b.visit_date < current_date - 30 or b.status in ('cancelled', 'rejected'));
  get diagnostics n = row_count; return n;
end $$;
revoke all on function public.survey_purge() from public, anon;
grant execute on function public.survey_purge() to authenticated;

-- 예약이 취소 · 거절되면 바로 지워요
create or replace function public.survey_on_cancel() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('cancelled', 'rejected') then delete from booking_surveys where booking_id = new.id; end if;
  return new;
end $$;
drop trigger if exists booking_surveys_cancel on public.bookings;
create trigger booking_surveys_cancel after update of status on public.bookings for each row execute function public.survey_on_cancel();

-- 손님: 내 답 보기 (예약확인증 열쇠)
-- (가게 업종 · 질문 설정도 같이 줘요 — 예약확인증이 질문 목록을 만들 때 써요)
create or replace function public.survey_get(t text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('answers', s.answers, 'updated_at', s.updated_at, 'cat', sh.data ->> 'cat', 'survey', coalesce(sh.data -> 'survey', '{}'::jsonb))
  from bookings b join shops sh on sh.id = b.shop_id left join booking_surveys s on s.booking_id = b.id where b.customer_token = t
$$;

-- 손님: 답 저장 (동의 필수 · 확정된 예약 · 방문일까지)
create or replace function public.survey_submit(t text, ans jsonb, consent boolean, lg text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b bookings; r booking_surveys;
begin
  select * into b from bookings where customer_token = t;
  if not found then raise exception 'Booking not found'; end if;
  if consent is not true then raise exception 'Consent is required'; end if;
  if b.status not in ('confirmed', 'shop_ok', 'reschedule') then raise exception 'You can answer after your booking is confirmed'; end if;
  if b.visit_date < (now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'This visit has already passed'; end if;
  if jsonb_typeof(ans) <> 'object' or length(ans::text) > 8000 then raise exception 'Answers are too long'; end if;
  insert into booking_surveys (booking_id, shop_id, answers, lang, consent_at)
  values (b.id, b.shop_id, ans, left(lg, 8), now())
  on conflict (booking_id) do update set answers = excluded.answers, lang = excluded.lang, consent_at = now(), updated_at = now()
  returning * into r;
  perform survey_purge();
  return jsonb_build_object('answers', r.answers, 'updated_at', r.updated_at);
end $$;

-- 손님: 내 답 지우기
create or replace function public.survey_delete(t text) returns void
language sql security definer set search_path = public as $$
  delete from booking_surveys s using bookings b where b.id = s.booking_id and b.customer_token = t
$$;
grant execute on function public.survey_get(text), public.survey_submit(text, jsonb, boolean, text), public.survey_delete(text) to anon, authenticated;

-- 사장님이 보는 예약 한 건에 '시술 전 질문 답'을 더해요 (손님 연락처 · 확인증 열쇠는 여전히 빼요)
create or replace function public.owner_row(b bookings) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', b.id, 'code', b.code, 'status', b.status, 'menu_name', b.menu_name, 'menu_min', b.menu_min,
    'menu', (select m from shops s, jsonb_array_elements(s.data -> 'menu') m where s.id = b.shop_id and m -> 'name' ->> 'ko' = b.menu_name limit 1),
    'people', b.people, 'list_price', b.list_price, 'visit_date', b.visit_date, 'visit_time', b.visit_time,
    'customer_name', b.customer_name, 'note', b.note, 'lang', b.lang, 'paid_amount', b.paid_amount,
    'proposed_times', b.proposed_times, 'offer_times', b.offer_times, 'created_at', b.created_at,
    'sent_to_shop_at', b.sent_to_shop_at, 'shop_replied_at', b.shop_replied_at,
    'survey', (select s.answers from booking_surveys s where s.booking_id = b.id),
    'survey_at', (select s.updated_at from booking_surveys s where s.booking_id = b.id))
$$;

-- 사장님: 질문 설정 저장 (사장님만 · 직원 ✕)
create or replace function public.owner_survey_save(shop text, cfg jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c jsonb; cu jsonb := '[]'::jsonb; x jsonb; i int := 0;
begin
  perform owner_check(shop, true);
  for x in select * from jsonb_array_elements(coalesce(cfg -> 'custom', '[]'::jsonb)) loop
    i := i + 1; exit when i > 10;
    if coalesce(btrim(x -> 'q' ->> 'vi'), btrim(x -> 'q' ->> 'ko'), btrim(x -> 'q' ->> 'en'), '') = '' then continue; end if;
    cu := cu || jsonb_build_object('id', left(coalesce(x ->> 'id', 'c' || i), 20), 'type', case when x ->> 'type' = 'yn' then 'yn' else 'text' end,
      'q', jsonb_strip_nulls(jsonb_build_object('vi', left(x -> 'q' ->> 'vi', 300), 'ko', left(x -> 'q' ->> 'ko', 300), 'en', left(x -> 'q' ->> 'en', 300))));
  end loop;
  c := jsonb_build_object('on', coalesce((cfg ->> 'on')::boolean, true), 'req', coalesce((cfg ->> 'req')::boolean, false),
    'off', coalesce((select jsonb_agg(v) from jsonb_array_elements_text(coalesce(cfg -> 'off', '[]'::jsonb)) v where v ~ '^[a-zA-Z0-9_]{1,20}$'), '[]'::jsonb),
    'custom', cu);
  update shops set data = jsonb_set(coalesce(data, '{}'::jsonb), '{survey}', c) where id = shop;
  return c;
end $$;
grant execute on function public.owner_survey_save(text, jsonb) to authenticated;

create or replace function public.chat_booking_msg(b public.bookings, kind text) returns text
language plpgsql stable set search_path = public as $$
declare l text := case when b.lang is null or b.lang in ('ko', 'vi') then coalesce(b.lang, 'ko') else 'en' end; link text := 'https://www.uncleday.com/booking.html?v=2#' || b.customer_token;
        sv jsonb := (select data -> 'survey' from shops where id = b.shop_id); svl text := '';
        d text := chat_fmt(b); s text := coalesce(b.shop_name, ''); offers text;
begin
  select string_agg(x.n::text || ') ' ||
           chat_fmt(jsonb_populate_record(b, jsonb_build_object('visit_date', x.o ->> 'date', 'visit_time', x.o ->> 'time'))), E'\n' order by x.n)
    into offers from jsonb_array_elements(coalesce(b.offer_times, '[]'::jsonb)) with ordinality as x(o, n);
  if kind = 'new' then return case l
    when 'en' then '📥 We got your booking request (' || b.code || E')\n' || s || ' · ' || d || ' · ' || b.people || E' guest(s)\nWe''re checking with the shop now and will confirm shortly. Ask us anything here.'
    when 'vi' then '📥 Đã nhận yêu cầu đặt lịch (' || b.code || E')\n' || s || ' · ' || d || ' · ' || b.people || E' người\nChúng tôi đang kiểm tra với cơ sở và sẽ sớm xác nhận. Có câu hỏi cứ nhắn tại đây.'
    else '📥 예약 요청을 받았어요 (' || b.code || E')\n' || s || ' · ' || d || ' · ' || b.people || E'명\n업체에 바로 확인하고 신속하게 확정 안내드릴게요. 궁금한 점은 여기로 편하게 물어보세요.' end;
  elsif kind = 'confirmed' then
    -- 📋 시술 전 질문이 켜진 가게면 한 줄 더 (universe37)
    if coalesce(sv ->> 'on', 'true') <> 'false' then
      svl := case l when 'en' then E'\n📋 Please fill in the short pre-visit questions (allergies etc.) on your voucher' || case when sv ->> 'req' = 'true' then ' — the shop needs them before your visit.' else '.' end
                    when 'vi' then E'\n📋 Vui lòng trả lời vài câu hỏi trước khi đến (dị ứng…) trong phiếu' || case when sv ->> 'req' = 'true' then ' — cơ sở cần trước khi bạn đến.' else '.' end
                    else E'\n📋 예약확인증에서 방문 전 질문(알레르기 등)을 작성해 주세요' || case when sv ->> 'req' = 'true' then ' — 가게에서 방문 전에 꼭 필요하다고 해요.' else '.' end end;
    end if;
    return (case l
    when 'en' then '✅ Your booking is confirmed! (' || b.code || E')\n' || s || ' · ' || d || ' · ' || b.people || E' guest(s)\nWhen you arrive, show your voucher and tap 📍 Check in.\n' || link
    when 'vi' then '✅ Lịch hẹn đã được xác nhận! (' || b.code || E')\n' || s || ' · ' || d || ' · ' || b.people || E' người\nKhi đến, hãy đưa phiếu và bấm 📍 Check-in.\n' || link
    else '✅ 예약이 확정됐어요! (' || b.code || E')\n' || s || ' · ' || d || ' · ' || b.people || E'명\n도착하면 예약확인증을 업체에 보여 주고 📍 체크인을 눌러 주세요.\n' || link end) || svl;
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

-- 사장님: 질문 설정 읽기 (업종 + 현재 설정)
create or replace function public.owner_survey_get(shop text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform owner_check(shop);
  return (select jsonb_build_object('cat', data ->> 'cat', 'survey', coalesce(data -> 'survey', '{}'::jsonb)) from shops where id = shop);
end $$;
grant execute on function public.owner_survey_get(text) to authenticated;

-- 예약 흐름 2단계 (반자동): 업체 가능 → 엉클데이 확정, 불가면 시간 변경 제안 반복
-- Supabase SQL Editor에 통째로 붙여 넣고 Run 하세요. 여러 번 실행해도 괜찮아요.

-- 상태: requested 업체 확인 대기 → shop_ok 업체 가능(엉클데이 확정 대기) → confirmed 확정
--       업체 불가면 rejected(+업체가 제안한 시간) → reschedule 손님에게 변경 시간 안내 → 손님이 고르면 다시 requested
alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('requested','shop_ok','confirmed','rejected','reschedule','visited','settled','cancelled','noshow'));
alter table public.bookings add column if not exists proposed_times jsonb not null default '[]'::jsonb;  -- 업체가 제안한 가능 시간
alter table public.bookings add column if not exists offer_times    jsonb not null default '[]'::jsonb;  -- 손님에게 안내한 변경 시간
alter table public.bookings add column if not exists change_count   int   not null default 0;           -- 시간 변경 횟수

-- 시간 목록 정리 (최대 3개, {date:'YYYY-MM-DD', time:'HH:MM'})
create or replace function public.clean_times(x jsonb) returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(jsonb_build_object('date', e ->> 'date', 'time', e ->> 'time')), '[]'::jsonb)
  from (select e from jsonb_array_elements(case when jsonb_typeof(x) = 'array' then x else '[]'::jsonb end) e
        where (e ->> 'date') ~ '^\d{4}-\d{2}-\d{2}$' and (e ->> 'time') ~ '^\d{2}:\d{2}$' limit 3) s
$$;

create or replace function public.booking_for_customer(t text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b bookings; s shops;
begin
  select * into b from bookings where customer_token = t;
  if not found or t is null or length(t) < 20 then return null; end if;
  select * into s from shops where id = b.shop_id;
  return jsonb_build_object(
    'code', b.code, 'status', b.status, 'shop_id', b.shop_id, 'shop_name', b.shop_name,
    'shop', case when s.id is null then null else jsonb_build_object(
       'name', s.data -> 'name', 'address', s.data -> 'address', 'map', s.data -> 'map',
       'img', s.data -> 'img', 'imgPos', s.data -> 'imgPos', 'menu', s.data -> 'menu') end,
    'menu_name', b.menu_name, 'menu_min', b.menu_min, 'people', b.people, 'list_price', b.list_price,
    'visit_date', b.visit_date, 'visit_time', b.visit_time, 'customer_name', b.customer_name,
    'note', b.note, 'lang', b.lang, 'created_at', b.created_at,
    'customer_visit_at', b.customer_visit_at,
    'offer_times', case when b.status = 'reschedule' then b.offer_times else '[]'::jsonb end, 'change_count', b.change_count,
    'reviewed', exists (select 1 from reviews where booking_id = b.id));
end $$;

-- 손님: 방문했어요 / 예약 취소 / 변경 시간 고르기
drop function if exists public.customer_action(text, text);
create or replace function public.customer_action(t text, action text, pick int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b bookings; o jsonb;
begin
  perform set_config('app.actor', '손님', true);
  select * into b from bookings where customer_token = t;
  if not found or t is null or length(t) < 20 then raise exception '예약을 찾을 수 없어요'; end if;
  if action = 'visited' then
    if b.customer_visit_at is null then
      update bookings set customer_visit_at = now() where id = b.id;
      insert into booking_events (booking_id, action, detail) values (b.id, 'customer_visited', '{}');
    end if;
  elsif action = 'cancel' then
    if b.status not in ('requested', 'shop_ok', 'confirmed', 'rejected', 'reschedule') then raise exception '이미 처리된 예약이라 취소할 수 없어요. 상담으로 문의해 주세요'; end if;
    update bookings set status = 'cancelled' where id = b.id;
  elsif action = 'kakao' then   -- 손님이 '카톡으로 확정 받기'를 누름 (채널 채팅방이 생겼을 가능성)
    if not exists (select 1 from booking_events e where e.booking_id = b.id and e.action = 'customer_kakao') then
      insert into booking_events (booking_id, action, detail) values (b.id, 'customer_kakao', '{}');
    end if;
  elsif action = 'pick' then
    if b.status <> 'reschedule' then raise exception '지금은 시간을 바꿀 수 없어요. 상담으로 문의해 주세요'; end if;
    o := b.offer_times -> pick;
    if o is null then raise exception '고른 시간을 찾을 수 없어요'; end if;
    update bookings set visit_date = (o ->> 'date')::date, visit_time = o ->> 'time', status = 'requested',
      sent_to_shop_at = null, shop_replied_at = null, change_count = change_count + 1,
      offer_times = '[]'::jsonb, proposed_times = '[]'::jsonb
    where id = b.id;
  else
    raise exception '알 수 없는 요청이에요';
  end if;
  return booking_for_customer(t);
end $$;

-- 업체용 예약 화면 (손님 연락처는 보여주지 않아요)
create or replace function public.booking_for_shop(t text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b bookings; s shops;
begin
  select * into b from bookings where shop_token = t;
  if not found or t is null or length(t) < 20 then return null; end if;
  select * into s from shops where id = b.shop_id;
  return jsonb_build_object(
    'code', b.code, 'status', b.status,
    'shop_name', coalesce(s.data -> 'name', to_jsonb(b.shop_name)),
    'menu', (select m from jsonb_array_elements(s.data -> 'menu') m where m -> 'name' ->> 'ko' = b.menu_name limit 1),
    'menu_name', b.menu_name, 'menu_min', b.menu_min, 'people', b.people, 'list_price', b.list_price,
    'visit_date', b.visit_date, 'visit_time', b.visit_time, 'customer_name', b.customer_name,
    'note', b.note, 'lang', b.lang, 'paid_amount', b.paid_amount, 'shop_replied_at', b.shop_replied_at,
    'proposed_times', b.proposed_times, 'change_count', b.change_count,
    'open', s.data -> 'open', 'close', s.data -> 'close');
end $$;

-- 업체: 가능 / 불가(+가능한 시간 제안) / 방문 완료(+받은 금액) / 노쇼
drop function if exists public.shop_reply(text, text, bigint, text);
create or replace function public.shop_reply(t text, action text, amount bigint default null, memo text default null, times jsonb default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  perform set_config('app.actor', '업체', true);
  select * into b from bookings where shop_token = t;
  if not found or t is null or length(t) < 20 then raise exception 'Booking not found'; end if;
  if b.status in ('settled', 'cancelled') then raise exception 'This booking is closed'; end if;
  if action = 'accept' then
    if b.status not in ('requested', 'rejected') then raise exception 'Cannot change now'; end if;
    update bookings set status = 'shop_ok', proposed_times = '[]'::jsonb, shop_replied_at = now() where id = b.id;
  elsif action = 'reject' then
    if b.status not in ('requested', 'shop_ok', 'confirmed', 'rejected') then raise exception 'Cannot change now'; end if;
    update bookings set status = 'rejected', proposed_times = clean_times(times), shop_replied_at = now() where id = b.id;
  elsif action = 'visited' then
    if amount is null or amount < 0 then raise exception 'Please enter the amount'; end if;
    update bookings set status = 'visited', paid_amount = amount, shop_replied_at = now() where id = b.id;
  elsif action = 'noshow' then
    update bookings set status = 'noshow', shop_replied_at = now() where id = b.id and status in ('requested', 'shop_ok', 'confirmed');
  else
    raise exception 'Unknown action';
  end if;
  if coalesce(memo, '') <> '' then
    insert into booking_events (booking_id, action, detail) values (b.id, 'shop_memo', jsonb_build_object('memo', left(memo, 500)));
  end if;
  return booking_for_shop(t);
end $$;

grant execute on function public.booking_for_customer(text), public.customer_action(text, text, int),
  public.booking_for_shop(text), public.shop_reply(text, text, bigint, text, jsonb) to anon, authenticated;

-- 슬랙 알림 문구 (새 상태 이름)
create or replace function public.slack_booking_ev() returns trigger
language plpgsql security definer set search_path = public as $$
declare b bookings; head text; ev text; m text; st text;
begin
  select * into b from bookings where id = new.booking_id;
  if b is null then return new; end if;
  head := '`' || b.code || '` *' || coalesce(b.shop_name, '업체 미정') || '* · ' || coalesce(to_char(b.visit_date, 'MM/DD'), '날짜 미정')
          || coalesce(' ' || b.visit_time, '') || ' · ' || b.people || '명';
  st := case new.detail -> 'status' ->> 1 when 'confirmed' then '✅ 확정' when 'rejected' then '❌ 불가' when 'visited' then '🙌 방문 완료'
        when 'cancelled' then '🚫 취소' when 'noshow' then '👻 노쇼' when 'settled' then '💰 정산 완료' when 'requested' then '📥 업체 확인 대기로' when 'shop_ok' then '👍 가능 (엉클데이 확정 대기)' when 'reschedule' then '🔁 시간 변경 안내' else null end;
  if new.action = 'created' then
    ev := 'booking'; m := '📅 새 예약' || case when new.actor = '손님' then ' (사이트에서 손님이 직접)' else ' (' || nick(new.actor) || ' 등록)' end || E'\n' || head;
  elsif new.actor = '업체' then
    ev := 'shop';
    if new.action = 'shop_memo' then m := '🏪 업체 메모: ' || coalesce(new.detail ->> 'memo', '') || E'\n' || head;
    elsif st is not null then m := '🏪 업체가 링크로 답했어요: ' || st || coalesce(' · 결제 ' || slack_money(b.paid_amount), '') || E'\n' || head;
    else return new; end if;
  elsif new.actor = '손님' then
    ev := 'customer';
    if new.action = 'customer_visited' then m := '🙋 손님이 "다녀왔어요"를 눌렀어요' || E'\n' || head;
    elsif st is not null then m := '🙋 손님: ' || st || E'\n' || head;
    else return new; end if;
  else
    return new;   -- 관리자가 바꾼 건 보내지 않아요 (본인이 한 일)
  end if;
  perform slack_send(ev, m || E'\n<https://www.uncleday.com/admin.html|관리자에서 보기>');
  return new;
end $$;
drop trigger if exists slack_booking_ev on public.booking_events;
create trigger slack_booking_ev after insert on public.booking_events for each row execute function public.slack_booking_ev();

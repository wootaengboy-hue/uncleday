-- ============================================================
-- 54. 💰 결제 확인 페이백 (샵백처럼)
--  · 다녀온 손님이 예약확인증에서 '받은 시술 · 결제한 금액 · 영수증 사진(선택)'을 알려 주면
--    결제 금액의 3%를 엉클데이 포인트로 쌓아 줘요. (로그인한 손님만 — 포인트가 계정에 쌓여요)
--  · 업체가 적은 결제 금액과 같으면 바로 확정, 다르면 관리자가 확인한 뒤 확정해요.
--    업체가 아직 금액을 안 적었으면 '업체 확인 기다림' → 업체가 적는 순간 자동으로 다시 비교해요.
--  · 관리자: 손님 금액이 맞으면 예약의 결제 금액도 그 금액으로 바꿀 수 있어요 (= 수수료도 그 금액 기준).
--  · 포인트는 이번엔 쌓기만 해요 (쓰는 방법은 다음 단계).
--  · 영수증 사진은 비공개 보관함(receipts)에 — 손님 본인과 관리자만 볼 수 있어요.
-- universe30.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

create table if not exists public.paybacks (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null unique references public.bookings(id) on delete cascade,
  user_id     uuid not null,
  amount      bigint not null check (amount > 0),          -- 손님이 알려 준 결제 금액 (동)
  items       text,                                        -- 손님이 적은 받은 시술
  receipt     text,                                        -- 영수증 사진 경로 (receipts 보관함)
  shop_amount bigint,                                      -- 비교할 때의 업체 금액
  final_amount bigint,                                     -- 포인트 기준 금액 (확정 때)
  points      bigint not null default 0,
  status      text not null default 'wait' check (status in ('wait', 'review', 'ok', 'no')),
  -- wait: 업체 금액 기다림 · review: 금액이 달라서 관리자 확인 · ok: 확정 · no: 안 됨
  note        text,                                        -- 관리자 메모 (손님에게도 보여요)
  decided_by  text,
  decided_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists paybacks_user on public.paybacks (user_id);
alter table public.paybacks enable row level security;
drop policy if exists "paybacks admin" on public.paybacks;
create policy "paybacks admin" on public.paybacks for select to authenticated using (public.is_admin());

create or replace function public.payback_rate() returns numeric language sql immutable as $$ select 0.03::numeric $$;

-- 업체 금액과 비교해서 상태 정하기 (차이 1,000동 이하는 같은 금액으로 봐요)
create or replace function public.payback_eval(p public.paybacks) returns public.paybacks
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  if p.status in ('ok', 'no') then return p; end if;
  select * into b from bookings where id = p.booking_id;
  p.shop_amount := b.paid_amount;
  if b.paid_amount is null then p.status := 'wait';
  elsif abs(b.paid_amount - p.amount) <= 1000 then
    p.status := 'ok'; p.final_amount := b.paid_amount; p.points := floor(b.paid_amount * payback_rate());
    p.decided_by := 'auto'; p.decided_at := now();
  else p.status := 'review';
  end if;
  return p;
end $$;

-- 손님: 결제 금액 알려 주기 (확정 전이면 고칠 수 있어요)
create or replace function public.payback_submit(t text, amt bigint, items text default null, receipt text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b bookings; p paybacks; uid uuid := auth.uid();
begin
  if uid is null then raise exception '로그인해야 포인트를 받을 수 있어요'; end if;
  select * into b from bookings where customer_token = t;
  if b.id is null then raise exception '예약을 찾지 못했어요'; end if;
  if b.user_id is not null and b.user_id <> uid then raise exception '이 예약을 한 계정으로 로그인해 주세요'; end if;
  if b.status in ('cancelled', 'rejected', 'requested', 'reschedule') then raise exception '다녀온 예약만 알려 줄 수 있어요'; end if;
  if b.status <> 'visited' and b.status <> 'settled' and b.customer_visit_at is null and (b.visit_date is null or b.visit_date > (now() at time zone 'Asia/Ho_Chi_Minh')::date) then
    raise exception '방문한 뒤에 알려 주세요';
  end if;
  if amt is null or amt < 1000 or amt > 1000000000 then raise exception '결제 금액을 확인해 주세요'; end if;
  if receipt is not null and receipt !~ ('^' || uid::text || '/[A-Za-z0-9._-]+$') then receipt := null; end if;
  if b.user_id is null then update bookings set user_id = uid where id = b.id; end if;   -- 내 예약 목록에도 연결
  select * into p from paybacks where booking_id = b.id;
  if p.id is not null and p.status in ('ok', 'no') then raise exception '이미 확인이 끝났어요'; end if;
  if p.id is null then
    insert into paybacks (booking_id, user_id, amount, items, receipt) values (b.id, uid, amt, left(btrim(payback_submit.items), 300), payback_submit.receipt) returning * into p;
  else
    update paybacks set amount = amt, items = left(btrim(payback_submit.items), 300), receipt = coalesce(payback_submit.receipt, paybacks.receipt), updated_at = now()
    where id = p.id returning * into p;
  end if;
  p := payback_eval(p);
  update paybacks set status = p.status, shop_amount = p.shop_amount, final_amount = p.final_amount, points = p.points, decided_by = p.decided_by, decided_at = p.decided_at
  where id = p.id;
  if p.status = 'review' then
    perform slack_send('customer', '💰 결제 확인 금액이 달라요 · ' || coalesce(b.shop_name, '') || ' (' || b.code || ')'
      || E'\n손님 ' || to_char(amt, 'FM999,999,999') || '동 / 업체 ' || to_char(b.paid_amount, 'FM999,999,999') || '동'
      || E'\n<https://www.uncleday.com/admin.html#home/payback|👉 관리자에서 확인하기>');
  end if;
  return payback_get(t);
end $$;

-- 손님: 이 예약의 페이백 상태 + 내 포인트 합계
create or replace function public.payback_get(t text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare b bookings; p paybacks; uid uuid := auth.uid();
begin
  select * into b from bookings where customer_token = t;
  if b.id is null then return null; end if;
  select * into p from paybacks where booking_id = b.id;
  return jsonb_build_object(
    'rate', payback_rate(),
    'mine', p.id is not null and uid is not null and p.user_id = uid,
    'other', p.id is not null and (uid is null or p.user_id <> uid),
    'status', case when p.id is not null and uid is not null and p.user_id = uid then p.status end,
    'amount', case when p.user_id = uid then p.amount end,
    'items', case when p.user_id = uid then p.items end,
    'receipt', case when p.user_id = uid then p.receipt is not null end,
    'points', case when p.user_id = uid then p.points end,
    'note', case when p.user_id = uid then p.note end,
    'total', case when uid is not null then (select coalesce(sum(points), 0) from paybacks where user_id = uid and status = 'ok') end,
    'waiting', case when uid is not null then (select count(*) from paybacks where user_id = uid and status in ('wait', 'review')) end);
end $$;

-- 손님: 내 포인트 (계정 화면)
create or replace function public.my_points() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total', (select coalesce(sum(points), 0) from paybacks where user_id = auth.uid() and status = 'ok'),
    'list', coalesce((select jsonb_agg(jsonb_build_object('shop', b.shop_name, 'date', b.visit_date, 'amount', coalesce(p.final_amount, p.amount), 'points', p.points,
      'est', floor(p.amount * payback_rate()), 'status', p.status, 't', b.customer_token) order by p.created_at desc)
      from paybacks p join bookings b on b.id = p.booking_id where p.user_id = auth.uid()), '[]'::jsonb))
$$;

-- 관리자: 확정 · 안 됨 (금액 고치기 + 예약 결제 금액도 바꾸기)
create or replace function public.admin_payback_decide(pid uuid, st text, amt bigint default null, note text default null, fix_booking boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare p paybacks; b bookings;
begin
  if not is_admin() then raise exception '관리자만 할 수 있어요'; end if;
  if st not in ('ok', 'no', 'review') then raise exception '상태 이름이 이상해요'; end if;
  select * into p from paybacks where id = pid; if p.id is null then raise exception '없는 요청이에요'; end if;
  select * into b from bookings where id = p.booking_id;
  if st = 'ok' then
    amt := coalesce(amt, b.paid_amount, p.amount);
    if amt is null or amt <= 0 then raise exception '금액을 확인해 주세요'; end if;
    if fix_booking and b.paid_amount is distinct from amt then
      if b.status = 'settled' then raise exception '정산이 끝난 예약은 결제 금액을 바꿀 수 없어요'; end if;
      update bookings set paid_amount = amt, status = case when status in ('confirmed', 'noshow') then 'visited' else status end where id = b.id;
    end if;
    update paybacks set status = 'ok', final_amount = amt, points = floor(amt * payback_rate()), shop_amount = b.paid_amount,   -- 고치기 전 업체 금액을 남겨요 (손님 덕분에 드러난 금액 계산용)
      note = nullif(btrim(admin_payback_decide.note), ''), decided_by = coalesce(auth.jwt() ->> 'email', 'admin'), decided_at = now(), updated_at = now() where id = pid;
  else
    update paybacks set status = st, points = 0, final_amount = null, note = nullif(btrim(admin_payback_decide.note), ''),
      decided_by = case when st = 'no' then coalesce(auth.jwt() ->> 'email', 'admin') end, decided_at = case when st = 'no' then now() end, updated_at = now() where id = pid;
  end if;
end $$;

-- 업체(또는 관리자)가 결제 금액을 적거나 고치면, 기다리던 페이백을 자동으로 다시 비교해요
create or replace function public.paybacks_on_paid() returns trigger
language plpgsql security definer set search_path = public as $$
declare p paybacks;
begin
  if new.paid_amount is distinct from old.paid_amount then
    select * into p from paybacks where booking_id = new.id and status in ('wait', 'review');
    if p.id is not null then
      p := payback_eval(p);
      update paybacks set status = p.status, shop_amount = p.shop_amount, final_amount = p.final_amount, points = p.points, decided_by = p.decided_by, decided_at = p.decided_at, updated_at = now()
      where id = p.id;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists paybacks_on_paid on public.bookings;
create trigger paybacks_on_paid after update of paid_amount on public.bookings for each row execute function public.paybacks_on_paid();

revoke all on function public.payback_eval(public.paybacks) from public, anon, authenticated;
revoke all on function public.payback_submit(text, bigint, text, text) from public, anon;
grant execute on function public.payback_submit(text, bigint, text, text) to authenticated;
revoke all on function public.payback_get(text) from public;
grant execute on function public.payback_get(text) to anon, authenticated;
revoke all on function public.my_points() from public, anon;
grant execute on function public.my_points() to authenticated;
revoke all on function public.admin_payback_decide(uuid, text, bigint, text, boolean) from public, anon;
grant execute on function public.admin_payback_decide(uuid, text, bigint, text, boolean) to authenticated;

-- 영수증 사진: 비공개 보관함 · 손님은 자기 폴더(사용자 번호/)에만 올리고 볼 수 있어요 · 관리자는 전부
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 8388608, array['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "uncleday receipts own" on storage.objects;
create policy "uncleday receipts own" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "uncleday receipts read" on storage.objects;
create policy "uncleday receipts read" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

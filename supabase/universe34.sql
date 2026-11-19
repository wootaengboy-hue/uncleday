-- ===============================================================
-- universe34: 💰 건별 정산 — 방문 완료 1건마다 "입금 확인" 체크
--  계약서 제5조: 처음에는 손님 1건마다 정산 → 예약이 많아지면 협의해서 월말 정산
--  · 건별 입금 확인을 누르면 그 1건짜리 정산서가 '입금 완료'로 바로 만들어지고, 예약은 '정산 완료'가 돼요
--  · 잘못 눌렀으면 '입금 취소'로 되돌려요 (정산서는 '취소됨'으로 기록이 남고, 예약은 다시 '방문 완료')
--  · 월말 정산서(create_settlement)는 그대로 써요. 건별로 정산한 예약은 월말 정산서에 다시 들어가지 않아요
-- Supabase → SQL Editor 에 붙여 넣고 Run (여러 번 실행해도 괜찮아요)
-- ===============================================================

alter table public.settlements add column if not exists kind text not null default 'month';
do $$ begin
  alter table public.settlements add constraint settlements_kind_chk check (kind in ('month', 'each'));
exception when duplicate_object then null; end $$;
alter table public.settlements add column if not exists booking_id uuid references public.bookings(id) on delete set null;

-- ✅ 건별 입금 확인 (관리자만)
create or replace function public.settle_one(p_booking uuid, p_memo text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare b bookings; sid uuid;
begin
  if not is_admin() then raise exception '관리자만 할 수 있어요'; end if;
  select * into b from bookings where id = p_booking for update;
  if not found then raise exception '예약을 찾지 못했어요'; end if;
  if b.status <> 'visited' then raise exception '방문 완료 상태인 예약만 입금 확인할 수 있어요'; end if;
  if b.settlement_id is not null then raise exception '이미 정산서에 들어간 예약이에요'; end if;
  if b.paid_amount is null then raise exception '결제 금액을 먼저 넣어 주세요'; end if;
  insert into settlements (shop_id, shop_name, month, booking_count, total_paid, total_commission, status, paid_at, memo, created_by, kind, booking_id)
  values (b.shop_id, coalesce((select data -> 'name' ->> 'ko' from shops where id = b.shop_id), b.shop_name),
          to_char(b.visit_date, 'YYYY-MM'), 1, coalesce(b.paid_amount, 0), coalesce(b.commission, 0),
          'paid', now(), coalesce(nullif(trim(p_memo), ''), '건별 정산 ' || b.code), actor_name(), 'each', b.id)
  returning id into sid;
  update bookings set settlement_id = sid, status = 'settled' where id = b.id;
  return sid;
end $$;

-- ↩️ 건별 입금 확인 되돌리기 (관리자만)
create or replace function public.settle_one_undo(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s settlements;
begin
  if not is_admin() then raise exception '관리자만 할 수 있어요'; end if;
  select * into s from settlements where id = p_id for update;
  if not found or s.kind <> 'each' then raise exception '건별 정산이 아니에요'; end if;
  update bookings set status = 'visited' where settlement_id = p_id and status = 'settled';
  update bookings set settlement_id = null where settlement_id = p_id;
  update settlements set status = 'void', paid_at = null where id = p_id;
end $$;

revoke all on function public.settle_one(uuid, text), public.settle_one_undo(uuid) from public, anon;
grant execute on function public.settle_one(uuid, text), public.settle_one_undo(uuid) to authenticated;

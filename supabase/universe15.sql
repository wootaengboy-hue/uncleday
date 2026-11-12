-- ============================================================
-- 39. 예약 조회 보안: 예약번호 + 연락처를 여러 번 틀리면 잠시 막아요
--  · 같은 예약번호로 15분에 5번 틀리면, 또는 같은 접속(IP)에서 15분에 20번 틀리면 15분 동안 막혀요.
--  · 맞게 넣은 사람은 영향이 없어요. 틀린 기록은 하루 지나면 지워요. (IP 는 해시로만 저장)
-- universe14.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================
create table if not exists public.find_attempts (
  id  bigserial primary key,
  k   text not null,
  at  timestamptz not null default now()
);
create index if not exists find_attempts_k_idx on public.find_attempts (k, at desc);
alter table public.find_attempts enable row level security;
drop policy if exists "find_attempts admin" on public.find_attempts;
create policy "find_attempts admin" on public.find_attempts for select to authenticated using (is_admin());

create or replace function public.find_booking(c text, ct text) returns text
language plpgsql security definer set search_path = public as $$
declare tok text; kc text := 'c:' || upper(btrim(coalesce(c, ''))); ip text; ki text;
begin
  begin ip := split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1); exception when others then ip := ''; end;
  ki := 'i:' || encode(sha256(convert_to(coalesce(nullif(btrim(ip), ''), 'none'), 'UTF8')), 'hex');
  if (select count(*) from find_attempts where k = kc and at > now() - interval '15 minutes') >= 5
     or (ip <> '' and (select count(*) from find_attempts where k = ki and at > now() - interval '15 minutes') >= 20) then
    raise exception 'Too many tries';
  end if;
  select customer_token into tok from bookings
  where upper(trim(code)) = upper(trim(c))
    and regexp_replace(lower(contact), '[^0-9a-z@._]', '', 'g') = regexp_replace(lower(ct), '[^0-9a-z@._]', '', 'g')
  limit 1;
  if tok is null then
    insert into find_attempts (k) values (kc); if ip <> '' then insert into find_attempts (k) values (ki); end if;
    if random() < 0.05 then delete from find_attempts where at < now() - interval '1 day'; end if;
  end if;
  return tok;
end $$;
grant execute on function public.find_booking(text, text) to anon, authenticated;

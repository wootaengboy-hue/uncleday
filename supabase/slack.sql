-- 슬랙 알림만 따로 (schema.sql 전체 실행이 'Failed to fetch'로 안 될 때 이것만 실행해도 돼요)

-- ---------------------------------------------------------------
-- 17. 슬랙 알림: 예약·업체 답·손님·후기·팀(댓글/멘션)·영업 단계를 슬랙 채널로 보내요
--     웹후크 주소는 관리자만 볼 수 있는 칸에 저장돼요. 보내기는 DB 안에서(pg_net) 해요.
-- ---------------------------------------------------------------
do $$ begin create extension if not exists pg_net; exception when others then raise notice 'pg_net 을 켤 수 없어요: %', sqlerrm; end $$;

create table if not exists public.slack_cfg (
  id          int primary key default 1 check (id = 1),
  webhook     text,
  enabled     boolean not null default true,
  events      text[] not null default array['booking','shop','customer','review','team','lead'],
  updated_at  timestamptz not null default now(),
  updated_by  text
);
alter table public.slack_cfg add column if not exists hooks jsonb not null default '{}'::jsonb;   -- 알림 종류별 채널 (비면 기본 채널)
insert into public.slack_cfg (id) values (1) on conflict do nothing;
alter table public.slack_cfg enable row level security;
drop policy if exists admin_all on public.slack_cfg;
create policy admin_all on public.slack_cfg for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.slack_send(ev text, msg text) returns void
language plpgsql security definer set search_path = public as $$
declare c slack_cfg; u text;
begin
  select * into c from slack_cfg where id = 1;
  if c is null or not c.enabled then return; end if;
  if ev <> 'test' and not (ev = any(c.events)) then return; end if;
  u := coalesce(nullif(c.hooks ->> ev, ''), c.webhook);   -- 종류별 채널이 있으면 거기로, 없으면 기본 채널로
  if u is null or u !~ '^https://hooks\.slack\.com/' then return; end if;
  begin
    perform net.http_post(url := u, body := jsonb_build_object('text', msg), headers := '{"Content-Type": "application/json"}'::jsonb);
  exception when others then null;   -- 슬랙이 안 돼도 예약 저장은 절대 막지 않아요
  end;
end $$;
revoke all on function public.slack_send(text, text) from public, anon, authenticated;

create or replace function public.slack_test() returns void
language plpgsql security definer set search_path = public as $$
declare c slack_cfg; u text; names text;
  lbl constant jsonb := '{"booking":"📅 새 예약","shop":"🏪 업체 답","customer":"🙋 손님 행동","review":"⭐ 새 후기","team":"💬 팀 알림","lead":"🤝 영업 단계"}';
begin
  if not is_admin() then raise exception '관리자만 할 수 있어요'; end if;
  select * into c from slack_cfg where id = 1;
  -- 채널(웹후크)마다 한 번씩, 그 채널로 오는 알림 종류를 적어서 보내요
  for u in select distinct coalesce(nullif(c.hooks ->> e, ''), c.webhook) from unnest(c.events) e
           union select c.webhook where c.webhook is not null loop
    continue when u is null or u !~ '^https://hooks\.slack\.com/';
    select string_agg(lbl ->> e, ', ') into names from unnest(c.events) e where coalesce(nullif(c.hooks ->> e, ''), c.webhook) = u;
    begin
      perform net.http_post(url := u, body := jsonb_build_object('text', '✅ 엉클데이 슬랙 연결 테스트예요 (' || nick(actor_name()) || E')\n이 채널로 오는 알림: ' || coalesce(names, '없음 (기본 채널)')),
                            headers := '{"Content-Type": "application/json"}'::jsonb);
    exception when others then null; end;
  end loop;
end $$;
revoke all on function public.slack_test() from public, anon;
grant execute on function public.slack_test() to authenticated;

-- '관리자 someone@mail.com' → 닉네임 (없으면 이메일 앞부분)
create or replace function public.nick(t text) returns text language sql stable security definer set search_path = public as $$
  select coalesce((select coalesce(nullif(name, ''), split_part(email, '@', 1)) from admins where lower(email) = lower(regexp_replace(coalesce(t, ''), '^관리자 ', ''))), t) $$;

create or replace function public.slack_money(v bigint) returns text language sql immutable as $$
  select case when v is null then '' else to_char(v, 'FM999,999,999,999') || '₫' end $$;

-- 예약 기록이 생길 때
create or replace function public.slack_booking_ev() returns trigger
language plpgsql security definer set search_path = public as $$
declare b bookings; head text; ev text; m text; st text;
begin
  select * into b from bookings where id = new.booking_id;
  if b is null then return new; end if;
  head := '`' || b.code || '` *' || coalesce(b.shop_name, '업체 미정') || '* · ' || coalesce(to_char(b.visit_date, 'MM/DD'), '날짜 미정')
          || coalesce(' ' || b.visit_time, '') || ' · ' || b.people || '명';
  st := case new.detail -> 'status' ->> 1 when 'confirmed' then '✅ 확정' when 'rejected' then '❌ 불가' when 'visited' then '🙌 방문 완료'
        when 'cancelled' then '🚫 취소' when 'noshow' then '👻 노쇼' when 'settled' then '💰 정산 완료' when 'requested' then '📥 접수로 되돌림' else null end;
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

-- 손님 후기가 들어올 때
create or replace function public.slack_review() returns trigger
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  select coalesce(data -> 'name' ->> 'ko', data -> 'name' ->> 'en', id) into nm from shops where id = new.shop_id;
  perform slack_send('review', '⭐ 새 후기 (게시 대기) · *' || coalesce(nm, '업체') || '* · ' || repeat('★', new.stars) || E'\n> '
    || left(replace(new.body, E'\n', ' '), 200) || E'\n<https://www.uncleday.com/admin.html|확인하고 게시하기>');
  return new;
end $$;
drop trigger if exists slack_review on public.reviews;
create trigger slack_review after insert on public.reviews for each row execute function public.slack_review();

-- 팀 알림(멘션·담당 지정·참조·댓글)이 생길 때
create or replace function public.slack_team() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text; k text;
begin
  select coalesce(nullif(name, ''), split_part(email, '@', 1)) into who from admins where lower(email) = new.recipient_email;
  k := case new.kind when 'mention' then '💬 언급' when 'assign' then '👉 담당 지정' when 'ref' then '👥 참조' when 'comment' then '🗨️ 새 댓글' else '🔔 알림' end;
  perform slack_send('team', k || ' → *' || coalesce(who, new.recipient_email) || '* · ' || coalesce(nick(new.actor), '') || E'\n'
    || case new.target_type when 'task' then '할 일: ' else '영업: ' end || coalesce(new.title, '')
    || coalesce(E'\n> ' || left(replace(regexp_replace(regexp_replace(new.body, '⟦q:[^|⟧]*\|([^⟧]*)⟧', '“\1” →', 'g'), '<[^>]+>', ' ', 'g'), E'\n', ' '), 200), ''));
  return new;
end $$;
drop trigger if exists slack_team on public.notifications;
create trigger slack_team after insert on public.notifications for each row execute function public.slack_team();

-- 영업 단계가 바뀔 때
create or replace function public.slack_lead() returns trigger
language plpgsql security definer set search_path = public as $$
declare l leads; f text; t text;
begin
  if new.kind not in ('stage', 'created') then return new; end if;
  select * into l from leads where id = new.lead_id;
  f := new.detail ->> 'from'; t := coalesce(new.detail ->> 'to', new.detail ->> 'stage');
  perform slack_send('lead', '🤝 영업 · *' || coalesce(l.name, '') || '* · '
    || case when new.kind = 'created' then '🆕 새 후보 추가' else
         (case f when 'found' then '후보 발굴' when 'contacted' then '연락함' when 'meeting' then '미팅' when 'negotiating' then '계약 협의' when 'signed' then '계약 완료' when 'live' then '입점 완료' when 'hold' then '보류·거절' else coalesce(f, '') end)
         || ' → ' || (case t when 'found' then '후보 발굴' when 'contacted' then '연락함' when 'meeting' then '미팅' when 'negotiating' then '계약 협의' when 'signed' then '🎉 계약 완료' when 'live' then '🎉 입점 완료' when 'hold' then '보류·거절' else coalesce(t, '') end) end
    || ' (' || coalesce(nick(new.actor), '') || ')');
  return new;
end $$;
drop trigger if exists slack_lead on public.lead_logs;
create trigger slack_lead after insert on public.lead_logs for each row execute function public.slack_lead();

-- 끝! 'Success. No rows returned' 가 보이면 완료예요.

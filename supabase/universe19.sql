-- ============================================================
-- 43. 📨 검색 문의 알림 + 📈 사장님 리포트
--  · 미입점 가게 페이지에서 손님 예약 문의 · 사장님 입점 신청이 들어오면 슬랙으로 바로 알려요 (알림 종류 'seo').
--    연락처는 슬랙에 보내지 않아요. 관리자 포털에서만 봐요.
--  · 사장님 페이지 '오늘' 화면에 "엉클데이에서 내 가게" 최근 30일 숫자를 보여 줘요.
--    (가게 조회 · 검색으로 들어온 수 · 상담 버튼 · 예약) — 개인 정보 없이 숫자만
-- universe18.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

update public.slack_cfg set events = array_append(events, 'seo') where id = 1 and not ('seo' = any(events));
alter table public.slack_cfg alter column events set default array['booking','shop','customer','review','team','lead','chat','seo'];

create or replace function public.slack_seo_lead() returns trigger
language plpgsql security definer set search_path = public as $$
declare cnm text; s text;
begin
  cnm := case new.city when 'danang' then '다낭' when 'nhatrang' then '나트랑' when 'hcm' then '호찌민' when 'hanoi' then '하노이' else new.city end;
  s := case new.src when 'google' then '구글' when 'naver' then '네이버' when 'chatgpt' then 'ChatGPT' when 'perplexity' then 'Perplexity' when 'gemini' then 'Gemini'
       when 'claude' then 'Claude' when 'kakao' then '카카오톡' when 'direct' then '직접' when 'internal' then '사이트 안' else new.src end;
  perform slack_send('seo',
    case new.kind when 'owner' then '🏪 사장님 입점 신청' else '💬 미입점 가게 예약 문의' end
    || ' · *' || coalesce(nullif(new.shop_name, ''), '가게 미상') || '*' || coalesce(' (' || cnm || ')', '')
    || case when new.kind = 'guest' then coalesce(E'\n📅 ' || nullif(new.visit_date, ''), '') || case when new.people > 0 then ' · ' || new.people || '명' else '' end else '' end
    || coalesce(' · ' || s || '에서 들어옴', '')
    || coalesce(E'\n> ' || left(replace(nullif(new.msg, ''), E'\n', ' '), 200), '')
    || E'\n<https://www.uncleday.com/admin.html|포털에서 연락처 보고 처리하기>');
  return new;
end $$;
drop trigger if exists slack_seo_lead on public.seo_leads;
create trigger slack_seo_lead after insert on public.seo_leads for each row execute function public.slack_seo_lead();

-- 사장님 리포트: 최근 30일 + 그 전 30일 (비교용)
create or replace function public.owner_report(shop text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d date := (now() at time zone 'Asia/Ho_Chi_Minh')::date; p text := '/s/' || lower(shop) || '/';
  f constant text[] := array['google', 'naver', 'bing', 'daum', 'chatgpt', 'perplexity', 'claude', 'gemini'];
begin
  perform owner_check(shop);
  return (select jsonb_object_agg(k, v) from (
    select k || r.sfx k, v from (values ('', d - 29, d), ('_prev', d - 59, d - 30)) r(sfx, a, b),
    lateral (values
      ('views',   (select coalesce(sum(n), 0) from stats_daily where shop_id = shop and kind = 'view' and day between r.a and r.b)),
      ('consult', (select coalesce(sum(n), 0) from stats_daily where shop_id = shop and kind = 'consult' and day between r.a and r.b)),
      ('map',     (select coalesce(sum(n), 0) from stats_daily where shop_id = shop and kind = 'map' and day between r.a and r.b)),
      ('search',  (select coalesce(sum(n), 0) from seo_hits where path = p and kind = 'view' and src = any(f) and day between r.a and r.b)),
      ('bookings',(select count(*) from bookings where shop_id = shop and (created_at at time zone 'Asia/Ho_Chi_Minh')::date between r.a and r.b))
    ) x(k, v)) y);
end $$;
revoke all on function public.owner_report(text) from public, anon;
grant execute on function public.owner_report(text) to authenticated;

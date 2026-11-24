-- ===============================================================
-- universe38: 📋 방문 전 질문 — ① 방문 전날 자동 안내 ② 손님이 쓴 글 번역 (가게 · 엉클데이가 읽을 수 있게)
--  ① survey_remind(): 내일(베트남 날짜) 방문하는 확정 예약 중 아직 안 쓴 손님에게 채팅으로 한 번만 안내해요
--     · 베트남 시간 아침 8시 ~ 밤 9시 사이에만 보내요 (밤중에 안 보내요) · 예약마다 1번 (survey_reminded_at)
--     · 1시간마다 도는 자동 갱신(GitHub)이 불러요. Supabase 에 pg_cron 이 켜져 있으면 매일 아침 8시(베트남)에도 불러요
--  ② survey_tr_save(): 손님이 직접 쓴 글(자세히 · 하고 싶은 말)을 베트남어 · 한국어로 번역해 같이 저장해요
--     · 번역은 Edge Function 'chat-tr' 이 DB 에 저장된 손님 글만 번역해요 (아무 글이나 번역해 주지 않아요)
-- universe37 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ===============================================================

alter table public.bookings add column if not exists survey_reminded_at timestamptz;

-- 손님 답 읽기: 손님이 쓴 언어도 같이 (번역할 때 써요)
create or replace function public.survey_get(t text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('answers', s.answers, 'updated_at', s.updated_at, 'lang', coalesce(s.lang, b.lang),
                            'cat', sh.data ->> 'cat', 'survey', coalesce(sh.data -> 'survey', '{}'::jsonb))
  from bookings b join shops sh on sh.id = b.shop_id left join booking_surveys s on s.booking_id = b.id where b.customer_token = t
$$;

-- 번역 저장: { 질문id: { vi: "…", ko: "…" } } → answers[질문id].tr
create or replace function public.survey_tr_save(t text, tr jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare bid uuid; k text; v jsonb; a jsonb;
begin
  select b.id into bid from bookings b join booking_surveys s on s.booking_id = b.id where b.customer_token = t;
  if bid is null or jsonb_typeof(tr) <> 'object' then return; end if;
  select answers into a from booking_surveys where booking_id = bid;
  for k, v in select * from jsonb_each(tr) loop
    if a ? k and jsonb_typeof(v) = 'object' then
      a := jsonb_set(a, array[k, 'tr'], jsonb_strip_nulls(jsonb_build_object('vi', left(v ->> 'vi', 600), 'ko', left(v ->> 'ko', 600))));
    end if;
  end loop;
  update booking_surveys set answers = a where booking_id = bid;
end $$;
grant execute on function public.survey_tr_save(text, jsonb) to anon, authenticated;

-- ① 방문 전날 안내 (여러 번 불러도 예약마다 1번만)
create or replace function public.survey_remind() returns int
language plpgsql security definer set search_path = public as $$
declare vn timestamp := now() at time zone 'Asia/Ho_Chi_Minh'; b bookings; sv jsonb; l text; n int := 0; link text; msg text;
begin
  if extract(hour from vn) < 8 or extract(hour from vn) >= 21 then return 0; end if;
  for b in select bk.* from bookings bk
            where bk.status in ('confirmed', 'shop_ok') and bk.visit_date = vn::date + 1 and bk.survey_reminded_at is null
              and not exists (select 1 from booking_surveys s where s.booking_id = bk.id)
  loop
    select data -> 'survey' into sv from shops where id = b.shop_id;
    continue when coalesce(sv ->> 'on', 'true') = 'false';
    l := case when b.lang in ('ko', 'vi') then b.lang when b.lang is null then 'ko' else 'en' end;
    link := 'https://www.uncleday.com/booking.html?v=2#' || b.customer_token;
    msg := case l
      when 'en' then '📋 Your visit is tomorrow! Please answer a few short questions for the shop (allergies, etc.) on your voucher — it takes about a minute.' || case when sv ->> 'req' = 'true' then ' The shop needs them before your visit.' else '' end || E'\n' || link
      when 'vi' then '📋 Ngày mai là lịch hẹn của bạn! Vui lòng trả lời vài câu hỏi ngắn cho cơ sở (dị ứng…) trong phiếu — chỉ mất khoảng 1 phút.' || case when sv ->> 'req' = 'true' then ' Cơ sở cần trước khi bạn đến.' else '' end || E'\n' || link
      else '📋 내일 방문이에요! 예약확인증에서 가게가 미리 알고 싶어 하는 질문(알레르기 등)에 답해 주세요. 1분이면 돼요.' || case when sv ->> 'req' = 'true' then ' 가게에서 방문 전에 꼭 필요하다고 해요.' else '' end || E'\n' || link end;
    perform chat_post_booking(b.id, msg);
    update bookings set survey_reminded_at = now() where id = b.id;
    n := n + 1;
  end loop;
  return n;
end $$;
grant execute on function public.survey_remind() to anon, authenticated;

-- pg_cron 이 켜져 있으면 매일 베트남 아침 8시 5분(UTC 01:05)에도 불러요 (없으면 건너뜀 — GitHub 자동 갱신이 1시간마다 불러요)
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('ud-survey-remind', '5 1 * * *', 'select public.survey_remind()');
  end if;
exception when others then null; end $$;

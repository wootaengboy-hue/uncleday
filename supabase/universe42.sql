-- ===============================================================
-- universe42: 📒 손님 시술 기록 (손님 ↔ 가게 공유 · CRM)
--  · 방문이 끝나면 가게(사장님 · 직원)가 시술 기록을 남겨요
--      - 손님용 메모 (pub): 받은 시술 · 다음에 추천하는 시술 → 손님 예약확인증에 보여요 (손님 말로 자동 번역)
--      - 가게 전용 메모 (priv): 강도 · 주의할 점 등 → 그 가게와 엉클데이 관리자만 봐요
--  · 사장님 페이지 예약 상세에서 그 손님의 지난 시술 내역을 봐요
--      - 우리 가게에서 받은 시술: 날짜 · 메뉴 · 손님용 메모 · 가게 전용 메모
--      - 다른 가게에서 받은 시술은 사장님에게 안 보여요. 현장에서 손님에게 "엉클데이 시술 기록 보여 주세요" 하면
--        손님이 예약확인증의 '📒 내 시술 기록 → 🇻🇳 사장님께 보여 주기' 화면을 직접 보여 줘요 (손님이 고르는 방식)
--  · 손님 연락처는 지금처럼 사장님에게 절대 안 보여요
--  · 같은 손님 = CRM 과 같은 기준 (같은 연락처로 들어온 예약 → bookings.customer_id)
-- Supabase → SQL Editor 에 붙여 넣고 Run (여러 번 실행해도 괜찮아요)
-- ===============================================================

create table if not exists public.visit_notes (
  booking_id  uuid primary key references public.bookings(id) on delete cascade,
  shop_id     text,
  pub         text,                                  -- 손님용 (손님도 봐요)
  priv        text,                                  -- 가게 전용
  lang        text,                                  -- 쓴 말 (대개 vi)
  pub_tr      jsonb not null default '{}'::jsonb,    -- 손님용 메모 번역 { ko: "…", en: "…" }
  author      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.visit_notes enable row level security;
drop policy if exists admin_all on public.visit_notes;
create policy admin_all on public.visit_notes for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- (예전 초안의 '다른 가게 공유 동의' 는 쓰지 않아요 — 손님이 현장에서 직접 보여 주는 방식으로)
drop function if exists public.customer_history_share(text, boolean);

-- 사장님 · 직원: 이 예약 손님의 시술 내역 (+ 이 예약의 시술 기록)
create or replace function public.owner_history(bid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare b bookings; own jsonb; n jsonb;
begin
  select * into b from bookings where id = bid;
  if not found then raise exception 'Booking not found'; end if;
  perform owner_check(b.shop_id);
  select jsonb_build_object('pub', pub, 'priv', priv, 'author', author, 'updated_at', updated_at) into n from visit_notes where booking_id = b.id;
  if b.customer_id is null then return jsonb_build_object('note', n, 'own', '[]'::jsonb); end if;
  -- 우리 가게에서 받은 시술만 (다른 가게 기록은 손님이 현장에서 직접 보여 줘요)
  select coalesce(jsonb_agg(jsonb_build_object('date', x.visit_date, 'menu', x.menu_name, 'min', x.menu_min, 'people', x.people,
           'mn', (select m -> 'name' from shops s, jsonb_array_elements(s.data -> 'menu') m where s.id = x.shop_id and m -> 'name' ->> 'ko' = x.menu_name limit 1),
           'pub', v.pub, 'priv', v.priv, 'promo', x.promo) order by x.visit_date desc, x.visit_time desc), '[]'::jsonb) into own
  from bookings x left join visit_notes v on v.booking_id = x.id
  where x.customer_id = b.customer_id and x.shop_id = b.shop_id and x.id <> b.id and x.status in ('visited', 'settled');
  return jsonb_build_object('note', n, 'own', own);
end $$;
grant execute on function public.owner_history(uuid) to authenticated;

-- 사장님 · 직원: 시술 기록 저장 (확정된 예약부터 · 방문 후 30일까지)
create or replace function public.owner_note_save(bid uuid, pub text, priv text, lg text default 'vi') returns jsonb
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where id = bid;
  if not found then raise exception 'Booking not found'; end if;
  perform owner_check(b.shop_id);
  if b.status not in ('confirmed', 'shop_ok', 'visited', 'settled') then raise exception 'Only for confirmed or visited bookings'; end if;
  if b.visit_date < vn_today() - 30 then raise exception 'Notes can be written until 30 days after the visit'; end if;
  pub := nullif(left(btrim(coalesce(pub, '')), 1000), ''); priv := nullif(left(btrim(coalesce(priv, '')), 1000), '');
  insert into visit_notes (booking_id, shop_id, pub, priv, lang, author, pub_tr)
  values (b.id, b.shop_id, pub, priv, left(coalesce(lg, 'vi'), 8), actor_name(), '{}'::jsonb)
  on conflict (booking_id) do update set pub = excluded.pub, priv = excluded.priv, lang = excluded.lang, author = excluded.author, updated_at = now(),
    pub_tr = case when visit_notes.pub is distinct from excluded.pub then '{}'::jsonb else visit_notes.pub_tr end;   -- 글이 바뀌면 번역 다시
  return jsonb_build_object('pub', pub, 'priv', priv);
end $$;
grant execute on function public.owner_note_save(uuid, text, text, text) to authenticated;

-- 손님: 내 시술 기록 (예약확인증 열쇠로) — 모든 가게 · 손님용 메모만
create or replace function public.customer_history(t text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where customer_token = t;
  if not found or length(coalesce(t, '')) < 20 then return null; end if;
  if b.customer_id is null then
    return jsonb_build_object('list', coalesce((select jsonb_agg(jsonb_build_object('code', b.code, 'date', b.visit_date, 'menu', b.menu_name, 'shop', b.shop_name,
      'pub', v.pub, 'tr', v.pub_tr, 'lang', v.lang)) from visit_notes v where v.booking_id = b.id and b.status in ('visited', 'settled')), '[]'::jsonb));
  end if;
  return jsonb_build_object(
    'list', coalesce((select jsonb_agg(jsonb_build_object('code', x.code, 'date', x.visit_date, 'menu', x.menu_name, 'shop_id', x.shop_id,
              'mn', (select m -> 'name' from jsonb_array_elements(s.data -> 'menu') m where m -> 'name' ->> 'ko' = x.menu_name limit 1),
              'shop', coalesce(s.data -> 'name', to_jsonb(x.shop_name)), 'pub', v.pub, 'tr', v.pub_tr, 'lang', v.lang) order by x.visit_date desc)
            from bookings x left join visit_notes v on v.booking_id = x.id left join shops s on s.id = x.shop_id
            where x.customer_id = b.customer_id and x.status in ('visited', 'settled')), '[]'::jsonb));
end $$;
grant execute on function public.customer_history(text) to anon, authenticated;


-- 번역 (Edge Function chat-tr 의 { visit: 열쇠, to: 언어 }): 아직 번역 안 된 손님용 메모 → 번역 저장
create or replace function public.visit_tr_src(t text, lg text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', v.booking_id, 'text', v.pub)), '[]'::jsonb)
  from bookings b join bookings x on x.customer_id = b.customer_id or x.id = b.id join visit_notes v on v.booking_id = x.id
  where b.customer_token = t and length(coalesce(t, '')) >= 20 and v.pub is not null
    and coalesce(v.lang, 'vi') <> lg and not (v.pub_tr ? lg)
$$;
grant execute on function public.visit_tr_src(text, text) to anon, authenticated;

create or replace function public.visit_tr_save(t text, bid uuid, lg text, txt text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if lg !~ '^[a-z]{2}(-[A-Z]{2})?$' then return; end if;
  update visit_notes v set pub_tr = v.pub_tr || jsonb_build_object(lg, left(coalesce(txt, ''), 1500))
  where v.booking_id = bid and exists (
    select 1 from bookings b join bookings x on x.customer_id = b.customer_id or x.id = b.id
    where b.customer_token = t and length(coalesce(t, '')) >= 20 and x.id = bid);
end $$;
grant execute on function public.visit_tr_save(text, uuid, text, text) to anon, authenticated;

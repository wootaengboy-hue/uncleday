-- ============================================================
-- 37. 엉클데이 유니버스 게임: 화분 물 주기 · 수확 · 테라피스트 챙기기 · 펫 · 오늘의 퀘스트 · 매장 레벨
--  · 매장마다 코인 · 경험치(XP) · 레벨을 서버에 저장해요 (사장님 · 카운터 어느 기기에서 해도 같아요).
--  · 퀘스트는 베트남 날짜로 매일 새로 시작해요. 완료하면 '받기'로 코인 · XP 를 받아요.
-- universe12.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

create table if not exists public.shop_game (
  shop_id    text primary key references public.shops(id) on update cascade on delete cascade,
  coins      int not null default 50,
  xp         int not null default 0,
  day        date,
  prog       jsonb not null default '{}'::jsonb,   -- {water, care, pet, claimed:[]}
  plants     jsonb not null default '{}'::jsonb,   -- {아이템id: {g: 0~3, w: 마지막 물 준 시각}}
  cool       jsonb not null default '{}'::jsonb,   -- {praise:{직원id: 시각}, pet:{아이템id: 시각}}
  updated_at timestamptz not null default now()
);
alter table public.shop_game enable row level security;
drop policy if exists "shop_game admin" on public.shop_game;
create policy "shop_game admin" on public.shop_game for all to authenticated using (is_admin()) with check (is_admin());

-- 오늘 줄 · 매일 초기화 (내부용)
create or replace function public.game_row(shop text) returns shop_game
language plpgsql security definer set search_path = public as $$
declare g shop_game; d date := vn_today();
begin
  insert into shop_game (shop_id, day) values (shop, d) on conflict (shop_id) do nothing;
  select * into g from shop_game where shop_id = shop for update;
  if g.day is distinct from d then
    update shop_game set day = d, prog = '{}'::jsonb, updated_at = now() where shop_id = shop returning * into g;
  end if;
  return g;
end $$;
revoke execute on function public.game_row(text) from public, anon, authenticated;

-- 레벨: 필요한 누적 XP
create or replace function public.game_level(xp int) returns jsonb
language sql immutable as $$
  select jsonb_build_object('lv', lv, 'from', a[lv], 'to', case when lv < array_length(a, 1) then a[lv + 1] end)
  from (select array[0, 60, 160, 320, 540, 840, 1240, 1760, 2400, 3200] a) x,
       lateral (select max(i) lv from generate_subscripts(x.a, 1) i where x.a[i] <= greatest(0, xp)) y
$$;

-- 오늘의 퀘스트 진행 (내부용)
create or replace function public.game_quests(shop text, g shop_game) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d date := vn_today(); l shop_layout; nst int; done int; ud int; late int; ins int;
begin
  select * into l from shop_layout where shop_id = shop;
  nst := coalesce(array_length(layout_stations(l), 1), 3);
  select count(distinct coalesce(grp, id)), count(distinct coalesce(grp, id)) filter (where booking_id is not null) into done, ud
    from board_sessions where shop_id = shop and day = d and status = 'done';
  select count(*) filter (where late_min > 0), count(*) filter (where in_at is not null) into late, ins from staff_attendance where shop_id = shop and day = d;
  return jsonb_build_array(
    jsonb_build_object('id', 'done', 'n', greatest(5, least(30, nst * 2)), 'p', done, 'c', 20, 'x', 15),
    jsonb_build_object('id', 'water', 'n', 3, 'p', coalesce((g.prog ->> 'water')::int, 0), 'c', 10, 'x', 8),
    jsonb_build_object('id', 'care', 'n', 3, 'p', coalesce((g.prog ->> 'care')::int, 0), 'c', 10, 'x', 8),
    jsonb_build_object('id', 'ud', 'n', 2, 'p', ud, 'c', 15, 'x', 10),
    jsonb_build_object('id', 'ontime', 'n', 1, 'p', case when ins > 0 and late = 0 then 1 else 0 end, 'c', 10, 'x', 5, 'live', true)
  );
end $$;
revoke execute on function public.game_quests(text, shop_game) from public, anon, authenticated;

create or replace function public.game_out(shop text, g shop_game) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare q jsonb; cl jsonb := coalesce(g.prog -> 'claimed', '[]'::jsonb);
begin
  select coalesce(jsonb_agg(x || jsonb_build_object('claimed', cl ? (x ->> 'id'))), '[]'::jsonb) into q from jsonb_array_elements(game_quests(shop, g)) x;
  return jsonb_build_object('coins', g.coins, 'xp', g.xp, 'level', game_level(g.xp), 'day', g.day, 'prog', g.prog,
    'plants', g.plants, 'cool', g.cool, 'quests', q, 'now', now());
end $$;
revoke execute on function public.game_out(text, shop_game) from public, anon, authenticated;

create or replace function public.game_get(shop text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g shop_game;
begin
  perform owner_check(shop);
  g := game_row(shop);
  return game_out(shop, g);
end $$;

-- 놀이: water(화분) · harvest(화분) · snack(직원) · praise(직원) · pet(펫) · claim(퀘스트)
create or replace function public.game_act(shop text, act text, arg text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g shop_game; p jsonb; t timestamptz; gr int; q jsonb; its jsonb;
begin
  perform owner_check(shop);
  g := game_row(shop);
  select coalesce(l.items, '[]'::jsonb) into its from shop_layout l where l.shop_id = shop;
  if act in ('water', 'harvest') then
    if arg is null or not exists (select 1 from jsonb_array_elements(its) e where coalesce(e ->> 'id', '') = arg and e ->> 'k' in ('plant', 'palm', 'flower', 'bamboo')) then raise exception 'Plant not found'; end if;
    p := coalesce(g.plants -> arg, '{}'::jsonb); gr := coalesce((p ->> 'g')::int, 0); t := (p ->> 'w')::timestamptz;
    if act = 'water' then
      if gr >= 3 then raise exception 'Ready to harvest'; end if;
      if t is not null and t > now() - interval '2 hours' then raise exception 'Still moist'; end if;
      g.plants := jsonb_set(g.plants, array[arg], jsonb_build_object('g', gr + 1, 'w', now()));
      g.xp := g.xp + 3; g.prog := jsonb_set(g.prog, '{water}', to_jsonb(coalesce((g.prog ->> 'water')::int, 0) + 1));
    else
      if gr < 3 then raise exception 'Not ready yet'; end if;
      g.plants := jsonb_set(g.plants, array[arg], jsonb_build_object('g', 0, 'w', now()));
      g.coins := g.coins + 10; g.xp := g.xp + 8;
    end if;
  elsif act in ('snack', 'praise') then
    if arg is null or not exists (select 1 from shop_staff where id = arg::uuid and shop_id = shop and active) then raise exception 'Staff not found'; end if;
    if act = 'snack' then
      if g.coins < 5 then raise exception 'Not enough coins'; end if;
      g.coins := g.coins - 5; g.xp := g.xp + 2;
    else
      t := (g.cool #>> array['praise', arg])::timestamptz;
      if t is not null and t > now() - interval '1 hour' then raise exception 'Praise once an hour'; end if;
      g.cool := jsonb_set(case when g.cool ? 'praise' then g.cool else g.cool || '{"praise":{}}'::jsonb end, array['praise', arg], to_jsonb(now()));
      g.xp := g.xp + 1;
    end if;
    g.prog := jsonb_set(g.prog, '{care}', to_jsonb(coalesce((g.prog ->> 'care')::int, 0) + 1));
  elsif act = 'pet' then
    t := (g.cool #>> array['pet', coalesce(arg, '')])::timestamptz;
    if t is not null and t > now() - interval '30 minutes' then raise exception 'Pet is napping'; end if;
    g.cool := jsonb_set(case when g.cool ? 'pet' then g.cool else g.cool || '{"pet":{}}'::jsonb end, array['pet', coalesce(arg, '')], to_jsonb(now()));
    g.xp := g.xp + 2; g.prog := jsonb_set(g.prog, '{pet}', to_jsonb(coalesce((g.prog ->> 'pet')::int, 0) + 1));
  elsif act = 'claim' then
    select x into q from jsonb_array_elements(game_quests(shop, g)) x where x ->> 'id' = arg;
    if q is null then raise exception 'Quest not found'; end if;
    if coalesce(g.prog -> 'claimed', '[]'::jsonb) ? arg then raise exception 'Already claimed'; end if;
    if (q ->> 'p')::int < (q ->> 'n')::int then raise exception 'Quest not finished'; end if;
    g.coins := g.coins + (q ->> 'c')::int; g.xp := g.xp + (q ->> 'x')::int;
    g.prog := jsonb_set(g.prog, '{claimed}', coalesce(g.prog -> 'claimed', '[]'::jsonb) || to_jsonb(arg));
  else raise exception 'Unknown action';
  end if;
  update shop_game set coins = g.coins, xp = g.xp, prog = g.prog, plants = g.plants, cool = g.cool, updated_at = now() where shop_id = shop;
  return game_out(shop, g);
end $$;

grant execute on function public.game_get(text), public.game_act(text, text, text) to authenticated;

-- ===============================================================
-- universe44: 🔎 검색 동의어 (캐시바이 '검색 동의어' 방식)
--  · 업체 · 카테고리마다 '다른 이름'을 등록하면, 그 말로 검색해도 그 업체가 나와요
--      예) Vinmec-View → 빈맥 · 빈멕   /   Dr. Harvard → 하버드 · 닥터하버드   /   마사지 → 안마 · 스웨디시
--  · 관리자 → 🔎 검색어 탭에서 칩으로 추가 · 삭제 (저장하면 손님 화면에 바로 적용)
--  · 손님이 검색했는데 결과가 0개였던 말은 '못 찾은 검색어'로 모여요 (검색어 · 언어 · 날짜 · 횟수만, 개인 정보 없음)
--    → 그 말을 눌러 바로 동의어로 붙일 수 있어요
-- Supabase → SQL Editor 에 붙여 넣고 Run (여러 번 실행해도 괜찮아요 · 관리자가 고친 동의어는 그대로 둬요)
-- ===============================================================

create table if not exists public.search_synonyms (
  kind        text not null check (kind in ('shop', 'cat')),   -- shop: 업체 id · cat: 카테고리 id (massage, derma …)
  target      text not null,
  words       text[] not null default '{}',
  updated_at  timestamptz not null default now(),
  updated_by  text,
  primary key (kind, target)
);
alter table public.search_synonyms enable row level security;
drop policy if exists syn_read on public.search_synonyms;
create policy syn_read on public.search_synonyms for select to anon, authenticated using (true);
drop policy if exists syn_staff on public.search_synonyms;
create policy syn_staff on public.search_synonyms for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- 못 찾은 검색어 (결과 0개) — 하루 단위로 횟수만
create table if not exists public.search_misses (
  q     text not null,
  lang  text not null default '',
  day   date not null default current_date,
  n     int  not null default 1,
  primary key (q, lang, day)
);
alter table public.search_misses enable row level security;
drop policy if exists miss_staff on public.search_misses;
create policy miss_staff on public.search_misses for all to authenticated using (public.is_staff()) with check (public.is_staff());

create or replace function public.search_miss(q text, lg text default '') returns void
language plpgsql security definer set search_path = public as $$
declare w text := lower(btrim(regexp_replace(coalesce(q, ''), '\s+', ' ', 'g')));
begin
  if length(w) < 2 or length(w) > 40 then return; end if;
  if w ~ '[<>{}]|https?:' then return; end if;                      -- 이상한 입력은 버려요
  insert into search_misses (q, lang, day) values (w, left(coalesce(lg, ''), 8), current_date)
  on conflict on constraint search_misses_pkey do update set n = least(search_misses.n + 1, 100000);
end $$;
revoke all on function public.search_miss(text, text) from public;
grant execute on function public.search_miss(text, text) to anon, authenticated;

-- 90일 지난 기록은 지워요 (관리자 화면을 열 때 함께)
create or replace function public.search_miss_list(days int default 30) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception '엉클데이 직원만 볼 수 있어요'; end if;
  delete from search_misses where day < current_date - 90;
  return coalesce((select jsonb_agg(x order by x.n desc, x.last desc) from (
    select q, sum(n)::int n, max(day) last, array_agg(distinct nullif(lang, '')) langs
    from search_misses where day >= current_date - greatest(1, least(days, 90)) group by q limit 200) x), '[]'::jsonb);
end $$;
grant execute on function public.search_miss_list(int) to authenticated;

-- 처음 넣어 두는 동의어 (이미 있으면 건드리지 않아요)
insert into public.search_synonyms (kind, target, words, updated_by) values
  ('cat', 'skin',    '{에스테틱,얼굴관리,페이셜,관리샵,여드름,모공,미백}', '기본'),
  ('cat', 'massage', '{안마,발마사지,타이마사지,아로마,스웨디시,지압,전신마사지,풋마사지}', '기본'),
  ('cat', 'spa',     '{사우나,찜질,스크럽,바디케어,커플스파}', '기본'),
  ('cat', 'derma',   '{피부과,보톡스,필러,레이저,리프팅,울쎄라,써마지,스킨부스터,리쥬란}', '기본'),
  ('cat', 'surgery', '{성형외과,성형,쌍꺼풀,쌍수,코성형,지방흡입,가슴성형,윤곽}', '기본'),
  ('cat', 'hair',    '{미용실,헤어샵,두피,헤드스파,샴푸,염색,펌}', '기본'),
  ('cat', 'nail',    '{네일샵,손톱,젤네일,페디큐어,속눈썹,래쉬}', '기본'),
  ('cat', 'body',    '{제모,왁싱,슈가링,체형관리}', '기본'),
  ('cat', 'dental',  '{치과,임플란트,치아미백,라미네이트,스케일링}', '기본'),
  ('shop', 'dahan-spa',            '{다한,다한마사지}', '기본'),
  ('shop', 'azit-spa',             '{아짓스파,아지트}', '기본'),
  ('shop', 'villa-de-spa',         '{빌라드스파,빌라데스파}', '기본'),
  ('shop', 'rendezvous-spa',       '{랑데부,랑데뷰,참스파,charm spa}', '기본'),
  ('shop', 'moringa-spa',          '{모링가}', '기본'),
  ('shop', 'herbal-spa',           '{허브스파,허벌}', '기본'),
  ('shop', 'sarangbang-spa',       '{사랑방}', '기본'),
  ('shop', 'clover-spa',           '{클로바스파,클로버}', '기본'),
  ('shop', 'sform-clinic',         '{에스폼,에스폼성형외과}', '기본'),
  ('shop', 'doctor-international', '{닥터인터내셔널,인터내셔널성형외과}', '기본'),
  ('shop', 'seoul-plastic-danang', '{서울센터,서울성형,seoul center}', '기본'),
  ('shop', 'dr-harvard',           '{하버드,닥터하버드,하버드성형외과}', '기본'),
  ('shop', 'linh-chau',            '{린쩌우,린차우,린짜우}', '기본'),
  ('shop', 'xuan-truong',          '{쑤언쯔엉,수언트엉,쑤언truong}', '기본'),
  ('shop', 'golden-lotus-spa',     '{골든로투스,골든로터스}', '기본'),
  ('shop', 'ngo-massage-spa',      '{응오,응오스파}', '기본'),
  ('shop', 'swan-spa',             '{스완}', '기본'),
  ('shop', 'jw-korea-hospital',    '{제이더블유,jw성형외과,제이더블유성형외과}', '기본'),
  ('shop', 'dr-quang-tuan',        '{꽝뚜안,광뚜언,꽝뚜언}', '기본'),
  ('shop', 'dr-thanh-hoa',         '{탄화,타인호아,닥터탄화}', '기본'),
  ('shop', 'villa-aesthetica',     '{빌라에스테틱,빌라에스테티카}', '기본'),
  ('shop', 'paragon-spa',          '{파라곤}', '기본'),
  ('shop', 'la-belle-spa',         '{라벨르,라벨스파,라벨비}', '기본'),
  ('shop', 'la-maison-grand-spa',  '{라메종,라메존}', '기본'),
  ('shop', 'vinmec-view',          '{빈맥,빈멕,빈멕뷰,vinmec}', '기본'),
  ('shop', 'dong-a-beauty',        '{동아성형,동아성형외과,동아병원}', '기본'),
  ('shop', 'white-spa-nail',       '{화이트스파,화이트네일}', '기본'),
  ('shop', 'j-spa',                '{제이스파,j스파}', '기본'),
  ('shop', 'w-spa-nail',           '{w네일,더블유스파}', '기본'),
  ('shop', 'lumi-lux-nail',        '{루미럭스,루미}', '기본'),
  ('shop', 'aramsa-nails',         '{아람사,아람사스파}', '기본'),
  ('shop', 'vinpearl-spa-nhatrang','{빈펄,빈펄스파,빈펄리조트}', '기본'),
  ('shop', 'cho-ray-aesthetic',    '{초레이,쪼라이,쩌라이}', '기본'),
  ('shop', 'dr-dung-clinic',       '{닥터둥,닥터중,둥클리닉}', '기본'),
  ('shop', 'anna-huynh',           '{안나,안나후인,안나훈}', '기본'),
  ('shop', 'vvs-nhatrang',         '{브이브이에스,vvs성형외과}', '기본'),
  ('shop', 'seras-spa',            '{세라스,세라스파}', '기본')
on conflict (kind, target) do nothing;

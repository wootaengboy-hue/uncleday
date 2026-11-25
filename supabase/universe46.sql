-- ===============================================================
-- universe46: 🔎 검색 동의어 → 업체 페이지 해시태그 (캐시바이 상세페이지 해시태그 방식)
--  · 동의어 중 '👁 보이기'를 켠 말만 업체 상세 화면에 #해시태그로 보여요 (한국어 화면)
--  · 구글 · 네이버가 읽는 업체 페이지(s/업체/)에도 같은 해시태그가 들어가요 → 그 말로 검색해도 우리 페이지가 걸려요
--  · 해시태그를 누르면 그 말로 검색한 업체 목록이 나와요
--  · 오타 · 줄임말은 보이기를 끄고 사이트 안 검색에만 쓰세요
-- 먼저 universe44 가 실행돼 있어야 해요. Supabase → SQL Editor 에 붙여 넣고 Run (여러 번 실행해도 괜찮아요)
-- ===============================================================

alter table public.search_synonyms add column if not exists shown text[] not null default '{}';

-- 처음 한 번: 업체 동의어 중 한글로만 된 이름은 보이게 켜 둬요 (이미 고친 업체는 그대로)
update public.search_synonyms
set shown = coalesce((select array_agg(w) from unnest(words) w where w ~ '^[가-힣 ]+$'), '{}')
where kind = 'shop' and shown = '{}' and updated_by = '기본';

select count(*) filter (where cardinality(shown) > 0) as 해시태그_있는_업체, sum(cardinality(shown)) as 해시태그_수 from public.search_synonyms where kind = 'shop';

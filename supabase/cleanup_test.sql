-- ============================================================
-- 테스트 기록 지우기 (실제 영업을 시작하기 전에 한 번만)
-- 현황판 · 근무표 · 출퇴근 · 직원 요청 · 테라피스트 후기 중에서
-- 아래 '시작일' 전에 생긴 기록을 지워요.
--
-- 지우지 않는 것: 매장 배치(층 · 방 · 코스), 직원 목록 · PIN, 영업시간, 엉클데이 예약 · 정산.
--   → 예약 탭에서 테스트로 '방문 완료'한 예약이 있으면 관리자 페이지 예약에서 따로 정리해 주세요.
--
-- 쓰는 법
--   1) 아래 cutoff 날짜를 '실제 영업 첫날'로 바꿔요 (그날 기록부터는 남아요).
--   2) 특정 매장만 지우려면 only_shop 에 매장 아이디를 넣어요 (비워 두면 모든 매장).
--   3) Run. 몇 건을 지웠는지 아래 Messages(알림)에 나와요.
-- ============================================================
do $$
declare
  cutoff    date := '2026-11-13';   -- ← 실제 영업 첫날로 바꾸세요
  only_shop text := '';             -- ← 예: 'villa-de-spa' (비워 두면 모든 매장)
  n int;
begin
  delete from public.staff_reviews where created_at < cutoff and (only_shop = '' or shop_id = only_shop);
  get diagnostics n = row_count; raise notice '테라피스트 후기 % 건', n;
  delete from public.board_sessions where day < cutoff and (only_shop = '' or shop_id = only_shop);
  get diagnostics n = row_count; raise notice '시술 기록 % 건', n;
  delete from public.board_guests where day < cutoff and (only_shop = '' or shop_id = only_shop);
  get diagnostics n = row_count; raise notice '손님 접수 % 건', n;
  delete from public.staff_attendance where day < cutoff and (only_shop = '' or shop_id = only_shop);
  get diagnostics n = row_count; raise notice '출퇴근 % 건', n;
  delete from public.staff_requests where created_at < cutoff and (only_shop = '' or shop_id = only_shop);
  get diagnostics n = row_count; raise notice '직원 요청 % 건', n;
  delete from public.staff_shifts where day < cutoff and (only_shop = '' or shop_id = only_shop);
  get diagnostics n = row_count; raise notice '근무표(지난 날) % 건', n;
  delete from public.shop_days where day < cutoff and (only_shop = '' or shop_id = only_shop);
  get diagnostics n = row_count; raise notice '영업 시작·마감 기록 % 건', n;
end $$;

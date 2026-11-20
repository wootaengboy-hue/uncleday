/* 손님 사이트 홈 화면 설치(앱처럼 쓰기)용 서비스 워커
   - 설치를 가능하게 하는 최소한의 역할만 해요. 화면 · 데이터는 저장하지 않고 항상 새로 받아요 (가격 · 예약이 늘 최신이도록).
   - 사장님 페이지(/owner)는 owner-sw.js 가 따로 맡아요. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

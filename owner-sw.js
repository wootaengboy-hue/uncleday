/* 사장님 페이지 홈 화면 설치용 서비스 워커
   - 설치(홈 화면에 추가)를 가능하게 하는 최소한의 역할만 해요.
   - 화면·데이터는 저장해 두지 않고 항상 인터넷에서 새로 받아요 (예약이 늘 최신이도록). */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

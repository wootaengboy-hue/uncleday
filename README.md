# 엉클데이 Uncle Day

베트남 뷰티·마사지 예약 안내 사이트 (www.uncleday.com)

## 구성
- 손님 화면: `index.html` (메인 + 업체 상세), `booking.html` (예약확인증)
- 업체 화면: `partner.html` — 예약마다 받는 링크로 로그인 없이 수락/불가/방문 완료(+금액)
- 관리자: `admin.html` — 이메일 로그인, 대시보드·예약·정산·업체·후기·계정
- 데이터베이스: Supabase. 설정은 `config.js`, 테이블·보안 규칙은 `supabase/schema.sql`
- `shops.js`, `catimgs.js`: 데이터베이스에 연결되지 않을 때 쓰는 기본 파일 (관리자 → 계정 → 백업에서 새로 받을 수 있어요)
- 사이트 문구·카테고리·지역: `data.js`, 화면 글자 번역: `i18n.js`

`main` 브랜치에 올라가면 GitHub Pages가 1~2분 안에 자동으로 다시 배포해요.

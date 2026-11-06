/* 엉클데이 데이터베이스(Supabase) 연결 정보
   - url: Supabase → Project Settings → API 의 Project URL
   - key: 같은 화면의 anon(public) 또는 publishable 키 — 공개돼도 괜찮은 키예요
   ⚠ service_role / secret 키는 절대 여기에 넣지 마세요.
   비워 두면 예전처럼 shops.js 파일과 카카오톡·이메일 방식으로 동작해요. */
const SUPA = {
  url: "https://miftvdayembakwtvckxk.supabase.co",
  key: "sb_publishable_7nvhWQ3kmwjxEuxdBvNWVg_cmTYkED6"
};

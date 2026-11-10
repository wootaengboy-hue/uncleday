// 네이버 로그인 중계 (Supabase Edge Function: naver-userinfo)
// 네이버는 사용자 정보를 { resultcode, message, response: { id, email, name } } 처럼 한 번 감싸서 줘요.
// Supabase는 맨 바깥에 sub(id)·email이 있어야 읽을 수 있어서, 여기서 풀어서 다시 돌려줘요.
// 비밀 키는 필요 없어요. 로그인한 사람의 네이버 토큰을 그대로 네이버에 전달만 해요.
// 설정: 이 함수는 "Verify JWT" 를 꺼야 해요 (Supabase 로그인 서버가 네이버 토큰으로 부르기 때문).

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const auth = req.headers.get("authorization") || "";
  if (!/^bearer\s+\S+/i.test(auth)) return json({ error: "missing token" }, 401);

  const r = await fetch("https://openapi.naver.com/v1/nid/me", { headers: { Authorization: auth } });
  const j = await r.json().catch(() => null);
  const p = j && j.response;
  if (!r.ok || !j || j.resultcode !== "00" || !p || !p.id) {
    return json({ error: "naver userinfo failed", detail: (j && j.message) || r.status }, 401);
  }

  const out: Record<string, unknown> = {
    sub: p.id,
    id: p.id,
    name: p.name || p.nickname || "",
    nickname: p.nickname || null,
    picture: p.profile_image || null,
  };
  // @naver.com 메일만 확인된 이메일로 넘겨요. 다른 메일은 넘기지 않아요
  // (확인 안 된 이메일을 넘기면 Supabase가 인증 메일을 보내고 로그인을 멈추거나, 같은 이메일의 다른 계정과 잘못 합쳐질 수 있어서)
  if (typeof p.email === "string" && /@naver\.com$/i.test(p.email)) {
    out.email = p.email;
    out.email_verified = true;
  }
  return json(out);
});

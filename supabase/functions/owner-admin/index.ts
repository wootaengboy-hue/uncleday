// 사장님 계정 관리 (Supabase Edge Function: owner-admin)
// 관리자 페이지에서만 불러요. 부른 사람이 관리자인지 먼저 확인해요.
//   create: 전화번호로 사장님·직원 계정 만들기 (임시 비밀번호를 돌려줘요)
//   reset : 비밀번호를 새 임시 비밀번호로 바꾸기
// 계정 아이디는 전화번호로 만든 수신 없는 주소예요: 84905123456@owner.uncleday.com (문자 인증 비용 없음)
// 필요한 키(SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)는 Supabase가 자동으로 넣어줘요. 따로 입력할 필요 없어요.
// 설정: "Verify JWT" 는 꺼도 돼요. 아래에서 부른 사람의 로그인 정보로 관리자인지 직접 확인해요 (새 방식 키와도 문제없게).

import { createClient } from "jsr:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOW = ["https://www.uncleday.com", "https://uncleday.com"];

const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && (ALLOW.includes(origin) || origin.startsWith("http://localhost")) ? origin : ALLOW[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

// 0905 123 456 / +84 905 123 456 → 84905123456
const digitsOf = (phone: string) => {
  let d = String(phone || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "84" + d.slice(1);
  return d;
};
// 헷갈리는 글자(0/O, 1/l) 없이 8자리
const tempPassword = () => {
  const a = "abcdefghjkmnpqrstuvwxyz", n = "23456789";
  const pick = (s: string) => s[crypto.getRandomValues(new Uint32Array(1))[0] % s.length];
  return pick(a) + pick(a) + Array.from({ length: 6 }, () => pick(n)).join("");
};

Deno.serve(async (req) => {
  const h = { ...cors(req.headers.get("origin")), "Content-Type": "application/json" };
  const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: h });
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return out({ error: "POST only" }, 405);

  // 1) 부른 사람이 관리자인지 확인
  const caller = createClient(URL, ANON, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
  const { data: isAdmin, error: e1 } = await caller.rpc("is_admin");
  if (e1 || isAdmin !== true) return out({ error: "Admins only" }, 403);

  const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
  const b = await req.json().catch(() => ({}));

  if (b.action === "create") {
    const digits = digitsOf(b.phone);
    if (digits.length < 10 || digits.length > 13) return out({ error: "전화번호를 확인해 주세요" }, 400);
    if (!b.shop_id) return out({ error: "업체가 없어요" }, 400);
    const role = b.role === "staff" ? "staff" : "owner";
    const email = `${digits}@owner.uncleday.com`, password = tempPassword();

    // 같은 전화번호 계정이 있으면 그 계정에 업체를 붙이고 비밀번호를 새로 줘요
    let userId: string | null = null;
    const made = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: b.name || null, phone: b.phone, owner: true } });
    if (made.error) {
      for (let page = 1; page <= 20 && !userId; page++) {
        const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        const u = data?.users?.find((x) => (x.email || "").toLowerCase() === email);
        if (u) userId = u.id;
        if (!data || data.users.length < 1000) break;
      }
      if (!userId) return out({ error: made.error.message }, 400);
      const up = await admin.auth.admin.updateUserById(userId, { password });
      if (up.error) return out({ error: up.error.message }, 400);
    } else userId = made.data.user.id;

    const { error: e2 } = await admin.from("shop_members").upsert(
      { user_id: userId, shop_id: b.shop_id, role, name: b.name || null, phone: b.phone, active: true, must_change_pw: true },
      { onConflict: "user_id,shop_id" });
    if (e2) return out({ error: e2.message }, 400);
    return out({ ok: true, user_id: userId, phone: b.phone, password });
  }

  if (b.action === "reset") {
    if (!b.user_id) return out({ error: "user_id" }, 400);
    const { data: m } = await admin.from("shop_members").select("user_id").eq("user_id", b.user_id).limit(1);
    if (!m || !m.length) return out({ error: "사장님 계정이 아니에요" }, 400);   // 관리자·손님 계정 비번은 못 바꾸게
    const password = tempPassword();
    const up = await admin.auth.admin.updateUserById(b.user_id, { password });
    if (up.error) return out({ error: up.error.message }, 400);
    await admin.from("shop_members").update({ must_change_pw: true }).eq("user_id", b.user_id);
    return out({ ok: true, password });
  }

  return out({ error: "Unknown action" }, 400);
});

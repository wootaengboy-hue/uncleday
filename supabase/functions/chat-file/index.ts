// 📎 채팅 사진 · 파일 (손님용) — SQL universe40 먼저 실행
//  POST (multipart/form-data): 손님이 사진 · PDF 를 보내요
//    file (필수, 10MB까지 · jpg/png/webp/gif/pdf), t (대화 열쇠), bt (예약확인증 열쇠), body (같이 쓴 글), name, contact, lang, page, w, h,
//    grp (한꺼번에 보낸 사진 묶음 번호) · gn (묶음 사진 수 — 슬랙 알림 한 번에 'N장')
//    → 비공개 저장소 chat/g/<임의 32자>/<파일 이름> 에 올리고 chat_send_att 로 메시지를 남겨요. 답: chat_get 과 같은 모양 (token, messages …)
//  GET ?t=…|bt=…&id=<메시지 번호>: 그 대화방 손님인지 확인한 뒤 10분짜리 비공개 주소로 보내요 (사진 <img>, PDF 링크에 그대로 써요)
//  설정: 이 함수는 "Verify JWT" 를 꺼야 해요 (손님 화면의 <img> 는 로그인 정보를 못 보내요). 대신 아래에서 대화 열쇠로 직접 확인해요.
//  비밀값은 따로 필요 없어요 (SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY 는 Supabase 가 자동으로 넣어 줘요). 키는 채팅 · 코드에 적지 않아요.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOW = ["https://www.uncleday.com", "https://uncleday.com"];
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "application/pdf": "pdf" };
const MAX = 10 * 1024 * 1024;
const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && (ALLOW.includes(origin) || origin.startsWith("http://localhost")) ? origin : ALLOW[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
});
const hex32 = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
const safeName = (n: string, ext: string) => {
  const base = (n || "file").replace(/\.[^.]*$/, "").normalize("NFKD").replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "file";
  return `${base}.${ext}`;
};

Deno.serve(async (req) => {
  const h = { ...cors(req.headers.get("origin")), "Content-Type": "application/json" };
  const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: h });
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  const db = createClient(SB_URL, SERVICE, { auth: { persistSession: false } });

  // 보기: 대화방 손님인지 확인 → 10분짜리 주소로
  if (req.method === "GET") {
    const q = new URL(req.url).searchParams;
    const id = Number(q.get("id") || 0);
    if (!id) return out({ error: "id" }, 400);
    const { data: path, error } = await db.rpc("chat_att_path", { t: q.get("t") || null, bt: q.get("bt") || null, mid: id });
    if (error || !path) return out({ error: "Not found" }, 404);
    const s = await db.storage.from("chat").createSignedUrl(path as string, 600);
    if (s.error || !s.data) return out({ error: "Not found" }, 404);
    return new Response(null, { status: 302, headers: { ...h, Location: s.data.signedUrl, "Cache-Control": "private, max-age=300" } });
  }
  if (req.method !== "POST") return out({ error: "GET or POST only" }, 405);

  // 보내기
  let f: FormData;
  try { f = await req.formData(); } catch (_e) { return out({ error: "파일을 다시 골라 주세요" }, 400); }
  const file = f.get("file");
  if (!(file instanceof File)) return out({ error: "파일을 골라 주세요" }, 400);
  const ext = TYPES[file.type];
  if (!ext) return out({ error: "사진(jpg · png · webp · gif)이나 PDF만 보낼 수 있어요" }, 400);
  if (file.size > MAX) return out({ error: "파일이 너무 커요 (10MB까지)" }, 400);
  const str = (k: string, n = 200) => { const v = f.get(k); return typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null; };

  // 로그인한 손님이면 그 계정 대화로 (열쇠가 없을 때)
  let uid: string | null = null;
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (jwt && jwt.split(".").length === 3) { try { const u = await db.auth.getUser(jwt); uid = u.data.user ? u.data.user.id : null; } catch (_e) { uid = null; } }

  const path = `g/${hex32()}/${safeName(file.name, ext)}`;
  const up = await db.storage.from("chat").upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) return out({ error: "올리지 못했어요: " + up.error.message }, 400);
  const att = { p: path, n: (file.name || "file").slice(0, 120), m: file.type, s: file.size, w: str("w", 6), h: str("h", 6), g: str("grp", 32) };
  const { data, error } = await db.rpc("chat_send_att", { p: { att, body: str("body", 2000), t: str("t", 100), bt: str("bt", 100), uid,
    name: str("name", 60), contact: str("contact", 100), lang: str("lang", 8), page: str("page", 80), gn: str("gn", 3) } });
  if (error) { await db.storage.from("chat").remove([path]); return out({ error: error.message }, 400); }
  return out(data);
});

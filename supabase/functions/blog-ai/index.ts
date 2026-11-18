// ✍️ 블로그 본문 초안 (Claude) — 관리자만
//  포털 📝 블로그에서 [✍️ 본문 초안 만들기]를 누르면, 검색어에 맞는 '정보 본문 · 자주 묻는 질문'을 써서 돌려줘요.
//  저장 · 게시는 사람이 확인한 뒤에 해요 (자동 게시 없음).
//  필요한 비밀값: ANTHROPIC_API_KEY (Supabase → Edge Functions → Secrets). 키는 채팅 · 코드에 적지 않아요.
import { createClient } from "jsr:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const MODEL = Deno.env.get("BLOG_AI_MODEL") || "claude-sonnet-5-5";
const ALLOW = ["https://www.uncleday.com", "https://uncleday.com"];
const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && (ALLOW.includes(origin) || origin.startsWith("http://localhost")) ? origin : ALLOW[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

const SYSTEM = `당신은 베트남 여행 중인 한국인을 위한 뷰티 · 마사지 예약 사이트 '엉클데이'의 블로그 에디터예요.
검색어를 받으면, 그 검색어를 찾은 사람이 정말 궁금해하는 '정보'를 담은 본문을 한국어 해요체로 써요.
규칙:
- 업체 홍보 글이 아니에요. 본문의 80% 이상은 검색어 주제 자체에 대한 실용적인 정보예요 (왜 중요한지, 방법, 주의할 점, 여행 중 팁).
- 업체 목록은 사이트가 본문 아래에 따로 붙여요. 본문에 특정 업체 이름 · 가격을 쓰지 마세요. 마지막 문단에서만 "아래에서 ○○ 근처 업체를 비교해 보세요" 정도로 자연스럽게 연결해요.
- 지어낸 통계 · 연구 · 수치 · 인용을 쓰지 마세요. 확실하지 않은 사실은 쓰지 않아요.
- 의학적 진단 · 치료 효과를 약속하지 마세요. 피부 질환 · 통증 · 임신 · 시술 부작용 같은 내용은 "전문의와 상담하세요"로 안내해요.
- 다른 사이트 · 경쟁사 · 특정 제품 브랜드 이름을 쓰지 마세요.
- 짧은 문장, 쉬운 말. 소제목(## ) 3~5개, 필요하면 목록(- ). 본문 1,200~1,800자.
- 자주 묻는 질문 3개 (짧은 답).
반드시 아래 JSON 하나만 출력해요 (설명 · 코드블록 없이):
{"title": "검색어가 들어간 자연스러운 제목 (40자 안)", "intro": "첫 문단 1~2문장", "body": "## 소제목\\n본문…", "faq": [{"q": "질문", "a": "답"}]}`;

Deno.serve(async (req) => {
  const h = { ...cors(req.headers.get("origin")), "Content-Type": "application/json" };
  const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: h });
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return out({ error: "POST only" }, 405);
  const caller = createClient(URL, ANON, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
  const { data: isAdmin, error: e1 } = await caller.rpc("is_admin");
  if (e1 || isAdmin !== true) return out({ error: "Admins only" }, 403);
  if (!KEY) return out({ error: "ANTHROPIC_API_KEY 비밀값이 아직 없어요 (Supabase → Edge Functions → Secrets)" }, 400);

  const b = await req.json().catch(() => ({}));
  const kw = String(b.kw || "").slice(0, 120).trim();
  if (!kw) return out({ error: "검색어가 비어 있어요" }, 400);
  const ctx = [`검색어: ${kw}`, b.city ? `도시: ${String(b.city).slice(0, 30)}` : "", b.place ? `장소: ${String(b.place).slice(0, 40)}` : "", b.what ? `연결할 업종: ${String(b.what).slice(0, 40)}` : ""].filter(Boolean).join("\n");

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, system: SYSTEM, messages: [{ role: "user", content: ctx }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return out({ error: "AI 호출 실패: " + ((j.error && j.error.message) || r.status) }, 502);
  const text = (j.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("").trim();
  const m = text.match(/\{[\s\S]*\}/);
  try {
    const d = JSON.parse(m ? m[0] : text);
    const clip = (s: unknown, n: number) => String(s || "").slice(0, n);
    return out({ title: clip(d.title, 80), intro: clip(d.intro, 400), body: clip(d.body, 6000),
      faq: (Array.isArray(d.faq) ? d.faq : []).slice(0, 5).map((x: any) => ({ q: clip(x.q, 160), a: clip(x.a, 600) })), model: MODEL });
  } catch (_) { return out({ error: "AI 답을 읽지 못했어요. 한 번 더 눌러 주세요" }, 502); }
});

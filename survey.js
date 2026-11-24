/* 📋 시술 전 질문 — 손님 예약확인증(booking.html) · 사장님 페이지(owner.html) · 관리자(admin.html)가 같이 써요 */
// 📋 시술 전 질문 (예약 확정 뒤 손님이 예약확인증에서 작성 → 가게가 봐요) — universe37
//  가게마다 shop.survey = { on: true|false, req: true|false, off: [끈 기본 질문 id], custom: [{ id, type, q: {vi, ko, en}, opts }] }
//  type: yn(예/아니요, detail 이면 '예'일 때 자세히) · pick(고르기, opts) · text(직접 쓰기)
const SV = (ko, en, vi) => ({ ko, en, vi });
const SURVEY_Q = {
  allergy: { type: "yn", detail: true, q: SV("알레르기가 있나요? (화장품 · 오일 · 약 · 음식 · 금속 등)", "Do you have any allergies? (cosmetics, oils, medicine, food, metal, etc.)", "Bạn có bị dị ứng không? (mỹ phẩm, dầu, thuốc, thức ăn, kim loại…)") },
  preg: { type: "yn", q: SV("임신 중이거나 임신 가능성이 있나요?", "Are you pregnant or could you be pregnant?", "Bạn đang mang thai hoặc có thể đang mang thai không?") },
  cond: { type: "yn", detail: true, q: SV("치료 중인 질환이 있나요? (고혈압 · 당뇨 · 심장 · 피부 질환 등)", "Are you being treated for any condition? (blood pressure, diabetes, heart, skin, etc.)", "Bạn có đang điều trị bệnh nào không? (huyết áp, tiểu đường, tim, da…)") },
  med: { type: "yn", detail: true, q: SV("지금 먹고 있는 약이 있나요?", "Are you taking any medication?", "Bạn có đang dùng thuốc nào không?") },
  alcohol: { type: "pick", q: SV("평소 음주는 어느 정도인가요?", "How often do you drink alcohol?", "Bạn có thường uống rượu bia không?"),
    opts: [SV("안 마셔요", "Never", "Không uống"), SV("가끔", "Sometimes", "Thỉnh thoảng"), SV("자주", "Often", "Thường xuyên")] },
  drinkToday: { type: "yn", q: SV("시술 당일 술을 마셨거나 마실 예정인가요?", "Will you have had alcohol on the day of your visit?", "Bạn có uống rượu bia vào ngày đến không?") },
  pressure: { type: "pick", q: SV("원하는 마사지 강도", "Preferred massage pressure", "Lực massage mong muốn"),
    opts: [SV("약하게", "Light", "Nhẹ"), SV("보통", "Medium", "Vừa"), SV("강하게", "Strong", "Mạnh")] },
  avoid: { type: "text", q: SV("피하고 싶은 부위가 있나요? (다친 곳 · 수술 부위 등)", "Any areas to avoid? (injuries, surgery sites, etc.)", "Có vùng nào cần tránh không? (chấn thương, vết mổ…)") },
  skinType: { type: "pick", q: SV("피부 타입", "Skin type", "Loại da"),
    opts: [SV("건성", "Dry", "Da khô"), SV("지성", "Oily", "Da dầu"), SV("복합성", "Combination", "Da hỗn hợp"), SV("민감성", "Sensitive", "Da nhạy cảm"), SV("잘 모르겠어요", "Not sure", "Không rõ")] },
  recent: { type: "yn", detail: true, q: SV("최근 2주 안에 피부 시술(레이저 · 필링 · 보톡스 · 필러 등)을 받았나요?", "Have you had a skin treatment in the last 2 weeks? (laser, peel, Botox, filler, etc.)", "Trong 2 tuần qua bạn có làm thủ thuật da không? (laser, peel, botox, filler…)") },
  retinoid: { type: "yn", q: SV("레티놀이나 여드름 약(이소트레티노인 등)을 쓰고 있나요?", "Are you using retinol or acne medication (e.g. isotretinoin)?", "Bạn có dùng retinol hoặc thuốc trị mụn (isotretinoin…) không?") },
  sun: { type: "yn", q: SV("최근 햇볕에 많이 타거나 화상을 입었나요?", "Have you had a lot of sun or a sunburn recently?", "Gần đây bạn có bị cháy nắng không?") },
  scalp: { type: "yn", detail: true, q: SV("두피가 예민하거나 염색약 알레르기가 있나요?", "Is your scalp sensitive, or are you allergic to hair dye?", "Da đầu bạn có nhạy cảm hoặc dị ứng thuốc nhuộm không?") },
  blood: { type: "yn", q: SV("피가 잘 멈추지 않거나 혈액을 묽게 하는 약을 먹나요?", "Do you bleed easily or take blood-thinning medication?", "Bạn có dễ chảy máu hoặc dùng thuốc chống đông máu không?") },
  note: { type: "text", q: SV("가게에 미리 알려 주고 싶은 것이 있나요?", "Anything else the shop should know?", "Bạn muốn cửa hàng biết thêm điều gì không?") },
};
// 업종별 기본 질문 (업체 세부 카테고리 id)
const SURVEY_TPL = {
  massage: ["allergy", "preg", "cond", "drinkToday", "pressure", "avoid", "note"],
  spa: ["allergy", "preg", "cond", "drinkToday", "pressure", "avoid", "note"],
  body: ["allergy", "preg", "cond", "drinkToday", "avoid", "note"],
  skin: ["allergy", "preg", "skinType", "recent", "retinoid", "sun", "med", "alcohol", "note"],
  derma: ["allergy", "preg", "cond", "med", "skinType", "recent", "retinoid", "sun", "alcohol", "note"],
  surgery: ["allergy", "preg", "cond", "med", "blood", "alcohol", "note"],
  dental: ["allergy", "preg", "cond", "med", "blood", "note"],
  nail: ["allergy", "note"],
  hair: ["allergy", "scalp", "preg", "note"],
  package: ["allergy", "preg", "cond", "med", "drinkToday", "note"],
};
// 이 가게가 손님에게 묻는 질문 목록 (꺼져 있으면 [])
function surveyQs(shop) {
  const sv = (shop && shop.survey) || {};
  if (!shop || sv.on === false) return [];
  const off = sv.off || [];
  const base = (SURVEY_TPL[shop.cat] || SURVEY_TPL.package).filter(id => !off.includes(id) && id !== "note").map(id => ({ id, ...SURVEY_Q[id] }));
  const custom = (sv.custom || []).filter(c => c && c.id && c.q && (c.q.vi || c.q.ko || c.q.en)).map(c => ({ type: "text", ...c }));
  return base.concat(custom, off.includes("note") ? [] : [{ id: "note", ...SURVEY_Q.note }]);
}
const SV_YN = { y: SV("예", "Yes", "Có"), n: SV("아니요", "No", "Không") };
const svTx = (v, l) => !v ? "" : typeof v === "string" ? v : (v[l] || v.en || v.ko || v.vi || "");
// 답을 보기 좋게: [{ q, a, flag }] — flag: '예'라고 답한 건강 질문 (가게가 눈여겨볼 것)
function svRows(answers, shop, l) {
  const qs = surveyQs(shop || {}), seen = new Set(), out = [];
  const one = (q, a) => {
    if (!a || (a.v == null || a.v === "") && !a.d) return;
    let txt = "";
    // 손님이 쓴 글: 번역이 있으면 '번역 (원문)' — 가게는 베트남어, 엉클데이는 한국어 (universe38)
    const free = s => { const tr = a.tr && a.tr[l]; return tr && tr !== s ? `${tr} (${s})` : s; };
    if (q.type === "yn") txt = svTx(SV_YN[a.v], l) + (a.d ? " — " + free(a.d) : "");
    else if (q.type === "pick") txt = q.opts && q.opts[+a.v] ? svTx(q.opts[+a.v], l) : String(a.v);
    else txt = free(String(a.v || "")) + (a.d ? " — " + a.d : "");
    out.push({ q: svTx(q.q, l), a: txt, flag: q.type === "yn" && a.v === "y" });
  };
  qs.forEach(q => { seen.add(q.id); one(q, answers[q.id]); });
  Object.entries(answers || {}).forEach(([id, a]) => { if (seen.has(id)) return; const q = SURVEY_Q[id] ? { id, ...SURVEY_Q[id] } : (a && a.q ? { id, type: a.t || "text", q: a.q } : null); if (q) one(q, a); });
  return out;
}

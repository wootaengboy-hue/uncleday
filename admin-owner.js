/* 👤 사장님 페이지 계정 (업체 편집 창 안)
   - 계정 만들기 / 비밀번호 초기화: Edge Function "owner-admin" (서비스 키는 함수 안에만 있어요)
   - 사용 중지·다시 사용: shop_members 표를 관리자 권한으로 바로 고쳐요 */
const OWNER_URL = "https://www.uncleday.com/owner";
const ownerMsg = (shop, phone, pw) => `[Uncle Day] Tài khoản trang chủ sở hữu – ${shop}
Địa chỉ: ${OWNER_URL}
Số điện thoại: ${phone}
Mật khẩu tạm: ${pw}
Lần đầu đăng nhập, hãy đổi mật khẩu. Tại đây bạn có thể nhận lịch hẹn, đề xuất giờ khác và khoá giờ nghỉ.

[엉클데이] 사장님 페이지 계정 – 주소 ${OWNER_URL} / 전화번호 ${phone} / 임시 비밀번호 ${pw}`;
const ownZalo = phone => { let d = String(phone || "").replace(/\D/g, ""); if (d.startsWith("84")) d = "0" + d.slice(2); return d.length >= 9 ? "https://zalo.me/" + d : ""; };

async function ownerCall(body) {
  const { data, error } = await sb.functions.invoke("owner-admin", { body });
  if (error) {
    let msg = error.message || "";
    try { const j = await error.context.json(); msg = j.error || msg; } catch (e) {}
    if (/Failed to send|not found|404|FunctionsFetchError/i.test(msg + (error.name || ""))) msg = "Supabase에 owner-admin 기능(Edge Function)이 아직 없어요. 📘 사용 안내 → 사장님 페이지를 보고 올려 주세요.";
    throw new Error(msg);
  }
  return data;
}

async function drawOwnerBox(shopId, isNew, shopNm) {
  const el = $("ownBox"); if (!el) return;
  if (isNew) { el.innerHTML = `<p class="hint">업체를 먼저 저장하면 사장님 계정을 만들 수 있어요.</p>`; return; }
  const r = await sb.from("shop_members").select("*").eq("shop_id", shopId).order("created_at");
  if (r.error) { el.innerHTML = `<p class="hint">사장님 페이지를 쓰려면 Supabase SQL Editor에서 <b>supabase/owner.sql</b>을 한 번 실행해 주세요.</p>`; return; }
  const seen = m => m.last_seen_at ? `마지막 접속 ${dt(m.last_seen_at)}` : "아직 접속 안 함";
  el.innerHTML = `${r.data.length ? `<div class="own-list">${r.data.map(m => `<div class="own-row ${m.active ? "" : "off"}">
        <div class="grow"><b>${esc(m.name || "(이름 없음)")}</b> <span class="badge">${m.role === "staff" ? "직원" : "사장님"}</span>${m.active ? "" : ` <span class="badge">사용 중지</span>`}
          <small class="hint" style="display:block">${esc(m.phone || "")} · ${seen(m)}${m.must_change_pw ? " · 임시 비밀번호" : ""}</small></div>
        <button type="button" class="btn sm" data-own-reset="${m.user_id}">🔑 비밀번호 초기화</button>
        <button type="button" class="btn sm" data-own-act="${m.user_id}">${m.active ? "사용 중지" : "다시 사용"}</button></div>`).join("")}</div>` : `<p class="hint" style="margin:0 0 8px">아직 계정이 없어요. 계정을 만들면 업체가 <b>${OWNER_URL}</b> 에서 직접 예약에 답하고 휴무·시간을 막을 수 있어요. 지금처럼 예약 링크로 보내는 방식도 그대로 같이 써요.</p>`}
    <div class="own-form">
      <input id="ownName" placeholder="이름 (예: Chị Lan)" maxlength="40">
      <input id="ownPhone" placeholder="전화번호 (예: 0905 123 456)" inputmode="tel" maxlength="20">
      <select id="ownRole"><option value="owner">사장님</option><option value="staff">직원 (영업시간 변경 불가)</option></select>
      <button type="button" class="btn main" id="ownAdd">+ 계정 만들기</button>
    </div>
    <div id="ownOut"></div>`;
  const show = (phone, pw) => {
    const msg = ownerMsg(shopNm || shopId, phone, pw), z = ownZalo(phone);
    $("ownOut").innerHTML = `<div class="own-out"><b>✅ 임시 비밀번호: <code>${esc(pw)}</code></b>
      <p class="hint">아래 안내를 업체에 잘로로 보내 주세요. 이 비밀번호는 지금만 보여요 (잊으면 '비밀번호 초기화').</p>
      <textarea readonly rows="7">${esc(msg)}</textarea>
      <div style="display:flex;gap:6px;margin-top:6px"><button type="button" class="btn sm main" id="ownCopy">📋 안내 복사</button>${z ? `<a class="btn sm" href="${z}" target="_blank" rel="noopener">잘로 열기</a>` : ""}</div></div>`;
    $("ownCopy").onclick = () => copy(msg, "복사했어요. 잘로에 붙여넣어 보내세요.");
  };
  $("ownAdd").onclick = async () => {
    const phone = $("ownPhone").value.trim(), name = $("ownName").value.trim();
    if (phone.replace(/\D/g, "").length < 9) { toast("전화번호를 확인해 주세요"); return; }
    $("ownAdd").disabled = true;
    try { const d = await ownerCall({ action: "create", shop_id: shopId, phone, name, role: $("ownRole").value }); await drawOwnerBox(shopId, false, shopNm); show(phone, d.password); }
    catch (e) { toast(e.message, 6000); $("ownAdd").disabled = false; }
  };
  el.querySelectorAll("[data-own-reset]").forEach(b => b.onclick = async () => {
    const m = r.data.find(x => x.user_id === b.dataset.ownReset);
    if (!confirm(`${m.name || m.phone} 계정의 비밀번호를 새 임시 비밀번호로 바꿀까요?`)) return;
    b.disabled = true;
    try { const d = await ownerCall({ action: "reset", user_id: m.user_id }); await drawOwnerBox(shopId, false, shopNm); show(m.phone, d.password); }
    catch (e) { toast(e.message, 6000); b.disabled = false; }
  });
  el.querySelectorAll("[data-own-act]").forEach(b => b.onclick = async () => {
    const m = r.data.find(x => x.user_id === b.dataset.ownAct);
    const q = await sb.from("shop_members").update({ active: !m.active }).eq("user_id", m.user_id).eq("shop_id", shopId);
    if (q.error) { dbErr(q.error, "계정 상태 변경"); return; }
    toast(m.active ? "사용을 중지했어요. 이 계정은 이제 로그인해도 업체 정보를 못 봐요." : "다시 사용할 수 있어요");
    drawOwnerBox(shopId, false, shopNm);
  });
}

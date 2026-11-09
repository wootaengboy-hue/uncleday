/* 📄 계약서: 엉클데이 공통 양식 + 업체별 정보 → PDF → 잘로·메일로 보내기
   - 양식은 settings 표의 "contract_tpl"에 저장 (관리자만 읽기)
   - 업체별 정보·보낸 기록은 shop_private.contract 안에 저장
   - PDF는 비공개 저장소(files)에 올리고 14일짜리 임시 링크로 보내요 */
const CT_VARS = [
  ["회사명", "엉클데이 정식 명칭"], ["회사_사업자번호", "엉클데이 사업자번호"], ["회사_주소", "엉클데이 주소"], ["회사_대표자", "엉클데이 대표자"], ["회사_연락처", "엉클데이 연락처"],
  ["업체명", "업체 정식 상호"], ["업체_세금번호", "업체 세금번호(MST)"], ["업체_주소", "업체 사업장 주소"], ["업체_대표자", "업체 대표자"],
  ["업체_담당자", "업체 담당자"], ["업체_연락처", "업체 연락처"], ["수수료율", "수수료율(%)"], ["계약일", "계약일"]];
const CT_LANGS = [["ko", "한국어"], ["vi", "베트남어"], ["en", "영어"]];
const CT_COMPANY = [["name", "회사명", "정식 명칭 (예: 주식회사 엉클데이)"], ["bizno", "회사_사업자번호", "000-00-00000"], ["addr", "회사_주소", "사업장 주소"], ["ceo", "회사_대표자", "대표자 이름"], ["contact", "회사_연락처", "카카오톡·잘로·이메일"]];
const CT_LINK_DAYS = 14;
// 계약서 언어 조합: 두 언어는 PDF 한 파일에 앞뒤로 묶어요 (두 번째 언어는 새 쪽에서 시작)
const CT_COMBOS = [["ko+vi", "한국어 + 베트남어 (함께)"], ["ko+en", "한국어 + 영어 (함께)"], ["ko", "한국어만"], ["vi", "베트남어만"], ["en", "영어만"]];
const ctHas = (ct, combo) => combo.split("+").every(k => ct[k]);
let CT = null;

async function loadCt(force) {
  if (CT && !force) return CT;
  const r = await sb.from("settings").select("value").eq("key", "contract_tpl").maybeSingle();
  const v = (r.data && r.data.value) || {};
  CT = { company: v.company || {}, ko: v.ko || CONTRACT_DEFAULT_KO, vi: v.vi || "", en: v.en || "", ver: v.ver || "초안 v2", updated_at: v.updated_at || null, by: v.by || "" };
  return CT;
}
const ctToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
const ctDate = (d, lang) => { if (!d) return ""; const [y, m, dd] = d.split("-"); return lang === "ko" ? `${y}년 ${+m}월 ${+dd}일` : lang === "vi" ? `ngày ${dd} tháng ${m} năm ${y}` : `${y}-${m}-${dd}`; };

// {{변수}} 채우기. 빈 칸은 노란색으로 표시하고 개수를 세요
function ctFill(html, vals) {
  let miss = 0;
  const out = html.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (m, k) => { const v = vals[k]; if (v == null || String(v).trim() === "") { miss++; return `<mark class="ct-miss">${esc(m)}</mark>`; } return esc(v); });
  const t = document.createElement("div"); t.innerHTML = out;
  const brackets = (t.textContent.match(/\[[^\[\]]{0,40}\]/g) || []).length;
  return { html: out, miss, brackets };
}
function ctVals(s, c, rate, lang, company) {
  const nm = s ? (s.name[lang] || s.name.vi || s.name.en || s.name.ko) : "";
  const ad = s && s.address ? (s.address[lang] || s.address.vi || s.address.en || s.address.ko || "") : "";
  return {
    회사명: company.name, 회사_사업자번호: company.bizno, 회사_주소: company.addr, 회사_대표자: company.ceo, 회사_연락처: company.contact,
    업체명: c.legalName || nm, 업체_세금번호: c.taxId, 업체_주소: c.legalAddr || ad, 업체_대표자: c.rep,
    업체_담당자: c.person, 업체_연락처: [c.phone, c.zalo ? "Zalo " + c.zalo : "", c.email].filter(Boolean).join(" / "),
    수수료율: rate ? String(+rate) : "", 계약일: ctDate(c.date, lang)
  };
}

/* ---------- 양식 고치기 (모든 업체 공통) ---------- */
async function openContractTpl() {
  let ct; try { ct = await loadCt(true); } catch (e) { dbErr(e, "양식 불러오기"); return; }
  const draft = { ko: ct.ko, vi: ct.vi, en: ct.en }; let lang = "ko";
  const d = document.createElement("div"); d.className = "overlay center"; d.style.zIndex = 70;
  d.innerHTML = `<div class="modal task-modal" style="width:min(1040px,calc(100% - 24px))"><h2>📄 계약서 양식 <small class="hint">모든 업체에 똑같이 쓰는 원본이에요</small></h2>
    <p class="hint" style="margin:6px 0 12px">업체마다 달라지는 칸은 <b>{{업체명}}</b>처럼 중괄호 두 개로 적어요. 보낼 때 업체 정보로 자동으로 바뀌어요. 아직 정하지 않은 칸은 [대괄호]로 남겨 두면 보내기 전에 알려 줘요.</p>
    <div class="box"><h3>엉클데이 정보 <small>계약서의 {{회사명}} 등에 들어가요</small></h3>
      <div class="ct-grid">${CT_COMPANY.map(([k, v, ph]) => `<label class="f"><span>${esc(v.replace(/^회사_?/, "") || "회사명")} <code>{{${v}}}</code></span><input data-co="${k}" value="${esc(ct.company[k] || "")}" placeholder="${esc(ph)}"></label>`).join("")}
      <label class="f"><span>양식 버전</span><input id="ctVer" value="${esc(ct.ver)}" placeholder="예: 확정 v1"></label></div></div>
    <div class="ct-tabs">${CT_LANGS.map(([k, n]) => `<button type="button" class="btn sm" data-lang="${k}">${n}${draft[k] ? "" : " (비어 있음)"}</button>`).join("")}</div>
    <div class="ct-chips"><span class="hint">눌러서 넣기:</span>${CT_VARS.map(([k, n]) => `<button type="button" class="chip" data-v="${k}" title="${esc(n)}">{{${k}}}</button>`).join("")}</div>
    <div id="ctEd"></div>
    <p class="hint">${ct.updated_at ? `마지막 저장: ${esc(dt(ct.updated_at))}${ct.by ? " · " + esc(who(ct.by)) : ""}` : "아직 저장한 적 없어요 (지금 보이는 건 초안 v2 기본 양식이에요)"}</p>
    <div class="btns"><button class="btn" data-no>닫기</button><button class="btn" data-pv>👀 예시 업체로 미리보기</button><button class="btn main" data-yes>저장</button></div></div>`;
  document.body.appendChild(d);
  let ed;
  const show = k => {
    if (ed) draft[lang] = ed.get();
    lang = k; d.querySelectorAll("[data-lang]").forEach(b => b.classList.toggle("main", b.dataset.lang === k));
    ed = richEditor(d.querySelector("#ctEd"), draft[k] || "", { placeholder: k === "ko" ? "계약서 내용" : `${CT_LANGS.find(x => x[0] === k)[1]} 번역본을 붙여 넣어요. 비워 두면 한국어본으로 보내요.` });
  };
  d.querySelectorAll("[data-lang]").forEach(b => b.onclick = () => show(b.dataset.lang));
  d.querySelectorAll("[data-v]").forEach(b => { b.onmousedown = e => e.preventDefault(); b.onclick = () => { if (!ed.el.contains(document.getSelection().anchorNode)) ed.el.focus(); document.execCommand("insertText", false, `{{${b.dataset.v}}}`); }; });
  show("ko");
  const company = () => { const o = {}; d.querySelectorAll("[data-co]").forEach(i => o[i.dataset.co] = i.value.trim()); return o; };
  d.querySelector("[data-no]").onclick = () => d.remove();
  d.querySelector("[data-pv]").onclick = () => {
    draft[lang] = ed.get();
    const sample = { name: { ko: "예시 스파", vi: "Spa Mẫu", en: "Sample Spa" }, address: { vi: "123 Lê Lợi, Quận 1, TP.HCM" } };
    const c = { taxId: "0312345678", rep: "Nguyễn Văn A", person: "Ms. Linh", phone: "+84 90 000 0000", date: ctToday() };
    const f = ctFill(draft[lang] || draft.ko, ctVals(sample, c, 15, lang, company()));
    ctPreview(f.html, `예시 업체 미리보기 · 빈 칸 ${f.miss}개 · [대괄호] ${f.brackets}개`);
  };
  d.querySelector("[data-yes]").onclick = async () => {
    draft[lang] = ed.get();
    if (!richText(draft.ko)) { toast("한국어 양식이 비어 있어요"); return; }
    const value = { company: company(), ko: draft.ko, vi: richText(draft.vi) ? draft.vi : "", en: richText(draft.en) ? draft.en : "", ver: d.querySelector("#ctVer").value.trim() || "초안", updated_at: new Date().toISOString(), by: (ME.email || "").toLowerCase() };
    try { await q(sb.from("settings").upsert({ key: "contract_tpl", value }), "계약서 양식 저장"); } catch (e) { return; }
    CT = { ...value }; if (window.overlaySnap) d._snap = overlaySnap(d); toast("계약서 양식을 저장했어요 ✅");
    d.querySelectorAll("[data-lang]").forEach(b => { const k = b.dataset.lang; b.textContent = CT_LANGS.find(x => x[0] === k)[1] + (value[k] ? "" : " (비어 있음)"); });
  };
}
function ctPreview(html, title) {
  const d = document.createElement("div"); d.className = "overlay center"; d.style.zIndex = 90;
  d.innerHTML = `<div class="modal" style="width:min(880px,calc(100% - 24px))"><h2>${esc(title)}</h2><div class="ct-sheet"><div class="ct-paper">${html}</div></div><div class="btns"><button class="btn main" data-no>닫기</button></div></div>`;
  document.body.appendChild(d); d.querySelector("[data-no]").onclick = () => d.remove();
}

/* ---------- PDF 만들기 ---------- */
async function loadH2p() {
  if (window.html2pdf) return;
  await new Promise((ok, no) => { const s = document.createElement("script"); s.src = "vendor/html2pdf.bundle.min.js"; s.onload = ok; s.onerror = () => no(new Error("PDF 도구를 불러오지 못했어요")); document.head.appendChild(s); });
}
async function ctPdf(html) {
  await loadH2p(); if (document.fonts) await document.fonts.ready;
  const wrap = document.createElement("div"); wrap.style.cssText = "position:fixed;left:-10000px;top:0;width:700px;background:#fff";
  wrap.innerHTML = `<div class="ct-paper ct-print">${html.replace(/<mark class="ct-miss">([\s\S]*?)<\/mark>/g, "$1")}</div>`; document.body.appendChild(wrap);
  try {
    const pdf = await html2pdf().set({
      margin: [16, 16, 18, 16], image: { type: "jpeg", quality: 0.9 },
      html2canvas: { scale: 2, backgroundColor: "#ffffff", useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"], avoid: ["h2", "h3", "p", "blockquote", "li"] }
    }).from(wrap.firstElementChild).toPdf().get("pdf");
    const n = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= n; i++) { pdf.setPage(i); pdf.setFontSize(8); pdf.setTextColor(150); pdf.text(`Uncleday Partner Agreement  -  ${i} / ${n}`, 105, 289, { align: "center" }); }
    return pdf.output("blob");
  } finally { wrap.remove(); }
}

/* ---------- 업체별 계약서 만들기·보내기 ---------- */
const CT_MSG = {
  ko: { subj: n => `[엉클데이] ${n} 입점 계약서`, body: (p, n, link) => `안녕하세요${p ? " " + p + "님" : ""}, 엉클데이입니다.\n${n} 입점 계약서를 보내드려요.${link ? `\n아래 링크에서 PDF를 받아 확인해 주세요 (${CT_LINK_DAYS}일 동안 열려요).\n${link}` : ""}\n궁금한 점은 편하게 말씀해 주세요. 감사합니다.` },
  vi: { subj: n => `[Uncleday] Hợp đồng hợp tác - ${n}`, body: (p, n, link) => `Xin chào${p ? " " + p : ""}, đây là Uncleday.\nChúng tôi gửi hợp đồng hợp tác cho ${n}.${link ? `\nVui lòng tải file PDF tại liên kết dưới đây (có hiệu lực ${CT_LINK_DAYS} ngày).\n${link}` : ""}\nNếu có câu hỏi, xin cứ liên hệ với chúng tôi. Cảm ơn!` },
  en: { subj: n => `[Uncleday] Partnership Agreement - ${n}`, body: (p, n, link) => `Hello${p ? " " + p : ""}, this is Uncleday.\nPlease find the partnership agreement for ${n}.${link ? `\nYou can download the PDF from the link below (valid for ${CT_LINK_DAYS} days).\n${link}` : ""}\nFeel free to reach out with any questions. Thank you!` }
};
const CT_VIA = { download: "📄 PDF 받기", share: "📤 공유", email: "✉️ 메일", zalo: "💬 잘로" };
const zaloUrl = z => { z = String(z || "").trim(); if (/^https?:\/\//i.test(z)) return z; const n = z.replace(/[^\d]/g, ""); return n ? `https://zalo.me/${n}` : ""; };

async function openContractSend(id, livePv) {
  const s = shops.find(x => x.id === id); if (!s) { toast("먼저 업체를 저장해 주세요"); return; }
  let ct; try { ct = await loadCt(); } catch (e) { dbErr(e, "양식 불러오기"); return; }
  const pv = PRIV[id] = PRIV[id] || { commission_rate: 0, contract: {} };
  const c = pv.contract = { ...(pv.contract || {}), ...(livePv ? livePv.contract : {}) };
  const rate = livePv ? livePv.commission_rate : pv.commission_rate;
  if (!c.date) c.date = ctToday();
  delete c.ctLang;   // 예전 버전에서 저절로 저장된 값은 버려요
  let lang = c.ctLangs && ctHas(ct, c.ctLangs) ? c.ctLangs : ctHas(ct, "ko+vi") ? "ko+vi" : "ko";
  const F = [["legalName", "정식 상호 {{업체명}}", s.name.vi || s.name.en || s.name.ko], ["taxId", "세금번호 MST {{업체_세금번호}}", "예: 0312345678"], ["rep", "대표자 {{업체_대표자}}", "사업자등록증의 대표자"],
    ["legalAddr", "사업장 주소 {{업체_주소}}", (s.address && (s.address.vi || s.address.en || s.address.ko)) || ""], ["person", "담당자 {{업체_담당자}}", "예: Ms. Linh"], ["phone", "전화", "+84 …"],
    ["zalo", "잘로 (보낼 곳)", "전화번호 또는 zalo.me 링크"], ["email", "이메일 (보낼 곳)", "name@example.com"], ["date", "계약일 {{계약일}}", ""]];
  const d = document.createElement("div"); d.className = "overlay center"; d.style.zIndex = 70;
  d.innerHTML = `<div class="modal ct-send" style="width:min(1180px,calc(100% - 24px))"><h2>📄 계약서 보내기 · ${esc(s.name.ko || s.name.en)}</h2>
    <div class="ct-cols"><div>
      <p class="hint" style="margin:0 0 8px">양식: <b>${esc(ct.ver)}</b> · <a href="#" data-tpl>양식 고치기</a> · 수수료율 <b>${rate ? +rate + "%" : "미입력"}</b> <small>(업체 정보에서 바꿔요)</small></p>
      <div class="ct-grid">${F.map(([k, n, ph]) => `<label class="f"><span>${esc(n)}</span><input data-k="${k}" ${k === "date" ? 'type="date"' : ""} value="${esc(c[k] || "")}" placeholder="${esc(ph)}"></label>`).join("")}
        <label class="f"><span>계약서 언어</span><select id="ctLang">${CT_COMBOS.map(([k, n]) => `<option value="${k}" ${k === lang ? "selected" : ""} ${ctHas(ct, k) ? "" : "disabled"}>${n}${ctHas(ct, k) ? "" : " (양식 없음)"}</option>`).join("")}</select></label>
        <label class="f"><span>메시지 언어</span><select id="msgLang">${CT_LANGS.map(([k, n]) => `<option value="${k}" ${k === (c.msgLang || "vi") ? "selected" : ""}>${n}</option>`).join("")}</select></label></div>
      <div id="ctWarn" class="ct-warn"></div>
      <div class="ct-acts">
        <button class="btn" data-a="download">📄 PDF 받기</button>
        ${navigator.canShare ? `<button class="btn" data-a="share" title="휴대폰에서 잘로·메일 앱으로 파일째 보내요">📤 공유 (파일째)</button>` : ""}
        <button class="btn main" data-a="zalo">💬 잘로로 보내기</button>
        <button class="btn main" data-a="email">✉️ 메일로 보내기</button>
      </div>
      <p class="hint">잘로·메일은 PDF를 비공개 저장소에 올리고 <b>${CT_LINK_DAYS}일짜리 링크</b>를 메시지에 넣어요. 잘로는 메시지를 복사해 대화창을 열어 드려요 (붙여넣기만 하면 돼요).</p>
      <div class="box ct-log"><h3>보낸 기록 ${c.signedAt ? `<span class="badge new">✅ 서명 완료 ${esc(c.signedAt)}</span>` : ""}</h3><div id="ctLog"></div>
        <button class="btn sm" data-signed>${c.signedAt ? "서명 완료 표시 지우기" : "✅ 서명 받음으로 표시"}</button></div>
    </div><div class="ct-sheet"><div class="ct-paper" id="ctPaper"></div></div></div>
    <div class="btns"><button class="btn" data-no>닫기</button></div></div>`;
  document.body.appendChild(d);
  const val = () => { d.querySelectorAll("[data-k]").forEach(i => { c[i.dataset.k] = i.value.trim(); }); lang = d.querySelector("#ctLang").value; c.msgLang = d.querySelector("#msgLang").value; };
  let cur;
  const draw = () => {
    val();
    const parts = lang.split("+").map(k => ({ k, ...ctFill(ct[k] || ct.ko, ctVals(s, c, rate, k, ct.company)) }));
    cur = { html: parts.map(x => `<section class="ct-part" lang="${x.k}">${x.html}</section>`).join(`<div class="html2pdf__page-break"></div>`),
      miss: parts.reduce((a, x) => a + x.miss, 0), brackets: parts.reduce((a, x) => a + x.brackets, 0) };
    d.querySelector("#ctPaper").innerHTML = cur.html;
    d.querySelector("#ctWarn").innerHTML = cur.miss || cur.brackets ? `⚠️ ${cur.miss ? `빈 칸 <b>${cur.miss}개</b> (노란색)` : ""}${cur.miss && cur.brackets ? " · " : ""}${cur.brackets ? `아직 정하지 않은 [대괄호] <b>${cur.brackets}개</b> — 양식에서 확정해 주세요` : ""}` : "✅ 빈 칸 없이 다 채워졌어요";
    d.querySelector("#ctWarn").classList.toggle("ok", !cur.miss && !cur.brackets);
  };
  const drawLog = () => {
    const L = (c.sends || []).slice().reverse();
    d.querySelector("#ctLog").innerHTML = L.length ? L.map(x => `<div class="ct-li"><span>${CT_VIA[x.via] || esc(x.via)}</span><span class="hint">${esc(dt(x.at))} · ${esc(who(x.by || ""))}${x.to ? " → " + esc(x.to) : ""} · ${esc(x.ver || "")}</span>${x.path ? `<button type="button" class="btn sm" data-open="${esc(x.path)}">열기</button>` : ""}</div>`).join("") : `<div class="hint">아직 보낸 적 없어요.</div>`;
    d.querySelectorAll("[data-open]").forEach(b => b.onclick = async () => { const w = window.open("", "_blank"); const u = await sb.storage.from("files").createSignedUrl(b.dataset.open, 300); if (u.error) { if (w) w.close(); dbErr(u.error, "열기"); return; } if (w) w.location = u.data.signedUrl; });
  };
  const persist = async () => {
    if (livePv) Object.assign(livePv.contract, c);
    const r = await sb.from("shop_private").upsert({ shop_id: id, contract: c }, { onConflict: "shop_id" });
    if (r.error) { dbErr(r.error, "계약 정보 저장"); return false; } return true;
  };
  d.querySelector("#ctLang").addEventListener("change", () => { c.ctLangs = d.querySelector("#ctLang").value; persist(); });   // 직접 고른 경우만 기억해요
  d.querySelectorAll("[data-k], #ctLang, #msgLang").forEach(i => i.addEventListener(i.tagName === "SELECT" ? "change" : "input", draw));
  d.querySelectorAll("[data-k]").forEach(i => i.addEventListener("change", persist));
  d.querySelector("[data-tpl]").onclick = e => { e.preventDefault(); d.remove(); openContractTpl(); };
  d.querySelector("[data-no]").onclick = async () => { val(); await persist(); d.remove(); };
  d.querySelector("[data-signed]").onclick = async () => {
    if (c.signedAt) delete c.signedAt; else { c.signedAt = ctToday(); if (!c.date) c.date = c.signedAt; }
    if (await persist()) { toast(c.signedAt ? "서명 완료로 표시했어요 ✅ 서명본은 영업 카드 📎에 올려 두세요" : "표시를 지웠어요", 4000); d.remove(); openContractSend(id, livePv); }
  };
  const busy = (on, label) => d.querySelectorAll("[data-a]").forEach(b => { b.disabled = on; if (on && label && b.dataset.a === label[0]) { b.dataset.t = b.textContent; b.textContent = label[1]; } else if (!on && b.dataset.t) { b.textContent = b.dataset.t; delete b.dataset.t; } });
  d.querySelectorAll("[data-a]").forEach(b => b.onclick = async () => {
    const via = b.dataset.a; draw();
    const name = c.legalName || s.name.vi || s.name.en || s.name.ko;
    if (via === "zalo" && !zaloUrl(c.zalo)) { toast("잘로 번호를 먼저 적어 주세요"); d.querySelector('[data-k="zalo"]').focus(); return; }
    if (via === "email" && !/^\S+@\S+\.\S+$/.test(c.email || "")) { toast("이메일 주소를 먼저 적어 주세요"); d.querySelector('[data-k="email"]').focus(); return; }
    if ((cur.miss || cur.brackets) && via !== "download" && !confirm(`빈 칸 ${cur.miss}개, [대괄호] ${cur.brackets}개가 남아 있어요. 그래도 보낼까요?`)) return;
    const fname = `Uncleday_${name.replace(/[\\/:*?"<>|]+/g, " ").trim()}_${lang.toUpperCase().replace("+", "-")}_${c.date || ctToday()}.pdf`;
    const w = via === "zalo" ? window.open("", "_blank") : null;   // 팝업 차단을 피하려고 미리 열어요
    busy(true, [via, "PDF 만드는 중…"]);
    try {
      const blob = await ctPdf(cur.html);
      const file = new File([blob], fname, { type: "application/pdf" });
      const msgLang = c.msgLang || "vi", M = CT_MSG[msgLang] || CT_MSG.ko;
      const log = { at: new Date().toISOString(), via, by: (ME.email || "").toLowerCase(), ver: ct.ver, lang };
      if (via === "download" || via === "share") {
        if (via === "share" && navigator.canShare && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], title: M.subj(name), text: M.body(c.person, name, "") }); } catch (e) { if (e.name === "AbortError") { busy(false); if (w) w.close(); return; } throw e; }
        } else { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = fname; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
      } else {
        const path = `contract/${id}/${Date.now().toString(36)}.pdf`;
        const up = await sb.storage.from("files").upload(path, blob, { contentType: "application/pdf", upsert: false });
        if (up.error) throw Object.assign(new Error(/bucket|not found/i.test(up.error.message) ? "비공개 저장소가 아직 없어요. Supabase에서 supabase/files.sql을 먼저 실행해 주세요" : up.error.message), { keep: true });
        const sg = await sb.storage.from("files").createSignedUrl(path, CT_LINK_DAYS * 86400, { download: fname }); if (sg.error) throw sg.error;
        const text = M.body(c.person, name, sg.data.signedUrl); log.path = path;
        if (via === "zalo") {
          try { await navigator.clipboard.writeText(text); } catch (e) {}
          if (w) w.location = zaloUrl(c.zalo); else window.open(zaloUrl(c.zalo), "_blank");
          log.to = c.zalo; toast("메시지를 복사했어요 📋 잘로 대화창에 붙여넣기(Ctrl+V)만 하세요", 6000);
        } else {
          log.to = c.email; location.href = `mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent(M.subj(name))}&body=${encodeURIComponent(text)}`;
          toast("메일 앱이 열렸어요. 내용을 확인하고 보내기를 누르세요 ✉️", 6000);
        }
      }
      c.sends = [...(c.sends || []), log].slice(-30); await persist(); drawLog();
    } catch (e) { if (w) w.close(); dbErr(e, "계약서 보내기"); }
    busy(false);
  });
  draw(); drawLog();
}

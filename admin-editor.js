/* 엉클데이 관리자 — 노션처럼 쓰는 메모 편집기 (제목, 목록, 체크리스트, 토글, 구분선, 강조 상자, 템플릿)
   '/'를 입력하면 블록 메뉴가 떠요. 저장은 안전하게 거른 HTML로 해요. */
const RICH_TAGS = { P: [], H2: [], H3: [], UL: ["class"], OL: [], LI: ["data-done"], B: [], STRONG: [], I: [], EM: [], S: [], STRIKE: [], U: [], A: ["href"],
  BR: [], HR: [], BLOCKQUOTE: [], DIV: ["class"], SPAN: [] };
const RICH_CLASS = ["check", "toggle", "open", "tg-head", "tg-body", "callout"];
function richClean(html) {
  const doc = new DOMParser().parseFromString(`<div>${html || ""}</div>`, "text/html");
  const walk = el => [...el.childNodes].forEach(n => {
    if (n.nodeType === 3) return;
    if (n.nodeType !== 1) { n.remove(); return; }
    walk(n);
    const ok = RICH_TAGS[n.tagName];
    if (!ok) { n.replaceWith(...n.childNodes); return; }
    [...n.attributes].forEach(a => {
      if (!ok.includes(a.name)) n.removeAttribute(a.name);
      else if (a.name === "class") { const c = a.value.split(/\s+/).filter(x => RICH_CLASS.includes(x)).join(" "); c ? n.setAttribute("class", c) : n.removeAttribute("class"); }
      else if (a.name === "href" && !/^https?:\/\//i.test(a.value)) n.removeAttribute("href");
    });
    if (n.tagName === "A") { n.setAttribute("target", "_blank"); n.setAttribute("rel", "noopener"); }
  });
  const root = doc.body.firstChild; walk(root);
  return root.innerHTML.replace(/(<p><br><\/p>)+$/, "").trim();
}
// 예전 글(그냥 텍스트)도 그대로 보이게
const richFrom = v => !v ? "" : /<\/?(p|h2|h3|ul|ol|li|div|hr|br|b|blockquote)\b/i.test(v) ? richClean(v) : v.split("\n").map(l => `<p>${esc(l) || "<br>"}</p>`).join("");
const richText = v => { const d = document.createElement("div"); d.innerHTML = richFrom(v); d.querySelectorAll("p,li,h2,h3,div,br").forEach(e => e.append(" ")); return d.textContent.replace(/\s+/g, " ").trim(); };

const BLOCKS = [
  ["text", "본문", "Aa", "일반 글"], ["h2", "큰 제목", "H1", "섹션 제목"], ["h3", "작은 제목", "H2", "소제목"],
  ["ul", "글머리 목록", "•", "점 목록"], ["ol", "번호 목록", "1.", "순서 목록"], ["check", "체크리스트", "☑", "할 일 체크"],
  ["toggle", "토글", "▶", "접었다 펼치는 목록"], ["callout", "강조 상자", "💡", "눈에 띄는 메모"], ["quote", "인용", "❝", "인용문"], ["hr", "구분선", "—", "가로줄"]
];
const BUILTIN_TPL = [
  { id: "b-meeting", name: "🤝 업체 미팅 노트", body: `<h2>업체 미팅</h2><p><b>날짜·장소:</b> </p><p><b>참석자:</b> </p><div class="toggle open"><div class="tg-head">업체 현황</div><div class="tg-body"><p>규모·직원 수, 한국인 손님 비율, 응대 언어</p></div></div><h3>확인한 것</h3><ul class="check"><li>메뉴·가격표 받기</li><li>영업시간·휴무일</li><li>픽업·한국어 응대 가능 여부</li><li>대표 사진 받기</li></ul><h3>수수료 협의</h3><div class="callout"><p>제안: %  /  업체 의견: </p></div><h3>다음 할 일</h3><ul class="check"><li></li></ul>` },
  { id: "b-onboard", name: "🏪 업체 입점 체크리스트", body: `<h2>입점 체크리스트</h2><ul class="check"><li>영업 허가·사업자 정보 확인</li><li>메뉴·가격표 사진 받기</li><li>대표 사진 3장 이상 받기</li><li>영업시간·휴무일 확인</li><li>응대 언어(한국어·영어) 확인</li><li>수수료율 합의</li><li>계약서 서명·사진 보관</li><li>업체 잘로 연락처·담당자 등록</li><li>사이트 등록 후 '사이트에 보이기' 켜기</li><li>업체 확인 링크 사용법 안내</li><li>첫 예약 테스트</li></ul>` },
  { id: "b-minutes", name: "📝 회의록", body: `<h2>회의록</h2><p><b>날짜:</b> </p><p><b>참석:</b> </p><h3>안건</h3><ol><li></li></ol><div class="toggle open"><div class="tg-head">논의 내용</div><div class="tg-body"><p></p></div></div><h3>결정 사항</h3><ul><li></li></ul><h3>할 일</h3><ul class="check"><li></li></ul>` },
  { id: "b-settle", name: "💰 월말 정산 체크", body: `<h2>월말 정산</h2><ul class="check"><li>지난달 방문 완료 예약 금액 모두 입력</li><li>방문일 지난 예약 정리 (방문·노쇼)</li><li>업체별 정산서 만들기</li><li>업체에 정산서·리포트 보내기</li><li>입금 확인 누르기</li></ul><div class="callout"><p>미입금 업체: </p></div>` }
];
let USER_TPL = null;
async function loadTemplates() {
  if (USER_TPL) return USER_TPL;
  const r = await sb.from("templates").select("*").order("created_at");
  USER_TPL = r.error ? [] : r.data; return USER_TPL;
}

/* 편집기 만들기: host 안에 그려요. 반환값의 get()으로 HTML을 받아요 */
function richEditor(host, html, opts = {}) {
  host.innerHTML = `<div class="re-bar">
      <button type="button" data-b="h2" title="큰 제목">H1</button><button type="button" data-b="h3" title="작은 제목">H2</button>
      <button type="button" data-c="bold" title="굵게 (Ctrl+B)"><b>B</b></button><button type="button" data-c="strikeThrough" title="취소선"><s>S</s></button>
      <span class="re-sep"></span>
      <button type="button" data-b="ul" title="글머리 목록">•</button><button type="button" data-b="ol" title="번호 목록">1.</button><button type="button" data-b="check" title="체크리스트">☑</button>
      <button type="button" data-b="toggle" title="토글">▶</button><button type="button" data-b="callout" title="강조 상자">💡</button><button type="button" data-b="hr" title="구분선">—</button>
      <span class="grow"></span><button type="button" class="re-tpl">📄 템플릿</button></div>
    <div class="re-doc" contenteditable="true" spellcheck="false" data-ph="${esc(opts.placeholder || "내용을 적어요. '/'를 누르면 제목·체크리스트·토글 메뉴가 나와요")}"></div>
    <div class="re-menu" hidden></div>`;
  const doc = host.querySelector(".re-doc"), menu = host.querySelector(".re-menu");
  doc.innerHTML = richFrom(html) || "<p><br></p>";
  const ph = () => doc.classList.toggle("empty", !doc.textContent.trim() && !doc.querySelector("ul,ol,hr,.toggle,.callout,h2,h3"));
  ph(); doc.addEventListener("input", ph); doc.addEventListener("focus", ph);
  try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch (e) {}
  const sel = () => window.getSelection();
  const blockOf = n => { while (n && n !== doc) { if (n.nodeType === 1 && (n.parentNode === doc || n.tagName === "LI" || n.classList.contains("tg-head") || n.parentNode.classList?.contains("tg-body") || n.parentNode.classList?.contains("callout"))) return n; n = n.parentNode; } return null; };
  const caretBlock = () => sel().rangeCount ? blockOf(sel().anchorNode) : null;
  const placeCaret = el => { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); sel().removeAllRanges(); sel().addRange(r); };
  const insertAfterBlock = html => {
    let b = caretBlock(); while (b && b.parentNode !== doc) b = b.parentNode;
    const t = document.createElement("div"); t.innerHTML = html; const nodes = [...t.childNodes];
    if (b) { b.after(...nodes); if (b.tagName === "P" && !b.textContent.trim()) b.remove(); }
    else doc.append(...nodes);
    return nodes;
  };
  function apply(kind) {
    doc.focus();
    if (kind === "h2" || kind === "h3" || kind === "text") { const b = caretBlock(); document.execCommand("formatBlock", false, kind === "text" ? "p" : kind); if (b && b.closest && b.closest("ul.check")) {} return; }
    if (kind === "quote") { document.execCommand("formatBlock", false, "blockquote"); return; }
    if (kind === "ul" || kind === "check") {
      const b = caretBlock(), inUl = b && b.closest && b.closest("ul");
      if (!inUl) document.execCommand("insertUnorderedList");
      const ul = caretBlock() && caretBlock().closest && caretBlock().closest("ul");
      if (ul) ul.classList.toggle("check", kind === "check");
      return;
    }
    if (kind === "ol") { document.execCommand("insertOrderedList"); return; }
    if (kind === "hr") { const n = insertAfterBlock("<hr><p><br></p>"); placeCaret(n[1]); return; }
    if (kind === "toggle") { const n = insertAfterBlock(`<div class="toggle open"><div class="tg-head"><br></div><div class="tg-body"><p><br></p></div></div><p><br></p>`); placeCaret(n[0].querySelector(".tg-head")); return; }
    if (kind === "callout") { const n = insertAfterBlock(`<div class="callout"><p><br></p></div><p><br></p>`); placeCaret(n[0].querySelector("p")); return; }
  }
  host.querySelectorAll(".re-bar [data-b]").forEach(b => b.onmousedown = e => { e.preventDefault(); apply(b.dataset.b); });
  host.querySelectorAll(".re-bar [data-c]").forEach(b => b.onmousedown = e => { e.preventDefault(); doc.focus(); document.execCommand(b.dataset.c); });

  // 체크리스트 체크 / 토글 열고 닫기 (왼쪽 아이콘 자리를 누르면)
  doc.addEventListener("mousedown", e => {
    if (!e.target.closest) return;
    const li = e.target.closest("ul.check > li");
    if (li && e.clientX - li.getBoundingClientRect().left < 26) { e.preventDefault(); li.toggleAttribute("data-done"); return; }
    const h = e.target.closest(".tg-head");
    if (h && e.clientX - h.getBoundingClientRect().left < 22) { e.preventDefault(); h.parentNode.classList.toggle("open"); }
  });

  // '/' 메뉴
  let mi = 0, mlist = [], slashNode = null, slashOff = 0;
  const closeMenu = () => { menu.hidden = true; slashNode = null; };
  function openMenu(q) {
    mlist = BLOCKS.filter(b => !q || (b[1] + b[3] + b[0]).toLowerCase().includes(q.toLowerCase()));
    if (!mlist.length) { closeMenu(); return; }
    mi = Math.min(mi, mlist.length - 1);
    menu.innerHTML = mlist.map((b, i) => `<div class="re-mi ${i === mi ? "on" : ""}" data-i="${i}"><span class="re-ic">${b[2]}</span><b>${b[1]}</b><small>${b[3]}</small></div>`).join("");
    const r = sel().getRangeAt(0).getBoundingClientRect(), hr = host.getBoundingClientRect();
    menu.style.left = Math.max(0, Math.min((r.left || hr.left + 10) - hr.left, hr.width - 230)) + "px";
    menu.style.top = ((r.bottom || hr.top + 60) - hr.top + 6) + "px";
    menu.hidden = false;
    menu.querySelectorAll("[data-i]").forEach(x => x.onmousedown = e => { e.preventDefault(); choose(+x.dataset.i); });
  }
  function choose(i) {
    const b = mlist[i]; if (!b) return;
    if (slashNode) { const t = slashNode.textContent; const end = sel().anchorOffset; slashNode.textContent = t.slice(0, slashOff) + t.slice(end); const r = document.createRange(); r.setStart(slashNode, Math.min(slashOff, slashNode.textContent.length)); r.collapse(true); sel().removeAllRanges(); sel().addRange(r); }
    closeMenu(); apply(b[0]);
  }
  doc.addEventListener("input", () => {
    const s = sel(); if (!s.rangeCount) return;
    const n = s.anchorNode; if (!n || n.nodeType !== 3) { closeMenu(); return; }
    const before = n.textContent.slice(0, s.anchorOffset), m = before.match(/(?:^|\s)\/([^\s/]{0,12})$/);
    if (m) { slashNode = n; slashOff = s.anchorOffset - m[1].length - 1; openMenu(m[1]); } else closeMenu();
    if (!doc.innerHTML.trim()) doc.innerHTML = "<p><br></p>";
  });
  doc.addEventListener("keydown", e => {
    if (!menu.hidden) {
      if (e.key === "ArrowDown") { e.preventDefault(); mi = (mi + 1) % mlist.length; openMenu(slashNode ? slashNode.textContent.slice(slashOff + 1, sel().anchorOffset) : ""); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); mi = (mi - 1 + mlist.length) % mlist.length; openMenu(slashNode ? slashNode.textContent.slice(slashOff + 1, sel().anchorOffset) : ""); return; }
      if (e.key === "Escape") { e.preventDefault(); closeMenu(); return; }
    }
  });
  // Enter·지우기는 beforeinput에서 처리해요 (한글 입력 중에 Enter를 눌러도 똑같이 동작하도록)
  const newP = () => { const p = document.createElement("p"); p.innerHTML = "<br>"; return p; };
  const atStart = el => { const s = sel(); if (!s.rangeCount || !s.isCollapsed) return false; const r = document.createRange(); r.selectNodeContents(el); r.setEnd(s.anchorNode, s.anchorOffset); return !r.toString().length; };
  doc.addEventListener("beforeinput", e => {
    const b = caretBlock(), cls = b && b.classList, par = b && b.parentNode && b.parentNode.classList;
    if (e.inputType === "insertParagraph") {
      if (!menu.hidden && mlist.length) { e.preventDefault(); choose(mi); return; }
      if (cls && cls.contains("tg-head")) {               // 토글 제목에서 Enter
        e.preventDefault(); const t = b.parentNode;
        if (t.classList.contains("open")) { const body = t.querySelector(".tg-body"); let p = body.firstElementChild; if (!p) { p = newP(); body.append(p); } placeCaret(p); }
        else { const p = newP(); t.after(p); placeCaret(p); }
        return;
      }
      if (par && (par.contains("tg-body") || par.contains("callout")) && !b.textContent.trim() && b === b.parentNode.lastElementChild) {
        e.preventDefault(); const box = par.contains("tg-body") ? b.parentNode.parentNode : b.parentNode;   // 빈 줄에서 Enter → 토글·상자 밖으로
        if (b.parentNode.children.length > 1) b.remove();
        const p = newP(); box.after(p); placeCaret(p); return;
      }
    }
    if (e.inputType === "deleteContentBackward" && cls && cls.contains("tg-head") && atStart(b)) {   // 토글 제목 맨 앞에서 지우기 → 일반 글로
      e.preventDefault(); const t = b.parentNode, p = document.createElement("p"); p.innerHTML = b.innerHTML || "<br>";
      const body = [...t.querySelector(".tg-body").children].filter(x => x.textContent.trim());
      t.replaceWith(p, ...body); placeCaret(p);
    }
  });
  doc.addEventListener("keyup", e => {
    if (e.key !== "Enter") return;
    const li = caretBlock(); if (li && li.tagName === "LI" && !li.textContent.trim()) li.removeAttribute("data-done");
  });
  doc.addEventListener("blur", () => setTimeout(closeMenu, 150));
  doc.addEventListener("paste", e => { // 붙여넣기는 글자만 (서식 깨짐 방지)
    const t = (e.clipboardData || window.clipboardData).getData("text/plain"); if (!t) return;
    e.preventDefault(); document.execCommand("insertText", false, t);
  });

  // 템플릿
  host.querySelector(".re-tpl").onclick = async e => {
    e.preventDefault();
    const user = await loadTemplates();
    document.querySelectorAll(".re-tplmenu").forEach(x => x.remove());
    const m = document.createElement("div"); m.className = "re-tplmenu";
    m.innerHTML = `<div class="re-tplh">기본 템플릿</div>${BUILTIN_TPL.map(t => `<div class="re-mi" data-t="${t.id}"><b>${esc(t.name)}</b></div>`).join("")}
      ${user.length ? `<div class="re-tplh">저장한 템플릿</div>${user.map(t => `<div class="re-mi" data-t="${t.id}"><b>${esc(t.name)}</b><small>${esc(who(t.created_by ? t.created_by.replace(/^관리자 /, "") : ""))}</small><button type="button" class="re-del" data-del="${t.id}" title="삭제">✕</button></div>`).join("")}` : ""}
      <div class="re-tplh"></div><div class="re-mi save" data-save><b>＋ 지금 내용을 템플릿으로 저장</b></div>`;
    host.appendChild(m);
    const off = ev => { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener("mousedown", off, true); } };
    setTimeout(() => document.addEventListener("mousedown", off, true));
    m.querySelectorAll("[data-t]").forEach(x => x.onclick = ev => {
      if (ev.target.dataset.del) return;
      const t = BUILTIN_TPL.find(y => y.id === x.dataset.t) || user.find(y => y.id === x.dataset.t);
      const empty = !doc.textContent.trim();
      doc.innerHTML = (empty ? "" : doc.innerHTML) + richClean(t.body) + "<p><br></p>";
      m.remove(); doc.focus(); placeCaret(doc.lastElementChild);
      if (opts.onTemplate && empty) opts.onTemplate(t);
    });
    m.querySelectorAll("[data-del]").forEach(x => x.onclick = ev => { ev.stopPropagation(); confirmBox("이 템플릿을 지울까요?", async () => {
      const r = await sb.from("templates").delete().eq("id", x.dataset.del); if (r.error) { dbErr(r.error, "삭제"); return; }
      USER_TPL = USER_TPL.filter(y => y.id !== x.dataset.del); m.remove(); toast("지웠어요"); }); });
    m.querySelector("[data-save]").onclick = () => {
      m.remove();
      if (!doc.textContent.trim()) { toast("먼저 내용을 적어 주세요"); return; }
      const body = richClean(doc.innerHTML);
      const d = document.createElement("div"); d.className = "overlay center"; d.style.zIndex = 80;
      d.innerHTML = `<div class="modal" style="width:min(420px,calc(100% - 32px))"><h2>템플릿으로 저장</h2><label class="f"><span>템플릿 이름</span><input id="tplName" placeholder="예: 나트랑 업체 미팅"></label>
        <p class="hint">저장하면 모든 관리자가 '📄 템플릿'에서 불러올 수 있어요.</p><div class="btns"><button class="btn" data-no>취소</button><button class="btn main" data-yes>저장</button></div></div>`;
      document.body.appendChild(d); d.querySelector("#tplName").focus();
      d.querySelector("[data-no]").onclick = () => d.remove();
      d.querySelector("[data-yes]").onclick = async () => {
        const name = d.querySelector("#tplName").value.trim(); if (!name) return;
        const r = await sb.from("templates").insert({ name, body }).select().single();
        if (r.error) { dbErr(r.error); return; }
        USER_TPL = [...(USER_TPL || []), r.data]; d.remove(); toast("템플릿으로 저장했어요 ✅");
      };
    };
  };
  return { get: () => richClean(doc.innerHTML), el: doc };
}

// 읽기 전용으로 보여 줄 때 (체크·토글은 눌러서 바꿀 수 있고, 바꾸면 onChange로 알려 줘요)
function richView(el, html, onChange) {
  el.classList.add("re-doc", "view"); el.innerHTML = richFrom(html) || `<p class="hint">내용 없음</p>`;
  el.onclick = e => {
    const li = e.target.closest("ul.check > li"); if (li && e.target === li && e.offsetX < 24) { li.toggleAttribute("data-done"); if (onChange) onChange(richClean(el.innerHTML)); return; }
    const h = e.target.closest(".tg-head"); if (h) h.parentNode.classList.toggle("open");
  };
}

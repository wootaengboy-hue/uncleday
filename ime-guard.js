/* ⌨️ 한글 입력 보호 — 검색칸에 "그랜드"를 치면 "ㄱㅡㄹ"처럼 글자가 풀리던 문제
 * 관리자 화면의 검색칸은 한 글자 칠 때마다 목록을 새로 그리면서 입력칸도 새로 만들어요.
 * 한글은 글자를 조합하는 중(ㄱ → 그 → 글)에 입력칸이 바뀌면 조합이 끊겨 자모가 따로 들어가요.
 * 그래서: 조합 중에는 '새로 그리기'를 잠시 막고, 한 글자가 완성되거나 타자를 잠깐(0.45초) 멈추면 그때 그려요.
 * (영어 · 숫자 입력은 그대로 · 화면 코드 수정 없이 모든 검색칸에 적용)
 */
(() => {
  if (window.__imeGuard) return; window.__imeGuard = 1;
  const isText = t => t && (t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && /^(text|search|)$/i.test(t.type || "")));
  let composing = null, idle = 0;
  const fire = t => { clearTimeout(idle); if (!t.isConnected) return; const ev = new Event("input", { bubbles: true }); ev.__ime = 1; t.dispatchEvent(ev); };
  addEventListener("compositionstart", e => { if (isText(e.target)) composing = e.target; }, true);
  addEventListener("input", e => {
    // 조합 중인 입력은 화면 코드로 보내지 않아요 (입력칸 자체에는 글자가 정상으로 들어가요)
    if (isText(e.target) && (e.isComposing || composing === e.target) && !e.__ime) {
      e.stopImmediatePropagation();
      const t = e.target; clearTimeout(idle); idle = setTimeout(() => fire(t), 450);   // 타자를 멈추면 조합 중인 글자까지 넣어서 찾기
    }
  }, true);
  addEventListener("compositionend", e => {
    const t = e.target; if (!isText(t)) return; composing = null;
    // 다음 글자 조합이 바로 이어지면 기다리고, 조합이 끝나 있으면 그때 한 번 그려요
    setTimeout(() => { if (composing !== t) fire(t); }, 0);
  }, true);
  // 조합 중에 다른 곳을 누르면(입력칸을 떠나면) 마지막 글자까지 반영
  addEventListener("blur", e => { const t = e.target; if (isText(t) && composing === t) { composing = null; fire(t); } }, true);
})();

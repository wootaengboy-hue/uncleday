/* 브랜드 이름은 번역하지 않기
   크롬·사파리 자동 번역이 "Uncle Day"를 "데이 삼촌", "삼촌의 날"처럼 바꾸지 않도록
   화면에 나오는 "Uncle Day" / "UncleDay" / "엉클데이" 글자만 translate="no" 로 감싸요.
   나머지 문장은 그대로 번역돼요. 나중에 그려지는 화면(채팅·예약 등)도 자동으로 처리해요. */
(function () {
  if (window.__udNoTr) return; window.__udNoTr = true;
  var RE = /(Uncle\s?Day|엉클\s?데이)/i, RE_SPLIT = /(Uncle\s?Day|엉클\s?데이)/gi;
  var SKIP = /^(SCRIPT|STYLE|TEXTAREA|INPUT|SELECT|OPTION|CODE|PRE|TITLE|NOSCRIPT|SVG)$/;

  function blocked(n) {
    for (var p = n.parentNode; p && p.nodeType === 1; p = p.parentNode) {
      if (SKIP.test(p.tagName) || p.isContentEditable || p.getAttribute("translate") === "no") return true;
    }
    return false;
  }
  function wrapText(n) {
    var parts = n.nodeValue.split(RE_SPLIT), f = document.createDocumentFragment();
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      if (i % 2) { var s = document.createElement("span"); s.setAttribute("translate", "no"); s.className = "notranslate"; s.textContent = parts[i]; f.appendChild(s); }
      else f.appendChild(document.createTextNode(parts[i]));
    }
    n.parentNode.replaceChild(f, n);
  }
  // 입력칸 안내 글자(placeholder)에 브랜드가 있으면 그 칸은 번역하지 않아요
  function guardFields(root) {
    if (!root.querySelectorAll) return;
    var els = root.querySelectorAll("[placeholder]");
    for (var i = 0; i < els.length; i++) if (RE.test(els[i].getAttribute("placeholder") || "")) els[i].setAttribute("translate", "no");
  }
  function scan(root) {
    if (!root) return;
    if (root.nodeType === 3) { if (RE.test(root.nodeValue) && root.parentNode && !blocked(root)) wrapText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), list = [];
    while (w.nextNode()) if (RE.test(w.currentNode.nodeValue)) list.push(w.currentNode);
    for (var i = 0; i < list.length; i++) if (list[i].parentNode && !blocked(list[i])) wrapText(list[i]);
    guardFields(root);
    if (root.nodeType === 1 && root.hasAttribute("placeholder") && RE.test(root.getAttribute("placeholder"))) root.setAttribute("translate", "no");
  }
  function start() {
    scan(document.body);
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i];
        if (m.type === "characterData") scan(m.target);
        else for (var j = 0; j < m.addedNodes.length; j++) scan(m.addedNodes[j]);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();

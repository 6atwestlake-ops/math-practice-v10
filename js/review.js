/* v10: Review questions with tap-to-show answers. Used by every profile and by Dad. Not a test: nothing is recorded. */
(function (global) {
  'use strict';
  function ansText(a) {
    if (a && typeof a === 'object' && a.kind === 'qr') return a.q + ' r ' + a.r;
    if (a && typeof a === 'object' && 'n' in a && 'd' in a) return a.n + '/' + a.d;
    return String(a);
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  /* who: 'cole' | 'guest' | 'taya' | 'dad' (Dad gets a picker for whose questions) */
  function mount(root, who, startSet) {
    root.innerHTML = '';
    var card = el('div', 'card');
    card.appendChild(el('h3', null, 'Review questions'));
    var intro = el('p', 'hint', 'Read through any set. Tap a question to show its answer. This is not a test, so nothing is scored.');
    intro.style.textAlign = 'left';
    card.appendChild(intro);
    var whoSel = null, setSel = el('select', 'select-field');
    if (who === 'dad') {
      card.appendChild(el('label', 'field-label', 'Questions for'));
      whoSel = el('select', 'select-field');
      [['cole', 'Cole (from your Sheet)'], ['guest', 'Guest (sample, new each time)'], ['taya', 'Taya (sample, new each time)']].forEach(function (o) {
        var op = el('option', null, o[1]); op.value = o[0]; whoSel.appendChild(op);
      });
      whoSel.id = 'revWho';
      card.appendChild(whoSel);
    }
    var setLabel = el('label', 'field-label', 'Set');
    setSel.id = 'revSet';
    for (var i = 1; i <= 20; i++) { var o = el('option', null, 'Set ' + i); o.value = String(i); setSel.appendChild(o); }
    if (startSet >= 1 && startSet <= 20) setSel.value = String(startSet);
    card.appendChild(setLabel); card.appendChild(setSel);
    var desc = el('p', 'hint'); desc.style.textAlign = 'left'; card.appendChild(desc);
    var ver = el('p', 'hint'); ver.style.textAlign = 'left'; card.appendChild(ver);
    var list = el('ol', 'rev-list'); list.id = 'revList'; card.appendChild(list);
    root.appendChild(card);

    function current() { return whoSel ? whoSel.value : who; }
    function show() {
      var w = current(), n = parseInt(setSel.value, 10), qs = [];
      var hasSets = w !== 'taya';
      setLabel.style.display = setSel.style.display = hasSets ? '' : 'none';
      desc.textContent = hasSets && global.ColeMathGuest ? ColeMathGuest.describe(n) : 'Grade 6 mix: facts, long division, BEDMAS, decimals, fractions, geometry.';
      ver.textContent = '';
      if (w === 'cole' && global.ColeMathBank && ColeMathBank.ready()) {
        qs = ColeMathBank.rows(n).map(function (r) { return { prompt: r.prompt, answer: r.answer }; });
        ver.textContent = who === 'dad' ? qs.length + ' questions from your Sheet (version ' + ColeMathBank.version() + '). Sheet edits show up after Education bot republishes them.' : 'All ' + qs.length + ' questions in this set.';
      } else if (w === 'taya' && global.ColeMathTaya6) {
        qs = ColeMathTaya6.makeSession(50);
        ver.textContent = 'A sample of 50. Your real sets pick new questions each time.';
      } else if (global.ColeMathGuest) {
        var keep = ColeMathGuest.getLevel();
        ColeMathGuest.setLevel(n);
        qs = ColeMathGuest.makeSession(50);
        ColeMathGuest.setLevel(keep);
        ver.textContent = 'A sample of 50. New questions are made each time.';
      }
      list.innerHTML = '';
      qs.forEach(function (q) {
        var li = el('li'), p = el('div', 'rev-q'), a = el('div', 'rev-a', 'Tap to show answer');
        global.ColeMathFmt ? ColeMathFmt.set(p, q.prompt) : (p.textContent = q.prompt);
        li.onclick = function () { a.textContent = 'Answer: ' + ansText(q.answer); a.className = 'rev-a shown'; };
        li.appendChild(p); li.appendChild(a); list.appendChild(li);
      });
    }
    setSel.onchange = show;
    if (whoSel) whoSel.onchange = show;
    show();
  }
  global.ColeMathReview = { mount: mount, answerText: ansText };
})(typeof window !== 'undefined' ? window : global);

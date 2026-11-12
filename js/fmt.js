/* v10: show exponents as real superscripts (x^2 -> x<sup>2</sup>) without innerHTML of raw text. */
(function (global) {
  'use strict';
  var RE = /\^(\(-?[0-9a-z?]+\)|-?[0-9]+|[a-z?])/gi;
  function parts(text) {
    var out = [], last = 0, m, s = String(text == null ? '' : text);
    RE.lastIndex = 0;
    while ((m = RE.exec(s))) {
      if (m.index > last) out.push({ t: s.slice(last, m.index) });
      var e = m[1];
      if (e.charAt(0) === '(') e = e.slice(1, -1);
      out.push({ t: e, sup: true });
      last = RE.lastIndex;
    }
    if (last < s.length) out.push({ t: s.slice(last) });
    return out;
  }
  function set(el, text) {
    if (!el) return;
    el.textContent = '';
    var wrap = document.createElement('span');
    parts(text).forEach(function (p) {
      if (p.sup) { var s = document.createElement('sup'); s.textContent = p.t; wrap.appendChild(s); }
      else wrap.appendChild(document.createTextNode(p.t));
    });
    el.appendChild(wrap);
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function html(text) {
    return parts(text).map(function (p) { return p.sup ? '<sup>' + esc(p.t) + '</sup>' : esc(p.t); }).join('');
  }
  global.ColeMathFmt = { set: set, html: html, parts: parts };
})(typeof window !== 'undefined' ? window : global);

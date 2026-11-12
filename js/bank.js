/* Question bank from Dad's Google Sheet (published as data/bank.json).
   Static file, cached for offline use; last good copy kept in localStorage. */
(function (global) {
  'use strict';
  var LS_KEY = 'coleMathBank_v10';
  var bank = null;

  function normalize(s) {
    return String(s == null ? '' : s).replace(/[\u2212\u2013]/g, '-').replace(/,/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = b; b = a % b; a = t; } return a || 1; }

  /* Parse an answer string: integer, decimal, fraction a/b, or "q r r". No eval. */
  function parse(s) {
    var t = normalize(s).replace(/^[a-z]\s*=\s*/, '');
    var m;
    if ((m = /^(-?\d+)\s*r\s*(\d+)$/.exec(t))) return { kind: 'qr', q: +m[1], r: +m[2] };
    t = t.replace(/\s+/g, '');
    if ((m = /^(-?)(\d+)\/(\d+)$/.exec(t))) {
      if (+m[3] === 0) return null;
      return { kind: 'frac', n: (m[1] ? -1 : 1) * +m[2], d: +m[3] };
    }
    if (/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return { kind: 'num', v: Number(t) };
    return null;
  }

  function makeCheck(answer) {
    var a = parse(answer);
    return function (user) {
      var u = parse(user);
      if (!a || !u) return false;
      if (a.kind === 'qr') return u.kind === 'qr' && u.q === a.q && u.r === a.r;
      if (a.kind === 'frac') {
        if (u.kind === 'frac') return u.n * a.d === a.n * u.d && gcd(u.n, u.d) === 1; // simplest form
        if (u.kind === 'num') return Math.abs(u.v - a.n / a.d) < 1e-9 && a.d === 1;
        return false;
      }
      if (u.kind === 'num') return Math.abs(u.v - a.v) <= 0.011;
      if (u.kind === 'qr') return u.r === 0 && u.q === a.v;
      return false;
    };
  }

  function valid(b) {
    if (!b || typeof b !== 'object' || !b.version || !b.sets) return false;
    var k, i, rows, ids;
    for (k = 1; k <= 20; k++) {
      rows = b.sets[String(k)];
      if (!rows || !rows.length) return false;
      ids = {};
      for (i = 0; i < rows.length; i++) {
        if (!rows[i] || !rows[i].id || ids[rows[i].id] || typeof rows[i].prompt !== 'string' || !parse(rows[i].answer)) return false;
        ids[rows[i].id] = true;
      }
    }
    return true;
  }

  function loadCached() {
    try { var b = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); if (valid(b)) bank = b; } catch (e) {}
  }

  function refresh() {
    if (typeof fetch !== 'function') return Promise.resolve(bank);
    return fetch('data/bank.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }).then(function (b) {
      if (valid(b)) {
        bank = b;
        try { localStorage.setItem(LS_KEY, JSON.stringify(b)); } catch (e) {}
      }
      return bank;
    }).catch(function () { return bank; });
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  var LABELS = { fact: 'Facts', fractions: 'Fractions', eq1: 'Equations', eq2: 'Equations', eq2int: 'Equations', multiEq: 'Equations' };

  function toQuestion(row, setNo) {
    return {
      id: row.id,
      set: setNo,
      type: row.type || 'mixed',
      label: (LABELS[row.type] || (row.type ? String(row.type).replace(/([a-z])([A-Z0-9])/g, '$1 $2').toLowerCase().replace(/^./, function (c) { return c.toUpperCase(); }) : 'Question')) + ' \u00b7 Set ' + setNo,
      prompt: row.prompt,
      hint: row.hint || '',
      answer: row.answer,
      promptClass: row.prompt.length > 40 ? 'small' : '',
      check: makeCheck(row.answer)
    };
  }

  /* Up to `count` unique questions; if more are enabled, a random 50 are chosen. */
  function makeSession(setNo, count) {
    if (!bank) return null;
    var rows = (bank.sets[String(setNo)] || []).slice();
    if (!rows.length) return null;
    shuffle(rows);
    rows = rows.slice(0, count || 50);
    return rows.map(function (r) { return toQuestion(r, setNo); });
  }

  function rows(setNo) { return bank ? (bank.sets[String(setNo)] || []) : []; }

  loadCached();

  global.ColeMathBank = {
    refresh: refresh,
    ready: function () { return !!bank; },
    version: function () { return bank ? bank.version : null; },
    makeSession: makeSession,
    rows: rows,
    makeCheck: makeCheck,
    parse: parse,
    valid: valid,
    _set: function (b) { if (valid(b)) bank = b; return !!bank; }
  };
})(typeof window !== 'undefined' ? window : global);

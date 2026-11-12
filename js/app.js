/* Math Practice — profiles, practice, Dad dashboard */
(function () {
  'use strict';

  var STREAK_REWARD = 5;

  var state = {
    session: [],
    index: 0,
    correctCount: 0,
    attempted: 0,
    firstTryOk: true,
    startedAt: 0,
    awaitingNext: false
  };

  function $(id) { return document.getElementById(id); }

  function showScreen(name) {
    var screens = document.querySelectorAll('.screen');
    var i;
    for (i = 0; i < screens.length; i++) {
      screens[i].className = screens[i].className.replace(/\bactive\b/g, '').replace(/\s+/g, ' ').trim();
    }
    var tabs = document.querySelectorAll('nav.tabs button');
    for (i = 0; i < tabs.length; i++) {
      tabs[i].className = tabs[i].className.replace(/\bactive\b/g, '').replace(/\s+/g, ' ').trim();
      tabs[i].style.display = '';
    }
    var s = $('screen-' + name);
    if (s) s.className += ' active';
    var t = $('tab-' + name);
    if (t) t.className += ' active';

    var p = ColeMathProfiles.getActive();
    if (p && p.role === 'dashboard') {
      // Dad: hide practice tab
      if ($('tab-practice')) $('tab-practice').style.display = 'none';
      if ($('tab-progress')) $('tab-progress').style.display = 'none';
      if ($('tab-home')) $('tab-home').textContent = 'Dashboard';
    } else {
      if ($('tab-home')) $('tab-home').textContent = 'Home';
    }

    if (name === 'progress' && p && p.role === 'student') {
      ColeMathProgress.render($('progressRoot'));
    }
    if (name === 'dashboard') {
      ColeMathDashboard.refresh($('dashboardRoot'));
    }
    if (window.ColeMathDraw) {
      ColeMathDraw.setEnabled(name === 'practice');
      if (name === 'practice') ColeMathDraw.clear();
    }
  }

  function updateChrome() {
    var p = ColeMathProfiles.getActive();
    var title = p ? (p.name + ' Math') : 'Math Practice';
    if ($('appTitle')) $('appTitle').textContent = title;
    if ($('streakHud')) {
      if (p && p.role === 'student') {
        $('streakHud').textContent = 'Streak ' + ColeMathStorage.getStreak();
      } else {
        $('streakHud').textContent = p ? p.name : '';
      }
    }
  }

  function showProfilePicker() {
    ColeMathProfiles.clearActive();
    clearTimers();
    state.sessionId = 0;
    closeSketch();
    state.session = [];
    updateChrome();
    var root = $('profileList');
    var html = '';
    ColeMathProfiles.list().forEach(function (p) {
      html += '<button type="button" class="btn profile-btn" data-id="' + p.id + '">';
      html += '<strong>' + p.name + '</strong><span class="hint">' + p.blurb + '</span>';
      html += '</button>';
    });
    root.innerHTML = html;
    var btns = root.querySelectorAll('.profile-btn');
    var i;
    for (i = 0; i < btns.length; i++) {
      btns[i].onclick = function (ev) {
        var id = (ev.currentTarget.getAttribute('data-id'));
        if (id === 'guest') beginGuest();
        else beginProfile(id);
      };
    }
    $('pinPanel').style.display = 'none';
    if ($('guestSetup')) $('guestSetup').style.display = 'none';
    showScreen('profiles');
    // hide main tabs on picker
    var tabs = document.querySelectorAll('nav.tabs button');
    for (i = 0; i < tabs.length; i++) tabs[i].style.display = 'none';
  }

  var pendingProfileId = null;
  var GUEST_LEVEL_KEY = 'coleMathGuestLevel';

  function fillGuestLevels() {
    var sel = $('guestLevel');
    if (!sel) return;
    if (!sel.options.length) {
      var i, opt;
      for (i = 1; i <= 20; i++) {
        opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = 'Level ' + i;
        sel.appendChild(opt);
      }
    }
    var saved = '10';
    try { saved = localStorage.getItem(GUEST_LEVEL_KEY) || '10'; } catch (e) {}
    if (parseInt(saved, 10) >= 1 && parseInt(saved, 10) <= 20) sel.value = saved;
    sel.onchange = updateGuestLevelDesc;
    updateGuestLevelDesc();
  }

  function updateGuestLevelDesc() {
    var sel = $('guestLevel');
    var el = $('guestLevelDesc');
    if (!sel || !el) return;
    if (window.ColeMathGuest && ColeMathGuest.describe) el.textContent = ColeMathGuest.describe(sel.value);
  }

  function beginGuest() {
    pendingProfileId = 'guest';
    if ($('pinPanel')) $('pinPanel').style.display = 'none';
    fillGuestLevels();
    if ($('guestSetup')) $('guestSetup').style.display = 'block';
  }

  var COLE_LEVEL_KEY = 'coleMathColeLevel';
  function levelKeyFor(pid) { return pid === 'guest' ? GUEST_LEVEL_KEY : 'coleMath' + pid.charAt(0).toUpperCase() + pid.slice(1) + 'Level'; }
  function savedLevel(pid) {
    var v = NaN;
    try { v = parseInt(localStorage.getItem(levelKeyFor(pid)), 10); } catch (e) {}
    if (!(v >= 1 && v <= 20)) v = pid === 'guest' ? 10 : 1;
    return v;
  }
  /* ---- v10: best first-try score per set, skipped-twice log ---- */
  function bestKey(pid) { return 'coleMathBest_' + pid; }
  function getBest(pid) {
    try { var b = JSON.parse(localStorage.getItem(bestKey(pid)) || '{}'); return (b && typeof b === 'object') ? b : {}; } catch (e) { return {}; }
  }
  function saveBest(pid, setNo, score, total) {
    var b = getBest(pid), cur = b[setNo];
    if (!cur || score > cur.score) {
      b[setNo] = { score: score, total: total, date: ColeMathStorage.todayKey() };
      try { localStorage.setItem(bestKey(pid), JSON.stringify(b)); } catch (e) {}
      return true;
    }
    return false;
  }
  function logSkippedTwice(pid, q) {
    var key = 'coleMathSkipLog_' + pid, log = [];
    try { log = JSON.parse(localStorage.getItem(key) || '[]') || []; } catch (e) { log = []; }
    log.unshift({ when: new Date().toISOString(), set: q.set || savedLevel(pid), id: q.id || '', prompt: q.prompt });
    if (log.length > 200) log = log.slice(0, 200);
    try { localStorage.setItem(key, JSON.stringify(log)); } catch (e2) {}
  }

  function renderSetList(pid) {
    var root = $('setList');
    if (!root) return;
    var best = getBest(pid), cur = savedLevel(pid), html = '', i, b, d;
    for (i = 1; i <= 20; i++) {
      b = best[i];
      d = window.ColeMathGuest && ColeMathGuest.describe ? ColeMathGuest.describe(i) : '';
      html += '<button type="button" class="set-btn' + (i === cur ? ' current' : '') + '" data-set="' + i + '">' +
        '<span class="set-no">Set ' + i + '</span>' +
        '<span class="set-desc"></span>' +
        '<span class="set-best">' + (b ? 'Best ' + b.score + '/' + b.total : 'Not tried') + '</span></button>';
    }
    root.innerHTML = html;
    var btns = root.querySelectorAll('.set-btn');
    for (i = 0; i < btns.length; i++) {
      btns[i].querySelector('.set-desc').textContent = window.ColeMathGuest && ColeMathGuest.describe ? ColeMathGuest.describe(i + 1) : '';
      btns[i].onclick = function (ev) {
        var n = ev.currentTarget.getAttribute('data-set');
        try { localStorage.setItem(levelKeyFor(pid), n); } catch (e) {}
        startSession();
      };
    }
  }

  function fillHomeLevels(pid) {
    var sel = $('homeLevel');
    if (!sel) return;
    if (!sel.options.length) {
      var i, opt;
      for (i = 1; i <= 20; i++) {
        opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = 'Set ' + i;
        sel.appendChild(opt);
      }
    }
    sel.value = String(savedLevel(pid));
    sel.onchange = function () {
      try { localStorage.setItem(levelKeyFor(pid), sel.value); } catch (e) {}
      updateHomeLevelDesc();
    };
    updateHomeLevelDesc();
  }
  function updateHomeLevelDesc() {
    var sel = $('homeLevel'), el = $('homeLevelDesc');
    if (sel && el && window.ColeMathGuest && ColeMathGuest.describe) el.textContent = ColeMathGuest.describe(sel.value);
  }

  function startGuestPractice() {
    var sel = $('guestLevel');
    var level = sel ? parseInt(sel.value, 10) : 10;
    if (!(level >= 1 && level <= 20)) level = 10;
    try { localStorage.setItem(GUEST_LEVEL_KEY, String(level)); } catch (e2) {}
    if (window.ColeMathGuest && ColeMathGuest.setLevel) ColeMathGuest.setLevel(level);
    if ($('guestSetup')) $('guestSetup').style.display = 'none';
    enterProfile('guest');
    startSession();
  }


  function beginProfile(id) {
    if (id === 'guest') { beginGuest(); return; }
    pendingProfileId = id;
    if ($('guestSetup')) $('guestSetup').style.display = 'none';
    var needsSet = !ColeMathProfiles.hasPin(id);
    $('pinPanel').style.display = 'block';
    $('pinInput').value = '';
    if (needsSet) {
      $('pinTitle').textContent = 'Choose a 4-digit PIN for ' + ColeMathProfiles.get(id).name;
      $('pinHint').textContent = 'Optional lock so others do not switch by accident. You can use 0000 if you want it easy.';
      $('pinSubmit').textContent = 'Save PIN & continue';
    } else {
      $('pinTitle').textContent = 'Enter PIN for ' + ColeMathProfiles.get(id).name;
      $('pinHint').textContent = '';
      $('pinSubmit').textContent = 'Unlock';
    }
    setTimeout(function () { try { $('pinInput').focus(); } catch (e) {} }, 50);
  }

  function submitPin() {
    var id = pendingProfileId;
    if (!id) return;
    var pin = ($('pinInput').value || '').trim();
    if (!/^\d{4}$/.test(pin)) {
      $('pinHint').textContent = 'Please enter exactly 4 digits.';
      return;
    }
    if (!ColeMathProfiles.hasPin(id)) {
      ColeMathProfiles.setPin(id, pin);
    } else if (!ColeMathProfiles.checkPin(id, pin)) {
      $('pinHint').textContent = 'That PIN does not match. Try again.';
      return;
    }
    enterProfile(id);
  }

  function enterProfile(id) {
    ColeMathProfiles.setActive(id);
    pendingProfileId = null;
    $('pinPanel').style.display = 'none';
    updateChrome();
    var tabs = document.querySelectorAll('nav.tabs button');
    var i;
    for (i = 0; i < tabs.length; i++) tabs[i].style.display = '';

    var p = ColeMathProfiles.getActive();
    if (p.role === 'dashboard') {
      showScreen('dashboard');
    } else {
      // update home blurb
      if ($('homeBlurb')) {
        if (p.id === 'taya') {
          $('homeBlurb').textContent = 'About 30 questions: times tables, division, decimals, fractions, and rectangle perimeter/area.';
        } else if (p.id === 'guest') {
          $('homeBlurb').textContent = '50 questions at Level ' + savedLevel('guest') + ' on the Grade 5 to 9 path (' + (window.ColeMathGuest ? ColeMathGuest.describe(savedLevel('guest')) : '') + ').';
        } else if (p.setId === 'guest') {
          $('homeBlurb').textContent = '50 questions per set. Sets 1–4 are 6×6 to 10×10 facts and division, then Grade 5 to 9 work. Tap any set to start. Your best first-try score shows on each.';
        } else {
          $('homeBlurb').textContent = 'About 50 questions in the Set 1 mix: times tables, division, integers, BEDMAS, and geometry.';
        }
      }
      if ($('homeLevelWrap')) {
        var showLv = p.setId === 'guest' && p.id !== 'guest';
        $('homeLevelWrap').style.display = showLv ? 'block' : 'none';
        if ($('startBtn')) $('startBtn').style.display = showLv ? 'none' : '';
        if (showLv) renderSetList(p.id);
      }
      if ($('homeTitle')) $('homeTitle').textContent = p.name + ' — today’s set';
      showScreen('home');
      try { if (window.ColeMathSync) ColeMathSync.trySync(); } catch (e) {}
    }
  }

  function currentQ() {
    return state.session[state.index] || null;
  }

  function updateHud() {
    var total = state.session.length;
    var pct = total ? Math.round(100 * state.index / total) : 0;
    $('barFill').style.width = pct + '%';
    $('qCount').textContent = Math.min(state.index + 1, total) + ' / ' + total;
    $('streakHud').textContent = 'Streak ' + ColeMathStorage.getStreak();
  }

  function renderQuestion() {
    var q = currentQ();
    state.awaitingNext = false;
    if (!q) {
      finishSession();
      return;
    }
    if (q._wrong === undefined) { q._wrong = 0; q._skips = 0; q._tried = false; }
    state.firstTryOk = !q._tried;
    state.wrongTries = q._wrong;
    $('typeTag').textContent = q.label || q.type;
    var prompt = $('prompt');
    prompt.textContent = q.prompt + (q.hint ? '\n' + q.hint : '');
    prompt.className = 'prompt' + (q.promptClass ? ' ' + q.promptClass : '');
    $('answerInput').value = '';
    $('feedback').textContent = q._skips ? 'Skipped once. Skip again to leave it.' : '';
    $('feedback').className = 'feedback';
    if (window.ColeMathDraw) ColeMathDraw.clear();
    if (state.sketchFor !== q) { clearSketch(); state.sketchFor = q; }
    if ($('skipBtn')) $('skipBtn').disabled = false;
    updateHud();
  }

  function answerText(q) {
    var a = q.answer;
    if (typeof a === 'number') return String(a);
    if (a && a.kind === 'qr') return a.q + ' r ' + a.r;
    return String(a);
  }

  function skip() {
    if (state.awaitingNext) return;
    var q = currentQ();
    if (!q) return;
    q._skips = (q._skips || 0) + 1;
    if (q._skips >= 2) {
      /* second skip: leave it (not correct), log it, move on */
      state.skippedTwice.push(q);
      var p = ColeMathProfiles.getActive();
      if (p) logSkippedTwice(p.id, q);
      ColeMathStorage.resetStreak();
      advance();
      return;
    }
    state.session.splice(state.index, 1);
    state.session.push(q);
    renderQuestion();
  }

  function startSession() {
    var p = ColeMathProfiles.getActive();
    if (!p || p.role !== 'student') {
      showProfilePicker();
      return;
    }
    var mod = ColeMathQuestions.current();
    if (!mod) {
      alert('Question module not loaded.');
      return;
    }
    if (p.setId === 'guest' && mod.setLevel) mod.setLevel(savedLevel(p.id));
    state.session = null;
    state.setNo = (p.setId === 'guest') ? savedLevel(p.id) : null;
    /* Cole uses Dad's Sheet questions; Guest keeps generated questions */
    if (p.id === 'cole' && window.ColeMathBank && ColeMathBank.ready()) {
      state.session = ColeMathBank.makeSession(state.setNo, p.sessionSize || 50);
    }
    if (!state.session) state.session = mod.makeSession(p.sessionSize || 50);
    state.skippedTwice = [];
    state.missedThree = [];
    state.sessionId = Date.now();
    clearTimers();
    state.index = 0;
    state.correctCount = 0;
    state.attempted = 0;
    state.startedAt = Date.now();
    ColeMathStorage.resetStreak();
    showScreen('practice');
    renderQuestion();
  }

  function finishSession() {
    var elapsed = Math.round((Date.now() - state.startedAt) / 1000);
    var acc = state.attempted ? Math.round(100 * state.correctCount / state.attempted) : 0;
    try { ColeMathStorage.addTime(elapsed); } catch (e0) {}
    ColeMathStorage.saveSessionSummary({
      attempted: state.attempted,
      correct: state.correctCount,
      accuracy: acc,
      durationSec: elapsed
    });
    try { if (window.ColeMathSync) ColeMathSync.trySync(); } catch (e1) {}
    var total = state.session.length;
    var pNow = ColeMathProfiles.getActive();
    var newBest = false;
    if (pNow && pNow.setId === 'guest' && state.setNo) newBest = saveBest(pNow.id, state.setNo, state.correctCount, total);
    var mins = Math.floor(elapsed / 60), secs = elapsed % 60;
    $('summaryBody').innerHTML =
      (state.setNo ? '<p class="hint" style="text-align:left">Set ' + state.setNo + (newBest ? ' · <strong>New best!</strong>' : '') + '</p>' : '') +
      '<div class="summary-grid">' +
      '<div class="stat"><div class="n">' + state.correctCount + '/' + total + '</div><div class="l">Correct first try</div></div>' +
      '<div class="stat"><div class="n">' + acc + '%</div><div class="l">Accuracy</div></div>' +
      '<div class="stat"><div class="n">' + state.missedThree.length + '</div><div class="l">Missed (3 tries)</div></div>' +
      '<div class="stat"><div class="n">' + state.skippedTwice.length + '</div><div class="l">Skipped twice</div></div>' +
      '<div class="stat" style="grid-column:1 / -1"><div class="n">' + mins + 'm ' + (secs < 10 ? '0' : '') + secs + 's</div><div class="l">Time</div></div>' +
      '</div>' +
      '<div id="summaryLists"></div>' +
      '<button class="btn" id="againBtn" type="button">Do another set</button>' +
      '<button class="btn secondary" id="toProgressBtn" type="button">See progress</button>' +
      '<button class="btn secondary" id="switchAfterBtn" type="button">Switch profile</button>';
    var lists = $('summaryLists');
    function addList(title, arr) {
      if (!arr.length) return;
      var h = document.createElement('h4'); h.textContent = title; lists.appendChild(h);
      var ul = document.createElement('ul'); ul.className = 'hist-list';
      arr.forEach(function (q) { var li = document.createElement('li'); var a = document.createElement('span'); a.textContent = q.prompt.replace(/\n/g, ' '); var b = document.createElement('span'); b.textContent = answerText(q); li.appendChild(a); li.appendChild(b); ul.appendChild(li); });
      lists.appendChild(ul);
    }
    addList('Missed after 3 tries', state.missedThree);
    addList('Skipped twice', state.skippedTwice);
    showScreen('summary');
    $('againBtn').onclick = startSession;
    $('toProgressBtn').onclick = function () { showScreen('progress'); };
    $('switchAfterBtn').onclick = showProfilePicker;
  }

  var timers = [];
  function later(fn, ms) {
    var sid = state.sessionId;
    timers.push(setTimeout(function () { if (state.sessionId === sid) fn(); }, ms));
  }
  function clearTimers() { while (timers.length) clearTimeout(timers.pop()); }

  function afterCorrect() {
    var streak = ColeMathStorage.getStreak();
    $('feedback').textContent = '✓';
    $('feedback').className = 'feedback ok';
    state.awaitingNext = true;
    updateHud();
    if (streak > 0 && streak % STREAK_REWARD === 0) {
      later(function () {
        if (window.ColeMathDraw) ColeMathDraw.setEnabled(false);
        ColeMathGame.start(function () {
          if (window.ColeMathDraw) ColeMathDraw.setEnabled(true);
          advance();
        });
      }, 450);
    } else {
      later(advance, 450);
    }
  }

  function advance() {
    state.index += 1;
    if (state.index >= state.session.length) finishSession();
    else renderQuestion();
  }

  function submit() {
    if (state.awaitingNext) return;
    var q = currentQ();
    if (!q) return;
    var raw = $('answerInput').value;
    if (!String(raw).replace(/\s+/g, '')) return;
    var ok = q.check(raw);
    var wasFirst = !q._tried;
    q._tried = true;
    state.firstTryOk = wasFirst;
    if (ok) {
      if (state.firstTryOk) {
        state.attempted += 1;
        state.correctCount += 1;
        ColeMathStorage.recordAnswer(q.type, true, q.prompt);
      } else {
        ColeMathStorage.recordAnswer(q.type, true, q.prompt);
      }
      afterCorrect();
    } else {
      if (state.firstTryOk) {
        state.attempted += 1;
        ColeMathStorage.recordAnswer(q.type, false, q.prompt);
        state.firstTryOk = false;
      } else {
        ColeMathStorage.recordAnswer(q.type, false, q.prompt);
      }
      q._wrong = (q._wrong || 0) + 1;
      state.wrongTries = q._wrong;
      if (state.wrongTries >= 3) {
        state.awaitingNext = true;
        state.missedThree.push(q);
        $('feedback').textContent = 'The answer is ' + answerText(q) + '. Next one!';
        $('feedback').className = 'feedback bad';
        ColeMathStorage.resetStreak();
        updateHud();
        later(advance, 2200);
        return;
      }
      $('feedback').textContent = '✗  Try again';
      $('feedback').className = 'feedback bad';
      updateHud();
      try { $('answerInput').select(); } catch (e) {}
    }
  }

  /* ---- v10: full-page sketch ---- */
  var sk = { canvas: null, ctx: null, drawing: false, x: 0, y: 0, hasMarks: false };
  function sketchSize() {
    var c = sk.canvas, wrap = $('sketchPad');
    if (!c || !wrap) return;
    var dpr = window.devicePixelRatio || 1, w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return;
    var keep = null;
    if (sk.hasMarks && c.width && c.height) { try { keep = sk.ctx.getImageData(0, 0, c.width, c.height); } catch (e) {} }
    if (c.width === Math.floor(w * dpr) && c.height === Math.floor(h * dpr)) return;
    c.width = Math.floor(w * dpr); c.height = Math.floor(h * dpr);
    c.style.width = w + 'px'; c.style.height = h + 'px';
    sk.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sk.ctx.lineCap = 'round'; sk.ctx.lineJoin = 'round'; sk.ctx.strokeStyle = '#ffffff'; sk.ctx.lineWidth = 3;
    if (keep) { try { sk.ctx.putImageData(keep, 0, 0); } catch (e2) {} }
  }
  function clearSketch() {
    if (!sk.ctx) return;
    sk.ctx.save(); sk.ctx.setTransform(1, 0, 0, 1, 0, 0); sk.ctx.clearRect(0, 0, sk.canvas.width, sk.canvas.height); sk.ctx.restore();
    sk.hasMarks = false;
  }
  function openSketch() {
    var q = currentQ();
    if (!q) return;
    $('sketchQ').textContent = q.prompt.replace(/\n/g, '  ');
    $('sketchWrap').className = 'active';
    if (window.ColeMathDraw) ColeMathDraw.setEnabled(false);
    sketchSize();
  }
  function closeSketch() {
    if ($('sketchWrap')) $('sketchWrap').className = '';
    var p = ColeMathProfiles.getActive();
    if (window.ColeMathDraw && p && p.role === 'student' && $('screen-practice').className.indexOf('active') >= 0) ColeMathDraw.setEnabled(true);
  }
  function bindSketch() {
    sk.canvas = $('sketchCanvas');
    if (!sk.canvas) return;
    sk.ctx = sk.canvas.getContext('2d');
    function pt(e) {
      var r = sk.canvas.getBoundingClientRect(), t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    }
    function start(e) { var p = pt(e); sk.drawing = true; sk.x = p.x; sk.y = p.y; if (e.cancelable) e.preventDefault(); }
    function move(e) {
      if (!sk.drawing) return;
      var p = pt(e);
      sk.ctx.beginPath(); sk.ctx.moveTo(sk.x, sk.y); sk.ctx.lineTo(p.x, p.y); sk.ctx.stroke();
      sk.x = p.x; sk.y = p.y; sk.hasMarks = true;
      if (e.cancelable) e.preventDefault();
    }
    function end() { sk.drawing = false; }
    sk.canvas.addEventListener('touchstart', start, { passive: false });
    sk.canvas.addEventListener('touchmove', move, { passive: false });
    sk.canvas.addEventListener('touchend', end);
    sk.canvas.addEventListener('mousedown', start);
    sk.canvas.addEventListener('mousemove', function (e) { if (e.buttons) move(e); });
    window.addEventListener('mouseup', end);
    window.addEventListener('resize', function () { if ($('sketchWrap').className === 'active') sketchSize(); });
    $('sketchBtn').onclick = openSketch;
    $('sketchClearBtn').onclick = clearSketch;
    $('sketchReturnBtn').onclick = closeSketch;
  }

  function bind() {
    bindSketch();
    $('tab-home').onclick = function () {
      var p = ColeMathProfiles.getActive();
      if (!p) return showProfilePicker();
      if (p.role === 'dashboard') showScreen('dashboard');
      else showScreen('home');
    };
    $('tab-practice').onclick = function () {
      var p = ColeMathProfiles.getActive();
      if (!p || p.role !== 'student') return showProfilePicker();
      if (!state.session.length) startSession();
      else showScreen('practice');
    };
    $('tab-progress').onclick = function () {
      var p = ColeMathProfiles.getActive();
      if (!p || p.role !== 'student') return showProfilePicker();
      showScreen('progress');
    };
    $('startBtn').onclick = startSession;
    $('submitBtn').onclick = submit;
    $('minusBtn').onclick = function () {
      var inp = $('answerInput');
      var v = inp.value || '';
      if (v.charAt(0) === '-') inp.value = v.slice(1);
      else inp.value = '-' + v;
      try { inp.focus(); } catch (e) {}
    };
    $('answerInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        submit();
      }
    });
    if ($('skipBtn')) $('skipBtn').onclick = skip;
    if ($('remBtn')) {
      $('remBtn').onclick = function () {
        var inp = $('answerInput');
        var v = (inp.value || '').replace(/\s+$/, '');
        if (!/r/i.test(v)) inp.value = v + ' r ';
        try { inp.focus(); } catch (e) {}
      };
    }
    $('pinSubmit').onclick = submitPin;
    $('pinInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        submitPin();
      }
    });
    $('pinCancel').onclick = function () {
      pendingProfileId = null;
      $('pinPanel').style.display = 'none';
    };
    $('switchProfileBtn').onclick = showProfilePicker;
    if ($('clearMarksBtn')) {
      $('clearMarksBtn').onclick = function () {
        if (window.ColeMathDraw) ColeMathDraw.clear();
      };
    }
    if ($('guestStartBtn')) $('guestStartBtn').onclick = startGuestPractice;
    if ($('guestCancelBtn')) {
      $('guestCancelBtn').onclick = function () {
        pendingProfileId = null;
        if ($('guestSetup')) $('guestSetup').style.display = 'none';
      };
    }
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./sw.js').then(function (reg) {
      console.log('[sw] registered', reg.scope);
    }).catch(function (err) {
      console.warn('[sw] failed', err);
    });
  }

  function init() {
    if (window.ColeMathSet1 && window.ColeMathQuestions) ColeMathQuestions.register(ColeMathSet1);
    if (window.ColeMathTaya6 && window.ColeMathQuestions) ColeMathQuestions.register(ColeMathTaya6);
    if (window.ColeMathGuest && window.ColeMathQuestions) ColeMathQuestions.register(ColeMathGuest);
    bind();
    showProfilePicker();
    registerSW();
    if (window.ColeMathBank) ColeMathBank.refresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.ColeMathApp = {
    startSession: startSession,
    submit: submit,
    getState: function () { return state; },
    skip: skip,
    getBest: getBest,
    clearTimers: clearTimers,
    STREAK_REWARD: STREAK_REWARD,
    showProfilePicker: showProfilePicker,
    beginGuest: beginGuest,
    startGuestPractice: startGuestPractice,
    enterProfile: enterProfile,
    beginProfile: beginProfile,
    submitPin: submitPin,
    trySync: function () {
      return window.ColeMathSync ? ColeMathSync.trySync() : Promise.resolve({ skipped: true });
    }
  };
})();

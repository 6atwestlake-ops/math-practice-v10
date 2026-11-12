/* Dad dashboard — local snapshots + optional remote GET */
(function (global) {
  'use strict';

  var SHEET_URL = 'https://docs.google.com/spreadsheets/d/19CPb7IIJUie1fovmWgtbQ-ycaU3xx6v38UUMGdcS9-M/edit';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderProfileCard(name, snap, sourceLabel) {
    var html = '<div class="card" style="margin-bottom:14px">';
    html += '<h3 style="margin-top:0">' + esc(name);
    if (sourceLabel) html += ' <span class="type-tag">' + esc(sourceLabel) + '</span>';
    html += '</h3>';
    if (!snap || (!snap.attempted && !(snap.dailySessions && snap.dailySessions.length))) {
      html += '<p class="hint">No practice data yet.</p></div>';
      return html;
    }
    html += '<div class="summary-grid">';
    html += '<div class="stat"><div class="n">' + (snap.attempted || 0) + '</div><div class="l">Attempted</div></div>';
    html += '<div class="stat"><div class="n">' + (snap.correct || 0) + '</div><div class="l">Correct</div></div>';
    html += '<div class="stat"><div class="n">' + (snap.accuracy || 0) + '%</div><div class="l">Accuracy</div></div>';
    html += '<div class="stat"><div class="n">' + (snap.totalMinutes || 0) + '</div><div class="l">Minutes</div></div>';
    html += '</div>';

    html += '<h4>By topic</h4><ul class="hist-list">';
    var topics = snap.topics || {};
    var tkeys = Object.keys(topics);
    if (!tkeys.length) html += '<li><span>None yet</span><span></span></li>';
    else tkeys.forEach(function (k) {
      var t = topics[k];
      html += '<li><span>' + esc(k) + '</span><span>' + t.correct + '/' + t.attempted + ' (' + t.accuracy + '%)</span></li>';
    });
    html += '</ul>';

    html += '<h4>Most missed</h4><ul class="hist-list">';
    var missed = snap.missedFacts || [];
    if (!missed.length) html += '<li><span>None yet</span><span></span></li>';
    else missed.forEach(function (m) {
      html += '<li><span>' + esc(m.fact) + '</span><span>' + m.misses + '</span></li>';
    });
    html += '</ul>';

    html += '<h4>Daily sessions</h4><ul class="hist-list">';
    var days = snap.dailySessions || [];
    if (!days.length) html += '<li><span>None yet</span><span></span></li>';
    else days.slice(0, 14).forEach(function (d) {
      html += '<li><span>' + esc(d.date) + '</span><span>' + d.questions + ' Q · ' + d.accuracy + '% · ' + d.minutes + ' min</span></li>';
    });
    html += '</ul></div>';
    return html;
  }

  function mergePreferRemote(localSnap, remoteProf) {
    if (!remoteProf) return { snap: localSnap, label: 'This device' };
    // Prefer remote totals when present (kids' phones), still show local if remote empty
    if ((remoteProf.attempted || 0) >= (localSnap.attempted || 0)) {
      return {
        snap: {
          attempted: remoteProf.attempted,
          correct: remoteProf.correct,
          accuracy: remoteProf.accuracy,
          totalMinutes: remoteProf.totalMinutes,
          topics: remoteProf.topics || {},
          missedFacts: remoteProf.missedFacts || [],
          dailySessions: remoteProf.dailySessions || [],
          lastSyncedAt: remoteProf.syncedAt || remoteProf.lastSyncedAt || null
        },
        label: 'Synced'
      };
    }
    return { snap: localSnap, label: 'This device' };
  }

  function render(el, remote) {
    var students = ColeMathProfiles.students();
    var html = '';
    html += '<div class="card" style="margin-bottom:14px">';
    html += '<h2 style="margin-top:0">Dad dashboard</h2>';
    html += '<p class="hint">Local progress on this device';
    if (remote && remote.ok) html += ' · remote totals loaded';
    else if (remote && remote.skipped) html += ' · remote sync off or offline';
    else if (remote && remote.ok === false) html += ' · remote fetch failed (showing local)';
    html += '.</p>';
    var lastSync = null;
    if (remote && remote.data && remote.data.syncedAt) lastSync = remote.data.syncedAt;
    if (!lastSync && remote && remote.data && remote.data.profiles) {
      Object.keys(remote.data.profiles).forEach(function (k) {
        var s = remote.data.profiles[k] && (remote.data.profiles[k].syncedAt || remote.data.profiles[k].lastSyncedAt);
        if (s && (!lastSync || s > lastSync)) lastSync = s;
      });
    }
    html += '<p><strong>Last synced:</strong> ' + (lastSync ? esc(lastSync) : '—') + '</p>';
    html += '<p><a class="sheet-link" href="' + SHEET_URL + '" target="_blank" rel="noopener">Open Google Sheet</a></p>';
    html += '<button class="btn secondary" type="button" id="dashRefreshBtn">Refresh remote</button>';
    html += '<button class="btn secondary" type="button" id="dashSwitchBtn">Switch profile</button>';
    html += '</div>';

    var remoteProfiles = (remote && remote.data && remote.data.profiles) || {};
    students.forEach(function (p) {
      var local = ColeMathStorage.snapshot(p.id);
      var remoteOne = remoteProfiles[p.name] || remoteProfiles[p.id] || null;
      var merged = mergePreferRemote(local, remoteOne);
      html += renderProfileCard(p.name, merged.snap, merged.label);
    });

    html += renderBestAndSkips();
    html += '<div class="card" style="margin-bottom:14px"><h3 style="margin-top:0">Review a set</h3>' +
      '<p class="hint" style="text-align:left">Look through any set. Tap a question to show its answer. Nothing here counts as practice.</p>' +
      '<label class="field-label" for="revWho">Questions for</label>' +
      '<select id="revWho" class="select-field"><option value="cole">Cole (from your Sheet)</option><option value="guest">Guest (sample, new each time)</option></select>' +
      '<label class="field-label" for="revSet">Set</label><select id="revSet" class="select-field"></select>' +
      '<p class="hint" id="revDesc" style="text-align:left"></p>' +
      '<p class="hint" id="revVer" style="text-align:left"></p>' +
      '<ol id="revList" class="rev-list"></ol></div>';

    el.innerHTML = html;
    bindReview();
    var rb = document.getElementById('dashRefreshBtn');
    if (rb) rb.onclick = function () { refresh(el); };
    var sb = document.getElementById('dashSwitchBtn');
    if (sb) sb.onclick = function () {
      ColeMathProfiles.clearActive();
      if (global.ColeMathApp && ColeMathApp.showProfilePicker) ColeMathApp.showProfilePicker();
    };
  }

  function bestFor(pid) {
    try { var b = JSON.parse(localStorage.getItem('coleMathBest_' + pid) || '{}'); return b || {}; } catch (e) { return {}; }
  }
  function renderBestAndSkips() {
    var best = bestFor('cole'), html = '<div class="card" style="margin-bottom:14px"><h3 style="margin-top:0">Cole: best first-try score per set <span class="type-tag">This device</span></h3><ul class="hist-list">';
    for (var i = 1; i <= 20; i++) {
      var b = best[i];
      html += '<li><span>Set ' + i + '</span><span>' + (b ? b.score + '/' + b.total + ' \u00b7 ' + esc(b.date) : '\u2014') + '</span></li>';
    }
    html += '</ul>';
    var log = [];
    try { log = JSON.parse(localStorage.getItem('coleMathSkipLog_cole') || '[]') || []; } catch (e) {}
    html += '<h4>Skipped twice (latest first)</h4><ul class="hist-list">';
    if (!log.length) html += '<li><span>None yet</span><span></span></li>';
    log.slice(0, 30).forEach(function (r) {
      html += '<li><span>Set ' + esc(r.set) + ': ' + esc(String(r.prompt).replace(/\n/g, ' ')) + '</span><span>' + esc(String(r.when).slice(0, 10)) + '</span></li>';
    });
    html += '</ul><p class="hint" style="text-align:left">Scores and skips are saved on the phone Cole practises on, so open Dad on his phone to see them.</p></div>';
    return html;
  }

  function bindReview() {
    var setSel = document.getElementById('revSet'), who = document.getElementById('revWho');
    if (!setSel) return;
    for (var i = 1; i <= 20; i++) { var o = document.createElement('option'); o.value = String(i); o.textContent = 'Set ' + i; setSel.appendChild(o); }
    function show() {
      var n = parseInt(setSel.value, 10), list = document.getElementById('revList'), qs = [];
      document.getElementById('revDesc').textContent = global.ColeMathGuest ? ColeMathGuest.describe(n) : '';
      if (who.value === 'cole' && global.ColeMathBank && ColeMathBank.ready()) {
        qs = ColeMathBank.rows(n).map(function (r) { return { prompt: r.prompt, answer: r.answer }; });
        document.getElementById('revVer').textContent = qs.length + ' questions from your Sheet (version ' + ColeMathBank.version() + '). Sheet edits show up here after Education bot republishes them.';
      } else if (global.ColeMathGuest) {
        var keep = ColeMathGuest.getLevel();
        ColeMathGuest.setLevel(n);
        qs = ColeMathGuest.makeSession(50).map(function (q) { return { prompt: q.prompt, answer: q.answer && q.answer.kind === 'qr' ? q.answer.q + ' r ' + q.answer.r : String(q.answer) }; });
        ColeMathGuest.setLevel(keep);
        document.getElementById('revVer').textContent = who.value === 'cole' ? 'Sheet questions not loaded yet; showing a generated sample.' : 'Guest questions are generated, so this is one sample.';
      }
      list.innerHTML = '';
      qs.forEach(function (q) {
        var li = document.createElement('li'), p = document.createElement('div'), a = document.createElement('div');
        p.className = 'rev-q'; p.textContent = q.prompt;
        a.className = 'rev-a'; a.textContent = 'Tap to show answer';
        li.onclick = function () { a.textContent = 'Answer: ' + q.answer; a.className = 'rev-a shown'; };
        li.appendChild(p); li.appendChild(a); list.appendChild(li);
      });
    }
    setSel.onchange = show; who.onchange = show;
    show();
  }

  function refresh(el) {
    el.innerHTML = '<div class="card"><p>Loading…</p></div>';
    var localOnly = function () { render(el, { skipped: true, reason: 'disabled' }); };
    if (!ColeMathSync.enabled()) {
      localOnly();
      return;
    }
    localOnly();
    ColeMathSync.fetchRemote().then(function (remote) {
      if (remote && !remote.skipped) render(el, remote);
    }).catch(function () {});
  }

  global.ColeMathDashboard = {
    render: render,
    refresh: refresh,
    SHEET_URL: SHEET_URL
  };
})(typeof window !== 'undefined' ? window : global);

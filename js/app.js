/*
 * SingCoach main application: tabs, tuner visualisation, exercise runner UI,
 * range test, recording studio and progress views.
 */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- */
  /* Shared state                                                      */
  /* ---------------------------------------------------------------- */

  var mic = new MicEngine();
  var tones = new TonePlayer(function () { return mic.ctx; });
  var trainer = new Trainer(mic, tones);
  var store = Progress.makeStore();
  var recorder = null;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function el(tag, cls, html) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  function fmtTime(ms) {
    var s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }

  function userRange() {
    var r = store.load().range;
    return Exercises.clampRange(r || Exercises.DEFAULT_RANGE);
  }

  /* ---------------------------------------------------------------- */
  /* Microphone control (shared banner + button)                       */
  /* ---------------------------------------------------------------- */

  var micButtons = $$('.mic-toggle');

  function setMicUi() {
    micButtons.forEach(function (b) {
      b.textContent = mic.running ? '🎤 Microphone on' : '🎤 Enable microphone';
      b.classList.toggle('on', mic.running);
    });
    $$('.needs-mic').forEach(function (n) {
      n.classList.toggle('mic-ready', mic.running);
    });
  }

  async function ensureMic() {
    if (mic.running) return true;
    try {
      await mic.start();
      setMicUi();
      return true;
    } catch (err) {
      var msg = err && err.name === 'NotAllowedError'
        ? 'Microphone access was blocked. Click the padlock/mic icon in your address bar and allow the microphone, then try again.'
        : 'Could not start the microphone: ' + (err.message || err);
      showToast(msg, true);
      return false;
    }
  }

  micButtons.forEach(function (b) {
    b.addEventListener('click', function () {
      if (mic.running) { mic.stop(); setMicUi(); }
      else ensureMic();
    });
  });

  var toastTimer = 0;
  function showToast(msg, isError) {
    var t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show' + (isError ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'toast'; }, 5000);
  }

  /* ---------------------------------------------------------------- */
  /* Tabs                                                              */
  /* ---------------------------------------------------------------- */

  function switchTab(name) {
    $$('.tab-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === name); });
    $$('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + name); });
    if (name === 'progress') renderProgress();
    if (name === 'studio') renderRecordings();
    if (name === 'train') renderCatalog();
    if (name === 'range') renderRangeIntro();
    if (name === 'game') renderGameIntro();
    if (name !== 'game' && game) game.stop(); // don't run the game loop off-screen
  }

  $$('.tab-btn').forEach(function (b) {
    b.addEventListener('click', function () { switchTab(b.dataset.tab); });
  });

  /* ---------------------------------------------------------------- */
  /* Learn view                                                        */
  /* ---------------------------------------------------------------- */

  function renderLessons() {
    var wrap = $('#lesson-list');
    wrap.innerHTML = '';
    var read = store.load().lessonsRead;
    Lessons.LESSONS.forEach(function (lesson) {
      var card = el('div', 'card lesson' + (read[lesson.id] ? ' read' : ''));
      var head = el('button', 'lesson-head');
      head.innerHTML = '<span class="lesson-title">' + lesson.title + '</span>' +
        '<span class="lesson-meta">' + lesson.minutes + ' min ' + (read[lesson.id] ? '✓' : '') + '</span>';
      var body = el('div', 'lesson-body');
      body.innerHTML = lesson.body.map(function (p) { return '<p>' + p + '</p>'; }).join('') +
        '<p class="try-it"><strong>Try it:</strong> ' + lesson.tryIt + '</p>';
      head.addEventListener('click', function () {
        var open = card.classList.toggle('open');
        if (open && !store.load().lessonsRead[lesson.id]) {
          store.markLessonRead(lesson.id);
          head.querySelector('.lesson-meta').innerHTML = lesson.minutes + ' min ✓';
          card.classList.add('read');
        }
      });
      card.appendChild(head);
      card.appendChild(body);
      wrap.appendChild(card);
    });
  }

  /* ---------------------------------------------------------------- */
  /* Tuner view                                                        */
  /* ---------------------------------------------------------------- */

  var tunerCanvas = $('#tuner-trace');
  var tunerCtx = tunerCanvas.getContext('2d');
  var traceData = []; // { midi or NaN }
  var TRACE_LEN = 300;

  function drawTuner() {
    var canvas = tunerCanvas;
    var w = canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
    var h = canvas.height = canvas.clientHeight * (window.devicePixelRatio || 1);
    var g = tunerCtx;
    g.clearRect(0, 0, w, h);

    // Choose a window of ~14 semitones centred on recent pitch (or range middle).
    var recent = traceData.filter(function (d) { return isFinite(d); }).slice(-40);
    var center;
    if (recent.length) {
      var sorted = recent.slice().sort(function (a, b) { return a - b; });
      center = sorted[Math.floor(sorted.length / 2)];
    } else {
      var r = userRange();
      center = (r.low + r.high) / 2;
    }
    var lowMidi = Math.floor(center - 7), highMidi = Math.ceil(center + 7);

    function yFor(midi) {
      return h - ((midi - lowMidi) / (highMidi - lowMidi)) * h;
    }

    // Note grid lines
    g.font = Math.round(11 * (window.devicePixelRatio || 1)) + 'px system-ui, sans-serif';
    for (var m = lowMidi; m <= highMidi; m++) {
      var y = yFor(m);
      var isC = m % 12 === 0;
      g.strokeStyle = isC ? 'rgba(140,160,255,0.35)' : 'rgba(255,255,255,0.07)';
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
      if (isC || m % 12 === 7) {
        g.fillStyle = 'rgba(255,255,255,0.45)';
        g.fillText(Pitch.midiToNoteName(m), 6, y - 3);
      }
    }

    // Pitch trace
    g.lineWidth = 2.5 * (window.devicePixelRatio || 1);
    g.strokeStyle = '#5eead4';
    g.beginPath();
    var started = false;
    for (var i = 0; i < traceData.length; i++) {
      var midi = traceData[i];
      var x = (i / TRACE_LEN) * w;
      if (!isFinite(midi)) { started = false; continue; }
      var yy = yFor(midi);
      if (!started) { g.moveTo(x, yy); started = true; }
      else g.lineTo(x, yy);
    }
    g.stroke();
  }

  mic.onReading(function (r) {
    // volume meter
    var meter = $('#vol-meter-fill');
    var pct = Math.min(100, Math.round(r.rms * 700));
    meter.style.width = pct + '%';
    meter.classList.toggle('hot', pct > 85);

    // trace (all tabs share the mic; only draw when tuner visible)
    traceData.push(r.voiced ? r.midi : NaN);
    if (traceData.length > TRACE_LEN) traceData.shift();

    if (!$('#view-tuner').classList.contains('active')) return;

    if (r.voiced) {
      var near = Pitch.centsToNearestNote(r.freq);
      $('#tuner-note').textContent = near.name;
      $('#tuner-freq').textContent = r.freq.toFixed(1) + ' Hz';
      var cents = near.cents;
      $('#tuner-cents').textContent = (cents >= 0 ? '+' : '') + Math.round(cents) + ' cents';
      var needle = $('#needle');
      needle.style.left = (50 + (Math.max(-50, Math.min(50, cents)) / 50) * 46) + '%';
      var zone = Math.abs(cents) <= 10 ? 'great' : Math.abs(cents) <= 25 ? 'good' : 'off';
      $('#tuner-dial').dataset.zone = zone;
    } else {
      $('#tuner-note').textContent = '♪';
      $('#tuner-freq').textContent = 'listening…';
      $('#tuner-cents').textContent = '';
      $('#tuner-dial').dataset.zone = 'idle';
    }
    drawTuner();
  });

  /* ---------------------------------------------------------------- */
  /* Train view                                                        */
  /* ---------------------------------------------------------------- */

  function renderCatalog() {
    var wrap = $('#exercise-list');
    wrap.innerHTML = '';
    var stats = store.stats();
    Exercises.CATALOG.forEach(function (item) {
      var s = stats.byExercise[item.id];
      var card = el('div', 'card exercise-card');
      card.innerHTML =
        '<div class="ex-head"><span class="ex-title">' + item.title + '</span>' +
        '<span class="badge">' + item.level + '</span></div>' +
        '<p class="ex-blurb">' + item.blurb + '</p>' +
        '<div class="ex-foot"><span class="ex-stats">' +
        (s ? 'Best ' + s.best + ' · avg ' + s.avg + ' over ' + s.count + ' runs' : 'Not tried yet') +
        '</span><button class="btn primary">Start</button></div>';
      card.querySelector('button').addEventListener('click', function () { startExercise(item.id); });
      wrap.appendChild(card);
    });
    var rangeNote = $('#train-range-note');
    var hasRange = !!store.load().range;
    rangeNote.style.display = hasRange ? 'none' : 'block';
  }

  async function startExercise(id) {
    if (!(await ensureMic())) return;
    var exercise = Exercises.forId(id, userRange());
    $('#exercise-list').style.display = 'none';
    $('#train-range-note').style.display = 'none';
    var runner = $('#exercise-runner');
    runner.style.display = 'block';
    runner.innerHTML =
      '<div class="run-head"><h3>' + exercise.title + '</h3>' +
      '<button class="btn ghost" id="run-quit">Quit</button></div>' +
      '<p class="run-desc">' + exercise.description + '</p>' +
      '<div class="run-progress" id="run-progress"></div>' +
      '<div class="run-stage">' +
      '  <div class="run-phase" id="run-phase">Get ready…</div>' +
      '  <div class="run-note" id="run-note">—</div>' +
      '  <div class="run-label" id="run-label"></div>' +
      '  <div class="cents-bar"><div class="cents-zone"></div><div class="cents-marker" id="run-marker"></div></div>' +
      '  <div class="run-hint" id="run-hint"></div>' +
      '</div>' +
      '<div class="run-results" id="run-results"></div>';

    var dots = exercise.notes.map(function () {
      var d = el('span', 'dot');
      $('#run-progress').appendChild(d);
      return d;
    });

    $('#run-quit').addEventListener('click', function () {
      trainer.cancel();
      endExerciseUi();
    });

    trainer.onState = function (s) {
      dots.forEach(function (d, i) {
        d.className = 'dot' + (i < s.noteIndex ? ' done' : i === s.noteIndex ? ' current' : '');
      });
      var noteName = Pitch.midiToNoteName(s.note.midi);
      $('#run-note').textContent = noteName;
      $('#run-label').textContent = s.note.label || '';
      if (s.phase === 'listen') {
        $('#run-phase').textContent = '👂 Listen…';
        $('#run-hint').textContent = 'Hear the note in your head.';
      } else if (s.phase === 'ready') {
        $('#run-phase').textContent = '🫁 Breathe in…';
        $('#run-hint').textContent = '';
      } else if (s.phase === 'sing') {
        $('#run-phase').textContent = '🎤 Sing "ahh" and hold it!';
      }
    };

    trainer.onLive = function (live) {
      var marker = $('#run-marker');
      if (!marker) return;
      if (live.voiced && isFinite(live.cents)) {
        var c = Math.max(-100, Math.min(100, live.cents));
        marker.style.left = (50 + (c / 100) * 48) + '%';
        marker.className = 'cents-marker ' + (Math.abs(live.cents) <= Scoring.IN_TUNE_CENTS ? 'in-tune' : 'off-tune');
        $('#run-hint').textContent = live.cents > Scoring.IN_TUNE_CENTS ? 'A bit high — come down'
          : live.cents < -Scoring.IN_TUNE_CENTS ? 'A bit low — lift up'
          : 'Great — hold it!';
      } else {
        marker.className = 'cents-marker silent';
      }
    };

    trainer.onNoteResult = function (res, i) {
      var row = el('div', 'note-result ' + (res.score >= 65 ? 'ok' : res.score >= 40 ? 'meh' : 'bad'));
      row.innerHTML = '<span>' + Pitch.midiToNoteName(res.targetMidi) + '</span>' +
        '<span class="nr-score">' + res.score + '</span><span class="nr-fb">' + res.feedback + '</span>';
      $('#run-results').appendChild(row);
    };

    trainer.onDone = function (total) {
      store.addSession(exercise.id, total.score, total.stars);
      checkAchievements();
      if (total.stars === 3) celebrate();
      var stars = '★★★'.slice(0, total.stars) + '☆☆☆'.slice(0, 3 - total.stars);
      var summary = el('div', 'card run-summary');
      summary.innerHTML = '<div class="stars">' + stars + '</div>' +
        '<div class="final-score">' + total.score + '<span>/100</span></div>' +
        '<p>' + (total.score >= 85 ? 'Outstanding! Try a harder exercise.' :
                 total.score >= 65 ? 'Nice work — one more round to lock it in?' :
                 total.heardAll ? 'Good effort. Slow, gentle repetition wins — go again!' :
                 'We could not hear you on some notes. Check the volume meter moves when you sing.') + '</p>' +
        '<div class="row"><button class="btn primary" id="run-again">Sing it again</button>' +
        '<button class="btn ghost" id="run-back">Back to exercises</button></div>';
      $('#exercise-runner').appendChild(summary);
      $('#run-again').addEventListener('click', function () { startExercise(id); });
      $('#run-back').addEventListener('click', endExerciseUi);
    };

    trainer.run(exercise);
  }

  function endExerciseUi() {
    trainer.cancel();
    $('#exercise-runner').style.display = 'none';
    $('#exercise-runner').innerHTML = '';
    $('#exercise-list').style.display = '';
    renderCatalog();
  }

  /* ---------------------------------------------------------------- */
  /* Range view                                                        */
  /* ---------------------------------------------------------------- */

  function renderRangeIntro() {
    var r = store.load().range;
    $('#range-current').innerHTML = r
      ? 'Your range: <strong>' + Pitch.midiToNoteName(r.low) + ' – ' + Pitch.midiToNoteName(r.high) +
        '</strong> (' + (r.high - r.low) + ' semitones)'
      : 'No range measured yet — exercises use a generic comfortable range until you test.';
  }

  $('#range-start').addEventListener('click', async function () {
    if (!(await ensureMic())) return;
    var stage = $('#range-stage');
    var btn = $('#range-start');
    btn.disabled = true;

    async function measure(promptHtml) {
      stage.innerHTML = '<p class="range-prompt">' + promptHtml + '</p>' +
        '<div class="range-live" id="range-live">—</div><div class="range-count" id="range-count"></div>';
      // countdown
      for (var c = 3; c >= 1; c--) {
        $('#range-count').textContent = 'Starting in ' + c + '…';
        await new Promise(function (res) { setTimeout(res, 800); });
      }
      $('#range-count').textContent = 'Sing now — hold it steady!';
      trainer.onLive = function (live) {
        var elLive = $('#range-live');
        if (!elLive) return;
        elLive.textContent = live.voiced && isFinite(live.midi) ? Pitch.midiToNoteName(live.midi) : '…';
      };
      return trainer.measureHeldNote(4000);
    }

    var low = await measure('Step 1 of 2 — sing your <strong>lowest comfortable</strong> note on "ahh". Not a growl — comfy and clear.');
    if (low === null) {
      stage.innerHTML = '<p class="range-prompt">We could not hear a steady note. Get closer to the mic and try again.</p>';
      btn.disabled = false;
      return;
    }
    var high = await measure('Step 2 of 2 — now sing your <strong>highest comfortable</strong> note. No straining!');
    btn.disabled = false;
    if (high === null) {
      stage.innerHTML = '<p class="range-prompt">We could not hear the high note. Try the test again.</p>';
      return;
    }
    var lowMidi = Math.round(Math.min(low, high));
    var highMidi = Math.round(Math.max(low, high));
    if (highMidi - lowMidi < 5) {
      stage.innerHTML = '<p class="range-prompt">Those two notes were very close together (' +
        Pitch.midiToNoteName(lowMidi) + ' and ' + Pitch.midiToNoteName(highMidi) +
        '). Make the low one lower and the high one higher, then re-test.</p>';
      return;
    }
    store.setRange(lowMidi, highMidi);
    checkAchievements();
    stage.innerHTML = '<p class="range-prompt">✅ Saved! Your range is <strong>' +
      Pitch.midiToNoteName(lowMidi) + ' – ' + Pitch.midiToNoteName(highMidi) +
      '</strong>. Every exercise is now tuned to your voice.</p>';
    renderRangeIntro();
  });

  /* ---------------------------------------------------------------- */
  /* Achievements + confetti                                           */
  /* ---------------------------------------------------------------- */

  function celebrate() {
    var canvas = el('canvas', 'confetti');
    document.body.appendChild(canvas);
    var g = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var colors = ['#5eead4', '#fbbf24', '#f87171', '#a78bfa', '#60a5fa'];
    var parts = [];
    for (var i = 0; i < 130; i++) {
      parts.push({
        x: innerWidth / 2 + (Math.random() - 0.5) * 160,
        y: innerHeight * 0.35,
        vx: (Math.random() - 0.5) * 560,
        vy: -Math.random() * 480 - 120,
        s: 5 + Math.random() * 6,
        c: colors[i % colors.length],
        rot: Math.random() * Math.PI
      });
    }
    var t0 = performance.now();
    (function frame(now) {
      var t = (now - t0) / 1000;
      if (t > 1.8) { canvas.remove(); return; }
      var dt = 1 / 60;
      g.clearRect(0, 0, innerWidth, innerHeight);
      parts.forEach(function (p) {
        p.vy += 900 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += dt * 6;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.globalAlpha = Math.max(0, 1 - t / 1.8);
        g.fillStyle = p.c;
        g.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
        g.restore();
      });
      requestAnimationFrame(frame);
    })(t0);
  }

  // Check for newly earned badges; celebrate and persist them.
  function checkAchievements() {
    var data = store.load();
    data.streak = store.streak();
    var fresh = Achievements.newUnlocks(data);
    if (!fresh.length) return fresh;
    store.unlockAchievements(fresh);
    celebrate();
    fresh.forEach(function (id, i) {
      var b = Achievements.byId(id);
      setTimeout(function () {
        showToast('🏅 Achievement unlocked: ' + b.icon + ' ' + b.title + ' — ' + b.desc);
      }, i * 2200);
    });
    return fresh;
  }

  function renderBadges() {
    var grid = $('#badge-grid');
    var have = store.load().achievements || {};
    grid.innerHTML = '';
    Achievements.BADGES.forEach(function (b) {
      var unlocked = !!have[b.id];
      var node = el('div', 'badge' + (unlocked ? ' unlocked' : ''));
      node.innerHTML = '<div class="badge-icon">' + (unlocked ? b.icon : '🔒') + '</div>' +
        '<div class="badge-title">' + b.title + '</div>' +
        '<div class="badge-desc">' + b.desc + (unlocked ? ' · ' + have[b.id] : '') + '</div>';
      grid.appendChild(node);
    });
  }

  /* ---------------------------------------------------------------- */
  /* Game view (Pitch Flyer)                                           */
  /* ---------------------------------------------------------------- */

  var game = null;

  function renderGameIntro() {
    var best = store.load().gameBest || 0;
    $('#game-best-label').textContent = best > 0 ? 'Your best: ' + best : 'Fly through 5 gaps to earn your first badge!';
  }

  $('#game-play').addEventListener('click', async function () {
    if (!(await ensureMic())) return;
    if (!game) game = new PitchFlyer($('#game-canvas'), mic);
    game.best = store.load().gameBest || 0;
    game.setZone(Exercises.comfortZone(userRange()));
    game.onGameOver = function (score) {
      tones.blip(false);
      store.addGameScore(score);
      renderGameIntro();
      checkAchievements();
    };
    game.start();
  });

  /* ---------------------------------------------------------------- */
  /* Studio view                                                       */
  /* ---------------------------------------------------------------- */

  var recTimerInterval = 0;

  $('#rec-toggle').addEventListener('click', async function () {
    var btn = $('#rec-toggle');
    if (recorder) {
      // stop
      clearInterval(recTimerInterval);
      var result;
      try { result = await recorder.stop(); }
      catch (err) { showToast('Recording failed: ' + (err.message || err), true); recorder = null; return; }
      recorder = null;
      btn.textContent = '⏺ Start recording';
      btn.classList.remove('recording');
      var name = 'Take ' + new Date().toLocaleString();
      try {
        await RecordingStore.save({
          name: name, blob: result.blob, durationMs: result.durationMs,
          mimeType: result.mimeType, createdAt: Date.now()
        });
        showToast('Saved “' + name + '”. Listen back — it is the fastest way to improve!');
        store.incrRecordings();
        checkAchievements();
        renderRecordings();
      } catch (err) {
        showToast('Could not save the recording: ' + (err.message || err), true);
      }
    } else {
      if (!(await ensureMic())) return;
      try { recorder = new Recorder(mic.stream); }
      catch (err) { showToast(err.message, true); return; }
      recorder.start();
      btn.textContent = '⏹ Stop recording';
      btn.classList.add('recording');
      var t0 = Date.now();
      recTimerInterval = setInterval(function () {
        $('#rec-timer').textContent = fmtTime(Date.now() - t0);
      }, 250);
    }
  });

  var recordingUrls = [];

  function renderRecordings() {
    var wrap = $('#recording-list');
    recordingUrls.forEach(function (u) { URL.revokeObjectURL(u); });
    recordingUrls = [];
    RecordingStore.list().then(function (items) {
      wrap.innerHTML = items.length ? '' : '<p class="muted">No recordings yet. Hit record and sing anything you like!</p>';
      items.forEach(function (item) {
        var card = el('div', 'card rec-card');
        var url = URL.createObjectURL(item.blob);
        recordingUrls.push(url);
        card.innerHTML = '<div class="rec-head"><span class="rec-name">' + item.name + '</span>' +
          '<span class="rec-dur">' + fmtTime(item.durationMs) + '</span></div>';
        var audio = document.createElement('audio');
        audio.controls = true;
        audio.src = url;
        card.appendChild(audio);
        var row = el('div', 'row');
        var dl = el('a', 'btn ghost small', '⬇ Download');
        dl.href = url;
        dl.download = item.name.replace(/[^\w\- ]+/g, '') + (item.mimeType.indexOf('mp4') >= 0 ? '.m4a' : '.webm');
        var del = el('button', 'btn ghost small danger', 'Delete');
        del.addEventListener('click', function () {
          RecordingStore.remove(item.id).then(renderRecordings);
        });
        row.appendChild(dl); row.appendChild(del);
        card.appendChild(row);
        wrap.appendChild(card);
      });
    }).catch(function (err) {
      wrap.innerHTML = '<p class="muted">Could not load recordings: ' + (err.message || err) + '</p>';
    });
  }

  /* ---------------------------------------------------------------- */
  /* Progress view                                                     */
  /* ---------------------------------------------------------------- */

  function renderProgress() {
    var stats = store.stats();
    var streak = store.streak();
    $('#prog-streak').textContent = streak + (streak === 1 ? ' day' : ' days');
    $('#prog-total').textContent = stats.total;
    var r = stats.range;
    $('#prog-range').textContent = r ? Pitch.midiToNoteName(r.low) + '–' + Pitch.midiToNoteName(r.high) : 'not set';
    renderBadges();

    // per-exercise table
    var tbl = $('#prog-table');
    var rows = Exercises.CATALOG.filter(function (c) { return stats.byExercise[c.id]; });
    tbl.innerHTML = rows.length
      ? '<tr><th>Exercise</th><th>Runs</th><th>Average</th><th>Best</th></tr>' +
        rows.map(function (c) {
          var s = stats.byExercise[c.id];
          return '<tr><td>' + c.title + '</td><td>' + s.count + '</td><td>' + s.avg + '</td><td>' + s.best + '</td></tr>';
        }).join('')
      : '<tr><td class="muted">Complete an exercise in the Train tab to see stats here.</td></tr>';

    // 14-day chart
    var days = store.recentDays(14);
    var canvas = $('#prog-chart');
    var g = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.width = canvas.clientWidth * dpr;
    var h = canvas.height = canvas.clientHeight * dpr;
    g.clearRect(0, 0, w, h);
    var barW = w / days.length;
    days.forEach(function (d, i) {
      var x = i * barW;
      if (d.count > 0) {
        var bh = Math.max(4 * dpr, (d.avg / 100) * (h - 22 * dpr));
        g.fillStyle = d.avg >= 65 ? '#5eead4' : '#fbbf24';
        g.fillRect(x + barW * 0.18, h - 18 * dpr - bh, barW * 0.64, bh);
      } else {
        g.fillStyle = 'rgba(255,255,255,0.08)';
        g.fillRect(x + barW * 0.18, h - 18 * dpr - 3 * dpr, barW * 0.64, 3 * dpr);
      }
      g.fillStyle = 'rgba(255,255,255,0.4)';
      g.font = Math.round(9 * dpr) + 'px system-ui, sans-serif';
      g.fillText(d.date.slice(8), x + barW * 0.28, h - 5 * dpr);
    });
  }

  $('#prog-reset').addEventListener('click', function () {
    if (confirm('Erase all progress (range, scores, streak)? Recordings are kept.')) {
      store.reset();
      renderProgress();
    }
  });

  /* ---------------------------------------------------------------- */
  /* Boot                                                              */
  /* ---------------------------------------------------------------- */

  renderLessons();
  renderCatalog();
  renderRangeIntro();
  setMicUi();
  switchTab('learn');

  // Expose for the automated end-to-end test only.
  window.__singcoach = {
    mic: mic, store: store, trainer: trainer,
    checkAchievements: checkAchievements,
    getGame: function () { return game; }
  };
})();

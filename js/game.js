/*
 * Pitch Flyer — a voice-controlled arcade game (browser only).
 *
 * Your singing pitch steers a balloon up and down; fly through the gaps in
 * the walls. Higher pitch = higher balloon. Great disguised training for
 * pitch control and smooth register changes.
 */
(function (global) {
  'use strict';

  var PLAYER_R = 16;         // balloon radius, px
  var WALL_W = 52;           // wall width, px
  var GAP_SEMIS = 6;         // gap height in semitones (forgiving)
  var WALL_SPACING = 340;    // px between walls
  var BASE_SPEED = 110;      // px/s, ramps up slowly
  var MAX_SPEED = 240;
  var ZONE_PAD = 2;          // extra semitones beyond the comfort zone

  function PitchFlyer(canvas, mic) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.mic = mic;
    this.state = 'idle';     // idle | countdown | playing | over
    this.score = 0;
    this.best = 0;
    this.onGameOver = function () {};
    this._lastMidi = NaN;
    this._voiced = false;
    this._raf = 0;
    this._unsub = null;
    this._countdownT = 0;
  }

  PitchFlyer.prototype.setZone = function (range) {
    // range: comfort zone midi bounds; pad a little so edges are reachable.
    this.zoneLow = range.low - ZONE_PAD;
    this.zoneHigh = range.high + ZONE_PAD;
  };

  PitchFlyer.prototype.start = function () {
    var self = this;
    this.score = 0;
    this.walls = [];
    this.speed = BASE_SPEED;
    this.distSinceWall = WALL_SPACING * 0.5;
    this.vy = 0;
    this.py = 0.5; // normalized 0(top)..1(bottom)
    this.state = 'countdown';
    this._countdownT = performance.now();
    if (!this._unsub) {
      this._unsub = this.mic.onReading(function (r) {
        self._voiced = r.voiced;
        if (r.voiced) self._lastMidi = r.midi;
      });
    }
    this._lastFrame = performance.now();
    if (!this._raf) this._loop();
  };

  PitchFlyer.prototype.stop = function () {
    this.state = 'idle';
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
    if (this._unsub) { this._unsub(); this._unsub = null; }
  };

  PitchFlyer.prototype._yForMidi = function (midi, h) {
    var t = (midi - this.zoneLow) / (this.zoneHigh - this.zoneLow);
    return h - Math.max(0, Math.min(1, t)) * h;
  };

  PitchFlyer.prototype._loop = function () {
    var self = this;
    function frame(now) {
      self._raf = requestAnimationFrame(frame);
      var dt = Math.min(0.05, (now - self._lastFrame) / 1000);
      self._lastFrame = now;
      self._update(dt, now);
      self._draw(now);
    }
    this._raf = requestAnimationFrame(frame);
  };

  PitchFlyer.prototype._update = function (dt, now) {
    if (this.state === 'countdown') {
      if (now - this._countdownT >= 3000) this.state = 'playing';
      return;
    }
    if (this.state !== 'playing') return;

    var h = this.canvas.clientHeight;

    // Player vertical motion: pitch pulls the balloon, silence lets it sink.
    if (this._voiced && isFinite(this._lastMidi)) {
      var target = this._yForMidi(this._lastMidi, h) / h;
      this.py += (target - this.py) * Math.min(1, dt * 9);
      this.vy = 0;
    } else {
      this.vy = Math.min(0.9, this.vy + 1.4 * dt);
      this.py = Math.min(1, this.py + this.vy * dt);
    }

    // Scroll world & spawn walls.
    var dx = this.speed * dt;
    this.distSinceWall += dx;
    if (this.distSinceWall >= WALL_SPACING) {
      this.distSinceWall = 0;
      var gapSemis = GAP_SEMIS;
      var span = this.zoneHigh - this.zoneLow;
      var lo = this.zoneLow + 1 + Math.random() * Math.max(1, span - gapSemis - 2);
      this.walls.push({ x: this.canvas.clientWidth + WALL_W, gapLow: lo, gapHigh: lo + gapSemis, passed: false });
    }
    var px = this.canvas.clientWidth * 0.22;
    var pyPx = this.py * h;
    for (var i = this.walls.length - 1; i >= 0; i--) {
      var w = this.walls[i];
      w.x -= dx;
      if (!w.passed && w.x + WALL_W < px - PLAYER_R) {
        w.passed = true;
        this.score++;
        this.speed = Math.min(MAX_SPEED, this.speed + 4);
      }
      if (w.x < -WALL_W) { this.walls.splice(i, 1); continue; }
      // Collision: player circle vs wall rects (above & below the gap).
      if (px + PLAYER_R > w.x && px - PLAYER_R < w.x + WALL_W) {
        var gapTop = this._yForMidi(w.gapHigh, h);
        var gapBot = this._yForMidi(w.gapLow, h);
        if (pyPx - PLAYER_R < gapTop || pyPx + PLAYER_R > gapBot) {
          this._gameOver();
          return;
        }
      }
    }
  };

  PitchFlyer.prototype._gameOver = function () {
    this.state = 'over';
    if (this.score > this.best) this.best = this.score;
    this.onGameOver(this.score);
  };

  PitchFlyer.prototype._draw = function (now) {
    var canvas = this.canvas;
    var dpr = window.devicePixelRatio || 1;
    var cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (canvas.width !== cw * dpr) { canvas.width = cw * dpr; canvas.height = ch * dpr; }
    var g = this.g;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cw, ch);

    // Note grid for orientation.
    g.font = '10px system-ui, sans-serif';
    for (var m = Math.ceil(this.zoneLow); m <= this.zoneHigh; m++) {
      var y = this._yForMidi(m, ch);
      var isC = m % 12 === 0;
      g.strokeStyle = isC ? 'rgba(140,160,255,0.30)' : 'rgba(255,255,255,0.05)';
      g.beginPath(); g.moveTo(0, y); g.lineTo(cw, y); g.stroke();
      if (isC || m % 12 === 7) {
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillText(Pitch.midiToNoteName(m), 4, y - 2);
      }
    }

    // Walls.
    for (var i = 0; i < this.walls.length; i++) {
      var w = this.walls[i];
      var gapTop = this._yForMidi(w.gapHigh, ch);
      var gapBot = this._yForMidi(w.gapLow, ch);
      g.fillStyle = '#2dd4bf';
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(w.x, 0, WALL_W, gapTop);
      g.fillRect(w.x, gapBot, WALL_W, ch - gapBot);
      g.strokeRect(w.x, 0, WALL_W, gapTop);
      g.strokeRect(w.x, gapBot, WALL_W, ch - gapBot);
    }

    // Player balloon.
    var px = cw * 0.22, py = this.py * ch;
    g.font = (PLAYER_R * 2.1) + 'px serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('🎈', px, py);
    g.textAlign = 'start';
    g.textBaseline = 'alphabetic';

    // HUD.
    g.font = 'bold 26px system-ui, sans-serif';
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.fillText(String(this.score), cw - 54, 36);
    g.font = '12px system-ui, sans-serif';
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.fillText('best ' + this.best, cw - 54, 52);

    if (this.state === 'countdown') {
      var left = Math.max(0, 3 - Math.floor((now - this._countdownT) / 1000));
      g.font = 'bold 64px system-ui, sans-serif';
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.textAlign = 'center';
      g.fillText(left > 0 ? String(left) : 'Sing!', cw / 2, ch / 2);
      g.font = '15px system-ui, sans-serif';
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fillText('Sing high to float up, low to sink. Silence = falling!', cw / 2, ch / 2 + 40);
      g.textAlign = 'start';
    } else if (this.state === 'over') {
      g.fillStyle = 'rgba(10,14,28,0.72)';
      g.fillRect(0, 0, cw, ch);
      g.textAlign = 'center';
      g.font = 'bold 40px system-ui, sans-serif';
      g.fillStyle = '#fbbf24';
      g.fillText('💥 ' + this.score, cw / 2, ch / 2 - 14);
      g.font = '15px system-ui, sans-serif';
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.fillText('best ' + this.best + ' — press Play to fly again', cw / 2, ch / 2 + 18);
      g.textAlign = 'start';
    }
  };

  global.PitchFlyer = PitchFlyer;
})(window);

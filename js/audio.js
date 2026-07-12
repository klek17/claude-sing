/*
 * SingCoach audio layer (browser only).
 *  - MicEngine: microphone capture + continuous pitch analysis
 *  - TonePlayer: plays reference notes with a soft synth voice
 */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* MicEngine                                                           */
  /* ------------------------------------------------------------------ */

  function MicEngine() {
    this.ctx = null;
    this.stream = null;
    this.analyser = null;
    this.buffer = null;
    this.running = false;
    this.listeners = [];
    this._raf = 0;
    // Median-of-3 smoothing to suppress octave-error blips.
    this._recent = [];
  }

  MicEngine.prototype.onReading = function (fn) {
    this.listeners.push(fn);
    var self = this;
    return function () {
      var i = self.listeners.indexOf(fn);
      if (i >= 0) self.listeners.splice(i, 1);
    };
  };

  MicEngine.prototype.start = async function () {
    if (this.running) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('This browser cannot access the microphone. Try Chrome, Edge or Firefox.');
    }
    // Voice-friendly constraints: processing like echo cancellation and
    // auto gain distorts sung pitch and level, so ask for a raw signal.
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });
    var AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = this.ctx || new AC();
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    var source = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    source.connect(this.analyser);
    this.buffer = new Float32Array(this.analyser.fftSize);
    this.running = true;
    this._loop();
  };

  MicEngine.prototype.stop = function () {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
    if (this.stream) {
      this.stream.getTracks().forEach(function (t) { t.stop(); });
      this.stream = null;
    }
    this._recent = [];
  };

  MicEngine.prototype._loop = function () {
    var self = this;
    function tick() {
      if (!self.running) return;
      self.analyser.getFloatTimeDomainData(self.buffer);
      var raw = Pitch.detectPitch(self.buffer, self.ctx.sampleRate);
      var reading = self._smooth(raw);
      reading.rms = raw ? raw.rms : Pitch.rms(self.buffer);
      reading.time = performance.now();
      for (var i = 0; i < self.listeners.length; i++) self.listeners[i](reading);
      self._raf = requestAnimationFrame(tick);
    }
    this._raf = requestAnimationFrame(tick);
  };

  // Turn a raw detection into a stable reading using a median of the last 3
  // voiced frames. Returns { voiced, freq, midi, clarity }.
  MicEngine.prototype._smooth = function (raw) {
    if (!raw) {
      this._recent.length = 0;
      return { voiced: false, freq: 0, midi: NaN, clarity: 0 };
    }
    this._recent.push(raw.freq);
    if (this._recent.length > 3) this._recent.shift();
    var sorted = this._recent.slice().sort(function (a, b) { return a - b; });
    var freq = sorted[Math.floor(sorted.length / 2)];
    return { voiced: true, freq: freq, midi: Pitch.freqToMidi(freq), clarity: raw.clarity };
  };

  /* ------------------------------------------------------------------ */
  /* TonePlayer                                                          */
  /* ------------------------------------------------------------------ */

  function TonePlayer(getCtx) {
    this._getCtx = getCtx; // share the mic's AudioContext when available
    this._ownCtx = null;
  }

  TonePlayer.prototype._ctx = function () {
    var shared = this._getCtx && this._getCtx();
    if (shared) return shared;
    var AC = window.AudioContext || window.webkitAudioContext;
    this._ownCtx = this._ownCtx || new AC();
    return this._ownCtx;
  };

  /*
   * Play a reference note. Returns a promise resolving when it ends.
   * Soft "ooh" style voice: sine fundamental + quiet 2nd/3rd harmonics
   * through an ADSR-ish envelope, so it is easy to match with a voice.
   */
  TonePlayer.prototype.playNote = function (midi, durMs) {
    var ctx = this._ctx();
    var self = this;
    return (ctx.state === 'suspended' ? ctx.resume() : Promise.resolve()).then(function () {
      return self._playOn(ctx, midi, durMs);
    });
  };

  TonePlayer.prototype._playOn = function (ctx, midi, durMs) {
    var freq = Pitch.midiToFreq(midi);
    var dur = (durMs || 1500) / 1000;
    var t0 = ctx.currentTime;

    var master = ctx.createGain();
    master.gain.setValueAtTime(0, t0);
    master.gain.linearRampToValueAtTime(0.28, t0 + 0.04);
    master.gain.setValueAtTime(0.28, t0 + dur - 0.15);
    master.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    master.connect(ctx.destination);

    var partials = [
      { mult: 1, gain: 1.0 },
      { mult: 2, gain: 0.25 },
      { mult: 3, gain: 0.08 }
    ];
    var oscs = partials.map(function (p) {
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * p.mult;
      var g = ctx.createGain();
      g.gain.value = p.gain;
      osc.connect(g);
      g.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
      return osc;
    });

    return new Promise(function (resolve) {
      oscs[0].onended = function () { resolve(); };
    });
  };

  // Short confirmation blip (correct answer, phase change, etc.)
  TonePlayer.prototype.blip = function (good) {
    var ctx = this._ctx();
    var t0 = ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = good ? 1320 : 220;
    g.gain.setValueAtTime(0.12, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t0); osc.stop(t0 + 0.2);
  };

  global.MicEngine = MicEngine;
  global.TonePlayer = TonePlayer;
})(window);

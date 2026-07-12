/*
 * SingCoach pitch engine.
 *
 * Pure math only (no Web Audio) so the same file runs in the browser and in
 * Node unit tests. Pitch detection uses the McLeod Pitch Method (MPM):
 * a normalized square-difference autocorrelation with peak picking and
 * parabolic interpolation, which is robust for the human voice.
 */
(function (global) {
  'use strict';

  var NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  var DEFAULTS = {
    minFreq: 55,        // A1 — below any singing voice
    maxFreq: 1200,      // above soprano C6, catches harmonics-free range
    rmsThreshold: 0.008, // silence gate
    clarityThreshold: 0.80,
    peakPickRatio: 0.90
  };

  function freqToMidi(freq) {
    return 69 + 12 * Math.log2(freq / 440);
  }

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // MIDI 60 => "C4". Accepts fractional midi (rounds to nearest semitone).
  function midiToNoteName(midi) {
    var m = Math.round(midi);
    var octave = Math.floor(m / 12) - 1;
    var name = NOTE_NAMES[((m % 12) + 12) % 12];
    return name + octave;
  }

  // Signed cents from `freq` to the target frequency (+ means sharp).
  function centsBetween(freq, targetFreq) {
    return 1200 * Math.log2(freq / targetFreq);
  }

  // Cents from freq to the *nearest* equal-tempered semitone.
  function centsToNearestNote(freq) {
    var midi = freqToMidi(freq);
    var nearest = Math.round(midi);
    return { midi: nearest, cents: (midi - nearest) * 100, name: midiToNoteName(nearest) };
  }

  // Reusable work buffers — detectPitch runs ~60x/sec, so per-call
  // allocations would create constant GC pressure.
  var _scratch = {};
  function scratch(key, len) {
    var b = _scratch[key];
    if (!b || b.length !== len) b = _scratch[key] = new Float32Array(len);
    return b;
  }

  function rms(buf) {
    var sum = 0;
    for (var i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  }

  /*
   * Detect the fundamental frequency of `buf` (Float32Array of PCM samples
   * in [-1, 1]) recorded at `sampleRate` Hz.
   *
   * Returns { freq, clarity, rms } or null when no confident pitch exists
   * (silence, noise, or out-of-range input).
   */
  function detectPitch(buf, sampleRate, options) {
    var opts = Object.assign({}, DEFAULTS, options || {});

    var level = rms(buf);
    if (level < opts.rmsThreshold) return null;

    // Voice tops out far below Nyquist at studio sample rates, so decimate
    // 2x (averaging pairs as a crude anti-alias filter). This makes the
    // O(n·tau) correlation ~4x cheaper with negligible accuracy loss.
    if (sampleRate >= 32000 && buf.length >= 512) {
      var half = scratch('half', buf.length >> 1);
      for (var d = 0; d < half.length; d++) {
        half[d] = (buf[2 * d] + buf[2 * d + 1]) * 0.5;
      }
      buf = half;
      sampleRate = sampleRate / 2;
    }

    var n = buf.length;
    if (n < 128) return null;

    var maxTau = Math.min(Math.floor(sampleRate / opts.minFreq), Math.floor(n / 2));
    // Always scan from a tiny lag: starting at the maxFreq lag can land inside
    // the first true peak's lobe, making the zero-lag skip swallow the real
    // peak and return an octave-low result. Frequency bounds are enforced on
    // the final result instead.
    var minTau = 2;
    if (minTau >= maxTau) return null;

    // NSDF: nsdf[tau] = 2*acf(tau) / m(tau), in [-1, 1].
    // The power term m(tau) = Σ x[i]² + x[i+tau]² over i < n-tau is computed
    // incrementally (m(tau+1) = m(tau) - x[n-tau-1]² - x[tau]²), leaving only
    // the autocorrelation product in the hot inner loop.
    var nsdf = scratch('nsdf', maxTau + 1);
    nsdf.fill(0);
    var sumSq = 0;
    for (var j = 0; j < n; j++) sumSq += buf[j] * buf[j];
    var m = 2 * sumSq; // m(0)
    for (var tau = 1; tau <= maxTau; tau++) {
      var tail = buf[n - tau], head = buf[tau - 1];
      m -= tail * tail + head * head;
      if (tau < minTau) continue;
      var acf = 0;
      for (var i = 0, lim = n - tau; i < lim; i++) {
        acf += buf[i] * buf[i + tau];
      }
      nsdf[tau] = m > 0 ? (2 * acf) / m : 0;
    }

    // Collect the key maximum between every pair of positive zero crossings.
    var maxima = [];
    var t = minTau;
    while (t <= maxTau && nsdf[t] > 0) t++; // skip the initial lobe
    while (t <= maxTau) {
      while (t <= maxTau && nsdf[t] <= 0) t++;
      var peakTau = -1, peakVal = -Infinity;
      while (t <= maxTau && nsdf[t] > 0) {
        if (nsdf[t] > peakVal) { peakVal = nsdf[t]; peakTau = t; }
        t++;
      }
      if (peakTau > 0) maxima.push({ tau: peakTau, val: peakVal });
    }
    if (maxima.length === 0) return null;

    var highest = 0;
    for (var k = 0; k < maxima.length; k++) if (maxima[k].val > highest) highest = maxima[k].val;
    var threshold = opts.peakPickRatio * highest;

    var chosen = null;
    for (k = 0; k < maxima.length; k++) {
      if (maxima[k].val >= threshold) { chosen = maxima[k]; break; }
    }
    if (!chosen || chosen.val < opts.clarityThreshold) return null;

    // Parabolic interpolation around the chosen lag for sub-sample accuracy.
    var ct = chosen.tau;
    var refined = ct;
    if (ct > minTau && ct < maxTau) {
      var y0 = nsdf[ct - 1], y1 = nsdf[ct], y2 = nsdf[ct + 1];
      var denom = 2 * (2 * y1 - y0 - y2);
      if (Math.abs(denom) > 1e-12) {
        var shift = (y2 - y0) / denom;
        if (shift > -1 && shift < 1) refined = ct + shift;
      }
    }

    var freq = sampleRate / refined;
    if (freq < opts.minFreq || freq > opts.maxFreq) return null;

    return { freq: freq, clarity: Math.min(1, chosen.val), rms: level };
  }

  var Pitch = {
    DEFAULTS: DEFAULTS,
    NOTE_NAMES: NOTE_NAMES,
    freqToMidi: freqToMidi,
    midiToFreq: midiToFreq,
    midiToNoteName: midiToNoteName,
    centsBetween: centsBetween,
    centsToNearestNote: centsToNearestNote,
    rms: rms,
    detectPitch: detectPitch
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Pitch;
  else global.Pitch = Pitch;
})(typeof window !== 'undefined' ? window : globalThis);

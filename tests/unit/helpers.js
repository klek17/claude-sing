'use strict';
/* Signal synthesis helpers for pitch-engine tests. */

const SR = 48000;

function sine(freq, seconds, amp = 0.4, sampleRate = SR) {
  const n = Math.round(seconds * sampleRate);
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) buf[i] = amp * Math.sin(2 * Math.PI * freq * (i / sampleRate));
  return buf;
}

/* A voice-like tone: strong fundamental plus decaying harmonics. */
function voiceLike(freq, seconds, amp = 0.35, sampleRate = SR) {
  const n = Math.round(seconds * sampleRate);
  const buf = new Float32Array(n);
  const harmonics = [1, 0.5, 0.3, 0.18, 0.1];
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    let v = 0;
    for (let h = 0; h < harmonics.length; h++) {
      v += harmonics[h] * Math.sin(2 * Math.PI * freq * (h + 1) * t);
    }
    buf[i] = amp * v / 2;
  }
  return buf;
}

function whiteNoise(seconds, amp = 0.3, sampleRate = SR, seed = 42) {
  const n = Math.round(seconds * sampleRate);
  const buf = new Float32Array(n);
  let s = seed;
  for (let i = 0; i < n; i++) {
    // xorshift PRNG for determinism
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s |= 0;
    buf[i] = amp * ((s / 0x7fffffff) % 1);
  }
  return buf;
}

function silence(seconds, sampleRate = SR) {
  return new Float32Array(Math.round(seconds * sampleRate));
}

/* Constant-frequency tone with sinusoidal vibrato (like a real singer). */
function vibrato(freq, seconds, depthCents = 30, rateHz = 5.5, amp = 0.35, sampleRate = SR) {
  const n = Math.round(seconds * sampleRate);
  const buf = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const f = freq * Math.pow(2, (depthCents * Math.sin(2 * Math.PI * rateHz * t)) / 1200);
    phase += (2 * Math.PI * f) / sampleRate;
    buf[i] = amp * Math.sin(phase);
  }
  return buf;
}

module.exports = { SR, sine, voiceLike, whiteNoise, silence, vibrato };

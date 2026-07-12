'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const Pitch = require('../../js/pitch.js');
const { SR, sine, voiceLike, whiteNoise, silence, vibrato } = require('./helpers.js');

const FRAME = 2048; // same analysis window the app uses

function frame(buf, offset = 4096) {
  return buf.subarray(offset, offset + FRAME);
}

test('midi/freq conversions round-trip', () => {
  assert.strictEqual(Pitch.midiToFreq(69), 440);
  assert.ok(Math.abs(Pitch.freqToMidi(440) - 69) < 1e-9);
  assert.ok(Math.abs(Pitch.midiToFreq(60) - 261.6256) < 0.001); // middle C
  for (let m = 36; m <= 96; m++) {
    assert.ok(Math.abs(Pitch.freqToMidi(Pitch.midiToFreq(m)) - m) < 1e-9);
  }
});

test('note names', () => {
  assert.strictEqual(Pitch.midiToNoteName(60), 'C4');
  assert.strictEqual(Pitch.midiToNoteName(69), 'A4');
  assert.strictEqual(Pitch.midiToNoteName(61), 'C#4');
  assert.strictEqual(Pitch.midiToNoteName(59), 'B3');
  assert.strictEqual(Pitch.midiToNoteName(48), 'C3');
});

test('cents math', () => {
  assert.ok(Math.abs(Pitch.centsBetween(440, 440)) < 1e-9);
  assert.ok(Math.abs(Pitch.centsBetween(466.1638, 440) - 100) < 0.01); // one semitone sharp
  const near = Pitch.centsToNearestNote(445);
  assert.strictEqual(near.name, 'A4');
  assert.ok(near.cents > 0 && near.cents < 30);
});

test('detects pure sine across the singing range within 5 cents', () => {
  // A2 (110) male low → C6 (1046.5) soprano high
  for (const f of [82.4, 110, 146.8, 220, 261.6, 329.6, 440, 587.3, 783.99, 1046.5]) {
    const res = Pitch.detectPitch(frame(sine(f, 0.5)), SR);
    assert.ok(res, `no detection at ${f} Hz`);
    const cents = Math.abs(Pitch.centsBetween(res.freq, f));
    assert.ok(cents < 5, `${f} Hz detected as ${res.freq.toFixed(2)} Hz (${cents.toFixed(1)} cents off)`);
  }
});

test('detects voice-like tone (with harmonics) at the fundamental, not a harmonic', () => {
  for (const f of [98, 130.8, 196, 293.7, 392, 523.25]) {
    const res = Pitch.detectPitch(frame(voiceLike(f, 0.5)), SR);
    assert.ok(res, `no detection at ${f} Hz`);
    const cents = Math.abs(Pitch.centsBetween(res.freq, f));
    assert.ok(cents < 10, `${f} Hz voice detected as ${res.freq.toFixed(2)} Hz (${cents.toFixed(1)} cents off)`);
  }
});

test('tracks a tone with singer vibrato', () => {
  const buf = vibrato(220, 0.5, 30, 5.5);
  const res = Pitch.detectPitch(frame(buf), SR);
  assert.ok(res, 'vibrato tone not detected');
  // Vibrato of ±30 cents: detection must stay within ~50 cents of centre.
  assert.ok(Math.abs(Pitch.centsBetween(res.freq, 220)) < 50);
});

test('rejects silence', () => {
  assert.strictEqual(Pitch.detectPitch(frame(silence(0.5)), SR), null);
});

test('rejects very quiet input (below the gate)', () => {
  assert.strictEqual(Pitch.detectPitch(frame(sine(220, 0.5, 0.002)), SR), null);
});

test('rejects white noise', () => {
  assert.strictEqual(Pitch.detectPitch(frame(whiteNoise(0.5)), SR), null);
});

test('quiet-but-audible singing is still detected', () => {
  const res = Pitch.detectPitch(frame(sine(220, 0.5, 0.02)), SR);
  assert.ok(res, 'quiet tone should be detected');
  assert.ok(Math.abs(Pitch.centsBetween(res.freq, 220)) < 5);
});

test('works at 44100 Hz sample rate too', () => {
  const res = Pitch.detectPitch(frame(sine(261.63, 0.5, 0.4, 44100)), 44100);
  assert.ok(res);
  assert.ok(Math.abs(Pitch.centsBetween(res.freq, 261.63)) < 5);
});

test('handles tiny buffers gracefully', () => {
  assert.strictEqual(Pitch.detectPitch(new Float32Array(64), SR), null);
  assert.strictEqual(Pitch.detectPitch(new Float32Array(0), SR), null);
});

test('clarity is high for tones, and result reports rms', () => {
  const res = Pitch.detectPitch(frame(sine(330, 0.5)), SR);
  assert.ok(res.clarity > 0.9);
  assert.ok(res.rms > 0.2 && res.rms < 0.4); // amp 0.4 sine → rms ≈ 0.283
});

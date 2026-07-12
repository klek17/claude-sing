'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const Songs = require('../../js/songs.js');
const Pitch = require('../../js/pitch.js');

const SONG = Songs.BREAKEVEN;

test('Breakeven profile is sane', () => {
  assert.strictEqual(SONG.artist, 'The Script');
  assert.ok(SONG.range.high > SONG.range.low);
  assert.ok(SONG.range.high - SONG.range.low >= 12, 'song spans over an octave');
  assert.ok(SONG.guide.length >= 3);
  assert.strictEqual(Songs.songById('breakeven'), SONG);
  assert.strictEqual(Songs.songById('nope'), null);
});

test('scaleClasses builds a major scale from any root', () => {
  assert.deepStrictEqual(Songs.scaleClasses(0), [0, 2, 4, 5, 7, 9, 11]); // C major
  const fSharp = Songs.scaleClasses(6);
  assert.ok(fSharp.includes(6) && fSharp.includes(1) && fSharp.includes(10)); // F#, C#, A#
  assert.strictEqual(fSharp.length, 7);
});

test('practice key name follows the offset', () => {
  assert.strictEqual(Songs.practiceKeyName(SONG, 0), 'F# major');
  assert.strictEqual(Songs.practiceKeyName(SONG, 1), 'G major');
  assert.strictEqual(Songs.practiceKeyName(SONG, -2), 'E major');
  assert.strictEqual(Songs.practiceKeyName(SONG, -6), 'C major');
});

test('recommendOffset keeps the original key when the song already fits', () => {
  const rec = Songs.recommendOffset(SONG.range, { low: 45, high: 70 });
  assert.strictEqual(rec.fits, true);
  assert.strictEqual(rec.offset, 0);
});

test('recommendOffset transposes down for a lower voice', () => {
  const rec = Songs.recommendOffset(SONG.range, { low: 40, high: 62 });
  assert.strictEqual(rec.fits, true);
  // top must fit with one semitone of headroom
  assert.ok(SONG.range.high + rec.offset <= 61);
  assert.ok(SONG.range.low + rec.offset >= 40);
});

test('recommendOffset transposes up for a higher voice', () => {
  const rec = Songs.recommendOffset(SONG.range, { low: 55, high: 76 });
  assert.strictEqual(rec.fits, true);
  assert.ok(SONG.range.low + rec.offset >= 55);
});

test('recommendOffset protects the chorus when range is too narrow', () => {
  const rec = Songs.recommendOffset(SONG.range, { low: 55, high: 64 }); // only 9 semitones
  assert.strictEqual(rec.fits, false);
  assert.ok(SONG.range.high + rec.offset <= 63, 'top note stays reachable');
  assert.ok(rec.offset >= -12 && rec.offset <= 12);
});

function midisAround(values, perNote = 20, jitter = 0) {
  const out = [];
  for (const v of values) {
    for (let i = 0; i < perNote; i++) out.push(v + (jitter ? (Math.sin(i) * jitter) : 0));
  }
  return out;
}

test('analyzeTake rejects too little voice', () => {
  assert.strictEqual(Songs.analyzeTake([], SONG, 0), null);
  assert.strictEqual(Songs.analyzeTake(midisAround([60], 10), SONG, 0), null);
});

test('a clean in-key take covering the range scores high', () => {
  // F# major scale notes across the song's range: F#3(54) .. F#4(66) region
  const notes = [49, 54, 58, 61, 63, 66]; // C#3, F#3, A#3, C#4, D#4, F#4 — all in F# major
  const a = Songs.analyzeTake(midisAround(notes, 30, 0.05), SONG, 0);
  assert.ok(a, 'analysis exists');
  assert.ok(a.inKeyPct > 0.95, `inKey ${a.inKeyPct}`);
  assert.ok(a.coverage > 0.95, `coverage ${a.coverage}`);
  assert.ok(a.hitTop);
  assert.ok(a.readiness >= 85, `readiness ${a.readiness}`);
});

test('an out-of-key take scores low on inKey', () => {
  // G natural, C natural etc — mostly outside F# major
  const notes = [55, 60, 62, 65];
  const a = Songs.analyzeTake(midisAround(notes, 30, 0.05), SONG, 0);
  assert.ok(a.inKeyPct < 0.3, `inKey ${a.inKeyPct}`);
});

test('narrow-range take gets low coverage and no hitTop', () => {
  const a = Songs.analyzeTake(midisAround([54, 56], 40, 0.05), SONG, 0);
  assert.ok(a.coverage < 0.4, `coverage ${a.coverage}`);
  assert.strictEqual(a.hitTop, false);
});

test('wobbly pitch lowers stability and readiness', () => {
  const clean = Songs.analyzeTake(midisAround([54, 58, 61, 66], 40, 0.03), SONG, 0);
  const wobbly = Songs.analyzeTake(midisAround([54, 58, 61, 66], 40, 0.45), SONG, 0);
  assert.ok(wobbly.stability < clean.stability);
  assert.ok(wobbly.readiness < clean.readiness);
});

test('analysis respects the practice-key offset', () => {
  // Transposed down 2: key = E major; E-major scale notes, covering shifted range
  const notes = [47, 52, 56, 59, 61, 64];
  const a = Songs.analyzeTake(midisAround(notes, 30, 0.05), SONG, -2);
  assert.ok(a.inKeyPct > 0.95, `inKey ${a.inKeyPct}`);
  assert.ok(a.hitTop);
});

test('takeFeedback targets the weakest metric', () => {
  assert.match(Songs.takeFeedback(null, SONG, 0), /hear enough/i);
  const noTop = Songs.analyzeTake(midisAround([54, 56], 40, 0.05), SONG, 0);
  assert.match(Songs.takeFeedback(noTop, SONG, 0), /top note|lower the practice key/i);
  const great = Songs.analyzeTake(midisAround([49, 54, 58, 61, 63, 66], 30, 0.03), SONG, 0);
  if (great.readiness >= 80) assert.match(Songs.takeFeedback(great, SONG, 0), /stage ready/i);
});

test('drill generators stay inside the user range and reach the song top', () => {
  const range = { low: 48, high: 68 };
  const sustains = Songs.topNoteSustains(SONG, 0, range);
  assert.strictEqual(sustains.notes.length, 3);
  sustains.notes.forEach(n => assert.ok(n.midi >= 48 && n.midi <= 68));
  assert.strictEqual(sustains.notes[2].midi, SONG.range.high); // 66 fits in 48..68

  const leaps = Songs.chorusLeaps(SONG, 0, range);
  assert.strictEqual(leaps.notes.length, 6);
  for (let i = 0; i < leaps.notes.length; i += 2) {
    const jump = leaps.notes[i + 1].midi - leaps.notes[i].midi;
    assert.ok(jump === 7 || jump === 5, `jump ${jump}`);
  }
});

test('drills clamp when the song top exceeds the user range', () => {
  const range = { low: 48, high: 60 };
  const sustains = Songs.topNoteSustains(SONG, 0, range);
  sustains.notes.forEach(n => assert.ok(n.midi <= 60 && n.midi >= 48));
});

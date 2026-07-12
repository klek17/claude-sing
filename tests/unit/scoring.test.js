'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const Scoring = require('../../js/scoring.js');

function samples(centsArr) {
  return centsArr.map(c => ({ cents: c, clarity: 0.95 }));
}

test('median', () => {
  assert.strictEqual(Scoring.median([3, 1, 2]), 2);
  assert.strictEqual(Scoring.median([4, 1, 2, 3]), 2.5);
  assert.ok(Number.isNaN(Scoring.median([])));
});

test('perfect singing scores ~100', () => {
  const r = Scoring.scoreNote(samples([0, 1, -2, 3, 0, -1, 2, 0]));
  assert.ok(r.heard);
  assert.ok(r.score >= 95, `expected >=95, got ${r.score}`);
  assert.match(r.feedback, /Excellent/);
});

test('silence scores 0 with "not heard" feedback', () => {
  const r = Scoring.scoreNote([]);
  assert.strictEqual(r.score, 0);
  assert.strictEqual(r.heard, false);
  assert.match(r.feedback, /hear you/);
});

test('too few voiced samples counts as not heard', () => {
  const r = Scoring.scoreNote(samples([0, 0]));
  assert.strictEqual(r.heard, false);
});

test('NaN cents (unvoiced frames) are ignored', () => {
  const mixed = samples([0, 2, -1, 1, 0, 3]).concat([{ cents: NaN, clarity: 0 }, { cents: NaN, clarity: 0 }]);
  const r = Scoring.scoreNote(mixed);
  assert.ok(r.heard);
  assert.ok(r.score >= 95);
});

test('consistently sharp singing gets sharp feedback and a low score', () => {
  const r = Scoring.scoreNote(samples([120, 130, 110, 125, 118, 122]));
  assert.ok(r.heard);
  assert.ok(r.score < 40, `expected <40, got ${r.score}`);
  assert.match(r.feedback, /sharp/i);
});

test('consistently flat singing gets flat feedback', () => {
  const r = Scoring.scoreNote(samples([-120, -130, -110, -125, -118, -122]));
  assert.match(r.feedback, /flat/i);
});

test('slightly flat drift is noted but still a good score', () => {
  const r = Scoring.scoreNote(samples([-25, -30, -20, -28, -22, -26, -24, -27]));
  assert.ok(r.score >= 60, `expected >=60, got ${r.score}`);
  assert.match(r.feedback, /flat|low/i);
});

test('score is monotonic: closer singing never scores lower', () => {
  const tight = Scoring.scoreNote(samples([5, -5, 8, -3, 6, -7]));
  const loose = Scoring.scoreNote(samples([35, -40, 45, -30, 38, -42]));
  const bad = Scoring.scoreNote(samples([90, -95, 85, -100, 92, -88]));
  assert.ok(tight.score > loose.score);
  assert.ok(loose.score > bad.score);
});

test('exercise scoring averages notes and assigns stars', () => {
  const mk = s => ({ score: s, heard: true });
  assert.deepStrictEqual(
    Scoring.scoreExercise([mk(90), mk(90), mk(90)]),
    { score: 90, stars: 3, heardAll: true }
  );
  const r = Scoring.scoreExercise([mk(70), { score: 0, heard: false }]);
  assert.strictEqual(r.score, 35);
  assert.strictEqual(r.heardAll, false);
  assert.deepStrictEqual(Scoring.scoreExercise([]), { score: 0, stars: 0, heardAll: false });
});

test('star thresholds', () => {
  assert.strictEqual(Scoring.starsFor(100), 3);
  assert.strictEqual(Scoring.starsFor(85), 3);
  assert.strictEqual(Scoring.starsFor(84), 2);
  assert.strictEqual(Scoring.starsFor(65), 2);
  assert.strictEqual(Scoring.starsFor(64), 1);
  assert.strictEqual(Scoring.starsFor(40), 1);
  assert.strictEqual(Scoring.starsFor(39), 0);
});

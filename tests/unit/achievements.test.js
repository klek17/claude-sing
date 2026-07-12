'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const Achievements = require('../../js/achievements.js');

function session(exerciseId, score, stars) {
  return { date: '2026-07-12', exerciseId, score, stars };
}

test('empty data earns nothing', () => {
  assert.deepStrictEqual(Achievements.evaluate({}), []);
  assert.deepStrictEqual(Achievements.evaluate(null), []);
});

test('first exercise unlocks First Note', () => {
  const got = Achievements.evaluate({ sessions: [session('pitch-match', 50, 1)] });
  assert.ok(got.includes('first-note'));
  assert.ok(!got.includes('all-rounder'));
});

test('all-rounder needs all four exercise types', () => {
  const three = ['warmup-hum', 'pitch-match', 'scale-5'].map(id => session(id, 70, 2));
  assert.ok(!Achievements.evaluate({ sessions: three }).includes('all-rounder'));
  const four = three.concat([session('intervals', 70, 2)]);
  assert.ok(Achievements.evaluate({ sessions: four }).includes('all-rounder'));
});

test('score and star badges', () => {
  const got = Achievements.evaluate({ sessions: [session('scale-5', 92, 3)] });
  assert.ok(got.includes('triple-star'));
  assert.ok(got.includes('high-scorer'));
  const modest = Achievements.evaluate({ sessions: [session('scale-5', 89, 2)] });
  assert.ok(!modest.includes('triple-star'));
  assert.ok(!modest.includes('high-scorer'));
});

test('volume badges at 10 and 25 sessions', () => {
  const ten = Array.from({ length: 10 }, () => session('pitch-match', 60, 1));
  const got10 = Achievements.evaluate({ sessions: ten });
  assert.ok(got10.includes('dedicated'));
  assert.ok(!got10.includes('committed'));
  const twentyFive = Array.from({ length: 25 }, () => session('pitch-match', 60, 1));
  assert.ok(Achievements.evaluate({ sessions: twentyFive }).includes('committed'));
});

test('streak badges use the derived streak value', () => {
  assert.ok(Achievements.evaluate({ streak: 3 }).includes('streak-3'));
  assert.ok(!Achievements.evaluate({ streak: 3 }).includes('streak-7'));
  assert.ok(Achievements.evaluate({ streak: 9 }).includes('streak-7'));
});

test('range badges', () => {
  assert.ok(Achievements.evaluate({ range: { low: 48, high: 60 } }).includes('octave-club'));
  assert.ok(!Achievements.evaluate({ range: { low: 48, high: 59 } }).includes('octave-club'));
  assert.ok(Achievements.evaluate({ range: { low: 48, high: 72 } }).includes('two-octaves'));
});

test('game badges at 5/15/30', () => {
  assert.deepStrictEqual(
    Achievements.evaluate({ gameBest: 17 }).filter(id => id.startsWith('game-')),
    ['game-rookie', 'game-ace']
  );
  assert.ok(Achievements.evaluate({ gameBest: 30 }).includes('game-legend'));
  assert.deepStrictEqual(Achievements.evaluate({ gameBest: 4 }).filter(id => id.startsWith('game-')), []);
});

test('recording badge', () => {
  assert.ok(Achievements.evaluate({ recordingCount: 1 }).includes('first-take'));
});

test('song badges', () => {
  const takes = n => ({ songs: { breakeven: { takes: Array.from({ length: n }, () => ({})), best: 0 } } });
  assert.ok(Achievements.evaluate(takes(1)).includes('song-take'));
  assert.ok(!Achievements.evaluate(takes(1)).includes('song-grind'));
  assert.ok(Achievements.evaluate(takes(10)).includes('song-grind'));
  assert.ok(Achievements.evaluate({ songs: { breakeven: { takes: [{}], best: 80 } } }).includes('song-ready'));
  assert.ok(!Achievements.evaluate({ songs: { breakeven: { takes: [{}], best: 79 } } }).includes('song-ready'));
  assert.ok(Achievements.evaluate({ bestHissSec: 20 }).includes('breath-20'));
  assert.ok(!Achievements.evaluate({ bestHissSec: 19.9 }).includes('breath-20'));
});

test('newUnlocks excludes already-earned badges', () => {
  const data = {
    sessions: [session('pitch-match', 92, 3)],
    achievements: { 'first-note': '2026-07-10' }
  };
  const fresh = Achievements.newUnlocks(data);
  assert.ok(!fresh.includes('first-note'));
  assert.ok(fresh.includes('triple-star'));
});

test('every badge has icon, title, desc and a working check', () => {
  for (const b of Achievements.BADGES) {
    assert.ok(b.id && b.icon && b.title && b.desc, `badge ${b.id} incomplete`);
    assert.strictEqual(typeof b.check, 'function');
    assert.ok(Achievements.byId(b.id) === b);
  }
  // ids are unique
  const ids = Achievements.BADGES.map(b => b.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});

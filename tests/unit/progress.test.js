'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const Progress = require('../../js/progress.js');

function fakeStorage() {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: k => map.delete(k)
  };
}

const DAY = 24 * 60 * 60 * 1000;
// Fixed noon timestamp avoids any midnight edge cases in tests.
const NOW = new Date('2026-07-12T12:00:00').getTime();

test('starts blank and survives corrupt JSON', () => {
  const storage = fakeStorage();
  const store = Progress.makeStore(storage);
  assert.deepStrictEqual(store.load().sessions, []);
  storage.setItem(Progress.KEY, '{not json![');
  assert.deepStrictEqual(store.load().sessions, []);
});

test('range persists', () => {
  const store = Progress.makeStore(fakeStorage());
  store.setRange(50, 74);
  assert.deepStrictEqual(store.load().range, { low: 50, high: 74 });
});

test('sessions accumulate and stats aggregate per exercise', () => {
  const store = Progress.makeStore(fakeStorage());
  store.addSession('pitch-match', 80, 2, NOW);
  store.addSession('pitch-match', 90, 3, NOW);
  store.addSession('scale-5', 60, 1, NOW);
  const stats = store.stats();
  assert.strictEqual(stats.total, 3);
  assert.strictEqual(stats.byExercise['pitch-match'].count, 2);
  assert.strictEqual(stats.byExercise['pitch-match'].avg, 85);
  assert.strictEqual(stats.byExercise['pitch-match'].best, 90);
  assert.strictEqual(stats.byExercise['scale-5'].avg, 60);
});

test('streak counts consecutive days ending today', () => {
  const store = Progress.makeStore(fakeStorage());
  store.addSession('pitch-match', 80, 2, NOW - 2 * DAY);
  store.addSession('pitch-match', 80, 2, NOW - DAY);
  store.addSession('pitch-match', 80, 2, NOW);
  assert.strictEqual(store.streak(NOW), 3);
});

test('streak survives "have not practised yet today"', () => {
  const store = Progress.makeStore(fakeStorage());
  store.addSession('pitch-match', 80, 2, NOW - 2 * DAY);
  store.addSession('pitch-match', 80, 2, NOW - DAY);
  assert.strictEqual(store.streak(NOW), 2);
});

test('streak breaks on a missed day', () => {
  const store = Progress.makeStore(fakeStorage());
  store.addSession('pitch-match', 80, 2, NOW - 3 * DAY);
  store.addSession('pitch-match', 80, 2, NOW);
  assert.strictEqual(store.streak(NOW), 1);
});

test('recentDays returns oldest→newest with gaps as zero', () => {
  const store = Progress.makeStore(fakeStorage());
  store.addSession('pitch-match', 80, 2, NOW - DAY);
  store.addSession('pitch-match', 60, 1, NOW - DAY);
  store.addSession('scale-5', 90, 3, NOW);
  const days = store.recentDays(3, NOW);
  assert.strictEqual(days.length, 3);
  assert.strictEqual(days[0].count, 0);
  assert.strictEqual(days[1].count, 2);
  assert.strictEqual(days[1].avg, 70);
  assert.strictEqual(days[2].count, 1);
  assert.strictEqual(days[2].avg, 90);
});

test('session history is capped at 500', () => {
  const store = Progress.makeStore(fakeStorage());
  for (let i = 0; i < 520; i++) store.addSession('pitch-match', 50, 1, NOW);
  assert.strictEqual(store.load().sessions.length, 500);
});

test('game best only ever increases', () => {
  const store = Progress.makeStore(fakeStorage());
  store.addGameScore(7);
  assert.strictEqual(store.load().gameBest, 7);
  store.addGameScore(3);
  assert.strictEqual(store.load().gameBest, 7);
  store.addGameScore(12);
  assert.strictEqual(store.load().gameBest, 12);
});

test('recording counter and achievement unlocks persist', () => {
  const store = Progress.makeStore(fakeStorage());
  store.incrRecordings();
  store.incrRecordings();
  assert.strictEqual(store.load().recordingCount, 2);
  store.unlockAchievements(['first-note', 'first-take'], NOW);
  const a = store.load().achievements;
  assert.strictEqual(a['first-note'], '2026-07-12');
  assert.strictEqual(a['first-take'], '2026-07-12');
});

test('lessons read + reset', () => {
  const store = Progress.makeStore(fakeStorage());
  store.markLessonRead('posture');
  assert.strictEqual(store.load().lessonsRead.posture, true);
  store.reset();
  assert.deepStrictEqual(store.load().lessonsRead, {});
  assert.strictEqual(store.load().range, null);
});

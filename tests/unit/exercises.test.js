'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const Exercises = require('../../js/exercises.js');

// Deterministic PRNG so generator tests are reproducible.
function makeRng(seed) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function assertNotesInRange(ex, range) {
  const zone = Exercises.comfortZone(range);
  for (const n of ex.notes) {
    assert.ok(n.midi >= zone.low && n.midi <= zone.high,
      `${ex.id}: note ${n.midi} outside comfort zone ${zone.low}..${zone.high}`);
    assert.ok(n.holdMs > 500, 'holds must be long enough to sing');
  }
}

test('clampRange sanitises garbage input', () => {
  assert.deepStrictEqual(Exercises.clampRange(null), Exercises.DEFAULT_RANGE);
  assert.deepStrictEqual(Exercises.clampRange({ low: NaN, high: 70 }), Exercises.DEFAULT_RANGE);
  const r = Exercises.clampRange({ low: 10, high: 200 });
  assert.ok(r.low >= 36 && r.high <= 96);
  // Inverted / too-narrow range becomes a usable span.
  const narrow = Exercises.clampRange({ low: 60, high: 62 });
  assert.ok(narrow.high - narrow.low >= 7);
});

test('comfort zone sits strictly inside the range', () => {
  const zone = Exercises.comfortZone({ low: 48, high: 72 });
  assert.ok(zone.low > 48 && zone.high < 72);
  assert.ok(zone.high > zone.low);
});

test('pitch match stays in the comfort zone for many seeds and ranges', () => {
  const ranges = [{ low: 40, high: 60 }, { low: 48, high: 72 }, { low: 55, high: 84 }, { low: 60, high: 68 }];
  for (const range of ranges) {
    for (let seed = 1; seed <= 50; seed++) {
      const ex = Exercises.pitchMatch(range, 5, makeRng(seed));
      assert.strictEqual(ex.notes.length, 5);
      assertNotesInRange(ex, range);
    }
  }
});

test('pitch match avoids repeating near-identical consecutive notes', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const ex = Exercises.pitchMatch({ low: 48, high: 72 }, 5, makeRng(seed));
    for (let i = 1; i < ex.notes.length; i++) {
      assert.ok(Math.abs(ex.notes[i].midi - ex.notes[i - 1].midi) >= 2,
        `seed ${seed}: consecutive notes too close`);
    }
  }
});

test('five-note scale is a proper up-down major pentascale', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const ex = Exercises.scaleFiveNote({ low: 48, high: 72 }, makeRng(seed));
    assert.strictEqual(ex.notes.length, 9);
    const root = ex.notes[0].midi;
    const degrees = ex.notes.map(n => n.midi - root);
    assert.deepStrictEqual(degrees, [0, 2, 4, 5, 7, 5, 4, 2, 0]);
    assert.strictEqual(ex.notes[0].label, 'Do');
    assert.strictEqual(ex.notes[4].label, 'Sol');
    // whole scale must fit inside the comfort zone
    const zone = Exercises.comfortZone({ low: 48, high: 72 });
    assert.ok(root >= zone.low && root + 7 <= zone.high, `seed ${seed}: scale escapes zone`);
  }
});

test('scale still fits when the range is minimal', () => {
  const tiny = { low: 60, high: 67 }; // clamped up to a wider span internally
  const ex = Exercises.scaleFiveNote(tiny, makeRng(7));
  assert.strictEqual(ex.notes.length, 9);
});

test('intervals produce valid pairs inside the zone', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const ex = Exercises.intervals({ low: 48, high: 72 }, 4, makeRng(seed));
    assert.strictEqual(ex.notes.length, 8);
    const zone = Exercises.comfortZone({ low: 48, high: 72 });
    for (let i = 0; i < ex.notes.length; i += 2) {
      const root = ex.notes[i], target = ex.notes[i + 1];
      const semis = target.midi - root.midi;
      assert.ok([2, 4, 5, 7].includes(semis), `seed ${seed}: bad interval ${semis}`);
      assert.ok(root.midi >= zone.low && target.midi <= zone.high, `seed ${seed}: interval escapes zone`);
    }
  }
});

test('warm-up hum sits around the middle of the range', () => {
  const ex = Exercises.warmupHum({ low: 48, high: 72 });
  assert.strictEqual(ex.notes.length, 6);
  const mids = ex.notes.map(n => n.midi);
  const centre = mids[0];
  assert.ok(Math.abs(centre - 60) <= 2);
  assert.ok(Math.max(...mids) - Math.min(...mids) === 4); // ±2 semitones
});

test('forId returns every catalogued exercise', () => {
  for (const item of Exercises.CATALOG) {
    const ex = Exercises.forId(item.id, { low: 48, high: 72 }, makeRng(3));
    assert.ok(ex, `missing generator for ${item.id}`);
    assert.strictEqual(ex.id, item.id);
    assert.ok(ex.notes.length > 0);
  }
  assert.strictEqual(Exercises.forId('nope', { low: 48, high: 72 }), null);
});

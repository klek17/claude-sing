/*
 * SingCoach exercise generators — pure functions, shared with Node tests.
 *
 * Every generator receives the singer's vocal range { low, high } (MIDI note
 * numbers) and returns an exercise:
 *   { id, title, description, notes: [{ midi, holdMs, label? }] }
 */
(function (global) {
  'use strict';

  var DEFAULT_RANGE = { low: 48, high: 72 }; // C3..C5 — safe middle ground
  var MIN_RANGE_SPAN = 7;                    // need at least a fifth to train

  function clampRange(range) {
    var r = range && isFinite(range.low) && isFinite(range.high)
      ? { low: Math.round(range.low), high: Math.round(range.high) }
      : { low: DEFAULT_RANGE.low, high: DEFAULT_RANGE.high };
    // Sanity: human singing range, low below high.
    r.low = Math.min(Math.max(r.low, 36), 84);
    r.high = Math.min(Math.max(r.high, 40), 96);
    if (r.high - r.low < MIN_RANGE_SPAN) {
      var mid = Math.round((r.low + r.high) / 2);
      r.low = mid - 4;
      r.high = mid + 4;
    }
    return r;
  }

  // The comfortable middle of the range, where beginners should train.
  function comfortZone(range) {
    var r = clampRange(range);
    var span = r.high - r.low;
    var pad = Math.max(1, Math.round(span * 0.2));
    return { low: r.low + pad, high: r.high - pad };
  }

  function randInt(rng, lo, hi) { // inclusive
    return lo + Math.floor(rng() * (hi - lo + 1));
  }

  /* Match single sustained notes, one at a time. */
  function pitchMatch(range, count, rng) {
    rng = rng || Math.random;
    count = count || 5;
    var zone = comfortZone(range);
    var notes = [];
    var prev = null;
    for (var i = 0; i < count; i++) {
      var midi;
      var guard = 0;
      do {
        midi = randInt(rng, zone.low, zone.high);
      } while (prev !== null && Math.abs(midi - prev) < 2 && ++guard < 20);
      prev = midi;
      notes.push({ midi: midi, holdMs: 2500 });
    }
    return {
      id: 'pitch-match',
      title: 'Pitch Matching',
      description: 'Listen to each note, then sing it back and hold it steady.',
      notes: notes
    };
  }

  /* Five-note major scale, up and back down (do-re-mi-fa-sol-fa-mi-re-do). */
  function scaleFiveNote(range, rng) {
    rng = rng || Math.random;
    var zone = comfortZone(range);
    var top = 7; // a fifth above the root
    var rootHigh = zone.high - top;
    var root = rootHigh <= zone.low ? zone.low : randInt(rng, zone.low, rootHigh);
    var degrees = [0, 2, 4, 5, 7, 5, 4, 2, 0];
    var solfege = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'Fa', 'Mi', 'Re', 'Do'];
    var notes = degrees.map(function (d, i) {
      return { midi: root + d, holdMs: 1400, label: solfege[i] };
    });
    return {
      id: 'scale-5',
      title: 'Five-Note Scale',
      description: 'Sing up the scale and back down, one clear note at a time.',
      notes: notes
    };
  }

  /* Hear a root, then sing the interval above it. */
  function intervals(range, count, rng) {
    rng = rng || Math.random;
    count = count || 4;
    var zone = comfortZone(range);
    var choices = [
      { semis: 2, name: 'Major 2nd' },
      { semis: 4, name: 'Major 3rd' },
      { semis: 5, name: 'Perfect 4th' },
      { semis: 7, name: 'Perfect 5th' }
    ];
    var notes = [];
    for (var i = 0; i < count; i++) {
      var iv = choices[randInt(rng, 0, choices.length - 1)];
      var rootHigh = zone.high - iv.semis;
      var root = rootHigh <= zone.low ? zone.low : randInt(rng, zone.low, rootHigh);
      notes.push({ midi: root, holdMs: 1800, label: 'Root' });
      notes.push({ midi: root + iv.semis, holdMs: 1800, label: iv.name });
    }
    return {
      id: 'intervals',
      title: 'Interval Jumps',
      description: 'Sing the first note, then leap cleanly to the second.',
      notes: notes
    };
  }

  /* Gentle warm-up: hum a comfy note, then step up and down by one tone. */
  function warmupHum(range) {
    var zone = comfortZone(range);
    var mid = Math.round((zone.low + zone.high) / 2);
    var seq = [0, 0, 2, 0, -2, 0].map(function (d, i) {
      return { midi: mid + d, holdMs: 2200, label: i < 2 ? 'Hum' : 'Hum step' };
    });
    return {
      id: 'warmup-hum',
      title: 'Humming Warm-Up',
      description: 'Hum each note gently with your lips closed. No pushing!',
      notes: seq
    };
  }

  function forId(id, range, rng) {
    switch (id) {
      case 'pitch-match': return pitchMatch(range, 5, rng);
      case 'scale-5': return scaleFiveNote(range, rng);
      case 'intervals': return intervals(range, 4, rng);
      case 'warmup-hum': return warmupHum(range);
      default: return null;
    }
  }

  var CATALOG = [
    { id: 'warmup-hum', title: 'Humming Warm-Up', level: 'Start here', blurb: 'Gentle hums to wake up your voice safely.' },
    { id: 'pitch-match', title: 'Pitch Matching', level: 'Beginner', blurb: 'Hear a note, sing it back. The core skill of singing in tune.' },
    { id: 'scale-5', title: 'Five-Note Scale', level: 'Beginner', blurb: 'Do–Re–Mi–Fa–Sol and back. Builds smooth, even steps.' },
    { id: 'intervals', title: 'Interval Jumps', level: 'Improver', blurb: 'Leap between two notes accurately — the start of melody skills.' }
  ];

  var Exercises = {
    DEFAULT_RANGE: DEFAULT_RANGE,
    CATALOG: CATALOG,
    clampRange: clampRange,
    comfortZone: comfortZone,
    pitchMatch: pitchMatch,
    scaleFiveNote: scaleFiveNote,
    intervals: intervals,
    warmupHum: warmupHum,
    forId: forId
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Exercises;
  else global.Exercises = Exercises;
})(typeof window !== 'undefined' ? window : globalThis);

/*
 * SingCoach song trainer engine — pure logic, shared with Node tests.
 *
 * A song profile stores only facts (key, tempo, range) and original coaching
 * text — no lyrics and no melody transcription. The user sings along with
 * their own copy of the track; the app analyses their voice.
 */
(function (global) {
  'use strict';

  var Pitch = global.Pitch || (typeof require === 'function' ? require('./pitch.js') : null);
  var Exercises = global.Exercises || (typeof require === 'function' ? require('./exercises.js') : null);

  var MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];

  /*
   * Breakeven — The Script. Key/tempo/range are approximate, widely reported
   * facts; the profile is a starting point and the practice key is adjustable.
   * MIDI: C#3 = 49, F#4 = 66.
   */
  var BREAKEVEN = {
    id: 'breakeven',
    title: 'Breakeven',
    artist: 'The Script',
    keyRoot: 6,            // F# (pitch class)
    major: true,
    tempo: 94,             // approx BPM
    range: { low: 49, high: 66 },  // approx C#3–F#4
    demands: [
      'Sustained notes at the very top of the range in every chorus',
      'Leaps from low verse notes up to high chorus notes',
      'Long phrases with few places to breathe',
      'Staying relaxed (not shouty) on repeated high passages'
    ],
    guide: [
      { title: 'Learn it in sections', text: 'Master the first verse alone, then the chorus alone, before singing the whole song. The chorus is the hard part — give it 70% of your practice time.' },
      { title: 'The chorus lives at your top', text: 'The chorus sits near the highest note of the song and repeats it a lot. Use the Top-Note Sustains drill until that pitch feels easy, not like a reach. If it always strains, lower the practice key — great singers transpose all the time.' },
      { title: 'Breathe like a swimmer', text: 'Phrases are long. Plan your breaths: take a low, silent belly breath at every comma-sized gap, not a last-second gasp. The Breath Trainer below builds the tank you need.' },
      { title: 'Lighten up, don’t push', text: 'The high repeated notes should feel light and forward (like calling "hey!" across a street), never like shouting. If your throat tightens, sing the passage on "woo" first, then add words back in.' },
      { title: 'Record, listen, repeat', text: 'Sing along with the track in headphones, record a take here, and read the analysis. Fix the weakest number, then take another. Three focused takes beat twenty careless ones.' }
    ]
  };

  var SONGS = [BREAKEVEN];

  function songById(id) {
    for (var i = 0; i < SONGS.length; i++) if (SONGS[i].id === id) return SONGS[i];
    return null;
  }

  // Pitch classes of the (major) scale for a practice key.
  function scaleClasses(root) {
    return MAJOR_SCALE.map(function (s) { return (root + s) % 12; });
  }

  /*
   * Recommend a semitone offset that moves the song into the user's range,
   * leaving one semitone of headroom at the top. Returns { offset, fits }.
   * When the user's range is too narrow to fit the whole song, the offset
   * still protects the top (the chorus) and fits=false.
   */
  function recommendOffset(songRange, userRange) {
    var maxOff = userRange.high - 1 - songRange.high; // top must fit w/ headroom
    var minOff = userRange.low - songRange.low;       // bottom must fit
    if (minOff <= maxOff) {
      // Feasible: choose the offset closest to zero (stay near the original key).
      var offset = Math.max(minOff, Math.min(maxOff, 0));
      return { offset: offset, fits: true };
    }
    // Infeasible: protect the chorus top, let low verse notes fall where they may.
    return { offset: Math.max(-12, Math.min(12, maxOff)), fits: false };
  }

  // "F# major" style name for the practice key after an offset.
  function practiceKeyName(profile, offset) {
    var root = ((profile.keyRoot + offset) % 12 + 12) % 12;
    return Pitch.NOTE_NAMES[root] + ' major';
  }

  /*
   * Analyse one sing-along take.
   * midis: array of detected MIDI floats (voiced frames only).
   * Returns null when there is not enough voice to judge.
   */
  function analyzeTake(midis, profile, offset) {
    var voiced = (midis || []).filter(isFinite);
    if (voiced.length < 40) return null; // ~1s of singing minimum

    var classes = scaleClasses(((profile.keyRoot + offset) % 12 + 12) % 12);
    var inKey = 0;
    var absCents = [];
    var lo = Infinity, hi = -Infinity;
    voiced.forEach(function (m) {
      var nearest = Math.round(m);
      absCents.push(Math.abs(m - nearest) * 100);
      if (classes.indexOf(((nearest % 12) + 12) % 12) >= 0) inKey++;
      if (m < lo) lo = m;
      if (m > hi) hi = m;
    });

    var inKeyPct = inKey / voiced.length;

    // How much of the song's (transposed) range did the singer actually use?
    var songLo = profile.range.low + offset, songHi = profile.range.high + offset;
    var overlap = Math.min(hi, songHi) - Math.max(lo, songLo);
    var coverage = Math.max(0, Math.min(1, overlap / (songHi - songLo)));
    var hitTop = hi >= songHi - 0.5;

    absCents.sort(function (a, b) { return a - b; });
    var medAbs = absCents[Math.floor(absCents.length / 2)];
    var stability = Math.max(0, 1 - medAbs / 60);

    var readiness = Math.round(100 * (0.45 * inKeyPct + 0.30 * coverage + 0.25 * stability));

    return {
      voicedCount: voiced.length,
      inKeyPct: inKeyPct,
      coverage: coverage,
      hitTop: hitTop,
      lowest: Math.round(lo),
      highest: Math.round(hi),
      medianAbsCents: medAbs,
      stability: stability,
      readiness: readiness
    };
  }

  // Coaching feedback for the weakest part of a take.
  function takeFeedback(a, profile, offset) {
    if (!a) return 'We could not hear enough singing. Headphones on, track up, and sing out!';
    var topName = Pitch.midiToNoteName(profile.range.high + offset);
    if (a.readiness >= 80) return 'Stage ready! This take sounds confident — keep it warm with a run-through every day.';
    var weakest = Math.min(a.inKeyPct, a.coverage, a.stability);
    if (weakest === a.coverage) {
      return a.hitTop
        ? 'You touched the top but spent little time in the chorus zone. Loop the chorus a few times, then take again.'
        : 'You never reached the song’s top note (' + topName + '). Run the Top-Note Sustains drill, or lower the practice key a step.';
    }
    if (weakest === a.inKeyPct) {
      return 'Quite a few notes landed outside the key. Slow down: hum the melody with the track once before singing words.';
    }
    return 'Your pitch wobbles as you hold notes. More breath support — do the Breath Trainer, then sustain each long note on "ahh".';
  }

  /* --- Drill generators (personalised to the practice key + user range) --- */

  // Three sustains climbing to the song's (transposed) top note.
  function topNoteSustains(profile, offset, userRange) {
    var r = Exercises.clampRange(userRange);
    var top = Math.min(profile.range.high + offset, r.high);
    var notes = [top - 4, top - 2, top].map(function (m, i) {
      return { midi: Math.max(r.low, m), holdMs: 4000, label: i === 2 ? 'Top note!' : 'Step ' + (i + 1) };
    });
    return {
      id: 'song-sustains',
      title: 'Top-Note Sustains',
      description: 'Climb to the chorus top note and hold each step long and steady.',
      notes: notes
    };
  }

  // Verse-to-chorus style leaps: low anchor up to the top zone and back.
  function chorusLeaps(profile, offset, userRange) {
    var r = Exercises.clampRange(userRange);
    var top = Math.min(profile.range.high + offset, r.high);
    var leap = top - 7 >= r.low ? 7 : 5; // prefer a fifth, shrink if needed
    var base = Math.max(r.low, top - leap);
    var notes = [];
    for (var i = 0; i < 3; i++) {
      notes.push({ midi: base, holdMs: 1500, label: 'Low anchor' });
      notes.push({ midi: top, holdMs: 2200, label: 'Leap up!' });
    }
    return {
      id: 'song-leaps',
      title: 'Chorus Leaps',
      description: 'Jump cleanly from a low anchor note up to the chorus top — no sliding, no strain.',
      notes: notes
    };
  }

  var Songs = {
    SONGS: SONGS,
    BREAKEVEN: BREAKEVEN,
    songById: songById,
    scaleClasses: scaleClasses,
    recommendOffset: recommendOffset,
    practiceKeyName: practiceKeyName,
    analyzeTake: analyzeTake,
    takeFeedback: takeFeedback,
    topNoteSustains: topNoteSustains,
    chorusLeaps: chorusLeaps
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Songs;
  else global.Songs = Songs;
})(typeof window !== 'undefined' ? window : globalThis);

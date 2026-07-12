/*
 * SingCoach scoring — pure functions shared by browser and Node tests.
 *
 * A "sample" is one pitch-detector reading taken while the singer holds a
 * note: { cents: signed cents vs the target, clarity: 0..1 }.
 */
(function (global) {
  'use strict';

  var IN_TUNE_CENTS = 50;      // within half a semitone counts as "on pitch"
  var GREAT_CENTS = 20;        // professional-ish accuracy
  var MIN_SAMPLES = 5;         // fewer voiced samples than this = not heard

  function median(values) {
    if (!values.length) return NaN;
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /*
   * Score one sung note against its target.
   * Returns { score: 0..100, heard, withinPct, medianCents, medianAbsCents, feedback }
   */
  function scoreNote(samples) {
    var voiced = samples.filter(function (s) { return isFinite(s.cents); });
    if (voiced.length < MIN_SAMPLES) {
      return {
        score: 0, heard: false, withinPct: 0,
        medianCents: NaN, medianAbsCents: NaN,
        feedback: "We couldn't hear you — sing louder and closer to the mic."
      };
    }

    var cents = voiced.map(function (s) { return s.cents; });
    var absCents = cents.map(Math.abs);
    var within = absCents.filter(function (c) { return c <= IN_TUNE_CENTS; }).length;
    var withinPct = within / voiced.length;
    var med = median(cents);
    var medAbs = median(absCents);

    // 60% weight: fraction of the hold spent on pitch.
    // 40% weight: how close the centre of your pitch was.
    var accuracy = Math.max(0, 1 - medAbs / 100);
    var score = Math.round(100 * (0.6 * withinPct + 0.4 * accuracy));

    var feedback;
    if (medAbs <= GREAT_CENTS && withinPct >= 0.8) {
      feedback = 'Excellent — locked right onto the note!';
    } else if (withinPct >= 0.6) {
      feedback = med > 15 ? 'Good, but you drift slightly sharp (high). Relax and let the note settle.'
        : med < -15 ? 'Good, but you drift slightly flat (low). More breath support!'
        : 'Good — keep the note steadier as you hold it.';
    } else if (med > IN_TUNE_CENTS) {
      feedback = 'You sang sharp (too high). Listen again and slide down to meet the note.';
    } else if (med < -IN_TUNE_CENTS) {
      feedback = 'You sang flat (too low). Take a deeper breath and aim a touch higher.';
    } else {
      feedback = 'Your pitch wobbled around the note. Try humming it softly first.';
    }

    return {
      score: score, heard: true, withinPct: withinPct,
      medianCents: med, medianAbsCents: medAbs, feedback: feedback
    };
  }

  // Combine per-note results into an exercise result.
  function scoreExercise(noteResults) {
    if (!noteResults.length) return { score: 0, stars: 0, heardAll: false };
    var sum = 0, heardAll = true;
    noteResults.forEach(function (r) { sum += r.score; if (!r.heard) heardAll = false; });
    var score = Math.round(sum / noteResults.length);
    return { score: score, stars: starsFor(score), heardAll: heardAll };
  }

  function starsFor(score) {
    if (score >= 85) return 3;
    if (score >= 65) return 2;
    if (score >= 40) return 1;
    return 0;
  }

  var Scoring = {
    IN_TUNE_CENTS: IN_TUNE_CENTS,
    MIN_SAMPLES: MIN_SAMPLES,
    median: median,
    scoreNote: scoreNote,
    scoreExercise: scoreExercise,
    starsFor: starsFor
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Scoring;
  else global.Scoring = Scoring;
})(typeof window !== 'undefined' ? window : globalThis);

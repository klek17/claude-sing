/*
 * SingCoach beginner lessons — short, practical reading with "try it" tasks.
 */
(function (global) {
  'use strict';

  var LESSONS = [
    {
      id: 'posture',
      title: '1. Stand Like a Singer',
      minutes: 2,
      body: [
        'Your body is your instrument, and it works best when it is aligned and relaxed.',
        '<strong>Feet</strong> shoulder-width apart, weight even. <strong>Knees</strong> soft, never locked. <strong>Shoulders</strong> rolled back and down — not raised. <strong>Head</strong> level, chin parallel to the floor, like a string gently pulls the crown of your head upward.',
        'Common beginner mistake: reaching the chin up for high notes. It tightens your throat and makes high notes harder, not easier.'
      ],
      tryIt: 'Stand up, shake out your arms, then set your posture using the checklist above. Notice how much easier a deep breath feels.'
    },
    {
      id: 'breathing',
      title: '2. Breathe From Your Belly',
      minutes: 3,
      body: [
        'Singers breathe low. When you inhale, your <strong>belly should expand</strong> — not your chest or shoulders. This is called diaphragmatic breathing, and it gives your voice steady power.',
        'Exercise — <em>the book breath</em>: lie on your back with a book on your belly. Breathe so the book rises on the inhale and falls slowly on the exhale.',
        'Exercise — <em>the hiss</em>: inhale low for 4 counts, then exhale on a steady "sss" for as long as you can. Aim for 20+ seconds with a perfectly even hiss. Do this daily; your note-holding power comes directly from it.'
      ],
      tryIt: 'Do 3 rounds of the hiss right now. Time yourself — write down your best. Beat it tomorrow.'
    },
    {
      id: 'pitch',
      title: '3. What "Singing In Tune" Means',
      minutes: 3,
      body: [
        'Every note is a vibration speed (pitch). Singing in tune means your voice vibrates at the same speed as the target note. When you are slightly too high you are <strong>sharp</strong>; slightly too low is <strong>flat</strong>.',
        'Good news: pitch accuracy is a <em>trainable skill</em>, not a talent you are born with. The loop is: listen → sing → check → adjust. This app closes that loop for you — its tuner hears your voice and shows exactly how close you are, in real time.',
        'Tip: before singing a note back, <em>hear it in your head first</em> (this is called audiation). It roughly doubles most beginners’ accuracy.'
      ],
      tryIt: 'Open the Tuner tab, hum any comfortable note, and watch the needle. Try to hold it in the green zone for 5 seconds.'
    },
    {
      id: 'warmup',
      title: '4. Always Warm Up (Gently!)',
      minutes: 2,
      body: [
        'Cold vocal cords strain easily. Two minutes of gentle warm-up protects your voice and instantly improves your sound.',
        'Good warm-ups: <strong>lip trills</strong> (blow air through loosely closed lips, like a motorboat, while sliding your pitch up and down), <strong>humming</strong> gentle sirens, and <strong>yawn-sighs</strong> (a big yawn that slides down into a sigh).',
        'Rule of thumb: warm-ups should feel like a gentle stretch, never like effort. If anything hurts or scratches — stop, drink water, and sing lower and quieter.'
      ],
      tryIt: 'Run the Humming Warm-Up in the Train tab before every practice session.'
    },
    {
      id: 'range',
      title: '5. Find Your Range, Stay In It',
      minutes: 2,
      body: [
        'Your vocal range is the span from the lowest to the highest note you can sing comfortably. Beginners improve fastest by practising in the <em>middle</em> of their range, where the voice is relaxed.',
        'Use the <strong>Range</strong> tab to measure yours: you will sing your lowest comfy note, then your highest. The app then personalises every exercise to sit in your sweet spot.',
        'Your range will grow over time — re-test every couple of weeks. Never push for high notes to the point of strain; range grows from relaxed repetition, not force.'
      ],
      tryIt: 'Do the range test in the Range tab now — it takes 30 seconds and makes every exercise fit your voice.'
    },
    {
      id: 'practice',
      title: '6. How To Practise (10 Minutes a Day)',
      minutes: 2,
      body: [
        'Ten focused minutes daily beats two hours once a week. Voices are muscles-plus-coordination; both grow with frequent, small doses.',
        'A perfect beginner session: <strong>2 min</strong> breathing + posture → <strong>2 min</strong> Humming Warm-Up → <strong>4 min</strong> Pitch Matching or Five-Note Scale → <strong>2 min</strong> record yourself singing anything you enjoy in the Studio tab.',
        'Recording yourself matters: everyone hates their recorded voice at first (you normally hear yourself through your skull, which adds bass). Push through it — listening back is the fastest way to spot and fix pitch drift.'
      ],
      tryIt: 'Do one full 10-minute session today, and check the Progress tab afterwards to start your streak.'
    },
    {
      id: 'health',
      title: '7. Take Care of Your Voice',
      minutes: 2,
      body: [
        '<strong>Hydrate</strong>: your cords need water — sip regularly, all day.',
        '<strong>Stop if it hurts</strong>: singing should never be painful. Pain, scratchiness, or losing your voice means rest, not pushing through.',
        '<strong>Avoid whispering and screaming</strong> — both strain cords more than normal speech. If you are hoarse, be quiet and rest.',
        'A relaxed voice today is a bigger, better voice next month.'
      ],
      tryIt: 'Get a glass of water before your next exercise. Seriously — go get it.'
    }
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = { LESSONS: LESSONS };
  else global.Lessons = { LESSONS: LESSONS };
})(typeof window !== 'undefined' ? window : globalThis);

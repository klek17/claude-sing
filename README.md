# 🎤 SingCoach — Learn to Sing

A complete, beginner-friendly singing training system that runs entirely in your
browser. It listens to your voice through your microphone, tells you exactly how
in-tune you are in real time, guides you through vocal exercises, records your
performances, and tracks your progress over time.

**No account, no installs, no data leaves your computer.** Everything (scores,
vocal range, recordings) is stored privately in your own browser.

## Use it online

Once this repository's Pages deployment is enabled (merge to `main` — the
included GitHub Actions workflow does the rest automatically), the app is live
for free at:

**https://klek17.github.io/claude-sing/**

Open it on any phone, tablet or computer, click **🎤 Enable microphone**, and
allow microphone access when the browser asks.

## Run it locally

You need [Node.js](https://nodejs.org) (any recent version) — only to serve the
files locally.

```bash
npm start
```

Then open **http://localhost:8080** in Chrome, Edge or Firefox.

No Node? Run `npm run build` once and double-click
`dist/singcoach-standalone.html` — the entire app in a single file that works
offline from anywhere (email it to yourself, put it on a USB stick…).

> Tip: use headphones during exercises so the reference notes don't bleed into
> your microphone.

## What's inside

| Tab | What it does |
| --- | --- |
| 📖 **Learn** | Seven short lessons covering posture, breathing, pitch, warm-ups, range, practice habits and vocal health — everything a beginner needs to start safely. |
| 🎯 **Tuner** | Real-time pitch display: the note you're singing, how many cents sharp or flat you are, a scrolling pitch trace, and an input level meter. |
| 🏋️ **Train** | Guided exercises (humming warm-up, pitch matching, five-note scale, interval jumps). Each plays reference notes, listens to you sing them back, and scores every note out of 100 with specific feedback ("you drift slightly flat — more breath support!"). |
| 📏 **Range** | A 30-second vocal range test. Once measured, every exercise is automatically transposed to sit comfortably in *your* voice. |
| 🎈 **Game** | *Pitch Flyer* — steer a balloon with your voice (sing higher to float up, lower to sink) and fly through the gaps. Pitch-control training disguised as an arcade game, with a persistent best score. |
| ⏺ **Studio** | Record yourself, listen back, download or delete takes. Recordings persist across sessions (IndexedDB). |
| 📈 **Progress** | Practice streak, per-exercise averages and bests, a 14-day score chart, and **17 unlockable achievement badges** (with confetti 🎉 when you earn one). |

## Suggested daily routine (10 minutes)

1. **2 min** — posture + breathing (Learn tab, lessons 1–2)
2. **2 min** — Humming Warm-Up (Train tab)
3. **4 min** — Pitch Matching or Five-Note Scale
4. **2 min** — record yourself singing anything you enjoy (Studio tab)

## How the pitch detection works

The app captures raw microphone audio (with echo cancellation and auto-gain
disabled, which distort singing) and runs the **McLeod Pitch Method** — a
normalized square-difference autocorrelation with peak picking and parabolic
interpolation — about 60 times per second. It is decimated 2× for speed
(~0.5 ms per frame) and accurate to well under 1 cent on clean signals, with
silence/noise gating and median smoothing to reject octave-error blips.

Scoring: each held note is sampled continuously; your score combines the
percentage of time spent within ±50 cents of the target (60%) and the median
accuracy of your pitch centre (40%).

## Development

```
index.html          app shell
css/styles.css      styling
js/pitch.js         pitch detection + music math (pure, Node-testable)
js/scoring.js       note/exercise scoring (pure, Node-testable)
js/exercises.js     exercise generators (pure, Node-testable)
js/progress.js      localStorage progress store (Node-testable)
js/lessons.js       lesson content
js/achievements.js  badge definitions + unlock logic (pure, Node-testable)
js/audio.js         microphone engine + reference tone synth
js/recorder.js      MediaRecorder wrapper + IndexedDB store
js/trainer.js       exercise state machine
js/game.js          Pitch Flyer voice-controlled arcade game
js/app.js           UI wiring
tools/serve.js      dependency-free static server
tools/build-single.js  bundles everything into one standalone HTML file
tests/unit/         55 unit tests (node:test) for all the app logic
tests/e2e/          36-check browser test driving the real app with a fake mic
.github/workflows/  auto-deploys to GitHub Pages on every push to main
```

Run the tests:

```bash
npm test          # unit tests (no browser needed)
npm run test:e2e  # full browser test (uses a simulated microphone)
npm run test:all  # both
```

The end-to-end test launches headless Chromium with
`--use-fake-device-for-media-stream`, so the entire mic → analysis → UI →
recording pipeline is exercised automatically without a human singing.

## Troubleshooting

- **"Microphone access was blocked"** — click the padlock/mic icon in the
  address bar, allow the microphone, and reload.
- **Tuner says "listening…" while you sing** — check the input level meter
  moves; if not, pick the right input device in your OS sound settings.
- **Scores seem harsh** — sing "ahh" clearly and hold the note steadily for the
  whole bar; breathy or very quiet singing is hard to track.

# Changelog

## 1.2.0 — 2026-07-12

- **Song Trainer** 🎵 — a complete practice program for *Breakeven — The Script*:
  - Song profile (key, tempo, required range — approximate and adjustable) compared
    against your measured vocal range, with automatic practice-key recommendation
    and ♭/♯ transposition controls
  - Personalised drills: Top-Note Sustains and Chorus Leaps, generated in your
    practice key and clamped to your range
  - Breath Trainer: measures how long you can hold a steady sound (Breakeven's
    long phrases need 20s+)
  - Sing-along take analyser: records you singing with the real track and scores
    in-key percentage, range coverage, pitch steadiness, and an overall readiness
    score with targeted coaching feedback; audio takes are saved to the Studio
  - Take history with best readiness per song
- 4 new achievements (Cover Artist, Take Ten, Stage Ready, Deep Well)
- No lyrics or melody data are bundled (copyright) — you sing along with your own
  copy of the track; the app analyses your voice

## 1.1.0 — 2026-07-12

- **Pitch Flyer** 🎈 — voice-controlled arcade game: your singing pitch steers a
  balloon through gaps, mapped to your own vocal range
- **17 achievement badges** with confetti celebrations and unlock toasts
- Badge grid in the Progress tab; best game score persisted
- GitHub Actions workflow: tests + automatic deploy to GitHub Pages on every
  push to `main`
- `npm run build` bundles the app into a single offline HTML file (`dist/`)

## 1.0.0 — 2026-07-12

- Initial release: live tuner (McLeod pitch detection), guided exercises with
  per-note scoring, vocal range test, recording studio (IndexedDB), progress
  tracking, and seven beginner lessons
- 55 unit tests + 36-check end-to-end browser test with a simulated microphone

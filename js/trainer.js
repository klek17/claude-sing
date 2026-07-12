/*
 * SingCoach trainer — runs one exercise as a state machine:
 * for each note: LISTEN (reference tone plays) → SING (collect pitch
 * samples) → per-note result; then a final exercise score.
 *
 * The trainer knows nothing about the DOM; the app subscribes to events:
 *   onState({ phase, noteIndex, note, msLeft })
 *   onLive({ cents, voiced })           — during SING
 *   onNoteResult(result, noteIndex)
 *   onDone({ score, stars, noteResults })
 */
(function (global) {
  'use strict';

  var LISTEN_EXTRA_MS = 350;  // small gap after the reference tone
  var GET_READY_MS = 900;

  function Trainer(mic, tones) {
    this.mic = mic;
    this.tones = tones;
    this.onState = function () {};
    this.onLive = function () {};
    this.onNoteResult = function () {};
    this.onDone = function () {};
    this._cancelled = false;
    this._unsub = null;
  }

  Trainer.prototype.cancel = function () {
    this._cancelled = true;
    if (this._unsub) { this._unsub(); this._unsub = null; }
  };

  Trainer.prototype._sleep = function (ms) {
    var self = this;
    return new Promise(function (resolve) {
      var start = performance.now();
      function step() {
        if (self._cancelled) return resolve();
        if (performance.now() - start >= ms) return resolve();
        requestAnimationFrame(step);
      }
      step();
    });
  };

  Trainer.prototype.run = async function (exercise) {
    this._cancelled = false;
    var noteResults = [];

    for (var i = 0; i < exercise.notes.length; i++) {
      if (this._cancelled) return null;
      var note = exercise.notes[i];

      // LISTEN: play the reference
      this.onState({ phase: 'listen', noteIndex: i, note: note });
      await this.tones.playNote(note.midi, Math.min(note.holdMs, 1800));
      await this._sleep(LISTEN_EXTRA_MS);
      if (this._cancelled) return null;

      // GET READY
      this.onState({ phase: 'ready', noteIndex: i, note: note });
      await this._sleep(GET_READY_MS);
      if (this._cancelled) return null;

      // SING: collect samples for holdMs
      this.onState({ phase: 'sing', noteIndex: i, note: note });
      var samples = await this._collect(note);
      if (this._cancelled) return null;

      var result = Scoring.scoreNote(samples);
      result.targetMidi = note.midi;
      noteResults.push(result);
      this.onNoteResult(result, i);
      this.tones.blip(result.score >= 65);
      await this._sleep(900);
    }

    var total = Scoring.scoreExercise(noteResults);
    total.noteResults = noteResults;
    this.onDone(total);
    return total;
  };

  Trainer.prototype._collect = function (note) {
    var self = this;
    var targetFreq = Pitch.midiToFreq(note.midi);
    var samples = [];
    return new Promise(function (resolve) {
      var start = performance.now();
      var finished = false;
      function finish() {
        if (finished) return;
        finished = true;
        clearTimeout(guard);
        if (self._unsub) { self._unsub(); self._unsub = null; }
        resolve(samples);
      }
      // Readings stop if the mic is turned off mid-exercise; never hang.
      var guard = setTimeout(finish, note.holdMs + 2000);
      self._unsub = self.mic.onReading(function (r) {
        var elapsed = performance.now() - start;
        if (self._cancelled || elapsed >= note.holdMs) {
          finish();
          return;
        }
        if (r.voiced) {
          var cents = Pitch.centsBetween(r.freq, targetFreq);
          samples.push({ cents: cents, clarity: r.clarity });
          self.onLive({ cents: cents, voiced: true, msLeft: note.holdMs - elapsed });
        } else {
          self.onLive({ cents: NaN, voiced: false, msLeft: note.holdMs - elapsed });
        }
      });
    });
  };

  /*
   * Range test helper: collect voiced readings for `ms`, return the median
   * MIDI value (or null if barely voiced). Used to find lowest/highest note.
   */
  Trainer.prototype.measureHeldNote = function (ms) {
    var self = this;
    var midis = [];
    return new Promise(function (resolve) {
      var start = performance.now();
      var finished = false;
      function finish() {
        if (finished) return;
        finished = true;
        clearTimeout(guard);
        unsub();
        if (midis.length < 10) return resolve(null);
        midis.sort(function (a, b) { return a - b; });
        resolve(midis[Math.floor(midis.length / 2)]);
      }
      var guard = setTimeout(finish, ms + 2000);
      var unsub = self.mic.onReading(function (r) {
        var elapsed = performance.now() - start;
        if (elapsed >= ms) {
          finish();
          return;
        }
        if (r.voiced) {
          midis.push(r.midi);
          self.onLive({ midi: r.midi, voiced: true, msLeft: ms - elapsed });
        } else {
          self.onLive({ midi: NaN, voiced: false, msLeft: ms - elapsed });
        }
      });
    });
  };

  global.Trainer = Trainer;
})(window);

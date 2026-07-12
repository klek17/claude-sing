/*
 * SingCoach recording studio backend (browser only).
 *  - Recorder: wraps MediaRecorder on the mic stream
 *  - RecordingStore: persists takes in IndexedDB so they survive reloads
 */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Recorder                                                            */
  /* ------------------------------------------------------------------ */

  function pickMimeType() {
    if (typeof MediaRecorder === 'undefined') return null;
    var candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    for (var i = 0; i < candidates.length; i++) {
      if (MediaRecorder.isTypeSupported(candidates[i])) return candidates[i];
    }
    return ''; // let the browser choose
  }

  function Recorder(stream) {
    if (typeof MediaRecorder === 'undefined') {
      throw new Error('Recording is not supported in this browser.');
    }
    var mime = pickMimeType();
    this.mimeType = mime || 'audio/webm';
    this._rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    this._chunks = [];
    this.startedAt = 0;
  }

  Recorder.prototype.start = function () {
    this._chunks = [];
    var self = this;
    this._rec.ondataavailable = function (e) {
      if (e.data && e.data.size > 0) self._chunks.push(e.data);
    };
    this.startedAt = Date.now();
    this._rec.start(250); // gather data every 250ms so nothing is lost
  };

  // Resolves with { blob, durationMs, mimeType }
  Recorder.prototype.stop = function () {
    var self = this;
    return new Promise(function (resolve, reject) {
      self._rec.onstop = function () {
        var blob = new Blob(self._chunks, { type: self.mimeType });
        resolve({ blob: blob, durationMs: Date.now() - self.startedAt, mimeType: self.mimeType });
      };
      self._rec.onerror = function (e) { reject(e.error || new Error('Recording failed')); };
      try { self._rec.stop(); } catch (err) { reject(err); }
    });
  };

  /* ------------------------------------------------------------------ */
  /* RecordingStore (IndexedDB)                                          */
  /* ------------------------------------------------------------------ */

  var DB_NAME = 'singcoach';
  var STORE = 'recordings';

  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function tx(db, mode, fn) {
    return new Promise(function (resolve, reject) {
      var t = db.transaction(STORE, mode);
      var store = t.objectStore(STORE);
      var out = fn(store);
      t.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : undefined); };
      t.onerror = function () { reject(t.error); };
      t.onabort = function () { reject(t.error || new Error('IndexedDB transaction aborted')); };
    });
  }

  var RecordingStore = {
    save: function (rec) {
      // rec: { name, blob, durationMs, mimeType, createdAt }
      return openDb().then(function (db) {
        return tx(db, 'readwrite', function (store) { return store.add(rec); });
      });
    },
    list: function () {
      return openDb().then(function (db) {
        return new Promise(function (resolve, reject) {
          var t = db.transaction(STORE, 'readonly');
          var req = t.objectStore(STORE).getAll();
          req.onsuccess = function () {
            var all = req.result || [];
            all.sort(function (a, b) { return b.createdAt - a.createdAt; });
            resolve(all);
          };
          req.onerror = function () { reject(req.error); };
        });
      });
    },
    remove: function (id) {
      return openDb().then(function (db) {
        return tx(db, 'readwrite', function (store) { return store.delete(id); });
      });
    }
  };

  global.Recorder = Recorder;
  global.RecordingStore = RecordingStore;
})(window);

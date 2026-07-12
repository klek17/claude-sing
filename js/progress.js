/*
 * SingCoach progress store — localStorage-backed. Pure enough to unit test
 * in Node by injecting a fake storage object.
 */
(function (global) {
  'use strict';

  var KEY = 'singcoach.progress.v1';

  function makeStore(storage) {
    storage = storage || (typeof localStorage !== 'undefined' ? localStorage : null);

    function blank() {
      return {
        range: null,                 // { low, high } midi, from the range test
        sessions: [],                // { date: 'YYYY-MM-DD', exerciseId, score, stars }
        lessonsRead: {},             // { lessonId: true }
        achievements: {},            // { badgeId: unlockDate }
        gameBest: 0,                 // best Pitch Flyer score
        recordingCount: 0,           // total recordings ever saved
        bestHissSec: 0,              // longest steady breath (seconds)
        songs: {}                    // { songId: { offset, best, takes: [...] } }
      };
    }

    function load() {
      if (!storage) return blank();
      try {
        var raw = storage.getItem(KEY);
        if (!raw) return blank();
        var data = JSON.parse(raw);
        return Object.assign(blank(), data);
      } catch (e) {
        return blank();
      }
    }

    function save(data) {
      if (storage) storage.setItem(KEY, JSON.stringify(data));
      return data;
    }

    function todayStr(now) {
      var d = now ? new Date(now) : new Date();
      var m = d.getMonth() + 1, day = d.getDate();
      return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
    }

    return {
      load: load,
      setRange: function (low, high) {
        var d = load();
        d.range = { low: low, high: high };
        return save(d);
      },
      addSession: function (exerciseId, score, stars, now) {
        var d = load();
        d.sessions.push({ date: todayStr(now), exerciseId: exerciseId, score: score, stars: stars });
        if (d.sessions.length > 500) d.sessions = d.sessions.slice(-500);
        return save(d);
      },
      addGameScore: function (score) {
        var d = load();
        if (score > d.gameBest) d.gameBest = score;
        return save(d);
      },
      incrRecordings: function () {
        var d = load();
        d.recordingCount = (d.recordingCount || 0) + 1;
        return save(d);
      },
      unlockAchievements: function (ids, now) {
        var d = load();
        ids.forEach(function (id) { d.achievements[id] = todayStr(now); });
        return save(d);
      },
      setBestHiss: function (sec) {
        var d = load();
        if (sec > d.bestHissSec) d.bestHissSec = sec;
        return save(d);
      },
      song: function (songId) {
        var d = load();
        return d.songs[songId] || { offset: null, best: 0, takes: [] };
      },
      setSongOffset: function (songId, offset) {
        var d = load();
        var s = d.songs[songId] || (d.songs[songId] = { offset: null, best: 0, takes: [] });
        s.offset = offset;
        return save(d);
      },
      addSongTake: function (songId, readiness, now) {
        var d = load();
        var s = d.songs[songId] || (d.songs[songId] = { offset: null, best: 0, takes: [] });
        s.takes.push({ date: todayStr(now), readiness: readiness });
        if (s.takes.length > 100) s.takes = s.takes.slice(-100);
        if (readiness > s.best) s.best = readiness;
        return save(d);
      },
      markLessonRead: function (lessonId) {
        var d = load();
        d.lessonsRead[lessonId] = true;
        return save(d);
      },
      // Consecutive days (ending today or yesterday) with >= 1 session.
      streak: function (now) {
        var d = load();
        var days = {};
        d.sessions.forEach(function (s) { days[s.date] = true; });
        var count = 0;
        var cursor = new Date(now || Date.now());
        if (!days[todayStr(cursor)]) cursor.setDate(cursor.getDate() - 1); // today not practiced yet
        while (days[todayStr(cursor)]) {
          count++;
          cursor.setDate(cursor.getDate() - 1);
        }
        return count;
      },
      stats: function () {
        var d = load();
        var byEx = {};
        d.sessions.forEach(function (s) {
          var b = byEx[s.exerciseId] || (byEx[s.exerciseId] = { count: 0, sum: 0, best: 0 });
          b.count++; b.sum += s.score;
          if (s.score > b.best) b.best = s.score;
        });
        Object.keys(byEx).forEach(function (k) {
          byEx[k].avg = Math.round(byEx[k].sum / byEx[k].count);
        });
        return { total: d.sessions.length, byExercise: byEx, range: d.range };
      },
      // Last N days as [{ date, count, avg }] oldest → newest.
      recentDays: function (n, now) {
        var d = load();
        var byDate = {};
        d.sessions.forEach(function (s) {
          var b = byDate[s.date] || (byDate[s.date] = { count: 0, sum: 0 });
          b.count++; b.sum += s.score;
        });
        var out = [];
        var cursor = new Date(now || Date.now());
        cursor.setDate(cursor.getDate() - (n - 1));
        for (var i = 0; i < n; i++) {
          var key = todayStr(cursor);
          var b = byDate[key];
          out.push({ date: key, count: b ? b.count : 0, avg: b ? Math.round(b.sum / b.count) : 0 });
          cursor.setDate(cursor.getDate() + 1);
        }
        return out;
      },
      reset: function () { return save(blank()); },
      _todayStr: todayStr
    };
  }

  var Progress = { makeStore: makeStore, KEY: KEY };

  if (typeof module !== 'undefined' && module.exports) module.exports = Progress;
  else global.Progress = Progress;
})(typeof window !== 'undefined' ? window : globalThis);

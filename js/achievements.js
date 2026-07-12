/*
 * SingCoach achievements — pure logic, shared with Node tests.
 *
 * evaluate(data) returns the ids of every badge earned by `data`, where
 * data is the progress store contents plus derived extras:
 *   { sessions, range, achievements, gameBest, recordingCount, streak }
 */
(function (global) {
  'use strict';

  function triedIds(sessions) {
    var ids = {};
    (sessions || []).forEach(function (s) { ids[s.exerciseId] = true; });
    return ids;
  }

  var BADGES = [
    { id: 'first-note', icon: '🎵', title: 'First Note', desc: 'Complete your first exercise',
      check: function (d) { return (d.sessions || []).length >= 1; } },
    { id: 'warm-hummer', icon: '🐝', title: 'Warm Hummer', desc: 'Finish a Humming Warm-Up',
      check: function (d) { return !!triedIds(d.sessions)['warmup-hum']; } },
    { id: 'scale-climber', icon: '🪜', title: 'Scale Climber', desc: 'Finish a Five-Note Scale',
      check: function (d) { return !!triedIds(d.sessions)['scale-5']; } },
    { id: 'interval-hopper', icon: '🦘', title: 'Interval Hopper', desc: 'Finish an Interval Jumps round',
      check: function (d) { return !!triedIds(d.sessions)['intervals']; } },
    { id: 'all-rounder', icon: '🎪', title: 'All-Rounder', desc: 'Try all four exercises',
      check: function (d) {
        var t = triedIds(d.sessions);
        return t['warmup-hum'] && t['pitch-match'] && t['scale-5'] && t['intervals'];
      } },
    { id: 'triple-star', icon: '⭐', title: 'Triple Star', desc: 'Earn 3 stars on any exercise',
      check: function (d) { return (d.sessions || []).some(function (s) { return s.stars === 3; }); } },
    { id: 'high-scorer', icon: '🎯', title: 'Sharpshooter', desc: 'Score 90+ on any exercise',
      check: function (d) { return (d.sessions || []).some(function (s) { return s.score >= 90; }); } },
    { id: 'dedicated', icon: '💪', title: 'Dedicated', desc: 'Complete 10 exercises',
      check: function (d) { return (d.sessions || []).length >= 10; } },
    { id: 'committed', icon: '🔥', title: 'On Fire', desc: 'Complete 25 exercises',
      check: function (d) { return (d.sessions || []).length >= 25; } },
    { id: 'streak-3', icon: '📅', title: 'Habit Forming', desc: 'Practise 3 days in a row',
      check: function (d) { return (d.streak || 0) >= 3; } },
    { id: 'streak-7', icon: '🗓️', title: 'Week Warrior', desc: 'Practise 7 days in a row',
      check: function (d) { return (d.streak || 0) >= 7; } },
    { id: 'octave-club', icon: '📏', title: 'Octave Club', desc: 'Measure a range of an octave or more',
      check: function (d) { return d.range && d.range.high - d.range.low >= 12; } },
    { id: 'two-octaves', icon: '🌈', title: 'Two Octaves!', desc: 'Measure a range of two octaves or more',
      check: function (d) { return d.range && d.range.high - d.range.low >= 24; } },
    { id: 'first-take', icon: '🎙️', title: 'First Take', desc: 'Save a recording in the Studio',
      check: function (d) { return (d.recordingCount || 0) >= 1; } },
    { id: 'game-rookie', icon: '🎈', title: 'Balloon Pilot', desc: 'Score 5 in Pitch Flyer',
      check: function (d) { return (d.gameBest || 0) >= 5; } },
    { id: 'game-ace', icon: '🕹️', title: 'Arcade Ace', desc: 'Score 15 in Pitch Flyer',
      check: function (d) { return (d.gameBest || 0) >= 15; } },
    { id: 'game-legend', icon: '👑', title: 'Pitch Royalty', desc: 'Score 30 in Pitch Flyer',
      check: function (d) { return (d.gameBest || 0) >= 30; } },
    { id: 'song-take', icon: '🎼', title: 'Cover Artist', desc: 'Record and analyse a song take',
      check: function (d) { return songTakeCount(d) >= 1; } },
    { id: 'song-grind', icon: '🎚️', title: 'Take Ten', desc: 'Record 10 song takes',
      check: function (d) { return songTakeCount(d) >= 10; } },
    { id: 'song-ready', icon: '🌟', title: 'Stage Ready', desc: 'Reach 80+ readiness on a song',
      check: function (d) { return bestSongReadiness(d) >= 80; } },
    { id: 'breath-20', icon: '🌬️', title: 'Deep Well', desc: 'Hold a steady breath sound for 20 seconds',
      check: function (d) { return (d.bestHissSec || 0) >= 20; } }
  ];

  function songTakeCount(d) {
    var songs = (d && d.songs) || {};
    var n = 0;
    Object.keys(songs).forEach(function (k) { n += (songs[k].takes || []).length; });
    return n;
  }

  function bestSongReadiness(d) {
    var songs = (d && d.songs) || {};
    var best = 0;
    Object.keys(songs).forEach(function (k) { if ((songs[k].best || 0) > best) best = songs[k].best; });
    return best;
  }

  function evaluate(data) {
    return BADGES.filter(function (b) {
      try { return !!b.check(data || {}); } catch (e) { return false; }
    }).map(function (b) { return b.id; });
  }

  // Earned-but-not-yet-stored badge ids.
  function newUnlocks(data) {
    var have = (data && data.achievements) || {};
    return evaluate(data).filter(function (id) { return !have[id]; });
  }

  function byId(id) {
    for (var i = 0; i < BADGES.length; i++) if (BADGES[i].id === id) return BADGES[i];
    return null;
  }

  var Achievements = { BADGES: BADGES, evaluate: evaluate, newUnlocks: newUnlocks, byId: byId };

  if (typeof module !== 'undefined' && module.exports) module.exports = Achievements;
  else global.Achievements = Achievements;
})(typeof window !== 'undefined' ? window : globalThis);

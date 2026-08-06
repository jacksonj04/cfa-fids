/*
 * Deterministic staging helpers and a single blink style.
 *
 * Hash-based rolls drive arrivals chaos: each flight walks a timeline of
 * segments (hold length, time status, blink flags). Blink phase is also
 * hashed so neighbouring rows drift out of sync instead of pulsing together.
 */
(function (global) {
  "use strict";

  var BLINK_DEFAULTS = { periodTicks: 12, onTicks: 7 };

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function isGenerative(staging) {
    return !!(
      staging &&
      staging.statuses &&
      staging.statuses.length &&
      staging.seed != null &&
      staging.seed !== ""
    );
  }

  function pickWeighted(statuses, roll) {
    var total = 0;
    var i;
    for (i = 0; i < statuses.length; i++) total += statuses[i].weight || 1;
    if (total <= 0) return statuses[0] || { weight: 1 };
    var cursor = (roll % total) + 1;
    for (i = 0; i < statuses.length; i++) {
      cursor -= statuses[i].weight || 1;
      if (cursor <= 0) return statuses[i];
    }
    return statuses[statuses.length - 1];
  }

  function secondsToTicks(seconds, tickMs) {
    return Math.max(1, Math.round((seconds * 1000) / tickMs));
  }

  /**
   * Walk the seeded segment timeline until `tick` is covered.
   * Hold length is the full segment (refresh cascade plays at the start).
   */
  function segmentAt(flightId, tick, tickMs, staging) {
    var seed = String(staging.seed);
    var hold = staging.holdSeconds || {};
    var minSec = hold.min == null ? 20 : hold.min;
    var maxSec = hold.max == null ? 120 : hold.max;
    if (maxSec < minSec) {
      var swap = minSec;
      minSec = maxSec;
      maxSec = swap;
    }
    var minTicks = secondsToTicks(minSec, tickMs);
    var maxTicks = secondsToTicks(maxSec, tickMs);
    var span = maxTicks - minTicks + 1;
    var chance = Math.max(1, staging.gateBlinkChance | 0 || 4);
    var statuses = staging.statuses;
    var t = 0;
    var segment = 0;
    var safety = 0;

    while (safety++ < 100000) {
      var holdHash = hash(seed + ":" + flightId + ":hold:" + segment);
      var statusHash = hash(seed + ":" + flightId + ":status:" + segment);
      var gateHash = hash(seed + ":" + flightId + ":gate:" + segment);
      var holdTicks = minTicks + (holdHash % span);
      var picked = pickWeighted(statuses, statusHash);
      if (tick < t + holdTicks) {
        return {
          segment: segment,
          segmentStartTick: t,
          holdTicks: holdTicks,
          age: tick - t,
          statusValue: picked.value != null ? picked.value : null,
          timeBlink: !!picked.blink,
          gateBlink: gateHash % chance === 0,
        };
      }
      t += holdTicks;
      segment += 1;
    }

    return {
      segment: segment,
      segmentStartTick: t,
      holdTicks: minTicks,
      age: 0,
      statusValue: null,
      timeBlink: false,
      gateBlink: false,
    };
  }

  function refreshTiming(staging, tickMs, columnCount) {
    var refresh = staging.refresh || {};
    var blankSeconds = refresh.blankSeconds == null ? 0.5 : refresh.blankSeconds;
    var revealSeconds =
      refresh.columnRevealSeconds == null ? 0.25 : refresh.columnRevealSeconds;
    return {
      blankTicks: Math.max(0, Math.round((blankSeconds * 1000) / tickMs)),
      revealTicks: Math.max(
        1,
        Math.round((revealSeconds * 1000) / tickMs),
      ),
      columnCount: columnCount,
    };
  }

  /** Whether column index `i` has been revealed for this segment age. */
  function columnVisible(age, columnIndex, timing) {
    if (age < timing.blankTicks) return false;
    return age >= timing.blankTicks + columnIndex * timing.revealTicks;
  }

  /**
   * Blink on a fixed board-wide rate; phase comes from the cell seed so rows
   * stay out of sync.
   */
  function blink(value, tick, seed, blinkConfig) {
    var cfg = blinkConfig || {};
    var period = Math.max(
      1,
      cfg.periodTicks != null ? cfg.periodTicks | 0 : BLINK_DEFAULTS.periodTicks,
    );
    var on = Math.max(
      0,
      Math.min(
        period,
        cfg.onTicks != null ? cfg.onTicks | 0 : BLINK_DEFAULTS.onTicks,
      ),
    );
    var phase = hash(seed || "") % period;
    var position = ((((tick || 0) + phase) % period) + period) % period;
    return position < on ? value : "";
  }

  global.FIDS = global.FIDS || {};
  global.FIDS.Animations = {
    hash: hash,
    blink: blink,
    BLINK_DEFAULTS: BLINK_DEFAULTS,
  };
  global.FIDS.Staging = {
    isGenerative: isGenerative,
    segmentAt: segmentAt,
    refreshTiming: refreshTiming,
    columnVisible: columnVisible,
  };
})(window);

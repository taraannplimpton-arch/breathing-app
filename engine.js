(function (root) {
  const BREATHING =
    root.BREATHING ||
    (typeof require === "function" ? require("./protocols.js") : null);
  const { SESSION_MS, MIN_SCALE, MAX_SCALE } = BREATHING;

  const FORESHADOW_MS = 500;
  const RESTING_SCALE = (MIN_SCALE + MAX_SCALE) / 2;
  const START_GLIMPSE_MS = 4200;
  const GLIMPSE_MS = 3800;
  const END_REMAINING_MS = 30000;

  const PREF_KEYS = {
    alwaysTimer: "breathe.alwaysTimer",
    audio: "breathe.audio",
    haptics: "breathe.haptics",
    duration: "breathe.duration",
    bodySetup: "breathe.bodySetup",
    hum: "breathe.hum",
  };

  const HUM_INHALE_HZ = 174.61;
  const HUM_EXHALE_HZ = 123.47;

  function cycleMs(pattern) {
    return pattern.phases.reduce(function (sum, phase) {
      return sum + phase.seconds * 1000;
    }, 0);
  }

  function effectiveMinutes(pattern, selectedMinutes) {
    const requested = Number(selectedMinutes);
    if (!pattern || pattern.maxMinutes == null) {
      return requested;
    }
    const cap = Number(pattern.maxMinutes);
    if (!(cap > 0)) {
      return requested;
    }
    return Math.min(requested, cap);
  }

  function easeSeconds(seconds, phaseId, level) {
    const steps = Math.max(0, Number(level) || 0);
    const floor = phaseId === "inhale2" ? 1 : 2;
    return Math.max(floor, seconds - steps);
  }

  function easePhases(pattern, level) {
    const steps = Math.max(0, Math.min(2, Number(level) || 0));
    const phases = pattern.phases.map(function (phase) {
      return {
        id: phase.id,
        seconds: easeSeconds(phase.seconds, phase.id, steps),
      };
    });
    const clone = {};
    for (const key in pattern) {
      if (Object.prototype.hasOwnProperty.call(pattern, key)) {
        clone[key] = pattern[key];
      }
    }
    clone.phases = phases;
    return clone;
  }

  function dropCountAfterMs(pattern) {
    if (!pattern || !pattern.dropCountAfterCycles) {
      return null;
    }
    return pattern.dropCountAfterCycles * cycleMs(pattern);
  }

  function urgeBreatheMs(urge) {
    const spec = urge || BREATHING.URGE;
    const breaths = Number(spec.breaths) || 0;
    return breaths * cycleMs(spec.pattern);
  }

  function urgeBreathLabel(completedCycles, wrap) {
    const mod = Number(wrap) > 0 ? Number(wrap) : 10;
    const n = ((Number(completedCycles) || 0) % mod + mod) % mod;
    return String(n + 1);
  }

  function urgeWaveLevel(elapsedMs, opts) {
    const riseMs = opts && opts.riseMs != null ? Number(opts.riseMs) : 60000;
    const durationMs = opts && opts.durationMs != null ? Number(opts.durationMs) : 150000;
    const duration = durationMs > 0 ? durationMs : 0;
    const rise = riseMs > 0 ? riseMs : 0;
    let t = Number(elapsedMs) || 0;
    if (t < 0) {
      t = 0;
    }
    if (t > duration) {
      t = duration;
    }
    if (!(duration > 0)) {
      return 0;
    }
    if (t <= rise) {
      return rise ? easeInOut(t / rise) : 1;
    }
    const fall = duration - rise;
    if (!(fall > 0)) {
      return 0;
    }
    return easeInOut(1 - (t - rise) / fall);
  }

  function previousPhase(pattern, index) {
    return pattern.phases[(index - 1 + pattern.phases.length) % pattern.phases.length];
  }

  function nextPhase(pattern, index) {
    return pattern.phases[(index + 1) % pattern.phases.length];
  }

  function isInhalePhase(phase) {
    return Boolean(phase) && /^inhale/.test(phase.id);
  }

  function isExhalePhase(phase) {
    return Boolean(phase) && phase.id === "exhale";
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function formatTime(remainingMs) {
    const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    return minutes + ":" + String(seconds).padStart(2, "0");
  }

  function inhaleRun(pattern, index) {
    const phases = pattern.phases;
    let start = index;
    while (start > 0 && isInhalePhase(phases[start - 1])) {
      start -= 1;
    }
    let end = index;
    while (end < phases.length - 1 && isInhalePhase(phases[end + 1])) {
      end += 1;
    }
    let offset = 0;
    let total = 0;
    for (let i = start; i <= end; i += 1) {
      const duration = phases[i].seconds * 1000;
      if (i < index) {
        offset += duration;
      }
      total += duration;
    }
    return { start: start, end: end, offset: offset, total: total };
  }

  function phaseAt(pattern, elapsedMs) {
    const cycle = cycleMs(pattern);
    const t = ((elapsedMs % cycle) + cycle) % cycle;
    let acc = 0;
    for (let i = 0; i < pattern.phases.length; i += 1) {
      const phase = pattern.phases[i];
      const duration = phase.seconds * 1000;
      if (t < acc + duration) {
        const progress = duration ? (t - acc) / duration : 1;
        const remainingMs = duration - (t - acc);
        let inhaleOverallProgress = null;
        if (isInhalePhase(phase)) {
          const run = inhaleRun(pattern, i);
          inhaleOverallProgress = run.total ? (run.offset + (t - acc)) / run.total : progress;
        }
        return {
          phase: phase,
          index: i,
          progress: progress,
          previous: previousPhase(pattern, i),
          next: nextPhase(pattern, i),
          remainingMs: remainingMs,
          inhaleOverallProgress: inhaleOverallProgress,
          pattern: pattern,
        };
      }
      acc += duration;
    }
    const lastIndex = pattern.phases.length - 1;
    const last = pattern.phases[lastIndex];
    let inhaleOverallProgress = null;
    if (isInhalePhase(last)) {
      inhaleOverallProgress = 1;
    }
    return {
      phase: last,
      index: lastIndex,
      progress: 1,
      previous: previousPhase(pattern, lastIndex),
      next: nextPhase(pattern, lastIndex),
      remainingMs: 0,
      inhaleOverallProgress: inhaleOverallProgress,
      pattern: pattern,
    };
  }

  function scaleFor(snapshot, options) {
    if (options && options.reducedMotion) {
      return RESTING_SCALE;
    }
    const phase = snapshot.phase;
    if (isInhalePhase(phase)) {
      let t = snapshot.inhaleOverallProgress;
      if (t == null) {
        t = snapshot.progress;
      }
      return lerp(MIN_SCALE, MAX_SCALE, easeInOut(t));
    }
    if (isExhalePhase(phase)) {
      return lerp(MAX_SCALE, MIN_SCALE, easeInOut(snapshot.progress));
    }
    return snapshot.previous && isExhalePhase(snapshot.previous) ? MIN_SCALE : MAX_SCALE;
  }

  function opacityFor(snapshot, options) {
    if (!options || !options.reducedMotion) {
      return 1;
    }
    if (isInhalePhase(snapshot.phase)) {
      const t = snapshot.inhaleOverallProgress != null ? snapshot.inhaleOverallProgress : snapshot.progress;
      return lerp(0.48, 1, easeInOut(t));
    }
    if (isExhalePhase(snapshot.phase)) {
      return lerp(1, 0.48, easeInOut(snapshot.progress));
    }
    return snapshot.previous && isExhalePhase(snapshot.previous) ? 0.48 : 1;
  }

  function foreshadowActive(snapshot) {
    if (!snapshot || snapshot.progress >= 1) {
      return false;
    }
    let remaining = snapshot.remainingMs;
    if (remaining == null && snapshot.phase) {
      remaining = snapshot.phase.seconds * 1000 * (1 - snapshot.progress);
    }
    return remaining > 0 && remaining <= FORESHADOW_MS;
  }

  function audioLevel(snapshot) {
    if (isInhalePhase(snapshot.phase)) {
      const t = snapshot.inhaleOverallProgress != null ? snapshot.inhaleOverallProgress : snapshot.progress;
      return lerp(0.012, 0.055, easeInOut(t));
    }
    if (isExhalePhase(snapshot.phase)) {
      return lerp(0.055, 0.01, easeInOut(snapshot.progress));
    }
    return snapshot.previous && isExhalePhase(snapshot.previous) ? 0.01 : 0.055;
  }

  function createSessionClock(sessionMs) {
    const duration = sessionMs == null ? SESSION_MS : sessionMs;
    let running = false;
    let paused = false;
    let completed = false;
    let startAt = 0;
    let pauseAt = 0;
    let pausedTotal = 0;

    function elapsed(now) {
      if (completed) {
        return duration;
      }
      if (!running) {
        return 0;
      }
      const end = paused ? pauseAt : now;
      // Wall timestamps minus pause gaps — never a summed frame delta.
      return Math.max(0, Math.min(duration, end - startAt - pausedTotal));
    }

    return {
      start: function (now) {
        running = true;
        paused = false;
        completed = false;
        startAt = now;
        pauseAt = 0;
        pausedTotal = 0;
      },
      pause: function (now) {
        if (!running || paused || completed) {
          return;
        }
        paused = true;
        pauseAt = now;
      },
      resume: function (now) {
        if (!running || !paused) {
          return;
        }
        pausedTotal += now - pauseAt;
        paused = false;
        pauseAt = 0;
      },
      stop: function () {
        running = false;
        paused = false;
        completed = false;
        startAt = 0;
        pauseAt = 0;
        pausedTotal = 0;
      },
      complete: function () {
        running = false;
        paused = false;
        completed = true;
      },
      seek: function (elapsedMs, now) {
        if (!running && !completed) {
          this.start(now);
        }
        const clamped = Math.max(0, Math.min(duration, elapsedMs));
        if (paused) {
          pauseAt = now;
          startAt = now - clamped - pausedTotal;
        } else {
          startAt = now - clamped - pausedTotal;
        }
      },
      elapsed: elapsed,
      remaining: function (now) {
        return Math.max(0, duration - elapsed(now));
      },
      isRunning: function () {
        return running;
      },
      isPaused: function () {
        return paused;
      },
      isCompleted: function () {
        return completed;
      },
      sessionMs: duration,
    };
  }

  function placeMidPoints(midCount, zoneStart, zoneEnd, minGap, rand) {
    const points = [];
    const span = Math.max(0, zoneEnd - zoneStart);
    for (let i = 0; i < midCount; i += 1) {
      points.push(zoneStart + rand() * span);
    }
    points.sort(function (a, b) {
      return a - b;
    });
    for (let i = 1; i < points.length; i += 1) {
      if (points[i] < points[i - 1] + minGap) {
        points[i] = points[i - 1] + minGap;
      }
    }
    if (points.length && points[points.length - 1] > zoneEnd) {
      let cursor = zoneEnd;
      for (let i = points.length - 1; i >= 0; i -= 1) {
        points[i] = Math.min(points[i], cursor);
        cursor = points[i] - minGap;
      }
    }
    return points;
  }

  function planGlimpses(sessionMs, random) {
    const duration = sessionMs == null ? SESSION_MS : sessionMs;
    const rand = typeof random === "function" ? random : Math.random;
    const windows = [];
    windows.push({ type: "start", start: 0, end: Math.min(START_GLIMPSE_MS, duration) });

    const longSession = duration >= 4 * 60 * 1000;
    const midCount = longSession
      ? rand() < 0.5
        ? 2
        : 3
      : duration >= 90 * 1000
        ? rand() < 0.5
          ? 1
          : 2
        : rand() < 0.4
          ? 0
          : 1;

    const zoneStart = longSession
      ? 22000
      : Math.max(windows[0].end + 1200, Math.round(duration * 0.18));
    const minGap = longSession ? 28000 : Math.max(8000, Math.round(duration * 0.16));
    const endRemaining = longSession
      ? END_REMAINING_MS
      : Math.max(6000, Math.round(duration * 0.12));
    const endStart = Math.max(windows[0].end + 400, duration - endRemaining - 800);
    const zoneEnd = longSession
      ? Math.max(zoneStart + 40000, duration - 52000)
      : Math.max(zoneStart, endStart - 800);

    placeMidPoints(midCount, zoneStart, zoneEnd, minGap, rand).forEach(function (point) {
      const start = Math.max(zoneStart, point);
      const end = start + GLIMPSE_MS;
      if (start < 0 || end > duration || start >= endStart) {
        return;
      }
      windows.push({ type: "mid", start: start, end: end });
    });

    windows.push({
      type: "end",
      start: endStart,
      end: Math.min(duration, endStart + GLIMPSE_MS),
    });

    return { windows: windows, midCount: midCount };
  }

  function isCountdownVisible(elapsedMs, schedule, alwaysShow) {
    if (alwaysShow) {
      return true;
    }
    if (!schedule) {
      return false;
    }
    const windows = schedule.windows || schedule;
    return windows.some(function (window) {
      return elapsedMs >= window.start && elapsedMs < window.end;
    });
  }

  const CARDS_KEY = "breathe.cards";
  const CARD_PREF_IDS = Object.freeze(["rest", "energy", "hrv", "focus", "sleep", "urge"]);
  const CARD_DURATIONS = BREATHING.DURATION_MINUTES || [1, 2, 5, 10];

  function humAllowed(cardId) {
    return cardId === "rest" || cardId === "sleep";
  }

  function cardPrefDefaults() {
    return {
      alwaysTimer: false,
      audio: false,
      haptics: false,
      bodySetup: true,
      hum: false,
      duration: 5,
    };
  }

  function storageSnapshot(store) {
    const snapshot = {};
    if (!store || typeof store !== "object") {
      return snapshot;
    }
    Object.keys(store).forEach(function (key) {
      if (store[key] !== undefined) {
        snapshot[key] = store[key];
      }
    });
    return snapshot;
  }

  function asBool(value, fallback) {
    if (value === true || value === false) {
      return value;
    }
    if (value === 1 || value === "1" || value === "true") {
      return true;
    }
    if (value === 0 || value === "0" || value === "false") {
      return false;
    }
    return fallback;
  }

  function asDuration(value, fallback) {
    const minutes = Number(value);
    if (CARD_DURATIONS.indexOf(minutes) !== -1) {
      return minutes;
    }
    const base = Number(fallback);
    if (CARD_DURATIONS.indexOf(base) !== -1) {
      return base;
    }
    return 5;
  }

  function normalizeCardPref(input, fallback) {
    const base = fallback || cardPrefDefaults();
    const src = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const durationGiven =
      Object.prototype.hasOwnProperty.call(src, "duration") && src.duration != null && src.duration !== "";
    return {
      alwaysTimer: asBool(src.alwaysTimer, base.alwaysTimer),
      audio: asBool(src.audio, base.audio),
      haptics: asBool(src.haptics, base.haptics),
      bodySetup: asBool(src.bodySetup, base.bodySetup),
      hum: asBool(src.hum, base.hum),
      duration: durationGiven ? asDuration(src.duration, base.duration) : asDuration(base.duration, 5),
    };
  }

  function legacyCardDefaults(snapshot) {
    const defaults = cardPrefDefaults();
    if (Object.prototype.hasOwnProperty.call(snapshot, PREF_KEYS.alwaysTimer)) {
      defaults.alwaysTimer = asBool(snapshot[PREF_KEYS.alwaysTimer], defaults.alwaysTimer);
    }
    if (Object.prototype.hasOwnProperty.call(snapshot, PREF_KEYS.audio)) {
      defaults.audio = asBool(snapshot[PREF_KEYS.audio], defaults.audio);
    }
    if (Object.prototype.hasOwnProperty.call(snapshot, PREF_KEYS.haptics)) {
      defaults.haptics = asBool(snapshot[PREF_KEYS.haptics], defaults.haptics);
    }
    if (Object.prototype.hasOwnProperty.call(snapshot, PREF_KEYS.bodySetup)) {
      defaults.bodySetup = asBool(snapshot[PREF_KEYS.bodySetup], defaults.bodySetup);
    }
    if (Object.prototype.hasOwnProperty.call(snapshot, PREF_KEYS.hum)) {
      defaults.hum = asBool(snapshot[PREF_KEYS.hum], defaults.hum);
    }
    if (Object.prototype.hasOwnProperty.call(snapshot, PREF_KEYS.duration)) {
      defaults.duration = asDuration(snapshot[PREF_KEYS.duration], defaults.duration);
    }
    return defaults;
  }

  function cardsFromDefaults(defaults) {
    const base = normalizeCardPref(defaults, cardPrefDefaults());
    const cards = {};
    CARD_PREF_IDS.forEach(function (id) {
      cards[id] = normalizeCardPref(base, cardPrefDefaults());
    });
    return cards;
  }

  function parseCardBlob(raw) {
    if (raw == null) {
      return null;
    }
    if (typeof raw === "string" && raw.trim() === "") {
      return null;
    }
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
      }
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function loadCardPrefs(store) {
    const snapshot = storageSnapshot(store);
    const defaults = legacyCardDefaults(snapshot);
    const parsed = parseCardBlob(snapshot[CARDS_KEY]);
    const cards = cardsFromDefaults(defaults);
    if (!parsed) {
      return { cards: cards, migrated: true, defaults: normalizeCardPref(defaults) };
    }
    CARD_PREF_IDS.forEach(function (id) {
      const record = parsed[id];
      if (record && typeof record === "object" && !Array.isArray(record)) {
        cards[id] = normalizeCardPref(record, defaults);
      }
    });
    return { cards: cards, migrated: false, defaults: normalizeCardPref(defaults) };
  }

  function cardPref(cards, id) {
    const record = cards && cards[id];
    if (!record || typeof record !== "object") {
      return cardPrefDefaults();
    }
    return normalizeCardPref(record, cardPrefDefaults());
  }

  function updateCardPrefs(cards, id, patch) {
    const next = {};
    CARD_PREF_IDS.forEach(function (cardId) {
      next[cardId] = normalizeCardPref(cards && cards[cardId], cardPrefDefaults());
    });
    if (CARD_PREF_IDS.indexOf(id) === -1) {
      return next;
    }
    const current = next[id];
    const merged = {
      alwaysTimer: current.alwaysTimer,
      audio: current.audio,
      haptics: current.haptics,
      bodySetup: current.bodySetup,
      hum: current.hum,
      duration: current.duration,
    };
    const src = patch && typeof patch === "object" ? patch : {};
    Object.keys(merged).forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(src, key) && src[key] !== undefined) {
        merged[key] = src[key];
      }
    });
    next[id] = normalizeCardPref(merged, current);
    return next;
  }

  function serializeCardPrefs(cards) {
    const normalized = {};
    CARD_PREF_IDS.forEach(function (id) {
      normalized[id] = normalizeCardPref(cards && cards[id], cardPrefDefaults());
    });
    return JSON.stringify(normalized);
  }

  function resetCardPrefs(store) {
    const snapshot = storageSnapshot(store);
    const removedKeys = Object.keys(snapshot).filter(function (key) {
      return key.indexOf("breathe.") === 0;
    });
    return {
      removedKeys: removedKeys,
      cards: cardsFromDefaults(cardPrefDefaults()),
    };
  }

  const engine = {
    SESSION_MS: SESSION_MS,
    MIN_SCALE: MIN_SCALE,
    MAX_SCALE: MAX_SCALE,
    FORESHADOW_MS: FORESHADOW_MS,
    RESTING_SCALE: RESTING_SCALE,
    PREF_KEYS: PREF_KEYS,
    CARDS_KEY: CARDS_KEY,
    CARD_PREF_IDS: CARD_PREF_IDS,
    humAllowed: humAllowed,
    loadCardPrefs: loadCardPrefs,
    cardPref: cardPref,
    updateCardPrefs: updateCardPrefs,
    serializeCardPrefs: serializeCardPrefs,
    resetCardPrefs: resetCardPrefs,
    HUM_INHALE_HZ: HUM_INHALE_HZ,
    HUM_EXHALE_HZ: HUM_EXHALE_HZ,
    cycleMs: cycleMs,
    effectiveMinutes: effectiveMinutes,
    easeSeconds: easeSeconds,
    easePhases: easePhases,
    dropCountAfterMs: dropCountAfterMs,
    urgeBreatheMs: urgeBreatheMs,
    urgeBreathLabel: urgeBreathLabel,
    urgeWaveLevel: urgeWaveLevel,
    phaseAt: phaseAt,
    scaleFor: scaleFor,
    opacityFor: opacityFor,
    formatTime: formatTime,
    isInhalePhase: isInhalePhase,
    isExhalePhase: isExhalePhase,
    foreshadowActive: foreshadowActive,
    audioLevel: audioLevel,
    createSessionClock: createSessionClock,
    planGlimpses: planGlimpses,
    isCountdownVisible: isCountdownVisible,
    easeInOut: easeInOut,
    lerp: lerp,
  };

  root.BREATHING_ENGINE = engine;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = engine;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

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
  };

  function cycleMs(pattern) {
    return pattern.phases.reduce(function (sum, phase) {
      return sum + phase.seconds * 1000;
    }, 0);
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

  function planGlimpses(sessionMs, random) {
    const duration = sessionMs == null ? SESSION_MS : sessionMs;
    const rand = typeof random === "function" ? random : Math.random;
    const windows = [];
    windows.push({ type: "start", start: 0, end: START_GLIMPSE_MS });

    const midCount = rand() < 0.5 ? 2 : 3;
    const zoneStart = 22000;
    const zoneEnd = Math.max(zoneStart + 40000, duration - 52000);
    const minGap = 28000;
    const points = [];
    for (let i = 0; i < midCount; i += 1) {
      points.push(zoneStart + rand() * Math.max(0, zoneEnd - zoneStart));
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
    points.forEach(function (point) {
      const start = Math.max(zoneStart, point);
      windows.push({ type: "mid", start: start, end: start + GLIMPSE_MS });
    });

    const endStart = duration - END_REMAINING_MS - 800;
    windows.push({ type: "end", start: endStart, end: endStart + GLIMPSE_MS });

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

  const engine = {
    SESSION_MS: SESSION_MS,
    MIN_SCALE: MIN_SCALE,
    MAX_SCALE: MAX_SCALE,
    FORESHADOW_MS: FORESHADOW_MS,
    RESTING_SCALE: RESTING_SCALE,
    PREF_KEYS: PREF_KEYS,
    cycleMs: cycleMs,
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

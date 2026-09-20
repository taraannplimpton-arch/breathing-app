(function () {
  "use strict";

  const { SESSION_MS, MIN_SCALE, PATTERNS, DURATION_MINUTES } = window.BREATHING;
  const ALLOWED_MINUTES = DURATION_MINUTES || [1, 2, 5, 10];
  const DURATION_WORDS = {
    1: "one minute",
    2: "two minutes",
    5: "five minutes",
    10: "ten minutes",
  };
  const engine = window.BREATHING_ENGINE;
  const {
    phaseAt,
    scaleFor,
    opacityFor,
    formatTime,
    foreshadowActive,
    audioLevel,
    createSessionClock,
    planGlimpses,
    isCountdownVisible,
    PREF_KEYS,
  } = engine;

  const PATTERN_ORDER = ["rest", "energy", "hrv", "focus"];

  const homeEl = document.getElementById("home");
  const sessionEl = document.getElementById("session");
  const patternsEl = document.getElementById("patterns");
  const startEl = document.getElementById("start");
  const countdownEl = document.getElementById("countdown");
  const bubbleEl = document.getElementById("bubble");
  const haloEl = document.getElementById("halo");
  const pauseBtn = document.getElementById("pause-btn");
  const endBtn = document.getElementById("end-btn");
  const techniqueEl = document.getElementById("technique");
  const whisperEl = document.getElementById("whisper");
  const taglineEl = document.getElementById("tagline");
  const durationsEl = document.getElementById("durations");
  const prefTimerEl = document.getElementById("pref-timer");
  const prefAudioEl = document.getElementById("pref-audio");
  const prefHapticsEl = document.getElementById("pref-haptics");

  let clock = createSessionClock(SESSION_MS);
  const prefs = {
    alwaysTimer: false,
    audio: false,
    haptics: false,
  };

  let selectedId = "rest";
  let selectedMinutes = 5;
  let rafId = 0;
  let completing = false;
  let glimpseSchedule = null;
  let lastPhaseKey = "";
  let reducedMotion = false;
  let whisperTimer = 0;

  let audioCtx = null;
  let gainNode = null;
  let oscNode = null;

  function currentPattern() {
    return PATTERNS[selectedId];
  }

  function readPref(key) {
    try {
      const value = window.localStorage.getItem(key);
      return value === "1" || value === "true";
    } catch (err) {
      return false;
    }
  }

  function writePref(key, value) {
    try {
      window.localStorage.setItem(key, value ? "1" : "0");
    } catch (err) {
      /* private mode */
    }
  }

  function selectedSessionMs() {
    return selectedMinutes * 60 * 1000;
  }

  function readDurationMinutes() {
    try {
      const raw = window.localStorage.getItem(PREF_KEYS.duration);
      const minutes = Number(raw);
      if (ALLOWED_MINUTES.indexOf(minutes) !== -1) {
        return minutes;
      }
    } catch (err) {
      /* private mode */
    }
    return 5;
  }

  function writeDurationMinutes(minutes) {
    try {
      window.localStorage.setItem(PREF_KEYS.duration, String(minutes));
    } catch (err) {
      /* private mode */
    }
  }

  function syncDurationUi() {
    const buttons = durationsEl ? durationsEl.querySelectorAll("[data-minutes]") : [];
    Array.prototype.forEach.call(buttons, function (button) {
      const minutes = Number(button.getAttribute("data-minutes"));
      const on = minutes === selectedMinutes;
      button.classList.toggle("is-selected", on);
      button.setAttribute("aria-checked", on ? "true" : "false");
    });
    if (taglineEl) {
      taglineEl.textContent = DURATION_WORDS[selectedMinutes] || "five minutes";
    }
    if (!clock.isRunning() && !clock.isPaused() && !completing) {
      countdownEl.textContent = formatTime(selectedSessionMs());
    }
  }

  function loadPrefs() {
    prefs.alwaysTimer = readPref(PREF_KEYS.alwaysTimer);
    prefs.audio = readPref(PREF_KEYS.audio);
    prefs.haptics = readPref(PREF_KEYS.haptics);
    selectedMinutes = readDurationMinutes();
    prefTimerEl.checked = prefs.alwaysTimer;
    prefAudioEl.checked = prefs.audio;
    prefHapticsEl.checked = prefs.haptics;
    syncDurationUi();
  }

  function motionQuery() {
    if (typeof window.matchMedia !== "function") {
      return { matches: false, addEventListener: function () {}, addListener: function () {} };
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)");
  }

  function syncReducedMotion(matches) {
    reducedMotion = Boolean(matches);
    document.body.classList.toggle("reduce-motion", reducedMotion);
  }

  function applyVisuals(pattern, snapshot, scale) {
    const colors = pattern.colors[snapshot.phase.id] || pattern.colors.inhale;
    const opacity = opacityFor(snapshot, { reducedMotion: reducedMotion });
    const foreshadow = !clock.isPaused() && foreshadowActive(snapshot);
    document.documentElement.style.setProperty("--scale", String(scale));
    document.documentElement.style.setProperty("--bubble-fill", colors.fill);
    document.documentElement.style.setProperty("--bubble-glow", colors.glow);
    document.documentElement.style.setProperty("--atmosphere", colors.atmosphere);
    document.documentElement.style.setProperty("--bubble-opacity", String(opacity));
    bubbleEl.dataset.phase = snapshot.phase.id;
    bubbleEl.dataset.pattern = pattern.id;
    document.body.dataset.pattern = pattern.id;
    document.body.dataset.mood = pattern.mood || "steady";
    document.body.classList.toggle("is-foreshadow", foreshadow);
    if (haloEl) {
      haloEl.classList.toggle("is-foreshadow", foreshadow);
    }
    bubbleEl.classList.toggle("is-foreshadow", foreshadow);
  }

  function previewHomeAtmosphere() {
    const pattern = currentPattern();
    document.documentElement.style.setProperty("--atmosphere", pattern.colors.inhale.atmosphere);
    document.documentElement.style.setProperty("--bubble-fill", pattern.colors.inhale.fill);
    document.documentElement.style.setProperty("--bubble-glow", pattern.colors.inhale.glow);
    document.documentElement.style.setProperty("--scale", String(MIN_SCALE));
    document.documentElement.style.setProperty("--bubble-opacity", "1");
    document.body.dataset.pattern = pattern.id;
    document.body.dataset.mood = pattern.mood || "steady";
    techniqueEl.textContent = pattern.technique || "";
  }

  function updateCountdown(elapsed, remaining) {
    countdownEl.textContent = formatTime(remaining);
    const show =
      completing ||
      isCountdownVisible(elapsed, glimpseSchedule, prefs.alwaysTimer);
    countdownEl.classList.toggle("is-on", show);
  }

  function cancelFrame() {
    window.cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function renderHome() {
    patternsEl.replaceChildren();
    PATTERN_ORDER.forEach(function (id) {
      const pattern = PATTERNS[id];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pattern" + (id === selectedId ? " is-selected" : "");
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", id === selectedId ? "true" : "false");
      button.dataset.pattern = id;
      button.style.setProperty("--accent", pattern.colors.inhale.fill);

      const orb = document.createElement("span");
      orb.className = "orb";
      orb.setAttribute("aria-hidden", "true");

      const copy = document.createElement("span");
      copy.className = "pattern-copy";

      const label = document.createElement("span");
      label.className = "pattern-label";
      label.textContent = pattern.homeLabel;

      const protocol = document.createElement("span");
      protocol.className = "pattern-protocol";
      protocol.textContent = pattern.protocol;

      copy.append(label, protocol);
      button.append(orb, copy);
      button.addEventListener("click", function () {
        selectedId = id;
        renderHome();
        previewHomeAtmosphere();
      });
      patternsEl.append(button);
    });
    previewHomeAtmosphere();
  }

  function hideWhisper() {
    window.clearTimeout(whisperTimer);
    whisperEl.hidden = true;
    whisperEl.textContent = "";
  }

  function showWhisper(elapsedMs) {
    window.clearTimeout(whisperTimer);
    whisperEl.hidden = false;
    whisperEl.textContent = formatTime(elapsedMs);
    whisperTimer = window.setTimeout(hideWhisper, 4800);
  }

  function stopAudio() {
    if (gainNode && audioCtx) {
      try {
        gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      } catch (err) {
        /* closed */
      }
    }
    if (oscNode) {
      try {
        oscNode.stop();
      } catch (err) {
        /* already stopped */
      }
      oscNode = null;
    }
    if (audioCtx) {
      const ctx = audioCtx;
      audioCtx = null;
      gainNode = null;
      try {
        ctx.close();
      } catch (err) {
        /* ignore */
      }
    }
  }

  function muteAudio() {
    if (gainNode && audioCtx) {
      try {
        gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
        gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.04);
      } catch (err) {
        /* ignore */
      }
    }
  }

  function startAudio() {
    if (!prefs.audio) {
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      return;
    }
    if (!audioCtx) {
      audioCtx = new Ctx();
      oscNode = audioCtx.createOscillator();
      oscNode.type = "sine";
      oscNode.frequency.value = 174.61;
      gainNode = audioCtx.createGain();
      gainNode.gain.value = 0;
      oscNode.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscNode.start();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  function updateAudio(snapshot) {
    if (!prefs.audio || !gainNode || !audioCtx || clock.isPaused() || completing) {
      return;
    }
    const level = audioLevel(snapshot);
    try {
      gainNode.gain.setTargetAtTime(level, audioCtx.currentTime, 0.12);
    } catch (err) {
      /* ignore */
    }
  }

  function maybeHaptic(snapshot) {
    const key = snapshot.index + ":" + snapshot.phase.id;
    if (key === lastPhaseKey) {
      return;
    }
    const first = lastPhaseKey === "";
    lastPhaseKey = key;
    if (first || clock.isPaused() || completing || !prefs.haptics) {
      return;
    }
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(12);
    }
  }

  function paint(now) {
    const pattern = currentPattern();
    const limit = clock.sessionMs;
    const elapsed = completing ? limit : clock.elapsed(now);
    const remaining = completing ? 0 : clock.remaining(now);
    const snapshot = phaseAt(pattern, Math.min(elapsed, Math.max(0, limit - 1)));
    const scale = completing
      ? MIN_SCALE
      : scaleFor(snapshot, { reducedMotion: reducedMotion });
    applyVisuals(pattern, snapshot, scale);
    updateCountdown(elapsed, remaining);
    if (!clock.isPaused() && !completing) {
      updateAudio(snapshot);
      maybeHaptic(snapshot);
    }
  }

  function frame(now) {
    if (!clock.isRunning() || clock.isPaused()) {
      return;
    }
    if (clock.remaining(now) <= 0) {
      finishSession();
      return;
    }
    paint(now);
    rafId = window.requestAnimationFrame(frame);
  }

  function showHome(opts) {
    const endedMs = opts && opts.sessionMs != null ? opts.sessionMs : clock.sessionMs;
    completing = false;
    clock.stop();
    cancelFrame();
    stopAudio();
    lastPhaseKey = "";
    glimpseSchedule = null;
    document.body.classList.remove("is-session", "is-complete", "is-paused", "is-foreshadow");
    pauseBtn.textContent = "Pause";
    pauseBtn.setAttribute("aria-pressed", "false");
    sessionEl.hidden = true;
    sessionEl.classList.add("is-hidden");
    homeEl.hidden = false;
    homeEl.classList.remove("is-hidden");
    countdownEl.textContent = formatTime(selectedSessionMs());
    countdownEl.classList.remove("is-on");
    delete bubbleEl.dataset.phase;
    delete bubbleEl.dataset.pattern;
    const elapsedMs = opts && opts.elapsedMs;
    if (elapsedMs > 1200 && elapsedMs < endedMs - 400) {
      showWhisper(elapsedMs);
    } else {
      hideWhisper();
    }
    previewHomeAtmosphere();
  }

  function showSession() {
    homeEl.hidden = true;
    homeEl.classList.add("is-hidden");
    sessionEl.hidden = false;
    sessionEl.classList.remove("is-hidden");
    document.body.classList.add("is-session");
    document.body.classList.remove("is-complete", "is-paused");
    hideWhisper();
  }

  function finishSession() {
    if (completing) {
      return;
    }
    completing = true;
    clock.complete();
    cancelFrame();
    muteAudio();
    stopAudio();
    document.body.classList.add("is-complete");
    document.body.classList.remove("is-paused", "is-foreshadow");
    document.documentElement.style.setProperty("--scale", String(MIN_SCALE));
    countdownEl.textContent = "0:00";
    countdownEl.classList.add("is-on");
  }

  function startLoop() {
    cancelFrame();
    rafId = window.requestAnimationFrame(frame);
  }

  function startSession() {
    completing = false;
    lastPhaseKey = "";
    const ms = selectedSessionMs();
    clock = createSessionClock(ms);
    glimpseSchedule = planGlimpses(ms);
    clock.start(performance.now());
    showSession();
    pauseBtn.textContent = "Pause";
    pauseBtn.setAttribute("aria-pressed", "false");
    startAudio();
    paint(performance.now());
    startLoop();
  }

  function pauseSession() {
    if (!clock.isRunning() || clock.isPaused() || completing) {
      return;
    }
    const now = performance.now();
    clock.pause(now);
    cancelFrame();
    muteAudio();
    document.body.classList.add("is-paused");
    document.body.classList.remove("is-foreshadow");
    pauseBtn.textContent = "Resume";
    pauseBtn.setAttribute("aria-pressed", "true");
    paint(now);
  }

  function resumeSession() {
    if (!clock.isRunning() || !clock.isPaused() || completing) {
      return;
    }
    const now = performance.now();
    clock.resume(now);
    document.body.classList.remove("is-paused");
    pauseBtn.textContent = "Pause";
    pauseBtn.setAttribute("aria-pressed", "false");
    if (prefs.audio && audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    paint(now);
    startLoop();
  }

  function togglePause() {
    if (completing) {
      return;
    }
    if (clock.isPaused()) {
      resumeSession();
    } else {
      pauseSession();
    }
  }

  function endSession() {
    if (completing) {
      showHome();
      return;
    }
    if (!clock.isRunning() && !clock.isPaused()) {
      showHome();
      return;
    }
    const elapsedMs = clock.elapsed(performance.now());
    showHome({ elapsedMs: elapsedMs, sessionMs: clock.sessionMs });
  }

  function sessionText() {
    return sessionEl.innerText.replace(/\s+/g, " ").trim();
  }

  function getState() {
    const now = performance.now();
    const pattern = currentPattern();
    if (!clock.isRunning() && !clock.isPaused() && !completing) {
      return {
        screen: "home",
        patternId: selectedId,
        remainingMs: selectedSessionMs(),
        durationMinutes: selectedMinutes,
        phaseId: null,
        scale: MIN_SCALE,
        paused: false,
        technique: techniqueEl.textContent,
        whisper: whisperEl.textContent,
      };
    }
    const limit = clock.sessionMs;
    const elapsed = completing ? limit : clock.elapsed(now);
    const remaining = completing ? 0 : clock.remaining(now);
    const snapshot = phaseAt(pattern, Math.min(elapsed, Math.max(0, limit - 1)));
    return {
      screen: completing ? "complete" : "session",
      patternId: selectedId,
      remainingMs: remaining,
      phaseId: snapshot.phase.id,
      scale: completing ? MIN_SCALE : scaleFor(snapshot, { reducedMotion: reducedMotion }),
      paused: clock.isPaused(),
      countdown: countdownEl.textContent,
      countdownVisible: countdownEl.classList.contains("is-on"),
      foreshadow: foreshadowActive(snapshot),
      sessionText: sessionText(),
      technique: techniqueEl.textContent,
      durationMinutes: selectedMinutes,
    };
  }

  startEl.addEventListener("click", startSession);
  pauseBtn.addEventListener("click", function (event) {
    event.stopPropagation();
    togglePause();
  });
  endBtn.addEventListener("click", function (event) {
    event.stopPropagation();
    endSession();
  });
  sessionEl.addEventListener("click", function () {
    if (completing) {
      showHome();
    }
  });

  if (durationsEl) {
    durationsEl.addEventListener("click", function (event) {
      const button = event.target.closest("[data-minutes]");
      if (!button || clock.isRunning() || clock.isPaused() || completing) {
        return;
      }
      const minutes = Number(button.getAttribute("data-minutes"));
      if (ALLOWED_MINUTES.indexOf(minutes) === -1) {
        return;
      }
      selectedMinutes = minutes;
      writeDurationMinutes(minutes);
      syncDurationUi();
    });
  }

  prefTimerEl.addEventListener("change", function () {
    prefs.alwaysTimer = prefTimerEl.checked;
    writePref(PREF_KEYS.alwaysTimer, prefs.alwaysTimer);
  });
  prefAudioEl.addEventListener("change", function () {
    prefs.audio = prefAudioEl.checked;
    writePref(PREF_KEYS.audio, prefs.audio);
  });
  prefHapticsEl.addEventListener("change", function () {
    prefs.haptics = prefHapticsEl.checked;
    writePref(PREF_KEYS.haptics, prefs.haptics);
  });

  document.addEventListener("keydown", function (event) {
    const key = event.key;
    const inSession = clock.isRunning() || clock.isPaused() || completing;

    if (key === "Escape") {
      if (inSession) {
        endSession();
      }
      return;
    }

    if (key === " " || key === "Spacebar") {
      if (inSession) {
        event.preventDefault();
        if (completing) {
          showHome();
        } else if (event.target !== pauseBtn && event.target !== endBtn) {
          togglePause();
        }
      }
      return;
    }

    if (completing && (key === "Enter" || key === "Home")) {
      showHome();
      return;
    }

    if (inSession) {
      return;
    }

    const index = Number(key) - 1;
    if (index >= 0 && index < PATTERN_ORDER.length) {
      selectedId = PATTERN_ORDER[index];
      renderHome();
    }
    if (key === "Enter") {
      startSession();
    }
  });

  window.__breathing = {
    getState: getState,
    start: function (id) {
      if (PATTERNS[id]) {
        selectedId = id;
        renderHome();
      }
      startSession();
    },
    home: showHome,
    pause: pauseSession,
    resume: resumeSession,
    end: endSession,
    seek: function (elapsedMs) {
      if (!clock.isRunning() && !completing) {
        startSession();
      }
      clock.seek(elapsedMs, performance.now());
      paint(performance.now());
    },
    SESSION_MS: SESSION_MS,
    durationMinutes: function () {
      return selectedMinutes;
    },
    setDurationMinutes: function (minutes) {
      if (ALLOWED_MINUTES.indexOf(minutes) === -1) {
        return;
      }
      selectedMinutes = minutes;
      writeDurationMinutes(minutes);
      syncDurationUi();
    },
    PATTERNS: PATTERNS,
    engine: engine,
    prefs: prefs,
  };

  const mq = motionQuery();
  syncReducedMotion(mq.matches);
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", function (event) {
      syncReducedMotion(event.matches);
    });
  } else if (typeof mq.addListener === "function") {
    mq.addListener(function (event) {
      syncReducedMotion(event.matches);
    });
  }

  if ("serviceWorker" in navigator && /^https?:$/.test(window.location.protocol)) {
    navigator.serviceWorker.register("sw.js").catch(function () {
      /* offline or file protocol */
    });
  }

  loadPrefs();
  renderHome();
})();

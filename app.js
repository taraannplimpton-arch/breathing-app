(function () {
  "use strict";

  const { SESSION_MS, MIN_SCALE, PATTERNS, DURATION_MINUTES, QUICK_RESET_CYCLES } = window.BREATHING;
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
    cycleMs,
    effectiveMinutes,
    easePhases,
    quickResetMs,
    dropCountAfterMs,
    isExhalePhase,
    HUM_INHALE_HZ,
    HUM_EXHALE_HZ,
  } = engine;

  const PATTERN_ORDER = ["rest", "energy", "hrv", "focus", "sleep"];
  const PREROLL_CUES = ["Feet", "Stack", "Hands", "Jaw", "Eyes", "Exhale"];
  const PREROLL_WORD_MS = 1600;
  const PREROLL_TAIL_MS = 400;
  const NEED_BY_ID = {
    spike: { select: "rest", patterns: ["rest"], quickReset: true },
    fog: { select: "hrv", patterns: ["hrv", "focus"] },
    "low-energy": { select: "energy", patterns: ["energy"] },
    sleep: { select: "sleep", patterns: ["sleep"] },
  };

  const homeEl = document.getElementById("home");
  const sessionEl = document.getElementById("session");
  const prerollEl = document.getElementById("preroll");
  const prerollCueEl = document.getElementById("preroll-cue");
  const patternsEl = document.getElementById("patterns");
  const needsEl = document.getElementById("needs");
  const startEl = document.getElementById("start");
  const quickResetEl = document.getElementById("quick-reset");
  const countdownEl = document.getElementById("countdown");
  const bubbleEl = document.getElementById("bubble");
  const haloEl = document.getElementById("halo");
  const pauseBtn = document.getElementById("pause-btn");
  const endBtn = document.getElementById("end-btn");
  const easeBtn = document.getElementById("ease-btn");
  const nextMoveEl = document.getElementById("next-move");
  const techniqueEl = document.getElementById("technique");
  const whisperEl = document.getElementById("whisper");
  const taglineEl = document.getElementById("tagline");
  const durationsEl = document.getElementById("durations");
  const durationNoteEl = document.getElementById("duration-note");
  const prefTimerEl = document.getElementById("pref-timer");
  const prefAudioEl = document.getElementById("pref-audio");
  const prefHapticsEl = document.getElementById("pref-haptics");
  const prefHapticsLabelEl = document.getElementById("pref-haptics-label");
  const prefBodySetupEl = document.getElementById("pref-body-setup");
  const prefHumEl = document.getElementById("pref-hum");
  const prefHumWrapEl = document.getElementById("pref-hum-wrap");
  const hapticsSupported =
    typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

  let clock = createSessionClock(SESSION_MS);
  const prefs = {
    alwaysTimer: false,
    audio: false,
    haptics: false,
    bodySetup: true,
    hum: false,
  };

  let selectedId = "rest";
  let homeSelectedId = "rest";
  let selectedNeed = null;
  let selectedMinutes = 5;
  let sessionKind = "normal";
  let rafId = 0;
  let completing = false;
  let glimpseSchedule = null;
  let lastPhaseKey = "";
  let reducedMotion = false;
  let whisperTimer = 0;
  let easeLevel = 0;
  let easeApplied = 0;
  let cycleOriginMs = 0;
  let cyclesDone = 0;
  let activePattern = PATTERNS.rest;
  let prerollTimer = 0;
  let prerollIndex = 0;
  let prerollActive = false;

  let audioCtx = null;
  let gainNode = null;
  let oscNode = null;

  function currentPattern() {
    return PATTERNS[selectedId];
  }

  function basePattern() {
    return PATTERNS[selectedId];
  }

  function readPref(key, defaultOn) {
    try {
      const value = window.localStorage.getItem(key);
      if (value == null) {
        return defaultOn === true;
      }
      return value === "1" || value === "true";
    } catch (err) {
      return defaultOn === true;
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
    const minutes = effectiveMinutes(currentPattern(), selectedMinutes);
    return minutes * 60 * 1000;
  }

  function displayMinutes() {
    return effectiveMinutes(currentPattern(), selectedMinutes);
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
    const shown = displayMinutes();
    const energyCapped = currentPattern().id === "energy";
    const buttons = durationsEl ? durationsEl.querySelectorAll("[data-minutes]") : [];
    Array.prototype.forEach.call(buttons, function (button) {
      const minutes = Number(button.getAttribute("data-minutes"));
      const blocked = energyCapped && minutes > 1;
      const on = minutes === shown;
      button.disabled = blocked;
      button.classList.toggle("is-disabled", blocked);
      button.classList.toggle("is-selected", on);
      button.setAttribute("aria-checked", on ? "true" : "false");
      button.setAttribute("aria-disabled", blocked ? "true" : "false");
    });
    if (taglineEl) {
      taglineEl.textContent = DURATION_WORDS[shown] || "five minutes";
    }
    if (durationNoteEl) {
      if (energyCapped) {
        durationNoteEl.hidden = false;
        durationNoteEl.textContent = "Energy is one minute.";
      } else {
        durationNoteEl.hidden = true;
        durationNoteEl.textContent = "";
      }
    }
    if (!clock.isRunning() && !clock.isPaused() && !completing && !prerollActive) {
      countdownEl.textContent = formatTime(selectedSessionMs());
    }
  }

  function techniqueText(pattern) {
    let text = pattern.technique || "";
    if (prefs.hum && (pattern.id === "rest" || pattern.id === "sleep")) {
      text += " Hum softly on the exhale.";
    }
    return text;
  }

  function syncHumPrefUi() {
    if (!prefHumWrapEl) {
      return;
    }
    const allowed = selectedId === "rest" || selectedId === "sleep";
    prefHumWrapEl.hidden = !allowed;
    if (prefHumEl) {
      prefHumEl.disabled = !allowed;
    }
  }

  function applyHapticsAvailability() {
    if (!prefHapticsEl) {
      return;
    }
    if (hapticsSupported) {
      prefHapticsEl.disabled = false;
      return;
    }
    prefs.haptics = false;
    prefHapticsEl.checked = false;
    prefHapticsEl.disabled = true;
    const wrap = prefHapticsEl.closest(".pref");
    if (wrap) {
      wrap.classList.add("is-unavailable");
    }
    if (prefHapticsLabelEl) {
      prefHapticsLabelEl.textContent = "Haptics (not available on this device)";
    }
  }

  function loadPrefs() {
    prefs.alwaysTimer = readPref(PREF_KEYS.alwaysTimer);
    prefs.audio = readPref(PREF_KEYS.audio);
    prefs.haptics = readPref(PREF_KEYS.haptics);
    prefs.bodySetup = readPref(PREF_KEYS.bodySetup, true);
    prefs.hum = readPref(PREF_KEYS.hum);
    selectedMinutes = readDurationMinutes();
    prefTimerEl.checked = prefs.alwaysTimer;
    prefAudioEl.checked = prefs.audio;
    prefHapticsEl.checked = prefs.haptics;
    if (prefBodySetupEl) {
      prefBodySetupEl.checked = prefs.bodySetup;
    }
    if (prefHumEl) {
      prefHumEl.checked = prefs.hum;
    }
    applyHapticsAvailability();
    syncDurationUi();
    syncHumPrefUi();
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
    techniqueEl.textContent = techniqueText(pattern);
    syncHumPrefUi();
    syncDurationUi();
  }

  function patternMatchesNeed(id, need) {
    const spec = NEED_BY_ID[need];
    return Boolean(spec && spec.patterns.indexOf(id) !== -1);
  }

  function syncNeedsUi() {
    if (!needsEl) {
      return;
    }
    const chips = needsEl.querySelectorAll("[data-need]");
    Array.prototype.forEach.call(chips, function (chip) {
      const on = chip.getAttribute("data-need") === selectedNeed;
      chip.classList.toggle("is-selected", on);
      chip.setAttribute("aria-selected", on ? "true" : "false");
    });
    if (quickResetEl) {
      const rest = PATTERNS.rest;
      quickResetEl.style.setProperty("--accent", rest.colors.inhale.fill);
      quickResetEl.classList.toggle("is-suggested", selectedNeed === "spike");
    }
  }

  function updateCountdown(elapsed, remaining) {
    countdownEl.textContent = formatTime(remaining);
    const dropAfter = dropCountAfterMs(basePattern());
    const dropped = dropAfter != null && elapsed >= dropAfter && !prefs.alwaysTimer;
    const show =
      completing ||
      (!dropped && isCountdownVisible(elapsed, glimpseSchedule, prefs.alwaysTimer));
    countdownEl.classList.toggle("is-on", show);
  }

  function hideNextMove() {
    if (!nextMoveEl) {
      return;
    }
    nextMoveEl.hidden = true;
  }

  function showNextMove() {
    if (!nextMoveEl) {
      return;
    }
    nextMoveEl.hidden = false;
  }

  function syncEaseUi() {
    if (!easeBtn) {
      return;
    }
    easeBtn.setAttribute("data-ease", String(easeLevel));
    const maxed = easeLevel >= 2;
    easeBtn.setAttribute("aria-disabled", maxed ? "true" : "false");
  }

  function bumpEase() {
    if (completing || prerollActive) {
      return;
    }
    if (!clock.isRunning() && !clock.isPaused()) {
      return;
    }
    if (easeLevel >= 2) {
      return;
    }
    easeLevel += 1;
    syncEaseUi();
  }

  function applyPendingEase(elapsed) {
    const local = elapsed - cycleOriginMs;
    const cyc = cycleMs(activePattern);
    if (!(cyc > 0) || local < cyc) {
      return;
    }
    const crossed = Math.floor(local / cyc);
    cycleOriginMs += crossed * cyc;
    cyclesDone += crossed;
    if (easeLevel !== easeApplied) {
      activePattern = easePhases(basePattern(), easeLevel);
      easeApplied = easeLevel;
    }
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
      const suggested = selectedNeed && patternMatchesNeed(id, selectedNeed);
      button.type = "button";
      button.className =
        "pattern" +
        (id === selectedId ? " is-selected" : "") +
        (suggested && id !== selectedId ? " is-suggested" : "");
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
        if (selectedNeed && !patternMatchesNeed(id, selectedNeed)) {
          selectedNeed = null;
        }
        renderHome();
        previewHomeAtmosphere();
      });
      patternsEl.append(button);
    });
    syncNeedsUi();
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
      oscNode.frequency.value = HUM_INHALE_HZ || 174.61;
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

  function applyHumTone(snapshot) {
    if (!oscNode || !audioCtx) {
      return;
    }
    const hummable =
      prefs.hum && (activePattern.id === "rest" || activePattern.id === "sleep");
    const humNow = hummable && isExhalePhase(snapshot.phase);
    try {
      if (humNow) {
        oscNode.type = "triangle";
        oscNode.frequency.setTargetAtTime(HUM_EXHALE_HZ, audioCtx.currentTime, 0.08);
      } else {
        oscNode.type = "sine";
        oscNode.frequency.setTargetAtTime(HUM_INHALE_HZ, audioCtx.currentTime, 0.08);
      }
    } catch (err) {
      /* ignore */
    }
  }

  function updateAudio(snapshot) {
    if (!prefs.audio || !gainNode || !audioCtx || clock.isPaused() || completing) {
      return;
    }
    applyHumTone(snapshot);
    const level = audioLevel(snapshot);
    const hummable =
      prefs.hum && (activePattern.id === "rest" || activePattern.id === "sleep");
    const humNow = hummable && isExhalePhase(snapshot.phase);
    const target = humNow ? Math.min(level, 0.04) : level;
    try {
      gainNode.gain.setTargetAtTime(target, audioCtx.currentTime, 0.12);
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
    if (hapticsSupported) {
      navigator.vibrate(12);
    }
  }

  function paint(now) {
    const elapsedRaw = completing ? clock.sessionMs : clock.elapsed(now);
    applyPendingEase(elapsedRaw);
    if (sessionKind === "quick-reset" && cyclesDone >= (QUICK_RESET_CYCLES || 3)) {
      return;
    }
    const pattern = activePattern;
    const limit = clock.sessionMs;
    const elapsed = completing ? limit : clock.elapsed(now);
    const remaining = completing ? 0 : clock.remaining(now);
    const local = Math.max(0, elapsed - cycleOriginMs);
    const snapshot = phaseAt(pattern, Math.min(local, Math.max(0, limit - 1)));
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
    if (
      completing ||
      (sessionKind === "quick-reset" && cyclesDone >= (QUICK_RESET_CYCLES || 3))
    ) {
      if (!completing) {
        finishSession();
      }
      return;
    }
    rafId = window.requestAnimationFrame(frame);
  }

  function clearPreroll() {
    window.clearTimeout(prerollTimer);
    prerollTimer = 0;
    prerollActive = false;
    prerollIndex = 0;
    if (prerollEl) {
      prerollEl.hidden = true;
      prerollEl.classList.add("is-hidden");
    }
    if (prerollCueEl) {
      prerollCueEl.textContent = "";
      prerollCueEl.classList.remove("is-on");
    }
    document.body.classList.remove("is-preroll");
  }

  function showHome(opts) {
    const endedMs = opts && opts.sessionMs != null ? opts.sessionMs : clock.sessionMs;
    if (sessionKind === "quick-reset") {
      selectedId = homeSelectedId;
    }
    sessionKind = "normal";
    completing = false;
    clock.stop();
    cancelFrame();
    stopAudio();
    clearPreroll();
    lastPhaseKey = "";
    glimpseSchedule = null;
    easeLevel = 0;
    easeApplied = 0;
    cycleOriginMs = 0;
    cyclesDone = 0;
    activePattern = currentPattern();
    hideNextMove();
    document.body.classList.remove(
      "is-session",
      "is-complete",
      "is-paused",
      "is-foreshadow",
      "is-preroll"
    );
    pauseBtn.textContent = "Pause";
    pauseBtn.setAttribute("aria-pressed", "false");
    syncEaseUi();
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
    renderHome();
  }

  function showSession() {
    clearPreroll();
    homeEl.hidden = true;
    homeEl.classList.add("is-hidden");
    sessionEl.hidden = false;
    sessionEl.classList.remove("is-hidden");
    document.body.classList.add("is-session");
    document.body.classList.remove("is-complete", "is-paused", "is-preroll");
    hideWhisper();
    hideNextMove();
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
    showNextMove();
  }

  function startLoop() {
    cancelFrame();
    rafId = window.requestAnimationFrame(frame);
  }

  function startSession(opts) {
    completing = false;
    lastPhaseKey = "";
    easeLevel = 0;
    easeApplied = 0;
    cycleOriginMs = 0;
    cyclesDone = 0;
    activePattern = easePhases(basePattern(), 0);
    const ms = opts && opts.sessionMs != null ? opts.sessionMs : selectedSessionMs();
    clock = createSessionClock(ms);
    glimpseSchedule = planGlimpses(ms);
    clock.start(performance.now());
    showSession();
    pauseBtn.textContent = "Pause";
    pauseBtn.setAttribute("aria-pressed", "false");
    syncEaseUi();
    hideNextMove();
    startAudio();
    paint(performance.now());
    startLoop();
  }

  function showPrerollThenStart() {
    if (!prerollEl || !prerollCueEl) {
      startSession();
      return;
    }
    homeEl.hidden = true;
    homeEl.classList.add("is-hidden");
    sessionEl.hidden = true;
    sessionEl.classList.add("is-hidden");
    prerollEl.hidden = false;
    prerollEl.classList.remove("is-hidden");
    document.body.classList.add("is-preroll");
    document.body.classList.remove("is-session", "is-complete", "is-paused");
    prerollActive = true;
    prerollIndex = 0;
    hideWhisper();
    startAudio();

    function step() {
      if (!prerollActive) {
        return;
      }
      if (prerollIndex >= PREROLL_CUES.length) {
        prerollCueEl.classList.remove("is-on");
        prerollTimer = window.setTimeout(function () {
          if (!prerollActive) {
            return;
          }
          clearPreroll();
          startSession();
        }, reducedMotion ? 200 : PREROLL_TAIL_MS);
        return;
      }
      const word = PREROLL_CUES[prerollIndex];
      prerollIndex += 1;
      prerollCueEl.classList.remove("is-on");
      prerollCueEl.textContent = word;
      window.requestAnimationFrame(function () {
        if (!prerollActive) {
          return;
        }
        prerollCueEl.classList.add("is-on");
      });
      prerollTimer = window.setTimeout(step, reducedMotion ? 900 : PREROLL_WORD_MS);
    }

    step();
  }

  function skipPreroll() {
    if (!prerollActive) {
      return;
    }
    clearPreroll();
    startSession();
  }

  function cancelPreroll() {
    if (!prerollActive) {
      return;
    }
    stopAudio();
    showHome();
  }

  function requestStart() {
    sessionKind = "normal";
    homeSelectedId = selectedId;
    startAudio();
    if (prefs.bodySetup) {
      showPrerollThenStart();
      return;
    }
    startSession();
  }

  function startQuickReset() {
    sessionKind = "quick-reset";
    homeSelectedId = selectedId;
    selectedId = "rest";
    startAudio();
    startSession({ sessionMs: quickResetMs(PATTERNS.rest) });
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
    if (completing || prerollActive) {
      return;
    }
    if (clock.isPaused()) {
      resumeSession();
    } else {
      pauseSession();
    }
  }

  function endSession() {
    if (prerollActive) {
      cancelPreroll();
      return;
    }
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

  function currentScreen() {
    if (prerollActive) {
      return "preroll";
    }
    if (!clock.isRunning() && !clock.isPaused() && !completing) {
      return "home";
    }
    return completing ? "complete" : "session";
  }

  function getState() {
    const now = performance.now();
    const pattern = currentPattern();
    const screen = currentScreen();
    if (screen === "home" || screen === "preroll") {
      return {
        screen: screen,
        patternId: selectedId,
        remainingMs: selectedSessionMs(),
        durationMinutes: selectedMinutes,
        effectiveMinutes: displayMinutes(),
        phaseId: null,
        scale: MIN_SCALE,
        paused: false,
        technique: techniqueEl.textContent,
        whisper: whisperEl.textContent,
        sessionKind: sessionKind,
        easeLevel: easeLevel,
        need: selectedNeed,
      };
    }
    const limit = clock.sessionMs;
    const elapsed = completing ? limit : clock.elapsed(now);
    applyPendingEase(elapsed);
    const remaining = completing ? 0 : clock.remaining(now);
    const local = Math.max(0, elapsed - cycleOriginMs);
    const snapshot = phaseAt(activePattern, Math.min(local, Math.max(0, limit - 1)));
    return {
      screen: screen,
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
      effectiveMinutes: displayMinutes(),
      sessionKind: sessionKind,
      easeLevel: easeLevel,
      easeApplied: easeApplied,
    };
  }

  startEl.addEventListener("click", requestStart);
  if (quickResetEl) {
    quickResetEl.addEventListener("click", startQuickReset);
  }
  pauseBtn.addEventListener("click", function (event) {
    event.stopPropagation();
    togglePause();
  });
  endBtn.addEventListener("click", function (event) {
    event.stopPropagation();
    endSession();
  });
  if (easeBtn) {
    easeBtn.addEventListener("click", function (event) {
      event.stopPropagation();
      bumpEase();
    });
  }
  sessionEl.addEventListener("click", function () {
    if (completing) {
      showHome();
    }
  });
  if (prerollEl) {
    prerollEl.addEventListener("click", function () {
      skipPreroll();
    });
  }

  if (needsEl) {
    needsEl.addEventListener("click", function (event) {
      const chip = event.target.closest("[data-need]");
      if (!chip || clock.isRunning() || clock.isPaused() || completing || prerollActive) {
        return;
      }
      const need = chip.getAttribute("data-need");
      const spec = NEED_BY_ID[need];
      if (!spec) {
        return;
      }
      selectedNeed = need;
      selectedId = spec.select;
      renderHome();
    });
  }

  if (durationsEl) {
    durationsEl.addEventListener("click", function (event) {
      const button = event.target.closest("[data-minutes]");
      if (!button || clock.isRunning() || clock.isPaused() || completing) {
        return;
      }
      if (button.disabled) {
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
    if (!hapticsSupported) {
      prefHapticsEl.checked = false;
      prefs.haptics = false;
      return;
    }
    prefs.haptics = prefHapticsEl.checked;
    writePref(PREF_KEYS.haptics, prefs.haptics);
  });
  if (prefBodySetupEl) {
    prefBodySetupEl.addEventListener("change", function () {
      prefs.bodySetup = prefBodySetupEl.checked;
      writePref(PREF_KEYS.bodySetup, prefs.bodySetup);
    });
  }
  if (prefHumEl) {
    prefHumEl.addEventListener("change", function () {
      prefs.hum = prefHumEl.checked;
      writePref(PREF_KEYS.hum, prefs.hum);
      previewHomeAtmosphere();
    });
  }

  document.addEventListener("keydown", function (event) {
    const key = event.key;

    if (prerollActive) {
      if (key === "Escape") {
        cancelPreroll();
        return;
      }
      if (key === " " || key === "Spacebar") {
        event.preventDefault();
        skipPreroll();
      }
      return;
    }

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
        } else if (event.target !== pauseBtn && event.target !== endBtn && event.target !== easeBtn) {
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
      if (!completing && (key === "e" || key === "E")) {
        bumpEase();
      }
      return;
    }

    const index = Number(key) - 1;
    if (index >= 0 && index < PATTERN_ORDER.length) {
      selectedId = PATTERN_ORDER[index];
      if (selectedNeed && !patternMatchesNeed(selectedId, selectedNeed)) {
        selectedNeed = null;
      }
      renderHome();
    }
    if (key === "Enter") {
      requestStart();
    }
  });

  window.__breathing = {
    getState: getState,
    start: function (id) {
      if (PATTERNS[id]) {
        selectedId = id;
        renderHome();
      }
      sessionKind = "normal";
      homeSelectedId = selectedId;
      startAudio();
      startSession();
    },
    quickReset: startQuickReset,
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
    ease: bumpEase,
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
    hapticsSupported: hapticsSupported,
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

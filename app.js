(function () {
  "use strict";

  const { SESSION_MS, MIN_SCALE, PATTERNS, DURATION_MINUTES } = window.BREATHING;
  const ALLOWED_MINUTES = DURATION_MINUTES || [1, 2, 5, 10];
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
    dropCountAfterMs,
    urgeBreatheMs,
    urgeBreathLabel,
    urgeWaveLevel,
    isExhalePhase,
    HUM_INHALE_HZ,
    HUM_EXHALE_HZ,
  } = engine;
  const native = window.BREATHING_NATIVE;

  const PATTERN_ORDER = ["rest", "energy", "hrv", "focus", "sleep", "urge"];
  const PREROLL_CUES = ["Feet", "Stack", "Hands", "Jaw", "Eyes", "Exhale"];
  const PREROLL_WORD_MS = 1600;
  const PREROLL_TAIL_MS = 400;
  const URGE = window.BREATHING.URGE;

  const homeEl = document.getElementById("home");
  const settingsEl = document.getElementById("settings");
  const settingsPanelEl = document.getElementById("settings-panel");
  const settingsOpenEl = document.getElementById("settings-open");
  const settingsCloseEl = document.getElementById("settings-close");
  const settingsBackdropEl = document.getElementById("settings-backdrop");
  const aboutEl = document.getElementById("about");
  const aboutOpenEl = document.getElementById("about-open");
  const aboutCloseEl = document.getElementById("about-close");
  const resetSettingsEl = document.getElementById("reset-settings");
  const versionEl = document.getElementById("app-version");
  const sessionEl = document.getElementById("session");
  const prerollEl = document.getElementById("preroll");
  const prerollCueEl = document.getElementById("preroll-cue");
  const patternsEl = document.getElementById("patterns");
  const startEl = document.getElementById("start");
  const urgeGuideEl = document.getElementById("urge-guide");
  const urgeLineEl = document.getElementById("urge-line");
  const urgeRespondEl = document.getElementById("urge-respond");
  const urgeRespondLineEl = document.getElementById("urge-respond-line");
  const urgeAgainEl = document.getElementById("urge-again");
  const urgeDoneEl = document.getElementById("urge-done");
  const countdownEl = document.getElementById("countdown");
  const bubbleEl = document.getElementById("bubble");
  const haloEl = document.getElementById("halo");
  const pauseBtn = document.getElementById("pause-btn");
  const endBtn = document.getElementById("end-btn");
  const easeBtn = document.getElementById("ease-btn");
  const nextMoveEl = document.getElementById("next-move");
  const techniqueEl = document.getElementById("technique");
  const patternDescriptionEl = document.getElementById("pattern-description");
  const whisperEl = document.getElementById("whisper");
  const durationsEl = document.getElementById("durations");
  const durationNoteEl = document.getElementById("duration-note");
  const prefTimerEl = document.getElementById("pref-timer");
  const prefAudioEl = document.getElementById("pref-audio");
  const prefHapticsEl = document.getElementById("pref-haptics");
  const prefBodySetupEl = document.getElementById("pref-body-setup");
  const prefHumEl = document.getElementById("pref-hum");
  const prefHumWrapEl = document.getElementById("pref-hum-wrap");
  const prefReminderWrapEl = document.getElementById("pref-reminder-wrap");
  const prefReminderEl = document.getElementById("pref-reminder");
  const prefReminderTimeEl = document.getElementById("pref-reminder-time");
  const prefHealthWrapEl = document.getElementById("pref-health-wrap");
  const prefHealthEl = document.getElementById("pref-health");
  const hapticsSupported = native.hapticsAvailable(window, navigator);

  let clock = createSessionClock(SESSION_MS);
  const prefs = {
    alwaysTimer: false,
    audio: false,
    haptics: false,
    bodySetup: true,
    hum: false,
    reminder: false,
    reminderTime: "08:00",
    health: false,
  };

  let selectedId = "rest";
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
  let urgePhase = null;
  let urgeAfterBreathe = "expand";
  let urgeTimer = 0;
  let urgeGuideActive = false;
  let urgeGuideNext = null;
  let urgeWaveHeld = false;
  let aboutActive = false;
  let settingsActive = false;
  let wakeLockWanted = false;
  let wakeLockSentinel = null;

  let audioCtx = null;
  let gainNode = null;
  let oscNode = null;

  function urgeSelected() {
    return selectedId === "urge";
  }

  function currentPattern() {
    return PATTERNS[selectedId];
  }

  function basePattern() {
    if (sessionKind === "urge" && URGE && URGE.pattern) {
      return URGE.pattern;
    }
    return PATTERNS[selectedId] || PATTERNS.rest;
  }

  function restoreSavedPattern() {
    try {
      const saved = window.localStorage.getItem("breathe.pattern");
      if (
        saved === "urge" ||
        saved === "rest" ||
        (saved && Object.prototype.hasOwnProperty.call(PATTERNS, saved))
      ) {
        selectedId = saved;
      }
    } catch (err) {
      /* private mode */
    }
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
    if (urgeSelected()) {
      return urgeBreatheMs(URGE);
    }
    const minutes = effectiveMinutes(currentPattern(), selectedMinutes);
    return minutes * 60 * 1000;
  }

  function displayMinutes() {
    if (urgeSelected()) {
      return selectedMinutes;
    }
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
    const urgeOn = urgeSelected();
    const shown = displayMinutes();
    const energyCapped = !urgeOn && currentPattern() && currentPattern().id === "energy";
    const buttons = durationsEl ? durationsEl.querySelectorAll("[data-minutes]") : [];
    Array.prototype.forEach.call(buttons, function (button) {
      const minutes = Number(button.getAttribute("data-minutes"));
      const blocked = urgeOn || (energyCapped && minutes > 1);
      const on = !urgeOn && minutes === shown;
      button.disabled = blocked;
      button.classList.toggle("is-disabled", blocked);
      button.classList.toggle("is-selected", on);
      button.setAttribute("aria-checked", on ? "true" : "false");
      button.setAttribute("aria-disabled", blocked ? "true" : "false");
    });
    if (durationNoteEl) {
      if (urgeOn) {
        durationNoteEl.hidden = false;
        durationNoteEl.textContent = (URGE && URGE.durationNote) || "About 3 minutes.";
      } else if (energyCapped) {
        durationNoteEl.hidden = false;
        durationNoteEl.textContent = "Energy is one minute.";
      } else {
        durationNoteEl.hidden = true;
        durationNoteEl.textContent = "";
      }
    }
    if (startEl) {
      startEl.setAttribute("aria-label", urgeOn ? "Start Think First" : "Start session");
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

  function setSwitch(el, on) {
    if (!el) {
      return;
    }
    el.setAttribute("aria-checked", on ? "true" : "false");
  }

  function syncHumPrefUi() {
    if (!prefHumEl) {
      return;
    }
    const allowed = selectedId === "rest" || selectedId === "sleep";
    prefHumEl.disabled = !allowed;
    if (prefHumWrapEl) {
      prefHumWrapEl.classList.toggle("is-unavailable", !allowed);
    }
  }

  function readReminderTime() {
    try {
      const parsed = native.parseClock(window.localStorage.getItem(native.KEYS.reminderTime));
      if (parsed) {
        return native.formatClock(parsed.hour, parsed.minute);
      }
    } catch (err) {
      /* private mode */
    }
    return "08:00";
  }

  function applyHapticsAvailability() {
    const wrap = document.getElementById("pref-haptics-wrap");
    if (hapticsSupported) {
      if (prefHapticsEl) {
        prefHapticsEl.disabled = false;
      }
      if (wrap) {
        wrap.hidden = false;
      }
      return;
    }
    prefs.haptics = false;
    setSwitch(prefHapticsEl, false);
    if (prefHapticsEl) {
      prefHapticsEl.disabled = true;
    }
    if (wrap) {
      wrap.hidden = true;
    }
  }

  function applyNativeGates() {
    applyHapticsAvailability();
    const reminderOn = Boolean(native.reminderAvailable(window, navigator));
    const healthOn = Boolean(native.healthAvailable(window));
    if (prefReminderWrapEl) {
      prefReminderWrapEl.hidden = !reminderOn;
    }
    if (!reminderOn) {
      prefs.reminder = false;
      setSwitch(prefReminderEl, false);
    }
    if (prefHealthWrapEl) {
      prefHealthWrapEl.hidden = !healthOn;
    }
    if (!healthOn) {
      prefs.health = false;
      setSwitch(prefHealthEl, false);
    }
  }

  function armReminder() {
    if (!prefs.reminder || !native.reminderAvailable(window, navigator)) {
      return;
    }
    const parsed = native.parseClock(prefs.reminderTime) || { hour: 8, minute: 0 };
    let armedKey = "";
    try {
      armedKey = window.localStorage.getItem(native.KEYS.reminderArmedFor) || "";
    } catch (err) {
      armedKey = "";
    }
    const plan = native.planReminder(Date.now(), parsed.hour, parsed.minute, armedKey);
    if (!plan.schedule) {
      return;
    }
    let sent = false;
    try {
      const command = native.localReminderCommand(
        plan.delaySeconds,
        native.REMINDER_BODY,
        native.REMINDER_TITLE,
        native.appStartUrl(window.location)
      );
      sent = native.sendDespia(window, navigator, command);
    } catch (err) {
      sent = false;
    }
    if (!sent) {
      return;
    }
    try {
      window.localStorage.setItem(native.KEYS.reminderArmedFor, plan.key);
    } catch (err) {
      /* private mode */
    }
  }

  function loadPrefs() {
    prefs.alwaysTimer = readPref(PREF_KEYS.alwaysTimer);
    prefs.audio = readPref(PREF_KEYS.audio);
    prefs.haptics = readPref(PREF_KEYS.haptics);
    prefs.bodySetup = readPref(PREF_KEYS.bodySetup, true);
    prefs.hum = readPref(PREF_KEYS.hum);
    prefs.reminder = readPref(native.KEYS.reminder);
    prefs.reminderTime = readReminderTime();
    prefs.health = readPref(native.KEYS.health);
    selectedMinutes = readDurationMinutes();
    setSwitch(prefTimerEl, prefs.alwaysTimer);
    setSwitch(prefAudioEl, prefs.audio);
    setSwitch(prefHapticsEl, prefs.haptics);
    setSwitch(prefBodySetupEl, prefs.bodySetup);
    setSwitch(prefHumEl, prefs.hum);
    setSwitch(prefReminderEl, prefs.reminder);
    setSwitch(prefHealthEl, prefs.health);
    if (prefReminderTimeEl) {
      prefReminderTimeEl.value = prefs.reminderTime;
    }
    applyNativeGates();
    armReminder();
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

  function cardAccessibleName(id, pattern) {
    const name = pattern.homeLabel || "";
    const protocol = pattern.protocol || "";
    let description = pattern.technique || "";
    if (id === "urge" && URGE) {
      description = [URGE.technique, URGE.description].filter(Boolean).join(" ");
    }
    return name + ", " + protocol + ". " + description;
  }

  function cardSpec(id) {
    if (id === "urge" && URGE && URGE.pattern) {
      return {
        id: "urge",
        homeLabel: URGE.homeLabel || "Think First",
        protocol: URGE.protocol || "4–6",
        colors: URGE.pattern.colors,
      };
    }
    return PATTERNS[id];
  }

  function previewHomeAtmosphere() {
    const urgeOn = urgeSelected() && URGE && URGE.pattern;
    const pattern = urgeOn ? URGE.pattern : currentPattern();
    if (!pattern) {
      return;
    }
    document.documentElement.style.setProperty("--atmosphere", pattern.colors.inhale.atmosphere);
    document.documentElement.style.setProperty("--bubble-fill", pattern.colors.inhale.fill);
    document.documentElement.style.setProperty("--bubble-glow", pattern.colors.inhale.glow);
    document.documentElement.style.setProperty("--scale", String(MIN_SCALE));
    document.documentElement.style.setProperty("--bubble-opacity", "1");
    document.body.dataset.pattern = urgeOn ? "urge" : pattern.id;
    document.body.dataset.mood = pattern.mood || "steady";
    techniqueEl.textContent = urgeOn ? URGE.technique || "" : techniqueText(pattern);
    if (patternDescriptionEl) {
      const blurb = urgeOn && URGE && URGE.description ? URGE.description : "";
      patternDescriptionEl.textContent = blurb;
      patternDescriptionEl.hidden = !blurb;
    }
    syncHumPrefUi();
    syncDurationUi();
  }

  function updateCountdown(elapsed, remaining) {
    if (sessionKind === "urge") {
      const wrap = URGE && URGE.breathCountWrap ? URGE.breathCountWrap : 10;
      countdownEl.textContent = urgeBreathLabel(cyclesDone, wrap);
      countdownEl.classList.toggle("is-on", !completing);
      return;
    }
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
      const pattern = cardSpec(id);
      if (!pattern) {
        return;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pattern" + (id === selectedId ? " is-selected" : "");
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", id === selectedId ? "true" : "false");
      button.setAttribute("aria-label", cardAccessibleName(id, pattern));
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
      native.playHaptic(window, navigator, snapshot.phase.id);
    }
  }

  function syncUrgeWave(elapsed) {
    if (sessionKind !== "urge" || urgePhase !== "breathe") {
      return;
    }
    if (reducedMotion) {
      if (!urgeWaveHeld) {
        document.documentElement.style.setProperty("--urge-level", "0");
        urgeWaveHeld = true;
      }
      return;
    }
    const level = urgeWaveLevel(elapsed, {
      riseMs: URGE.waveRiseMs,
      durationMs: clock.sessionMs,
    });
    document.documentElement.style.setProperty("--urge-level", String(level));
  }

  function paint(now) {
    const elapsedRaw = completing ? clock.sessionMs : clock.elapsed(now);
    applyPendingEase(elapsedRaw);
    if (sessionKind === "urge" && URGE && cyclesDone >= (URGE.breaths || 15)) {
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
    syncUrgeWave(elapsed);
    if (!clock.isPaused() && !completing) {
      updateAudio(snapshot);
      maybeHaptic(snapshot);
    }
  }

  function finishActiveSession() {
    if (sessionKind === "urge") {
      onUrgeBreatheDone();
      return;
    }
    finishSession();
  }

  function frame(now) {
    if (!clock.isRunning() || clock.isPaused()) {
      return;
    }
    if (clock.remaining(now) <= 0) {
      finishActiveSession();
      return;
    }
    paint(now);
    if (completing || (sessionKind === "urge" && URGE && cyclesDone >= (URGE.breaths || 15))) {
      if (!completing) {
        finishActiveSession();
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

  function clearUrgeRun() {
    window.clearTimeout(urgeTimer);
    urgeTimer = 0;
    urgeGuideActive = false;
    urgeGuideNext = null;
    urgePhase = null;
    urgeAfterBreathe = "expand";
    urgeWaveHeld = false;
    document.documentElement.style.removeProperty("--urge-level");
    if (urgeLineEl) {
      urgeLineEl.textContent = "";
      urgeLineEl.classList.remove("is-on");
    }
    if (urgeGuideEl) {
      urgeGuideEl.hidden = true;
      urgeGuideEl.classList.add("is-hidden");
    }
    if (urgeRespondEl) {
      urgeRespondEl.hidden = true;
      urgeRespondEl.classList.add("is-hidden");
    }
    document.body.classList.remove("is-urge", "is-urge-guide", "is-urge-respond");
  }

  function showHome(opts) {
    const endedMs = opts && opts.sessionMs != null ? opts.sessionMs : clock.sessionMs;
    sessionKind = "normal";
    clearUrgeRun();
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
    activePattern = currentPattern() || (URGE && URGE.pattern) || PATTERNS.rest;
    hideNextMove();
    releaseWakeLock();
    document.body.classList.remove(
      "is-session",
      "is-complete",
      "is-paused",
      "is-foreshadow",
      "is-preroll",
      "is-urge",
      "is-urge-guide",
      "is-urge-respond",
      "is-about"
    );
    aboutActive = false;
    if (aboutEl) {
      aboutEl.hidden = true;
      aboutEl.classList.add("is-hidden");
    }
    pauseBtn.textContent = "Pause";
    pauseBtn.setAttribute("aria-label", "Pause session");
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
    if (urgeGuideEl) {
      urgeGuideEl.hidden = true;
      urgeGuideEl.classList.add("is-hidden");
    }
    if (urgeRespondEl) {
      urgeRespondEl.hidden = true;
      urgeRespondEl.classList.add("is-hidden");
    }
    homeEl.hidden = true;
    homeEl.classList.add("is-hidden");
    sessionEl.hidden = false;
    sessionEl.classList.remove("is-hidden");
    document.body.classList.add("is-session");
    document.body.classList.remove(
      "is-complete",
      "is-paused",
      "is-preroll",
      "is-urge-guide",
      "is-urge-respond"
    );
    hideWhisper();
    hideNextMove();
  }

  function markSessionComplete(durationMs) {
    if (prefs.haptics && hapticsSupported) {
      try {
        native.playHaptic(window, navigator, "end");
      } catch (err) {
        /* bridge missing or threw */
      }
    }
    if (prefs.health && native.healthAvailable(window)) {
      try {
        native.writeMindfulSession(window, durationMs);
      } catch (err) {
        /* bridge missing or threw */
      }
    }
  }

  function finishSession() {
    if (completing) {
      return;
    }
    completing = true;
    markSessionComplete(clock.sessionMs);
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
    if (typeof document !== "undefined" && document.hidden) {
      pauseSession();
      return;
    }
    rafId = window.requestAnimationFrame(frame);
  }

  function requestWakeLock() {
    if (!wakeLockWanted || wakeLockSentinel) {
      return;
    }
    if (!navigator.wakeLock || typeof navigator.wakeLock.request !== "function") {
      return;
    }
    navigator.wakeLock
      .request("screen")
      .then(function (sentinel) {
        if (!wakeLockWanted) {
          sentinel.release().catch(function () {});
          return;
        }
        wakeLockSentinel = sentinel;
        sentinel.addEventListener("release", function () {
          if (wakeLockSentinel === sentinel) {
            wakeLockSentinel = null;
          }
        });
      })
      .catch(function () {
        wakeLockSentinel = null;
      });
  }

  function acquireWakeLock() {
    wakeLockWanted = true;
    requestWakeLock();
  }

  function releaseWakeLock() {
    wakeLockWanted = false;
    const sentinel = wakeLockSentinel;
    wakeLockSentinel = null;
    if (!sentinel) {
      return;
    }
    sentinel.release().catch(function () {});
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
    if (sessionKind === "urge") {
      document.body.classList.add("is-urge");
      countdownEl.textContent = urgeBreathLabel(0, URGE.breathCountWrap);
      countdownEl.classList.add("is-on");
    } else {
      document.body.classList.remove("is-urge");
      document.documentElement.style.removeProperty("--urge-level");
    }
    showSession();
    pauseBtn.textContent = "Pause";
    pauseBtn.setAttribute("aria-label", "Pause session");
    pauseBtn.setAttribute("aria-pressed", "false");
    syncEaseUi();
    hideNextMove();
    startAudio();
    acquireWakeLock();
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
    acquireWakeLock();
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
    if (urgeSelected()) {
      startRideUrge();
      return;
    }
    sessionKind = "normal";
    startAudio();
    if (prefs.bodySetup) {
      showPrerollThenStart();
      return;
    }
    startSession();
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
    pauseBtn.setAttribute("aria-label", "Resume session");
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
    pauseBtn.setAttribute("aria-label", "Pause session");
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

  function applyUrgeAtmosphere() {
    if (!URGE || !URGE.pattern) {
      return;
    }
    const colors = URGE.pattern.colors.inhale;
    document.documentElement.style.setProperty("--atmosphere", colors.atmosphere);
    document.documentElement.style.setProperty("--bubble-fill", colors.fill);
    document.documentElement.style.setProperty("--bubble-glow", colors.glow);
    document.body.dataset.pattern = URGE.pattern.id;
    document.body.dataset.mood = URGE.pattern.mood || "still";
  }

  function showUrgeGuide(phase, line, ms, next) {
    window.clearTimeout(urgeTimer);
    urgeTimer = 0;
    urgePhase = phase;
    urgeGuideActive = true;
    urgeGuideNext = next;
    acquireWakeLock();
    if (homeEl) {
      homeEl.hidden = true;
      homeEl.classList.add("is-hidden");
    }
    if (sessionEl) {
      sessionEl.hidden = true;
      sessionEl.classList.add("is-hidden");
    }
    if (urgeRespondEl) {
      urgeRespondEl.hidden = true;
      urgeRespondEl.classList.add("is-hidden");
    }
    if (prerollEl) {
      prerollEl.hidden = true;
      prerollEl.classList.add("is-hidden");
    }
    if (urgeGuideEl) {
      urgeGuideEl.hidden = false;
      urgeGuideEl.classList.remove("is-hidden");
    }
    document.body.classList.add("is-urge-guide");
    document.body.classList.remove(
      "is-session",
      "is-complete",
      "is-paused",
      "is-preroll",
      "is-urge",
      "is-urge-respond",
      "is-foreshadow"
    );
    applyUrgeAtmosphere();
    hideWhisper();
    if (urgeLineEl) {
      urgeLineEl.classList.remove("is-on");
      urgeLineEl.textContent = line || "";
      if (reducedMotion) {
        urgeLineEl.classList.add("is-on");
      } else {
        window.requestAnimationFrame(function () {
          if (!urgeGuideActive || urgePhase !== phase || !urgeLineEl) {
            return;
          }
          urgeLineEl.classList.add("is-on");
        });
      }
    }
    if (urgeGuideEl && typeof urgeGuideEl.focus === "function") {
      urgeGuideEl.focus();
    }
    urgeTimer = window.setTimeout(function () {
      if (urgePhase !== phase) {
        return;
      }
      finishUrgeGuide();
    }, ms);
  }

  function finishUrgeGuide() {
    if (!urgeGuideActive) {
      return;
    }
    const next = urgeGuideNext;
    window.clearTimeout(urgeTimer);
    urgeTimer = 0;
    urgeGuideActive = false;
    urgeGuideNext = null;
    if (typeof next === "function") {
      next();
    }
  }

  function showUrgeObserve() {
    showUrgeGuide("observe", URGE.lines.observe, URGE.observeMs, startUrgeBreathe);
  }

  function startRideUrge() {
    sessionKind = "urge";
    urgeAfterBreathe = "expand";
    startAudio();
    showUrgeGuide("stop", URGE.lines.stop, URGE.stopMs, showUrgeObserve);
  }

  function startUrgeBreathe() {
    window.clearTimeout(urgeTimer);
    urgeTimer = 0;
    urgeGuideActive = false;
    urgeGuideNext = null;
    urgePhase = "breathe";
    urgeWaveHeld = false;
    sessionKind = "urge";
    applyUrgeAtmosphere();
    startSession({ sessionMs: urgeBreatheMs(URGE) });
  }

  function showUrgeRespond() {
    window.clearTimeout(urgeTimer);
    urgeTimer = 0;
    urgeGuideActive = false;
    urgeGuideNext = null;
    cancelFrame();
    stopAudio();
    if (clock.isRunning() || clock.isPaused()) {
      clock.stop();
    }
    urgePhase = "respond";
    sessionKind = "urge";
    urgeWaveHeld = false;
    document.documentElement.style.removeProperty("--urge-level");
    if (homeEl) {
      homeEl.hidden = true;
      homeEl.classList.add("is-hidden");
    }
    if (sessionEl) {
      sessionEl.hidden = true;
      sessionEl.classList.add("is-hidden");
    }
    if (urgeGuideEl) {
      urgeGuideEl.hidden = true;
      urgeGuideEl.classList.add("is-hidden");
    }
    if (urgeRespondEl) {
      urgeRespondEl.hidden = false;
      urgeRespondEl.classList.remove("is-hidden");
    }
    document.body.classList.remove(
      "is-session",
      "is-complete",
      "is-paused",
      "is-preroll",
      "is-urge",
      "is-urge-guide",
      "is-foreshadow"
    );
    document.body.classList.add("is-urge-respond");
    applyUrgeAtmosphere();
    hideWhisper();
    hideNextMove();
    if (urgeRespondLineEl && typeof urgeRespondLineEl.focus === "function") {
      urgeRespondLineEl.focus();
    }
  }

  function onUrgeBreatheDone() {
    if (urgePhase !== "breathe") {
      return;
    }
    markSessionComplete(clock.sessionMs);
    const destination = urgeAfterBreathe === "respond" ? "respond" : "expand";
    urgePhase = destination;
    cancelFrame();
    muteAudio();
    stopAudio();
    clock.complete();
    document.body.classList.remove("is-urge", "is-paused", "is-foreshadow");
    document.documentElement.style.removeProperty("--urge-level");
    urgeWaveHeld = false;
    if (destination === "respond") {
      showUrgeRespond();
      return;
    }
    showUrgeGuide("expand", URGE.lines.expand, URGE.expandMs, showUrgeRespond);
  }

  function startUrgeAnotherRound() {
    urgeAfterBreathe = "respond";
    sessionKind = "urge";
    startAudio();
    startUrgeBreathe();
  }

  function sessionText() {
    return sessionEl.innerText.replace(/\s+/g, " ").trim();
  }

  function currentScreen() {
    if (aboutActive) {
      return "about";
    }
    if (prerollActive) {
      return "preroll";
    }
    if (urgeGuideActive) {
      return "urge-guide";
    }
    if (urgePhase === "respond") {
      return "urge-respond";
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
    if (screen === "home" || screen === "about" || screen === "preroll" || screen === "urge-guide" || screen === "urge-respond") {
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
        urgePhase: urgePhase,
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
      urgePhase: urgePhase,
    };
  }

  function focusableIn(root) {
    if (!root) {
      return [];
    }
    const nodes = root.querySelectorAll("button, [href], input, select, textarea, [tabindex]");
    return Array.prototype.filter.call(nodes, function (el) {
      if (el.disabled || el.getAttribute("aria-hidden") === "true" || el.tabIndex < 0) {
        return false;
      }
      if (el.closest("[hidden]")) {
        return false;
      }
      return true;
    });
  }

  function trapSettingsFocus(event) {
    const root = settingsPanelEl || settingsEl;
    const items = focusableIn(root);
    if (!items.length) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    const onItem = items.indexOf(active) !== -1;
    if (event.shiftKey) {
      if (!onItem || active === first) {
        event.preventDefault();
        last.focus();
      }
      return;
    }
    if (!onItem || active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function openSettings() {
    if (settingsActive || aboutActive || clock.isRunning() || clock.isPaused() || completing || prerollActive || urgeGuideActive || urgePhase) {
      return;
    }
    settingsActive = true;
    if (settingsOpenEl) {
      settingsOpenEl.setAttribute("aria-expanded", "true");
    }
    if (settingsEl) {
      settingsEl.hidden = false;
      settingsEl.classList.remove("is-hidden");
    }
    document.body.classList.add("is-settings");
    if (homeEl) {
      homeEl.setAttribute("inert", "");
      homeEl.setAttribute("aria-hidden", "true");
    }
    window.requestAnimationFrame(function () {
      const focusTarget = settingsPanelEl || settingsEl;
      if (!settingsActive || !focusTarget || typeof focusTarget.focus !== "function") {
        return;
      }
      focusTarget.focus({ preventScroll: true });
    });
  }

  function closeSettings() {
    if (!settingsActive) {
      return;
    }
    settingsActive = false;
    if (settingsOpenEl) {
      settingsOpenEl.setAttribute("aria-expanded", "false");
    }
    if (settingsEl) {
      settingsEl.hidden = true;
      settingsEl.classList.add("is-hidden");
    }
    document.body.classList.remove("is-settings");
    if (homeEl) {
      homeEl.removeAttribute("inert");
      homeEl.removeAttribute("aria-hidden");
    }
    if (settingsOpenEl && typeof settingsOpenEl.focus === "function") {
      settingsOpenEl.focus();
    }
  }

  function showAbout() {
    if (settingsActive || clock.isRunning() || clock.isPaused() || completing || prerollActive || urgeGuideActive || urgePhase) {
      return;
    }
    aboutActive = true;
    if (versionEl && window.BREATHING.APP_VERSION) {
      versionEl.textContent = window.BREATHING.APP_VERSION;
    }
    if (homeEl) {
      homeEl.hidden = true;
      homeEl.classList.add("is-hidden");
    }
    if (aboutEl) {
      aboutEl.hidden = false;
      aboutEl.classList.remove("is-hidden");
    }
    document.body.classList.add("is-about");
    if (aboutCloseEl && typeof aboutCloseEl.focus === "function") {
      aboutCloseEl.focus();
    }
  }

  function hideAbout() {
    if (!aboutActive) {
      return;
    }
    aboutActive = false;
    if (aboutEl) {
      aboutEl.hidden = true;
      aboutEl.classList.add("is-hidden");
    }
    document.body.classList.remove("is-about");
    if (homeEl) {
      homeEl.hidden = false;
      homeEl.classList.remove("is-hidden");
    }
    if (aboutOpenEl && typeof aboutOpenEl.focus === "function") {
      aboutOpenEl.focus();
    }
  }

  function resetSettings() {
    const ok = window.confirm("Reset settings on this device? Saved preferences return to defaults.");
    if (!ok) {
      return;
    }
    try {
      const keys = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (key && key.indexOf("breathe.") === 0) {
          keys.push(key);
        }
      }
      keys.forEach(function (key) {
        window.localStorage.removeItem(key);
      });
    } catch (err) {
      /* private mode */
    }
    selectedId = "rest";
    selectedMinutes = 5;
    prefs.alwaysTimer = false;
    prefs.audio = false;
    prefs.haptics = false;
    prefs.bodySetup = true;
    prefs.hum = false;
    prefs.reminder = false;
    prefs.reminderTime = "08:00";
    prefs.health = false;
    loadPrefs();
    renderHome();
  }

  function bindSwitch(el, apply) {
    if (!el) {
      return;
    }
    el.addEventListener("click", function () {
      if (el.disabled) {
        return;
      }
      const next = el.getAttribute("aria-checked") !== "true";
      setSwitch(el, next);
      apply(next);
    });
    const row = el.closest(".switch-row");
    if (!row) {
      return;
    }
    row.addEventListener("click", function (event) {
      if (event.target === el || el.contains(event.target) || el.disabled) {
        return;
      }
      el.click();
    });
  }

  startEl.addEventListener("click", requestStart);
  if (settingsOpenEl) {
    settingsOpenEl.addEventListener("click", openSettings);
  }
  if (settingsCloseEl) {
    settingsCloseEl.addEventListener("click", closeSettings);
  }
  if (settingsBackdropEl) {
    settingsBackdropEl.addEventListener("click", closeSettings);
  }
  if (aboutOpenEl) {
    aboutOpenEl.addEventListener("click", showAbout);
  }
  if (aboutCloseEl) {
    aboutCloseEl.addEventListener("click", hideAbout);
  }
  if (resetSettingsEl) {
    resetSettingsEl.addEventListener("click", resetSettings);
  }
  if (urgeGuideEl) {
    urgeGuideEl.addEventListener("click", function () {
      finishUrgeGuide();
    });
  }
  if (urgeAgainEl) {
    urgeAgainEl.addEventListener("click", startUrgeAnotherRound);
  }
  if (urgeDoneEl) {
    urgeDoneEl.addEventListener("click", function () {
      showHome();
    });
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

  bindSwitch(prefTimerEl, function (on) {
    prefs.alwaysTimer = on;
    writePref(PREF_KEYS.alwaysTimer, prefs.alwaysTimer);
  });
  bindSwitch(prefAudioEl, function (on) {
    prefs.audio = on;
    writePref(PREF_KEYS.audio, prefs.audio);
  });
  bindSwitch(prefHapticsEl, function (on) {
    if (!hapticsSupported) {
      setSwitch(prefHapticsEl, false);
      prefs.haptics = false;
      return;
    }
    prefs.haptics = on;
    writePref(PREF_KEYS.haptics, prefs.haptics);
  });
  bindSwitch(prefBodySetupEl, function (on) {
    prefs.bodySetup = on;
    writePref(PREF_KEYS.bodySetup, prefs.bodySetup);
  });
  bindSwitch(prefHumEl, function (on) {
    prefs.hum = on;
    writePref(PREF_KEYS.hum, prefs.hum);
    previewHomeAtmosphere();
  });
  bindSwitch(prefReminderEl, function (on) {
    if (!native.reminderAvailable(window, navigator)) {
      setSwitch(prefReminderEl, false);
      prefs.reminder = false;
      return;
    }
    prefs.reminder = on;
    writePref(native.KEYS.reminder, prefs.reminder);
    if (on) {
      armReminder();
    }
  });
  bindSwitch(prefHealthEl, function (on) {
    if (!native.healthAvailable(window)) {
      setSwitch(prefHealthEl, false);
      prefs.health = false;
      return;
    }
    prefs.health = on;
    writePref(native.KEYS.health, prefs.health);
  });
  if (prefReminderTimeEl) {
    prefReminderTimeEl.addEventListener("change", function () {
      const parsed = native.parseClock(prefReminderTimeEl.value);
      if (!parsed) {
        prefReminderTimeEl.value = prefs.reminderTime;
        return;
      }
      prefs.reminderTime = native.formatClock(parsed.hour, parsed.minute);
      try {
        window.localStorage.setItem(native.KEYS.reminderTime, prefs.reminderTime);
      } catch (err) {
        /* private mode */
      }
      if (prefs.reminder) {
        armReminder();
      }
    });
  }

  document.addEventListener("keydown", function (event) {
    const key = event.key;

    if (settingsActive) {
      if (key === "Escape") {
        event.preventDefault();
        closeSettings();
        return;
      }
      if (key === "Tab") {
        trapSettingsFocus(event);
      }
      return;
    }

    if (aboutActive) {
      if (key === "Escape") {
        hideAbout();
      }
      return;
    }

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

    if (urgeGuideActive) {
      if (key === "Escape") {
        showHome();
        return;
      }
      if (key === " " || key === "Spacebar" || key === "Enter") {
        event.preventDefault();
        finishUrgeGuide();
      }
      return;
    }

    if (urgePhase === "respond") {
      const onChoice = event.target === urgeAgainEl || event.target === urgeDoneEl;
      if (key === "Escape") {
        showHome();
        return;
      }
      if (!onChoice && (key === " " || key === "Spacebar" || key === "Enter")) {
        event.preventDefault();
        showHome();
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
      renderHome();
    }
    if (key === "Enter") {
      if (
        event.target === aboutOpenEl ||
        event.target === resetSettingsEl ||
        event.target === settingsOpenEl ||
        event.target === settingsCloseEl ||
        (event.target && event.target.getAttribute && event.target.getAttribute("role") === "switch")
      ) {
        return;
      }
      requestStart();
    }
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      if (!completing && !prerollActive && !urgeGuideActive && clock.isRunning() && !clock.isPaused()) {
        pauseSession();
      }
      return;
    }
    if (wakeLockWanted) {
      wakeLockSentinel = null;
      requestWakeLock();
    }
  });

  window.__breathing = {
    getState: getState,
    start: function (id) {
      if (id === "urge" || (id == null && urgeSelected())) {
        selectedId = "urge";
        renderHome();
        startRideUrge();
        return;
      }
      if (PATTERNS[id]) {
        selectedId = id;
        renderHome();
      }
      sessionKind = "normal";
      startAudio();
      startSession();
    },
    rideUrge: startRideUrge,
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

  if (versionEl && window.BREATHING.APP_VERSION) {
    versionEl.textContent = window.BREATHING.APP_VERSION;
  }

  restoreSavedPattern();
  loadPrefs();
  renderHome();
})();

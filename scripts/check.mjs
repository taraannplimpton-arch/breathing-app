import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const breathing = require(path.join(root, "protocols.js"));
const engine = require(path.join(root, "engine.js"));
const html = readFileSync(path.join(root, "index.html"), "utf8");
const css = readFileSync(path.join(root, "styles.css"), "utf8");
const js = readFileSync(path.join(root, "app.js"), "utf8");
const engineSrc = readFileSync(path.join(root, "engine.js"), "utf8");
const readme = readFileSync(path.join(root, "README.md"), "utf8");
const sw = readFileSync(path.join(root, "sw.js"), "utf8");
const manifest = readFileSync(path.join(root, "manifest.webmanifest"), "utf8");

const failures = [];

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function nearly(actual, expected, eps, message) {
  assert(Math.abs(actual - expected) <= eps, message + " (got " + actual + ", expected ~" + expected + ")");
}

assert(breathing.SESSION_MS === 5 * 60 * 1000, "SESSION_MS default must remain 5 minutes");
assert(engine.SESSION_MS === breathing.SESSION_MS, "engine SESSION_MS must match protocol data");
assert(JSON.stringify(breathing.DURATION_MINUTES) === JSON.stringify([1, 2, 5, 10]), "allowed durations must be exactly 1, 2, 5, and 10 minutes");
assert(engine.formatTime(breathing.SESSION_MS) === "5:00", "default remaining display is 5:00");
assert(engine.formatTime(60 * 1000) === "1:00", "1-minute remaining formats as 1:00");
assert(engine.formatTime(2 * 60 * 1000) === "2:00", "2-minute remaining formats as 2:00");
assert(engine.formatTime(10 * 60 * 1000) === "10:00", "10-minute remaining formats as 10:00");
assert(breathing.MIN_SCALE < breathing.MAX_SCALE, "bubble must have room to grow");
assert(Object.keys(breathing.PATTERNS).length === 5, "there must be exactly five patterns");
assert(breathing.QUICK_RESET_CYCLES === 3, "Quick Reset must be 3 physiological sighs");

const expected = {
  energy: [
    ["inhale", 4],
    ["exhale", 2],
  ],
  hrv: [
    ["inhale", 5],
    ["exhale", 5],
  ],
  focus: [
    ["inhale", 4],
    ["hold", 4],
    ["exhale", 4],
    ["hold", 4],
  ],
};

for (const [id, phases] of Object.entries(expected)) {
  const pattern = breathing.PATTERNS[id];
  assert(Boolean(pattern), "missing pattern " + id);
  if (!pattern) {
    continue;
  }
  assert(pattern.phases.length === phases.length, id + " has the wrong number of phases");
  phases.forEach(function (spec, index) {
    const phase = pattern.phases[index] || {};
    assert(phase.id === spec[0] && phase.seconds === spec[1], id + " phase " + index + " should be " + spec[0] + " " + spec[1] + "s");
  });
}

const rest = breathing.PATTERNS.rest;
assert(Boolean(rest), "missing Rest pattern");
assert(rest.phases.length === 3, "Rest should be inhale, shorter inhale, longer exhale");
assert(engine.isInhalePhase(rest.phases[0]), "Rest phase 0 must be inhale-class");
assert(engine.isInhalePhase(rest.phases[1]), "Rest phase 1 must be inhale-class");
assert(engine.isExhalePhase(rest.phases[2]), "Rest phase 2 must be exhale");
assert(rest.phases[1].seconds < rest.phases[0].seconds, "second Rest inhale must be shorter than the first");
assert(rest.phases[2].seconds > rest.phases[0].seconds, "Rest exhale must be longer than the first inhale");
assert(rest.phases[0].seconds === 2 && rest.phases[1].seconds === 1 && rest.phases[2].seconds === 6, "Rest timings must be 2s, 1s, 6s");

const restTech = rest.technique || "";
const energyTech = breathing.PATTERNS.energy.technique || "";
const hrvTech = breathing.PATTERNS.hrv.technique || "";
const focusTech = breathing.PATTERNS.focus.technique || "";
assert(/nose/i.test(restTech) && /mouth/i.test(restTech) && /exhale/i.test(restTech), "Rest technique must state nose inhale and mouth exhale");
assert(/top-up/i.test(restTech), "Rest technique must mention the short nose top-up");
assert(!/nose-only/i.test(restTech), "Rest technique must not be described as nose-only");
assert(/nose inhale/i.test(energyTech) && /nose exhale/i.test(energyTech), "Energy technique must be nose inhale and nose exhale");
assert(/shorter/i.test(energyTech), "Energy technique must note the shorter exhale");
assert(/lightheaded/i.test(energyTech) && /More air isn't better/i.test(energyTech), "Energy technique must include a gentle lightheaded / more-air safety line");
assert(breathing.PATTERNS.energy.maxMinutes === 1, "Energy must cap at 1 minute");
assert(engine.effectiveMinutes(breathing.PATTERNS.energy, 5) === 1, "Energy effective minutes must cap 5 → 1");
assert(engine.effectiveMinutes(breathing.PATTERNS.energy, 2) === 1, "Energy effective minutes must cap 2 → 1");
assert(engine.effectiveMinutes(breathing.PATTERNS.energy, 10) === 1, "Energy effective minutes must cap 10 → 1");
assert(engine.effectiveMinutes(breathing.PATTERNS.energy, 1) === 1, "Energy effective minutes must keep 1");
assert(engine.effectiveMinutes(breathing.PATTERNS.rest, 5) === 5, "Rest must not inherit the Energy duration cap");
assert(engine.effectiveMinutes(breathing.PATTERNS.sleep, 10) === 10, "Sleep must not inherit the Energy duration cap");
assert(/nose inhale/i.test(hrvTech) && /nose exhale/i.test(hrvTech) && /belly/i.test(hrvTech), "HRV technique must be nose inhale and nose exhale, soft belly");
assert(/nose inhale/i.test(focusTech) && /nose hold/i.test(focusTech) && /nose exhale/i.test(focusTech), "Focus technique must keep inhale, hold, and exhale on the nose");
assert(/all through the nose/i.test(focusTech), "Focus technique must say the whole box is through the nose");

const sleep = breathing.PATTERNS.sleep;
assert(Boolean(sleep), "missing Sleep pattern");
assert(sleep.mood === "calm", "Sleep atmosphere must be dim/calm like Rest");
assert(sleep.dropCountAfterCycles === 4, "Sleep should drop the count after about 4 cycles");
assert(sleep.phases.length === 2, "Sleep should be inhale then longer exhale");
assert(sleep.phases[0].id === "inhale" && sleep.phases[0].seconds === 4, "Sleep inhale must be 4s");
assert(sleep.phases[1].id === "exhale" && sleep.phases[1].seconds === 6, "Sleep exhale must be 6s");
assert(engine.cycleMs(sleep) === 10000, "Sleep cycle must be 10s");
assert(engine.dropCountAfterMs(sleep) === 40000, "Sleep drop-the-count must start at 40s");
assert(engine.dropCountAfterMs(rest) == null, "Rest must not drop the count");
const sleepTech = sleep.technique || "";
assert(/Small breath/i.test(sleepTech) && /longer exhale/i.test(sleepTech) && /fade/i.test(sleepTech), "Sleep technique must mention small breath, longer exhale, and fading counts");
nearly(engine.scaleFor(engine.phaseAt(sleep, 0)), breathing.MIN_SCALE, 0.02, "Sleep inhale should start near MIN_SCALE");
nearly(engine.scaleFor(engine.phaseAt(sleep, 4000 - 1)), breathing.MAX_SCALE, 0.02, "Sleep inhale should end near MAX_SCALE");
nearly(engine.scaleFor(engine.phaseAt(sleep, 10000 - 1)), breathing.MIN_SCALE, 0.02, "Sleep exhale should end near MIN_SCALE");

assert(engine.quickResetMs(rest) === 27000, "Quick Reset must last 3 Rest cycles (27s)");
assert(3 * engine.cycleMs(rest) === 27000, "three Rest sighs must be 27s");
const qrClock = engine.createSessionClock(engine.quickResetMs(rest));
const qrT0 = 100;
qrClock.start(qrT0);
assert(qrClock.remaining(qrT0) === 27000, "Quick Reset remaining at t=0 must be 27000ms");
assert(qrClock.remaining(qrT0 + 27000) === 0, "Quick Reset must complete at 27s");

function easeIds(pattern, level) {
  return engine.easePhases(pattern, level).phases.map(function (phase) {
    return [phase.id, phase.seconds];
  });
}
assert(JSON.stringify(easeIds(sleep, 0)) === JSON.stringify([["inhale", 4], ["exhale", 6]]), "ease level 0 must be identity");
assert(JSON.stringify(easeIds(sleep, 1)) === JSON.stringify([["inhale", 3], ["exhale", 5]]), "Sleep 4-6 eases to 3-5");
assert(JSON.stringify(easeIds(sleep, 2)) === JSON.stringify([["inhale", 2], ["exhale", 4]]), "Sleep second ease is 2-4");
assert(JSON.stringify(easeIds(breathing.PATTERNS.hrv, 1)) === JSON.stringify([["inhale", 4], ["exhale", 4]]), "HRV 5-5 eases to 4-4");
assert(JSON.stringify(easeIds(breathing.PATTERNS.hrv, 2)) === JSON.stringify([["inhale", 3], ["exhale", 3]]), "HRV second ease is 3-3");
assert(JSON.stringify(easeIds(breathing.PATTERNS.energy, 1).map(function (pair) { return pair[1]; })) === JSON.stringify([3, 2]), "Energy 4-2 eases to 3-2");
assert(JSON.stringify(easeIds(breathing.PATTERNS.energy, 2).map(function (pair) { return pair[1]; })) === JSON.stringify([2, 2]), "Energy second ease floors exhale at 2");
const focusEased = easeIds(breathing.PATTERNS.focus, 1);
assert(focusEased.every(function (pair) { return pair[1] === 3; }), "box 4 eases to 3");
assert(easeIds(breathing.PATTERNS.focus, 2).every(function (pair) { return pair[1] === 2; }), "box second ease is 2");
assert(JSON.stringify(easeIds(rest, 1).map(function (pair) { return pair[1]; })) === JSON.stringify([2, 1, 5]), "Rest 2-1-6 eases to 2-1-5");
assert(JSON.stringify(easeIds(rest, 2).map(function (pair) { return pair[1]; })) === JSON.stringify([2, 1, 4]), "Rest second ease is 2-1-4");
assert(engine.easeSeconds(1, "inhale2", 2) === 1, "Rest top-up must stay 1s");
assert(engine.easeSeconds(2, "inhale", 2) === 2, "no phase under 2s except the Rest top-up");
const restPhasesBefore = JSON.stringify(rest.phases);
engine.easePhases(rest, 2);
assert(JSON.stringify(rest.phases) === restPhasesBefore, "easePhases must not mutate the original pattern");
[1, 2].forEach(function (level) {
  engine.easePhases(rest, level).phases.forEach(function (phase) {
    const floor = phase.id === "inhale2" ? 1 : 2;
    assert(phase.seconds >= floor, "eased " + phase.id + " must respect the " + floor + "s floor");
  });
});

assert(engine.PREF_KEYS.bodySetup === "breathe.bodySetup", "body setup pref key must be breathe.bodySetup");
assert(engine.PREF_KEYS.hum === "breathe.hum", "hum pref key must be breathe.hum");
assert(engine.HUM_EXHALE_HZ > 100 && engine.HUM_EXHALE_HZ < engine.HUM_INHALE_HZ, "exhale hum must be a lower tone than the inhale swell");
assert(/mouth exhale/i.test(readme) && /Do not breathe this pattern nose-only|not nose-only/i.test(readme), "README Rest notes must make the mouth exhale explicit and must not read as nose-only");
assert(/Nose inhale and nose exhale/i.test(readme), "README Energy/HRV notes must state nose inhale and nose exhale");
assert(/all through the nose/i.test(readme) && /nose inhale, nose hold, nose exhale, nose hold/i.test(readme), "README Focus notes must keep the box on the nose");

for (const pattern of Object.values(breathing.PATTERNS)) {
  const colorKeys = new Set(pattern.phases.map(function (phase) {
    return phase.id;
  }));
  for (const key of colorKeys) {
    assert(Boolean(pattern.colors[key]), pattern.id + " needs a distinct color for " + key);
  }
}

const min = breathing.MIN_SCALE;
const max = breathing.MAX_SCALE;
assert(typeof engine.phaseAt === "function" && typeof engine.scaleFor === "function", "shipped phaseAt/scaleFor must exist");

const restStart = engine.scaleFor(engine.phaseAt(rest, 0));
const restEndInhale1 = engine.scaleFor(engine.phaseAt(rest, rest.phases[0].seconds * 1000 - 1));
const restStartInhale2 = engine.scaleFor(engine.phaseAt(rest, rest.phases[0].seconds * 1000));
const restEndInhale2 = engine.scaleFor(engine.phaseAt(rest, (rest.phases[0].seconds + rest.phases[1].seconds) * 1000 - 1));
const restStartExhale = engine.scaleFor(engine.phaseAt(rest, (rest.phases[0].seconds + rest.phases[1].seconds) * 1000));
const restEndExhale = engine.scaleFor(engine.phaseAt(rest, engine.cycleMs(rest) - 1));

nearly(restStart, min, 0.02, "Rest should start near MIN_SCALE");
assert(restEndInhale1 > min, "Rest scale at the end of inhale 1 must be greater than MIN_SCALE");
assert(restStartInhale2 > min + 0.08, "second inhale must not reset to MIN_SCALE");
assert(Math.abs(restStartInhale2 - restEndInhale1) < 0.05, "second inhale should continue from the first inhale's end scale");
assert(restEndInhale2 > restEndInhale1, "scale at the end of inhale 2 must be greater than end of inhale 1");
assert(restEndInhale2 > max - 0.05, "end of inhale 2 should be at/near MAX_SCALE");
assert(restStartExhale > max - 0.05, "exhale should begin at/near MAX_SCALE");
assert(restEndExhale < min + 0.05, "exhale should shrink toward MIN_SCALE");

const energy = breathing.PATTERNS.energy;
nearly(engine.scaleFor(engine.phaseAt(energy, 0)), min, 0.02, "Energy inhale should start near MIN_SCALE");
nearly(engine.scaleFor(engine.phaseAt(energy, 4000 - 1)), max, 0.02, "Energy inhale should end near MAX_SCALE");
nearly(engine.scaleFor(engine.phaseAt(energy, 6000 - 1)), min, 0.02, "Energy exhale should end near MIN_SCALE");

const clock = engine.createSessionClock(breathing.SESSION_MS);
let now = 1000;
clock.start(now);
now += 8000;
const elapsedBeforePause = clock.elapsed(now);
const remainingBeforePause = clock.remaining(now);
const scaleBeforePause = engine.scaleFor(engine.phaseAt(rest, elapsedBeforePause));
clock.pause(now);
for (let i = 0; i < 12; i += 1) {
  now += 16;
  assert(clock.isPaused(), "clock should stay paused");
  assert(clock.elapsed(now) === elapsedBeforePause, "paused elapsed must stay frozen");
  assert(clock.remaining(now) === remainingBeforePause, "paused remaining must stay frozen");
  assert(
    engine.scaleFor(engine.phaseAt(rest, clock.elapsed(now))) === scaleBeforePause,
    "paused scale must stay frozen"
  );
}
clock.resume(now);
now += 2000;
assert(!clock.isPaused(), "resume should clear pause");
assert(clock.elapsed(now) === elapsedBeforePause + 2000, "resume must continue from the pause point, not restart 5:00");
assert(clock.remaining(now) === remainingBeforePause - 2000, "remaining should keep counting down after resume");
assert(clock.elapsed(now) !== 0 && clock.remaining(now) !== breathing.SESSION_MS, "resume must not restart the session");

breathing.DURATION_MINUTES.forEach(function (minutes) {
  const ms = minutes * 60 * 1000;
  const timed = engine.createSessionClock(ms);
  const t0 = 250;
  timed.start(t0);
  assert(timed.remaining(t0) === ms, minutes + "-minute clock remaining at t=0 must be " + ms + "ms");
  assert(timed.elapsed(t0) === 0, minutes + "-minute clock elapsed at t=0 must be 0");
  assert(timed.remaining(t0 + ms) === 0, minutes + "-minute session must complete at " + ms + "ms (remaining 0)");
  assert(timed.elapsed(t0 + ms) === ms, minutes + "-minute elapsed at session end must equal duration");
  assert(timed.remaining(t0 + Math.floor(ms / 2)) === ms - Math.floor(ms / 2), minutes + "-minute remaining must track the selected length, not a hard-coded 5:00");
});

const midNow = now;
clock.stop();
assert(clock.elapsed(midNow + 50) === 0, "stop/end resets the clock");

function rng(values) {
  let i = 0;
  return function () {
    const value = values[Math.min(i, values.length - 1)];
    i += 1;
    return value;
  };
}

const twoMids = engine.planGlimpses(breathing.SESSION_MS, rng([0.1, 0.2, 0.55, 0.8]));
const threeMids = engine.planGlimpses(breathing.SESSION_MS, rng([0.9, 0.15, 0.4, 0.7]));
[twoMids, threeMids].forEach(function (schedule, index) {
  const types = schedule.windows.map(function (window) {
    return window.type;
  });
  const mids = schedule.windows.filter(function (window) {
    return window.type === "mid";
  });
  const start = schedule.windows.find(function (window) {
    return window.type === "start";
  });
  const end = schedule.windows.find(function (window) {
    return window.type === "end";
  });
  assert(Boolean(start) && start.start === 0, "glimpse schedule must include a near-start window");
  assert(engine.isCountdownVisible(0, schedule, false), "timer should show near 5:00");
  assert(engine.isCountdownVisible(500, schedule, false), "start glimpse should cover the opening seconds");
  assert(Boolean(end), "glimpse schedule must include a near-end window");
  const endMid = (end.start + end.end) / 2;
  const remainingAtEnd = breathing.SESSION_MS - endMid;
  assert(remainingAtEnd > 20000 && remainingAtEnd < 45000, "end glimpse should sit near 0:30 remaining");
  assert(engine.isCountdownVisible(end.start + 10, schedule, false), "timer should show in the end window");
  assert(mids.length === 2 || mids.length === 3, "there must be 2–3 mid-session glimpses");
  assert(schedule.windows.length >= 4 && schedule.windows.length <= 5, "about 4–5 glimpses total");
  assert(types.includes("start") && types.includes("end") && types.includes("mid"), "start, mid, and end glimpses required");
  mids.forEach(function (window) {
    assert(window.start > 10000 && window.end < breathing.SESSION_MS - 20000, "mid glimpses stay in the middle of the session");
  });
  const quiet = 120000;
  const hit = engine.isCountdownVisible(quiet, schedule, false);
  assert(engine.isCountdownVisible(quiet, schedule, true) === true, "Always show timer must force visibility");
  if (!hit) {
    assert(engine.isCountdownVisible(quiet, schedule, false) === false, "default path hides the timer outside glimpses");
  }
  assert(index === 0 ? mids.length === 2 : mids.length === 3, "rng should be able to pick both 2 and 3 mids");
});

[60 * 1000, 2 * 60 * 1000].forEach(function (ms) {
  const label = ms / 60000 + " min";
  const seeds = [
    [0.1, 0.2, 0.55, 0.8],
    [0.9, 0.15, 0.4, 0.7],
    [0.01, 0.99, 0.3, 0.6],
  ];
  seeds.forEach(function (seed) {
    const schedule = engine.planGlimpses(ms, rng(seed));
    const start = schedule.windows.find(function (window) {
      return window.type === "start";
    });
    const end = schedule.windows.find(function (window) {
      return window.type === "end";
    });
    assert(Boolean(start) && start.start === 0, label + " glimpse schedule must include a start window at 0");
    assert(Boolean(end), label + " glimpse schedule must include a near-end window");
    assert(schedule.windows.length >= 2 && schedule.windows.length <= 5, label + " must stay at most ~4–5 glimpses");
    schedule.windows.forEach(function (window) {
      assert(window.start >= 0 && window.end <= ms, label + " glimpse must stay inside the session");
      assert(window.start < window.end, label + " glimpse window must have duration");
      assert(window.end <= ms, label + " must not run past 0:00");
    });
    const endMid = (end.start + end.end) / 2;
    const remainingAtEnd = ms - endMid;
    assert(remainingAtEnd > 0, label + " near-end glimpse must sit before 0:00");
    assert(end.start > ms * 0.5, label + " near-end glimpse must be in the second half of the session");
    assert(engine.isCountdownVisible(0, schedule, false), label + " timer should show at start");
    assert(engine.isCountdownVisible(end.start + 10, schedule, false), label + " timer should show in the end window");
  });
});

assert(engine.FORESHADOW_MS >= 400 && engine.FORESHADOW_MS <= 600, "foreshadow window must be 0.4–0.6s");
const inhaleMs = energy.phases[0].seconds * 1000;
const foreshadowOn = engine.phaseAt(energy, inhaleMs - engine.FORESHADOW_MS);
const foreshadowLate = engine.phaseAt(energy, inhaleMs - 120);
const foreshadowEarly = engine.phaseAt(energy, inhaleMs - engine.FORESHADOW_MS - 200);
const foreshadowMid = engine.phaseAt(energy, inhaleMs / 2);
assert(engine.foreshadowActive(foreshadowOn), "foreshadow should be active at the window start");
assert(engine.foreshadowActive(foreshadowLate), "foreshadow should be active in the last fraction of a phase");
assert(!engine.foreshadowActive(foreshadowEarly), "foreshadow must not start before the last 0.4–0.6s");
assert(!engine.foreshadowActive(foreshadowMid), "foreshadow must not be active mid-phase");

const reducedA = engine.scaleFor(engine.phaseAt(energy, 0), { reducedMotion: true });
const reducedB = engine.scaleFor(engine.phaseAt(energy, 3999), { reducedMotion: true });
const reducedC = engine.scaleFor(engine.phaseAt(energy, 5000), { reducedMotion: true });
const reducedRest = engine.scaleFor(engine.phaseAt(rest, 2500), { reducedMotion: true });
assert(reducedA === reducedB && reducedB === reducedC && reducedC === reducedRest, "reduced-motion path must not apply the large scale pulse");
assert(engine.scaleFor(engine.phaseAt(energy, 3999)) > reducedB + 0.1, "normal path still uses a large scale pulse");
assert(engine.opacityFor(engine.phaseAt(energy, 0), { reducedMotion: true }) < engine.opacityFor(engine.phaseAt(energy, 3999), { reducedMotion: true }), "reduced-motion should pulse opacity instead");

const sessionChunk = html.slice(html.indexOf('id="session"'), html.indexOf("<script"));
assert(/id="bubble"/.test(sessionChunk), "session needs a bubble");
assert(/id="countdown"/.test(sessionChunk), "session needs a countdown");
assert(/id="pause-btn"/.test(sessionChunk) && />Pause</.test(sessionChunk), "session needs a Pause control");
assert(/id="end-btn"/.test(sessionChunk) && />End</.test(sessionChunk), "session needs an End control");
assert(/id="ease-btn"/.test(sessionChunk) && /aria-label="Easier"/.test(sessionChunk), "session needs a minimal Ease control");
assert(/What's the smallest next move\?/.test(sessionChunk), "completion line must live in the session markup");
assert(/id="next-move"[^>]*hidden/.test(sessionChunk), "completion line must be hidden until the session completes");
assert(!/<input|<textarea/i.test(sessionChunk), "completion must not include an input");
assert(!/\b(inhale|exhale|hold|breathe)\b/i.test(sessionChunk), "session markup must not include breathing-phase words");
assert(!/id="technique"/.test(sessionChunk), "technique line must not be in the session");
assert(!/id="preroll"/.test(sessionChunk), "body-setup pre-roll must not sit inside the session screen");
assert(/id="home"/.test(html) && /id="start"/.test(html), "home needs a Start control");
assert(/id="technique"/.test(html), "home needs a technique line");
assert(/id="durations"/.test(html), "home needs a duration control");
assert(/data-minutes="1"/.test(html) && /data-minutes="2"/.test(html) && /data-minutes="5"/.test(html) && /data-minutes="10"/.test(html), "duration control must list 1, 2, 5, and 10 minutes");
assert(/data-minutes="5"[^>]*aria-checked="true"|class="duration is-selected"[^>]*data-minutes="5"/.test(html), "5 minutes must be the default selected duration in markup");
assert(/>5:00</.test(html), "default remaining in markup is 5:00");
assert(/id="pref-timer"/.test(html) && /id="pref-audio"/.test(html) && /id="pref-haptics"/.test(html), "home needs timer, audio, and haptics toggles");
assert(!/id="pref-timer"[^>]*checked/.test(html), "Always show timer must default off");
assert(!/id="pref-audio"[^>]*checked/.test(html), "audio must default off");
assert(!/id="pref-haptics"[^>]*checked/.test(html), "haptics must default off");
assert(/id="quick-reset"/.test(html) && /Quick Reset/.test(html), "home needs a prominent Quick Reset button");
assert(/id="needs"/.test(html) && /data-need="spike"/.test(html) && /data-need="fog"/.test(html) && /data-need="low-energy"/.test(html) && /data-need="sleep"/.test(html), "home needs Spike / Fog / Low energy / Sleep need chips");
assert(/>Spike</.test(html) && />Fog</.test(html) && />Low energy</.test(html), "need chips must use the Spike / Fog / Low energy labels");
assert(/id="preroll"/.test(html) && /id="preroll-cue"/.test(html), "body-setup pre-roll screen must exist outside the session");
assert(html.indexOf('id="preroll"') < html.indexOf('id="session"'), "pre-roll must come before the session screen");
assert(/id="pref-body-setup"/.test(html) && /id="pref-body-setup"[^>]*checked/.test(html), "Body setup before sessions must default ON in markup");
assert(/id="pref-hum"/.test(html) && !/id="pref-hum"[^>]*checked/.test(html), "Hum on the exhale must default off");
assert(/id="duration-note"/.test(html), "Energy cap needs a duration note element");
assert(/Feet/.test(js) && /Stack/.test(js) && /Hands/.test(js) && /Jaw/.test(js) && /Eyes/.test(js) && /Exhale/.test(js), "pre-roll cues must cycle Feet Stack Hands Jaw Eyes Exhale");
assert(!/\b(Feet|Stack|Hands|Jaw)\b/.test(sessionChunk), "pre-roll cue words must not appear in the session screen");

assert(css.includes("--scale"), "CSS must drive bubble scale from a variable");
assert(/\.countdown[\s\S]{0,220}opacity[\s\S]{0,80}transition[\s\S]{0,40}opacity/.test(css.replace(/\n/g, " ")) || /transition:\s*opacity\s+9\d{2}ms/.test(css), "countdown must fade, not flash");
assert(css.includes("prefers-reduced-motion"), "reduced-motion rule must exist");
assert(css.includes('data-mood="calm"') && css.includes('data-mood="bright"'), "Rest atmosphere must be distinct/dimmer than Energy");
assert(js.includes("requestAnimationFrame"), "session animation must be clock-driven");
assert(engineSrc.includes("phaseAt") && engineSrc.includes("scaleFor"), "bubble size must follow real phase durations");
assert(js.includes("keydown") && js.includes("Escape") && js.includes(" "), "Space and Escape handling must exist");
const persistSrc = js + engineSrc;
assert(js.includes("localStorage") && persistSrc.includes("breathe.alwaysTimer") && persistSrc.includes("breathe.audio") && persistSrc.includes("breathe.haptics"), "toggles must persist via localStorage keys");
assert(engine.PREF_KEYS.duration === "breathe.duration" && persistSrc.includes("breathe.duration"), "selected duration must persist in localStorage");
assert(persistSrc.includes("breathe.bodySetup") && persistSrc.includes("breathe.hum"), "body setup and hum prefs must persist");
assert(/readPref\(\s*PREF_KEYS\.bodySetup\s*,\s*true\s*\)/.test(js), "body setup must treat a missing key as on");
assert(/createSessionClock\(ms\)/.test(js) && /planGlimpses\(ms\)/.test(js), "session clock and glimpses must use the selected duration");
assert(/effectiveMinutes\(currentPattern\(\),\s*selectedMinutes\)/.test(js), "session length must go through effectiveMinutes so Energy caps at 1 minute");
assert(/PATTERN_ORDER = \["rest", "energy", "hrv", "focus", "sleep"\]/.test(js), "home pattern order must include Sleep as the fifth pattern");
assert(/function startQuickReset/.test(js) && /sessionKind = "quick-reset"/.test(js) && /quickResetMs/.test(js), "Quick Reset must start a dedicated short Rest session");
{
  const qrStart = js.indexOf("function startQuickReset");
  const qrEnd = js.indexOf("function pauseSession", qrStart);
  const qrFn = qrStart >= 0 && qrEnd > qrStart ? js.slice(qrStart, qrEnd) : "";
  assert(/startSession/.test(qrFn), "Quick Reset must call startSession");
  assert(!/showPreroll/.test(qrFn), "Quick Reset must skip the body-setup pre-roll");
}
assert(/key === "e" \|\| key === "E"/.test(js) && /bumpEase|easeLevel/.test(js), "Ease needs an E keyboard shortcut");
assert(/easePhases\(basePattern\(\),\s*easeLevel\)/.test(js) && /cycleOriginMs/.test(js), "Ease must apply from the next cycle via cycleOriginMs");
assert(/Hum softly on the exhale/.test(js), "hum toggle must mention humming on the home technique line");
assert(/triangle/.test(js) && /HUM_EXHALE_HZ/.test(js), "humming must switch the exhale tone when soft audio is on");
assert(/dropCountAfterMs/.test(js), "Sleep must drop the on-screen count after the settle window");
assert(/What's the smallest next move\?/.test(js) || /showNextMove/.test(js), "completion must reveal the next-move line");
assert(!/countdownEl\.textContent = "5:00"/.test(js), "home/session countdown must not hard-code 5:00");
assert(!/planGlimpses\(SESSION_MS\)/.test(js), "glimpse planning must not freeze the default 5:00 length");
assert(js.includes("AudioContext") && js.includes("vibrate"), "audio and haptics paths must exist");
assert(js.includes("startAudio") && js.includes("muteAudio") && js.includes("stopAudio"), "audio must start on gesture and mute on pause/end");

const vibrateSupportCheck = 'typeof navigator !== "undefined" && typeof navigator.vibrate === "function"';
assert(js.includes(vibrateSupportCheck), "app.js must detect vibrate support at load with the specified typeof check");
const supportCheckIdx = js.indexOf(vibrateSupportCheck);
const maybeHapticIdx = js.indexOf("function maybeHaptic");
assert(supportCheckIdx !== -1 && (maybeHapticIdx === -1 || supportCheckIdx < maybeHapticIdx), "vibrate support must be computed once at load, not only inside maybeHaptic");
assert(/prefHapticsEl\.disabled\s*=\s*true/.test(js), "unsupported path must disable the haptics checkbox");
assert(/not available on this device|not supported|iPhone not supported/i.test(js), "unsupported path must relabel haptics as unavailable");
assert(/prefHapticsEl\.checked\s*=\s*false/.test(js), "unsupported path must not leave a stored-on haptics preference looking enabled");
assert(/if\s*\(\s*hapticsSupported\s*\)[\s\S]{0,80}navigator\.vibrate/.test(js), "navigator.vibrate must stay gated by the load-time support result");
assert(/first \|\| clock\.isPaused\(\) \|\| completing \|\| !prefs\.haptics/.test(js), "supported haptic path must still skip first paint, pause, complete, and toggle-off");
assert(/navigator\.vibrate\(\s*12\s*\)/.test(js), "supported path must still light-vibrate on phase change");
assert(/iOS Safari/i.test(readme) && /Add-to-Home-Screen/i.test(readme) && /does not implement vibrate|no vibrate|not implement vibrate/i.test(readme), "README must document that iOS Safari / Add-to-Home-Screen does not implement vibrate");
assert(/Soft audio[\s\S]{0,80}iPhone cue|iPhone cue[\s\S]{0,80}Soft audio/i.test(readme), "README must document Soft audio as the iPhone cue");

const guilt = /(streak|shame|guilt|you failed|you missed|incomplete session|keep going|don't give up|try again|you stopped)/i;
assert(!guilt.test(html) && !guilt.test(js), "End must not use guilt, streak, or shame copy");

assert(/manifest\.webmanifest/.test(html), "HTML must link the web app manifest");
assert(/sw\.js/.test(js), "app must register the service worker");
assert(/"display"\s*:\s*"standalone"/.test(manifest), "manifest should be installable (standalone)");
assert(sw.includes("caches") && sw.includes("index.html") && sw.includes("engine.js"), "service worker must cache the static app shell");
assert(/const CACHE = "breathe-shell-v2"/.test(sw), "service worker cache name must bump to breathe-shell-v2");
assert(!/const CACHE = "breathe-shell-v1"/.test(sw), "service worker must not keep the v1 cache name");
assert(existsSync(path.join(root, "icon-192.png")) && existsSync(path.join(root, "icon-512.png")), "PWA icons must exist");
assert(existsSync(path.join(root, "favicon.svg")), "favicon.svg must remain");

assert(/Pause/.test(readme) && /Resume/.test(readme) && /Escape/.test(readme) && /Space/.test(readme), "README must document Pause/Resume/End and shortcuts");
assert(/Always show timer/.test(readme) && /breathe\.alwaysTimer/.test(readme), "README must document the timer toggle and persistence");
assert(/breathe\.duration/.test(readme) && /1, 2, 5, or 10 minutes/.test(readme), "README must document selectable 1/2/5/10-minute sessions");
assert(!/Each session is exactly five minutes/.test(readme), "README must not claim every session is exactly five minutes");
assert(/Soft audio/.test(readme) && /Haptics/.test(readme), "README must document audio and haptics toggles");
assert(/Balban/.test(readme) && /2023/.test(readme) && /cyclic sighing/i.test(readme), "README must cite Balban et al. 2023 / cyclic sighing");
assert(/First nasal inhale \| 2/.test(readme) && /Second nasal top-up \| 1/.test(readme) && /Long mouth exhale \| 6/.test(readme), "README must document Rest seconds");
assert(/Add to Home Screen/.test(readme) && /file:\/\//.test(readme) && /http\.server/.test(readme), "README must document PWA install vs file://");
assert(/Manual checklist/.test(readme), "README must keep a manual checklist");
assert(/Quick Reset/.test(readme) && /30 seconds|~30|about 30|three/.test(readme), "README must document Quick Reset");
assert(/Sleep/.test(readme) && /4–6|4-6/.test(readme) && /drop the count|counts fade/i.test(readme), "README must document Sleep 4-6 and drop-the-count");
assert(/one minute/.test(readme) && /lightheaded/.test(readme) && /More air isn't better/.test(readme), "README must document the Energy 1-minute cap and safety line");
assert(/Body setup before sessions/.test(readme) && /breathe\.bodySetup/.test(readme), "README must document body setup and its localStorage key");
assert(/Ease/.test(readme) && /`E`/.test(readme), "README must document Ease and the E shortcut");
assert(/Spike/.test(readme) && /Fog/.test(readme) && /Low energy/.test(readme), "README must document pick-by-need chips");
assert(/Hum on the exhale/.test(readme) && /breathe\.hum/.test(readme) && /Hum softly on the exhale/.test(readme), "README must document humming");
assert(/What's the smallest next move\?/.test(readme), "README must document the completion prompt");
assert(/`1`–`5`|1`–`5/.test(readme), "README keyboard table must include keys 1-5");

if (failures.length) {
  console.error("check failed:");
  failures.forEach(function (failure) {
    console.error(" - " + failure);
  });
  process.exit(1);
}

console.log("ok — 5 protocols, Quick Reset, Energy cap, Sleep drop-count, ease, PWA shell");

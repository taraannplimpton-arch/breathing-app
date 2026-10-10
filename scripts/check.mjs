import { createRequire } from "node:module";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { inflateSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const breathing = require(path.join(root, "protocols.js"));
const engine = require(path.join(root, "engine.js"));
const native = require(path.join(root, "native.js"));
const html = readFileSync(path.join(root, "index.html"), "utf8");
const protocolsSrc = readFileSync(path.join(root, "protocols.js"), "utf8");
const css = readFileSync(path.join(root, "styles.css"), "utf8");
const js = readFileSync(path.join(root, "app.js"), "utf8");
const engineSrc = readFileSync(path.join(root, "engine.js"), "utf8");
const nativeSrc = readFileSync(path.join(root, "native.js"), "utf8");
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
assert(Object.keys(breathing.PATTERNS).length === 5, "there must be exactly five timed patterns");
assert(breathing.APP_VERSION === "1.5.0", "APP_VERSION must be 1.5.0");
assert((protocolsSrc.match(/1\.5\.0/g) || []).length === 1, "1.5.0 must be a single constant in protocols.js");
assert(!Object.prototype.hasOwnProperty.call(breathing, "QUICK_RESET_CYCLES"), "Quick Reset config must be removed");

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
assert(Boolean(rest), "missing Calm Down pattern");
assert(rest.id === "rest", "Calm Down must keep the internal id rest");
assert(rest.homeLabel === "Calm Down", "the rest pattern must display as Calm Down");
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

const urge = breathing.URGE;
const thinkFirstDescription = "That airport candy, the reply-all, the cart checkout. Breathe first, then decide.";
assert(Boolean(urge), "Think First config must exist");
assert(urge.id === "urge", "Think First must keep the internal id urge");
assert(urge.homeLabel === "Think First", "the sixth card must be labeled Think First");
assert(urge.protocol === "4–6", "Think First protocol line must stay short");
assert(urge.technique === "Stop, notice, then choose.", "Think First technique line must match");
assert(typeof urge.technique === "string" && urge.technique.length > 0 && urge.technique.length <= 80, "Think First technique line must be short");
assert(urge.description === thinkFirstDescription, "Think First description must match");
assert(urge.durationNote === "About 3 minutes.", "Think First must say it is about 3 minutes");
assert(!Object.prototype.hasOwnProperty.call(breathing.PATTERNS, "urge"), "Think First stays outside the five timed patterns");
assert(Object.keys(breathing.PATTERNS).length === 5, "the five timed patterns must stay five");
assert(urge.stopMs === 5000, "Stop must be 5s");
assert(urge.observeMs === 10000, "Observe must be 10s");
assert(urge.expandMs === 8000, "Expand must be 8s");
assert(urge.waveRiseMs === 60000, "the urge wave must crest at 60s");
assert(urge.breaths === 15, "Breathe must be 15 breaths");
assert(urge.breathCountWrap === 10, "breath counting must wrap at 10");
assert(urge.pattern.mood === "still", "Ride the Urge needs its own calm mood");
assert(urge.pattern.phases.length === 2, "Ride the Urge breathe is inhale then exhale");
assert(urge.pattern.phases[0].id === "inhale" && urge.pattern.phases[0].seconds === 4, "Ride the Urge inhale must be 4s");
assert(urge.pattern.phases[1].id === "exhale" && urge.pattern.phases[1].seconds === 6, "Ride the Urge exhale must be 6s");
assert(engine.cycleMs(urge.pattern) === 10000, "Ride the Urge cycle must be 10s (6 breaths/min)");
assert(engine.urgeBreatheMs(urge) === 150000, "15 breaths of 4-6 must be 150s");
assert(Boolean(urge.pattern.colors.inhale) && Boolean(urge.pattern.colors.exhale), "Ride the Urge needs inhale and exhale colors");
for (const pattern of Object.values(breathing.PATTERNS)) {
  assert(pattern.colors.inhale.fill !== urge.pattern.colors.inhale.fill, "urge palette must be distinct from " + pattern.id);
}
assert(urge.lines.stop === "Pause. Put it down.", "Stop line must match");
assert(urge.lines.observe === "Notice the pull. Where do you feel it?", "Observe line must match");
assert(urge.lines.expand === "Notice what changed. Widen your view.", "Expand line must match");
assert(urge.lines.respond === "What's your next move?", "Respond line must match");
assert(urge.lines.again === "Another round", "Another round label must match");
assert(urge.lines.done === "Done", "Done label must match");
const drinkingLine = "If you drink heavily every day, talk to a doctor before stopping suddenly.";
assert(!html.includes(drinkingLine), "index.html must not include the heavy-drinking line");
assert(!js.includes(drinkingLine), "app.js must not include the heavy-drinking line");
assert(!protocolsSrc.includes(drinkingLine), "protocols.js must not include the heavy-drinking line");
assert(engine.urgeBreathLabel(0) === "1", "first breath displays 1");
assert(engine.urgeBreathLabel(9) === "10", "tenth breath displays 10");
assert(engine.urgeBreathLabel(10) === "1", "eleventh breath wraps to 1");
assert(engine.urgeBreathLabel(14) === "5", "fifteenth breath displays 5");
const urgeCountShown = [];
for (let i = 0; i < 30; i += 1) {
  const label = engine.urgeBreathLabel(i, urge.breathCountWrap);
  urgeCountShown.push(label);
  const n = Number(label);
  assert(label === String((i % 10) + 1), "breath count must wrap 1-10 at cycle " + i);
  assert(n >= 1 && n <= 10, "breath count must stay in 1..10");
}
assert(urgeCountShown.slice(0, 15).join(",") === "1,2,3,4,5,6,7,8,9,10,1,2,3,4,5", "15 breaths display 1-10 then 1-5");
assert(engine.urgeWaveLevel(0) === 0, "wave starts low");
assert(engine.urgeWaveLevel(30000) === 0.5, "wave is halfway up at 30s");
assert(engine.urgeWaveLevel(60000) === 1, "wave crests at 60s");
assert(engine.urgeWaveLevel(105000) === 0.5, "wave is halfway down after the crest");
assert(engine.urgeWaveLevel(150000) === 0, "wave has subsided at 150s");
assert(engine.urgeWaveLevel(-50) === 0, "wave clamps before the start");
assert(engine.urgeWaveLevel(999999) === 0, "wave clamps after the end");
const urgeRise = [0, 20000, 40000, 60000].map(function (ms) {
  return engine.urgeWaveLevel(ms);
});
for (let i = 1; i < urgeRise.length; i += 1) {
  assert(urgeRise[i] > urgeRise[i - 1], "urge wave must rise through the first minute");
}
const urgeFall = [60000, 90000, 120000, 150000].map(function (ms) {
  return engine.urgeWaveLevel(ms);
});
for (let i = 1; i < urgeFall.length; i += 1) {
  assert(urgeFall[i] < urgeFall[i - 1], "urge wave must subside after the crest");
}
const urgeClock = engine.createSessionClock(engine.urgeBreatheMs(urge));
const urgeT0 = 50;
urgeClock.start(urgeT0);
assert(urgeClock.remaining(urgeT0) === 150000, "uneased Ride the Urge clock is 150s");
assert(urgeClock.remaining(urgeT0 + 150000) === 0, "uneased Ride the Urge clock ends at 150s");
nearly(engine.scaleFor(engine.phaseAt(urge.pattern, 0)), breathing.MIN_SCALE, 0.02, "Ride the Urge inhale should start near MIN_SCALE");
nearly(engine.scaleFor(engine.phaseAt(urge.pattern, 4000 - 1)), breathing.MAX_SCALE, 0.02, "Ride the Urge inhale should end near MAX_SCALE");
nearly(engine.scaleFor(engine.phaseAt(urge.pattern, 10000 - 1)), breathing.MIN_SCALE, 0.02, "Ride the Urge exhale should end near MIN_SCALE");

assert(!Object.prototype.hasOwnProperty.call(engine, "quickResetMs"), "Quick Reset timing helper must be removed");

function easeIds(pattern, level) {
  return engine.easePhases(pattern, level).phases.map(function (phase) {
    return [phase.id, phase.seconds];
  });
}
assert(JSON.stringify(easeIds(sleep, 0)) === JSON.stringify([["inhale", 4], ["exhale", 6]]), "ease level 0 must be identity");
assert(JSON.stringify(easeIds(breathing.URGE.pattern, 0)) === JSON.stringify([["inhale", 4], ["exhale", 6]]), "Ride the Urge ease 0 stays 4-6");
assert(JSON.stringify(easeIds(breathing.URGE.pattern, 1)) === JSON.stringify([["inhale", 3], ["exhale", 5]]), "Ride the Urge eases to 3-5");
assert(JSON.stringify(easeIds(breathing.URGE.pattern, 2)) === JSON.stringify([["inhale", 2], ["exhale", 4]]), "Ride the Urge second ease is 2-4");
const urgePhasesBefore = JSON.stringify(breathing.URGE.pattern.phases);
engine.easePhases(breathing.URGE.pattern, 2);
assert(JSON.stringify(breathing.URGE.pattern.phases) === urgePhasesBefore, "easing Ride the Urge must not mutate its pattern");
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

{
  const sessionMs = 10 * 60 * 1000;
  const driftClock = engine.createSessionClock(sessionMs);
  let t = 40.25;
  driftClock.start(t);
  let expected = 0;
  let maxDrift = 0;
  const frameSteps = [16.67, 16.66, 8.33, 33.4, 16.7, 50.12, 16.67, 16.67, 41.2, 16.63];

  function noteDrift() {
    const actual = driftClock.elapsed(t);
    const drift = Math.abs(actual - expected);
    if (drift > maxDrift) {
      maxDrift = drift;
    }
    const remainingDrift = Math.abs(driftClock.remaining(t) - (sessionMs - expected));
    if (remainingDrift > maxDrift) {
      maxDrift = remainingDrift;
    }
  }

  function runFor(ms) {
    let left = ms;
    let i = 0;
    while (left > 0 && expected < sessionMs) {
      const step = Math.min(left, frameSteps[i % frameSteps.length], sessionMs - expected);
      i += 1;
      t += step;
      expected += step;
      noteDrift();
      left -= step;
    }
  }

  function pauseFor(ms) {
    driftClock.pause(t);
    noteDrift();
    t += Math.min(ms, 250);
    noteDrift();
    t += Math.max(0, ms - 250);
    noteDrift();
    assert(Math.abs(driftClock.elapsed(t) - expected) < 100, "paused elapsed must stay frozen across a background jump");
    driftClock.resume(t);
    noteDrift();
  }

  // Phase is phaseAt(clock elapsed). A summed frame counter can sit a fraction
  // of a millisecond on the other side of a boundary; that is not drift.
  function assertPhaseFollowsElapsed() {
    const elapsedNow = driftClock.elapsed(t);
    const fromClock = engine.phaseAt(breathing.PATTERNS.focus, elapsedNow);
    const fromExpected = engine.phaseAt(breathing.PATTERNS.focus, expected);
    const samePhase = fromClock.phase.id === fromExpected.phase.id && fromClock.index === fromExpected.index;
    const gap = Math.abs(elapsedNow - expected);
    assert(
      samePhase || gap < 1,
      "phases must follow elapsed timestamps, not a drifting frame counter"
    );
  }

  runFor(90 * 1000);
  assertPhaseFollowsElapsed();
  pauseFor(15 * 1000);
  runFor(3 * 60 * 1000);
  assertPhaseFollowsElapsed();
  pauseFor(40 * 1000);
  runFor(2 * 60 * 1000);
  assertPhaseFollowsElapsed();
  pauseFor(8 * 1000);
  runFor(sessionMs - expected);
  assertPhaseFollowsElapsed();
  assert(maxDrift < 100, "10-minute session with pauses must drift by less than 100ms (got " + maxDrift + "ms)");
  nearly(driftClock.elapsed(t), sessionMs, 100, "drift simulation must reach the 10-minute session end");
  nearly(driftClock.remaining(t), 0, 100, "drift simulation remaining must be ~0 at 10 minutes");
}

assert(/end - startAt - pausedTotal/.test(engineSrc), "session elapsed must be wall timestamps minus pause gaps, not a summed frame delta");
assert(/clock\.start\(performance\.now\(\)\)/.test(js), "the app must start the session clock from performance.now");
assert(/const now = performance\.now\(\);\s*clock\.pause\(now\)/.test(js), "pause must stamp performance.now");
assert(/const now = performance\.now\(\);\s*clock\.resume\(now\)/.test(js), "resume must stamp performance.now");
assert(!/clock\.(start|pause|resume|elapsed|seek)\(\s*Date\.now/.test(js), "the session clock must not use Date.now");
assert(!/\belapsed\s*\+=/.test(engineSrc) && !/\belapsedMs\s*\+=/.test(engineSrc), "engine must not accumulate elapsed from frame deltas");

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
assert(/id="pref-timer"/.test(html) && /id="pref-audio"/.test(html) && /id="pref-haptics"/.test(html), "settings needs timer, audio, and haptics switches");
assert(/id="pref-timer"[^>]*aria-checked="false"/.test(html), "Always show timer must default off");
assert(/id="pref-audio"[^>]*aria-checked="false"/.test(html), "audio must default off");
assert(/id="pref-haptics"[^>]*aria-checked="false"/.test(html), "haptics must default off");
assert(!/<input[^>]*type="checkbox"/i.test(html), "preferences must be switches, not checkboxes");
assert(!/id="quick-reset"/.test(html) && !/Quick Reset/.test(html), "home must not show Quick Reset");
assert(!/id="needs"/.test(html) && !/data-need=/.test(html), "home must not show need chips");
assert(!/>Spike</.test(html) && !/>Fog</.test(html) && !/>Low energy</.test(html), "need-chip labels must be gone");
assert(/id="preroll"/.test(html) && /id="preroll-cue"/.test(html), "body-setup pre-roll screen must exist outside the session");
assert(html.indexOf('id="preroll"') < html.indexOf('id="session"'), "pre-roll must come before the session screen");
assert(/id="pref-body-setup"/.test(html) && /id="pref-body-setup"[^>]*aria-checked="true"/.test(html), "Body setup before sessions must default ON in markup");
assert(/id="pref-hum"/.test(html) && /id="pref-hum"[^>]*aria-checked="false"/.test(html), "Hum on the exhale must default off");
assert(/id="duration-note"/.test(html), "Energy cap needs a duration note element");
assert(/Feet/.test(js) && /Stack/.test(js) && /Hands/.test(js) && /Jaw/.test(js) && /Eyes/.test(js) && /Exhale/.test(js), "pre-roll cues must cycle Feet Stack Hands Jaw Eyes Exhale");
assert(!/\b(Feet|Stack|Hands|Jaw)\b/.test(sessionChunk), "pre-roll cue words must not appear in the session screen");
assert(!/id="ride-urge"/.test(html), "Think First is a pattern card, not a separate home button");
assert(/id="pattern-description"/.test(html), "home needs a selected-pattern description line");
const aboutAt = html.indexOf('id="about"');
const aboutChunk = aboutAt >= 0 ? html.slice(aboutAt, html.indexOf('id="preroll"')) : "";
assert(aboutAt > 0 && aboutAt < html.indexOf('id="preroll"'), "about screen must sit with the other screens");
assert(/id="about-open"[^>]*aria-label="Information"/.test(html), "home needs an Information control with an accessible name");
assert(/id="about-open"[^>]*>\s*Information\s*<\/button>/.test(html), "home Information control must be a sentence-case text button");
assert(!/>\s*INFORMATION\s*</.test(html), "home must not use an uppercase INFORMATION label");
assert(/id="settings-open"[^>]*>\s*Settings\s*<\/button>/.test(html), "home needs a sentence-case Settings text button");
const aboutOpenTag = html.slice(html.indexOf('id="about-open"'), html.indexOf('id="about-open"') + 400);
assert(aboutOpenTag.indexOf("</button>") > 0 && !/<svg/.test(aboutOpenTag.slice(0, aboutOpenTag.indexOf("</button>"))), "Information control must not use an icon svg");
assert(/id="reset-settings"/.test(html) && /Reset settings/.test(html), "about needs a Reset settings button");
assert(/privacy\.html/.test(aboutChunk) && !/support\.html/.test(aboutChunk), "about must link to privacy and not support");
assert(/id="app-version"/.test(aboutChunk), "about must show the version from the app");
assert(/faint, dizzy, panicky, or have chest pain/.test(aboutChunk), "about must include the safety note");
assert(/not medical advice/.test(aboutChunk) && /not for emergencies/.test(aboutChunk), "about must say it is educational, not medical advice, and not for emergencies");
assert(!aboutChunk.includes(drinkingLine), "about must not include the heavy-drinking line");
assert(/Think First/.test(aboutChunk), "about must name Think First");
assert(/Six cards for six moments/.test(aboutChunk), "about must name the six cards");
assert(/Twizzlers at the airport/.test(aboutChunk), "about must include the Think First example");
assert(/aria-label="Think First"/.test(html), "the guide screen must be named Think First");
assert(/noodleelder@gmail\.com/.test(aboutChunk) && !/support@example\.com/.test(aboutChunk), "about must show noodleelder@gmail.com");
assert(html.includes(breathing.URGE.lines.respond), "respond screen must ask what's your next move");
assert(html.includes(breathing.URGE.lines.again) && html.includes(breathing.URGE.lines.done), "respond screen needs Another round and Done");
assert(/id="urge-wave"[^>]*aria-hidden/.test(html), "the urge wave must be decorative");
const guideAt = html.indexOf('id="urge-guide"');
const respondAt = html.indexOf('id="urge-respond"');
const sessionAt = html.indexOf('id="session"');
assert(guideAt > 0 && respondAt > guideAt && respondAt < sessionAt, "urge guide and respond screens must sit before the session");
assert(!/id="urge-guide"/.test(sessionChunk) && !/id="urge-respond"/.test(sessionChunk), "urge words must stay outside the session screen");
assert(!/What's your next move/.test(sessionChunk), "respond copy must not live in the session screen");
const guideChunk = html.slice(guideAt, respondAt);
assert(!/<input|<textarea|type="range"/i.test(guideChunk), "Observe must not ask for input");

assert(css.includes("--scale"), "CSS must drive bubble scale from a variable");
assert(/\.countdown[\s\S]{0,220}opacity[\s\S]{0,80}transition[\s\S]{0,40}opacity/.test(css.replace(/\n/g, " ")) || /transition:\s*opacity\s+9\d{2}ms/.test(css), "countdown must fade, not flash");
assert(css.includes("prefers-reduced-motion"), "reduced-motion rule must exist");
assert(css.includes(".urge-wave") && css.includes("--urge-level"), "the urge wave must be driven by --urge-level");
assert(/prefers-reduced-motion[\s\S]*\.urge-wave/.test(css) && /body\.reduce-motion \.urge-wave/.test(css), "reduced motion must keep the urge wave still");
assert(css.includes('data-mood="still"'), "Ride the Urge mood must be styled");
assert(css.includes('data-mood="calm"') && css.includes('data-mood="bright"'), "Rest atmosphere must be distinct/dimmer than Energy");

const homeChunk = html.slice(html.indexOf('id="home"'), html.indexOf('id="settings"'));
const settingsChunk = html.slice(html.indexOf('id="settings"'), html.indexOf('id="about"'));
assert(homeChunk.length > 0 && !/id="pref-/.test(homeChunk), "preference switches must not sit on the home screen");
assert(/role="dialog"/.test(settingsChunk) && /aria-modal="true"/.test(settingsChunk) && /aria-labelledby="settings-title"/.test(settingsChunk), "settings must be a modal dialog");
assert(/id="settings-close"/.test(settingsChunk) && />\s*Close\s*</.test(settingsChunk), "settings dialog needs a Close button");
["pref-timer", "pref-audio", "pref-haptics", "pref-body-setup", "pref-hum"].forEach(function (id) {
  assert(new RegExp('id="' + id + '"[^>]*role="switch"').test(settingsChunk), id + " must be a switch in the settings sheet");
});
assert(/id="pref-hum-note"/.test(settingsChunk) && /Only for Calm Down and Sleep/.test(settingsChunk), "hum switch must note it is only for Calm Down and Sleep");
assert(/prefHumEl\.disabled\s*=\s*!allowed/.test(js), "hum switch must disable unless Calm Down or Sleep is selected");
assert(/function openSettings/.test(js) && /function closeSettings/.test(js) && /function trapSettingsFocus/.test(js), "settings sheet must open, close, and trap focus");
assert(/settingsActive[\s\S]{0,200}Escape[\s\S]{0,120}closeSettings\(/.test(js), "Escape must close the settings sheet");
const sessionListen = js.indexOf('sessionEl.addEventListener("click"');
const sessionListenBody = sessionListen >= 0 ? js.slice(sessionListen, js.indexOf("if (prerollEl)", sessionListen)) : "";
assert(sessionListen !== -1 && !/togglePause/.test(sessionListenBody), "tapping the session screen must not pause");
assert(/pauseBtn\.addEventListener\("click"[\s\S]{0,180}togglePause\(/.test(js), "pause stays on the Pause button");
assert(/key === " " \|\| key === "Spacebar"[\s\S]{0,400}togglePause\(\)/.test(js), "Space still pauses for keyboard users");
assert(/visibilitychange/.test(js) && /visibilityState === "hidden"/.test(js), "background auto-pause must stay");
assert(/font:\s*-apple-system-body/.test(css), "root text must use -apple-system-body so user text size is respected");
[".text-btn", ".session-btn", ".duration", ".duration-note", ".pattern-protocol", ".preroll-hint", ".switch-label"].forEach(function (sel) {
  const escaped = sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const body = (css.match(new RegExp(escaped + "\\s*\\{([^}]*)\\}")) || [])[1] || "";
  assert(body.length > 0, "missing style " + sel);
  assert(!/text-transform:\s*uppercase/.test(body), sel + " must not use tiny uppercase");
  assert(/font-size:\s*(0\.94rem|1rem|1\.125rem)/.test(body), sel + " must use a sentence-case size around 15–17px");
});
[".text-btn", ".session-btn", ".duration", ".switch"].forEach(function (sel) {
  const escaped = sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const body = (css.match(new RegExp(escaped + "\\s*\\{([^}]*)\\}")) || [])[1] || "";
  assert(/min-height:\s*2\.75rem/.test(body), sel + " hit area must be at least 44px");
});
function contrastChannel(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function contrastLuminance(rgb) {
  return 0.2126 * contrastChannel(rgb[0]) + 0.7152 * contrastChannel(rgb[1]) + 0.0722 * contrastChannel(rgb[2]);
}
function contrastRatio(fg, bg) {
  const lighter = Math.max(contrastLuminance(fg), contrastLuminance(bg));
  const darker = Math.min(contrastLuminance(fg), contrastLuminance(bg));
  return (lighter + 0.05) / (darker + 0.05);
}
function parseHex(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}
const creamHex = (css.match(/--cream:\s*(#[0-9a-fA-F]{6})/) || [])[1];
const mutedHex = (css.match(/--muted:\s*(#[0-9a-fA-F]{6})/) || [])[1];
const inkHexes = [];
const inkRe = /--ink:\s*(#[0-9a-fA-F]{6})/g;
let inkMatch;
while ((inkMatch = inkRe.exec(css))) {
  inkHexes.push(inkMatch[1]);
}
const sheetHex = (css.match(/\.sheet-panel\s*\{[^}]*background:\s*(#[0-9a-fA-F]{6})/) || [])[1];
assert(Boolean(creamHex) && Boolean(mutedHex) && inkHexes.length >= 4 && Boolean(sheetHex), "main text colors must be defined");
inkHexes.concat([sheetHex]).forEach(function (bg) {
  assert(contrastRatio(parseHex(mutedHex), parseHex(bg)) >= 4.5, "secondary text " + mutedHex + " on " + bg + " must be at least 4.5:1");
  assert(contrastRatio(parseHex(creamHex), parseHex(bg)) >= 4.5, "primary text " + creamHex + " on " + bg + " must be at least 4.5:1");
});
function moodInk(mood) {
  const block = css.match(new RegExp('body\\[data-mood="' + mood + '"\\]\\s*\\{[^}]*--ink:\\s*(#[0-9a-fA-F]{6})'));
  if (block && block[1]) {
    return block[1];
  }
  return inkHexes[0];
}
const palettes = [];
Object.values(breathing.PATTERNS).forEach(function (pattern) {
  Object.keys(pattern.colors).forEach(function (phaseId) {
    palettes.push({
      id: pattern.id + "-" + phaseId,
      fill: pattern.colors[phaseId].fill,
      atmosphere: pattern.colors[phaseId].atmosphere,
      ink: moodInk(pattern.mood),
    });
  });
});
Object.keys(breathing.URGE.pattern.colors).forEach(function (phaseId) {
  palettes.push({
    id: "urge-" + phaseId,
    fill: breathing.URGE.pattern.colors[phaseId].fill,
    atmosphere: breathing.URGE.pattern.colors[phaseId].atmosphere,
    ink: moodInk(breathing.URGE.pattern.mood),
  });
});
assert(palettes.length >= 12, "every protocol palette must be contrast-checked");
palettes.forEach(function (entry) {
  const fill = parseHex(entry.fill);
  const vsAtm = contrastRatio(fill, parseHex(entry.atmosphere));
  const vsInk = contrastRatio(fill, parseHex(entry.ink));
  assert(
    vsAtm >= 3,
    "bubble " + entry.id + " fill " + entry.fill + " vs atmosphere " + entry.atmosphere + " at smallest scale must be >= 3:1 (got " + vsAtm.toFixed(2) + ")"
  );
  assert(
    vsInk >= 3,
    "bubble " + entry.id + " fill " + entry.fill + " vs background " + entry.ink + " at smallest scale must be >= 3:1 (got " + vsInk.toFixed(2) + ")"
  );
});
assert(breathing.MIN_SCALE < 0.5, "smallest bubble scale is the shrunk inhale/exhale size");
const nameFn = js.slice(js.indexOf("function cardAccessibleName"), js.indexOf("function cardSpec"));
assert(/homeLabel/.test(nameFn) && /protocol/.test(nameFn) && /technique/.test(nameFn) && /description/.test(nameFn), "card accessible name includes name, pattern, and description");
assert(/setAttribute\(\s*"aria-label"\s*,\s*cardAccessibleName\(/.test(js), "cards must expose that accessible name");
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
assert(/PATTERN_ORDER = \["rest", "energy", "hrv", "focus", "sleep", "urge"\]/.test(js), "home cards must be Calm Down, Energy, HRV, Focus, Sleep, then Think First");
assert(!/function startQuickReset|sessionKind = "quick-reset"|quickResetMs|QUICK_RESET/.test(js), "Quick Reset must be removed from the app");
{
  const requestStart = js.indexOf("function requestStart");
  const requestEnd = js.indexOf("function pauseSession", requestStart);
  const requestFn = requestStart >= 0 && requestEnd > requestStart ? js.slice(requestStart, requestEnd) : "";
  assert(/urgeSelected\(\)/.test(requestFn) && /startRideUrge\(\)/.test(requestFn), "selecting Think First and starting must open that flow");
  assert(!/showPreroll/.test(requestFn.split("startRideUrge")[0] || ""), "the urge branch must not show body setup");
}
assert(/key === "e" \|\| key === "E"/.test(js) && /bumpEase|easeLevel/.test(js), "Ease needs an E keyboard shortcut");
assert(/URGE\.lines\.stop/.test(js) && /URGE\.lines\.observe/.test(js) && /URGE\.lines\.expand/.test(js), "guide copy must come from the URGE config");
assert(/sessionKind = "urge"/.test(js), "Ride the Urge must use its own session kind");
assert(/urgeBreathLabel\(/.test(js), "the urge number must be a breath count");
assert(/urgeWaveLevel\(/.test(js), "the urge wave must follow the session clock");
assert(/urgeAfterBreathe = "respond"/.test(js), "Another round must return to Respond rather than Expand");
{
  const rideStart = js.indexOf("function startRideUrge");
  const rideEnd = js.indexOf("function startUrgeBreathe", rideStart);
  const rideFn = rideStart >= 0 && rideEnd > rideStart ? js.slice(rideStart, rideEnd) : "";
  assert(rideStart !== -1, "startRideUrge must exist");
  assert(/sessionKind = "urge"/.test(rideFn), "Ride the Urge must set its session kind");
  assert(!/showPreroll/.test(rideFn), "Ride the Urge must skip the body-setup pre-roll");
  assert(!/selectedMinutes/.test(rideFn), "Ride the Urge must ignore the duration picker");
  assert(/URGE\.lines\.stop/.test(rideFn), "Stop copy must come from URGE.lines.stop");
}
assert(Object.keys(engine.PREF_KEYS).length === 6, "Ride the Urge must not add a preference key");
["alwaysTimer", "audio", "haptics", "duration", "bodySetup", "hum"].forEach(function (key) {
  assert(Object.prototype.hasOwnProperty.call(engine.PREF_KEYS, key), "missing pref " + key);
});
assert(!/breathe\.urge/.test(persistSrc), "Ride the Urge must not add a localStorage key");
assert(!/localStorage\.setItem\([^)]*urge/i.test(js), "Ride the Urge must not write storage");
assert(/easePhases\(basePattern\(\),\s*easeLevel\)/.test(js) && /cycleOriginMs/.test(js), "Ease must apply from the next cycle via cycleOriginMs");
assert(/Hum softly on the exhale/.test(js), "hum toggle must mention humming on the home technique line");
assert(/triangle/.test(js) && /HUM_EXHALE_HZ/.test(js), "humming must switch the exhale tone when soft audio is on");
assert(/dropCountAfterMs/.test(js), "Sleep must drop the on-screen count after the settle window");
assert(/What's the smallest next move\?/.test(js) || /showNextMove/.test(js), "completion must reveal the next-move line");
assert(!/countdownEl\.textContent = "5:00"/.test(js), "home/session countdown must not hard-code 5:00");
assert(!/planGlimpses\(SESSION_MS\)/.test(js), "glimpse planning must not freeze the default 5:00 length");
assert(js.includes("AudioContext") && nativeSrc.includes("vibrate"), "audio and haptics paths must exist");
assert(js.includes("startAudio") && js.includes("muteAudio") && js.includes("stopAudio"), "audio must start on gesture and mute on pause/end");

assert(/typeof nav !== "undefined" && nav !== null && typeof nav\.vibrate === "function"/.test(nativeSrc), "native.js must detect vibrate support without assuming the bridge exists");
assert(js.indexOf("native.hapticsAvailable(window, navigator)") !== -1 && js.indexOf("native.hapticsAvailable(window, navigator)") < js.indexOf("function maybeHaptic"), "haptic support must be decided once at load, before maybeHaptic");
assert(/prefHapticsEl\.disabled\s*=\s*true/.test(js), "unsupported path must disable the haptics switch");
assert(/id="pref-haptics-wrap"[^>]*\bhidden\b/.test(html), "haptics switch must be hidden in markup until a haptic path exists");
assert(/wrap\.hidden\s*=\s*true/.test(js), "unsupported path must hide the haptics switch");
assert(/setSwitch\(\s*prefHapticsEl\s*,\s*false\s*\)/.test(js), "unsupported path must not leave a stored-on haptics preference looking enabled");
assert(/if\s*\(\s*hapticsSupported\s*\)[\s\S]{0,120}playHaptic\(/.test(js), "phase haptics must stay gated by the load-time support result");
assert(/first \|\| clock\.isPaused\(\) \|\| completing \|\| !prefs\.haptics/.test(js), "supported haptic path must still skip first paint, pause, complete, and toggle-off");
assert(native.hapticIntent("inhale") === "light" && native.hapticIntent("inhale2") === "light", "inhale maps to a light haptic");
assert(native.hapticIntent("exhale") === "soft", "exhale maps to a soft haptic");
assert(native.hapticIntent("hold") === "none", "holds map to no haptic");
assert(native.hapticIntent("end") === "success", "session end maps to a success haptic");
assert(native.mapHaptic("inhale", "median", false).style === "impactLight", "Median inhale is impactLight");
assert(native.mapHaptic("exhale", "median", false).style === "impactLight", "Median exhale uses impactLight when Android tick is unavailable");
assert(native.mapHaptic("exhale", "median", true).style === "tick", "Median exhale on Android uses tick, the lightest Android style");
assert(native.mapHaptic("inhale", "median", true).style === "impactLight", "Median inhale stays impactLight on Android");
assert(native.mapHaptic("hold", "median", true).style == null && native.mapHaptic("hold", "median", true).intent === "none", "Median holds must not pick a style");
assert(native.mapHaptic("end", "median", false).style === "notificationSuccess", "Median session end is notificationSuccess");
assert(native.mapHaptic("inhale", "despia", false).command === "lighthaptic://", "Despia inhale is lighthaptic");
assert(native.mapHaptic("exhale", "despia", false).command === "lighthaptic://", "Despia exhale uses lighthaptic because there is no softer command");
assert(native.mapHaptic("hold", "despia", false).command == null, "Despia holds must not send a command");
assert(native.mapHaptic("end", "despia", false).command === "successhaptic://", "Despia session end is successhaptic");
assert(native.mapHaptic("inhale", "vibrate", false).pattern === 12, "web inhale vibrate is a short pulse");
assert(native.mapHaptic("exhale", "vibrate", false).pattern === 6, "web exhale vibrate is softer than inhale");
assert(native.mapHaptic("exhale", "vibrate", false).pattern < native.mapHaptic("inhale", "vibrate", false).pattern, "exhale pulse must be shorter than inhale");
assert(native.mapHaptic("hold", "vibrate", false).pattern == null, "web holds must not vibrate");
{
  const endPulse = native.mapHaptic("end", "vibrate", false).pattern;
  assert(Array.isArray(endPulse) && endPulse.length >= 3 && endPulse[1] > endPulse[0], "web session end vibrates as a short double pulse");
}
assert(native.hapticsAvailable({}, {}) === false, "plain browser with no vibrate must not offer haptics");
assert(native.hapticsKind({ median: { haptics: {} }, gonative: {} }, {}) === "none", "a haptic object without trigger is not a bridge");
assert(native.hapticsKind({ gonative: { haptics: { trigger: function () {} } } }, {}) === "median", "legacy gonative haptics count as Median");
assert(native.reminderAvailable({}, {}) === false, "reminder stays hidden without a local-notification bridge");
assert(native.reminderAvailable({ median: { haptics: { trigger: function () {} } } }, { userAgent: "Median" }) === false, "Median must not show the reminder");
assert(native.healthAvailable({}) === false, "Health stays hidden without a category writer");
assert(native.healthAvailable({ despia: function () {} }) === false, "Despia presence must not show Apple Health");
assert(native.healthAvailable({ median: { haptics: { trigger: function () {} }, healthkit: {} } }) === false, "Median without a category writer must not show Health");
{
  const medianStyles = [];
  const medianWin = {
    median: {
      haptics: {
        trigger: function (arg) {
          medianStyles.push(arg.style);
        },
      },
    },
  };
  const iosNav = { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" };
  const androidNav = { userAgent: "Mozilla/5.0 (Linux; Android 14)" };
  native.playHaptic(medianWin, iosNav, "inhale");
  native.playHaptic(medianWin, iosNav, "exhale");
  native.playHaptic(medianWin, iosNav, "hold");
  native.playHaptic(medianWin, androidNav, "exhale");
  native.playHaptic(medianWin, iosNav, "end");
  assert(medianStyles.join(",") === "impactLight,impactLight,tick,notificationSuccess", "Median playback must skip holds and use tick only for Android exhale");
  const commands = [];
  native.playHaptic({ despia: function (cmd) { commands.push(cmd); } }, iosNav, "inhale");
  native.playHaptic({ despia: function (cmd) { commands.push(cmd); } }, iosNav, "hold");
  native.playHaptic({ despia: function (cmd) { commands.push(cmd); } }, iosNav, "end");
  assert(commands.join(",") === "lighthaptic://,successhaptic://", "Despia playback must skip holds");
  const pulses = [];
  const vibrateNav = { vibrate: function (pattern) { pulses.push(pattern); } };
  native.playHaptic({}, vibrateNav, "inhale");
  native.playHaptic({}, vibrateNav, "hold");
  native.playHaptic({}, vibrateNav, "exhale");
  assert(pulses.length === 2 && pulses[0] === 12 && pulses[1] === 6, "vibrate fallback must skip holds");
  native.playHaptic({ median: { haptics: { trigger: function () { throw new Error("missing"); } } } }, {}, "inhale");
  native.playHaptic({}, { vibrate: function () { throw new Error("missing"); } }, "end");
  native.playHaptic(null, null, "inhale");
}
{
  const at = function (h, m, s) {
    return new Date(2026, 9, 9, h, m, s || 0, 0).getTime();
  };
  assert(native.nextReminderDelaySeconds(at(7, 0), 8, 0) === 3600, "reminder delay until later today is the second gap");
  assert(native.nextReminderDelaySeconds(at(8, 0), 8, 0) === 86400, "a reminder at the exact chosen minute waits until tomorrow");
  assert(native.nextReminderDelaySeconds(at(8, 0, 30), 8, 0) === 86400 - 30, "a reminder just after the chosen minute waits until tomorrow");
  assert(native.nextReminderDelaySeconds(at(9, 30), 8, 0) === 81000, "a passed reminder time rolls to the next day");
  const key = native.reminderOccurrenceKey(at(7, 0), 8, 0);
  const firstPlan = native.planReminder(at(7, 0), 8, 0, "");
  assert(firstPlan.schedule === true && firstPlan.delaySeconds === 3600 && firstPlan.key === key, "the first open schedules the next occurrence");
  const again = native.planReminder(at(7, 10), 8, 0, key);
  assert(again.schedule === false && again.key === key, "opening again must not schedule a second notification for the same occurrence");
  const moved = native.planReminder(at(7, 0), 9, 15, key);
  assert(moved.schedule === true && moved.key !== key, "changing the time schedules the new occurrence");
  const body = "A minute to breathe, whenever you're ready.";
  assert(native.REMINDER_BODY === body, "reminder copy must stay gentle and fixed");
  assert(native.REMINDER_TITLE === "Practical Breathing", "reminder title must match the listing name");
  const command = native.localReminderCommand(90, body, native.REMINDER_TITLE, "./");
  assert(command.indexOf("sendlocalpushmsg://push.send?s=90=msg!") === 0, "Despia local reminder command must be on-device");
  assert(command.indexOf(encodeURIComponent(body)) !== -1, "reminder body must be URI-encoded inside the command");
  assert(command.indexOf("&!#" + encodeURIComponent("Practical Breathing") + "&!#" + encodeURIComponent("./")) !== -1, "reminder command must carry title and url");
  assert(native.localReminderCommand(0.2, body, "Breathe", "./").indexOf("s=1=msg!") !== -1, "reminder delay must be at least one second");
  assert(native.parseClock("08:00").hour === 8 && native.parseClock("08:00:00").minute === 0, "clock parse accepts hour:minute and hour:minute:second");
  assert(native.parseClock("24:00") == null && native.parseClock("nope") == null, "invalid reminder times are rejected");
  assert(native.formatClock(8, 0) === "08:00", "reminder time is stored with a leading zero");
  assert(native.appStartUrl({ href: "./index.html#done" }) === "./index.html", "deep link must drop the hash");
  assert(native.appStartUrl(null) === "./", "missing location must not throw");
}
{
  let saved = null;
  const healthWin = {
    median: {
      healthkit: {
        writeMindfulSession: function (sample) {
          saved = sample;
        },
      },
    },
  };
  assert(native.healthAvailable(healthWin) === true, "a real category writer would show Apple Health");
  const wrote = native.writeMindfulSession(healthWin, 5 * 60 * 1000, 1000000);
  assert(wrote.wrote === true && saved.durationMs === 300000 && saved.minutes === 5, "completed session duration is what would be written");
  assert(saved.startMs === 700000 && saved.endMs === 1000000, "category sample must carry start and end");
  assert(native.writeMindfulSession({}, 60000, 1000).wrote === false, "missing Health bridge must not write");
  assert(native.writeMindfulSession(healthWin, 0, 1000).wrote === false, "a zero-length session must not write");
  const throwing = {
    median: {
      healthkit: {
        writeMindfulSession: function () {
          throw new Error("nope");
        },
      },
    },
  };
  assert(native.writeMindfulSession(throwing, 60000, 1000).wrote === false, "a throwing Health bridge must not escape");
}
assert(!/writehealthkit:\/\//.test(nativeSrc), "native.js must not send the quantity health command");
assert(/id="pref-reminder-wrap"[^>]*\bhidden\b/.test(html) && /id="pref-health-wrap"[^>]*\bhidden\b/.test(html), "reminder and Health must be hidden in markup");
assert(/id="pref-reminder"[^>]*role="switch"[^>]*aria-checked="false"/.test(html), "daily reminder must be an off switch");
assert(/id="pref-health"[^>]*role="switch"[^>]*aria-checked="false"/.test(html), "Apple Health must be an off switch");
assert(/id="pref-reminder-time"[^>]*value="08:00"/.test(html), "reminder time needs a default that is not scheduled until the switch is on");
assert(/A minute to breathe, whenever you're ready\./.test(html), "settings must show the reminder copy");
assert(/does not cancel a reminder already scheduled/.test(html), "settings must say an already scheduled reminder cannot be cancelled");
assert(/prefReminderWrapEl\.hidden\s*=\s*!reminderOn/.test(js), "reminder UI must hide when no local-notification bridge is detected");
assert(/prefHealthWrapEl\.hidden\s*=\s*!healthOn/.test(js), "Health UI must hide when no category writer is detected");
assert(/function armReminder/.test(js) && /planReminder\(/.test(js) && /localReminderCommand\(/.test(js), "the app must schedule the next on-device reminder through the pure helper");
assert(/if\s*\(\s*!prefs\.reminder\s*\|\|\s*!native\.reminderAvailable/.test(js), "a reminder must not be scheduled while the switch is off or the bridge is missing");
{
  const markFn = js.slice(js.indexOf("function markSessionComplete"), js.indexOf("function finishSession"));
  const finishFn = js.slice(js.indexOf("function finishSession"), js.indexOf("function startLoop"));
  const endFn = js.slice(js.indexOf("function endSession"), js.indexOf("function applyUrgeAtmosphere"));
  const urgeDoneFn = js.slice(js.indexOf("function onUrgeBreatheDone"), js.indexOf("function startUrgeAnotherRound"));
  assert(/playHaptic\([\s\S]*"end"/.test(markFn) && /prefs\.haptics/.test(markFn), "session end plays the success haptic only when haptics are on");
  assert(/writeMindfulSession\(/.test(markFn) && /prefs\.health/.test(markFn), "Health write must be opt-in inside the completion helper");
  assert(/markSessionComplete\(/.test(finishFn), "a finished timed session must record completion");
  assert(/markSessionComplete\(/.test(urgeDoneFn), "a finished Think First breathe must record completion");
  assert(!/markSessionComplete\(/.test(endFn), "End must not count as a completed session");
}
assert(/iOS Safari/i.test(readme) && /Add-to-Home-Screen/i.test(readme) && /does not implement vibrate|no vibrate|not implement vibrate/i.test(readme), "README must document that iOS Safari / Add-to-Home-Screen does not implement vibrate");
assert(/Soft audio[\s\S]{0,80}iPhone cue|iPhone cue[\s\S]{0,80}Soft audio/i.test(readme), "README must document Soft audio as the iPhone cue");

const guilt = /(streak|shame|guilt|you failed|you missed|incomplete session|keep going|don't give up|try again|you stopped)/i;
assert(!guilt.test(html) && !guilt.test(js), "End must not use guilt, streak, or shame copy");

assert(/manifest\.webmanifest/.test(html), "HTML must link the web app manifest");
assert(/sw\.js/.test(js), "app must register the service worker");
assert(/"display"\s*:\s*"standalone"/.test(manifest), "manifest should be installable (standalone)");
assert(sw.includes("caches") && sw.includes("index.html") && sw.includes("engine.js") && sw.includes("native.js"), "service worker must cache the static app shell");
assert(html.indexOf('src="native.js"') !== -1 && html.indexOf('src="native.js"') < html.indexOf('src="app.js"'), "native.js must load before app.js");
assert(/const CACHE = "breathe-shell-v9"/.test(sw), "service worker cache name must bump to breathe-shell-v9");
assert(!/breathe-shell-v1|breathe-shell-v2|breathe-shell-v3|breathe-shell-v4|breathe-shell-v5|breathe-shell-v6|breathe-shell-v7|breathe-shell-v8/.test(sw), "service worker must not keep an older cache name");
["privacy.html", "support.html", "icon-180.png", "icon-1024.png", "icon-maskable-512.png"].forEach(function (asset) {
  assert(sw.includes(asset), "service worker must cache " + asset);
});
assert(existsSync(path.join(root, "icon-192.png")) && existsSync(path.join(root, "icon-512.png")), "PWA icons must exist");
assert(existsSync(path.join(root, "icon-180.png")) && existsSync(path.join(root, "icon-1024.png")) && existsSync(path.join(root, "icon-maskable-512.png")), "apple touch, 1024, and maskable icons must exist");
assert(existsSync(path.join(root, "favicon.svg")), "favicon.svg must remain");

assert(/Pause/.test(readme) && /Resume/.test(readme) && /Escape/.test(readme) && /Space/.test(readme), "README must document Pause/Resume/End and shortcuts");
assert(/Always show timer/.test(readme) && /breathe\.alwaysTimer/.test(readme), "README must document the timer toggle and persistence");
assert(/breathe\.duration/.test(readme) && /1, 2, 5, or 10 minutes/.test(readme), "README must document selectable 1/2/5/10-minute sessions");
assert(!/Each session is exactly five minutes/.test(readme), "README must not claim every session is exactly five minutes");
assert(/Soft audio/.test(readme) && /Haptics/.test(readme), "README must document audio and haptics toggles");
assert(/Balban/.test(readme) && /2023/.test(readme) && /cyclic sighing/i.test(readme), "README must cite Balban et al. 2023 / cyclic sighing");
assert(/First nasal inhale \| 2/.test(readme) && /Second nasal top-up \| 1/.test(readme) && /Long mouth exhale \| 6/.test(readme), "README must document Rest seconds");
assert(/Add to Home Screen/.test(readme) && /file:\/\//.test(readme) && /http\.server/.test(readme), "README must document PWA install vs file://");
assert(/^# Practical Breathing/m.test(readme), "README title must be Practical Breathing");
assert(/home wordmark/.test(readme) && /Practical Breathing/.test(readme), "README must document the Practical Breathing wordmark");
assert(/breathe-shell-v9/.test(readme), "README must document the v9 cache");
assert(/performance\.now/.test(readme), "README must document timestamp-based session timing");
assert(/Manual checklist/.test(readme), "README must keep a manual checklist");
assert(!/Quick Reset/.test(readme), "README must not document Quick Reset");
assert(/Calm Down/.test(readme) && /Think First/.test(readme), "README must document the six-card names");
assert(/Sleep/.test(readme) && /4–6|4-6/.test(readme) && /drop the count|counts fade/i.test(readme), "README must document Sleep 4-6 and drop-the-count");
assert(/one minute/.test(readme) && /lightheaded/.test(readme) && /More air isn't better/.test(readme), "README must document the Energy 1-minute cap and safety line");
assert(/Body setup before sessions/.test(readme) && /breathe\.bodySetup/.test(readme), "README must document body setup and its localStorage key");
assert(/Ease/.test(readme) && /`E`/.test(readme), "README must document Ease and the E shortcut");
assert(!/Spike/.test(readme) && !/Fog/.test(readme) && !/Low energy/.test(readme), "README must not document the removed need chips");
assert(/Hum on the exhale/.test(readme) && /breathe\.hum/.test(readme) && /Hum softly on the exhale/.test(readme), "README must document humming");
assert(/What's the smallest next move\?/.test(readme), "README must document the completion prompt");
assert(/Think First/.test(readme), "README must document Think First");
assert(!/Avoid the Urge/.test(readme), "README must not use the old card name");
assert(!readme.includes(drinkingLine), "README must not include the heavy-drinking line");
assert(/Stop, notice, then choose\./.test(readme), "README must document the Think First technique line");
assert(readme.includes(thinkFirstDescription), "README must document the Think First description");
assert(/Notice the pull\. Where do you feel it\?/.test(readme), "README must document the Observe line");
assert(/What's your next move\?/.test(readme), "README must document the urge respond line");
assert(/Another round/.test(readme), "README must document Another round");
assert(/Think First[\s\S]{0,700}ignores the duration picker/.test(readme), "README must say Think First ignores the duration picker");
assert(/About 3 minutes/.test(readme), "README must say Think First is about 3 minutes");
assert(/nothing about an urge is saved|nothing is saved/i.test(readme), "README must say the urge tool stores nothing");
assert(/`1`–`6`/.test(readme), "README keyboard table must include keys 1-6");

assert(/viewport-fit=cover/.test(html), "index must set viewport-fit=cover");
assert(/name="theme-color"/.test(html), "index must set theme-color");
assert(/apple-mobile-web-app-capable/.test(html), "index must set apple-mobile-web-app-capable");
assert(/apple-mobile-web-app-status-bar-style/.test(html), "index must set the status bar style");
assert(/apple-mobile-web-app-title" content="Practical Breathing"/.test(html), "index must set the Apple web app title to Practical Breathing");
assert(/<title>Practical Breathing<\/title>/.test(html), "document title must be Practical Breathing");
assert(/<h1>\s*Practical Breathing\s*<\/h1>/.test(html), "home wordmark must be Practical Breathing");
assert(/Practical Breathing is a breathing practice you run on your own device\./.test(aboutChunk), "About must use the Practical Breathing name");
assert(/apple-touch-icon/.test(html) && /icon-180\.png/.test(html), "index must link a 180px apple touch icon");
assert(/navigator\.wakeLock/.test(js) && /request\(\s*"screen"\s*\)/.test(js), "sessions must request a screen wake lock where supported");
assert(/function releaseWakeLock/.test(js) && /releaseWakeLock\(/.test(js), "the wake lock must be released when a session ends");
assert(/visibilitychange/.test(js) && /visibilityState === "hidden"/.test(js) && /pauseSession\(/.test(js), "a running session must auto-pause when backgrounded");
assert(/wakeLockWanted/.test(js), "the wake lock must be re-acquired when the app is visible again");
assert(/env\(safe-area-inset-/.test(css), "layout must pad for the iOS safe area");
assert(/-webkit-touch-callout:\s*none/.test(css), "long-press callouts must be disabled");
assert(/touch-action:\s*manipulation/.test(css), "controls must use touch-action manipulation");
assert(/overscroll-behavior:\s*none/.test(css), "the session screen must block pull-to-refresh overscroll");
assert(/prefers-reduced-motion/.test(css), "reduced motion must stay honored");
assert(/APP_VERSION/.test(js) && !/1\.4\.0/.test(js) && !/1\.5\.0/.test(js), "the version shown in the app must come from APP_VERSION, not a second literal");
assert(/confirm\(/.test(js) && /breathe\./.test(js) && /removeItem/.test(js), "reset must confirm, then clear only this app's localStorage keys");
assert(/breathe\.pattern/.test(js), "a saved rest id must still be accepted");

const privacy = readFileSync(path.join(root, "privacy.html"), "utf8");
const support = readFileSync(path.join(root, "support.html"), "utf8");
const storeDoc = readFileSync(path.join(root, "APP_STORE.md"), "utf8");
assert(/no account/i.test(privacy) && /analytics/i.test(privacy) && /tracking/i.test(privacy), "privacy policy must say there is no account, analytics, or tracking");
assert(/localStorage/.test(privacy) && /third part/i.test(privacy), "privacy policy must say preferences stay in localStorage and there are no third parties");
assert(/October 9, 2026/.test(privacy), "privacy policy effective date must be October 9, 2026");
assert(/If you turn it on, completed session minutes are saved to Apple Health on your device; the app never sees or sends your Health data\./.test(privacy), "privacy policy must describe the optional on-device Health write");
assert(/noodleelder@gmail\.com/.test(privacy) && !/support@example\.com/.test(privacy) && !/REPLACE support@example\.com/.test(privacy), "privacy page must show noodleelder@gmail.com");
assert(/href="\.\/"/.test(privacy) || /href="index\.html"/.test(privacy), "privacy page must link back to the app");
assert(/viewport-fit=cover/.test(privacy) && /apple-mobile-web-app-capable/.test(privacy), "privacy page must carry the iOS viewport meta");
assert(/apple-mobile-web-app-title" content="Practical Breathing"/.test(privacy), "privacy page Apple title must be Practical Breathing");
assert(/Back to Practical Breathing/.test(privacy), "privacy page must link back using the Practical Breathing name");
assert(/Practical Breathing does not collect data/.test(privacy), "privacy page must name Practical Breathing");
assert(/Six cards for six moments/.test(support) && /Reset settings/.test(support), "support page must include the six cards and reset settings");
assert(/Think First/.test(support), "support page must name Think First");
assert(storeDoc.includes(thinkFirstDescription), "APP_STORE.md listing copy must include the Think First description");
assert(/Think First/.test(storeDoc) && /Stop, notice, then choose\./.test(storeDoc), "APP_STORE.md must name Think First and its technique line");
assert(!/alcohol/i.test(storeDoc), "APP_STORE.md must not mention alcohol");
["Avoid the Urge", "drink", "craving", "addiction", "relapse"].forEach(function (word) {
  const banned = word.toLowerCase();
  [
    ["index.html", html],
    ["app.js", js],
    ["protocols.js", protocolsSrc],
    ["native.js", nativeSrc],
    ["support.html", support],
    ["privacy.html", privacy],
  ].forEach(function (pair) {
    assert(!pair[1].toLowerCase().includes(banned), pair[0] + " must not mention " + word);
  });
});
assert(/URGE\.description/.test(js), "home must show the Think First description");
assert(/saved === "urge"/.test(js), "a saved urge id must still select Think First");
assert(/noodleelder@gmail\.com/.test(support) && !/support@example\.com/.test(support) && !/REPLACE support@example\.com/.test(support), "support page must show noodleelder@gmail.com");
assert(/href="\.\/"/.test(support), "support page must link back to the app");
assert(/apple-mobile-web-app-title" content="Practical Breathing"/.test(support), "support page Apple title must be Practical Breathing");
assert(/Back to Practical Breathing/.test(support) && /Practical Breathing is a breathing practice/.test(support), "support page must use the Practical Breathing name");
assert(/viewport-fit=cover/.test(support), "support page must set viewport-fit=cover");
assert(/com\.TODO\.breathe/.test(storeDoc), "APP_STORE.md must include the bundle id placeholder");
assert(/Data Not Collected/.test(storeDoc), "APP_STORE.md must answer App Privacy as Data Not Collected");
assert(/4\.2/.test(storeDoc) && /haptic/i.test(storeDoc) && /notification/i.test(storeDoc), "APP_STORE.md must cover guideline 4.2 and native haptics / reminders");
assert(/treatment/.test(storeDoc) && /cure/.test(storeDoc), "APP_STORE.md must caution against treatment and cure claims");
assert(/6\.9/.test(storeDoc) && /6\.7/.test(storeDoc) && /6\.5/.test(storeDoc) && /iPad/.test(storeDoc), "APP_STORE.md must list iPhone and iPad screenshot sizes");
assert(/noodleelder@gmail\.com/.test(storeDoc) && !/support@example\.com/.test(storeDoc), "APP_STORE.md must list noodleelder@gmail.com");
assert(/TODO/.test(storeDoc), "APP_STORE.md must list owner decisions as TODO");
const pagesOrigin = "https://" + "taraannplimpton-arch.github.io/breathing-app/";
assert(/\| App name \| Practical Breathing \|/.test(storeDoc), "APP_STORE.md listing name must be Practical Breathing");
assert(/Breathing Protocols/.test(storeDoc), "APP_STORE.md must list Breathing Protocols as the name fallback");
assert(/Hollr People Limited/.test(storeDoc) && /6740619490/.test(storeDoc) && /Breathwork/.test(storeDoc), "APP_STORE.md must note Breathwork is already taken on the App Store");
assert(storeDoc.indexOf("Practical Breathing") < storeDoc.indexOf("Breathing Protocols"), "Practical Breathing is the name; Breathing Protocols is the fallback");
assert(/Breathing for any moment/.test(storeDoc), "APP_STORE.md subtitle must be Breathing for any moment");
assert(/Free\. No account\. No ads\. Nothing leaves your phone\./.test(storeDoc), "APP_STORE.md must include the promo line");
assert(/one soft glowing circle on near-black/i.test(storeDoc) && /no letters/i.test(storeDoc), "APP_STORE.md icon direction must be one soft glowing circle, no letters");
assert(!/\bFive Minutes\b/.test(storeDoc), "APP_STORE.md must not use Five Minutes as a name");
assert(!/^\| App name \|.*\b(Calm|Focus|Sleep)\b/m.test(storeDoc), "APP_STORE.md name must not use calm/focus/sleep framing");
assert(/taraannplimpton-arch/.test(storeDoc) && /exposes her name/.test(storeDoc), "APP_STORE.md must flag that the GitHub user name is in the privacy/support URLs");
assert(/neutral name/.test(storeDoc) && /custom domain/.test(storeDoc) && /another static host/.test(storeDoc), "APP_STORE.md must list hosting options without changing hosting");
assert(/Do not change hosting/.test(storeDoc), "APP_STORE.md must say not to change hosting in this repo");
assert(storeDoc.includes(pagesOrigin + "privacy.html"), "APP_STORE.md must document the privacy URL");
assert(storeDoc.includes(pagesOrigin + "support.html"), "APP_STORE.md must document the support URL");
assert(/impactLight/.test(storeDoc) && /notificationSuccess/.test(storeDoc), "APP_STORE.md must document Median haptic styles");
assert(/lighthaptic/.test(storeDoc) && /successhaptic/.test(storeDoc), "APP_STORE.md must document Despia haptic commands");
assert(/sendlocalpushmsg/.test(storeDoc), "APP_STORE.md must document the on-device reminder command");
assert(/does not cancel|cannot cancel|no documented cancel/i.test(storeDoc), "APP_STORE.md must say a scheduled reminder cannot be cancelled");
assert(/Median does not document an on-device local-notification/.test(storeDoc), "APP_STORE.md must say Median has no local-notification API");
assert(/Despia/.test(storeDoc) && /category/i.test(storeDoc) && /Mindful/.test(storeDoc), "APP_STORE.md must say Mindful Minutes needs a category write");
assert(/writehealthkit/.test(storeDoc), "APP_STORE.md must note the quantity health command is the wrong type");

const manifestJson = JSON.parse(manifest);
assert(manifestJson.name === "Practical Breathing" && manifestJson.short_name === "Breathing", "manifest name must be Practical Breathing and short_name Breathing");
assert(manifestJson.id === "/breathing-app/", "manifest id must be the GitHub Pages path");
assert(manifestJson.start_url === "/breathing-app/" && manifestJson.scope === "/breathing-app/", "manifest start_url and scope must be /breathing-app/");
assert(manifestJson.display === "standalone", "manifest display must be standalone");
assert(manifestJson.orientation === "portrait", "manifest orientation must be portrait");
assert(JSON.stringify(manifestJson.categories) === JSON.stringify(["health", "lifestyle"]), "manifest categories must be health and lifestyle");
const iconNotes = manifestJson.icons.map(function (icon) {
  return icon.sizes + " " + icon.purpose;
});
assert(iconNotes.some(function (note) { return note.indexOf("192x192") !== -1; }), "manifest needs a 192 icon");
assert(iconNotes.some(function (note) { return note.indexOf("512x512") !== -1 && note.indexOf("any") !== -1; }), "manifest needs a 512 any-purpose icon");
assert(iconNotes.some(function (note) { return note.indexOf("1024x1024") !== -1; }), "manifest needs a 1024 icon");
assert(iconNotes.some(function (note) { return note.indexOf("maskable") !== -1; }), "manifest needs a maskable icon");

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function readPng(filePath) {
  const buf = readFileSync(filePath);
  assert(buf.subarray(0, 8).toString("hex") === "89504e470d0a1a0a", path.basename(filePath) + " must be a PNG");
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = -1;
  let bitDepth = 0;
  const idats = [];
  let trns = false;
  while (offset + 8 <= buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "tRNS") {
      trns = true;
    } else if (type === "IDAT") {
      idats.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + len;
  }
  const inflated = inflateSync(Buffer.concat(idats));
  const bpp = colorType === 2 ? 3 : 4;
  const stride = width * bpp;
  const rows = [];
  let pos = 0;
  const prior = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[pos];
    pos += 1;
    const raw = inflated.subarray(pos, pos + stride);
    pos += stride;
    const out = Buffer.alloc(stride);
    for (let i = 0; i < stride; i += 1) {
      const left = i >= bpp ? out[i - bpp] : 0;
      const up = prior[i];
      const ul = i >= bpp ? prior[i - bpp] : 0;
      const v = raw[i];
      if (filter === 0) out[i] = v;
      else if (filter === 1) out[i] = (v + left) & 255;
      else if (filter === 2) out[i] = (v + up) & 255;
      else if (filter === 3) out[i] = (v + Math.floor((left + up) / 2)) & 255;
      else out[i] = (v + paeth(left, up, ul)) & 255;
    }
    rows.push(out);
    out.copy(prior);
  }
  return {
    width: width,
    height: height,
    colorType: colorType,
    bitDepth: bitDepth,
    trns: trns,
    pixel: function (x, y) {
      const row = rows[y];
      const i = x * bpp;
      return [row[i], row[i + 1], row[i + 2]];
    },
  };
}

function sameRgb(actual, expected) {
  return actual[0] === expected[0] && actual[1] === expected[1] && actual[2] === expected[2];
}

const storeIcon = readPng(path.join(root, "icon-1024.png"));
const bg = [14, 13, 11];
const fg = [201, 176, 255];
assert(storeIcon.width === 1024 && storeIcon.height === 1024, "icon-1024 must be 1024x1024");
assert(storeIcon.colorType === 2 && storeIcon.bitDepth === 8 && !storeIcon.trns, "icon-1024 must be opaque RGB with no alpha");
assert(sameRgb(storeIcon.pixel(0, 0), bg) && sameRgb(storeIcon.pixel(1023, 1023), bg), "icon-1024 corners must be the flat background, not rounded off");
assert(sameRgb(storeIcon.pixel(512, 512), fg), "icon-1024 must keep the existing circle art");
const touchIcon = readPng(path.join(root, "icon-180.png"));
assert(touchIcon.width === 180 && touchIcon.height === 180 && touchIcon.colorType === 2, "apple touch icon must be a 180px opaque PNG");
const maskIcon = readPng(path.join(root, "icon-maskable-512.png"));
assert(maskIcon.width === 512 && maskIcon.height === 512 && maskIcon.colorType === 2, "maskable icon must be a 512px opaque PNG");
assert(sameRgb(maskIcon.pixel(Math.floor(512 * 0.08), 256), bg), "maskable icon must keep safe-zone padding outside the circle");
assert(sameRgb(maskIcon.pixel(256, 256), fg), "maskable icon must still show the circle");

const bannedEmail = ["taraannplimpton", "gmail.com"].join("@");
const allowedDocs = new Set(["README.md", "APP_STORE.md"]);
const allowedUrls = new Set([
  pagesOrigin + "privacy.html",
  pagesOrigin + "support.html",
]);
const svgNamespace = "http://" + "www.w3.org/2000/svg";

function walkFiles(dir, out) {
  readdirSync(dir).forEach(function (name) {
    if (name === ".git" || name === "node_modules") {
      return;
    }
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      walkFiles(full, out);
      return;
    }
    out.push(full);
  });
}

const repoFiles = [];
walkFiles(root, repoFiles);
repoFiles.forEach(function (filePath) {
  const text = readFileSync(filePath);
  const asString = text.toString("utf8");
  const rel = path.relative(root, filePath);
  assert(!asString.includes(bannedEmail), rel + " must not contain a personal email");
  if (rel !== "scripts/check.mjs" && /\.(js|mjs|html|css|md|webmanifest|svg)$/.test(rel)) {
    assert(!/onesignal/i.test(asString), rel + " must not mention a remote push vendor");
    assert(!/firebase/i.test(asString), rel + " must not mention a remote push vendor");
  }
  const urls = asString.match(/https?:\/\/[^\s"'<>)\\]+/g) || [];
  urls.forEach(function (url) {
    const clean = url.replace(/[.,)|*`]+$/, "");
    if (clean === svgNamespace) {
      return;
    }
    const rel = path.relative(root, filePath);
    if (allowedDocs.has(rel) && allowedUrls.has(clean)) {
      return;
    }
    failures.push(rel + " has an external URL that is not allowed: " + clean);
  });
});

if (failures.length) {
  console.error("check failed:");
  failures.forEach(function (failure) {
    console.error(" - " + failure);
  });
  process.exit(1);
}

console.log("ok — 6 cards, Energy cap, Sleep drop-count, ease, Think First, App Store shell");

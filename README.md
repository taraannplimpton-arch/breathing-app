# Practical Breathing

A single-page breathing practice. The listing, manifest name, Apple title, About name, and home wordmark are **Practical Breathing**. The manifest short name is **Breathing**.

Six cards: **Calm Down**, **Energy**, **HRV**, **Focus**, **Sleep**, and **Think First**. Timed sessions last 1, 2, 5, or 10 minutes (default five). Energy is capped at one minute. **Think First** is about 3 minutes. It ignores the duration picker and skips body setup. Nothing from Think First is saved. Its internal id stays `urge`, so a saved `urge` still opens this card.

Calm Down is the cyclic-sigh pattern. Its internal id stays `rest`, so a saved or selected `rest` still opens this card.

The about screen shows `APP_VERSION` from `protocols.js` (currently 1.5.0).

During a session the screen is a bubble, a sparse countdown, and three quiet controls (Pause / Ease / End). No phase labels, no instructions. The bubble grows on inhale, shrinks on exhale, and holds still during holds. Color follows both the chosen pattern and the current phase.

Session time and phases are read from elapsed wall time (`performance.now` timestamps), so pause, resume, and background auto-pause do not accumulate drift.

Where a screen wake lock is supported, the display stays on for a session and is released when you return home. If the app is backgrounded mid-session, the session pauses. It does not resume by itself.

## Run locally

Serve the folder (needed for install / Add to Home Screen, and for the service worker):

```bash
python3 -m http.server 8080
```

Then visit localhost port 8080.

Opening `index.html` as a `file://` page still runs the session itself (classic `<script src>` tags, no build). The web app manifest and service worker will not install from `file://` — use `http.server` (or any static host) for PWA install.

The manifest `id`, `scope`, and `start_url` are `/breathing-app/` so a GitHub Pages project site resolves them. Relative asset paths in the service worker are resolved from the worker script.

Published pages, once the site is public:

- https://taraannplimpton-arch.github.io/breathing-app/privacy.html
- https://taraannplimpton-arch.github.io/breathing-app/support.html

The contact address in the app is noodleelder@gmail.com. See `APP_STORE.md`.

No build step. No dependencies. No requests to other sites.

## Using a session

- **Start** begins a session of the selected pattern and length (1, 2, 5, or 10 minutes; default 5:00). Energy always runs one minute even if a longer length is stored.
- **Think First** is the sixth card. Stop, Observe, then 15 nasal breaths (4 in / 6 out, about 2.5 minutes), Expand, then Respond. The number counts breaths from 1 to 10 and starts again at 1, instead of a countdown. **Another round** repeats only the breathing, then returns to Respond. **Done** or **End** goes home. It skips body setup. It ignores the duration picker. Home says so, the same way Energy shows its one-minute note: *About 3 minutes.* The technique line is *Stop, notice, then choose.* The description is *That airport candy, the reply-all, the cart checkout. Breathe first, then decide.* Pause, Ease, and End work as in other sessions. Nothing is stored.
- **Pause** / **Resume** freeze the bubble and the clock. Resume continues the same session; it does not restart. Pause only from the Pause button, or with the Space key. Tapping the session screen does not pause. Leaving the app also pauses a running session.
- **Ease** (`E`) shortens the remaining cycles by about one second per phase, from the next cycle. Tap twice at most. No phase goes under 2 seconds; Calm Down’s 1s top-up stays 1s.
- **End** returns home immediately. Nothing to earn, nothing to lose. If you leave early, a quiet elapsed time may fade in on home (`1:12`) and then disappear.
- When the clock hits `0:00`, the screen fades and waits with one quiet line: *What's the smallest next move?* No input, nothing saved. One tap, **Enter**, **Space**, or **Escape** returns home.

If **Body setup before sessions** is on (default), Start first shows a ~10-second pre-roll: *Feet. Stack. Hands. Jaw. Eyes. Exhale.* One word at a time. Tap or **Space** skips it; **Escape** cancels home. Think First never shows it. The in-session screen stays numbers-only.

**Settings** and **Information** sit at the top right. Information opens About, which explains the app, the safety note, and the version. It links to Privacy and Support. **Reset settings** clears only this app’s `localStorage` keys (anything starting with `breathe.`) after you confirm, then restores defaults. Settings is a sheet over the home screen.

Keyboard:

| Key | Where | Action |
| --- | --- | --- |
| `1`–`6` | Home | Select Calm Down / Energy / HRV / Focus / Sleep / Think First |
| `Enter` | Home | Start |
| `Space` | Session | Pause / Resume |
| `E` | Session | Ease (shorter counts from the next cycle) |
| `Escape` | Session, pre-roll, Think First guide, Settings, about, or completion | End (back home) / cancel pre-roll, the Think First guide, Settings, or about |
| `Space` / tap | Think First guide | Continue |
| `Space` / `Enter` / tap | Completion | Back home |
| `Space` / tap | Pre-roll | Skip and start |

## Settings

Timer, audio, and haptics default off (the timer is hidden most of the time unless you opt in). Body setup defaults on. Humming defaults off. Session length defaults to 5 minutes. The daily reminder and Apple Health stay hidden unless the wrapper can actually do them, and both default off. Preferences are switches in Settings and persist in `localStorage`:

| Control | Key | Default |
| --- | --- | --- |
| Session length | `breathe.duration` | `5` — 1, 2, 5, or 10 minutes |
| Always show timer | `breathe.alwaysTimer` | off — sparse glimpses |
| Soft audio | `breathe.audio` | off |
| Haptics | `breathe.haptics` | off |
| Body setup before sessions | `breathe.bodySetup` | on |
| Hum on the exhale | `breathe.hum` | off — Calm Down and Sleep only |
| Daily reminder | `breathe.reminder` | off — hidden without an on-device notification bridge. Time is `breathe.reminderTime` (default 08:00). |
| Apple Health | `breathe.health` | off — hidden. No documented Mindful Minutes write. |

**Always show timer** keeps the remaining-time counter visible for the whole session (accessibility). Otherwise the counter appears only about four or five times (fewer on 1- and 2-minute sessions): near the start, near the end, and a couple of brief mid-session fades. It fades in and out; it never flashes. The bubble is the continuous cue. On Sleep, counts fade after about four cycles (“drop the count”) unless Always show timer is on.

**Soft audio** is a continuous swell/fade tone tied to inhale and exhale — not a metronome beep. It starts on the Start gesture (browsers block autoplay), and mutes on Pause or End. On iPhone, the silent switch also mutes it.

**Hum on the exhale** (Calm Down and Sleep) adds “Hum softly on the exhale.” to the home technique line. If Soft audio is also on, the exhale uses a gentler low hum-like tone. No extra words during the session.

**Haptics** is a light tap on the inhale, a softer tap on the exhale, nothing on a hold, and a short success tap when the session finishes. Android Chrome uses `navigator.vibrate`. A Median or Despia wrapper uses its native bridge instead. iOS Safari / Add-to-Home-Screen does not implement vibrate, so the Haptics switch is hidden there; **Soft audio** is the iPhone cue. No tap if the toggle is off. Ending early does not play the success tap.

**Daily reminder** is off, and the row is hidden unless Despia’s on-device notification command is available. Median does not document that API. Copy: “A minute to breathe, whenever you're ready.” Opening the app schedules the next occurrence of the chosen time. Turning it off cannot cancel one already scheduled.

**Apple Health** is off and hidden. Completed minutes would be written only after a finished session, and only if a wrapper can save a Mindful Session category sample. None documented today can.

Home also shows one short technique line for the selected pattern (never during the session). Calm Down is nose inhale, short nose top-up, long mouth exhale — not nose-only. Energy and HRV stay nose in and nose out. Focus (box) is nose for inhale, hold, exhale, and hold. Sleep is a small nasal inhale and an easy longer exhale (nose or soft pursed lips). Think First’s technique line is “Stop, notice, then choose.” Its description is “That airport candy, the reply-all, the cart checkout. Breathe first, then decide.” The longer doctor note lives on About.

## The five timed protocols

Pick **1 / 2 / 5 / 10** minutes on home (default **5:00**). Cycles repeat until the clock hits zero, even if that is mid-breath. Energy is capped at **1 minute**.

### 1. Calm Down — cyclic sighing (2–1–6)

| Phase | Seconds | How |
| --- | ---: | --- |
| First nasal inhale | 2 | Nose, to most of a full breath |
| Second nasal top-up | 1 | Shorter nose inhale to the top |
| Long mouth exhale | 6 | Slow exhale through the mouth |

Stanford-style cyclic sighing: a **nose** inhale, a second shorter **nose** top-up, then a long **mouth** exhale. Do not breathe this pattern nose-only. The 9-second loop (~6.7 breaths/min) repeats through the session. The bubble expands in two steps on the double inhale, then takes a long shrink on the exhale.

Balban et al. 2023 (*Cell Reports Medicine*) compared five minutes of cyclic sighing to other brief breathwork and to mindfulness; cyclic sighing improved mood and reduced respiratory rate more than the mindfulness arm. The paper does not publish exact phase seconds, so this app uses 2s + 1s + 6s as a documented, calm loop.

Calm Down’s atmosphere is slightly dimmer and cooler than Energy.

### 2. Energy — upregulating 4–2

| Phase  | Seconds | How |
| ------ | ------- | --- |
| Inhale | 4       | Nose |
| Exhale | 2       | Nose, shorter |

The inverse of a calming breath. **Nose inhale and nose exhale** (the exhale is shorter). Inhalation mechanically speeds the heart; exhalation slows it. Making the inhale longer (and relatively more vigorous) than the exhale therefore raises alertness — the principle Andrew Huberman describes for inhale-emphasized breathing, and the same autonomic direction as cyclic hyperventilation, without empty-lung holds or rapid 25-breath rounds. About 10 breaths/min.

Energy sessions are **one minute**, even if 2 / 5 / 10 is stored for other patterns. Stop if you feel lightheaded. More air isn't better.

### 3. HRV — coherent / resonant breathing (5–5)

| Phase  | Seconds | How |
| ------ | ------- | --- |
| Inhale | 5       | Nose, soft belly |
| Exhale | 5       | Nose, soft belly |

**Nose inhale and nose exhale, soft belly.** Six breaths per minute (~0.1 Hz) sits on the baroreflex resonance frequency of most adults. That is the pacing used in HRV biofeedback (Lehrer, Vaschillo, Gevirtz): heart rate, blood pressure, and breath lock together and HRV amplitude is typically largest. A 2022 meta-analysis (Laborde et al.) found slow-paced breathing increases vagally mediated HRV during and right after practice. No holds — a continuous wave.

### 4. Focus — box breathing (4–4–4–4)

| Phase  | Seconds | How |
| ------ | ------- | --- |
| Inhale | 4       | Nose |
| Hold   | 4       | Nose |
| Exhale | 4       | Nose |
| Hold   | 4       | Nose |

Tactical / box breathing: equal sides, **all through the nose** — nose inhale, nose hold, nose exhale, nose hold. Used by the Navy and first responders before high-load work. Because inhale and exhale are the same length, it does not sedate the way a long-exhale rest pattern does; the holds add a mild CO₂ stimulus and a counting scaffold for attention. Stanford’s 2023 5-minute breathwork trial (Balban et al., *Cell Reports Medicine*) included box breathing as a structured protocol. Use it as a pre-study or pre-exam reset: alert, not drowsy.

### 5. Sleep — 4–6

| Phase  | Seconds | How |
| ------ | ------- | --- |
| Inhale | 4       | Nose, small |
| Exhale | 6       | Nose or soft pursed lips |

Small breath, easy longer exhale. Counts fade once the rhythm settles — after about four cycles the numbers drop and only the bubble continues (Always show timer still keeps them visible). Atmosphere is dim like Calm Down.

## Think First

The sixth home card, for an everyday impulse (the airport candy, the reply-all, the cart checkout). It is not one of the five timed protocols: it ignores the minute picker, it does not show body setup, and the home note says *About 3 minutes.* Nothing is saved: no log, no streak, and no new `localStorage` key.

The shape is a pause before an impulse: Stop, Observe, Breathe, Expand, Respond. The feeling often rises for about a minute and has fallen off by about three. This is a way to sit with that window. It is not a treatment claim, and it is not medical advice.

| Step | Time | Screen |
| --- | --- | --- |
| Stop | ~5s | Pause. Put it down. |
| Observe | ~10s | Notice the pull. Where do you feel it? Tap or wait. |
| Breathe | 15 breaths, ~2.5 min | Bubble only. Nose, 4s in / 6s out. |
| Expand | ~8s | Notice what changed. Widen your view. |
| Respond | until you choose | What's your next move? |

Breathe is slow nasal breathing at about 6 breaths per minute, with a longer exhale. The on-screen number counts the breath, 1 through 10, then 1 again. A faint wave behind the bubble rises through the first minute, crests, and subsides by the end. If the OS asks for reduced motion, that wave stays still. Pause, Ease (`E`), soft audio, and haptics behave as they do in other sessions. Ease can shorten later breaths; the round still ends after 15 breaths.

Respond offers **Another round** (the breathing block again, then the same question) and **Done** (home). Leaving with **End** during the breathing also goes home. Neither is a verdict.

## Motion and completion

In the last 0.5s of a phase the glow shifts slightly toward the next breath — no words. If the OS asks for reduced motion (`prefers-reduced-motion: reduce`), the large scale pulse is replaced by a gentler opacity/color change. Phase timing stays the same.

A finished session fades quietly. There is no celebratory sound or jump cut home. The line *What's the smallest next move?* is a prompt to notice, not a form.

## Install (PWA)

From a served origin (`python3 -m http.server` or any HTTPS host, including GitHub Pages under `/breathing-app/`):

1. Open the app in Chrome, Safari, or Edge.
2. Use **Add to Home Screen** / **Install app**.
3. The manifest (`manifest.webmanifest`, name Practical Breathing, short name Breathing) and a small service worker (`sw.js`, cache `breathe-shell-v9`) cache the static shell — `index.html`, `privacy.html`, `support.html`, scripts, styles, and icons — so the app still opens offline.

Icons: `icon-192.png`, `icon-512.png`, opaque `icon-1024.png` (no transparency, square corners), `icon-180.png` for Apple touch, and a maskable `icon-maskable-512.png` whose circle sits inside the safe zone. They are derived from `favicon.svg`.

`privacy.html` and `support.html` are offline too. They link back to the app. There is no account and no analytics.

## Verify

Automated (protocol timings, Calm Down double-inhale scale, pause/resume clock, 10-minute drift simulation, bubble and text contrast, sparse timer, PWA files, Sleep, Energy cap, ease, Think First, about / privacy / support):

```bash
node scripts/check.mjs
```

Manual checklist:

1. Home shows six cards in order (Calm Down, Energy, HRV, Focus, Sleep, Think First), a technique line, a **1 / 2 / 5 / 10** minute control (default 5), **Start**, and sentence-case **Settings** and **Information** buttons. Home is only those cards. Preferences (timer/audio/haptics/hum off by default; body setup on) are switches in the Settings sheet. Calm Down’s technique mentions a nose inhale, a short nose top-up, and a long mouth exhale.
2. Start Calm Down. If body setup is on, six words fade, then the session. Controls are **Pause**, **Ease**, and **End** only. No inhale/exhale/hold labels. Atmosphere is dimmer than Energy. The screen stays awake where a wake lock exists. Switching away pauses the session.
3. Bubble grows in two steps (2s then 1s), then shrinks for 6s. Countdown appears near the start, fades, and is not on screen the whole time (unless Always show timer is on).
4. **Space** pauses (bubble and clock freeze). **Space** again resumes the same session. Tapping the session screen does not pause. **Escape** or **End** returns home with no guilt copy; a quiet elapsed time is optional. **E** / Ease shortens the next cycle.
5. Energy: 2 / 5 / 10 disabled and a one-minute note; bubble grows slowly (4s) and shrinks faster (2s); amber on inhale, deep orange on exhale. Safety line: stop if you feel lightheaded; more air isn't better. Brighter than Calm Down.
6. HRV: equal 5s grow and 5s shrink; bright teal vs deep teal.
7. Focus: grow, pause large, shrink, pause small (4s each). Hold uses a distinct violet tint vs sky-blue inhale and deep-blue exhale.
8. Sleep: 4s grow, 6s shrink, dim like Calm Down. After about four cycles the countdown stays off (unless Always show timer).
9. Keys `1` through `6` select the six cards. Think First disables the minute picker and shows *About 3 minutes.* Start skips body setup.
10. Let any timed pattern reach `0:00`. Quiet fade and the next-move line; tap or press a key to return home.
11. Open Settings and turn on Always show timer, Soft audio, and Hum; turn on Haptics if that switch is shown; reload — they stay. Daily reminder and Apple Health stay hidden in a normal browser. Body setup stays on unless turned off. Hum is only for Calm Down and Sleep. Audio starts with Start, mutes on Pause/End. Hum changes Calm Down/Sleep technique copy and the exhale tone. With reduced-motion enabled in the OS, the bubble should not pulse in size.
12. About shows what the app is, how to use it, the safety note, the version, links to privacy and support, and Reset settings (confirm, then only this app’s keys are cleared).
13. Served over HTTP, `/`, `/privacy.html`, and `/support.html` load. The document links a manifest and registers a service worker. Add to Home Screen is available in a supporting browser.
14. Think First: no pre-roll and no duration change. Stop, then Observe (tap skips), then a dusk-clay bubble, 4s grow / 6s shrink, breath numbers 1–10 wrapping, faint wave. Expand, then *What's your next move?* Another round returns to the bubble, then Respond. Done returns home. End during the breathing returns home. Reduced motion keeps the wave still.

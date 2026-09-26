# Breathe

A single-page breathing studio. Five science-backed patterns. Sessions last 1, 2, 5, or 10 minutes (default five). Energy is capped at one minute. **Quick Reset** is three physiological sighs (~30 seconds) and ignores the duration picker.

During a session the screen is a bubble, a sparse countdown, and three quiet controls (Pause / Ease / End). No phase labels, no instructions. The bubble grows on inhale, shrinks on exhale, and holds still during holds. Color follows both the chosen pattern and the current phase.

## Run locally

Serve the folder (needed for install / Add to Home Screen, and for the service worker):

```bash
python3 -m http.server 8080
```

Then visit [http://localhost:8080](http://localhost:8080).

Opening `index.html` as a `file://` page still runs the session itself (classic `<script src>` tags, no build). The web app manifest and service worker will not install from `file://` — use `http.server` (or any static host) for PWA install.

No build step. No dependencies.

## Using a session

- **Start** begins a session of the selected pattern and length (1, 2, 5, or 10 minutes; default 5:00). Energy always runs one minute even if a longer length is stored.
- **Quick Reset** runs three Rest-style physiological sighs (~27s of 2–1–6, about 30 seconds total) and then the completion screen. It ignores the duration picker and skips body setup.
- **Pause** / **Resume** freeze the bubble and the clock. Resume continues the same session; it does not restart.
- **Ease** (`E`) shortens the remaining cycles by about one second per phase, from the next cycle. Tap twice at most. No phase goes under 2 seconds; Rest’s 1s top-up stays 1s.
- **End** returns home immediately. Nothing to earn, nothing to lose. If you leave early, a quiet elapsed time may fade in on home (`1:12`) and then disappear.
- When the clock hits `0:00`, the screen fades and waits with one quiet line: *What's the smallest next move?* No input, nothing saved. One tap, **Enter**, **Space**, or **Escape** returns home.

If **Body setup before sessions** is on (default), Start first shows a ~10-second pre-roll: *Feet. Stack. Hands. Jaw. Eyes. Exhale.* One word at a time. Tap or **Space** skips it; **Escape** cancels home. Quick Reset never shows it. The in-session screen stays numbers-only.

Keyboard:

| Key | Where | Action |
| --- | --- | --- |
| `1`–`5` | Home | Select Rest / Energy / HRV / Focus / Sleep |
| `Enter` | Home | Start |
| `Space` | Session | Pause / Resume |
| `E` | Session | Ease (shorter counts from the next cycle) |
| `Escape` | Session, pre-roll, or completion | End (back home) / cancel pre-roll |
| `Space` / `Enter` / tap | Completion | Back home |
| `Space` / tap | Pre-roll | Skip and start |

## Home toggles

Timer, audio, and haptics default off (the timer is hidden most of the time unless you opt in). Body setup defaults on. Humming defaults off. Session length defaults to 5 minutes. Preferences persist in `localStorage`:

| Control | Key | Default |
| --- | --- | --- |
| Session length | `breathe.duration` | `5` — 1, 2, 5, or 10 minutes |
| Always show timer | `breathe.alwaysTimer` | off — sparse glimpses |
| Soft audio | `breathe.audio` | off |
| Haptics | `breathe.haptics` | off |
| Body setup before sessions | `breathe.bodySetup` | on |
| Hum on the exhale | `breathe.hum` | off — Rest and Sleep only |

**Always show timer** keeps the remaining-time counter visible for the whole session (accessibility). Otherwise the counter appears only about four or five times (fewer on 1- and 2-minute sessions): near the start, near the end, and a couple of brief mid-session fades. It fades in and out; it never flashes. The bubble is the continuous cue. On Sleep, counts fade after about four cycles (“drop the count”) unless Always show timer is on.

**Soft audio** is a continuous swell/fade tone tied to inhale and exhale — not a metronome beep. It starts on the Start gesture (browsers block autoplay), and mutes on Pause or End.

**Hum on the exhale** (Rest and Sleep) adds “Hum softly on the exhale.” to the home technique line. If Soft audio is also on, the exhale uses a gentler low hum-like tone. No extra words during the session.

**Haptics** is a light `navigator.vibrate` on phase change when the browser supports it (typical Android Chrome). iOS Safari / Add-to-Home-Screen does not implement vibrate, so the toggle is disabled and labeled unavailable on iPhone; **Soft audio** is the iPhone cue. No vibration if the toggle is off.

Home also shows one short technique line for the selected pattern (never during the session). Rest is nose inhale, short nose top-up, long mouth exhale — not nose-only. Energy and HRV stay nose in and nose out. Focus (box) is nose for inhale, hold, exhale, and hold. Sleep is a small nasal inhale and an easy longer exhale (nose or soft pursed lips).

Need chips on home — **Spike**, **Fog**, **Low energy**, **Sleep** — highlight a matching pattern (Spike also highlights Quick Reset). The pattern list remains; chips are not saved.

## The five protocols

Pick **1 / 2 / 5 / 10** minutes on home (default **5:00**). Cycles repeat until the clock hits zero, even if that is mid-breath. Energy is capped at **1 minute**.

### 1. Rest — cyclic sighing (2–1–6)

| Phase | Seconds | How |
| --- | ---: | --- |
| First nasal inhale | 2 | Nose, to most of a full breath |
| Second nasal top-up | 1 | Shorter nose inhale to the top |
| Long mouth exhale | 6 | Slow exhale through the mouth |

Stanford-style cyclic sighing: a **nose** inhale, a second shorter **nose** top-up, then a long **mouth** exhale. Do not breathe this pattern nose-only. The 9-second loop (~6.7 breaths/min) repeats through the session. The bubble expands in two steps on the double inhale, then takes a long shrink on the exhale.

Balban et al. 2023 (*Cell Reports Medicine*) compared five minutes of cyclic sighing to other brief breathwork and to mindfulness; cyclic sighing improved mood and reduced respiratory rate more than the mindfulness arm. The paper does not publish exact phase seconds, so this app uses 2s + 1s + 6s as a documented, calm loop.

Rest’s atmosphere is slightly dimmer and cooler than Energy.

**Quick Reset** is three of these sighs, then completion.

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

Small breath, easy longer exhale. Counts fade once the rhythm settles — after about four cycles the numbers drop and only the bubble continues (Always show timer still keeps them visible). Atmosphere is dim like Rest.

## Motion and completion

In the last 0.5s of a phase the glow shifts slightly toward the next breath — no words. If the OS asks for reduced motion (`prefers-reduced-motion: reduce`), the large scale pulse is replaced by a gentler opacity/color change. Phase timing stays the same.

A finished session fades quietly. There is no celebratory sound or jump cut home. The line *What's the smallest next move?* is a prompt to notice, not a form.

## Install (PWA)

From a served origin (`python3 -m http.server` or any HTTPS host):

1. Open the app in Chrome, Safari, or Edge.
2. Use **Add to Home Screen** / **Install app**.
3. The manifest (`manifest.webmanifest`) and a small service worker (`sw.js`) cache the static shell (`index.html`, scripts, styles, icons) so the app still opens offline.

Icons are derived from `favicon.svg`.

## Verify

Automated (protocol timings, Rest double-inhale scale, pause/resume clock, sparse timer, PWA files, Sleep, Quick Reset, Energy cap, ease):

```bash
node scripts/check.mjs
```

Manual checklist:

1. Home shows five labels (Rest, Energy, HRV, Focus, Sleep), need chips (Spike, Fog, Low energy, Sleep), a technique line, a **1 / 2 / 5 / 10** minute control (default 5), **Quick Reset**, **Start**, and toggles (timer/audio/haptics/hum off by default; body setup on). Rest’s technique mentions a nose inhale, a short nose top-up, and a long mouth exhale.
2. Start Rest. If body setup is on, six words fade, then the session. Controls are **Pause**, **Ease**, and **End** only. No inhale/exhale/hold labels. Atmosphere is dimmer than Energy.
3. Bubble grows in two steps (2s then 1s), then shrinks for 6s. Countdown appears near the start, fades, and is not on screen the whole time (unless Always show timer is on).
4. **Space** pauses (bubble and clock freeze). **Space** again resumes the same session. **Escape** or **End** returns home with no guilt copy; a quiet elapsed time is optional. **E** / Ease shortens the next cycle.
5. Energy: 2 / 5 / 10 disabled and a one-minute note; bubble grows slowly (4s) and shrinks faster (2s); amber on inhale, deep orange on exhale. Safety line: stop if you feel lightheaded; more air isn't better. Brighter than Rest.
6. HRV: equal 5s grow and 5s shrink; bright teal vs deep teal.
7. Focus: grow, pause large, shrink, pause small (4s each). Hold uses a distinct violet tint vs sky-blue inhale and deep-blue exhale.
8. Sleep: 4s grow, 6s shrink, dim like Rest. After about four cycles the countdown stays off (unless Always show timer).
9. Quick Reset: no pre-roll, ~0:27, Rest bubble, then completion with *What's the smallest next move?* Duration picker unchanged after return.
10. Spike highlights Rest and Quick Reset; Fog highlights HRV and Focus; Low energy selects Energy; Sleep selects Sleep.
11. Let any pattern reach `0:00`. Quiet fade and the next-move line; tap or press a key to return home.
12. Turn on Always show timer, Soft audio, Haptics, and Hum; reload — they stay. Body setup stays on unless turned off. Audio starts with Start, mutes on Pause/End. Hum changes Rest/Sleep technique copy and the exhale tone. With reduced-motion enabled in the OS, the bubble should not pulse in size.
13. Served over HTTP, the document links a manifest and registers a service worker. Add to Home Screen is available in a supporting browser.

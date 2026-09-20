# Breathe

A single-page breathing studio. Four science-backed patterns. Each session is exactly five minutes.

During a session the screen is a bubble, a sparse countdown, and two quiet controls (Pause / End). No phase labels, no instructions. The bubble grows on inhale, shrinks on exhale, and holds still during holds. Color follows both the chosen pattern and the current phase.

## Run locally

Serve the folder (needed for install / Add to Home Screen, and for the service worker):

```bash
python3 -m http.server 8080
```

Then visit [http://localhost:8080](http://localhost:8080).

Opening `index.html` as a `file://` page still runs the session itself (classic `<script src>` tags, no build). The web app manifest and service worker will not install from `file://` — use `http.server` (or any static host) for PWA install.

No build step. No dependencies.

## Using a session

- **Start** begins a 5:00 session of the selected pattern.
- **Pause** / **Resume** freeze the bubble and the clock. Resume continues the same session; it does not restart.
- **End** returns home immediately. Nothing to earn, nothing to lose. If you leave early, a quiet elapsed time may fade in on home (`1:12`) and then disappear.
- When 5:00 completes, the screen fades and waits. One tap, **Enter**, **Space**, or **Escape** returns home.

Keyboard:

| Key | Where | Action |
| --- | --- | --- |
| `1`–`4` | Home | Select Rest / Energy / HRV / Focus |
| `Enter` | Home | Start |
| `Space` | Session | Pause / Resume |
| `Escape` | Session or completion | End (back home) |
| `Space` / `Enter` / tap | Completion | Back home |

## Home toggles

All three default off (the timer is hidden most of the time unless you opt in). Preferences persist in `localStorage`:

| Toggle | Key | Default |
| --- | --- | --- |
| Always show timer | `breathe.alwaysTimer` | off — sparse glimpses |
| Soft audio | `breathe.audio` | off |
| Haptics | `breathe.haptics` | off |

**Always show timer** keeps the remaining-time counter visible for the whole session (accessibility). Otherwise the counter appears only about four or five times: near `5:00`, near `0:30`, and two or three brief mid-session fades. It fades in and out; it never flashes. The bubble is the continuous cue.

**Soft audio** is a continuous swell/fade tone tied to inhale and exhale — not a metronome beep. It starts on the Start gesture (browsers block autoplay), and mutes on Pause or End.

**Haptics** is a light `navigator.vibrate` on phase change when the browser supports it. No vibration if the toggle is off or the API is missing.

Home also shows one short technique line for the selected pattern (never during the session). Rest’s line mentions the double inhale and long exhale.

## The four protocols

Every session is **5:00**. Cycles repeat until the clock hits zero, even if that is mid-breath.

### 1. Rest — cyclic sighing (2–1–6)

| Phase | Seconds | How |
| --- | ---: | --- |
| First nasal inhale | 2 | Nose, to most of a full breath |
| Second nasal top-up | 1 | Shorter nose inhale to the top |
| Long mouth exhale | 6 | Slow exhale through the mouth |

Stanford-style cyclic sighing: a nasal inhale, a second shorter nasal top-up, then a long mouth exhale. The 9-second loop (~6.7 breaths/min) repeats through a calm 5:00. The bubble expands in two steps on the double inhale, then takes a long shrink on the exhale.

Balban et al. 2023 (*Cell Reports Medicine*) compared five minutes of cyclic sighing to other brief breathwork and to mindfulness; cyclic sighing improved mood and reduced respiratory rate more than the mindfulness arm. The paper does not publish exact phase seconds, so this app uses 2s + 1s + 6s as a documented, calm loop that fits the five-minute session.

Rest’s atmosphere is slightly dimmer and cooler than Energy.

### 2. Energy — upregulating 4–2

| Phase  | Seconds |
| ------ | ------- |
| Inhale | 4       |
| Exhale | 2       |

The inverse of a calming breath. Inhalation mechanically speeds the heart; exhalation slows it. Making the inhale longer (and relatively more vigorous) than the exhale therefore raises alertness — the principle Andrew Huberman describes for inhale-emphasized breathing, and the same autonomic direction as cyclic hyperventilation, without empty-lung holds or rapid 25-breath rounds. About 10 breaths/min, sustainable for a full five minutes before a performance or when you need to come up.

### 3. HRV — coherent / resonant breathing (5–5)

| Phase  | Seconds |
| ------ | ------- |
| Inhale | 5       |
| Exhale | 5       |

Six breaths per minute (~0.1 Hz) sits on the baroreflex resonance frequency of most adults. That is the pacing used in HRV biofeedback (Lehrer, Vaschillo, Gevirtz): heart rate, blood pressure, and breath lock together and HRV amplitude is typically largest. A 2022 meta-analysis (Laborde et al.) found slow-paced breathing increases vagally mediated HRV during and right after practice. No holds — a continuous wave.

### 4. Focus — box breathing (4–4–4–4)

| Phase  | Seconds |
| ------ | ------- |
| Inhale | 4       |
| Hold   | 4       |
| Exhale | 4       |
| Hold   | 4       |

Tactical / box breathing: equal sides, used by the Navy and first responders before high-load work. Because inhale and exhale are the same length, it does not sedate the way a long-exhale rest pattern does; the holds add a mild CO₂ stimulus and a counting scaffold for attention. Stanford’s 2023 5-minute breathwork trial (Balban et al., *Cell Reports Medicine*) included box breathing as a structured protocol. Use it as a pre-study or pre-exam reset: alert, not drowsy.

## Motion and completion

In the last 0.5s of a phase the glow shifts slightly toward the next breath — no words. If the OS asks for reduced motion (`prefers-reduced-motion: reduce`), the large scale pulse is replaced by a gentler opacity/color change. Phase timing stays the same.

A finished 5:00 fades quietly. There is no celebratory sound or jump cut home.

## Install (PWA)

From a served origin (`python3 -m http.server` or any HTTPS host):

1. Open the app in Chrome, Safari, or Edge.
2. Use **Add to Home Screen** / **Install app**.
3. The manifest (`manifest.webmanifest`) and a small service worker (`sw.js`) cache the static shell (`index.html`, scripts, styles, icons) so the app still opens offline.

Icons are derived from `favicon.svg`.

## Verify

Automated (protocol timings, Rest double-inhale scale, pause/resume clock, sparse timer, PWA files):

```bash
node scripts/check.mjs
```

Manual checklist:

1. Home shows four labels (Rest, Energy, HRV, Focus), a technique line, **Start**, and three toggles (off by default). Rest’s technique mentions double inhale and long exhale.
2. Start Rest. Controls are **Pause** and **End** only. No inhale/exhale/hold labels. Atmosphere is dimmer than Energy.
3. Bubble grows in two steps (2s then 1s), then shrinks for 6s. Countdown appears near `5:00`, fades, and is not on screen the whole time (unless Always show timer is on).
4. **Space** pauses (bubble and clock freeze). **Space** again resumes the same session. **Escape** or **End** returns home with no guilt copy; a quiet elapsed time is optional.
5. Energy: bubble grows slowly (4s) and shrinks faster (2s); amber on inhale, deep orange on exhale; it never freezes at full or empty size. Brighter than Rest.
6. HRV: equal 5s grow and 5s shrink; bright teal vs deep teal.
7. Focus: grow, pause large, shrink, pause small (4s each). Hold uses a distinct violet tint vs sky-blue inhale and deep-blue exhale.
8. Let any pattern reach `0:00`. Quiet fade; tap or press a key to return home.
9. Turn on Always show timer, Soft audio, and Haptics; reload — they stay on. Audio starts with Start, mutes on Pause/End. With reduced-motion enabled in the OS, the bubble should not pulse in size.
10. Served over HTTP, the document links a manifest and registers a service worker. Add to Home Screen is available in a supporting browser.

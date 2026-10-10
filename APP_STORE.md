# App Store checklist (Median or Despia)

Wrap this static app for iOS. The site is the whole product: offline shell, six breathing cards, about / privacy / support. Do not add accounts or a backend for the wrapper.

## Identity

| Item | Value |
| --- | --- |
| App name | Practical Breathing |
| Name fallback | Breathing Protocols |
| Subtitle | Breathing for any moment |
| Promotional text | Free. No account. No ads. Nothing leaves your phone. |
| Bundle id | `com.TODO.breathe` |
| Version | `APP_VERSION` in `protocols.js` (currently 1.5.0). Keep the wrapper version in step with it. |
| Privacy policy URL | https://taraannplimpton-arch.github.io/breathing-app/privacy.html |
| Support URL | https://taraannplimpton-arch.github.io/breathing-app/support.html |
| Contact shown in the app | noodleelder@gmail.com |
| Category | Health & Fitness, or Lifestyle if Health invites medical review |
| Devices | TODO: iPhone only, or iPhone and iPad |

“Breathwork” is already taken on the App Store (Hollr People Limited, id6740619490). Do not use it. The fallback name is Breathing Protocols.

Do not put a duration, or calm / focus / sleep, in the name. The home wordmark, listing, manifest name, Apple title, and About name are Practical Breathing. The manifest short name is Breathing.

The manifest is already scoped for GitHub Pages: `id`, `scope`, and `start_url` are `/breathing-app/`. Icon files include 192, 512, opaque 1024 (no alpha, no rounded corners), 180 for the home-screen touch icon, and a maskable 512.

Icon direction: one soft glowing circle on near-black. No letters.

## Privacy and support URLs (flagged)

Those URLs live under the GitHub user `taraannplimpton-arch`, which exposes her name. Do not change hosting in this repo. If the listing should not show that name, pick one of:

(a) a new GitHub account or org with a neutral name, then move Pages  
(b) a custom domain on GitHub Pages  
(c) host privacy and support on another static host

## Listing copy

Subtitle: Breathing for any moment.

Promotional text: Free. No account. No ads. Nothing leaves your phone.

Think First — Stop, notice, then choose. That airport candy, the reply-all, the cart checkout. Breathe first, then decide. About 3 minutes. It ignores the minute picker.

The other cards are Calm Down, Energy, HRV, Focus, and Sleep. Educational breathing practice. Not medical advice, and not for emergencies.

## App Privacy

Answer **Data Not Collected**.

The app has no account, no analytics, no tracking, and no third-party SDK in the web layer. Preferences live in `localStorage` on the device. Sessions are not saved. Do not let the wrapper add crash reporting, attribution, or ad SDKs unless the privacy policy and this answer change first.

Privacy nutrition label: Data Not Collected. Confirm again in App Store Connect after the wrapper’s own SDKs are listed.

Apple Health is not written in this version. Mindful Minutes needs a category sample, and no documented JavaScript API writes one, so the Settings switch stays hidden. If a later wrapper adds that write, confirm this nutrition label again before turning it on. The web app still does not collect Health data. The privacy page already says that if the person turns it on, completed session minutes are saved to Apple Health on the device and are not sent.

## Age rating

No user accounts, no user-generated content, no unrestricted web browsing if the wrapper only loads this origin. There is no graphic content.

TODO: complete Apple’s age-rating questionnaire. Do not guess in the store listing; record the questionnaire result here.

## Guideline 4.2 (minimum functionality)

A thin website wrapper is a known rejection risk under guideline 4.2: Apple may say the app is just a website. This project is offline, standalone, and useful without an account, which helps, but it may not be enough.

What the wrapper can add that the iPhone browser cannot:

- **Native haptics.** iOS Safari and Add to Home Screen do not implement `navigator.vibrate`. The Haptics switch is hidden unless Median, Despia, or `navigator.vibrate` is detected. Calls do not throw when the bridge is missing. Median uses `median.haptics.trigger({ style })`; legacy `gonative` is detected the same way. Inhale is `impactLight`. Exhale is `impactLight`, or Android `tick` (the lightest Android style — there is no soft style). Holds call nothing. A completed session uses `notificationSuccess`. Despia uses `lighthaptic://` on inhale and exhale, nothing on holds, and `successhaptic://` at session end. Android web falls back to a short vibrate (12 ms inhale, 6 ms exhale, a double pulse at the end). Ending early does not play the success tap.
- **Local notifications (reminders).** Optional, off by default. The person picks a time. Copy is fixed: “A minute to breathe, whenever you're ready.” Despia can schedule one on-device notification with `sendlocalpushmsg://push.send?s=SECONDS=msg!BODY&!#TITLE&!#URL` (values URI-encoded, delay in seconds, deep link is the page the app opened). No remote push service and no callback. It is one-shot: there is no documented cancel or repeat. The app schedules the next occurrence when it is opened or the time changes, and it does not schedule a second notification for the same occurrence. Turning the reminder off, changing the time, or Reset settings does not cancel a notification already handed to the system. It only refuses to schedule the next one. The reminder re-arms only when the app is opened. Median does not document an on-device local-notification JavaScript API. Its notification plugins are remote push services only. Use Despia for this reminder. Do not add a remote push service.
- **Apple Health.** Not possible with the documented JavaScript APIs. The switch stays hidden. Despia's `writehealthkit://` command writes a numeric quantity. Mindful Minutes is a category sample with a start and an end, and no category write is documented. Median does not document a HealthKit JavaScript API. The adapter writes only when a category writer is actually present, and only after a completed session, not after End. Mindful Minutes needs a custom native plugin, or the wrapper confirming a category write, before the switch can show.

TODO: choose Despia if the daily reminder should ship. Haptics can ship on either wrapper. Do not promise a Median reminder or Apple Health in the store description. If those native pieces are not enough for guideline 4.2, the rejection risk stays.

Other native pieces already covered by the web app: portrait standalone display, offline cache, wake lock while a session is open, pause when the app is backgrounded.

## Health-claim wording

Do not say the app treats, cures, prevents, or diagnoses anything. That includes anxiety, insomnia, panic, PTSD, blood pressure, and pain.

Avoid: treatment, cure, therapy, clinical, rehab.

Prefer: breathing practice, educational, not medical advice, not for emergencies.

Think First is a short pause before an everyday impulse. The in-app safety note stays: stop if you feel faint, dizzy, panicky, or have chest pain; consult a doctor first if pregnant or with heart, lung, seizure, or other significant conditions.

Screenshot captions and the store description use the same restraint. Do not put a claim in the subtitle that the app itself refuses to make.

## Screenshots

Capture on the real UI (home with the six cards, a session, Think First, About). No fake medical dashboards.

| Device | Size (pixels, portrait) |
| --- | --- |
| 6.9" iPhone | 1320 × 2868 |
| 6.7" iPhone | 1290 × 2796 |
| 6.5" iPhone | 1284 × 2778 (1242 × 2688 is also accepted on older slots) |
| iPad 13" if supported | 2064 × 2752 |
| iPad 12.9" if supported | 2048 × 2732 |

TODO: if the binary is iPhone-only, do not upload iPad screenshots; say so in App Store Connect. If iPad is supported, provide the iPad sizes too. The web layout is portrait-first.

## Decisions the owner must make

- TODO: bundle id. Replace `com.TODO.breathe`.
- TODO: Apple Developer team and who uploads the build.
- TODO: “Breathwork” is already taken on the App Store (Hollr People Limited, id6740619490). Primary name is Practical Breathing. Fallback: Breathing Protocols. The manifest name is Practical Breathing; short_name is Breathing.
- TODO: Median (haptics only) or Despia (haptics and the on-device reminder), and the wrapper’s minimum iOS version.
- TODO: iPhone only, or iPhone and iPad.
- TODO: Apple Health stays off until a wrapper can write a Mindful Session category sample. Recheck App Privacy before enabling it. Reminder copy is fixed and the control stays off until the person opts in.
- TODO: age-rating questionnaire answers.
- TODO: subtitle, description, keywords, and promotional text with no treatment or cure claims.
- TODO: which screenshots show Think First.
- TODO: price (this app is built as free) and availability countries.
- TODO: export compliance. The web app adds no custom encryption beyond the platform HTTPS stack.
- TODO: confirm App Privacy stays **Data Not Collected** after the wrapper’s libraries are included.
- TODO: privacy and support URLs return 200 on the GitHub Pages host before review.
- TODO: sign-in. There is none. Do not add one for the store.

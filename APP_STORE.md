# App Store checklist (Median or Despia)

Wrap this static app for iOS. The site is the whole product: offline shell, six breathing cards, about / privacy / support. Do not add accounts or a backend for the wrapper.

TODO: REPLACE support@example.com with the dedicated support address before publishing.

## Identity

| Item | Value |
| --- | --- |
| App name | Breathe |
| Bundle id | `com.TODO.breathe` |
| Version | `APP_VERSION` in `protocols.js` (currently 1.4.0). Keep the wrapper version in step with it. |
| Privacy policy URL | https://taraannplimpton-arch.github.io/breathing-app/privacy.html |
| Support URL | https://taraannplimpton-arch.github.io/breathing-app/support.html |
| Contact shown in the app | support@example.com (placeholder) |
| Category | Health & Fitness, or Lifestyle if Health invites medical review |
| Devices | TODO: iPhone only, or iPhone and iPad |

The manifest is already scoped for GitHub Pages: `id`, `scope`, and `start_url` are `/breathing-app/`. Icon files include 192, 512, opaque 1024 (no alpha, no rounded corners), 180 for the home-screen touch icon, and a maskable 512.

## App Privacy

Answer **Data Not Collected**.

The app has no account, no analytics, no tracking, and no third-party SDK in the web layer. Preferences live in `localStorage` on the device. Sessions are not saved. Do not let the wrapper add crash reporting, attribution, or ad SDKs unless the privacy policy and this answer change first.

Privacy nutrition label: Data Not Collected. Confirm again in App Store Connect after the wrapper’s own SDKs are listed.

## Age rating

No user accounts, no user-generated content, no unrestricted web browsing if the wrapper only loads this origin. The only sensitive line is the Avoid the Urge caution about heavy daily drinking. There is no graphic content.

TODO: complete Apple’s age-rating questionnaire. Likely 4+ or 12+ depending on how that alcohol caution is classified. Do not guess in the store listing; record the questionnaire result here.

## Guideline 4.2 (minimum functionality)

A thin website wrapper is a known rejection risk under guideline 4.2: Apple may say the app is just a website. This project is offline, standalone, and useful without an account, which helps, but it may not be enough.

What the wrapper can add that the iPhone browser cannot:

- **Native haptics.** iOS Safari and Add to Home Screen do not implement `navigator.vibrate`. The in-app haptics toggle correctly reports that it is unavailable. Median or Despia can bridge a light tap on phase change. That is a real device capability, not a new medical feature.
- **Local notifications (reminders).** Optional, on-device reminders to practice — for example a daily time the person picks. No server, no marketing pushes. Copy should invite, not nag, and should not claim a treatment outcome.

TODO: decide whether v1 of the wrapper actually ships native haptics, local reminders, or both. If neither ships, 4.2 risk stays high. Do not promise either in the App Store description until it works.

Other native pieces already covered by the web app: portrait standalone display, offline cache, wake lock while a session is open, pause when the app is backgrounded.

## Health-claim wording

Do not say the app treats, cures, prevents, or diagnoses anything. That includes anxiety, insomnia, panic, PTSD, blood pressure, pain, and addiction.

Avoid: treatment, cure, therapy, clinical, rehab, “stop drinking,” “quit smoking,” “for addiction.”

Prefer: breathing practice, educational, not medical advice, not for emergencies.

Avoid the Urge is a short pause when an impulse shows up. It is not an addiction program. The doctor line stays: if you drink heavily every day, talk to a doctor before stopping suddenly. The in-app safety note stays: stop if you feel faint, dizzy, panicky, or have chest pain; consult a doctor first if pregnant or with heart, lung, seizure, or other significant conditions.

Screenshot captions and the store description use the same restraint. Do not put a claim in the subtitle that the app itself refuses to make.

## Screenshots

Capture on the real UI (home with the six cards, a session, Avoid the Urge, About). No fake medical dashboards.

| Device | Size (pixels, portrait) |
| --- | --- |
| 6.9" iPhone | 1320 × 2868 |
| 6.7" iPhone | 1290 × 2796 |
| 6.5" iPhone | 1284 × 2778 (1242 × 2688 is also accepted on older slots) |
| iPad 13" if supported | 2064 × 2752 |
| iPad 12.9" if supported | 2048 × 2732 |

TODO: if the binary is iPhone-only, do not upload iPad screenshots; say so in App Store Connect. If iPad is supported, provide the iPad sizes too. The web layout is portrait-first.

## Decisions the owner must make

- TODO: REPLACE support@example.com with the dedicated support address before publishing. Update privacy.html, support.html, About, and this file. Do not use a personal inbox.
- TODO: bundle id. Replace `com.TODO.breathe`.
- TODO: Apple Developer team and who uploads the build.
- TODO: confirm the name “Breathe” is available, or pick another display name. The manifest name is Breathe.
- TODO: Median or Despia, and the wrapper’s minimum iOS version.
- TODO: iPhone only, or iPhone and iPad.
- TODO: ship native haptics, local notification reminders, both, or neither (4.2 risk if neither).
- TODO: reminder copy and default schedule, if reminders ship. Off until the person opts in.
- TODO: age-rating questionnaire answers.
- TODO: subtitle, description, keywords, and promotional text with no treatment, cure, or addiction claims.
- TODO: which screenshots show Avoid the Urge (the doctor line is on About, not on the card).
- TODO: price (this app is built as free) and availability countries.
- TODO: export compliance. The web app adds no custom encryption beyond the platform HTTPS stack.
- TODO: confirm App Privacy stays **Data Not Collected** after the wrapper’s libraries are included.
- TODO: privacy and support URLs return 200 on the GitHub Pages host before review.
- TODO: sign-in. There is none. Do not add one for the store.

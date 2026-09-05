# Publishing Envelope to Google Play

Everything the code could do is done (see the diff this doc ships with). This is what's left, in
order — none of it is code, it's account setup and console clicks. First time doing this: budget a
free afternoon for the console setup, then a 14-day wait for closed testing before you can go live.

## 1. Before you touch the Play Console

- [ ] **Pick a support email.** Every `[your support email]` placeholder in `Web/app/legal/*` and a
  field in the Play listing need one. A dedicated alias (e.g. a Google Group or a filter in your own
  inbox) beats a personal address — replace the placeholder with a find-and-replace across those
  three files once you have it.
- [ ] **Firebase**: in the [Firebase console](https://console.firebase.google.com), project
  `envelope-20125` → Add app → Android, package name `com.sukrit04.envelope` (the renamed package —
  see the diff). Download the new `google-services.json` and replace both
  `Mobile/google-services.json` and `Mobile/android/app/google-services.json` (the second one only
  exists after your next `expo prebuild`). While you're in the Firebase console, restrict the Android
  API key in that file to this package name + your release SHA-1 (Google Cloud console → APIs &
  Services → Credentials).
- [ ] **WorkOS dashboard**: add a redirect URI matching the new scheme,
  `com.sukrit04.envelope://callback`, next to whatever the old `com.sukrit04.Mobile://callback` entry
  was. Leave the old one until you've confirmed the new build signs in, then remove it.
- [ ] **EAS credentials**: run `eas credentials` inside `Mobile/` and let EAS generate and hold your
  Android upload keystore. Don't create one by hand — losing it means you can never update the app
  again under the same listing.
- [ ] **EAS environment variables**: the app needs four `EXPO_PUBLIC_*` values at build time
  (`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WORKOS_CLIENT_ID`, `EXPO_PUBLIC_POSTHOG_KEY`,
  `EXPO_PUBLIC_POSTHOG_HOST` — see `Mobile/.env` for your current values). These are safe to be
  public — they're already inlined into the shipped app bundle — but don't paste them into
  `eas.json` itself, since that file is committed. Push them once instead:
  `eas env:create --scope project --environment production --name EXPO_PUBLIC_API_URL --value <...> --visibility plaintext`
  (repeat per variable). Confirm with `eas env:list --environment production` before building.
- [ ] **Google Play service account**: Play Console → Setup → API access → create a service account,
  grant it release-manager permissions, download its JSON key, save it as
  `Mobile/play-service-account.json` (gitignored — see `.gitignore`). `eas submit` reads it from
  there per `eas.json`.

## 2. Google Play Developer account

- Sign up at [play.google.com/console](https://play.google.com/console) — $25 one-time fee.
- You're publishing as an **individual**, so Google will ask for identity verification (a government
  ID and a short wait, sometimes a few days) before you can publish anything, even to a closed test.
  Start this early — it's the one step with a queue outside your control.
- Individual accounts must also run a **closed test with at least 12 testers for 14 continuous days**
  before Google allows a production release. Line up 12 people with Google accounts now so the clock
  can start as soon as you have a build.

## 3. Create the app in Play Console

- Create app → name **Envelope**, default language, Free, confirm the declarations.
- App category: Finance.
- Store listing:
  - Short description (≤80 chars): e.g. "Envelope budgeting for real spending, in rupees."
  - Full description (≤4000 chars): pull from `Web/PRODUCT.md`'s Product Purpose / Capabilities
    sections — accurate, not aspirational (that doc was corrected as part of this work to drop the
    "self-hosted, nothing leaves your machine" framing, since Gemini and PostHog now receive data).
  - App icon: `Mobile/store/play-icon-512.png` (already generated from `assets/icon.png`).
  - Feature graphic (1024×500) and at least 2 phone screenshots (4–8 recommended): not generated here
    — these need real device screenshots or a design pass, and Play prohibits placeholder/fake
    screenshots, so don't fabricate them. Capture from a real build once you have one installed.
  - Support email: the one you picked in step 1.
  - Privacy policy URL: `https://<your-deployed-domain>/legal/privacy` — confirm it loads logged out
    before you paste it in (see Verification below).

## 4. Data Safety form

Fill it in from what the app actually does (audited, not guessed):

| Data type | Collected? | Shared? | Purpose |
|---|---|---|---|
| Email address, name | Yes | Yes (WorkOS, PostHog) | Account management, analytics |
| Financial info (transactions, budgets) | Yes | Yes (Google Gemini, for AI features only) | App functionality |
| Photos (receipts) | Yes, transient | Yes (Google Gemini, not stored after processing) | App functionality |
| Device or other IDs (push token) | Yes | Yes (Google/Expo push infra) | Notifications |
| App interactions | Yes | Yes (PostHog) | Analytics |

- Encryption in transit: **Yes** (all HTTPS).
- Users can request data deletion: **Yes** — link `https://<your-domain>/legal/delete-account`.
- Data collection is user-initiated / tied to account use, not sold, no ads.

## 5. Content rating questionnaire

Answer as a finance/utility app with no user-generated public content, no messaging between users, no
violence, gambling, or mature themes. Should land in the lowest rating tier (Everyone).

## 6. Build and submit

```bash
cd Mobile
npm run build:android   # eas build --platform android --profile production
npm run submit:android  # eas submit --platform android --profile production
```

The first submit targets the `internal` track (set in `eas.json`). Promote to the closed testing
track in the Play Console once the internal build looks right, add your 12 testers there, and let the
14-day clock run. Only after that window can you promote to production.

## 7. Verification before you submit anything

- [ ] `npm run typecheck && npm run lint && npm test` (Mobile) and `npm run build && npm test` (Web).
- [ ] `npx expo prebuild --clean`, build a release, then check the **merged** manifest at
  `android/app/build/intermediates/merged_manifest/release/.../AndroidManifest.xml` — `RECORD_AUDIO`,
  `SYSTEM_ALERT_WINDOW`, and the launcher-badge permissions should be gone; `CAMERA` and
  `POST_NOTIFICATIONS` should remain.
- [ ] Open `/legal/privacy`, `/legal/terms`, `/legal/delete-account` in a **logged-out incognito
  window** on the deployed URL — the single most common first-submission rejection is a policy URL
  that requires a login.
- [ ] On the welcome screen, tap "Terms" and "Privacy Policy" — both should open a browser now.
- [ ] Toggle analytics off in More → Your data, log an expense, confirm nothing new shows up in
  PostHog; toggle back on and confirm it resumes.
- [ ] Install the release build via internal testing and confirm sign-in (new package ID means a new
  WorkOS redirect URI, tested above), bill scanning, and push notifications all still work.

## What's deliberately not done

- **Crash reporting.** No Sentry/Crashlytics today; Play doesn't require it. Worth adding once real
  users exist to generate crashes worth reading.
- **iOS.** `Mobile/ios/Envelope/PrivacyInfo.xcprivacy` currently declares no data collection and no
  tracking, which is inaccurate given PostHog — fix that before any TestFlight build, but it's not a
  Play blocker.
- **Feature graphic and screenshots.** Mechanical assets (icon resize) are generated; anything
  requiring a real device or design judgment is left for you, on purpose — see step 3.

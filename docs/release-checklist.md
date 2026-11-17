# Release checklist (Google Play)

Everything in code is done; these steps need the Play Console account owner.

## 0. Developer account

- Publish from the **Kalkan Software** Play Console account: the personal account whose developer
  name is "Kalkan Software", the one Fazor uses. That name must match `PUBLISHER` in
  `src/ui/copy.ts`; the account's developer contact is `support@kalkansoftware.com` and
  `https://kalkansoftware.com`.
- Create the app with package **`com.kalkansoftware.tenulo`** (`app.json`). A package name is
  permanent once any build is uploaded, to any track.
- The privacy policy the app links to (`PRIVACY_POLICY_URL` in `src/ui/copy.ts`) is live and
  names Kalkan Software: `curl -sL -o /dev/null -w "%{http_code}" https://kalkansoftware.com/tenulo/privacy/`
  prints `200`. Its source is the kalkansoftware.com site repo; change it there first, then here.
- The policy describes everything the app stores, in Turkish and English: weigh-ins, injections,
  plan, side effects, and the daily log (food entries and the user's own foods, water,
  body measurements, exercise, daily goals, language, which body figure the site map shows). All
  of it stays on the phone; nothing about Health Connect changes (Weight, read-only).

## 1. Build

```bash
pnpm install
pnpm typecheck && pnpm lint && pnpm test
npx expo-doctor            # see "Known doctor warnings" below
npx expo prebuild --platform android --no-install
cd android && ./gradlew app:bundleRelease   # -> android/app/build/outputs/bundle/release/app-release.aab
```

The AAB is built and signed here, with no Expo account (EAS stays possible: `eas.json` is kept).

- `app.json`: `version` 1.0.0, `android.versionCode` 1. Bump `versionCode` on every upload and commit
  it: `eas.json` sets `appVersionSource: "local"`, so the version in git is the one that ships, for
  EAS and local builds alike (`package.json` `version` is kept equal to `expo.version`).
- `eas.json` profiles: `production` builds the AAB for Play; `preview` is a release-mode APK to
  sideload (store screenshots, testing); `development` is the dev client. All enable `corepack`, so
  EAS installs the pnpm version pinned in `package.json` `packageManager`: the lockfile and
  `pnpm-workspace.yaml` (`allowBuilds`) need that pnpm major.
- Signing: Play App Signing holds the app signing key; we sign uploads with the owner's upload key.
  It lives outside the repo (`~/keystores/tenulo-upload.jks`, made with Android Studio's
  `keytool`), and `plugins/with-release-signing.js` reads it from four Gradle properties in
  `~/.gradle/gradle.properties`: `TENULO_UPLOAD_STORE_FILE`, `TENULO_UPLOAD_STORE_PASSWORD`,
  `TENULO_UPLOAD_KEY_ALIAS`, `TENULO_UPLOAD_KEY_PASSWORD`. Without them a release build stops with
  an error; it never falls back to the debug key. Keep a backup of the `.jks` and its password; if
  it is lost, Play Console can reset the upload key (Setup → App signing).
- Check the signer before uploading: `keytool -printcert -jarfile app-release.aab` shows the
  upload certificate (CN=Kalkan Software).
- On a `preview` build with data in it, run Settings → Delete all data once. The alert must say
  "Tenulo is empty again. Reminders were cancelled too." with nothing after it. The other text means
  VACUUM or the WAL checkpoint failed on the device's SQLite, which the Node tests cannot show (see
  `purgeDeletedData` in `src/db/ops.ts`).

## 2. In-app product

Play Console → Monetize → Products → In-app products → Create:

| Field | Value |
| --- | --- |
| Product ID | `tenulo_pro` (must match `PRO_PRODUCT_ID` in `src/platform/billing.ts`) |
| Type | One-time, non-consumable |
| Name | Tenulo Pro |
| Description | Doctor report (PDF) and Health Connect sync. One purchase, no subscription. |
| Price | your choice |

Test with a license-tester account on an internal testing track: buy, cancel, a pending payment
("slow test card"), refund, and "Restore purchase" on a second device.

## 3. Health Connect declaration

Play Console → App content → Health apps / Health Connect permissions:

- Permission: **Read Weight** only.
- Purpose: show smart-scale and other apps' weight readings in the user's own log and trend.
- Privacy policy URL: https://kalkansoftware.com/tenulo/privacy/ (it already describes this).
- Approval can take up to a week, plus 5–7 business days to propagate.

## 4. Data safety form

Answers that match the code (re-check against Google's current definitions before submitting):

- Data collected: **none** (nothing is transmitted off the device by the app).
- Data shared: **none**.
- Health and fitness data is processed on the device only (manual entries and Health Connect).
- Encryption in transit: not applicable (no app server).
- Users can request deletion: yes, in-app ("Delete all data"); there is no server copy.
- Google Play Billing handles purchases; Tenulo receives only the purchase state on the device.

## 5. Store listing

- Text: `docs/store/listing.md`, Turkish (default listing language) and English.
- Graphics: `docs/store/icon-512.png`; the feature graphic per store language,
  `docs/store/feature-graphic-tr.png` (Turkish, the default listing) and
  `docs/store/feature-graphic.png` (English). Regenerate them, with the app icon, splash and
  notification icon, by `python scripts/brand.py <Roboto.ttf>`.
- Screenshots: the five screens and captions in `docs/store/listing.md` (1080 × 1920), once with
  the app in Turkish and once in English. Sample data only, never real data. To redo them, per
  language (`tr-TR`, then `en-US`) on the emulator:
  1. `adb shell cmd locale set-app-locales com.kalkansoftware.tenulo --user 0 --locales tr-TR`
     (`pm clear` resets it, so set it after clearing).
  2. In the dev build: finish the welcome pages, then Settings → "Load sample data". It names
     foods, the medication and notes in the app's language.
  3. `adb install -r` a local release APK
     (`cd android && ./gradlew app:assembleRelease -PtenuloDebugSignedRelease=true`) over
     the dev build: both are signed with the debug key, so the sample data stays.
  4. Demo-mode status bar, then capture `today`, `food`, `progress` (`tenulo://` deep links) and
     `log-injection` with the suggested site tapped, into `docs/store/screenshots/raw/<lang>/`.
  5. Settings → Delete all data (this also checks the alert text, see step 1), then capture the
     last welcome page as `welcome-private.png`.
  6. `python scripts/store_screens.py <Roboto.ttf>`. Android's own variable Roboto works:
     `adb pull /system/fonts/Roboto-Regular.ttf`.
- The release changes native code (the reminder module sets notification texts per language), so
  a store build must come from a fresh `eas build`, not an OTA update.
- Content rating questionnaire: medical/health reference, no user-generated content shared.
- Target audience: 18+ (matches the privacy policy).

## Known doctor warnings

- `@expo/config-plugins` installed directly: it pins the peer of `react-native-health-connect`
  to the version Expo already uses, so pnpm does not add a second, newer copy. After
  `npx expo install --fix`, set the pin to the version in `node_modules/expo/package.json` and
  check that `node_modules` holds only one copy of `@expo/config-plugins`.

If `npx expo install --fix` says a version is too new, that is pnpm's `minimumReleaseAge`
rejecting packages published in the last day: run it again a day later.

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
- The policy describes the narrow app (`expo.extra.medication: false`), in Turkish and English:
  weight, food entries and the user's own foods, water, body measurements, exercise, daily goals
  and settings, weigh-in reminders, Health Connect `Weight` read-only, the PDF report and backup
  files, plus the one neutral sentence about entries from earlier test versions. All of it stays
  on the phone. It names no medication word; what it must say, and the word check after deploy,
  are in `docs/store/site-privacy-update.md`.

## 1. Build

```bash
pnpm install
pnpm typecheck && pnpm lint && pnpm test
npx expo-doctor            # see "Known doctor warnings" below
npx expo prebuild --platform android --no-install
cd android && ./gradlew app:bundleRelease   # -> android/app/build/outputs/bundle/release/app-release.aab
```

The AAB is built and signed here, with no Expo account (EAS stays possible: `eas.json` is kept).

- `app.json`: `version` 1.0.0, `android.versionCode` as committed (5 for the narrow build). Bump `versionCode` on every upload and commit
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
- Check the medication switch before any Play upload (ADR 0007): `expo.extra.medication` is
  `false` (`node -p "require('./app.json').expo.extra.medication"` prints `false`), and the bundle
  manifest has `<meta-data android:name="tenulo.medication" android:value="false"/>`
  (`grep tenulo.medication android/app/build/intermediates/bundle_manifest/release/processApplicationManifestReleaseForBundle/AndroidManifest.xml`,
  the path the current Android Gradle Plugin writes). `android/` is generated, so every release
  build runs `npx expo prebuild --platform android --no-install` first, as above: a build from an
  older `android/` carries the old value or none, and the reminder module reads a missing value
  as medication on.
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
| Description | Narrow build: PDF report (weight trend, nutrition, water, measurements, exercise). One purchase, no subscription. With medication features (ADR 0007): doctor report. |
| Price | your choice |

Test with a license-tester account on an internal testing track: buy, cancel, a pending payment
("slow test card"), refund, and "Restore purchase" on a second device.

## 3. Health Connect declaration

Play Console → App content → Health apps / Health Connect permissions:

- Permission: **Read Weight** only.
- Purpose: show smart-scale and other apps' weight readings in the user's own log and trend.
- Privacy policy URL: https://kalkansoftware.com/tenulo/privacy/ (it already describes this).
- Approval can take up to a week, plus 5–7 business days to propagate.
- Health Connect is free (ADR 0006), so the reviewer can turn it on without a purchase.

App access (Play Console → App content → Sign-in details): "Yes". The one-time product counts as
restricted, and "Yes" requires confirming the details give full access, paid content included.
Tell the reviewer there is no account, every log and Health Connect is free, and give unused
Google Play promo codes for `tenulo_pro` (Monetize → Promo codes; one-time products only get
single-use codes, up to 500 a quarter, valid up to a year). Keep the test-device toggle off so
automated runs do not spend the codes. Never commit the codes; when the listed ones are used or
expire, put fresh ones in the note.

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
     foods and notes in the app's language.
  3. `adb install -r` a local release APK
     (`cd android && ./gradlew app:assembleRelease -PtenuloDebugSignedRelease=true`) over
     the dev build: both are signed with the debug key, so the sample data stays.
  4. Demo-mode status bar, then capture `today`, `food`, `progress` and `water`
     (`tenulo://` deep links; `tenulo://water` is saved as `water.png`, which becomes
     `04-water.png`) into `docs/store/screenshots/raw/<lang>/`.
  5. Settings → Delete all data (this also checks the alert text, see step 1), then capture the
     last welcome page as `welcome-private.png`.
  6. `python scripts/store_screens.py <Roboto.ttf>`. Android's own variable Roboto works:
     `adb pull /system/fonts/Roboto-Regular.ttf`.
- The release changes native code (the reminder module sets notification texts per language), so
  a store build must come from a fresh `eas build`, not an OTA update.
- Content rating questionnaire: "All other app types"; no rating-relevant content, no user interaction, no online content, digital purchases yes (as answered on 2026-11-18, docs/RELEASE.md).
- Target audience: 18+ (matches the privacy policy).

## Known doctor warnings

- `@expo/config-plugins` installed directly: it pins the peer of `react-native-health-connect`
  to the version Expo already uses, so pnpm does not add a second, newer copy. After
  `npx expo install --fix`, set the pin to the version in `node_modules/expo/package.json` and
  check that `node_modules` holds only one copy of `@expo/config-plugins`.

If `npx expo install --fix` says a version is too new, that is pnpm's `minimumReleaseAge`
rejecting packages published in the last day: run it again a day later.

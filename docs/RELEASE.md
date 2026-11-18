# Release log

Every Play Console step and release decision, dated. Decisions with a lasting reason go to
`docs/adr/`. The checklist of what a release needs is `docs/release-checklist.md`.

Developer account: Kalkan Software (personal account). App: "Tenulo: GLP-1, Kilo, Beslenme",
package `com.kalkansoftware.tenulo`.

## 2026-11-17

- **Name check before creating the app.**
  - Google Play, Türkiye and United States stores: no app named "Tenulo" or close to it. The
    GLP-1 tracker category has no similar name either.
  - WIPO Global Brand Database (90 sources): no mark containing "tenulo".
  - Not checked: the Turkish Patent Office database, which needs an e-Devlet login.
- **Upload key.** Made by the owner with Android Studio's `keytool` (PKCS12, alias
  `tenulo-upload`), kept outside the repo. Release builds are signed locally, without EAS, by
  `plugins/with-release-signing.js`.
- **Language split off.** `plugins/with-bundle-languages.js` turns off the app bundle's language
  split. Tenulo has its own Turkish/English switch, and Play would otherwise install only the
  phone's language.
- **Play Console: created the app.**
  - Name "Tenulo: GLP-1, Kilo, Beslenme", package `com.kalkansoftware.tenulo` (the console
    showed it as available).
  - Default language Turkish (tr-TR); type app; free.
  - The owner approved both declarations (Developer Program Policies, US export laws).
  - App id 4973557485914653707.
- **Play Console: deleted the old draft.** "Tenulo: GLP-1 & Weight Log"
  (`com.sabahattinkalkan.tenulo`) was a draft from before the package rename, with no release.
  The owner chose to delete it.
- **Internal testing testers.** The account's one-person list "Fazor dahili test" is attached; it is
  the owner, for quick checks on a phone. The 21-person "Test User" list is kept for closed testing
  (12 testers × 14 days, through a Google Group).
- **Internal testing release 1 (1.0.0) published at 17:44.**
  - The bundle is signed with the upload key: certificate CN=Kalkan Software, SHA-256
    `EB:11:C5:53:19:99:66:4E:01:A9:09:D3:96:B1:D9:A6:69:5D:2E:00:DC:9F:4A:F5:75:EE:FD:2A:0F:71:67:0A`.
  - The language split is off.
  - API 26+, target SDK 36; arm64-v8a, armeabi-v7a, x86 and x86_64. Play reports 14.2 MB per
    install.
  - Release notes in tr-TR.
  - Play App Signing: the app signing key is Google's and shows as in use.
  - Opt-in link for testers: https://play.google.com/apps/internaltest/4700356311542017142. Open it
    signed in with the tester account, then install from the phone's Play Store; the web store
    shows 404 for internal tests.
- **Next.**
  - The privacy policy on kalkansoftware.com must list the daily log and the body figure before
    the store listing goes in.
  - Then: store listing (`docs/store/listing.md`), app content forms, the in-app product
    `tenulo_pro`, and the closed test.

## 2026-11-18

- **Privacy policy live in both languages.** The site deploy is `20261117-202422-9be6e91`.
  - Effective date 2026-11-18.
  - It lists the daily log, the user's own goals, the language and the body figure, and names the
    USDA source. The Turkish page's headings are Turkish now.
  - Checked live: both URLs return 200, and every resource comes from kalkansoftware.com.
- **Device-to-device transfer closed.** The site's review found that `allowBackup="false"` does not
  stop device-to-device transfer for apps targeting API 31+, so the database would have been copied
  to a new phone during setup. `plugins/with-no-data-extraction.js` now excludes every storage
  domain from both cloud backup and device transfer.
- **versionCode 2.** Release 1 on internal testing does not have the transfer fix. The next upload
  is versionCode 2.
- **versionCode 2 AAB built** (`tenulo-1.0.0-2.aab`, 66.9 MB). Checked before upload:
  - Signed with the same upload key, SHA-256 `EB:11:C5:53:…:0F:71:67:0A`.
  - The bundle manifest has `versionCode="2"`, `allowBackup="false"` and
    `dataExtractionRules="@xml/data_extraction_rules"`.
- **Default store listing saved as a draft.** Nothing is published yet.
  - Default language: tr-TR. Name "Tenulo: GLP-1, Kilo, Beslenme"; short and full description from
    `docs/store/listing.md`; `icon-512.png`, `feature-graphic-tr.png` and the five TR screenshots in
    order (today, food, trend, injection, private).
  - en-US translation added. Name "Tenulo: GLP-1, Weight & Food"; EN texts from `listing.md`;
    `feature-graphic.png` and the five EN screenshots in the same order.
  - A translation without its own graphics shows the default language's. Adding the first EN
    screenshot replaced the whole inherited TR set for en-US; the TR listing kept its own.
  - Uploading several screenshots back to back drops some of them. Upload one, wait until it shows
    in the slot, then upload the next.
- **Internal testing release 2 (1.0.0) published at 01:16** (console time, 2026-11-18). It replaces
  release 1 on the track.
  - versionCode 2. Release 1's bundle is not carried over.
  - Device support is unchanged from release 1: 11,546 phones, no device lost or added.
  - Release notes in tr-TR and en-US: data is no longer copied by device-to-device transfer, and
    moves to a new phone only with a backup file the user makes.
- **App content: six declarations saved** (not yet sent for review).
  - Privacy policy: https://kalkansoftware.com/tenulo/privacy/.
  - Ads: no. Advertising ID: no (`AD_ID` stays blocked). Government app: no. Financial features:
    none.
  - Health apps: activity and fitness, nutrition and weight management, medication and treatment
    management. "Disease and condition management" is left out on purpose: Tenulo logs, it does
    not manage a condition. The `READ_WEIGHT` reason is in English: read-only, Weight only,
    foreground only, stored on the phone, free (ADR 0006). No regional requirements asked.
- **Sign-in details not saved.** The console counts a one-time product as a restricted part, and
  "Yes" requires ticking "these details give full access to all features, including premium or
  paid content". Health Connect became free (ADR 0006) so the `READ_WEIGHT` reviewer needs no
  purchase; the doctor report will be opened for the reviewer with a Play promo code for
  `tenulo_pro`, once that product exists.
- **Store listing drafts updated** in tr-TR and en-US: Health Connect moved to the weight section;
  Tenulo Pro is the doctor report only. Both texts checked against `docs/store/listing.md` by hash.
- **versionCode 3 AAB built** (`tenulo-1.0.0-3.aab`): same upload key, `versionCode="3"`,
  `dataExtractionRules` present. Not uploaded yet.
- Local build note: from Git Bash, put CMake on PATH with `cygpath -u "$LOCALAPPDATA"`; a Windows
  path with backslashes in PATH leaves Gradle unable to find CMake 4.1.2.
- **In-app product `tenulo_pro` active.** Name "Tenulo Pro" (tr-TR, en-US), description: the
  doctor PDF report, one purchase, no subscription. Purchase option `buy`, backwards compatible.
  Base price USD 2,99 for all 174 countries, converted by Play (TRY 179,99 incl. 20 % KDV,
  AZN 4,99, EUR 3,29). Tax category: digital app sales.
- **Promo codes for review.** Promotion "Play review access - doctor report" (id 131813106):
  10 single-use codes for `tenulo_pro`, 2026-11-18 12:00 to 2027-11-17. The codes live only in
  the CSV the console exports (kept outside the repo).
- **Sign-in details saved.** "Yes, restricted", full access confirmed: the note says there is no
  account, logs and Health Connect are free, and lists three promo codes for the doctor report.
  The toggle that lets Google's test devices use these details is off, so automated runs do not
  spend the single-use codes.
- **Internal testing release 3 (1.0.0) published at 16:56** (console time). It replaces release 2.
  - versionCode 3: Health Connect free, Tenulo Pro is the doctor report (PR 14).
  - Device support unchanged (11,546 phones); install size 14.2 MB.
  - Release notes in tr-TR and en-US: Health Connect is free; Tenulo Pro is the PDF report.
- **Next.** Redeem one promo code (not one of the three in the reviewer note) with the tester
  account and check that Pro unlocks after reopening Tenulo. Then: data safety, content rating,
  target audience.

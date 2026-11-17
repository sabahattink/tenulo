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

# Tenulo without medication features: a general weight and food log for a personal Play account

Status: proposed (2026-11-19), awaiting the owner's approval.

## Why

Google Play rejected Tenulo's first review on 2026-11-18 under the Play Console Requirements
policy: "Health apps, such as medical apps" may only be published from an organization developer
account. Tenulo's account (Kalkan Software) is a personal one. The trigger was the health apps
declaration "Medication and treatment management", which Google groups under Medical; its own
examples include medication reminders, so the injection log, the dose plan shown back and the
injection-day reminder fit it. Declaring anything else while those features are in the app would
be a false declaration (docs/RELEASE.md, 2026-11-18).

Kalkan Software is not a registered company yet, so an organization account (D-U-N-S number,
verified website, organization payments profile) is not available now. The owner's decision:
publish now as a general weight and food log, with no medication features and no "GLP-1" anywhere
the user or Google sees, and bring the medication features back into the same app once the account
is an organization.

## Goals

- One switch, `medication`, decides whether the medication features exist for the user. It is off
  for every build that goes to Play from the personal account.
- With the switch off, nothing in the app, its notifications, its store listing or its Play Console
  declarations presents Tenulo as a medication, injection or GLP-1 tool.
- With the switch on, the app behaves exactly as it does today (versionCode 4).
- No data is lost. Internal testers who logged injections keep those rows in the database, in
  backups and in "Delete all data".
- The app resubmits for review as "Activity and fitness" plus "Nutrition and weight management",
  and passes on a personal account.

## Non-goals

- Removing medication code, tables, migrations or backup fields.
- A second app or a second applicationId.
- New features. The closed test that follows must run without new features (owner's Play rules).
- Changing the app name "Tenulo" or the applicationId.

## Anti-goals (a failure even if it works)

- A medication word, an injection site picker, a dose, or "GLP-1" reachable in the narrow build by
  any path: a deep link, a reminder tap, a restored backup, History, the PDF report, the
  notification channel text, the in-app privacy screen, or a welcome page.
- An injection reminder still scheduled on a tester's phone after they update.
- Losing or rewriting a tester's injection rows.
- A switch that can be forgotten at build time and ship the wrong mode silently.

## Constraints

- Domain code stays pure TypeScript with unit tests (AGENTS.md). Anything that decides what is
  shown for a mode is a pure function with tests for both modes.
- Every user-visible string exists in Turkish and English. Mode-specific texts are separate keys in
  `src/i18n/en.ts` and `tr.ts`, not string surgery.
- No new dependencies. `expo-constants` is already installed.
- Data rules unchanged: no schema change, no migration, `ALL_TABLES_DELETE_ORDER` and the backup
  format stay as they are. `BACKUP_VERSION` does not change.
- Privacy promises unchanged (no network, Health Connect Weight read-only, no backup or transfer).

## Approaches considered

- **A. One codebase, a build-time switch (chosen by the owner).** Medication features stay in the
  code and are hidden behind `medication`. Pro: going back is one switch, a new versionCode and a
  new health declaration; tester data is untouched. Con: the medication code ships unreachable in
  the bundle, and about ten places need a condition and tests for both modes.
- **B. Delete the medication code now, restore it from git later.** Pro: a cleaner binary today.
  Con: the restore months later is a large revert that conflicts with everything changed in
  between. Rejected.
- **C. A separate app (new applicationId) for the general log.** Pro: the medication app keeps its
  identity for the organization account. Con: two listings, a new name check, a new 12 x 14 closed
  test, and users split across two apps that can only move data by backup file. Rejected.

## Design (decided)

### The switch

- `app.json` → `expo.extra.medication: false`. Committed, so the mode that ships is the mode in
  git, the same rule as `versionCode` (deterministic; no environment variable to forget).
- `src/platform/features.ts` reads it once through `expo-constants` and exports a typed
  `features` object; a missing or non-boolean value fails fast at startup (a thrown error in
  development, `false` is never assumed silently). Screens and hooks import from there.
- Pure decisions take the flag as a parameter so domain tests cover both modes (for example the
  welcome page list, the quick actions, the timeline kinds, the report sections, the reminder
  plan).

### Every Play track gets the narrow build (my call)

The health declaration is per app, not per track. A full build on any track (internal testing
still serves versionCode 3) would make the narrow declaration false. So versionCode 5 replaces the
release on internal testing and on closed testing. The owner can keep the full app on their own
phone with a local release APK built with `medication: true` and the debug key
(`-PtenuloDebugSignedRelease=true`), installed outside Play; that build never goes to Play.

### The switch reaches native code (my call)

`ReminderReceiver` re-arms every stored alarm on `MY_PACKAGE_REPLACED` and on boot, so an injection
alarm stored by the full build would fire as "Injection day" before the tester ever opens the
narrow build. The switch is therefore also written into the Android manifest as
`<meta-data android:name="tenulo.medication" android:value="false" />` by a config plugin
(`plugins/with-medication-switch.js`, with a test, same pattern as the other plugins).
`Reminders.kt` reads it: with medication off, re-arming drops and cancels the injection alarm, and
an injection alarm that still fires is swallowed without a notification. Kotlin's default channel
description becomes neutral ("Reminders you set in Tenulo"), since it is what Android shows before
the app sets its own texts.

### What the narrow build hides (switch off)

| Area | Today | Narrow build |
| --- | --- | --- |
| Routes `setup-medication`, `medication`, `log-injection`, `log-side-effect` | Screens | Not reachable: each redirects to Today at once; `_layout.tsx` keeps them registered. Deep links and a reminder launch with the injection reminder id land on Today. |
| Today | Injection card; side-effect quick action | Neither shown |
| History | Injection and side-effect rows and filter chips | Not shown (rows stay in the database) |
| Settings | Medication section; injection-day reminder | Not shown; weigh-in reminder stays |
| Reminders | Injection + weigh-in | Only weigh-in is ever scheduled; an existing injection alarm is cancelled on the first start after the update (the existing `applyReminders` path with injection disabled) |
| Notification channel | "Injection and weigh-in reminders…" | Mode-specific description: weigh-in only |
| Welcome | trend, plan, food, private | trend, food, private (the "plan" page is dropped) |
| In-app privacy screen | Intro names GLP-1 medication; device and reminder points name injections and side effects | Mode-specific intro and points: weight, food, water, measurements, exercise; weigh-in reminders |
| PDF report (Pro) | "Doctor report" with medication, plan, injections, side effects | "PDF report": weight trend, nutrition, water, measurements, exercise only; medication sections never rendered |
| Pro screen and banner | "A PDF report for your doctor" | Mode-specific copy naming the PDF report without "doctor" |
| Backup restore | Restores everything; the summary counts medications, plan steps, injections and side effects; a bad row is named by its record kind | Restores everything into the database. The summary counts only the kinds the narrow build shows and adds one neutral line for the rest, e.g. "12 entries from another version were kept; this version does not show them" (my call: honest about the data without naming it). Error messages for bad rows use neutral wording in the narrow build |
| Settings: inactive medications | "Their injections are in History" | Not shown |
| PDF report wording | "the patient logged…", "Recorded by the patient…", report intro "for your doctor or pharmacist" | Narrow-specific wording: "you logged…", "Recorded by you in Tenulo…", an intro without doctor or pharmacist |
| Food goals hint | "your doctor or dietitian" | Narrow-specific: "a dietitian" |

My call on the report name: "Doctor report" becomes "PDF report" in the narrow build only, so the
narrow app has no wording that reads as care for a treatment. The full build keeps "Doctor report".

### Strings

- New mode-specific keys where a text names medication: privacy intro and points, notification
  channel description, Pro feature and banner copy, report title and settings row, and anything the
  builder finds while auditing. The full build keeps today's strings.
- A test walks every string the narrow build can show (the keys listed as narrow-visible) in both
  languages and fails on any of these words, matched as whole words or word stems, case-insensitive
  (my call: wider than medication words, because a general log has no reason to talk about care):
  GLP, injection, inject, enjeksiyon, iğne, dose, doz, medication, medicine, ilaç, side effect,
  yan etki, prescription, reçete, doctor, doktor, patient, hasta, pharmacist, eczacı, treatment,
  tedavi. The list of narrow-visible keys is explicit in the test, so a new screen has to opt in.
- The narrow disclaimer uses the wording Google's health content policy asks for, instead of
  "does not recommend medications or doses": "Tenulo is a personal log for adults. It is not a
  medical device and does not diagnose, treat, cure or prevent any condition." (Turkish to match.)
  It replaces the medication sentence in the privacy footer, the Pro screen and the PDF footer.
  The word test allows exactly this sentence (it contains "treat").

### Store listing and graphics

- Name (my call, owner may change): "Tenulo: Kilo, Beslenme, Su" (tr-TR, 26 chars) and
  "Tenulo: Weight, Food & Water" (en-US, 28 chars).
- `docs/store/listing.md`: short and full descriptions rewritten in both languages for a general
  weight and food log. No GLP-1, injections, doses, side effects or "doctor". The Health Connect
  line stays in the weight section; Tenulo Pro is the PDF report. The closing becomes the narrow
  disclaimer above (adults; not a medical device; does not diagnose, treat, cure or prevent).
- A test over `listing.md` fails on the same word list and the same single allowed disclaimer
  (both languages), so the store text cannot drift back.
- Screenshots: all five re-shot in both languages from a narrow release APK (the Today screenshot
  showed the injection card). `04-injection` is replaced by the water screen with new captions;
  `scripts/store_screens.py` captions updated. The AI-generated labels in Play move with the files
  (the body figure is gone; `05-private` keeps its label).
- Feature graphics: `scripts/brand.py` `FEATURE_COPY` loses "GLP-1"; both PNGs regenerated.

### Play Console (owner approves each step before it is sent)

- Health apps declaration: untick "Medication and treatment management"; keep "Activity and
  fitness" and "Nutrition and weight management". Rewrite the `READ_WEIGHT` reason without
  "GLP-1 medication".
- Sign-in details note and the `tenulo_pro` description: "PDF report" instead of "doctor report";
  promo codes unchanged.
- Store listing: new name, texts, screenshots, feature graphics, AI labels.
- versionCode 5 replaces the release on internal testing and on closed testing, then send for
  review with a short note in the release log explaining the change.
- Data safety, content rating, target audience, ads, category: unchanged.

### Privacy policy (site repo, before resubmission)

The live policy names GLP-1 medication, injections and side effects. It stays true for what Tenulo
can store, but a reviewer reads it next to the declaration. Before resubmitting, the site agent
updates it to describe the narrow app (weight, food, water, measurements, exercise, weigh-in
reminders, Health Connect Weight read-only, PDF report, backup). It also says, without naming
medication (my call): "If you used an earlier test version of Tenulo, the entries you made there
stay on your phone and in your backup files until you delete them", which is true for the few
internal testers whose injection rows stay in the database. When the medication features come
back, the policy changes first (AGENTS.md rule). The repo gets the prompt for the site agent; the
owner runs it.

### Documentation

- ADR 0007: medication features behind a build switch for the personal account; how to turn them
  back on (organization account → switch on → health declaration → policy → new versionCode).
- AGENTS.md: the switch is part of the project rules (Play builds from the personal account keep
  `medication: false`; the word test must pass).
- docs/RELEASE.md: dated log of every console step, as before.

## Calls made in this design (owner may change)

- Every Play track gets the narrow build; the full app only as a local sideloaded build.
- The switch also reaches native code, so no injection notification fires after the update.
- Report renamed "PDF report"; "doctor", "patient", "pharmacist" and treatment words also kept out
  of the narrow build, with Google's "not a medical device…" disclaimer as the one exception.
- Restore summary: one neutral line for entries the narrow build does not show.
- Privacy policy: one neutral sentence about entries from earlier test versions.
- Store names "Tenulo: Kilo, Beslenme, Su" and "Tenulo: Weight, Food & Water".
- The water screen replaces the injection screenshot.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`, including the new mode tests, the narrow string
  test and the listing word test.
- `npx expo-doctor` and `npx expo export --platform android` (native/config change).
- On the emulator with a narrow release build over a full dev build that has injections, side
  effects and an injection reminder: Today, History, Settings, welcome, privacy, Pro and the PDF
  report show no medication content; `tenulo://log-injection` lands on Today; after installing the
  narrow build and before opening it, `adb shell dumpsys alarm` shows no injection alarm (re-arm on
  package replace dropped it) and the notification channel text is neutral; the weigh-in reminder
  still fires; Delete all data still empties every table; a backup
  made in the narrow build still contains the injection rows.
- Release AAB versionCode 5: signer, manifest (`allowBackup`, `dataExtractionRules`, optional
  portrait) as before.

## Left to the builder

- How each hidden route redirects (component guard or layout-level), as long as no medication UI
  renders for even one frame.
- Exact keys and wording of the new mode-specific strings, within the word list.
- Whether the report builder takes the flag or receives empty medication inputs.
- Order of work and how the PR is split, within the repo's commit conventions.

# Narrow Play Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One committed switch (`expo.extra.medication`, `false` for Play) hides every medication,
injection and GLP-1 trace from the app, its notifications, its PDF and its store listing, without
touching data, so Tenulo can pass review on a personal developer account.

**Architecture:** The switch is read once (JS: `src/platform/features.ts`; native: a manifest
meta-data written by a config plugin). Every "what is shown" decision is a pure function that takes
`medication: boolean` and is unit-tested for both modes. Mode-specific copy lives in separate
`narrow` keys; a word test scans every string the narrow build can show, and a second one scans
`docs/store/listing.md`.

**Tech Stack:** Expo SDK 58 / React Native 0.88, Expo Router, TypeScript strict, Vitest, Expo
config plugins (CommonJS), Kotlin (`modules/tenulo-native`), Python scripts for store graphics.

**Spec:** `docs/specs/2026-11-19-narrow-play-build.md` (approved 2026-11-19). Read it first.

## Global Constraints

- The switch: `app.json` → `expo.extra.medication`, committed, `false` on this branch. A missing or
  non-boolean value throws at startup; `false` is never assumed silently.
- No schema change, no migration, no change to `ALL_TABLES_DELETE_ORDER`, the backup format or
  `BACKUP_VERSION`. Injection, plan, medication and side-effect rows stay in the database and in
  backups in both modes.
- Every user-visible string in Turkish and English (`src/i18n/en.ts` defines the shape, `tr.ts`
  satisfies it). Numbers and dates through `f`. No new dependencies.
- Forbidden words in anything the narrow build shows and in `docs/store/listing.md` (whole word or
  word stem, case-insensitive): GLP, injection, inject, enjeksiyon, iğne, dose, doz, medication,
  medicine, ilaç, ilac, side effect, yan etki, prescription, reçete, doctor, doktor, patient, hasta,
  pharmacist, eczacı, treatment, tedavi. (`ilac` is added to catch Turkish consonant changes such
  as "ilacın".)
- The one allowed exception, exact text: EN "Tenulo is a personal log for adults. It is not a
  medical device and does not diagnose, treat, cure or prevent any condition." TR "Tenulo
  yetişkinler için kişisel bir günlüktür. Tıbbi cihaz değildir; hiçbir durumu teşhis etmez, tedavi
  etmez, iyileştirmez veya önlemez."
- Narrow names: report "PDF report" / "PDF rapor"; store "Tenulo: Kilo, Beslenme, Su" (tr-TR) and
  "Tenulo: Weight, Food & Water" (en-US). The full build keeps today's strings ("Doctor report").
- `versionCode` 5. Every Play track (internal and closed) gets this narrow build.
- Before calling any task done: `pnpm typecheck && pnpm lint && pnpm test`. Native or config tasks
  also: `npx expo-doctor` and `npx expo export --platform android`.
- Play Console steps and pushes only with the owner's explicit approval, each logged dated in
  `docs/RELEASE.md`.

## Review Focus

1. **A tester updates from versionCode 4 with an injection alarm armed and does not open the app**:
   no "Injection day" notification may appear (Android re-arms alarms on package replace). Pinned
   in Task 2 (plugin test) and Task 11 (emulator `dumpsys alarm` check).
2. **A user restores a backup made by the full build**: rows go into the database, the summary
   names no medication kind and says how many entries are kept hidden. Pinned in Task 8.
3. **A deep link or a notification tap targets a hidden screen** (`tenulo://log-injection`, launch
   with reminder id `injection`): lands on Today with no flash of the hidden screen. Pinned in
   Task 5 (`launchRoute` tests) and Task 11 (manual deep link).
4. **The Pro PDF for a user who has injection rows**: the narrow HTML contains no forbidden word.
   Pinned in Task 7.
5. **A string added later to a shared screen** silently brings a forbidden word back: the narrow
   word test treats every key as narrow-visible unless it is explicitly listed as medication-only.
   Pinned in Task 4.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/domain/features.ts` (+ test) | `Features` type and `parseFeatures(extra)`; pure |
| `src/domain/narrow-words.ts` (+ test) | Forbidden word list, allowed disclaimer, `findForbiddenWords(text)` |
| `src/platform/features.ts` | Reads `expo-constants` once, exports `features` |
| `plugins/app-config.test.ts` | Pins the committed `app.json` mode and versionCode |
| `plugins/with-medication-switch.js` (+ test) | Writes `tenulo.medication` manifest meta-data |
| `modules/tenulo-native/.../Reminders.kt` | Reads the meta-data; drops the injection alarm when off |
| `src/i18n/en.ts`, `tr.ts`, `messages/*.ts` | New `narrow` keys next to the full ones |
| `src/i18n/narrow-strings.test.ts` | Scans every narrow-visible string |
| `src/ui/MedicationOnly.tsx` | Route guard: redirect to Today when off |
| `src/data/launch-route.ts` (+ test) | Pure launch-intent → route decision |
| `src/domain/reminder.ts` (+ test) | `injectionReminderWanted(...)` |
| `src/ui/welcome-pages.ts`, `src/ui/today/actions.ts`, `src/ui/timeline.ts` (+ tests) | Mode-aware lists |
| `src/data/report.ts`, `src/ui/report-html.ts` (+ test) | Narrow report content and wording |
| `src/i18n/format.ts` (+ test) | Mode-aware restore summary and backup error |
| `src/i18n/store-listing.test.ts` | Scans `docs/store/listing.md` |
| `docs/adr/0007-medication-switch.md`, `AGENTS.md`, `docs/store/site-privacy-update.md` | Decision, rule, site-agent prompt |

---

### Task 1: The JS switch

**Files:**
- Create: `src/domain/features.ts`, `src/domain/features.test.ts`, `src/platform/features.ts`,
  `plugins/app-config.test.ts`
- Modify: `app.json` (`expo.extra.medication: false`, `android.versionCode: 5`)

**Interfaces:**
- Produces: `interface Features { readonly medication: boolean }`;
  `parseFeatures(extra: unknown): Features` (throws `Error` whose message contains
  `"expo.extra.medication"` unless `extra` is an object with a boolean `medication`);
  `export const features: Features` in `src/platform/features.ts` (calls `parseFeatures` on
  `Constants.expoConfig?.extra` at module load).

- [ ] **Step 1: Write the failing tests**
  - `features.test.ts`: `parseFeatures({ medication: false })` → `{ medication: false }`;
    `parseFeatures({ medication: true })` → `{ medication: true }`; `parseFeatures(undefined)`,
    `parseFeatures({})`, `parseFeatures({ medication: "false" })` each throw `/expo\.extra\.medication/`.
  - `app-config.test.ts` (reads `app.json` with `fs`): `expo.extra.medication === false` and
    `expo.android.versionCode === 5`.
- [ ] **Step 2: Run** `pnpm vitest run src/domain/features.test.ts plugins/app-config.test.ts` → FAIL (module missing, values absent).
- [ ] **Step 3: Implement** `parseFeatures`, `src/platform/features.ts`, and the two `app.json` values.
- [ ] **Step 4: Run** the same command → PASS; then `pnpm typecheck`.
- [ ] **Step 5: Commit** `feat: medication switch in app.json, read once at startup`

### Task 2: The switch in native code

**Files:**
- Create: `plugins/with-medication-switch.js`, `plugins/with-medication-switch.test.ts`
- Modify: `app.json` (register `./plugins/with-medication-switch` last),
  `modules/tenulo-native/android/src/main/java/expo/modules/tenulonative/Reminders.kt`

**Interfaces:**
- Consumes: `expo.extra.medication` from Task 1.
- Produces: `META_NAME = "tenulo.medication"`; `medicationMetaData(manifest, medication: boolean)`
  (pure, idempotent: exactly one `<meta-data android:name="tenulo.medication" android:value="true|false">`
  under `<application>`); the plugin throws if `config.extra?.medication` is not boolean.
  Kotlin: `ReminderScheduler.medicationEnabled(context): Boolean` (meta-data, default `true` when
  absent) and `INJECTION_ID = "injection"` (same id as JS `INJECTION_REMINDER_ID`).

- [ ] **Step 1: Write the failing plugin test** (same style as `with-optional-portrait.test.ts`):
  adds the meta-data with `"false"`; with `true` writes `"true"`; idempotent; replaces an existing
  entry; the exported plugin function throws `/expo\.extra\.medication/` for `extra: {}`.
- [ ] **Step 2: Run** `pnpm vitest run plugins/with-medication-switch.test.ts` → FAIL.
- [ ] **Step 3: Implement the plugin** with `withAndroidManifest`; register it in `app.json`.
- [ ] **Step 4: Run** the test → PASS; `npx expo config --type introspect` shows the meta-data with `false`.
- [ ] **Step 5: Kotlin.** In `rearmAll`, when `!medicationEnabled(context)`, call `cancel(context, INJECTION_ID)` and skip that entry. In `fire`, when `id == INJECTION_ID && !medicationEnabled(context)`, cancel and return without `post`. Change `DEFAULT_CHANNEL_DESCRIPTION` to `"Reminders you set in Tenulo"`. (No Kotlin unit test harness exists; Task 11 verifies on the emulator.)
- [ ] **Step 6: Run** `pnpm typecheck && pnpm lint && pnpm test`, `npx expo-doctor`, `npx expo export --platform android` → all pass.
- [ ] **Step 7: Commit** `feat(android): the medication switch reaches the reminder receiver`

### Task 3: Forbidden-word matcher

**Files:**
- Create: `src/domain/narrow-words.ts`, `src/domain/narrow-words.test.ts`

**Interfaces:**
- Produces: `NARROW_FORBIDDEN: readonly string[]` (the Global Constraints list, verbatim);
  `NARROW_DISCLAIMER: { readonly en: string; readonly tr: string }` (exact texts above);
  `findForbiddenWords(text: string): string[]` — the forbidden entries found, after removing every
  occurrence of either disclaimer. Matching: lower-case the text both with
  `toLocaleLowerCase("en")` and `toLocaleLowerCase("tr")`; an entry matches when it starts at a
  word boundary (`(?<![\p{L}\p{N}])`, `u` flag); multi-word entries match as phrases.

- [ ] **Step 1: Write the failing tests:** `findForbiddenWords("Log each injection")` → `["injection","inject"]`;
  `"İĞNE"` → `["iğne"]`; `"INJECTION"` → contains `"injection"`; `"ilacın"` → `["ilac"]`;
  `"GLP-1"` → `["GLP"]`; `"Yan etkiler"` → `["yan etki"]`; `"dosage"` → `[]` (it does not start
  with `dose`); `"adozen"` → `[]` (no word boundary); each `NARROW_DISCLAIMER` text alone → `[]`;
  the EN disclaimer followed by `" Talk to your doctor."` → `["doctor"]`.
- [ ] **Step 2: Run** `pnpm vitest run src/domain/narrow-words.test.ts` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: forbidden-word matcher for the narrow build`

### Task 4: Narrow copy and the narrow strings test

**Files:**
- Create: `src/i18n/narrow-strings.test.ts`, `src/i18n/leaves.ts` (the `leaves` walker and
  `SAMPLE_ARGS` moved out of `messages.test.ts`, which then imports them), `src/i18n/narrow-keys.ts`
- Modify: `src/i18n/en.ts`, `src/i18n/tr.ts`, `src/i18n/messages/food.ts`,
  `src/i18n/messages/progress.ts`, `src/i18n/messages.test.ts`

**Interfaces:**
- Consumes: `findForbiddenWords`, `NARROW_DISCLAIMER` (Task 3).
- Produces (names fixed for later tasks; wording within the constraints): a `narrow` object next
  to each full text that names medication, at least: `privacy.narrow.{intro, deviceBody,
  remindersBody, footer}`, `reminders.narrow.channelDescription` (EN "Weigh-in reminders you set in
  Tenulo", TR "Tenulo'da kurduğun tartım hatırlatıcıları"), `screens.narrow.report` and
  `settings.data.narrow.report` ("PDF report" / "PDF rapor"), `report.narrow.{proOnly, intro}`,
  `reportPdf.narrow.*` (every PDF sentence that says "the patient" becomes "you"; footer starts
  "Recorded by you in Tenulo…" and uses `NARROW_DISCLAIMER`), `pro.narrow.features.report`,
  `settings.proBanner.narrow.pitch`, `settings.narrow.disclaimer` (= `NARROW_DISCLAIMER`), the food
  goals hint narrow variant ("…for example the ones a dietitian gave you…"), and
  `restore.keptHidden: (n: number) => string` (EN n=1 "1 entry from another version was kept; this
  version does not show it.", n>1 "{n} entries from another version were kept; this version does
  not show them."; TR "Başka bir sürümden {n} kayıt saklandı; bu sürüm onları göstermiyor."),
  `backup.problemAtHidden: (row: number | undefined) => string`.
- Produces: `MEDICATION_ONLY_KEYS: readonly string[]` in `src/i18n/narrow-keys.ts` (used by
  tests only) — key prefixes shown only with `medication: true` (e.g. `injections.`, `medication.`, `sideEffects.`,
  `welcome.pages.plan`, the full-mode keys that now have a `narrow` twin). Every other key counts
  as narrow-visible.

- [ ] **Step 1: Write the failing test:** for `en` and `tr`, every leaf whose path does not start
  with a `MEDICATION_ONLY_KEYS` prefix has `findForbiddenWords(text)` equal to `[]`; the failure
  message lists `path: text → words`. Start with `MEDICATION_ONLY_KEYS = []`.
- [ ] **Step 2: Run** `pnpm vitest run src/i18n/narrow-strings.test.ts` → FAIL; the output is the
  audit list.
- [ ] **Step 3: For each listed key, decide:** shown only by a screen/component Tasks 5–8 hide
  → add its prefix to `MEDICATION_ONLY_KEYS` with a one-line comment naming the hiding task; shown
  in the narrow build → add a `narrow` twin (both languages) and list the full key as
  medication-only. Do not reword full-mode strings.
- [ ] **Step 4: Run** the test, `messages.test.ts` and `pnpm typecheck` → PASS.
- [ ] **Step 5: Commit** `feat(i18n): narrow-build copy without medication words`

### Task 5: Hidden routes, launch, reminders, notification texts

**Files:**
- Create: `src/ui/MedicationOnly.tsx`, `src/data/launch-route.ts`, `src/data/launch-route.test.ts`
- Modify: `src/app/setup-medication.tsx`, `src/app/medication.tsx`, `src/app/log-injection.tsx`,
  `src/app/log-side-effect.tsx`, `src/data/use-app-sync.ts`, `src/domain/reminder.ts`,
  `src/domain/reminder.test.ts`

**Interfaces:**
- Consumes: `features` (Task 1), `t.reminders.narrow.channelDescription` (Task 4).
- Produces: `MedicationOnly({ children }): JSX.Element` — returns `<Redirect href="/" />` when
  `!features.medication`, else `children`; each of the four screens wraps its whole body in it, so
  none of its hooks or UI runs in the narrow build.
  `launchRoute(info: { action: string | null; reminder: string | null }, medication: boolean):
  "/privacy" | "/log-injection" | "/add-weight" | undefined`.
  `injectionReminderWanted(o: { medication: boolean; enabled: boolean; hasMedication: boolean }): boolean`.

- [ ] **Step 1: Write the failing tests:** `launchRoute` — Health Connect rationale action →
  `"/privacy"` in both modes; reminder `"injection"` → `"/log-injection"` when `true`, `undefined`
  when `false`; reminder `"weigh-in"` → `"/add-weight"` in both. `injectionReminderWanted` — `true`
  only when all three are `true`.
- [ ] **Step 2: Run** `pnpm vitest run src/data/launch-route.test.ts src/domain/reminder.test.ts` → FAIL.
- [ ] **Step 3: Implement** both functions; `use-app-sync.ts` uses `launchRoute` instead of its
  local `route`, passes `injectionEnabled: injectionReminderWanted(...)` to `applyReminders` (an
  armed injection alarm is then cancelled on the first start), and passes the narrow channel
  description when `!features.medication`. Wrap the four screens in `MedicationOnly`.
- [ ] **Step 4: Run** the tests → PASS; full check.
- [ ] **Step 5: Commit** `feat: hide medication routes, launches and reminders in the narrow build`

### Task 6: Today, History, Settings, Welcome, Privacy, Pro

**Files:**
- Create: `src/ui/welcome-pages.ts`, `src/ui/today/actions.ts` (+ tests)
- Modify: `src/ui/timeline.ts` (+ test), `src/app/welcome.tsx`, `src/ui/today/QuickActions.tsx`,
  `src/app/(tabs)/index.tsx`, `src/app/(tabs)/history.tsx`, `src/app/(tabs)/settings.tsx`,
  `src/app/privacy.tsx`, `src/app/pro.tsx`, `src/app/goals.tsx` (the food goals hint)

**Interfaces:**
- Consumes: `features`, Task 4 `narrow` keys.
- Produces: `welcomePages(medication: boolean): readonly WelcomePage[]` (`true` → `["trend","plan","food","private"]`,
  `false` → `["trend","food","private"]`); `quickActions(medication: boolean)` (the current six,
  minus `sideEffect` when `false`); `timelineFilters(medication: boolean): readonly TimelineFilter[]`
  (minus `"injection"` and `"side-effect"` when `false`).

- [ ] **Step 1: Write the failing tests** for the three functions, both modes, exact arrays above.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** and wire: welcome uses `welcomePages`; Quick Actions uses
  `quickActions` (check the grid still lays out with five tiles); Today renders `InjectionCard`
  only when `features.medication`; History uses `timelineFilters` and leaves injection and
  side-effect rows out of the list when `false` (hooks still called unconditionally); Settings
  hides the medication section, the injection reminder row and the inactive-medications line, and
  uses the narrow report row, banner and disclaimer; privacy and Pro screens use the narrow texts.
- [ ] **Step 4: Run** tests and full check → PASS.
- [ ] **Step 5: Commit** `feat: shared screens without medication content in the narrow build`

### Task 7: Narrow PDF report

**Files:**
- Modify: `src/data/report.ts`, `src/ui/report-html.ts`, `src/app/report.tsx`
- Test: `src/ui/report-html.test.ts` (create or extend)

**Interfaces:**
- Consumes: `features`, `findForbiddenWords`, Task 4 `report.narrow` / `reportPdf.narrow` keys.
- Produces: `loadReport(period, to, medication: boolean)` — with `false`, `medicationName` is
  `undefined` and `planSteps`, `injections`, `sideEffects` are empty; `reportHtml(report, unit,
  created, i18n, medication: boolean)` — with `false`, renders no medication, plan, injection or
  side-effect section and uses the narrow wording and title.

- [ ] **Step 1: Write the failing test:** build a `Report` that still contains injections, plan
  steps and side effects (as a restored backup could); `reportHtml(..., false)` with tags stripped
  gives `findForbiddenWords(...) == []` in `en` and `tr`; `reportHtml(..., true)` still contains the
  injections section heading.
- [ ] **Step 2: Run** `pnpm vitest run src/ui/report-html.test.ts` → FAIL.
- [ ] **Step 3: Implement**; the report screen passes `features.medication` and uses the narrow
  title and intro.
- [ ] **Step 4: Run** → PASS; full check.
- [ ] **Step 5: Commit** `feat: PDF report without medication sections in the narrow build`

### Task 8: Restore summary and backup errors

**Files:**
- Modify: `src/i18n/format.ts`, `src/i18n/format.test.ts`, the Settings restore call sites

**Interfaces:**
- Consumes: `t.restore.keptHidden`, `t.backup.problemAtHidden` (Task 4).
- Produces: `f.restoreSummary(counts: RestoreCounts, medication: boolean): string` — with `false`,
  `injections`, `sideEffects`, `planSteps`, `medications` are left out of the list and their sum,
  when above zero, is appended as `t.restore.keptHidden(sum)`; `f.backupProblem(result, medication:
  boolean)` — with `false`, a problem in one of those four tables uses `problemAtHidden`.

- [ ] **Step 1: Write the failing tests:** `restoreSummary({ weights: 2, injections: 3, sideEffects: 1 }, false)`
  contains the weights count and `keptHidden(4)` text and no forbidden word; the same counts with
  `true` match today's output; `restoreSummary({ injections: 3 }, false)` is only the kept-hidden
  sentence; `backupProblem` for a bad injection row with `false` has no forbidden word.
- [ ] **Step 2: Run** `pnpm vitest run src/i18n/format.test.ts` → FAIL.
- [ ] **Step 3: Implement**; Settings passes `features.medication`. Inside `format.ts`,
  `healthSync` calls `restoreSummary({ weights }, true)` (weights only, mode does not matter).
- [ ] **Step 4: Run** → PASS; full check.
- [ ] **Step 5: Commit** `feat: restore summary keeps medication entries without naming them`

### Task 9: Decision, rule, site prompt

**Files:**
- Create: `docs/adr/0007-medication-switch.md`, `docs/store/site-privacy-update.md`
- Modify: `AGENTS.md`

- [ ] **Step 1:** ADR 0007: context (rejection, personal account), decision (switch, narrow build
  on every track), how to turn it back on (organization account → `medication: true` → health
  declaration with "Medication and treatment management" → privacy policy first → new versionCode),
  consequences (unreachable code in the bundle, both-mode tests).
- [ ] **Step 2:** AGENTS.md "Tenulo — project rules": Play builds from the personal account keep
  `expo.extra.medication: false`; the narrow word tests must pass; turning it on follows ADR 0007.
- [ ] **Step 3:** `site-privacy-update.md`: the prompt for the site agent — rewrite
  `/tenulo/privacy/` (EN and TR) for weight, food, water, measurements, exercise, weigh-in
  reminders, Health Connect Weight read-only, PDF report, backup; no forbidden word; add the spec's
  sentence about entries from earlier test versions; bump the effective date.
- [ ] **Step 4:** `pnpm lint` (markdown untouched by lint; just confirm nothing else broke).
- [ ] **Step 5: Commit** `docs: ADR 0007, project rule and site prompt for the narrow build`

### Task 10: Store text and graphics

**Files:**
- Create: `src/i18n/store-listing.test.ts`
- Modify: `docs/store/listing.md`, `scripts/brand.py` (`FEATURE_COPY`), `scripts/store_screens.py`
  (`SCREENS`), `docs/store/feature-graphic.png`, `docs/store/feature-graphic-tr.png`

- [ ] **Step 1: Write the failing test:** read `docs/store/listing.md`; the tr-TR and en-US
  sections (name, short, full) give `findForbiddenWords == []`; the names equal "Tenulo: Kilo,
  Beslenme, Su" and "Tenulo: Weight, Food & Water"; the screenshot table names `04-water.png`.
- [ ] **Step 2: Run** `pnpm vitest run src/i18n/store-listing.test.ts` → FAIL.
- [ ] **Step 3:** Rewrite `listing.md` for a general weight and food log (both languages; short
  ≤ 80 chars; full ≤ 4000; Health Connect in the weight section; Tenulo Pro = PDF report; closing
  = `NARROW_DISCLAIMER`). `FEATURE_COPY` third line without "GLP-1" (EN "Weight, food, water and
  exercise.", TR "Kilo, beslenme, su ve egzersiz."). In `SCREENS`, replace the injection entry
  with `("water.png", "04-water.png", …)`: TR "Su, tek\ndokunuşta" / "Bir dokunuş bir bardak;
  hedefin senin.", EN "Water,\none tap away" / "One tap, one glass; the goal is yours."
- [ ] **Step 4: Run** the test → PASS; `python scripts/brand.py <Roboto.ttf>` regenerates both
  feature graphics (open them and check the line).
- [ ] **Step 5: Commit** `docs(store): listing and graphics for the narrow build`

### Task 11: Build and verify on the emulator

**Files:** none new; screenshots under `docs/store/screenshots/{tr,en}/`.

- [ ] **Step 1:** Full checks: `pnpm typecheck && pnpm lint && pnpm test`, `npx expo-doctor`,
  `npx expo export --platform android`.
- [ ] **Step 2: Data with medication on.** Temporarily set `medication: true`, build the dev
  client, load sample data, set an injection reminder for tomorrow. Restore `false` (do not commit
  `true`).
- [ ] **Step 3: Narrow release over it.** `npx expo prebuild --platform android --no-install`, then
  `cd android && ./gradlew app:assembleRelease -PtenuloDebugSignedRelease=true`, `adb install -r`.
  Before opening the app: `adb shell dumpsys alarm | grep -i tenulo` shows no injection alarm, and
  `adb shell dumpsys notification` shows the neutral channel description.
- [ ] **Step 4: Walk the app** in TR and EN: Today, History (no injection/side-effect rows or
  chips), Settings, welcome (after Delete all data: three pages), privacy, Pro, PDF report; open
  `tenulo://log-injection` (`adb shell am start -d tenulo://log-injection`) → Today; weigh-in
  reminder still fires; make a backup, Delete all data, restore → summary shows the kept-hidden
  line; the restored database still has injection rows (`adb exec-out run-as ... cat
  files/SQLite/tenulo.db`).
- [ ] **Step 5: Store screenshots** both languages per `docs/release-checklist.md` (capture
  `water` instead of `log-injection`), `python scripts/store_screens.py <Roboto.ttf>`.
- [ ] **Step 6: AAB** `./gradlew app:bundleRelease` (upload key), check signer SHA-256
  `EB:11:C5:53:…:0F:71:67:0A`, manifest `versionCode="5"`, `allowBackup="false"`,
  `dataExtractionRules`, optional portrait, `tenulo.medication` = `false`.
- [ ] **Step 7: Commit** `docs(store): narrow-build screenshots` and log the build in `docs/RELEASE.md`.

### Task 12: Play Console and PR (owner approves every step)

- [ ] **Step 1:** Owner runs the site prompt; check the live policy has no forbidden word
  (fetch and run `findForbiddenWords` over the page text).
- [ ] **Step 2:** Health apps: untick "Medication and treatment management"; new `READ_WEIGHT`
  reason without "GLP-1 medication". Sign-in note and `tenulo_pro` description: "PDF report".
- [ ] **Step 3:** Store listing tr-TR and en-US: names, texts, feature graphics, screenshots, AI
  labels (feature graphics and `05-private`; the new `04-water` has no AI art).
- [ ] **Step 4:** versionCode 5 on internal testing and on closed testing (owner uploads the AAB);
  send for review only after the owner's yes.
- [ ] **Step 5:** Each step dated in `docs/RELEASE.md`; push and PR only after the owner's yes.

---

## Self-review notes

- Spec coverage: switch (T1, T2), hidden UI per table row (T5–T8), strings and word test (T3, T4),
  disclaimer (T3/T4/T6/T7/T10), store (T10, T11), Play Console (T12), policy (T9, T12), ADR and
  AGENTS.md (T9), verification (T11). The spec's "list of narrow-visible keys is explicit" is met
  in its stricter form: every key is checked unless it is explicitly medication-only.
- `restoreSummary` and `backupProblem` change signature; every call site is in Settings (Task 8).

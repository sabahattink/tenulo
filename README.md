# Tenulo

Private GLP-1 and daily log for Android: shots, weight, food, water, measurements and exercise in
one place, in Turkish and English. Local-first: no account, no analytics, no data collected.

- Publisher: Kalkan Software
- Play package: `com.kalkansoftware.tenulo`
- Privacy policy: https://kalkansoftware.com/tenulo/privacy/ · support: support@kalkansoftware.com
- Project rules (privacy invariants, medical boundaries, data rules): [AGENTS.md](AGENTS.md)
- Decisions: [docs/adr](docs/adr) · Release steps: [docs/release-checklist.md](docs/release-checklist.md)

## What it does

- **Languages**: Turkish and English everywhere (screens, PDF report, reminders); follows the
  phone unless the user picks one in Settings.
- **Welcome**: illustrated pages on first launch (and after "Delete all data"), then the kg/lb
  choice, suggested from the phone's region.
- **Today**: the day at a glance: energy, protein and water against the user's own goals, quick
  actions for every log, the weight trend, the injection card, today's exercise.
- **Food**: a diary by meal; search a bundled list of 274 foods (USDA SR Legacy + Turkish recipes,
  [ADR 0005](docs/adr/0005-bundled-food-list.md)) in Turkish or English, pick portion and amount;
  recent foods in one tap; the user's own foods; quick add.
- **Water, measurements, exercise**: a glass per tap; waist, hip, chest, neck, arm and thigh with
  their change; exercise by kind, duration and intensity, with a marked estimate when no kcal is
  entered.
- **Weight**: daily weigh-ins smoothed into a trend (time-aware EMA), weekly change, goal progress,
  a goal date only when the data supports one; chart with 30D / 90D / 1Y / All (Progress tab).
- **Injections**: the user's own dose plan shown back (step, period, next step), due date and a
  day-of-cycle ring, body-map site picker with a least-recently-used hint, side effects.
- **Progress and History**: trends, measurements and weekly averages; one timeline of every
  record, filterable.
- **Reminders**: injection day (from the user's schedule) and daily weigh-in; local alarms only.
- **Your data**: backup to a file and merge-restore, delete everything.
- **Tenulo Pro** (one-time, Play Billing): doctor report as PDF (now with nutrition, water,
  measurement and exercise summaries), Health Connect weight import (read-only).

## Stack

Expo SDK 58 (development build, Expo Router) · TypeScript strict + `noUncheckedIndexedAccess` ·
expo-sqlite + Drizzle ORM · Zod · Vitest · pnpm · one local Kotlin Expo module

## Commands

```bash
pnpm install
pnpm typecheck      # tsc --noEmit
pnpm lint           # expo lint (eslint-config-expo)
pnpm test           # domain, UI logic and migration tests
pnpm db:generate    # after editing src/db/schema.ts
pnpm android        # expo run:android (needs JDK 17+ and the Android SDK; see below on Windows)
python scripts/brand.py path/to/Roboto.ttf   # regenerate icons, splash and store graphics
python scripts/store_screens.py path/to/Roboto.ttf   # frame raw captures into store screenshots
python scripts/foods/build_foods.py          # regenerate the food list after editing foods.json (--check in CI)
```

## Local Android build on Windows

`pnpm android` compiles native C++ (React Native's new architecture), which needs more than the
Android SDK. Checked with JDK 25, Gradle 9.4.1 and an Android 17 emulator:

- **`ANDROID_HOME`** pointing at the SDK, usually `%LOCALAPPDATA%\Android\Sdk`. Gradle stops with
  "SDK location not found" without it.
- **CMake 4.1.2 and Ninja.** `app.json` pins the version (`expo-build-properties` →
  `android.cmakeVersion`); Gradle accepts only that exact version, from the SDK's `cmake` folder or
  from `PATH`. Without an SDK package, Kitware's `cmake-4.1.2-windows-x86_64.zip` (check it against
  the release's `cmake-4.1.2-SHA-256.txt`) with `ninja.exe` from a Ninja release copied into its
  `bin` folder works; put that `bin` folder on `PATH` for the build.
- **Windows long paths.** Some generated object paths are longer than 260 characters (one in
  react-native-gesture-handler's codegen is 335), and Ninja then fails with "Filename longer than
  260 characters". Turn long paths on once, in an administrator PowerShell, then stop the Gradle
  daemon (`android\gradlew --stop`) so the next build sees it:

  ```powershell
  New-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name LongPathsEnabled -Value 1 -PropertyType DWORD -Force
  ```

  A shorter checkout path does not help: the project path appears twice in those paths.
- **Hoisted `node_modules`.** `pnpm-workspace.yaml` sets `nodeLinker: hoisted`, because native
  builds break when packages are reached through pnpm's junctions. Keep it.

Development-build notes:

- On Android 13 and later the dev client asks for "Nearby devices" to reach Metro on the local
  network. Release builds do not include that permission.
- `CI=1 npx expo run:android` builds and installs, but Metro then does not watch files. For live
  reload, run `npx expo start --dev-client` and open the installed dev build.
- The dev build is debuggable, so `adb exec-out run-as com.kalkansoftware.tenulo cat
  files/SQLite/tenulo.db` reads its database, for example to check "Delete all data".

## Layout

```
src/domain/    pure TS: dates, weight, trend, forecast, injection schedule, backup format,
               report model, reminder timing, Health Connect mapping (all unit-tested)
src/db/        Drizzle schema, client, migration tests on real SQLite (node:sqlite)
src/data/      queries and writes, backup/restore, PDF report, Health Connect sync, app sync hook
src/platform/  adapters over native code: reminders, billing (Pro), Health Connect
src/domain/foods/   the bundled food list (generated by scripts/foods), Turkish-aware search
src/i18n/      Turkish and English dictionaries, formatters, language provider
src/ui/        theme tokens, kit, icons, chart and body-map geometry, publisher constants (tested where pure)
src/app/       Expo Router screens: (tabs)/ Today, Food, Progress, History, Settings; modals and detail screens
modules/tenulo-native/   Kotlin Expo module: local reminders, Play Billing, launch intents
drizzle/       generated SQL migrations (bundled into the app)
assets/illustrations/   paper-cut illustrations (made in Canva), 960 px WebP
scripts/       brand asset and store screenshot generators; foods/: food list spec, USDA extract, generator
docs/          ADRs, release checklist, store listing and graphics
```

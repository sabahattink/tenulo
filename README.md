# Tenulo

Private GLP-1 and weight log for Android. Local-first: no account, no analytics, no data collected.

- Publisher: Kalkan Software
- Play package: `com.kalkansoftware.tenulo`
- Privacy policy: https://sabahattinkalkan.com/tenulo/privacy/
- Project rules (privacy invariants, medical boundaries, data rules): [AGENTS.md](AGENTS.md)
- Decisions: [docs/adr](docs/adr) · Release steps: [docs/release-checklist.md](docs/release-checklist.md)

## What it does

- **Welcome**: three illustrated pages on first launch (and after "Delete all data"), then the
  kg/lb choice, suggested from the phone's region.
- **Weight**: daily weigh-ins smoothed into a trend (time-aware EMA), weekly change, goal progress,
  a goal date only when the data supports one; chart with 30D / 90D / 1Y / All.
- **Injections**: the user's own dose plan shown back (step, period, next step), due date and a
  day-of-cycle ring, body-map site picker with a least-recently-used hint, side effects.
- **History**: one timeline of weigh-ins, injections and side effects, filterable.
- **Reminders**: injection day (from the user's schedule) and daily weigh-in; local alarms only.
- **Your data**: backup to a file and merge-restore, delete everything.
- **Tenulo Pro** (one-time, Play Billing): doctor report as PDF, Health Connect weight import
  (read-only).

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
src/ui/        theme tokens, kit, icons, chart and body-map geometry, copy (tested where pure)
src/app/       Expo Router screens: (tabs)/ Today, History, Settings; modals and detail screens
modules/tenulo-native/   Kotlin Expo module: local reminders, Play Billing, launch intents
drizzle/       generated SQL migrations (bundled into the app)
assets/illustrations/   paper-cut illustrations (made in Canva), 960 px WebP
scripts/       brand asset and store screenshot generators
docs/          ADRs, release checklist, store listing and graphics
```

# Tenulo

Private GLP-1 and weight log for Android. Local-first: no account, no analytics, no data collected.

- Play package: `com.sabahattinkalkan.tenulo`
- Privacy policy: https://sabahattinkalkan.com/tenulo/privacy/
- Project rules (privacy invariants, medical boundaries, data rules): [AGENTS.md](AGENTS.md)
- Decisions: [docs/adr](docs/adr) · Release steps: [docs/release-checklist.md](docs/release-checklist.md)

## What it does

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
pnpm android        # expo run:android (needs JDK 17 + Android SDK)
python scripts/brand.py path/to/Roboto.ttf   # regenerate icons, splash and store graphics
```

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
scripts/       brand asset generator
docs/          ADRs, release checklist, store listing and graphics
```

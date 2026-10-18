# Tenulo

Private GLP-1 and weight log for Android. Local-first: no account, no analytics, no data collected.

- Play package: `com.sabahattinkalkan.tenulo`
- Privacy policy: https://sabahattinkalkan.com/tenulo/privacy/
- Project rules (privacy invariants, medical boundaries, data rules): [AGENTS.md](AGENTS.md)

## Stack

Expo SDK 58 (development build, Expo Router) · TypeScript strict + `noUncheckedIndexedAccess` · expo-sqlite + Drizzle ORM · Zod · Vitest · pnpm

## Commands

```bash
pnpm install
pnpm typecheck      # tsc --noEmit
pnpm test           # domain + migration tests
pnpm db:generate    # after editing src/db/schema.ts
pnpm android        # expo run:android (needs JDK 17 + Android SDK)
```

## Layout

```
src/domain/   pure TS: dates, weight units, trend, forecast, injection schedule (fully tested)
src/db/       Drizzle schema, client, migration tests on real SQLite
src/app/      Expo Router screens
drizzle/      generated SQL migrations (bundled into the app)
```

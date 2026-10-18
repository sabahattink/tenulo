This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Tenulo — project rules

Tenulo is a local-first GLP-1 and weight log for Android (`com.sabahattinkalkan.tenulo`). These rules are promises made in the Play Store data-safety form and in the public privacy policy at https://sabahattinkalkan.com/tenulo/privacy/. Breaking one makes those statements false, so treat them as hard constraints.

### Privacy invariants

- No network calls from app code. No analytics, crash reporting, ads, remote config or Firebase. Google Play Billing is the only component that talks to a server.
- No RevenueCat or any other purchase backend: use Play Billing directly.
- `android.allowBackup` stays `false`. `com.google.android.gms.permission.AD_ID` stays in `android.blockedPermissions`.
- Health Connect: read `Weight` only. Never write. Adding any other record type requires updating the privacy policy first.
- Data leaves the device only when the user exports it themselves (PDF report, backup file).
- "Delete all data" in Settings must remove every row in every table.

### Medical boundaries

- Tenulo logs what the user enters. It never recommends a medication, dose, dose change or injection site.
- The dose schedule is the user's own plan, shown back to them (`planPosition`), never generated.
- No drug brand names in code, presets, strings or store assets. Medication name is free text.

### Data rules

- Weight is integer grams, dose integer micrograms. No floats in the database.
- Dates are local `YYYY-MM-DD` (`LocalDate`); instants are UTC epoch ms. Day arithmetic goes through `src/domain/date.ts`.
- Schema changes: edit `src/db/schema.ts`, run `pnpm db:generate`, commit the generated migration. Never edit a generated migration after it has shipped.

### Code layout

- `src/domain/` is pure TypeScript with no React Native imports, and every function there has unit tests.
- `src/db/` holds the Drizzle schema, client and migration tests (run against real SQLite via `node:sqlite`).
- `src/app/` holds Expo Router screens only.

### Before calling a task done

`pnpm typecheck && pnpm test` must pass. For native or config changes also run `npx expo-doctor` and `npx expo export --platform android` to prove the bundle builds.

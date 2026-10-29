# ADR 0003: Health Connect, Weight only, read-only

- Status: accepted
- Date: 2026-10-29

## Decision

- Library: `react-native-health-connect@4.1.3` (wraps `androidx.health.connect:connect-client`,
  no telemetry; its own config plugin adds the permissions-rationale intent filter and the
  Android 14 `ViewPermissionUsageActivity` alias).
- Permission: `android.permission.health.READ_WEIGHT` only. `WRITE_WEIGHT` is listed in
  `blockedPermissions` so the manifest can never ask for it.
- Sync (`src/data/health-sync.ts`): reads Weight records in a window (first sync: 365 days;
  later: from 3 days before the last sync, for scales that upload late), maps them in
  `src/domain/health-connect.ts` (integer grams, local date, plausibility), and inserts only ids
  not already stored. `weight_entry.health_connect_id` is UNIQUE and tied to
  `source = 'health_connect'` by a CHECK.
- Runs on start and on every return to the foreground while enabled and Pro.
- The rationale screen Health Connect opens is the in-app Privacy screen (`/privacy`), routed by
  `LaunchModule`.

## Consequences

- Health Connect only returns data from 30 days before the first grant unless the app also holds
  `READ_HEALTH_DATA_HISTORY`. Tenulo does not ask for it (one permission, one record type).
- Records edited or deleted in Health Connect after import are not changed in Tenulo; the user
  can delete an imported reading from History. A changes-token sync can come later.
- `minSdkVersion` is 26 (Health Connect requirement).
- Adding any other record type, or any write, requires the privacy policy to change first.

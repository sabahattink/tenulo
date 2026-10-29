# ADR 0004: Backup file format and restore semantics

- Status: accepted
- Date: 2026-10-29

## Decision

- One JSON document: `{ format: "tenulo-backup", version: 1, exportedAt, appVersion, data }`,
  `data` holding every row of every table plus the user-facing settings.
- Created in the app cache and handed to the Android share sheet; the user picks the destination.
- `parseBackup` (`src/domain/backup.ts`, Zod) validates the whole file before anything is written:
  the same ranges as the database CHECKs, calendar-valid dates, ULID ids, unique ids per table,
  and references that resolve inside the backup. Newer versions are refused with a clear message.
- Restore merges in one transaction, parents before children, `ON CONFLICT DO NOTHING`, in chunks
  of 200 rows (SQLite bound-variable limit). Nothing already on the phone is changed or removed.
  If the phone already has an active medication, the backup's other medications are added as
  inactive (the app tracks one current medication); their injections still appear in History.
- All multi-statement writes live in `src/db/ops.ts` and use Drizzle's synchronous API inside a
  synchronous `transaction()`. The expo-sqlite driver commits when the callback returns, so an
  `async` callback would commit at its first `await` and never roll back. `ops.test.ts` runs the
  real driver on `node:sqlite`, including forced mid-way failures, and pins this driver behavior.
  Unit and goal are taken from the backup only on a phone with no records yet. Reminders and
  Health Connect are not restored: both need fresh permission on the new phone.

## Consequences

- Restoring the same file twice is harmless.
- A backup is plain JSON: readable by the user, and as private as the place they store it.

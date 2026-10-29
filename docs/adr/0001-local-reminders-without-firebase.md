# ADR 0001: Local reminders without expo-notifications

- Status: accepted
- Date: 2026-10-29

## Context

The privacy policy promises that injection and weigh-in reminders are "scheduled locally by
Android" and that "no reminder content goes through a server". AGENTS.md forbids Firebase.

`expo-notifications@58.0.11` declares `implementation 'com.google.firebase:firebase-messaging:25.0.1'`
in its `android/build.gradle`. Even unused, that ships Firebase Cloud Messaging (and its
installations and data-transport components) in the APK, which contradicts both the rule and the
data-safety answers. Excluding the dependency through Gradle breaks the library's own classes
(`ExpoFirebaseMessagingService`, push-token module) and needs R8 suppressions.

## Decision

Tenulo has its own small Expo module, `modules/tenulo-native` (`RemindersModule`):

- `AlarmManager.setAndAllowWhileIdle` (inexact, Doze-safe, needs no `SCHEDULE_EXACT_ALARM`);
- a `BroadcastReceiver` that posts a `NotificationCompat` notification and re-arms daily ones;
- reminders persisted in `SharedPreferences` and re-armed on `BOOT_COMPLETED`,
  `MY_PACKAGE_REPLACED`, `TIMEZONE_CHANGED` and `TIME_SET`;
- lock-screen visibility `PRIVATE` with a public version that says only "Tenulo reminder".

When to fire is pure TypeScript (`src/domain/reminder.ts`, tested). `src/platform/reminders.ts`
reconciles the alarms with settings and the injection log on every change (`useAppSync`).

## Consequences

- Permissions added: `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`. No Firebase in the APK.
- A reminder may arrive a few minutes late in Doze; acceptable for this use.
- One-shot alarms computed in the old time zone are recomputed the next time the app opens;
  daily alarms are re-armed in the new zone immediately.
- "Delete all data" also cancels every alarm and clears the stored reminders.

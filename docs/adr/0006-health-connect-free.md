# ADR 0006: Health Connect is free; Pro is the doctor report

- Status: accepted
- Date: 2026-11-18
- Changes: ADR 0002 (what Pro unlocks) and ADR 0003 (when the sync runs)

## Context

Play Console's App content asks whether parts of the app are restricted. One-time products count
as restricted, and reviewers cannot buy, use free trials or create accounts. Health Connect sync
was a Pro feature, so the reviewer of the `READ_WEIGHT` declaration could not turn it on and see
how the permission is used. Tenulo has no way to unlock Pro without a purchase in a release build,
and adding one (a demo code, a reviewer flag) would be a second, weaker path around Play Billing.

## Decision

- Health Connect weight import is free. The Settings switch, the foreground sync
  (`src/data/use-app-sync.ts`) and "Sync now" depend only on the user turning it on.
- Tenulo Pro unlocks the doctor PDF report only. The Pro screen and the Settings banner say so.
- The store listing names Health Connect in the weight section, not under Tenulo Pro.
- App access in Play Console: "Yes, restricted". The note tells the reviewer that there is no
  account and that only the PDF report needs the one-time purchase.

## Consequences

- A reviewer can see `READ_WEIGHT` in use without a purchase.
- Anyone who had turned Health Connect on without Pro (the switch showed off) now syncs on the next
  start. The read still needs the Health Connect permission; without it the sync does nothing.
- Pro has one feature. The privacy policy only says Pro is sold through Google Play, so it does
  not change.

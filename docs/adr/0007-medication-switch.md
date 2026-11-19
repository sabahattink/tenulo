# ADR 0007: Medication features behind a build switch for the personal Play account

- Status: accepted
- Date: 2026-11-19
- Changes: ADR 0006 (in the narrow build the Pro feature reads "PDF report", not "doctor report")

## Context

Google Play rejected Tenulo's first review on 2026-11-18 under the Play Console Requirements
policy: health apps may only be published from an organization developer account. Tenulo's account
(Kalkan Software) is a personal one, and Kalkan Software is not a registered company yet, so an
organization account is not available now. The trigger was the health apps declaration "Medication
and treatment management", which the injection log, the dose plan shown back and the
injection-day reminder fit. Declaring anything else while those features are in the app would be a
false declaration. The design is in `docs/specs/2026-11-19-narrow-play-build.md`.

## Decision

- `app.json` → `expo.extra.medication` is the one switch. It is committed, like `versionCode`, so
  the mode that ships is the mode in git. A missing or non-boolean value throws at startup.
- Every Play build from the personal account keeps `medication: false` (the narrow build). It goes
  to every track, internal and closed, because the health declaration is per app, not per track.
  `versionCode` 5 replaces the release on both.
- The switch also reaches the Android manifest (`tenulo.medication`, written by
  `plugins/with-medication-switch.js`), so an injection alarm stored by an earlier build is
  dropped on package replace and never fires.
- The narrow build keeps every row in the database and in backups; it only stops showing and
  creating medication content. No schema change, no migration, `BACKUP_VERSION` unchanged.
- The narrow build uses no medication, treatment or care wording at all (list and the one allowed
  disclaimer in `src/domain/narrow-words.ts`). "Doctor report" becomes "PDF report"; this changes
  how ADR 0006 reads for the narrow build: Tenulo Pro unlocks the PDF report. The full build keeps
  "Doctor report".
- Turning the medication features back on, in this order:
  1. Tenulo's Play account is an organization account.
  2. The privacy policy on the site is updated to describe them. Policy first (AGENTS.md).
  3. In the Play Console health declaration, tick "Medication and treatment management".
  4. Set `expo.extra.medication` to `true` and rebuild.
  5. A new `versionCode`, then a normal release.

## Consequences

- The medication code ships unreachable in the narrow bundle. Dead to the user, present in the
  binary; accepted so that going back is one switch and tester data is never touched.
- Everything that decides what is shown for a mode is a pure function that takes the flag, tested
  for both modes. The narrow string test and the store listing word test must pass for any build
  that goes to Play from the personal account.
- Internal testers who logged injections keep those rows; the privacy policy says entries from
  earlier test versions stay on the phone and in backups until deleted.
- The full app can run only as a local build with `medication: true`, installed outside Play; that
  build never goes to Play.

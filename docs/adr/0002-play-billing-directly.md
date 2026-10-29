# ADR 0002: Tenulo Pro through Play Billing, used directly

- Status: accepted
- Date: 2026-10-29

## Context

The privacy policy sells "Tenulo Pro" as an in-app purchase through Google Play and promises the
app receives only confirmation that a purchase is valid. AGENTS.md: no RevenueCat or other purchase
backend; Play Billing is the only component that talks to a server.

Wrappers considered: `expo-iap` (multi-store, pulls the `openiap` artifact and optional Amazon
peers) and `react-native-iap`. Both add a third-party layer between Tenulo and Play Billing.

## Decision

`BillingModule` in `modules/tenulo-native` uses `com.android.billingclient:billing:9.1.0` directly
for one one-time product, `tenulo_pro`:

- `getProduct` (price from Play), `purchase` (billing flow), `ownedProducts` (owned and pending);
- purchases are acknowledged on the device (Play refunds unacknowledged ones after three days);
  failed acknowledgements are retried on the next ownership check;
- `enableAutoServiceReconnection()`, pending one-time purchases enabled.

Ownership is never stored in Tenulo's database. `src/platform/billing.ts` asks Play on start, on
foreground and after every purchase update; Play answers from its own cache when offline.

Pro unlocks the doctor PDF report and Health Connect sync. Logging, trend, forecast, reminders,
backup, restore and delete-all stay free: nobody's own data is held behind a paywall.

## Consequences

- No server-side verification (there is no server). Signature verification on the device would
  need the Play public key and adds little; a rooted device can bypass either way.
- Play Billing Library itself depends on Google's data-transport and Play services libraries; that
  is Google Play Billing, the one networked component the rules allow. The location permissions
  that come with Play services stay removed by `blockedPermissions`.
- Development builds can unlock Pro from Settings (`__DEV__` only) to test gated screens.
- Play Console must have an active in-app product with id `tenulo_pro` (see release checklist).

# Release checklist (Google Play)

Everything in code is done; these steps need the Play Console account owner.

## 1. Build

```bash
pnpm install
pnpm typecheck && pnpm lint && pnpm test
npx expo-doctor            # see "Known doctor warnings" below
npx eas-cli@latest build --platform android --profile production   # or a local signed build
```

- `app.json`: `version` 1.0.0, `android.versionCode` 1. Bump `versionCode` on every upload.
- Signing: use Play App Signing; keep the upload key out of the repo (`*.jks` is gitignored).

## 2. In-app product

Play Console → Monetize → Products → In-app products → Create:

| Field | Value |
| --- | --- |
| Product ID | `tenulo_pro` (must match `PRO_PRODUCT_ID` in `src/platform/billing.ts`) |
| Type | One-time, non-consumable |
| Name | Tenulo Pro |
| Description | Doctor report (PDF) and Health Connect sync. One purchase, no subscription. |
| Price | your choice |

Test with a license-tester account on an internal testing track: buy, cancel, a pending payment
("slow test card"), refund, and "Restore purchase" on a second device.

## 3. Health Connect declaration

Play Console → App content → Health apps / Health Connect permissions:

- Permission: **Read Weight** only.
- Purpose: show smart-scale and other apps' weight readings in the user's own log and trend.
- Privacy policy URL: https://sabahattinkalkan.com/tenulo/privacy/ (it already describes this).
- Approval can take up to a week, plus 5–7 business days to propagate.

## 4. Data safety form

Answers that match the code (re-check against Google's current definitions before submitting):

- Data collected: **none** (nothing is transmitted off the device by the app).
- Data shared: **none**.
- Health and fitness data is processed on the device only (manual entries and Health Connect).
- Encryption in transit: not applicable (no app server).
- Users can request deletion: yes, in-app ("Delete all data"); there is no server copy.
- Google Play Billing handles purchases; Tenulo receives only the purchase state on the device.

## 5. Store listing

- Text: `docs/store/listing.md`.
- Graphics: `docs/store/icon-512.png`, `docs/store/feature-graphic.png` (regenerate with
  `python scripts/brand.py <Roboto.ttf>`).
- Screenshots: phone, at least 2; use the development build with sample data, never real data.
- Content rating questionnaire: medical/health reference, no user-generated content shared.
- Target audience: 18+ (matches the privacy policy).

## Known doctor warnings

- `@expo/config-plugins` installed directly: it pins the peer of `react-native-health-connect`
  to the version Expo already uses, so pnpm does not add a second, newer copy.
- Patch versions one behind the SDK's latest: pnpm's `minimumReleaseAge` rejects packages
  published in the last day. Run `npx expo install --fix` a day later.

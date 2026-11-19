# Prompt for the site agent: update the Tenulo privacy policy

Paste this to the agent that maintains kalkansoftware.com. It is self-contained.

---

Update the Tenulo privacy policy on kalkansoftware.com before Tenulo is resubmitted to Google Play.

## Pages

- English: `/tenulo/privacy/`
- Turkish: `/tr/tenulo/privacy/`

Rewrite both, with the same content in both languages. Bump the effective date on both to the
date you deploy.

## Why

Tenulo (Android, `com.kalkansoftware.tenulo`, by Kalkan Software) now ships as a general weight
and food log. The live policy still describes features the new app does not show. The policy must
describe the app as it is, and a Play reviewer reads it next to the app's declarations.

## What the app stores and does (describe exactly this)

- It stores on the device only: weight, food entries, water, body measurements and exercise, plus
  the user's own daily goals and settings.
- Weigh-in reminders: local notifications set by the user, scheduled on the device.
- Health Connect: the app can read `Weight` only, if the user turns it on and grants the
  permission. It never writes to Health Connect.
- PDF report: the user can create a PDF report of their entries. It leaves the device only when
  the user shares or saves it themselves.
- Backup file: the user can export a backup file and restore from one. It leaves the device only
  when the user shares or saves it themselves.
- Tenulo Pro: a one-time purchase through Google Play Billing. Google Play is the only component
  that talks to a server; Tenulo does not see payment details.

## Keep everything the policy already promises

- No account, no sign-in.
- No analytics, no crash reporting, no ads, no advertising ID, no remote config, no tracking.
- No network calls from the app itself; no data is sent to Kalkan Software or anyone else.
- No cloud backup and no device-to-device transfer by Android; data leaves the device only when
  the user exports it.
- Deletion: "Delete all data" in Settings removes every entry; uninstalling the app removes the
  rest.
- Contact: support@kalkansoftware.com. Do not add any other name or address.

## Add this sentence (English, exact)

> If you used an earlier test version of Tenulo, the entries you made there stay on your phone and
> in your backup files until you delete them.

Turkish rendering (use it on the Turkish page; polish if you must, keep the meaning):

> Tenulo'nun daha önceki bir test sürümünü kullandıysanız, orada yaptığınız kayıtlar siz silene
> kadar telefonunuzda ve yedek dosyalarınızda kalır.

Do not explain what those entries are.

## Words that must not appear in the new page text (either language)

GLP, injection, inject, enjeksiyon, iğne, dose, doz, medication, medicine, ilaç, ilac (catches
"ilacın" and similar), side effect, yan etki, prescription, reçete, doctor, doktor, patient,
hasta, pharmacist, eczacı, treatment, tedavi. Match as whole words or word stems,
case-insensitive. Remove every existing mention, including in headings, the page title, meta
description and any footer.

One allowed exception, only if the page has a disclaimer, exact text:
- EN: "Tenulo is a personal log for adults. It is not a medical device and does not diagnose,
  treat, cure or prevent any condition."
- TR: "Tenulo yetişkinler için kişisel bir günlüktür. Tıbbi cihaz değildir; hiçbir durumu teşhis
  etmez, tedavi etmez, iyileştirmez veya önlemez."

## Verify after deploy

1. `https://kalkansoftware.com/tenulo/privacy/` returns HTTP 200.
2. `https://kalkansoftware.com/tr/tenulo/privacy/` returns HTTP 200.
3. Both show the new effective date and the earlier-test-versions sentence.
4. Search the rendered text of both pages for each word above; there must be no match.

Report the two status codes and the effective date you set.

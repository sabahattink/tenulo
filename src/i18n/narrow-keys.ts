/**
 * Message keys the narrow build (`expo.extra.medication: false`) never shows. Used by tests only:
 * narrow-strings.test.ts scans every other key for medication words, so a key is narrow-visible
 * unless it is listed here, and a new string on a shared screen is checked without opting in.
 *
 * An entry covers the key itself and everything under it ("report.medication" covers
 * "report.medication", not "report.medicationX"). Each entry names the task that hides it; a full
 * text whose screen stays visible is listed only because a `narrow` twin replaces it there.
 */
export const MEDICATION_ONLY_KEYS: readonly string[] = [
  // Task 5: the setup-medication, medication, log-injection (with BodyMap) and log-side-effect
  // routes redirect to Today, so their titles and screens never render.
  "screens.setupMedication",
  "screens.logInjection",
  "screens.logSideEffect",
  "screens.medication",
  "common.addMedicationFirst",
  "common.medicationName",
  "medication",
  "setupMedication",
  "logInjection",
  "bodyMap",
  "logSideEffect",
  "sideEffects", // Also History rows (Task 6) and the PDF side-effect section (Task 7).
  // Task 5: the injection reminder is never scheduled; the channel uses reminders.narrow.
  "reminders.injectionTitle",
  "reminders.injectionBody",
  "reminders.channelDescription",
  // Task 6: Today hides InjectionCard (its due line is f.due) and the side-effect quick action.
  "injectionCard",
  "due",
  "daily.actions.sideEffect",
  // Task 6: History hides injection and side-effect rows and chips; empty text uses history.narrow.
  "history.filters.injection",
  "history.filters.side-effect",
  "history.injection",
  "history.emptyBody",
  // Task 6: welcome drops the plan page; the food page body uses daily.welcomePage.narrow.
  "welcome.pages.plan",
  "daily.welcomePage.body",
  // Task 6: Settings hides the medication section, the injection reminder row and the
  // inactive-medications line; the rest uses the narrow twins.
  "settings.medication",
  "settings.reminders.injection",
  "settings.reminders.injectionDetail",
  "settings.reminders.injectionTime",
  "settings.reminders.addMedicationFirst",
  "settings.reminders.footer",
  "settings.data.report",
  "settings.data.reportDetail",
  "settings.data.inactiveMedications",
  "settings.data.deleteAllBody",
  "settings.proBanner.pitch",
  "settings.disclaimer",
  // Task 6: privacy, Pro and goals screens use their narrow twins.
  "privacy.intro",
  "privacy.points.device.body",
  "privacy.points.reminders.body",
  "privacy.footer",
  "pro.features.report",
  "goals.intro",
  // Task 7: the report screen uses screens.narrow / report.narrow and shows no medication,
  // injection or side-effect fact; the PDF renders no medication, plan, injection or side-effect
  // section and uses reportPdf.narrow / reportLog.pdf.narrow.
  "screens.report",
  "report.proOnly",
  "report.intro",
  "report.injections",
  "report.sideEffects",
  "report.medication",
  "reportPdf.injections",
  "reportPdf.sideEffects",
  "reportPdf.medication",
  "reportPdf.plan",
  "reportPdf.dose",
  "reportPdf.injectionsLogged",
  "reportPdf.noInjections",
  "reportPdf.gaps",
  "reportPdf.noSideEffects",
  "reportPdf.ratingsNote",
  "reportPdf.footer",
  "reportLog.pdf.nutritionNote",
  "reportLog.pdf.exerciseNote",
  // Task 8: the restore summary leaves medication kinds out and adds restore.keptHidden.
  "restore.counts.injections",
  "restore.counts.sideEffects",
  "restore.counts.medications",
];

/** True when `path` is a key listed in MEDICATION_ONLY_KEYS or lies under one. */
export function isMedicationOnly(path: string): boolean {
  return MEDICATION_ONLY_KEYS.some((key) => path === key || path.startsWith(`${key}.`));
}

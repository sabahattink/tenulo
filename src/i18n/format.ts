/**
 * Numbers, dates and the sentences built from them, in one language.
 *
 * Deliberately not Intl: month names, decimal marks and case mapping come from the dictionaries,
 * so the output is the same in tests (Node's ICU) and on the phone (Hermes), and a LocalDate never
 * passes through a Date object and the device's time zone. Day arithmetic goes through
 * src/domain/date.ts; weights and doses are formatted by the domain and only localized here.
 */
import type { ParseBackupResult } from "../domain/backup";
import { type LocalDate, diffDays, localDateOf, toDayNumber } from "../domain/date";
import type { Forecast } from "../domain/forecast";
import type { Language } from "../domain/language";
import { formatDose } from "../domain/parse";
import { formatMinuteOfDay } from "../domain/reminder";
import { type WeightUnit, formatWeight, formatWeightChange, weightNumber } from "../domain/weight";
import type { Messages } from "./en";
import { RESTORE_COUNTS, type RestoreCounts, isBackupRecord } from "./records";

const MINUS = "−";
/** 1970-01-01, day 0, was a Thursday: index 3 in a Monday-first week. */
const THURSDAY = 3;

export interface Formatters {
  /** "82.4" / "82,4": a fixed number of decimals with the language's decimal mark and a true minus. */
  decimal(value: number, digits: number): string;
  /** "1,850" / "1.850". */
  integer(value: number): string;
  /** "82.4 kg" / "82,4 kg". */
  weight(grams: number, unit: WeightUnit): string;
  /** "−0.6 kg", "+1.2 lb", "0.0 kg" (true minus sign). */
  weightChange(grams: number, unit: WeightUnit): string;
  /** Number only, for input fields and headline figures: "82.4" / "82,4". */
  weightNumber(grams: number, unit: WeightUnit): string;
  /** "0.25 mg" / "0,25 mg". */
  dose(mcg: number): string;
  /** "0.25" / "0,25": the dose as typed into a field. */
  doseNumber(mcg: number): string;
  /** "every week" / "her hafta", "every 2 weeks" / "2 haftada bir". */
  interval(days: number): string;
  /** A dose and its interval: "0.25 mg every week" / "0,25 mg, her hafta". */
  planStep(doseMcg: number, intervalDays: number): string;
  /** "18 Oct" / "18 Eki", with the year when it is not `today`'s. */
  shortDate(date: LocalDate, today: LocalDate): string;
  /** Always with the year, for documents read outside the app: "29 Oct 2026" / "29 Ekim 2026". */
  longDate(date: LocalDate): string;
  /** "Thursday, 29 October" / "Perşembe, 29 Ekim". */
  longWeekday(date: LocalDate): string;
  /** "October 2026" / "Ekim 2026". */
  monthTitle(date: LocalDate): string;
  /** "Today", "Yesterday", "3 days ago", or a date further back (or ahead). */
  relativeDay(date: LocalDate, today: LocalDate): string;
  /** The same, for use inside a sentence: "today", "yesterday". */
  relativeDayInline(date: LocalDate, today: LocalDate): string;
  /** "09:00": 24-hour in both languages. */
  time(minuteOfDay: number): string;
  /** "a, b and c" / "a, b ve c". */
  list(parts: readonly string[]): string;
  /** Upper case with the language's own rules (Turkish i → İ), whatever the phone's locale is. */
  upper(text: string): string;
  /** One calm sentence about where the trend is heading; never a promise, never advice. */
  forecast(forecast: Forecast, unit: WeightUnit, today: LocalDate): string;
  /** When the next injection is due by the user's own schedule. */
  due(daysUntilDue: number | undefined, nextDue: LocalDate | undefined, today: LocalDate): string;
  /** "Added 12 weigh-ins, 1 injection and 2 side effects." */
  restoreSummary(counts: RestoreCounts): string;
  /** Why a backup file was refused, in words a person can act on. */
  backupProblem(result: Extract<ParseBackupResult, { ok: false }>): string;
  /** The last Health Connect read, relative to `now`. */
  synced(enabled: boolean, syncedAt: number | null, now?: Date): string;
  /** After a Health Connect read: what was added, and whether more is still to come. */
  healthSync(result: { readonly added: number; readonly complete: boolean }): string;
}

export function createFormatters(lang: Language, t: Messages): Formatters {
  const { calendar } = t;
  const localize = (plain: string) => plain.replace(".", t.number.decimalMark);
  const monthIndex = (date: LocalDate) => Number(date.slice(5, 7)) - 1;
  const dayOfMonth = (date: LocalDate) => Number(date.slice(8, 10));

  const decimal = (value: number, digits: number) => {
    const plain = Math.abs(value).toFixed(digits);
    // No "−0.0": a value that rounds to zero has no sign.
    return `${value < 0 && Number(plain) !== 0 ? MINUS : ""}${localize(plain)}`;
  };

  const shortDate = (date: LocalDate, today: LocalDate) =>
    calendar.shortDate(
      dayOfMonth(date),
      calendar.monthsShort[monthIndex(date)] ?? "",
      date.slice(0, 4) === today.slice(0, 4) ? undefined : date.slice(0, 4),
    );

  const relative = (date: LocalDate, today: LocalDate, inline: boolean) => {
    const days = diffDays(date, today);
    if (days === 0) return inline ? t.days.todayInline : t.days.today;
    if (days === 1) return inline ? t.days.yesterdayInline : t.days.yesterday;
    if (days > 1 && days < 7) return t.days.daysAgo(days);
    return shortDate(date, today);
  };

  const interval = (days: number) => {
    if (days === 1) return t.interval.daily;
    if (days === 7) return t.interval.weekly;
    if (days % 7 === 0) return t.interval.everyWeeks(days / 7);
    return t.interval.everyDays(days);
  };

  const list = (parts: readonly string[]) => {
    if (parts.length <= 1) return parts.join("");
    return `${parts.slice(0, -1).join(", ")} ${t.list.and} ${parts.at(-1) ?? ""}`;
  };

  const weightChange = (grams: number, unit: WeightUnit) => localize(formatWeightChange(grams, unit));

  const restoreSummary = (counts: RestoreCounts) => {
    const parts = RESTORE_COUNTS.flatMap((key) => {
      const n = counts[key];
      return n === undefined || n === 0 ? [] : [t.restore.counts[key](n)];
    });
    return parts.length === 0 ? t.restore.nothingNew : t.restore.added(list(parts));
  };

  /** The record a person could find, counted from 1: ["data", "weights", 3, "weightG"] is weigh-in 4. */
  const backupPlace = (path: readonly PropertyKey[]): string | undefined => {
    const [root, table, index] = path;
    if (root !== "data") return undefined;
    if (table === "settings") return t.backup.problemInSettings;
    if (!isBackupRecord(table)) return undefined;
    return t.backup.problemAt(table, typeof index === "number" ? index + 1 : undefined);
  };

  return {
    decimal,
    integer: (value) => {
      const digits = String(Math.abs(Math.round(value))).replace(/\B(?=(\d{3})+(?!\d))/g, t.number.groupMark);
      return Math.round(value) < 0 ? `${MINUS}${digits}` : digits;
    },
    weight: (grams, unit) => localize(formatWeight(grams, unit)),
    weightChange,
    weightNumber: (grams, unit) => localize(weightNumber(grams, unit)),
    dose: (mcg) => localize(formatDose(mcg)),
    doseNumber: (mcg) => localize(String(mcg / 1000)),
    interval,
    planStep: (doseMcg, intervalDays) => t.medication.step(localize(formatDose(doseMcg)), interval(intervalDays)),
    shortDate,
    longDate: (date) =>
      calendar.longDate(
        dayOfMonth(date),
        calendar.monthsShort[monthIndex(date)] ?? "",
        calendar.monthsLong[monthIndex(date)] ?? "",
        date.slice(0, 4),
      ),
    longWeekday: (date) =>
      calendar.weekdayDate(
        calendar.weekdays[(((toDayNumber(date) + THURSDAY) % 7) + 7) % 7] ?? "",
        dayOfMonth(date),
        calendar.monthsLong[monthIndex(date)] ?? "",
      ),
    monthTitle: (date) => calendar.monthTitle(calendar.monthsLong[monthIndex(date)] ?? "", date.slice(0, 4)),
    relativeDay: (date, today) => relative(date, today, false),
    relativeDayInline: (date, today) => relative(date, today, true),
    time: formatMinuteOfDay,
    list,
    // JS toUpperCase maps i to I in every locale; Turkish needs İ, while ı already becomes I.
    upper: (text) => (lang === "tr" ? text.replaceAll("i", "İ") : text).toUpperCase(),
    forecast: (f, unit, today) => {
      const perWeek = (rate: number) => t.forecast.perWeek(weightChange(rate * 7, unit));
      switch (f.kind) {
        case "insufficient-data":
          return t.forecast.insufficient(f.needed - f.points);
        case "no-goal":
          return t.forecast.noGoal(perWeek(f.rateGPerDay));
        case "reached":
          return t.forecast.reached;
        case "steady":
          return t.forecast.steady;
        case "away-from-goal":
          return t.forecast.away(perWeek(f.rateGPerDay));
        case "beyond-horizon":
          return t.forecast.beyond(perWeek(f.rateGPerDay));
        case "on-track":
          return t.forecast.onTrack(perWeek(f.rateGPerDay), shortDate(f.goalDate, today));
      }
    },
    due: (daysUntilDue, nextDue, today) => {
      if (daysUntilDue === undefined || nextDue === undefined) return t.due.first;
      if (daysUntilDue === 0) return t.due.today;
      if (daysUntilDue === 1) return t.due.tomorrow;
      if (daysUntilDue > 1) return t.due.inDays(shortDate(nextDue, today), daysUntilDue);
      return t.due.overdue(shortDate(nextDue, today), -daysUntilDue);
    },
    restoreSummary,
    backupProblem: (r) => {
      switch (r.reason) {
        case "not-json":
        case "not-a-backup":
          return t.backup.notABackup;
        case "newer-version":
          return t.backup.newerVersion;
        case "too-large":
          return t.backup.tooLarge;
        case "invalid": {
          // Whole-backup checks have no path; their messages are already sentences.
          const why = backupPlace(r.path) ?? (r.path.length === 0 ? t.backup.wholeCheck(r.detail) : undefined);
          return why === undefined ? t.backup.damaged : `${t.backup.damaged} ${why}`;
        }
      }
    },
    synced: (enabled, syncedAt, now = new Date()) => {
      if (!enabled) return t.health.off;
      if (syncedAt === null) return t.health.notReadYet;
      // An instant, so the device's time zone is the right one here.
      const at = new Date(syncedAt);
      const minute = at.getHours() * 60 + at.getMinutes();
      return t.health.lastRead(relative(localDateOf(at), localDateOf(now), true), formatMinuteOfDay(minute));
    },
    healthSync: (r) => {
      const added = r.added === 0 ? t.health.noNewReadings : restoreSummary({ weights: r.added });
      return r.complete ? added : `${added} ${t.health.moreToRead}`;
    },
  };
}

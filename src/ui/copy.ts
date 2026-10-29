import type { ParseBackupResult } from "../domain/backup";
import { type LocalDate, diffDays, localDateOf, toDayNumber } from "../domain/date";
import { formatMinuteOfDay } from "../domain/reminder";
import type { Forecast } from "../domain/forecast";
import type { InjectionSite } from "../domain/injection";
import type { SideEffectType as SideEffectKind } from "../domain/side-effect";
import { type WeightUnit, formatWeightChange } from "../domain/weight";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "18 Oct", or "18 Oct 2027" when the year differs from `today`'s. */
export function shortDate(date: LocalDate, today: LocalDate): string {
  const [y, m, d] = date.split("-");
  const label = `${Number(d)} ${MONTHS[Number(m) - 1] ?? ""}`;
  return y === today.slice(0, 4) ? label : `${label} ${y}`;
}

/** For use inside a sentence: "today", "yesterday", "3 days ago", "20 Oct". */
export function relativeDayInline(date: LocalDate, today: LocalDate): string {
  const text = relativeDay(date, today);
  return text === "Today" || text === "Yesterday" ? text.toLowerCase() : text;
}

/** "Today", "Yesterday", "3 days ago", or a date further back. */
export function relativeDay(date: LocalDate, today: LocalDate): string {
  const days = diffDays(date, today);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days > 1 && days < 7) return `${days} days ago`;
  return shortDate(date, today);
}

/**
 * One calm sentence about where the trend is heading. Never a promise, never advice: when the
 * data cannot support a date, it says so instead of inventing one.
 */
export function forecastText(f: Forecast, unit: WeightUnit, today: LocalDate): string {
  const perWeek = (rate: number) => `${formatWeightChange(rate * 7, unit)} per week`;
  switch (f.kind) {
    case "insufficient-data":
      return `Log ${f.needed - f.points} more ${f.needed - f.points === 1 ? "day" : "days"} to see where your trend is heading.`;
    case "no-goal":
      return `Trend: ${perWeek(f.rateGPerDay)}. Set a goal to see a projected date.`;
    case "reached":
      return "Your trend is at your goal.";
    case "steady":
      return "Your trend is holding steady.";
    case "away-from-goal":
      return `Trend: ${perWeek(f.rateGPerDay)}, moving away from your goal.`;
    case "beyond-horizon":
      return `Trend: ${perWeek(f.rateGPerDay)}. At this pace your goal is more than two years away.`;
    case "on-track":
      return `At ${perWeek(f.rateGPerDay)}, your trend would reach your goal around ${shortDate(f.goalDate, today)}.`;
  }
}

export const SITE_LABELS: Record<InjectionSite, string> = {
  "abdomen-left": "Belly, left",
  "abdomen-right": "Belly, right",
  "thigh-left": "Thigh, left",
  "thigh-right": "Thigh, right",
  "arm-left": "Arm, left",
  "arm-right": "Arm, right",
};

export const SIDE_EFFECT_LABELS: Record<SideEffectKind, string> = {
  nausea: "Nausea",
  vomiting: "Vomiting",
  constipation: "Constipation",
  diarrhea: "Diarrhea",
  heartburn: "Heartburn",
  fatigue: "Tiredness",
  headache: "Headache",
  "injection-site": "Injection site",
  other: "Other",
};

export const SEVERITY_LABELS = { 1: "Mild", 2: "Moderate", 3: "Strong" } as const;

/** One line for the injection card: when the next shot is due, by the user's own schedule. */
export function dueText(daysUntilDue: number | undefined, nextDue: LocalDate | undefined, today: LocalDate): string {
  if (daysUntilDue === undefined || nextDue === undefined) return "Log your first injection to start tracking.";
  if (daysUntilDue === 0) return "Next injection: today";
  if (daysUntilDue === 1) return "Next injection: tomorrow";
  if (daysUntilDue > 1) return `Next injection: ${shortDate(nextDue, today)} (in ${daysUntilDue} days)`;
  const late = -daysUntilDue;
  return `Next injection was due ${shortDate(nextDue, today)} (${late} ${late === 1 ? "day" : "days"} ago)`;
}

/** "29 Oct 2026": always with the year, for documents read outside the app. */
export function longDate(date: LocalDate): string {
  const [y, m, d] = date.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? ""} ${y}`;
}

/** "every week", "every 2 weeks", "every day", "every 10 days". */
export function intervalText(days: number): string {
  if (days === 1) return "every day";
  if (days === 7) return "every week";
  if (days % 7 === 0) return `every ${days / 7} weeks`;
  return `every ${days} days`;
}

const WEEKDAYS = ["Thursday", "Friday", "Saturday", "Sunday", "Monday", "Tuesday", "Wednesday"];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "Thursday, 29 October". Weekday from the day number: 1970-01-01 was a Thursday. */
export function longWeekday(date: LocalDate): string {
  const [, m, d] = date.split("-");
  const weekday = WEEKDAYS[((toDayNumber(date) % 7) + 7) % 7] ?? "";
  return `${weekday}, ${Number(d)} ${MONTHS_LONG[Number(m) - 1] ?? ""}`;
}

/** "October 2026", for grouping history by month. */
export function monthTitle(date: LocalDate): string {
  const [y, m] = date.split("-");
  return `${MONTHS_LONG[Number(m) - 1] ?? ""} ${y}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function listJoin(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1) ?? ""}`;
}

/** "Added 12 weigh-ins, 4 injections and 2 side effects." */
export function restoreSummaryText(added: {
  weights?: number;
  injections?: number;
  sideEffects?: number;
  planSteps?: number;
  medications?: number;
}): string {
  const parts = [
    added.weights ? plural(added.weights, "weigh-in", "weigh-ins") : "",
    added.injections ? plural(added.injections, "injection", "injections") : "",
    added.sideEffects ? plural(added.sideEffects, "side effect", "side effects") : "",
    added.planSteps ? plural(added.planSteps, "plan step", "plan steps") : "",
    added.medications ? plural(added.medications, "medication", "medications") : "",
  ].filter((p) => p !== "");
  return parts.length === 0 ? "Nothing new: everything was already on this phone." : `Added ${listJoin(parts)}.`;
}

/** Why a backup file was refused, in words a person can act on. */
export function backupProblem(r: Extract<ParseBackupResult, { ok: false }>): string {
  switch (r.reason) {
    case "not-json":
    case "not-a-backup":
      return "This file is not a Tenulo backup.";
    case "newer-version":
      return "This backup was made by a newer version of Tenulo. Update Tenulo, then try again.";
    case "invalid":
      return `The backup is damaged or was edited, so nothing was restored. (${r.detail})`;
  }
}

/** "Last read 29 Oct at 08:15", relative to `now`. */
export function syncedText(enabled: boolean, syncedAt: number | null, now: Date = new Date()): string {
  if (!enabled) return "Off";
  if (syncedAt === null) return "Not read yet";
  const at = new Date(syncedAt);
  const minute = at.getHours() * 60 + at.getMinutes();
  return `Last read ${relativeDayInline(localDateOf(at), localDateOf(now))} at ${formatMinuteOfDay(minute)}`;
}

/** After a Health Connect read: what was added, and whether more is still to come. */
export function healthSyncText(r: { added: number; complete: boolean }): string {
  const added = r.added === 0 ? "No new readings." : restoreSummaryText({ weights: r.added });
  return r.complete ? added : `${added} There is more to read; Tenulo continues next time it opens.`;
}

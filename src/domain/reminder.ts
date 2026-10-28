/**
 * When local reminders fire. Times are minutes after local midnight (0-1439), the same integer the
 * settings table stores. Reminders restate the user's own schedule; they never suggest a dose.
 */
import { type LocalDate, addDays, localDateOf } from "./date";

export const MINUTES_PER_DAY = 1_440;

export function isMinuteOfDay(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && n < MINUTES_PER_DAY;
}

/** "09:00". 24-hour clock: unambiguous in every locale Tenulo ships to. */
export function formatMinuteOfDay(minute: number): string {
  if (!isMinuteOfDay(minute)) throw new RangeError(`Not a minute of the day: ${minute}`);
  const h = String(Math.floor(minute / 60)).padStart(2, "0");
  const m = String(minute % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export function parseMinuteOfDay(text: string): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!match) return undefined;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return undefined;
  return h * 60 + m;
}

/** Moves a time by `delta` minutes, wrapping around midnight. */
export function stepMinute(minute: number, delta: number): number {
  return (((minute + delta) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** That calendar date at that wall-clock time, in the device's current time zone. */
export function atLocalMinute(date: LocalDate, minute: number): Date {
  if (!isMinuteOfDay(minute)) throw new RangeError(`Not a minute of the day: ${minute}`);
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, Math.floor(minute / 60), minute % 60, 0, 0);
}

/** The next time the clock shows `minute`, strictly after `now`. */
export function nextDailyAt(minute: number, now: Date): Date {
  const today = localDateOf(now);
  const candidate = atLocalMinute(today, minute);
  return candidate.getTime() > now.getTime() ? candidate : atLocalMinute(addDays(today, 1), minute);
}

/**
 * When to remind about the next injection: the due date at the chosen time. If that moment has
 * already passed (the shot is overdue and not logged yet), remind once more at the next chosen
 * time rather than never. Undefined before the first injection is logged: there is nothing to
 * count from.
 */
export function injectionReminderAt(nextDue: LocalDate | undefined, minute: number, now: Date): Date | undefined {
  if (nextDue === undefined) return undefined;
  const due = atLocalMinute(nextDue, minute);
  return due.getTime() > now.getTime() ? due : nextDailyAt(minute, now);
}

/**
 * Calendar dates without time zones.
 *
 * Every record stores the user's local calendar date as `YYYY-MM-DD`. Day arithmetic is done on
 * an integer day number (days since 1970-01-01) computed in UTC, so DST shifts and the device
 * time zone can never change the distance between two dates.
 */

declare const localDateBrand: unique symbol;
export type LocalDate = string & { readonly [localDateBrand]: true };

const PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export function parseLocalDate(value: string): LocalDate {
  const match = PATTERN.exec(value);
  if (!match) throw new RangeError(`Not a YYYY-MM-DD date: "${value}"`);
  const [, y, m, d] = match;
  const ms = Date.UTC(Number(y), Number(m) - 1, Number(d));
  const roundTrip = new Date(ms).toISOString().slice(0, 10);
  if (roundTrip !== value) throw new RangeError(`Not a real calendar date: "${value}"`);
  return value as LocalDate;
}

export function isLocalDate(value: string): value is LocalDate {
  try {
    parseLocalDate(value);
    return true;
  } catch {
    return false;
  }
}

export function toDayNumber(date: LocalDate): number {
  return Date.parse(`${date}T00:00:00Z`) / MS_PER_DAY;
}

export function fromDayNumber(day: number): LocalDate {
  if (!Number.isInteger(day)) throw new RangeError(`Day number must be an integer: ${day}`);
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10) as LocalDate;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromDayNumber(toDayNumber(date) + days);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function diffDays(from: LocalDate, to: LocalDate): number {
  return toDayNumber(to) - toDayNumber(from);
}

/** The calendar date of an instant as seen in the device's current time zone. */
export function localDateOf(instant: Date): LocalDate {
  const y = instant.getFullYear();
  const m = String(instant.getMonth() + 1).padStart(2, "0");
  const d = String(instant.getDate()).padStart(2, "0");
  return parseLocalDate(`${y}-${m}-${d}`);
}

import { type LocalDate, diffDays, isLocalDate } from "../../domain/date";

/**
 * The `date` a screen was opened with (`/water?date=2026-11-17`): a real calendar date, not in
 * the future; anything else means today.
 */
export function dateFromParam(param: string | readonly string[] | undefined, today: LocalDate): LocalDate {
  const value = typeof param === "string" ? param : param?.[0];
  if (value === undefined || !isLocalDate(value)) return today;
  return diffDays(value, today) >= 0 ? value : today;
}

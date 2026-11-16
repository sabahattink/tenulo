/**
 * Route parameters of the food screens, checked: a link can carry anything, so each value falls
 * back to a safe default instead of reaching the database unchecked.
 */
import { type LocalDate, diffDays, isLocalDate } from "../../domain/date";
import { MAX_QUANTITY_MILLI, MEALS, MIN_QUANTITY_MILLI, type Meal, defaultMealFor } from "../../domain/food-log";

/** expo-router hands a repeated parameter over as an array; the screens use the first value. */
export type Param = string | string[] | undefined;

export function single(value: Param): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** The meal from the link, or the one that fits the time of day. */
export function mealParam(value: Param, minuteOfDay: number): Meal {
  const v = single(value);
  return MEALS.find((m) => m === v) ?? defaultMealFor(minuteOfDay);
}

/** The day from the link when it is a real date and not in the future; today otherwise. */
export function dateParam(value: Param, today: LocalDate): LocalDate {
  const v = single(value);
  return v !== undefined && isLocalDate(v) && diffDays(v, today) >= 0 ? v : today;
}

/** An amount in thousandths from the link, or undefined. */
export function quantityParam(value: Param): number | undefined {
  const v = single(value);
  if (v === undefined || !/^\d{1,9}$/.test(v)) return undefined;
  const n = Number(v);
  return n >= MIN_QUANTITY_MILLI && n <= MAX_QUANTITY_MILLI ? n : undefined;
}

/** Minutes since local midnight, for the default meal. */
export function minuteOfDay(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

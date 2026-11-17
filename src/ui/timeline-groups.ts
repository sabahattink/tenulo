/**
 * How the daily-log records become History lines: one line per meal per day, one per day of water,
 * one per measuring sitting. Exercise and the older kinds stay one line per record.
 */
import { type LocalDate, parseLocalDate, toDayNumber } from "../domain/date";
import { MEALS, type Meal } from "../domain/food-log";
import { MEASUREMENT_SITES, type MeasurementSite } from "../domain/measurement";

/** Foods of one meal on one day: a single entry (`foods` 1), or several already added up by the database. */
export interface FoodLogRow {
  readonly localDate: string;
  readonly meal: Meal;
  readonly foods: number;
  /** The latest entry's. */
  readonly loggedAt: number;
  readonly energyKcal: number;
}

export interface MealLine {
  /** "YYYY-MM-DD|meal": one line per meal per day. */
  readonly id: string;
  readonly date: LocalDate;
  readonly meal: Meal;
  readonly foods: number;
  readonly energyKcal: number;
  /** When the meal's latest food was logged. */
  readonly at: number;
}

/** One line per meal per day, newest day first and in meal order within a day. */
export function mealLines(rows: readonly FoodLogRow[]): MealLine[] {
  const groups = new Map<string, { date: LocalDate; meal: Meal; foods: number; energyKcal: number; at: number }>();
  for (const r of rows) {
    const id = `${r.localDate}|${r.meal}`;
    const g = groups.get(id);
    if (g === undefined) {
      groups.set(id, { date: parseLocalDate(r.localDate), meal: r.meal, foods: r.foods, energyKcal: r.energyKcal, at: r.loggedAt });
    } else {
      g.foods += r.foods;
      g.energyKcal += r.energyKcal;
      g.at = Math.max(g.at, r.loggedAt);
    }
  }
  return [...groups.entries()]
    .map(([id, g]) => ({ id, ...g }))
    .sort((a, b) => toDayNumber(b.date) - toDayNumber(a.date) || MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal));
}

export interface WaterLogRow {
  readonly id: string;
  readonly localDate: string;
  readonly loggedAt: number;
  readonly amountMl: number;
}

export interface WaterLine {
  /** The day, "YYYY-MM-DD": one line per day. */
  readonly id: string;
  readonly date: LocalDate;
  readonly totalMl: number;
  /** The entries behind the total, so the day can be deleted as a whole. */
  readonly entryIds: readonly string[];
  readonly at: number;
}

export function waterLines(rows: readonly WaterLogRow[]): WaterLine[] {
  const days = new Map<string, { totalMl: number; entryIds: string[]; at: number }>();
  for (const r of rows) {
    const d = days.get(r.localDate);
    if (d === undefined) days.set(r.localDate, { totalMl: r.amountMl, entryIds: [r.id], at: r.loggedAt });
    else {
      d.totalMl += r.amountMl;
      d.entryIds.push(r.id);
      d.at = Math.max(d.at, r.loggedAt);
    }
  }
  return [...days.entries()]
    .map(([day, d]) => ({ id: day, date: parseLocalDate(day), ...d }))
    .sort((a, b) => toDayNumber(b.date) - toDayNumber(a.date));
}

export interface MeasurementRow {
  readonly id: string;
  readonly localDate: string;
  readonly measuredAt: number;
  readonly site: MeasurementSite;
  readonly lengthMm: number;
}

export interface SittingLine {
  /** "YYYY-MM-DD|measuredAt": readings saved together share their date and instant. */
  readonly id: string;
  readonly date: LocalDate;
  readonly at: number;
  /** In body order (waist, hip, chest, neck, arm, thigh). */
  readonly readings: readonly { readonly id: string; readonly site: MeasurementSite; readonly lengthMm: number }[];
}

export function measurementSittings(rows: readonly MeasurementRow[]): SittingLine[] {
  const sittings = new Map<string, { date: LocalDate; at: number; readings: { id: string; site: MeasurementSite; lengthMm: number }[] }>();
  for (const r of rows) {
    const id = `${r.localDate}|${r.measuredAt}`;
    const reading = { id: r.id, site: r.site, lengthMm: r.lengthMm };
    const s = sittings.get(id);
    if (s === undefined) sittings.set(id, { date: parseLocalDate(r.localDate), at: r.measuredAt, readings: [reading] });
    else s.readings.push(reading);
  }
  const order = (site: MeasurementSite) => MEASUREMENT_SITES.indexOf(site);
  return [...sittings.entries()]
    .map(([id, s]) => ({ id, ...s, readings: [...s.readings].sort((a, b) => order(a.site) - order(b.site)) }))
    .sort((a, b) => toDayNumber(b.date) - toDayNumber(a.date) || b.at - a.at);
}

/**
 * Looks up the body weight on a day: the latest weigh-in on or before it, undefined before the
 * first. Used only to show an exercise estimate (marked as one). The weigh-ins are sorted once, so
 * each lookup is a binary search rather than a pass over every weigh-in.
 */
export function weightOnOrBefore(
  weights: readonly { readonly date: LocalDate; readonly weightG: number }[],
): (date: LocalDate) => number | undefined {
  const sorted = weights.map((w) => ({ day: toDayNumber(w.date), weightG: w.weightG })).sort((a, b) => a.day - b.day);
  return (date) => {
    const day = toDayNumber(date);
    // The last index whose day is on or before `day`.
    let lo = 0;
    let hi = sorted.length - 1;
    let found: number | undefined;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const entry = sorted[mid];
      if (entry === undefined) break;
      if (entry.day <= day) {
        found = entry.weightG;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return found;
  };
}

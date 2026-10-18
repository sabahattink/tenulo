import { type LocalDate, fromDayNumber, toDayNumber } from "./date";
import type { TrendPoint } from "./trend";

export interface ForecastOptions {
  /** Only trend points within this many days before the latest point are used. */
  readonly windowDays: number;
  /** Below this many points a forecast is not shown at all. */
  readonly minPoints: number;
  /** Rates slower than this (g/day, absolute) are treated as "holding steady". */
  readonly minRateGPerDay: number;
  /** Goal dates further away than this are not reported; the line would be speculation. */
  readonly maxHorizonDays: number;
}

export const DEFAULT_FORECAST: ForecastOptions = {
  windowDays: 21,
  minPoints: 10,
  minRateGPerDay: 10,
  maxHorizonDays: 730,
};

/** A trend within this distance of the goal counts as reached. */
export const REACHED_TOLERANCE_G = 100;

export type Forecast =
  | { readonly kind: "insufficient-data"; readonly points: number; readonly needed: number }
  | { readonly kind: "steady"; readonly rateGPerDay: number }
  | { readonly kind: "away-from-goal"; readonly rateGPerDay: number }
  | { readonly kind: "beyond-horizon"; readonly rateGPerDay: number }
  | { readonly kind: "no-goal"; readonly rateGPerDay: number }
  | { readonly kind: "reached"; readonly rateGPerDay: number }
  | { readonly kind: "on-track"; readonly rateGPerDay: number; readonly goalDate: LocalDate };

/** Least-squares slope of trend against day number. */
export function trendRate(points: readonly { day: number; trendG: number }[]): number {
  const n = points.length;
  if (n < 2) return 0;
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p.day;
    sy += p.trendG;
  }
  const mx = sx / n;
  const my = sy / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.day - mx) * (p.trendG - my);
    den += (p.day - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export function forecast(
  trend: readonly TrendPoint[],
  goalG: number | null,
  options: ForecastOptions = DEFAULT_FORECAST,
): Forecast {
  const last = trend.at(-1);
  if (last === undefined) {
    return { kind: "insufficient-data", points: 0, needed: options.minPoints };
  }
  const lastDay = toDayNumber(last.date);
  const window = trend
    .map((p) => ({ day: toDayNumber(p.date), trendG: p.trendG }))
    .filter((p) => lastDay - p.day < options.windowDays);

  if (window.length < options.minPoints) {
    return { kind: "insufficient-data", points: window.length, needed: options.minPoints };
  }

  const rate = trendRate(window);
  if (goalG === null) return { kind: "no-goal", rateGPerDay: rate };

  const remaining = goalG - last.trendG;
  if (Math.abs(remaining) < REACHED_TOLERANCE_G) return { kind: "reached", rateGPerDay: rate };
  if (Math.abs(rate) < options.minRateGPerDay) return { kind: "steady", rateGPerDay: rate };
  if (Math.sign(remaining) !== Math.sign(rate)) return { kind: "away-from-goal", rateGPerDay: rate };

  const days = Math.ceil(remaining / rate);
  if (days > options.maxHorizonDays) return { kind: "beyond-horizon", rateGPerDay: rate };
  return { kind: "on-track", rateGPerDay: rate, goalDate: fromDayNumber(lastDay + days) };
}

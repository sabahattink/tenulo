import { type LocalDate, toDayNumber } from "./date";

export interface WeightReading {
  readonly date: LocalDate;
  readonly weightG: number;
}

export interface TrendPoint {
  readonly date: LocalDate;
  /** Mean of the readings on this date, rounded to the gram. */
  readonly valueG: number;
  /** Smoothed trend, unrounded so later calculations do not accumulate rounding error. */
  readonly trendG: number;
}

/** Smoothing factor per day. 0.1 is the classic "Hacker's Diet" value: roughly a 10-day memory. */
export const DEFAULT_ALPHA = 0.1;

/**
 * Collapses several readings on one date into their mean, sorted by date.
 * Input order does not matter, so the result is the same however the rows were queried.
 */
export function dailyValues(readings: readonly WeightReading[]): { date: LocalDate; valueG: number }[] {
  const byDate = new Map<LocalDate, { sum: number; count: number }>();
  for (const r of readings) {
    const acc = byDate.get(r.date) ?? { sum: 0, count: 0 };
    acc.sum += r.weightG;
    acc.count += 1;
    byDate.set(r.date, acc);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => toDayNumber(a) - toDayNumber(b))
    .map(([date, { sum, count }]) => ({ date, valueG: Math.round(sum / count) }));
}

/**
 * Exponential moving average over days, not over readings.
 *
 * A gap of Δ days is treated as Δ steps of decay, so the effective smoothing factor is
 * `1 - (1 - α)^Δ`. Missing a week of weigh-ins therefore lets the next reading pull the trend
 * further, exactly as if the user had kept weighing in at that level.
 */
export function smoothedTrend(
  readings: readonly WeightReading[],
  alpha: number = DEFAULT_ALPHA,
): TrendPoint[] {
  if (!(alpha > 0 && alpha <= 1)) throw new RangeError(`alpha must be in (0, 1]: ${alpha}`);
  const days = dailyValues(readings);
  const points: TrendPoint[] = [];
  let previous: { day: number; trendG: number } | undefined;

  for (const { date, valueG } of days) {
    const day = toDayNumber(date);
    let trendG: number;
    if (previous === undefined) {
      trendG = valueG;
    } else {
      const gap = day - previous.day;
      const effective = 1 - (1 - alpha) ** gap;
      trendG = previous.trendG + effective * (valueG - previous.trendG);
    }
    points.push({ date, valueG, trendG });
    previous = { day, trendG };
  }
  return points;
}

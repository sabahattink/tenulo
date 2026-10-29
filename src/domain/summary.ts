import { type LocalDate, diffDays } from "./date";
import { type Forecast, forecast } from "./forecast";
import { type TrendPoint, type WeightReading, smoothedTrend } from "./trend";

export interface WeightSummary {
  readonly trend: readonly TrendPoint[];
  /** Latest smoothed value, rounded to the gram. */
  readonly currentTrendG: number;
  /** Most recent day's measured value. */
  readonly latestG: number;
  readonly latestDate: LocalDate;
  /** Days since the last weigh-in, from `today`. 0 means weighed in today. */
  readonly daysSinceLatest: number;
  /** Change of the smoothed trend over the last 7 days, or undefined with under a week of data. */
  readonly weekChangeG: number | undefined;
  /** Trend change since the very first reading. */
  readonly totalChangeG: number;
  readonly forecast: Forecast;
}

/** Everything the home screen shows, computed in one place. Returns undefined with no data. */
export function summarizeWeights(
  readings: readonly WeightReading[],
  goalG: number | null,
  today: LocalDate,
): WeightSummary | undefined {
  const trend = smoothedTrend(readings);
  const first = trend[0];
  const last = trend.at(-1);
  if (first === undefined || last === undefined) return undefined;

  // The closest reading at least a week back; if the nearest one is more than 10 days back the
  // difference is no longer "this week" and is not reported.
  const weekAgo = [...trend].reverse().find((p) => diffDays(p.date, last.date) >= 7);
  const weekChangeG =
    weekAgo !== undefined && diffDays(weekAgo.date, last.date) <= 10
      ? Math.round(last.trendG - weekAgo.trendG)
      : undefined;

  return {
    trend,
    currentTrendG: Math.round(last.trendG),
    latestG: last.valueG,
    latestDate: last.date,
    daysSinceLatest: diffDays(last.date, today),
    weekChangeG,
    totalChangeG: Math.round(last.trendG - first.trendG),
    forecast: forecast(trend, goalG),
  };
}

/**
 * How much of the way from the first trend value to the goal the trend has come, 0 to 1.
 * Undefined without a goal, or when the goal is where the trend started.
 */
export function goalProgress(startG: number, currentG: number, goalG: number | null): number | undefined {
  if (goalG === null || startG === goalG) return undefined;
  const fraction = (startG - currentG) / (startG - goalG);
  return Math.min(1, Math.max(0, fraction));
}

import { type LocalDate, toDayNumber } from "../domain/date";
import type { TrendPoint } from "../domain/trend";
import { GRAMS_PER_POUND, type WeightUnit, fromGrams } from "../domain/weight";

export interface ChartBox {
  readonly width: number;
  readonly height: number;
  readonly padLeft: number;
  readonly padRight: number;
  readonly padTop: number;
  readonly padBottom: number;
}

export interface ChartGeometry {
  /** SVG path for the smoothed trend line, or "" with fewer than two points. */
  readonly trendPath: string;
  /** The trend line's vertices, oldest first. */
  readonly trendPoints: readonly { x: number; y: number }[];
  readonly readings: readonly { x: number; y: number; date: LocalDate }[];
  readonly ticks: readonly { y: number; valueG: number }[];
  /** Decimals for tick labels in the chart's unit: 0 for whole-unit steps, 1 below that. */
  readonly tickDecimals: 0 | 1;
  /** Y of the goal line, only when the goal lies within the plotted range. */
  readonly goalY: number | undefined;
  readonly first: LocalDate;
  readonly last: LocalDate;
}

/** The smallest tick step, in the unit the person weighs in: 0.1 kg or 0.1 lb. */
const MIN_STEP_UNITS = 0.1;

/**
 * Chooses a tick step giving about `target` ticks across `span`, round in the unit the axis is
 * labelled in (1, 2 or 5 kg; 1, 2 or 5 lb), and returns it in grams. Kilogram steps are whole
 * grams; pound steps are not, and only their labels need to be round.
 */
export function tickStep(spanG: number, target = 4, unit: WeightUnit = "kg"): number {
  const raw = fromGrams(Math.max(spanG, 1), unit) / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max([1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow, MIN_STEP_UNITS);
  return unit === "kg" ? Math.round(step * 1000) : step * GRAMS_PER_POUND;
}

/**
 * Lays out the last `windowDays` of trend data in the box. The y-range covers readings, trend
 * and (if close) the goal, padded to round ticks, so the line never touches the edges.
 */
export function chartGeometry(
  points: readonly TrendPoint[],
  box: ChartBox,
  goalG: number | null,
  windowDays = 90,
  unit: WeightUnit = "kg",
): ChartGeometry | undefined {
  const lastPoint = points.at(-1);
  if (lastPoint === undefined) return undefined;
  const lastDay = toDayNumber(lastPoint.date);
  const visible = points.filter((p) => lastDay - toDayNumber(p.date) < windowDays);
  const firstPoint = visible[0] ?? lastPoint;
  const firstDay = toDayNumber(firstPoint.date);

  const values = visible.flatMap((p) => [p.valueG, p.trendG]);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  // Include the goal only when it is near the data; a far-off goal would flatten the line.
  if (goalG !== null && goalG >= lo - (hi - lo + 2000) && goalG <= hi + (hi - lo + 2000)) {
    lo = Math.min(lo, goalG);
    hi = Math.max(hi, goalG);
  }
  const step = tickStep(hi - lo, 4, unit);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  if (hi === lo) hi = lo + step;

  const innerW = box.width - box.padLeft - box.padRight;
  const innerH = box.height - box.padTop - box.padBottom;
  const spanDays = Math.max(lastDay - firstDay, 1);
  const x = (day: number) => box.padLeft + ((day - firstDay) / spanDays) * innerW;
  const y = (g: number) => box.padTop + (1 - (g - lo) / (hi - lo)) * innerH;
  const r = (n: number) => Math.round(n * 10) / 10;

  const trendPoints = visible.map((p) => ({ x: r(x(toDayNumber(p.date))), y: r(y(p.trendG)) }));
  const trendPath =
    trendPoints.length < 2 ? "" : trendPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  // Counted, not accumulated: adding a fractional pound step again and again would drift.
  const ticks: { y: number; valueG: number }[] = [];
  const count = Math.round((hi - lo) / step);
  for (let i = 0; i <= count; i++) {
    const v = lo + i * step;
    ticks.push({ y: r(y(v)), valueG: v });
  }

  return {
    trendPath,
    trendPoints,
    readings: visible.map((p) => ({ x: r(x(toDayNumber(p.date))), y: r(y(p.valueG)), date: p.date })),
    ticks,
    // From the step itself, with a tolerance: a pound step in grams is not exact, and the
    // difference of two ticks can fall an ulp short of 1 lb.
    tickDecimals: fromGrams(step, unit) >= 1 - 1e-9 ? 0 : 1,
    goalY: goalG !== null && goalG >= lo && goalG <= hi ? r(y(goalG)) : undefined,
    first: firstPoint.date,
    last: lastPoint.date,
  };
}

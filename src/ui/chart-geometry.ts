import { type LocalDate, toDayNumber } from "../domain/date";
import type { TrendPoint } from "../domain/trend";

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
  readonly readings: readonly { x: number; y: number; date: LocalDate }[];
  readonly ticks: readonly { y: number; valueG: number }[];
  /** Y of the goal line, only when the goal lies within the plotted range. */
  readonly goalY: number | undefined;
  readonly first: LocalDate;
  readonly last: LocalDate;
}

/** Chooses a round tick step (in grams) giving about `target` ticks across `span`. */
export function tickStep(spanG: number, target = 4): number {
  const raw = Math.max(spanG, 1) / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  return Math.max(step, 100);
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
  const step = tickStep(hi - lo);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  if (hi === lo) hi = lo + step;

  const innerW = box.width - box.padLeft - box.padRight;
  const innerH = box.height - box.padTop - box.padBottom;
  const spanDays = Math.max(lastDay - firstDay, 1);
  const x = (day: number) => box.padLeft + ((day - firstDay) / spanDays) * innerW;
  const y = (g: number) => box.padTop + (1 - (g - lo) / (hi - lo)) * innerH;
  const r = (n: number) => Math.round(n * 10) / 10;

  const trendPath =
    visible.length < 2
      ? ""
      : visible
          .map((p, i) => `${i === 0 ? "M" : "L"}${r(x(toDayNumber(p.date)))},${r(y(p.trendG))}`)
          .join(" ");

  const ticks: { y: number; valueG: number }[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push({ y: r(y(v)), valueG: v });

  return {
    trendPath,
    readings: visible.map((p) => ({ x: r(x(toDayNumber(p.date))), y: r(y(p.valueG)), date: p.date })),
    ticks,
    goalY: goalG !== null && goalG >= lo && goalG <= hi ? r(y(goalG)) : undefined,
    first: firstPoint.date,
    last: lastPoint.date,
  };
}

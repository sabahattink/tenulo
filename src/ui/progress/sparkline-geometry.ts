/**
 * A small line of one measured site over time, laid out like the weight chart (chart-geometry.ts):
 * days along x, values on y, inside a padded box. No axes or ticks; the card states the numbers.
 */
import { type LocalDate, toDayNumber } from "../../domain/date";
import type { ChartBox } from "../chart-geometry";

export interface SparkPoint {
  readonly date: LocalDate;
  readonly value: number;
}

export interface Sparkline {
  /** SVG path through the points, or "" with fewer than two days. */
  readonly path: string;
  /** One vertex per day, oldest first. */
  readonly points: readonly { readonly x: number; readonly y: number }[];
}

const r = (n: number) => Math.round(n * 10) / 10;

/**
 * One point per day, placed by date. `points` come oldest first (as siteSummaries gives them), so a
 * day measured twice keeps its later reading. A flat series sits on the middle line; a single day is
 * one point at the right edge, where the latest value belongs.
 */
export function sparkline(points: readonly SparkPoint[], box: ChartBox): Sparkline | undefined {
  const byDay = new Map<number, number>();
  for (const p of points) byDay.set(toDayNumber(p.date), p.value);
  const days = [...byDay.entries()].sort(([a], [b]) => a - b);
  const first = days[0];
  const last = days.at(-1);
  if (first === undefined || last === undefined) return undefined;

  const values = days.map(([, v]) => v);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const innerW = box.width - box.padLeft - box.padRight;
  const innerH = box.height - box.padTop - box.padBottom;
  const spanDays = last[0] - first[0];
  const x = (day: number) => (spanDays === 0 ? box.padLeft + innerW : box.padLeft + ((day - first[0]) / spanDays) * innerW);
  const y = (v: number) => (hi === lo ? box.padTop + innerH / 2 : box.padTop + (1 - (v - lo) / (hi - lo)) * innerH);

  const vertices = days.map(([day, v]) => ({ x: r(x(day)), y: r(y(v)) }));
  const path = vertices.length < 2 ? "" : vertices.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  return { path, points: vertices };
}

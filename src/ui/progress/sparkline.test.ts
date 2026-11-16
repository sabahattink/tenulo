import { describe, expect, it } from "vitest";
import { parseLocalDate as d } from "../../domain/date";
import type { ChartBox } from "../chart-geometry";
import { sparkline } from "./sparkline";

const box: ChartBox = { width: 120, height: 40, padLeft: 4, padRight: 4, padTop: 4, padBottom: 4 };

describe("sparkline", () => {
  it("has nothing to draw without readings", () => {
    expect(sparkline([], box)).toBeUndefined();
  });

  it("puts a single reading at the right edge, on the middle line, without a path", () => {
    expect(sparkline([{ date: d("2026-11-01"), value: 925 }], box)).toEqual({ path: "", points: [{ x: 116, y: 20 }] });
  });

  it("spans the box from the first to the last day, highest value at the top", () => {
    const s = sparkline(
      [
        { date: d("2026-11-01"), value: 1000 },
        { date: d("2026-11-05"), value: 980 },
        { date: d("2026-11-11"), value: 960 },
      ],
      box,
    );
    expect(s?.points).toEqual([
      { x: 4, y: 4 },
      { x: 48.8, y: 20 },
      { x: 116, y: 36 },
    ]);
    expect(s?.path).toBe("M4,4 L48.8,20 L116,36");
  });

  it("places points by date, so a long gap looks long", () => {
    const s = sparkline(
      [
        { date: d("2026-11-01"), value: 10 },
        { date: d("2026-11-02"), value: 20 },
        { date: d("2026-11-11"), value: 30 },
      ],
      box,
    );
    expect(s?.points.map((p) => p.x)).toEqual([4, 15.2, 116]);
  });

  it("keeps the latest reading of a day and draws a flat series on the middle line", () => {
    const s = sparkline(
      [
        { date: d("2026-11-01"), value: 900 },
        { date: d("2026-11-01"), value: 920 },
        { date: d("2026-11-08"), value: 920 },
      ],
      box,
    );
    expect(s?.points).toEqual([
      { x: 4, y: 20 },
      { x: 116, y: 20 },
    ]);
  });

  it("orders readings by date whatever order they come in", () => {
    const s = sparkline(
      [
        { date: d("2026-11-08"), value: 2 },
        { date: d("2026-11-01"), value: 1 },
      ],
      box,
    );
    expect(s?.points).toEqual([
      { x: 4, y: 36 },
      { x: 116, y: 4 },
    ]);
  });
});

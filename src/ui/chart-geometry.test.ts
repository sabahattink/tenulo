import { describe, expect, it } from "vitest";
import { addDays, parseLocalDate } from "../domain/date";
import { smoothedTrend } from "../domain/trend";
import { GRAMS_PER_POUND, fromGrams } from "../domain/weight";
import { type ChartBox, chartGeometry, tickStep } from "./chart-geometry";

const box: ChartBox = { width: 340, height: 200, padLeft: 40, padRight: 10, padTop: 10, padBottom: 20 };
const start = parseLocalDate("2026-08-01");
const trendOf = (n: number, f: (i: number) => number) =>
  smoothedTrend(Array.from({ length: n }, (_, i) => ({ date: addDays(start, i), weightG: f(i) })));

describe("tickStep", () => {
  it("picks round steps and never below 100 g", () => {
    expect(tickStep(4_000)).toBe(1_000);
    expect(tickStep(9_000)).toBe(5_000);
    expect(tickStep(1_500)).toBe(500);
    expect(tickStep(0)).toBe(100);
  });

  it("steps in round pounds when the unit is pounds", () => {
    expect(tickStep(20 * GRAMS_PER_POUND, 4, "lb")).toBeCloseTo(5 * GRAMS_PER_POUND, 6);
    expect(tickStep(3 * GRAMS_PER_POUND, 4, "lb")).toBeCloseTo(1 * GRAMS_PER_POUND, 6);
    expect(tickStep(4_000, 4, "kg")).toBe(1_000);
  });
});

describe("chartGeometry", () => {
  it("returns undefined without data and draws no line for a single point", () => {
    expect(chartGeometry([], box, null)).toBeUndefined();
    const one = chartGeometry(trendOf(1, () => 80_000), box, null);
    expect(one?.trendPath).toBe("");
    expect(one?.readings).toHaveLength(1);
  });

  it("keeps every point inside the plot area", () => {
    const g = chartGeometry(trendOf(40, (i) => 90_000 - i * 120 + (i % 3) * 400), box, 80_000);
    expect(g).toBeDefined();
    for (const p of g?.readings ?? []) {
      expect(p.x).toBeGreaterThanOrEqual(box.padLeft);
      expect(p.x).toBeLessThanOrEqual(box.width - box.padRight);
      expect(p.y).toBeGreaterThanOrEqual(box.padTop);
      expect(p.y).toBeLessThanOrEqual(box.height - box.padBottom);
    }
    expect(g?.trendPath.startsWith(`M${box.padLeft},`)).toBe(true);
  });

  it("shows a nearby goal but not a distant one", () => {
    const near = chartGeometry(trendOf(20, (i) => 90_000 - i * 100), box, 85_000);
    expect(near?.goalY).toBeDefined();
    const far = chartGeometry(trendOf(20, (i) => 90_000 - i * 100), box, 40_000);
    expect(far?.goalY).toBeUndefined();
  });

  it("only plots the most recent window", () => {
    const g = chartGeometry(trendOf(200, () => 80_000), box, null, 90);
    expect(g?.readings).toHaveLength(90);
    expect(g?.first).toBe(addDays(start, 110));
    expect(g?.last).toBe(addDays(start, 199));
  });

  it("puts ticks on round pounds for people who weigh in pounds", () => {
    // About 203 lb down to 187 lb, the goal: round kilograms would label the axis 220, 209, 198…
    const g = chartGeometry(trendOf(60, (i) => 92_000 - i * 70), box, 85_000, 90, "lb");
    const pounds = g?.ticks.map((t) => fromGrams(t.valueG, "lb")) ?? [];
    expect(pounds.length).toBeGreaterThanOrEqual(2);
    for (const lb of pounds) expect(Math.abs(lb - Math.round(lb / 5) * 5)).toBeLessThan(1e-6);
  });

  it("labels a whole-pound step without decimals, despite floating-point grams", () => {
    // A 911 g span near 60 kg steps by exactly 1 lb, whose grams are not whole.
    const g = chartGeometry(trendOf(2, (i) => 60_000 + i * 911), box, null, 90, "lb");
    expect(fromGrams((g?.ticks[1]?.valueG ?? 0) - (g?.ticks[0]?.valueG ?? 0), "lb")).toBeCloseTo(1, 9);
    expect(g?.tickDecimals).toBe(0);
  });

  it("labels sub-unit steps with one decimal", () => {
    const g = chartGeometry(trendOf(2, (i) => 60_000 + i * 900), box, null, 90, "kg");
    expect(g?.tickDecimals).toBe(1);
  });

  it("keeps kilogram ticks on whole grams", () => {
    const g = chartGeometry(trendOf(60, (i) => 92_000 - i * 70), box, 85_000, 90, "kg");
    for (const t of g?.ticks ?? []) expect(Number.isInteger(t.valueG)).toBe(true);
  });

  it("orders ticks from bottom value upward with round values", () => {
    const g = chartGeometry(trendOf(30, (i) => 90_000 - i * 100), box, null);
    const values = g?.ticks.map((t) => t.valueG) ?? [];
    expect(values.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < values.length; i++) expect((values[i] ?? 0) > (values[i - 1] ?? 0)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { cycleProgress } from "./injection";
import { goalProgress } from "./summary";

describe("goalProgress", () => {
  it("measures the way from start to goal, in either direction", () => {
    expect(goalProgress(100_000, 95_000, 80_000)).toBeCloseTo(0.25, 9);
    expect(goalProgress(60_000, 63_000, 66_000)).toBeCloseTo(0.5, 9);
  });

  it("clamps overshoot and moving away", () => {
    expect(goalProgress(100_000, 78_000, 80_000)).toBe(1);
    expect(goalProgress(100_000, 102_000, 80_000)).toBe(0);
  });

  it("is undefined without a goal or with a goal at the start", () => {
    expect(goalProgress(100_000, 95_000, null)).toBeUndefined();
    expect(goalProgress(80_000, 80_000, 80_000)).toBeUndefined();
  });
});

describe("cycleProgress", () => {
  it("counts the day within a weekly interval", () => {
    expect(cycleProgress(6, 7)).toEqual({ day: 1, fraction: 1 / 7 });
    expect(cycleProgress(2, 7)).toEqual({ day: 5, fraction: 5 / 7 });
  });

  it("is full on the due day and when overdue", () => {
    expect(cycleProgress(0, 7)).toEqual({ day: 7, fraction: 1 });
    expect(cycleProgress(-3, 7)).toEqual({ day: 7, fraction: 1 });
  });

  it("stays in range for a shot logged ahead of time", () => {
    expect(cycleProgress(9, 7)).toEqual({ day: 1, fraction: 0 });
  });
});

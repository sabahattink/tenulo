import { describe, expect, it } from "vitest";
import { parseLocalDate as d } from "./date";
import { averageOverLoggedDays, direction, exerciseTotals, inWindow, weekWindows, weeklyComparison } from "./weekly";

const today = d("2026-11-17");

describe("weekWindows", () => {
  it("ends the current week today and puts the previous seven days right before it", () => {
    expect(weekWindows(today)).toEqual({
      current: { from: "2026-11-11", to: "2026-11-17" },
      previous: { from: "2026-11-04", to: "2026-11-10" },
    });
  });

  it("crosses month and year boundaries by calendar days", () => {
    expect(weekWindows(d("2027-01-03")).previous).toEqual({ from: "2026-12-21", to: "2026-12-27" });
  });
});

describe("inWindow", () => {
  it("includes both ends", () => {
    const w = { from: d("2026-11-11"), to: d("2026-11-17") };
    expect(inWindow(d("2026-11-11"), w)).toBe(true);
    expect(inWindow(d("2026-11-17"), w)).toBe(true);
    expect(inWindow(d("2026-11-10"), w)).toBe(false);
    expect(inWindow(d("2026-11-18"), w)).toBe(false);
  });
});

describe("averageOverLoggedDays", () => {
  const w = { from: d("2026-11-11"), to: d("2026-11-17") };

  it("divides by the days that have a value, not by seven", () => {
    const r = averageOverLoggedDays(
      [
        { date: d("2026-11-12"), value: 1500 },
        { date: d("2026-11-15"), value: 1800 },
      ],
      w,
    );
    expect(r).toEqual({ perDay: 1650, daysLogged: 2 });
  });

  it("adds several rows of one day together and ignores days outside the window", () => {
    const r = averageOverLoggedDays(
      [
        { date: d("2026-11-12"), value: 250 },
        { date: d("2026-11-12"), value: 500 },
        { date: d("2026-11-10"), value: 9000 },
      ],
      w,
    );
    expect(r).toEqual({ perDay: 750, daysLogged: 1 });
  });

  it("rounds to a whole unit after dividing", () => {
    const r = averageOverLoggedDays(
      [
        { date: d("2026-11-12"), value: 81_400 },
        { date: d("2026-11-13"), value: 82_700 },
      ],
      w,
      1000,
    );
    expect(r).toEqual({ perDay: 82, daysLogged: 2 });
  });

  it("has no average without a logged day", () => {
    expect(averageOverLoggedDays([], w)).toEqual({ perDay: undefined, daysLogged: 0 });
  });
});

describe("exerciseTotals", () => {
  it("counts sessions and minutes inside the window", () => {
    const w = { from: d("2026-11-11"), to: d("2026-11-17") };
    expect(
      exerciseTotals(
        [
          { date: d("2026-11-11"), durationMin: 30 },
          { date: d("2026-11-11"), durationMin: 20 },
          { date: d("2026-11-17"), durationMin: 45 },
          { date: d("2026-11-03"), durationMin: 60 },
        ],
        w,
      ),
    ).toEqual({ sessions: 3, minutes: 95 });
    expect(exerciseTotals([], w)).toEqual({ sessions: 0, minutes: 0 });
  });
});

describe("direction", () => {
  it("says which way a number moved, and nothing more", () => {
    expect(direction(1700, 1600)).toBe("higher");
    expect(direction(1500, 1600)).toBe("lower");
    expect(direction(1600, 1600)).toBe("same");
  });

  it("has nothing to compare when a side is missing", () => {
    expect(direction(undefined, 1600)).toBeUndefined();
    expect(direction(1600, undefined)).toBeUndefined();
  });
});

describe("weeklyComparison", () => {
  it("compares the last seven days with the seven before for every kind", () => {
    const r = weeklyComparison({
      today,
      food: [
        { date: d("2026-11-17"), energyKcal: 1200, proteinMg: 60_000 },
        { date: d("2026-11-16"), energyKcal: 1800, proteinMg: 90_000 },
        { date: d("2026-11-08"), energyKcal: 2000, proteinMg: 70_400 },
      ],
      water: [
        { date: d("2026-11-16"), amountMl: 1500 },
        { date: d("2026-11-05"), amountMl: 2000 },
        { date: d("2026-11-04"), amountMl: 1000 },
      ],
      exercise: [
        { date: d("2026-11-14"), durationMin: 40 },
        { date: d("2026-11-09"), durationMin: 25 },
      ],
    });
    expect(r.current).toEqual({ from: "2026-11-11", to: "2026-11-17" });
    expect(r.energyKcal).toEqual({ current: { perDay: 1500, daysLogged: 2 }, previous: { perDay: 2000, daysLogged: 1 } });
    expect(r.proteinG).toEqual({ current: { perDay: 75, daysLogged: 2 }, previous: { perDay: 70, daysLogged: 1 } });
    expect(r.waterMl).toEqual({ current: { perDay: 1500, daysLogged: 1 }, previous: { perDay: 1500, daysLogged: 2 } });
    expect(r.exercise).toEqual({ current: { sessions: 1, minutes: 40 }, previous: { sessions: 1, minutes: 25 } });
  });
});

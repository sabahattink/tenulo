import { describe, expect, it } from "vitest";
import { parseLocalDate as d } from "./date";
import { type PlanStep, daysUntilDue, leastRecentSite, nextDueDate, planPosition } from "./injection";

describe("leastRecentSite", () => {
  it("starts with the first site when nothing is logged", () => {
    expect(leastRecentSite([])).toBe("abdomen-left");
  });

  it("prefers never-used sites, then the oldest", () => {
    const history = [
      { date: d("2026-09-01"), site: "abdomen-left" as const },
      { date: d("2026-09-08"), site: "abdomen-right" as const },
    ];
    expect(leastRecentSite(history)).toBe("thigh-left");
    expect(leastRecentSite(history, ["abdomen-left", "abdomen-right"])).toBe("abdomen-left");
  });

  it("uses the latest date per site regardless of input order", () => {
    const history = [
      { date: d("2026-09-15"), site: "abdomen-left" as const },
      { date: d("2026-09-08"), site: "abdomen-right" as const },
      { date: d("2026-09-01"), site: "abdomen-left" as const },
    ];
    expect(leastRecentSite(history, ["abdomen-left", "abdomen-right"])).toBe("abdomen-right");
  });

  it("returns undefined when every site is excluded", () => {
    expect(leastRecentSite([], [])).toBeUndefined();
  });
});

describe("planPosition", () => {
  const plan: PlanStep[] = [
    { startDate: d("2026-10-26"), doseMcg: 500, intervalDays: 7 },
    { startDate: d("2026-09-28"), doseMcg: 250, intervalDays: 7 },
  ];

  it("is undefined before the plan starts", () => {
    expect(planPosition(plan, d("2026-09-27"))).toBeUndefined();
  });

  it("reports the user's own step and week, with the next step date", () => {
    const p = planPosition(plan, d("2026-10-18"));
    expect(p?.step.doseMcg).toBe(250);
    expect(p?.stepIndex).toBe(0);
    expect(p?.period).toBe(3);
    expect(p?.nextStepDate).toBe("2026-10-26");
  });

  it("moves to the next step on its start date", () => {
    const p = planPosition(plan, d("2026-10-26"));
    expect(p?.step.doseMcg).toBe(500);
    expect(p?.period).toBe(1);
    expect(p?.nextStepDate).toBeUndefined();
  });

  it("rejects a non-positive interval", () => {
    expect(() => planPosition([{ startDate: d("2026-01-01"), doseMcg: 1, intervalDays: 0 }], d("2026-01-02"))).toThrow(
      RangeError,
    );
  });
});

describe("due dates", () => {
  it("counts from the last logged injection", () => {
    expect(nextDueDate(d("2026-10-12"), 7)).toBe("2026-10-19");
    expect(daysUntilDue(d("2026-10-12"), 7, d("2026-10-18"))).toBe(1);
    expect(daysUntilDue(d("2026-10-12"), 7, d("2026-10-19"))).toBe(0);
    expect(daysUntilDue(d("2026-10-12"), 7, d("2026-10-21"))).toBe(-2);
  });
});

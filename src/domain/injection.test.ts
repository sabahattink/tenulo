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

describe("injectionStatus", () => {
  it("is empty before the first shot", async () => {
    const { injectionStatus } = await import("./injection");
    const s = injectionStatus([], [], d("2026-10-19"));
    expect(s.lastDate).toBeUndefined();
    expect(s.nextDue).toBeUndefined();
    expect(s.intervalDays).toBe(7);
    expect(s.suggestedSite).toBe("abdomen-left");
  });

  it("uses the plan's interval and dose, and ignores input order", async () => {
    const { injectionStatus } = await import("./injection");
    const s = injectionStatus(
      [
        { date: d("2026-10-12"), site: "abdomen-right", doseMcg: 250 },
        { date: d("2026-10-05"), site: "abdomen-left", doseMcg: 250 },
      ],
      [
        { startDate: d("2026-10-05"), doseMcg: 250, intervalDays: 7 },
        { startDate: d("2026-10-19"), doseMcg: 500, intervalDays: 7 },
      ],
      d("2026-10-19"),
    );
    expect(s.lastDate).toBe("2026-10-12");
    expect(s.lastSite).toBe("abdomen-right");
    expect(s.nextDue).toBe("2026-10-19");
    expect(s.daysUntilDue).toBe(0);
    expect(s.expectedDoseMcg).toBe(500);
    expect(s.plan?.period).toBe(1);
    expect(s.suggestedSite).toBe("thigh-left");
  });

  it("falls back to the last logged dose without a plan, and reports overdue", async () => {
    const { injectionStatus } = await import("./injection");
    const s = injectionStatus([{ date: d("2026-10-01"), site: null, doseMcg: 2500 }], [], d("2026-10-19"));
    expect(s.expectedDoseMcg).toBe(2500);
    expect(s.daysUntilDue).toBe(-11);
    expect(s.lastSite).toBeUndefined();
  });
});

describe("parseDoseInput", () => {
  it("parses mg with comma or dot into integer micrograms", async () => {
    const { parseDoseInput, formatDose } = await import("./parse");
    expect(parseDoseInput("0,25")).toEqual({ ok: true, mcg: 250 });
    expect(parseDoseInput("2.5")).toEqual({ ok: true, mcg: 2500 });
    expect(parseDoseInput("15")).toEqual({ ok: true, mcg: 15_000 });
    expect(parseDoseInput("")).toEqual({ ok: false, reason: "empty" });
    expect(parseDoseInput("abc")).toEqual({ ok: false, reason: "not-a-number" });
    expect(parseDoseInput("0")).toEqual({ ok: false, reason: "out-of-range" });
    expect(parseDoseInput("99")).toEqual({ ok: false, reason: "out-of-range" });
    expect(formatDose(250)).toBe("0.25 mg");
    expect(formatDose(15_000)).toBe("15 mg");
  });
});

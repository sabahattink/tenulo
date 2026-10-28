import { describe, expect, it } from "vitest";
import { addDays, parseLocalDate as d } from "./date";
import { type ReportInput, buildReport, reportStart } from "./report";

const to = d("2026-10-29");
const base: ReportInput = {
  from: d("2026-09-30"),
  to,
  weights: [],
  medicationName: undefined,
  planSteps: [],
  injections: [],
  sideEffects: [],
};

describe("reportStart", () => {
  it("counts the period back from the end date, inclusive", () => {
    expect(reportStart(30, to, undefined)).toBe("2026-09-30");
    expect(reportStart(90, to, undefined)).toBe(addDays(to, -89));
  });

  it("starts at the first record for 'all', and never after the end", () => {
    expect(reportStart("all", to, d("2026-03-01"))).toBe("2026-03-01");
    expect(reportStart("all", to, undefined)).toBe(to);
  });
});

describe("buildReport", () => {
  it("is empty but valid without any records", () => {
    const r = buildReport(base);
    expect(r.days).toBe(30);
    expect(r.weight).toBeUndefined();
    expect(r.injections.count).toBe(0);
    expect(r.injections.gaps).toBeUndefined();
    expect(r.sideEffects.total).toBe(0);
  });

  it("summarizes weight inside the period, using earlier readings only for the trend", () => {
    const weights = Array.from({ length: 60 }, (_, i) => ({ date: addDays(d("2026-08-31"), i), weightG: 100_000 - i * 100 }));
    const r = buildReport({ ...base, weights });
    expect(r.weight?.firstDate).toBe("2026-09-30");
    expect(r.weight?.lastDate).toBe("2026-10-29");
    expect(r.weight?.weighIns).toBe(30);
    expect(r.weight?.lowestG).toBe(94_100);
    expect(r.weight?.highestG).toBe(97_000);
    expect(r.weight?.changeG).toBeLessThan(0);
    // The trend already carried 30 days of history into the period, so it starts near the readings.
    expect(Math.abs((r.weight?.startTrendG ?? 0) - 97_000)).toBeLessThan(1_500);
    expect(r.weight?.perWeekG).toBeCloseTo(-700, -2);
    expect(r.weight?.trend.every((p) => p.date >= "2026-09-30")).toBe(true);
  });

  it("omits a weekly rate over less than two weeks of readings", () => {
    const weights = [0, 3, 6, 9].map((i) => ({ date: addDays(d("2026-10-15"), i), weightG: 90_000 - i * 100 }));
    expect(buildReport({ ...base, weights }).weight?.perWeekG).toBeUndefined();
  });

  it("lists injections in date order with the gaps between them", () => {
    const r = buildReport({
      ...base,
      injections: [
        { date: d("2026-10-14"), doseMcg: 500, site: "thigh-left" },
        { date: d("2026-09-01"), doseMcg: 250, site: null },
        { date: d("2026-10-01"), doseMcg: 250, site: "abdomen-left" },
        { date: d("2026-10-07"), doseMcg: 250, site: "abdomen-left" },
      ],
    });
    expect(r.injections.rows.map((i) => i.date)).toEqual(["2026-10-01", "2026-10-07", "2026-10-14"]);
    expect(r.injections.gaps).toEqual({ minDays: 6, maxDays: 7, meanDays: 6.5 });
    expect(r.injections.sites).toEqual([
      { site: "abdomen-left", count: 2 },
      { site: "thigh-left", count: 1 },
    ]);
  });

  it("groups side effects by type, most frequent first, with the strongest rating", () => {
    const r = buildReport({
      ...base,
      sideEffects: [
        { date: d("2026-10-02"), type: "nausea", severity: 1, note: null },
        { date: d("2026-10-09"), type: "headache", severity: 2, note: "evening" },
        { date: d("2026-10-03"), type: "nausea", severity: 3, note: null },
        { date: d("2026-08-01"), type: "fatigue", severity: 3, note: null },
      ],
    });
    expect(r.sideEffects.total).toBe(3);
    expect(r.sideEffects.byType).toEqual([
      { type: "nausea", count: 2, strongest: 3 },
      { type: "headache", count: 1, strongest: 2 },
    ]);
    expect(r.sideEffects.rows[0]?.date).toBe("2026-10-02");
  });

  it("shows plan steps that had started by the end of the period", () => {
    const r = buildReport({
      ...base,
      medicationName: "My pen",
      planSteps: [
        { startDate: d("2026-11-05"), doseMcg: 1_000, intervalDays: 7 },
        { startDate: d("2026-09-01"), doseMcg: 250, intervalDays: 7 },
        { startDate: d("2026-10-01"), doseMcg: 500, intervalDays: 7 },
      ],
    });
    expect(r.planSteps.map((s) => s.doseMcg)).toEqual([250, 500]);
    expect(r.medicationName).toBe("My pen");
  });
});

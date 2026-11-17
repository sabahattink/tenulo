import { describe, expect, it } from "vitest";
import { i18nFor } from "../i18n";
import { type TimelineData, timelineRows } from "./timeline-rows";

const en = i18nFor("en");
const tr = i18nFor("tr");

const data: TimelineData = {
  weights: [{ id: "w1", localDate: "2026-11-10", measuredAt: 1, weightG: 80_000, source: "manual" }],
  injections: [{ id: "i1", localDate: "2026-11-10", takenAt: 2, doseMcg: 2_500, site: null, note: null }],
  sideEffects: [{ id: "s1", localDate: "2026-11-11", createdAt: 3, type: "nausea", severity: 2, note: "evening" }],
  food: [
    { localDate: "2026-11-16", meal: "lunch", foods: 1, loggedAt: 10, energyKcal: 300 },
    { localDate: "2026-11-16", meal: "lunch", foods: 1, loggedAt: 11, energyKcal: 240 },
    { localDate: "2026-11-16", meal: "lunch", foods: 1, loggedAt: 12, energyKcal: 1100 },
  ],
  water: [
    { id: "a", localDate: "2026-11-16", loggedAt: 20, amountMl: 1000 },
    { id: "b", localDate: "2026-11-16", loggedAt: 21, amountMl: 750 },
  ],
  measurements: [
    { id: "m1", localDate: "2026-11-15", measuredAt: 30, site: "hip", lengthMm: 1040 },
    { id: "m2", localDate: "2026-11-15", measuredAt: 30, site: "waist", lengthMm: 925 },
  ],
  exercise: [
    { id: "x1", localDate: "2026-11-12", loggedAt: 40, kind: "walking", durationMin: 40, intensity: "moderate", energyKcal: null, note: null },
    { id: "x2", localDate: "2026-11-13", loggedAt: 41, kind: "running", durationMin: 25, intensity: "vigorous", energyKcal: 310, note: "park" },
    { id: "x3", localDate: "2026-11-01", loggedAt: 42, kind: "yoga", durationMin: 20, intensity: "light", energyKcal: null, note: null },
  ],
};

const byId = (rows: ReturnType<typeof timelineRows>, id: string) => rows.find((r) => r.id === id);

describe("timelineRows", () => {
  const rows = timelineRows(data, "all", "kg", en);

  it("makes one line per meal that opens the day in the food diary and is not deleted from History", () => {
    const lunch = byId(rows, "2026-11-16|lunch");
    expect(lunch).toMatchObject({ kind: "food", title: "Lunch", detail: "3 foods · 1,640 kcal", icon: "food" });
    expect(lunch?.open).toEqual({ screen: "food", date: "2026-11-16", hint: "Opens this day's food diary" });
    expect(lunch?.remove).toBeUndefined();
  });

  it("makes one line per day of water that opens the day and deletes all of its entries", () => {
    const water = byId(rows, "2026-11-16");
    expect(water).toMatchObject({ kind: "water", title: "Water · 1,750 ml", detail: "2 entries", icon: "glass" });
    expect(water?.open?.screen).toBe("water");
    expect(water?.remove).toEqual({ ids: ["a", "b"], question: "Delete this day's water?" });
  });

  it("lists a measuring sitting in body order and deletes it as a whole", () => {
    const sitting = byId(rows, "2026-11-15|30");
    expect(sitting).toMatchObject({ kind: "measurement", title: "Measurements", detail: "Waist 92.5\u00a0cm · Hip 104\u00a0cm" });
    expect(sitting?.remove?.ids).toEqual(["m2", "m1"]);
    expect(timelineRows(data, "measurement", "lb", en)[0]?.detail).toBe("Waist 36.4\u00a0in · Hip 40.9\u00a0in");
  });

  it("shows exercise energy the user entered as is, and Tenulo's estimate marked as one", () => {
    expect(byId(rows, "x2")).toMatchObject({ title: "Running · 25 min", detail: "Vigorous · 310 kcal · park" });
    // 3.5 MET x 80 kg x 40/60 h, with the weigh-in from before the walk.
    expect(byId(rows, "x1")).toMatchObject({ title: "Walking · 40 min", detail: "Moderate · ≈ 187 kcal (estimate)" });
    // No weigh-in yet on that day: no estimate at all.
    expect(byId(rows, "x3")?.detail).toBe("Light");
  });

  it("keeps the older kinds as they were", () => {
    expect(byId(rows, "w1")).toMatchObject({ title: "80.0 kg", detail: "Weigh-in", tint: "accent", remove: { ids: ["w1"] } });
    expect(byId(rows, "i1")).toMatchObject({ title: "Injection · 2.5 mg", detail: "Site not recorded" });
    expect(byId(rows, "s1")).toMatchObject({ title: "Nausea", detail: "Moderate · evening", tint: "warn" });
  });

  it("builds only the kind a filter asks for", () => {
    expect(new Set(timelineRows(data, "exercise", "kg", en).map((r) => r.kind))).toEqual(new Set(["exercise"]));
    expect(timelineRows(data, "food", "kg", en)).toHaveLength(1);
  });

  it("speaks Turkish, with Turkish numbers", () => {
    const turkish = timelineRows(data, "all", "kg", tr);
    expect(byId(turkish, "2026-11-16|lunch")).toMatchObject({ title: "Öğle yemeği", detail: "3 yiyecek · 1.640 kcal" });
    expect(byId(turkish, "2026-11-16")).toMatchObject({ title: "Su · 1.750 ml", detail: "2 kayıt" });
    expect(byId(turkish, "2026-11-15|30")?.detail).toBe("Bel 92,5\u00a0cm · Kalça 104\u00a0cm");
    expect(byId(turkish, "x1")).toMatchObject({ title: "Yürüyüş · 40 dk", detail: "Orta · ≈ 187 kcal (tahmini)" });
  });
});

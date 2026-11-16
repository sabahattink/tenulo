import { describe, expect, it } from "vitest";
import { parseLocalDate } from "./date";
import { fromMillimetres, lengthUnitFor, parseLengthInput, siteSummaries, toMillimetres } from "./measurement";

describe("length units", () => {
  it("follows the weight unit: centimetres with kilograms, inches with pounds", () => {
    expect(lengthUnitFor("kg")).toBe("cm");
    expect(lengthUnitFor("lb")).toBe("in");
  });

  it("converts to whole millimetres and back", () => {
    expect(toMillimetres(92.5, "cm")).toBe(925);
    expect(toMillimetres(36.4, "in")).toBe(925);
    expect(fromMillimetres(925, "cm")).toBe(92.5);
    expect(fromMillimetres(254, "in")).toBe(10);
  });
});

describe("parseLengthInput", () => {
  it("accepts dot and comma decimals", () => {
    expect(parseLengthInput("92,5", "cm")).toEqual({ ok: true, mm: 925 });
    expect(parseLengthInput(" 92.5 ", "cm")).toEqual({ ok: true, mm: 925 });
    expect(parseLengthInput("36", "in")).toEqual({ ok: true, mm: 914 });
  });

  it("explains why input is rejected", () => {
    expect(parseLengthInput("", "cm")).toEqual({ ok: false, reason: "empty" });
    expect(parseLengthInput("9a", "cm")).toEqual({ ok: false, reason: "not-a-number" });
    expect(parseLengthInput("92,55", "cm")).toEqual({ ok: false, reason: "not-a-number" });
    expect(parseLengthInput("5", "cm")).toEqual({ ok: false, reason: "implausible" });
    expect(parseLengthInput("400", "cm")).toEqual({ ok: false, reason: "implausible" });
  });
});

describe("siteSummaries", () => {
  const d = parseLocalDate;

  it("gives each measured site its latest value and the change since the first", () => {
    const summaries = siteSummaries([
      { site: "waist", date: d("2026-11-01"), measuredAt: 1, lengthMm: 1000 },
      { site: "waist", date: d("2026-11-15"), measuredAt: 3, lengthMm: 975 },
      { site: "waist", date: d("2026-11-08"), measuredAt: 2, lengthMm: 990 },
      { site: "hip", date: d("2026-11-08"), measuredAt: 2, lengthMm: 1100 },
    ]);
    expect(summaries.map((s) => s.site)).toEqual(["waist", "hip"]);
    const waist = summaries[0];
    expect(waist?.latestMm).toBe(975);
    expect(waist?.latestDate).toBe("2026-11-15");
    expect(waist?.changeMm).toBe(-25);
    expect(waist?.points.map((p) => p.lengthMm)).toEqual([1000, 990, 975]);
    expect(summaries[1]?.changeMm).toBeUndefined();
  });

  it("orders same-day readings by when they were taken", () => {
    const [waist] = siteSummaries([
      { site: "waist", date: d("2026-11-15"), measuredAt: 20, lengthMm: 970 },
      { site: "waist", date: d("2026-11-15"), measuredAt: 10, lengthMm: 980 },
    ]);
    expect(waist?.latestMm).toBe(970);
  });
});

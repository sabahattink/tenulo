import { describe, expect, it } from "vitest";
import { addDays, parseLocalDate } from "./date";
import { ULID_PATTERN, encodeTime, ulid } from "./id";
import { parseWeightInput } from "./parse";
import { summarizeWeights } from "./summary";

describe("parseWeightInput", () => {
  it("accepts dot and comma decimals", () => {
    expect(parseWeightInput("82.4", "kg")).toEqual({ ok: true, grams: 82_400 });
    expect(parseWeightInput(" 82,4 ", "kg")).toEqual({ ok: true, grams: 82_400 });
    expect(parseWeightInput("181,7", "lb")).toEqual({ ok: true, grams: 82_418 });
    expect(parseWeightInput("95", "kg")).toEqual({ ok: true, grams: 95_000 });
  });

  it("explains why input is rejected", () => {
    expect(parseWeightInput("", "kg")).toEqual({ ok: false, reason: "empty" });
    expect(parseWeightInput("8a", "kg")).toEqual({ ok: false, reason: "not-a-number" });
    expect(parseWeightInput("1,234.5", "kg")).toEqual({ ok: false, reason: "not-a-number" });
    expect(parseWeightInput("82.456", "kg")).toEqual({ ok: false, reason: "not-a-number" });
    expect(parseWeightInput("-80", "kg")).toEqual({ ok: false, reason: "not-a-number" });
    expect(parseWeightInput("8.2", "kg")).toEqual({ ok: false, reason: "implausible" });
    expect(parseWeightInput("999", "kg")).toEqual({ ok: false, reason: "implausible" });
  });
});

describe("ulid", () => {
  it("is 26 Crockford base32 chars and sorts by time", () => {
    const a = ulid(1_000, () => 0.5);
    const b = ulid(2_000, () => 0.1);
    expect(a).toMatch(ULID_PATTERN);
    expect(a < b).toBe(true);
  });

  it("encodes time exactly", () => {
    expect(encodeTime(0)).toBe("0000000000");
    expect(encodeTime(1_469_918_176_385)).toBe("01ARYZ6S41");
    expect(() => encodeTime(-1)).toThrow(RangeError);
  });

  it("is deterministic with an injected random source", () => {
    expect(ulid(5, () => 0)).toBe(`${encodeTime(5)}0000000000000000`);
  });
});

describe("summarizeWeights", () => {
  const start = parseLocalDate("2026-09-01");
  const daily = (n: number, f: (i: number) => number) =>
    Array.from({ length: n }, (_, i) => ({ date: addDays(start, i), weightG: f(i) }));

  it("returns undefined without readings", () => {
    expect(summarizeWeights([], 80_000, start)).toBeUndefined();
  });

  it("summarizes a steady loss", () => {
    const s = summarizeWeights(daily(30, (i) => 90_000 - i * 100), 80_000, addDays(start, 31));
    expect(s?.latestG).toBe(87_100);
    expect(s?.latestDate).toBe(addDays(start, 29));
    expect(s?.daysSinceLatest).toBe(2);
    expect(s?.weekChangeG).toBeLessThan(0);
    expect(s?.totalChangeG).toBeLessThan(0);
    expect(s?.forecast.kind).toBe("on-track");
  });

  it("omits the weekly change when the previous reading is too far back", () => {
    const readings = [
      { date: start, weightG: 90_000 },
      { date: addDays(start, 30), weightG: 88_000 },
    ];
    expect(summarizeWeights(readings, null, addDays(start, 30))?.weekChangeG).toBeUndefined();
    expect(summarizeWeights(daily(5, () => 90_000), null, addDays(start, 4))?.weekChangeG).toBeUndefined();
  });
});

describe("formatWeightChange", () => {
  it("uses a true minus and hides the sign of a rounded zero", async () => {
    const { formatWeightChange, weightNumber } = await import("./weight");
    expect(formatWeightChange(-600, "kg")).toBe("\u22120.6 kg");
    expect(formatWeightChange(1_200, "kg")).toBe("+1.2 kg");
    expect(formatWeightChange(-30, "kg")).toBe("0.0 kg");
    expect(weightNumber(82_418, "lb")).toBe("181.7");
  });
});

describe("sampleWeights", () => {
  it("is deterministic, ends today and stays plausible", async () => {
    const { sampleWeights } = await import("./sample");
    const { isPlausibleWeight } = await import("./weight");
    const opts = {
      endDate: parseLocalDate("2026-10-19"),
      days: 35,
      startG: 96_000,
      rateGPerDay: -90,
      noiseG: 700,
      skipChance: 0.15,
      seed: 42,
    };
    const a = sampleWeights(opts);
    expect(sampleWeights(opts)).toEqual(a);
    expect(a.at(-1)?.date).toBe("2026-10-19");
    expect(a.length).toBeGreaterThan(20);
    expect(a.length).toBeLessThanOrEqual(35);
    expect(a.every((r) => isPlausibleWeight(r.weightG) && r.weightG % 100 === 0)).toBe(true);
    const s = summarizeWeights(a, 88_000, parseLocalDate("2026-10-19"));
    expect(s?.forecast.kind).toBe("on-track");
  });
});

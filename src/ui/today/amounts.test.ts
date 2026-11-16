import { describe, expect, it } from "vitest";
import { MAX_DURATION_MIN } from "../../domain/exercise";
import {
  DURATION_STEP_MIN,
  WATER_CHIPS_ML,
  formatLitres,
  minuteOfDayAt,
  parseDuration,
  parseOptionalKcal,
  parseWaterMl,
  stepDuration,
} from "./amounts";

describe("formatLitres", () => {
  it("writes litres with the language's decimal mark and no trailing zeros", () => {
    expect(formatLitres(1750, ",")).toBe("1,75");
    expect(formatLitres(1750, ".")).toBe("1.75");
    expect(formatLitres(1500, ",")).toBe("1,5");
    expect(formatLitres(2000, ".")).toBe("2");
    expect(formatLitres(330, ",")).toBe("0,33");
    expect(formatLitres(0, ".")).toBe("0");
  });

  it("rounds to the nearest 10 ml", () => {
    expect(formatLitres(1234, ".")).toBe("1.23");
    expect(formatLitres(1235, ".")).toBe("1.24");
    expect(formatLitres(1996, ".")).toBe("2");
    expect(formatLitres(5, ".")).toBe("0.01");
    expect(formatLitres(4, ".")).toBe("0");
  });

  it("does not group thousands of litres", () => {
    expect(formatLitres(12_340, ",")).toBe("12,34");
  });
});

describe("stepDuration", () => {
  it("moves in five-minute steps", () => {
    expect(DURATION_STEP_MIN).toBe(5);
    expect(stepDuration(30, 1)).toBe(35);
    expect(stepDuration(30, -1)).toBe(25);
  });

  it("snaps a typed odd value to the next step in the direction pressed", () => {
    expect(stepDuration(23, 1)).toBe(25);
    expect(stepDuration(23, -1)).toBe(20);
    expect(stepDuration(7, -1)).toBe(5);
  });

  it("does not go below one step, nor past a day", () => {
    expect(stepDuration(5, -1)).toBe(5);
    expect(stepDuration(10, -1)).toBe(5);
    // A typed value under one step is left alone rather than raised by a "less" tap.
    expect(stepDuration(3, -1)).toBe(3);
    expect(stepDuration(3, 1)).toBe(5);
    expect(stepDuration(1438, 1)).toBe(MAX_DURATION_MIN);
    expect(stepDuration(MAX_DURATION_MIN, 1)).toBe(MAX_DURATION_MIN);
  });
});

describe("parseDuration", () => {
  it("accepts whole minutes within a day", () => {
    expect(parseDuration("45")).toEqual({ ok: true, value: 45 });
    expect(parseDuration(" 1 ")).toEqual({ ok: true, value: 1 });
    expect(parseDuration("1440")).toEqual({ ok: true, value: 1440 });
  });

  it("rejects the rest", () => {
    expect(parseDuration("")).toEqual({ ok: false, reason: "empty" });
    expect(parseDuration("0")).toEqual({ ok: false, reason: "out-of-range" });
    expect(parseDuration("1441")).toEqual({ ok: false, reason: "out-of-range" });
    expect(parseDuration("12,5")).toEqual({ ok: false, reason: "not-a-number" });
  });
});

describe("parseOptionalKcal", () => {
  it("is null when left empty: the screens then show an estimate", () => {
    expect(parseOptionalKcal("")).toEqual({ ok: true, value: null });
    expect(parseOptionalKcal("  ")).toEqual({ ok: true, value: null });
  });

  it("accepts whole kilocalories, zero included", () => {
    expect(parseOptionalKcal("320")).toEqual({ ok: true, value: 320 });
    expect(parseOptionalKcal("0")).toEqual({ ok: true, value: 0 });
    expect(parseOptionalKcal("10000")).toEqual({ ok: true, value: 10_000 });
  });

  it("rejects fractions, separators and typos beyond the limit", () => {
    expect(parseOptionalKcal("320.5")).toEqual({ ok: false, reason: "not-a-number" });
    expect(parseOptionalKcal("1.200")).toEqual({ ok: false, reason: "not-a-number" });
    expect(parseOptionalKcal("10001")).toEqual({ ok: false, reason: "out-of-range" });
  });
});

describe("parseWaterMl", () => {
  it("accepts whole millilitres from 1 to 5000", () => {
    expect(parseWaterMl("400")).toEqual({ ok: true, value: 400 });
    expect(parseWaterMl("1")).toEqual({ ok: true, value: 1 });
    expect(parseWaterMl("5000")).toEqual({ ok: true, value: 5000 });
  });

  it("rejects the rest", () => {
    expect(parseWaterMl("")).toEqual({ ok: false, reason: "empty" });
    expect(parseWaterMl("0")).toEqual({ ok: false, reason: "out-of-range" });
    expect(parseWaterMl("5001")).toEqual({ ok: false, reason: "out-of-range" });
    expect(parseWaterMl("0,5")).toEqual({ ok: false, reason: "not-a-number" });
  });

  it("offers only amounts it would accept as quick chips", () => {
    for (const ml of WATER_CHIPS_ML) expect(parseWaterMl(String(ml))).toEqual({ ok: true, value: ml });
  });
});

describe("minuteOfDayAt", () => {
  it("is the clock time of an instant on this phone", () => {
    expect(minuteOfDayAt(new Date(2026, 10, 17, 9, 5).getTime())).toBe(9 * 60 + 5);
    expect(minuteOfDayAt(new Date(2026, 10, 17, 0, 0).getTime())).toBe(0);
    expect(minuteOfDayAt(new Date(2026, 10, 17, 23, 59).getTime())).toBe(1439);
  });
});

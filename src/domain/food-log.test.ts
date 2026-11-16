import { describe, expect, it } from "vitest";
import { defaultMealFor, formatQuantity, parseGramsToMg, parseQuantity, stepQuantity } from "./food-log";

describe("defaultMealFor", () => {
  it("suggests the meal by the time of day", () => {
    expect(defaultMealFor(7 * 60)).toBe("breakfast");
    expect(defaultMealFor(10 * 60 + 59)).toBe("breakfast");
    expect(defaultMealFor(11 * 60)).toBe("lunch");
    expect(defaultMealFor(15 * 60 + 59)).toBe("lunch");
    expect(defaultMealFor(16 * 60)).toBe("snack");
    expect(defaultMealFor(18 * 60)).toBe("dinner");
    expect(defaultMealFor(21 * 60 + 59)).toBe("dinner");
    expect(defaultMealFor(22 * 60)).toBe("snack");
    expect(defaultMealFor(2 * 60)).toBe("snack");
  });
});

describe("quantities", () => {
  it("parses amounts with a dot or comma into thousandths", () => {
    expect(parseQuantity("2")).toEqual({ ok: true, milli: 2000 });
    expect(parseQuantity("1,5")).toEqual({ ok: true, milli: 1500 });
    expect(parseQuantity("0.25")).toEqual({ ok: true, milli: 250 });
    expect(parseQuantity("250")).toEqual({ ok: true, milli: 250_000 });
  });

  it("rejects what is not an amount", () => {
    expect(parseQuantity("")).toEqual({ ok: false, reason: "empty" });
    expect(parseQuantity("1,2345")).toEqual({ ok: false, reason: "not-a-number" });
    expect(parseQuantity("0")).toEqual({ ok: false, reason: "out-of-range" });
    expect(parseQuantity("100001")).toEqual({ ok: false, reason: "out-of-range" });
  });

  it("steps by halves below ten and by whole units from ten", () => {
    expect(stepQuantity(1000, 1)).toBe(1500);
    expect(stepQuantity(500, -1)).toBe(500);
    expect(stepQuantity(1500, -1)).toBe(1000);
    expect(stepQuantity(10_000, 1)).toBe(11_000);
    expect(stepQuantity(1250, 1)).toBe(1500);
    expect(stepQuantity(1250, -1)).toBe(1000);
  });

  it("formats thousandths without trailing zeros", () => {
    expect(formatQuantity(2000, ".")).toBe("2");
    expect(formatQuantity(1500, ",")).toBe("1,5");
    expect(formatQuantity(250, ".")).toBe("0.25");
  });
});

describe("parseGramsToMg", () => {
  it("reads grams with up to one decimal into milligrams; empty means unknown", () => {
    expect(parseGramsToMg("12")).toEqual({ ok: true, mg: 12_000 });
    expect(parseGramsToMg("12,5")).toEqual({ ok: true, mg: 12_500 });
    expect(parseGramsToMg(" ")).toEqual({ ok: true, mg: null });
  });

  it("rejects what is not a gram amount", () => {
    expect(parseGramsToMg("1,25")).toEqual({ ok: false, reason: "not-a-number" });
    expect(parseGramsToMg("2001")).toEqual({ ok: false, reason: "out-of-range" });
  });
});

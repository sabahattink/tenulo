import { describe, expect, it } from "vitest";
import { MAX_WATER_ENTRY_ML, isWaterAmount, totalMl } from "./water";

describe("water", () => {
  it("sums a day's entries", () => {
    expect(totalMl([])).toBe(0);
    expect(totalMl([{ amountMl: 250 }, { amountMl: 330 }, { amountMl: 500 }])).toBe(1080);
  });

  it("accepts whole millilitres up to one large bottle", () => {
    expect(isWaterAmount(1)).toBe(true);
    expect(isWaterAmount(MAX_WATER_ENTRY_ML)).toBe(true);
    expect(isWaterAmount(0)).toBe(false);
    expect(isWaterAmount(MAX_WATER_ENTRY_ML + 1)).toBe(false);
    expect(isWaterAmount(250.5)).toBe(false);
  });
});

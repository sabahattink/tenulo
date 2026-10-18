import { describe, expect, it } from "vitest";
import { addDays, diffDays, fromDayNumber, isLocalDate, parseLocalDate, toDayNumber } from "./date";

describe("parseLocalDate", () => {
  it("accepts real calendar dates", () => {
    expect(parseLocalDate("2026-10-18")).toBe("2026-10-18");
    expect(parseLocalDate("2028-02-29")).toBe("2028-02-29");
  });

  it("rejects malformed and impossible dates", () => {
    for (const bad of ["2026-2-1", "2026-13-01", "2026-02-30", "2027-02-29", "18.10.2026", ""]) {
      expect(isLocalDate(bad), bad).toBe(false);
    }
  });
});

describe("day arithmetic", () => {
  const d = parseLocalDate;

  it("round-trips day numbers", () => {
    expect(fromDayNumber(toDayNumber(d("2026-10-18")))).toBe("2026-10-18");
    expect(toDayNumber(d("1970-01-01"))).toBe(0);
  });

  it("is unaffected by DST transitions", () => {
    // EU clocks change on 2026-03-29 and 2026-10-25; US on 2026-03-08 and 2026-11-01.
    expect(diffDays(d("2026-03-28"), d("2026-03-30"))).toBe(2);
    expect(diffDays(d("2026-10-24"), d("2026-10-26"))).toBe(2);
    expect(addDays(d("2026-10-24"), 7)).toBe("2026-10-31");
  });

  it("crosses month and year boundaries", () => {
    expect(addDays(d("2026-12-28"), 7)).toBe("2027-01-04");
    expect(addDays(d("2028-02-28"), 1)).toBe("2028-02-29");
    expect(diffDays(d("2027-01-04"), d("2026-12-28"))).toBe(-7);
  });

  it("refuses fractional day numbers", () => {
    expect(() => fromDayNumber(1.5)).toThrow(RangeError);
  });
});

import { describe, expect, it } from "vitest";
import { parseLocalDate } from "../../domain/date";
import { dateParam, mealParam, minuteOfDay, quantityParam, single } from "./params";

const today = parseLocalDate("2026-11-17");

describe("route parameters", () => {
  it("takes the first of a repeated parameter", () => {
    expect(single(["a", "b"])).toBe("a");
    expect(single("a")).toBe("a");
    expect(single(undefined)).toBeUndefined();
  });

  it("keeps a known meal and otherwise picks one for the time of day", () => {
    expect(mealParam("dinner", 8 * 60)).toBe("dinner");
    expect(mealParam("brunch", 8 * 60)).toBe("breakfast");
    expect(mealParam(undefined, 13 * 60)).toBe("lunch");
  });

  it("accepts a past or current day and refuses the future or nonsense", () => {
    expect(dateParam("2026-11-10", today)).toBe("2026-11-10");
    expect(dateParam("2026-11-17", today)).toBe("2026-11-17");
    expect(dateParam("2026-11-18", today)).toBe(today);
    expect(dateParam("2026-02-30", today)).toBe(today);
    expect(dateParam(undefined, today)).toBe(today);
  });

  it("reads an amount in thousandths within the stored range", () => {
    expect(quantityParam("1500")).toBe(1500);
    expect(quantityParam("0")).toBeUndefined();
    expect(quantityParam("1.5")).toBeUndefined();
    expect(quantityParam("100000001")).toBeUndefined();
    expect(quantityParam(undefined)).toBeUndefined();
  });

  it("counts minutes from local midnight", () => {
    expect(minuteOfDay(new Date(2026, 10, 17, 7, 45))).toBe(465);
  });
});

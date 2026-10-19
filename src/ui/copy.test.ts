import { describe, expect, it } from "vitest";
import { parseLocalDate as d } from "../domain/date";
import { forecastText, relativeDay, shortDate } from "./copy";

const today = d("2026-10-19");

describe("dates", () => {
  it("formats short and relative dates", () => {
    expect(shortDate(d("2026-10-05"), today)).toBe("5 Oct");
    expect(shortDate(d("2027-01-15"), today)).toBe("15 Jan 2027");
    expect(relativeDay(today, today)).toBe("Today");
    expect(relativeDay(d("2026-10-18"), today)).toBe("Yesterday");
    expect(relativeDay(d("2026-10-16"), today)).toBe("3 days ago");
    expect(relativeDay(d("2026-10-01"), today)).toBe("1 Oct");
  });
});

describe("forecastText", () => {
  it("covers every forecast kind without inventing dates", () => {
    expect(forecastText({ kind: "insufficient-data", points: 9, needed: 10 }, "kg", today)).toBe(
      "Log 1 more day to see where your trend is heading.",
    );
    expect(forecastText({ kind: "steady", rateGPerDay: 2 }, "kg", today)).toBe("Your trend is holding steady.");
    expect(forecastText({ kind: "reached", rateGPerDay: -50 }, "kg", today)).toBe("Your trend is at your goal.");
    expect(forecastText({ kind: "away-from-goal", rateGPerDay: 50 }, "kg", today)).toContain("moving away");
    expect(forecastText({ kind: "beyond-horizon", rateGPerDay: -11 }, "kg", today)).toContain("two years");
    expect(forecastText({ kind: "no-goal", rateGPerDay: -100 }, "kg", today)).toBe(
      "Trend: \u22120.7 kg per week. Set a goal to see a projected date.",
    );
    expect(
      forecastText({ kind: "on-track", rateGPerDay: -100, goalDate: d("2027-01-07") }, "kg", today),
    ).toBe("At \u22120.7 kg per week, your trend would reach your goal around 7 Jan 2027.");
  });
});

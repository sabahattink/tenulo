import { describe, expect, it } from "vitest";
import { parseLocalDate as d } from "../domain/date";
import {
  backupProblem,
  forecastText,
  intervalText,
  longDate,
  longWeekday,
  monthTitle,
  relativeDay,
  restoreSummaryText,
  shortDate,
  syncedText,
} from "./copy";

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

describe("long dates", () => {
  it("names the weekday and month", () => {
    expect(longWeekday(d("2026-10-29"))).toBe("Thursday, 29 October");
    expect(longWeekday(d("2026-11-02"))).toBe("Monday, 2 November");
    expect(longWeekday(d("1969-12-31"))).toBe("Wednesday, 31 December");
    expect(longDate(d("2026-03-05"))).toBe("5 Mar 2026");
    expect(monthTitle(d("2026-10-29"))).toBe("October 2026");
  });

  it("describes intervals in words", () => {
    expect(intervalText(1)).toBe("every day");
    expect(intervalText(7)).toBe("every week");
    expect(intervalText(14)).toBe("every 2 weeks");
    expect(intervalText(10)).toBe("every 10 days");
  });
});

describe("data copy", () => {
  it("summarizes a restore in a sentence", () => {
    expect(restoreSummaryText({ weights: 12, injections: 1, sideEffects: 2 })).toBe("Added 12 weigh-ins, 1 injection and 2 side effects.");
    expect(restoreSummaryText({ weights: 1 })).toBe("Added 1 weigh-in.");
    expect(restoreSummaryText({ weights: 0, injections: 0 })).toBe("Nothing new: everything was already on this phone.");
  });

  it("explains refused backups", () => {
    expect(backupProblem({ ok: false, reason: "not-json" })).toContain("not a Tenulo backup");
    expect(backupProblem({ ok: false, reason: "newer-version" })).toContain("newer version");
    const damaged = "The backup is damaged or was edited, so nothing was restored.";
    expect(backupProblem({ ok: false, reason: "invalid", detail: "Too small", path: ["data", "weights", 3, "weightG"] })).toBe(
      `${damaged} The problem is in weigh-in 4.`,
    );
    expect(backupProblem({ ok: false, reason: "invalid", detail: "Too small", path: ["data", "sideEffects", 0, "severity"] })).toBe(
      `${damaged} The problem is in side effect 1.`,
    );
    expect(backupProblem({ ok: false, reason: "invalid", detail: "Too big", path: ["data", "settings", "goalWeightG"] })).toBe(
      `${damaged} The problem is in the settings.`,
    );
    // Whole-backup checks have no path; their messages are already sentences.
    expect(backupProblem({ ok: false, reason: "invalid", detail: "Injection for a medication not in the backup", path: [] })).toBe(
      `${damaged} Injection for a medication not in the backup.`,
    );
    expect(backupProblem({ ok: false, reason: "invalid", detail: "Invalid input", path: ["exportedAt"] })).toBe(damaged);
  });

  it("describes the last Health Connect read", () => {
    const now = new Date(2026, 9, 29, 12, 0);
    expect(syncedText(false, null, now)).toBe("Off");
    expect(syncedText(true, null, now)).toBe("Not read yet");
    expect(syncedText(true, new Date(2026, 9, 29, 8, 5).getTime(), now)).toBe("Last read today at 08:05");
    expect(syncedText(true, new Date(2026, 9, 20, 21, 30).getTime(), now)).toBe("Last read 20 Oct at 21:30");
  });
});

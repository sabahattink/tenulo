import { describe, expect, it } from "vitest";
import { parseLocalDate as d } from "./date";
import {
  atLocalMinute,
  formatMinuteOfDay,
  injectionReminderAt,
  nextDailyAt,
  parseMinuteOfDay,
  stepMinute,
} from "./reminder";

// Local wall-clock times, so the tests hold in any device time zone.
const local = (y: number, m: number, day: number, h: number, min: number) => new Date(y, m - 1, day, h, min, 0, 0);

describe("minute of day", () => {
  it("formats as 24-hour HH:MM", () => {
    expect(formatMinuteOfDay(0)).toBe("00:00");
    expect(formatMinuteOfDay(540)).toBe("09:00");
    expect(formatMinuteOfDay(1_439)).toBe("23:59");
    expect(() => formatMinuteOfDay(1_440)).toThrow(RangeError);
  });

  it("parses HH:MM and rejects nonsense", () => {
    expect(parseMinuteOfDay("07:30")).toBe(450);
    expect(parseMinuteOfDay("7:05")).toBe(425);
    expect(parseMinuteOfDay("24:00")).toBeUndefined();
    expect(parseMinuteOfDay("12:60")).toBeUndefined();
    expect(parseMinuteOfDay("noon")).toBeUndefined();
  });

  it("steps through the day and wraps around midnight", () => {
    expect(stepMinute(540, 15)).toBe(555);
    expect(stepMinute(1_430, 15)).toBe(5);
    expect(stepMinute(5, -15)).toBe(1_430);
  });
});

describe("atLocalMinute", () => {
  it("is the local wall-clock time on that date", () => {
    expect(atLocalMinute(d("2026-10-29"), 540).getTime()).toBe(local(2026, 10, 29, 9, 0).getTime());
  });
});

describe("nextDailyAt", () => {
  it("is later today when the time is still ahead, else tomorrow", () => {
    expect(nextDailyAt(540, local(2026, 10, 29, 8, 59)).getTime()).toBe(local(2026, 10, 29, 9, 0).getTime());
    expect(nextDailyAt(540, local(2026, 10, 29, 9, 0)).getTime()).toBe(local(2026, 10, 30, 9, 0).getTime());
    expect(nextDailyAt(540, local(2026, 12, 31, 22, 0)).getTime()).toBe(local(2027, 1, 1, 9, 0).getTime());
  });
});

describe("injectionReminderAt", () => {
  it("is not scheduled before the first injection is logged", () => {
    expect(injectionReminderAt(undefined, 540, local(2026, 10, 29, 8, 0))).toBeUndefined();
  });

  it("fires on the due date at the chosen time", () => {
    const at = injectionReminderAt(d("2026-11-02"), 540, local(2026, 10, 29, 20, 0));
    expect(at?.getTime()).toBe(local(2026, 11, 2, 9, 0).getTime());
  });

  it("still fires later today when the shot is due today", () => {
    const at = injectionReminderAt(d("2026-10-29"), 1_200, local(2026, 10, 29, 9, 0));
    expect(at?.getTime()).toBe(local(2026, 10, 29, 20, 0).getTime());
  });

  it("reminds once more at the next chosen time when the due time has passed", () => {
    const at = injectionReminderAt(d("2026-10-27"), 540, local(2026, 10, 29, 10, 0));
    expect(at?.getTime()).toBe(local(2026, 10, 30, 9, 0).getTime());
  });
});

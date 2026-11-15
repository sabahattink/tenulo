import { beforeEach, describe, expect, it } from "vitest";
import { addDays, parseLocalDate as d } from "../domain/date";
import { injectionOnOrBefore } from "./queries";
import { type TestDb, testDb } from "./test-db";

const now = 1_792_300_000_000;
let t: TestDb;

beforeEach(async () => {
  t = await testDb();
  t.sqlite.exec(`
    INSERT INTO medication (id, name, created_at, updated_at) VALUES ('m', 'Daily pen', ${now}, ${now});
    INSERT INTO medication (id, name, created_at, updated_at) VALUES ('other', 'Other pen', ${now}, ${now});
  `);
});

const shot = (id: string, date: string, takenAt = now, medication = "m") =>
  t.sqlite
    .prepare(
      "INSERT INTO injection (id, medication_id, taken_at, local_date, dose_mcg, created_at, updated_at) VALUES (?, ?, ?, ?, 250, ?, ?)",
    )
    .run(id, medication, takenAt, date, now, now);

describe("injectionOnOrBefore", () => {
  it("finds the shot a side effect followed, however many shots came after it", () => {
    // Daily shots for 40 days; a side effect dated on day 5 followed day 5's shot.
    const start = d("2026-09-01");
    for (let i = 0; i < 40; i++) shot(`s${i}`, addDays(start, i));
    expect(injectionOnOrBefore(t.database, "m", addDays(start, 5))).toBe("s5");
  });

  it("takes the later of two shots on the same day", () => {
    shot("early", "2026-10-10", now);
    shot("late", "2026-10-10", now + 60_000);
    expect(injectionOnOrBefore(t.database, "m", d("2026-10-12"))).toBe("late");
  });

  it("is null before the first shot, and ignores other medications", () => {
    shot("other-shot", "2026-10-01", now, "other");
    shot("mine", "2026-10-10");
    expect(injectionOnOrBefore(t.database, "m", d("2026-10-05"))).toBeNull();
    expect(injectionOnOrBefore(t.database, "m", d("2026-10-10"))).toBe("mine");
  });
});

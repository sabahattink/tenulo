import { describe, expect, it } from "vitest";
import { parseLocalDate } from "../../domain/date";
import { dateFromParam } from "./params";

const today = parseLocalDate("2026-11-17");

describe("dateFromParam", () => {
  it("takes a real date up to today", () => {
    expect(dateFromParam("2026-11-17", today)).toBe("2026-11-17");
    expect(dateFromParam("2026-11-02", today)).toBe("2026-11-02");
  });

  it("falls back to today for a missing, malformed or future date", () => {
    expect(dateFromParam(undefined, today)).toBe(today);
    expect(dateFromParam("", today)).toBe(today);
    expect(dateFromParam("2026-02-30", today)).toBe(today);
    expect(dateFromParam("17.11.2026", today)).toBe(today);
    expect(dateFromParam("2026-11-18", today)).toBe(today);
  });

  it("uses the first value when the parameter is repeated", () => {
    expect(dateFromParam(["2026-11-10", "2026-11-11"], today)).toBe("2026-11-10");
    expect(dateFromParam([], today)).toBe(today);
  });
});

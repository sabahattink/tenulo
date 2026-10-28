import { describe, expect, it } from "vitest";
import { localDateOf } from "./date";
import { FIRST_SYNC_DAYS, SYNC_OVERLAP_DAYS, importableWeights, syncRange, toImportedWeight } from "./health-connect";

const DAY = 86_400_000;

describe("toImportedWeight", () => {
  it("maps a Health Connect reading to integer grams on the local date", () => {
    const time = "2026-10-18T06:30:00.000Z";
    expect(toImportedWeight({ id: "hc-1", time, grams: 82_418.4 })).toEqual({
      healthConnectId: "hc-1",
      measuredAt: Date.parse(time),
      localDate: localDateOf(new Date(time)),
      weightG: 82_418,
    });
  });

  it("skips readings Tenulo could not store or tell apart", () => {
    expect(toImportedWeight({ id: undefined, time: "2026-10-18T06:30:00Z", grams: 80_000 })).toBeUndefined();
    expect(toImportedWeight({ id: "", time: "2026-10-18T06:30:00Z", grams: 80_000 })).toBeUndefined();
    expect(toImportedWeight({ id: "x", time: "yesterday", grams: 80_000 })).toBeUndefined();
    expect(toImportedWeight({ id: "x", time: "2026-10-18T06:30:00Z", grams: 8_000 })).toBeUndefined();
    expect(toImportedWeight({ id: "x", time: "2026-10-18T06:30:00Z", grams: Number.NaN })).toBeUndefined();
  });
});

describe("importableWeights", () => {
  it("drops duplicates and readings already imported", () => {
    const r = (id: string) => ({ id, time: "2026-10-18T06:30:00Z", grams: 80_000 });
    const out = importableWeights([r("a"), r("b"), r("a"), r("c")], new Set(["b"]));
    expect(out.map((w) => w.healthConnectId)).toEqual(["a", "c"]);
  });
});

describe("syncRange", () => {
  const now = 1_792_300_000_000;

  it("looks back a year on the first sync", () => {
    expect(syncRange(null, now)).toEqual({ startMs: now - FIRST_SYNC_DAYS * DAY, endMs: now });
  });

  it("re-reads a few days before the last sync to catch late arrivals", () => {
    const last = now - 2 * DAY;
    expect(syncRange(last, now)).toEqual({ startMs: last - SYNC_OVERLAP_DAYS * DAY, endMs: now });
  });

  it("never asks for more than the first-sync window, even after a long pause or a clock jump", () => {
    expect(syncRange(now - 900 * DAY, now).startMs).toBe(now - FIRST_SYNC_DAYS * DAY);
    expect(syncRange(now + 5 * DAY, now).startMs).toBe(now - SYNC_OVERLAP_DAYS * DAY);
  });
});

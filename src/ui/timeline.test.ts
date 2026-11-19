import { describe, expect, it } from "vitest";
import { parseLocalDate as d } from "../domain/date";
import { TIMELINE_FILTERS, type TimelineItem, timeline, timelineFilters } from "./timeline";

const items: TimelineItem[] = [
  { kind: "weight", id: "w1", date: d("2026-09-30"), at: 1 },
  { kind: "injection", id: "i1", date: d("2026-10-01"), at: 5 },
  { kind: "side-effect", id: "s1", date: d("2026-10-01"), at: 9 },
  { kind: "weight", id: "w2", date: d("2026-10-12"), at: 2 },
  { kind: "food", id: "2026-10-12|lunch", date: d("2026-10-12"), at: 7 },
  { kind: "water", id: "2026-10-01", date: d("2026-10-01"), at: 6 },
  { kind: "measurement", id: "2026-09-30|3", date: d("2026-09-30"), at: 3 },
  { kind: "exercise", id: "e1", date: d("2026-10-12"), at: 1 },
];

describe("timeline", () => {
  it("groups newest first by month, later entries first within a day", () => {
    const t = timeline(items, "all");
    expect(t.map((s) => s.month)).toEqual(["2026-10", "2026-09"]);
    expect(t[0]?.items.map((i) => i.id)).toEqual(["2026-10-12|lunch", "w2", "e1", "s1", "2026-10-01", "i1"]);
    expect(t[1]?.items.map((i) => i.id)).toEqual(["2026-09-30|3", "w1"]);
  });

  it("orders across a year boundary", () => {
    const t = timeline(
      [
        { kind: "weight", id: "dec", date: d("2026-12-31"), at: 9 },
        { kind: "weight", id: "jan", date: d("2027-01-02"), at: 1 },
      ],
      "all",
    );
    expect(t.map((s) => s.month)).toEqual(["2027-01", "2026-12"]);
  });

  it("filters by kind and drops empty months", () => {
    expect(timeline(items, "injection")).toEqual([{ month: "2026-10", items: [items[1]] }]);
    expect(timeline(items, "measurement")).toEqual([{ month: "2026-09", items: [items[6]] }]);
    expect(timeline([], "all")).toEqual([]);
  });

  it("offers a filter for every kind, after 'all'", () => {
    expect(TIMELINE_FILTERS).toEqual(["all", "weight", "injection", "side-effect", "food", "water", "measurement", "exercise"]);
  });

  it("timelineFilters keeps every filter with medication on", () => {
    expect(timelineFilters(true)).toEqual(TIMELINE_FILTERS);
  });

  it("timelineFilters drops injection and side-effect with medication off", () => {
    expect(timelineFilters(false)).toEqual(["all", "weight", "food", "water", "measurement", "exercise"]);
  });
});

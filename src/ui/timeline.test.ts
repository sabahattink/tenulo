import { describe, expect, it } from "vitest";
import { parseLocalDate as d } from "../domain/date";
import { type TimelineItem, timeline } from "./timeline";

const items: TimelineItem[] = [
  { kind: "weight", id: "w1", date: d("2026-09-30"), at: 1 },
  { kind: "injection", id: "i1", date: d("2026-10-01"), at: 5 },
  { kind: "side-effect", id: "s1", date: d("2026-10-01"), at: 9 },
  { kind: "weight", id: "w2", date: d("2026-10-12"), at: 2 },
];

describe("timeline", () => {
  it("groups newest first by month, later entries first within a day", () => {
    const t = timeline(items, "all");
    expect(t.map((s) => s.month)).toEqual(["2026-10", "2026-09"]);
    expect(t[0]?.items.map((i) => i.id)).toEqual(["w2", "s1", "i1"]);
  });

  it("filters by kind and drops empty months", () => {
    expect(timeline(items, "injection")).toEqual([{ month: "2026-10", items: [items[1]] }]);
    expect(timeline([], "all")).toEqual([]);
  });
});

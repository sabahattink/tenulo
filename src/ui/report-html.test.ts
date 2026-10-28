import { describe, expect, it } from "vitest";
import { addDays, parseLocalDate as d } from "../domain/date";
import { buildReport } from "../domain/report";
import { escapeHtml, reportHtml } from "./report-html";

const empty = buildReport({
  from: d("2026-09-30"),
  to: d("2026-10-29"),
  weights: [],
  medicationName: undefined,
  planSteps: [],
  injections: [],
  sideEffects: [],
});

const full = buildReport({
  from: d("2026-09-30"),
  to: d("2026-10-29"),
  weights: Array.from({ length: 30 }, (_, i) => ({ date: addDays(d("2026-09-30"), i), weightG: 95_000 - i * 90 })),
  medicationName: `<img src=x onerror="alert(1)"> & Co`,
  planSteps: [{ startDate: d("2026-09-01"), doseMcg: 250, intervalDays: 7 }],
  injections: [
    { date: d("2026-10-01"), doseMcg: 250, site: "abdomen-left" },
    { date: d("2026-10-08"), doseMcg: 250, site: null },
  ],
  sideEffects: [{ date: d("2026-10-02"), type: "nausea", severity: 2, note: "<b>after</b> dinner" }],
});

describe("escapeHtml", () => {
  it("escapes every character that could open markup or an attribute", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});

describe("reportHtml", () => {
  const created = d("2026-10-29");

  it("renders an empty period without inventing numbers", () => {
    const html = reportHtml(empty, "kg", created);
    expect(html).toContain("30 Sep 2026");
    expect(html).toContain("No weigh-ins in this period");
    expect(html).toContain("No injections in this period");
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("undefined");
  });

  it("escapes what the user typed", () => {
    const html = reportHtml(full, "kg", created);
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; Co");
    expect(html).toContain("&lt;b&gt;after&lt;/b&gt; dinner");
  });

  it("is self-contained: no external resources a renderer could fetch", () => {
    const html = reportHtml(full, "lb", created);
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/<[^>]*\ssrc=/);
    expect(html).not.toMatch(/@import|url\(/);
  });

  it("shows the weight trend, the plan, injections and side effects", () => {
    const html = reportHtml(full, "kg", created);
    expect(html).toContain("<svg");
    expect(html).toContain("0.25 mg");
    expect(html).toContain("Belly, left");
    expect(html).toContain("Not recorded");
    expect(html).toContain("Nausea");
    expect(html).toContain("Moderate");
    expect(html).toContain("does not give medical advice");
  });
});

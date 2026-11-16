import { describe, expect, it } from "vitest";
import { addDays, parseLocalDate as d } from "../domain/date";
import { buildReport } from "../domain/report";
import { i18nFor } from "../i18n";
import { PUBLISHER } from "./copy";
import { escapeHtml, reportHtml } from "./report-html";

const en = i18nFor("en");
const tr = i18nFor("tr");

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
    { date: d("2026-10-14"), doseMcg: 250, site: "thigh-right" },
  ],
  sideEffects: [{ date: d("2026-10-02"), type: "nausea", severity: 2, note: "<b>after</b> dinner" }],
});

const footerOf = (html: string) => /<footer>([\s\S]*?)<\/footer>/.exec(html)?.[1] ?? "";

describe("escapeHtml", () => {
  it("escapes every character that could open markup or an attribute", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});

describe("reportHtml", () => {
  const created = d("2026-10-29");

  it("renders an empty period without inventing numbers", () => {
    for (const i18n of [en, tr]) {
      const html = reportHtml(empty, "kg", created, i18n);
      expect(html).not.toContain("NaN");
      expect(html).not.toContain("undefined");
    }
    const html = reportHtml(empty, "kg", created, en);
    expect(html).toContain("30 Sep 2026");
    expect(html).toContain("No weigh-ins in this period");
    expect(html).toContain("No injections in this period");
  });

  it("escapes what the user typed", () => {
    for (const i18n of [en, tr]) {
      const html = reportHtml(full, "kg", created, i18n);
      expect(html).not.toContain("<img");
      expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; Co");
      expect(html).toContain("&lt;b&gt;after&lt;/b&gt; dinner");
    }
  });

  it("names Tenulo's publisher in the footer", () => {
    expect(footerOf(reportHtml(empty, "kg", created, en))).toContain(`Tenulo by ${PUBLISHER}`);
    expect(footerOf(reportHtml(empty, "kg", created, tr))).toContain(`Tenulo, ${PUBLISHER} ürünüdür`);
  });

  it("is self-contained: no external resources a renderer could fetch", () => {
    for (const i18n of [en, tr]) {
      const html = reportHtml(full, "lb", created, i18n);
      expect(html).not.toMatch(/https?:\/\//);
      expect(html).not.toMatch(/<[^>]*\ssrc=/);
      expect(html).not.toMatch(/@import|url\(/);
    }
  });

  it("shows the weight trend, the plan, injections and side effects", () => {
    const html = reportHtml(full, "kg", created, en);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<svg");
    expect(html).toContain("0.25 mg");
    expect(html).toContain("every week");
    expect(html).toContain("Belly, left");
    expect(html).toContain("Not recorded");
    expect(html).toContain("Nausea");
    expect(html).toContain("Moderate");
    expect(html).toContain("Days between injections: 6–7 (average 6.5).");
    expect(html).toContain("does not give medical advice");
  });

  it("speaks Turkish, with a decimal comma and Turkish upper case", () => {
    const html = reportHtml(full, "kg", created, tr);
    expect(html).toContain('<html lang="tr">');
    expect(html).toContain("30 Eylül 2026 – 29 Ekim 2026 · 30 gün");
    expect(html).toContain("0,25 mg");
    expect(html).toContain("her hafta");
    expect(html).toContain("Karın, sol");
    expect(html).toContain("Kaydedilmedi");
    expect(html).toContain("Bulantı");
    expect(html).toContain("Orta");
    expect(html).toContain("Enjeksiyonlar arası gün: 6–7 (ortalama 6,5).");
    expect(html).toContain("DÖNEM BAŞI TREND");
    expect(html).toContain("BÖLGE");
    expect(html).toContain("Tenulo tıbbi tavsiye vermez");
    expect(html).not.toContain("Nausea");
  });

  it("labels the weekly rate and the chart ticks in the user's language", () => {
    expect(reportHtml(full, "kg", created, en)).toMatch(/−\d\.\d kg per week/);
    expect(reportHtml(full, "kg", created, tr)).toMatch(/haftada −\d,\d kg/);
  });
});

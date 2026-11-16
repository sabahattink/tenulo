import { describe, expect, it } from "vitest";
import { addDays, parseLocalDate as d } from "../domain/date";
import { buildReport } from "../domain/report";
import { i18nFor } from "../i18n";
import { PUBLISHER } from "./copy";
import { escapeHtml, reportHtml } from "./report-html";

const en = i18nFor("en");
const tr = i18nFor("tr");

const noDailyLog = { foodDays: [], waterDays: [], measurements: [], exercises: [] } as const;

const empty = buildReport({
  from: d("2026-09-30"),
  to: d("2026-10-29"),
  weights: [],
  medicationName: undefined,
  planSteps: [],
  injections: [],
  sideEffects: [],
  ...noDailyLog,
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
  foodDays: [
    { date: d("2026-10-01"), energyKcal: 1580, proteinMg: 81_400, proteinUnknown: 0 },
    { date: d("2026-10-02"), energyKcal: 1720, proteinMg: 92_600, proteinUnknown: 1 },
  ],
  waterDays: [
    { date: d("2026-10-01"), amountMl: 1750 },
    { date: d("2026-10-02"), amountMl: 2250 },
    { date: d("2026-10-03"), amountMl: 1500 },
  ],
  measurements: [
    { site: "waist", date: d("2026-10-01"), measuredAt: 1, lengthMm: 1005 },
    { site: "waist", date: d("2026-10-22"), measuredAt: 2, lengthMm: 970 },
    { site: "hip", date: d("2026-10-01"), measuredAt: 1, lengthMm: 1120 },
  ],
  exercises: [
    { date: d("2026-10-01"), kind: "walking", durationMin: 40 },
    { date: d("2026-10-03"), kind: "walking", durationMin: 35 },
    { date: d("2026-10-05"), kind: "strength", durationMin: 30 },
  ],
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

  it("adds nutrition, water, measurements and exercise in English", () => {
    const html = reportHtml(full, "kg", created, en);
    expect(html).toContain("<h2>Nutrition</h2>");
    expect(html).toContain("<th>Days with food logged</th><td>2 of 30</td>");
    expect(html).toContain("<th>Average energy per logged day</th><td>1,650 kcal</td>");
    expect(html).toContain("<th>Average protein per logged day</th><td>87 g</td>");
    expect(html).toContain("the protein average counts only the foods that had one");
    expect(html).toContain("<th>Days with water logged</th><td>3 of 30</td>");
    expect(html).toContain("<td>1,833 ml</td>");
    expect(html).toContain("<h2>Body measurements</h2>");
    expect(html).toContain("<td>Waist</td><td>100.5 cm · 1 Oct 2026</td><td>97 cm · 22 Oct 2026</td><td>−3.5 cm</td>");
    expect(html).toContain("<td>Hip</td><td>112 cm · 1 Oct 2026</td><td>–</td><td>–</td>");
    expect(html).toContain("<th>Sessions</th><td>3</td><th>Total time</th><td>105 min</td>");
    expect(html).toContain("<td>Walking</td><td>2</td><td>75 min</td>");
    expect(html).toContain("Energy burned is not included.");
  });

  it("adds the same sections in Turkish, with Turkish numbers and upper case", () => {
    const html = reportHtml(full, "kg", created, tr);
    expect(html).toContain("<h2>Beslenme</h2>");
    expect(html).toContain("<td>2 / 30</td>");
    expect(html).toContain("<td>1.650 kcal</td>");
    expect(html).toContain("<td>1.833 ml</td>");
    expect(html).toContain("<td>Bel</td><td>100,5 cm · 1 Ekim 2026</td><td>97 cm · 22 Ekim 2026</td><td>−3,5 cm</td>");
    expect(html).toContain("<th>İLK</th>");
    expect(html).toContain("<td>Yürüyüş</td><td>2</td><td>75 dk</td>");
    expect(html).toContain("Harcanan enerji dahil edilmemiştir.");
    expect(html).not.toContain("Walking");
  });

  it("shows lengths in inches next to pounds", () => {
    expect(reportHtml(full, "lb", created, en)).toContain("<td>Waist</td><td>39.6 in · 1 Oct 2026</td>");
  });

  it("leaves out daily-log sections that have nothing in the period", () => {
    for (const i18n of [en, tr]) {
      const html = reportHtml(empty, "kg", created, i18n);
      for (const heading of ["Nutrition", "Beslenme", "Body measurements", "Vücut ölçüleri", "Exercise", "Egzersiz"]) {
        expect(html).not.toContain(`<h2>${heading}</h2>`);
      }
      expect(html).not.toContain("kcal");
    }
  });

  it("never prints an energy estimate for exercise", () => {
    expect(reportHtml(full, "kg", created, en)).not.toContain("≈");
  });
});

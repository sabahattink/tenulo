import { describe, expect, it } from "vitest";
import { type Messages, en } from "./en";
import { leaves } from "./leaves";
import { tr } from "./tr";

/** Text that is the same in both languages on purpose: names, units and symbols. */
const SAME_IN_BOTH = new Set([
  "common.noValue",
  "screens.pro",
  "trendChart.title",
  "trendChart.legendTrend",
  "trendChart.ranges.365",
  "report.trend",
  "reportPdf.legendTrend",
  "settings.healthConnect.title",
  "pro.features.healthConnect.title",
  "calendar.shortDate",
  "calendar.weekdayDate",
  "calendar.monthTitle",
  "calendar.monthsShort.2",
  "calendar.monthsShort.4",
  "daily.protein",
  "exerciseLog.kinds.yoga",
  "food.nutrients.protein",
]);

describe("messages", () => {
  const english = leaves(en);
  const turkish = leaves(tr);

  it("has the same keys in both languages", () => {
    expect(turkish.map(([path]) => path)).toEqual(english.map(([path]) => path));
  });

  it.each([
    ["en", english],
    ["tr", turkish],
  ])("has no empty or broken text in %s", (_lang, all) => {
    for (const [path, text] of all) {
      expect(text.trim(), path).not.toBe("");
      expect(text, path).not.toMatch(/undefined|NaN|\[object|<|>/);
    }
  });

  it("translates every Turkish string", () => {
    const english = new Map(leaves(en));
    const untranslated = turkish.filter(([path, text]) => english.get(path) === text && !SAME_IN_BOTH.has(path));
    expect(untranslated).toEqual([]);
  });

  it("writes Turkish with Turkish letters", () => {
    const text = turkish.map(([, t]) => t).join(" ");
    for (const letter of ["ç", "ğ", "ı", "İ", "ö", "ş", "ü"]) expect(text).toContain(letter);
  });

  it("keeps the medical boundary in both languages", () => {
    expect(en.today.footnote).toBe("Tenulo is a personal log. It does not give medical advice. Everything stays on this phone.");
    expect(tr.today.footnote).toBe("Tenulo kişisel bir kayıttır. Tıbbi tavsiye vermez. Her şey bu telefonda kalır.");
  });

  it("explains purchase failures in Turkish by their code, and keeps Play's message in English", () => {
    expect(en.pro.failedBody("E_NO_PRODUCT", "This product is not available right now")).toBe(
      "This product is not available right now",
    );
    expect(en.pro.failedBody(undefined, undefined)).toBe("Please try again later.");
    expect(tr.pro.failedBody("E_BILLING_12", "Network error")).toContain("Bağlantını kontrol");
    expect(tr.pro.failedBody("E_SOMETHING_NEW", "Unknown")).toBe("Lütfen daha sonra tekrar dene.");
  });
});

// Compile-time: a dictionary with a month missing does not type-check.
// @ts-expect-error eleven months
const elevenMonths: Messages["calendar"]["monthsShort"] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];
void elevenMonths;

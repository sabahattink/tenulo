import { describe, expect, it } from "vitest";
import { DARK, DARK_KINDS, KINDS, LIGHT, LIGHT_KINDS, contrastRatio } from "./palette";

const SCHEMES = [
  { name: "light", base: LIGHT, kinds: LIGHT_KINDS },
  { name: "dark", base: DARK, kinds: DARK_KINDS },
] as const;

/** WCAG 2.x AA for normal-size text. Every color here can carry text, not only icons. */
const TEXT = 4.5;

describe("contrastRatio", () => {
  it("matches the WCAG reference values", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 2);
  });
});

describe.each(SCHEMES)("$name theme", ({ base, kinds }) => {
  it.each(["text", "muted", "accent", "danger"] as const)("%s is readable on the background and on cards", (role) => {
    expect(contrastRatio(base[role], base.background)).toBeGreaterThanOrEqual(TEXT);
    expect(contrastRatio(base[role], base.card)).toBeGreaterThanOrEqual(TEXT);
  });

  it.each(["text", "muted", "accent"] as const)("%s is readable on the wash behind screen titles", (role) => {
    expect(contrastRatio(base[role], base.wash)).toBeGreaterThanOrEqual(TEXT);
  });

  it.each(KINDS)("%s ink is readable on the background, on cards and on its own tint", (kind) => {
    const { ink, soft } = kinds[kind];
    expect(contrastRatio(ink, base.background)).toBeGreaterThanOrEqual(TEXT);
    expect(contrastRatio(ink, base.card)).toBeGreaterThanOrEqual(TEXT);
    expect(contrastRatio(ink, soft)).toBeGreaterThanOrEqual(TEXT);
  });

  it.each(KINDS)("%s tint stays readable under body text and visibly differs from a card", (kind) => {
    const { soft } = kinds[kind];
    expect(contrastRatio(base.text, soft)).toBeGreaterThanOrEqual(TEXT);
    expect(contrastRatio(soft, base.card)).toBeGreaterThan(1.15);
  });
});

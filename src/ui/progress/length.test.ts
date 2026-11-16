import { describe, expect, it } from "vitest";
import { i18nFor } from "../../i18n";
import { formatLength, formatLengthChange, formatLengthNumber } from "./length";

const en = i18nFor("en").f;
const tr = i18nFor("tr").f;

describe("formatLength", () => {
  it("shows one decimal only when the tape reading has one", () => {
    expect(formatLength(en, 925, "cm")).toBe("92.5 cm");
    expect(formatLength(en, 1040, "cm")).toBe("104 cm");
    expect(formatLength(tr, 925, "cm")).toBe("92,5 cm");
  });

  it("converts to inches for people who weigh in pounds", () => {
    expect(formatLength(en, 925, "in")).toBe("36.4 in");
    expect(formatLength(en, 254, "in")).toBe("10 in");
  });

  it("gives the bare number for fields", () => {
    expect(formatLengthNumber(en, 925, "cm")).toBe("92.5");
    expect(formatLengthNumber(tr, 1040, "cm")).toBe("104");
  });
});

describe("formatLengthChange", () => {
  it("signs a change with a true minus or a plus", () => {
    expect(formatLengthChange(en, -35, "cm")).toBe("−3.5 cm");
    expect(formatLengthChange(tr, -35, "cm")).toBe("−3,5 cm");
    expect(formatLengthChange(en, 10, "cm")).toBe("+1 cm");
  });

  it("shows no sign for a change that rounds to nothing", () => {
    expect(formatLengthChange(en, 0, "cm")).toBe("0 cm");
    expect(formatLengthChange(en, -1, "in")).toBe("0 in");
  });
});

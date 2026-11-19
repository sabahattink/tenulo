import { describe, expect, it } from "vitest";
import { parseFeatures } from "./features";

describe("parseFeatures", () => {
  it("reads medication: false", () => {
    expect(parseFeatures({ medication: false })).toEqual({ medication: false });
  });

  it("reads medication: true", () => {
    expect(parseFeatures({ medication: true })).toEqual({ medication: true });
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["an empty object", {}],
    ["a string value", { medication: "false" }],
  ])("throws naming expo.extra.medication for %s", (_name, extra) => {
    expect(() => parseFeatures(extra)).toThrow(/expo\.extra\.medication/);
  });
});

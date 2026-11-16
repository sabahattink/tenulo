import { describe, expect, it } from "vitest";
import { resolveLanguage } from "./language";

describe("resolveLanguage", () => {
  it("uses the user's explicit choice", () => {
    expect(resolveLanguage("tr", "en-US")).toBe("tr");
    expect(resolveLanguage("en", "tr-TR")).toBe("en");
  });

  it("follows the phone for 'system': Turkish for Turkish and Azerbaijani, English otherwise", () => {
    expect(resolveLanguage("system", "tr-TR")).toBe("tr");
    expect(resolveLanguage("system", "tr")).toBe("tr");
    expect(resolveLanguage("system", "az-Latn-AZ")).toBe("tr");
    expect(resolveLanguage("system", "en-GB")).toBe("en");
    expect(resolveLanguage("system", "de-DE")).toBe("en");
    expect(resolveLanguage("system", "")).toBe("en");
  });

  it("matches the whole language subtag only", () => {
    expect(resolveLanguage("system", "trv")).toBe("en");
    expect(resolveLanguage("system", "TR_tr")).toBe("tr");
  });
});

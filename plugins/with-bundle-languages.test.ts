import { describe, expect, it } from "vitest";
import { MARKER, keepAllLanguages } from "./with-bundle-languages";

const TEMPLATE = `apply plugin: "com.android.application"

android {
    namespace 'com.kalkansoftware.tenulo'
}
`;

describe("keepAllLanguages", () => {
  it("turns off the app bundle's language split, so every phone gets both languages", () => {
    const out = keepAllLanguages(TEMPLATE);
    expect(out.startsWith(TEMPLATE)).toBe(true);
    expect(out).toMatch(/bundle\s*\{\s*language\s*\{\s*enableSplit = false\s*\}\s*\}/);
  });

  it("is idempotent: a second prebuild does not add a second block", () => {
    const once = keepAllLanguages(TEMPLATE);
    expect(keepAllLanguages(once)).toBe(once);
    expect(once.split(MARKER).length - 1).toBe(1);
  });
});

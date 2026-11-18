import { describe, expect, it } from "vitest";
import { FEATURE, optionalPortrait } from "./with-optional-portrait";

interface Feature {
  $: Record<string, string>;
}
interface Manifest {
  manifest: { $: Record<string, string>; application: unknown[]; "uses-feature"?: Feature[] };
}

const base = (): Manifest => ({
  manifest: { $: { "xmlns:android": "http://schemas.android.com/apk/res/android" }, application: [{ $: {} }] },
});

const portraitEntries = (m: Manifest): Feature[] =>
  (m.manifest["uses-feature"] ?? []).filter((f) => f.$["android:name"] === FEATURE);

describe("optionalPortrait", () => {
  it("declares the portrait screen feature as not required", () => {
    const out: Manifest = optionalPortrait(base());
    expect(portraitEntries(out)).toEqual([{ $: { "android:name": FEATURE, "android:required": "false" } }]);
  });

  it("is idempotent: a second prebuild leaves one entry", () => {
    const once: Manifest = optionalPortrait(base());
    expect(optionalPortrait(once)).toEqual(once);
  });

  it("turns an existing required declaration into an optional one and keeps other features", () => {
    const m = base();
    m.manifest["uses-feature"] = [
      { $: { "android:name": FEATURE, "android:required": "true" } },
      { $: { "android:name": "android.hardware.camera", "android:required": "false" } },
    ];
    const out: Manifest = optionalPortrait(m);
    expect(portraitEntries(out)).toEqual([{ $: { "android:name": FEATURE, "android:required": "false" } }]);
    expect(out.manifest["uses-feature"]).toContainEqual({
      $: { "android:name": "android.hardware.camera", "android:required": "false" },
    });
  });
});

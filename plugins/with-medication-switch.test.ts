import { describe, expect, it } from "vitest";
import withMedicationSwitch, { META_NAME, medicationMetaData } from "./with-medication-switch";

interface MetaData {
  $: Record<string, string>;
}
interface Application {
  $: Record<string, string>;
  "meta-data"?: MetaData[];
}
interface Manifest {
  manifest: { $: Record<string, string>; application: Application[] };
}

const base = (): Manifest => ({
  manifest: { $: { "xmlns:android": "http://schemas.android.com/apk/res/android" }, application: [{ $: {} }] },
});

const entries = (m: Manifest): MetaData[] =>
  (m.manifest.application[0]?.["meta-data"] ?? []).filter((d) => d.$["android:name"] === META_NAME);

describe("medicationMetaData", () => {
  it("writes the switch as false", () => {
    const out: Manifest = medicationMetaData(base(), false);
    expect(entries(out)).toEqual([{ $: { "android:name": META_NAME, "android:value": "false" } }]);
  });

  it("writes the switch as true", () => {
    const out: Manifest = medicationMetaData(base(), true);
    expect(entries(out)).toEqual([{ $: { "android:name": META_NAME, "android:value": "true" } }]);
  });

  it("is idempotent: a second prebuild leaves one entry", () => {
    const once: Manifest = medicationMetaData(base(), false);
    expect(medicationMetaData(once, false)).toEqual(once);
  });

  it("replaces an existing entry and keeps other meta-data", () => {
    const m = base();
    m.manifest.application[0]!["meta-data"] = [
      { $: { "android:name": META_NAME, "android:value": "true" } },
      { $: { "android:name": "other", "android:value": "x" } },
    ];
    const out: Manifest = medicationMetaData(m, false);
    expect(entries(out)).toEqual([{ $: { "android:name": META_NAME, "android:value": "false" } }]);
    expect(out.manifest.application[0]?.["meta-data"]).toContainEqual({ $: { "android:name": "other", "android:value": "x" } });
  });
});

describe("withMedicationSwitch", () => {
  it("throws when expo.extra.medication is not a boolean", () => {
    expect(() => withMedicationSwitch({ name: "t", slug: "t", extra: {} })).toThrow(/expo\.extra\.medication/);
  });
});

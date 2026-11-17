import { describe, expect, it } from "vitest";
import { DOMAINS, RULES_RESOURCE, dataExtractionRulesXml, pointManifestAtRules } from "./with-no-data-extraction";

describe("dataExtractionRulesXml", () => {
  const xml = dataExtractionRulesXml();

  it("excludes every storage domain from cloud backup and from device-to-device transfer", () => {
    const cloud = xml.slice(xml.indexOf("<cloud-backup>"), xml.indexOf("</cloud-backup>"));
    const device = xml.slice(xml.indexOf("<device-transfer>"), xml.indexOf("</device-transfer>"));
    for (const domain of DOMAINS) {
      expect(cloud).toContain(`<exclude domain="${domain}" path="." />`);
      expect(device).toContain(`<exclude domain="${domain}" path="." />`);
    }
  });

  it("covers the database, files, preferences and their device-protected twins", () => {
    for (const domain of ["database", "file", "sharedpref", "root", "device_database", "device_file"]) {
      expect(DOMAINS).toContain(domain);
    }
  });

  it("includes nothing", () => {
    expect(xml).not.toContain("<include");
  });
});

describe("pointManifestAtRules", () => {
  const manifest = () => ({
    manifest: { application: [{ $: { "android:name": ".MainApplication", "android:allowBackup": "false" } }] },
  });

  it("points the application at the rules and keeps cloud backup off", () => {
    const out = pointManifestAtRules(manifest());
    const app = out.manifest.application?.[0]?.$;
    expect(app?.["android:dataExtractionRules"]).toBe(RULES_RESOURCE);
    expect(app?.["android:allowBackup"]).toBe("false");
  });

  it("is idempotent", () => {
    const once = pointManifestAtRules(manifest());
    expect(pointManifestAtRules(once)).toEqual(once);
  });

  it("fails loudly on a manifest without an application", () => {
    expect(() => pointManifestAtRules({ manifest: {} })).toThrow(/application/);
  });
});

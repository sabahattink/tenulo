/**
 * Tenulo's data leaves the phone only when the user exports it (AGENTS.md, the privacy policy and
 * the Play data-safety answers all say so). `android:allowBackup="false"` alone no longer
 * guarantees that: for apps targeting Android 12 (API 31) or higher it turns off cloud backup but
 * not device-to-device transfer, which would copy the database to a new phone during setup.
 *
 * This plugin writes res/xml/data_extraction_rules.xml, excluding every storage domain from both
 * cloud backup and device transfer, and points the manifest's `android:dataExtractionRules` at it.
 * allowBackup stays false (app.json) for Android 11 and lower.
 */
const fs = require("fs");
const path = require("path");
const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");

/** Every domain Android backup knows, including the device-protected storage twins. */
const DOMAINS = [
  "root",
  "file",
  "database",
  "sharedpref",
  "external",
  "device_root",
  "device_file",
  "device_database",
  "device_sharedpref",
];

const RULES_RESOURCE = "@xml/data_extraction_rules";
const RULES_FILE = path.join("app", "src", "main", "res", "xml", "data_extraction_rules.xml");

function dataExtractionRulesXml() {
  const excludes = DOMAINS.map((d) => `    <exclude domain="${d}" path="." />`).join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- Written by plugins/with-no-data-extraction.js: nothing leaves the phone by backup or transfer. -->
<data-extraction-rules>
  <cloud-backup>
${excludes}
  </cloud-backup>
  <device-transfer>
${excludes}
  </device-transfer>
</data-extraction-rules>
`;
}

/** Sets `android:dataExtractionRules` on the <application> element; idempotent. */
function pointManifestAtRules(manifest) {
  const app = manifest.manifest.application?.[0];
  if (app === undefined) throw new Error("with-no-data-extraction: the manifest has no <application>");
  app.$ = { ...app.$, "android:dataExtractionRules": RULES_RESOURCE };
  return manifest;
}

function withNoDataExtraction(config) {
  config = withAndroidManifest(config, (mod) => {
    mod.modResults = pointManifestAtRules(mod.modResults);
    return mod;
  });
  return withDangerousMod(config, [
    "android",
    (mod) => {
      const file = path.join(mod.modRequest.platformProjectRoot, RULES_FILE);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, dataExtractionRulesXml());
      return mod;
    },
  ]);
}

module.exports = withNoDataExtraction;
module.exports.DOMAINS = DOMAINS;
module.exports.RULES_RESOURCE = RULES_RESOURCE;
module.exports.dataExtractionRulesXml = dataExtractionRulesXml;
module.exports.pointManifestAtRules = pointManifestAtRules;

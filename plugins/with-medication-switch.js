/**
 * The medication switch (`expo.extra.medication` in app.json) hides the medication features in
 * JS. Android also starts Tenulo's reminder receiver without the JS runtime (boot, app update),
 * so the switch is copied into the manifest as meta-data `tenulo.medication` for Kotlin to read.
 * Without it, an update from a build that had an injection reminder armed would show that
 * notification before the user opens the app.
 */
const { withAndroidManifest } = require("expo/config-plugins");

const META_NAME = "tenulo.medication";

/** Puts exactly one `tenulo.medication` meta-data under <application>; idempotent. */
function medicationMetaData(manifest, medication) {
  const [application, ...rest] = manifest.manifest.application;
  const others = (application["meta-data"] ?? []).filter((d) => d.$["android:name"] !== META_NAME);
  return {
    ...manifest,
    manifest: {
      ...manifest.manifest,
      application: [
        {
          ...application,
          "meta-data": [...others, { $: { "android:name": META_NAME, "android:value": String(medication) } }],
        },
        ...rest,
      ],
    },
  };
}

function withMedicationSwitch(config) {
  const medication = config.extra?.medication;
  if (typeof medication !== "boolean") {
    throw new Error("expo.extra.medication in app.json must be true or false");
  }
  return withAndroidManifest(config, (mod) => {
    mod.modResults = medicationMetaData(mod.modResults, medication);
    return mod;
  });
}

module.exports = withMedicationSwitch;
module.exports.META_NAME = META_NAME;
module.exports.medicationMetaData = medicationMetaData;

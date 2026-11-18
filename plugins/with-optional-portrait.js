/**
 * Tenulo runs in portrait only (`"orientation": "portrait"` in app.json), so the main activity gets
 * `android:screenOrientation="portrait"`. Google Play reads that as an implied, required
 * `android.hardware.screen.portrait` feature and hides the app from devices that do not report it
 * (some tablets, desktops, Android XR); Play Console's pre-review check flags it.
 *
 * Declaring the feature with `android:required="false"` lifts that filter. The app still asks for
 * portrait; devices without it show the portrait layout as they would for any portrait-locked app.
 */
const { withAndroidManifest } = require("expo/config-plugins");

const FEATURE = "android.hardware.screen.portrait";

/** Puts exactly one optional portrait-screen declaration in the manifest; idempotent. */
function optionalPortrait(manifest) {
  const others = (manifest.manifest["uses-feature"] ?? []).filter((f) => f.$["android:name"] !== FEATURE);
  return {
    ...manifest,
    manifest: {
      ...manifest.manifest,
      "uses-feature": [...others, { $: { "android:name": FEATURE, "android:required": "false" } }],
    },
  };
}

function withOptionalPortrait(config) {
  return withAndroidManifest(config, (mod) => {
    mod.modResults = optionalPortrait(mod.modResults);
    return mod;
  });
}

module.exports = withOptionalPortrait;
module.exports.FEATURE = FEATURE;
module.exports.optionalPortrait = optionalPortrait;

/**
 * Every install carries both of Tenulo's languages.
 *
 * Play splits an app bundle by language and installs only the phone's system language. Tenulo
 * lets the user pick Turkish or English in Settings, whatever the phone's language, so a phone in
 * English must still have the Turkish resources (and the other way round): Android's own strings,
 * the reminder notifications and the dialogs come from them. The split is turned off; the cost is a
 * few kilobytes.
 */
const { withAppBuildGradle } = require("expo/config-plugins");

const MARKER = "// tenulo: both languages in every install (plugins/with-bundle-languages.js)";

const BLOCK = `
${MARKER}
android {
    bundle {
        language {
            enableSplit = false
        }
    }
}
`;

/** Appends the bundle block to android/app/build.gradle once; a second prebuild leaves it as is. */
function keepAllLanguages(contents) {
  if (contents.includes(MARKER)) return contents;
  return contents + BLOCK;
}

function withBundleLanguages(config) {
  return withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = keepAllLanguages(mod.modResults.contents);
    return mod;
  });
}

module.exports = withBundleLanguages;
module.exports.keepAllLanguages = keepAllLanguages;
module.exports.MARKER = MARKER;

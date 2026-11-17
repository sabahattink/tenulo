/**
 * Release builds are signed with the owner's upload key, read from Gradle properties outside the
 * repo (normally ~/.gradle/gradle.properties):
 *
 *   TENULO_UPLOAD_STORE_FILE=C:/Users/<you>/keystores/tenulo-upload.jks
 *   TENULO_UPLOAD_STORE_PASSWORD=...
 *   TENULO_UPLOAD_KEY_ALIAS=tenulo-upload
 *   TENULO_UPLOAD_KEY_PASSWORD=...
 *
 * Play App Signing re-signs what is uploaded with Google's own key; this one only proves the upload
 * came from the owner. Nothing secret is in the repo or in android/ (generated).
 *
 * A release build without those properties stops with an error rather than quietly signing with
 * the debug key. The one exception is asked for by name: `-PtenuloDebugSignedRelease=true` signs a
 * local release APK with the debug key, so it installs over a dev build and keeps its data (how the
 * store screenshots are taken; docs/release-checklist.md).
 */
const { withAppBuildGradle } = require("expo/config-plugins");

const MARKER = "// tenulo: release signing (plugins/with-release-signing.js)";

const BLOCK = `
${MARKER}
def debugSigned = findProperty('tenuloDebugSignedRelease') == 'true'
def uploadStore = findProperty('TENULO_UPLOAD_STORE_FILE')
def wantsRelease = gradle.startParameter.taskNames.any { it.toLowerCase().contains('release') }
if (wantsRelease && !debugSigned) {
    if (!uploadStore || !file(uploadStore).exists()) {
        throw new GradleException(
            "Release signing needs the upload key: set TENULO_UPLOAD_STORE_FILE, TENULO_UPLOAD_STORE_PASSWORD, " +
            "TENULO_UPLOAD_KEY_ALIAS and TENULO_UPLOAD_KEY_PASSWORD in ~/.gradle/gradle.properties " +
            "(docs/release-checklist.md), or pass -PtenuloDebugSignedRelease=true for a local test APK."
        )
    }
}
android {
    signingConfigs {
        tenuloUpload {
            if (uploadStore) {
                storeFile file(uploadStore)
                storePassword findProperty('TENULO_UPLOAD_STORE_PASSWORD')
                keyAlias findProperty('TENULO_UPLOAD_KEY_ALIAS')
                keyPassword findProperty('TENULO_UPLOAD_KEY_PASSWORD')
            }
        }
    }
    buildTypes {
        release {
            signingConfig debugSigned ? signingConfigs.debug : signingConfigs.tenuloUpload
        }
    }
}
`;

/** Appends the signing block to android/app/build.gradle once; a second prebuild leaves it as is. */
function addReleaseSigning(contents) {
  if (contents.includes(MARKER)) return contents;
  return contents + BLOCK;
}

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = addReleaseSigning(mod.modResults.contents);
    return mod;
  });
}

module.exports = withReleaseSigning;
module.exports.addReleaseSigning = addReleaseSigning;
module.exports.MARKER = MARKER;

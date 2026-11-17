import { describe, expect, it } from "vitest";
import { MARKER, addReleaseSigning } from "./with-release-signing";

const TEMPLATE = `apply plugin: "com.android.application"

android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
        }
    }
}
`;

describe("addReleaseSigning", () => {
  it("keeps the template and appends one signing block", () => {
    const out = addReleaseSigning(TEMPLATE);
    expect(out.startsWith(TEMPLATE)).toBe(true);
    expect(out.split(MARKER).length - 1).toBe(1);
  });

  it("is idempotent: a second prebuild does not add a second block", () => {
    const once = addReleaseSigning(TEMPLATE);
    expect(addReleaseSigning(once)).toBe(once);
  });

  it("reads the upload key from Gradle properties, never from the repo", () => {
    const out = addReleaseSigning(TEMPLATE);
    for (const name of ["TENULO_UPLOAD_STORE_FILE", "TENULO_UPLOAD_STORE_PASSWORD", "TENULO_UPLOAD_KEY_ALIAS", "TENULO_UPLOAD_KEY_PASSWORD"]) {
      expect(out).toContain(`findProperty('${name}')`);
    }
    expect(out).toContain("signingConfig debugSigned ? signingConfigs.debug : signingConfigs.tenuloUpload");
  });

  it("stops a release build that has no upload key, instead of signing it with the debug key", () => {
    const out = addReleaseSigning(TEMPLATE);
    expect(out).toContain("throw new GradleException");
    expect(out).toContain("tenuloDebugSignedRelease");
  });
});

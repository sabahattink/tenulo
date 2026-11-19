import { describe, expect, it } from "vitest";
import { launchRoute } from "./launch-route";

const RATIONALE = "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE";
const USAGE = "android.intent.action.VIEW_PERMISSION_USAGE";

describe("launchRoute", () => {
  it.each([true, false])("opens the privacy screen for Health Connect rationale (medication=%s)", (m) => {
    expect(launchRoute({ action: RATIONALE, reminder: null }, m)).toBe("/privacy");
    expect(launchRoute({ action: USAGE, reminder: null }, m)).toBe("/privacy");
  });

  it("opens the injection log for the injection reminder only when medication is on", () => {
    expect(launchRoute({ action: null, reminder: "injection" }, true)).toBe("/log-injection");
    expect(launchRoute({ action: null, reminder: "injection" }, false)).toBeUndefined();
  });

  it.each([true, false])("opens add-weight for the weigh-in reminder (medication=%s)", (m) => {
    expect(launchRoute({ action: null, reminder: "weigh-in" }, m)).toBe("/add-weight");
  });

  it("ignores unknown launches", () => {
    expect(launchRoute({ action: "x", reminder: "y" }, true)).toBeUndefined();
    expect(launchRoute({ action: null, reminder: null }, true)).toBeUndefined();
  });
});

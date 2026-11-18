import { describe, expect, it } from "vitest";
import { quickActions } from "./actions";

describe("quickActions", () => {
  it("offers the six actions when medication is on", () => {
    expect(quickActions(true).map((a) => a.action)).toEqual(["food", "water", "weight", "measurement", "exercise", "sideEffect"]);
  });

  it("drops sideEffect when medication is off", () => {
    expect(quickActions(false).map((a) => a.action)).toEqual(["food", "water", "weight", "measurement", "exercise"]);
  });
});

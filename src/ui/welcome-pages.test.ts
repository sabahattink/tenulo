import { describe, expect, it } from "vitest";
import { welcomePages } from "./welcome-pages";

describe("welcomePages", () => {
  it("lists the four pages when medication is on", () => {
    expect(welcomePages(true)).toEqual(["trend", "plan", "food", "private"]);
  });

  it("leaves the plan page out when medication is off", () => {
    expect(welcomePages(false)).toEqual(["trend", "food", "private"]);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

interface AppJson {
  expo: { extra?: { medication?: unknown }; android: { versionCode?: unknown } };
}

const app = JSON.parse(readFileSync(join(__dirname, "..", "app.json"), "utf8")) as AppJson;

describe("app.json", () => {
  it("ships the narrow build: expo.extra.medication is false", () => {
    expect(app.expo.extra?.medication).toBe(false);
  });

  it("has versionCode 5", () => {
    expect(app.expo.android.versionCode).toBe(5);
  });
});

import { describe, expect, it } from "vitest";
import { INJECTION_SITES } from "../domain/injection";
import { BODY_ZONES, type Target, siteTargets } from "./body-map-geometry";

const overlaps = (a: Target, b: Target) =>
  a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;

describe("siteTargets", () => {
  it("has one target per injection site", () => {
    expect(siteTargets(1).map((t) => t.site).sort()).toEqual([...INJECTION_SITES].sort());
  });

  it("never lets two targets overlap, at any size the map is drawn", () => {
    for (let scale = 0.5; scale <= 2; scale += 0.05) {
      const targets = siteTargets(scale);
      for (const a of targets) {
        for (const b of targets) {
          if (a !== b) expect(overlaps(a, b), `${a.site} / ${b.site} at ${scale.toFixed(2)}`).toBe(false);
        }
      }
    }
  });

  it("keeps each zone's centre inside its own target", () => {
    for (const scale of [0.6, 0.85, 1, 1.4]) {
      for (const t of siteTargets(scale)) {
        const z = BODY_ZONES[t.site];
        expect(z.cx * scale).toBeGreaterThan(t.left);
        expect(z.cx * scale).toBeLessThan(t.left + t.width);
        expect(z.cy * scale).toBeGreaterThan(t.top);
        expect(z.cy * scale).toBeLessThan(t.top + t.height);
      }
    }
  });

  it("grows small zones toward the minimum touch size", () => {
    const arm = siteTargets(1).find((t) => t.site === "arm-left");
    expect(arm?.width).toBe(48);
    expect(arm?.height).toBeGreaterThanOrEqual(44);
  });
});

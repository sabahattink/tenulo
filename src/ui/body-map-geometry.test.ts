import { describe, expect, it } from "vitest";
import { BODY_FIGURES } from "../domain/body-figure";
import { INJECTION_SITES } from "../domain/injection";
import { BODY_ZONES, FIGURE_H, FIGURE_W, MIN_TARGET, type Target, siteTargets } from "./body-map-geometry";

const overlaps = (a: Target, b: Target) =>
  a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;

/** The figure is drawn about 200 to 320 dp wide: 0.4 to 0.63 dp per picture pixel. */
const SCALES = Array.from({ length: 19 }, (_, i) => 0.3 + i * 0.05);

describe.each(BODY_FIGURES)("siteTargets on the %s figure", (figure) => {
  it("has one target per injection site", () => {
    expect(siteTargets(figure, 0.5).map((t) => t.site).sort()).toEqual([...INJECTION_SITES].sort());
  });

  it("never lets two targets overlap, at any size the map is drawn", () => {
    for (const scale of SCALES) {
      const targets = siteTargets(figure, scale);
      for (const a of targets) {
        for (const b of targets) {
          if (a !== b) expect(overlaps(a, b), `${a.site} / ${b.site} at ${scale.toFixed(2)}`).toBe(false);
        }
      }
    }
  });

  it("keeps each zone's centre inside its own target", () => {
    for (const scale of SCALES) {
      for (const t of siteTargets(figure, scale)) {
        const z = BODY_ZONES[figure][t.site];
        expect(z.cx * scale).toBeGreaterThan(t.left);
        expect(z.cx * scale).toBeLessThan(t.left + t.width);
        expect(z.cy * scale).toBeGreaterThan(t.top);
        expect(z.cy * scale).toBeLessThan(t.top + t.height);
      }
    }
  });

  it("grows each arm's narrow zone to about a finger's width", () => {
    // The arm and the belly are close together; where their targets meet, the split takes a little.
    for (const site of ["arm-left", "arm-right"] as const) {
      const arm = siteTargets(figure, 0.5).find((t) => t.site === site);
      expect(arm?.width).toBeGreaterThanOrEqual(40);
      expect(arm?.width).toBeLessThanOrEqual(MIN_TARGET);
      expect(arm?.height).toBeGreaterThanOrEqual(MIN_TARGET - 8);
    }
  });

  it("draws every zone inside the picture", () => {
    for (const z of Object.values(BODY_ZONES[figure])) {
      expect(z.cx - z.rx).toBeGreaterThan(0);
      expect(z.cx + z.rx).toBeLessThan(FIGURE_W);
      expect(z.cy - z.ry).toBeGreaterThan(0);
      expect(z.cy + z.ry).toBeLessThan(FIGURE_H);
    }
  });

  it("is a front view: the person's right side is on the viewer's left", () => {
    const zones = BODY_ZONES[figure];
    expect(zones["arm-right"].cx).toBeLessThan(zones["arm-left"].cx);
    expect(zones["abdomen-right"].cx).toBeLessThan(zones["abdomen-left"].cx);
    expect(zones["thigh-right"].cx).toBeLessThan(zones["thigh-left"].cx);
  });

  it("keeps the body's order from top to bottom: arms, then belly, then thighs", () => {
    const zones = BODY_ZONES[figure];
    expect(zones["arm-left"].cy).toBeLessThan(zones["abdomen-left"].cy + zones["abdomen-left"].ry);
    expect(zones["abdomen-left"].cy).toBeLessThan(zones["thigh-left"].cy);
  });
});

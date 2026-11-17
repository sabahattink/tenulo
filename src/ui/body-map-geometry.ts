import type { BodyFigure } from "../domain/body-figure";
import type { InjectionSite } from "../domain/injection";

/**
 * The two figures (assets/illustrations/body-female.webp and body-male.webp) are drawn on a
 * 504 x 1200 picture, seen from the front: the person's LEFT side is on the viewer's RIGHT, so
 * "abdomen-left" sits right of centre. Zones are ellipses in picture pixels, placed by hand on each
 * figure: the upper arm below the sleeve, either side of the navel, the front of each thigh.
 */
export const FIGURE_W = 504;
export const FIGURE_H = 1200;

export interface Zone {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
}

export const BODY_ZONES: Readonly<Record<BodyFigure, Readonly<Record<InjectionSite, Zone>>>> = {
  female: {
    "arm-right": { cx: 146, cy: 410, rx: 22, ry: 48 },
    "arm-left": { cx: 364, cy: 410, rx: 22, ry: 48 },
    "abdomen-right": { cx: 215, cy: 460, rx: 26, ry: 32 },
    "abdomen-left": { cx: 287, cy: 460, rx: 26, ry: 32 },
    "thigh-right": { cx: 205, cy: 690, rx: 30, ry: 54 },
    "thigh-left": { cx: 300, cy: 690, rx: 30, ry: 54 },
  },
  male: {
    "arm-right": { cx: 121, cy: 440, rx: 22, ry: 48 },
    "arm-left": { cx: 386, cy: 440, rx: 22, ry: 48 },
    "abdomen-right": { cx: 215, cy: 485, rx: 28, ry: 32 },
    "abdomen-left": { cx: 290, cy: 485, rx: 28, ry: 32 },
    "thigh-right": { cx: 198, cy: 690, rx: 32, ry: 54 },
    "thigh-left": { cx: 312, cy: 690, rx: 32, ry: 54 },
  },
};

/** Viewer's left to right, top to bottom: the order a screen reader walks the map. */
export const ZONE_ORDER: readonly InjectionSite[] = [
  "arm-right",
  "arm-left",
  "abdomen-right",
  "abdomen-left",
  "thigh-right",
  "thigh-left",
];

/** Minimum touch target in density-independent pixels (Android guideline). */
export const MIN_TARGET = 48;

export interface Target {
  readonly site: InjectionSite;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

interface Box {
  site: InjectionSite;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Touch targets laid over the figure's zones at `scale` (dp per picture pixel). Each zone is grown to the
 * minimum touch size, then any two targets that would overlap are split at the middle of their
 * overlap, along the axis where they overlap least. A tap therefore always lands on exactly one
 * site: two sites a finger-width apart can never both claim it.
 */
export function siteTargets(figure: BodyFigure, scale: number, minTarget: number = MIN_TARGET): Target[] {
  const zones = BODY_ZONES[figure];
  const boxes: Box[] = ZONE_ORDER.map((site) => {
    const z = zones[site];
    const w = Math.max(z.rx * 2 * scale, minTarget);
    const h = Math.max(z.ry * 2 * scale, minTarget);
    const cx = z.cx * scale;
    const cy = z.cy * scale;
    return { site, x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
  });

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (a === undefined || b === undefined) continue;
      const overlapW = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const overlapH = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      if (overlapW <= 0 || overlapH <= 0) continue;
      if (overlapW <= overlapH) {
        const mid = (Math.max(a.x0, b.x0) + Math.min(a.x1, b.x1)) / 2;
        const [leftBox, rightBox] = a.x0 + a.x1 <= b.x0 + b.x1 ? [a, b] : [b, a];
        leftBox.x1 = mid;
        rightBox.x0 = mid;
      } else {
        const mid = (Math.max(a.y0, b.y0) + Math.min(a.y1, b.y1)) / 2;
        const [upper, lower] = a.y0 + a.y1 <= b.y0 + b.y1 ? [a, b] : [b, a];
        upper.y1 = mid;
        lower.y0 = mid;
      }
    }
  }

  return boxes.map((b) => ({ site: b.site, left: b.x0, top: b.y0, width: b.x1 - b.x0, height: b.y1 - b.y0 }));
}

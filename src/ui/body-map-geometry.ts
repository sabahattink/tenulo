import type { InjectionSite } from "../domain/injection";

/**
 * Front view of a body, drawn in a 200 x 420 box. Front view means the person's LEFT side is on
 * the viewer's RIGHT, so "abdomen-left" sits right of centre.
 */
export const VIEW_W = 200;
export const VIEW_H = 420;

export interface Zone {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
}

export const BODY_ZONES: Record<InjectionSite, Zone> = {
  "arm-right": { cx: 44, cy: 122, rx: 10, ry: 22 },
  "arm-left": { cx: 156, cy: 122, rx: 10, ry: 22 },
  "abdomen-right": { cx: 84, cy: 168, rx: 13, ry: 20 },
  "abdomen-left": { cx: 116, cy: 168, rx: 13, ry: 20 },
  "thigh-right": { cx: 85, cy: 262, rx: 12, ry: 28 },
  "thigh-left": { cx: 115, cy: 262, rx: 12, ry: 28 },
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
 * Touch targets laid over the zones at `scale` (pixels per view unit). Each zone is grown to the
 * minimum touch size, then any two targets that would overlap are split at the middle of their
 * overlap, along the axis where they overlap least. A tap therefore always lands on exactly one
 * site: two sites a finger-width apart can never both claim it.
 */
export function siteTargets(scale: number, minTarget: number = MIN_TARGET): Target[] {
  const boxes: Box[] = ZONE_ORDER.map((site) => {
    const z = BODY_ZONES[site];
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

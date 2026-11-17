/**
 * Tenulo's colors as plain data, with no React Native import, so their contrast is unit-tested
 * (palette.test.ts). `theme.ts` turns them into the theme the screens use.
 *
 * The world: a clean, faintly sage-tinted white with white cards, deep sage for the brand and
 * the primary action, a terracotta for "needs attention". (Until the 1.1 refresh the background
 * was a warm beige paper; it read as dated, and the cards now carry the warmth instead.) Each kind of record also has its own hue, so a glance tells food from water from an
 * injection: an `ink` for icons, rings and text, and a `soft` tint to sit behind them. Every ink
 * reads at 4.5:1 or more on the background, on cards and on its own tint, in both schemes.
 */

export const KINDS = ["weight", "food", "protein", "water", "injection", "measurement", "exercise", "sideEffect"] as const;
export type Kind = (typeof KINDS)[number];

export interface KindColors {
  /** Icons, ring strokes and colored text. */
  readonly ink: string;
  /** A light tint (a deep one in the dark theme) behind ink-colored content. */
  readonly soft: string;
}

export const LIGHT = {
  background: "#F3F6F4",
  card: "#FFFFFF",
  /** Recessed surfaces: segmented controls, chips, progress tracks. */
  surfaceAlt: "#E8EDEA",
  /** Lifted out of a recessed surface: the selected segment. Lighter than surfaceAlt in both schemes. */
  raised: "#FFFFFF",
  /** Accent tint behind accent-colored content. */
  accentSoft: "#DCEBE5",
  border: "#DEE4E0",
  text: "#1C211E",
  muted: "#5B615C",
  accent: "#2F6B5B",
  accentText: "#FFFFFF",
  trend: "#2F6B5B",
  reading: "#A9B4AE",
  goal: "#A4552C",
  warn: "#A4552C",
  danger: "#B3261E",
  tabBar: "#FFFFFF",
  /** A soft sage that fades into the background behind each tab's title (and under the status bar). */
  wash: "#E1EEE7",
  /**
   * Switch when off (on is accent with an accentText thumb). Track >= 3:1 on card, thumb >= 3:1
   * on the track, in both schemes, so the off state stays visible (WCAG 1.4.11).
   */
  switchOffTrack: "#5B615C",
  switchOffThumb: "#FFFFFF",
} as const;

export type BaseColors = { readonly [K in keyof typeof LIGHT]: string };

export const DARK: BaseColors = {
  background: "#101412",
  card: "#191E1B",
  surfaceAlt: "#232A26",
  raised: "#36403B",
  accentSoft: "#1F3A32",
  border: "#2A312D",
  text: "#ECEFEC",
  muted: "#A3ABA5",
  accent: "#7FC2AE",
  accentText: "#0E1A16",
  trend: "#7FC2AE",
  reading: "#4F5A54",
  goal: "#E8A27A",
  warn: "#E8A27A",
  danger: "#F2B8B5",
  tabBar: "#141916",
  wash: "#16241E",
  switchOffTrack: "#6B7670",
  switchOffThumb: "#ECEFEC",
};

/**
 * Hues spread around the wheel and chosen from what they stand for: sage is the brand and the
 * weight trend, honey for food, berry for protein, water blue, indigo for the injection, the teal
 * of a tape measure, coral for moving, a muted mauve for how the body feels.
 */
export const LIGHT_KINDS: Readonly<Record<Kind, KindColors>> = {
  weight: { ink: "#2F6B5B", soft: "#DCEBE5" },
  food: { ink: "#93560A", soft: "#F7E7CC" },
  protein: { ink: "#A3365F", soft: "#F6DDE6" },
  water: { ink: "#1F64A3", soft: "#DCEAF7" },
  injection: { ink: "#5A4CB0", soft: "#E6E2F7" },
  measurement: { ink: "#0B6872", soft: "#D5EDEF" },
  exercise: { ink: "#AF441C", soft: "#FBE1D4" },
  sideEffect: { ink: "#87437D", soft: "#F1E0EE" },
};

/** Lighter inks over deep tints: composed for the dark theme, not inverted from the light one. */
export const DARK_KINDS: Readonly<Record<Kind, KindColors>> = {
  weight: { ink: "#7FC2AE", soft: "#1F3A32" },
  food: { ink: "#E8B25A", soft: "#3A2D15" },
  protein: { ink: "#EE93B4", soft: "#3E2230" },
  water: { ink: "#86BDF0", soft: "#1B3047" },
  injection: { ink: "#B3A8F2", soft: "#2A2645" },
  measurement: { ink: "#6CCBD5", soft: "#163A3E" },
  exercise: { ink: "#F29B76", soft: "#43261A" },
  sideEffect: { ink: "#DB9FD2", soft: "#3A2338" },
};

/**
 * Raised cards in the light theme: a soft, offset shadow, faintly green like the background,
 * instead of an outline. The dark
 * theme has no shadow; its cards are lifted by tone (card is lighter than the background).
 */
export const LIGHT_SHADOW = "0px 1px 2px rgba(20, 40, 32, 0.06), 0px 6px 18px rgba(20, 40, 32, 0.07)";

function channel(hex: string, at: number): number {
  const c = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

/** WCAG 2.x contrast ratio of two "#RRGGBB" colors, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

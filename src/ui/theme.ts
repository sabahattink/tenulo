import { type TextStyle, useColorScheme } from "react-native";

/**
 * Calm, non-clinical palette: warm paper, deep sage, a terracotta for "needs attention".
 * Every color the UI uses comes from here, in both schemes. Measured WCAG contrast:
 * text, muted, accent, danger >= 5:1 on every surface; warn >= 4.7:1 on background and card
 * (use it only there).
 */
const light = {
  background: "#F4F1EA",
  card: "#FFFFFF",
  /** Recessed surfaces: segmented controls, chips, progress tracks. */
  surfaceAlt: "#ECE8DF",
  /** Accent tint behind accent-colored content. */
  accentSoft: "#DCEBE5",
  border: "#E3DFD6",
  text: "#1C211E",
  muted: "#5B615C",
  accent: "#2F6B5B",
  accentText: "#FFFFFF",
  trend: "#2F6B5B",
  reading: "#A9B4AE",
  goal: "#A4552C",
  warn: "#A4552C",
  danger: "#B3261E",
  tabBar: "#FBF9F5",
} as const;

const dark: { [K in keyof typeof light]: string } = {
  background: "#101412",
  card: "#191E1B",
  surfaceAlt: "#232A26",
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
};

export type Theme = { readonly [K in keyof typeof light]: string };

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;
export const radius = { s: 8, m: 14, l: 22, pill: 999 } as const;

/** Type scale. Numbers use tabular figures so values do not jump as they change. */
export const type = {
  display: { fontSize: 60, lineHeight: 64, fontWeight: "700", letterSpacing: -1.5, fontVariant: ["tabular-nums"] },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "700", letterSpacing: -0.4 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: "700" },
  body: { fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  small: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "600", letterSpacing: 0.7, textTransform: "uppercase" },
  number: { fontSize: 16, fontWeight: "600", fontVariant: ["tabular-nums"] },
} as const satisfies Record<string, TextStyle>;

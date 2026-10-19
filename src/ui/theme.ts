import { useColorScheme } from "react-native";

/**
 * Calm, non-clinical palette. Every color the UI uses comes from here, in both schemes.
 * Contrast of `text`/`muted` on `background`/`card` stays at or above WCAG AA (4.5:1).
 */
const light = {
  background: "#F6F4EF",
  card: "#FFFFFF",
  border: "#E3DFD6",
  text: "#1E2320",
  muted: "#5D635E",
  accent: "#2F6B5B",
  accentText: "#FFFFFF",
  trend: "#2F6B5B",
  reading: "#A9B4AE",
  goal: "#C0784E",
  danger: "#B3261E",
} as const;

const dark: { [K in keyof typeof light]: string } = {
  background: "#121513",
  card: "#1B1F1C",
  border: "#2C322E",
  text: "#ECEFEC",
  muted: "#A3ABA5",
  accent: "#7FC2AE",
  accentText: "#0E1A16",
  trend: "#7FC2AE",
  reading: "#55605A",
  goal: "#E3A27C",
  danger: "#F2B8B5",
};

export type Theme = { readonly [K in keyof typeof light]: string };

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;
export const radius = { s: 8, m: 14, l: 20 } as const;

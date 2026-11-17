import { type TextStyle, useColorScheme } from "react-native";

import {
  type BaseColors,
  DARK,
  DARK_KINDS,
  type Kind,
  type KindColors,
  LIGHT,
  LIGHT_KINDS,
  LIGHT_SHADOW,
} from "./palette";

export type { Kind, KindColors } from "./palette";

/**
 * Every color the UI uses, in both schemes: the base roles, one ink-and-tint pair per kind of
 * record, and the card shadow (light theme only). The values and their contrast live in
 * palette.ts.
 */
export type Theme = BaseColors & {
  readonly kinds: Readonly<Record<Kind, KindColors>>;
  /** `boxShadow` for raised cards, or undefined where cards are lifted by tone instead. */
  readonly shadow: string | undefined;
};

const lightTheme: Theme = { ...LIGHT, kinds: LIGHT_KINDS, shadow: LIGHT_SHADOW };
const darkTheme: Theme = { ...DARK, kinds: DARK_KINDS, shadow: undefined };

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? darkTheme : lightTheme;
}

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;
export const radius = { s: 8, m: 14, l: 22, pill: 999 } as const;

/**
 * Type scale. Numbers use tabular figures so values do not jump as they change.
 *
 * `caption` text is upper-cased by the caller with `f.upper` (src/i18n), not with textTransform:
 * Android upper-cases in the phone's locale, which writes English "i" as "İ" on a Turkish phone
 * and Turkish "i" as "I" on an English one.
 */
export const type = {
  display: { fontSize: 60, lineHeight: 64, fontWeight: "700", letterSpacing: -1.5, fontVariant: ["tabular-nums"] },
  title: { fontSize: 32, lineHeight: 38, fontWeight: "800", letterSpacing: -0.8 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: "700" },
  body: { fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  small: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "600", letterSpacing: 0.7 },
  number: { fontSize: 16, fontWeight: "600", fontVariant: ["tabular-nums"] },
} as const satisfies Record<string, TextStyle>;

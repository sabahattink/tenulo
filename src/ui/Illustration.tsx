import { Image, StyleSheet, View, useColorScheme } from "react-native";
import { type Theme, radius } from "./theme";

/**
 * Paper-cut illustrations (made in Canva, assets/illustrations). They are drawn on warm paper,
 * so they sit in a rounded frame like a printed card, slightly dimmed in the dark theme.
 */
const SOURCES = {
  trend: require("../../assets/illustrations/trend.webp"),
  plan: require("../../assets/illustrations/plan.webp"),
  private: require("../../assets/illustrations/private.webp"),
} as const;

export type IllustrationName = keyof typeof SOURCES;

export function Illustration({ name, theme, size }: { name: IllustrationName; theme: Theme; size: number }) {
  const dark = useColorScheme() === "dark";
  return (
    <View
      style={[styles.frame, { width: size, height: size, borderColor: theme.border }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Image source={SOURCES[name]} style={{ width: size, height: size, opacity: dark ? 0.88 : 1 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.l, borderWidth: 1, overflow: "hidden" },
});

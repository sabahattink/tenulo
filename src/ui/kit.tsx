import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { type Theme, radius, space } from "./theme";

export function Card({ theme, children, style }: { theme: Theme; children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, style]}>{children}</View>
  );
}

type ButtonKind = "primary" | "secondary" | "danger";

export function Button({
  theme,
  label,
  onPress,
  kind = "primary",
  disabled = false,
}: {
  theme: Theme;
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
}) {
  const bg = kind === "primary" ? theme.accent : "transparent";
  const fg = kind === "primary" ? theme.accentText : kind === "danger" ? theme.danger : theme.accent;
  const border = kind === "primary" ? theme.accent : kind === "danger" ? theme.danger : theme.border;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Label({ theme, children }: { theme: Theme; children: ReactNode }) {
  return <Text style={[styles.label, { color: theme.muted }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.l, padding: space.l, gap: space.s },
  button: {
    minHeight: 48,
    borderRadius: radius.m,
    borderWidth: 1.5,
    paddingHorizontal: space.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontSize: 16, fontWeight: "600" },
  label: { fontSize: 13, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.6 },
});

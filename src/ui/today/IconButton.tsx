import { Pressable, StyleSheet } from "react-native";
import { Icon, type IconName } from "../icons";
import { type Theme, radius } from "../theme";

/** A square, icon-only button the height of a kit Button (50 dp), labelled for screen readers. */
export function IconButton({
  theme,
  icon,
  label,
  hint,
  onPress,
  disabled = false,
}: {
  theme: Theme;
  icon: IconName;
  label: string;
  hint?: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { borderColor: theme.border, backgroundColor: theme.card, opacity: disabled ? 0.45 : pressed ? 0.7 : 1 },
      ]}
    >
      <Icon name={icon} color={theme.accent} size={22} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 50, height: 50, borderRadius: radius.m, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
});

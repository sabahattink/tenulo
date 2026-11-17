import { Pressable, StyleSheet } from "react-native";
import { Icon, type IconName } from "../icons";
import { raisedSurface } from "../kit";
import { type KindColors, type Theme, radius } from "../theme";

/** A square, icon-only button the height of a kit Button (50 dp), labelled for screen readers. */
export function IconButton({
  theme,
  icon,
  label,
  hint,
  onPress,
  disabled = false,
  tint,
}: {
  theme: Theme;
  icon: IconName;
  label: string;
  hint?: string;
  onPress: () => void;
  disabled?: boolean;
  /** Colors of the kind of record the button acts on; the brand accent otherwise. */
  tint?: KindColors;
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
        tint === undefined ? raisedSurface(theme) : { backgroundColor: tint.soft, borderColor: tint.soft },
        { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Icon name={icon} color={tint?.ink ?? theme.accent} size={22} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 50, height: 50, borderRadius: radius.m, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  pressed: { transform: [{ scale: 0.96 }] },
});

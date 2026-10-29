import type { ReactNode } from "react";
import { Pressable, StyleSheet, Switch, Text, View, type ViewStyle } from "react-native";
import { Icon, type IconName } from "./icons";
import { type Theme, radius, space, type } from "./theme";

export function Card({ theme, children, style }: { theme: Theme; children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, style]}>{children}</View>
  );
}

type ButtonKind = "primary" | "secondary" | "danger" | "quiet";

export function Button({
  theme,
  label,
  onPress,
  kind = "primary",
  disabled = false,
  icon,
}: {
  theme: Theme;
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  icon?: IconName;
}) {
  const bg = kind === "primary" ? theme.accent : kind === "quiet" ? theme.accentSoft : "transparent";
  const fg = kind === "primary" ? theme.accentText : kind === "danger" ? theme.danger : theme.accent;
  const border = kind === "primary" ? theme.accent : kind === "danger" ? theme.danger : kind === "quiet" ? theme.accentSoft : theme.border;
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
      {icon && <Icon name={icon} color={fg} size={20} />}
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Label({ theme, children }: { theme: Theme; children: ReactNode }) {
  return <Text style={[type.caption, { color: theme.muted }]}>{children}</Text>;
}

/** Large page title with an optional line above it (e.g. today's date). */
export function ScreenTitle({ theme, title, eyebrow }: { theme: Theme; title: string; eyebrow?: string }) {
  return (
    <View style={styles.screenTitle} accessibilityRole="header">
      {eyebrow !== undefined && <Text style={[type.small, { color: theme.muted }]}>{eyebrow}</Text>}
      <Text style={[type.title, { color: theme.text }]}>{title}</Text>
    </View>
  );
}

/** A titled group of rows inside one card, like an Android settings section. */
export function Section({ theme, title, children, footer }: { theme: Theme; title: string; children: ReactNode; footer?: string }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Label theme={theme}>{title}</Label>
      </View>
      <View style={[styles.sectionBody, { backgroundColor: theme.card, borderColor: theme.border }]}>{children}</View>
      {footer !== undefined && <Text style={[type.small, styles.sectionFooter, { color: theme.muted }]}>{footer}</Text>}
    </View>
  );
}

export function ListRow({
  theme,
  icon,
  title,
  detail,
  onPress,
  right,
  danger = false,
  disabled = false,
  last = false,
}: {
  theme: Theme;
  icon?: IconName;
  title: string;
  detail?: string;
  onPress?: () => void;
  right?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  last?: boolean;
}) {
  const color = danger ? theme.danger : theme.text;
  const body = (
    <>
      {icon && (
        <View style={[styles.rowIcon, { backgroundColor: danger ? "transparent" : theme.accentSoft }]}>
          <Icon name={icon} color={danger ? theme.danger : theme.accent} size={20} />
        </View>
      )}
      <View style={styles.rowText}>
        <Text style={[type.bodyStrong, { color }]}>{title}</Text>
        {detail !== undefined && <Text style={[type.small, { color: theme.muted }]}>{detail}</Text>}
      </View>
      {right ?? (onPress && <Icon name="chevron" color={theme.muted} size={20} />)}
    </>
  );
  const rowStyle = [styles.row, !last && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }];
  if (!onPress) return <View style={rowStyle}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [...rowStyle, { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 }]}
    >
      {body}
    </Pressable>
  );
}

export function SwitchRow({
  theme,
  icon,
  title,
  detail,
  value,
  onChange,
  disabled = false,
  last = false,
}: {
  theme: Theme;
  icon?: IconName;
  title: string;
  detail?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  last?: boolean;
}) {
  return (
    <ListRow
      theme={theme}
      icon={icon}
      title={title}
      detail={detail}
      last={last}
      right={
        <Switch
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          accessibilityLabel={title}
          trackColor={{ false: theme.surfaceAlt, true: theme.accent }}
          thumbColor={theme.card}
        />
      }
    />
  );
}

/** One-of-n choice. Renders as a recessed track with the selected option raised. */
export function Segmented<T extends string | number>({
  theme,
  options,
  value,
  onChange,
  label,
}: {
  theme: Theme;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <View style={[styles.segment, { backgroundColor: theme.surfaceAlt }]} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[styles.segmentItem, selected && [styles.segmentSelected, { backgroundColor: theme.card }]]}
          >
            <Text style={[styles.segmentText, { color: selected ? theme.text : theme.muted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ theme, label, selected, onPress }: { theme: Theme; label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: selected ? theme.accent : theme.border, backgroundColor: selected ? theme.accent : theme.card },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? theme.accentText : theme.text }]}>{label}</Text>
    </Pressable>
  );
}

export function ProBadge({ theme }: { theme: Theme }) {
  return (
    <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
      <Text style={[styles.badgeText, { color: theme.accent }]}>PRO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.l, padding: space.l, gap: space.s },
  button: {
    minHeight: 50,
    borderRadius: radius.m,
    borderWidth: 1.5,
    paddingHorizontal: space.xl,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: space.s,
  },
  buttonText: { fontSize: 16, fontWeight: "600" },
  screenTitle: { gap: 2, paddingTop: space.s, paddingBottom: space.xs },
  section: { gap: space.s },
  sectionHead: { paddingHorizontal: space.xs },
  sectionBody: { borderWidth: 1, borderRadius: radius.l, paddingHorizontal: space.l },
  sectionFooter: { paddingHorizontal: space.xs },
  row: { flexDirection: "row", alignItems: "center", gap: space.m, minHeight: 60, paddingVertical: space.m },
  rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, gap: 2 },
  segment: { flexDirection: "row", borderRadius: radius.m, padding: 3 },
  segmentItem: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.m - 3, paddingHorizontal: space.xs },
  segmentSelected: { elevation: 1, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  segmentText: { fontSize: 14, fontWeight: "600", textAlign: "center" },
  chip: { borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: space.l, minHeight: 40, justifyContent: "center" },
  chipText: { fontSize: 14, fontWeight: "600" },
  badge: { borderRadius: radius.pill, paddingHorizontal: space.s, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
});

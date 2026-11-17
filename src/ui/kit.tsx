import type { ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Switch, Text, View, type ViewStyle, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useI18n } from "@/i18n/provider";
import { Icon, type IconName } from "./icons";
import { type Kind, type KindColors, type Theme, radius, space, type } from "./theme";

/**
 * Bottom padding for a scrolling stack screen. Screens draw edge to edge, so the end of the
 * content must clear the navigation bar, which is twice as tall with three-button navigation.
 */
export function useScrollEndPadding(): number {
  return useSafeAreaInsets().bottom + space.xxl;
}

/** Android draws `boxShadow` from 9 (API 28); before that a card keeps its hairline instead. */
const DRAWS_BOX_SHADOW = Platform.OS !== "android" || Number(Platform.Version) >= 28;

/**
 * The surface of a card: lifted by a soft shadow in the light theme, by tone and a hairline in the
 * dark one (see palette.ts).
 */
export function raisedSurface(theme: Theme): ViewStyle {
  return theme.shadow === undefined || !DRAWS_BOX_SHADOW
    ? { backgroundColor: theme.card, borderColor: theme.border }
    : { backgroundColor: theme.card, borderColor: "transparent", boxShadow: theme.shadow };
}

export function Card({ theme, children, style }: { theme: Theme; children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, raisedSurface(theme), style]}>{children}</View>;
}

/** A kind of record's icon on its own tint: the color that tells food from water at a glance. */
export function KindIcon({ theme, kind, icon, size = 40 }: { theme: Theme; kind: Kind; icon: IconName; size?: number }) {
  const { ink, soft } = theme.kinds[kind];
  return (
    <View style={[styles.kindIcon, { width: size, height: size, borderRadius: size / 2, backgroundColor: soft }]}>
      <Icon name={icon} color={ink} size={Math.round(size * 0.55)} />
    </View>
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
  tint,
}: {
  theme: Theme;
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  icon?: IconName;
  /** For a quiet button that belongs to one kind of record, e.g. the water glass: its ink and tint. */
  tint?: KindColors;
}) {
  const soft = tint?.soft ?? theme.accentSoft;
  const ink = tint?.ink ?? theme.accent;
  const bg = kind === "primary" ? theme.accent : kind === "quiet" ? soft : "transparent";
  const fg = kind === "primary" ? theme.accentText : kind === "danger" ? theme.danger : ink;
  const border = kind === "primary" ? theme.accent : kind === "danger" ? theme.danger : kind === "quiet" ? soft : theme.border;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        pressed && !disabled && styles.pressed,
      ]}
    >
      {icon && <Icon name={icon} color={fg} size={20} />}
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** A small caption, upper-cased with the active language's rules. */
export function Label({ theme, children }: { theme: Theme; children: string }) {
  const { f } = useI18n();
  return <Text style={[type.caption, { color: theme.muted }]}>{f.upper(children)}</Text>;
}

/** A card's caption in its kind's color, after the kind's icon: whose card this is, at a glance. */
export function KindLabel({ theme, kind, icon, children }: { theme: Theme; kind: Kind; icon: IconName; children: string }) {
  const { f } = useI18n();
  return (
    <View style={styles.kindLabel}>
      <KindIcon theme={theme} kind={kind} icon={icon} size={28} />
      <Text style={[type.caption, { color: theme.kinds[kind].ink }]}>{f.upper(children)}</Text>
    </View>
  );
}

/** How far down the screen the title's wash fades out. */
const WASH_HEIGHT = 300;

/**
 * Large page title, with an optional line under it (e.g. the day it shows). Behind it, a soft sage
 * wash runs from under the status bar and fades into the background; it scrolls away with the page.
 * Every tab screen starts with this title inside the same padding (the inset plus space.l on top,
 * space.l at the sides), which the wash reaches back over.
 */
export function ScreenTitle({ theme, title, subtitle }: { theme: Theme; title: string; subtitle?: string }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  return (
    <View style={styles.screenTitle} accessibilityRole="header">
      <Svg
        width={width}
        height={WASH_HEIGHT}
        style={[styles.wash, { top: -(insets.top + space.l) }]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Defs>
          <LinearGradient id="title-wash" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.wash} stopOpacity={1} />
            <Stop offset="0.35" stopColor={theme.wash} stopOpacity={0.85} />
            <Stop offset="1" stopColor={theme.wash} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#title-wash)" />
      </Svg>
      <Text style={[type.title, { color: theme.text }]}>{title}</Text>
      {subtitle !== undefined && <Text style={[styles.subtitle, { color: theme.muted }]}>{subtitle}</Text>}
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
      <View style={[styles.sectionBody, raisedSurface(theme)]}>{children}</View>
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
          trackColor={{ false: theme.switchOffTrack, true: theme.accent }}
          thumbColor={value ? theme.accentText : theme.switchOffThumb}
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
            style={[styles.segmentItem, selected && [styles.segmentSelected, { backgroundColor: theme.raised }]]}
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
  // Pressed controls sink a little, an acknowledgment that does not wait for the next screen.
  pressed: { transform: [{ scale: 0.98 }] },
  kindIcon: { alignItems: "center", justifyContent: "center" },
  kindLabel: { flexDirection: "row", alignItems: "center", gap: space.s },
  screenTitle: { gap: 2, paddingTop: space.s, paddingBottom: space.xs },
  subtitle: { fontSize: 16, lineHeight: 22, fontWeight: "500" },
  wash: { position: "absolute", left: -space.l },
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

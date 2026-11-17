import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { LocalDate } from "@/domain/date";
import { useI18n } from "@/i18n/provider";
import { Icon } from "./icons";
import { type Theme, space, type } from "./theme";
import type { TimelineRow as Row } from "./timeline-rows";

interface Props {
  readonly theme: Theme;
  readonly row: Row;
  readonly now: LocalDate;
  readonly last: boolean;
  readonly onOpen: (row: Row) => void;
  readonly onDelete: (row: Row) => void;
}

/**
 * One History line. A tap opens the day where its records are kept (meals, water); a long press, or
 * the "delete" accessibility action, asks before deleting what the line stands for. Memoized: a
 * month card holds every line of the month, and a write elsewhere must not redraw them all.
 */
export const TimelineRow = memo(function TimelineRow({ theme, row, now, last, onOpen, onDelete }: Props) {
  const { t, f } = useI18n();
  const { ink, soft } = theme.kinds[row.color];
  const when = f.relativeDay(row.date, now);
  const removable = row.remove !== undefined;
  const hint = [row.open?.hint, removable ? t.history.deleteHint : undefined].filter((h) => h !== undefined).join(". ");
  return (
    <Pressable
      onPress={row.open === undefined ? undefined : () => onOpen(row)}
      onLongPress={removable ? () => onDelete(row) : undefined}
      accessibilityRole={row.open === undefined ? undefined : "button"}
      accessibilityHint={hint === "" ? undefined : hint}
      accessibilityActions={removable ? [{ name: "delete", label: t.common.delete }] : undefined}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "delete" && removable) onDelete(row);
      }}
      accessibilityLabel={[row.title, row.detail, when].filter((p) => p !== "").join(", ")}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth },
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: soft }]}>
        <Icon name={row.icon} color={ink} size={20} />
      </View>
      <View style={styles.text}>
        <Text style={[type.bodyStrong, { color: theme.text }]}>{row.title}</Text>
        {row.detail !== "" && (
          <Text style={[type.small, styles.detail, { color: theme.muted }]} numberOfLines={2}>
            {row.detail}
          </Text>
        )}
      </View>
      <Text style={[type.small, { color: theme.muted }]}>{when}</Text>
      {row.open !== undefined && <Icon name="chevron" color={theme.muted} size={18} />}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.m, minHeight: 64, paddingVertical: space.m },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: 2 },
  detail: { fontVariant: ["tabular-nums"] },
});

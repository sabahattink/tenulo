import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { deleteInjection, deleteSideEffect, useActiveMedication, useInjections, useSideEffects } from "@/data/injections";
import { deleteWeight, today, useSettings, useWeightEntries } from "@/data/repo";
import { type LocalDate, parseLocalDate } from "@/domain/date";
import { formatDose } from "@/domain/parse";
import { isSeverity } from "@/domain/side-effect";
import { formatWeight } from "@/domain/weight";
import { SEVERITY_LABELS, SIDE_EFFECT_LABELS, SITE_LABELS, monthTitle, relativeDay } from "@/ui/copy";
import { Icon, type IconName } from "@/ui/icons";
import { Chip, ScreenTitle } from "@/ui/kit";
import { type TimelineFilter, type TimelineItem, timeline } from "@/ui/timeline";
import { type Theme, radius, space, type, useTheme } from "@/ui/theme";

interface Row extends TimelineItem {
  readonly title: string;
  readonly detail: string;
  readonly icon: IconName;
}

const FILTERS: readonly { value: TimelineFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "weight", label: "Weight" },
  { value: "injection", label: "Injections" },
  { value: "side-effect", label: "Side effects" },
];

export default function History() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const now = today();
  const unit = useSettings()?.weightUnit ?? "kg";
  const weights = useWeightEntries();
  const medication = useActiveMedication();
  const shots = useInjections(medication?.id);
  const effects = useSideEffects();
  const [filter, setFilter] = useState<TimelineFilter>("all");

  const sections = useMemo(() => {
    const rows: Row[] = [
      ...weights.map(
        (w): Row => ({
          kind: "weight",
          id: w.id,
          date: parseLocalDate(w.localDate),
          at: w.measuredAt,
          title: formatWeight(w.weightG, unit),
          detail: w.source === "health_connect" ? "From Health Connect" : "Weigh-in",
          icon: "scale",
        }),
      ),
      ...shots.map(
        (s): Row => ({
          kind: "injection",
          id: s.id,
          date: parseLocalDate(s.localDate),
          at: s.takenAt,
          title: `Injection · ${formatDose(s.doseMcg)}`,
          detail: [s.site ? SITE_LABELS[s.site] : "Site not recorded", s.note].filter(Boolean).join(" · "),
          icon: "pen",
        }),
      ),
      ...effects.map(
        (e): Row => ({
          kind: "side-effect",
          id: e.id,
          date: parseLocalDate(e.localDate),
          at: e.createdAt,
          title: SIDE_EFFECT_LABELS[e.type],
          detail: [isSeverity(e.severity) ? SEVERITY_LABELS[e.severity] : "", e.note].filter(Boolean).join(" · "),
          icon: "drop",
        }),
      ),
    ];
    return timeline(rows, filter);
  }, [weights, shots, effects, filter, unit]);

  const confirmDelete = (row: Row) =>
    Alert.alert("Delete this entry?", `${row.title} · ${relativeDay(row.date, now)}`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          void (row.kind === "weight" ? deleteWeight(row.id) : row.kind === "injection" ? deleteInjection(row.id) : deleteSideEffect(row.id)),
      },
    ]);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.l }]}
    >
      <ScreenTitle theme={theme} title="History" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityRole="radiogroup">
        {FILTERS.map((f) => (
          <Chip key={f.value} theme={theme} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
        ))}
      </ScrollView>

      {sections.length === 0 && (
        <View style={styles.empty}>
          <Icon name="calendar" color={theme.muted} size={32} />
          <Text style={[type.body, { color: theme.muted, textAlign: "center" }]}>
            {filter === "all" ? "Nothing logged yet. Your weigh-ins, injections and side effects will appear here." : "Nothing of this kind yet."}
          </Text>
        </View>
      )}

      {sections.map((section) => (
        <View key={section.month} style={styles.section}>
          <Text style={[type.caption, styles.month, { color: theme.muted }]}>
            {monthTitle(parseLocalDate(`${section.month}-01`))}
          </Text>
          <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {section.items.map((row, i) => (
              <TimelineRow
                key={`${row.kind}-${row.id}`}
                theme={theme}
                row={row}
                now={now}
                last={i === section.items.length - 1}
                onLongPress={() => confirmDelete(row)}
              />
            ))}
          </View>
        </View>
      ))}
      {sections.length > 0 && (
        <Text style={[type.small, styles.hint, { color: theme.muted }]}>Long press an entry to delete it.</Text>
      )}
    </ScrollView>
  );
}

function TimelineRow({
  theme,
  row,
  now,
  last,
  onLongPress,
}: {
  theme: Theme;
  row: Row;
  now: LocalDate;
  last: boolean;
  onLongPress: () => void;
}) {
  const tint = row.kind === "side-effect" ? theme.warn : theme.accent;
  return (
    <Pressable
      onLongPress={onLongPress}
      accessibilityHint="Long press to delete"
      accessibilityLabel={`${row.title}, ${row.detail}, ${relativeDay(row.date, now)}`}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth },
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: row.kind === "side-effect" ? theme.surfaceAlt : theme.accentSoft }]}>
        <Icon name={row.icon} color={tint} size={20} />
      </View>
      <View style={styles.text}>
        <Text style={[type.bodyStrong, { color: theme.text }]}>{row.title}</Text>
        {row.detail !== "" && (
          <Text style={[type.small, { color: theme.muted }]} numberOfLines={2}>
            {row.detail}
          </Text>
        )}
      </View>
      <Text style={[type.small, { color: theme.muted }]}>{relativeDay(row.date, now)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.l, gap: space.l, paddingBottom: space.xxl },
  filters: { gap: space.s, paddingRight: space.l },
  empty: { alignItems: "center", gap: space.m, paddingVertical: space.xxl, paddingHorizontal: space.xl },
  section: { gap: space.s },
  month: { paddingHorizontal: space.xs },
  group: { borderWidth: 1, borderRadius: radius.l, paddingHorizontal: space.l },
  row: { flexDirection: "row", alignItems: "center", gap: space.m, minHeight: 64, paddingVertical: space.m },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: 2 },
  hint: { textAlign: "center" },
});

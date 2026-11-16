import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { deleteInjection, deleteSideEffect, useAllInjections, useSideEffects } from "@/data/injections";
import { deleteWeight, useSettings, useWeightEntries } from "@/data/repo";
import { useToday } from "@/data/use-today";
import { type LocalDate, parseLocalDate } from "@/domain/date";
import { isSeverity } from "@/domain/side-effect";
import { useI18n } from "@/i18n/provider";
import { Illustration } from "@/ui/Illustration";
import { Icon, type IconName } from "@/ui/icons";
import { Chip, ScreenTitle } from "@/ui/kit";
import { type TimelineFilter, type TimelineItem, timeline } from "@/ui/timeline";
import { type Theme, radius, space, type, useTheme } from "@/ui/theme";

interface Row extends TimelineItem {
  readonly title: string;
  readonly detail: string;
  readonly icon: IconName;
}

/** One calendar month of the timeline, drawn as one card. */
interface MonthSection {
  /** "YYYY-MM" */
  readonly month: string;
  readonly rows: readonly Row[];
}

const FILTERS: readonly TimelineFilter[] = ["all", "weight", "injection", "side-effect"];

export default function History() {
  const theme = useTheme();
  const { t, f } = useI18n();
  const insets = useSafeAreaInsets();
  const now = useToday();
  const unit = useSettings()?.weightUnit ?? "kg";
  const weights = useWeightEntries();
  const shots = useAllInjections();
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
          title: f.weight(w.weightG, unit),
          detail: w.source === "health_connect" ? t.history.fromHealthConnect : t.history.weighIn,
          icon: "scale",
        }),
      ),
      ...shots.map(
        (s): Row => ({
          kind: "injection",
          id: s.id,
          date: parseLocalDate(s.localDate),
          at: s.takenAt,
          title: t.history.injection(f.dose(s.doseMcg)),
          detail: [s.site ? t.sites[s.site] : t.history.siteNotRecorded, s.note].filter(Boolean).join(" · "),
          icon: "pen",
        }),
      ),
      ...effects.map(
        (e): Row => ({
          kind: "side-effect",
          id: e.id,
          date: parseLocalDate(e.localDate),
          at: e.createdAt,
          title: t.sideEffects[e.type],
          detail: [isSeverity(e.severity) ? t.severity[e.severity] : "", e.note].filter(Boolean).join(" · "),
          icon: "drop",
        }),
      ),
    ];
    return timeline(rows, filter).map((s): MonthSection => ({ month: s.month, rows: s.items }));
  }, [weights, shots, effects, filter, unit, t, f]);

  const confirmDelete = (row: Row) =>
    Alert.alert(t.history.deleteTitle, `${row.title} · ${f.relativeDay(row.date, now)}`, [
      { text: t.common.cancel, style: "cancel" },
      {
        text: t.common.delete,
        style: "destructive",
        onPress: () =>
          void (row.kind === "weight" ? deleteWeight(row.id) : row.kind === "injection" ? deleteInjection(row.id) : deleteSideEffect(row.id)),
      },
    ]);

  // A virtualized list of months: years of daily weigh-ins would otherwise mount every row at once.
  // Each month is drawn whole, as one card. Splitting a card's border across row cells left a
  // one-pixel gap between rows on fractional pixel densities (1 dp = 2.625 px).
  return (
    <FlatList<MonthSection>
      data={sections}
      keyExtractor={(section) => section.month}
      initialNumToRender={2}
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.l }]}
      ListHeaderComponent={
        <View style={styles.header}>
          <ScreenTitle theme={theme} title={t.history.title} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityRole="radiogroup">
            {FILTERS.map((value) => (
              <Chip key={value} theme={theme} label={t.history.filters[value]} selected={filter === value} onPress={() => setFilter(value)} />
            ))}
          </ScrollView>
        </View>
      }
      renderItem={({ item: section }) => (
        <View style={styles.section}>
          <Text style={[type.caption, styles.month, { color: theme.muted }]}>
            {f.upper(f.monthTitle(parseLocalDate(`${section.month}-01`)))}
          </Text>
          <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {section.rows.map((row, i) => (
              <TimelineRow
                key={`${row.kind}-${row.id}`}
                theme={theme}
                row={row}
                now={now}
                last={i === section.rows.length - 1}
                onLongPress={() => confirmDelete(row)}
              />
            ))}
          </View>
        </View>
      )}
      ListEmptyComponent={
        <View style={styles.empty}>
          {filter === "all" ? (
            <>
              <Illustration name="journal" theme={theme} size={220} />
              <Text style={[type.heading, { color: theme.text }]}>{t.history.emptyTitle}</Text>
              <Text style={[type.body, { color: theme.muted, textAlign: "center" }]}>{t.history.emptyBody}</Text>
            </>
          ) : (
            <>
              <Icon name="calendar" color={theme.muted} size={32} />
              <Text style={[type.body, { color: theme.muted, textAlign: "center" }]}>{t.history.emptyFiltered}</Text>
            </>
          )}
        </View>
      }
      ListFooterComponent={
        sections.length > 0 ? (
          <Text style={[type.small, styles.hint, { color: theme.muted }]}>{t.history.longPressHint}</Text>
        ) : undefined
      }
    />
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
  const { t, f } = useI18n();
  const tint = row.kind === "side-effect" ? theme.warn : theme.accent;
  return (
    <Pressable
      onLongPress={onLongPress}
      accessibilityHint={t.history.deleteHint}
      accessibilityActions={[{ name: "delete", label: t.common.delete }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "delete") onLongPress();
      }}
      accessibilityLabel={`${row.title}, ${row.detail}, ${f.relativeDay(row.date, now)}`}
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
      <Text style={[type.small, { color: theme.muted }]}>{f.relativeDay(row.date, now)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.l, paddingBottom: space.xxl },
  header: { gap: space.l },
  filters: { gap: space.s, paddingRight: space.l },
  empty: { alignItems: "center", gap: space.m, paddingVertical: space.xxl, paddingHorizontal: space.xl, marginTop: space.l },
  section: { gap: space.s, paddingTop: space.l },
  month: { paddingHorizontal: space.xs },
  group: { borderWidth: 1, borderRadius: radius.l, paddingHorizontal: space.l },
  row: { flexDirection: "row", alignItems: "center", gap: space.m, minHeight: 64, paddingVertical: space.m },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: 2 },
  hint: { textAlign: "center", paddingTop: space.l },
});

import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { LocalDate } from "@/domain/date";
import { type WeightSummary, goalProgress } from "@/domain/summary";
import type { WeightUnit } from "@/domain/weight";
import { useI18n } from "@/i18n/provider";
import { Icon } from "../icons";
import { Button, Card, Label } from "../kit";
import { type Theme, radius, space, type } from "../theme";
import { routes } from "./routes";

/**
 * Today's weight in brief: the trend, its 7-day change, progress to the user's own goal and the
 * forecast sentence. The full chart lives on the Progress tab.
 */
export function WeightCard({
  theme,
  summary,
  unit,
  goalG,
  now,
}: {
  theme: Theme;
  summary: WeightSummary;
  unit: WeightUnit;
  goalG: number | null;
  now: LocalDate;
}) {
  const { t, f } = useI18n();
  const first = summary.trend[0];
  const progress = first === undefined ? undefined : goalProgress(Math.round(first.trendG), summary.currentTrendG, goalG);
  const toGoal = goalG === null ? undefined : Math.abs(summary.currentTrendG - goalG);
  const weighedToday = summary.daysSinceLatest === 0;
  return (
    <Card theme={theme} style={styles.card}>
      <View style={styles.head}>
        <Label theme={theme}>{t.today.yourTrend}</Label>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(routes.progress())}
          hitSlop={space.m}
          style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.linkText, { color: theme.accent }]}>{t.daily.seeChart}</Text>
          <Icon name="chevron" color={theme.accent} size={16} />
        </Pressable>
      </View>
      <View style={styles.headline}>
        <View style={styles.flex}>
          <View style={styles.figure}>
            <Text style={[styles.number, { color: theme.text }]} accessibilityLabel={f.weight(summary.currentTrendG, unit)}>
              {f.weightNumber(summary.currentTrendG, unit)}
            </Text>
            <Text style={[styles.unit, { color: theme.muted }]}>{unit}</Text>
          </View>
          <Text style={[type.small, { color: theme.muted }]}>{t.today.weighed(f.relativeDayInline(summary.latestDate, now))}</Text>
        </View>
        <View style={[styles.stat, { backgroundColor: theme.surfaceAlt }]}>
          <Text style={[styles.statLabel, { color: theme.muted }]}>{f.upper(t.today.sevenDays)}</Text>
          <Text style={[type.number, { color: theme.text }]}>
            {summary.weekChangeG === undefined ? t.common.noValue : f.weightChange(summary.weekChangeG, unit)}
          </Text>
        </View>
      </View>
      {progress !== undefined && toGoal !== undefined && goalG !== null && (
        <View style={styles.goal}>
          <View style={[styles.track, { backgroundColor: theme.surfaceAlt }]}>
            <View style={[styles.fill, { backgroundColor: theme.accent, width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={[type.small, { color: theme.muted }]}>
            {toGoal < 100 ? t.today.atGoal : t.today.toGoal(f.weight(toGoal, unit), f.weight(goalG, unit))}
          </Text>
        </View>
      )}
      <Text style={[type.small, { color: theme.text }]}>{f.forecast(summary.forecast, unit, now)}</Text>
      <Button
        theme={theme}
        kind={weighedToday ? "quiet" : "primary"}
        icon="plus"
        label={weighedToday ? t.today.logAnother : t.today.logToday}
        onPress={() => router.push(routes.addWeight())}
      />
    </Card>
  );
}

/** No weigh-in yet: what the trend is, drawn rather than explained. */
export function EmptyWeight({ theme }: { theme: Theme }) {
  const { t } = useI18n();
  return (
    <Card theme={theme} style={styles.card}>
      <Svg width="100%" height={72} viewBox="0 0 320 96" accessibilityElementsHidden importantForAccessibility="no">
        {[18, 34, 30, 46, 40, 52, 62, 56, 70, 66, 78].map((y, i) => (
          <Circle key={i} cx={20 + i * 28} cy={y} r={4} fill={theme.reading} />
        ))}
        <Path d="M20 26 C 90 34, 150 44, 200 56 S 280 70, 300 74" stroke={theme.trend} strokeWidth={4} fill="none" strokeLinecap="round" />
      </Svg>
      <Text style={[type.heading, { color: theme.text }]}>{t.today.emptyTitle}</Text>
      <Text style={[type.small, { color: theme.muted }]}>{t.today.emptyBody}</Text>
      <Button theme={theme} icon="plus" label={t.today.logWeight} onPress={() => router.push(routes.addWeight())} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.m },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  link: { flexDirection: "row", alignItems: "center", gap: 2, paddingVertical: space.xs },
  linkText: { fontSize: 14, fontWeight: "600" },
  headline: { flexDirection: "row", alignItems: "center", gap: space.m },
  flex: { flex: 1, gap: 2 },
  figure: { flexDirection: "row", alignItems: "baseline", gap: space.s },
  number: { fontSize: 44, lineHeight: 50, fontWeight: "700", letterSpacing: -1, fontVariant: ["tabular-nums"] },
  unit: { fontSize: 20, fontWeight: "600" },
  stat: { borderRadius: radius.m, paddingVertical: space.s, paddingHorizontal: space.m, gap: 2, alignItems: "flex-end" },
  // Upper-cased in JS with the language's rules (see type.caption in theme.ts).
  statLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.4 },
  goal: { gap: space.xs },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
});

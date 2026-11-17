import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { DayRings, Ring } from "@/domain/day-summary";
import type { LocalDate } from "@/domain/date";
import { useI18n } from "@/i18n/provider";
import { ProgressRing } from "../ProgressRing";
import { Button, Card } from "../kit";
import { type Theme, space, type } from "../theme";
import { IconButton } from "./IconButton";
import { routes } from "./routes";
import { type RingKind, mlText, ringTexts } from "./texts";
import type { WaterActions } from "./use-water-actions";

const RING_MAX = 92;
const RING_STROKE = 8;
const RING_KINDS: readonly RingKind[] = ["energy", "protein", "water"];

/**
 * The day at a glance: energy, protein and water against the user's own goals, and the one-tap
 * glass of water. Without a goal a ring shows just the value; one quiet link offers to set goals.
 */
export function DayCard({
  theme,
  rings,
  date,
  servingMl,
  canUndo,
  goalsKnown,
  water,
}: {
  theme: Theme;
  rings: DayRings;
  date: LocalDate;
  servingMl: number;
  canUndo: boolean;
  /** False while settings are still being read, so "Set a goal" does not flash for users who have goals. */
  goalsKnown: boolean;
  water: WaterActions;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const { width } = useWindowDimensions();
  // Three rings side by side inside the screen and card padding, never wider than RING_MAX.
  const size = Math.min(RING_MAX, Math.floor((width - space.l * 4 - space.s * 2) / 3));
  const goals = RING_KINDS.map((k) => rings[k].goal);
  const anyGoal = goals.some((g) => g !== null);
  const missingGoal = goalsKnown && goals.some((g) => g === null);

  const open = (kind: RingKind) => router.push(kind === "water" ? routes.water(date) : routes.food());

  return (
    <Card theme={theme} style={styles.card}>
      <View style={styles.rings}>
        {RING_KINDS.map((kind) => (
          <RingColumn
            key={kind}
            theme={theme}
            kind={kind}
            ring={rings[kind]}
            size={size}
            goalLine={anyGoal}
            hint={kind === "water" ? t.daily.openWater : t.daily.openFood}
            onPress={() => open(kind)}
          />
        ))}
      </View>
      {missingGoal && (
        <Pressable
          accessibilityRole="button"
          accessibilityHint={t.daily.setGoalHint}
          onPress={() => router.push(routes.goals())}
          hitSlop={space.m}
          style={({ pressed }) => [styles.goalLink, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.goalLinkText, { color: theme.accent }]}>{t.daily.setGoal}</Text>
        </Pressable>
      )}
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <View style={styles.waterRow}>
        <View style={styles.flex}>
          <Button theme={theme} kind="quiet" icon="plus" label={t.daily.addGlass(mlText(i18n, servingMl))} onPress={() => water.add(servingMl)} />
        </View>
        {canUndo && <IconButton theme={theme} icon="undo" label={t.daily.undoGlass} onPress={water.undoLast} />}
        <IconButton
          theme={theme}
          icon="chevron"
          label={t.daily.otherAmount}
          hint={t.daily.openWater}
          onPress={() => router.push(routes.water(date))}
        />
      </View>
    </Card>
  );
}

function RingColumn({
  theme,
  kind,
  ring,
  size,
  goalLine,
  hint,
  onPress,
}: {
  theme: Theme;
  kind: RingKind;
  ring: Ring;
  size: number;
  /** Keeps the three labels level when only some rings have a goal. */
  goalLine: boolean;
  hint: string;
  onPress: () => void;
}) {
  const i18n = useI18n();
  const texts = ringTexts(i18n, kind, ring);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={texts.a11y}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [styles.column, { opacity: pressed ? 0.7 : 1 }]}
    >
      <ProgressRing size={size} stroke={RING_STROKE} fraction={ring.fraction ?? 0} color={theme.accent} track={theme.surfaceAlt}>
        <Text style={[styles.value, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
          {texts.value}
        </Text>
        <Text style={[styles.unit, { color: theme.muted }]}>{texts.unit}</Text>
      </ProgressRing>
      <Text style={[type.caption, { color: theme.muted }]} numberOfLines={1}>
        {i18n.f.upper(texts.label)}
      </Text>
      {goalLine && (
        <Text style={[styles.goal, { color: theme.muted }]} numberOfLines={1}>
          {texts.goal ?? " "}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.m },
  rings: { flexDirection: "row", justifyContent: "space-between", gap: space.s },
  column: { flex: 1, alignItems: "center", gap: space.xs },
  value: { fontSize: 20, lineHeight: 24, fontWeight: "700", fontVariant: ["tabular-nums"], paddingHorizontal: space.s },
  unit: { fontSize: 12, lineHeight: 14, fontWeight: "600" },
  goal: { fontSize: 13, lineHeight: 18, fontVariant: ["tabular-nums"] },
  goalLink: { alignSelf: "center", paddingVertical: space.xs, paddingHorizontal: space.m },
  goalLinkText: { fontSize: 14, fontWeight: "600" },
  divider: { height: StyleSheet.hairlineWidth },
  waterRow: { flexDirection: "row", alignItems: "center", gap: space.s },
  flex: { flex: 1 },
});

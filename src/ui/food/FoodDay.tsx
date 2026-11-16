import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { type FoodEntry, copyMeal } from "@/data/food";
import { type LocalDate, addDays } from "@/domain/date";
import { QUICK_ADD_PORTION_ID, amountPhrase, gramsText } from "@/domain/food-entry";
import { MEALS, type Meal, totals } from "@/domain/food-log";
import { goalFraction } from "@/domain/goals";
import type { I18n } from "@/i18n";
import { useI18n } from "@/i18n/provider";
import { DayPicker } from "@/ui/DayPicker";
import { Illustration } from "@/ui/Illustration";
import { ProgressRing } from "@/ui/ProgressRing";
import { Icon } from "@/ui/icons";
import { Card, Label } from "@/ui/kit";
import { type Theme, space, type } from "@/ui/theme";
import { FoodRow, RoundButton, StatTile } from "./parts";
import { GRAM, KCAL, decimalMark, gramsFromMg, kcalText } from "./units";

/** The pager goes back as far as anyone keeps a diary; never ahead of today. */
const MAX_DAYS_BACK = 3650;
const RING = 112;
const RING_STROKE = 10;
const MG_PER_G = 1000;
/** How many of the previous day's foods the "copy" row names. */
const COPY_PREVIEW = 3;

/** "≥ 62" when some entry did not know the value, so the sum is a lower bound. */
const atLeast = (text: string, incomplete: boolean) => (incomplete ? `≥ ${text}` : text);

export function FoodDay({
  theme,
  date,
  today,
  onDate,
  entries,
  previous,
  energyGoalKcal,
  proteinGoalG,
}: {
  theme: Theme;
  date: LocalDate;
  today: LocalDate;
  onDate: (date: LocalDate) => void;
  entries: readonly FoodEntry[];
  previous: readonly FoodEntry[];
  energyGoalKcal: number | null;
  proteinGoalG: number | null;
}) {
  const { t } = useI18n();
  return (
    <>
      <View style={styles.pager}>
        <DayPicker theme={theme} value={date} today={today} onChange={onDate} maxDaysBack={MAX_DAYS_BACK} />
        {date !== today && (
          <Pressable accessibilityRole="button" onPress={() => onDate(today)} style={styles.todayLink}>
            <Text style={[type.bodyStrong, { color: theme.accent }]}>{t.food.day.backToToday}</Text>
          </Pressable>
        )}
      </View>
      {entries.length === 0 ? (
        <EmptyDay theme={theme} />
      ) : (
        <DayTotals theme={theme} entries={entries} energyGoalKcal={energyGoalKcal} proteinGoalG={proteinGoalG} />
      )}
      {MEALS.map((meal) => (
        <MealSection
          key={meal}
          theme={theme}
          meal={meal}
          date={date}
          today={today}
          entries={entries.filter((e) => e.meal === meal)}
          previous={previous.filter((e) => e.meal === meal)}
        />
      ))}
      <Text style={[type.small, styles.footnote, { color: theme.muted }]}>{t.food.day.footnote}</Text>
    </>
  );
}

function EmptyDay({ theme }: { theme: Theme }) {
  const { t } = useI18n();
  return (
    <Card theme={theme} style={styles.empty}>
      <Illustration name="food" theme={theme} size={144} />
      <Text style={[type.body, styles.emptyText, { color: theme.muted }]}>{t.food.day.empty}</Text>
    </Card>
  );
}

function DayTotals({
  theme,
  entries,
  energyGoalKcal,
  proteinGoalG,
}: {
  theme: Theme;
  entries: readonly FoodEntry[];
  energyGoalKcal: number | null;
  proteinGoalG: number | null;
}) {
  const i18n = useI18n();
  const { t, f } = i18n;
  const sum = totals(entries);
  const anyIncomplete = Object.values(sum.incomplete).some(Boolean);
  const grams = (mg: number, incomplete: boolean) => atLeast(gramsFromMg(i18n, mg), incomplete);
  return (
    <Card theme={theme} style={styles.totals}>
      <Label theme={theme}>{t.food.day.total}</Label>
      <View style={styles.rings}>
        <GoalRing
          theme={theme}
          label={t.food.nutrients.energy}
          value={f.integer(sum.energyKcal)}
          unit={KCAL}
          fraction={goalFraction(sum.energyKcal, energyGoalKcal)}
          goal={energyGoalKcal === null ? undefined : `${f.integer(energyGoalKcal)} ${KCAL}`}
        />
        <GoalRing
          theme={theme}
          label={t.food.nutrients.protein}
          value={atLeast(gramsText(sum.proteinMg, decimalMark(i18n)), sum.incomplete.proteinMg)}
          unit={GRAM}
          fraction={goalFraction(sum.proteinMg, proteinGoalG === null ? null : proteinGoalG * MG_PER_G)}
          goal={proteinGoalG === null ? undefined : `${f.integer(proteinGoalG)} ${GRAM}`}
        />
      </View>
      <View style={styles.stats}>
        <StatTile theme={theme} label={t.food.nutrients.carbs} value={grams(sum.carbMg, sum.incomplete.carbMg)} />
        <StatTile theme={theme} label={t.food.nutrients.fat} value={grams(sum.fatMg, sum.incomplete.fatMg)} />
        <StatTile theme={theme} label={t.food.nutrients.fiber} value={grams(sum.fiberMg, sum.incomplete.fiberMg)} />
      </View>
      {anyIncomplete && <Text style={[type.small, { color: theme.muted }]}>{t.food.day.atLeast}</Text>}
    </Card>
  );
}

/** Value in a ring filled towards the user's own goal; without a goal, the value and a quiet link. */
function GoalRing({
  theme,
  label,
  value,
  unit,
  fraction,
  goal,
}: {
  theme: Theme;
  label: string;
  value: string;
  unit: string;
  fraction: number | undefined;
  goal: string | undefined;
}) {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <View style={styles.ringBlock}>
      <View accessible accessibilityLabel={[label, `${value} ${unit}`, goal === undefined ? "" : t.food.day.goal(goal)].filter(Boolean).join(", ")}>
        <ProgressRing size={RING} stroke={RING_STROKE} fraction={fraction ?? 0} color={theme.accent} track={theme.surfaceAlt}>
          <Text style={[styles.ringValue, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
            {value}
          </Text>
          <Text style={[type.small, { color: theme.muted }]}>{unit}</Text>
        </ProgressRing>
      </View>
      <Label theme={theme}>{label}</Label>
      {goal === undefined ? (
        <Pressable accessibilityRole="link" onPress={() => router.push("/goals")} style={styles.setGoal}>
          <Text style={[type.small, styles.link, { color: theme.accent }]}>{t.food.day.setGoal}</Text>
        </Pressable>
      ) : (
        <Text style={[type.small, styles.goalText, { color: theme.muted }]}>{t.food.day.goal(goal)}</Text>
      )}
    </View>
  );
}

function MealSection({
  theme,
  meal,
  date,
  today,
  entries,
  previous,
}: {
  theme: Theme;
  meal: Meal;
  date: LocalDate;
  today: LocalDate;
  entries: readonly FoodEntry[];
  previous: readonly FoodEntry[];
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const router = useRouter();
  const name = t.food.meals[meal];
  const sum = totals(entries);
  const add = () => router.push({ pathname: "/food/add", params: { meal, date } });

  // One copy per tap: a second tap while the first is still writing would log the meal twice.
  const [copying, setCopying] = useState(false);
  const copy = () => {
    if (copying) return;
    setCopying(true);
    copyMeal(addDays(date, -1), date, meal)
      .catch((e: unknown) => Alert.alert(t.food.day.couldNotCopy, e instanceof Error ? e.message : t.common.tryAgain))
      .finally(() => setCopying(false));
  };

  return (
    <Card theme={theme} style={styles.meal}>
      <View style={styles.mealHead}>
        <View style={styles.mealTitle} accessibilityRole="header">
          <Text style={[type.heading, { color: theme.text }]}>{name}</Text>
          {entries.length > 0 && <Text style={[type.small, { color: theme.muted }]}>{mealSummary(i18n, sum)}</Text>}
        </View>
        <RoundButton theme={theme} icon="plus" label={t.food.day.addTo(name)} onPress={add} />
      </View>
      {entries.map((e, i) => (
        <FoodRow
          key={e.id}
          theme={theme}
          title={e.name}
          detail={entryDetail(i18n, e)}
          right={kcalText(i18n, e.energyKcal)}
          hint={t.food.day.openHint}
          last={i === entries.length - 1}
          onPress={() => router.push({ pathname: "/food/entry", params: { id: e.id } })}
        />
      ))}
      {entries.length === 0 && previous.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: copying }}
          disabled={copying}
          onPress={copy}
          style={({ pressed }) => [styles.copy, { borderColor: theme.border, opacity: copying ? 0.45 : pressed ? 0.6 : 1 }]}
        >
          <Icon name="history" color={theme.accent} size={20} />
          <View style={styles.copyText}>
            <Text style={[type.bodyStrong, { color: theme.accent }]}>
              {date === today ? t.food.day.copyFromYesterday : t.food.day.copyFromDayBefore}
            </Text>
            <Text style={[type.small, { color: theme.muted }]} numberOfLines={1}>
              {copyPreview(i18n, previous)}
            </Text>
          </View>
        </Pressable>
      )}
    </Card>
  );
}

/** "420 kcal · Protein 18 g". */
function mealSummary(i18n: I18n, sum: ReturnType<typeof totals>): string {
  const protein = `${i18n.t.food.nutrients.protein} ${atLeast(gramsFromMg(i18n, sum.proteinMg), sum.incomplete.proteinMg)}`;
  return `${kcalText(i18n, sum.energyKcal)} · ${protein}`;
}

/** "2 adet · Protein 12 g": what was eaten, and its protein when known. A quick add says so. */
function entryDetail(i18n: I18n, e: FoodEntry): string {
  const amount =
    e.portionId === QUICK_ADD_PORTION_ID
      ? i18n.t.food.add.quickAdd
      : amountPhrase(e.quantityMilli, e.portionLabel, i18n.lang, decimalMark(i18n));
  return e.proteinMg === null ? amount : `${amount} · ${i18n.t.food.nutrients.protein} ${gramsFromMg(i18n, e.proteinMg)}`;
}

/** "Simit, Çay and Beyaz peynir" or the first three and a count: what copying would add. */
function copyPreview({ f }: I18n, previous: readonly FoodEntry[]): string {
  const names = previous.map((e) => e.name);
  if (names.length <= COPY_PREVIEW) return f.list(names);
  return `${names.slice(0, COPY_PREVIEW).join(", ")} +${names.length - COPY_PREVIEW}`;
}

const styles = StyleSheet.create({
  pager: { gap: space.xs },
  todayLink: { alignSelf: "center", minHeight: 48, justifyContent: "center", paddingHorizontal: space.l },
  empty: { alignItems: "center", gap: space.l, padding: space.xl },
  emptyText: { textAlign: "center" },
  totals: { gap: space.l, padding: space.xl },
  rings: { flexDirection: "row", justifyContent: "space-around" },
  ringBlock: { alignItems: "center", gap: space.xs, flex: 1 },
  ringValue: { fontSize: 24, fontWeight: "700", fontVariant: ["tabular-nums"], maxWidth: RING - 2 * RING_STROKE - space.s },
  setGoal: { minHeight: 48, justifyContent: "center", paddingHorizontal: space.s },
  link: { fontWeight: "600" },
  goalText: { minHeight: 48, textAlignVertical: "center", fontVariant: ["tabular-nums"] },
  stats: { flexDirection: "row", gap: space.s },
  meal: { gap: 0 },
  mealHead: { flexDirection: "row", alignItems: "center", gap: space.m, paddingBottom: space.xs },
  mealTitle: { flex: 1, gap: 2 },
  copy: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.m,
    minHeight: 56,
    marginTop: space.s,
    paddingTop: space.s,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  copyText: { flex: 1, gap: 2 },
  footnote: { textAlign: "center", paddingHorizontal: space.l },
});

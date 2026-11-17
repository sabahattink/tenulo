import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { addFoodEntry } from "@/data/food";
import { useCustomFood } from "@/data/food-lookup";
import { useToday } from "@/data/use-today";
import type { LocalDate } from "@/domain/date";
import { type FoodChoice, choiceKey, choiceName, portionOptions, snapshotFor, startingPortion, withinEntryLimits } from "@/domain/food-entry";
import type { Meal } from "@/domain/food-log";
import { findCatalogFood } from "@/domain/foods/catalog";
import { useI18n } from "@/i18n/provider";
import { PortionEditor, useAmountInput } from "@/ui/food/PortionEditor";
import { ADD_FLOW_DEPTH, type Param, dateParam, mealParam, minuteOfDay, quantityParam, single } from "@/ui/food/params";
import { Button, Label, useScrollEndPadding } from "@/ui/kit";
import { type Theme, space, type, useTheme } from "@/ui/theme";


/** `/food/portion?source=catalog|custom&id=&portion=&qty=&meal=&date=`: the portion step. */
export default function PortionScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const today = useToday();
  const params = useLocalSearchParams<{ source?: Param; id?: Param; portion?: Param; qty?: Param; meal?: Param; date?: Param }>();
  const source = single(params.source);
  const id = single(params.id) ?? "";
  const catalogFood = source === "catalog" ? findCatalogFood(id) : undefined;
  const custom = useCustomFood(source === "custom" ? id : "");
  const [meal] = useState(() => mealParam(params.meal, minuteOfDay(new Date())));
  const date = dateParam(params.date, today);

  const choice: FoodChoice | undefined =
    catalogFood !== undefined ? { kind: "catalog", food: catalogFood } : custom.row !== undefined ? { kind: "custom", food: custom.row } : undefined;

  if (choice === undefined) {
    const reading = source === "custom" && !custom.loaded;
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        {!reading && <Text style={[type.body, { color: theme.muted }]}>{t.food.portion.gone}</Text>}
      </View>
    );
  }

  const qty = quantityParam(params.qty);
  const last = qty === undefined ? undefined : { portionId: single(params.portion) || null, quantityMilli: qty };
  return <PortionStep key={choiceKey(choice)} theme={theme} choice={choice} last={last} initialMeal={meal} date={date} today={today} />;
}

function PortionStep({
  theme,
  choice,
  last,
  initialMeal,
  date,
  today,
}: {
  theme: Theme;
  choice: FoodChoice;
  last: { portionId: string | null; quantityMilli: number } | undefined;
  initialMeal: Meal;
  date: LocalDate;
  today: LocalDate;
}) {
  const i18n = useI18n();
  const { t, f, lang } = i18n;
  const router = useRouter();
  const endPadding = useScrollEndPadding();
  const portions = useMemo(() => portionOptions(choice, lang), [choice, lang]);
  const [start] = useState(() => startingPortion(choice, last));
  const [portionIndex, setPortionIndex] = useState(start.index);
  const amount = useAmountInput(start.quantityMilli);
  const [meal, setMeal] = useState(initialMeal);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const portion = portions[portionIndex] ?? portions[0];
  const snapshot = amount.parsed.ok && portion !== undefined ? snapshotFor(choice, portion, amount.parsed.milli, lang) : undefined;
  const tooMuch = snapshot !== undefined && !withinEntryLimits(snapshot);
  const canSave = snapshot !== undefined && !tooMuch && !saving;

  const save = async () => {
    if (snapshot === undefined || !canSave) return;
    setSaving(true);
    try {
      await addFoodEntry({ ...snapshot, date, meal });
      router.dismiss(ADD_FLOW_DEPTH);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.couldNotSave);
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: choiceName(choice, lang) }} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: endPadding }]} keyboardShouldPersistTaps="handled">
        {date !== today && (
          <View style={styles.day}>
            <Label theme={theme}>{t.common.day}</Label>
            <Text style={[type.bodyStrong, { color: theme.text }]}>{f.relativeDay(date, today)}</Text>
          </View>
        )}
        <PortionEditor
          theme={theme}
          portions={portions}
          portionIndex={portionIndex}
          onPortion={setPortionIndex}
          amount={amount}
          meal={meal}
          onMeal={setMeal}
          preview={snapshot}
          tooMuch={tooMuch}
        />
        {error !== undefined && <Text style={[type.small, { color: theme.danger }]}>{error}</Text>}
        <Button theme={theme} icon="plus" label={saving ? t.food.portion.adding : t.food.portion.add} onPress={() => void save()} disabled={!canSave} />
        <Text style={[type.small, styles.note, { color: theme.muted }]}>{t.food.portion.estimate}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
  content: { padding: space.l, gap: space.xl },
  day: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  note: { textAlign: "center" },
});

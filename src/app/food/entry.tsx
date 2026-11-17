import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { type ReactNode, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { type FoodEntry, deleteFoodEntry, updateFoodEntry } from "@/data/food";
import { useCustomFood, useFoodEntry } from "@/data/food-lookup";
import { type EntryChange, type EntrySource, editPortions, editedEntry, sourceOfEntry, withinEntryLimits } from "@/domain/food-entry";
import { formatQuantity } from "@/domain/food-log";
import { findCatalogFood } from "@/domain/foods/catalog";
import { useI18n } from "@/i18n/provider";
import { ENTRY_KCAL, type QuickAddField, parseQuickAddForm } from "@/ui/food/forms";
import { PortionEditor, useAmountInput } from "@/ui/food/PortionEditor";
import { type Param, single } from "@/ui/food/params";
import { Field, type FieldKind, MealChips, problemText } from "@/ui/food/parts";
import { GRAM, KCAL, decimalMark } from "@/ui/food/units";
import { Button, useScrollEndPadding } from "@/ui/kit";
import { type Theme, space, type, useTheme } from "@/ui/theme";

/** `/food/entry?id=`: change a logged food's amount, portion or meal, or delete it. */
export default function EntryScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ id?: Param }>();
  const entry = useFoodEntry(single(params.id) ?? "");
  const row = entry.row;
  if (row === undefined) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        {entry.loaded && <Text style={[type.body, { color: theme.muted }]}>{t.food.entry.gone}</Text>}
      </View>
    );
  }
  // Keyed by the custom food, so its lookup starts fresh rather than from another id's result.
  if (row.customFoodId !== null) return <WithCustomFood key={row.customFoodId} theme={theme} entry={row} customFoodId={row.customFoodId} />;
  const source = sourceOfEntry(row, findCatalogFood, []);
  return <EditEntry key={`${row.id}:${source.kind}`} theme={theme} entry={row} source={source} />;
}

/** A custom-food entry, once it is known whether that food still exists. */
function WithCustomFood({ theme, entry, customFoodId }: { theme: Theme; entry: FoodEntry; customFoodId: string }) {
  const custom = useCustomFood(customFoodId);
  if (!custom.loaded) return <View style={[styles.center, { backgroundColor: theme.background }]} />;
  const source = sourceOfEntry(entry, findCatalogFood, custom.row === undefined ? [] : [custom.row]);
  return <EditEntry key={`${entry.id}:${source.kind}`} theme={theme} entry={entry} source={source} />;
}

function EditEntry({ theme, entry, source }: { theme: Theme; entry: FoodEntry; source: EntrySource }) {
  const { t } = useI18n();
  const router = useRouter();
  const endPadding = useScrollEndPadding();
  const [meal, setMeal] = useState(entry.meal);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const save = async (change: EntryChange | undefined) => {
    if (change === undefined || saving) return;
    setSaving(true);
    try {
      await updateFoodEntry(entry.id, { ...change, meal });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.couldNotSave);
      setSaving(false);
    }
  };

  const remove = () =>
    Alert.alert(t.food.entry.deleteTitle, entry.name, [
      { text: t.common.cancel, style: "cancel" },
      {
        text: t.common.delete,
        style: "destructive",
        onPress: () => {
          deleteFoodEntry(entry.id)
            .then(() => router.back())
            .catch((e: unknown) => Alert.alert(t.common.didNotWork, e instanceof Error ? e.message : t.common.tryAgain));
        },
      },
    ]);

  const footer = (change: EntryChange | undefined) => (
    <>
      {error !== undefined && <Text style={[type.small, { color: theme.danger }]}>{error}</Text>}
      <Button
        theme={theme}
        label={saving ? t.common.saving : t.common.save}
        onPress={() => void save(change)}
        disabled={change === undefined || saving}
      />
      <Button theme={theme} kind="danger" icon="trash" label={t.food.entry.delete} onPress={remove} />
    </>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: entry.name }} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: endPadding }]} keyboardShouldPersistTaps="handled">
        {source.kind === "quick" ? (
          <QuickEditor theme={theme} entry={entry} meal={meal} onMeal={setMeal} footer={footer} />
        ) : (
          <AmountEditor theme={theme} entry={entry} source={source} meal={meal} onMeal={setMeal} footer={footer} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

interface EditorProps {
  theme: Theme;
  entry: FoodEntry;
  meal: FoodEntry["meal"];
  onMeal: (meal: FoodEntry["meal"]) => void;
  footer: (change: EntryChange | undefined) => ReactNode;
}

/** A food from either list, or one whose food is gone: portion, amount and meal. */
function AmountEditor({ theme, entry, source, meal, onMeal, footer }: EditorProps & { source: EntrySource }) {
  const { t, lang } = useI18n();
  const portions = useMemo(() => editPortions(entry, source, lang), [entry, source, lang]);
  const [portionIndex, setPortionIndex] = useState(() => Math.max(0, portions.findIndex((p) => p.id === entry.portionId)));
  const amount = useAmountInput(entry.quantityMilli);
  const portion = portions[portionIndex] ?? portions[0];
  const change = amount.parsed.ok && portion !== undefined ? editedEntry(entry, source, portion, amount.parsed.milli, lang) : undefined;
  const tooMuch = change !== undefined && !withinEntryLimits(change);
  return (
    <>
      {source.kind === "snapshot" && <Text style={[type.small, { color: theme.muted }]}>{t.food.entry.snapshotNote}</Text>}
      <PortionEditor
        theme={theme}
        portions={portions}
        portionIndex={portionIndex}
        onPortion={setPortionIndex}
        amount={amount}
        meal={meal}
        onMeal={onMeal}
        preview={change}
        tooMuch={tooMuch}
      />
      {footer(tooMuch ? undefined : change)}
    </>
  );
}

const QUICK_KINDS: Readonly<Record<Exclude<QuickAddField, "name">, FieldKind>> = {
  energyKcal: { kind: "whole", range: ENTRY_KCAL },
  protein: { kind: "grams" },
};

/** A quick add: its energy and protein are edited as numbers. */
function QuickEditor({ theme, entry, meal, onMeal, footer }: EditorProps) {
  const i18n = useI18n();
  const { t } = i18n;
  const [energy, setEnergy] = useState(String(entry.energyKcal));
  const [protein, setProtein] = useState(entry.proteinMg === null ? "" : formatQuantity(entry.proteinMg, decimalMark(i18n)));
  const parsed = parseQuickAddForm({ name: "", energyKcal: energy, protein });
  const problem = (field: Exclude<QuickAddField, "name">) => {
    const p = parsed.ok ? undefined : parsed.problems[field];
    return p === undefined ? undefined : problemText(i18n, p, QUICK_KINDS[field]);
  };
  const change: EntryChange | undefined = parsed.ok
    ? {
        portionId: entry.portionId,
        portionLabel: entry.portionLabel,
        quantityMilli: entry.quantityMilli,
        grams: entry.grams,
        energyKcal: parsed.value.energyKcal,
        proteinMg: parsed.value.proteinMg,
        carbMg: entry.carbMg,
        fatMg: entry.fatMg,
        fiberMg: entry.fiberMg,
      }
    : undefined;
  return (
    <>
      <Text style={[type.small, { color: theme.muted }]}>{t.food.entry.quickNote}</Text>
      <Field
        theme={theme}
        label={t.food.nutrients.energy}
        unit={KCAL}
        value={energy}
        onChangeText={setEnergy}
        keyboardType="number-pad"
        maxLength={5}
        accessibilityLabel={t.food.quick.energyLabel}
        problem={problem("energyKcal")}
      />
      <Field
        theme={theme}
        label={t.food.nutrients.protein}
        unit={GRAM}
        value={protein}
        onChangeText={setProtein}
        keyboardType="decimal-pad"
        maxLength={6}
        placeholder={t.food.quick.optional}
        accessibilityLabel={t.food.quick.proteinLabel}
        problem={problem("protein")}
      />
      <MealChips theme={theme} value={meal} onChange={onMeal} />
      {footer(change)}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
  content: { padding: space.l, gap: space.xl },
});

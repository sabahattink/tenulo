import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { addFoodEntry } from "@/data/food";
import { useToday } from "@/data/use-today";
import { quickAddSnapshot } from "@/domain/food-entry";
import { useI18n } from "@/i18n/provider";
import { ENTRY_KCAL, MAX_ENTRY_NAME, type QuickAddField, type QuickAddForm, parseQuickAddForm } from "@/ui/food/forms";
import { ADD_FLOW_DEPTH, type Param, dateParam, mealParam, minuteOfDay } from "@/ui/food/params";
import { Field, type FieldKind, MealChips, problemText } from "@/ui/food/parts";
import { GRAM, KCAL } from "@/ui/food/units";
import { Button, Label, useScrollEndPadding } from "@/ui/kit";
import { space, type, useTheme } from "@/ui/theme";


const KINDS: Readonly<Record<QuickAddField, FieldKind>> = {
  name: { kind: "text", max: MAX_ENTRY_NAME },
  energyKcal: { kind: "whole", range: ENTRY_KCAL },
  protein: { kind: "grams" },
};

/** `/food/quick?meal=&date=`: a name and energy, for a meal out or anything not in the lists. */
export default function QuickAdd() {
  const theme = useTheme();
  const i18n = useI18n();
  const { t, f } = i18n;
  const router = useRouter();
  const endPadding = useScrollEndPadding();
  const today = useToday();
  const params = useLocalSearchParams<{ meal?: Param; date?: Param }>();
  const date = dateParam(params.date, today);
  const [meal, setMeal] = useState(() => mealParam(params.meal, minuteOfDay(new Date())));
  const [form, setForm] = useState<QuickAddForm>({ name: "", energyKcal: "", protein: "" });
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const parsed = parseQuickAddForm(form);
  const problem = (field: QuickAddField) => {
    const p = parsed.ok ? undefined : parsed.problems[field];
    if (p === undefined || (!attempted && form[field].trim() === "")) return undefined;
    return problemText(i18n, p, KINDS[field]);
  };
  const set = (field: QuickAddField) => (value: string) => setForm((current) => ({ ...current, [field]: value }));

  const save = async () => {
    setAttempted(true);
    if (!parsed.ok || saving) return;
    setSaving(true);
    try {
      const v = parsed.value;
      await addFoodEntry({
        ...quickAddSnapshot(v.name, v.energyKcal, v.proteinMg, t.food.quick.defaultName, t.food.quick.serving),
        date,
        meal,
      });
      router.dismiss(ADD_FLOW_DEPTH);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.couldNotSave);
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: endPadding }]} keyboardShouldPersistTaps="handled">
        <Text style={[type.body, { color: theme.muted }]}>{t.food.quick.intro}</Text>
        {date !== today && (
          <View style={styles.day}>
            <Label theme={theme}>{t.common.day}</Label>
            <Text style={[type.bodyStrong, { color: theme.text }]}>{f.relativeDay(date, today)}</Text>
          </View>
        )}
        <Field
          theme={theme}
          label={t.food.quick.name}
          value={form.name}
          onChangeText={set("name")}
          placeholder={t.food.quick.namePlaceholder}
          maxLength={MAX_ENTRY_NAME}
          autoCapitalize="sentences"
          problem={problem("name")}
        />
        <Field
          theme={theme}
          label={t.food.nutrients.energy}
          unit={KCAL}
          value={form.energyKcal}
          onChangeText={set("energyKcal")}
          keyboardType="number-pad"
          maxLength={5}
          autoFocus
          accessibilityLabel={t.food.quick.energyLabel}
          problem={problem("energyKcal")}
        />
        <Field
          theme={theme}
          label={t.food.nutrients.protein}
          unit={GRAM}
          value={form.protein}
          onChangeText={set("protein")}
          keyboardType="decimal-pad"
          maxLength={6}
          placeholder={t.food.quick.optional}
          accessibilityLabel={t.food.quick.proteinLabel}
          problem={problem("protein")}
        />
        <MealChips theme={theme} value={meal} onChange={setMeal} />
        {error !== undefined && <Text style={[type.small, { color: theme.danger }]}>{error}</Text>}
        <Button theme={theme} icon="plus" label={saving ? t.food.portion.adding : t.food.portion.add} onPress={() => void save()} disabled={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: space.l, gap: space.xl },
  day: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});

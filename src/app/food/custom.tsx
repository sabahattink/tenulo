import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { type CustomFood, createCustomFood, deleteCustomFood, updateCustomFood } from "@/data/food";
import { useCustomFood } from "@/data/food-lookup";
import { useI18n } from "@/i18n/provider";
import {
  type CustomFoodField,
  type CustomFoodForm,
  EMPTY_CUSTOM_FOOD_FORM,
  MAX_FOOD_NAME,
  MAX_SERVING_LABEL,
  SERVING_GRAMS,
  SERVING_KCAL,
  customFoodFormOf,
  parseCustomFoodForm,
} from "@/ui/food/forms";
import { type Param, single } from "@/ui/food/params";
import { Field, type FieldKind, Group, problemText } from "@/ui/food/parts";
import { GRAM, KCAL, decimalMark } from "@/ui/food/units";
import { Button, Card, useScrollEndPadding } from "@/ui/kit";
import { type Theme, space, type, useTheme } from "@/ui/theme";
import { notify } from "@/ui/notice";

const KINDS: Readonly<Record<CustomFoodField, FieldKind>> = {
  name: { kind: "text", max: MAX_FOOD_NAME },
  servingLabel: { kind: "text", max: MAX_SERVING_LABEL },
  servingGrams: { kind: "whole", range: SERVING_GRAMS },
  energyKcal: { kind: "whole", range: SERVING_KCAL },
  protein: { kind: "grams" },
  carb: { kind: "grams" },
  fat: { kind: "grams" },
  fiber: { kind: "grams" },
};

/**
 * `/food/custom?id=` edits one of the user's own foods; without an id it creates one. Opened from
 * the add flow (`&meal=&date=`), saving a new food goes straight on to its portion step.
 */
export default function CustomFoodScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ id?: Param; meal?: Param; date?: Param }>();
  const id = single(params.id);
  const existing = useCustomFood(id ?? "");
  const logNext = id === undefined && single(params.meal) !== undefined ? { meal: single(params.meal), date: single(params.date) } : undefined;

  if (id !== undefined && existing.row === undefined) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        {existing.loaded && <Text style={[type.body, { color: theme.muted }]}>{t.food.custom.gone}</Text>}
      </View>
    );
  }
  return <CustomFoodEditor key={id ?? "new"} theme={theme} food={existing.row} logNext={logNext} />;
}

function CustomFoodEditor({
  theme,
  food,
  logNext,
}: {
  theme: Theme;
  food: CustomFood | undefined;
  logNext: { meal: string | undefined; date: string | undefined } | undefined;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const router = useRouter();
  const endPadding = useScrollEndPadding();
  const [form, setForm] = useState<CustomFoodForm>(() => (food === undefined ? EMPTY_CUSTOM_FOOD_FORM : customFoodFormOf(food, decimalMark(i18n))));
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const parsed = parseCustomFoodForm(form);
  const problem = (field: CustomFoodField) => {
    const p = parsed.ok ? undefined : parsed.problems[field];
    if (p === undefined || (!attempted && form[field].trim() === "")) return undefined;
    return problemText(i18n, p, KINDS[field]);
  };
  const set = (field: CustomFoodField) => (value: string) => setForm((current) => ({ ...current, [field]: value }));

  const save = async () => {
    setAttempted(true);
    if (!parsed.ok || saving) return;
    setSaving(true);
    try {
      if (food !== undefined) {
        await updateCustomFood(food.id, parsed.value);
        router.back();
        return;
      }
      const newId = await createCustomFood(parsed.value);
      if (logNext === undefined) router.back();
      else router.replace({ pathname: "/food/portion", params: { source: "custom", id: newId, meal: logNext.meal ?? "", date: logNext.date ?? "" } });
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.couldNotSave);
      setSaving(false);
    }
  };

  const remove = () => {
    if (food === undefined) return;
    Alert.alert(t.food.custom.deleteTitle, t.food.custom.deleteBody, [
      { text: t.common.cancel, style: "cancel" },
      {
        text: t.common.delete,
        style: "destructive",
        onPress: () => {
          deleteCustomFood(food.id)
            .then(() => router.back())
            .catch((e: unknown) => notify(t, t.common.didNotWork, e instanceof Error ? e.message : t.common.tryAgain));
        },
      },
    ]);
  };

  const gramsField = (field: "protein" | "carb" | "fat" | "fiber", label: string) => (
    <Field
      theme={theme}
      label={label}
      unit={GRAM}
      value={form[field]}
      onChangeText={set(field)}
      keyboardType="decimal-pad"
      maxLength={6}
      problem={problem(field)}
    />
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.screen, { backgroundColor: theme.background }]}>
      {food !== undefined && <Stack.Screen options={{ title: t.food.custom.editTitle }} />}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: endPadding }]} keyboardShouldPersistTaps="handled">
        {food !== undefined && <Text style={[type.small, { color: theme.muted }]}>{t.food.custom.editNote}</Text>}
        <Card theme={theme} style={styles.card}>
          <Field
            theme={theme}
            label={t.food.custom.name}
            value={form.name}
            onChangeText={set("name")}
            placeholder={t.food.custom.namePlaceholder}
            maxLength={MAX_FOOD_NAME}
            autoCapitalize="sentences"
            autoFocus={food === undefined}
            problem={problem("name")}
          />
          <Field
            theme={theme}
            label={t.food.custom.serving}
            value={form.servingLabel}
            onChangeText={set("servingLabel")}
            placeholder={t.food.custom.servingPlaceholder}
            maxLength={MAX_SERVING_LABEL}
            hint={t.food.custom.servingHint}
            problem={problem("servingLabel")}
          />
          <Field
            theme={theme}
            label={t.food.custom.servingGrams}
            unit={GRAM}
            value={form.servingGrams}
            onChangeText={set("servingGrams")}
            keyboardType="number-pad"
            maxLength={4}
            problem={problem("servingGrams")}
          />
        </Card>

        <Group theme={theme} title={t.food.custom.perServing}>
          <Card theme={theme} style={styles.card}>
            <Field
              theme={theme}
              label={t.food.nutrients.energy}
              unit={KCAL}
              value={form.energyKcal}
              onChangeText={set("energyKcal")}
              keyboardType="number-pad"
              maxLength={4}
              problem={problem("energyKcal")}
            />
            {gramsField("protein", t.food.nutrients.protein)}
            {gramsField("carb", t.food.nutrients.carbs)}
            {gramsField("fat", t.food.nutrients.fat)}
            {gramsField("fiber", t.food.nutrients.fiber)}
            <Text style={[type.small, { color: theme.muted }]}>{t.food.custom.nutrientsHint}</Text>
          </Card>
        </Group>

        {error !== undefined && <Text style={[type.small, { color: theme.danger }]}>{error}</Text>}
        <Button
          theme={theme}
          label={saving ? t.common.saving : logNext !== undefined ? t.food.custom.saveAndAdd : t.common.save}
          onPress={() => void save()}
          disabled={saving}
        />
        {food !== undefined && <Button theme={theme} kind="danger" icon="trash" label={t.food.custom.delete} onPress={remove} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
  content: { padding: space.l, gap: space.xl },
  card: { gap: space.l },
});

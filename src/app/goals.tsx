import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { setDailyGoals, setWaterServing } from "@/data/goals";
import { type Settings, useSettings } from "@/data/repo";
import { useI18n } from "@/i18n/provider";
import { features } from "@/platform/features";
import { GOAL_RANGES, type GoalsField, type GoalsForm, goalsFormOf, parseGoalsForm } from "@/ui/food/forms";
import { Field, problemText } from "@/ui/food/parts";
import { GRAM, KCAL, ML } from "@/ui/food/units";
import { Button, Card, useScrollEndPadding } from "@/ui/kit";
import { type Theme, space, type, useTheme } from "@/ui/theme";

const UNITS: Readonly<Record<GoalsField, string>> = { energy: KCAL, protein: GRAM, water: ML, glass: ML };

/**
 * `/goals`: the user's own daily energy, protein and water goals, and the glass size. Tenulo
 * stores what is typed here and never fills in or suggests a value.
 */
export default function GoalsScreen() {
  const theme = useTheme();
  const settings = useSettings();
  if (settings === undefined) return <View style={[styles.screen, { backgroundColor: theme.background }]} />;
  return <GoalsEditor theme={theme} settings={settings} />;
}

function GoalsEditor({ theme, settings }: { theme: Theme; settings: Settings }) {
  const i18n = useI18n();
  const { t } = i18n;
  const router = useRouter();
  const endPadding = useScrollEndPadding();
  const [form, setForm] = useState<GoalsForm>(() => goalsFormOf(settings));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const parsed = parseGoalsForm(form);
  const problem = (field: GoalsField) => {
    const p = parsed.ok ? undefined : parsed.problems[field];
    return p === undefined ? undefined : problemText(i18n, p, { kind: "whole", range: GOAL_RANGES[field] });
  };
  const set = (field: GoalsField) => (value: string) => setForm((current) => ({ ...current, [field]: value }));

  const save = async () => {
    if (!parsed.ok || saving) return;
    setSaving(true);
    try {
      const { waterServingMl, ...goals } = parsed.value;
      await setDailyGoals(goals);
      await setWaterServing(waterServingMl);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.couldNotSave);
      setSaving(false);
    }
  };

  const goalField = (field: Exclude<GoalsField, "glass">, label: string) => (
    <Field
      theme={theme}
      label={label}
      unit={UNITS[field]}
      value={form[field]}
      onChangeText={set(field)}
      keyboardType="number-pad"
      maxLength={5}
      placeholder={t.goals.optional}
      problem={problem(field)}
    />
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: endPadding }]} keyboardShouldPersistTaps="handled">
        <Text style={[type.body, { color: theme.text }]}>{features.medication ? t.goals.intro : t.goals.narrow.intro}</Text>
        <Card theme={theme} style={styles.card}>
          {goalField("energy", t.goals.energy)}
          {goalField("protein", t.goals.protein)}
          {goalField("water", t.goals.water)}
          <Text style={[type.small, { color: theme.muted }]}>{t.goals.clearHint}</Text>
        </Card>
        <Card theme={theme} style={styles.card}>
          <Field
            theme={theme}
            label={t.goals.glass}
            unit={UNITS.glass}
            value={form.glass}
            onChangeText={set("glass")}
            keyboardType="number-pad"
            maxLength={4}
            hint={t.goals.glassHint}
            problem={problem("glass")}
          />
        </Card>
        {error !== undefined && <Text style={[type.small, { color: theme.danger }]}>{error}</Text>}
        <Button theme={theme} label={saving ? t.common.saving : t.common.save} onPress={() => void save()} disabled={!parsed.ok || saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: space.l, gap: space.xl },
  card: { gap: space.l },
});

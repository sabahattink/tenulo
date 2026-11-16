import { router, useLocalSearchParams } from "expo-router";
import { type ReactNode, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { addExercise } from "@/data/exercise";
import { useWeightEntries } from "@/data/repo";
import { useToday } from "@/data/use-today";
import { exerciseEnergy } from "@/domain/day-summary";
import { EXERCISE_KINDS, type ExerciseKind, INTENSITIES, type Intensity, MAX_DURATION_MIN, MAX_EXERCISE_KCAL } from "@/domain/exercise";
import { useI18n } from "@/i18n/provider";
import { DayPicker } from "@/ui/DayPicker";
import { Icon } from "@/ui/icons";
import { Button, Label, Segmented, useScrollEndPadding } from "@/ui/kit";
import { type Theme, radius, space, type, useTheme } from "@/ui/theme";
import { DEFAULT_DURATION_MIN, DURATION_STEP_MIN, parseDuration, parseOptionalKcal, stepDuration } from "@/ui/today/amounts";
import { EXERCISE_ICONS } from "@/ui/today/exercise-icons";
import { IconButton } from "@/ui/today/IconButton";
import { dateFromParam } from "@/ui/today/params";
import { UNITS } from "@/ui/today/texts";

const MAX_NOTE = 200;

/**
 * Logs exercise the user did. Energy is optional: only what they know (from a watch, say) is
 * saved; otherwise an estimate is shown, marked as one, and never stored.
 */
export default function LogExercise() {
  const theme = useTheme();
  const { t, f } = useI18n();
  const endPadding = useScrollEndPadding();
  const today = useToday();
  const params = useLocalSearchParams<{ date?: string }>();
  const latestWeightG = useWeightEntries()[0]?.weightG;

  const [kind, setKind] = useState<ExerciseKind | undefined>();
  const [durationText, setDurationText] = useState(String(DEFAULT_DURATION_MIN));
  const [intensity, setIntensity] = useState<Intensity>("moderate");
  const [kcalText, setKcalText] = useState("");
  const [date, setDate] = useState(() => dateFromParam(params.date, today));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>();

  const duration = parseDuration(durationText);
  const kcal = parseOptionalKcal(kcalText);
  const durationError = !duration.ok && duration.reason !== "empty";
  const canSave = kind !== undefined && duration.ok && kcal.ok && !saving;

  const step = (direction: 1 | -1) =>
    setDurationText(String(stepDuration(duration.ok ? duration.value : DEFAULT_DURATION_MIN, direction)));

  // Under the energy field: why a typed value is refused, or the live estimate while it is empty.
  let energyNote: ReactNode = null;
  if (!kcal.ok) {
    energyNote = (
      <Text style={[type.small, { color: theme.danger }]} accessibilityLiveRegion="polite">
        {t.exerciseLog.energyInvalid(f.integer(MAX_EXERCISE_KCAL))}
      </Text>
    );
  } else if (kcal.value === null && kind !== undefined && duration.ok) {
    const estimate = exerciseEnergy({ kind, intensity, durationMin: duration.value, energyKcal: null }, latestWeightG);
    energyNote =
      estimate === undefined ? (
        <Text style={[type.small, { color: theme.muted }]}>{t.exerciseLog.noEstimate}</Text>
      ) : (
        <>
          <Text style={[type.bodyStrong, styles.tabular, { color: theme.text }]}>
            {t.exerciseLog.estimate(`${f.integer(estimate.kcal)} ${UNITS.kcal}`)}
          </Text>
          <Text style={[type.small, { color: theme.muted }]}>{t.exerciseLog.estimateNote}</Text>
        </>
      );
  }

  const save = async () => {
    if (kind === undefined || !duration.ok || !kcal.ok || saving) return;
    setSaving(true);
    try {
      await addExercise({ date, kind, durationMin: duration.value, intensity, energyKcal: kcal.value, note });
      router.back();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t.common.couldNotSave);
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: endPadding }]}
      keyboardShouldPersistTaps="handled"
    >
      <Label theme={theme}>{t.exerciseLog.what}</Label>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t.exerciseLog.what}>
        {EXERCISE_KINDS.map((k) => (
          <KindChip key={k} theme={theme} kind={k} label={t.exerciseLog.kinds[k]} selected={k === kind} onPress={() => setKind(k)} />
        ))}
      </View>

      <Label theme={theme}>{t.exerciseLog.duration}</Label>
      <View style={styles.stepper}>
        <IconButton
          theme={theme}
          icon="minus"
          label={t.exerciseLog.shorter(String(DURATION_STEP_MIN))}
          disabled={duration.ok && duration.value <= DURATION_STEP_MIN}
          onPress={() => step(-1)}
        />
        <View style={[styles.durationBox, { borderColor: durationError ? theme.danger : theme.border, backgroundColor: theme.card }]}>
          <TextInput
            value={durationText}
            onChangeText={setDurationText}
            keyboardType="number-pad"
            maxLength={4}
            selectTextOnFocus
            accessibilityLabel={t.exerciseLog.durationLabel}
            style={[styles.durationInput, { color: theme.text }]}
          />
          <Text style={[styles.durationUnit, { color: theme.muted }]}>{t.exerciseLog.minutesUnit}</Text>
        </View>
        <IconButton
          theme={theme}
          icon="plus"
          label={t.exerciseLog.longer(String(DURATION_STEP_MIN))}
          disabled={duration.ok && duration.value >= MAX_DURATION_MIN}
          onPress={() => step(1)}
        />
      </View>
      <Text style={[type.small, styles.message, { color: theme.danger }]} accessibilityLiveRegion="polite">
        {durationError ? t.exerciseLog.durationInvalid(f.integer(MAX_DURATION_MIN)) : " "}
      </Text>

      <Label theme={theme}>{t.exerciseLog.intensity}</Label>
      <View style={styles.block}>
        <Segmented
          theme={theme}
          label={t.exerciseLog.intensityLabel}
          options={INTENSITIES.map((i) => ({ value: i, label: t.exerciseLog.intensities[i] }))}
          value={intensity}
          onChange={setIntensity}
        />
      </View>

      <Label theme={theme}>{t.exerciseLog.energy}</Label>
      <TextInput
        value={kcalText}
        onChangeText={setKcalText}
        keyboardType="number-pad"
        maxLength={5}
        placeholder={t.exerciseLog.energyPlaceholder}
        placeholderTextColor={theme.muted}
        accessibilityLabel={t.exerciseLog.energyLabel}
        style={[styles.input, { color: theme.text, borderColor: kcal.ok ? theme.border : theme.danger, backgroundColor: theme.card }]}
      />
      <View style={styles.estimate}>{energyNote}</View>

      <Label theme={theme}>{t.common.day}</Label>
      <View style={styles.block}>
        <DayPicker theme={theme} value={date} today={today} onChange={setDate} />
      </View>

      <Label theme={theme}>{t.common.noteOptional}</Label>
      <TextInput
        value={note}
        onChangeText={setNote}
        maxLength={MAX_NOTE}
        placeholder={t.exerciseLog.notePlaceholder}
        placeholderTextColor={theme.muted}
        accessibilityLabel={t.common.noteOptional}
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
      />
      {saveError !== undefined && <Text style={[type.small, { color: theme.danger }]}>{saveError}</Text>}

      <View style={styles.save}>
        {kind === undefined && <Text style={[type.small, styles.center, { color: theme.muted }]}>{t.exerciseLog.pickKind}</Text>}
        <Button theme={theme} label={saving ? t.common.saving : t.exerciseLog.save} onPress={() => void save()} disabled={!canSave} />
      </View>
    </ScrollView>
  );
}

/** A kind of exercise: icon and name, one of a radio group. */
function KindChip({
  theme,
  kind,
  label,
  selected,
  onPress,
}: {
  theme: Theme;
  kind: ExerciseKind;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const fg = selected ? theme.accentText : theme.text;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: selected ? theme.accent : theme.border,
          backgroundColor: selected ? theme.accent : theme.card,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Icon name={EXERCISE_ICONS[kind]} color={selected ? theme.accentText : theme.accent} size={20} />
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.s },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.s, marginBottom: space.l },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s,
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingLeft: space.m,
    paddingRight: space.l,
    minHeight: 48,
  },
  chipText: { fontSize: 14, fontWeight: "600" },
  stepper: { flexDirection: "row", alignItems: "center", gap: space.m },
  durationBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: space.s,
    borderWidth: 1.5,
    borderRadius: radius.m,
    minHeight: 56,
    paddingHorizontal: space.m,
  },
  durationInput: { fontSize: 28, fontWeight: "700", fontVariant: ["tabular-nums"], textAlign: "right", minWidth: 56, paddingVertical: space.s },
  durationUnit: { fontSize: 16, fontWeight: "600" },
  message: { minHeight: 20, marginBottom: space.s },
  block: { marginBottom: space.l },
  input: { borderWidth: 1.5, borderRadius: radius.m, paddingHorizontal: space.m, minHeight: 52, fontSize: 16 },
  estimate: { gap: 2, minHeight: 24, marginBottom: space.l, marginTop: space.xs },
  tabular: { fontVariant: ["tabular-nums"] },
  save: { marginTop: space.l, gap: space.s },
  center: { textAlign: "center" },
});

import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, type TextInputInstance, View } from "react-native";
import { addMeasurements, useMeasurements } from "@/data/body";
import { useSettings } from "@/data/repo";
import { useToday } from "@/data/use-today";
import { type LocalDate, diffDays, isLocalDate, parseLocalDate } from "@/domain/date";
import {
  type LengthUnit,
  MAX_LENGTH_MM,
  MEASUREMENT_SITES,
  MIN_LENGTH_MM,
  type MeasurementSite,
  type ParseLengthResult,
  type SiteSummary,
  lengthUnitFor,
  parseLengthInput,
  siteSummaries,
} from "@/domain/measurement";
import type { I18n } from "@/i18n";
import { useI18n } from "@/i18n/provider";
import { DayPicker } from "@/ui/DayPicker";
import { Button, Label, raisedSurface, useScrollEndPadding } from "@/ui/kit";
import { formatLength, formatLengthNumber } from "@/ui/progress/length";
import { type Theme, radius, space, type, useTheme } from "@/ui/theme";

const MAX_DAYS_BACK = 60;
/** A typical waist, for the "enter a number like…" hint. */
const EXAMPLE_MM = 925;

/** The day from `?date=`, when it is a real day within reach of the picker; otherwise today. */
function startDate(param: string | undefined, today: LocalDate): LocalDate {
  if (param === undefined || !isLocalDate(param)) return today;
  const date = parseLocalDate(param);
  const back = diffDays(date, today);
  return back >= 0 && back <= MAX_DAYS_BACK ? date : today;
}

function errorText(r: ParseLengthResult, unit: LengthUnit, { t, f }: I18n): string | undefined {
  if (r.ok || r.reason === "empty") return undefined;
  if (r.reason === "not-a-number") return t.measure.notANumber(formatLengthNumber(f, EXAMPLE_MM, unit));
  return t.measure.outOfRange(formatLength(f, MIN_LENGTH_MM, unit), formatLength(f, MAX_LENGTH_MM, unit));
}

const EMPTY: Readonly<Record<MeasurementSite, string>> = { waist: "", hip: "", chest: "", neck: "", arm: "", thigh: "" };

/** Tape-measure readings from one sitting: fill in any of the sites, save them together. */
export default function AddMeasurement() {
  const theme = useTheme();
  const i18n = useI18n();
  const { t } = i18n;
  const endPadding = useScrollEndPadding();
  const now = useToday();
  const params = useLocalSearchParams<{ date?: string }>();
  const unit = lengthUnitFor(useSettings()?.weightUnit ?? "kg");
  const readings = useMeasurements();
  const latest = useMemo(() => {
    const summaries = siteSummaries(
      readings.map((r) => ({ site: r.site, date: parseLocalDate(r.localDate), measuredAt: r.measuredAt, lengthMm: r.lengthMm })),
    );
    return new Map(summaries.map((s) => [s.site, s]));
  }, [readings]);

  const [texts, setTexts] = useState<Readonly<Record<MeasurementSite, string>>>(EMPTY);
  const [date, setDate] = useState(() => startDate(params.date, now));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>();
  const inputs = useRef<Partial<Record<MeasurementSite, TextInputInstance | null>>>({});
  // One ref callback per site for the screen's lifetime, so React does not detach and re-attach
  // every input on each keystroke.
  const inputRefs = useMemo(
    () =>
      Object.fromEntries(
        MEASUREMENT_SITES.map((site) => [
          site,
          (input: TextInputInstance | null) => {
            inputs.current[site] = input;
          },
        ]),
      ) as Record<MeasurementSite, (input: TextInputInstance | null) => void>,
    [],
  );

  const parsed = MEASUREMENT_SITES.map((site) => ({ site, result: parseLengthInput(texts[site], unit) }));
  const filled = parsed.flatMap((p) => (p.result.ok ? [{ site: p.site, lengthMm: p.result.mm }] : []));
  const hasError = parsed.some((p) => !p.result.ok && p.result.reason !== "empty");
  const canSave = filled.length > 0 && !hasError && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError(undefined);
    try {
      await addMeasurements(filled, date);
      router.back();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t.common.couldNotSave);
      setSaving(false);
    }
  };

  const next = (index: number) => {
    const site = MEASUREMENT_SITES[index + 1];
    if (site === undefined) void save();
    else inputs.current[site]?.focus();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.body, { paddingBottom: endPadding }]}>
        <Text style={[type.body, { color: theme.muted }]}>{t.measure.intro}</Text>
        <View style={[styles.group, raisedSurface(theme)]}>
          {parsed.map(({ site, result }, index) => (
            <SiteField
              key={site}
              theme={theme}
              site={site}
              unit={unit}
              today={now}
              text={texts[site]}
              error={errorText(result, unit, i18n)}
              last={latest.get(site)}
              isLast={index === MEASUREMENT_SITES.length - 1}
              inputRef={inputRefs[site]}
              onChange={(text) => {
                setSaveError(undefined);
                setTexts((current) => ({ ...current, [site]: text }));
              }}
              onSubmit={() => next(index)}
            />
          ))}
        </View>

        <Label theme={theme}>{t.common.day}</Label>
        <DayPicker theme={theme} value={date} today={now} onChange={setDate} maxDaysBack={MAX_DAYS_BACK} />

        <Text style={[type.small, styles.message, { color: theme.danger }]} accessibilityLiveRegion="polite">
          {saveError ?? " "}
        </Text>
        <Button theme={theme} label={saving ? t.common.saving : t.measure.save} onPress={() => void save()} disabled={!canSave} />
        <Text style={[type.small, styles.hint, { color: theme.muted }]}>{t.measure.hint}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SiteField({
  theme,
  site,
  unit,
  today,
  text,
  error,
  last,
  isLast,
  inputRef,
  onChange,
  onSubmit,
}: {
  theme: Theme;
  site: MeasurementSite;
  unit: LengthUnit;
  today: LocalDate;
  text: string;
  error: string | undefined;
  last: SiteSummary | undefined;
  isLast: boolean;
  inputRef: (input: TextInputInstance | null) => void;
  onChange: (text: string) => void;
  onSubmit: () => void;
}) {
  const { t, f } = useI18n();
  const name = t.measure.sites[site];
  const lastText = last === undefined ? undefined : t.measure.last(formatLength(f, last.latestMm, unit), f.relativeDayInline(last.latestDate, today));
  return (
    <View style={[styles.field, !isLast && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={styles.fieldRow}>
        <View style={styles.fieldText}>
          <Text style={[type.bodyStrong, { color: theme.text }]}>{name}</Text>
          {lastText !== undefined && <Text style={[type.small, styles.tabular, { color: theme.muted }]}>{lastText}</Text>}
        </View>
        <View
          style={[
            styles.inputBox,
            { borderColor: error !== undefined ? theme.danger : text !== "" ? theme.accent : theme.border, backgroundColor: theme.background },
          ]}
        >
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={onChange}
            onSubmitEditing={onSubmit}
            returnKeyType={isLast ? "done" : "next"}
            submitBehavior={isLast ? "blurAndSubmit" : "submit"}
            keyboardType="decimal-pad"
            maxLength={5}
            placeholder={last === undefined ? undefined : formatLengthNumber(f, last.latestMm, unit)}
            placeholderTextColor={theme.reading}
            accessibilityLabel={t.measure.fieldLabel(name, unit)}
            accessibilityHint={lastText}
            style={[styles.input, { color: theme.text }]}
          />
          <Text style={[styles.unit, { color: theme.muted }]}>{unit}</Text>
        </View>
      </View>
      {error !== undefined && (
        <Text style={[type.small, { color: theme.danger }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: space.xl, gap: space.m },
  group: { borderWidth: 1, borderRadius: radius.l, paddingHorizontal: space.l },
  field: { paddingVertical: space.m, gap: space.xs },
  fieldRow: { flexDirection: "row", alignItems: "center", gap: space.m, minHeight: 48 },
  fieldText: { flex: 1, gap: 2 },
  tabular: { fontVariant: ["tabular-nums"] },
  inputBox: {
    width: 128,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: radius.m,
    paddingHorizontal: space.m,
    gap: space.xs,
  },
  input: { flex: 1, fontSize: 20, fontWeight: "700", fontVariant: ["tabular-nums"], paddingVertical: space.s, textAlign: "right" },
  unit: { fontSize: 16, fontWeight: "600" },
  message: { minHeight: 20 },
  hint: { textAlign: "center" },
});

import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { type PortionOption, amountAfterPortionChange } from "@/domain/food-entry";
import { type Meal, type ParseQuantityResult, formatQuantity, parseQuantity, stepQuantity } from "@/domain/food-log";
import { useI18n } from "@/i18n/provider";
import { Label, raisedSurface } from "@/ui/kit";
import { type Theme, radius, space, type } from "@/ui/theme";
import { ChoiceChip, MealChips, RoundButton, StatTile } from "./parts";
import { GRAM, decimalMark, gramsFromMg, kcalText } from "./units";

const ONE = 1000;

/** The amount field: typed text, its parsed value, and the stepper. */
export interface AmountInput {
  readonly text: string;
  readonly parsed: ParseQuantityResult;
  setText(text: string): void;
  setMilli(milli: number): void;
  step(direction: 1 | -1): void;
}

export function useAmountInput(initialMilli: number): AmountInput {
  const i18n = useI18n();
  const mark = decimalMark(i18n);
  const [text, setText] = useState(() => formatQuantity(initialMilli, mark));
  const parsed = parseQuantity(text);
  const setMilli = (milli: number) => setText(formatQuantity(milli, mark));
  return {
    text,
    parsed,
    setText,
    setMilli,
    step: (direction) => setMilli(stepQuantity(parsed.ok ? parsed.milli : ONE, direction)),
  };
}

/** What the chosen amount comes to; undefined while the amount is not a number. */
export interface Preview {
  readonly energyKcal: number;
  readonly proteinMg: number | null;
  readonly grams: number | null;
}

/**
 * The portion step: portion chips, the amount (stepper or typed), the meal, and live energy and
 * protein for what is chosen. Used to add a food and to edit a logged one.
 */
export function PortionEditor({
  theme,
  portions,
  portionIndex,
  onPortion,
  amount,
  meal,
  onMeal,
  preview,
  tooMuch,
}: {
  theme: Theme;
  portions: readonly PortionOption[];
  portionIndex: number;
  onPortion: (index: number) => void;
  amount: AmountInput;
  meal: Meal;
  onMeal: (meal: Meal) => void;
  preview: Preview | undefined;
  tooMuch: boolean;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const mark = decimalMark(i18n);
  const amountProblem =
    !amount.parsed.ok && amount.parsed.reason !== "empty"
      ? t.food.portion.amountProblem("1", `1${mark}5`, "250")
      : tooMuch
        ? t.food.portion.tooMuch
        : undefined;

  const pickPortion = (index: number) => {
    const from = portions[portionIndex];
    const to = portions[index];
    if (from !== undefined && to !== undefined && amount.parsed.ok) {
      amount.setMilli(amountAfterPortionChange(from, to, amount.parsed.milli));
    }
    onPortion(index);
  };

  return (
    <View style={styles.editor}>
      <View style={[styles.preview, raisedSurface(theme)]}>
        <Text style={[styles.kcal, { color: theme.text }]} accessibilityLiveRegion="polite">
          {preview === undefined ? t.common.noValue : kcalText(i18n, preview.energyKcal)}
        </Text>
        <View style={styles.stats}>
          <StatTile
            theme={theme}
            label={t.food.nutrients.protein}
            value={preview === undefined || preview.proteinMg === null ? t.common.noValue : gramsFromMg(i18n, preview.proteinMg)}
          />
          <StatTile
            theme={theme}
            label={t.food.portion.weight}
            value={preview === undefined || preview.grams === null ? t.common.noValue : `${i18n.f.integer(preview.grams)} ${GRAM}`}
          />
        </View>
      </View>

      {portions.length > 1 && (
        <View style={styles.group}>
          <Label theme={theme}>{t.food.portion.portion}</Label>
          <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={t.food.portion.portion}>
            {portions.map((p, i) => (
              <ChoiceChip
                key={p.id ?? p.label}
                theme={theme}
                label={portionChipLabel(p)}
                selected={i === portionIndex}
                onPress={() => pickPortion(i)}
              />
            ))}
          </View>
        </View>
      )}

      <View style={styles.group}>
        <Label theme={theme}>{portions.length > 1 ? t.food.portion.amount : `${t.food.portion.amount} · ${portions[0]?.label ?? ""}`}</Label>
        <View style={styles.stepper}>
          <RoundButton theme={theme} icon="minus" label={t.food.portion.less} onPress={() => amount.step(-1)} />
          <TextInput
            value={amount.text}
            onChangeText={amount.setText}
            keyboardType="decimal-pad"
            maxLength={10}
            selectTextOnFocus
            accessibilityLabel={t.food.portion.amountLabel}
            style={[
              styles.amount,
              { color: theme.text, backgroundColor: theme.surfaceAlt, borderColor: amountProblem === undefined ? theme.surfaceAlt : theme.danger },
            ]}
          />
          <RoundButton theme={theme} icon="plus" label={t.food.portion.more} onPress={() => amount.step(1)} />
        </View>
        {amountProblem !== undefined && (
          <Text style={[type.small, { color: theme.danger }]} accessibilityLiveRegion="polite">
            {amountProblem}
          </Text>
        )}
      </View>

      <MealChips theme={theme} value={meal} onChange={onMeal} />
    </View>
  );
}

/** "adet · 50 g"; weight portions ("100 g", "gram") and custom servings without grams as they are. */
function portionChipLabel(p: PortionOption): string {
  if (p.grams === null || p.grams === 1 || /^\d/.test(p.label)) return p.label;
  return `${p.label} · ${p.grams} ${GRAM}`;
}

const styles = StyleSheet.create({
  editor: { gap: space.xl },
  preview: { borderWidth: 1, borderRadius: radius.l, padding: space.l, gap: space.m, alignItems: "stretch" },
  kcal: { fontSize: 40, lineHeight: 46, fontWeight: "700", letterSpacing: -0.8, fontVariant: ["tabular-nums"], textAlign: "center" },
  stats: { flexDirection: "row", gap: space.s },
  group: { gap: space.s },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.s },
  stepper: { flexDirection: "row", alignItems: "center", gap: space.m },
  amount: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.m,
    borderWidth: 1.5,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});

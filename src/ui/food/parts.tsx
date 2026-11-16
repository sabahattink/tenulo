import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";
import { MEALS, type Meal } from "@/domain/food-log";
import type { Range } from "@/domain/goals";
import type { I18n } from "@/i18n";
import { useI18n } from "@/i18n/provider";
import { Icon, type IconName } from "@/ui/icons";
import { Label } from "@/ui/kit";
import { type Theme, radius, space, type } from "@/ui/theme";
import type { FieldProblem } from "./forms";

/** Chips are drawn 40 dp tall like the kit's; the slop brings the touch target to 48 dp. */
const CHIP_SLOP = { top: 4, bottom: 4, left: 0, right: 0 } as const;

/** A one-of-n chip with the kit's look and a 48 dp touch target. */
export function ChoiceChip({
  theme,
  label,
  selected,
  onPress,
  accessibilityLabel,
}: {
  theme: Theme;
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={CHIP_SLOP}
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
      <Text style={[styles.chipText, { color: selected ? theme.accentText : theme.text }]}>{label}</Text>
    </Pressable>
  );
}

export function MealChips({ theme, value, onChange }: { theme: Theme; value: Meal; onChange: (m: Meal) => void }) {
  const { t } = useI18n();
  return (
    <View style={styles.group}>
      <Label theme={theme}>{t.food.portion.meal}</Label>
      <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={t.food.portion.meal}>
        {MEALS.map((m) => (
          <ChoiceChip key={m} theme={theme} label={t.food.meals[m]} selected={m === value} onPress={() => onChange(m)} />
        ))}
      </View>
    </View>
  );
}

/** A small figure with its caption, like the stats on Today. */
export function StatTile({ theme, label, value }: { theme: Theme; label: string; value: string }) {
  const { f } = useI18n();
  return (
    <View style={[styles.stat, { backgroundColor: theme.surfaceAlt }]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.statLabel, { color: theme.muted }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {f.upper(label)}
      </Text>
      <Text style={[type.number, { color: theme.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/** A round 48 dp icon button. */
export function RoundButton({
  theme,
  icon,
  label,
  onPress,
  disabled = false,
}: {
  theme: Theme;
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.round, { backgroundColor: theme.accentSoft, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}
    >
      <Icon name={icon} color={theme.accent} size={22} />
    </Pressable>
  );
}

/** One food in a list: name, a detail line, and a figure on the right. */
export function FoodRow({
  theme,
  title,
  detail,
  right,
  onPress,
  hint,
  last = false,
}: {
  theme: Theme;
  title: string;
  detail?: string;
  right?: string;
  onPress: () => void;
  hint?: string;
  last?: boolean;
}) {
  const a11y = [title, detail, right].filter((s) => s !== undefined && s !== "").join(", ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth },
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <View style={styles.rowText}>
        <Text style={[type.bodyStrong, { color: theme.text }]} numberOfLines={2}>
          {title}
        </Text>
        {detail !== undefined && detail !== "" && (
          <Text style={[type.small, { color: theme.muted }]} numberOfLines={1}>
            {detail}
          </Text>
        )}
      </View>
      {right !== undefined && <Text style={[type.number, { color: theme.text }]}>{right}</Text>}
    </Pressable>
  );
}

/** A row that starts something (quick add, a new food): icon, title, detail. */
export function ActionRow({
  theme,
  icon,
  title,
  detail,
  onPress,
  last = false,
}: {
  theme: Theme;
  icon: IconName;
  title: string;
  detail?: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth },
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <View style={[styles.actionIcon, { backgroundColor: theme.accentSoft }]}>
        <Icon name={icon} color={theme.accent} size={20} />
      </View>
      <View style={styles.rowText}>
        <Text style={[type.bodyStrong, { color: theme.accent }]}>{title}</Text>
        {detail !== undefined && <Text style={[type.small, { color: theme.muted }]}>{detail}</Text>}
      </View>
    </Pressable>
  );
}

/** A labelled text field with its unit, and a problem or a hint under it. */
export function Field({
  theme,
  label,
  unit,
  problem,
  hint,
  ...input
}: {
  theme: Theme;
  label: string;
  unit?: string;
  problem?: string;
  hint?: string;
} & Pick<
  TextInputProps,
  | "value"
  | "onChangeText"
  | "placeholder"
  | "keyboardType"
  | "maxLength"
  | "autoFocus"
  | "accessibilityLabel"
  | "returnKeyType"
  | "onSubmitEditing"
  | "autoCapitalize"
>) {
  return (
    <View style={styles.field}>
      <Text style={[type.bodyStrong, { color: theme.text }]}>{label}</Text>
      <View
        style={[
          styles.inputRow,
          { backgroundColor: theme.surfaceAlt, borderColor: problem === undefined ? theme.surfaceAlt : theme.danger },
        ]}
      >
        <TextInput
          {...input}
          accessibilityLabel={input.accessibilityLabel ?? label}
          placeholderTextColor={theme.muted}
          style={[styles.input, { color: theme.text }]}
        />
        {unit !== undefined && <Text style={[type.bodyStrong, { color: theme.muted }]}>{unit}</Text>}
      </View>
      {problem !== undefined ? (
        <Text style={[type.small, { color: theme.danger }]} accessibilityLiveRegion="polite">
          {problem}
        </Text>
      ) : (
        hint !== undefined && <Text style={[type.small, { color: theme.muted }]}>{hint}</Text>
      )}
    </View>
  );
}

export type FieldKind = { readonly kind: "text"; readonly max: number } | { readonly kind: "whole"; readonly range: Range } | { readonly kind: "grams" };

/** Grams typed into a nutrient field: at most 2000 g (`MAX_SERVING_NUTRIENT_G`). */
const MAX_GRAMS_SHOWN = 2000;

/** The words for a field's problem. Ranges are shown without group marks, as they are typed. */
export function problemText({ t }: Pick<I18n, "t">, problem: FieldProblem, field: FieldKind): string {
  if (problem === "required") return t.food.problems.required;
  switch (field.kind) {
    case "text":
      return t.food.problems.tooLong(field.max);
    case "whole":
      return t.food.problems.wholeNumber(String(field.range.min), String(field.range.max));
    case "grams":
      return problem === "out-of-range"
        ? t.food.problems.gramsTooMuch(String(MAX_GRAMS_SHOWN))
        : t.food.problems.grams(`12${t.number.decimalMark}5`);
  }
}

/** A titled block inside a screen. */
export function Group({ theme, title, children }: { theme: Theme; title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Label theme={theme}>{title}</Label>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.s },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.s },
  chip: { borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: space.l, minHeight: 40, justifyContent: "center" },
  chipText: { fontSize: 14, fontWeight: "600" },
  stat: { flex: 1, borderRadius: radius.m, paddingVertical: space.s, paddingHorizontal: space.m, gap: 2 },
  // Upper-cased in JS with the language's rules (see type.caption in theme.ts).
  statLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.4 },
  round: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: space.m, minHeight: 56, paddingVertical: space.s },
  rowText: { flex: 1, gap: 2 },
  actionIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  field: { gap: space.s },
  inputRow: { flexDirection: "row", alignItems: "center", gap: space.s, borderRadius: radius.m, borderWidth: 1.5, paddingHorizontal: space.m },
  input: { flex: 1, minHeight: 50, fontSize: 18, fontWeight: "600", fontVariant: ["tabular-nums"] },
});

import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useCustomFoods, useRecentFoodEntries } from "@/data/food";
import { useToday } from "@/data/use-today";
import {
  type FoodChoice,
  amountPhrase,
  choiceKey,
  choiceName,
  foodsInCategory,
  portionOptions,
  resolveRecents,
  searchCustomFoods,
  snapshotFor,
  sortByName,
  startingPortion,
} from "@/domain/food-entry";
import { CATALOG_FOODS, findCatalogFood } from "@/domain/foods/catalog";
import { searchFoods } from "@/domain/foods/search";
import { FOOD_CATEGORIES, type FoodCategory } from "@/domain/foods/types";
import type { I18n } from "@/i18n";
import { useI18n } from "@/i18n/provider";
import { ActionRow, ChoiceChip, FoodRow } from "@/ui/food/parts";
import { type Param, dateParam, mealParam, minuteOfDay } from "@/ui/food/params";
import { decimalMark, kcalText } from "@/ui/food/units";
import { Icon, type IconName } from "@/ui/icons";
import { Label, useScrollEndPadding } from "@/ui/kit";
import { type Theme, radius, space, type, useTheme } from "@/ui/theme";

/** Enough recent foods to cover a few days of usual meals without a long scroll. */
const RECENT_LIMIT = 12;

/** A food offered on this screen, with the portion and amount the portion step starts at. */
interface Offer {
  readonly choice: FoodChoice;
  readonly last?: { readonly portionId: string | null; readonly quantityMilli: number };
}

interface Action {
  readonly key: string;
  readonly icon: IconName;
  readonly title: string;
  readonly detail: string;
  readonly onPress: () => void;
}

/** One card of the list: a titled group of foods, a group of actions, or a line of text. */
type Section =
  | {
      readonly kind: "foods";
      readonly key: string;
      readonly title: string;
      readonly offers: readonly Offer[];
      readonly action?: { readonly label: string; readonly onPress: () => void };
    }
  | { readonly kind: "actions"; readonly key: string; readonly actions: readonly Action[] }
  | { readonly kind: "note"; readonly key: string; readonly text: string };

/** "1 adet" and "78 kcal": a food at the amount its portion step would start with. */
function offerFigures(i18n: I18n, offer: Offer): { detail: string; right: string; portionId: string | null; quantityMilli: number } {
  const portions = portionOptions(offer.choice, i18n.lang);
  const start = startingPortion(offer.choice, offer.last);
  const portion = portions[start.index];
  if (portion === undefined) return { detail: "", right: "", portionId: null, quantityMilli: start.quantityMilli };
  const s = snapshotFor(offer.choice, portion, start.quantityMilli, i18n.lang);
  return {
    detail: amountPhrase(start.quantityMilli, portion.label, i18n.lang, decimalMark(i18n)),
    right: kcalText(i18n, s.energyKcal),
    portionId: portion.id,
    quantityMilli: start.quantityMilli,
  };
}

export default function AddFood() {
  const theme = useTheme();
  const i18n = useI18n();
  const { t, lang } = i18n;
  const router = useRouter();
  const endPadding = useScrollEndPadding();
  const today = useToday();
  const params = useLocalSearchParams<{ meal?: Param; date?: Param }>();
  // Fixed when the screen opens: the meal the user tapped, or the one for the time of day.
  const [meal] = useState(() => mealParam(params.meal, minuteOfDay(new Date())));
  const date = dateParam(params.date, today);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FoodCategory | undefined>();
  const recentEntries = useRecentFoodEntries();
  const customFoods = useCustomFoods();

  const recents = useMemo(
    () => resolveRecents(recentEntries, customFoods, findCatalogFood, RECENT_LIMIT),
    [recentEntries, customFoods],
  );

  const open = (offer: Offer) => {
    const figures = offerFigures(i18n, offer);
    router.push({
      pathname: "/food/portion",
      params: {
        source: offer.choice.kind,
        id: offer.choice.food.id,
        meal,
        date,
        ...(offer.last === undefined ? {} : { portion: figures.portionId ?? "", qty: String(figures.quantityMilli) }),
      },
    });
  };

  const quickAdd: Action = {
    key: "quick",
    icon: "plus",
    title: t.food.add.quickAdd,
    detail: t.food.add.quickAddDetail,
    onPress: () => router.push({ pathname: "/food/quick", params: { meal, date } }),
  };
  const addOwn: Action = {
    key: "own",
    icon: "food",
    title: t.food.add.addOwn,
    detail: t.food.add.addOwnDetail,
    onPress: () => router.push({ pathname: "/food/custom", params: { meal, date } }),
  };

  const sections = buildSections({ i18n, query, category, recents, customFoods, quickAdd, addOwn, manageMine: () => router.push("/food/mine") });

  const renderSection = ({ item }: { item: Section }) => {
    switch (item.kind) {
      case "foods":
        return (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Label theme={theme}>{item.title}</Label>
              {item.action !== undefined && (
                <Pressable accessibilityRole="button" onPress={item.action.onPress} style={styles.headAction}>
                  <Text style={[type.small, styles.headActionText, { color: theme.accent }]}>{item.action.label}</Text>
                </Pressable>
              )}
            </View>
            <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {item.offers.map((offer, i) => {
                const figures = offerFigures(i18n, offer);
                return (
                  <FoodRow
                    key={choiceKey(offer.choice)}
                    theme={theme}
                    title={choiceName(offer.choice, lang)}
                    detail={figures.detail}
                    right={figures.right}
                    last={i === item.offers.length - 1}
                    onPress={() => open(offer)}
                  />
                );
              })}
            </View>
          </View>
        );
      case "actions":
        return (
          <View style={[styles.actions, styles.group, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {item.actions.map((a, i) => (
              <ActionRow key={a.key} theme={theme} icon={a.icon} title={a.title} detail={a.detail} onPress={a.onPress} last={i === item.actions.length - 1} />
            ))}
          </View>
        );
      case "note":
        return <Text style={[type.body, styles.note, { color: theme.muted }]}>{item.text}</Text>;
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <View style={styles.top}>
        <View style={[styles.search, { backgroundColor: theme.card, borderColor: theme.accent }]}>
          <Icon name="search" color={theme.muted} size={22} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            maxLength={60}
            placeholder={t.food.add.searchPlaceholder}
            placeholderTextColor={theme.muted}
            accessibilityLabel={t.food.add.searchLabel}
            style={[styles.searchInput, { color: theme.text }]}
          />
          {query !== "" && (
            <Pressable accessibilityRole="button" accessibilityLabel={t.food.add.clear} onPress={() => setQuery("")} style={styles.clear}>
              <Text style={[styles.clearText, { color: theme.muted }]}>×</Text>
            </Pressable>
          )}
        </View>
        {query.trim() === "" && <CategoryChips theme={theme} value={category} onChange={setCategory} />}
      </View>
      <FlatList
        data={sections}
        keyExtractor={(s) => s.key}
        renderItem={renderSection}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.list, { paddingBottom: endPadding }]}
      />
    </View>
  );
}

/**
 * What the list shows. Typing: your own foods that match, then the food list, then the ways to add
 * something that is not there. A category: its foods. Otherwise: quick add, recent foods, your own.
 */
function buildSections(p: {
  i18n: I18n;
  query: string;
  category: FoodCategory | undefined;
  recents: ReturnType<typeof resolveRecents>;
  customFoods: ReturnType<typeof useCustomFoods>;
  quickAdd: Action;
  addOwn: Action;
  manageMine: () => void;
}): Section[] {
  const { t, lang } = p.i18n;
  const trimmed = p.query.trim();
  const custom = (food: (typeof p.customFoods)[number]): Offer => ({ choice: { kind: "custom", food } });
  const listed = (food: (typeof CATALOG_FOODS)[number]): Offer => ({ choice: { kind: "catalog", food } });

  if (trimmed !== "") {
    const recentIds = p.recents.flatMap((r) => (r.choice.kind === "catalog" ? [r.choice.food.id] : []));
    const mine = searchCustomFoods(p.customFoods, trimmed, lang).map(custom);
    const found = searchFoods(CATALOG_FOODS, trimmed, lang, { recentIds }).map(listed);
    const out: Section[] = [];
    if (mine.length > 0) out.push({ kind: "foods", key: "mine", title: t.food.add.mine, offers: mine });
    if (found.length > 0) out.push({ kind: "foods", key: "list", title: t.food.add.results, offers: found });
    if (out.length === 0) out.push({ kind: "note", key: "none", text: t.food.add.noResults(trimmed) });
    return [...out, { kind: "actions", key: "more", actions: [p.addOwn, p.quickAdd] }];
  }
  if (p.category !== undefined) {
    return [
      { kind: "foods", key: `cat-${p.category}`, title: t.food.categories[p.category], offers: foodsInCategory(CATALOG_FOODS, p.category, lang).map(listed) },
    ];
  }
  const out: Section[] = [{ kind: "actions", key: "quick", actions: [p.quickAdd] }];
  if (p.recents.length > 0) {
    out.push({
      kind: "foods",
      key: "recent",
      title: t.food.add.recent,
      offers: p.recents.map((r) => ({ choice: r.choice, last: { portionId: r.portionId, quantityMilli: r.quantityMilli } })),
    });
  }
  if (p.customFoods.length === 0) {
    out.push({ kind: "actions", key: "own", actions: [p.addOwn] });
  } else {
    out.push({
      kind: "foods",
      key: "mine",
      title: t.food.add.mine,
      offers: sortByName(p.customFoods, lang).map(custom),
      action: { label: t.food.add.manageMine, onPress: p.manageMine },
    });
  }
  return out;
}

function CategoryChips({ theme, value, onChange }: { theme: Theme; value: FoodCategory | undefined; onChange: (c: FoodCategory | undefined) => void }) {
  const { t } = useI18n();
  return (
    <View style={styles.categories}>
      <View style={styles.categoriesHead}>
        <Label theme={theme}>{t.food.add.browse}</Label>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.chips}
        accessibilityRole="radiogroup"
        accessibilityLabel={t.food.add.categoriesLabel}
      >
        {FOOD_CATEGORIES.map((c) => (
          <ChoiceChip
            key={c}
            theme={theme}
            label={t.food.categories[c]}
            selected={c === value}
            onPress={() => onChange(c === value ? undefined : c)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { paddingTop: space.l, gap: space.m },
  search: {
    marginHorizontal: space.l,
    flexDirection: "row",
    alignItems: "center",
    gap: space.s,
    borderWidth: 2,
    borderRadius: radius.l,
    paddingLeft: space.l,
  },
  searchInput: { flex: 1, minHeight: 52, fontSize: 18 },
  clear: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  clearText: { fontSize: 26, lineHeight: 28 },
  categories: { gap: space.s },
  categoriesHead: { paddingHorizontal: space.l + space.xs },
  chips: { gap: space.s, paddingHorizontal: space.l, paddingVertical: space.xs },
  list: { paddingHorizontal: space.l },
  section: { gap: space.s, marginTop: space.l },
  actions: { marginTop: space.l },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.xs, minHeight: 24 },
  headAction: { minHeight: 48, justifyContent: "center", paddingHorizontal: space.s, marginVertical: -space.m },
  headActionText: { fontWeight: "600" },
  group: { borderWidth: 1, borderRadius: radius.l, paddingHorizontal: space.l },
  note: { marginTop: space.l, paddingHorizontal: space.xs },
});

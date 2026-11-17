/**
 * From a chosen food to a logged entry, and back: the portions a food offers, the snapshot an entry
 * stores, how an entry is recomputed when its amount changes, and the orderings the food screens
 * show. Pure and integer-only, like the rest of the food diary (food-log.ts, foods/nutrition.ts).
 */
import {
  type LoggedFood,
  MAX_ENTRY_KCAL,
  MAX_NUTRIENT_MG,
  MAX_QUANTITY_MILLI,
  MIN_QUANTITY_MILLI,
  formatQuantity,
  recentFoods,
} from "./food-log";
import { nutritionFor, portionGrams } from "./foods/nutrition";
import { foldTurkish } from "./foods/search";
import type { CatalogFood, FoodCategory, FoodLocale } from "./foods/types";

/**
 * `food_entry.portion_id` of a quick add (a name and energy with no food behind it). An entry whose
 * custom food was deleted also has neither food id, but keeps a null portion id; this tells the two
 * apart, so a quick add is edited by its values and the other is scaled by its amount.
 */
export const QUICK_ADD_PORTION_ID = "quick-add";

const MILLI = 1000;
/** `food_entry.grams` (schema check). */
const MAX_ENTRY_GRAMS = 100_000;

/** Energy in kcal and nutrients in mg, each null when unknown (custom foods, quick adds). */
export interface EntryNutrients {
  readonly energyKcal: number;
  readonly proteinMg: number | null;
  readonly carbMg: number | null;
  readonly fatMg: number | null;
  readonly fiberMg: number | null;
}

/** A custom food per serving, as stored in `custom_food`. */
export interface CustomFoodValues extends EntryNutrients {
  readonly id: string;
  readonly name: string;
  readonly servingLabel: string;
  readonly servingGrams: number | null;
}

export type FoodChoice =
  | { readonly kind: "catalog"; readonly food: CatalogFood }
  | { readonly kind: "custom"; readonly food: CustomFoodValues };

/** One way to measure a chosen food. Custom foods have one, their serving, with a null id. */
export interface PortionOption {
  readonly id: string | null;
  readonly label: string;
  readonly grams: number | null;
}

/** What `food_entry` stores for one logged food, apart from date, meal and time. */
export interface EntrySnapshot extends EntryNutrients {
  readonly catalogFoodId: string | null;
  readonly customFoodId: string | null;
  readonly name: string;
  readonly portionId: string | null;
  readonly portionLabel: string;
  readonly quantityMilli: number;
  readonly grams: number | null;
}

/** numerator / denominator for non-negative safe integers, rounded half away from zero. */
function divideRounded(numerator: number, denominator: number): number {
  if (!Number.isSafeInteger(numerator) || numerator < 0) throw new RangeError(`Bad value: ${numerator}`);
  const quotient = Math.floor(numerator / denominator);
  const remainder = numerator - quotient * denominator;
  return 2 * remainder >= denominator ? quotient + 1 : quotient;
}

function scaled(value: number | null, from: number, to: number): number | null {
  return value === null ? null : divideRounded(value * to, from);
}

export function choiceName(choice: FoodChoice, locale: FoodLocale): string {
  return choice.kind === "catalog" ? choice.food.name[locale] : choice.food.name;
}

/** "catalog:egg-boiled" / "custom:<ulid>", as `sourceKey` in food-log.ts builds it from an entry. */
export function choiceKey(choice: FoodChoice): string {
  return `${choice.kind}:${choice.food.id}`;
}

export function portionOptions(choice: FoodChoice, locale: FoodLocale): PortionOption[] {
  if (choice.kind === "custom") return [{ id: null, label: choice.food.servingLabel, grams: choice.food.servingGrams }];
  return choice.food.portions.map((p) => ({ id: p.id, label: p.label[locale], grams: p.grams }));
}

/**
 * Where the portion step starts: the portion and amount used last time, when that portion still
 * exists; otherwise one of the food's default portion.
 */
export function startingPortion(
  choice: FoodChoice,
  last?: { readonly portionId: string | null; readonly quantityMilli: number },
): { readonly index: number; readonly quantityMilli: number } {
  if (last === undefined) return { index: 0, quantityMilli: MILLI };
  if (choice.kind === "custom") return { index: 0, quantityMilli: last.quantityMilli };
  const index = choice.food.portions.findIndex((p) => p.id === last.portionId);
  return index < 0 ? { index: 0, quantityMilli: MILLI } : { index, quantityMilli: last.quantityMilli };
}

/** A food offered again in one tap, with the portion and amount used last time. */
export interface RecentChoice {
  readonly choice: FoodChoice;
  readonly portionId: string | null;
  readonly quantityMilli: number;
}

/**
 * Recent entries (newest first or not) as foods the user can log again: each food once, most
 * recent first. Foods no longer in the bundled list or among the custom foods are left out.
 */
export function resolveRecents(
  entries: readonly LoggedFood[],
  customFoods: readonly CustomFoodValues[],
  findCatalog: (id: string) => CatalogFood | undefined,
  limit: number,
): RecentChoice[] {
  const customById = new Map(customFoods.map((f) => [f.id, f]));
  const out: RecentChoice[] = [];
  for (const e of recentFoods(entries, entries.length)) {
    if (out.length >= limit) break;
    const choice = choiceOf(e, findCatalog, customById);
    if (choice !== undefined) out.push({ choice, portionId: e.portionId, quantityMilli: e.quantityMilli });
  }
  return out;
}

function choiceOf(
  e: Pick<LoggedFood, "catalogFoodId" | "customFoodId">,
  findCatalog: (id: string) => CatalogFood | undefined,
  customById: ReadonlyMap<string, CustomFoodValues>,
): FoodChoice | undefined {
  if (e.catalogFoodId !== null) {
    const food = findCatalog(e.catalogFoodId);
    return food === undefined ? undefined : { kind: "catalog", food };
  }
  if (e.customFoodId !== null) {
    const food = customById.get(e.customFoodId);
    return food === undefined ? undefined : { kind: "custom", food };
  }
  return undefined;
}

function customNutrients(food: CustomFoodValues, quantityMilli: number): EntryNutrients {
  return scaleNutrients(food, MILLI, quantityMilli);
}

/**
 * The entry for `quantityMilli` thousandths of `portion` of a food: name and portion label in the
 * active language, whole grams, and nutrients computed from those whole grams (catalog) or the
 * serving's values times the amount (custom).
 */
export function snapshotFor(choice: FoodChoice, portion: PortionOption, quantityMilli: number, locale: FoodLocale): EntrySnapshot {
  const grams = portion.grams === null ? null : portionGrams(portion.grams, quantityMilli);
  if (choice.kind === "catalog") {
    return {
      catalogFoodId: choice.food.id,
      customFoodId: null,
      name: choice.food.name[locale],
      portionId: portion.id,
      portionLabel: portion.label,
      quantityMilli,
      grams,
      ...nutritionFor(choice.food.per100g, grams ?? 0),
    };
  }
  return {
    catalogFoodId: null,
    customFoodId: choice.food.id,
    name: choice.food.name,
    portionId: null,
    portionLabel: choice.food.servingLabel,
    quantityMilli,
    grams,
    ...customNutrients(choice.food, quantityMilli),
  };
}

/** Values for `to` thousandths when `n` holds them for `from`; unknown values stay unknown. */
export function scaleNutrients(n: EntryNutrients, from: number, to: number): EntryNutrients {
  if (!Number.isSafeInteger(from) || from <= 0) throw new RangeError(`Bad starting amount: ${from}`);
  return {
    energyKcal: divideRounded(n.energyKcal * to, from),
    proteinMg: scaled(n.proteinMg, from, to),
    carbMg: scaled(n.carbMg, from, to),
    fatMg: scaled(n.fatMg, from, to),
    fiberMg: scaled(n.fiberMg, from, to),
  };
}

/** False when one entry would hold more than the database allows (a typo like 50 000 g). */
export function withinEntryLimits(e: EntryNutrients & { readonly grams: number | null }): boolean {
  const nutrientsOk = [e.proteinMg, e.carbMg, e.fatMg, e.fiberMg].every((v) => v === null || v <= MAX_NUTRIENT_MG);
  return e.energyKcal <= MAX_ENTRY_KCAL && nutrientsOk && (e.grams === null || e.grams <= MAX_ENTRY_GRAMS);
}

/** A restaurant meal and the like: a name (or `fallbackName`), energy and maybe protein. */
export function quickAddSnapshot(
  name: string,
  energyKcal: number,
  proteinMg: number | null,
  fallbackName: string,
  portionLabel: string,
): EntrySnapshot {
  const trimmed = name.trim();
  return {
    catalogFoodId: null,
    customFoodId: null,
    name: trimmed === "" ? fallbackName : trimmed,
    portionId: QUICK_ADD_PORTION_ID,
    portionLabel,
    quantityMilli: MILLI,
    grams: null,
    energyKcal,
    proteinMg,
    carbMg: null,
    fatMg: null,
    fiberMg: null,
  };
}

/** The bundled list's weight portions: every food has "1 g" and "100 g" (ADR 0005). */
const WEIGHT_PORTION_IDS: ReadonlySet<string> = new Set(["g", "100g"]);

/**
 * The amount to show after the user picks another portion. Into a weight portion the weight carries
 * over (1 piece of 50 g becomes 50 g); out of one, or without known grams, it starts again at one
 * portion; between two household portions the count stays (2 slices become 2 pieces).
 */
export function amountAfterPortionChange(from: PortionOption, to: PortionOption, quantityMilli: number): number {
  const toWeight = to.id !== null && WEIGHT_PORTION_IDS.has(to.id);
  const fromWeight = from.id !== null && WEIGHT_PORTION_IDS.has(from.id);
  if (toWeight && from.grams !== null && to.grams !== null) {
    const milli = divideRounded(portionGrams(from.grams, quantityMilli) * MILLI, to.grams);
    return Math.min(MAX_QUANTITY_MILLI, Math.max(MIN_QUANTITY_MILLI, milli));
  }
  return fromWeight ? MILLI : quantityMilli;
}

/** What a logged entry needs for editing. */
export type StoredEntry = Omit<EntrySnapshot, "name">;

/**
 * What an entry is recomputed from when its amount changes: its food when it is still there (and,
 * for a catalog food, its portion too), else the values it was logged with. Quick adds are edited
 * by their values.
 */
export type EntrySource =
  | { readonly kind: "catalog"; readonly food: CatalogFood }
  | { readonly kind: "custom"; readonly food: CustomFoodValues }
  | { readonly kind: "snapshot" }
  | { readonly kind: "quick" };

export function sourceOfEntry(
  entry: Pick<StoredEntry, "catalogFoodId" | "customFoodId" | "portionId">,
  findCatalog: (id: string) => CatalogFood | undefined,
  customFoods: readonly CustomFoodValues[],
): EntrySource {
  if (entry.catalogFoodId === null && entry.customFoodId === null && entry.portionId === QUICK_ADD_PORTION_ID) {
    return { kind: "quick" };
  }
  const choice = choiceOf(entry, findCatalog, new Map(customFoods.map((f) => [f.id, f])));
  if (choice === undefined) return { kind: "snapshot" };
  if (choice.kind === "catalog" && !choice.food.portions.some((p) => p.id === entry.portionId)) return { kind: "snapshot" };
  return choice;
}

/** The portions an entry can be changed to. A snapshot keeps the one it was logged with. */
export function editPortions(entry: StoredEntry, source: EntrySource, locale: FoodLocale): PortionOption[] {
  if (source.kind === "catalog" || source.kind === "custom") return portionOptions(source, locale);
  return [{ id: entry.portionId, label: entry.portionLabel, grams: null }];
}

export type EntryChange = Omit<StoredEntry, "catalogFoodId" | "customFoodId">;

/**
 * The entry with a new portion and amount, always derived from what was logged, so editing an old
 * entry never pulls in values the food list or a custom food has today (history is not rewritten):
 * - same portion and amount: the entry as logged (moving it to another meal changes nothing);
 * - same portion, new amount: the logged values scaled by the amount;
 * - another portion of a list food: grams from the list's portion, the logged values scaled by
 *   weight;
 * - otherwise (no known weight to scale by): recomputed from the food, the only option left.
 * The logged label stays when the portion does, so a Turkish entry keeps "adet" after the app was
 * switched to English.
 */
export function editedEntry(
  entry: StoredEntry,
  source: EntrySource,
  portion: PortionOption,
  quantityMilli: number,
  locale: FoodLocale,
): EntryChange {
  if (portion.id === entry.portionId && quantityMilli === entry.quantityMilli) {
    return {
      portionId: entry.portionId,
      portionLabel: entry.portionLabel,
      quantityMilli,
      grams: entry.grams,
      energyKcal: entry.energyKcal,
      proteinMg: entry.proteinMg,
      carbMg: entry.carbMg,
      fatMg: entry.fatMg,
      fiberMg: entry.fiberMg,
    };
  }
  if (portion.id === entry.portionId) {
    return {
      portionId: entry.portionId,
      portionLabel: entry.portionLabel,
      quantityMilli,
      grams: scaled(entry.grams, entry.quantityMilli, quantityMilli),
      ...scaleNutrients(entry, entry.quantityMilli, quantityMilli),
    };
  }
  if (source.kind === "catalog" || source.kind === "custom") {
    const s = snapshotFor(source, portion, quantityMilli, locale);
    if (s.grams !== null && entry.grams !== null && entry.grams > 0) {
      return { portionId: s.portionId, portionLabel: s.portionLabel, quantityMilli, grams: s.grams, ...scaleNutrients(entry, entry.grams, s.grams) };
    }
    const portionLabel = s.portionId === entry.portionId && source.kind === "catalog" ? entry.portionLabel : s.portionLabel;
    return {
      portionId: s.portionId,
      portionLabel,
      quantityMilli,
      grams: s.grams,
      energyKcal: s.energyKcal,
      proteinMg: s.proteinMg,
      carbMg: s.carbMg,
      fatMg: s.fatMg,
      fiberMg: s.fiberMg,
    };
  }
  return {
    portionId: entry.portionId,
    portionLabel: entry.portionLabel,
    quantityMilli,
    grams: scaled(entry.grams, entry.quantityMilli, quantityMilli),
    ...scaleNutrients(entry, entry.quantityMilli, quantityMilli),
  };
}

/** Turkish alphabetical order; letters outside it (q, w, x) sort by where English puts them. */
const TURKISH_ORDER = " 0123456789aâbcçdefgğhıiîjklmnoöpqrsştuûüvwxyz";
const ENGLISH_ORDER = " 0123456789abcdefghijklmnopqrstuvwxyz";
const COMBINING_MARKS = /[̀-ͯ]/g;

function collationKey(name: string, locale: FoodLocale): number[] {
  const lowered =
    locale === "tr"
      ? name.replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase()
      : name.toLowerCase().normalize("NFD").replace(COMBINING_MARKS, "");
  const order = locale === "tr" ? TURKISH_ORDER : ENGLISH_ORDER;
  return [...lowered].map((ch) => {
    const rank = order.indexOf(ch);
    // Anything else (punctuation, other scripts) after the alphabet, by code point.
    return rank >= 0 ? rank : order.length + (ch.codePointAt(0) ?? 0);
  });
}

/** Alphabetical by the language's alphabet, ignoring case; ties fall back to the raw text. */
export function compareNames(a: string, b: string, locale: FoodLocale): number {
  const ka = collationKey(a, locale);
  const kb = collationKey(b, locale);
  for (let i = 0; i < Math.min(ka.length, kb.length); i++) {
    const d = (ka[i] ?? 0) - (kb[i] ?? 0);
    if (d !== 0) return d;
  }
  return ka.length - kb.length || (a < b ? -1 : a > b ? 1 : 0);
}

export function sortByName<T extends { readonly name: string }>(foods: readonly T[], locale: FoodLocale): T[] {
  return [...foods].sort((a, b) => compareNames(a.name, b.name, locale));
}

/** The bundled foods of one category, alphabetical in the active language. */
export function foodsInCategory(foods: readonly CatalogFood[], category: FoodCategory, locale: FoodLocale): CatalogFood[] {
  return foods.filter((f) => f.category === category).sort((a, b) => compareNames(a.name[locale], b.name[locale], locale));
}

const QUERY_SEPARATORS = /[^0-9a-z]+/;

/**
 * The user's own foods whose name holds every word of `query` (case and Turkish letters ignored),
 * names that start with the query first, then alphabetical. An empty query finds nothing.
 */
export function searchCustomFoods<T extends { readonly name: string }>(foods: readonly T[], query: string, locale: FoodLocale): T[] {
  const tokens = foldTurkish(query)
    .split(QUERY_SEPARATORS)
    .filter((w) => w.length > 0);
  if (tokens.length === 0) return [];
  const joined = tokens.join(" ");
  const matches = foods
    .map((food) => ({ food, key: foldTurkish(food.name).split(QUERY_SEPARATORS).filter((w) => w.length > 0).join(" ") }))
    .filter(({ key }) => tokens.every((t) => key.includes(t)));
  return matches
    .sort((a, b) => Number(!a.key.startsWith(joined)) - Number(!b.key.startsWith(joined)) || compareNames(a.food.name, b.food.name, locale))
    .map((m) => m.food);
}

/** English plurals of the bundled list's portion labels; Turkish keeps the singular after a number. */
const ENGLISH_PLURALS: Readonly<Record<string, string>> = {
  bar: "bars",
  bottle: "bottles",
  bowl: "bowls",
  bunch: "bunches",
  can: "cans",
  clove: "cloves",
  cob: "cobs",
  cube: "cubes",
  cup: "cups",
  glass: "glasses",
  gram: "grams",
  half: "halves",
  handful: "handfuls",
  ladle: "ladles",
  leaf: "leaves",
  mug: "mugs",
  piece: "pieces",
  "quarter loaf": "quarter loaves",
  scoop: "scoops",
  serving: "servings",
  skewer: "skewers",
  slice: "slices",
  square: "squares",
  tablespoon: "tablespoons",
  "tea glass": "tea glasses",
  teaspoon: "teaspoons",
};

/**
 * "2 adet", "1,5 dilim", "150 grams", "2 × 100 g": an amount and its portion as one phrase. A label
 * that starts with a number takes a times sign, so "2 100 g" never appears.
 */
export function amountPhrase(quantityMilli: number, portionLabel: string, locale: FoodLocale, decimalMark: "." | ","): string {
  const amount = formatQuantity(quantityMilli, decimalMark);
  if (/^\d/.test(portionLabel)) return `${amount} × ${portionLabel}`;
  const label = locale === "en" && quantityMilli !== MILLI ? (ENGLISH_PLURALS[portionLabel] ?? portionLabel) : portionLabel;
  return `${amount} ${label}`;
}

const TENTH_GRAM_MG = 100;
const GRAM_MG = 1000;
const ONE_DECIMAL_BELOW_MG = 10_000;

/** Grams for display from milligrams: "6,3" below 10 g, whole grams from there ("56"). */
export function gramsText(mg: number, decimalMark: "." | ","): string {
  const unit = mg < ONE_DECIMAL_BELOW_MG ? TENTH_GRAM_MG : GRAM_MG;
  return formatQuantity(divideRounded(mg, unit) * unit, decimalMark);
}

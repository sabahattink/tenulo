import { type CatalogFood, FOOD_LOCALES, type FoodLocale } from "./types";

/**
 * Food search for the add-food screen. Pure and synchronous: each food's names are folded once
 * and cached, after which a keystroke over a few hundred foods is a few thousand string
 * comparisons.
 */

const TURKISH_FOLD: Readonly<Record<string, string>> = { ı: "i", ş: "s", ğ: "g", ü: "u", ö: "o", ç: "c" };
// After folding, a word is a run of ASCII letters and digits; anything else separates words.
const WORD_SEPARATORS = /[^0-9a-z]+/;
const COMBINING_MARKS = /[̀-ͯ]/g;

export const DEFAULT_SEARCH_LIMIT = 50;

/**
 * Lowercase with Turkish rules (İ -> i, I -> ı), then fold the Turkish letters to ASCII
 * (ı -> i, ş -> s, ğ -> g, ü -> u, ö -> o, ç -> c) and strip any other diacritic (â -> a).
 * "IZGARA", "ızgara" and "Izgara" all become "izgara"; "Köfte" becomes "kofte".
 */
export function foldTurkish(text: string): string {
  const lowered = text.replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase();
  const folded = lowered.replace(/[ışğüöç]/g, (ch) => TURKISH_FOLD[ch] ?? ch);
  return folded.normalize("NFD").replace(COMBINING_MARKS, "");
}

function words(text: string): string[] {
  return foldTurkish(text)
    .split(WORD_SEPARATORS)
    .filter((w) => w.length > 0);
}

interface IndexedName {
  /** Folded words joined by single spaces. */
  readonly key: string;
  readonly words: readonly string[];
  readonly locale: FoodLocale;
  readonly isAlias: boolean;
}

interface IndexedFood {
  readonly names: readonly IndexedName[];
  readonly nameKey: Readonly<Record<FoodLocale, string>>;
}

const INDEX = new WeakMap<CatalogFood, IndexedFood>();

function indexName(text: string, locale: FoodLocale, isAlias: boolean): IndexedName {
  const w = words(text);
  return { key: w.join(" "), words: w, locale, isAlias };
}

function indexed(food: CatalogFood): IndexedFood {
  const cached = INDEX.get(food);
  if (cached) return cached;
  const names: IndexedName[] = [];
  for (const locale of FOOD_LOCALES) {
    names.push(indexName(food.name[locale], locale, false));
    for (const alias of food.aliases?.[locale] ?? []) names.push(indexName(alias, locale, true));
  }
  const entry: IndexedFood = {
    names,
    nameKey: { tr: names.find((n) => n.locale === "tr")?.key ?? "", en: names.find((n) => n.locale === "en")?.key ?? "" },
  };
  INDEX.set(food, entry);
  return entry;
}

/** How a name matches, best first. */
const EXACT = 0;
const PREFIX = 1;
const WORD_START = 2;
const SUBSTRING = 3;

interface Match {
  /** 0 when every query word is a whole word of the name, 1 when one only starts or is inside one. */
  readonly partial: number;
  readonly tier: number;
  /** 0 for the current locale, 1 for the other one. */
  readonly otherLocale: number;
  readonly alias: number;
}

function matchName(name: IndexedName, query: string, tokens: readonly string[], locale: FoodLocale): Match | undefined {
  let tier: number;
  if (name.key === query) tier = EXACT;
  else if (name.key.startsWith(query)) tier = PREFIX;
  else if (tokens.every((t) => name.words.some((w) => w.startsWith(t)))) tier = WORD_START;
  else if (tokens.every((t) => name.key.includes(t))) tier = SUBSTRING;
  else return undefined;
  const whole = tokens.every((t) => name.words.includes(t));
  return { partial: whole ? 0 : 1, tier, otherLocale: name.locale === locale ? 0 : 1, alias: name.isAlias ? 1 : 0 };
}

function compareMatch(a: Match, b: Match): number {
  return a.partial - b.partial || a.otherLocale - b.otherLocale || a.tier - b.tier || a.alias - b.alias;
}

interface Ranked {
  readonly food: CatalogFood;
  readonly match: Match;
  readonly recent: number;
  readonly nameKey: string;
}

function compareRanked(a: Ranked, b: Ranked): number {
  const m = a.match;
  const n = b.match;
  return (
    m.partial - n.partial ||
    m.otherLocale - n.otherLocale ||
    m.tier - n.tier ||
    a.recent - b.recent ||
    m.alias - n.alias ||
    a.nameKey.length - b.nameKey.length ||
    (a.nameKey < b.nameKey ? -1 : a.nameKey > b.nameKey ? 1 : 0) ||
    (a.food.id < b.food.id ? -1 : a.food.id > b.food.id ? 1 : 0)
  );
}

export interface SearchOptions {
  /** Ids of recently logged foods, most recent first. Unknown ids are ignored. */
  readonly recentIds?: readonly string[];
  /** At most this many results; default `DEFAULT_SEARCH_LIMIT`. */
  readonly limit?: number;
}

function recentFoods(foods: readonly CatalogFood[], recentIds: readonly string[], limit: number): CatalogFood[] {
  const byId = new Map(foods.map((f) => [f.id, f]));
  const out: CatalogFood[] = [];
  const seen = new Set<string>();
  for (const id of recentIds) {
    const food = byId.get(id);
    if (!food || seen.has(id)) continue;
    if (out.length >= limit) break;
    seen.add(id);
    out.push(food);
  }
  return out;
}

/**
 * Foods whose Turkish or English name or alias matches `query`, best first.
 *
 * Case, Turkish letters and punctuation are ignored ("kofte" finds "Köfte"), and the query's
 * words may come in any order. Ranking, each rule breaking the ties of the one before:
 * 1. every query word is a whole word of the name, before names where one is only a word's start
 *    ("egg" finds "Fried egg" before "Eggplant");
 * 2. a name in `locale` before one in the other language;
 * 3. exact name, then name starting with the query, then every query word starting a word of the
 *    name, then every query word somewhere inside the name;
 * 4. recent foods, in `recentIds` order;
 * 5. a name before an alias; a shorter name in `locale`; alphabetical; id.
 *
 * An empty query (nothing but spaces or punctuation) returns the recent foods only: the screen
 * shows them before the user types, and an unfiltered list of hundreds of foods helps nobody.
 */
export function searchFoods(
  foods: readonly CatalogFood[],
  query: string,
  locale: FoodLocale,
  options: SearchOptions = {},
): CatalogFood[] {
  const limit = options.limit ?? DEFAULT_SEARCH_LIMIT;
  if (!Number.isSafeInteger(limit) || limit < 0) throw new RangeError(`limit must be a non-negative integer: ${limit}`);
  const recentIds = options.recentIds ?? [];
  const tokens = words(query);
  if (tokens.length === 0) return recentFoods(foods, recentIds, limit);

  const recentRank = new Map<string, number>();
  recentIds.forEach((id, i) => {
    if (!recentRank.has(id)) recentRank.set(id, i);
  });
  const joined = tokens.join(" ");
  const ranked: Ranked[] = [];
  for (const food of foods) {
    const entry = indexed(food);
    let best: Match | undefined;
    for (const name of entry.names) {
      const match = matchName(name, joined, tokens, locale);
      if (match && (!best || compareMatch(match, best) < 0)) best = match;
    }
    if (!best) continue;
    ranked.push({ food, match: best, recent: recentRank.get(food.id) ?? Infinity, nameKey: entry.nameKey[locale] });
  }
  ranked.sort(compareRanked);
  return ranked.slice(0, limit).map((r) => r.food);
}

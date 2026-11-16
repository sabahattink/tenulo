import { describe, expect, it } from "vitest";
import {
  type CustomFoodValues,
  type FoodChoice,
  QUICK_ADD_PORTION_ID,
  amountAfterPortionChange,
  amountPhrase,
  compareNames,
  editPortions,
  editedEntry,
  foodsInCategory,
  gramsText,
  portionOptions,
  quickAddSnapshot,
  resolveRecents,
  scaleNutrients,
  searchCustomFoods,
  snapshotFor,
  sortByName,
  sourceOfEntry,
  startingPortion,
  withinEntryLimits,
} from "./food-entry";
import type { LoggedFood } from "./food-log";
import { CATALOG_FOODS } from "./foods/catalog";
import type { CatalogFood } from "./foods/types";

const egg: CatalogFood = {
  id: "egg-boiled",
  category: "breakfast",
  name: { tr: "Haşlanmış yumurta", en: "Boiled egg" },
  per100g: { energyKcal: 155, proteinMg: 12_580, carbMg: 1_120, fatMg: 10_610, fiberMg: 0 },
  portions: [
    { id: "piece", label: { tr: "adet", en: "piece" }, grams: 50 },
    { id: "100g", label: { tr: "100 g", en: "100 g" }, grams: 100 },
    { id: "g", label: { tr: "gram", en: "gram" }, grams: 1 },
  ],
};

const soup: CustomFoodValues = {
  id: "01SOUP",
  name: "Annemin çorbası",
  servingLabel: "kase",
  servingGrams: 250,
  energyKcal: 181,
  proteinMg: 7_500,
  carbMg: null,
  fatMg: 5_250,
  fiberMg: null,
};

const catalog = (food: CatalogFood): FoodChoice => ({ kind: "catalog", food });
const custom = (food: CustomFoodValues): FoodChoice => ({ kind: "custom", food });
const find = (id: string) => (id === egg.id ? egg : undefined);

const logged = (over: Partial<LoggedFood>): LoggedFood => ({
  catalogFoodId: "egg-boiled",
  customFoodId: null,
  portionId: "piece",
  quantityMilli: 1000,
  loggedAt: 1,
  meal: "breakfast",
  energyKcal: 78,
  proteinMg: 6_290,
  carbMg: 560,
  fatMg: 5_305,
  fiberMg: 0,
  ...over,
});

describe("portionOptions", () => {
  it("lists a catalog food's portions in the active language, default first", () => {
    expect(portionOptions(catalog(egg), "tr").map((p) => p.label)).toEqual(["adet", "100 g", "gram"]);
    expect(portionOptions(catalog(egg), "en")[0]).toEqual({ id: "piece", label: "piece", grams: 50 });
  });

  it("gives a custom food its one serving", () => {
    expect(portionOptions(custom(soup), "en")).toEqual([{ id: null, label: "kase", grams: 250 }]);
  });
});

describe("startingPortion", () => {
  it("starts on the default portion, one of it", () => {
    expect(startingPortion(catalog(egg))).toEqual({ index: 0, quantityMilli: 1000 });
  });

  it("reopens a recent food with the portion and amount used last time", () => {
    expect(startingPortion(catalog(egg), { portionId: "g", quantityMilli: 120_000 })).toEqual({ index: 2, quantityMilli: 120_000 });
    expect(startingPortion(custom(soup), { portionId: null, quantityMilli: 1500 })).toEqual({ index: 0, quantityMilli: 1500 });
  });

  it("falls back to the default portion when the last one is gone", () => {
    expect(startingPortion(catalog(egg), { portionId: "slice", quantityMilli: 3000 })).toEqual({ index: 0, quantityMilli: 1000 });
  });
});

describe("amountAfterPortionChange", () => {
  const portions = portionOptions(catalog(egg), "en");
  const piece = portions[0]!;
  const hundred = portions[1]!;
  const gram = portions[2]!;
  const slice = { id: "slice", label: "slice", grams: 30 };

  it("carries the weight over into a weight portion", () => {
    expect(amountAfterPortionChange(piece, gram, 2000)).toBe(100_000);
    expect(amountAfterPortionChange(piece, hundred, 1000)).toBe(500);
    expect(amountAfterPortionChange(hundred, gram, 1500)).toBe(150_000);
  });

  it("starts again at one portion when leaving a weight portion", () => {
    expect(amountAfterPortionChange(gram, piece, 250_000)).toBe(1000);
  });

  it("keeps the count between household portions", () => {
    expect(amountAfterPortionChange(piece, slice, 2500)).toBe(2500);
  });

  it("never goes below the smallest amount", () => {
    expect(amountAfterPortionChange(gram, hundred, 0)).toBe(1);
  });
});

describe("resolveRecents", () => {
  it("turns recent entries into foods, newest first, with their last portion and amount", () => {
    const recents = resolveRecents(
      [
        logged({ loggedAt: 1 }),
        logged({ catalogFoodId: null, customFoodId: soup.id, portionId: null, quantityMilli: 2000, loggedAt: 2 }),
        logged({ loggedAt: 3, portionId: "g", quantityMilli: 80_000 }),
      ],
      [soup],
      find,
      10,
    );
    expect(recents).toEqual([
      { choice: catalog(egg), portionId: "g", quantityMilli: 80_000 },
      { choice: custom(soup), portionId: null, quantityMilli: 2000 },
    ]);
  });

  it("skips foods that are no longer in either list, then applies the limit", () => {
    const recents = resolveRecents(
      [
        logged({ catalogFoodId: "dropped-food", loggedAt: 9 }),
        logged({ catalogFoodId: null, customFoodId: "01GONE", portionId: null, loggedAt: 8 }),
        logged({ catalogFoodId: null, customFoodId: null, portionId: QUICK_ADD_PORTION_ID, loggedAt: 7 }),
        logged({ loggedAt: 2 }),
        logged({ catalogFoodId: null, customFoodId: soup.id, portionId: null, loggedAt: 1 }),
      ],
      [soup],
      find,
      1,
    );
    expect(recents.map((r) => r.choice.food.id)).toEqual(["egg-boiled"]);
  });
});

describe("snapshotFor", () => {
  it("logs a catalog food with its name and portion in the active language and whole grams", () => {
    expect(snapshotFor(catalog(egg), portionOptions(catalog(egg), "tr")[0]!, 2000, "tr")).toEqual({
      catalogFoodId: "egg-boiled",
      customFoodId: null,
      name: "Haşlanmış yumurta",
      portionId: "piece",
      portionLabel: "adet",
      quantityMilli: 2000,
      grams: 100,
      energyKcal: 155,
      proteinMg: 12_580,
      carbMg: 1_120,
      fatMg: 10_610,
      fiberMg: 0,
    });
  });

  it("computes from the rounded grams, as the stored entry can be recomputed", () => {
    // 1.5 x 33 g = 49.5 g -> 50 g; 155 kcal per 100 g -> 77.5 -> 78
    const odd: CatalogFood = { ...egg, portions: [{ id: "piece", label: { tr: "adet", en: "piece" }, grams: 33 }] };
    const s = snapshotFor(catalog(odd), portionOptions(catalog(odd), "en")[0]!, 1500, "en");
    expect(s.grams).toBe(50);
    expect(s.energyKcal).toBe(78);
  });

  it("scales a custom food's serving by the amount, keeping unknown values unknown", () => {
    expect(snapshotFor(custom(soup), portionOptions(custom(soup), "en")[0]!, 1500, "en")).toEqual({
      catalogFoodId: null,
      customFoodId: "01SOUP",
      name: "Annemin çorbası",
      portionId: null,
      portionLabel: "kase",
      quantityMilli: 1500,
      grams: 375,
      energyKcal: 272, // 271.5
      proteinMg: 11_250,
      carbMg: null,
      fatMg: 7_875,
      fiberMg: null,
    });
  });

  it("leaves grams unknown for a custom food without serving grams", () => {
    const noGrams = { ...soup, servingGrams: null };
    expect(snapshotFor(custom(noGrams), portionOptions(custom(noGrams), "en")[0]!, 2000, "en").grams).toBeNull();
  });
});

describe("scaleNutrients", () => {
  it("scales every known value and rounds half away from zero", () => {
    expect(
      scaleNutrients({ energyKcal: 181, proteinMg: 7_501, carbMg: null, fatMg: 0, fiberMg: 3 }, 1000, 500),
    ).toEqual({ energyKcal: 91, proteinMg: 3_751, carbMg: null, fatMg: 0, fiberMg: 2 });
  });

  it("returns the values unchanged for the same amount", () => {
    const n = { energyKcal: 77, proteinMg: 1, carbMg: 2, fatMg: 3, fiberMg: null };
    expect(scaleNutrients(n, 1500, 1500)).toEqual(n);
  });

  it("refuses a zero starting amount", () => {
    expect(() => scaleNutrients({ energyKcal: 1, proteinMg: null, carbMg: null, fatMg: null, fiberMg: null }, 0, 10)).toThrow(RangeError);
  });
});

describe("withinEntryLimits", () => {
  it("accepts an ordinary entry and refuses one beyond what an entry can hold", () => {
    const base = { energyKcal: 500, proteinMg: 20_000, carbMg: null, fatMg: null, fiberMg: null, grams: 300 };
    expect(withinEntryLimits(base)).toBe(true);
    expect(withinEntryLimits({ ...base, energyKcal: 10_001 })).toBe(false);
    expect(withinEntryLimits({ ...base, proteinMg: 2_000_001 })).toBe(false);
    expect(withinEntryLimits({ ...base, grams: 100_001 })).toBe(false);
  });
});

describe("quickAddSnapshot", () => {
  it("stores a name and energy with no food behind it", () => {
    expect(quickAddSnapshot("  Restoran  ", 850, 30_000, "Hızlı ekleme", "porsiyon")).toEqual({
      catalogFoodId: null,
      customFoodId: null,
      name: "Restoran",
      portionId: QUICK_ADD_PORTION_ID,
      portionLabel: "porsiyon",
      quantityMilli: 1000,
      grams: null,
      energyKcal: 850,
      proteinMg: 30_000,
      carbMg: null,
      fatMg: null,
      fiberMg: null,
    });
  });

  it("uses the fallback name when none is given", () => {
    expect(quickAddSnapshot("   ", 300, null, "Quick add", "serving").name).toBe("Quick add");
  });
});

describe("editing a logged entry", () => {
  const stored = {
    catalogFoodId: "egg-boiled",
    customFoodId: null,
    portionId: "piece",
    portionLabel: "adet",
    quantityMilli: 2000,
    grams: 100,
    energyKcal: 155,
    proteinMg: 12_580,
    carbMg: 1_120,
    fatMg: 10_610,
    fiberMg: 0,
  };

  it("finds what the entry came from", () => {
    expect(sourceOfEntry(stored, find, [])).toEqual({ kind: "catalog", food: egg });
    expect(sourceOfEntry({ ...stored, catalogFoodId: null, customFoodId: soup.id, portionId: null }, find, [soup])).toEqual({
      kind: "custom",
      food: soup,
    });
    expect(sourceOfEntry({ ...stored, catalogFoodId: null, customFoodId: null, portionId: QUICK_ADD_PORTION_ID }, find, [])).toEqual({
      kind: "quick",
    });
  });

  it("falls back to the logged values when the food or its portion is gone", () => {
    expect(sourceOfEntry({ ...stored, catalogFoodId: "dropped-food" }, find, [])).toEqual({ kind: "snapshot" });
    expect(sourceOfEntry({ ...stored, portionId: "slice" }, find, [])).toEqual({ kind: "snapshot" });
    // A deleted custom food leaves both ids empty.
    expect(sourceOfEntry({ ...stored, catalogFoodId: null, customFoodId: null, portionId: null }, find, [])).toEqual({ kind: "snapshot" });
  });

  it("recomputes a catalog entry from the list, keeping the logged label for the same portion", () => {
    const source = sourceOfEntry(stored, find, []);
    const portions = editPortions(stored, source, "en");
    expect(editedEntry(stored, source, portions[0]!, 3000, "en")).toEqual({
      portionId: "piece",
      portionLabel: "adet",
      quantityMilli: 3000,
      grams: 150,
      energyKcal: 233, // 232.5
      proteinMg: 18_870,
      carbMg: 1_680,
      fatMg: 15_915,
      fiberMg: 0,
    });
    expect(editedEntry(stored, source, portions[2]!, 80_000, "en")).toMatchObject({ portionId: "g", portionLabel: "gram", grams: 80, energyKcal: 124 });
  });

  it("keeps the logged values when portion and amount stay, even if the food changed since", () => {
    const entry = { ...stored, catalogFoodId: null, customFoodId: soup.id, portionId: null, portionLabel: "kase", energyKcal: 999 };
    const source = sourceOfEntry(entry, find, [soup]);
    const [serving] = editPortions(entry, source, "tr");
    expect(editedEntry(entry, source, serving!, entry.quantityMilli, "tr")).toEqual({
      portionId: null,
      portionLabel: "kase",
      quantityMilli: 2000,
      grams: 100,
      energyKcal: 999,
      proteinMg: 12_580,
      carbMg: 1_120,
      fatMg: 10_610,
      fiberMg: 0,
    });
  });

  it("recomputes a custom-food entry from the food as it is now", () => {
    const entry = { ...stored, catalogFoodId: null, customFoodId: soup.id, portionId: null, portionLabel: "kase" };
    const source = sourceOfEntry(entry, find, [soup]);
    const [serving] = editPortions(entry, source, "tr");
    expect(editedEntry(entry, source, serving!, 3000, "tr")).toMatchObject({ portionId: null, portionLabel: "kase", grams: 750, energyKcal: 543, carbMg: null });
  });

  it("scales the logged values when the food is gone", () => {
    const entry = { ...stored, catalogFoodId: null, customFoodId: null, portionId: null, portionLabel: "tabak", grams: 401 };
    const source = sourceOfEntry(entry, find, []);
    const portions = editPortions(entry, source, "tr");
    expect(portions).toEqual([{ id: null, label: "tabak", grams: null }]);
    expect(editedEntry(entry, source, portions[0]!, 1000, "tr")).toEqual({
      portionId: null,
      portionLabel: "tabak",
      quantityMilli: 1000,
      grams: 201, // 200.5
      energyKcal: 78, // 77.5
      proteinMg: 6_290,
      carbMg: 560,
      fatMg: 5_305,
      fiberMg: 0,
    });
  });
});

describe("compareNames and foodsInCategory", () => {
  it("orders Turkish names by the Turkish alphabet", () => {
    const names = ["Zeytin", "Çay", "Ispanak", "İrmik", "Cacık", "Şalgam", "Sucuk", "Ömlet", "Otlu peynir", "Üzüm", "Un", "ğ"];
    expect([...names].sort((a, b) => compareNames(a, b, "tr"))).toEqual([
      "Cacık",
      "Çay",
      "ğ",
      "Ispanak",
      "İrmik",
      "Otlu peynir",
      "Ömlet",
      "Sucuk",
      "Şalgam",
      "Un",
      "Üzüm",
      "Zeytin",
    ]);
  });

  it("orders English names ignoring case and accents", () => {
    expect(["banana", "Apple", "Çay (tea)", "apricot"].sort((a, b) => compareNames(a, b, "en"))).toEqual([
      "Apple",
      "apricot",
      "banana",
      "Çay (tea)",
    ]);
  });

  it("puts a shorter name before a longer one that starts with it", () => {
    expect(compareNames("Ekmek", "Ekmek kadayıfı", "tr")).toBeLessThan(0);
    expect(compareNames("Ekmek", "Ekmek", "tr")).toBe(0);
  });

  it("lists every food of a category in name order", () => {
    const fruit = foodsInCategory(CATALOG_FOODS, "fruit", "tr");
    expect(fruit.length).toBe(CATALOG_FOODS.filter((f) => f.category === "fruit").length);
    expect(fruit.every((f) => f.category === "fruit")).toBe(true);
    const names = fruit.map((f) => f.name.tr);
    expect(names).toEqual([...names].sort((a, b) => compareNames(a, b, "tr")));
  });

  it("sorts custom foods by name", () => {
    expect(sortByName([{ name: "Su böreği" }, { name: "Çorba" }, { name: "Ayran" }], "tr").map((f) => f.name)).toEqual([
      "Ayran",
      "Çorba",
      "Su böreği",
    ]);
  });
});

describe("searchCustomFoods", () => {
  const foods = [{ name: "Annemin çorbası" }, { name: "Ofis salatası" }, { name: "Çiğ köfte dürüm" }];

  it("matches every word of the query, ignoring case and Turkish letters", () => {
    expect(searchCustomFoods(foods, "corba", "tr").map((f) => f.name)).toEqual(["Annemin çorbası"]);
    expect(searchCustomFoods(foods, "KÖFTE cig", "tr").map((f) => f.name)).toEqual(["Çiğ köfte dürüm"]);
    expect(searchCustomFoods(foods, "pizza", "tr")).toEqual([]);
  });

  it("puts names starting with the query first", () => {
    const both = [{ name: "Tavuk salata" }, { name: "Salata" }];
    expect(searchCustomFoods(both, "sal", "tr").map((f) => f.name)).toEqual(["Salata", "Tavuk salata"]);
  });

  it("returns nothing for an empty query", () => {
    expect(searchCustomFoods(foods, "  ", "tr")).toEqual([]);
  });
});

describe("amountPhrase", () => {
  it("joins the amount and the portion with the language's decimal mark", () => {
    expect(amountPhrase(2000, "adet", "tr", ",")).toBe("2 adet");
    expect(amountPhrase(1500, "dilim", "tr", ",")).toBe("1,5 dilim");
    expect(amountPhrase(250_000, "gram", "tr", ",")).toBe("250 gram");
  });

  it("uses a times sign when the portion starts with a number", () => {
    expect(amountPhrase(2000, "100 g", "tr", ",")).toBe("2 × 100 g");
    expect(amountPhrase(1000, "10 pieces", "en", ".")).toBe("1 × 10 pieces");
  });

  it("writes English portions in the plural except for exactly one", () => {
    expect(amountPhrase(1000, "piece", "en", ".")).toBe("1 piece");
    expect(amountPhrase(2000, "piece", "en", ".")).toBe("2 pieces");
    expect(amountPhrase(500, "glass", "en", ".")).toBe("0.5 glasses");
    expect(amountPhrase(3000, "quarter loaf", "en", ".")).toBe("3 quarter loaves");
    expect(amountPhrase(150_000, "gram", "en", ".")).toBe("150 grams");
  });

  it("leaves labels it does not know as they are", () => {
    expect(amountPhrase(2000, "my big bowl", "en", ".")).toBe("2 my big bowl");
    expect(amountPhrase(2000, "adet", "en", ".")).toBe("2 adet");
  });
});

describe("gramsText", () => {
  it("shows one decimal below 10 g and whole grams above", () => {
    expect(gramsText(6_290, ",")).toBe("6,3");
    expect(gramsText(400, ".")).toBe("0.4");
    expect(gramsText(5_000, ",")).toBe("5");
    expect(gramsText(9_960, ",")).toBe("10");
    expect(gramsText(56_499, ",")).toBe("56");
    expect(gramsText(56_500, ",")).toBe("57");
    expect(gramsText(0, ",")).toBe("0");
  });
});

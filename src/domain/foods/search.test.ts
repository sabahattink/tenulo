import { describe, expect, it } from "vitest";
import { CATALOG_FOODS } from "./catalog";
import { foldTurkish, searchFoods } from "./search";
import type { CatalogFood, FoodCategory } from "./types";

const ids = (foods: readonly CatalogFood[]): string[] => foods.map((f) => f.id);

function food(id: string, tr: string, en: string, aliases?: CatalogFood["aliases"]): CatalogFood {
  const category: FoodCategory = "main";
  return {
    id,
    category,
    name: { tr, en },
    ...(aliases ? { aliases } : {}),
    per100g: { energyKcal: 100, proteinMg: 0, carbMg: 0, fatMg: 0, fiberMg: 0 },
    portions: [{ id: "100g", label: { tr: "100 g", en: "100 g" }, grams: 100 }],
  };
}

describe("foldTurkish", () => {
  it("lowercases with Turkish dotted and dotless i, then folds them together", () => {
    expect(foldTurkish("İSTANBUL")).toBe("istanbul");
    expect(foldTurkish("IZGARA")).toBe("izgara");
    expect(foldTurkish("ızgara")).toBe("izgara");
    expect(foldTurkish("Iğdır")).toBe("igdir");
  });

  it("folds the other Turkish letters in both cases", () => {
    expect(foldTurkish("Köfte")).toBe("kofte");
    expect(foldTurkish("ŞEKER ÇAY ĞÜÖ")).toBe("seker cay guo");
    expect(foldTurkish("çılbır")).toBe("cilbir");
  });

  it("strips other diacritics, including a stray combining dot", () => {
    expect(foldTurkish("kâse")).toBe("kase");
    expect(foldTurkish("Café crème")).toBe("cafe creme");
    expect(foldTurkish("i̇")).toBe("i");
  });

  it("leaves digits and punctuation alone", () => {
    expect(foldTurkish("3'Ü 1 ARADA")).toBe("3'u 1 arada");
  });
});

describe("searchFoods on the bundled list", () => {
  it("finds every egg dish for 'yumurta', plain boiled egg first", () => {
    const found = ids(searchFoods(CATALOG_FOODS, "yumurta", "tr"));
    expect(found[0]).toBe("egg-boiled");
    expect(found).toEqual(
      expect.arrayContaining(["egg-fried", "egg-scrambled", "eggs-with-sucuk", "egg-white", "menemen", "omelette"]),
    );
  });

  it("finds köfte without Turkish letters", () => {
    const found = ids(searchFoods(CATALOG_FOODS, "kofte", "tr"));
    expect(found[0]).toBe("kofte");
    expect(found).toContain("cig-kofte");
  });

  it("treats IZGARA, ızgara and Izgara alike", () => {
    const lower = ids(searchFoods(CATALOG_FOODS, "ızgara", "tr"));
    expect(lower.length).toBeGreaterThan(3);
    expect(ids(searchFoods(CATALOG_FOODS, "IZGARA", "tr"))).toEqual(lower);
    expect(ids(searchFoods(CATALOG_FOODS, "Izgara", "tr"))).toEqual(lower);
    expect(lower).toContain("chicken-breast-grilled");
  });

  it("searches English names from the Turkish locale too", () => {
    const found = ids(searchFoods(CATALOG_FOODS, "egg", "tr"));
    expect(found[0]).toBe("egg-boiled");
    expect(found).toEqual(expect.arrayContaining(["egg-fried", "egg-white", "eggplant"]));
  });

  it("ranks foods that contain the whole word above longer words that only start with it", () => {
    const found = ids(searchFoods(CATALOG_FOODS, "egg", "en"));
    expect(found.indexOf("egg-fried")).toBeLessThan(found.indexOf("eggplant"));
  });

  it("matches the words of a query in any order", () => {
    expect(ids(searchFoods(CATALOG_FOODS, "göğsü tavuk", "tr"))).toContain("chicken-breast-grilled");
    expect(ids(searchFoods(CATALOG_FOODS, "tavuk gogsu", "tr"))).toContain("chicken-breast-poached");
  });

  it("puts recent foods first among equally good matches", () => {
    // Every soup has the alias "çorba", so they all match equally well.
    const plain = ids(searchFoods(CATALOG_FOODS, "çorba", "tr"));
    expect(plain.slice(0, 2)).not.toEqual(["soup-tripe", "soup-lentil"]);
    const withRecents = ids(searchFoods(CATALOG_FOODS, "çorba", "tr", { recentIds: ["soup-tripe", "soup-lentil"] }));
    expect(withRecents.slice(0, 2)).toEqual(["soup-tripe", "soup-lentil"]);
    expect([...withRecents].sort()).toEqual([...plain].sort());
  });

  it("does not lift a recent food above a better match", () => {
    // Sütlaç only starts with "süt"; milk is named "süt". Recency does not change that.
    const found = ids(searchFoods(CATALOG_FOODS, "süt", "tr", { recentIds: ["rice-pudding"] }));
    expect(found[0]).toBe("milk-whole");
    expect(found.indexOf("rice-pudding")).toBeGreaterThan(found.indexOf("milk-semi"));
  });

  it("returns the recent foods, in order, for an empty query", () => {
    const recents = ["tea", "simit", "no-such-food", "tea", "cheese-white"];
    expect(ids(searchFoods(CATALOG_FOODS, "", "tr", { recentIds: recents }))).toEqual(["tea", "simit", "cheese-white"]);
    expect(ids(searchFoods(CATALOG_FOODS, "  ()  ", "en", { recentIds: recents }))).toEqual([
      "tea",
      "simit",
      "cheese-white",
    ]);
    expect(searchFoods(CATALOG_FOODS, "", "tr")).toEqual([]);
  });

  it("respects the limit", () => {
    expect(searchFoods(CATALOG_FOODS, "a", "tr", { limit: 5 })).toHaveLength(5);
    expect(searchFoods(CATALOG_FOODS, "", "tr", { recentIds: ["tea", "simit"], limit: 1 })).toHaveLength(1);
    expect(searchFoods(CATALOG_FOODS, "a", "tr", { limit: 0 })).toEqual([]);
    expect(() => searchFoods(CATALOG_FOODS, "a", "tr", { limit: -1 })).toThrow(RangeError);
    expect(() => searchFoods(CATALOG_FOODS, "a", "tr", { limit: 2.5 })).toThrow(RangeError);
  });

  it("finds nothing for nonsense", () => {
    expect(searchFoods(CATALOG_FOODS, "xyzzy", "tr")).toEqual([]);
  });
});

describe("searchFoods ranking rules", () => {
  it("ranks an exact name above a name that starts with the query", () => {
    const foods = [food("tea-sugar", "Çay (şekerli)", "Sweet tea"), food("tea", "Çay", "Tea")];
    expect(ids(searchFoods(foods, "cay", "tr"))).toEqual(["tea", "tea-sugar"]);
  });

  it("ranks prefix above word start above substring", () => {
    const foods = [
      food("substring", "Karton", "Cardboard"),
      food("word-start", "Pilav ton", "Rice"),
      food("prefix", "Ton balığı", "Tuna"),
    ];
    expect(ids(searchFoods(foods, "ton", "tr"))).toEqual(["prefix", "word-start", "substring"]);
  });

  it("ranks names in the current locale above the other language", () => {
    const foods = [food("noodles", "Makarna", "Pasta"), food("cake", "Pasta", "Cake")];
    expect(ids(searchFoods(foods, "pasta", "tr"))).toEqual(["cake", "noodles"]);
    expect(ids(searchFoods(foods, "pasta", "en"))).toEqual(["noodles", "cake"]);
  });

  it("ranks a weaker match in the current locale above a stronger one in the other language", () => {
    const foods = [food("ayran", "Ayran", "Yogurt drink"), food("strained", "Süzme yoğurt", "Strained yogurt")];
    expect(ids(searchFoods(foods, "yoğurt", "tr"))).toEqual(["strained", "ayran"]);
    expect(ids(searchFoods(foods, "yogurt", "en"))).toEqual(["ayran", "strained"]);
  });

  it("matches aliases, below an equally good name", () => {
    const foods = [food("by-alias", "Sosis", "Frankfurter", { tr: ["sucuk"] }), food("by-name", "Sucuk", "Sujuk")];
    expect(ids(searchFoods(foods, "sucuk", "tr"))).toEqual(["by-name", "by-alias"]);
  });

  it("breaks remaining ties by shorter name, then alphabetically, so results are stable", () => {
    const foods = [
      food("d", "Elma sirkesi", "D"),
      food("b", "Elma suyu", "B"),
      food("c", "Elma", "C"),
      food("a", "Elma çayı", "A"),
    ];
    // "Elma" is exact; "elma cayi" and "elma suyu" tie on length and sort alphabetically.
    expect(ids(searchFoods(foods, "elma", "tr"))).toEqual(["c", "a", "b", "d"]);
    expect(ids(searchFoods([...foods].reverse(), "elma", "tr"))).toEqual(["c", "a", "b", "d"]);
  });
});

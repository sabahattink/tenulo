"""
Builds Tenulo's bundled food list: src/domain/foods/catalog.generated.ts.

Inputs (both in this directory, both committed):
  foods.json            the curated list: names, aliases, categories, portions, and for every food
                        either one USDA SR Legacy food (`usda`) or a recipe over SR foods
  usda-sr-extract.csv   the SR Legacy rows the list uses: fdc_id, description and the five
                        nutrients per 100 g, copied verbatim from the USDA CSV files

Every number in the output is an SR Legacy value or computed from SR Legacy values. Nothing is
typed in by hand except recipe amounts, cooked yields and portion weights.

Run from the repo root (standard library only, Python 3.10+):
    python scripts/foods/build_foods.py                  write the TypeScript module
    python scripts/foods/build_foods.py --check          exit 1 if the module is out of date
    python scripts/foods/build_foods.py --sr-dir DIR     first rebuild the extract from the full
                                                         SR Legacy CSV download (DIR holds food.csv,
                                                         food_nutrient.csv and nutrient.csv)

Rounding: energy to whole kcal, nutrients to whole milligrams, half away from zero (0.5 -> 1),
done once at the end with exact decimal arithmetic. Output order is by food id, so the same
inputs always give a byte-identical file.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from typing import NoReturn

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SPEC = HERE / "foods.json"
EXTRACT = HERE / "usda-sr-extract.csv"
OUTPUT = ROOT / "src" / "domain" / "foods" / "catalog.generated.ts"

# SR Legacy nutrient ids (nutrient.csv). Checked against the download when --sr-dir is given.
NUTRIENTS = (
    ("energy_kcal", "1008", "Energy", "KCAL"),
    ("protein_g", "1003", "Protein", "G"),
    ("carbohydrate_g", "1005", "Carbohydrate, by difference", "G"),
    ("fat_g", "1004", "Total lipid (fat)", "G"),
    ("fiber_g", "1079", "Fiber, total dietary", "G"),
)
EXTRACT_COLUMNS = ("fdc_id", "description") + tuple(n[0] for n in NUTRIENTS)

# Portions every food gets, after its own: 100 g, and 1 g so any amount can be entered.
AUTO_PORTIONS = (("100g", 100), ("g", 1))
ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
FOOD_KEYS = {"id", "category", "name", "aliases", "usda", "recipe", "yield", "note", "portions"}
LOCALES = ("tr", "en")
# A recipe's cooked yield must be between these fractions of its raw weight (water included).
MIN_YIELD_RATIO = Decimal("0.3")
# SR writes most brand names in capitals ("CHOBANI"). A heuristic guard on top of reviewing the
# extract: no capitalised word other than these may appear in a description the list uses.
BRAND_LIKE = re.compile(r"\b[A-Z]{3,}\b")
BRAND_ALLOWED = {"USDA", "NFS"}
HUNDRED = Decimal(100)
THOUSAND = Decimal(1000)


class SpecError(Exception):
    pass


@dataclass(frozen=True)
class SrFood:
    fdc_id: int
    description: str
    values: tuple[Decimal | None, ...]  # in NUTRIENTS order; None = not in SR


def fail(message: str) -> NoReturn:
    raise SpecError(message)


# --- extract ---------------------------------------------------------------------------------


def referenced_fdc_ids(spec: dict) -> set[int]:
    ingredients = spec["ingredients"]
    ids: set[int] = set(ingredients.values())
    for food in spec["foods"]:
        ref = food.get("usda")
        if isinstance(ref, int):
            ids.add(ref)
        for item in food.get("recipe", []):
            if isinstance(item[0], int):
                ids.add(item[0])
    return ids


def rebuild_extract(spec: dict, sr_dir: Path) -> None:
    with (sr_dir / "nutrient.csv").open(encoding="utf-8", newline="") as f:
        rows = {row["id"]: row for row in csv.DictReader(f)}
    for _, nid, name, unit in NUTRIENTS:
        row = rows.get(nid)
        if row is None or row["name"] != name or row["unit_name"] != unit:
            fail(f"nutrient.csv: id {nid} is not {name!r} in {unit}")

    wanted = referenced_fdc_ids(spec)
    descriptions: dict[int, str] = {}
    with (sr_dir / "food.csv").open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            fdc = int(row["fdc_id"])
            if fdc in wanted:
                if row["data_type"] != "sr_legacy_food":
                    fail(f"fdc_id {fdc} is not an SR Legacy food")
                descriptions[fdc] = row["description"]
    missing = sorted(wanted - descriptions.keys())
    if missing:
        fail(f"fdc_ids not in food.csv: {missing}")

    column = {nid: i for i, (_, nid, _, _) in enumerate(NUTRIENTS)}
    amounts: dict[int, list[str]] = {fdc: [""] * len(NUTRIENTS) for fdc in wanted}
    with (sr_dir / "food_nutrient.csv").open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            i = column.get(row["nutrient_id"])
            if i is None:
                continue
            fdc = int(row["fdc_id"])
            if fdc in amounts:
                amounts[fdc][i] = row["amount"]

    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(EXTRACT_COLUMNS)
    for fdc in sorted(wanted):
        writer.writerow([fdc, descriptions[fdc], *amounts[fdc]])
    EXTRACT.write_text(buffer.getvalue(), encoding="utf-8", newline="\n")
    print(f"wrote {EXTRACT.relative_to(ROOT)}: {len(wanted)} SR foods")


def load_extract() -> dict[int, SrFood]:
    foods: dict[int, SrFood] = {}
    with EXTRACT.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        if tuple(reader.fieldnames or ()) != EXTRACT_COLUMNS:
            fail(f"{EXTRACT.name}: unexpected columns {reader.fieldnames}")
        for row in reader:
            fdc = int(row["fdc_id"])
            values = tuple(Decimal(row[c]) if row[c] != "" else None for c in EXTRACT_COLUMNS[2:])
            for v in values:
                if v is not None and v < 0:
                    fail(f"fdc_id {fdc}: negative nutrient value")
            brand = [w for w in BRAND_LIKE.findall(row["description"]) if w not in BRAND_ALLOWED]
            if brand:
                fail(f"fdc_id {fdc}: description looks branded ({brand}): {row['description']}")
            foods[fdc] = SrFood(fdc, row["description"], values)
    return foods


# --- validation --------------------------------------------------------------------------------


def check_text(value: object, where: str) -> str:
    if not isinstance(value, str) or value.strip() == "" or value != value.strip():
        fail(f"{where}: expected a non-empty trimmed string, got {value!r}")
    return value


def check_localized(value: object, where: str) -> dict[str, str]:
    if not isinstance(value, dict) or set(value) != set(LOCALES):
        fail(f"{where}: expected exactly {LOCALES}")
    return {loc: check_text(value[loc], f"{where}.{loc}") for loc in LOCALES}


def check_grams(value: object, where: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
        fail(f"{where}: grams must be a positive integer, got {value!r}")
    return value


def validate_vocabulary(spec: dict, sr: dict[int, SrFood]) -> None:
    units = spec["units"]
    for unit_id, label in units.items():
        if not ID_PATTERN.match(unit_id) and unit_id != "100g":
            fail(f"unit id {unit_id!r} is not kebab-case")
        check_localized(label, f"units.{unit_id}")
    for unit_id, _ in AUTO_PORTIONS:
        if unit_id not in units:
            fail(f"units must define the automatic portion {unit_id!r}")
    for key, fdc in spec["ingredients"].items():
        if fdc not in sr:
            fail(f"ingredient {key!r}: fdc_id {fdc} is not in {EXTRACT.name}")
    for fdc in sorted(set(spec["fiberAssumedZero"]["fdcIds"])):
        if fdc not in sr or sr[fdc].values[4] is not None:
            fail(f"fiberAssumedZero: {fdc} is not an SR food without a fibre value")


def validate_names(food: dict, categories: list[str], where: str) -> None:
    extra = set(food) - FOOD_KEYS
    if extra:
        fail(f"{where}: unknown keys {sorted(extra)}")
    if food.get("category") not in categories:
        fail(f"{where}: unknown category {food.get('category')!r}")
    check_localized(food.get("name"), f"{where}.name")
    aliases = food.get("aliases", {})
    if not isinstance(aliases, dict) or not set(aliases) <= set(LOCALES):
        fail(f"{where}.aliases: expected keys from {LOCALES}")
    for loc, words in aliases.items():
        if not isinstance(words, list) or not words:
            fail(f"{where}.aliases.{loc}: expected a non-empty list")
        for w in words:
            check_text(w, f"{where}.aliases.{loc}")
        if len(set(words)) != len(words):
            fail(f"{where}.aliases.{loc}: duplicates")


def validate_source(food: dict, spec: dict, sr: dict[int, SrFood], ids: set[str], where: str) -> None:
    has_usda, has_recipe = "usda" in food, "recipe" in food
    if has_usda == has_recipe:
        fail(f"{where}: needs exactly one of 'usda' and 'recipe'")
    if has_usda:
        resolve_ref(food["usda"], spec, sr, ids, f"{where}.usda", allow_food=False)
        if "yield" in food:
            fail(f"{where}: 'yield' belongs to recipes")
        return
    items = food["recipe"]
    if not isinstance(items, list) or not items:
        fail(f"{where}.recipe: expected a non-empty list")
    raw = 0
    for i, item in enumerate(items):
        if not isinstance(item, list) or len(item) != 2:
            fail(f"{where}.recipe[{i}]: expected [ingredient, grams]")
        resolve_ref(item[0], spec, sr, ids, f"{where}.recipe[{i}]", allow_food=True)
        raw += check_grams(item[1], f"{where}.recipe[{i}]")
    cooked = check_grams(food.get("yield"), f"{where}.yield")
    if cooked > raw or Decimal(cooked) < MIN_YIELD_RATIO * raw:
        fail(f"{where}: yield {cooked} g is implausible for {raw} g of ingredients")
    check_text(food.get("note"), f"{where}.note")


def validate_portions(food: dict, units: dict, where: str) -> None:
    portions = food.get("portions")
    if not isinstance(portions, list) or not portions:
        fail(f"{where}.portions: expected at least one portion")
    for i, portion in enumerate(portions):
        if not isinstance(portion, list) or len(portion) != 2 or portion[0] not in units:
            fail(f"{where}.portions[{i}]: expected [known unit id, grams]")
        check_grams(portion[1], f"{where}.portions[{i}]")
    portion_ids = [p[0] for p in portions] + [u for u, _ in AUTO_PORTIONS]
    if len(set(portion_ids)) != len(portion_ids):
        fail(f"{where}.portions: duplicate portion ids {portion_ids}")


def validate(spec: dict, sr: dict[int, SrFood]) -> None:
    validate_vocabulary(spec, sr)
    ids: set[str] = set()
    for food in spec["foods"]:
        fid = food.get("id")
        if not isinstance(fid, str) or not ID_PATTERN.match(fid):
            fail(f"food id {fid!r} is not kebab-case")
        if fid in ids:
            fail(f"duplicate food id {fid!r}")
        ids.add(fid)
    for food in spec["foods"]:
        where = f"food {food['id']}"
        validate_names(food, spec["categories"], where)
        validate_source(food, spec, sr, ids, where)
        validate_portions(food, spec["units"], where)


def resolve_ref(ref: object, spec: dict, sr: dict[int, SrFood], ids: set[str], where: str, allow_food: bool) -> None:
    if isinstance(ref, int) and not isinstance(ref, bool):
        if ref not in sr:
            fail(f"{where}: fdc_id {ref} is not in {EXTRACT.name}")
        return
    if isinstance(ref, str) and ref.startswith("@"):
        if not allow_food or ref[1:] not in ids:
            fail(f"{where}: unknown food reference {ref!r}")
        return
    if isinstance(ref, str) and ref in spec["ingredients"]:
        return
    fail(f"{where}: unknown ingredient {ref!r}")


# --- computation -------------------------------------------------------------------------------


class Calculator:
    def __init__(self, spec: dict, sr: dict[int, SrFood]):
        self.spec = spec
        self.sr = sr
        self.by_id = {f["id"]: f for f in spec["foods"]}
        self.fiber_zero = set(spec["fiberAssumedZero"]["fdcIds"])
        self.memo: dict[str, tuple[Decimal, ...]] = {}
        self.active: set[str] = set()

    def sr_values(self, fdc: int, where: str) -> tuple[Decimal, ...]:
        food = self.sr[fdc]
        out = []
        for (name, *_), value in zip(NUTRIENTS, food.values):
            if value is None:
                if name == "fiber_g" and fdc in self.fiber_zero:
                    value = Decimal(0)
                else:
                    fail(f"{where}: fdc_id {fdc} has no {name} value ({food.description})")
            out.append(value)
        return tuple(out)

    def ref_values(self, ref: object, where: str) -> tuple[Decimal, ...]:
        if isinstance(ref, int):
            return self.sr_values(ref, where)
        assert isinstance(ref, str)
        if ref.startswith("@"):
            return self.food_values(ref[1:])
        return self.sr_values(self.spec["ingredients"][ref], where)

    def food_values(self, fid: str) -> tuple[Decimal, ...]:
        """Exact (unrounded) values per 100 g, in NUTRIENTS order."""
        if fid in self.memo:
            return self.memo[fid]
        if fid in self.active:
            fail(f"food {fid}: recipe references itself")
        self.active.add(fid)
        food = self.by_id[fid]
        where = f"food {fid}"
        if "usda" in food:
            values = self.ref_values(food["usda"], where)
        else:
            totals = [Decimal(0)] * len(NUTRIENTS)
            for ref, grams in food["recipe"]:
                per100 = self.ref_values(ref, where)
                totals = [t + v * grams / HUNDRED for t, v in zip(totals, per100)]
            values = tuple(t * HUNDRED / food["yield"] for t in totals)
        self.active.discard(fid)
        self.memo[fid] = values
        return values


def round_half_away(value: Decimal) -> int:
    return int(value.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def per100g_integers(values: tuple[Decimal, ...]) -> tuple[int, ...]:
    kcal, *grams = values
    return (round_half_away(kcal), *(round_half_away(g * THOUSAND) for g in grams))


# --- output ------------------------------------------------------------------------------------


def ts_string(text: str) -> str:
    return json.dumps(text, ensure_ascii=False)


def ts_list(words: list[str]) -> str:
    return "[" + ", ".join(ts_string(w) for w in words) + "]"


def render_header(spec: dict) -> list[str]:
    units = spec["units"]
    used_units = sorted({p[0] for f in spec["foods"] for p in f["portions"]} | {u for u, _ in AUTO_PORTIONS})
    lines = [
        "// GENERATED FILE, DO NOT EDIT. Built by scripts/foods/build_foods.py from",
        "// scripts/foods/foods.json and scripts/foods/usda-sr-extract.csv (USDA FoodData Central,",
        "// SR Legacy, April 2018, public domain / CC0). Regenerate: python scripts/foods/build_foods.py",
        "// Per 100 g as eaten: energy in kcal, nutrients in mg, rounded half away from zero.",
        "// See docs/adr/0005-bundled-food-list.md.",
        "",
        'import type { CatalogFood, CatalogPortion, NutrientsPer100g, PortionLabel } from "./types";',
        "",
        "const L = {",
    ]
    for unit_id in used_units:
        label = units[unit_id]
        lines.append(f"  {ts_string(unit_id)}: {{ tr: {ts_string(label['tr'])}, en: {ts_string(label['en'])} }},")
    lines += [
        "} as const satisfies Record<string, PortionLabel>;",
        "",
        "function p(id: keyof typeof L, grams: number): CatalogPortion {",
        "  return { id, label: L[id], grams };",
        "}",
        "",
        "function n(energyKcal: number, proteinMg: number, carbMg: number, fatMg: number, fiberMg: number): NutrientsPer100g {",
        "  return { energyKcal, proteinMg, carbMg, fatMg, fiberMg };",
        "}",
        "",
        "export const CATALOG_FOODS: readonly CatalogFood[] = [",
    ]
    return lines


def render_food(food: dict, values: tuple[int, ...]) -> str:
    name = food["name"]
    parts = [
        f"id: {ts_string(food['id'])}",
        f"category: {ts_string(food['category'])}",
        f"name: {{ tr: {ts_string(name['tr'])}, en: {ts_string(name['en'])} }}",
    ]
    aliases = food.get("aliases")
    if aliases:
        inner = ", ".join(f"{loc}: {ts_list(aliases[loc])}" for loc in LOCALES if loc in aliases)
        parts.append(f"aliases: {{ {inner} }}")
    parts.append("per100g: n(" + ", ".join(str(v) for v in values) + ")")
    portions = [tuple(p) for p in food["portions"]] + list(AUTO_PORTIONS)
    parts.append("portions: [" + ", ".join(f"p({ts_string(u)}, {g})" for u, g in portions) + "]")
    return "  { " + ", ".join(parts) + " },"


def render(spec: dict, calc: Calculator) -> str:
    lines = render_header(spec)
    for food in sorted(spec["foods"], key=lambda f: f["id"]):
        lines.append(render_food(food, per100g_integers(calc.food_values(food["id"]))))
    lines += ["];", ""]
    return "\n".join(lines)


def summary(spec: dict) -> str:
    counts: dict[str, int] = {}
    for food in spec["foods"]:
        counts[food["category"]] = counts.get(food["category"], 0) + 1
    recipes = sum(1 for f in spec["foods"] if "recipe" in f)
    per_category = ", ".join(f"{c} {counts.get(c, 0)}" for c in spec["categories"])
    return f"{len(spec['foods'])} foods ({recipes} recipes): {per_category}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--sr-dir", type=Path, help="full SR Legacy CSV directory; rebuilds the extract")
    parser.add_argument("--check", action="store_true", help="fail if the generated module is stale")
    args = parser.parse_args()
    # Messages quote Turkish names; a Windows console defaults to a legacy code page.
    for stream in (sys.stdout, sys.stderr):
        if isinstance(stream, io.TextIOWrapper):
            stream.reconfigure(encoding="utf-8")

    try:
        spec = json.loads(SPEC.read_text(encoding="utf-8"))
        if args.sr_dir is not None:
            rebuild_extract(spec, args.sr_dir)
        sr = load_extract()
        unused = sorted(set(sr) - referenced_fdc_ids(spec))
        if unused:
            fail(f"{EXTRACT.name} has rows no food uses: {unused} (rebuild it with --sr-dir)")
        validate(spec, sr)
        calc = Calculator(spec, sr)
        output = render(spec, calc)
    except SpecError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1

    if args.check:
        current = OUTPUT.read_text(encoding="utf-8") if OUTPUT.exists() else ""
        if current != output:
            print(f"{OUTPUT.relative_to(ROOT)} is out of date; run python scripts/foods/build_foods.py", file=sys.stderr)
            return 1
        print(f"{OUTPUT.relative_to(ROOT)} is up to date. {summary(spec)}")
        return 0

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(output, encoding="utf-8", newline="\n")
    print(f"wrote {OUTPUT.relative_to(ROOT)}. {summary(spec)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

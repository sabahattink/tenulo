/**
 * The Play listing for the narrow build (docs/store/listing.md) must read as a general weight and
 * food log: no medication word in either language, the agreed store names, Play's length limits,
 * and the one allowed disclaimer as the closing line.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NARROW_DISCLAIMER, findForbiddenWords } from "../domain/narrow-words";

const ROOT = join(__dirname, "..", "..");
const LISTING = readFileSync(join(ROOT, "docs", "store", "listing.md"), "utf8");

const NAME_LIMIT = 30;
const SHORT_LIMIT = 80;
const FULL_LIMIT = 4000;

interface StoreText {
  readonly name: string;
  readonly short: string;
  readonly full: string;
}

const ALL_CAPS_HEADING = /^[\p{Lu}0-9 ,.:&'()/-]+$/u;

/**
 * Joins hard-wrapped lines the way the owner pastes the text into Play Console: lines of a
 * paragraph join with a space, while blank lines, `- ` bullets and ALL-CAPS headings start a new
 * line. Play keeps every pasted line break, so this models the joined text as pasted, which is
 * what the length limits count.
 */
function joinWrapped(block: string): string {
  const out: string[] = [];
  let continuing = false;
  for (const raw of block.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "") {
      out.push("");
      continuing = false;
    } else if (continuing && !line.startsWith("- ") && !ALL_CAPS_HEADING.test(line)) {
      out[out.length - 1] = `${out[out.length - 1] ?? ""} ${line}`;
    } else {
      out.push(line);
      continuing = !ALL_CAPS_HEADING.test(line);
    }
  }
  return out.join("\n").trim();
}

/** The text under `### <title>` inside `## <section>` (up to the next heading). */
function field(section: string, title: string): string {
  const start = section.indexOf(`### ${title}`);
  if (start === -1) throw new Error(`missing "### ${title}"`);
  const rest = section.slice(start).split(/\r?\n/).slice(1).join("\n");
  const end = rest.search(/^#{2,3} /m);
  return joinWrapped(end === -1 ? rest : rest.slice(0, end));
}

/**
 * The lines of a Python script from the first one starting with `start` to the first `}` line
 * after it. Python's `\n` escapes in the captions become spaces, so the word next to one is still
 * matched as a whole word.
 */
function pythonBlock(source: string, start: string): string {
  const lines = source.split(/\r?\n/);
  const from = lines.findIndex((line) => line.startsWith(start));
  if (from === -1) throw new Error(`missing "${start}"`);
  const to = lines.findIndex((line, i) => i > from && line === "}");
  if (to === -1) throw new Error(`no closing "}" after "${start}"`);
  return lines
    .slice(from, to + 1)
    .join("\n")
    .replace(/\\n/g, " ");
}

function storeText(sectionTitle: string): StoreText {
  const start = LISTING.indexOf(`## ${sectionTitle}`);
  if (start === -1) throw new Error(`missing "## ${sectionTitle}"`);
  const rest = LISTING.slice(start + 3);
  const end = rest.search(/^## /m);
  const section = end === -1 ? rest : rest.slice(0, end);
  return {
    name: field(section, "App name"),
    short: field(section, "Short description"),
    full: field(section, "Full description"),
  };
}

const SECTIONS = [
  { lang: "tr", title: "Türkçe (tr-TR, default)", name: "Tenulo: Kilo, Beslenme, Su" },
  { lang: "en", title: "English (en-US)", name: "Tenulo: Weight, Food & Water" },
] as const;

/**
 * The TR and EN captions drawn into the screenshots and the feature graphics. `holds` proves the
 * block was found and is the one with both languages in it.
 */
const CAPTION_BLOCKS = [
  { file: "scripts/store_screens.py", start: "SCREENS:", holds: ['"tr":', '"en":', "04-water.png"] },
  { file: "scripts/brand.py", start: "FEATURE_COPY =", holds: ['"tr":', '"en":'] },
] as const;

describe("store listing (narrow build)", () => {
  it.each(SECTIONS)("$lang: agreed name and limits", ({ title, name }) => {
    const text = storeText(title);
    expect(text.name).toBe(name);
    expect(text.name.length).toBeLessThanOrEqual(NAME_LIMIT);
    expect(text.short.length).toBeGreaterThan(0);
    expect(text.short.length).toBeLessThanOrEqual(SHORT_LIMIT);
    expect(text.full.length).toBeLessThanOrEqual(FULL_LIMIT);
  });

  it.each(SECTIONS)("$lang: no medication word in name, short or full description", ({ title }) => {
    const text = storeText(title);
    expect(findForbiddenWords(text.name)).toEqual([]);
    expect(findForbiddenWords(text.short)).toEqual([]);
    expect(findForbiddenWords(text.full)).toEqual([]);
  });

  it.each(SECTIONS)("$lang: closes with the allowed disclaimer", ({ lang, title }) => {
    expect(storeText(title).full.endsWith(NARROW_DISCLAIMER[lang])).toBe(true);
  });

  it("has no medication word anywhere in listing.md (captions and developer note included)", () => {
    expect(findForbiddenWords(LISTING)).toEqual([]);
  });

  it.each(CAPTION_BLOCKS)("has no medication word in $start in $file", ({ file, start, holds }) => {
    const block = pythonBlock(readFileSync(join(ROOT, file), "utf8"), start);
    for (const text of holds) expect(block).toContain(text);
    expect(findForbiddenWords(block)).toEqual([]);
  });

  it("reads a Python block up to its closing brace, with \\n escapes as spaces", () => {
    const source = 'A = 1\nCOPY = {\n    "en": ("Your\\ninjection",),\n}\nB = "dose"\n';
    expect(pythonBlock(source, "COPY =")).toBe('COPY = {\n    "en": ("Your injection",),\n}');
    expect(findForbiddenWords(pythonBlock(source, "COPY ="))).toEqual(["injection", "inject"]);
  });

  it("names the water screenshot and no injection screenshot", () => {
    expect(LISTING).toContain("04-water.png");
    expect(LISTING).not.toContain("04-injection.png");
  });

  it("joins wrapped lines with a space and keeps bullets and headings on their own lines", () => {
    expect(joinWrapped("alpha\nbeta\n\nHEADING\ntext\nmore\n- one\n  two\n- three")).toBe(
      "alpha beta\n\nHEADING\ntext more\n- one two\n- three",
    );
  });
});

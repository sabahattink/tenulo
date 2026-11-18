/**
 * Forbidden-word matcher for the narrow Play build (no medication features).
 *
 * Tests use it to scan every string the narrow app can show, the PDF report and the store
 * listing. The one allowed exception is the not-a-medical-device disclaimer, which is removed
 * before matching.
 */

/** Whole words or word stems that the narrow build must never show. */
export const NARROW_FORBIDDEN: readonly string[] = [
  "GLP",
  "injection",
  "inject",
  "enjeksiyon",
  "iğne",
  "dose",
  "doz",
  "medication",
  "medicine",
  "ilaç",
  "ilac",
  "side effect",
  "yan etki",
  "prescription",
  "reçete",
  "doctor",
  "doktor",
  "patient",
  "hasta",
  "pharmacist",
  "eczacı",
  "treatment",
  "tedavi",
];

export const NARROW_DISCLAIMER: { readonly en: string; readonly tr: string } = {
  en: "Tenulo is a personal log for adults. It is not a medical device and does not diagnose, treat, cure or prevent any condition.",
  tr: "Tenulo yetişkinler için kişisel bir günlüktür. Tıbbi cihaz değildir; hiçbir durumu teşhis etmez, tedavi etmez, iyileştirmez veya önlemez.",
};

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/** True when `needle` occurs in `text` starting at a word boundary. */
function startsAtWordBoundary(text: string, needle: string): boolean {
  let from = text.indexOf(needle);
  while (from !== -1) {
    const before = Array.from(text.slice(0, from)).pop();
    if (before === undefined || !LETTER_OR_DIGIT.test(before)) return true;
    from = text.indexOf(needle, from + 1);
  }
  return false;
}

function entryMatches(entry: string, haystacks: readonly string[]): boolean {
  const needles = [entry.toLocaleLowerCase("en"), entry.toLocaleLowerCase("tr")];
  return needles.some((needle) => haystacks.some((text) => startsAtWordBoundary(text, needle)));
}

/** NFC-normalizes and collapses every whitespace run (line breaks, tabs, NBSP) to one space. */
function fold(text: string): string {
  return text.normalize("NFC").replace(/\s+/gu, " ");
}

/**
 * The forbidden entries found in `text`, in list order. Both disclaimers are removed first; the
 * text is lower-cased in English and in Turkish so "İĞNE" and "INJECTION" are both caught.
 */
export function findForbiddenWords(text: string): string[] {
  const stripped = fold(text)
    .split(fold(NARROW_DISCLAIMER.en))
    .join(" ")
    .split(fold(NARROW_DISCLAIMER.tr))
    .join(" ");
  const haystacks = [stripped.toLocaleLowerCase("en"), stripped.toLocaleLowerCase("tr")];
  return NARROW_FORBIDDEN.filter((entry) => entryMatches(entry, haystacks));
}

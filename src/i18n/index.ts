/**
 * Tenulo speaks Turkish and English. A screen gets both the words and the formatters for the
 * active language from `useI18n()` (provider.tsx); code outside React (the PDF report, tests)
 * takes an `I18n` from `i18nFor(lang)`.
 *
 *   const { t, f } = useI18n();
 *   t.today.title                  // "Today" / "Bugün"
 *   t.forecast.perWeek(...)        // parametrised text is a function
 *   f.weight(82_400, "kg")         // "82.4 kg" / "82,4 kg"
 */
import type { Language } from "../domain/language";
import { type Messages, en } from "./en";
import { type Formatters, createFormatters } from "./format";
import { tr } from "./tr";

export interface I18n {
  readonly lang: Language;
  /** The words: tr.ts has exactly the shape of en.ts. */
  readonly t: Messages;
  /** Numbers, dates and the sentences built from them, in the same language. */
  readonly f: Formatters;
}

const bundle = (lang: Language, t: Messages): I18n => ({ lang, t, f: createFormatters(lang, t) });

/** Built once: a stable object per language, so a context holding it re-renders only on a switch. */
const BUNDLES: Readonly<Record<Language, I18n>> = { en: bundle("en", en), tr: bundle("tr", tr) };

export function i18nFor(lang: Language): I18n {
  return BUNDLES[lang];
}

export type { Formatters, Messages };

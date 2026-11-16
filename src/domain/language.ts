/**
 * Which language Tenulo speaks. The user picks Turkish or English in Settings, or leaves it on
 * "system", which follows the phone. Turkish and English are the only two; Azerbaijani phones get
 * Turkish, which reads closer to them than English does.
 */

export const LANGUAGE_PREFERENCES = ["system", "tr", "en"] as const;
export type LanguagePreference = (typeof LANGUAGE_PREFERENCES)[number];

export const LANGUAGES = ["tr", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

const TURKISH_READERS: ReadonlySet<string> = new Set(["tr", "az"]);

/** The language to show, from the user's preference and the phone's BCP 47 locale tag ("tr-TR"). */
export function resolveLanguage(preference: LanguagePreference, deviceLocale: string): Language {
  if (preference !== "system") return preference;
  const primary = deviceLocale.split(/[-_]/)[0]?.toLowerCase() ?? "";
  return TURKISH_READERS.has(primary) ? "tr" : "en";
}

import { type ReactNode, createContext, useContext } from "react";
import { type LanguagePreference, resolveLanguage } from "@/domain/language";
import { deviceLocale } from "./device";
import { type I18n, i18nFor } from "./index";

const I18nContext = createContext<I18n | undefined>(undefined);

/**
 * Speaks the language the user chose in Settings ("system" follows the phone). Mounted by the
 * root layout once the database is open; changing the preference re-renders every screen.
 */
export function I18nProvider({ preference, children }: { preference: LanguagePreference; children: ReactNode }) {
  const value = i18nFor(resolveLanguage(preference, deviceLocale()));
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * The words and formatters for the active language. Outside the provider (while the database
 * opens, in the error boundary) that is the phone's language.
 */
export function useI18n(): I18n {
  return useContext(I18nContext) ?? i18nFor(resolveLanguage("system", deviceLocale()));
}

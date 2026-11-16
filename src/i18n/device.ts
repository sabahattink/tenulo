/**
 * The phone's locale as a BCP 47 tag ("tr-TR"). Read once per process: a change of the phone's
 * language reaches Tenulo the next time it starts.
 */
let cached: string | undefined;

export function deviceLocale(): string {
  if (cached === undefined) {
    try {
      cached = Intl.DateTimeFormat().resolvedOptions().locale;
    } catch {
      cached = "";
    }
  }
  return cached;
}

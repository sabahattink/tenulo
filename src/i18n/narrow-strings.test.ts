/**
 * The narrow build (no medication features) must not show a medication word in either language.
 * Every key counts as narrow-visible unless narrow-keys.ts lists it as medication-only.
 */
import { describe, expect, it } from "vitest";
import { NARROW_DISCLAIMER, findForbiddenWords } from "../domain/narrow-words";
import { en } from "./en";
import { leaves } from "./leaves";
import { MEDICATION_ONLY_KEYS, isMedicationOnly } from "./narrow-keys";
import { BACKUP_RECORDS } from "./records";
import { tr } from "./tr";

const DICTIONARIES = [
  ["en", en],
  ["tr", tr],
] as const;

/** Record kinds the narrow build never names (restore and backup errors use the neutral texts). */
const HIDDEN_RECORDS: readonly string[] = ["medications", "planSteps", "injections", "sideEffects"];

describe("narrow-build strings", () => {
  it.each(DICTIONARIES)("shows no medication word in %s", (_lang, messages) => {
    const offending = leaves(messages)
      .filter(([path]) => !isMedicationOnly(path))
      .flatMap(([path, text]) => {
        const words = findForbiddenWords(text);
        return words.length === 0 ? [] : [`${path}: ${text} → ${words.join(", ")}`];
      });
    expect(offending, offending.join("\n")).toEqual([]);
  });

  it.each(DICTIONARIES)("shows no medication word in %s messages the walk does not reach", (_lang, t) => {
    const texts = [
      t.restore.keptHidden(1),
      t.restore.keptHidden(12),
      t.backup.problemAtHidden(undefined),
      t.backup.problemAtHidden(4),
      ...BACKUP_RECORDS.filter((r) => !HIDDEN_RECORDS.includes(r)).flatMap((r) => [t.backup.problemAt(r, undefined), t.backup.problemAt(r, 4)]),
    ];
    expect(texts.filter((text) => findForbiddenWords(text).length > 0)).toEqual([]);
  });

  it("lists only keys that exist", () => {
    const paths = leaves(en).map(([path]) => path);
    const stale = MEDICATION_ONLY_KEYS.filter((key) => !paths.some((path) => path === key || path.startsWith(`${key}.`)));
    expect(stale).toEqual([]);
  });

  it("never hides a narrow twin", () => {
    const hidden = leaves(en)
      .map(([path]) => path)
      .filter((path) => path.split(".").includes("narrow") && isMedicationOnly(path));
    expect(hidden).toEqual([]);
  });

  it("uses the one allowed disclaimer", () => {
    expect(en.settings.narrow.disclaimer).toBe(NARROW_DISCLAIMER.en);
    expect(tr.settings.narrow.disclaimer).toBe(NARROW_DISCLAIMER.tr);
    expect(en.privacy.narrow.footer("P", "e@x")).toContain(NARROW_DISCLAIMER.en);
    expect(tr.privacy.narrow.footer("P", "e@x")).toContain(NARROW_DISCLAIMER.tr);
    expect(en.reportPdf.narrow.footer("1 Jan 2027", "P")).toMatch(/^Recorded by you in Tenulo/);
    expect(en.reportPdf.narrow.footer("1 Jan 2027", "P")).toContain(NARROW_DISCLAIMER.en);
    expect(tr.reportPdf.narrow.footer("1 Ocak 2027", "P")).toContain(NARROW_DISCLAIMER.tr);
  });

  it("names the report and the reminders as the narrow build does", () => {
    expect([en.screens.narrow.report, en.settings.data.narrow.report]).toEqual(["PDF report", "PDF report"]);
    expect([tr.screens.narrow.report, tr.settings.data.narrow.report]).toEqual(["PDF rapor", "PDF rapor"]);
    expect(en.reminders.narrow.channelDescription).toBe("Weigh-in reminders you set in Tenulo");
    expect(tr.reminders.narrow.channelDescription).toBe("Tenulo'da kurduğun tartım hatırlatıcıları");
  });

  it("counts restored entries it does not show without naming them", () => {
    expect(en.restore.keptHidden(1)).toBe("1 entry from another version was kept; this version does not show it.");
    expect(en.restore.keptHidden(12)).toBe("12 entries from another version were kept; this version does not show them.");
    expect(tr.restore.keptHidden(12)).toBe("Başka bir sürümden 12 kayıt saklandı; bu sürüm onları göstermiyor.");
  });
});

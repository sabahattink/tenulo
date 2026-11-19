import { describe, expect, it } from "vitest";
import { en } from "./en";
import { reminderTextsFor } from "./reminder-texts";
import { tr } from "./tr";

const DICTIONARIES = [
  ["en", en],
  ["tr", tr],
] as const;

describe("reminderTextsFor", () => {
  it.each(DICTIONARIES)("uses the narrow channel description without medication features (%s)", (_lang, t) => {
    const texts = reminderTextsFor(t.reminders, false);
    expect(texts.channelDescription).toBe(t.reminders.narrow.channelDescription);
    expect(texts.channelName).toBe(t.reminders.channelName);
    expect(texts.lockedTitle).toBe(t.reminders.lockedTitle);
    expect(texts.weighInTitle).toBe(t.reminders.weighInTitle);
    expect(texts.weighInBody).toBe(t.reminders.weighInBody);
  });

  it.each(DICTIONARIES)("keeps the full texts as they are with medication features (%s)", (_lang, t) => {
    const texts = reminderTextsFor(t.reminders, true);
    expect(texts).toBe(t.reminders);
    expect(texts.channelDescription).toBe(t.reminders.channelDescription);
  });
});

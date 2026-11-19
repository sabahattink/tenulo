import type { ReminderTexts } from "../platform/reminders";
import type { Messages } from "./en";

/**
 * The texts the reminder module gets: the `reminders` messages themselves with medication features,
 * and a copy with the `narrow` channel description (weigh-in only) without them.
 */
export function reminderTextsFor(texts: Messages["reminders"], medication: boolean): ReminderTexts {
  return medication ? texts : { ...texts, ...texts.narrow };
}

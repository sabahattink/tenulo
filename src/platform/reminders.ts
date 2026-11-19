/**
 * Local reminders, behind one small interface. The Android side is Tenulo's own module
 * (AlarmManager + NotificationCompat), chosen over expo-notifications because that library ships
 * Firebase Cloud Messaging, and Tenulo ships no Firebase.
 */
import { Reminders } from "../../modules/tenulo-native";
import type { LocalDate } from "../domain/date";
import { INJECTION_REMINDER_ID, WEIGH_IN_REMINDER_ID, injectionReminderAt } from "../domain/reminder";

export { INJECTION_REMINDER_ID, WEIGH_IN_REMINDER_ID };

export interface ReminderPlan {
  readonly injectionEnabled: boolean;
  readonly injectionMinute: number;
  /** Next due date from the user's own schedule; undefined before the first logged injection. */
  readonly nextDue: LocalDate | undefined;
  readonly weighInEnabled: boolean;
  readonly weighInMinute: number;
}

/**
 * Everything a reminder shows, in the user's language (the `reminders` messages). The native side
 * stores each reminder's title and body with its alarm, so a reminder fires in the language it was
 * scheduled in; applyReminders runs again when the language changes.
 */
export interface ReminderTexts {
  readonly injectionTitle: string;
  readonly injectionBody: string;
  readonly weighInTitle: string;
  readonly weighInBody: string;
  /** The notification channel, as listed in Android's notification settings for Tenulo. */
  readonly channelName: string;
  readonly channelDescription: string;
  /** The only text a locked screen shows: what a reminder is about is health data. */
  readonly lockedTitle: string;
}

export function remindersAvailable(): boolean {
  return Reminders !== null;
}

export function canNotify(): boolean {
  return Reminders?.canNotify() ?? false;
}

export async function requestNotificationPermission(): Promise<boolean> {
  return (await Reminders?.requestPermission()) ?? false;
}

/**
 * Makes the scheduled alarms match the plan, with texts in the user's language. Idempotent:
 * called whenever settings, the language or the injection log change, and on every app start.
 */
export function applyReminders(plan: ReminderPlan, texts: ReminderTexts, now: Date = new Date()): void {
  if (Reminders === null) return;
  Reminders.setTexts(texts.channelName, texts.channelDescription, texts.lockedTitle);
  const injectionAt = plan.injectionEnabled ? injectionReminderAt(plan.nextDue, plan.injectionMinute, now) : undefined;
  if (injectionAt === undefined) {
    Reminders.cancel(INJECTION_REMINDER_ID);
  } else {
    Reminders.scheduleAt(INJECTION_REMINDER_ID, texts.injectionTitle, texts.injectionBody, injectionAt.getTime());
  }
  if (plan.weighInEnabled) {
    Reminders.scheduleDaily(WEIGH_IN_REMINDER_ID, texts.weighInTitle, texts.weighInBody, plan.weighInMinute);
  } else {
    Reminders.cancel(WEIGH_IN_REMINDER_ID);
  }
}

export function cancelAllReminders(): void {
  Reminders?.cancelAll();
}

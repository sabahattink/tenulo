/**
 * Local reminders, behind one small interface. The Android side is Tenulo's own module
 * (AlarmManager + NotificationCompat), chosen over expo-notifications because that library ships
 * Firebase Cloud Messaging, and Tenulo ships no Firebase.
 */
import { Reminders } from "../../modules/tenulo-native";
import type { LocalDate } from "../domain/date";
import { injectionReminderAt } from "../domain/reminder";

export const INJECTION_REMINDER_ID = "injection";
export const WEIGH_IN_REMINDER_ID = "weigh-in";

export interface ReminderPlan {
  readonly injectionEnabled: boolean;
  readonly injectionMinute: number;
  /** Next due date from the user's own schedule; undefined before the first logged injection. */
  readonly nextDue: LocalDate | undefined;
  readonly weighInEnabled: boolean;
  readonly weighInMinute: number;
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
 * Makes the scheduled alarms match the plan. Idempotent: called whenever settings or the
 * injection log change, and on every app start.
 */
export function applyReminders(plan: ReminderPlan, now: Date = new Date()): void {
  if (Reminders === null) return;
  const injectionAt = plan.injectionEnabled ? injectionReminderAt(plan.nextDue, plan.injectionMinute, now) : undefined;
  if (injectionAt === undefined) {
    Reminders.cancel(INJECTION_REMINDER_ID);
  } else {
    Reminders.scheduleAt(
      INJECTION_REMINDER_ID,
      "Injection day",
      "Your schedule has an injection due. Log it in Tenulo once it is done.",
      injectionAt.getTime(),
    );
  }
  if (plan.weighInEnabled) {
    Reminders.scheduleDaily(
      WEIGH_IN_REMINDER_ID,
      "Time to weigh in",
      "Step on the scale and log it. Your trend smooths out the daily ups and downs.",
      plan.weighInMinute,
    );
  } else {
    Reminders.cancel(WEIGH_IN_REMINDER_ID);
  }
}

export function cancelAllReminders(): void {
  Reminders?.cancelAll();
}

/**
 * Typed bindings for Tenulo's own Android module (see android/). Each binding is optional: in a
 * build without the native code (Expo Go, web, tests) the module is null and callers fall back.
 */
import { type EventSubscription, type NativeModule, requireOptionalNativeModule } from "expo";

declare class TenuloRemindersModule extends NativeModule {
  canNotify(): boolean;
  requestPermission(): Promise<boolean>;
  scheduleAt(id: string, title: string, body: string, atMs: number): void;
  scheduleDaily(id: string, title: string, body: string, minute: number): void;
  cancel(id: string): void;
  cancelAll(): void;
  scheduledIds(): string[];
}

export type PurchaseOutcome = "purchased" | "pending" | "canceled";

export interface StoreProduct {
  readonly productId: string;
  readonly title: string;
  readonly description: string;
  readonly price: string | null;
}

declare class TenuloBillingModule extends NativeModule<{ onPurchasesUpdated: (e: { responseCode: number }) => void }> {
  getProduct(productId: string): Promise<StoreProduct | null>;
  purchase(productId: string): Promise<PurchaseOutcome>;
  ownedProducts(): Promise<{ owned: string[]; pending: string[] }>;
}

export interface LaunchInfo {
  readonly action: string | null;
  /** Id of the reminder whose notification opened the app. */
  readonly reminder: string | null;
}

declare class TenuloLaunchModule extends NativeModule<{ onLaunch: (e: LaunchInfo) => void }> {
  initial(): LaunchInfo;
}

export const Reminders = requireOptionalNativeModule<TenuloRemindersModule>("TenuloReminders");
export const Billing = requireOptionalNativeModule<TenuloBillingModule>("TenuloBilling");
export const Launch = requireOptionalNativeModule<TenuloLaunchModule>("TenuloLaunch");

export type { EventSubscription };

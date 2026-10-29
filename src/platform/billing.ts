/**
 * Tenulo Pro: one one-time product, bought through Google Play Billing directly. Play is the only
 * source of truth: ownership is asked from Play on start and after every purchase update, and
 * nothing about it is stored in Tenulo's database (Play answers from its own cache when offline).
 */
import { useSyncExternalStore } from "react";
import { Billing, type PurchaseOutcome, type StoreProduct } from "../../modules/tenulo-native";

/** The in-app product id configured in Play Console (one-time, non-consumable). */
export const PRO_PRODUCT_ID = "tenulo_pro";

export interface ProState {
  /** Play confirmed the purchase. */
  readonly pro: boolean;
  /** Paid but not settled yet (e.g. cash at a store); Pro unlocks once Play confirms. */
  readonly pending: boolean;
  /** False until Play has answered once. */
  readonly checked: boolean;
  /** Development builds only: lets the developer try Pro features without a Play account. */
  readonly devUnlocked: boolean;
}

let state: ProState = { pro: false, pending: false, checked: false, devUnlocked: false };
const listeners = new Set<() => void>();

function set(next: Partial<ProState>): void {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function billingAvailable(): boolean {
  return Billing !== null;
}

/** Asks Play what the user owns. Safe to call often; failures leave the last known state. */
export async function refreshPro(): Promise<void> {
  if (Billing === null) {
    set({ checked: true });
    return;
  }
  try {
    const { owned, pending } = await Billing.ownedProducts();
    set({ pro: owned.includes(PRO_PRODUCT_ID), pending: pending.includes(PRO_PRODUCT_ID), checked: true });
  } catch {
    set({ checked: true });
  }
}

let listening = false;

/** Starts following purchase updates (a pending purchase may complete while the app runs). */
export function startBilling(): void {
  if (listening || Billing === null) {
    void refreshPro();
    return;
  }
  listening = true;
  Billing.addListener("onPurchasesUpdated", () => void refreshPro());
  void refreshPro();
}

export async function proProduct(): Promise<StoreProduct | null> {
  if (Billing === null) return null;
  return Billing.getProduct(PRO_PRODUCT_ID);
}

export async function buyPro(): Promise<PurchaseOutcome> {
  if (Billing === null) throw new Error("Purchases need the Play Store version of Tenulo");
  const outcome = await Billing.purchase(PRO_PRODUCT_ID);
  await refreshPro();
  return outcome;
}

export function setDevUnlocked(unlocked: boolean): void {
  if (__DEV__) set({ devUnlocked: unlocked });
}

export function useProState(): ProState {
  return useSyncExternalStore(subscribe, () => state);
}

/** True when Pro features may be used. */
export function useIsPro(): boolean {
  const s = useProState();
  return s.pro || (__DEV__ && s.devUnlocked);
}

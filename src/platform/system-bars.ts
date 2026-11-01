/**
 * System bar appearance that Expo does not keep in step with the theme. Android's activity is not
 * recreated on a dark/light switch, so the three-button navigation bar keeps the scrim it was
 * started with until told otherwise (see SystemBarsModule.kt).
 */
import { SystemBars } from "../../modules/tenulo-native";

export function setNavigationBarLight(light: boolean): void {
  // Cosmetic: a failure leaves the bar as it was, which is still usable.
  SystemBars?.setNavigationBarLight(light).catch(() => undefined);
}

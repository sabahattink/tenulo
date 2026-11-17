import { Alert } from "react-native";
import type { Messages } from "@/i18n";

/**
 * A message with a single button that only closes it. `Alert.alert` without buttons shows React
 * Native's own "OK", which is English whatever the app's language; this one says it in the app's
 * ("Tamam"). The lint config forbids `Alert.alert` with fewer than three arguments, so every alert
 * names its buttons.
 */
export function notify(t: Messages, title: string, message?: string): void {
  Alert.alert(title, message, [{ text: t.common.ok }]);
}

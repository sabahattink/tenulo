import { AccessibilityInfo, Alert } from "react-native";
import { addWater, deleteWater, removeLastWater } from "@/data/water";
import type { LocalDate } from "@/domain/date";
import { useI18n } from "@/i18n/provider";
import { litresText, mlText } from "./texts";

export interface WaterActions {
  /** Logs `ml` on the day and tells a screen reader the new total. */
  readonly add: (ml: number) => void;
  /** Takes back the day's last entry: the quick fix for a mistaken tap. */
  readonly undoLast: () => void;
  readonly remove: (id: string) => void;
}

/**
 * Water changes from Today and the water screen. `totalMl` is the day's total as shown, so the
 * announcement after a tap can say where the day now stands. Errors are shown, never swallowed.
 */
export function useWaterActions(date: LocalDate, totalMl: number): WaterActions {
  const i18n = useI18n();
  const { t } = i18n;
  const fail = (e: unknown) => Alert.alert(t.common.couldNotSave, e instanceof Error ? e.message : t.common.tryAgain);
  return {
    add: (ml) => {
      addWater(ml, date)
        .then(() => AccessibilityInfo.announceForAccessibility(t.daily.glassAdded(mlText(i18n, ml), litresText(i18n, totalMl + ml))))
        .catch(fail);
    },
    undoLast: () => {
      removeLastWater(date)
        .then(() => AccessibilityInfo.announceForAccessibility(t.daily.glassRemoved))
        .catch(fail);
    },
    remove: (id) => {
      deleteWater(id).catch(fail);
    },
  };
}

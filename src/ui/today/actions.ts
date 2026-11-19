import type { Messages } from "@/i18n";
import type { IconName } from "../icons";
import type { Kind } from "../theme";

export type QuickAction = keyof Messages["daily"]["actions"];

export interface QuickActionTile {
  readonly action: QuickAction;
  readonly icon: IconName;
  readonly kind: Kind;
}

/** Each tile wears its kind's tint, the same color the record has in rings and in History. */
const ACTIONS: readonly QuickActionTile[] = [
  { action: "food", icon: "food", kind: "food" },
  { action: "water", icon: "glass", kind: "water" },
  { action: "weight", icon: "scale", kind: "weight" },
  { action: "measurement", icon: "tape", kind: "measurement" },
  { action: "exercise", icon: "run", kind: "exercise" },
  { action: "sideEffect", icon: "face", kind: "sideEffect" },
];

/** The tiles for Today; the narrow build has no side-effect log. */
export function quickActions(medication: boolean): readonly QuickActionTile[] {
  return medication ? ACTIONS : ACTIONS.filter((a) => a.action !== "sideEffect");
}

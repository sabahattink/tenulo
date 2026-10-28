/** Side effects the user can record. The list is descriptive; Tenulo never interprets it. */
export const SIDE_EFFECT_TYPES = [
  "nausea",
  "vomiting",
  "constipation",
  "diarrhea",
  "heartburn",
  "fatigue",
  "headache",
  "injection-site",
  "other",
] as const;
export type SideEffectType = (typeof SIDE_EFFECT_TYPES)[number];

/** The user's own rating: 1 mild, 2 moderate, 3 strong. */
export const SEVERITIES = [1, 2, 3] as const;
export type Severity = (typeof SEVERITIES)[number];

export function isSeverity(n: number): n is Severity {
  return n === 1 || n === 2 || n === 3;
}

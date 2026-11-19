/** Build-time switches committed in app.json (`expo.extra`). */
export interface Features {
  /** true: the full build with medication features; false: the narrow Play build. */
  readonly medication: boolean;
}

/** Validates `expo.extra`. A missing or non-boolean switch throws; `false` is never assumed. */
export function parseFeatures(extra: unknown): Features {
  if (typeof extra === "object" && extra !== null && "medication" in extra) {
    const { medication } = extra;
    if (typeof medication === "boolean") return { medication };
  }
  throw new Error("app.json: expo.extra.medication must be true or false");
}

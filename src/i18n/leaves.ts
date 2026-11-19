/**
 * Every message of a dictionary as `[path, text]`, for the tests that read all strings at once
 * (messages.test.ts, narrow-strings.test.ts). Used by tests only.
 */

/** Arguments for messages whose parameters are not plain numbers or text. */
export const SAMPLE_ARGS: Readonly<Record<string, readonly unknown[]>> = {
  "backup.problemAt": ["weights", 4],
  "backup.wholeCheck": ["Duplicate id in backup"],
  "calendar.shortDate": [18, "Oct", "2027"],
  "pro.failedBody": ["E_NO_PRODUCT", "This product is not available right now"],
};
const DEFAULT_ARGS = [3, "x", "y", "z"];

/** Every message as text: strings as they are, functions called with sample arguments. */
export function leaves(messages: unknown, path = ""): [string, string][] {
  if (typeof messages === "string") return [[path, messages]];
  if (typeof messages === "function") {
    const result: unknown = messages(...(SAMPLE_ARGS[path] ?? DEFAULT_ARGS));
    return [[path, typeof result === "string" ? result : `<${String(result)}>`]];
  }
  if (typeof messages === "object" && messages !== null) {
    return Object.entries(messages).flatMap(([key, value]) => leaves(value, path === "" ? key : `${path}.${key}`));
  }
  return [[path, `<${String(messages)}>`]];
}

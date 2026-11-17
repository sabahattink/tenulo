/**
 * Tape-measure lengths for display. A tape is read to half a centimetre, so a length shows one
 * decimal at most and none when it is whole ("92.5 cm", "104 cm"). The unit symbol is the same in
 * both languages; the number follows the language (decimal comma in Turkish, a true minus sign).
 */
import { type LengthUnit, fromMillimetres } from "../../domain/measurement";
import type { Formatters } from "../../i18n";

/** Between a number and its unit, so a narrow card never wraps "cm" onto a line of its own. */
const NBSP = "\u00a0";

/** The length in tenths of the display unit, rounded once. */
function tenths(mm: number, unit: LengthUnit): number {
  return Math.round(fromMillimetres(mm, unit) * 10);
}

function number(f: Formatters, tenthsValue: number): string {
  return f.decimal(tenthsValue / 10, tenthsValue % 10 === 0 ? 0 : 1);
}

/** "92.5" / "92,5": for input fields and hints. */
export function formatLengthNumber(f: Formatters, mm: number, unit: LengthUnit): string {
  return number(f, tenths(mm, unit));
}

/** "92.5 cm" / "92,5 cm", "36.4 in". */
export function formatLength(f: Formatters, mm: number, unit: LengthUnit): string {
  return `${formatLengthNumber(f, mm, unit)}${NBSP}${unit}`;
}

/** "−3.5 cm", "+1 cm", "0 cm": signed, with a true minus sign. */
export function formatLengthChange(f: Formatters, mm: number, unit: LengthUnit): string {
  const t = tenths(Math.abs(mm), unit);
  if (t === 0) return `0${NBSP}${unit}`;
  return `${mm < 0 ? "−" : "+"}${number(f, t)}${NBSP}${unit}`;
}

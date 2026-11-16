/** Water is logged in whole millilitres, one entry per glass or bottle. */

/** One entry: a 5-litre bottle is far beyond any real glass, so anything bigger is a typo. */
export const MAX_WATER_ENTRY_ML = 5000;

export function isWaterAmount(ml: number): boolean {
  return Number.isInteger(ml) && ml >= 1 && ml <= MAX_WATER_ENTRY_ML;
}

export function totalMl(entries: readonly { readonly amountMl: number }[]): number {
  return entries.reduce((sum, e) => sum + e.amountMl, 0);
}

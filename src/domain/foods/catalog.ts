import { CATALOG_FOODS } from "./catalog.generated";
import type { CatalogFood } from "./types";

export { CATALOG_FOODS };

const BY_ID: ReadonlyMap<string, CatalogFood> = new Map(CATALOG_FOODS.map((food) => [food.id, food]));

/**
 * The bundled food with this id. Undefined when a later list dropped it: logged entries keep their
 * own snapshot of name and nutrients, so they never depend on finding the food again.
 */
export function findCatalogFood(id: string): CatalogFood | undefined {
  return BY_ID.get(id);
}

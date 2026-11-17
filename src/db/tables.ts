import {
  customFoods,
  exerciseEntries,
  foodEntries,
  injections,
  measurementEntries,
  medications,
  planSteps,
  settings,
  sideEffects,
  waterEntries,
  weightEntries,
} from "./schema";

/**
 * Every table, children before parents, so deleting in this order never trips a foreign key.
 * "Delete all data" walks this list; a test fails if a table in the schema is missing here.
 */
export const ALL_TABLES_DELETE_ORDER = [
  sideEffects,
  injections,
  planSteps,
  medications,
  weightEntries,
  foodEntries,
  customFoods,
  waterEntries,
  measurementEntries,
  exerciseEntries,
  settings,
] as const;

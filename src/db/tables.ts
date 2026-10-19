import { injections, medications, planSteps, settings, sideEffects, weightEntries } from "./schema";

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
  settings,
] as const;

/**
 * Settings for every connection to Tenulo's database, shared by the app (client.ts) and the tests
 * (test-db.ts), so the tests run against the same database behavior as the phone.
 *
 * `secure_delete` overwrites a deleted record with zeros instead of only unlinking it, so deleting
 * one entry removes its bytes from the database file too (at the next checkpoint). expo-sqlite's
 * bundled SQLite is not compiled with it on. "Delete all data" goes further: see purgeDeletedData.
 */
export const CONNECTION_PRAGMAS = "PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA secure_delete = ON;";

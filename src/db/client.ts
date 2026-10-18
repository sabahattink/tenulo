import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import * as schema from "./schema";

/** The app's single database file, inside the app sandbox. Never synced, never uploaded. */
export const DATABASE_NAME = "tenulo.db";

const connection = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });
connection.execSync("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");

export const db = drizzle(connection, { schema });
export type Db = typeof db;

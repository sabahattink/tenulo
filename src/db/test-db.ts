/// <reference types="node" />
/**
 * Test-only: the app's real Drizzle expo-sqlite driver, running on Node's built-in SQLite.
 *
 * The adapter implements the few expo-sqlite methods the driver calls (prepareSync, executeSync,
 * executeForRawResultSync), so transactions, conflict handling and RETURNING go through exactly
 * the code paths the phone runs. Migrations run through Drizzle's own migrator, as at app start:
 * every pending migration in one transaction (where `PRAGMA foreign_keys=OFF` does nothing).
 * Never imported by app code.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync, type SQLInputValue, type StatementSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite/driver";
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import { CONNECTION_PRAGMAS } from "./connection";
import * as schema from "./schema";

const root = join(__dirname, "..", "..", "drizzle");

interface JournalEntry {
  readonly idx: number;
  readonly when: number;
  readonly tag: string;
  readonly breakpoints: boolean;
}

export interface MigrationBundle {
  readonly journal: { readonly entries: JournalEntry[] };
  readonly migrations: Record<string, string>;
}

/** The bundle drizzle/migrations.js gives the app, read from the same files, up to `lastIdx`. */
export function migrationBundle(lastIdx = Number.MAX_SAFE_INTEGER): MigrationBundle {
  const journal = JSON.parse(readFileSync(join(root, "meta", "_journal.json"), "utf8")) as { entries: JournalEntry[] };
  const entries = journal.entries.filter((e) => e.idx <= lastIdx);
  return {
    journal: { ...journal, entries },
    migrations: Object.fromEntries(
      entries.map((e) => [`m${String(e.idx).padStart(4, "0")}`, readFileSync(join(root, `${e.tag}.sql`), "utf8")]),
    ),
  };
}

/** Each migration's SQL, for checks over everything the app will ever run. */
export function migrationSql(): { readonly tag: string; readonly sql: string }[] {
  const { journal, migrations } = migrationBundle();
  return journal.entries.map((e) => ({ tag: e.tag, sql: migrations[`m${String(e.idx).padStart(4, "0")}`] ?? "" }));
}

const toInput = (params: readonly unknown[]): SQLInputValue[] =>
  params.map((p) => (typeof p === "boolean" ? Number(p) : (p as SQLInputValue)));

class StatementAdapter {
  constructor(private readonly stmt: StatementSync) {}

  executeSync(params: readonly unknown[]) {
    if (this.stmt.columns().length > 0) {
      const rows = this.stmt.all(...toInput(params));
      return { changes: 0, lastInsertRowId: 0, getAllSync: () => rows, getFirstSync: () => rows[0] ?? null };
    }
    const r = this.stmt.run(...toInput(params));
    return {
      changes: Number(r.changes),
      lastInsertRowId: Number(r.lastInsertRowid),
      getAllSync: () => [],
      getFirstSync: () => null,
    };
  }

  executeForRawResultSync(params: readonly unknown[]) {
    this.stmt.setReturnArrays(true);
    try {
      const rows = this.stmt.all(...toInput(params));
      return { getAllSync: () => rows };
    } finally {
      this.stmt.setReturnArrays(false);
    }
  }
}

export type TestDb = Awaited<ReturnType<typeof testDb>>;

/**
 * A database with the app's connection settings, migrated up to `lastIdx` (default: all), the raw
 * handle for setup and assertions, and every SQL statement Drizzle prepared after migrating. In
 * memory unless `path` names a file.
 */
export async function testDb(path = ":memory:", lastIdx = Number.MAX_SAFE_INTEGER) {
  const sqlite = new DatabaseSync(path);
  sqlite.exec(CONNECTION_PRAGMAS);
  const statements: string[] = [];
  const client = {
    prepareSync: (sql: string) => {
      statements.push(sql);
      return new StatementAdapter(sqlite.prepare(sql));
    },
  };
  const database = drizzle(client as unknown as Parameters<typeof drizzle>[0], { schema });
  await migrate(database, migrationBundle(lastIdx));
  statements.length = 0;
  return { sqlite, database, statements };
}

/** Runs the migrations a newer app version brings, as its start-up would: the pending ones only. */
export async function upgrade(t: TestDb, lastIdx = Number.MAX_SAFE_INTEGER): Promise<void> {
  await migrate(t.database, migrationBundle(lastIdx));
}

export function count(sqlite: DatabaseSync, table: string): number {
  return (sqlite.prepare(`SELECT count(*) AS n FROM "${table}"`).get() as { n: number }).n;
}

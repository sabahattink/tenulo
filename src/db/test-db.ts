/// <reference types="node" />
/**
 * Test-only: the app's real Drizzle expo-sqlite driver, running on Node's built-in SQLite.
 *
 * The adapter implements the few expo-sqlite methods the driver calls (prepareSync, executeSync,
 * executeForRawResultSync), so transactions, conflict handling and RETURNING go through exactly
 * the code paths the phone runs. Never imported by app code.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync, type SQLInputValue, type StatementSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite/driver";
import * as schema from "./schema";

const root = join(__dirname, "..", "..", "drizzle");

export function applyMigrations(db: DatabaseSync, fromIdx = 0, toIdx = Number.MAX_SAFE_INTEGER): void {
  const journal = JSON.parse(readFileSync(join(root, "meta", "_journal.json"), "utf8")) as {
    entries: { idx: number; tag: string }[];
  };
  for (const { idx, tag } of [...journal.entries].sort((a, b) => a.idx - b.idx)) {
    if (idx < fromIdx || idx > toIdx) continue;
    const sql = readFileSync(join(root, `${tag}.sql`), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) db.exec(statement);
    }
  }
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

/** A migrated in-memory database, the raw handle for setup and assertions, and every SQL statement Drizzle prepared. */
export function testDb() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  applyMigrations(sqlite);
  const statements: string[] = [];
  const client = {
    prepareSync: (sql: string) => {
      statements.push(sql);
      return new StatementAdapter(sqlite.prepare(sql));
    },
  };
  const database = drizzle(client as unknown as Parameters<typeof drizzle>[0], { schema });
  return { sqlite, database, statements };
}

export function count(sqlite: DatabaseSync, table: string): number {
  return (sqlite.prepare(`SELECT count(*) AS n FROM "${table}"`).get() as { n: number }).n;
}

/// <reference types="node" />
/**
 * Runs the generated migrations against a real SQLite database (Node's built-in node:sqlite)
 * and checks that the constraints reject what the app must never store.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";

const root = join(__dirname, "..", "..", "drizzle");
const journal = JSON.parse(readFileSync(join(root, "meta", "_journal.json"), "utf8")) as {
  entries: { idx: number; tag: string }[];
};

function migratedDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const { tag } of [...journal.entries].sort((a, b) => a.idx - b.idx)) {
    const sql = readFileSync(join(root, `${tag}.sql`), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) db.exec(statement);
    }
  }
  return db;
}

const now = 1_792_300_000_000;
let db: DatabaseSync;

beforeEach(() => {
  db = migratedDb();
});

const insertWeight = (values: Record<string, unknown>) => {
  const row = {
    id: "01W",
    measured_at: now,
    local_date: "2026-10-18",
    weight_g: 82_400,
    source: "manual",
    health_connect_id: null,
    created_at: now,
    updated_at: now,
    ...values,
  };
  const cols = Object.keys(row);
  db.prepare(`INSERT INTO weight_entry (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`).run(
    ...(Object.values(row) as (string | number | null)[]),
  );
};

describe("schema constraints", () => {
  it("accepts a valid weight", () => {
    insertWeight({});
    expect(db.prepare("SELECT count(*) AS n FROM weight_entry").get()).toEqual({ n: 1 });
  });

  it("rejects implausible weights, unknown sources and malformed dates", () => {
    expect(() => insertWeight({ weight_g: 8_240 })).toThrow(/CHECK/);
    expect(() => insertWeight({ source: "cloud" })).toThrow(/CHECK/);
    expect(() => insertWeight({ local_date: "18.10.2026" })).toThrow(/CHECK/);
  });

  it("ties Health Connect ids to the health_connect source and keeps them unique", () => {
    expect(() => insertWeight({ source: "health_connect" })).toThrow(/CHECK/);
    expect(() => insertWeight({ health_connect_id: "hc-1" })).toThrow(/CHECK/);
    insertWeight({ id: "a", source: "health_connect", health_connect_id: "hc-1" });
    expect(() => insertWeight({ id: "b", source: "health_connect", health_connect_id: "hc-1" })).toThrow(/UNIQUE/);
  });

  it("allows only one settings row", () => {
    db.prepare("INSERT INTO settings (id, updated_at) VALUES (1, ?)").run(now);
    expect(() => db.prepare("INSERT INTO settings (id, updated_at) VALUES (2, ?)").run(now)).toThrow(/CHECK/);
    expect(() => db.prepare("UPDATE settings SET weight_unit = 'stone' WHERE id = 1").run()).toThrow(/CHECK/);
  });

  it("protects injections, sites and medication references", () => {
    db.prepare("INSERT INTO medication (id, name, created_at, updated_at) VALUES ('m', 'My pen', ?, ?)").run(now, now);
    const insertInjection = (id: string, site: string | null, medication = "m") =>
      db
        .prepare(
          "INSERT INTO injection (id, medication_id, taken_at, local_date, dose_mcg, site, created_at, updated_at) VALUES (?, ?, ?, '2026-10-18', 250, ?, ?, ?)",
        )
        .run(id, medication, now, site, now, now);

    insertInjection("i1", "thigh-left");
    insertInjection("i2", null);
    expect(() => insertInjection("i3", "elbow")).toThrow(/CHECK/);
    expect(() => insertInjection("i4", "arm-left", "missing")).toThrow(/FOREIGN KEY/);
    expect(() => db.prepare("DELETE FROM medication WHERE id = 'm'").run()).toThrow(/FOREIGN KEY/);
  });

  it("rejects empty medication names and bad side effects", () => {
    expect(() =>
      db.prepare("INSERT INTO medication (id, name, created_at, updated_at) VALUES ('x', '   ', ?, ?)").run(now, now),
    ).toThrow(/CHECK/);
    const insertEffect = (type: string, severity: number) =>
      db
        .prepare(
          "INSERT INTO side_effect (id, local_date, type, severity, created_at, updated_at) VALUES (?, '2026-10-18', ?, ?, ?, ?)",
        )
        .run(`${type}-${severity}`, type, severity, now, now);
    insertEffect("nausea", 2);
    expect(() => insertEffect("nausea", 4)).toThrow(/CHECK/);
    expect(() => insertEffect("euphoria", 1)).toThrow(/CHECK/);
  });
});

describe("delete all data", () => {
  it("covers every table in the schema", async () => {
    const { is, getTableName } = await import("drizzle-orm");
    const { SQLiteTable } = await import("drizzle-orm/sqlite-core");
    const schema = await import("./schema");
    const { ALL_TABLES_DELETE_ORDER } = await import("./tables");
    const inSchema = Object.values(schema)
      .filter((v) => is(v, SQLiteTable))
      .map((t) => getTableName(t as InstanceType<typeof SQLiteTable>))
      .sort();
    const inList = ALL_TABLES_DELETE_ORDER.map((t) => getTableName(t)).sort();
    expect(inList).toEqual(inSchema);
  });

  it("empties a fully linked database without foreign key errors", async () => {
    const { getTableName } = await import("drizzle-orm");
    const { ALL_TABLES_DELETE_ORDER } = await import("./tables");
    db.prepare("INSERT INTO settings (id, updated_at) VALUES (1, ?)").run(now);
    insertWeight({});
    db.prepare("INSERT INTO medication (id, name, created_at, updated_at) VALUES ('m', 'Pen', ?, ?)").run(now, now);
    db.prepare(
      "INSERT INTO plan_step (id, medication_id, start_date, dose_mcg, created_at, updated_at) VALUES ('p', 'm', '2026-10-01', 250, ?, ?)",
    ).run(now, now);
    db.prepare(
      "INSERT INTO injection (id, medication_id, taken_at, local_date, dose_mcg, created_at, updated_at) VALUES ('i', 'm', ?, '2026-10-18', 250, ?, ?)",
    ).run(now, now, now);
    db.prepare(
      "INSERT INTO side_effect (id, local_date, type, severity, injection_id, created_at, updated_at) VALUES ('s', '2026-10-18', 'nausea', 1, 'i', ?, ?)",
    ).run(now, now);

    for (const table of ALL_TABLES_DELETE_ORDER) db.exec(`DELETE FROM "${getTableName(table)}"`);

    for (const table of ALL_TABLES_DELETE_ORDER) {
      expect(db.prepare(`SELECT count(*) AS n FROM "${getTableName(table)}"`).get()).toEqual({ n: 0 });
    }
  });
});

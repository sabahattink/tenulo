/// <reference types="node" />
/**
 * Runs the generated migrations, through Drizzle's own migrator as the app does at start, against
 * a real SQLite database (Node's built-in node:sqlite) and checks that the constraints reject what
 * the app must never store.
 */
import type { DatabaseSync } from "node:sqlite";
import { getTableName } from "drizzle-orm";
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { beforeEach, describe, expect, it } from "vitest";
import { ALL_TABLES_DELETE_ORDER } from "./tables";
import { count, migrationBundle, migrationSql, testDb, upgrade } from "./test-db";

const now = 1_792_300_000_000;
let db: DatabaseSync;

beforeEach(async () => {
  db = (await testDb()).sqlite;
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

  it("rejects malformed dates on injections, side effects and plan steps, on insert and on update", () => {
    db.prepare("INSERT INTO medication (id, name, created_at, updated_at) VALUES ('m', 'Pen', ?, ?)").run(now, now);
    const rows = {
      injection: (date: string) =>
        db
          .prepare(
            "INSERT INTO injection (id, medication_id, taken_at, local_date, dose_mcg, created_at, updated_at) VALUES (?, 'm', ?, ?, 250, ?, ?)",
          )
          .run(`i-${date}`, now, date, now, now),
      side_effect: (date: string) =>
        db
          .prepare(
            "INSERT INTO side_effect (id, local_date, type, severity, created_at, updated_at) VALUES (?, ?, 'nausea', 1, ?, ?)",
          )
          .run(`s-${date}`, date, now, now),
      plan_step: (date: string) =>
        db
          .prepare(
            "INSERT INTO plan_step (id, medication_id, start_date, dose_mcg, created_at, updated_at) VALUES (?, 'm', ?, 250, ?, ?)",
          )
          .run(`p-${date}`, date, now, now),
    };
    const column = { injection: "local_date", side_effect: "local_date", plan_step: "start_date" } as const;

    for (const [table, insert] of Object.entries(rows) as [keyof typeof rows, (d: string) => unknown][]) {
      insert("2026-10-18");
      for (const bad of ["18.10.2026", "2026-1-8", "", "2026-10-18T09:00"]) {
        expect(() => insert(bad), `${table} insert ${bad}`).toThrow(/CHECK/);
      }
      expect(() => db.prepare(`UPDATE ${table} SET ${column[table]} = '10/18/2026'`).run(), `${table} update`).toThrow(
        /CHECK/,
      );
      expect(db.prepare(`SELECT ${column[table]} AS d FROM ${table}`).all(), table).toEqual([{ d: "2026-10-18" }]);
    }
  });

  it("guards the daily log: meals, food sources, amounts, sites, kinds and dates", () => {
    const food = (values: Record<string, string | number | null>) => {
      const row: Record<string, string | number | null> = {
        id: "f",
        local_date: "2026-11-16",
        logged_at: now,
        meal: "lunch",
        catalog_food_id: "egg-boiled",
        custom_food_id: null,
        name: "Yumurta",
        portion_label: "1 adet",
        quantity_milli: 2000,
        grams: 100,
        energy_kcal: 155,
        protein_mg: 12_600,
        created_at: now,
        updated_at: now,
        ...values,
      };
      const cols = Object.keys(row);
      db.prepare(`INSERT INTO food_entry (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`).run(...Object.values(row));
    };
    expect(() => food({})).not.toThrow();
    expect(() => food({ id: "f2", meal: "brunch" })).toThrow(/CHECK/);
    expect(() => food({ id: "f3", local_date: "16.11.2026" })).toThrow(/CHECK/);
    expect(() => food({ id: "f4", quantity_milli: 0 })).toThrow(/CHECK/);
    expect(() => food({ id: "f5", protein_mg: -1 })).toThrow(/CHECK/);
    expect(() => food({ id: "f6", name: "  " })).toThrow(/CHECK/);
    db.prepare("INSERT INTO custom_food (id, name, serving_label, energy_kcal, created_at, updated_at) VALUES ('c', 'Mantı', '1 tabak', 450, ?, ?)").run(now, now);
    expect(() => food({ id: "f7", custom_food_id: "c" })).toThrow(/CHECK/);
    expect(() => food({ id: "f8", catalog_food_id: null, custom_food_id: "c" })).not.toThrow();
    db.prepare("DELETE FROM custom_food WHERE id = 'c'").run();
    expect(db.prepare("SELECT custom_food_id, energy_kcal FROM food_entry WHERE id = 'f8'").get()).toEqual({ custom_food_id: null, energy_kcal: 155 });

    const insert = (table: string, row: Record<string, string | number>) => {
      const cols = Object.keys(row);
      db.prepare(`INSERT INTO ${table} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`).run(...Object.values(row));
    };
    const stamps = { created_at: now, updated_at: now };
    expect(() => insert("water_entry", { id: "w", local_date: "2026-11-16", logged_at: now, amount_ml: 250, ...stamps })).not.toThrow();
    expect(() => insert("water_entry", { id: "w2", local_date: "2026-11-16", logged_at: now, amount_ml: 0, ...stamps })).toThrow(/CHECK/);
    const measure = { local_date: "2026-11-16", measured_at: now, site: "waist", length_mm: 925, ...stamps };
    expect(() => insert("measurement_entry", { id: "m", ...measure })).not.toThrow();
    expect(() => insert("measurement_entry", { id: "m2", ...measure, site: "ankle" })).toThrow(/CHECK/);
    expect(() => insert("measurement_entry", { id: "m3", ...measure, length_mm: 50 })).toThrow(/CHECK/);
    const exercise = { local_date: "2026-11-16", logged_at: now, kind: "walking", duration_min: 30, intensity: "moderate", ...stamps };
    expect(() => insert("exercise_entry", { id: "e", ...exercise })).not.toThrow();
    expect(() => insert("exercise_entry", { id: "e2", ...exercise, kind: "chess" })).toThrow(/CHECK/);
    expect(() => insert("exercise_entry", { id: "e3", ...exercise, duration_min: 0 })).toThrow(/CHECK/);
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

describe("upgrades", () => {
  it("keeps a 0.1 user's settings and weights when adding Health Connect settings", async () => {
    const old = await testDb(":memory:", 0);
    old.sqlite.prepare("INSERT INTO settings (id, weight_unit, goal_weight_g, updated_at) VALUES (1, 'lb', 75000, ?)").run(now);
    old.sqlite
      .prepare(
        "INSERT INTO weight_entry (id, measured_at, local_date, weight_g, source, created_at, updated_at) VALUES ('w', ?, '2026-10-18', 82400, 'manual', ?, ?)",
      )
      .run(now, now, now);

    await upgrade(old);

    expect(
      old.sqlite.prepare("SELECT weight_unit, goal_weight_g, health_connect_enabled, health_connect_synced_at FROM settings").get(),
    ).toEqual({
      weight_unit: "lb",
      goal_weight_g: 75000,
      health_connect_enabled: 0,
      health_connect_synced_at: null,
    });
    expect(old.sqlite.prepare("SELECT count(*) AS n FROM weight_entry").get()).toEqual({ n: 1 });
  });

  it("does not show the welcome screens to someone already using Tenulo", async () => {
    const old = await testDb(":memory:", 1);
    old.sqlite.prepare("INSERT INTO settings (id, updated_at) VALUES (1, ?)").run(now);

    await upgrade(old);

    expect(old.sqlite.prepare("SELECT welcomed_at FROM settings").get()).toEqual({ welcomed_at: now });
  });

  it("adds the date checks to an existing log without touching its rows or their links", async () => {
    const old = await testDb(":memory:", 2);
    old.sqlite.exec(`
      INSERT INTO medication (id, name, created_at, updated_at) VALUES ('m', 'Pen', ${now}, ${now});
      INSERT INTO plan_step (id, medication_id, start_date, dose_mcg, created_at, updated_at) VALUES ('p', 'm', '2026-10-01', 250, ${now}, ${now});
      INSERT INTO injection (id, medication_id, taken_at, local_date, dose_mcg, created_at, updated_at) VALUES ('i', 'm', ${now}, '2026-10-18', 250, ${now}, ${now});
      INSERT INTO side_effect (id, local_date, type, severity, injection_id, created_at, updated_at) VALUES ('s', '2026-10-18', 'nausea', 1, 'i', ${now}, ${now});
    `);

    await upgrade(old);

    expect(old.sqlite.prepare("SELECT id, injection_id FROM side_effect").all()).toEqual([{ id: "s", injection_id: "i" }]);
    expect(old.sqlite.prepare("SELECT count(*) AS n FROM plan_step").get()).toEqual({ n: 1 });
    expect(() => old.sqlite.prepare("UPDATE injection SET local_date = '18.10.2026'").run()).toThrow(/CHECK/);
  });

  it("adds the daily log and the goal settings to a 1.0 phone without touching its settings or links", async () => {
    const old = await testDb(":memory:", 3);
    old.sqlite.exec(`
      INSERT INTO settings (id, weight_unit, goal_weight_g, weigh_in_reminder_enabled, welcomed_at, updated_at)
        VALUES (1, 'lb', 80000, 1, ${now}, ${now});
      INSERT INTO medication (id, name, created_at, updated_at) VALUES ('m', 'Pen', ${now}, ${now});
      INSERT INTO injection (id, medication_id, taken_at, local_date, dose_mcg, created_at, updated_at) VALUES ('i', 'm', ${now}, '2026-10-18', 250, ${now}, ${now});
      INSERT INTO side_effect (id, local_date, type, severity, injection_id, created_at, updated_at) VALUES ('s', '2026-10-18', 'nausea', 1, 'i', ${now}, ${now});
    `);

    await upgrade(old);

    expect(old.sqlite.prepare("SELECT weight_unit, goal_weight_g, weigh_in_reminder_enabled, welcomed_at, language, energy_goal_kcal, water_serving_ml FROM settings").get()).toEqual({
      weight_unit: "lb",
      goal_weight_g: 80000,
      weigh_in_reminder_enabled: 1,
      welcomed_at: now,
      language: "system",
      energy_goal_kcal: null,
      water_serving_ml: 250,
    });
    expect(old.sqlite.prepare("SELECT injection_id FROM side_effect").get()).toEqual({ injection_id: "i" });
    expect(() => old.sqlite.prepare("UPDATE settings SET energy_goal_kcal = 100").run()).toThrow(/CHECK/);
    for (const table of ["food_entry", "custom_food", "water_entry", "measurement_entry", "exercise_entry"]) {
      expect(count(old.sqlite, table)).toBe(0);
    }
  });

  it("shows them on a fresh install", () => {
    db.prepare("INSERT INTO settings (id, updated_at) VALUES (1, ?)").run(now);
    expect(db.prepare("SELECT welcomed_at FROM settings").get()).toEqual({ welcomed_at: null });
  });
});

describe("migrations on the phone", () => {
  /** Tables other tables point at with a foreign key. */
  const referenced = [
    ...new Set(
      ALL_TABLES_DELETE_ORDER.flatMap((t) =>
        getTableConfig(t).foreignKeys.map((fk) => getTableName(fk.reference().foreignTable)),
      ),
    ),
  ];

  it("run in one transaction, where PRAGMA foreign_keys=OFF does nothing", async () => {
    // The shape drizzle-kit generates to change a table's constraints in SQLite.
    const rebuild = [
      "PRAGMA foreign_keys=OFF;",
      "CREATE TABLE `__new_injection` AS SELECT * FROM `injection`;",
      "DROP TABLE `injection`;",
      "ALTER TABLE `__new_injection` RENAME TO `injection`;",
      "PRAGMA foreign_keys=ON;",
    ].join("--> statement-breakpoint\n");
    const t = await testDb();
    t.sqlite.exec(`
      INSERT INTO medication (id, name, created_at, updated_at) VALUES ('m', 'Pen', ${now}, ${now});
      INSERT INTO injection (id, medication_id, taken_at, local_date, dose_mcg, created_at, updated_at) VALUES ('i', 'm', ${now}, '2026-10-18', 250, ${now}, ${now});
      INSERT INTO side_effect (id, local_date, type, severity, injection_id, created_at, updated_at) VALUES ('s', '2026-10-18', 'nausea', 1, 'i', ${now}, ${now});
    `);
    const bundle = migrationBundle();
    const last = bundle.journal.entries.at(-1);
    if (last === undefined) throw new Error("No migrations");
    const next = { idx: last.idx + 1, when: last.when + 1, tag: "rebuild", breakpoints: true };

    await migrate(t.database, {
      journal: { entries: [...bundle.journal.entries, next] },
      migrations: { ...bundle.migrations, [`m${String(next.idx).padStart(4, "0")}`]: rebuild },
    });

    // Dropping the parent ran its ON DELETE SET NULL: the side effect lost its injection. If this
    // ever keeps the link, Drizzle stopped wrapping migrations in a transaction.
    expect(t.sqlite.prepare("SELECT injection_id FROM side_effect").get()).toEqual({ injection_id: null });
  });

  it("never drop a table that others reference, so a migration cannot clear or break their rows", () => {
    // Change such a table with a new table plus copy, or with triggers, never a drop-and-rename.
    expect([...referenced].sort()).toEqual(["custom_food", "injection", "medication"]);
    const drops = migrationSql().flatMap(({ tag, sql }) =>
      referenced.filter((name) => new RegExp(`DROP TABLE\\s+[\`"]?${name}[\`"]?\\s*;`, "i").test(sql)).map((name) => `${tag}: ${name}`),
    );
    expect(drops).toEqual([]);
  });
});

/// <reference types="node" />
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type BackupData, createBackup, parseBackup, serializeBackup } from "../domain/backup";
import { parseLocalDate as d } from "../domain/date";
import { ulid } from "../domain/id";
import {
  createMedicationWithPlan,
  insertImportedWeights,
  purgeDeletedData,
  readBackupData,
  restoreData,
  wipeAll,
} from "./ops";
import { ALL_TABLES_DELETE_ORDER } from "./tables";
import { eq, getTableName } from "drizzle-orm";
import { medications, weightEntries } from "./schema";
import { type TestDb, count, testDb } from "./test-db";

const now = 1_792_300_000_000;
const id = (n: number) => ulid(now + n, () => 0.5);
let t: TestDb;

beforeEach(async () => {
  t = await testDb();
  t.sqlite.prepare("INSERT INTO settings (id, updated_at) VALUES (1, ?)").run(now);
});

const failOn = (table: string, event: "INSERT" | "DELETE") =>
  t.sqlite.exec(`CREATE TRIGGER fail_${table} BEFORE ${event} ON "${table}" BEGIN SELECT RAISE(ABORT, 'boom'); END`);

function seedLinkedRows(): void {
  t.sqlite.exec(`
    INSERT INTO weight_entry (id, measured_at, local_date, weight_g, source, created_at, updated_at) VALUES ('w', ${now}, '2026-10-18', 82400, 'manual', ${now}, ${now});
    INSERT INTO medication (id, name, created_at, updated_at) VALUES ('m', 'Pen', ${now}, ${now});
    INSERT INTO plan_step (id, medication_id, start_date, dose_mcg, created_at, updated_at) VALUES ('p', 'm', '2026-10-01', 250, ${now}, ${now});
    INSERT INTO injection (id, medication_id, taken_at, local_date, dose_mcg, created_at, updated_at) VALUES ('i', 'm', ${now}, '2026-10-18', 250, ${now}, ${now});
    INSERT INTO side_effect (id, local_date, type, severity, injection_id, created_at, updated_at) VALUES ('s', '2026-10-18', 'nausea', 1, 'i', ${now}, ${now});
    INSERT INTO custom_food (id, name, serving_label, energy_kcal, created_at, updated_at) VALUES ('c', 'Mantı', '1 tabak', 450, ${now}, ${now});
    INSERT INTO food_entry (id, local_date, logged_at, meal, custom_food_id, name, portion_label, quantity_milli, energy_kcal, created_at, updated_at) VALUES ('f', '2026-10-18', ${now}, 'dinner', 'c', 'Mantı', '1 tabak', 1000, 450, ${now}, ${now});
    INSERT INTO water_entry (id, local_date, logged_at, amount_ml, created_at, updated_at) VALUES ('wa', '2026-10-18', ${now}, 250, ${now}, ${now});
    INSERT INTO measurement_entry (id, local_date, measured_at, site, length_mm, created_at, updated_at) VALUES ('me', '2026-10-18', ${now}, 'waist', 925, ${now}, ${now});
    INSERT INTO exercise_entry (id, local_date, logged_at, kind, duration_min, intensity, created_at, updated_at) VALUES ('e', '2026-10-18', ${now}, 'walking', 30, 'moderate', ${now}, ${now});
  `);
}

describe("wipeAll", () => {
  it("empties every table and leaves one fresh settings row, so the welcome screens show again", () => {
    seedLinkedRows();
    t.sqlite.exec(`UPDATE settings SET weight_unit = 'lb', goal_weight_g = 70000, welcomed_at = ${now}`);
    wipeAll(t.database, now);
    for (const table of ALL_TABLES_DELETE_ORDER) {
      const name = getTableName(table);
      expect(count(t.sqlite, name), name).toBe(name === "settings" ? 1 : 0);
    }
    expect(t.sqlite.prepare("SELECT weight_unit, goal_weight_g, welcomed_at FROM settings").get()).toEqual({
      weight_unit: "kg",
      goal_weight_g: null,
      welcomed_at: null,
    });
  });

  it("deletes with a WHERE clause, so live queries hear about every table", () => {
    // A bare `DELETE FROM t` on a table without triggers or foreign keys takes SQLite's truncate
    // optimization, which skips the update hook. expo-sqlite's change listener, and so every
    // useLiveQuery, is built on that hook: History kept showing weigh-ins after "Delete all data".
    t.statements.length = 0;
    wipeAll(t.database, now);
    const deletes = t.statements.filter((s) => /^\s*delete\b/i.test(s));
    expect(deletes).toHaveLength(ALL_TABLES_DELETE_ORDER.length);
    for (const s of deletes) expect(s).toMatch(/\bwhere\b/i);
  });

  it("is all or nothing: a failure part-way deletes nothing", () => {
    seedLinkedRows();
    failOn("weight_entry", "DELETE");
    expect(() => wipeAll(t.database, now)).toThrow(/boom/);
    for (const table of ["side_effect", "injection", "plan_step", "medication", "weight_entry", "settings"]) {
      expect(count(t.sqlite, table), table).toBe(1);
    }
  });
});

describe("deleted records leave no bytes in the database files (secure_delete, purgeDeletedData)", () => {
  /** Text that appears only in the records below, so finding its bytes means a record survived. */
  const MARKER = "tenulo-erase-check-7f3a";
  let dir: string;
  let file: string;
  let disk: TestDb;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "tenulo-"));
    file = join(dir, "tenulo.db");
    disk = await testDb(file);
    disk.sqlite.prepare("INSERT INTO settings (id, updated_at) VALUES (1, ?)").run(now);
  });

  afterEach(() => {
    disk.sqlite.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const insertMarked = (key: string) =>
    disk.sqlite.exec(`
      INSERT INTO weight_entry (id, measured_at, local_date, weight_g, source, note, created_at, updated_at) VALUES ('w${key}', ${now}, '2026-10-18', 82400, 'manual', '${MARKER} weight', ${now}, ${now});
      INSERT INTO medication (id, name, created_at, updated_at) VALUES ('m${key}', '${MARKER}', ${now}, ${now});
      INSERT INTO injection (id, medication_id, taken_at, local_date, dose_mcg, note, created_at, updated_at) VALUES ('i${key}', 'm${key}', ${now}, '2026-10-18', 250, '${MARKER} shot', ${now}, ${now});
      INSERT INTO side_effect (id, local_date, type, severity, injection_id, note, created_at, updated_at) VALUES ('s${key}', '2026-10-18', 'nausea', 1, 'i${key}', '${MARKER} effect', ${now}, ${now});
    `);
  const filesHoldingMarker = (text = MARKER) =>
    [file, `${file}-wal`].filter((f) => existsSync(f) && readFileSync(f).includes(text));

  it("overwrites a single deleted entry in the database file, not only unlinks it", () => {
    insertMarked("1");
    disk.sqlite.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    expect(filesHoldingMarker(`${MARKER} weight`)).toEqual([file]);

    disk.database.delete(weightEntries).where(eq(weightEntries.id, "w1")).run();
    disk.sqlite.exec("PRAGMA wal_checkpoint(TRUNCATE)");

    expect(filesHoldingMarker(`${MARKER} weight`)).toEqual([]);
    expect(filesHoldingMarker(`${MARKER} shot`)).toEqual([file]);
  });

  it("leaves no byte of a deleted record in the database file or its write-ahead log", () => {
    insertMarked("1");
    // Older records live in the database file itself, recent ones only in the WAL: cover both.
    disk.sqlite.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    insertMarked("2");
    expect(filesHoldingMarker()).toEqual([file, `${file}-wal`]);

    wipeAll(disk.database, now);
    purgeDeletedData(disk.database);

    expect(filesHoldingMarker()).toEqual([]);
  });

  it("is never blocked by app code that leaves a query half-read", () => {
    // On the phone a statement stepped but not run to its end stays open (Drizzle's expo driver
    // never finalizes), and an open statement makes VACUUM fail and the checkpoint stay busy. The
    // tests run node:sqlite, which reads to the end, so they would not notice: forbid the reads.
    const halfReads = /\.get(<[^>]*>)?\(\s*sql\b|\bget(First|Each)(Sync|Async)\b|\bgenerator(Sync|Async)\b/;
    const src = join(__dirname, "..");
    const offenders = readdirSync(src, { recursive: true, encoding: "utf8" })
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.ts$|test-db\.ts$/.test(f))
      .filter((f) => halfReads.test(readFileSync(join(src, f), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("fails loudly when the write-ahead log cannot be emptied", () => {
    insertMarked("1");
    wipeAll(disk.database, now);
    // A second connection in the middle of a read pins the old log, so it cannot be truncated.
    const reader = new DatabaseSync(file);
    try {
      reader.exec("BEGIN");
      reader.prepare("SELECT count(*) FROM settings").get();
      expect(() => purgeDeletedData(disk.database)).toThrow(/write-ahead log/);
    } finally {
      reader.close();
    }
  });
});

describe("createMedicationWithPlan", () => {
  it("creates the medication and its first plan step", () => {
    const medId = createMedicationWithPlan(t.database, { name: " Pen ", doseMcg: 250, intervalDays: 7, startDate: d("2026-10-01") }, now);
    expect(t.sqlite.prepare("SELECT name, active FROM medication WHERE id = ?").get(medId)).toEqual({ name: "Pen", active: 1 });
    expect(count(t.sqlite, "plan_step")).toBe(1);
  });

  it("leaves no medication behind when the plan step is rejected", () => {
    expect(() =>
      createMedicationWithPlan(t.database, { name: "Pen", doseMcg: 250, intervalDays: 0, startDate: d("2026-10-01") }, now),
    ).toThrow();
    expect(count(t.sqlite, "medication")).toBe(0);
  });
});

const backup = (): BackupData => ({
  settings: {
    weightUnit: "lb",
    goalWeightG: 75_000,
    injectionReminderEnabled: true,
    injectionReminderMinute: 540,
    weighInReminderEnabled: true,
    weighInReminderMinute: 450,
    language: "tr",
    energyGoalKcal: 1700,
    proteinGoalG: 100,
    waterGoalMl: 2000,
    waterServingMl: 330,
  },
  weights: [0, 1, 2].map((i) => ({
    id: id(10 + i),
    measuredAt: now,
    localDate: d(`2026-10-1${i}`),
    weightG: 90_000 - i * 100,
    source: "manual" as const,
    healthConnectId: null,
    note: null,
    createdAt: now,
    updatedAt: now,
  })),
  medications: [{ id: id(1), name: "Backup pen", active: true, createdAt: now - 1, updatedAt: now }],
  planSteps: [{ id: id(2), medicationId: id(1), startDate: d("2026-10-01"), doseMcg: 250, intervalDays: 7, createdAt: now, updatedAt: now }],
  injections: [
    { id: id(3), medicationId: id(1), takenAt: now, localDate: d("2026-10-08"), doseMcg: 250, site: "arm-left", note: null, createdAt: now, updatedAt: now },
  ],
  sideEffects: [
    { id: id(4), localDate: d("2026-10-09"), type: "nausea", severity: 2, injectionId: id(3), note: null, createdAt: now, updatedAt: now },
  ],
  customFoods: [
    {
      id: id(5),
      name: "Mantı",
      servingLabel: "1 tabak",
      servingGrams: 300,
      energyKcal: 450,
      proteinMg: 20_000,
      carbMg: null,
      fatMg: null,
      fiberMg: null,
      createdAt: now,
      updatedAt: now,
    },
  ],
  foodEntries: [
    {
      id: id(6),
      localDate: d("2026-10-09"),
      loggedAt: now,
      meal: "dinner",
      catalogFoodId: null,
      customFoodId: id(5),
      name: "Mantı",
      portionId: null,
      portionLabel: "1 tabak",
      quantityMilli: 1000,
      grams: 300,
      energyKcal: 450,
      proteinMg: 20_000,
      carbMg: null,
      fatMg: null,
      fiberMg: null,
      createdAt: now,
      updatedAt: now,
    },
  ],
  waterEntries: [{ id: id(7), localDate: d("2026-10-09"), loggedAt: now, amountMl: 330, createdAt: now, updatedAt: now }],
  measurements: [
    { id: id(8), localDate: d("2026-10-09"), measuredAt: now, site: "waist", lengthMm: 950, note: null, createdAt: now, updatedAt: now },
  ],
  exercises: [
    {
      id: id(9),
      localDate: d("2026-10-09"),
      loggedAt: now,
      kind: "walking",
      durationMin: 45,
      intensity: "moderate",
      energyKcal: 210,
      note: null,
      createdAt: now,
      updatedAt: now,
    },
  ],
});

/** What restoring backup() into an empty phone adds. */
const ALL_ADDED = {
  weights: 3,
  injections: 1,
  sideEffects: 1,
  medications: 1,
  planSteps: 1,
  inactiveMedications: 0,
  customFoods: 1,
  foodEntries: 1,
  waterEntries: 1,
  measurements: 1,
  exercises: 1,
};
const NONE_ADDED = Object.fromEntries(Object.keys(ALL_ADDED).map((k) => [k, 0]));

describe("restoreData", () => {
  it("adds everything to an empty phone and adopts its unit, goals and language", () => {
    const summary = restoreData(t.database, backup(), now);
    expect(summary).toEqual(ALL_ADDED);
    expect(
      t.sqlite
        .prepare(
          "SELECT weight_unit, goal_weight_g, injection_reminder_enabled, language, energy_goal_kcal, protein_goal_g, water_goal_ml, water_serving_ml FROM settings",
        )
        .get(),
    ).toEqual({
      weight_unit: "lb",
      goal_weight_g: 75000,
      injection_reminder_enabled: 0,
      language: "tr",
      energy_goal_kcal: 1700,
      protein_goal_g: 100,
      water_goal_ml: 2000,
      water_serving_ml: 330,
    });
    expect(t.sqlite.prepare("SELECT custom_food_id FROM food_entry").get()).toEqual({ custom_food_id: id(5) });
  });

  it("treats a phone with only a food diary as one already in use: its settings stay", () => {
    t.sqlite.exec(
      `INSERT INTO water_entry (id, local_date, logged_at, amount_ml, created_at, updated_at) VALUES ('${id(60)}', '2026-11-01', ${now}, 250, ${now}, ${now})`,
    );
    restoreData(t.database, backup(), now);
    expect(t.sqlite.prepare("SELECT weight_unit, energy_goal_kcal FROM settings").get()).toEqual({ weight_unit: "kg", energy_goal_kcal: null });
  });

  it("is idempotent and never overwrites what is already on the phone", () => {
    restoreData(t.database, backup(), now);
    t.sqlite.prepare("UPDATE weight_entry SET weight_g = 70000 WHERE id = ?").run(id(10));
    t.sqlite.exec("UPDATE settings SET weight_unit = 'kg'");
    const again = restoreData(t.database, backup(), now);
    expect(again).toEqual(NONE_ADDED);
    expect(t.sqlite.prepare("SELECT weight_g FROM weight_entry WHERE id = ?").get(id(10))).toEqual({ weight_g: 70000 });
    expect(t.sqlite.prepare("SELECT weight_unit FROM settings").get()).toEqual({ weight_unit: "kg" });
  });

  it("keeps the phone's medication active and adds a different one from the backup as inactive", () => {
    t.sqlite.exec(`INSERT INTO medication (id, name, active, created_at, updated_at) VALUES ('${id(50)}', 'Phone pen', 1, ${now}, ${now})`);
    const summary = restoreData(t.database, backup(), now);
    expect(summary.inactiveMedications).toBe(1);
    expect(t.sqlite.prepare("SELECT name FROM medication WHERE active = 1").all()).toEqual([{ name: "Phone pen" }]);
  });

  it("counts as inactive only the medications it actually added", () => {
    // The phone has its own pen and, from an earlier restore, the backup's pen as inactive.
    t.sqlite.exec(`
      INSERT INTO medication (id, name, active, created_at, updated_at) VALUES ('${id(50)}', 'Phone pen', 1, ${now}, ${now});
      INSERT INTO medication (id, name, active, created_at, updated_at) VALUES ('${id(1)}', 'Backup pen', 0, ${now}, ${now});
    `);
    const data = backup();
    const withSecond = {
      ...data,
      medications: [...data.medications, { id: id(60), name: "Second pen", active: true, createdAt: now, updatedAt: now }],
    };
    const summary = restoreData(t.database, withSecond, now);
    expect(summary.medications).toBe(1);
    expect(summary.inactiveMedications).toBe(1);
  });

  it("keeps one current medication when a backup has several active: the oldest, which the app shows", () => {
    const data = backup();
    const several = {
      ...data,
      medications: [{ id: id(61), name: "Newer pen", active: true, createdAt: now, updatedAt: now }, ...data.medications],
    };
    const summary = restoreData(t.database, several, now);
    expect(t.sqlite.prepare("SELECT name FROM medication WHERE active = 1").all()).toEqual([{ name: "Backup pen" }]);
    expect(summary.inactiveMedications).toBe(1);
  });

  it("is all or nothing: a failure part-way adds nothing", () => {
    failOn("weight_entry", "INSERT");
    expect(() => restoreData(t.database, backup(), now)).toThrow(/boom/);
    for (const table of ["medication", "plan_step", "injection", "side_effect", "weight_entry"]) {
      expect(count(t.sqlite, table), table).toBe(0);
    }
    expect(t.sqlite.prepare("SELECT weight_unit FROM settings").get()).toEqual({ weight_unit: "kg" });
  });

  it("restores in chunks larger backups than one statement may bind", () => {
    const big = backup();
    const many = Array.from({ length: 1_500 }, (_, i) => ({
      ...big.weights[0]!,
      id: id(1_000 + i),
      localDate: d("2026-01-01"),
    }));
    expect(restoreData(t.database, { ...big, weights: many }, now).weights).toBe(1_500);
  });
});

describe("readBackupData", () => {
  it("reads every table inside one transaction, so a backup never mixes two moments", () => {
    restoreData(t.database, backup(), now);
    t.statements.length = 0;
    readBackupData(t.database);
    expect(t.statements[0]).toMatch(/^begin/i);
    expect(t.statements.at(-1)).toMatch(/^commit/i);
    expect(t.statements.filter((s) => /^\s*select/i.test(s))).toHaveLength(ALL_TABLES_DELETE_ORDER.length);
  });

  it("makes a file that passes the backup checks and restores to the same records", async () => {
    restoreData(t.database, backup(), now);
    const data = readBackupData(t.database);

    const parsed = parseBackup(serializeBackup(createBackup(data, now, "test")));
    if (!parsed.ok) throw new Error(`Backup rejected: ${JSON.stringify(parsed)}`);
    const other = await testDb();
    other.sqlite.prepare("INSERT INTO settings (id, updated_at) VALUES (1, ?)").run(now);
    restoreData(other.database, parsed.backup.data, now);

    expect(readBackupData(other.database)).toEqual(data);
  });
});

describe("insertImportedWeights", () => {
  const w = (hc: string) => ({ healthConnectId: hc, measuredAt: now, localDate: "2026-10-20", weightG: 88_000 });

  it("adds new readings once and moves the sync cursor in the same transaction", () => {
    expect(insertImportedWeights(t.database, [w("a"), w("b")], now + 5, now)).toBe(2);
    expect(insertImportedWeights(t.database, [w("a"), w("c")], now + 9, now)).toBe(1);
    expect(t.sqlite.prepare("SELECT health_connect_synced_at AS s FROM settings").get()).toEqual({ s: now + 9 });
    expect(count(t.sqlite, "weight_entry")).toBe(3);
  });

  it("does not move the cursor when the insert fails", () => {
    failOn("weight_entry", "INSERT");
    expect(() => insertImportedWeights(t.database, [w("a")], now + 5, now)).toThrow(/boom/);
    expect(t.sqlite.prepare("SELECT health_connect_synced_at AS s FROM settings").get()).toEqual({ s: null });
  });
});

describe("the driver's transaction trap", () => {
  it("commits an async callback at its first await: why ops.ts is synchronous", async () => {
    await t.database
      .transaction(async (tx) => {
        await tx.insert(medications).values({ id: "a", name: "A", createdAt: now, updatedAt: now });
        await tx.insert(medications).values({ id: "b", name: "   ", createdAt: now, updatedAt: now });
      })
      .catch(() => undefined);
    // With a real transaction this would be 0. If Drizzle ever awaits async callbacks, this
    // fails, and the synchronous style in ops.ts can be revisited.
    expect(count(t.sqlite, "medication")).toBe(1);
  });
});

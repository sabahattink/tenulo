import { beforeEach, describe, expect, it } from "vitest";
import type { BackupData } from "../domain/backup";
import { parseLocalDate as d } from "../domain/date";
import { ulid } from "../domain/id";
import { createMedicationWithPlan, insertImportedWeights, restoreData, wipeAll } from "./ops";
import { ALL_TABLES_DELETE_ORDER } from "./tables";
import { getTableName } from "drizzle-orm";
import { medications } from "./schema";
import { count, testDb } from "./test-db";

const now = 1_792_300_000_000;
const id = (n: number) => ulid(now + n, () => 0.5);
let t: ReturnType<typeof testDb>;

beforeEach(() => {
  t = testDb();
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
});

describe("restoreData", () => {
  it("adds everything to an empty phone and adopts its unit and goal", () => {
    const summary = restoreData(t.database, backup(), now);
    expect(summary).toEqual({ weights: 3, injections: 1, sideEffects: 1, medications: 1, planSteps: 1, inactiveMedications: 0 });
    expect(t.sqlite.prepare("SELECT weight_unit, goal_weight_g, injection_reminder_enabled FROM settings").get()).toEqual({
      weight_unit: "lb",
      goal_weight_g: 75000,
      injection_reminder_enabled: 0,
    });
  });

  it("is idempotent and never overwrites what is already on the phone", () => {
    restoreData(t.database, backup(), now);
    t.sqlite.prepare("UPDATE weight_entry SET weight_g = 70000 WHERE id = ?").run(id(10));
    t.sqlite.exec("UPDATE settings SET weight_unit = 'kg'");
    const again = restoreData(t.database, backup(), now);
    expect(again).toEqual({ weights: 0, injections: 0, sideEffects: 0, medications: 0, planSteps: 0, inactiveMedications: 0 });
    expect(t.sqlite.prepare("SELECT weight_g FROM weight_entry WHERE id = ?").get(id(10))).toEqual({ weight_g: 70000 });
    expect(t.sqlite.prepare("SELECT weight_unit FROM settings").get()).toEqual({ weight_unit: "kg" });
  });

  it("keeps the phone's medication active and adds a different one from the backup as inactive", () => {
    t.sqlite.exec(`INSERT INTO medication (id, name, active, created_at, updated_at) VALUES ('${id(50)}', 'Phone pen', 1, ${now}, ${now})`);
    const summary = restoreData(t.database, backup(), now);
    expect(summary.inactiveMedications).toBe(1);
    expect(t.sqlite.prepare("SELECT name FROM medication WHERE active = 1").all()).toEqual([{ name: "Phone pen" }]);
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

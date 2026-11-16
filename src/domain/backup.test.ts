import { describe, expect, it } from "vitest";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type BackupData,
  MAX_BACKUP_BYTES,
  backupFileName,
  backupTooLarge,
  createBackup,
  parseBackup,
  serializeBackup,
} from "./backup";
import { parseLocalDate } from "./date";
import { ulid } from "./id";

const t = 1_792_300_000_000;
const id = (n: number) => ulid(t + n, () => 0.5);
const med = id(1);
const shot = id(2);
const myFood = id(7);

const data: BackupData = {
  settings: {
    weightUnit: "kg",
    goalWeightG: 80_000,
    injectionReminderEnabled: true,
    injectionReminderMinute: 540,
    weighInReminderEnabled: false,
    weighInReminderMinute: 450,
    language: "tr",
    energyGoalKcal: 1800,
    proteinGoalG: 110,
    waterGoalMl: 2500,
    waterServingMl: 300,
  },
  weights: [
    {
      id: id(3),
      measuredAt: t,
      localDate: parseLocalDate("2026-10-18"),
      weightG: 92_400,
      source: "manual",
      healthConnectId: null,
      note: "after a run",
      createdAt: t,
      updatedAt: t,
    },
    {
      id: id(4),
      measuredAt: t,
      localDate: parseLocalDate("2026-10-19"),
      weightG: 92_100,
      source: "health_connect",
      healthConnectId: "hc-abc",
      note: null,
      createdAt: t,
      updatedAt: t,
    },
  ],
  medications: [{ id: med, name: "My pen", active: true, createdAt: t, updatedAt: t }],
  planSteps: [
    { id: id(5), medicationId: med, startDate: parseLocalDate("2026-10-01"), doseMcg: 250, intervalDays: 7, createdAt: t, updatedAt: t },
  ],
  injections: [
    {
      id: shot,
      medicationId: med,
      takenAt: t,
      localDate: parseLocalDate("2026-10-12"),
      doseMcg: 250,
      site: "thigh-left",
      note: null,
      createdAt: t,
      updatedAt: t,
    },
  ],
  sideEffects: [
    {
      id: id(6),
      localDate: parseLocalDate("2026-10-13"),
      type: "nausea",
      severity: 2,
      injectionId: shot,
      note: null,
      createdAt: t,
      updatedAt: t,
    },
  ],
  customFoods: [
    {
      id: myFood,
      name: "Annemin mantısı",
      servingLabel: "1 tabak",
      servingGrams: 300,
      energyKcal: 520,
      proteinMg: 24_000,
      carbMg: null,
      fatMg: null,
      fiberMg: null,
      createdAt: t,
      updatedAt: t,
    },
  ],
  foodEntries: [
    {
      id: id(8),
      localDate: parseLocalDate("2026-11-16"),
      loggedAt: t,
      meal: "breakfast",
      catalogFoodId: "egg-boiled",
      customFoodId: null,
      name: "Haşlanmış yumurta",
      portionLabel: "adet",
      quantityMilli: 2000,
      grams: 100,
      energyKcal: 155,
      proteinMg: 12_600,
      carbMg: 1_100,
      fatMg: 10_600,
      fiberMg: 0,
      createdAt: t,
      updatedAt: t,
    },
    {
      id: id(9),
      localDate: parseLocalDate("2026-11-16"),
      loggedAt: t,
      meal: "dinner",
      catalogFoodId: null,
      customFoodId: myFood,
      name: "Annemin mantısı",
      portionLabel: "1 tabak",
      quantityMilli: 1000,
      grams: 300,
      energyKcal: 520,
      proteinMg: 24_000,
      carbMg: null,
      fatMg: null,
      fiberMg: null,
      createdAt: t,
      updatedAt: t,
    },
  ],
  waterEntries: [{ id: id(10), localDate: parseLocalDate("2026-11-16"), loggedAt: t, amountMl: 300, createdAt: t, updatedAt: t }],
  measurements: [
    { id: id(11), localDate: parseLocalDate("2026-11-16"), measuredAt: t, site: "waist", lengthMm: 925, note: null, createdAt: t, updatedAt: t },
  ],
  exercises: [
    {
      id: id(12),
      localDate: parseLocalDate("2026-11-16"),
      loggedAt: t,
      kind: "strength",
      durationMin: 40,
      intensity: "moderate",
      energyKcal: null,
      note: "legs",
      createdAt: t,
      updatedAt: t,
    },
  ],
};

const roundTrip = (d: BackupData) => parseBackup(serializeBackup(createBackup(d, t, "0.1.0")));

/** Serializes `data` with one field replaced, to test the validator against hand-edited files. */
function tampered(mutate: (json: { data: Record<string, Record<string, unknown>[]> }) => void): string {
  const json = JSON.parse(serializeBackup(createBackup(data, t, "0.1.0"))) as {
    data: Record<string, Record<string, unknown>[]>;
  };
  mutate(json);
  return JSON.stringify(json);
}

describe("backup round trip", () => {
  it("restores exactly what was exported", () => {
    const r = roundTrip(data);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.backup.data).toEqual(data);
      expect(r.backup.format).toBe(BACKUP_FORMAT);
      expect(r.backup.version).toBe(BACKUP_VERSION);
      expect(r.backup.exportedAt).toBe(t);
    }
  });

  it("accepts an empty log", () => {
    const empty: BackupData = {
      settings: null,
      weights: [],
      medications: [],
      planSteps: [],
      injections: [],
      sideEffects: [],
      customFoods: [],
      foodEntries: [],
      waterEntries: [],
      measurements: [],
      exercises: [],
    };
    expect(roundTrip(empty).ok).toBe(true);
  });

  it("still reads a 1.0 backup, which has no daily log and no goals", () => {
    const v1 = JSON.parse(serializeBackup(createBackup(data, t, "1.0.0"))) as { version: number; data: Record<string, unknown> };
    v1.version = 1;
    for (const key of ["customFoods", "foodEntries", "waterEntries", "measurements", "exercises"]) delete v1.data[key];
    const settings = v1.data.settings as Record<string, unknown>;
    for (const key of ["language", "energyGoalKcal", "proteinGoalG", "waterGoalMl", "waterServingMl"]) delete settings[key];

    const r = parseBackup(JSON.stringify(v1));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.backup.data.foodEntries).toEqual([]);
    expect(r.backup.data.exercises).toEqual([]);
    expect(r.backup.data.weights).toEqual(data.weights);
    expect(r.backup.data.settings).toMatchObject({ language: "system", energyGoalKcal: null, waterServingMl: 250, weightUnit: "kg" });
  });

  it("names the file after the local date", () => {
    expect(backupFileName(parseLocalDate("2026-10-29"))).toBe("tenulo-backup-2026-10-29.json");
  });
});

describe("parseBackup rejects files it cannot trust", () => {
  it("explains non-JSON and foreign JSON", () => {
    expect(parseBackup("not json {")).toEqual({ ok: false, reason: "not-json" });
    expect(parseBackup(JSON.stringify({ hello: "world" }))).toEqual({ ok: false, reason: "not-a-backup" });
    expect(parseBackup("[]")).toEqual({ ok: false, reason: "not-a-backup" });
  });

  it("refuses a file far larger than any real backup, before reading it if its size is known", () => {
    expect(backupTooLarge(MAX_BACKUP_BYTES)).toBe(false);
    expect(backupTooLarge(MAX_BACKUP_BYTES + 1)).toBe(true);
    expect(backupTooLarge(null)).toBe(false);
    expect(parseBackup(" ".repeat(MAX_BACKUP_BYTES + 1))).toEqual({ ok: false, reason: "too-large" });
  });

  it("refuses a backup written by a newer Tenulo", () => {
    const newer = JSON.parse(serializeBackup(createBackup(data, t, "0.1.0"))) as Record<string, unknown>;
    newer.version = BACKUP_VERSION + 1;
    expect(parseBackup(JSON.stringify(newer))).toEqual({ ok: false, reason: "newer-version" });
  });

  it("rejects values the database would reject", () => {
    const cases: [string, (j: { data: Record<string, Record<string, unknown>[]> }) => void][] = [
      ["implausible weight", (j) => void (j.data.weights![0]!.weightG = 8_240)],
      ["float weight", (j) => void (j.data.weights![0]!.weightG = 82_400.5)],
      ["impossible date", (j) => void (j.data.weights![0]!.localDate = "2026-02-30")],
      ["unknown source", (j) => void (j.data.weights![0]!.source = "cloud")],
      ["manual reading with a Health Connect id", (j) => void (j.data.weights![0]!.healthConnectId = "x")],
      ["bad site", (j) => void (j.data.injections![0]!.site = "elbow")],
      ["zero dose", (j) => void (j.data.injections![0]!.doseMcg = 0)],
      ["severity 4", (j) => void (j.data.sideEffects![0]!.severity = 4)],
      ["unknown side effect", (j) => void (j.data.sideEffects![0]!.type = "euphoria")],
      ["blank medication name", (j) => void (j.data.medications![0]!.name = "   ")],
      ["interval of 0 days", (j) => void (j.data.planSteps![0]!.intervalDays = 0)],
      ["malformed id", (j) => void (j.data.weights![0]!.id = "1")],
      ["unknown meal", (j) => void (j.data.foodEntries![0]!.meal = "brunch")],
      ["food from both the list and a custom food", (j) => void (j.data.foodEntries![0]!.customFoodId = myFood)],
      ["malformed food list id", (j) => void (j.data.foodEntries![0]!.catalogFoodId = "Egg Boiled!")],
      ["negative protein", (j) => void (j.data.foodEntries![0]!.proteinMg = -1)],
      ["zero amount", (j) => void (j.data.foodEntries![0]!.quantityMilli = 0)],
      ["empty glass", (j) => void (j.data.waterEntries![0]!.amountMl = 0)],
      ["unknown measurement site", (j) => void (j.data.measurements![0]!.site = "ankle")],
      ["implausible length", (j) => void (j.data.measurements![0]!.lengthMm = 50)],
      ["unknown exercise", (j) => void (j.data.exercises![0]!.kind = "chess")],
      ["zero-minute exercise", (j) => void (j.data.exercises![0]!.durationMin = 0)],
      ["blank custom food", (j) => void (j.data.customFoods![0]!.name = " ")],
    ];
    for (const [label, mutate] of cases) {
      const r = parseBackup(tampered(mutate));
      expect(r.ok, label).toBe(false);
      if (!r.ok) expect(r.reason, label).toBe("invalid");
    }
  });

  it("says where a rejected value is", () => {
    const r = parseBackup(tampered((j) => void (j.data.weights![1]!.weightG = 8_240)));
    expect(r).toMatchObject({ ok: false, reason: "invalid", path: ["data", "weights", 1, "weightG"] });
    const food = parseBackup(tampered((j) => void (j.data.foodEntries![1]!.energyKcal = -5)));
    expect(food).toMatchObject({ ok: false, reason: "invalid", path: ["data", "foodEntries", 1, "energyKcal"] });
  });

  it("rejects references that point outside the backup", () => {
    const orphanShot = tampered((j) => void (j.data.injections![0]!.medicationId = id(99)));
    const orphanStep = tampered((j) => void (j.data.planSteps![0]!.medicationId = id(99)));
    const orphanEffect = tampered((j) => void (j.data.sideEffects![0]!.injectionId = id(99)));
    const orphanFood = tampered((j) => void (j.data.foodEntries![1]!.customFoodId = id(99)));
    for (const text of [orphanShot, orphanStep, orphanEffect, orphanFood]) expect(parseBackup(text).ok).toBe(false);
  });

  it("rejects duplicate ids within a table", () => {
    const dup = tampered((j) => {
      j.data.weights![1]!.id = j.data.weights![0]!.id;
    });
    expect(parseBackup(dup).ok).toBe(false);
  });
});

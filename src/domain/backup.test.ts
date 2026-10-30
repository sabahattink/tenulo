import { describe, expect, it } from "vitest";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type BackupData,
  backupFileName,
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

const data: BackupData = {
  settings: {
    weightUnit: "kg",
    goalWeightG: 80_000,
    injectionReminderEnabled: true,
    injectionReminderMinute: 540,
    weighInReminderEnabled: false,
    weighInReminderMinute: 450,
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
    const empty: BackupData = { settings: null, weights: [], medications: [], planSteps: [], injections: [], sideEffects: [] };
    expect(roundTrip(empty).ok).toBe(true);
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
  });

  it("rejects references that point outside the backup", () => {
    const orphanShot = tampered((j) => void (j.data.injections![0]!.medicationId = id(99)));
    const orphanStep = tampered((j) => void (j.data.planSteps![0]!.medicationId = id(99)));
    const orphanEffect = tampered((j) => void (j.data.sideEffects![0]!.injectionId = id(99)));
    for (const text of [orphanShot, orphanStep, orphanEffect]) expect(parseBackup(text).ok).toBe(false);
  });

  it("rejects duplicate ids within a table", () => {
    const dup = tampered((j) => {
      j.data.weights![1]!.id = j.data.weights![0]!.id;
    });
    expect(parseBackup(dup).ok).toBe(false);
  });
});

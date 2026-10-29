import { eq, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { settings, weightEntries } from "@/db/schema";
import { importableWeights, syncRange } from "@/domain/health-connect";
import { ulid } from "@/domain/id";
import { hasWeightAccess, readWeights } from "@/platform/health";

export type SyncResult =
  | { readonly kind: "synced"; readonly added: number }
  | { readonly kind: "no-access" }
  | { readonly kind: "off" };

const INSERT_CHUNK = 200;

/**
 * Reads new weight records from Health Connect into the log. Read-only: nothing is written back.
 * Readings Tenulo already has (same Health Connect id) are skipped, so this is safe to repeat.
 */
export async function syncHealthConnect(now: number = Date.now()): Promise<SyncResult> {
  const [s] = await db.select().from(settings).where(eq(settings.id, 1));
  if (!s?.healthConnectEnabled) return { kind: "off" };
  if (!(await hasWeightAccess())) return { kind: "no-access" };

  const { startMs, endMs } = syncRange(s.healthConnectSyncedAt, now);
  const records = await readWeights(startMs, endMs);
  const known = new Set(
    (
      await db
        .select({ id: weightEntries.healthConnectId })
        .from(weightEntries)
        .where(isNotNull(weightEntries.healthConnectId))
    ).flatMap((r) => (r.id === null ? [] : [r.id])),
  );
  const fresh = importableWeights(records, known);

  let added = 0;
  await db.transaction(async (tx) => {
    for (let i = 0; i < fresh.length; i += INSERT_CHUNK) {
      const rows = fresh.slice(i, i + INSERT_CHUNK).map((w) => ({
        id: ulid(w.measuredAt),
        measuredAt: w.measuredAt,
        localDate: w.localDate,
        weightG: w.weightG,
        source: "health_connect" as const,
        healthConnectId: w.healthConnectId,
        note: null,
        createdAt: now,
        updatedAt: now,
      }));
      added += (await tx.insert(weightEntries).values(rows).onConflictDoNothing().returning({ id: weightEntries.id })).length;
    }
    await tx.update(settings).set({ healthConnectSyncedAt: endMs, updatedAt: now }).where(eq(settings.id, 1));
  });
  return { kind: "synced", added };
}

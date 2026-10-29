import { eq, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { insertImportedWeights } from "@/db/ops";
import { settings, weightEntries } from "@/db/schema";
import { importableWeights, syncRange } from "@/domain/health-connect";
import { hasWeightAccess, readWeights } from "@/platform/health";

export type SyncResult =
  | { readonly kind: "synced"; readonly added: number; readonly complete: boolean }
  | { readonly kind: "no-access" }
  | { readonly kind: "off" };

/**
 * Reads new weight records from Health Connect into the log. Read-only: nothing is written back.
 * Readings Tenulo already has (same Health Connect id) are skipped, so this is safe to repeat.
 * When the read stopped early (page cap), the cursor moves only to the last reading read, so the
 * next sync continues from there instead of skipping the rest.
 */
export async function syncHealthConnect(now: number = Date.now()): Promise<SyncResult> {
  const [s] = await db.select().from(settings).where(eq(settings.id, 1));
  if (!s?.healthConnectEnabled) return { kind: "off" };
  if (!(await hasWeightAccess())) return { kind: "no-access" };

  const { startMs, endMs } = syncRange(s.healthConnectSyncedAt, now);
  const { records, complete } = await readWeights(startMs, endMs);
  const known = new Set(
    (
      await db
        .select({ id: weightEntries.healthConnectId })
        .from(weightEntries)
        .where(isNotNull(weightEntries.healthConnectId))
    ).flatMap((r) => (r.id === null ? [] : [r.id])),
  );
  const fresh = importableWeights(records, known);
  const lastRead = records.reduce((max, r) => Math.max(max, Date.parse(r.time) || 0), startMs);
  const cursor = complete ? endMs : lastRead;
  const added = insertImportedWeights(db, fresh, cursor, now);
  return { kind: "synced", added, complete };
}

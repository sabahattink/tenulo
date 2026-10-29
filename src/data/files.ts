import { Directory, File, Paths } from "expo-file-system";

/** Every file Tenulo writes for sharing (backups, PDF reports) starts with this. */
export const EXPORT_PREFIX = "tenulo-";

/**
 * Deletes exported files from the app cache. They are kept briefly after sharing, because the app
 * the user shared to may still be reading them; "Delete all data" removes them all at once.
 */
export function sweepExports(olderThanMs: number, now: number = Date.now()): void {
  let entries: (Directory | File)[];
  try {
    entries = new Directory(Paths.cache).list();
  } catch {
    return; // No cache directory yet: nothing was exported.
  }
  for (const entry of entries) {
    if (!(entry instanceof File) || !entry.name.startsWith(EXPORT_PREFIX)) continue;
    if (now - (entry.modificationTime ?? 0) >= olderThanMs) entry.delete();
  }
}

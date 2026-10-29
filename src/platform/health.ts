/**
 * Health Connect, read-only and Weight only. The privacy policy promises exactly this: adding a
 * record type, or any write, needs the policy updated first.
 */
import { Platform } from "react-native";
import {
  SdkAvailabilityStatus,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
} from "react-native-health-connect";
import type { HealthWeight } from "../domain/health-connect";

export type HealthConnectAvailability = "available" | "needs-update" | "unavailable";

const WEIGHT_READ = { accessType: "read", recordType: "Weight" } as const;
const PAGE_SIZE = 500;
/** A year of daily weigh-ins is ~365 records; this bounds a runaway paging loop. */
const MAX_PAGES = 20;

let initialized = false;

async function ready(): Promise<boolean> {
  if (initialized) return true;
  initialized = await initialize();
  return initialized;
}

export async function healthConnectAvailability(): Promise<HealthConnectAvailability> {
  if (Platform.OS !== "android") return "unavailable";
  try {
    const status = await getSdkStatus();
    if (status === SdkAvailabilityStatus.SDK_AVAILABLE) return "available";
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return "needs-update";
    return "unavailable";
  } catch {
    return "unavailable";
  }
}

export async function hasWeightAccess(): Promise<boolean> {
  if (!(await ready())) return false;
  const granted = await getGrantedPermissions();
  return granted.some((p) => p.accessType === "read" && "recordType" in p && p.recordType === "Weight");
}

export async function requestWeightAccess(): Promise<boolean> {
  if (!(await ready())) return false;
  const granted = await requestPermission([WEIGHT_READ]);
  return granted.some((p) => p.accessType === "read" && "recordType" in p && p.recordType === "Weight");
}

/** Every weight reading between the two instants, oldest first. */
export async function readWeights(startMs: number, endMs: number): Promise<HealthWeight[]> {
  if (!(await ready())) return [];
  const out: HealthWeight[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await readRecords("Weight", {
      timeRangeFilter: {
        operator: "between",
        startTime: new Date(startMs).toISOString(),
        endTime: new Date(endMs).toISOString(),
      },
      ascendingOrder: true,
      pageSize: PAGE_SIZE,
      pageToken,
    });
    for (const r of result.records) out.push({ id: r.metadata?.id, time: r.time, grams: r.weight.inGrams });
    pageToken = result.pageToken;
    if (pageToken === undefined || pageToken === "") break;
  }
  return out;
}

export function openHealthConnect(): void {
  openHealthConnectSettings();
}

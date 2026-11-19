import { Redirect } from "expo-router";
import type { ReactNode } from "react";
import { features } from "@/platform/features";

/** Wraps a medication-only screen: in the narrow build it sends the user home and renders nothing of it. */
export function MedicationOnly({ children }: { readonly children: ReactNode }) {
  if (!features.medication) return <Redirect href="/" />;
  return <>{children}</>;
}

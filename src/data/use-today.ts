import { useEffect, useState } from "react";
import { AppState } from "react-native";
import type { LocalDate } from "@/domain/date";
import { today } from "./repo";

/** A few seconds past midnight, so the new date is already in effect when the timer fires. */
const MIDNIGHT_SLACK_MS = 5_000;

/**
 * Today's local date, kept current: it changes at midnight while the app is open and whenever the
 * app returns to the foreground (the phone may have slept through midnight or changed time zone).
 */
export function useToday(): LocalDate {
  const [day, setDay] = useState<LocalDate>(today);
  useEffect(() => {
    const refresh = () => setDay((current) => (today() === current ? current : today()));
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() + MIDNIGHT_SLACK_MS;
    const timer = setTimeout(refresh, midnight - now.getTime());
    return () => {
      sub.remove();
      clearTimeout(timer);
    };
  }, [day]);
  return day;
}

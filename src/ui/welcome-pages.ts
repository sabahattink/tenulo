import type { Messages } from "@/i18n";
import type { IllustrationName } from "./Illustration";

/**
 * Each page is named by its illustration; its words are `t.welcome.pages[name]`, and for the daily
 * log page (`food`) `t.daily.welcomePage`.
 */
export type WelcomePage = Extract<IllustrationName, keyof Messages["welcome"]["pages"]> | "food";

const FULL: readonly WelcomePage[] = ["trend", "plan", "food", "private"];
const NARROW: readonly WelcomePage[] = ["trend", "food", "private"];

/** The narrow build has no plan page: the plan is the dose schedule. */
export function welcomePages(medication: boolean): readonly WelcomePage[] {
  return medication ? FULL : NARROW;
}

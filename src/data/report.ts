import { and, asc, eq, gte, lte, min, sql } from "drizzle-orm";
import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { db } from "@/db/client";
import {
  exerciseEntries,
  foodEntries,
  injections,
  measurementEntries,
  medications,
  planSteps,
  settings,
  sideEffects,
  waterEntries,
  weightEntries,
} from "@/db/schema";
import { type LocalDate, parseLocalDate, toDayNumber } from "@/domain/date";
import { type Report, type ReportPeriod, buildReport, reportStart } from "@/domain/report";
import { isSeverity } from "@/domain/side-effect";
import type { I18n } from "@/i18n";
import { reportHtml } from "@/ui/report-html";

/** A4 in PostScript points (72 per inch), the page size doctors print on outside North America. */
const A4 = { width: 595, height: 842 };

/** The first day anything was logged in the daily-log tables, for an "all" report. */
async function earliestDailyLog(): Promise<LocalDate[]> {
  const firsts = await Promise.all([
    db.select({ date: min(foodEntries.localDate) }).from(foodEntries),
    db.select({ date: min(waterEntries.localDate) }).from(waterEntries),
    db.select({ date: min(measurementEntries.localDate) }).from(measurementEntries),
    db.select({ date: min(exerciseEntries.localDate) }).from(exerciseEntries),
  ]);
  return firsts.flatMap(([row]) => (row?.date == null ? [] : [parseLocalDate(row.date)]));
}

/** Food, water, measurements and exercise between two dates (inclusive), summed per day where that is all the report needs. */
async function loadDailyLog(from: LocalDate, to: LocalDate) {
  const [food, water, measurements, exercises] = await Promise.all([
    db
      .select({
        localDate: foodEntries.localDate,
        energyKcal: sql<number>`sum(${foodEntries.energyKcal})`.mapWith(Number),
        proteinMg: sql<number>`coalesce(sum(${foodEntries.proteinMg}), 0)`.mapWith(Number),
        proteinUnknown: sql<number>`sum(case when ${foodEntries.proteinMg} is null then 1 else 0 end)`.mapWith(Number),
      })
      .from(foodEntries)
      .where(and(gte(foodEntries.localDate, from), lte(foodEntries.localDate, to)))
      .groupBy(foodEntries.localDate),
    db
      .select({ localDate: waterEntries.localDate, amountMl: sql<number>`sum(${waterEntries.amountMl})`.mapWith(Number) })
      .from(waterEntries)
      .where(and(gte(waterEntries.localDate, from), lte(waterEntries.localDate, to)))
      .groupBy(waterEntries.localDate),
    db
      .select()
      .from(measurementEntries)
      .where(and(gte(measurementEntries.localDate, from), lte(measurementEntries.localDate, to))),
    db
      .select({ localDate: exerciseEntries.localDate, kind: exerciseEntries.kind, durationMin: exerciseEntries.durationMin })
      .from(exerciseEntries)
      .where(and(gte(exerciseEntries.localDate, from), lte(exerciseEntries.localDate, to))),
  ]);
  return {
    foodDays: food.map((f) => ({
      date: parseLocalDate(f.localDate),
      energyKcal: f.energyKcal,
      proteinMg: f.proteinMg,
      proteinUnknown: f.proteinUnknown,
    })),
    waterDays: water.map((w) => ({ date: parseLocalDate(w.localDate), amountMl: w.amountMl })),
    measurements: measurements.map((m) => ({
      site: m.site,
      date: parseLocalDate(m.localDate),
      measuredAt: m.measuredAt,
      lengthMm: m.lengthMm,
    })),
    exercises: exercises.map((x) => ({ date: parseLocalDate(x.localDate), kind: x.kind, durationMin: x.durationMin })),
  };
}

/** Collects the records for a report ending today. */
export async function loadReport(period: ReportPeriod, to: LocalDate): Promise<Report> {
  const [medication] = await db
    .select()
    .from(medications)
    .where(eq(medications.active, true))
    .orderBy(asc(medications.createdAt))
    .limit(1);
  const weights = (await db.select().from(weightEntries)).map((w) => ({
    date: parseLocalDate(w.localDate),
    weightG: w.weightG,
  }));
  const shots =
    medication === undefined ? [] : await db.select().from(injections).where(eq(injections.medicationId, medication.id));
  const steps =
    medication === undefined ? [] : await db.select().from(planSteps).where(eq(planSteps.medicationId, medication.id));
  const effects = await db.select().from(sideEffects);

  const dates = [
    ...weights.map((w) => w.date),
    ...shots.map((s) => parseLocalDate(s.localDate)),
    ...(period === "all" ? await earliestDailyLog() : []),
  ];
  const earliest = dates.sort((a, b) => toDayNumber(a) - toDayNumber(b))[0];
  const from = reportStart(period, to, earliest);

  return buildReport({
    from,
    to,
    weights,
    medicationName: medication?.name,
    planSteps: steps.map((s) => ({ startDate: parseLocalDate(s.startDate), doseMcg: s.doseMcg, intervalDays: s.intervalDays })),
    injections: shots.map((s) => ({ date: parseLocalDate(s.localDate), doseMcg: s.doseMcg, site: s.site })),
    sideEffects: effects.flatMap((e) =>
      isSeverity(e.severity)
        ? [{ date: parseLocalDate(e.localDate), type: e.type, severity: e.severity, note: e.note }]
        : [],
    ),
    ...(await loadDailyLog(from, to)),
  });
}

/**
 * Renders the report to a PDF on the device and opens the share sheet. The page is printed by
 * Android's own WebView from a self-contained HTML string; nothing is fetched.
 */
export async function shareReportPdf(report: Report, created: LocalDate, i18n: I18n): Promise<void> {
  const [s] = await db.select().from(settings).limit(1);
  const html = reportHtml(report, s?.weightUnit ?? "kg", created, i18n);
  const { uri } = await Print.printToFileAsync({ html, width: A4.width, height: A4.height });
  // Give the file a readable name; printToFileAsync picks a random one.
  const printed = new File(uri);
  const named = new File(Paths.cache, `tenulo-report-${report.from}-to-${report.to}.pdf`);
  if (named.exists) named.delete();
  await printed.move(named);
  await Sharing.shareAsync(named.uri, { mimeType: "application/pdf", dialogTitle: i18n.t.report.shareTitle });
}

import { asc, eq } from "drizzle-orm";
import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { db } from "@/db/client";
import { injections, medications, planSteps, settings, sideEffects, weightEntries } from "@/db/schema";
import { type LocalDate, parseLocalDate, toDayNumber } from "@/domain/date";
import { type Report, type ReportPeriod, buildReport, reportStart } from "@/domain/report";
import { isSeverity } from "@/domain/side-effect";
import { reportHtml } from "@/ui/report-html";

/** A4 in PostScript points (72 per inch), the page size doctors print on outside North America. */
const A4 = { width: 595, height: 842 };

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

  const dates = [...weights.map((w) => w.date), ...shots.map((s) => parseLocalDate(s.localDate))];
  const earliest = dates.sort((a, b) => toDayNumber(a) - toDayNumber(b))[0];

  return buildReport({
    from: reportStart(period, to, earliest),
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
  });
}

/**
 * Renders the report to a PDF on the device and opens the share sheet. The page is printed by
 * Android's own WebView from a self-contained HTML string; nothing is fetched.
 */
export async function shareReportPdf(report: Report, created: LocalDate): Promise<void> {
  const [s] = await db.select().from(settings).limit(1);
  const html = reportHtml(report, s?.weightUnit ?? "kg", created);
  const { uri } = await Print.printToFileAsync({ html, width: A4.width, height: A4.height });
  // Give the file a readable name; printToFileAsync picks a random one.
  const printed = new File(uri);
  const named = new File(Paths.cache, `tenulo-report-${report.from}-to-${report.to}.pdf`);
  if (named.exists) named.delete();
  await printed.move(named);
  await Sharing.shareAsync(named.uri, { mimeType: "application/pdf", dialogTitle: "Share your Tenulo report" });
}

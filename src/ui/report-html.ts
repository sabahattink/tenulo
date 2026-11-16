/**
 * The doctor report as a single self-contained HTML page, printed to PDF on the device.
 *
 * No fonts, images or styles are loaded from anywhere: the renderer never needs the network, and
 * a test guards that. Every value the user typed is escaped. The report is in the user's language;
 * upper-case labels are upper-cased here with that language's rules rather than by CSS.
 */
import type { LocalDate } from "../domain/date";
import { lengthUnitFor } from "../domain/measurement";
import type { Report } from "../domain/report";
import { type WeightUnit, fromGrams } from "../domain/weight";
import type { I18n } from "../i18n";
import { chartGeometry } from "./chart-geometry";
import { PUBLISHER } from "./copy";
import { formatLength, formatLengthChange } from "./progress/length";

const MG_PER_G = 1000;

/** Print palette: the light theme, which prints well in color and in grey. */
const INK = "#1E2320";
const MUTED = "#5D635E";
const RULE = "#E3DFD6";
const ACCENT = "#2F6B5B";
const DOT = "#A9B4AE";

/** A4 at 72 dpi minus margins. */
const CHART_W = 515;
const CHART_H = 170;
const CHART_PAD_LEFT = 40;

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const e = escapeHtml;

export function reportHtml(report: Report, unit: WeightUnit, created: LocalDate, i18n: I18n): string {
  const { lang, t, f } = i18n;
  const period = `${f.longDate(report.from)} – ${f.longDate(report.to)}`;
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(t.reportPdf.documentTitle(f.longDate(report.from), f.longDate(report.to)))}</title>
<style>${STYLE}</style>
</head>
<body>
<header>
  <div class="brand">${e(f.upper("Tenulo"))}</div>
  <h1>${e(t.reportPdf.heading)}</h1>
  <p class="period">${e(period)} · ${e(t.reportPdf.days(report.days))}</p>
</header>
${summary(report, unit, i18n)}
${weightBlock(report, unit, i18n)}
${measurementBlock(report, unit, i18n)}
${medicationBlock(report, i18n)}
${sideEffectBlock(report, i18n)}
${nutritionBlock(report, i18n)}
${waterBlock(report, i18n)}
${exerciseBlock(report, i18n)}
<footer>
  ${e(t.reportPdf.footer(f.longDate(created), PUBLISHER))}
</footer>
</body>
</html>`;
}

function summary(r: Report, unit: WeightUnit, { t, f }: I18n): string {
  const w = r.weight;
  const tile = (label: string, value: string) =>
    `<div class="tile"><div class="tile-label">${e(f.upper(label))}</div><div class="tile-value">${e(value)}</div></div>`;
  return `<section class="tiles">
  ${tile(t.reportPdf.trendStart, w ? f.weight(w.startTrendG, unit) : t.common.noValue)}
  ${tile(t.reportPdf.trendEnd, w ? f.weight(w.endTrendG, unit) : t.common.noValue)}
  ${tile(t.reportPdf.change, w ? f.weightChange(w.changeG, unit) : t.common.noValue)}
  ${tile(t.reportPdf.injections, f.integer(r.injections.count))}
  ${tile(t.reportPdf.sideEffects, f.integer(r.sideEffects.total))}
</section>`;
}

/** A table of rows with upper-case column headers. */
function listTable({ f }: I18n, headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const head = headers.map((h) => `<th>${e(f.upper(h))}</th>`).join("");
  const body = rows.map((cells) => `<tr>${cells.map((c) => `<td>${e(c)}</td>`).join("")}</tr>`).join("");
  return `<table class="list"><thead><tr>${head}</tr></thead><tbody>
  ${body}
  </tbody></table>`;
}

function weightBlock(r: Report, unit: WeightUnit, i18n: I18n): string {
  const { t, f } = i18n;
  const w = r.weight;
  if (w === undefined) return `<section><h2>${e(t.reportPdf.weight)}</h2><p class="empty">${e(t.reportPdf.noWeighIns)}</p></section>`;
  const rate = w.perWeekG === undefined ? t.common.noValue : t.forecast.perWeek(f.weightChange(w.perWeekG, unit));
  const fact = (label: string, value: string) => `<th>${e(label)}</th><td>${e(value)}</td>`;
  return `<section>
  <h2>${e(t.reportPdf.weight)}</h2>
  ${chart(r, unit, i18n)}
  <table class="facts">
    <tr>${fact(t.reportPdf.weighInDays, f.integer(w.weighIns))}${fact(t.reportPdf.trendRate, rate)}</tr>
    <tr>${fact(t.reportPdf.lowestDay, f.weight(w.lowestG, unit))}${fact(t.reportPdf.highestDay, f.weight(w.highestG, unit))}</tr>
    <tr>${fact(t.reportPdf.firstWeighIn, f.longDate(w.firstDate))}${fact(t.reportPdf.lastWeighIn, f.longDate(w.lastDate))}</tr>
  </table>
  <p class="note">${e(t.reportPdf.trendNote)}</p>
</section>`;
}

function chart(r: Report, unit: WeightUnit, { t, f }: I18n): string {
  const w = r.weight;
  if (w === undefined) return "";
  const g = chartGeometry(
    w.trend,
    { width: CHART_W, height: CHART_H, padLeft: CHART_PAD_LEFT, padRight: 6, padTop: 8, padBottom: 8 },
    null,
    r.days,
  );
  if (g === undefined) return "";
  const stepG = (g.ticks[1]?.valueG ?? 0) - (g.ticks[0]?.valueG ?? 0);
  const decimals = fromGrams(stepG, unit) >= 1 ? 0 : 1;
  const ticks = g.ticks
    .map(
      (tick) =>
        `<line x1="${CHART_PAD_LEFT}" x2="${CHART_W - 6}" y1="${tick.y}" y2="${tick.y}" stroke="${RULE}" stroke-width="1"/>` +
        `<text x="${CHART_PAD_LEFT - 6}" y="${tick.y + 3.5}" text-anchor="end" font-size="9" fill="${MUTED}">${f.decimal(
          fromGrams(tick.valueG, unit),
          decimals,
        )}</text>`,
    )
    .join("");
  const dots = g.readings.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="2.2" fill="${DOT}"/>`).join("");
  const line =
    g.trendPath === ""
      ? ""
      : `<path d="${g.trendPath}" fill="none" stroke="${ACCENT}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
  return `<svg class="chart" width="${CHART_W}" height="${CHART_H}" viewBox="0 0 ${CHART_W} ${CHART_H}" role="img" aria-label="${e(
    t.reportPdf.chartLabel,
  )}">${ticks}${dots}${line}</svg>
  <p class="legend"><span class="swatch line"></span>${e(t.reportPdf.legendTrend(unit))} <span class="swatch dot"></span>${e(
    t.reportPdf.legendDaily,
  )}</p>`;
}

function medicationBlock(r: Report, i18n: I18n): string {
  const { t, f } = i18n;
  const name = r.medicationName === undefined ? "" : `<p class="med">${e(r.medicationName)}</p>`;
  const plan =
    r.planSteps.length === 0
      ? ""
      : `<h3>${e(t.reportPdf.plan)}</h3>
  ${listTable(
    i18n,
    [t.reportPdf.from, t.reportPdf.dose, t.reportPdf.schedule],
    r.planSteps.map((s) => [f.longDate(s.startDate), f.dose(s.doseMcg), f.interval(s.intervalDays)]),
  )}`;
  const inj = r.injections;
  const shots =
    inj.count === 0
      ? `<p class="empty">${e(t.reportPdf.noInjections)}</p>`
      : listTable(
          i18n,
          [t.reportPdf.date, t.reportPdf.dose, t.reportPdf.site],
          inj.rows.map((i) => [f.longDate(i.date), f.dose(i.doseMcg), i.site === null ? t.reportPdf.notRecorded : t.sites[i.site]]),
        );
  const gaps = inj.gaps;
  const gapText =
    gaps === undefined
      ? ""
      : `<p class="note">${e(
          t.reportPdf.gaps(
            gaps.minDays === gaps.maxDays ? f.integer(gaps.minDays) : `${f.integer(gaps.minDays)}–${f.integer(gaps.maxDays)}`,
            f.decimal(gaps.meanDays, Number.isInteger(gaps.meanDays) ? 0 : 1),
          ),
        )}</p>`;
  const sites =
    inj.sites.length === 0
      ? ""
      : `<p class="note">${e(t.reportPdf.sites(inj.sites.map((s) => `${t.sites[s.site]} ×${s.count}`).join(", ")))}</p>`;
  return `<section><h2>${e(t.reportPdf.medication)}</h2>${name}${plan}<h3>${e(t.reportPdf.injectionsLogged)}</h3>${shots}${gapText}${sites}</section>`;
}

function sideEffectBlock(r: Report, i18n: I18n): string {
  const { t, f } = i18n;
  const s = r.sideEffects;
  if (s.total === 0) {
    return `<section><h2>${e(t.reportPdf.sideEffects)}</h2><p class="empty">${e(t.reportPdf.noSideEffects)}</p></section>`;
  }
  return `<section>
  <h2>${e(t.reportPdf.sideEffects)}</h2>
  ${listTable(
    i18n,
    [t.reportPdf.type, t.reportPdf.times, t.reportPdf.strongest],
    s.byType.map((x) => [t.sideEffects[x.type], f.integer(x.count), t.severity[x.strongest]]),
  )}
  <h3>${e(t.reportPdf.allEntries)}</h3>
  ${listTable(
    i18n,
    [t.reportPdf.date, t.reportPdf.type, t.reportPdf.rating, t.reportPdf.note],
    s.rows.map((x) => [f.longDate(x.date), t.sideEffects[x.type], t.severity[x.severity], x.note ?? ""]),
  )}
  <p class="note">${e(t.reportPdf.ratingsNote)}</p>
</section>`;
}

/** Label and value pairs, two to a row, like the weight facts. */
function factsTable(pairs: readonly (readonly [label: string, value: string])[]): string {
  const rows: string[] = [];
  for (let i = 0; i < pairs.length; i += 2) {
    const cells = pairs
      .slice(i, i + 2)
      .map(([label, value]) => `<th>${e(label)}</th><td>${e(value)}</td>`)
      .join("");
    rows.push(`<tr>${cells}</tr>`);
  }
  return `<table class="facts">${rows.join("")}</table>`;
}

/*
 * The daily-log sections. Each appears only when the period has records of its kind: these logs are
 * optional, and a page of empty sections would hide the ones that matter.
 */

function measurementBlock(r: Report, unit: WeightUnit, i18n: I18n): string {
  const { t, f } = i18n;
  if (r.measurements.length === 0) return "";
  const lengthUnit = lengthUnitFor(unit);
  const reading = (mm: number, date: LocalDate) => `${formatLength(f, mm, lengthUnit)} · ${f.longDate(date)}`;
  return `<section>
  <h2>${e(t.reportLog.pdf.measurements)}</h2>
  ${listTable(
    i18n,
    [t.reportPdf.site, t.reportLog.pdf.first, t.reportLog.pdf.last, t.reportPdf.change],
    r.measurements.map((m) => [
      t.measure.sites[m.site],
      reading(m.first.lengthMm, m.first.date),
      m.readings > 1 ? reading(m.last.lengthMm, m.last.date) : t.common.noValue,
      m.changeMm === undefined ? t.common.noValue : formatLengthChange(f, m.changeMm, lengthUnit),
    ]),
  )}
</section>`;
}

function nutritionBlock(r: Report, { t, f }: I18n): string {
  const n = r.nutrition;
  if (n.daysLogged === 0) return "";
  const pdf = t.reportLog.pdf;
  const kcal = n.energyKcalPerDay === undefined ? t.common.noValue : `${f.integer(n.energyKcalPerDay)} kcal`;
  const protein = n.proteinMgPerDay === undefined ? t.common.noValue : `${f.integer(n.proteinMgPerDay / MG_PER_G)} g`;
  const incomplete = n.proteinIncomplete ? ` ${pdf.proteinIncomplete}` : "";
  return `<section>
  <h2>${e(pdf.nutrition)}</h2>
  ${factsTable([
    [t.reportLog.foodDays, pdf.ofDays(f.integer(n.daysLogged), f.integer(r.days))],
    [pdf.energyPerDay, kcal],
    [pdf.proteinPerDay, protein],
  ])}
  <p class="note">${e(`${pdf.nutritionNote}${incomplete}`)}</p>
</section>`;
}

function waterBlock(r: Report, { t, f }: I18n): string {
  const w = r.water;
  if (w.daysLogged === 0) return "";
  const pdf = t.reportLog.pdf;
  return `<section>
  <h2>${e(pdf.water)}</h2>
  ${factsTable([
    [t.reportLog.waterDays, pdf.ofDays(f.integer(w.daysLogged), f.integer(r.days))],
    [pdf.waterPerDay, w.mlPerDay === undefined ? t.common.noValue : `${f.integer(w.mlPerDay)} ml`],
  ])}
</section>`;
}

function exerciseBlock(r: Report, i18n: I18n): string {
  const { t, f } = i18n;
  const x = r.exercise;
  if (x.sessions === 0) return "";
  const pdf = t.reportLog.pdf;
  const minutes = (n: number) => t.historyLog.minutes(f.integer(n));
  return `<section>
  <h2>${e(pdf.exercise)}</h2>
  ${factsTable([
    [pdf.sessions, f.integer(x.sessions)],
    [pdf.totalTime, minutes(x.minutes)],
  ])}
  ${listTable(
    i18n,
    [t.reportPdf.type, pdf.sessions, pdf.totalTime],
    x.byKind.map((k) => [t.exerciseLog.kinds[k.kind], f.integer(k.sessions), minutes(k.minutes)]),
  )}
  <p class="note">${e(pdf.exerciseNote)}</p>
</section>`;
}

const STYLE = `
@page { size: A4; margin: 36pt 40pt; }
* { box-sizing: border-box; }
body { font-family: -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif; color: ${INK}; font-size: 10.5pt; line-height: 1.45; margin: 0; }
header { border-bottom: 2px solid ${ACCENT}; padding-bottom: 10pt; margin-bottom: 14pt; }
.brand { color: ${ACCENT}; font-weight: 700; letter-spacing: 0.08em; font-size: 9pt; }
h1 { font-size: 20pt; margin: 2pt 0 2pt; font-weight: 700; }
.period { color: ${MUTED}; margin: 0; }
h2 { font-size: 13pt; margin: 18pt 0 6pt; color: ${ACCENT}; }
h3 { font-size: 10.5pt; margin: 12pt 0 4pt; }
section { page-break-inside: auto; }
.tiles { display: flex; gap: 8pt; }
.tile { flex: 1; border: 1px solid ${RULE}; border-radius: 6pt; padding: 6pt 8pt; }
.tile-label { color: ${MUTED}; font-size: 8pt; letter-spacing: 0.05em; }
.tile-value { font-size: 12pt; font-weight: 700; font-variant-numeric: tabular-nums; }
.chart { display: block; margin: 4pt 0 2pt; }
.legend { color: ${MUTED}; font-size: 8.5pt; margin: 0 0 6pt; }
.swatch { display: inline-block; width: 10pt; height: 3pt; vertical-align: middle; margin: 0 4pt 0 10pt; }
.swatch.line { background: ${ACCENT}; margin-left: 0; }
.swatch.dot { width: 5pt; height: 5pt; border-radius: 50%; background: ${DOT}; }
table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
table.list th { text-align: left; color: ${MUTED}; font-weight: 600; font-size: 8.5pt; letter-spacing: 0.04em; border-bottom: 1px solid ${RULE}; padding: 3pt 6pt 3pt 0; }
table.list td { border-bottom: 1px solid ${RULE}; padding: 4pt 6pt 4pt 0; vertical-align: top; }
table.list tr { page-break-inside: avoid; }
table.facts th { text-align: left; color: ${MUTED}; font-weight: 400; padding: 2pt 6pt 2pt 0; width: 22%; }
table.facts td { font-weight: 600; padding: 2pt 12pt 2pt 0; width: 28%; }
.med { font-size: 12pt; font-weight: 700; margin: 0 0 4pt; }
.note { color: ${MUTED}; font-size: 9pt; margin: 6pt 0 0; }
.empty { color: ${MUTED}; font-style: italic; }
footer { margin-top: 22pt; padding-top: 8pt; border-top: 1px solid ${RULE}; color: ${MUTED}; font-size: 8.5pt; }
`;

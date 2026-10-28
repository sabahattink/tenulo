/**
 * The doctor report as a single self-contained HTML page, printed to PDF on the device.
 *
 * No fonts, images or styles are loaded from anywhere: the renderer never needs the network, and
 * a test guards that. Every value the user typed is escaped.
 */
import type { LocalDate } from "../domain/date";
import { formatDose } from "../domain/parse";
import type { Report } from "../domain/report";
import { type WeightUnit, formatWeight, formatWeightChange, fromGrams } from "../domain/weight";
import { chartGeometry } from "./chart-geometry";
import { SEVERITY_LABELS, SIDE_EFFECT_LABELS, SITE_LABELS, intervalText, longDate } from "./copy";

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

export function reportHtml(report: Report, unit: WeightUnit, created: LocalDate): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tenulo report ${e(longDate(report.from))} – ${e(longDate(report.to))}</title>
<style>${STYLE}</style>
</head>
<body>
<header>
  <div class="brand">Tenulo</div>
  <h1>Personal log report</h1>
  <p class="period">${e(longDate(report.from))} – ${e(longDate(report.to))} · ${report.days} ${report.days === 1 ? "day" : "days"}</p>
</header>
${summary(report, unit)}
${weightBlock(report, unit)}
${medicationBlock(report)}
${sideEffectBlock(report)}
<footer>
  Recorded by the patient in Tenulo, a personal log. Values are shown exactly as the patient entered
  them. Tenulo does not give medical advice and does not recommend medications or doses.
  Created ${e(longDate(created))}.
</footer>
</body>
</html>`;
}

function tile(label: string, value: string): string {
  return `<div class="tile"><div class="tile-label">${e(label)}</div><div class="tile-value">${e(value)}</div></div>`;
}

function summary(r: Report, unit: WeightUnit): string {
  const w = r.weight;
  return `<section class="tiles">
  ${tile("Trend at start", w ? formatWeight(w.startTrendG, unit) : "–")}
  ${tile("Trend at end", w ? formatWeight(w.endTrendG, unit) : "–")}
  ${tile("Change", w ? formatWeightChange(w.changeG, unit) : "–")}
  ${tile("Injections", String(r.injections.count))}
  ${tile("Side effects", String(r.sideEffects.total))}
</section>`;
}

function weightBlock(r: Report, unit: WeightUnit): string {
  const w = r.weight;
  if (w === undefined) return `<section><h2>Weight</h2><p class="empty">No weigh-ins in this period.</p></section>`;
  const rate = w.perWeekG === undefined ? "–" : `${formatWeightChange(w.perWeekG, unit)} per week`;
  return `<section>
  <h2>Weight</h2>
  ${chart(r, unit)}
  <table class="facts">
    <tr><th>Weigh-in days</th><td>${w.weighIns}</td><th>Trend rate</th><td>${e(rate)}</td></tr>
    <tr><th>Lowest day</th><td>${e(formatWeight(w.lowestG, unit))}</td><th>Highest day</th><td>${e(formatWeight(w.highestG, unit))}</td></tr>
    <tr><th>First weigh-in</th><td>${e(longDate(w.firstDate))}</td><th>Last weigh-in</th><td>${e(longDate(w.lastDate))}</td></tr>
  </table>
  <p class="note">The trend is a moving average of daily weigh-ins; it smooths day-to-day water weight.</p>
</section>`;
}

function chart(r: Report, unit: WeightUnit): string {
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
      (t) =>
        `<line x1="${CHART_PAD_LEFT}" x2="${CHART_W - 6}" y1="${t.y}" y2="${t.y}" stroke="${RULE}" stroke-width="1"/>` +
        `<text x="${CHART_PAD_LEFT - 6}" y="${t.y + 3.5}" text-anchor="end" font-size="9" fill="${MUTED}">${fromGrams(
          t.valueG,
          unit,
        ).toFixed(decimals)}</text>`,
    )
    .join("");
  const dots = g.readings.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="2.2" fill="${DOT}"/>`).join("");
  const line =
    g.trendPath === ""
      ? ""
      : `<path d="${g.trendPath}" fill="none" stroke="${ACCENT}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
  return `<svg class="chart" width="${CHART_W}" height="${CHART_H}" viewBox="0 0 ${CHART_W} ${CHART_H}" role="img" aria-label="Weight trend">${ticks}${dots}${line}</svg>
  <p class="legend"><span class="swatch line"></span>Trend (${e(unit)}) <span class="swatch dot"></span>Daily weigh-in</p>`;
}

function medicationBlock(r: Report): string {
  const name = r.medicationName === undefined ? "" : `<p class="med">${e(r.medicationName)}</p>`;
  const plan =
    r.planSteps.length === 0
      ? ""
      : `<h3>Plan entered by the patient</h3>
  <table class="list"><thead><tr><th>From</th><th>Dose</th><th>Schedule</th></tr></thead><tbody>
  ${r.planSteps
    .map(
      (s) =>
        `<tr><td>${e(longDate(s.startDate))}</td><td>${e(formatDose(s.doseMcg))}</td><td>${e(intervalText(s.intervalDays))}</td></tr>`,
    )
    .join("")}
  </tbody></table>`;
  const inj = r.injections;
  const shots =
    inj.count === 0
      ? `<p class="empty">No injections in this period.</p>`
      : `<table class="list"><thead><tr><th>Date</th><th>Dose</th><th>Site</th></tr></thead><tbody>
  ${inj.rows
    .map(
      (i) =>
        `<tr><td>${e(longDate(i.date))}</td><td>${e(formatDose(i.doseMcg))}</td><td>${e(
          i.site === null ? "Not recorded" : SITE_LABELS[i.site],
        )}</td></tr>`,
    )
    .join("")}
  </tbody></table>`;
  const gaps =
    inj.gaps === undefined
      ? ""
      : `<p class="note">Days between injections: ${inj.gaps.minDays === inj.gaps.maxDays ? inj.gaps.minDays : `${inj.gaps.minDays}–${inj.gaps.maxDays}`} (average ${inj.gaps.meanDays}).</p>`;
  const sites =
    inj.sites.length === 0
      ? ""
      : `<p class="note">Sites: ${inj.sites.map((s) => `${e(SITE_LABELS[s.site])} ×${s.count}`).join(", ")}.</p>`;
  return `<section><h2>Medication</h2>${name}${plan}<h3>Injections logged</h3>${shots}${gaps}${sites}</section>`;
}

function sideEffectBlock(r: Report): string {
  const s = r.sideEffects;
  if (s.total === 0) return `<section><h2>Side effects</h2><p class="empty">No side effects logged in this period.</p></section>`;
  return `<section>
  <h2>Side effects</h2>
  <table class="list"><thead><tr><th>Type</th><th>Times</th><th>Strongest rating</th></tr></thead><tbody>
  ${s.byType
    .map(
      (t) => `<tr><td>${e(SIDE_EFFECT_LABELS[t.type])}</td><td>${t.count}</td><td>${e(SEVERITY_LABELS[t.strongest])}</td></tr>`,
    )
    .join("")}
  </tbody></table>
  <h3>All entries</h3>
  <table class="list"><thead><tr><th>Date</th><th>Type</th><th>Rating</th><th>Note</th></tr></thead><tbody>
  ${s.rows
    .map(
      (x) =>
        `<tr><td>${e(longDate(x.date))}</td><td>${e(SIDE_EFFECT_LABELS[x.type])}</td><td>${e(SEVERITY_LABELS[x.severity])}</td><td>${e(
          x.note ?? "",
        )}</td></tr>`,
    )
    .join("")}
  </tbody></table>
  <p class="note">Ratings are the patient's own: mild, moderate or strong.</p>
</section>`;
}

const STYLE = `
@page { size: A4; margin: 36pt 40pt; }
* { box-sizing: border-box; }
body { font-family: -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif; color: ${INK}; font-size: 10.5pt; line-height: 1.45; margin: 0; }
header { border-bottom: 2px solid ${ACCENT}; padding-bottom: 10pt; margin-bottom: 14pt; }
.brand { color: ${ACCENT}; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; font-size: 9pt; }
h1 { font-size: 20pt; margin: 2pt 0 2pt; font-weight: 700; }
.period { color: ${MUTED}; margin: 0; }
h2 { font-size: 13pt; margin: 18pt 0 6pt; color: ${ACCENT}; }
h3 { font-size: 10.5pt; margin: 12pt 0 4pt; }
section { page-break-inside: auto; }
.tiles { display: flex; gap: 8pt; }
.tile { flex: 1; border: 1px solid ${RULE}; border-radius: 6pt; padding: 6pt 8pt; }
.tile-label { color: ${MUTED}; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.05em; }
.tile-value { font-size: 12pt; font-weight: 700; font-variant-numeric: tabular-nums; }
.chart { display: block; margin: 4pt 0 2pt; }
.legend { color: ${MUTED}; font-size: 8.5pt; margin: 0 0 6pt; }
.swatch { display: inline-block; width: 10pt; height: 3pt; vertical-align: middle; margin: 0 4pt 0 10pt; }
.swatch.line { background: ${ACCENT}; margin-left: 0; }
.swatch.dot { width: 5pt; height: 5pt; border-radius: 50%; background: ${DOT}; }
table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
table.list th { text-align: left; color: ${MUTED}; font-weight: 600; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid ${RULE}; padding: 3pt 6pt 3pt 0; }
table.list td { border-bottom: 1px solid ${RULE}; padding: 4pt 6pt 4pt 0; vertical-align: top; }
table.list tr { page-break-inside: avoid; }
table.facts th { text-align: left; color: ${MUTED}; font-weight: 400; padding: 2pt 6pt 2pt 0; width: 22%; }
table.facts td { font-weight: 600; padding: 2pt 12pt 2pt 0; width: 28%; }
.med { font-size: 12pt; font-weight: 700; margin: 0 0 4pt; }
.note { color: ${MUTED}; font-size: 9pt; margin: 6pt 0 0; }
.empty { color: ${MUTED}; font-style: italic; }
footer { margin-top: 22pt; padding-top: 8pt; border-top: 1px solid ${RULE}; color: ${MUTED}; font-size: 8.5pt; }
`;

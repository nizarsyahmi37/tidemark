import type { AnalysisDoc, Diagnostics, HeatCell, HeatmapMetrics, Headline, MonthlyRow, PrimaryMethod, SeasonSpec, TrendResult } from "../types";
import { fmtG, lag1, mean, median, normCdf, percentile, std } from "./math";
import { gilbertCI, hamedRaoVarS, mkTest, senSlopes, windowStats } from "./trend";

export interface AnalyseOpts { season: SeasonSpec; alpha?: number; minWindowYears?: number; primary?: PrimaryMethod; units: string; unitLabel: string; shortName: string }
export type StatsOutput = Pick<AnalysisDoc, "series" | "climatology" | "analyses" | "annual_season_series" | "headline" | "heatmap" | "diagnostics" | "notes">;

const num = (x: number): number | null => (Number.isFinite(x) ? x : null);

function plain(r: Omit<TrendResult, "plain">, unit: string, what: string, alpha: number): string {
  const f = (x: number) => fmtG(x, 3);
  if (r.trend === "no_trend") return `${what}: estimated change ${f(r.slope_per_decade)} ${unit} per decade (${Math.round((1 - alpha) * 100)}% CI ${f(r.ci_low)} to ${f(r.ci_high)}), p = ${r.p == null ? "n/a" : r.p.toFixed(2)}. Not statistically significant - this does not prove there is no trend; a longer record might settle it.`;
  return `${what} ${r.trend === "increasing" ? "rose" : "fell"} by about ${f(Math.abs(r.slope_per_decade))} ${unit} per decade (${Math.round((1 - alpha) * 100)}% CI ${f(r.ci_low)} to ${f(r.ci_high)}), p = ${r.p == null ? "n/a" : r.p < 0.001 ? "<0.001" : r.p.toFixed(3)}: statistically significant.`;
}
function result(method: string, n: number, slopeDec: number, lo: number, hi: number, p: number, tau: number, unit: string, what: string, alpha: number): TrendResult {
  const significant = Number.isFinite(p) && p < alpha;
  const trend: TrendResult["trend"] = !significant ? "no_trend" : slopeDec > 0 ? "increasing" : "decreasing";
  const base = { method, n, slope_per_decade: slopeDec, ci_low: lo, ci_high: hi, p: num(p), tau: num(tau), trend, significant };
  return { ...base, plain: plain(base, unit, what, alpha) };
}

/** Season-year assignment: months of a season that wraps Dec->Jan (e.g. DJF) belong to the following year for the part before January. */
export function lateMonths(months: number[]): Set<number> {
  const set = new Set(months); const late = new Set<number>();
  if (!(set.has(12) && set.has(1)) || set.size === 12) return late;
  for (let m = 12; m >= 1 && set.has(m); m--) late.add(m);
  return late;
}

export function analyseSeries(rowsIn: MonthlyRow[], opts: AnalyseOpts): StatsOutput {
  const alpha = opts.alpha ?? 0.05, minYears = opts.minWindowYears ?? 8, primary: PrimaryMethod = opts.primary ?? "season_only";
  const months = [...new Set(opts.season.months)].sort((a, b) => a - b);
  if (!months.length) throw new Error("season must contain at least one month");
  const rows = [...rowsIn].sort((a, b) => a.date.localeCompare(b.date));
  const valid = rows.filter((r) => r.value != null && Number.isFinite(r.value));
  if (valid.length < 36) throw new Error("Need at least 36 valid monthly values (3 years) to analyse a trend.");

  // climatology & anomalies (over all valid months)
  const byMonth: number[][] = Array.from({ length: 12 }, () => []);
  for (const r of valid) byMonth[Number(r.date.slice(5, 7)) - 1].push(r.value as number);
  const clim = byMonth.map((a) => (a.length ? mean(a) : NaN));
  const series = rows.map((r) => {
    const v = r.value != null && Number.isFinite(r.value) ? r.value : null;
    const m = Number(r.date.slice(5, 7)) - 1;
    return { date: r.date, value: v, anomaly: v == null || !Number.isFinite(clim[m]) ? null : v - clim[m] };
  });
  const climatology = clim.map((m, i) => ({ month: i + 1, mean: m })).filter((c) => Number.isFinite(c.mean));

  const unit = opts.unitLabel || opts.units, what = `${opts.shortName[0].toUpperCase()}${opts.shortName.slice(1)} (${opts.season.label})`;
  const tIdx = series.map((_, i) => i / 12);

  // --- raw monthly (naive)
  const vals = series.map((s) => s.value);
  const rawY = vals.filter((v): v is number => v != null);
  const mkRaw = mkTest(rawY), slRaw = senSlopes(tIdx, vals);
  const [rl, rh] = gilbertCI(slRaw, mkRaw.varS, alpha);
  const raw = result("Mann-Kendall + Sen's slope on raw monthly values (ignores seasons & autocorrelation)", rawY.length, median(slRaw) * 10, rl * 10, rh * 10, mkRaw.p, mkRaw.tau, unit, what, alpha);

  // --- deseasonalised (anomalies) + Hamed-Rao variance
  const anom = series.map((s) => s.anomaly);
  const anomY = anom.filter((v): v is number => v != null);
  const mkA = mkTest(anomY), hr = hamedRaoVarS(anomY, alpha), slA = senSlopes(tIdx, anom);
  const zA = mkA.S === 0 ? 0 : (mkA.S - Math.sign(mkA.S)) / Math.sqrt(hr.varS);
  const pA = 2 * (1 - normCdf(Math.abs(zA)));
  const [al, ah] = gilbertCI(slA, hr.varS, alpha);
  const deseasonalized = result("Hamed-Rao modified Mann-Kendall + Sen's slope on monthly anomalies", anomY.length, median(slA) * 10, al * 10, ah * 10, pA, mkA.tau, unit, what, alpha);

  // --- seasonal MK (all 12 calendar months, pooled)
  const pooled: number[] = []; let Ssum = 0, Vsum = 0;
  for (let m = 1; m <= 12; m++) {
    const yrs: number[] = [], v: number[] = [];
    for (const s of series) if (Number(s.date.slice(5, 7)) === m && s.value != null) { yrs.push(Number(s.date.slice(0, 4))); v.push(s.value); }
    if (v.length < 4) continue;
    const mk = mkTest(v); Ssum += mk.S; Vsum += mk.varS; for (const x of senSlopes(yrs, v)) pooled.push(x);
  }
  const zS = Ssum === 0 ? 0 : (Ssum - Math.sign(Ssum)) / Math.sqrt(Vsum);
  const pS = 2 * (1 - normCdf(Math.abs(zS)));
  const [sl, sh] = gilbertCI(pooled, Vsum, alpha);
  const seasonal_mk = result("Seasonal Mann-Kendall (each calendar month tested separately, then pooled) + Sen's slope", rawY.length, median(pooled) * 10, sl * 10, sh * 10, pS, NaN, unit, what, alpha);

  // --- yearly season means (complete seasons only)
  const late = lateMonths(months), mset = new Set(months);
  const acc = new Map<number, { sum: number; n: number }>();
  for (const s of series) {
    const m = Number(s.date.slice(5, 7)); if (!mset.has(m) || s.value == null) continue;
    const y = Number(s.date.slice(0, 4)) + (late.has(m) ? 1 : 0);
    const a = acc.get(y) ?? { sum: 0, n: 0 }; a.sum += s.value; a.n++; acc.set(y, a);
  }
  const allYears = new Set<number>(); for (const s of series) allYears.add(Number(s.date.slice(0, 4)) + (late.has(Number(s.date.slice(5, 7))) && mset.has(Number(s.date.slice(5, 7))) ? 1 : 0));
  const years: number[] = [], yv: number[] = [], incomplete: number[] = [];
  for (const y of [...acc.keys()].sort((a, b) => a - b)) { const a = acc.get(y)!; if (a.n === months.length) { years.push(y); yv.push(Math.round((a.sum / a.n) * 1e10) / 1e10); } else incomplete.push(y); }
  if (years.length < 5) throw new Error("Fewer than 5 complete seasons are available - choose a longer period or a different season.");
  const w = windowStats(years, yv, alpha);
  const season_only = result(`Mann-Kendall + Sen's slope on yearly ${opts.season.label} means`, w.n, w.slope, w.lo, w.hi, w.p, w.tau, unit, what, alpha);
  const annual_season_series = years.map((y, i) => ({ year: y, value: yv[i] }));

  // --- window sweep on yearly season means
  const cells: HeatCell[] = [];
  for (let i = 0; i < years.length; i++) for (let j = i; j < years.length; j++) {
    const s = years[i], e = years[j];
    if (e - s + 1 < minYears) continue;
    const idx: number[] = []; for (let k = 0; k < years.length; k++) if (years[k] >= s && years[k] <= e) idx.push(k);
    if (idx.length < minYears) continue;
    const ws = windowStats(idx.map((k) => years[k]), idx.map((k) => yv[k]), alpha);
    cells.push({ start: s, end: e, n: ws.n, slope_per_decade: ws.slope, ci_low: ws.lo, ci_high: ws.hi, p: num(ws.p), significant: ws.p < alpha });
  }
  const full = w, slopes = cells.map((c) => c.slope_per_decade);
  const sameSign = cells.filter((c) => Math.sign(c.slope_per_decade) === Math.sign(full.slope)).length;
  const fullExcl = full.lo > 0 || full.hi < 0;
  const excl = (c: HeatCell) => c.ci_low > 0 || c.ci_high < 0;
  const metrics: HeatmapMetrics = {
    n_windows: cells.length,
    full_window: { slope_per_decade: full.slope, p: num(full.p), significant: full.p < alpha },
    direction_agreement: cells.length ? sameSign / cells.length : null,
    significant_fraction: cells.length ? cells.filter((c) => c.significant).length / cells.length : null,
    slope_dispersion: full.slope !== 0 && cells.length ? (percentile(slopes, 0.75) - percentile(slopes, 0.25)) / Math.abs(full.slope) : null,
    ci_stability: cells.length ? cells.filter((c) => excl(c) === fullExcl).length / cells.length : null,
    sign_flips: slopes.some((s) => s > 0) && slopes.some((s) => s < 0),
    verdict: "insufficient", verdict_text: "",
  };
  const [verdict, text] = classify(metrics, years.length);
  metrics.verdict = verdict; metrics.verdict_text = text;
  const starts = [...new Set(cells.map((c) => c.start))].sort((a, b) => a - b), ends = [...new Set(cells.map((c) => c.end))].sort((a, b) => a - b);

  // --- headline
  const analyses = { raw, deseasonalized, seasonal_mk, season_only };
  const prim = analyses[primary];
  const meanV = mean(yv); const slopesY = senSlopes(years, yv); const sY = median(slopesY);
  const icpt = median(yv.map((v, i) => v - sY * years[i]));
  const resid = yv.map((v, i) => v - (icpt + sY * years[i]));
  const sd = std(resid, 1);
  const hi = yv.indexOf(Math.max(...yv)), lo = yv.indexOf(Math.min(...yv));
  const keys = ["raw", "deseasonalized", "seasonal_mk", "season_only"] as const;
  const headline: Headline = {
    primary, n_years: years.length, first_year: years[0], last_year: years[years.length - 1],
    typical_value: meanV, yearly_sd: sd, total_change: (prim.slope_per_decade * (years.length - 1)) / 10,
    relative_change_pct_per_decade: meanV ? (prim.slope_per_decade / meanV) * 100 : null,
    highest_year: years[hi], lowest_year: years[lo],
    methods_significant: keys.filter((k) => analyses[k].significant).length, methods_total: 4,
    methods_agree_with_primary: keys.filter((k) => analyses[k].significant && Math.sign(analyses[k].slope_per_decade) === Math.sign(prim.slope_per_decade)).length,
  };

  // --- diagnostics
  const firstY = Number(rows[0].date.slice(0, 4)), lastY = Number(rows[rows.length - 1].date.slice(0, 4));
  const expected = rows.length, nValid = valid.length, pctMissing = expected ? (100 * (expected - nValid)) / expected : 0;
  const r1m = lag1(anom), r1y = lag1(resid);
  const outliers = resid.map((r, i) => ({ year: years[i], z: sd > 0 ? r / sd : 0 })).filter((o) => Math.abs(o.z) >= 2.5);
  const warnings: string[] = [];
  if (years.length < 15) warnings.push(`Only ${years.length} complete seasons: short records can hide real trends or exaggerate chance ones.`);
  if (pctMissing > 10) warnings.push(`${pctMissing.toFixed(0)}% of months are missing; check the gaps before trusting the result.`);
  if (incomplete.length) warnings.push(`${incomplete.length} season(s) were dropped because they were incomplete (${incomplete.slice(0, 6).join(", ")}${incomplete.length > 6 ? ", ..." : ""}).`);
  if (r1m != null && r1m > 0.5) warnings.push(`Month-to-month values are strongly autocorrelated (lag-1 r = ${r1m.toFixed(2)}). The seasonal Mann-Kendall can then be over-confident; prefer the yearly season means test or the Hamed-Rao corrected test.`);
  if (r1y != null && Math.abs(r1y) > 0.4) warnings.push(`Yearly residuals are autocorrelated (lag-1 r = ${r1y.toFixed(2)}); p-values from the yearly test may be too small.`);
  if (outliers.length) warnings.push(`Unusual year(s) relative to the trend line: ${outliers.map((o) => `${o.year} (${o.z > 0 ? "+" : ""}${o.z.toFixed(1)} SD)`).join(", ")}. Check whether they drive the result.`);
  if (metrics.verdict === "window_dependent") warnings.push("The conclusion depends on which years are included - see the window-sensitivity analysis.");
  const diagnostics: Diagnostics = {
    n_months: nValid, pct_missing: pctMissing, incomplete_seasons: incomplete,
    lag1_autocorr_monthly_anomalies: r1m, lag1_autocorr_yearly_residuals: r1y, outlier_years: outliers, warnings,
  };
  void firstY; void lastY; void allYears;

  const notes = [
    "Heatmap windows overlap heavily, so it is a descriptive sensitivity view, not many independent tests.",
    "Reanalysis data blend a weather model with satellite and ground observations; trends can be affected by changes in the observing system.",
    `Significance level alpha = ${alpha}; confidence intervals are ${Math.round((1 - alpha) * 100)}%. 'Not significant' does not mean 'no trend' - a longer record may be needed.`,
  ];
  return { series, climatology, analyses, annual_season_series, headline, heatmap: { min_years: minYears, basis: "season_only", starts, ends, cells, metrics }, diagnostics, notes };
}

function classify(m: HeatmapMetrics, nYears: number): [HeatmapMetrics["verdict"], string] {
  const da = m.direction_agreement ?? 0, sf = m.significant_fraction ?? 0;
  if (nYears < 15 || m.n_windows < 10) return ["insufficient", "The record is too short for a reliable window analysis. A longer record may reveal a trend that is not yet detectable."];
  if (m.full_window.significant && da >= 0.9 && sf >= 0.5) return ["robust", "The full-record trend is significant, almost every period you could have chosen points the same way, and most of them are individually significant. The conclusion does not hinge on the start or end year."];
  if (sf < 0.1 && !m.full_window.significant && da < 0.9) return ["no_clear_trend", "Across nearly all periods the trend is not significant and its direction is mixed: the data show no clear trend. That is not proof of no change - only that none is detectable here."];
  if (sf < 0.1 && !m.full_window.significant) return ["no_clear_trend", "The estimated direction is consistent, but almost no period reaches significance. There is a hint of a trend that is not yet statistically detectable; more data might change that."];
  return ["window_dependent", "Whether the trend looks real depends on which years you pick: its size, direction or significance changes between periods. Treat any single-period result with caution, and check which years or events drive it."];
}

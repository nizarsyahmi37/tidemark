// Shared contract between the API, the statistics engine and the UI.

export interface MonthlyRow { date: string; value: number | null } // date = "YYYY-MM"

export type RegionSpec =
  | { type: "point"; lat: number; lon: number; name?: string }
  | { type: "bbox"; west: number; south: number; east: number; north: number; name?: string };

export interface SeasonSpec { label: string; months: number[] } // months 1..12

export interface VariableDef {
  id: string;                // e.g. "precip"
  powerParam: string;        // NASA POWER parameter, e.g. "PRECTOTCORR"
  name: string;              // "Precipitation (bias-corrected)"
  shortName: string;         // "rainfall"
  category: string;          // "Water cycle" | "Temperature" | "Atmosphere" | "Land" | "Energy"
  units: string;             // "mm/day"
  unitLabel: string;         // "mm of rain per day"
  definition: string;        // plain-language
  whyItMatters: string;
  caveat?: string;
  sourceDataset: string;     // e.g. "MERRA-2 (bias-corrected with GPCP/CPCU gauge data)"
  recordStartYear: number;   // first year with data in POWER monthly
  defaultSeason?: SeasonSpec;
}

export interface AnalyseRequest {
  // exactly one of: (variableId + region) OR csv
  variableId?: string;
  region?: RegionSpec;
  startYear: number;
  endYear: number;
  season: SeasonSpec;
  alpha?: number;            // significance level, default 0.05
  minWindowYears?: number;   // default 8
  primary?: PrimaryMethod;   // default "season_only"
  csv?: { name: string; units: string; rows: MonthlyRow[] };
}

export type PrimaryMethod = "season_only" | "deseasonalized" | "seasonal_mk" | "raw";

export interface TrendResult {
  method: string;
  n: number;
  slope_per_decade: number;
  ci_low: number;
  ci_high: number;
  p: number | null;
  tau: number | null;
  trend: "increasing" | "decreasing" | "no_trend";
  significant: boolean;
  plain: string;
}

export interface HeatCell {
  start: number; end: number; n: number;
  slope_per_decade: number; ci_low: number; ci_high: number; p: number | null; significant: boolean;
}

export interface HeatmapMetrics {
  n_windows: number;
  full_window: { slope_per_decade: number; p: number | null; significant: boolean };
  direction_agreement: number | null;
  significant_fraction: number | null;
  slope_dispersion: number | null;
  ci_stability: number | null;
  sign_flips: boolean;
  verdict: "robust" | "window_dependent" | "no_clear_trend" | "insufficient";
  verdict_text: string;
}

export interface Headline {
  primary: PrimaryMethod;
  n_years: number; first_year: number; last_year: number;
  typical_value: number; yearly_sd: number; total_change: number;
  relative_change_pct_per_decade: number | null;
  highest_year: number; lowest_year: number;
  methods_significant: number; methods_total: number; methods_agree_with_primary: number;
}

export interface Diagnostics {
  n_months: number;
  pct_missing: number;                    // 0..100 of months in the requested period
  incomplete_seasons: number[];           // years dropped because the season was incomplete
  lag1_autocorr_monthly_anomalies: number | null;
  lag1_autocorr_yearly_residuals: number | null;
  outlier_years: { year: number; z: number }[]; // |z| >= 2.5 vs. fitted trend
  warnings: string[];                     // plain-language warnings (short record, many gaps, strong autocorrelation...)
}

export interface Provenance {
  source: string;             // "NASA POWER (MERRA-2 ...)" or "User-supplied CSV"
  dataset: string;
  powerParam?: string;
  gridPoints?: { lat: number; lon: number }[];
  requestUrls?: string[];
  fetchedAt: string;          // ISO
  citation: string;           // human-readable citation text
  bibtex: string;
}

export interface AnalysisDoc {
  id: string;
  mock?: boolean;
  title: string;
  subtitle: string;
  variable: {
    name: string; units: string; unit_label: string; short_name: string;
    definition: string; caveat?: string; source: string; temporal_resolution: "monthly";
  };
  region: { name: string; bbox: [number, number, number, number]; n_gridcells: number };
  period: { start: string; end: string };
  season: SeasonSpec;
  series: { date: string; value: number | null; anomaly: number | null }[];
  climatology: { month: number; mean: number }[];
  analyses: { raw: TrendResult; deseasonalized: TrendResult; seasonal_mk: TrendResult; season_only: TrendResult };
  annual_season_series: { year: number; value: number }[];
  headline: Headline;
  heatmap: { min_years: number; basis: string; starts: number[]; ends: number[]; cells: HeatCell[]; metrics: HeatmapMetrics };
  validation?: { pymannkendall_agrees: boolean; max_abs_diff?: Record<string, number>; report?: string };
  notes: string[];
  diagnostics?: Diagnostics;
  provenance?: Provenance;
  request?: AnalyseRequest;
}

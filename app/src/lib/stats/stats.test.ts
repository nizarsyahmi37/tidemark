import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { normCdf, normPpf } from "./math";
import { analyseSeries } from "./index";
import type { AnalysisDoc, MonthlyRow } from "../types";

const root = path.resolve(__dirname, "../../..");
const load = (id: string) => {
  const csv = fs.readFileSync(path.resolve(root, "../data/series", `${id}.csv`), "utf8").trim().split("\n").slice(1);
  const rows: MonthlyRow[] = csv.map((l) => { const [d, v] = l.split(","); return { date: d, value: Number(v) }; });
  const doc = JSON.parse(fs.readFileSync(path.resolve(root, "src/data", `${id}.json`), "utf8")) as AnalysisDoc;
  return { rows, doc };
};
const close = (a: number | null, b: number | null, tol = 1e-6) => { if (a == null || b == null) { expect(a).toBe(b); return; } expect(Math.abs(a - b)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(b))); };

describe("math", () => {
  it("normal cdf/ppf", () => {
    close(normCdf(1.96), 0.9750021048517795, 1e-12); close(normCdf(-3.5), 2.326290790355250e-4, 1e-9);
    close(normCdf(-5), 2.866515718791939e-7, 1e-9); close(normPpf(0.975), 1.959963984540054, 1e-10); close(normPpf(0.001), -3.090232306167813, 1e-9);
  });
});

for (const [id, cfg] of [["wisconsin_aod", { months: [6, 7, 8], label: "June-August" }], ["klang_valley_rain", { months: [1,2,3,4,5,6,7,8,9,10,11,12], label: "Whole year" }], ["iowa_soil_moisture", { months: [6, 7, 8], label: "June-August (growing season)" }]] as const) {
  describe(`parity with Python engine: ${id}`, () => {
    const { rows, doc } = load(id);
    const out = analyseSeries(rows, { season: { label: cfg.label, months: [...cfg.months] }, units: doc.variable.units, unitLabel: doc.variable.unit_label, shortName: doc.variable.short_name });
    for (const k of ["raw", "deseasonalized", "seasonal_mk", "season_only"] as const) {
      it(`analysis ${k}`, () => {
        const a = out.analyses[k], b = doc.analyses[k];
        close(a.slope_per_decade, b.slope_per_decade, 1e-5); close(a.ci_low, b.ci_low, 1e-5); close(a.ci_high, b.ci_high, 1e-5); close(a.p, b.p, 1e-4); expect(a.n).toBe(b.n); expect(a.significant).toBe(b.significant);
      });
    }
    it("heatmap", () => {
      expect(out.heatmap.cells.length).toBe(doc.heatmap.cells.length);
      const m = out.heatmap.metrics, n = doc.heatmap.metrics;
      close(m.direction_agreement, n.direction_agreement, 1e-6); close(m.significant_fraction, n.significant_fraction, 1e-6); close(m.slope_dispersion, n.slope_dispersion, 1e-5); close(m.ci_stability, n.ci_stability, 1e-6); expect(m.verdict).toBe(n.verdict);
      for (let i = 0; i < doc.heatmap.cells.length; i += 37) { const a = out.heatmap.cells[i], b = doc.heatmap.cells[i]; expect([a.start, a.end]).toEqual([b.start, b.end]); close(a.slope_per_decade, b.slope_per_decade, 1e-5); close(a.p, b.p, 1e-4); }
    });
    it("headline", () => { const a = out.headline, b = doc.headline; close(a.typical_value, b.typical_value, 1e-5); close(a.yearly_sd, b.yearly_sd, 1e-4); close(a.total_change, b.total_change, 1e-5); expect(a.n_years).toBe(b.n_years); expect(a.highest_year).toBe(b.highest_year); });
  });
}

describe("synthetic", () => {
  it("recovers a known trend and handles DJF seasons", () => {
    const rows: MonthlyRow[] = []; let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let y = 2000; y < 2030; y++) for (let m = 1; m <= 12; m++) rows.push({ date: `${y}-${String(m).padStart(2, "0")}`, value: 5 + 0.05 * (y - 2000 + m / 12) + Math.sin((2 * Math.PI * m) / 12) + (rnd() - 0.5) * 0.4 });
    const out = analyseSeries(rows, { season: { label: "DJF", months: [12, 1, 2] }, units: "u", unitLabel: "u", shortName: "x" });
    expect(Math.abs(out.analyses.season_only.slope_per_decade - 0.5)).toBeLessThan(0.1); expect(out.analyses.season_only.significant).toBe(true);
    expect(out.annual_season_series[0].year).toBe(2001); // first complete DJF = Dec 2000 + Jan/Feb 2001
  });
  it("rejects too-short input", () => { expect(() => analyseSeries([{ date: "2000-01", value: 1 }], { season: { label: "a", months: [1] }, units: "", unitLabel: "", shortName: "x" })).toThrow(); });
});

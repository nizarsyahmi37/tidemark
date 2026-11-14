import { mean, median, normCdf, normPpf, percentile, rankAvg } from "./math";

export interface MkResult { S: number; varS: number; z: number; p: number; tau: number; n: number }

/** Classic Mann-Kendall with tie correction (matches pymannkendall.original_test). */
export function mkTest(yIn: ArrayLike<number>): MkResult {
  const y: number[] = []; for (let i = 0; i < yIn.length; i++) if (Number.isFinite(yIn[i])) y.push(yIn[i]);
  const n = y.length;
  if (n < 4) return { S: 0, varS: NaN, z: NaN, p: NaN, tau: NaN, n };
  let S = 0;
  for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) S += Math.sign(y[j] - y[i]);
  const counts = new Map<number, number>(); for (const v of y) counts.set(v, (counts.get(v) ?? 0) + 1);
  let tie = 0; for (const c of counts.values()) tie += c * (c - 1) * (2 * c + 5);
  const varS = (n * (n - 1) * (2 * n + 5) - tie) / 18;
  const z = S === 0 ? 0 : (S - Math.sign(S)) / Math.sqrt(varS);
  const p = 2 * (1 - normCdf(Math.abs(z)));
  return { S, varS, z, p, tau: S / (n * (n - 1) / 2), n };
}

/** All pairwise slopes (y_j - y_i)/(t_j - t_i), skipping non-finite y and equal t. */
export function senSlopes(t: ArrayLike<number>, y: ArrayLike<number | null>): number[] {
  const tt: number[] = [], yy: number[] = [];
  for (let i = 0; i < y.length; i++) { const v = y[i]; if (v != null && Number.isFinite(v)) { tt.push(t[i]); yy.push(v); } }
  const out: number[] = [];
  for (let i = 0; i < yy.length - 1; i++) for (let j = i + 1; j < yy.length; j++) { const dt = tt[j] - tt[i]; if (dt !== 0) out.push((yy[j] - yy[i]) / dt); }
  return out;
}

/** Sen's-slope CI (Gilbert 1987) from a given Var(S). Returns [lo, hi] in slope units. */
export function gilbertCI(slopes: number[], varS: number, alpha = 0.05): [number, number] {
  const N = slopes.length;
  if (!N || !Number.isFinite(varS)) return [NaN, NaN];
  const s = Float64Array.from(slopes).sort();
  const c = normPpf(1 - alpha / 2) * Math.sqrt(varS);
  const m1 = Math.floor((N - c) / 2), m2 = Math.ceil((N + c) / 2);
  return [s[Math.max(m1 - 1, 0)], s[Math.min(m2, N - 1)]];
}

/** Variance of S after Hamed & Rao (1998) autocorrelation correction, as in pymannkendall (all lags). Falls back to uncorrected if the factor is < 1 or not finite. */
export function hamedRaoVarS(y: number[], alpha = 0.05): { varS: number; varUncorrected: number; factor: number } {
  const n = y.length;
  const mk = mkTest(y);
  const slopesIdx = senSlopes(Array.from({ length: n }, (_, i) => i), y);
  const slope = median(slopesIdx);
  const detr = y.map((v, i) => v - (i + 1) * slope);
  const I = rankAvg(detr);
  const mu = mean(I); const yc = I.map((v) => v - mu);
  const acov0 = yc.reduce((a, v) => a + v * v, 0) / n;
  const interval = normPpf(1 - alpha / 2) / Math.sqrt(n);
  let sni = 0;
  for (let lag = 1; lag < n; lag++) {
    let c = 0; for (let i = 0; i < n - lag; i++) c += yc[i] * yc[i + lag];
    const rho = c / n / acov0;
    if (!(rho <= interval && rho >= -interval)) sni += (n - lag) * (n - lag - 1) * (n - lag - 2) * rho;
  }
  const factor = 1 + (2 / (n * (n - 1) * (n - 2))) * sni;
  const varHr = mk.varS * factor;
  return { varS: Number.isFinite(varHr) && varHr > mk.varS ? varHr : mk.varS, varUncorrected: mk.varS, factor };
}

export interface WindowStat { slope: number; lo: number; hi: number; p: number; tau: number; n: number }
/** MK + Sen's slope per decade for (years, values) using the uncorrected variance. */
export function windowStats(years: number[], vals: number[], alpha = 0.05): WindowStat {
  const mk = mkTest(vals); const sl = senSlopes(years, vals);
  const [lo, hi] = gilbertCI(sl, mk.varS, alpha);
  return { slope: median(sl) * 10, lo: lo * 10, hi: hi * 10, p: mk.p, tau: mk.tau, n: vals.length };
}
export { percentile };

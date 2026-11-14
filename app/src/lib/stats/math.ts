// Numerical helpers (no dependencies). Accuracy targets ~1e-12 for the normal CDF / quantile.

const SQRT2 = Math.SQRT2;

/** erf via Maclaurin series for |x| < 3, erfc via continued fraction beyond. */
function erfSeries(x: number): number {
  let term = x, sum = x;
  for (let n = 1; n < 200; n++) {
    term *= -x * x / n;
    const add = term / (2 * n + 1);
    sum += add;
    if (Math.abs(add) < 1e-17 * Math.abs(sum)) break;
  }
  return (2 / Math.sqrt(Math.PI)) * sum;
}
function erfcCF(x: number): number { // x >= 3, modified Lentz
  const tiny = 1e-300;
  let f = tiny, C = f, D = 0;
  // erfc(x) = exp(-x^2)/(x sqrt(pi)) * 1/(1+ 1/(2x^2)/(1+ 2/(2x^2)/(1+ ...)))
  // use the standard CF: erfc(x) = exp(-x^2)/sqrt(pi) * 1/(x+ (1/2)/(x+ 1/(x+ (3/2)/(x+ 2/(x+ ...)))))
  const b0 = x;
  f = b0; C = b0; D = 0;
  for (let k = 1; k < 500; k++) {
    const a = k / 2;
    D = x + a * D; if (D === 0) D = tiny; D = 1 / D;
    C = x + a / C; if (C === 0) C = tiny;
    const delta = C * D; f *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  return Math.exp(-x * x) / Math.sqrt(Math.PI) / f;
}
export function erfc(x: number): number {
  if (x < 0) return 2 - erfc(-x);
  if (x < 3) return 1 - erfSeries(x);
  return erfcCF(x);
}
export function normCdf(z: number): number { return 0.5 * erfc(-z / SQRT2); }

/** Inverse normal CDF: Acklam initial guess + Halley refinement. */
export function normPpf(p: number): number {
  if (!(p > 0 && p < 1)) { if (p === 0) return -Infinity; if (p === 1) return Infinity; return NaN; }
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const plow = 0.02425, phigh = 1 - plow;
  let x: number;
  if (p < plow) { const q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
  else if (p <= phigh) { const q = p - 0.5, r = q*q; x = (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1); }
  else { const q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
  for (let i = 0; i < 3; i++) { // Halley
    const e = normCdf(x) - p;
    const u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
    x = x - u / (1 + x * u / 2);
  }
  return x;
}

export function median(a: number[]): number {
  if (!a.length) return NaN;
  const s = Float64Array.from(a).sort();
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export function percentile(a: number[], q: number): number { // linear interpolation (numpy default)
  if (!a.length) return NaN;
  const s = Float64Array.from(a).sort();
  const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}
export function mean(a: number[]): number { let s = 0; for (const v of a) s += v; return s / a.length; }
export function std(a: number[], ddof = 1): number {
  if (a.length <= ddof) return NaN;
  const m = mean(a); let s = 0; for (const v of a) s += (v - m) ** 2; return Math.sqrt(s / (a.length - ddof));
}
/** Average ranks (ties share the mean rank), like scipy.stats.rankdata. */
export function rankAvg(a: number[]): number[] {
  const idx = a.map((v, i) => i).sort((i, j) => a[i] - a[j]);
  const r = new Array<number>(a.length);
  let i = 0;
  while (i < idx.length) {
    let j = i; while (j + 1 < idx.length && a[idx[j + 1]] === a[idx[i]]) j++;
    const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k]] = avg; i = j + 1;
  }
  return r;
}
/** Pearson correlation between x[t] and x[t-1] for pairs where both are finite. */
export function lag1(a: (number | null)[]): number | null {
  const xs: number[] = [], ys: number[] = [];
  for (let i = 1; i < a.length; i++) { const p = a[i - 1], q = a[i]; if (p != null && q != null && Number.isFinite(p) && Number.isFinite(q)) { xs.push(p); ys.push(q); } }
  if (xs.length < 8) return null;
  const mx = mean(xs), my = mean(ys); let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) { sxy += (xs[i]-mx)*(ys[i]-my); sxx += (xs[i]-mx)**2; syy += (ys[i]-my)**2; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}
/** numpy-like "g" formatting with n significant digits. */
export function fmtG(x: number, n = 3): string {
  if (!Number.isFinite(x)) return String(x);
  if (x === 0) return "0";
  const s = Number(x.toPrecision(n));
  const abs = Math.abs(s);
  if (abs >= 1e-4 && abs < 10 ** n) return String(s);
  return s.toExponential(Math.max(0, n - 1)).replace(/\.?0+e/, "e");
}

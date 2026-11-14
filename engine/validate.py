"""Validation: (1) own implementations vs pymannkendall/scipy, (2) synthetic series with known trends,
(3) calibration of false-alarm rate / CI coverage / verdict behaviour. Writes docs/validation.json + docs/VALIDATION.md"""
import json, os, sys, numpy as np, pandas as pd
from scipy import stats
import pymannkendall as pmk
sys.path.insert(0, os.path.dirname(__file__))
import trend_engine as te
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rng = np.random.default_rng(42)
out = {"crosscheck": {}, "synthetic": {}, "verdicts": {}}

def synth(n_years=24, slope_dec=0.0, phi=0.0, amp=1.0, noise=0.5, step=None, step_year=None, seed=None):
    r = np.random.default_rng(seed)
    n = n_years * 12; t = np.arange(n) / 12.0
    e = np.zeros(n); u = r.normal(0, noise, n)
    for i in range(1, n): e[i] = phi * e[i-1] + u[i]
    y = 5 + slope_dec/10 * t + amp * np.sin(2*np.pi*t) + e
    if step: y = y + step * (t >= step_year)
    dates = [f"{2000 + k//12}-{k%12+1:02d}" for k in range(n)]
    df = pd.DataFrame({"date": dates, "value": y}); df["month"] = df["date"].str[5:7].astype(int)
    df["anomaly"] = df["value"] - df["month"].map(df.groupby("month")["value"].mean())
    return df

# ---- 1. cross-check against pymannkendall / scipy
mx = {"mk_p": 0, "mk_S": 0, "slope": 0, "ci_vs_scipy": 0, "seasonal_p": 0, "seasonal_slope": 0}
for k in range(40):
    df = synth(20, slope_dec=rng.uniform(-1, 1), phi=rng.uniform(0, .6), seed=100+k)
    y = df["value"].to_numpy(); mk = te.mk_test(y); ref = pmk.original_test(y)
    mx["mk_p"] = max(mx["mk_p"], abs(mk["p"] - ref.p)); mx["mk_S"] = max(mx["mk_S"], abs(mk["S"] - ref.s))
    sl = te.sen_slopes(np.arange(len(y)), y); mx["slope"] = max(mx["slope"], abs(np.median(sl) - ref.slope))
    ts = stats.theilslopes(y, np.arange(len(y)), 0.95)
    lo, hi = te.gilbert_ci(sl, mk["var_s"])
    mx["ci_vs_scipy"] = max(mx["ci_vs_scipy"], abs(lo - ts[2]) / abs(ts[0] or 1), abs(hi - ts[3]) / abs(ts[0] or 1))
    s_ref = pmk.seasonal_test(y, period=12); sl_s, S, var = te.seasonal_slopes(df)
    z = 0 if S == 0 else (S - np.sign(S)) / np.sqrt(var); p = 2*(1 - stats.norm.cdf(abs(z)))
    mx["seasonal_p"] = max(mx["seasonal_p"], abs(p - s_ref.p)); mx["seasonal_slope"] = max(mx["seasonal_slope"], abs(np.median(sl_s) - s_ref.slope))
out["crosscheck"] = {"max_abs_diff": mx, "n_series": 40, "note": "own MK/Sen/seasonal MK vs pymannkendall; CI diff is relative to scipy.theilslopes CI (iid), small differences expected from rank rounding"}

# ---- 2. synthetic: recovery, coverage, false alarms
REPS = 300
def run(slope_dec, phi, label):
    cover = {"raw": 0, "deseasonalized": 0, "seasonal_mk": 0}; sig = {"raw": 0, "deseasonalized": 0, "seasonal_mk": 0}
    est = []
    for r in range(REPS):
        df = synth(24, slope_dec, phi, seed=1000 + r)
        a = {"raw": te.analyse_raw(df, "u", "x"), "deseasonalized": te.analyse_deseasonalized(df, "u", "x"),
             "seasonal_mk": te.analyse_seasonal_mk(df, "u", "x")}
        for k, v in a.items():
            cover[k] += v["ci_low"] <= slope_dec <= v["ci_high"]; sig[k] += v["significant"]
        est.append(a["deseasonalized"]["slope_per_decade"])
    return {"true_slope_per_decade": slope_dec, "ar1_phi": phi, "reps": REPS, "mean_estimate": float(np.mean(est)),
            "ci_coverage": {k: v / REPS for k, v in cover.items()}, "significant_rate": {k: v / REPS for k, v in sig.items()}}
out["synthetic"]["known_trend_iid"] = run(0.8, 0.0, "trend, iid")
out["synthetic"]["known_trend_ar1"] = run(0.8, 0.6, "trend, AR(1)=0.6")
out["synthetic"]["null_iid"] = run(0.0, 0.0, "no trend, iid")
out["synthetic"]["null_ar1"] = run(0.0, 0.6, "no trend, AR(1)=0.6  (false-alarm rate should be ~5%)")

# ---- 2b. false-alarm rate of the yearly season-mean test (the series the heatmap/verdict uses)
def yearly_fa(phi, reps=400, years=30):
    fa = 0
    for r in range(reps):
        df = synth(years, 0.0, phi, seed=9000 + r)
        ys = te.season_series(df, list(range(1, 13)))
        fa += te.window_stats(ys.index.to_numpy(float), ys.to_numpy())["p"] < 0.05
    return fa / reps
out["synthetic"]["yearly_series_false_alarm"] = {"monthly_ar1_0.0": yearly_fa(0.0), "monthly_ar1_0.6": yearly_fa(0.6), "reps": 400, "years": 30}

# ---- 3. verdict behaviour on annual season series
def verdicts(kind, reps=100):
    cnt = {}
    for r in range(reps):
        if kind == "strong_trend": df = synth(30, 1.5, 0.3, noise=0.5, seed=5000+r)
        elif kind == "no_trend": df = synth(30, 0.0, 0.3, noise=0.5, seed=6000+r)
        elif kind == "late_step": df = synth(30, 0.0, 0.0, noise=0.4, step=1.2, step_year=24, seed=7000+r)
        elif kind == "short_record": df = synth(10, 1.5, 0.3, seed=8000+r)
        ys = te.season_series(df, list(range(1, 13)))
        v = te.window_sweep(ys, 8)["metrics"]["verdict"]; cnt[v] = cnt.get(v, 0) + 1
    return {k: v / reps for k, v in cnt.items()}
for kind in ["strong_trend", "no_trend", "late_step", "short_record"]:
    out["verdicts"][kind] = verdicts(kind)

json.dump(out, open(f"{ROOT}/docs/validation.json", "w"), indent=1)
s = out["synthetic"]
md = ["# Validation report (auto-generated by engine/validate.py)\n",
      "## 1. Cross-check vs pymannkendall / scipy\n", f"Max absolute differences over 40 random series: `{mx}`\n",
      "## 2. Synthetic series with known trend (24 years monthly, seasonal cycle + noise, 300 repetitions)\n",
      "| scenario | true slope/decade | mean estimate | CI coverage (raw / deseas. / seasonal) | significant rate (raw / deseas. / seasonal) |", "|---|---|---|---|---|"]
for k, v in [(a, b) for a, b in s.items() if "ci_coverage" in b]:
    md.append(f"| {k} (AR1={v['ar1_phi']}) | {v['true_slope_per_decade']} | {v['mean_estimate']:.3f} | "
              + " / ".join(f"{v['ci_coverage'][x]:.2f}" for x in ['raw','deseasonalized','seasonal_mk']) + " | "
              + " / ".join(f"{v['significant_rate'][x]:.2f}" for x in ['raw','deseasonalized','seasonal_mk']) + " |")
md += ["\nNominal CI coverage is 0.95 and the nominal false-alarm rate is 0.05. Values far from these indicate where a method is unreliable (notably raw MK under autocorrelation).\n",
       "\n**False-alarm rate of the yearly season-mean test (30 years, no true trend, nominal 0.05):** `%s`\n" % json.dumps(s["yearly_series_false_alarm"]),
       "## 3. Window-sweep verdicts on synthetic yearly series (100 repetitions each)\n", "```", json.dumps(out["verdicts"], indent=1), "```"]
open(f"{ROOT}/docs/VALIDATION.md", "w").write("\n".join(md))
print(json.dumps(out, indent=1))

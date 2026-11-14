"""Tidemark statistics engine (Python reference implementation).

Everything is reported as slope per DECADE (value units / 10 years).
Own implementations (mk_test, sen_slopes, gilbert_ci) are cross-checked against pymannkendall in validate.py.
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from scipy import stats
import pymannkendall as pmk

ALPHA = 0.05


# ---------------------------------------------------------------- core primitives
def mk_test(y):
    """Classic Mann-Kendall with tie correction. Returns dict(S, var_s, z, p, tau)."""
    y = np.asarray(y, float)
    y = y[~np.isnan(y)]
    n = len(y)
    if n < 4:
        return dict(S=0.0, var_s=np.nan, z=np.nan, p=np.nan, tau=np.nan, n=n)
    diff = np.sign(y[None, :] - y[:, None])
    S = float(np.triu(diff, 1).sum())
    _, counts = np.unique(y, return_counts=True)
    var_s = (n * (n - 1) * (2 * n + 5) - np.sum(counts * (counts - 1) * (2 * counts + 5))) / 18.0
    z = 0.0 if S == 0 else (S - np.sign(S)) / np.sqrt(var_s)
    p = 2 * (1 - stats.norm.cdf(abs(z)))
    return dict(S=S, var_s=float(var_s), z=float(z), p=float(p), tau=float(S / (n * (n - 1) / 2)), n=n)


def sen_slopes(t, y):
    t = np.asarray(t, float); y = np.asarray(y, float)
    ok = ~np.isnan(y); t, y = t[ok], y[ok]
    i, j = np.triu_indices(len(y), 1)
    dt = t[j] - t[i]
    keep = dt != 0
    return (y[j] - y[i])[keep] / dt[keep]


def gilbert_ci(slopes, var_s, alpha=ALPHA):
    """Sen's-slope confidence interval (Gilbert 1987) using a given Var(S) (may be autocorrelation-corrected)."""
    s = np.sort(slopes)
    N = len(s)
    if N == 0 or not np.isfinite(var_s):
        return np.nan, np.nan
    c = stats.norm.ppf(1 - alpha / 2) * np.sqrt(var_s)
    m1 = int(np.floor((N - c) / 2.0))        # 1-based rank of lower limit
    m2 = int(np.ceil((N + c) / 2.0))         # 1-based rank (M2+1) of upper limit -> 0-based index m2
    lo = s[max(m1 - 1, 0)]
    hi = s[min(m2, N - 1)]
    return float(lo), float(hi)


def _verdict_trend(p, slope):
    if not np.isfinite(p):
        return "no_trend"
    if p >= ALPHA:
        return "no_trend"
    return "increasing" if slope > 0 else "decreasing"


def _fmt(x, d=3):
    return f"{x:.{d}g}"


def _plain(res, units, what):
    s, lo, hi = res["slope_per_decade"], res["ci_low"], res["ci_high"]
    if res["trend"] == "no_trend":
        return (f"{what}: estimated change {_fmt(s)} {units} per decade (95% CI {_fmt(lo)} to {_fmt(hi)}), "
                f"p = {res['p']:.2f}. Not statistically significant - this does not prove there is no trend; "
                f"a longer record might settle it.")
    word = "rose" if res["trend"] == "increasing" else "fell"
    return (f"{what} {word} by about {_fmt(abs(s))} {units} per decade (95% CI {_fmt(lo)} to {_fmt(hi)}), "
            f"p = {res['p']:.3f}: statistically significant.")


# ---------------------------------------------------------------- analyses
def _result(method, n, slope_dec, lo, hi, p, tau, units, what):
    r = dict(method=method, n=int(n), slope_per_decade=float(slope_dec), ci_low=float(lo), ci_high=float(hi),
             p=float(p), tau=float(tau))
    r["trend"] = _verdict_trend(p, slope_dec)
    r["significant"] = bool(np.isfinite(p) and p < ALPHA)
    r["plain"] = _plain(r, units, what)
    return r


def analyse_raw(df, units, what):
    """Naive: monthly series, ignores seasonality and autocorrelation. Shown for contrast."""
    y = df["value"].to_numpy(); t = np.arange(len(y)) / 12.0     # years
    mk = mk_test(y); sl = sen_slopes(t, y)
    lo, hi = gilbert_ci(sl, mk["var_s"])
    return _result("Mann-Kendall + Sen's slope on raw monthly values (ignores seasons & autocorrelation)",
                   len(y), np.nanmedian(sl) * 10, lo * 10, hi * 10, mk["p"], mk["tau"], units, what)


def analyse_deseasonalized(df, units, what):
    """Monthly anomalies + Hamed-Rao autocorrelation-corrected variance (never allowed to shrink below the
    uncorrected variance, since a negative-autocorrelation 'correction' on short records is unreliable)."""
    y = df["anomaly"].to_numpy(); t = np.arange(len(y)) / 12.0
    yy = y[~np.isnan(y)]
    mk = mk_test(yy)
    hr = pmk.hamed_rao_modification_test(yy)
    var_c = hr.var_s if np.isfinite(hr.var_s) and hr.var_s > mk["var_s"] else mk["var_s"]
    z = 0.0 if mk["S"] == 0 else (mk["S"] - np.sign(mk["S"])) / np.sqrt(var_c)
    p = 2 * (1 - stats.norm.cdf(abs(z)))
    sl = sen_slopes(t, y)
    lo, hi = gilbert_ci(sl, var_c)
    return _result("Hamed-Rao modified Mann-Kendall + Sen's slope on monthly anomalies",
                   len(yy), np.nanmedian(sl) * 10, lo * 10, hi * 10, p, mk["tau"], units, what)


def seasonal_slopes(df):
    """Pooled within-calendar-month Sen slopes (per year) and Seasonal-MK S / Var(S)."""
    d = df.copy(); d["year"] = d["date"].str[:4].astype(int); d["month"] = d["date"].str[5:7].astype(int)
    slopes, S, var = [], 0.0, 0.0
    for m, g in d.groupby("month"):
        g = g.dropna(subset=["value"])
        if len(g) < 4: continue
        mk = mk_test(g["value"].to_numpy())
        S += mk["S"]; var += mk["var_s"]
        slopes.append(sen_slopes(g["year"].to_numpy(), g["value"].to_numpy()))
    return np.concatenate(slopes), S, var


def analyse_seasonal_mk(df, units, what):
    sl, S, var = seasonal_slopes(df)
    z = 0.0 if S == 0 else (S - np.sign(S)) / np.sqrt(var)
    p = 2 * (1 - stats.norm.cdf(abs(z)))
    lo, hi = gilbert_ci(sl, var)
    n = int(df["value"].notna().sum())
    return _result("Seasonal Mann-Kendall (each calendar month tested separately, then pooled) + Sen's slope",
                   n, np.median(sl) * 10, lo * 10, hi * 10, p, float('nan'), units, what)


def season_series(df, months):
    d = df.copy(); d["year"] = d["date"].str[:4].astype(int); d["month"] = d["date"].str[5:7].astype(int)
    d = d[d["month"].isin(months)]
    g = d.groupby("year")["value"].agg(["mean", "count"])
    g = g[g["count"] == len(months)]            # only complete seasons
    return g["mean"].round(10)   # round so exact ties are detected consistently across implementations


def window_stats(years, vals):
    mk = mk_test(vals); sl = sen_slopes(years, vals)
    lo, hi = gilbert_ci(sl, mk["var_s"])
    return dict(slope=float(np.median(sl)) * 10, lo=lo * 10, hi=hi * 10, p=mk["p"], tau=mk["tau"], n=len(vals))


def analyse_season_only(ys, units, what, label):
    w = window_stats(ys.index.to_numpy(float), ys.to_numpy())
    return _result(f"Mann-Kendall + Sen's slope on yearly {label} means", w["n"], w["slope"], w["lo"], w["hi"],
                   w["p"], w["tau"], units, what)


# ---------------------------------------------------------------- window sweep (heatmap)
def window_sweep(ys: pd.Series, min_years=8):
    years = ys.index.to_numpy(int); vals = ys.to_numpy()
    cells = []
    for i, s in enumerate(years):
        for j, e in enumerate(years):
            if e - s + 1 < min_years: continue
            sel = (years >= s) & (years <= e)
            if sel.sum() < min_years: continue
            w = window_stats(years[sel].astype(float), vals[sel])
            cells.append(dict(start=int(s), end=int(e), n=int(w["n"]), slope_per_decade=w["slope"], ci_low=w["lo"],
                              ci_high=w["hi"], p=w["p"], significant=bool(w["p"] < ALPHA)))
    full = window_stats(years.astype(float), vals)
    sl = np.array([c["slope_per_decade"] for c in cells])
    sig = np.array([c["significant"] for c in cells])
    same_sign = np.sign(sl) == np.sign(full["slope"])
    full_ci_excl = (full["lo"] > 0) or (full["hi"] < 0)
    cell_excl = np.array([(c["ci_low"] > 0) or (c["ci_high"] < 0) for c in cells])
    m = dict(n_windows=len(cells),
             full_window=dict(slope_per_decade=full["slope"], p=full["p"], significant=bool(full["p"] < ALPHA)),
             direction_agreement=float(same_sign.mean()) if len(cells) else None,
             significant_fraction=float(sig.mean()) if len(cells) else None,
             slope_dispersion=(float((np.percentile(sl, 75) - np.percentile(sl, 25)) / abs(full["slope"]))
                               if full["slope"] != 0 and len(cells) else None),
             ci_stability=float((cell_excl == full_ci_excl).mean()) if len(cells) else None,
             sign_flips=bool(len(cells) and (sl > 0).any() and (sl < 0).any()))
    m["verdict"], m["verdict_text"] = classify(m, len(years), min_years)
    starts = sorted({c["start"] for c in cells}); ends = sorted({c["end"] for c in cells})
    return dict(min_years=min_years, starts=starts, ends=ends, cells=cells, metrics=m)


def classify(m, n_years, min_years):
    """Transparent heuristic thresholds (calibrated on synthetic series in validate.py; NOT universal standards)."""
    if n_years < 15 or m["n_windows"] < 10:
        return "insufficient", ("The record is too short for a reliable window analysis. A longer record may reveal "
                                "a trend that is not yet detectable.")
    da, sf = m["direction_agreement"], m["significant_fraction"]
    if m["full_window"]["significant"] and da >= 0.9 and sf >= 0.5:
        return "robust", ("The full-record trend is significant, almost every period you could have chosen points the "
                          "same way, and most of them are individually significant. The conclusion does not hinge on "
                          "the start or end year.")
    if sf < 0.1 and not m["full_window"]["significant"] and da < 0.9:
        return "no_clear_trend", ("Across nearly all periods the trend is not significant and its direction is mixed: "
                                  "the data show no clear trend. That is not proof of no change - only that none is detectable here.")
    if sf < 0.1 and not m["full_window"]["significant"]:
        return "no_clear_trend", ("The estimated direction is consistent, but almost no period reaches significance. "
                                  "There is a hint of a trend that is not yet statistically detectable; more data might change that.")
    return "window_dependent", ("Whether the trend looks real depends on which years you pick: its size, direction or "
                                "significance changes between periods. Treat any single-period result with caution, and "
                                "check which years or events drive it.")


# ---------------------------------------------------------------- series prep
def monthly_frame(csv_path):
    df = pd.read_csv(csv_path)
    df["date"] = df["date"].astype(str)
    df["month"] = df["date"].str[5:7].astype(int)
    clim = df.groupby("month")["value"].mean()
    df["anomaly"] = df["value"] - df["month"].map(clim)
    return df, clim

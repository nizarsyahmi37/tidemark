"""Run the full analysis for each demo and write app/src/data/<id>.json (+ index.json)."""
import json, os, sys, math
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import trend_engine as te
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AOD_CAVEAT = ("AOD measures how much sunlight aerosols (smoke, dust, haze, pollution) block through the whole atmospheric "
              "column. It is NOT a direct measure of smoke or of surface air pollution (PM2.5), and clouds and retrieval "
              "quality can affect it. Here it is a MERRA-2 reanalysis product, not a raw satellite retrieval.")
DEMOS = {
 "wisconsin_aod": dict(
    title="Is the air over Wisconsin getting smokier?", subtitle="Summer aerosol optical depth, 2002-2025",
    variable=dict(name="Aerosol Optical Depth (550 nm)", units="unitless", unit_label="AOD units (0 = clear air)", short_name="summer haze (AOD)",
        definition="How much sunlight is blocked by tiny particles floating in the air (smoke, dust, haze). 0 is perfectly clear; values above ~0.5 are hazy. It is measured through the whole column of air, not at the ground.",
        caveat=AOD_CAVEAT),
    season=dict(label="June-August", months=[6, 7, 8]), what="Summer aerosol optical depth",
    extra=["The challenge video suggests summer AOD over Wisconsin may be increasing (MODIS Aqua via Giovanni). This demo uses MERRA-2 AOD, a model-based product that also assimilates satellite data, so results can differ from MODIS. Eyeballing a plot is not a test: compare the p-values and the heatmap."]),
 "klang_valley_rain": dict(
    title="Is rainfall changing in the Klang Valley?", subtitle="Average daily rainfall, Malaysia, 1990-2025",
    variable=dict(name="Precipitation (bias-corrected)", units="mm/day", unit_label="mm of rain per day", short_name="rainfall",
        definition="Average rainfall per day, averaged over each month. A reanalysis product that blends a weather model with satellite and gauge rainfall data.",
        caveat="Rainfall is highly variable from year to year (e.g. El Nino/La Nina), so short records can mislead. Reanalysis rainfall is an estimate, not a gauge measurement."),
    season=dict(label="Whole year", months=list(range(1, 13))), what="Annual average rainfall",
    extra=["Annual means rise partly because 2021-2025 were very wet years in this reanalysis; check the heatmap to see how much the conclusion depends on the end year. Changes in the observations assimilated by reanalyses can also create artificial steps."]),
 "iowa_soil_moisture": dict(
    title="Is the land getting drier in Iowa?", subtitle="Root-zone soil wetness in the growing season, 1981-2025",
    variable=dict(name="Root-zone soil wetness", units="fraction (0 = dry, 1 = saturated)", unit_label="soil-wetness points (0 = dry, 1 = soaked)", short_name="soil moisture",
        definition="How full of water the soil is in the layer where plant roots grow, as a fraction of saturation. Important for crops and drought.",
        caveat="Modelled, not measured directly: reanalysis soil wetness depends on the land model and the rainfall it is fed. Irrigation and drainage are not fully represented."),
    season=dict(label="June-August (growing season)", months=[6, 7, 8]), what="Growing-season soil wetness"),
}
def clean(o):
    if isinstance(o, dict): return {k: clean(v) for k, v in o.items()}
    if isinstance(o, list): return [clean(v) for v in o]
    if isinstance(o, (np.floating, float)): return None if (math.isnan(o) or math.isinf(o)) else round(float(o), 6)
    if isinstance(o, (np.integer,)): return int(o)
    if isinstance(o, (np.bool_,)): return bool(o)
    return o
val = json.load(open(f"{ROOT}/docs/validation.json")) if os.path.exists(f"{ROOT}/docs/validation.json") else None
os.makedirs(f"{ROOT}/app/src/data", exist_ok=True); index = []
for id_, d in DEMOS.items():
    meta = json.load(open(f"{ROOT}/data/series/{id_}.meta.json"))
    df, clim = te.monthly_frame(f"{ROOT}/data/series/{id_}.csv")
    u, what = d["variable"]["units"], d["what"]
    ys = te.season_series(df, d["season"]["months"])
    ana = dict(raw=te.analyse_raw(df, u, what), deseasonalized=te.analyse_deseasonalized(df, u, what),
               seasonal_mk=te.analyse_seasonal_mk(df, u, what),
               season_only=te.analyse_season_only(ys, u, what, d["season"]["label"]))
    hm = te.window_sweep(ys, 8); hm["basis"] = "season_only"
    # ---- headline numbers for the front end (plain-language story)
    prim = ana["season_only"]; yv = ys.to_numpy(float); yr = ys.index.to_numpy(float)
    resid = yv - (np.median(yv - np.median(te.sen_slopes(yr, yv)) * yr) + np.median(te.sen_slopes(yr, yv)) * yr)
    mean_v = float(np.mean(yv)); n_years = int(len(yv))
    total_change = prim["slope_per_decade"] * (n_years - 1) / 10.0
    agree = sum(1 for k in ("raw", "deseasonalized", "seasonal_mk", "season_only") if ana[k]["significant"] and np.sign(ana[k]["slope_per_decade"]) == np.sign(prim["slope_per_decade"]))
    headline = dict(primary="season_only", n_years=n_years, first_year=int(yr[0]), last_year=int(yr[-1]),
        typical_value=mean_v, yearly_sd=float(np.std(resid, ddof=1)), total_change=float(total_change),
        relative_change_pct_per_decade=(prim["slope_per_decade"] / mean_v * 100.0) if mean_v else None,
        highest_year=int(yr[int(np.argmax(yv))]), lowest_year=int(yr[int(np.argmin(yv))]),
        methods_significant=int(sum(ana[k]["significant"] for k in ana)), methods_total=4,
        methods_agree_with_primary=int(agree))
    cc = (val or {}).get("crosscheck", {}).get("max_abs_diff", {})
    doc = dict(id=id_, mock=False, title=d["title"], subtitle=d["subtitle"],
        variable={**d["variable"], "source": "NASA MERRA-2 reanalysis, accessed via NASA POWER", "temporal_resolution": "monthly"},
        region=dict(name=meta["region"], bbox=meta["bbox"], n_gridcells=meta["n_points"]),
        period=dict(start=df["date"].iloc[0], end=df["date"].iloc[-1]), season=d["season"],
        series=[dict(date=r.date, value=r.value, anomaly=r.anomaly) for r in df.itertuples()],
        climatology=[dict(month=int(m), mean=float(v)) for m, v in clim.items()],
        headline=headline, analyses=ana, annual_season_series=[dict(year=int(y), value=float(v)) for y, v in ys.items()],
        heatmap=hm,
        validation=dict(pymannkendall_agrees=bool(cc and max(cc.values()) < 0.05), max_abs_diff=cc,
                        report="docs/VALIDATION.md"),
        notes=["Regional value = average of %d MERRA-2 grid cells inside the region (about 0.5 x 0.6 degrees each)." % meta["n_points"],
               "Reanalysis data blend a weather model with satellite and ground observations; trends can be affected by changes in the observing system.",
               "Heatmap windows overlap heavily, so it is a descriptive sensitivity view, not many independent tests.",
               "'Not significant' does not mean 'no trend' - a longer record may be needed."] + d.get("extra", []))
    json.dump(clean(doc), open(f"{ROOT}/app/src/data/{id_}.json", "w"), allow_nan=False)
    index.append(dict(id=id_, title=d["title"], subtitle=d["subtitle"]))
    m = hm["metrics"]
    print(f"{id_}: season_only slope/dec={ana['season_only']['slope_per_decade']:.4f} p={ana['season_only']['p']:.3f} | deseas p={ana['deseasonalized']['p']:.3f} | raw p={ana['raw']['p']:.3f} | verdict={m['verdict']} dir={m['direction_agreement']:.2f} sig={m['significant_fraction']:.2f}")
json.dump(dict(demos=index), open(f"{ROOT}/app/src/data/index.json", "w"), indent=1)

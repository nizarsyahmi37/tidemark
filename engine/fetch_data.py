"""Fetch monthly regional series from NASA POWER (MERRA-2 based). Regional value = mean of sampled grid-cell points.
Writes data/series/<id>.csv (date,value,n_points) and data/series/<id>.meta.json"""
import json, urllib.request, concurrent.futures as cf, itertools, os, sys
from collections import defaultdict
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEMOS = {
 "wisconsin_aod": dict(param="AOD_55", start=2002, end=2025, lats=[43.0,44.5,46.0], lons=[-91.5,-89.5,-87.5],
                       bbox=[-92.9,42.5,-86.8,47.1], region="Wisconsin, USA"),
 "klang_valley_rain": dict(param="PRECTOTCORR", start=1990, end=2025, lats=[2.75,3.25], lons=[101.25,101.875],
                       bbox=[101.0,2.5,102.2,3.7], region="Klang Valley, Malaysia"),
 "iowa_soil_moisture": dict(param="GWETROOT", start=1981, end=2025, lats=[41.0,42.0,43.0], lons=[-95.5,-93.5,-91.5],
                       bbox=[-96.6,40.4,-90.1,43.5], region="Iowa, USA"),
}
def get(param, lat, lon, s, e):
    url=(f"https://power.larc.nasa.gov/api/temporal/monthly/point?parameters={param}&community=AG"
         f"&longitude={lon}&latitude={lat}&start={s}&end={e}&format=JSON")
    for k in range(4):
        try:
            with urllib.request.urlopen(url, timeout=90) as r:
                return json.load(r)["properties"]["parameter"][param]
        except Exception as ex:
            err=ex
    raise err
for id_, d in DEMOS.items():
    pts=list(itertools.product(d["lats"], d["lons"]))
    with cf.ThreadPoolExecutor(4) as ex:
        res=list(ex.map(lambda p: get(d["param"], p[0], p[1], d["start"], d["end"]), pts))
    agg=defaultdict(list)
    for series in res:
        for k,v in series.items():
            if k.endswith("13") or v is None or v<=-990: continue   # drop annual mean (MM=13) and fill values
            agg[k].append(v)
    rows=sorted(agg.items())
    with open(f"{ROOT}/data/series/{id_}.csv","w") as f:
        f.write("date,value,n_points\n")
        for k,v in rows:
            f.write(f"{k[:4]}-{k[4:]},{sum(v)/len(v):.5f},{len(v)}\n")
    json.dump({**d,"id":id_,"n_points":len(pts),"source":"NASA POWER (MERRA-2)"}, open(f"{ROOT}/data/series/{id_}.meta.json","w"), indent=1)
    print(id_, len(rows), rows[0][0], rows[-1][0], flush=True)

# NASA POWER monthly client — what was checked

Checked on **15 November 2026** against the live Monthly and Annual API. The service identified itself as `POWER Monthly and Annual API` **v2.10.0**. Requests used `community=AG` and `format=JSON`. The probe point for the long records was **42°N, 93.625°W** (central Iowa). A second point, **42°N, 93.75°W** (an actual MERRA-2 longitude), was used to compare one month of daily data with the monthly value.

The parameter list that works is:

`https://power.larc.nasa.gov/api/system/manager/parameters?community=AG&temporal=monthly&format=JSON`

The same URL without `temporal` returns HTTP 422 (`Field required`).

## Variables that returned data

`record start` is the first year with a non-fill monthly value, not the first year the API will accept. The API accepts `start=1981` for every parameter below. Years before the real record come back as `-999`. `start=1980` is rejected for every parameter, including aerosol optical depth, with: "The data starts at 1981/01/01."

`last non-fill` is the last month that was not `-999` in a request for 1981–2026, on this date. The response `header.end` was still `20261130`. October and November 2026 were fill for meteorology; radiation stopped earlier.

| Parameter | Units | Record start | Last non-fill | `header.sources` |
| --- | --- | --- | --- | --- |
| T2M | C | 1981 | 2026-09 | MERRA2 |
| T2M_MAX | C | 1981 | 2026-09 | MERRA2, POWER |
| T2M_MIN | C | 1981 | 2026-09 | MERRA2, POWER |
| TS | C | 1981 | 2026-09 | MERRA2 |
| T2MDEW | C | 1981 | 2026-09 | MERRA2 |
| PRECTOTCORR | mm/day | 1981 | 2026-09 | MERRA2 |
| RH2M | % | 1981 | 2026-09 | MERRA2, POWER |
| QV2M | g/kg | 1981 | 2026-09 | MERRA2 |
| EVLAND | mm/day | 1981 | 2026-09 | MERRA2 |
| GWETTOP | 1 (fraction) | 1981 | 2026-09 | MERRA2 |
| GWETROOT | 1 (fraction) | 1981 | 2026-09 | MERRA2 |
| GWETPROF | 1 (fraction) | 1981 | 2026-09 | MERRA2 |
| WS10M | m/s | 1981 | 2026-09 | MERRA2, POWER |
| PS | kPa | 1981 | 2026-09 | MERRA2 |
| CLOUD_AMT | % | 1984 | 2026-07 | SYN1DEG, SRB |
| ALLSKY_SFC_SW_DWN | MJ/m^2/day | 1984 | 2026-07 | SRB, SYN1DEG |
| CLRSKY_SFC_SW_DWN | MJ/m^2/day | 1984 | 2026-07 | SRB, SYN1DEG |
| ALLSKY_SFC_LW_DWN | MJ/m^2/day | 1984 | 2026-07 | SRB, SYN1DEG |
| ALLSKY_SFC_PAR_TOT | MJ/m^2/day | 1984 | 2026-07 | SYN1DEG, SRB |
| AOD_55 | dimensionless | 2001 | 2026-07 | SYN1DEG |
| PW | cm | 2001 | 2026-07 | SYN1DEG |

No interior gaps showed up between the first and last good month at this point. The 1981–1983 radiation months, and 1981–2000 for AOD and precipitable water, are fill values, not missing keys.

Magnitudes at this point were physically plausible: January 1981 T2M about −5°C, August precipitation a few mm/day, surface pressure about 98 kPa, January all-sky sunlight about 7 MJ/m^2/day and June about 22. PAR was a bit under half of all-sky shortwave, which is what that band should be.

### What the underlying products actually are

From POWER's methodology pages (fetched the same day), not from the parameter name alone:

- Meteorology, soil wetness, and land evaporation are **MERRA-2** (GMAO), on a 1/2° × 5/8° grid, from 1 January 1981. POWER says the newest days can be **GEOS-IT** instead, and that a trend study should stop about two months behind real time. The 1981–2026 T2M header on this date listed only `MERRA2`.
- **PRECTOTCORR** is MERRA-2 precipitation after the observational correction. POWER's meteorology page cites Reichle et al. (2017), doi:10.1175/JCLI-D-16-0570.1. It is not a rain gauge.
- **GWETTOP / GWETROOT / GWETPROF** are wetness fractions from the Catchment land model inside MERRA-2 (about 0–5 cm, the upper metre, and the column to bedrock). They are not SMAP. SMAP is a separate high-resolution path and was not used here.
- Surface shortwave, longwave, PAR, and cloud amount are **GEWEX SRB Release 4-IP** from 1 January 1984 through 31 December 2000, then **CERES SYN1deg Edition 4.2** from 1 January 2001. The native grid is **1° × 1°**. POWER says not to read a trend across that join as a climate change without checking for a step. The energy-flux page also documents **CERES FLASHFlux Version 4A** (Kratz et al. 2014, doi:10.1175/JAMC-D-13-061.1) as the low-latency tail. On this date the monthly series still ended at 2026-07, two months before meteorology, so the monthly API was not yet showing a FLASHFlux extension past SYN1deg.
- **AOD_55** is the 550 nm aerosol field in CERES SYN1deg Edition 4.2, from 1 January 2001, on the 1° grid. POWER's clouds and aerosols page describes it as MODIS Dark Target and Deep Blue retrievals assimilated for the SYN1deg calculation. It is column optical depth, not PM2.5 and not a surface monitor.
- **PW** is labelled in the parameter list as column water vapor sourced from CERES. The header said `SYN1DEG` only, and the first good month was 2001-01.

Primary papers used in the citation text, confirmed against the DOI pages:

- Gelaro et al. 2017, J. Climate, 30, 5419–5454, doi:10.1175/JCLI-D-16-0758.1 (MERRA-2).
- Reichle et al. 2017, J. Climate, 30, 1643–1664, doi:10.1175/JCLI-D-16-0570.1 (corrected precipitation).
- Rutan et al. 2015, J. Atmos. Oceanic Technol., 32, 1121–1143, doi:10.1175/JTECH-D-14-00165.1 (CERES SYN1deg surface fluxes; the paper POWER's flux page points at).
- Stackhouse, Cox, Mikovitz, and Zhang, 2021, NASA Technical Reports Server 20210018620 (SRB Release 4-IP). Author list taken from the NTRS record.
- Kratz et al. 2014, J. Appl. Meteor. Climatol., 53, 1059–1079, doi:10.1175/JAMC-D-13-061.1 (FLASHFlux).

The official POWER credit line is the one on https://power.larc.nasa.gov/docs/referencing/ : the data were obtained from the NASA Langley Research Center POWER Project, funded through the NASA Earth Science Division.

## Variables that failed

| What was tried | Result |
| --- | --- |
| `SNOD` (snow depth) | Not in the AG monthly parameter list. The point API returned HTTP 422: "One of your parameters is incorrect: SNOD." |
| `EVLAND_SUM` | Not in the parameter list. Not requested. |
| `PRECTOT` | The name is not in the parameter list, but the point API returns HTTP 200 and **rewrites it to `PRECTOTCORR`**. The payload key is `PRECTOTCORR`. Uncorrected model precipitation is not available as its own series, so it is not in the catalog. |
| `start=1980` | HTTP 422 for every parameter: data starts at 1981/01/01. |
| `end=2027` and `end=2030` for T2M | HTTP 422: "The data is available to 2026/11/30." Asking for the current year is accepted; months inside that year can still be `-999`. |

`PRECSNOLAND`, `FRSNO`, `TSOIL1`, `WS2M`, and `T2M_RANGE` did return data from 1981 through 2026-09. They are real, and they were left out of the catalog so the list stays the variables a student is most likely to misread if the definition is sloppy (extremes, soil wetness, aerosol, the radiation join). They can be added later on the same client.

## Rate limit and latency

A burst of **12** different one-year T2M points, all in flight together, returned **HTTP 200** for every request. No 429. Each took about **0.5–1.0 s**. The wall clock for the burst was about **1.0 s**.

A single-parameter request for **1981–2026** (one point, ~550 months) also returned in about **0.6–1.0 s**. The slow part of a regional request is the number of points, not the length of the record.

The client still caps concurrency at **4**, retries **429**, **5xx**, and network errors up to **4 attempts** with exponential backoff (0.5 s, 1 s, 2 s, plus up to 20% jitter), and treats a `Retry-After` of a few seconds as a minimum wait (capped at 20 s). A **60 s** timeout is not retried, so one stuck call fails in a minute instead of four. This run never saw a 429, so the backoff path is covered by unit tests with a mocked `fetch`, not by a live rate-limit.

## Gotchas

- **Fill value is `-999`** (`header.fill_value` was `-999.0`). The client also treats `null`, non-numbers, any value equal to the header fill, and any value `<= -900` as missing. Real temperatures, kPa pressures, and fractions in this catalog are nowhere near −900.
- **Month 13 is the annual mean**, not a month. Keys look like `"202013"`. It has to be dropped or it will be averaged in as if it were data. December is `"202012"`.
- **Monthly `T2M_MAX` / `T2M_MIN` are the single extreme hour in the month**, not the mean of the daily highs or lows. Checked for August 2020 at 42°N, 93.75°W: monthly `T2M_MAX` was 37.37°C, equal to the highest daily maximum; the mean of the daily maxima was 30.7°C. Monthly `T2M_MIN` equalled the lowest daily minimum (11.91°C), not the mean of the daily minima (17.7°C). `T2M`, `PRECTOTCORR`, `RH2M`, and `WS10M` for that month did match the mean of the daily values.
- **Grid.** MERRA-2 points used here are latitude `-90 + i·0.5` (i = 0…360) and longitude `-180 + j·0.625` (j = 0…575, so the last longitude is **179.375**, not 180). A point such as 93.625°W is between centres (93.75°W and 93.125°W). POWER still answers it; the geometry in the response echoes the coordinate you sent. Boxes use centres that fall inside the box. A box smaller than one cell uses the box centre. More than 25 cells are subsampled on an even lattice and the result carries a warning. The mean is an **unweighted** mean of those centres, not an area-weighted mean.
- **Radiation is 1°, meteorology is 0.5° × 0.625°.** This client samples the MERRA-2 lattice for every variable, including sunlight and aerosol optical depth. Neighbouring sample points can land in the same 1° radiation cell and repeat one value. The average is then less independent than the point count suggests.
- **Time standard** on the monthly header is `LST` (local solar time), not UTC. It matters more for hourly data than for a monthly mean, but it is what the file says.
- **The archive end is not `header.end`.** On 15 November 2026 the header said the series ran through 30 November 2026, while the last non-fill meteorology month was September and the last radiation month was July. The client drops trailing all-missing months and warns. A request with `end` past the current year is rejected by the API; the client pulls the year out of that message and retries once.
- **In-memory cache** is per server process, keyed by the full request URL, 6 hours, 200 entries, and identical in-flight URLs share one promise. It does not survive a restart, and `cache: "no-store"` is set so Next's own fetch cache is not a second, hidden copy.

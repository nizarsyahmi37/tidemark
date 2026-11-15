<div align="center">

# Tidemark

**Read the marks Earth leaves.**

Test whether a NASA climate trend is real, how big it is, and how far to trust it.

[**Try the live app**](https://tidemark.nizarsyahmi37.com) ·
[Demo slides](https://docs.google.com/presentation/d/1cIdttWOFYzX0sEIVTVRjfrsx3bQKf4ENdBRGtGFvoh8/edit?usp=sharing) ·
[PDF deck](slides/deck.pdf) ·
[Disclosure](docs/DISCLOSURE.md)

NASA Space Apps Challenge 2026 · _Be An Earth System Trend Detective_

</div>

---

## What is Tidemark?

A tidemark is the line the water leaves behind: a record that something rose or fell over time. Tidemark reads those
marks in NASA Earth data and tells you whether a trend is real, how big it is, and how far to trust it.

Pick a variable, a place and a season, and Tidemark fetches the data live from the
[NASA POWER API](https://power.larc.nasa.gov/) (MERRA-2 and CERES-based fields). You can also upload your own monthly
series.

## Features

- **21 NASA variables**: temperature, rainfall, soil wetness, humidity, wind, sunlight, cloud, aerosol and more
- **Any point or area**, any range of years, any season
- **Trend statistics**: Sen's slope with a confidence interval, Mann-Kendall, seasonal Mann-Kendall and an
  autocorrelation-aware test
- **Stress test**: reruns the analysis over every start/end-year window, so you can see whether the answer depends on
  the years you pick
- **Diagnostics**: missing data, autocorrelation and unusual years
- **Exports**: CSV, JSON, charts, a methods paragraph, citations and a reproducible Python script

## Run it locally

Needs Node 20+ and internet access (NASA POWER). No API keys.

```bash
cd app
npm install
npm run dev                    # http://localhost:3000
```

```bash
npm test                       # statistics parity-tested against the Python reference engine
npm run build && npm start     # production
```

## Project layout

| Folder         | Contents                                                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`         | Next.js app: UI, API routes (`/api/analyse`, `/api/variables`), TypeScript statistics (`src/lib/stats`), NASA POWER client (`src/lib/power`) |
| `engine/`      | Python reference engine and validation against pymannkendall and synthetic data (`pip install -r requirements.txt`)                          |
| `data/series/` | The three example series used for the offline worked examples                                                                                |
| `docs/`        | Validation report, NASA POWER notes, data and AI disclosure                                                                                  |
| `slides/`      | 7-slide demo (`deck.html`, print to PDF)                                                                                                     |
| `submission/`  | Drafted answers for the Space Apps project page                                                                                              |

To regenerate the worked examples:

```bash
python engine/fetch_data.py && python engine/validate.py && python engine/build_site_data.py
```

## Data, credits and AI disclosure

- **Data:** NASA POWER, MERRA-2. Not endorsed by NASA.
- **AI assistance:** parts of this project (code, documentation, slides) were written with Claude Code, OpenAI Codex and
  Cursor Agent.
- Full details: [docs/DISCLOSURE.md](docs/DISCLOSURE.md)

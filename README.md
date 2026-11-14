# Tidemark

**Read the marks Earth leaves.**

NASA Space Apps Challenge 2026 · _Be An Earth System Trend Detective_

|                       |                                                                                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Live app (try it)** | https://tidemark.nizarsyahmi37.com                                                                                                                                                                 |
| **Source code**       | https://github.com/nizarsyahmi37/tidemark                                                                                                                                                          |
| **Demo slides**       | [Google Slides](https://docs.google.com/presentation/d/1cIdttWOFYzX0sEIVTVRjfrsx3bQKf4ENdBRGtGFvoh8/edit?usp=sharing) · [PDF](https://github.com/nizarsyahmi37/tidemark/blob/main/slides/deck.pdf) |

A tidemark is the line the water leaves behind: a record that something rose or fell over time. Tidemark reads those marks
in NASA Earth data and tells you whether a trend is real, how big it is, and how far to trust it.

Choose one of 21 NASA variables (temperature, rainfall, soil wetness, humidity, wind, sunlight, cloud, aerosol, ...), a
point or area, the years and the season, or upload your own monthly series. Tidemark fetches the data live from the NASA
POWER API (MERRA-2 and CERES-based fields), then computes:

- Sen's slope with a confidence interval, Mann-Kendall, seasonal Mann-Kendall and an autocorrelation-aware test
- a **stress test** across every start/end-year window, showing whether the answer depends on the years you pick
- diagnostics (missing data, autocorrelation, unusual years)
- exports: CSV, JSON, charts, a methods paragraph, citations and a reproducible Python script

## Run it

```bash
cd app
npm install
npm run dev        # http://localhost:3000
npm test           # statistics parity-tested against the Python reference engine
npm run build && npm start     # production
```

Needs Node 20+ and internet access (NASA POWER). No API keys.

## What is here

| Folder         | Contents                                                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`         | Next.js app: UI, API routes (`/api/analyse`, `/api/variables`), TypeScript statistics (`src/lib/stats`), NASA POWER client (`src/lib/power`) |
| `engine/`      | Python reference engine and validation against pymannkendall and synthetic data (`pip install -r requirements.txt`)                          |
| `data/series/` | The three example series used for the offline worked examples                                                                                |
| `docs/`        | Validation report, NASA POWER notes, data and AI disclosure                                                                                  |
| `slides/`      | 7-slide demo (`deck.html`, print to PDF)                                                                                                     |
| `submission/`  | Drafted answers for the Space Apps project page                                                                                              |

Regenerate the worked examples: `python engine/fetch_data.py && python engine/validate.py && python engine/build_site_data.py`.

## Data, credits and AI disclosure

See [docs/DISCLOSURE.md](docs/DISCLOSURE.md). Parts of this project (code, documentation, slides) were written with AI
assistance: Claude Code, OpenAI Codex and Cursor Agent. Data: NASA POWER, MERRA-2. Not endorsed by NASA.

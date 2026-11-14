## Data, credits & AI disclosure

**NASA data.** NASA POWER API (NASA Langley Research Center), which serves MERRA-2 reanalysis (NASA GMAO: temperature, precipitation, soil wetness, humidity, wind, pressure, evaporation) and satellite-based CERES / GEWEX SRB radiation, cloud and aerosol fields. Regional values are means of the grid cells inside the chosen box.

**Other resources.** Next.js, React, Chart.js, Leaflet, OpenStreetMap map tiles, Python (NumPy, pandas, SciPy, statsmodels, pymannkendall) for the reference engine and validation. Statistical methods: Mann (1945), Kendall (1975), Sen (1968), Gilbert (1987), Hamed & Rao (1998).

**AI / SI use (accurate account).** AI tools were used throughout this project:

- Claude (Anthropic, via Claude Code): research on the challenge and existing projects; refining the project concept; writing the Python reference engine, the TypeScript statistics, the validation tests, much of the interface, documentation and slides; debugging.
- OpenAI Codex and Cursor Agent: parts of the first interface builds, the NASA POWER data layer and some slide drafts, each directed by Claude / the team and then reviewed and edited.
- The project concept (a window-sensitivity "stress test" of trends) was developed in conversation with AI. The team contributed for decisions making, design choices, review, testing, verification.
- Generated code and data processing are acknowledged here, in the README, in the app's About page and in page metadata. No AI-generated images, audio or video are used. No NASA logos or branding are used.

**Limits.** Results come from reanalysis and model-blended data, not direct measurements at a point. AOD is not a measure of surface air pollution. "Not significant" does not mean "no trend". This project is not endorsed by NASA.

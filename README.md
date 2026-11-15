# The Average Lies

## ▶ Live site: **https://reek3r.github.io/the-average-lies/**

Opens in any browser, no install. Desktop and phone.

NASA Space Apps Challenge 2026 · Earth System Trend Detective · Active Future Labs

A fact-checking intelligence tool for climate claims. Paste a sentence or a whole article and each claim is traced to the place, the measure and the direction it states, tested in every study area it covers with 25 years of monthly NASA data, and given a verdict with its confidence.

## Run it

| Way | Link |
|---|---|
| Live site (GitHub Pages) | https://reek3r.github.io/the-average-lies/ |
| Run the source in your browser (no install) | https://stackblitz.com/github/Reek3r/the-average-lies/tree/main/frontend |
| Run locally | `cd frontend && npm install && npm run dev` then open the address it prints |

## What it does

- **Plate 01 · Index globe.** A printed-atlas globe with numbered findings and an index beside it. Click any area to open its page: monthly record, the trend in the average, the trend in the swings, a second NASA record where one exists, and the nearest area moving the other way.
- **Plate 02 · Claims desk.** Paste text. Each testable sentence is traced on an evidence board: claim → tested as → study areas (grouped into areas that back it, show the opposite, or show no clear change) → verdict. Six real news claims are included. Export the board as a Markdown report.
- **Plate 03 · Survey.** Write a query as a sentence, add a second condition (for example rain swings growing and topsoil getting drier), limit it to countries or regions, and rank. Results show on a map, a scatter of average change against swing change, a ranked table and a comparison tray. Export CSV or GeoJSON, or copy a link to the query.
- **Plate 04 · Method**, and a guided tour of three findings.

## Data

360 study areas of 2° × 2°, monthly, January 2000 to December 2024. NASA POWER (MERRA-2): temperature, humidity, rain, topsoil wetness. MERRA-2 aerosol: haze and dust. GPM IMERG: satellite rain. GLDAS Noah 2.1: evaporation, runoff, soil moisture. Coastlines from Natural Earth via `world-atlas`.

## Method

Seasons removed by comparing each month with the same month in other years. Average test: seasonal OLS trend with Newey–West (HAC, 12) errors. Swings test: trend in the size of each month's departure from normal. 3,545 tests corrected together with Benjamini–Hochberg. Rain and soil each have a second NASA record, and disagreements are reported. Records sensitive to the 2013–15 satellite changeover are kept out of headline counts. Claims are read with a fixed vocabulary; no AI writes any verdict.

## Layout

| Folder | What it holds |
|---|---|
| `frontend/` | The website (Vite, plain JavaScript, d3-geo). Data is pre-exported to `frontend/public/data/`. |
| `backend/analysis/` | Download and trend-fitting pipeline for the NASA records (Python). |
| `backend/export/`, `backend/claims/` | Export of the analysis to the JSON the site reads, and the per-area tests. |
| `tests/`, `frontend/tests/` | Tests. `cd frontend && npm test` |

## Limits

The tool doesn't explain causes or forecast. Each area is about 220 km across, so local events can be missed. 25 years is short for climate. "Not shown" means the data can't separate a change from chance.

## AI use

Claude (Anthropic) helped design and write the code and interface. No AI runs inside the product.

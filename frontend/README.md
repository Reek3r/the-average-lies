# The Average Lies

Climate claims, checked against 25 years of NASA data in 360 places.

## What it does

- **Landing page.** Real published claims with live verdicts. An animation shows one average splitting into 360 stories. Three things an average hides: wilder swings while the average holds, neighbours moving in opposite directions, and two NASA systems that disagree.
- **Investigator** (`#/investigate`). A 3D NASA Earth (Blue Marble), plus:
  - **Feed:** In the news, Hidden extremes, Opposite neighbours, NASA vs NASA.
  - **Globe views:** what averages hide, change in the level, change in the swings, and year by year with playback.
  - **Place briefing:** the bottom line, the average/swings flip chart with event markers, and checks for luck, a second NASA system and the satellite switch. Also the nearest place going the opposite way, and all 10 measures for that place.
  - **Check anything:** paste a claim, a paragraph or a whole article. Each sentence is tested, and a playback steps through the claims on the globe.
  - **Guided tour.**
- **No AI in the answers.** Claims are read with a fixed vocabulary, and every number comes from the exported statistics.

## Run it

```bash
cd frontend
npm install
npm run dev            # local
npm test               # claim parser and verdicts
npm run build          # static site in dist/ (GitHub Pages workflow included)
npm run build:artifact # claude.ai-hosted build (globe.gl and fonts from CDN)
```

## Data

The site reads `public/data/`:
- `regions.json`
- `checks.json`, built by `backend/claims/export_checks.py`
- `annual/*.json` and `monthly/*.json`, built by `backend/export/export_frontend_data.py`
- `src/content/news.js` holds the curated claims, each linked to its source.

## References

- Libraries:
  - [globe.gl](https://github.com/vasturiano/globe.gl) (MIT), which bundles three.js (MIT)
  - Newsreader and Inter Tight fonts (OFL)
  - Vite (MIT)
- Imagery: NASA Blue Marble and Black Marble (public domain), via the three-globe examples.
- Data:
  - NASA POWER (MERRA-2)
  - MERRA-2 aerosol (M2TMNXAER)
  - GPM IMERG
  - GLDAS Noah
- Claim sources are listed in `src/content/news.js`.

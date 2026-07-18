# Ogmore Stepping Stones

A community-run, open-source site to provide **best-guess** crossing guidance for the stepping stones by Ogmore Castle.

## Why this exists

Walkers and cyclists often use this route to cross the River Ogmore. Conditions can shift quickly due to tides and weather. This project aims to provide a simple, locally-focused signal while avoiding certainty language.

## Safety note

This website provides **guidance only**. It does **not** guarantee safe crossing conditions. Always assess the river and weather in person before crossing.

## Site shape (v1.1)

Single-page app with jump navigation to:

- `#live` – current best-guess state and live inputs.
- `#forecast` – next 24 hours of likely conditions.
- `#history` – local context.
- `#about` – project intent.
- `#report` – observation feedback form.

States are:

- **Likely Passable**
- **Caution**
- **Likely Unpassable**

## Data pipeline

Runtime is frontend-only, but live JSON is generated server-side in GitHub Actions every 15 minutes:

- NRW river station: `4083` (`Ogmore at Bridgend`, parameter `110`)
- NRW tide station primary: `72839` (`Newport`, parameter `10254`)
- NRW tide fallbacks: `72639` then `72439`
- Rainfall forecast: Open-Meteo hourly forecast for Ogmore area

Generated files:

- `public/data/live.json`
- `public/data/forecast.json`
- `public/data/config.json`

## Forecast model defaults

Hourly risk score blends:

- Tide component: `0.45`
- River component: `0.35`
- Rain component: `0.20`

State thresholds (from `config.json`):

- `< 0.45` => Likely Passable
- `0.45 to < 0.70` => Caution
- `>= 0.70` => Likely Unpassable

## Development

```bash
npm install
npm run generate:data
npm run dev
```

Build with fresh generated data:

```bash
npm run build:with-data
```

Run tests:

```bash
npm test
```

## Observation feedback loop

Users submit observations through the GitHub issue form:

- `.github/ISSUE_TEMPLATE/observation.yml`

Threshold tuning helper:

```bash
npm run calibrate:observations -- ./data/observations.json
```

Expected observation row format:

```json
[
  {
    "observedState": "Caution",
    "riskScoreAtTime": 0.58,
    "timestamp": "2026-07-19T14:10:00Z"
  }
]
```

The calibration script proposes adjusted thresholds to review in a PR.

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

## Hero animation

The water uses a lazy-loaded [OGL](https://github.com/oframe/ogl) renderer and a custom refraction shader over the original watercolour image. Evolving noise moves right through the river mask; the banks, stones and swan remain fixed. This is a decorative approximation of water flow.

The same renderer animates the trees behind the castle. Smaller canopy groups have their own branch timing, flexibility and response delay. Passing gusts build and fade into quieter spells, with stronger bending at the crowns and small leaf movements. Smooth joins between groups prevent visible seams. A separate mask anchors the lower foliage and protects the castle's painted edges and tower silhouette.

OGL has no runtime dependencies. The renderer uses one draw pass, caps drawing at 30 fps and 1080 pixels wide, and pauses while off screen or in a hidden tab. Reduced motion or unavailable WebGL leaves the static painting visible. The combined water and tree module is about 10.6 KB gzipped; tree sway adds about 1.2 KB of compressed JavaScript over the water-only version.

### Day and night lighting

The illustration follows the light at Ogmore using [SunCalc](https://github.com/mourner/suncalc) 2.1.1 and the same location as the rainfall feed (51.4759, -3.6206). Solar altitude drives gradual dawn, daylight, dusk and night colour washes, so transitions follow the seasons. The clock uses `Europe/London`, including GMT/BST changes. There is no location permission or extra data request.

Use **Lighting** below the painting to preview each phase; choose **Live local time** to resume the actual scene. Previews are labelled and reloads always return to live mode. The moon and stars are decorative. The complete painting, including moving water and trees, receives the lighting; page text and condition indicators retain their existing colours.

Lighting refreshes each minute, pauses its timer in hidden tabs and catches up when returning. Reduced motion disables colour transitions while keeping the correct time-of-day appearance, including without WebGL. SunCalc has no runtime dependencies; lighting adds about 2.6 KB of compressed JavaScript and 0.6 KB of CSS to the previous build.

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

Users can submit observations directly from the page (no GitHub account required).

By default, the form is wired for a FormSubmit-style endpoint and configured in:

- `public/data/config.json` → `observationSubmission.endpoint`

Example endpoint:

```text
https://formsubmit.co/you@example.com
```

On first submission, FormSubmit will send a one-time email verification to activate delivery.

If `endpoint` is left as `REPLACE_WITH_EMAIL`, the submit button is disabled and the page shows a setup message.

The previous GitHub issue template is still in the repo as an optional fallback.

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

# Ogmore Stepping Stones

A community-run, open-source site to provide **best-guess** crossing guidance for the stepping stones by Ogmore Castle.

## Why this exists

Walkers and cyclists often use this route to cross the River Ewenny, close to its confluence with the Ogmore. Conditions can shift quickly due to tides and weather. This project aims to provide a simple, locally-focused signal while avoiding certainty language.

## Safety note

This website provides **guidance only**. It does **not** guarantee safe crossing conditions. Always assess the river and weather in person before crossing.

## Site shape

The landing page is one fixed watercolour scene, with the castle and stepping stones visible together. A persistent crossing-outlook overlay offers **Now**, **+1 hour** and **+3 hours**. Selecting an hour in the full forecast also updates the same scene. The camera never follows scrolling. On narrow screens the overlay overlaps the bottom edge of the complete painting, keeping the route visible.

Phone portrait and short landscape windows use a flowing layout so the outlook cannot escape above the header. Main forecast/scene controls have 44-pixel touch targets, supporting copy is larger, and the compact Scene toggle leaves more of the castle visible. The Scene panel scrolls within the available height; dialog headings keep their Close button visible. Safe-area padding supports phone cutouts, and native input text remains at least 16 pixels on narrow screens.

About and History are separate full page views within the app, using the shared header and a Back to crossing link. Changing views updates the document title, current navigation and heading focus, and supports browser Back/Forward. Their existing hash links still work on direct visits and reloads, including GitHub Pages without server rewrites. The crossing scene remains mounted while hidden, so scene settings and the selected History milestone survive navigation.

Readings, forecast and reporting continue to use native dialogs. Closing a dialog returns to the page it was opened from; the reporting form itself is unchanged. Routes are:

- `#live` – current best-guess state and live inputs.
- `#forecast` – next 24 hours of likely conditions.
- `#history` – full page illustrated castle/valley timeline, research sources and local folklore.
- `#about` – full page project introduction.
- `#report` – observation feedback form.

States are:

- **Likely Passable**
- **Caution**
- **Likely Unpassable**

### Prediction and water appearance

The selected prediction drives both the condition label and an illustrated water treatment. Higher combined risk gradually covers the stone route and increases the current; lower risk exposes more stone tops. This is a visual proxy for the existing model, not a local depth calculation. Upstream river metres and regional tide metres AOD remain separate readings. The model's weights and state thresholds are unchanged.

The approved high-water artwork (~158 KB) loads only when needed. Its river area is masked over the original painting, retaining the bank, swan, castle, snow and sky. The shader reuses that decoded image and blends it with the original at the same opacity. A packed mask keeps exposed stones still at low water and lets water flow over them when covered. Static/reduced-motion rendering uses the matching DOM layer. All effects share one draw pass, using at most eight textures with both snowy trees and high water. Provenance and the original prompts are in [the water asset notes](docs/assets/river-high.md).

Future presets select a nearby future forecast timestamp and show its actual local time; missing or expired hours are unavailable. Freshness is recomputed every minute, including time elapsed since generation and the older of the river/tide readings. Stale data removes the classified outlook, disables future selections and shows a neutral illustration. Data refreshes every 15 minutes while visible; pending requests time out after 10 seconds. Fresh cached data can survive an update failure, with a delayed-update caption. Reload resets forecast selection and scene overrides.

## Castle and valley history

Open **History** in the main navigation, or use the [published History link](https://smcqueen2.github.io/stepping-stones/#history). The one-page view follows twelve milestones through the castle, Ewenni Priory, Merthyr Mawr and the stepping-stone crossing, using the archived Living landscape design as its starting point.

Previous/Next and desktop date buttons slide between chapters; phones use a native milestone picker. Each chapter has source links and expandable context/date notes. The Hawise/common-land story is separately labelled undated folklore. Every image caption and alt description explicitly says **AI generated**, while distinguishing estimated reconstructions from present-day-inspired studies. The medieval chapters use the revised stepping-stones-view reconstruction, labelled as an estimate of the castle around 1250-1300. Navigation is manual, with reduced-motion support, normal page scrolling, shared site links, browser Back/Forward and Back to crossing. The selected milestone is retained when visiting another view and returning.

The canonical researched copy remains [timeline-content.json](docs/design/historical-timeline/timeline-content.json), with the [research brief](docs/design/historical-timeline/research-brief.md), exact prompts and compressed paintings alongside it. The [castle reconstruction notes](docs/design/historical-timeline/reconstruction/research-notes.md) preserve the photographic references, orientation correction and uncertainty. The application imports these assets directly. The History module/styles load only when the page is first visited, with retry if loading fails; no new package was added. History adds a lazy module of about 6.6 KB gzip and 1.2 KB CSS, plus five compressed paintings totalling about 990 KB on use, including the 594 KB revised castle image.

## Hero animation

The water uses a lazy-loaded [OGL](https://github.com/oframe/ogl) renderer and a custom refraction shader over the original watercolour image. Evolving noise moves right through the river mask; banks, exposed stones and the swan stay fixed. Covered stones blend into the higher-water painting. This is a decorative approximation of water flow.

The same renderer animates the trees behind the castle. Smaller canopy groups have their own branch timing, flexibility and response delay. Passing gusts build and fade into quieter spells, with stronger bending at the crowns and small leaf movements. Smooth joins between groups prevent visible seams. A separate mask anchors the lower foliage and protects the castle's painted edges and tower silhouette.

OGL has no runtime dependencies. The renderer uses one draw pass, caps drawing at 30 fps and 1080 pixels wide, and pauses while off screen or in a hidden tab. Reduced motion or unavailable WebGL leaves the static painting visible, including the selected water treatment. The lazy animation module is about 11.9 KB gzipped.

### Day and night lighting

The illustration follows the light at Ogmore using [SunCalc](https://github.com/mourner/suncalc) 2.1.1 and the same location as the rainfall feed (51.4759, -3.6206). Solar altitude drives gradual dawn, daylight, dusk and night colour washes, so transitions follow the seasons. The clock uses `Europe/London`, including GMT/BST changes. There is no location permission or extra data request.

Open **Scene** at the top right of the painting to find the **Light**, **Weather** and **Wind** controls. Light previews each phase; **Live** resumes local time. Previews are labelled and reloads always return to live mode. The moon and stars are decorative. The complete painting, including moving water and trees, receives the lighting; page text and condition indicators retain their existing colours.

Lighting refreshes each minute, pauses its timer in hidden tabs and catches up when returning. Reduced motion disables colour transitions while keeping the correct time-of-day appearance, including without WebGL. SunCalc has no runtime dependencies; lighting adds about 2.6 KB of compressed JavaScript and 0.6 KB of CSS to the previous build.

### Weather and manual scenes

The scene fetches [Open-Meteo current modelled weather](https://open-meteo.com/en/docs) for Ogmore every 15 minutes while the tab is visible. A 15-minute local cache avoids duplicate requests on reload. The caption shows the model timestamp and wind/gust speeds in mph, with attribution. These are modelled conditions, rather than a sensor at the castle. Data older than an hour, invalid units and incomplete responses are rejected; requests time out after 10 seconds. If weather is unavailable, the scene uses neutral conditions and manual previews remain available.

Weather codes and precipitation amounts control rain or snow; cloud cover softens the sky and hides stars, and fog adds a mist wash. Wind and gust speeds increase tree bending within a fixed limit, with a wider castle guard for stronger movement. Two layers of rain streaks or drifting snowflakes are composited in the existing OGL draw pass. The effects remain decorative; crossing assessments continue to use the generated river/tide/forecast data.

The **Weather** buttons offer **Live**, **Clear**, **Cloudy**, **Rain** and **Snow**. A separate **Wind** group offers **Live**, **Calm**, **Breezy** and **Windy**, so rain or snow can combine with strong wind. Changing weather preserves the wind selection, and changing wind preserves precipitation. A Live wind selection uses the current wind feed even with a manual weather preview. Combine both groups with any Light preview. Active buttons expose their pressed state and captions identify overrides. Each group's Live button restores only its automatic behaviour; reload restores all three groups. Reduced motion and the static WebGL fallback retain weather washes and captions without animated precipitation.

Snowy conditions also reveal a snow-covered castle variant, with settled snow on the tower and wall tops. The transparent 1672 × 941 WebP is about 160 KB and loads only when snow is first selected or reported by the live feed; later previews reuse it. It shares the scene lighting and static fallback, and fades away when snow ends. The original artwork is retained. See the [asset notes and exact imagegen prompt](docs/assets/castle-snow.md).

The grass also gains a blanket of settled snow, with irregular patches resting on the tree crowns and branches. A second transparent WebP (~292 KB) loads on first snow. The animated canopy samples this artwork with the same branch displacement, so the snow sways with the foliage, including in strong wind. Grass and static/reduced-motion trees use the matching image layer. Both snowy variants share day/night lighting and fade away together; a failed image retains the original artwork. See the [landscape asset notes and exact built-in imagegen prompt](docs/assets/landscape-snow.md).

The weather feature reuses OGL and adds no npm package. Compared with lighting alone, it adds about 2.6 KB compressed JavaScript and 0.25 KB CSS. tsParticles' [snow preset](https://particles.js.org/demos/recipes/snow) was considered; the existing renderer lets this illustration keep its single draw pass and existing pause/resume lifecycle.

The single-scene implementation and page navigation add no npm package. With the lazy History entry point, main JavaScript is about 10.5 KB gzip, lazy animation 11.9 KB and initial CSS 3.6 KB. Snow and high-water images are decoded on demand and reused as renderer textures.

## Data pipeline

Runtime is frontend-only, with live JSON generated server-side in GitHub Actions. The workflow requests a 15-minute schedule; actual scheduled starts can be delayed:

- NRW river station: `4083` (`Ogmore at Bridgend`, parameter `110`)
- NRW tide station primary: `72839` (`Newport`, parameter `10254`)
- NRW tide fallbacks: `72639` then `72439`
- Rainfall forecast: Open-Meteo hourly forecast for Ogmore area

The generator selects the next 24 future hourly rows from the provider's two-day response. River trend projects from the actual observation timestamp, rather than a row's position in a midnight-based array. Both source timestamps inform freshness. All displayed times use Europe/London; forecast rows distinguish BST/GMT across the autumn clock change.

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

### Preview on a phone over Wi-Fi

Connect the phone and development PC to the same Wi-Fi network, then start Vite with:

```bash
npm run dev:lan
```

Open the Wi-Fi **Network** URL printed by Vite on the phone. Keep the PC awake while viewing. On Windows, allow inbound TCP port 5173 for the Node executable on the Wi-Fi interface, restricted to the local subnet. Router port forwarding is not needed. Stop the server with Ctrl+C when finished; ordinary `npm run dev` keeps the default local-only preview.

For an Android phone already authorised for USB debugging, an optional USB preview avoids changing Wi-Fi addresses. Keep the local server running, connect the phone and use the installed Android Platform Tools:

```bash
adb -d reverse tcp:5173 tcp:5173
```

Open **http://localhost:5173/** in Chrome on the connected phone. The mapping uses USB and must be recreated after disconnecting/reconnecting. Remove just this preview mapping with `adb -d reverse --remove tcp:5173`; leave any other development mappings intact. This does not require router changes. See [Chrome's USB port-forwarding guide](https://developer.chrome.com/docs/devtools/remote-debugging/local-server).

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

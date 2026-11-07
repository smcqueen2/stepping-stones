# Ogmore Stepping Stones

A community-run, open-source site to provide **best-guess** crossing guidance for the stepping stones by Ogmore Castle.

## Why this exists

Walkers and cyclists often use this route to cross the River Ewenny, close to its confluence with the Ogmore. Conditions can shift quickly due to tides and weather. This project aims to provide a simple, locally-focused signal while avoiding certainty language.

## Safety note

This website provides **guidance only**. It does **not** guarantee safe crossing conditions. Always assess the river and weather in person before crossing.

## Site shape

The landing page is one fixed watercolour scene, with the castle and stepping stones visible together. A persistent crossing-outlook overlay offers **Now**, **+1 hour** and **+3 hours**. Selecting an hour in the full forecast also updates the same scene. The camera never follows scrolling. On narrow screens the overlay overlaps the bottom edge of the complete painting, keeping the route visible.

Phone portrait and short landscape windows use a flowing layout so the outlook cannot escape above the header. Main forecast/scene controls have 44-pixel touch targets, supporting copy is larger, and the compact Scene toggle leaves more of the castle visible. The Scene panel scrolls within the available height; dialog headings keep their Close button visible. Safe-area padding supports phone cutouts, and native input text remains at least 16 pixels on narrow screens.

About and History are separate full page views within the app, using the shared header and a Back to crossing link. Changing views updates the document title, current navigation and heading focus, and supports browser Back/Forward. Their existing hash links still work on direct visits and reloads, including GitHub Pages without server rewrites. The crossing scene remains mounted while hidden, preserving scene settings. History stays mounted after its first visit; its timeline follows the current scroll position.

Readings, forecast and reporting use native dialogs. Closing a dialog returns to the page it was opened from. Reporting is now a simple slider preview opened from the main crossing overlay, rather than a navigation tab. Routes are:

- `#live` – current best-guess state and live inputs.
- `#forecast` – next 24 hours of likely conditions.
- `#history` – full page illustrated castle/valley timeline, research sources and local folklore.
- `#about` – full page project introduction.
- `#report` – quick condition slider (interface preview; collection deferred).

States are:

- **Likely Passable**
- **Caution**
- **Likely Unpassable**

### Prediction and water appearance

The crossing status (Likely Passable, Caution or Likely Unpassable) is the main headline, with a smaller plain-language reason below it. A compact River & tide overlay shows the current river reading and approximate coastal tide timings. Detailed river/tide gauge values and trends remain under Readings. The same short reason is used for its current assessment, while a future selection uses that selected forecast hour's inputs.

Reasons use the model's existing normalized river, tide and rain components, with configured weights to select an active high contributor. A high river and low tide are described together, and rain wording describes a possible future rise. The generator now includes optional `live.current.riskComponents`, matching the components already supplied for forecast hours. Older payloads or missing/invalid component/config data use a neutral explanation without guessing a cause.

Copy bands of 0.3 and 0.7 describe low/high positions in the previous 48-hour gauge range; they are not new crossing-risk thresholds, flood limits or measurements of depth at individual stones. Readings includes this distinction. The score, state classification, calibration, freshness checks and water rendering remain unchanged; stale/unavailable readings still replace the classification and explanation.

The selected prediction drives both the condition label and an illustrated water treatment. Higher combined risk gradually covers the stone route and increases the current; lower risk exposes more stone tops. This is a visual proxy for the existing model, not a local depth calculation. Upstream river metres and regional tide metres AOD remain separate readings. The model's weights and state thresholds are unchanged.

The approved high-water artwork (~158 KB) loads only when needed. Its river area is masked over the original painting, retaining the bank, swan, castle, snow and sky. The shader reuses that decoded image and blends it with the original at the same opacity. A packed mask keeps exposed stones still at low water and lets water flow over them when covered. Static/reduced-motion rendering uses the matching DOM layer. All effects share one draw pass, using at most eight textures with both snowy trees and high water. Provenance and the original prompts are in [the water asset notes](docs/assets/river-high.md).

Future presets select a nearby future forecast timestamp and show its actual local time; missing or expired hours are unavailable. Freshness is recomputed every minute, including time elapsed since generation and the older of the river/tide readings. Stale data removes the classified outlook, disables future selections and shows a neutral illustration. Data refreshes every 15 minutes while visible; pending requests time out after 10 seconds. Fresh cached data can survive an update failure, with a delayed-update caption. Reload resets forecast selection and scene overrides.

### At a glance water readings

The **River & tide** overlay shows the river gauge reading beside a plain-language coastal tide summary: **Coming in**, **Going out**, or **Around high/low tide**. It includes the next high tide's approximate local time, a rounded countdown and the relevant previous/upcoming low tide. Different dates are shown explicitly, and times use Europe/London including GMT/BST. Selecting a future crossing outlook leaves this current-tide guide and current river reading unchanged.

River levels retain metres at the Bridgend gauge, with a recent-trend caption. The gauge-data age badge conservatively uses the older of the two NRW readings, as does the crossing assessment. The regional NRW tide number is now only in Readings, still expressed in metres above Ordnance Datum with negative values preserved. These gauge levels are not water depth at the stones. The [official tide-gauge API reference](https://environment.data.gov.uk/flood-monitoring/doc/tidegauge) describes the difference between local and Ordnance Datum measurements.

Tide timing guidance is a separate optional `live.tideTiming` field, generated from [Open-Meteo Marine](https://open-meteo.com/en/docs/marine-weather-api)'s offshore Ogmore sea-level forecast. It derives turning points from hourly samples using three-point interpolation and rounds them to half-hours. The page shows `~` and estimated wording; the countdown rounds to half-hours too. Around-turn wording covers 30 minutes either side of an estimated turn. These choices avoid minute-level display precision; they are not an accuracy guarantee. No turning times are inferred from the old regional gauge trend or simple risk-model projection.

The marine model has approximately 8 km resolution and limited coastal/estuary accuracy. This is an approximate coastal guide, **not a predicted submergence time or a safe crossing window**. Its MSL heights are not interchangeable with NRW AOD levels and never enter the crossing score. The risk model and thresholds remain unchanged. Readings explains this separation and credits the adapted Open-Meteo/Copernicus Marine data under CC BY 4.0. The non-commercial endpoint needs no key; paid/commercial use requires reviewing the provider's terms.

The generator makes one additional bounded marine request; failure omits timing guidance without stopping the existing river/forecast output. Times older than six hours, outside coverage, with invalid timestamps or missing/inconsistent events show **Times unavailable** and clear old event text. Fresh tide timing can remain available while river telemetry is stale; the river/outlook's existing stale guards remain intact. The existing minute timer updates the countdown, with no extra browser polling or package. Detailed Readings retains three-decimal gauge values and rates. See [tide timing source and method notes](docs/tide-timing.md).

## Castle and valley history

Open **History** in the main navigation, or use the [published History link](https://smcqueen2.github.io/stepping-stones/#history). The one-page view follows twelve milestones through the castle, Ewenni Priory, Merthyr Mawr and the stepping-stone crossing, using the archived Living landscape design as its starting point.

All twelve chapters appear in one continuous vertical page, with normal document scrolling and no pagination or scroll snapping. Each painting retains its watercolour caption overlay, followed by that period's expandable context, date qualifications and source links. A fixed vertical timeline beside the right scrollbar highlights the period at the reading position and fills as the story advances. Dates are clickable jump controls; arrow keys, Home and End move keyboard focus through them, and Enter/Space opens that chapter. Jumps focus the chapter heading and use instant movement for reduced motion. Passive scrolling leaves keyboard focus alone.

The timeline stays visible along the right edge, with every date beside its dot and the current period highlighted. It has no hide/show button or enclosing panel; small paper-backed date labels remain legible over the watercolours. Paintings retain the full chapter width, while headings, caption overlays, artwork credits, source notes and the compact picker leave enough space for the dates. On narrow screens and short windows, the compact rail remains visible and a labelled native **Jump to a period** picker provides larger controls. Scroll/resize updates share a scheduled animation frame and skip hidden views; expanding chapter notes recalculates progress. The page keeps native browser scrolling, Back/Forward, shared site links and Back to crossing.

The Hawise/common-land story remains separately labelled undated folklore. Every image caption and alt description explicitly says **AI generated**, while distinguishing estimated reconstructions from present-day-inspired studies. The medieval chapters retain the revised stepping-stones-view reconstruction, labelled as an estimate of the castle around 1250-1300. The historical copy, sources and artwork have not changed in this layout update.

The canonical researched copy remains [timeline-content.json](docs/design/historical-timeline/timeline-content.json), with the [research brief](docs/design/historical-timeline/research-brief.md), exact prompts and compressed paintings alongside it. The [castle reconstruction notes](docs/design/historical-timeline/reconstruction/research-notes.md) preserve the photographic references, orientation correction and uncertainty. The application imports these assets directly. The History module/styles load only when the page is first visited, with retry if loading fails; later chapter images use native lazy loading and shared painting URLs. No new package was added. History adds a lazy module of about 7.1 KB gzip and 1.6 KB CSS, plus the same five compressed paintings totalling about 990 KB on use, including the 594 KB revised castle image.

## Hero animation

The water uses a lazy-loaded [OGL](https://github.com/oframe/ogl) renderer and a custom refraction shader over the original watercolour image. Evolving noise moves right through the river mask; banks, exposed stones and the swan stay fixed. Covered stones blend into the higher-water painting. This is a decorative approximation of water flow.

The same renderer animates the trees behind the castle. Smaller canopy groups have their own branch timing, flexibility and response delay. Passing gusts build and fade into quieter spells, with stronger bending at the crowns and small leaf movements. Smooth joins between groups prevent visible seams. A separate mask anchors the lower foliage and protects the castle's painted edges and tower silhouette.

OGL has no runtime dependencies. The renderer uses one draw pass, caps drawing at 30 fps and 1080 pixels wide, and pauses while off screen or in a hidden tab. Reduced motion or unavailable WebGL leaves the static painting visible, including the selected water treatment. The lazy animation module is about 11.9 KB gzipped.

### Day and night lighting

The illustration follows the light at Ogmore using [SunCalc](https://github.com/mourner/suncalc) 2.1.1 and the same location as the rainfall feed (51.4759, -3.6206). Solar altitude drives gradual dawn, daylight, dusk and night colour washes, so transitions follow the seasons. The clock uses `Europe/London`, including GMT/BST changes. There is no location permission or extra data request.

Open **Scene** at the top right of the painting to find the **Light**, **Weather** and **Wind** controls. Light previews each phase; **Live** resumes local time. Previews are labelled and reloads always return to live mode. The moon and stars are decorative. The complete painting, including moving water and trees, receives the lighting; page text and condition indicators retain their existing colours.

The night sky has an AI-generated watercolour crescent moon and eighteen softly painted-looking stars. Stars brighten and settle at different speeds and phases, with no hard blinking. Both layers sit behind the actual castle and tree silhouettes; narrow/short views place the moon on the left, clear of the Scene button. Clouds and fog soften their visibility while retaining some light through the illustrative cloud treatment. Daylight hides them. The crescent is decorative and does not show the actual lunar phase or position.

The transparent moon image is about 13.5 KB and loads only when the night-sky fade first becomes visible; later previews reuse it. Stars use CSS opacity/scale animation with no library, shader texture/pass or extra animation-frame loop. Motion pauses in daylight, hidden tabs, other page views and when the scene is off screen. Reduced motion retains static stars and the moon, with no appearance transitions; WebGL is not required. The generated master, optimized asset and exact built-in ImageGen prompt are recorded in [the night-sky asset notes](docs/assets/night-sky/README.md).

The sky has its own brightness curve, fading towards black at night while the castle, landscape and water receive gentler dimming and a lighter cool wash. The existing sky asset and transparent-edge backdrop darken together; no night bitmap is downloaded. The tree renderer samples the sky layer's interpolated CSS brightness for newly uncovered branch edges, so the moving canopy matches the sky throughout the transition. This adds one scalar uniform, with the same textures, draw pass and frame cap. Daylight preserves the original painting. The same sky treatment works in the static fallback, and reduced motion disables its transitions too.

Lighting refreshes each minute, pauses its timer in hidden tabs and catches up when returning. Reduced motion disables colour transitions while keeping the correct time-of-day appearance, including without WebGL. SunCalc has no runtime dependencies; lighting adds about 2.6 KB of compressed JavaScript and 0.6 KB of CSS to the previous build.

### Weather and manual scenes

The scene fetches [Open-Meteo current modelled weather](https://open-meteo.com/en/docs) for Ogmore every 15 minutes while the tab is visible. A 15-minute local cache avoids duplicate requests on reload. The caption shows the model timestamp and wind/gust speeds in mph, with attribution. These are modelled conditions, rather than a sensor at the castle. Data older than an hour, invalid units and incomplete responses are rejected; requests time out after 10 seconds. If weather is unavailable, the scene uses neutral conditions and manual previews remain available.

Weather codes and precipitation amounts control rain or snow; cloud cover softens the sky and hides stars, and fog adds a mist wash. Wind and gust speeds increase tree bending within a fixed limit, with a wider castle guard for stronger movement. Two layers of rain streaks or drifting snowflakes are composited in the existing OGL draw pass. The effects remain decorative; crossing assessments continue to use the generated river/tide/forecast data.

The **Weather** buttons offer **Live**, **Clear**, **Cloudy**, **Rain** and **Snow**. A separate **Wind** group offers **Live**, **Calm**, **Breezy** and **Windy**, so rain or snow can combine with strong wind. Changing weather preserves the wind selection, and changing wind preserves precipitation. A Live wind selection uses the current wind feed even with a manual weather preview. Combine both groups with any Light preview. Active buttons expose their pressed state and captions identify overrides. Each group's Live button restores only its automatic behaviour; reload restores all three groups. Reduced motion and the static WebGL fallback retain weather washes and captions without animated precipitation.

Snowy conditions also reveal a snow-covered castle variant, with settled snow on the tower and wall tops. The transparent 1672 × 941 WebP is about 160 KB and loads only when snow is first selected or reported by the live feed; later previews reuse it. It shares the scene lighting and static fallback, and fades away when snow ends. The original artwork is retained. See the [asset notes and exact imagegen prompt](docs/assets/castle-snow.md).

The grass also gains a blanket of settled snow, with irregular patches resting on the tree crowns and branches. A second transparent WebP (~292 KB) loads on first snow. The animated canopy samples this artwork with the same branch displacement, so the snow sways with the foliage, including in strong wind. Grass and static/reduced-motion trees use the matching image layer. Both snowy variants share day/night lighting and fade away together; a failed image retains the original artwork. See the [landscape asset notes and exact built-in imagegen prompt](docs/assets/landscape-snow.md).

The weather feature reuses OGL and adds no npm package. Compared with lighting alone, it adds about 2.6 KB compressed JavaScript and 0.25 KB CSS. tsParticles' [snow preset](https://particles.js.org/demos/recipes/snow) was considered; the existing renderer lets this illustration keep its single draw pass and existing pause/resume lifecycle.

The single-scene implementation, page navigation, condition-report preview, water-reading overlay and night-sky decoration add no npm package. Main JavaScript is about 11.3 KB gzip, lazy animation 12.0 KB and initial CSS 4.8 KB. Snow and high-water images are decoded on demand and reused as renderer textures; the moon uses its own small on-demand image element.

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

**Interface preview only.** On 6 November the owner requested quick anonymous reporting, then explicitly asked not to prepare any backend yet. No backend, database, account setup or production submission endpoint is included in this change.

Use **Seen the stones? Share conditions** on the main crossing overlay to open a small native modal. A touch/keyboard slider has five visibly marked positions from completely submerged/unpassable to clear and passable, each with a short description. The track dots align with the thumb's five stopping positions. Moving the slider or tapping its current position makes a deliberate choice. **Preview report** confirms that selection locally and explicitly says nothing has been sent. There are no sign-in, date/time, checkbox or notes fields. Close/Escape and existing `#report` links remain supported; the header's separate Report link is removed.

The landing overlay reserves a line for **reports in the last hour**, marked coming soon. There are no simulated counts, requests, cookies or browser-storage writes for reporting. Slider choices do not change the model's prediction or scene. The old inactive FormSubmit placeholder and its form/configuration code were removed.

Deferred until the owner chooses to proceed: shared storage, actual submission/confirmation, a rolling 60-minute count, duplicate/abuse controls and how community observations should be summarised. An anonymous count should be labelled reports rather than verified unique people. These are future requirements, not implemented features. The website can stay on GitHub Pages with a separate service if later chosen; [GitHub Pages is static hosting](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

The previous GitHub issue template and the manual calibration helper remain available separately; this preview does not feed either of them.

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

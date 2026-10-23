# Progress

## 2026-07-19

- Scaffolded Vite + TypeScript single-page site structure.
- Implemented anchored sections (`#live`, `#forecast`, `#history`, `#about`, `#report`) with sticky nav and scroll animations.
- Added hero river visual that reflects current and short-horizon risk levels.
- Implemented data generator script using NRW river+tide feeds and Open-Meteo rainfall forecast.
- Added tide fallback station selection and stale-data handling metadata.
- Added forecast model producing 24-hour hourly risk states.
- Added observation issue form and Pages deployment workflow (push, manual, scheduled).
- Added calibration helper script for threshold tuning from observed outcomes.
- Added unit and contract tests; all tests passing.

## 2026-07-19 (later update)

- Replaced GitHub-account-only observation flow with a direct in-page observation form.
- Added radio + checklist controls and endpoint-driven submission wiring.
- Added config-based enable/disable messaging for observation submissions.

## 2026-10-22

- Added seamless left-to-right ripple highlights to the watercolour hero using two SVG patterns animated in CSS.
- Masked the effect to the river, excluding the painted stepping stones and swan, so the landmarks stay still.
- Reused the hero reveal and existing reduced-motion handling; added no dependency or image asset.
- Verified the moving layers and desktop layout in the local browser. Production build and all 16 existing tests pass.

### Stronger watercolour revision

- User found the first ripples too subtle. Increased stroke width, opacity and speed, and added rough, softened edges using SVG filters.
- Added two crossfading copies of the existing painted water, drifting right in 5.6-second loops. A wider mask excludes any shifted stone edges.
- Kept the river risk tints above the animated water, and hid the drifting copies for reduced motion.

### OGL refraction revision

- User found the regular flow unnatural and requested a lightweight npm option. Compared OGL, jQuery Ripples and simplex-noise using their primary documentation.
- Installed OGL 1.0.11 as the sole runtime dependency (no transitive runtime dependencies). Replaced the repeating SVG/CSS layers with a custom GPU shader that refracts the existing painting using several scales of evolving, rightward-moving noise. This is a visual approximation, not a physical fluid solver.
- Extracted the river mask to `public/images/hero/river-mask.svg`; sample checks prevent displaced stone or bank pixels from appearing in the water. Risk tints remain above the canvas.
- Draw the triangle directly to avoid importing a 3D scene or camera. Lazy-loaded water module: 31,476 bytes / 9,382 gzip. Total JS: 12,298 gzip versus 2,227 before this revision; increase 10,071 bytes (Node zlib defaults).
- Cap at 30 fps and 1080 pixels wide. Pause off screen and in hidden tabs, skip loading for reduced motion, and fall back to the original illustration if WebGL fails or its context is lost.
- Production build, TypeScript checks and all 16 existing tests pass. Browser verified shader rendering without warnings, offscreen pause and return-to-hero resume.

### Tree sway

- Added position-dependent branch bending, passing gusts and small leaf movements to the trees behind the castle, strongest at the crowns and fading toward the trunks.
- Reused the original landscape, sky and castle images with a new vector tree mask in the existing OGL draw pass. No new package or bitmap asset.
- Frame inspection caught tree movement showing through translucent castle paint; tightened the castle alpha exclusion and added a solid tower silhouette exclusion.
- Production build and TypeScript checks pass. Browser renders without warnings; the combined lazy module is about 10.2 KB gzip (under 1 KB more than water only).

## 2026-10-23 — Less uniform tree sway

- User requested the first recorded design task. Replaced the two broad canopy waves with smaller, unevenly spaced groups, each with seeded flexibility, branch rhythms and response delays.
- Noise-driven gust fronts build and fade, with quieter intervals and small leaf movements. Smoothly blend neighbouring groups to avoid abrupt seams; retain the anchored lower foliage and castle exclusions.
- Production build and TypeScript checks pass. Combined animation chunk is 10.56 KB gzip, about 0.4 KB more than the previous tree implementation. No dependency, texture, draw pass or lifecycle changes.
- Restarted the local Vite preview at 127.0.0.1:5173. After reloading, the shader renders with `data-water-state="running"` and no new shader warnings. Two-frame comparison shows varied movement in left, centre and right crowns; sky, grass and the foreground wall are unchanged. Tower interior difference is negligible (0.06 on a 0–255 channel scale).
- User accepted the sway refinement and requested committing/pushing it, then implementing lighting matched to local time. Home-page styling remains future work.
- Committed and pushed the accepted sway refinement and to-do notes as `ca2916e82d03aa616998a4ff5b155499e0d5f357`. All 16 existing tests passed; verified remote main matched. Generated local JSON snapshots were excluded.

### Day/night cycle

- Added SunCalc 2.1.1 as one dependency with no transitive runtime dependencies. Solar altitude at Ogmore drives gradual colour washes; the scene clock uses Europe/London with GMT/BST. The cycle follows the seasons without additional network requests or device location access.
- Wrapped the original hero layers and animation canvas in one lighting group, preserving the water/tree renderer. Added warm dawn/dusk washes and cool night grading with decorative moon and stars. The text and assessment colours remain independent of scene lighting.
- Added a Lighting selector for labelled previews and Live local time. Reload resets to live. Clock updates align to the minute, stop in hidden tabs and catch up on return; HMR disposal clears the timer and listeners. Reduced motion disables colour transitions while retaining the correct lighting.
- Production build and TypeScript checks pass; all 22 tests pass, including season changes, the repeated UK clock-change hour, preview/live reset, clock updates, hidden-tab recovery and disposal. Lighting increases JavaScript by about 2.6 KB gzip and CSS by 0.6 KB; the water/tree chunk remains 10.56 KB gzip.
- Browser checked daylight, dawn, dusk and night previews; water/tree animation remains running under the grading. Night screenshot saved outside the repo as `lighting-night-preview.png`. Returned the control to Live local time and verified mode=live, phase=day and the Europe/London clock.
- User accepted the lighting and requested committing/pushing it, then adding live weather effects, wind-responsive trees and manual scene buttons. Home-page styling remains future work.
- Committed and pushed lighting as `cfc7044d24d598e4d7259c3d22edc077f2ce23a1`; remote main matched. All 22 tests passed. Generated local live/forecast JSON snapshots were excluded.

### Live weather and scene buttons

- Investigated tsParticles' official snow preset and its engine/basic/palette/wobble dependencies. Reused the installed OGL renderer for two layers of rain streaks or drifting snowflakes, retaining one draw pass and the existing pause/reduced-motion/static fallback lifecycle. No package added.
- Added direct Open-Meteo current-weather requests for the fixed Ogmore coordinates. Validated WMO code mapping, precipitation/snow amounts, cloud cover and mph wind/gust units. Poll/cache for 15 minutes; show model timestamp and source. Reject data older than one hour or over 10 minutes in the future; cap weather-driven movement and cancel requests after 10 seconds. Stop polling while hidden and abort on disposal.
- Scale tree bending/gust strength from the weather, with smooth uniform changes and a wider castle exclusion margin under stronger wind. Rain/snow drift follows a horizontal wind component. Added cloud and fog washes; cloud cover attenuates the moon and stars.
- Replaced the Lighting select with labelled manual Light buttons, and added independent Weather buttons (Live/Clear/Cloudy/Rain/Snow/Windy). Exactly one button per group is pressed. Overrides remain intact when live data arrives; each Live restores its group, and reload restores both. Failed fetches leave previews usable and do not claim clear weather.
- Production build, TypeScript and all 31 tests pass. Tests cover feed validation/freshness, precipitation mapping, bounded windy-tree response, cached requests, late-response/manual override behaviour, offline controls and lifecycle cleanup, alongside existing lighting and app tests.
- Browser received live weather successfully: the sampled model reported partly cloudy, wind 26 mph and gusts 48 mph. Verified animation remained running, rain/snow rendering, independent night+snow controls and manual Clear/Windy strengths of 0.50/2.15. Screenshots are outside the repo in the task workspace.
- Final build: main JS 7.26 KB gzip, lazy hero animation 11.35 KB gzip, CSS 2.59 KB gzip. Weather adds about 2.6 KB gzip JS and 0.25 KB CSS over lighting alone. User accepted the weather work and requested committing/pushing it, then independent wind combined with rain/snow and a snowy castle variant.
- Committed/pushed the accepted weather work as `a58b7a458bc3327fe74a10ccbaeea09239a05d05`; remote main matched and all 31 tests passed. Generated live/forecast JSON snapshots were excluded.

### Independent wind and snowy castle

- Moved wind into a separate Live/Calm/Breezy/Windy group. Weather Live/Clear/Cloudy/Rain/Snow controls precipitation independently. The resolver composes the two selections; manual weather can retain live wind, and changing either group preserves the other. Captions reflect both modes and each group has its own Live reset.
- Generated a snowy version of the existing castle with built-in imagegen, keeping its canvas, position and watercolour style. Saved `public/images/hero/03_castle_snow.webp` (1672×941, 159,914 bytes); verified WebP alpha exactly matches the generated PNG. Original artwork is unchanged. Prompt/provenance saved in `docs/assets/castle-snow.md`.
- Add the snowy image as a fixed foreground layer in the existing lighting group, loaded/decoded only on first snow. Fade it in for modelled or preview snow and out when snow ends; a failed image load retains the original castle. Clip the lower 40% to keep faint generated edge remnants outside the river. Static/reduced-motion rendering also receives the snowy castle.
- Build, TypeScript and all 34 tests pass. New tests cover rain/snow with calm/strong wind, retaining manual wind across weather changes and late feed responses, independent Live resets, and on-demand/reused snow art.
- Browser verified Rain + Windy and Snow + Windy, with strength 2.15 and the animation running. Snow image decoded at 1672×941 with opacity 1, aligned with the scene. Switching to rain disables snow cover while retaining Windy; restoring live wind keeps Rain selected. Cold live mode had no snow image src, confirming on-demand loading.
- Final build: main JS 7.56 KB gzip (+0.30 KB), lazy animation 11.35 KB unchanged, CSS 2.64 KB gzip. Snowy/windy screenshot is outside the repo as `snowy-castle-windy-preview.png`. These additions remain local and uncommitted for review.

### Snow-covered grass and patchy tree snow

- Generated `public/images/hero/02_landscape_snow.webp` with built-in imagegen, matching the approved snowy castle's watercolour style. The grassy strip has settled snow with exposed tufts and visible fences/path; tree crowns and boughs have irregular snow patches with green/gold foliage between. Full prompt and provenance are in `docs/assets/landscape-snow.md`.
- Converted to WebP quality 90, preserving generated alpha exactly (1671×941, 292,454 bytes). Normalize the generator's one-pixel width difference with `object-fit: fill` and shared UVs. Clip empty lower remnants; preserve the original artwork.
- Generalized on-demand snow image loading to both assets, retaining independent readiness/failure handling. The snowy landscape is below the castle/river in the DOM. The renderer reuses its decoded image as a seventh texture, displaces snowy foliage with the same branch motion, and blends premultiplied samples using the DOM layer's fade opacity. Grass and static/reduced-motion trees retain snow without WebGL.
- All 35 tests, TypeScript and production build pass. Extended the image-loading test to both variants and added a failure/retry case proving one failed asset does not block the other. Main JS 7.56 KB gzip, animation 11.61 KB, CSS 2.67 KB. No new package or draw pass.
- Browser confirmed no snow image src in cold live mode, then both variants decoded with opacity 1 under Snow + Windy (strength 2.15), animation running and no console errors. Rain removed snow cover while retaining Windy. Night lighting correctly shaded snowy grass, castle and trees; restored live lighting with Snow + Windy for review. Screenshot: task workspace `snowy-landscape-windy-preview.png`. Changes remain local and uncommitted.
- User accepted the independent wind controls and complete snowy scene on 2026-10-23 and requested commit/push. Release includes the code, both snowy assets, exact prompts, documentation and project memory; generated `public/data/live.json` and `forecast.json` preview changes are excluded. Validation at this revision: all 35 tests, TypeScript and production build passed.

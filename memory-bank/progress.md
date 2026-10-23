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

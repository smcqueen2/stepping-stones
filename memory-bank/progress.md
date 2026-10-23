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

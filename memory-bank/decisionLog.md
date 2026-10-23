# Decision Log

## 2026-07-19 — Single-page architecture
- Decision: use one scrollable page with jump links instead of multi-page navigation.
- Rationale: faster access to key information on mobile and better continuity for local users.

## 2026-07-19 — Probabilistic state wording
- Decision: replace definitive state language with probabilistic wording.
- Chosen labels: Likely Passable / Caution / Likely Unpassable.
- Rationale: reduce false certainty and avoid overclaiming safety advice.

## 2026-07-19 — Frontend runtime with scheduled data pipeline
- Decision: keep runtime browser-only and generate data server-side in GitHub Actions.
- Rationale: NRW endpoints are not consistently browser-CORS friendly; scheduled generation avoids runtime CORS failure.

## 2026-07-19 — Forecast approach
- Decision: 24-hour hourly forecast combining tide projection, river trend, and rainfall forecast.
- Rationale: gives practical short-horizon guidance while remaining transparent about uncertainty.

## 2026-07-19 — Observation submission without GitHub account
- Decision: switch observation capture to a direct public form and remove dependency on user GitHub login.
- Implementation: in-page form with radio + checklist fields, endpoint configured via `public/data/config.json`.
- Rationale: lower submission friction for local residents and visitors.

## 2026-10-22 — River flow animation
- Decision: animate decorative ripple highlights over the existing painting, using an SVG river mask and two repeating patterns moving right at different speeds.
- Rationale: the water and stones share one raster layer. A masked overlay conveys flow while keeping the stones and banks stationary, scales with the illustration, and needs no runtime animation loop.
- Accessibility: stop both ripple animations when reduced motion is requested.
- Review revision: the initial thin highlights were too subtle. Reuse the original painted river in two crossfading drift layers, with broader irregular strokes moving faster. Expand the texture mask around the stones to avoid moving copies of their edges; keep risk tints on top.

## 2026-10-22 — Lightweight water renderer replaces repeating layers
- User feedback: the stronger repeating current still looked regular and unnatural; investigate npm options with low application overhead.
- Decision: OGL 1.0.11, imported lazily, rendering a custom evolving refraction shader over the painted river. OGL provides GPU rendering; this is not a ready-made river physics engine. Keep a static illustration fallback.
- Alternatives considered: jQuery Ripples requires jQuery and focuses on disturbance rings; simplex-noise is smaller but supplies noise functions without rendering; a full fluid solver would add rendering passes and simulation work unnecessary for this decorative image.
- Budget verified in the production build: about 10 KB additional gzip JavaScript; one draw pass capped at 30 fps, paused out of view. The earlier SVG patterns and CSS drift animations are superseded.

## 2026-10-22 — Tree sway shares the hero renderer
- User accepted the OGL water and requested realistic movement in the trees behind the castle.
- Decision: reuse the existing transparent landscape layer, painted sky and castle alpha in the same draw pass. Vary branch bends by position and crown height, add passing noise-driven gusts and small leaf movement, and anchor the lower foliage.
- Protect castle paint using its alpha and a fixed tower silhouette mask. This prevents tree movement showing through semi-transparent stone brushwork. Uncovered crown edges sample the nearby painted sky.
- Keep the existing motion/performance limits and static fallback. The addition needs no package, separate renderer or new bitmap; compressed JS grows by under 1 KB.

## 2026-10-23 — Independent canopy groups

- User feedback: tree sway still looked too uniform.
- Decision: replace the two broad waves with smoothly blended, unevenly spaced canopy groups. Give each group seeded flexibility, phase, branch frequency and response delay; use travelling noise-driven gusts and a changing strength envelope to introduce quieter spells.
- Keep the refinement in the existing shader and retain the masks, water behaviour, anchored lower foliage and lifecycle safeguards. Build cost increases by about 0.4 KB gzip, with no new runtime dependency or rendering pass.

## 2026-10-23 — Scene lighting follows time at Ogmore

- User requested proceeding to the day/night task after pushing the accepted sway refinement. Interpret local time as the scene's location, Ogmore, using Europe/London with daylight saving changes.
- Use SunCalc 2.1.1 solar altitude at the existing rainfall coordinates to follow seasonal light rather than fixed clock-hour cutoffs. It is a small dependency with no transitive runtime dependencies; calculations stay in the browser.
- Apply lighting to the complete illustration with CSS, retaining the original daytime artwork, animated textures and static fallback. Add warm twilight washes and cool night grading with decorative moon/stars. Keep assessment text and colour meanings separate from the decorative scene.
- Include explicit phase previews so the user can inspect night during daytime, defaulting to live on reload. Pause minute timers while hidden, resume immediately on return, and disable colour transitions for reduced motion.

## 2026-10-23 — Live weather shares the renderer; controls become buttons

- User accepted/pushed lighting and requested real-time weather, rain/snow effects, stronger trees in wind and manual scene buttons.
- Considered the official tsParticles snow preset. Reuse the existing OGL package to render precipitation in the same draw pass, adding no new engine, canvas or npm dependency. Keep the established caps, reduced-motion handling and static fallback.
- Use Open-Meteo current modelled weather at the same Ogmore coordinates, requested directly by the browser, with 15-minute polling/cache and attribution. Label modelled data with its timestamp. Validate units/freshness; failed or stale feeds must not falsely claim clear weather. This decorative feed does not change the crossing assessment pipeline.
- Drive bounded tree strength and gusts from wind data, and precipitation drift from its horizontal component. Widen the castle sampling guard as bend strength grows. Add cloud/fog washes and suppress stars under cloud cover.
- Provide independent, labelled Light and Weather button groups with pressed states, explicit preview captions and a Live button in each group. Reload starts live; manual choices survive completion of pending weather requests.

## 2026-10-23 — Wind composes with weather; snow reveals castle artwork

- User accepted/pushed weather work and requested combining rain or snow with wind, plus a snowy castle.
- Separate precipitation and wind selections. Weather changes do not reset wind, and wind changes do not reset precipitation. A Live wind selection uses current feed values even during manual rain/snow previews; each group's Live resets only that group.
- Use a generated sibling of the original castle raster, rather than altering the original. Preserve the watercolour style, canvas coordinates and alpha. The snowy variant is a fixed foreground layer sharing the lighting group, with no new WebGL texture or draw pass.
- Load the roughly 160 KB WebP on demand only when snow first appears; reuse it thereafter. Show settled snow whenever scene snow is active, including with reduced motion or unavailable WebGL. Clip the lower transparent-edge remnants to keep the river intact. The full generation prompt is kept with the asset notes.

## 2026-10-23 — Snowy grass and moving tree snow

- User requested snow-covered grass and patchy snow on the trees in the snowy scene. Generate a sibling landscape layer using the original landscape as the edit target and the approved snowy castle as a style reference. Retain the watercolour palette, fence, path, castle cutouts and foliage between irregular snow patches.
- Load the ~292 KB WebP alongside the castle only when snow is needed. Preserve generated alpha; normalize its one-pixel width difference through DOM sizing and texture coordinates. Clip lower empty edge remnants outside the landscape. No new npm dependency.
- Use the DOM layer for ground and the static/reduced-motion fallback. Reuse the same decoded image as one additional OGL texture and sample it with the original branch displacement. Match its DOM fade in the shader to avoid stationary snow on moving branches. Keep one rendering pass and the established motion/performance safeguards; release the texture on disposal.

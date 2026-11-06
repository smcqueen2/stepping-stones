# Decision Log

## 2026-11-06 - Scroll through History with a vertical timeline
- Owner requested vertical scrolling instead of paginated chapters, with a historical timeline next to the scrollbar showing the reading position. The new layout supersedes the click-through implementation; retain the archived designs and sourced content as provenance.
- Render all twelve chapters in normal document flow, with their existing paintings/overlays, AI labels and per-period source/context/date notes. Keep folklore separately labelled. No new image, package, research claim or effect on crossing predictions.
- Use a fixed right-hand timeline with active/past markers and continuous progress. Date buttons jump to chapters and focus their headings, with reduced-motion jumps and keyboard navigation; passive scrolling never moves focus. Narrow/short views get a compact rail/current period and a labelled native picker, keeping text clear and touch controls large.

## 2026-11-06 - Quick condition reporting interface; defer the backend
- User wants an option on the main page, a simple modal slider from completely submerged/unpassable to passable, and eventually the number of reports from the past hour. Prioritise a quick anonymous interaction without a date/time, notes or sign-in form.
- Owner explicitly replied: "neither dont prepare any backend yet" when asked about Cloudflare/Supabase. Keep this change frontend only. Backend scaffolding and local test storage started during exploration were removed; no backend deployment, service dependency, account setup or endpoint remains. Shared storage/counts, duplicate controls and actual submissions await a later request.
- The slider's five observable states have accessible value descriptions, touch/keyboard operation and a deliberate-choice requirement. The preview button confirms the choice with "Nothing has been sent". Hourly reports are labelled coming soon; do not simulate counts or success. Community observations remain separate from the model's prediction.

## 2026-11-06 - Darken the sky independently at night
- User wants the sky to reach black with lighter overall scene dimming. Use a runtime filter on the existing sky layer and a matching transparent-edge backdrop, preserving the daytime artwork and the accepted solar-altitude/local-time cycle.
- Keep the foliage renderer's exposed-sky fill in sync with the actual interpolated sky filter, not just the target value, to avoid bright halos during wind or preview transitions. Reuse the current draw pass/textures and support the static/reduced-motion treatment without a new asset or package.

## 2026-11-06 - Plain status before supporting detail
- User wants a simple crossing status as the primary heading and a short explanation in smaller type. Replace the poetic headline and move raw gauge values to the existing Readings view.
- Explain using the actual computed model inputs for the selected time, not absolute gauge guesses, the obsolete generic JSON reason or a nearby forecast as a stand-in for Now. Expose current risk components without changing the model. Use neutral text for missing or invalid explanation metadata.
- High/low copy describes normalized positions in the generator's existing 48-hour gauge range. State classification and freshness checks keep their existing thresholds; no flood or crossing-depth calibration is implied. Opposing river/tide conditions are named together, and future rainfall is described as a possibility.

## 2026-11-06 - About and History use full page views
- Owner requested separate page views instead of modal popups for About and History, explicitly leaving Report for later. Preserve the accepted fixed landing scene and the existing #about/#history links.
- Use a small shared hash-navigation controller rather than a router dependency or paths requiring server rewrites. One visible view, shared header, active navigation, document titles, heading focus and Back to crossing; native browser Back/Forward works. Keep mounted view state, including the selected historical milestone and scene preferences.
- Only Readings, Forecast and Report remain dialogs. Closing one returns to its originating page. The Report form's markup, appearance and submission setup are unchanged. History lazy loading now observes page visibility, including deep links and a download completing while the user is elsewhere.
- Full page content uses ordinary document scrolling and the available width; the landing-only viewport width constraint remains scoped to the landing scene. Archive concept previews retain their earlier presentation as historical design evidence.

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

## 2026-10-24 — Implement the fixed single-scene landing page

- User accepted the visual direction but rejected scroll-to-stones panning after trying it, then explicitly requested implementation. Keep the castle and stone route in one stable frame; show the forecast overlay immediately and put supporting content in native, hash-addressed dialogs. Preserve existing effects and independent Light/Weather/Wind controls in a Scene popover.
- Use the selected prediction for both the qualified label and illustrated water coverage/current. Reuse the approved high-water raster with a river-only mask, loaded on demand. DOM supplies the static fallback; OGL reuses its decoded image and shares fade opacity. Pack open-water and water-plus-stones into red/green mask channels to stay within eight WebGL texture units with snowy trees. No new package or draw pass.
- The water treatment is a bounded risk illustration. Gauge readings use different references and do not establish local depth at the crossing. Keep the model's weights/thresholds and clearly describe the scene as an illustrated prediction.
- Future controls exposed a midnight-window bug in data generation. Select the next 24 future hours before projecting, and use elapsed time from the river observation for the trend. Count both sources' freshness. Reject unavailable/past/stale predictions, preserve manual selection across refreshes, and recompute age in an open tab.
- Use actual Europe/London timestamps including zone labels for the clock-change duplicate hour. Native dialogs handle focus and Escape; hashes support deep links, return from reporting and browser navigation. The observation endpoint is still unconfigured and disabled.

## 2026-11-06 — Phone preview and short-screen layout

- User requested completing the landing release, phone access and an initial mobile-friendly pass. Keep the accepted castle-led painting and immediate outlook, with no scroll-driven camera.
- Use the flowing artwork/card layout for short landscape windows as well as narrow portrait screens. The previous height-limited desktop canvas caused the card to escape above the screen at 844×390. Keep 44px mobile controls, readable supporting text, a compact Scene toggle, safe-area spacing and scrollable panels with visible Close controls.
- Provide a repeatable LAN command and document optional Android USB forwarding for an already-authorised device. Test the actual phone-to-PC HTTP path independently from the Chrome UI. Direct Pixel checks succeeded on both paths; browser confirmation is still pending. Preserve unrelated USB forwards and the existing firewall/network protections.

## 2026-11-06 — Integrate the researched History work

- User requested publishing the historical research and generated paintings in the website before addressing hosted data freshness. Use the existing Living landscape design as the first integrated version for inspection. Preserve Painted chapters as an archived alternative; do not claim the user explicitly chose a layout earlier.
- Keep History in the existing SPA through the shareable native `#history` view, with a visible navigation link. Reuse canonical researched JSON and saved WebP paintings from `docs/design`, with per-chapter source/context/date notes and separately labelled undated folklore.
- Import the content, styles and image references lazily on opening. Use native controls, bounded navigation, inert inactive slides and reduced-motion horizontal transitions. No new runtime dependency or historical API request; the timeline stays usable when crossing data is stale or unavailable.

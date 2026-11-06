# Ogmore landing page design review

Created 2026-10-23; checkpoint updated 2026-10-24. The fixed-scene revision was subsequently accepted and implemented locally. This archive preserves the design record; application changes remain uncommitted separately.

## Current direction — revised 2026-10-24

User likes the general appearance but rejected the scroll-down/panning experience after trying it. Keep one fixed single-page scene with the existing prediction overlays. This supersedes the scroll journey described in the original alternatives below.

The updated review is `ogmore-single-scene.html`. Castle, river and stones remain in the same framing. The prediction overlay is visible immediately; forecast buttons change the example water treatment and condition text without moving the scene. Lighting opens in a small scene popover, and crossing information opens in an accessible dialog. On narrow screens, the compact prediction panel overlaps the lower edge of the complete painting so the castle and route remain visible. Original review imagery is reused; no new generated asset.

The user subsequently requested implementation of this revision, completed locally on 2026-10-24. The established live weather, seasonal lighting, snow and wind behaviour were retained. Keep the prediction illustration qualified and consistent with the chosen forecast time. No scroll camera, reveal threshold or scroll preview control is part of the revised direction. See [resume notes](../resume-notes.md) for the local implementation and release status.

Verified the revised fixed scene in the browser at desktop and 320px widths. Low/high forecast examples keep framing stable and update water visibility and labels together. The Day/Night popover and crossing-information dialog work; closing the dialog returns to the scene. Browser reported no warnings/errors. The self-contained review is about 666 KB and its scripts parse successfully. Screenshots are `single-scene-preview.png` and `single-scene-phone-preview.png` in this folder.

## Design directions

### River journey — superseded

The castle painting fills the opening scene, with a small masthead, a short editorial title and a direct link to conditions. Scrolling keeps the scene in place while the camera travels down and closer to the diagonal crossing. The introductory copy fades and a compact forecast overlay appears at the lower left, leaving the visible stone route to the right. A direct Conditions action reaches the same view without requiring the journey.

### Field journal

A quiet, warm paper layout with a centered Ogmore masthead, editorial heading and framed painting. The artwork moves towards the stones as visitors scroll; a low, wide forecast slip appears across the painting. Less immersive, with a stronger sense of local heritage and an easier transition into the rest of the site's content.

### Forecast lens

Artwork dominates the left of the desktop layout while the forecast stays visible alongside it. Scrolling still moves the artwork towards the stones; the condition text never needs to wait for a reveal. On narrow screens, the forecast follows the artwork. This offers faster access to information and less dramatic motion.

## What the review shows

- The carousel presents one complete design at a time. Its Scroll preview slider represents the intended scroll position; this is a review control, not a proposed visitor-facing slider.
- Low, rising and high water examples change the painting and condition label together. The product forecast buttons use the same three illustrative states. None of the sample forecasts are live readings or actual predictions for today.
- Original artwork supplies low water. Built-in imagegen produced a rising-water treatment and a refined high-water treatment, preserving the original scene. The high-water example exposes only a few isolated stone tips. Preview conversion changes format/size only.
- For review, only the river portion of the generated treatment is blended over the original painting. Castle, sky, grass and trees retain their original appearance. These raster variants demonstrate the intended result; a production implementation would keep the existing animated layers, lighting, snow and weather controls.

## Connection to the existing model

The app already has a combined tide/river/rain risk score and short-horizon/24-hour predictions. Its state labels are Likely Passable, Caution and Likely Unpassable. Preserve these qualified labels. The existing gauges use different references: upstream river metres and regional tide metres AOD must not be added as though they were local depth at the stones.

For implementation, select a forecast time and use that prediction consistently for both the condition overlay and the illustrative stone coverage/current. A bounded, monotonic mapping can show more covered stones at higher predicted risk. Include separate river/tide context when it helps explain the result. The picture is an illustration of the prediction; exact local depth or a guaranteed exposed route would require calibration against on-site observations.

Keep time selection independent of scroll progress: scrolling changes the camera, not the forecast time. Weather and day/night effects retain their existing independent controls. Give conditions a direct accessible route, show stale/unavailable data explicitly, and provide a reduced-motion view with the same information and an immediate view of the crossing. On mobile, use a shorter camera movement and place text clear of the route.

## Assets and interaction

- `landing-page-concepts.html`: self-contained, interactive review fragment, under 1 MB; no network requests.
- `assets/scene-low.webp`: composed from the four original hero layers, 1280×720 preview.
- `assets/scene-rising.webp`: first built-in imagegen water treatment, 1280×720 preview.
- `assets/scene-high.webp`: refined built-in imagegen high-water treatment, 1280×720 preview.
- The full generated high-water PNG remains local. The compressed review asset is archived as `assets/scene-high.webp`.
- `image-prompts.md`: exact generation/refinement prompts and provenance.

These original alternatives are archived for reference. The user chose the fixed-scene revision above; Data and History layout choices remain open. The documentation checkpoint does not release the local application implementation.

## Review checks

- Opened all three concepts in the browser and checked the desktop layouts, full castle framing, camera end position and condition overlays.
- Checked low, rising and high examples update both the painting and the qualified condition label. High water leaves only isolated stone tips visible.
- Checked the River journey arrival and high-water overlay at 320px, and the arrival at 360px. Compact phone overlays retain legible forecast controls and leave more of the water visible.
- Browser reported no warnings/errors during the review. Embedded scripts passed syntax checks; the self-contained fragment is about 678 KB, below the 1 MB limit.
- The temporary preview server was used only for review. The inline design file needs no server or live API.

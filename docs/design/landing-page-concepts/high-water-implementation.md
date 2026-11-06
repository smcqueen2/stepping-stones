# High-water scene artwork

## Application use — 2026-10-24

The approved high-water treatment is now `public/images/hero/04_river_high.webp` (1280×720, 157,546 bytes), copied unchanged from the review's `scene-high.webp`. No new image was generated for implementation. The original layers remain unchanged. The source was created with built-in imagegen using the prompts below.

The image loads on demand and is normalized to the hero canvas. `river-cover-mask.svg` exposes only water and the stone route, excluding the bank and swan. CSS supplies the static/reduced-motion treatment; the renderer reuses the decoded image as its eighth and final texture when snowy trees are also active. The packed animation mask uses red for open water and green for water plus the stone route. Both DOM and shader follow the same fade opacity. Original sky, landscape and castle pixels are retained.

Coverage is a bounded illustration of the selected combined risk, not an inferred water depth at the stones. This asset does not recalibrate the prediction model or promise physical accuracy.

Created 2026-10-23 with the built-in imagegen tool. These are design review assets, not physical simulations or live forecasts. The source reference was composed from the app's four existing hero layers; originals remain unchanged.

## Initial treatment, used for rising-water example

Generated file: `exec-d024f087-c2e0-45e4-97c9-092d70e8c90a.png`.

Use case: lighting-weather.
Asset type: high-water concept image for a website design review, using the existing Ogmore Castle watercolor illustration.
Image 1 is the EDIT TARGET. Preserve this exact composition, camera, scale, castle, trees, grass, fence, sky, river banks, swan, and delicate watercolor brushwork. Keep the same wide 1672 by 941 framing.
Change only the water and the visibility of the diagonal stepping-stone crossing in the lower river area: illustrate a high river combined with high tide. The river should lap over nearly all the stepping stones. Only a few tiny, broken, wet stone crowns should remain faintly visible, with soft partially submerged outlines below moving ripples. Water should occupy the gaps and flow across the stone tops so there is no continuous exposed dry route. Preserve exactly where the diagonal line of stones was, from the lower left foreground toward the right bank. Use the painting's existing natural blue-grey, olive and pale reflected water colours, with somewhat stronger irregular flow and soft white ripples; avoid a flat blue wash or photorealistic flood. Keep the banks, grass and castle intact; do not flood the lawn or change anything above the river. No graphic indicators, lines, arrows, labels, text, UI, new objects or watermark. This is an illustrative higher-water variant of the same painting.

## Refinement, used for high-water example

Generated file: `exec-e6ac2049-78d0-4d9e-a87a-c1aff3c46506.png`.

Use case: lighting-weather edit. Image 1 is the edit target, the high-water watercolor version of Ogmore Castle. Make one targeted change only: submerge the diagonal stepping-stone crossing almost completely. At present the stones still form a strong visible chain. Cover essentially all of that chain with blue-grey/olive river water and the existing irregular ripples, showing only three or four tiny isolated wet dark stone tips, each separated by long stretches of uninterrupted flowing water. The foreground stones must also be nearly submerged. There must be no continuous pale or dark dotted diagonal line of exposed stones. A few extremely faint stone shapes may be just perceptible under water. Preserve exact canvas, framing, colors, watercolor texture and all castle, grass, trees, fences, bank and swan pixels/composition outside the river. Do not raise the river onto the grass or flood the castle, change sky, add text, new objects or UI.

The generated PNG masters remain local, identified above by filename. The archived preview is `assets/scene-high.webp`; the application-specific asset and masks described above are part of the separate uncommitted landing implementation. WebP previews are 1280×720, quality 76. The prototype overlays only the river part of these treatments so the original castle and surroundings remain stable while example conditions change.

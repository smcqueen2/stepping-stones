# Snow-covered grass and trees

- Created on 2026-10-23 using the built-in imagegen tool, as a `lighting-weather` edit.
- Edit target: `public/images/hero/02_landscape_background.webp`. The PNG reference preserved visible RGBA pixels and cleared unused RGB only where alpha was zero. The approved snowy castle was supplied separately as a snow style reference.
- Final asset: `public/images/hero/02_landscape_snow.webp` (1671 × 941, 292,454 bytes). The generator returned one pixel less width than the source; normalized UVs and `object-fit: fill` align the variant with the 1672 × 941 scene. Converted to WebP at quality 90 without changing dimensions; generated alpha preserved exactly. Original artwork is unchanged.
- Loads only on first live or preview snow, alongside the snowy castle. The DOM layer supplies snowy grass and static/reduced-motion trees; it shares the existing lighting. Clip the empty lower 34% to keep faint generated remnants away from the river.
- The renderer reuses the decoded DOM image as one extra texture, bringing snowy scenes to seven texture units in the existing draw pass. It samples snow and foliage using the same branch displacement, so snow patches move with the trees. The shader reads the DOM layer's opacity to match its fade and safely retains the green landscape if the new asset fails to load. Texture is released on renderer disposal.

## Final prompt

Use case: lighting-weather
Asset type: transparent watercolor landscape layer for an existing layered website illustration.
Primary request: Edit image 1 to add settled snow over the grass and patchy snow on the trees.
Input images: Image 1 is the edit target, an existing transparent landscape layer containing trees, grass, fence and tiny remnants around transparent castle cutouts. Image 2 is only a style reference for the already-approved snow on the castle. Do not copy or add the castle from image 2.
Style/medium: Preserve the original loose, detailed watercolor brushwork, green/olive foliage and earthy landscape; snow should match the soft white and cool blue-grey watercolor snow in image 2.
Changes: Cover the low grassy strip across the full width with an obvious soft blanket of settled snow, following the small slopes. Leave a few irregular tufts and earth patches visible; keep the delicate fence and path visible. Add irregular patches of snow resting on upward-facing boughs and tree crowns across both left and right groups. Keep plenty of green and golden foliage visible between patches. Coverage must vary naturally from crown to crown, with small broken patches below larger snow caps.
Composition and invariants: Keep exactly the original 1672 by 941 canvas and the exact scale, position, contours and silhouettes of all trees, the grassy strip, fence, path, tiny buildings and all existing transparent castle-shaped gaps. It is a registered layer and must align with the original. Keep the entire empty sky area, castle cutouts and lower river area transparent. Do not fill holes with scenery. Do not paint a castle, water, river, new trees, mountains, sky, paper background or falling snowflakes. Do not crop, zoom or reposition. Preserve the watercolor feathered edges. Actual transparent background, no text, no watermark.

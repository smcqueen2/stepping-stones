# Site icon

The original, editable artwork is [favicon.svg](../../public/favicon.svg): a simplified jagged Ogmore keep above three stepping stones and a river. It uses the site's ink green (`#243a35`), cream (`#f8f5ed`) and a muted river blue. The bold silhouette and separated stones keep it readable at small browser-tab sizes. This is a hand-authored vector mark, with no fonts, external images or image-generation service.

`index.html` links to the SVG, a 32px PNG fallback, a multi-resolution ICO (16/32/48px), and a 180px Apple touch icon. Paths use Vite's `%BASE_URL%` so GitHub Pages' repository subdirectory is respected. The Apple export has an opaque green background for platform masking. No web-app manifest or service worker is needed for this change.

Raster exports were rendered directly from the SVG with `@resvg/resvg-js` 2.6.2 in a separate local tooling directory, and the ICO was packed from the rendered sizes using Pillow. Neither tool is a frontend dependency or part of the normal build. To regenerate, render the SVG at 16, 32, 48 and 180 pixels, use the green background for the Apple icon, and pack the three smaller sizes into `favicon.ico`. Preserve the SVG as the source of truth.

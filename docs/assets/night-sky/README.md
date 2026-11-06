# Watercolour night sky

Created 6 November 2026 for the owner's requested moon and twinkling stars on the dark sky.

## Moon artwork

- Generator: built-in `image_gen` tool, transparent output. This artwork is AI generated.
- Master: [moon-watercolour-master.png](moon-watercolour-master.png), 1254 × 1254 RGBA with real transparency, retained unchanged.
- App asset: [moon-watercolour.webp](../../../public/images/hero/moon-watercolour.webp), 256 × 256 with alpha, 13,774 bytes. Resized with Lanczos and exported as WebP quality 92, preserving transparency.
- Artwork is decorative; its crescent does not represent the current lunar phase or position.
- The app decodes this image on first use when its existing night-sky visibility becomes nonzero. It then reuses the image across previews.

## Exact generation prompt

> Use case: illustration-story. Asset type: a small transparent decorative moon illustration for a Welsh castle watercolour website night sky. Primary request: one beautiful hand-painted watercolour waxing crescent moon, isolated in the centre of a genuinely transparent square canvas. Shape: elegant gently irregular crescent with the illuminated outer arc on the right and two tips opening left, about three quarters of the canvas height; no separate planet or additional objects. Style: traditional delicate watercolour and gouache on cold-pressed paper, visible granular washes, feathered pigment edges, a little mottled pale grey-lavender in the warm ivory body, quiet muted golden light, natural asymmetry rather than a perfect vector shape. Gentle translucent pale halo close to the crescent only; preserve clear transparent negative space and transparent crescent interior. Designed to be legible at about 50 to 70 CSS pixels while matching a soft green-and-blue castle landscape painting. No stars, no sky background, no paper rectangle, no border, no words, no logo or watermark, no face, no photorealistic craters, no hard digital outline, no neon glow, no lens flare. This is decorative artwork, not an astronomical depiction of the current lunar phase.

## Star styling and scene integration

Eighteen CSS stars extend the previous gradient-based star treatment. Soft pigment-like centres, uneven small rays and restrained haloes match the moon's palette. Each star has its own size, duration and negative phase delay. Opacity and scale change slowly over 7.3–13.6 second alternating cycles, with no hard blinking.

Both celestial layers sit after the sky and before the landscape/castle layers, so the actual painted silhouettes cover them. They share the existing seasonal night fade and whole-scene grade. Existing cloud/fog washes and additional opacity attenuation soften them during weather; the decorative sky retains some moonlight and starlight through the stylised cloud treatment. Narrow/short views put the moon on the left, clear of the Scene control and keep.

Twinkle pauses in daylight, outside the scene viewport, in hidden tabs and on other page views. Reduced motion keeps static stars and disables the existing appearance transitions. The same artwork works without WebGL. No library, shader texture/pass or animation-frame loop was added for this feature.

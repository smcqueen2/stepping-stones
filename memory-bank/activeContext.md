# Active Context

- Date: 2026-10-23
- Workspace: stepping-stones
- Current focus: v1.1 single-page implementation with animated sections, probabilistic passability wording, scheduled data generation, and GitHub Pages deployment.
- Runtime model: frontend-only runtime; data prepared by GitHub Actions every 15 minutes.
- Current state labels: Likely Passable / Caution / Likely Unpassable.
- Observation submission: switched from GitHub-issue dependency to direct public form submission (endpoint configured in `public/data/config.json`).
- Hero river now uses lazy-loaded OGL 1.0.11 and a custom evolving refraction shader over the existing painting. The user found the preceding repeating SVG/CSS flow too regular; those moving layers have been removed. A feathered SVG mask protects the banks, stones and swan.
- Trees behind the castle sway in the same renderer. The 2026-10-23 revision replaces the broad shared waves with smaller canopy groups that have individual branch timing, flexibility and response delays. Gusts pass through unevenly spaced groups and fade into quiet spells, with smooth joins and small leaf movements. Existing landscape/sky/castle textures are reused; `tree-mask.svg` and castle alpha protect the tower, walls and anchored lower foliage. No additional package or WebGL context.
- Animation budget: one draw pass, 30 fps cap, 1080-pixel render width cap, no extra device-pixel scaling, offscreen/hidden-tab pause, static fallback for reduced motion or unavailable WebGL. Combined water/tree chunk is about 10.6 KB gzip; this sway refinement adds about 0.4 KB over the previous tree implementation.
- Local development verified with Node 22.23.4 and npm 10.9.9. Run `npm run dev`; the local preview uses port 5173.
- User accepted the less uniform tree sway; committed and pushed as `ca2916e82d03aa616998a4ff5b155499e0d5f357` on 2026-10-23, with all 16 then-existing tests passing. Remote main was verified to match.
- User accepted the day/night lighting and requested committing/pushing it, then adding live Ogmore weather, rain/snow effects, wind-responsive trees and manual scene buttons. SunCalc 2.1.1 calculates solar altitude at Ogmore, driving seasonal dawn/day/dusk/night colour washes over the complete painting. `Europe/London` clock handles GMT/BST; decorative moon/stars appear at night. The Lighting control offers explicit previews and Live local time; reload defaults to live. Minute updates pause when hidden and catch up on return. Reduced motion keeps the correct lighting without colour transitions, including the static artwork fallback.
- Lighting adds about 2.6 KB gzip JavaScript and 0.6 KB CSS; SunCalc adds no transitive runtime dependency or network request. Build, TypeScript and all 22 tests pass. A more distinctive home page remains future work.

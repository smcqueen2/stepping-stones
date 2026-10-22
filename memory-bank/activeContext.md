# Active Context

- Date: 2026-10-22
- Workspace: stepping-stones
- Current focus: v1.1 single-page implementation with animated sections, probabilistic passability wording, scheduled data generation, and GitHub Pages deployment.
- Runtime model: frontend-only runtime; data prepared by GitHub Actions every 15 minutes.
- Current state labels: Likely Passable / Caution / Likely Unpassable.
- Observation submission: switched from GitHub-issue dependency to direct public form submission (endpoint configured in `public/data/config.json`).
- Hero river now uses lazy-loaded OGL 1.0.11 and a custom evolving refraction shader over the existing painting. The user found the preceding repeating SVG/CSS flow too regular; those moving layers have been removed. A feathered SVG mask protects the banks, stones and swan.
- Trees behind the castle now sway in the same renderer: wind bends the crowns with varied gusts and small leaf movement. Existing landscape/sky/castle textures are reused; `tree-mask.svg` and castle alpha protect the tower, walls and anchored lower foliage. No additional package or WebGL context.
- Animation budget: one draw pass, 30 fps cap, 1080-pixel render width cap, no extra device-pixel scaling, offscreen/hidden-tab pause, static fallback for reduced motion or unavailable WebGL. Combined water/tree chunk is about 10.2 KB gzip; tree sway adds under 1 KB over the water-only version.
- Local development verified with Node 22.23.4 and npm 10.9.9. Run `npm run dev`; the local preview uses port 5173.

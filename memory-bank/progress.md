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

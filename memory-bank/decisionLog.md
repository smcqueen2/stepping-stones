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

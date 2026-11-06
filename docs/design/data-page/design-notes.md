# Dedicated data view exploration — 24 October 2026

The owner is away from the laptop and asked to explore a dedicated data page showing historical water levels and other useful data. This is design exploration, not approval to implement the data view. Preserve the accepted single-scene landing page and its existing local, uncommitted implementation.

## Review

`ogmore-data-page-concepts.html` is the self-contained inline review. Two meaningful layouts share the site's paper/serif style:

- **River journal**: dominant river graph, latest/minimum/maximum in the selected range, smaller tide and precipitation graphs, time inspector and readings table. Recommended starting point for general visitors.
- **Conditions compared**: aligned river, tide and precipitation graphs with a shared time inspector near the top. Suits exploring the timing of changes.

Both offer 24-hour, 48-hour and seven-day views. They have local presentation state, accessible native range controls, readable source timestamps, visible gaps and source details. On narrow screens the charts stack. Preview checked at desktop, 360px and 320px; time selection and period changes work, including 48-hour labels without overlap. Browser reported no warnings/errors. No app runtime dependency was added.

## Verified sources

The current generator downloads 48 hours of NRW river/tide readings for its calculations, but only exports live summary/forecast JSON. The workflow regenerates outputs; it does not maintain a durable historical observation or forecast archive.

On this date, seven-day requests using the existing public graph endpoint succeeded:

- River: station 4083, parameter 110, Ogmore at Bridgend, metres at that gauge; 690 unique readings in this snapshot (recording cadence can vary).
- Tide: station 72839, parameter 10254, Newport tide gauge, mAOD; 668 readings. Newport is a regional reference, not a measurement at the stepping stones.
- Weather: Open-Meteo `past_days=7` supplied 168 completed hourly precipitation values for the Ogmore coordinates. These are archived model outputs, not rain-gauge observations; precipitation includes rain, showers and snow water equivalent.

`history-study.json` is a dated snapshot fetched at 2026-10-24T18:26:59.473Z. The review embeds it and performs no API requests. It is not a live operational dashboard. `fetch-history-study.mjs` refreshes the research snapshot; `build-history-preview.mjs` combines it with the literal template. Null/invalid values are omitted and duplicate timestamps collapse; gaps longer than 45 minutes break level lines. The time inspector shows actual nearby readings within 20 minutes, separately timestamped; precipitation uses the completed hour containing the inspected time. Missing values stay blank.

NRW records are unverified and may change. Keep river metres and tidal mAOD on separate axes. Never label a gauge value as depth at the stones or invent a crossing threshold. Minimum/maximum labels refer only to the displayed window.

## Proposed implementation scope

1. Add a dedicated Data view within the same application, with a clear way back to the crossing scene. Lazy-load data charts so the animated landing page stays light.
2. Extend generation to publish a bounded seven-day historical file with per-series station, unit, source timestamp, coverage/gaps and provenance. Preserve existing forecast inputs and model weights.
3. Provide 24h/48h/7d periods, responsive charts, a keyboard/touch time inspector and accessible source readings. A CSV export would be useful in implementation.
4. Evaluate longer-term source coverage and an archive before offering month/year ranges. Aggregate longer periods while preserving peaks and gaps.
5. Later, compare forecasts saved **as issued** with timestamped on-site crossing observations. Existing forecasts must not be presented as historical observations, and today's model rerun must not be called the forecast issued in the past. Observation reporting is still disabled until its endpoint is configured.

Sources:

- https://naturalresourceswales.gov.uk/evidence-and-data/maps/river-levels-online-help/?lang=en
- https://api-portal.naturalresources.wales/apis
- https://open-meteo.com/en/docs

## Checkpoint status

The Data view remains design exploration. See [resume notes](../resume-notes.md) for the separate paused phone diagnostic and the local landing implementation. Neither issue changes this layout proposal or its dated research snapshot.

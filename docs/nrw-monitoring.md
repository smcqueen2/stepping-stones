# Local NRW readings and official warnings

Implemented 7 November 2026 within the existing static GitHub Pages / Actions architecture. No new runtime dependency, paid service or reporting backend.

## What changes and what stays calibrated separately

| Input | Use | Measurement |
| --- | --- | --- |
| Ewenny at Keepers Lodge, station **4099**, parameter **64** | Preferred home-page river number and twelve-hour observed graph; also detailed Readings | River level in **m**. The inspected feed supplies no datum; do not assume AOD or depth over the stones. |
| Ogmore at Penybont, station **4115**, parameter **112** | Separate downstream reading/trend/time in Readings | Tidal-influenced **river** level in **m**, datum unspecified by the feed. Not coastal tide height. |
| Ogmore at Bridgend, station **4083**, parameter **110** | Existing environmental model input; explicitly labelled Model river in Readings | Existing river-level scale, unchanged. Not silently substituted into the local Ewenny tile. |
| Existing regional NRW coastal gauge (Newport preferred) | Existing tide graph and environmental model input | Observed **mAOD**; never equated to local river metres. |
| Existing Open-Meteo Marine coastal model | Existing approximate high/low guide/countdown | Estimated coastal timings; its MSL output does not enter the crossing calculation. |

Live feed checks returned both local stations online, River Level parameters 64/112, unit `m`. Station metadata is validated against the expected station/parameter/type/unit before accepting the series. Null/blank/non-numeric and future observations are excluded. Failure leaves that station unavailable; it does not invent zero, borrow another station's datum or interrupt the other feeds. Each local reading ages independently, using the existing 120-minute gauge expiry. The local river graph uses the same actual-reading sampling, gap handling and per-graph scale as before.

The current risk model remains based on Bridgend, the regional tide gauge and rainfall. Its recent-48-hour normalisation, weights, trend extrapolation, rainfall coefficient and classification thresholds are unchanged. None is transferred to Keepers Lodge/Penybont. More relevant context is available now; a new quantitative relationship needs timestamped observations of the actual crossing, a documented station/datum/model version, and separate validation. There is no new safe-crossing threshold, travel-time assumption or local depth forecast. Community-report backend preparation remains on hold.

## Official warning API

The supported **Open Data - Live Flood Warnings and Alerts API - Version 3** was inspected in the [NRW developer portal](https://api-portal.naturalresources.wales/api-details#api=open-data-live-flood-warnings-and-alerts-api-version-3). The documented complete-feed operation is:

```http
GET https://api.naturalresources.wales/floodwarnings/v3/all
Ocp-Apim-Subscription-Key: <NRW subscription key>
Accept: application/geo+json, application/json
```

A keyless request was tested and returned **401 / missing subscription key**. The portal advertises free open-data access and OGL reuse with attribution. No account/key was created, purchased, entered into chat or placed in frontend assets.

The v3 contract is a GeoJSON FeatureCollection. Relevant feature properties are `FWACODE`, `DESCRIPTION`, `TIDAL`, `SEVERITY`, `SEVERITYVALUE`, `TIMERAISED`, `SEVERITY_CHANGED`, `RIM_CHANGED`, `RIM_ENGLISH` and `RIM_WELSH`. Numeric severity is 1 Severe Flood Warning, 2 Flood Warning, 3 Flood Alert, 4 Warning no Longer in Force. The implementation normalises English text, identity, severity and message/issue/severity-change times; it derives official links from a curated area ID, never from arbitrary response HTML/URLs. Commentary is rendered as text.

The all-areas feed is filtered by exact IDs from `data/nrw-warning-areas.json`, not nearest point or station. No public warning webpage is scraped during generation.

| Area | Reason for monitoring |
| --- | --- |
| [102FWB402A — Tidal area at Ogmore Castle](https://flood-warning.naturalresources.wales/Detail/102FWB402A) | Explicitly covers properties near the public house and castle. |
| [102FWB108A — River Ewenny at Ewenny Village](https://flood-warning.naturalresources.wales/Detail/102FWB108A) | Its official description also explicitly includes the public-house vicinity at Ogmore Castle, as well as the B4265 bridge. |
| [102WABF20 — Rivers Llynfi and Ogmore](https://flood-warning.naturalresources.wales/Detail/102WABF20) | Wider river-catchment alert context, connected to the downstream Ogmore system; labelled wider area, not a claim of flooding at the stones. |
| [102WABT04 — Swansea Bay and the Gower coast](https://flood-warning.naturalresources.wales/Detail/102WABT04) | Official description spans Llangennith to Llantwit Major, including the Ogmore coast. Labelled wider coastal context. |

Individual warnings elsewhere in these wider regions are not automatically added; only these four area IDs are monitored. Warning-area boundaries/definitions can change. The monitored list is explicit and inspectable in Readings, rather than a claim that all possible local flood hazards are covered.

## Status and precautionary advice

- Fresh Flood Warning / Severe Flood Warning: main advice becomes **Do not cross**, with distinct severe-warning styling/text. This works even if the environmental model is missing.
- Flood Alert: advice is at least **Caution**; it never lowers an existing higher-risk model result.
- A successful, valid, recent complete feed with no active relevant features: show **No active NRW warnings** for the monitored areas. This is not an all-clear for the stones.
- Severity 4 is a withdrawal, not a higher active severity. A fresh withdrawal can clear the previous escalation, while remaining available as source history.
- Missing key, authentication/rate-limit/server errors, timeout, malformed/partial feed, unknown relevant severity or unverifiable dates: **status unavailable**, never “no warnings”.
- A last-known active warning remains visible as **last known / current status unverified** through an outage or expiry; its precautionary advice is retained until a newer valid response clears it. An older deployment/cache cannot erase a newer warning already seen by the tab.

The model score/result and the warning escalation stay separate. Neither gauge values, forecast scores nor illustrative water coverage are altered by warning severity. The selected future model hour does not change current official warning status, and the forecast dialog explains that distinction.

Warning **check time** is separate from issue/message time. An old message can still be active in a fresh feed. Only successful parsing sets `checkedAt`; failed attempts use `attemptedAt` and retain the original successful time under `lastKnown`. The browser expires verification after **45 minutes**: an operational allowance for source publication, scheduled build and client refresh, not a physical safety threshold or guaranteed delivery time. Re-rendering an open tab never resets that clock. A failed browser JSON refresh also removes verification immediately.

NRW requests have a 15-second timeout; browser data requests have the existing 10-second timeout. Demonstrably old intermediary cache responses are rejected. Dates must include an explicit zone/offset; the integration deliberately does not guess the meaning of unqualified provider times. All display times use Europe/London with GMT/BST.

## Build, caching and failure isolation

`npm run generate:data` now invokes `scripts/generate-all-data.mjs`, which runs the unchanged environmental-model generation alongside the new monitoring generation. Local station requests and the warning request also run independently. `public/data/monitoring.json` contains only normalised public measurements/statuses, not credentials or raw error bodies. Its committed bootstrap contains unavailable states, not fictional live readings.

If the model fails but monitoring succeeds, the new monitoring/warning snapshot can still deploy. Existing model files retain their original timestamps and expire normally. If monitoring cannot publish but the model can, the previous monitoring file's timestamps are retained and warning verification expires normally. If neither pipeline can publish, the command fails. API-level failures are represented as explicit unavailable statuses within a successful monitoring output.

Only a successfully parsed warning response updates `.cache/nrw-warnings.json`. The existing Actions workflow restores/saves that small public-data cache using `actions/cache@v4`, so later failures can retain the last-known warning across builds. It contains no subscription key. Cache eviction/missing cache is supported and results in unknown status where no successful response is available.

Actions is scheduled every 15 minutes; the browser refreshes static files every 15 visible minutes and ages statuses every minute. Source cadence, build/deploy time and scheduling delays add latency. [GitHub schedules may be delayed/dropped or disabled after public-repository inactivity](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows). [NRW provides no guaranteed API service level](https://api-portal.naturalresources.wales/). The site is a periodically refreshed information display, not an emergency-notification service; the official source link remains visible.

## One-time setup for the owner

1. Sign up at the [NRW API portal](https://api-portal.naturalresources.wales/) and subscribe to **Open Data - Live Flood Warnings & Alerts API Data**. Use a subscription key authorised for the v3 product.
2. In the GitHub repository, open **Settings → Secrets and variables → Actions → New repository secret**. Name it **`NRW_API_KEY`** and enter the key privately. [Repository Actions secrets](https://github.com/smcqueen2/stepping-stones/settings/secrets/actions).
3. Run **Actions → Build and Deploy Pages → Run workflow**. The key is passed only to the generation step as an environment secret, never as a Vite/frontend variable or URL query parameter.
4. After deployment, inspect `/stepping-stones/data/monitoring.json`: `floodWarnings.status` should be `available`, with a recent `checkedAt` and either relevant warnings or a legitimately empty array. Inspect Readings and its source notes too.
5. If status remains unavailable, check the controlled `reason`: `not-configured`, `authentication`, `request-failed`, `stale-response` or `invalid-response`. Verify product subscription/approval and retry. `invalid-response` needs a schema/timestamp check against the authenticated v3 output; it does not indicate a clean feed. Do not paste the key or provider request headers into chat/logs.

For local development, set `NRW_API_KEY` privately in the launching shell before `npm run generate:data`; do not put it in `.env` files committed to Git or use a `VITE_` prefix. Local readings work without this key through the existing NRW gauge transport; warning status remains unavailable until configured.

## Validation limits

The local gauge metadata/series and keyless 401 response were verified live. Parsing, all severities, withdrawals, empty/invalid feeds, stale/future data, failures, last-known retention and warning/model separation are covered by clearly labelled fixtures. The authenticated warning operation still needs the owner's key and a live smoke test; fixture success is not represented as a verified authenticated integration. Unexpected schema or timestamp differences fail to unavailable, rather than inventing a clean status. No model calibration is claimed.

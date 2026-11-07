# Coastal tide timing guidance

Added for the home-page request of 6–7 November 2026: prioritise high/low tide status, upcoming high tide time and remaining time instead of a regional height number.

## Source and reuse

- [Open-Meteo Marine documentation](https://open-meteo.com/en/docs/marine-weather-api), checked 7 November 2026. `sea_level_height_msl` includes tides and other sea-level effects. Approximate resolution 0.08 degrees / 8 km; accuracy is limited near coasts and may be unreliable inland. Not a navigation source.
- [Open-Meteo licence](https://open-meteo.com/en/licence): data under CC BY 4.0, with visible Open-Meteo/model-provider attribution and adaptation identified. Attribution appears next to the card and in Readings.
- [Non-commercial API terms](https://open-meteo.com/en/terms): the hobby/community site's existing free, non-advertising use fits the free endpoint. Review access terms if commercial use is introduced.
- Model-provider credit: generated using E.U. Copernicus Marine Service Information, [Global Ocean Physics Analysis and Forecast](https://doi.org/10.48670/moi-00016). No model code was copied.

Request: `https://marine-api.open-meteo.com/v1/marine?latitude=51.461&longitude=-3.631&hourly=sea_level_height_msl&past_days=1&forecast_days=3&timezone=GMT&timeformat=unixtime&cell_selection=sea`.

This selects a sea cell near the Ogmore coast, not the inland stepping stones. The checked response cell was 51.458336, -3.7083282; returned coordinates are retained in the payload so grid selection stays inspectable. All source times are Unix UTC seconds, converted to ISO UTC. Browser formatting uses Europe/London, so GMT/BST and date rollover follow the location rather than the visitor's timezone.

## Derivation and presentation

`scripts/lib/tide-timing.mjs` detects high/low turning points bracketed by three valid, equally spaced hourly sea-level samples. It estimates a turn with a three-point quadratic interpolation and rounds the result to the nearest half-hour. Nulls and irregular/missing steps cannot create a turn. No arbitrary astronomical period or observed Newport extrema are used to infer these coastal event times.

Optional `live.tideTiming` contains provider/location/grid coordinates, generation time, forecast coverage and ordered high/low events. It contains no sea-level heights. The page validates alternating events, plausible 3–9-hour spacing, coverage and a six-hour cache limit before showing guidance; missing/expired timing clears previous text. The marine request has a 15-second timeout, fails independently and is made only during static data generation. No visitor location, browser request, new dependency, account, key or storage service is required.

The display uses Coming in/Going out, or Around high/low tide within 30 minutes of the rounded event. The next high remains the current one for that around-high window, then rolls forward. The previous low is shown while rising, or the upcoming low while falling. High times use `~`; both times and countdown are approximate, with countdown rounded to half-hours. Rounding and around-turn bands are presentation choices, not measured error bounds. Forecast values remain subject to the source model's coastal limitations.

## Relationship to crossing guidance

The coastal guide does not predict the estuary's response, depth at individual stones, start/end of passability, or a safe duration. River flow and rainfall still matter. The existing NRW regional gauge and projection continue to feed the crossing model without changing scores, thresholds or calibration. The coastal model's MSL datum is different from NRW AOD and is not mixed into those calculations.

River telemetry and marine guidance expire independently. A fresh marine forecast is allowed to show estimated tide times when the river/outlook correctly says its readings are out of date. There is no fabricated countdown if the marine source fails, even if NRW gauge values are available. Detailed Readings retains the numeric NRW tide value and explains the distinction.

## Alternatives checked

[ADMIRALTY EasyTide](https://www.admiralty.co.uk/access-data/tidal-data/easy-tide) provides official port tide times for browsing, but its [FAQ](https://easytide.admiralty.co.uk/FAQs) does not permit republication from EasyTide. The [UK Tidal API FAQ](https://developer.admiralty.co.uk/faqs) also excludes caching on the free Discovery tier, which does not suit generated static Pages data. No scraping, account setup, paid subscription or unlicensed tide-table copy was introduced. A future licensed local port feed could replace the coarse guide if tighter coastal timing accuracy is required.

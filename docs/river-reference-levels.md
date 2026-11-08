# River graph reference levels

The owner requested high/low watermarks on the river tile, then chose NRW's official **all-year** typical range instead of a comparison with one previous month. These are visual reference levels, not monthly averages, record extremes, flood-warning thresholds or safe-crossing levels.

## Source and reviewed values

Checked **8 November 2026**:

| Field | Value |
| --- | --- |
| Station | Ewenny at Keepers Lodge, **4099** |
| Parameter | River Level, **64** |
| Unit / datum | **m** at this gauge; datum unspecified in the public metadata |
| Typical low | **0.203 m** |
| Typical high | **0.538 m** |
| Scope | **All year**, not month-specific |

Primary sources:

- [NRW station page and its published graph configuration](https://rivers-and-seas.naturalresources.wales/Station/4099?parameterType=1).
- [NRW station/parameter metadata](https://rivers-and-seas.naturalresources.wales/Station/GetData/4099?includeStationParameters=true).
- [NRW's explanation of typical ranges](https://naturalresources.wales/evidence-and-data/maps/river-levels-online-help/?lang=en): historical levels at that gauge throughout the year. The documentation does not specify percentiles or a monthly climatology, so the application makes neither claim.

The station page's embedded `NRW.Pages.StationDetails` JSON supplies `parameters[id=64].graphConfiguration.typicalLevel`. Its inspected fields are `min: 0.538` and `max: 0.203`; they are inverted by numeric order. The two published bounds have been ordered numerically for the low/high labels. The record-level annotations (including 0.158 m and 2.239 m historical extremes) are different values and are deliberately not used as the typical range.

`src/data/river-reference.json` is a small **reviewed metadata snapshot**, bundled with the frontend. It is not automatically refreshed and its `checkedOn` date is not a telemetry timestamp. This avoids adding fragile HTML scraping or another provider call to each fifteen-minute data refresh. To update it, recheck the official page's matching station, parameter, units and datum, verify the typical bounds rather than the graph's axis limits/record annotations, and update the review date and evidence here. A changed datum or station must not silently inherit these values.

## Display and failure behaviour

- The references are used only alongside validated Keepers Lodge 4099 / parameter 64 observations, with matching NRW/m/unspecified-datum identity. Bridgend, Penybont and the coastal tide do not borrow them.
- The river curve and two dashed reference lines share one vertical scale. The domain includes observations outside the typical band; they are not clipped or clamped onto a reference. Actual observed minimum/maximum remain distinct from the reference bounds in the accessible description.
- Both lines have fixed-font HTML labels, **Typical high 0.538m** and **Typical low 0.203m**, so phone-sized SVG scaling does not shrink their text. Labels remain separated if exceptional readings compress the band.
- The caption links to NRW and explicitly says **NRW typical range · all year**. The accessible description and link tooltip include scope, checked date and the distinction from crossing-safety levels.
- Old/missing/invalid gauge history clears the complete graph and references under the existing freshness rules. Older payloads need no new field or endpoint; the regional tide graph retains its existing rendering.
- Reference levels do not enter the model, warnings, crossing advice, weather, water illustration or forecast. No calibration, risk threshold or dependency changed.

The NRW station page exposes up to thirteen months of graph history. That is not a long-term monthly normal. Month-specific context would need a suitable multi-year, station-consistent dataset and a documented comparison method before being labelled typical for a particular month.

# Resume notes — evening checkpoint, 24 October 2026

The owner paused work for the evening and requested a commit/push of the design documentation. This checkpoint saves the proposals and evidence for later review.

## Resume audit — 6 November 2026

The archive was present locally, but the earlier session had not completed its commit/push. Local and remote `main` still pointed to `06f8b7d`. The previously requested documentation-only checkpoint is being completed on resumption. The landing implementation remains separately uncommitted; Data and History remain design proposals awaiting feedback. No local development server was listening on port 5173 at this audit, and Packet Monitor was stopped. The recorded application tests below describe the October validation and have not been rerun for this documentation checkpoint.

### Subsequent implementation release — 6 November

The documentation archive was pushed as `a7f08fc`. The owner then requested completing the landing work and phone preview. The previously local landing source is now included in the application commit with an initial mobile pass: short-landscape layout correction, larger touch controls/text, compact Scene toggle, safe areas, bounded settings panel and sticky dialog Close controls. All 46 tests, TypeScript and production build pass again. Data/History still await layout selection and implementation. The earlier local/uncommitted descriptions below document the October checkpoint, rather than this subsequent application release. See the main README for LAN and optional authorised Android USB preview commands.

## Landing page: accepted direction

- Keep the castle, river and stepping stones in one stable frame. The user rejected scrolling/panning after trying the initial concepts.
- Show a simple prediction overlay immediately. Selecting the forecast time should change the illustrated water coverage/current and qualified crossing condition together.
- Keep the established watercolour artwork, paper/serif styling, local-time lighting, weather, independent wind, snowy castle/grass and irregular tree sway.
- Higher combined risk can conceal more stones, but upstream river metres and regional tidal mAOD are not physical depth at the crossing. The scene is an illustration of the prediction.

The revised design was explicitly approved for implementation. That implementation is present in the original working checkout, including Now/+1h/+3h and future-hour selection, native dialogs, stale/unavailable handling and a generator correction to select the next 24 future hours. The recorded verification was 46 passing tests, TypeScript, production build and desktop/phone browser checks. Screenshots are [desktop](landing-page-concepts/implemented-desktop.png) and [phone](landing-page-concepts/implemented-mobile.png).

**The application implementation is not included in this documentation-only commit.** At the start of this checkpoint, the last released application revision was `06f8b7d2d5edd55f9b2e64ad7a3baee67e48b99d` (independent wind and snowy scenery). A fresh clone therefore has the earlier application plus these design records. The local source, generated preview data and implementation-specific asset files remain uncommitted for a separate review/release. Check `git status` in the original checkout before resuming.

## Data page: next decision

Review **River journal** against **Conditions compared**, then choose the layout and first scope. Suggested first release is 24h/48h/7d river, tide and model precipitation with explicit source units/timestamps, gaps and accessible readings. Month/year ranges need a source-coverage and storage decision. Forecast verification requires forecasts archived as issued plus genuine crossing observations.

The saved seven-day study is dated `2026-10-24T18:26:59.473Z`. It is not a live dashboard. No Data page implementation is approved or present yet.

## History page: next decision

Review **Living landscape** against **Painted chapters**. Both have one-page, click-to-slide navigation through the same twelve milestones, with expanded source/context notes and a separate local-folklore companion.

Read the research brief before editing the copy. In particular: the stones cross the Ewenny and are probably medieval with later changes; the exact founder/date is unknown. The Lancaster marriage has a source-date discrepancy. The 1928 agreement is guardianship, not a purchase. Modern reserve management is described as dated events rather than an unchecked claim about current responsibilities. Historical paintings remain interpretive.

No History page implementation is approved or present yet.

## Phone access: paused and unresolved

The local app served HTTP 200 from both loopback and the laptop's Wi-Fi address, but the phone continued to report `ERR_TOO_MANY_RETRIES`. A narrowly filtered packet capture ended early on a counter-log file lock; the helper was repaired and cleanup left Packet Monitor stopped. The available recording does not reliably cover the latest retry and establishes no definitive cause.

Next check, with the owner available: confirm the phone's current Wi-Fi IP and try the plain connection-test URL in a different already-installed browser. Then, if needed, take one synchronized bounded capture. Check actual listener/address/helper state first. Do not disable firewall, network isolation or adapter protections merely to test a theory. Local trace/log files are not part of this archive.

## Picking up

1. Review this checkpoint and `git status`; preserve the existing local implementation.
2. Choose the Data and History designs explicitly; carousel selection alone is not approval.
3. Continue the selected view or review/release the local landing implementation as requested.
4. Refresh live data and repeat only the validation relevant to the next code change before releasing application work.

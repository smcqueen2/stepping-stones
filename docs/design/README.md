# Design checkpoint — 24 October 2026

Start here when returning to the website design work. This folder preserves the reviewed designs, illustrations, research, source templates and decisions in the repository.

Prepared on 24 October; documentation checkpoint completed when work resumed on 6 November 2026. The earlier session ended before staging/committing/pushing, so these files had remained local. See the resume notes for the verified distinction between this archive and the uncommitted landing implementation.

## Current direction

| Area | Saved review | Status |
| --- | --- | --- |
| Landing page | [Fixed single-scene preview](landing-page-concepts/index.html), [design notes](landing-page-concepts/design-notes.md) | User accepted one stable castle/river scene with immediate prediction overlays. Implemented locally; application changes remain uncommitted at this documentation checkpoint. |
| Data | [Two interactive designs](data-page/index.html), [scope and sources](data-page/design-notes.md) | River journal and Conditions compared await feedback. Design exploration only. |
| History | [Two interactive designs](historical-timeline/index.html), [historical research](historical-timeline/research-brief.md) | Living landscape and Painted chapters await feedback. Twelve researched milestones and four new watercolours; design exploration only. |
| Earlier landing ideas | [Original three concepts](landing-page-concepts/earlier-concepts.html) | Archived for reference. Their scroll/pan interaction was explicitly rejected and superseded by the fixed scene. |

The suggested starting designs are **River journal** for Data and **Living landscape** for History. These recommendations are not recorded as user approval.

## Inspect the previews

After cloning, open a linked `index.html` in a browser. These are standalone exports with their own design-switching controls. GitHub displays the HTML source rather than running it. The Data preview loads pinned D3 7.9.0 from jsDelivr and needs internet access for its graphs; all study readings and painting images are embedded. Values are a dated review snapshot or illustrative forecast examples, not live conditions.

The original conversation fragments are also retained:

- Landing: `landing-page-concepts/ogmore-single-scene.html` and `landing-page-concepts/landing-page-concepts.html`.
- Data: `data-page/ogmore-data-page-concepts.html`.
- History: `historical-timeline/ogmore-history-timeline-concepts.html`.

The fragments are editable sources for reopening in the conversation; the standalone exports supply the surrounding review runtime.

## Resume the work

Read [resume notes](resume-notes.md) for the next decisions, the local implementation status and the separate unresolved phone-access issue. The [project memory checkpoint](../../memory-bank/designCheckpoint.md) points back here.

## Sources, assets and rebuilding

- Landing artwork: [exact prompts](landing-page-concepts/image-prompts.md), three compressed water states and saved desktop/phone screenshots. [Implementation notes](landing-page-concepts/high-water-implementation.md) describe the local use of the high-water painting.
- Data: dated `history-study.json`, source-fetch study, literal template and build script. NRW river/tide readings stay separate from archived Open-Meteo model precipitation. See the source and uncertainty notes before implementation.
- History: `timeline-content.json` maps every milestone to sources and date qualifications. [Exact image prompts](historical-timeline/image-prompts.json) and [asset provenance](historical-timeline/generated-assets.json) accompany the compressed paintings. Generated reconstructions and local folklore are labelled explicitly.

Use Node 22 to rebuild the Data/History conversation fragments from the repository root:

```powershell
node docs/design/data-page/build-history-preview.mjs
node docs/design/historical-timeline/build-preview.mjs
```

The standalone exports represent this checkpoint. After editing a fragment, regenerate its standalone export with the Codex visualization export tool before reviewing it in an ordinary browser. Refreshing `history-study.json` is an explicit research action: the saved snapshot was fetched on 24 October 2026 and should retain that date when comparing the original designs.

Only compressed preview artwork is archived here. Original generated PNG masters remain local, identified by filename in the provenance notes. Downloaded third-party publication scans and extracted book text are not redistributed; the research links to the original sources. Temporary preview servers, logs, packet captures, machine-specific paths and credentials are outside this design archive.

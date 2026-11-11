# Wider valley history: evidence and editorial decisions

Reviewed 11 November 2026 against the owner's handover. This extends the existing continuous History page from 12 to 15 milestones. The canonical copy remains in [timeline-content.json](timeline-content.json); no historical dates are derived from the artwork.

## Evidence and placement

| Topic | Evidence used | Editorial treatment |
| --- | --- | --- |
| Early Christian Merthyr Mawr | [Cadw 11242](https://cadwpublic-api.azurewebsites.net/reports/listedbuilding/FullReport?id=11242), History; [Church Heritage Cymru 2956](https://heritage.churchinwales.org.uk/CHR/ChurchDetails.aspx?id=2956), Archaeology and History | A new chapter between the prehistoric/Roman overview and the Norman castle. Memorial-stone dating is distinguished from a church foundation date and from the much later standing building. |
| Candleston | [Cadw 11230](https://cadwpublic-api.azurewebsites.net/reports/listedbuilding/FullReport?id=11230), History and Exterior; [GM095](https://cadwpublic-api.azurewebsites.net/reports/sam/FullReport?id=2243&lang=en); [Coflein 93050](https://coflein.gov.uk/en/sites/93050) | A dedicated 1300s milestone after Lancaster and before the revolt. A fortified residence, not a second Norman military foundation. |
| Candleston's landscape | [Heneb, Merthyr Mawr Warren](https://heneb.org.uk/hcla/merthyr-mawr-kenfig-and-margam-burrows/merthyr-mawr-warren/), Historic Background | Settlement loss beneath sand is kept distinct from the residence's longer occupation. The 1500s–1600s Ogmore chapter no longer repeats this story. |
| River baptisms and Old Star Cottage | [Coflein 19537](https://coflein.gov.uk/en/sites/19537), Description; existing [stepping-stones record GM184](https://cadwpublic-api.azurewebsites.net/reports/sam/FullReport?id=2875) | Enhanced within the final crossing chapter, rather than assigned an invented event year. The cottage's preparation role remains a suggestion. |
| Rifle range | [Coflein 420030](https://coflein.gov.uk/en/sites/420030), David Leighton's record of 9 April 2014 | A new 1877 milestone between the estate and guardianship chapters. The map date is evidence of the range, not its opening date; no regiment is named. |
| White Lady | [Marie Trevelyan, *Folk-lore and Folk-stories of Wales* (1909), pp. 200–201](https://archive.org/details/afl2317.0001.001.umich.edu/page/200/mode/2up); [searchable original text](https://archive.org/stream/afl2317.0001.001.umich.edu/afl2317.0001.001.umich.edu_djvu.txt) | Added beside Hawise in an undated folklore accordion, outside the chronological rail. No invented speech, named participant or historical treasure claim. |

## Qualifications that matter

### Church, stones and saint

The official listing dates memorial stones to the fifth and sixth centuries and treats them as evidence suggesting an early church site. It does not establish an exact foundation year or prove that Teilo founded it personally. Church Heritage Cymru records stones from several periods, as well as the later rebuilding. A collection of memorials must not be presented as the surviving fabric of a fifth-century building.

The present church is dated 1849–51 by both Cadw and Church Heritage Cymru's detailed account. The [National Churches Trust summary](https://www.nationalchurchestrust.org/church/st-teilo-merthyr-mawr) instead gives the wider span 1848–1852. Display copy follows the statutory record and the detailed church history; it does not silently merge the ranges. The new church painting explicitly represents the later building, not an early medieval reconstruction.

### A house which outlasted its surrounding settlement

The de Cantilupe name appears with variant spellings in records. No specific individual is asserted as the securely identified builder. The residence's later building work and domestic use are supported by the listed-building and Royal Commission records. Coflein distinguishes elite residence into the early nineteenth century from subsequent farmhouse use into the late nineteenth century. This prevents an oversimplified claim that sand buried the whole inhabited complex in one disaster.

### Everyday religious life

RCAHMW records the baptism association and qualifies the cottage's possible use for preparations. It gives no ceremony date or denomination. A dated personal account or parish/nonconformist register would be needed for a more specific story. The visible crossing summary now explicitly separates historical use from present-day safety.

### Mapping a training ground

The range chapter follows RCAHMW's reading of the 1877 and 1899 maps, not an independent transcription of the original sheets or a new field survey. Its treatment of uncertain firing positions is retained. Other Warren ranges have separate records; their units and later events are not transferred to this one.

### Folklore is evidence of a story, not its events

The previously recorded difficulty extracting the White Lady story has been resolved using the Internet Archive's searchable transcription. The Ogmore account appears at the end of printed page 200 and continues on 201. Neighbouring Ewenny traditions in the same chapter are distinct. The year 1909 dates publication; it is not inserted as a haunting milestone. The family-facing summary omits graphic details without adding dialogue or events.

## Artwork and existing components

- [Candleston study](assets/candleston-v1.webp) and [St Teilo study](assets/st-teilo-v1.webp) are new, clearly labelled AI-generated paintings, produced with the built-in image-generation tool. Exact prompts, source descriptions, master filenames and limitations are in [expansion-artwork.json](expansion-artwork.json).
- Both delivery assets are 1024×576 WebP. Delivery processing only resized and compressed generated masters. No third-party photograph or map scan is redistributed.
- These images were generated from textual descriptions, not measured surveys. Building details, the churchyard arrangement and individual stone carvings are interpretive. The supplied dates must not turn them into claims of exact historical appearance.
- The rifle-range chapter reuses the existing Warren landscape study; it does not invent a uniformed unit, a ceremony, target layout or surviving structures in the painting.
- Existing chapter rendering, lazy image loading, vertical rail, source notes, keyboard navigation and back-to-top control remain in use. The renderer accepts a second folklore item alongside the original Hawise entry. The archived horizontal design exports remain historical design snapshots; the application and canonical content are the current experience.

## Validation

- Full suite: 222 passing tests across 26 files. The History/navigation subset has 16 passing checks. Chronological insertion, unique milestone identifiers, matching source links, complete artwork/AI labels, two undated folklore entries, rail progress, final-item keyboard navigation, reduced motion and cleanup are covered.
- TypeScript and the production build pass using the selected Cloudflare endpoint. No dependency or crossing-risk model change was needed. The repository has no configured lint or formatter command; edited source passes `git diff --check`.
- Browser review: 15 chapters and 15 dates rendered at 1366×768. Candleston's new image loaded and its correct rail date became active after scrolling. St Teilo's chapter and AI label rendered on a 412×892 phone; all 15 dates fit in the existing 420px rail.
- The 320×740 view had no horizontal overflow. At 740×360, the rail scrolled independently; End then Enter reached the final crossing and restored heading focus. The White Lady entry expanded separately with its folklore/publication label and original-source link.
- The design generator now accepts optional compact preview artwork so the additional paintings do not breach its existing inline size limit. `node docs/design/historical-timeline/build-preview.mjs --check` validates 967,726 bytes, 15 milestones and eight paintings without overwriting the archived exports. The app uses the full 1024×576 assets; only the optional archive generator uses the new 512×288 previews.

## Implementation files

| File or group | Change |
| --- | --- |
| `timeline-content.json` | Three chapters, source records, updated crossing/ruin copy and a second qualified folklore entry. |
| `src/lib/history-timeline.ts` | Two new artwork keys, wider-landscape accessible description and multiple folklore accordions, using existing chapter rendering/navigation. |
| `src/history.css` | Spacing between folklore accordions; the rail adapts to its data count without a layout rewrite. |
| `tests/unit/history-timeline.test.ts` | Chronology/source/folklore coverage and content-length-based final-item/scroll assertions. |
| `assets/candleston-v1.webp`, `assets/st-teilo-v1.webp`, `expansion-artwork.json` | New labelled paintings and exact generation/provenance record. |
| `assets/previews/`, `build-preview.mjs`, `timeline-template.html` | Compact optional inline artwork, non-writing generator check and multi-story folklore support. |
| `research-brief.md`, this note, project `memory-bank/todo.md` | Current findings, evidence/uncertainty, validation and project checkpoint. |

## Further research opportunities

Look for dated baptism accounts and the identity of the volunteer unit before adding names or detailed scenes. Photograph/plan-led reviews could improve the architectural illustrations, but the current studies must remain labelled interpretive. Earlier stone provenance could support a dedicated memorial-by-memorial account if the scope grows later.

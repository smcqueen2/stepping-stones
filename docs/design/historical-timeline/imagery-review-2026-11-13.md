# Ogmore Castle: a wider set of views

The owner's entrance photograph and [Medieval Heritage's Ogmore article](https://medievalheritage.eu/en/main-page/heritage/wales/ogmore-castle/) prompted this focused artwork update. Three new paintings replace three repeats of `present-castle.webp`; the familiar river-and-stones view stays with the final crossing chapter.

| Chapter | New illustration | Evidence and treatment |
| --- | --- | --- |
| A stronghold becomes a ruin | [Entrance view](assets/entrance-v1.webp) | The photograph supplied by the owner guides the surviving keep, gateway and modern bridge. The keep remains left of the gate in this view. |
| Justice among the ruins | [Courthouse](assets/courthouse-v1.webp) | A watercolour adaptation of Joseph French's [2026 photograph](https://commons.wikimedia.org/wiki/File:The_courthouse,_Ogmore_Castle_-_geograph.org.uk_-_8414474.jpg). This depicts the courthouse itself, rather than substituting a view of the main keep. |
| A future for the ruins | [Inner-ward remains](assets/inner-ward-v1.webp) | A watercolour adaptation of Nilfanion's [2013 photograph](https://commons.wikimedia.org/wiki/File:Ogmore_Castle_(4842).jpg), made with support from Wikimedia UK. Closer framing gives the standing walls and low room foundations their own chapter. |

All three are explicitly labelled **AI generated** and **present-day studies** in captions and alt text. None is evidence of the site's exact appearance at the accompanying milestone date. In particular, the modern footbridge is not presented as a surviving sixteenth-century bridge, the roofless courthouse is not an image of a hearing in 1803, and the conservation view is not an archival image from 1928. The river crossing is outside these camera views; the existing medieval river reconstructions and their stepping stones are unchanged.

## Historical illustrations and source criticism

The newly linked article credits a twelfth-century keep reconstruction and an early-thirteenth-century castle reconstruction to Chris Jones-Jenkins, and another thirteenth-century reconstruction to the Royal Commission on the Ancient and Historical Monuments of Wales (RCAHMW). Its illustrations also include a 1776 engraving attributed to Richard Bernard Godfrey and several phased plans. These are useful comparisons for the earlier chapters; links and explicit artist credits now appear in their expandable source notes.

No redistribution licence was established for the artists' reconstruction images on that article. They remain linked on their original page; no scan of those works is bundled, hotlinked or labelled as our AI artwork. The new paintings use the owner's supplied photograph or the two separately verified Creative Commons photographs above, with the existing approved painting as a style reference.

The article is an illustrated secondary synthesis, not a replacement for the official evidence already cited. [Cadw's statutory record](https://cadwpublic-api.azurewebsites.net/reports/listedbuilding/FullReport?id=21793) describes the keep, gateway and courthouse; [Coflein NPRN 93019](https://coflein.gov.uk/en/sites/93019) remains the source for the main abandonment interval and courthouse use into 1803. Existing date qualifications are retained, including the 1297/1298 marriage discrepancy. The article's dated 2018–19 visiting information is not used as current opening guidance.

## Credits, delivery and reproduction

- `courthouse-v1.webp` is an AI-generated watercolour adaptation of **The courthouse, Ogmore Castle**, Joseph French, 26 September 2026, Geograph/Wikimedia Commons. The reference and this adaptation are offered under [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/). Changes include watercolour style, reframing and light/palette. The linked record identifies the creator and licence; no endorsement is implied.
- `inner-ward-v1.webp` is an AI-generated watercolour adaptation of **Ogmore Castle (4842)**, Nilfanion, 13 June 2013, supported by Wikimedia UK. The reference and this adaptation are offered under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Changes include watercolour style, framing and omission of the bench and marker. No endorsement is implied.
- `entrance-v1.webp` uses the entrance photograph supplied by the owner. The source is identified as supplied, without asserting that the owner took it or granting an unverified third-party licence.
- User-facing photograph credits, changes and licence links are in each relevant chapter's existing source accordion. The licences apply to the identified adapted images, not indiscriminately to the repository or other artwork.
- Exact built-in image-generation prompts, master filenames, delivery paths and limitations are recorded in [view-variety-artwork.json](view-variety-artwork.json).
- Application images are 1024×576 WebP. Processing only resizes and compresses generated paintings. Small archive-only previews, including a new compact preview of the existing river painting, keep the non-writing design-generator check below its existing one-million-byte limit. The application uses the larger assets.
- Archived generated HTML exports are retained as historical snapshots. The template supports the new artwork notes when a fresh export is requested.

## Validation

- All 16 History, lazy-loading and navigation tests across three files pass, including source/credit links, AI labels, scroll progress and keyboard navigation. TypeScript and the production build pass; no dependencies changed.
- The non-writing design-generator check passes at 943,723 bytes, 15 chapters and 11 paintings, including artwork-note support. Existing generated HTML exports were not overwritten.
- Browser review at 1280×800, 412×892 and 320×740 found no horizontal overflow. All three new application images loaded at 1024×576. The entrance, courthouse and inner-ward chapters, timeline jumps, expanded source notes, creator/licence links and Medieval Heritage reconstruction link were checked. Temporary viewport overrides were reset.
- The owner reviewed the local History preview and approved publication on 13 November 2026. Screenshot: workspace parent `history-varied-views-preview-2026-11-13.png`.

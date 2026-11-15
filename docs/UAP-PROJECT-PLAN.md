# UFO Globe: Project Plan

Nov 15, 2026 · @Leanne McLaughlin

We fork the open-source God's Eye View globe and turn it into a public, explorable map of UFO sightings, built from three sources: Flying Saucer Review (FSR) magazine, interviews and documentaries from Jesse Michels' American Alchemy YouTube channel, and the US government UAP files.

## Vision

A reader opens the globe, filters by year, source or case type, and clicks a pin to see the sighting, the source it came from, and where possible a timestamped video clip or the original government document. Your FSR collection is the original, hard-to-get layer; the video and government data give it context.

Decisions so far: public website, FSR starts as physical magazines, and video is linked or embedded, not copied.

## The base: God's Eye View

God's Eye View is MIT-licensed, so we can fork and modify it, including for a public site. It is a Vue 3 and CesiumJS browser globe with each data layer as its own module, which makes a "UFO sightings" layer a natural addition. Source: [project README](https://raw.githubusercontent.com/bilawalsidhu/gods-eye-view/main/README.md).

| Item | Detail |
| --- | --- |
| Stack | Vue 3, Pinia, CesiumJS, Vite; Google Photorealistic 3D Tiles for the planet |
| Adding a layer | One folder under `src/layers/<family>/` with source, records, cards and index files plus tests; `src/layers/shipwrecks/` is the closest template |
| Run it | Node 24.14+, `npm ci`, `npm run dev`, or Docker; it starts with no API keys |
| Keys for the globe | A free Cesium ion token covers the 3D tiles, but its free tier is for personal and non-commercial use |
| Licence catch | The code is MIT, but each bundled or live dataset has its own terms, listed in `DATA_SOURCES.md` |

Two things to settle early for a public site. First, Google's 3D tiles and Cesium ion carry usage terms and cost that change once the site is public and busy, so we should check them before launch. Second, we should strip out the layers we don't need (live CCTV, ALPR, traffic) so the site stays focused and avoids their data terms.

## Naming and attribution

We rename the fork `uap-eye-view`, because the MIT licence allows it and a new name shows this is a separate product with its own data and purpose.

- **Keep the licence notice:** The original copyright and MIT licence text stay in the repo, as the licence requires.
- **Credit the original:** Add "Forked from God's Eye View by Bilawal Sidhu" to the README and to the site's about or footer area, and avoid wording that suggests the original author endorses the project.
- **Check availability:** Confirm the GitHub repo name and a domain are free, and search for existing projects with a similar name, since "UAP" is a common term.
- **UAP or UFO:** "UAP" matches the government files, while the magazine and video material is more "UFO" in tone. We can cover both with a tagline that mentions sightings.

## Data sources

The three sources need three different pipelines, and the FSR one is the most work.

| Source | What we get | How we collect it | Main risk |
| --- | --- | --- | --- |
| Flying Saucer Review (your magazines) | Dated case reports with place names and witness accounts | Photograph or scan each issue, OCR the text, extract cases with an LLM, then you review each one | Copyright on the magazine text; place names that are vague or old |
| American Alchemy (Jesse Michels, YouTube) | Interviews and documentary clips about cases and witnesses | Use YouTube transcripts and the official API to find places, dates and cases; store video ID plus timestamp only | Copyright and YouTube terms if we copy or rehost video |
| US government UAP files | Declassified case files, some with video, released in batches from May 2026 | Download from the official release pages, extract case metadata, link to the original file | Many entries have thin or redacted location data |

On the government files, the Department of War published a first tranche on 8 May 2026 and further batches since, via [war.gov/UFO](https://war.gov/UFO/release/03/). I can't load the site from here, but your screenshot of the war.gov/UFO site shows what we need: Release 07 (23 October 2026) sits in a searchable database that filters by agency, release and file type (.AUD, .IMG, .PDF, .VID), and each record has an incident date, incident location and type. That is close to our data model already. Release 07 has a 325 MB document download and no videos, so government video may be limited to earlier releases. Press coverage is a useful cross-check, for example [The War Zone](https://twz.com/news-features/the-newly-released-government-ufo-archives-will-leave-you-shrugging).

For the video, "scrape" should mean reading transcripts and metadata, not downloading footage. Jesse Michels' channel is called [American Alchemy](https://anomalyarchives.org/collections/file/american-alchemy), and each pin would link to a YouTube embed that starts at the right second.

## One data model for every sighting

Every source is converted into the same record, so the globe only needs one layer and one set of filters.

| Field | Example | Notes |
| --- | --- | --- |
| id | fsr-1967-v13-n4-03 | Stable and human-readable |
| source | FSR, American Alchemy, US government | Drives the pin colour and the filter |
| date and date precision | 1967-09, month | Many old cases lack an exact day |
| place name, lat, lon, location confidence | Place name, coordinates, high / medium / low | Geocoded from the place name; confidence is shown on the map |
| summary | One or two sentences in our own words | Never the magazine's wording |
| citation | Issue, volume, page | Lets people find the original |
| media | YouTube ID and start second, or government file URL | Link out, don't copy |
| review status | Extracted, checked, published | Nothing goes live until you have checked it |

The confidence field matters: a pin placed from "near a village in Wales" should look different from one with GPS-grade coordinates.

## Roadmap

We start with the easy, digital sources to prove the globe works, and run the slow magazine digitisation alongside them.

&#91;embedded content: roadmap · 4 phases, 4 gates, 1 parallel lane\]

The phases are in order but not dated, so we can set weeks once we know how many magazine issues you have and how fast you can review.

## Legal and ethical risks for a public site

The biggest risk is copying other people's content, so the design keeps to facts, our own summaries and links. I'm not a lawyer, so the legal check gate in the roadmap should include a short review by someone qualified, ideally before FSR content goes public.

- **Magazine text:** Facts such as dates and places are not owned, but the magazine's wording and photos are. We write our own short summaries, cite issue and page, and publish no scans or long quotes. It is worth finding out who holds FSR's rights today and asking permission.
- **YouTube video:** Embed with YouTube's own player and link to timestamps. Downloading or rehosting clips risks copyright and platform-terms problems. Fetching transcripts at scale should use the official route and respect the platform's terms.
- **Government files:** US federal government releases are generally public, but individual files may carry third-party material or redactions, so we link to the official source and keep the original citation.
- **Living people:** Witness names and details from interviews and the magazine should be handled carefully; we publish only what is already public and avoid addresses.
- **Accuracy:** Pins from vague place names are approximate and many cases are unexplained or disputed. We label confidence on every pin and make no claim about what the objects were.

## Open questions and next steps

The next move is a small proof of concept: fork the globe and get about 20 hand-entered pins on screen with filters.

- [ ] Fork God's Eye View and get it running locally
- [ ] Work out how to export the war.gov records (bulk download per release, or the database), and check which releases include video
- [ ] Pick 20 FSR cases and enter them by hand to test the data model
- [ ] Pick 3 American Alchemy episodes and test transcript-to-pin extraction
- [ ] How many FSR issues do you have, and over what years?
- [ ] Do you know who holds FSR's rights now, and are you open to asking them?
- [ ] Is the globe the whole site, or do you want pages for individual cases too?
- [ ] Check Google 3D tiles and Cesium ion terms and cost for a public site

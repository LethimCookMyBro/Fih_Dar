# Source Expansion Research — Scorecard (Phase 4)

> Live investigation conducted 2026-08-18 against the actual candidate endpoints.
> Every verdict is backed by a direct probe performed during this session.
> Rule applied: **transport ≠ independent evidence**. A mirrored record arriving via
> a second API is not a second corroborating observation.

---

## Verdict summary

| # | Candidate | Verdict | One-line reason |
|---|---|---|---|
| A | Thai Department of Fisheries (www4.fisheries.go.th) | **DEFER** | Real current content, but RSS sits behind Incapsula anti-bot; no bot-free structured feed |
| B | DOF Data Catalog / CKAN (catalog.fisheries.go.th) | **DEFER** | Working CKAN API, but 0/71 datasets are blackchin/tilapia — zero signal yield |
| C | GBIF occurrence API | **REJECT** | TH records are 100% iNaturalist research-grade — pure transport duplication |
| D | OBIS occurrence API | **REJECT** | TH records are 100% iNaturalist research-grade — pure transport duplication |
| E | TH-BIF / ONEP | **REJECT** | API requires manual email approval (not automatable); feeds GBIF (duplication risk) |
| F | Thai PBS | **REJECT** | No RSS; "public" APIs are SPA shells returning HTML; content already arrives via google-news-th transport |

**No candidate earns ADD NOW.** The connected-source set is already the right set for
the target species in Thailand. This is the honest outcome — the fix for a "small
source list" perception is information architecture (Phase 6), not padding the list
with zero-yield or duplicated sources.

---

## Candidate A — Thai Department of Fisheries (www4.fisheries.go.th)

**Live probes (2026-08-18):**
- `www4.fisheries.go.th/dof/tag/62` — dedicated ปลาหมอคางดำ tag page exists with
  current news (content through mid-2026). Real, authoritative, on-topic.
- `www4.fisheries.go.th/dof/feed` and `/feed` — HTTP 200, **but the body is an
  Incapsula (Imperva) interstitial challenge page**, not RSS XML. The bot wall
  returns the same to plain `curl` with a browser UA.

**Scoring:**

| Dimension | Score | Notes |
|---|---|---|
| Authority | 5/5 | The ministry itself |
| Target-species yield | 5/5 | Dedicated tag page, regularly updated |
| Location quality | 2/5 | News articles mention provinces; no coordinates |
| Freshness | 5/5 | Active through 2026 |
| API stability | 1/5 | Anti-bot wall on every request path probed |
| Terms / license | 3/5 | Government news; no explicit machine-readable license |
| Rate limit | n/a | Unreachable without bypassing the wall |
| Maintenance cost | high | Would need an anti-bot workaround the project bans |
| Duplication risk | low | Not mirrored by existing sources |
| Lineage quality | n/a | Blocked upstream |
| Operational value | **high if reachable** | The single most authoritative source for this species in Thailand |

**Verdict: DEFER.** The value is undeniable but the channel is walled. FihDar's
architecture explicitly has "no generic scraper" and no anti-bot bypass — a DOF
adapter would violate that. Defer until DOF exposes a bot-free feed/API, or an
intermediary (e.g. a government open-data portal) carries DOF content with a
structured endpoint. **DO NOT** attempt Incapsula bypass.

---

## Candidate B — DOF Data Catalog / CKAN (catalog.fisheries.go.th)

**Live probes (2026-08-18):**
- `catalog.fisheries.go.th/api/3/action/package_search?q=blackchin` — `success: True`,
  `count: 0`.
- `...?q=tilapia` — `success: True`, `count: 0`.
- Unfiltered — 71 total datasets (ornamental fish, aquatic plants, aquaculture
  economics — nothing ecological-surveillance).

**Scoring:**

| Dimension | Score | Notes |
|---|---|---|
| Authority | 5/5 | DOF-run open-data portal |
| Target-species yield | 0/5 | Zero blackchin/tilapia datasets today |
| Location quality | n/a | No relevant datasets |
| Freshness | 4/5 | Portal active; datasets current |
| API stability | 5/5 | Standard CKAN API, reliable |
| Terms / license | 4/5 | Open-data portal by design |
| Rate limit | low | CKAN default |
| Maintenance cost | low | Reuses existing `ckan` adapter |
| Duplication risk | low | Distinct portal |
| Lineage quality | n/a | No data flowing |
| Operational value | **low today** | Identical profile to data.go.th: technically healthy, zero signal |

**Verdict: DEFER.** Exactly mirrors data.go.th's current profile (healthy + zero
yield). Adding it now would add a second zero-yield government catalog — count
inflation without signal. The `ckan` adapter already exists, so the cost of adding it
later is one registry entry. Re-evaluate when DOF publishes an invasive-species or
blackchin dataset.

---

## Candidate C — GBIF occurrence API

**Live probes (2026-08-18):**
- Species lookup: `Sarotherodon melanotheron` → nubKey `4285710` (the search result's
  `177731865` is a non-nub usage key; `taxonKey=177731865` returns 0 — verified).
- Worldwide: `taxonKey=4285710` → **3089** occurrences.
- Thailand bbox (96.5,5.5,105.8,20.7): **145** occurrences.
- Dataset breakdown of all 145: **145/145 = "iNaturalist research-grade
  observations"** (datasetKey `50c9509d-...`).

**Scoring:**

| Dimension | Score | Notes |
|---|---|---|
| Authority | 4/5 | Global aggregator, strong provenance per record |
| Target-species yield | 0/5 in TH | 100% already ingested via iNaturalist directly |
| Location quality | 5/5 | Full coordinates |
| Freshness | 4/5 | Crawled recently (Aug 2026) |
| API stability | 5/5 | Rock-solid, well-documented |
| Terms / license | 5/5 | CC0/CC-BY per record |
| Rate limit | generous | 100k/day default |
| Maintenance cost | low | Reuses `json-api` adapter |
| Duplication risk | **critical** | GBIF TH = iNaturalist TH exactly |
| Lineage quality | good but moot | Records carry `datasetKey` + original iNat id |
| Operational value | **negative** | Would double-count every record FihDar already has |

**Verdict: REJECT.** GBIF's entire Thailand yield for this species *is* iNaturalist.
Adding it would inflate corroboration counts with zero independent evidence — the
exact trap the handoff forbids. If GBIF is ever wanted for *other* species or
country-wide biodiversity context (not this species), revisit — but as a separate
enrichment concept, not as an occurrence source for S. melanotheron.

---

## Candidate D — OBIS occurrence API

**Live probes (2026-08-18):**
- Worldwide `scientificname=Sarotherodon melanotheron` → **1680**.
- Thailand polygon (96.5,5.5,105.8,20.7) → **142**.
- Dataset breakdown of all 142: **142/142 = "iNaturalist research-grade
  observations"**.

**Scoring:** identical shape to GBIF — full coordinates, stable API, but 100%
iNaturalist content in Thailand.

**Verdict: REJECT.** Same reasoning as GBIF: pure transport duplication of the
existing iNaturalist source. A GBIF+OBIS pair would also duplicate *each other* —
GBIF already aggregates OBIS datasets. No independent evidence gained.

---

## Candidate E — TH-BIF / ONEP

**Research (2026-08-18):**
- `thbif.onep.go.th` — Thailand's national biodiversity data hub (ONEP).
- The site's own API page (`content-page?cpage=open_api`) states access requires
  submitting a request form and receiving approval **by e-mail** — a manual,
  non-automatable gate.
- TH-BIF is Thailand's GBIF node and aggregates the same occurrence datasets — any
  occurrence data it exposes would largely be the iNaturalist/GBIF material already
  investigated.

**Verdict: REJECT.** Manual e-mail approval breaks the autonomous pipeline; content
lineage overlaps GBIF/iNaturalist. No automatable, independent signal.

---

## Candidate F — Thai PBS

**Live probes (2026-08-18):**
- `/rss`, `/news/rss`, `/feed` — all **404**.
- `/api/public/content/v1`, `/api/news/api-v1` — return **SPA HTML shells**, not JSON
  (the API URLs are client-side routes, not server endpoints).
- Thai PBS *articles* already reach FihDar today: they appear in the
  `google-news-th` RSS results (verified: Thai PBS content ranks in the Google News
  TH query the existing source uses).

**Scoring:**

| Dimension | Score | Notes |
|---|---|---|
| Authority | 5/5 | National public broadcaster |
| Target-species yield | high | Frequent, serious coverage |
| Location quality | 2/5 | Provinces in text; no coordinates |
| Freshness | 5/5 | Daily |
| API stability | 0/5 | No server-side structured feed found |
| Terms / license | 3/5 | No machine-readable license found |
| Maintenance cost | high | Would require HTML scraping (banned) |
| Duplication risk | **high** | Same articles already ingested via google-news-th |
| Operational value | **negative as direct source** | Transport duplication of google-news-th |

**Verdict: REJECT.** No structured feed exists, and per the lineage rule a "Thai PBS
direct adapter" over the same articles Google News already transports would **not**
count as an independent corroborating source anyway. When the need is better Thai
PBS coverage, tune the google-news-th query — don't add a duplicate transport.

---

## Lineage note (applies if any mirrored source is ever added)

The handoff's lineage requirement (transport ≠ evidence) is already the deciding
factor above, so **no schema change is needed for the rejections**. If a mirrored
source (GBIF/OBIS) is ever considered for another species, the existing
`ExternalObservation.rawMetadata` JSON column can carry `via`/`originDataset`/
`originRecordId`/`canonicalUrl` — matching how the iNaturalist mapper already stores
`via: 'iNaturalist API (occurrence observations)'` and the observation id — and
dedupe/independent-count logic must collapse on origin identity, not
`(sourceName, sourceExternalId)`. Documented here; not implemented because no
mirrored source is being added.

---

## Recommendation

- **Do not add any new source now.** The six existing sources are the honest set.
- Phase 6 (Sources page information architecture) is the correct response to the
  "list looks too small" perception: group by role, show health ≠ signal, show
  authority and freshness — a well-labeled set of six is more credible than a padded
  list of ten.
- Re-check DOF CKAN (`catalog.fisheries.go.th`) and data.go.th periodically for a
  blackchin dataset; the moment one appears, the `ckan` adapter makes it a one-entry
  addition.
- If DOF ever exposes a bot-free feed, candidate A jumps to ADD NOW.

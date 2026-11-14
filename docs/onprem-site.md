# On-prem site: where the platform lives and what the space costs

Status: draft. Every decision below is a recommendation Claude picked when the grill was skipped. Vlad confirms or overrides each one, and the spec is final only after that.

## 1. Why

`move_to_onprem` prices the hardware, power, staff and the rest, but the space comes from one illustrative `colocation_eur_month` in the catalog. The space is the line that depends most on where the company is. This feature asks the owner whether on-prem is wanted at all, and where, then prices real spaces near that place and checks they are big enough for what the engine proposes.

## 2. Use cases

1. **The owner does not want on-prem.** In onboarding the checkbox stays unticked. The project's `forecast.json` gets `onprem` in `forbidden_providers`, the site step is skipped, and `move_to_onprem` rejects every move with the reason it already gives for a provider that is not allowed.
2. **The owner wants on-prem and has a headquarters with free space.** The owner ticks the checkbox, picks "at our headquarters", finds the address on the map, and types the free floor area in m². No rent is searched. The engine checks the area against the proposal and prices the fit-out.
3. **The owner wants on-prem and has no space.** The owner ticks the checkbox, picks "find a space near", and sets from one to three search areas, each a point and a radius, on the map or in the fields. The areas are alternatives for one site, not three sites. The site step searches two kinds of options near the pin: colocation offers (racks rented in a data centre) and commercial or industrial spaces to rent and fit out. The engine picks the cheapest option that fits each on-prem candidate.
4. **The owner reads the result.** The `move_to_onprem` candidate shows the chosen site: kind, address, area, monthly rent, one-off fit-out, the source URL of every number, and the next cheapest options that also fit.

## 3. Where it sits

**Onboarding.** Step 4 of `docs/onboarding.md`, at `/app`. When the owner ticks "Also price a setup of our own":
- a choice: "At our headquarters" or "Find a space near";
- an address field with autocomplete, and the map beside it. The address field is the primary control: it works with the keyboard and a screen reader. The map shows the pin and lets the pin be dragged, but nothing requires the map;
- for headquarters: the free floor area in m², required;
- for a search: from one to three areas. Each area has an optional name, a point and a radius in km, 25 by default, from 5 to 100. On the map, a click adds an area, a circle drags to move it, and its edge drags to resize it, in whole km. "Add an area" puts the next one beside the last, two radii east, so the keyboard alone reaches three. The last area cannot be removed. The map is Leaflet on OpenStreetMap tiles, with no key; a centre handle moves an area and an edge handle resizes it. When the map fails to load, the fields alone complete the step;
- a consent line: the location is sent to Google Maps and to the listing search.

Without the dashboard, the same answers are written by hand into `forecast.json`, and the flow works the same.

**The workflow.** A new step, `site`, between Extract and Investigate:

| Step | Who | Input | Output | Decides next step on |
| --- | --- | --- | --- | --- |
| 1b. Site | site searcher (new, in `apps/agent/`) | `forecast.json` `onprem` block | `sites.json` | skipped when on-prem is not wanted; fails only on a bad input or a missing key |

The site step needs only the `onprem` block of `forecast.json`, not `infra.json`, so it runs in parallel with Extract, Investigate and Propose; Evaluate waits for both. The orchestrator needs one event writer for steps that run at once, and `run.schema.json` must allow two steps `started` at the same time.

After Evaluate, a `verify_site` step re-reads the chosen option and its two runners-up, the three fetches in parallel. A page gone or marked let sets `gone_at` on the row, which the query then skips, and the engine runs again without it. A changed price or area updates the row and the engine runs again. The engine run is deterministic and needs no LLM, so it is cheap. The result says "checked on <date>", never "available".

**Search is a demo adapter.** Listings come from scraping public listing pages, behind a `ListingSource` interface, so a licensed feed can replace it without touching the step. Demo only: one request at a time per host, a pause between requests, no personal data (agent names, phone numbers, emails) read into the store.

**The two sources, for the MVP.** `ListingsByKind` sends each kind to its own source.
- **Leases come from Storia** (`StoriaLeases`), its `spatiu-comercial` rentals, the only Storia category for commercial and industrial space. Storia searches around a city, not a point, so the pin picks the nearest city of a short verified list (Bucuresti, Cluj-Napoca, Timisoara, Iasi, Brasov, Constanta), and the search asks for the smallest radius Storia offers (0, 5, 10, 15, 25, 50, 75 km) that covers the pin's radius plus the pin's distance from that city. A pin more than 50 km from every listed city finds no lease.
- One search page (36 offers) is read. An offer is kept only when it states its rent, its currency and its area. Each kept offer's page is then read for its exact coordinates, in order, until 20 lie within the radius of the pin; an offer outside it, or whose page is gone, is skipped.
- **Colocation comes from a curated file**, `apps/agent/config/colocation.json` (`ColocationOffers`): providers that publish a monthly rack price on their own page, each with its URL, the date read and the exact quote. A search keeps an offer only while its quote is still on that page, compared with whitespace and case ignored, outside scripts and styles. Aggregator listings are not used. Today it holds one offer, Royal Server's 42U rack in Tulcea at EUR 400 a month, placed at the city centre because the provider names no address.
- **Fetching** (`PoliteFetcher`): robots.txt is read once per host and obeyed; one request at a time with 2 s between requests to a host; two retries with backoff on a timeout, 429 or 5xx; a 404 or 410 skips that page. Any other failure makes the source unavailable and the step stops with the reason.
- **Currency:** EUR is kept as is; USD is converted at the ECB rate in `apps/pricing/snapshots/ecb-fx.json`, whose date is in that file. A rent in any other currency is dropped, never guessed.
- A layout change on Storia (no `__NEXT_DATA__`, no search results where they were) stops the step with the reason instead of returning nothing.
- `python -m agent sites-search --lat --lng [--radius-km]` runs the search against the store and prints what it holds near the pin, so the store fills with real listings before the site step exists.

The search runs once per run, not once per candidate: rent options do not depend on the candidate, only the fit does, and the engine decides the fit. The LLM finds facts; the engine decides, as section 1 of `docs/spec.md` asks.

**The site store.** Listings are kept in Postgres with PostGIS, shared across companies, so two projects in the same area reuse the same listings instead of searching again.

- Only the site step reads and writes it, through its own role. The engine never connects: the site step writes `sites.json` into the run's directory, and the engine reads that file, so a run stays deterministic and replayable.
- The store holds listings only. The owner's pin, headquarters address and free area never enter it; they stay in the run's `forecast.json`.
- A query first: when the store has enough fresh options in the radius, no search runs. Only when it does not, the agent searches, writes what it found into the store, and queries again.

```sql
create table site_options (
  id              bigint generated always as identity primary key,
  kind            text not null check (kind in ('colocation', 'lease')),
  label           text not null,
  location        geography(point, 4326) not null,
  area_m2         numeric check (area_m2 > 0),
  racks           integer check (racks > 0),
  rent_eur_month  numeric not null check (rent_eur_month >= 0),
  currency        text not null,
  rent_original   numeric not null,
  source_url      text not null unique,
  read_at         timestamptz not null,
  gone_at         timestamptz,
  check ((kind = 'lease' and area_m2 is not null) or (kind = 'colocation' and racks is not null))
);
create index site_options_location on site_options using gist (location);
create index site_options_kind_read_at on site_options (kind, read_at);
```

The one query the step runs, per kind:

```sql
select id, kind, label, st_y(location::geometry) as lat, st_x(location::geometry) as lng,
       st_distance(location, $pin) / 1000 as distance_km, area_m2, racks, rent_eur_month, source_url, read_at
from site_options
where kind = $kind
  and read_at > now() - interval '7 days'
  and st_dwithin(location, $pin, $radius_m)
order by location <-> $pin
limit 20;
```

- **Enough fresh options** means at least 5 per kind in the radius. Below that, the agent searches that kind.
- **Writes** are one batched `insert ... on conflict (source_url) do update` per search, never one round trip per listing. A listing seen again gets its new price and `read_at`.
- **Older than 7 days** a listing is ignored by the query. A nightly `delete ... where read_at < now() - interval '30 days'` keeps the table small; the 23 days between let a re-read update a row instead of inserting a new one.
- The area filter (`area_m2 >= area needed`) is not in the query: the area needed depends on the candidate, and the engine decides it from `sites.json`.

## 4. Contracts

All minor versions, all new fields optional, so existing files stay valid.

**`forecast.json`**, new `onprem` block at the top level:

```json
"onprem": {
  "wanted": true,
  "site": {
    "kind": "headquarters | search",
    "place_id": "Google place id",
    "label": "the formatted address the owner picked",
    "lat": 44.43, "lng": 26.10,
    "free_area_m2": 120,
    "areas": [{ "label": "optional", "lat": 44.43, "lng": 26.10, "radius_km": 25 }]
  }
}
```

`headquarters` needs `label`, `lat`, `lng` and `free_area_m2`, and no `areas`. `search` needs one to three `areas`, each a point on Earth with `radius_km` from 5 to 100, and none of `label`, `lat`, `lng`, `free_area_m2`. A profile saved as one search pin with `radius_km` is read as one area. `wanted: false` and a missing block mean the same: no on-prem, and onboarding writes `onprem` into `forbidden_providers`.
**`sites.schema.json`**, new, owned by the agent:

```json
{
  "version": "1.0",
  "searched_at": "ISO time",
  "center": { "lat": 44.43, "lng": 26.10 },
  "radius_km": 25,
  "options": [
    {
      "id": "site-1",
      "kind": "headquarters | colocation | lease",
      "label": "address or provider name",
      "lat": 44.44, "lng": 26.11,
      "distance_km": 3.2,
      "area_m2": 180,
      "racks": null,
      "rent_eur_month": 2700,
      "provenance": "observed | declared | estimated",
      "source_url": "https://...",
      "read_at": "ISO time"
    }
  ]
}
```

- `colocation` options give `racks` and a monthly price for them; `lease` options give `area_m2` and a rent; `headquarters` has `rent_eur_month: 0` and `provenance: declared`.
- An option enters the file only when its source states both the price and the size. A listing without either is dropped, never guessed.
- Prices are converted to EUR at the rate of the day the step runs, and the rate goes into the file.
- At most 20 options per kind, the nearest first.

**`catalog.json`**, new fields on `onprem_platforms[]`, illustrative like the rest:

| Field | Meaning |
| --- | --- |
| `racks` | racks one platform fills |
| `m2_per_rack` | floor area per rack, aisles included |
| `support_area_pct` | extra area for power, cooling and staging, as a % of the rack area |
| `fitout_eur_per_m2` | one-off fit-out of a leased or headquarters space: raised floor, cooling, UPS, fire suppression, access control |

**The map in the result.** Markers, not a heatmap: one marker per option, coloured on one sequential scale by what that option costs for this plan, `rent + fit-out / (amortization_years * 12)`, in EUR a month. That puts colocation (priced per rack) and leases (priced per m²) on the same scale. The chosen option is marked, the runners-up outlined, the options that do not fit drawn grey. A table beside the map lists the same options, so nothing is readable only on the map. A heatmap waits until the store has enough listings across a city to make it honest; with 60 points it would paint prices where nobody listed anything.

**`result.json`**, `cost.onprem_platform` gains `site`: the chosen option's id, kind, label, area needed, rent, fit-out, source URL, and the ids of up to two runner-up options that also fit.

## 5. How the engine uses it

- **Area needed** = `platforms_needed * racks * m2_per_rack * (1 + support_area_pct / 100)`. `platforms_needed` is the horizon size from #27, so the space fits month 36, not today.
- **Fits:** a `lease` or `headquarters` option fits when `area_m2 >= area needed`; a `colocation` option fits when `racks >= platforms_needed * racks`.
- **Pick:** among the options that fit, the lowest `rent + fit-out / (amortization_years * 12)`. Ties go to the nearest.
- **Prices:** the chosen rent replaces `colocation_eur_month`. For `lease` and `headquarters`, `fitout_eur_per_m2 * area needed` is a one-off: it is added to `migration_eur` and counts against `max_one_off_migration_cost_eur`, like the setup in #27. `colocation` has no fit-out. Rent is allocated by the capacity share, like every other platform line.
- **Confidence:** the site's provenance joins the candidate's weakest provenance. A `declared` headquarters area counts as `estimated`.
- **No `sites.json`** (the step was skipped, or the project predates it): the engine prices `colocation_eur_month` from the catalog, as today.

## 6. Edge cases and failure modes

| Case | What happens |
| --- | --- |
| On-prem not wanted | site step skipped, logged as `completed` with reason "on-prem not wanted"; no `move_to_onprem` actions |
| Every target unticked in step 3 | the dashboard keeps at least one ticked; `POST /runs` answers `400` when none is |
| `POST /runs` with a bad `onprem` block | `400` with the field that is wrong; no run starts |
| Headquarters too small | `move_to_onprem` is infeasible with a new violation `onprem_site`: "needs 140 m², headquarters has 120 m²". No search is made instead: the owner chose headquarters |
| Areas that overlap | allowed; an option inside two areas is one option, kept once by `source_url` |
| A fourth area | the map ignores the click and "Add an area" is disabled; `PUT /profile` answers `400` |
| A circle dragged past 100 km or under 5 km | it snaps back to the limit; nothing outside 5 to 100 is saved |
| Search finds nothing in the radius | the step widens once to double the radius, capped at 100 km. Still nothing: `sites.json` with no options, and every on-prem candidate gets `onprem_site`: "no space found within N km" |
| Options found, none fits | `onprem_site`: "the largest option is X m², the plan needs Y m²" |
| Pin outside every `data_residency` region | onboarding warns before saving; the engine already rejects the move for residency |
| Google key missing | the site step fails at startup and names the variable, as section 4 of `docs/spec.md` asks. The run stops: on-prem was asked for and cannot be priced |
| Google or the listing search times out or rate-limits | two retries with backoff, then the step fails with the reason; the run stops |
| A listing changed or disappeared since it was read | nothing in the run; `read_at` and `source_url` are shown so the owner can check |
| Currency other than EUR | converted at the rate of the day, the rate is in `sites.json` |
| A revision loop (back to step 3) | `sites.json` is reused: the search does not run again in the same run |
| Postgres is unreachable | the site step fails with the reason and the run stops. It does not search without the store: a search it cannot keep is paid for again on the next run |
| `SITES_DATABASE_URL` missing | the site step fails at startup and names the variable |
| Two runs search the same area at once | both may search; the upsert on `source_url` keeps one row per listing. No lock in the MVP |
| The same space listed on two sites | two rows, two URLs. Not merged in the MVP |

## 7. Load

- Per run: one Places call to resolve the pin, one store query per kind, and at most two listing searches per kind (the second only when widening). Never one call per candidate or per option.
- The store is keyed by area, not by company: a thousand companies in the same city share the same listings and cost one search per kind a week between them.
- At a thousand times today: a city has thousands of listings, a country hundreds of thousands. The GiST index keeps the radius query on the rows near the pin, not the table. Measured on 1,000,000 rows spread over Romania (about 4 a km², far denser than real listings): the nearby query takes 100 ms at 25 km and 306 ms at 100 km, both kinds in one round trip, through a bitmap of `site_options_location` and `site_options_kind_read_at`. A GiST on `(kind, location)` was not picked by the planner; dropping the B-tree made 100 km 615 ms.
- The dashboard's map uses OpenStreetMap's public tiles, with no key: one tile request per tile in view, light use only. The server key (`GOOGLE_MAPS_API_KEY`) is for the site step and never ships.
- `sites.json` is at most 60 options, so the engine's fit check is a scan of 60 rows per candidate.

## 8. Privacy

- What leaves Infrared: the pin's coordinates and the radius, to Google and to the listing search. Not the company name, not the infrastructure.
- `forecast.json` and `sites.json` stay in the run's directory, like every other input.
- The store keeps public listings only, never anything about the company that asked.

## 8b. Configuration and infrastructure

The repo has no database today. This feature adds the first stateful service.

- `docker-compose.yml` at the repo root with one service, `postgis/postgis` at a pinned version, for local runs.
- Migrations in `apps/agent/migrations/`, plain SQL. For the MVP there is no `migrate` command: the compose container applies them on an empty volume, and CI applies them in the `site-store` job. The step never applies them itself.
- CI starts the same image as a service container for the store tests.
- New variables in `.env.example` and in the table of section 4 of `docs/spec.md`:

| Variable | Read by | Value |
| --- | --- | --- |
| `SITES_DATABASE_URL` | agent (site step) | the site role's connection string; local: the compose service |
| `GOOGLE_MAPS_API_KEY` | agent (site step) | server key, Places API only |

## 9. Tests

- Contracts: `sites.example.json` and the new `forecast.json` block pass `check_mock.py`; `headquarters` without `free_area_m2` and `search` without `radius_km` are rejected.
- Engine: area needed from the formula; the cheapest fitting option is picked; ties go to the nearest; headquarters too small gives `onprem_site`; no options gives `onprem_site`; no `sites.json` prices as today; fit-out counts against the one-off budget.
- Site step: a recorded search response gives the expected `sites.json`; a listing without a price or a size is dropped; the widen-once rule; a missing key stops at startup. No live calls in CI.
- Store, against the Postgres service in CI: a listing outside the radius is not returned; a listing older than 7 days is not returned; enough fresh options skip the search; a listing seen twice stays one row with the newer price; the site role cannot read or write any other table; Postgres down stops the step.
- Flow test: a stub `site` stage copies `sites.example.json`, and the demo path stays green.
- Onboarding's on-prem step: the fields alone complete it with the keyboard, up to three areas; the map, against a fake Google library, adds an area on click and none past three, moves and resizes a circle, snaps a radius past 100 km back, follows the fields, and says when it cannot load; unticked, it writes `onprem` into `forbidden_providers`. The other onboarding tests are in `docs/onboarding.md`.

## 10. Out of scope

- Connecting a real cloud account: the MVP connects only to the Floci demo estate, with the orchestrator's own credentials.
- Owners who already run their own servers: Infrared cannot know what their hardware holds.
- More than one site per project, and on-prem spread over two sites for zones.
- Checking the building's power, cooling or floor load. The area is the only fit check; the site shows "power and cooling capacity not checked".
- Permits, lease terms, deposits, negotiation, signing anything.
- Buying a building.
- Prices that the source does not state: no estimated rent per m² for an area with no listings.
- Live refresh of listings after the run.

## 11. Decisions Claude picked, for Vlad to confirm

1. The listing search scrapes public listing pages, for the demo only, behind a `ListingSource` interface, keeping only listings that state price and size. Vlad accepted that the portals' terms were not checked. Colocation providers rarely publish prices, so colocation options may stay few or none. **Confirmed by Vlad:** leases from Storia only, coordinates from each listing's own page, colocation from a curated file of providers' own published prices with their quote. The details in section 3 (the city list, the radius steps, 36 offers read, 2 s between requests, EUR and USD only) are Claude's, accepted by Vlad as MVP defaults.
2. Colocation and lease are both searched, and the engine picks between them.
3. The step runs once per run, before Investigate, not per candidate.
4. The fit check is area only. Power and cooling are flagged, not checked.
5. A headquarters that is too small makes on-prem infeasible; it does not fall back to a search.
6. Nothing found means infeasible, not a fall-back to the catalog's colocation price.
7. The rack and fit-out figures live in the catalog, illustrative, like the rest.
8. The address field is primary and the map is secondary, for keyboard and screen reader access.
9. Listings live in Postgres with PostGIS, shared across companies, read and written only by the site step. Vlad picked Postgres; the rest of the store's shape is Claude's.
10. Fresh means read in the last 7 days; at least 5 fresh options per kind skip the search; rows older than 30 days are deleted nightly.
11. Postgres down stops the run instead of searching without the store.
12. No lock between two runs searching the same area at once, and no merging of the same space listed twice.
13. The site step runs in parallel with Extract to Propose; `verify_site` re-reads the chosen option and two runners-up after Evaluate.
14. The result map uses one marker per option, coloured by cost for the plan, not a heatmap. Vlad confirmed the markers; the colouring by cost for the plan is Claude's.
15. Onboarding has its own spec, `docs/onboarding.md`; this one covers only its on-prem step.
16. Up to three search areas, asked by Vlad, picked on a Leaflet map over OpenStreetMap tiles instead of Google Maps, so the demo needs no key or billing. OpenStreetMap's public tiles are for light use: production needs a tile provider or Google back; the answers below are Claude's, accepted by Vlad as MVP defaults without a grill:
    - the areas are alternatives for one site: the engine still picks one option, the cheapest that fits across all areas, ties to the nearest area's point;
    - a headquarters is one point and is not mixed with search areas;
    - areas may overlap; options are kept once by `source_url`;
    - widening, the 5 fresh options rule and the Storia city pick apply per area; the store query runs once for all areas, `st_dwithin` on each joined with `or`, not once per area;
    - areas have no priority; cost decides;
    - the result map draws every area's circle under the markers.
17. Not built yet: the site step and the result map still take one point. The dashboard and `PUT /profile` take three areas today; the run receives only `onprem.wanted`.

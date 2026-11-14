# Projects inside one estate

Confirmed with Vlad on 2026-11-14. Replaces the idea of separate mock companies, one per "project".

## The model

- **The estate** is the company's one infrastructure (`infra.json`): every stack and component it runs.
- **A project** is one application the company runs inside that estate: a product it sells or an internal tool. It owns some of the estate's stacks (its prod, staging and dev).
- **A project scales on its own plan**, from few inputs:
  - users now;
  - users expected, by month, as low, base and high;
  - its focus: High availability, Zones (with a market), Performance or Cost reduction.
- **An analysis is one run over the whole estate.** Every project in it scales on its own users. The focus is either one for the whole plan or each project's own, chosen in New analysis; each project's focus starts from a default set in Configuration for all projects, changeable per project there.

## Contract

`forecast.json` gains an optional `projects` array. A forecast without it behaves as today.

```json
"projects": [
  {
    "id": "booking",
    "name": "Clinic booking",
    "stacks": ["booking-prod", "booking-staging"],
    "users": {
      "metric": "monthly_active_users",
      "current": 41000,
      "expected": [{ "month": 24, "low": 70300, "base": 112500, "high": 178500 }]
    }
  }
]
```

- Every stack id exists in the run's `infra.json`, and a stack belongs to at most one project.
- `current` is above 0; every expected value is above 0.

## Engine

- A project's monthly growth for a scenario is `(expected at month M / current) ^ (1 / M)`, taken from its last expected row, and compounds past `M` at the same rate. Scenario `low`, `base` and `high` read the matching column; any other scenario id reads `base`.
- That growth applies to the traffic and the data of every component in the project's stacks, in place of the estate's scenario multipliers and events. Fixed costs stay fixed.
- Components outside every project keep the estate's scenarios and events.
- Cost at the horizon, total cost over the horizon, the budget constraint and payback use the per-project growth with no other change.

## Mock data

One mock estate with 8 to 10 projects of different kinds and sizes, each with its stacks, users now and expected, and a default focus. It replaces the separate mock companies as what New analysis offers.

## Delivery

1. The contract and the engine's per-project growth. Done.
2. The mock estate with its projects: `contracts/mock/build_estate.py` builds `northwind` (10 projects, 87 components) from the four mock companies, ownership planted as tags, a CloudFormation stack, a namespace and names, and resolved by the extractor. Done.
3. New analysis: the list of projects with users and focus, and the switch between one focus for the plan and each project's own; the run's forecast carries both. Configuration: the default focus for all projects and each project's own. Done.
4. Focus per project in the engine. Done:
   - the orchestrator writes each project's rules into the run's forecast: High availability gives `min_availability_pct: 99.9` for the project's critical paths (a path multiplies its components' SLAs, so 99.95 is out of reach for three components); Zones gives `allowed_regions` for the market; Cost and Performance add no rule;
   - the engine checks a project's paths against the stricter of the estate's target and the project's, and its data against the project's regions;
   - `managed_services` keeps every component of a High availability project at or above a floor halfway from its target to 100% (99.95% for 99.9%), trying two zones before rejecting a target;
   - ranking stays one for the whole plan: it is one plan.
   The estate's own targets stay at 99.5% availability and EUR 320,000 a month at the horizon.

## One company per run (2026-11-14)

- A run analyses **one company's cloud** and the projects listed in that company's financial roadmap (`forecast.json` `projects`), not one of several mock estates. The Floci company is `contracts/mock/company.forecast.json` (7 projects).
- Each project is found in the cloud by its **tags first** (`Project`, `App`, `Application`, any case, equal to one of `match.tags`), **then by resource names** (`match.names` prefixes). Without `match`: tags `[id]`, names `[id-]`.
- The extractor does it: `extract_floci.py --project company --forecast <run>/forecast.json --out <run>/infra.json` writes `x_projects` (components per project, how many by tag and by name) and `x_unassigned`.
- Each project may carry `intent`: what the owner wants done with it next, in their own words, written by the orchestrator from onboarding and read by the agent; the engine ignores it.

## Out of scope

- Moves that split a project across providers on purpose; a project's stacks are planned with the rest of the estate.
- Building the new estate in Floci in step 2; the mock infra is written as files first.
- Projects across several estates.
- Per-project events beyond what its expected users already include.

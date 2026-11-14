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

1. The contract and the engine's per-project growth.
2. The mock estate with its projects.
3. New analysis: the list of projects with users and focus, and the switch between one focus for the plan and each project's own. Configuration: the default focus for all projects and each project's own.
4. Focus per project in the engine (constraints and ranking per project's stacks).

## Out of scope

- Moves that split a project across providers on purpose; a project's stacks are planned with the rest of the estate.
- Building the new estate in Floci in step 2; the mock infra is written as files first.
- Projects across several estates.
- Per-project events beyond what its expected users already include.

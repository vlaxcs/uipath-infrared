# Remus: the decision engine

Your lane: the engine that turns candidates into numbers and picks the winner. It reads `infra.json`, `forecast.json` and `catalog.json`, and writes `result.json`. Every cost, availability, risk and effort figure the CTO sees comes from here. It continues your design in #2.

Time: `H+0` is the commit that added this file. Feature freeze at `H+8`.

Read first: `docs/spec.md` sections 1, 4, 5 and 6; your `docs/decision-engine.md`.

## You own

`apps/engine/`, `contracts/result.schema.json`, `contracts/catalog.schema.json` and the catalog examples.

## Order

| # | Task | Spec | Size | Done when |
|---|---|---|---|---|
| 1 | `result.schema.json` from your sketch, with a sample `result.json` | 6 | S | `check_mock.py` validates the sample; Robi renders it |
| 2 | Step a: loaders, normalisation, baseline pricing | #2 s7 | S | baseline about EUR 133k on `demo-shop`; cross-check differences listed |
| 3 | Step b: `do_nothing` and the constraint checks | #2 s7 | S | infeasible on residency and single-AZ RDS |
| 4 | Steps c and d: `cleanup_orphans`, `rightsize_in_place` | #2 s7 | M | about EUR 9.2k from orphans; `rds-analytics` grows; `ddb-orders` flagged, no capacity added |
| 5 | Step g: score, Pareto, payback, robustness, the nothing-feasible fallback | #2 s7 | M | a deterministic winner; every loser has a reason |
| 6 | The CLI: `engine evaluate <infra> <forecast> <catalog> [--candidates file]` | 5 | S | the orchestrator and the agent call it |
| 7 | Determinism test | 10 | S | the same inputs give the same `result.json`, byte for byte |
| 8 | Step e: `managed_services` with the feature check; Supabase or Neon in the catalog | #2 s7 | M | a cross-provider move is priced; feature mismatches rejected with the reason |
| 9 | Step f: `move_to_onprem` with the full platform cost | #2 s7 | M | capex, cooling, disks and staff in the result |
| 10 | Step h: the real Floci extraction | #2 s7 | S | no crash; the real-data flags appear |

## What you hand over

| To | What | By |
|---|---|---|
| Vlad, Robi | `result.schema.json` and a sample `result.json` | `H+2` |
| Vlad | the CLI with steps a to d and g | `H+5` |
| Vlad | steps e and f | `H+7` |

## What you expect

| From | What | By | If late |
|---|---|---|---|
| Vlad | `main` in the `apps/` structure | `H+1` | build in `apps/engine/` on your branch, rebase later |
| Andrei | the start-up mock and its `forecast.json` | `H+3` | test on `demo-shop` only |

## Rules you own

- No model touches a number. The engine is plain, deterministic code.
- Never test against `apps/estate/ground_truth/`; test against `expected-signals.md`.
- Every recommendation carries the weakest provenance behind it as its confidence.

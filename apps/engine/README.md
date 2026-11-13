# Engine

The deterministic part of Infrared: it reads `infra.json`, `forecast.json` and `catalog.json`, prices and checks candidate plans, and writes `result.json`. No model touches a number. Design: `docs/decision-engine.md`.

## Run

```bash
python3 -m venv .venv && .venv/bin/pip install -r apps/engine/requirements.txt
cd apps/engine
../../.venv/bin/python -m pytest -q
../../.venv/bin/python -m engine baseline ../../contracts/mock/demo-shop.infra.json ../../contracts/catalog.example.json
../../.venv/bin/python -m engine evaluate ../../contracts/mock/demo-shop.infra.json ../../contracts/forecast.example.json ../../contracts/catalog.example.json --out result.json
../../.venv/bin/python ../../contracts/check_mock.py result.json
```

`evaluate` validates its own output against `contracts/result.schema.json` before writing it.

Exit code 2 means an input broke its schema; the reason is on stderr.

## Layout

| Path | Layer | Holds |
| --- | --- | --- |
| `engine/cli.py`, `engine/__main__.py` | entry point | argument parsing, exit codes |
| `engine/application/` | application | one use case per file: load, run the domain, hand back a document |
| `engine/domain/` | domain | pure, deterministic logic; never imports `adapters`, `application` or `cli` (enforced by `tests/test_layers.py`) |
| `engine/adapters/` | adapters | JSON files, schema validation against `contracts/`, domain-to-document mapping |

Domain modules:

| Module | Does |
| --- | --- |
| `model.py`, `normalise.py` | `infra.json` as frozen dataclasses: 1.x accepted, unknown kinds become `other`, capacity and usage per unit, unknown stays `None` |
| `forecast.py`, `catalog.py` | the other two inputs |
| `provenance.py` | `Evidence`, weakest provenance, `confidence_of` with the reason naming the weakest input |
| `candidate.py` | `Action`, `ActionKind`, `Candidate` (cumulative layers through `extend`) |
| `end_state.py` | applies a candidate's actions to the estate: one `Placement` per component |
| `tiers.py`, `demand.py`, `pricing.py` | catalog price of one placement, line by line, with gaps listed |
| `costing.py` | which price a placement gets (rule below) |
| `baseline.py` | the current estate priced and cross-checked |
| `structure.py` | critical path per serving stack, stay-together groups (hints win, otherwise derived), environment leaks |
| `availability.py` | availability of each critical path on an end state |
| `violation.py` | `Violation` with the constraint ids of `result.json` (`budget`, `migration_budget`, `security.<gate>`) and its `distance` from passing |
| `security_gates.py` | one check per security gate; a gate that was remediated passes |
| `remediation.py` | the `security_remediation` layer: one `remediate` action per open gate violation, and its effort |
| `sizing.py` | the target size of a component from its usage: fewer units for a pool, a smaller or larger tier for a single unit |
| `signals.py` | facts to signals: orphan, idle, oversized, undersized, static scaling, single-zone stateful, single-zone pool, residency, design problem |
| `relocation.py` | the allowed region a component breaking residency moves to |
| `strategies/cleanup_orphans.py`, `strategies/rightsize_in_place.py` | the first two cumulative layers, each built with `Candidate.extend` on the one before |
| `constraints.py` | every hard constraint on an end state; money and hours arrive in `CandidateFigures` |
| `growth.py`, `projection.py` | run cost per month and scenario with growth and events, discounted over the horizon |
| `migration.py`, `ops.py`, `egress.py`, `outage.py` | one-off migration cost and hours, ops cost, egress on new boundaries, expected outage loss |
| `proposals.py` | the cumulative strategy chain; adds the remediation layer to every strategy |
| `action_savings.py` | each action's saving at today's demand, and what the component is before and after |
| `evaluation.py` | every figure for one candidate |
| `ranking.py` | step g: Pareto, score, payback, robustness, why each candidate lost, the nothing-feasible fallback |

Strategies plug in through `engine/application/strategies.py`: a builder `(previous, infra, catalog, forecast) -> Candidate` that returns `previous.extend(name, new_actions)`. A strategy enabled in the forecast without a builder is reported as `strategy_not_built_<name>`, never invented.

## Pricing rule

- An unchanged component costs its reported `cost.monthly_eur`; that is what the client pays today. Without one, the catalog prices it. Without either, it costs 0 and is flagged `unpriced`.
- A changed component (resized, scaled, moved, stopped) is priced from the catalog.
- Every component the catalog can price completely is cross-checked against its reported cost. Differences above 15% are listed, because a saving on that component carries the catalog's error.
- A tier is matched by SKU first. Otherwise the smallest single tier covering vCPU, memory and GPUs is used. Only when no single tier covers it is the component priced as the cheapest multiple of one tier.

## Constraint rules

- Critical path: per stack that is not `dev` or `staging` (a component's `tags.env` overrides its stack). It starts at the `dns` and `traffic` edges and takes one hop along `data` edges into the datastores. A stack with no such edges starts from the components that send data and receive none.
- Availability of a path is the product of its components. A single-zone service in two or more zones uses the catalog's `multi_az_availability_pct`, otherwise `1-(1-a)^zones`. A service the catalog marks multi-zone keeps its SLA. A kind with no catalog option gets 99.5% per zone (`DEFAULT_SINGLE_ZONE_AVAILABILITY_PCT`), the catalog's figure for single-zone RDS and EC2. Removed and stopped components do not count.
- `min_availability_pct`: on a path below the limit, every component that is below the limit on its own is a violation. If none is, the stack is reported once with the path's figure.
- `data_residency` applies to stateful components whose classification is in `applies_to`.
- Security gates read `security` and `controls` as extracted. A datastore is a stateful component. Admin ports are 22, 3389 and `-1` (all). Backups need 7 days of retention (`MIN_BACKUP_RETENTION_DAYS`). A fact the extractor did not report is not a violation.
- `distance`: `(actual - limit) / limit`; for availability `(limit - actual) / (100 - limit)`, the excess downtime over the allowed downtime; 1 for a violation without numbers.

## Security remediation

- `remediation_actions` returns one `remediate` action per security-gate violation still present on an end state; the action's `signal` is the gate. Removed components need none. Audit logging is an account control, so its action targets `account` and lands in `EndState.remediated_controls`.
- A remediated placement still counts as unchanged, so it keeps its reported cost. Only the effort is priced for now.
- Effort per action, in hours (`EFFORT_HOURS_BY_GATE`): remove public access 4, encrypt at rest 8, close admin ports 1, enable backups 1, turn on audit logging 2. These are estimates, not catalog figures.
- The actions rest on configuration facts, so their confidence is high.

## Cleanup and rightsizing rules

- `cleanup_orphans`: an orphan is deleted. An idle component is stopped when something is worth keeping (it is stateful, or it is a VM with disks, which stay billed); otherwise it is deleted (a NAT gateway, a stateless cache).
- `rightsize_in_place` skips whatever the layers before it removed or stopped.
- Headroom is 30% (`HEADROOM`). A pool is a stateless component with more than one unit; it is sized by its busiest reported resource (CPU, memory, GPU) and changes its unit count. Anything else changes tier.
- A pool with fixed scaling is autoscaled and billed at its average load plus headroom; other pools are resized to p95 plus headroom. A pool that serves production keeps at least `cto_settings.min_zones` units.
- A single unit shrinks only to a tier that covers p95 CPU and memory plus headroom and is no larger than today in either. When memory use is not reported, memory is kept; if that blocks the shrink, the component is flagged instead. The same goes for a kind the catalog cannot price.
- A shrink or an autoscale is kept only when `cost_placement` says it saves money.
- Undersized (CPU p95 above 80% or memory p95 above 85%) grows to cover p95 plus headroom, whatever it costs.
- A stateful production component in fewer zones than `min_zones` is scaled to `min_zones`. A component whose zone count is unknown, or whose catalog option is already multi-zone, is left alone.
- Throttling while consumed capacity stays under 20% of provisioned is a design problem: flagged, no capacity added.
- A stateless component on a production critical path in fewer zones than `min_zones` is spread to `min_zones`, keeping its unit count. It costs more only if the catalog's `multi_az_multiplier` says so.
- A stateful component that breaks `data_residency` moves, on its current catalog option, to the allowed region that most of its stack already uses (then the estate, then the allowed or offered concrete regions). When its option serves no allowed region, it stays and the violation stands. The move is priced and its migration counted like any other.
- Node groups of one cluster that report identical usage are cluster-level copies; their actions are capped at low confidence.

## Evaluation rules

- Months run from 1 to `horizon_months`; month *n* multiplies traffic costs by `traffic^n` and storage costs by `data^n`, times every event up to *n*. Fixed costs (gateways) and inactive components do not grow. A reported cost grows in the proportions of its catalog price, otherwise by kind.
- Discounting is monthly, at `(1 + discount_rate_annual)^(1/12) - 1`. Ops and outage loss are discounted over the same months.
- Migration: a move costs `(fixed + per_100gb * data_gb / 100) * same_provider_factor` hours (the factor only within the same provider), one month of the old cost side by side for stateful components, and data-transfer egress when it leaves its provider or region. An in-place change (resize, scale, autoscale) costs the current option's fixed hours times its `same_provider_factor`, and carries its risk the same way. Deleting or stopping costs nothing. Remediation hours are added to the effort.
- Cutover downtime is the longest single step, since each step ships on its own.
- Egress is only added for edges that a candidate moves across a provider or region boundary, at the target's `egress_per_gb_eur`; an edge without `gb_month` flags `egress_unpriced`.
- Outage loss per stack uses its worst critical path and `downtime_cost_by_stack`.
- Payback is migration cost over the monthly saving (run + ops) against `do_nothing`. When `do_nothing` is feasible, a candidate that pays back after the horizon is ranked below it and loses on `payback`.
- A feasible loser loses on the criterion with the largest weighted gap to the winner; an exact tie names the tie-break rule.

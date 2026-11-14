# Engine

The deterministic part of Infrared: it reads `infra.json`, `forecast.json` and `catalog.json`, prices and checks candidate plans, and writes `result.json`. No model touches a number. Design: `docs/decision-engine.md`.

## Run

```bash
python3 -m venv .venv && .venv/bin/pip install -r apps/engine/requirements.txt
cd apps/engine
../../.venv/bin/python -m pytest -q
../../.venv/bin/python -m engine baseline ../../contracts/mock/demo-shop.infra.json ../../contracts/catalog.example.json
../../.venv/bin/python -m engine evaluate ../../contracts/mock/demo-shop.infra.json ../../contracts/forecast.example.json ../../contracts/catalog.example.json --out result.json
../../.venv/bin/python -m engine evaluate ../../contracts/mock/demo-shop.infra.json ../../contracts/forecast.example.json ../../contracts/catalog.example.json --candidates ../../contracts/candidates.example.json --out result.json
../../.venv/bin/python ../../contracts/check_mock.py result.json
```

`evaluate` validates its own output against `contracts/result.schema.json` before writing it.

Exit code 2 means an input broke its schema or its rules, or a candidate builds on a strategy this forecast did not build; the reason is on stderr, and no result is written.

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
| `strategies/managed_services.py` | step e: moves to another provider's catalog option, with the feature, provider, residency and stay-together checks |
| `onprem.py` | the full on-prem platform cost (capex, power and cooling, colocation, disks, staff, maintenance, network, licences, contingency), the share a set of placements uses, its size at the horizon, and each component's part |
| `placement_size.py` | the vCPU and memory of one unit of a placement, from its tier when it has one |
| `strategies/move_to_onprem.py` | step f: moves to an `onprem-*` option when its platform share and ops cost less than staying |
| `constraints.py` | every hard constraint on an end state; money and hours arrive in `CandidateFigures` |
| `growth.py`, `projection.py` | run cost per month and scenario with growth and events, discounted over the horizon |
| `migration.py`, `ops.py`, `egress.py`, `outage.py` | one-off migration cost and hours, ops cost, egress on new boundaries, expected outage loss |
| `proposals.py` | the cumulative strategy chain; adds the remediation layer to every strategy |
| `agent_candidates.py` | the agent's candidates on top of their `builds_on` (rule below) |
| `action_savings.py` | each action's saving at today's demand, and what the component is before and after |
| `evaluation.py` | every figure for one candidate |
| `ranking.py` | step g: Pareto, score, payback, robustness, why each candidate lost, the nothing-feasible fallback |

Strategies plug in through `engine/application/strategies.py`: a builder `(previous, infra, catalog, forecast) -> Candidate` that returns `previous.extend(name, new_actions)`. A strategy enabled in the forecast without a builder is reported as `strategy_not_built_<name>`, never invented.

## Agent candidates

- `--candidates` reads a `candidates.json`. It is checked against `contracts/candidates.schema.json` and the rules in `contracts/candidates_integrity.py`, and its `project` must match the infra's.
- A candidate starts from the actions of its `builds_on` without their remediation layer: an engine strategy, an earlier candidate in the file, or today's estate for `null`. Its own actions replace the parent's on every component they touch.
- The `security_remediation` layer is then recomputed on the candidate's end state, as for the engine's own strategies.
- Agent actions carry the provenance of the component's usage as evidence, so their confidence comes from the data, not from the agent.
- In `result.json` they appear with `source: agent`, their own `id` and `builds_on`, and are ranked with the engine's candidates.

## Pricing rule

- An unchanged component costs its reported `cost.monthly_eur` when that cost is `observed`: it is what the client pays today, from billing. A reported cost that is only `estimated` or `synthetic` gives way to a complete catalog price, so the estate today and the candidates are priced from the same source; when the catalog cannot price the component completely, the estimate stays. Without a reported cost, the catalog prices it. Without either, it costs 0 and is flagged `unpriced`.
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

## Managed services rules

- `managed_services` builds on `rightsize_in_place` and looks at every running component whose kind has a catalog option at another provider. On-prem targets are left to `move_to_onprem`.
- A target is rejected, with the reason recorded, when it lacks an extension in `features_used`, its provider is not allowed or is forbidden, it would hold data subject to `data_residency` outside the allowed regions, it would split a region-scoped stay-together group across regions, or the catalog cannot price it.
- The target keeps the size rightsizing chose: the smallest tier at the target that covers the current tier's vCPU and memory. Among the targets left, the cheapest by `cost_placement` wins, and only if it costs less than staying.
- A stay-together group with `provider` or `zone` scope moves as one unit: every live member moves to the same provider, choosing the provider that saves the most in total, or none of them moves.
- A component that does not move but had targets gets one `flag` action (signal `move_rejected`) listing every rejected target and why. A move lists the targets it rejected in its reason.
- When `features_used` is unknown (real extractions), the move is allowed and a `flag` action with signal `verify_extensions` asks for a check before moving.
- On `demo-shop`: `rds-erp` moves to `neon-launch` and stays in `eu-west-1` with `erp-core`; `pg-lake` moves to `neon-scale`; `rds-orders` and `rds-analytics` stay, because `rds-analytics` has no managed target with its extensions and `orders-replication` moves as one unit.

## On-prem rules

- `move_to_onprem` builds on `managed_services` and looks at every running component, not already on-prem, whose kind has an `onprem` option on a catalog platform.
- Platform cost per month, each line from `onprem_platforms[]` in the catalog:
  - hardware: `capex / (amortization_years * 12)`;
  - power and cooling, and colocation (the space that houses it);
  - disk failures: `disks.count * AFR * (replacement_eur + replacement_labor_hours * rate) / 12`;
  - staff: `(base_hours + hours_per_100_vcpu * platform_vcpu / 100) * rate`. Staff hours scale with the platform's vCPU, not the share used, since the whole platform has to be run;
  - maintenance: `capex * maintenance_pct_of_capex_year / 100 / 12`, for support contracts, spare parts and every failure other than disks;
  - network (uplinks, transit) and licences (virtualisation, OS, backup software);
  - contingency: `contingency_pct` of every line above except hardware, for costs nobody listed. Hardware is a known price.

  The new lines default to 0, so a catalog without them prices as before.
- The share used is the largest of vCPU, memory and storage used over the platform's capacity; a dimension the platform does not list does not count.
- Each on-prem component carries its part of the platform share as its own cost (in proportion to its own share), so an action's saving counts the platform, and the cost grows like the component's kind: compute with traffic, storage with data.
- Sizing: the use is grown to the horizon month on the base scenario (compute by traffic, storage by data). `platforms_needed` rounds that share up, and `capex_eur` is the hardware for all of them.
- One-offs: the share of `setup_one_off_eur` (racking, cabling, installation) is added to `migration_eur`. The share of the hardware price is paid on day one (`upfront_hardware_eur`): it counts against `max_one_off_migration_cost_eur` and in payback, but not in the expected total, which already carries it spread over `amortization_years`.
- Payback is on cash: `(migration + upfront hardware) / monthly saving`, where the saving leaves out the hardware write-off, since the hardware is already paid.
- A component moves when its own platform share plus the target's ops costs less than its current price plus ops. It is rejected, with the reason, when the target lacks an extension it uses, `onprem` is not an allowed provider, it uses GPUs and the platform has none, or it holds data under `data_residency` and the platform's region is not allowed.
- A stay-together group moves as one unit: if any member cannot move, or the group would cost more together, none moves.
- On `demo-shop`: `ng-data-spark` moves to `onprem-k8s-nodes`, using 320 of the platform's 768 vCPU (a 42% share, EUR 10,240 of EUR 24,576 a month), and saves EUR 4,460 a month on run cost. By month 36 on the base scenario it needs 119% of a platform, so two are priced (EUR 620,000). Its EUR 129,167 hardware share up front breaks the EUR 120,000 one-off budget. `ng-data-gpu` stays, since `onprem-dc1` has no GPUs; `rds-orders` and `rds-analytics` stay with their groups.

## Evaluation rules

- Months run from 1 to `horizon_months`; month *n* multiplies traffic costs by `traffic^n` and storage costs by `data^n`, times every event up to *n*. Fixed costs (gateways) and inactive components do not grow. A reported cost grows in the proportions of its catalog price, otherwise by kind.
- Discounting is monthly, at `(1 + discount_rate_annual)^(1/12) - 1`. Ops and outage loss are discounted over the same months.
- Migration: a move costs `(fixed + per_100gb * data_gb / 100) * same_provider_factor` hours (the factor only within the same provider), one month of the old cost side by side for stateful components, and data-transfer egress when it leaves its provider or region. An in-place change (resize, scale, autoscale) costs the current option's fixed hours times its `same_provider_factor`, and carries its risk the same way. Deleting or stopping costs nothing. Remediation hours are added to the effort.
- Cutover downtime is the longest single step, since each step ships on its own.
- Egress is only added for edges that a candidate moves across a provider or region boundary, at the target's `egress_per_gb_eur`; an edge without `gb_month` flags `egress_unpriced`.
- Outage loss per stack uses its worst critical path and `downtime_cost_by_stack`.
- Payback is migration cost over the monthly saving (run + ops) against `do_nothing`. When `do_nothing` is feasible, a candidate that pays back after the horizon is ranked below it and loses on `payback`.
- A feasible loser loses on the criterion with the largest weighted gap to the winner; an exact tie names the tie-break rule.

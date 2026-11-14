# Infrared decision engine

How Infrared decides which plan is best, and what the engine must do with the contract data to get there. Design only: nothing here is built yet. Inputs are the three contract files in `contracts/` (see its `README.md` for field rules).

## The rule: the LLM proposes, the calculator decides, the LLM explains

A start-up CTO has no team to check an AI's recommendation, so "the model says so" is not an answer. The engine therefore defines **best** as:

> the candidate with the lowest expected total cost over the horizon, among those that pass every hard constraint, under the CTO's forecast and explicit weights.

Every number traces back to a catalog price, an SLA figure, a forecast assumption or an infra fact with its provenance. The same inputs always give the same winner. The LLM is used only where it is good: reading roadmap text into `forecast.json`, proposing candidates, the critic pass, and writing the explanation and migration plan.

```
 extractor ──► infra.json ─┐
 roadmap ──(LLM)──► forecast.json ─┼─► ENGINE (plain Python, deterministic) ──► result.json ──► LLM layer ──► dashboard / Slack
 catalog.json ─────────────┘        normalise → baseline → candidates →        (explain, critic,
                                    constraints → score → rank                   migration plan)
```

### How it fits with `apps/agent/`

The existing optimizer agent reads Floci directly and records findings, with savings in USD that the model estimates from its own knowledge of list prices. Keep it for what it does well: qualitative findings, dependency reasoning and dry-run scripts. **The numbers in the final output come from the engine, not from the model.** Later, expose the engine as an MCP tool (`evaluate_candidate(actions) -> priced result`) so that every candidate the agent proposes is priced and checked deterministically.

## 1. Process the data (what the engine does with `infra.json`)

### Load and normalise
- Accept any `schema_version` 1.x. Ignore unknown `usage`/`capacity` keys and `x_` fields. Treat an unknown `kind` as `other` and keep that component unchanged.
- `quantity`: `usage` and `capacity` are **per unit**, `cost.monthly_eur` is the **total**. Multiply capacity by `quantity` for totals and never multiply cost.
- Usage `sum` is over the window: monthly = `sum * 30 / window_days`.
- Unknown means omitted or `null`. The engine never fills one in silently; it records the gap (see "Gaps in real data" below).

### Price the baseline
- Price the current estate from the catalog. Cross-check each component against `cost.monthly_eur` and report any difference above 15%, because it means either the catalog or the extractor is wrong.
- Kinds without a catalog option (`cache`, `queue`, `stream`, `function`, `load_balancer`, `file_system`, `block_storage`, `kubernetes_cluster` today): keep the component unchanged at its `cost.monthly_eur`. If it has no cost either, price it at 0 and flag it as `unpriced`.
- Reference totals: mock `demo-shop` about **EUR 133.3k/month**, real Floci extraction about **EUR 162.1k/month** (both `estimated`).

### Work out the structure
- **Critical path** per production stack: start from `traffic` edges (DNS → load balancer → backends), then follow `data` edges into datastores. Availability is computed on this path (see section 3). Dev stacks use their own downtime cost (`downtime_cost_by_stack`, usually 0).
- **Stay-together groups:** use `stay_together` hints when present; hints win. Otherwise derive groups from `data`/`traffic` edges that are `latency_sensitive` or above 100 GB/month. The real extraction has **no hints**, so this derivation is required, not optional.
- **Environment leaks:** an edge from a non-prod stack into a prod datastore (the mock's `eks-shop-staging → rds-orders`) is reported as a risk.

### Turn facts into signals
The extractor reports facts; the engine decides what they mean.

| Signal | Rule | Action it feeds |
|---|---|---|
| orphan / idle | `status` from the extractor | delete (orphan) or stop/shrink (idle) in `cleanup_orphans` |
| oversized | smallest tier with `vcpu*(1-headroom) >= vcpu * cpu_pct.p95/100` (same for memory) is smaller than today; headroom 0.3 | downsize in `rightsize_in_place` |
| **undersized** | `cpu_pct.p95 > 80` or `memory_pct.p95 > 85` | **grow**. A cost-only engine misses this (mock: `rds-analytics` at p95 97%) |
| static scaling | `scaling.min == max == desired`, `autoscaling_enabled` false | autoscale; price at average load + headroom, not at peak |
| single-AZ stateful | `stateful` and `zones < cto_settings.min_zones` | multi-AZ (price × `multi_az_multiplier`) |
| design problem, not capacity | throttling with consumed capacity under 20% of provisioned | flag; **do not add capacity** (mock: `ddb-orders`, hot partition key) |
| end-of-life version | engine/k8s version on a hard-coded EOL list | upgrade effort added to the migration plan |

### Confidence
Every recommendation carries the **weakest provenance** of the inputs behind it: `observed` gives high confidence, `estimated` medium, `synthetic` low. The output says which input set the level ("GPU shutdown: low, `gpu_pct` is synthetic"). Confidence never changes the score; it is shown next to it.

### Gaps in real data (`contracts/real/`)
The real extraction differs from the mock, and the engine has to handle these:
- **No `features_used`** (the RDS API can't list Postgres extensions). A move to a target with fewer features is **allowed but flagged** "verify extensions before migrating"; its risk goes up by 0.15 and the migration plan gets a check step. It is blocked only when `features_used` is present and the target doesn't support everything in it.
- **No `gb_month` on edges.** Egress stays unpriced and the candidate is flagged `egress_unpriced`, so a cross-provider move never looks cheaper only because traffic data is missing.
- **Node-group metrics are cluster-level copies.** Never add them up across node groups. Node-group rightsizing is capped at low confidence.
- **Usage-priced components with no `cost`** (Lambda, SQS, on-demand DynamoDB): price from the catalog when an option exists; otherwise flag as `unpriced`.
- **us-east-1 only**, so data-residency rules only bite on the mock.

## 2. Generate candidates

Each candidate is a full **end state**: the current estate plus a list of actions per component (`keep`, `delete`, `resize(tier)`, `scale(zones)`, `autoscale`, `move(option_id)`). Only the strategies in `cto_settings.strategies_enabled` are generated.

The strategies are **cumulative layers**, so each one shows what it adds on top of the one before:

| Candidate | = previous layer + |
|---|---|
| `do_nothing` | nothing (the baseline, always present) |
| `cleanup_orphans` | delete orphans, stop idle components |
| `rightsize_in_place` | resize to fit p95, grow undersized components, autoscale static pools, multi-AZ for stateful prod |
| `managed_services` | move each component to the cheapest feasible catalog option at a different provider (Supabase, Neon, Hetzner and so on) |
| `consolidate` | merge duplicates (NAT gateways, duplicate databases, overlapping clusters) |
| `move_to_onprem` | move to `onprem-*` options, with the platform cost allocated (section 3) |

Movement rules:
- Members of a stay-together group move together or not at all, within the group's `scope`.
- A move is dropped when the target lacks a feature the component is known to use; the reason is recorded per component.

## 3. Evaluate each candidate (all in EUR)

| Term | Formula |
|---|---|
| Run cost, month *n*, scenario *s* | Σ components: catalog price at the demand for month *n*. Request- and compute-driven drivers scale by `traffic^n`, storage drivers by `data^n`; `events` multiply in from their month onward. Add egress for every edge that crosses a provider or region boundary: `gb_month * egress_per_gb_eur`, minus `free_egress_gb`. |
| Horizon run cost | Σ over months, discounted at `discount_rate_annual`, then weighted by scenario `probability` |
| Migration cost (one-off) | per moved component: `(effort_hours_fixed + effort_hours_per_100gb * data_gb/100) * same_provider_factor * engineer_hourly_eur`, plus 1 month of running old and new side by side for stateful moves, plus data-transfer egress |
| Ops cost | Σ `ops_hours_month_per_unit * quantity * engineer_hourly_eur` per month |
| On-prem platform | `capex/(amortization_years*12) + power_cooling + colocation + disks.count*AFR*(replacement_eur + labor_hours*rate)/12 + (base_hours + hours_per_100_vcpu*vcpu/100)*rate + capex*maintenance_pct/100/12 + network + licences`, plus `contingency_pct` of every line except capex; allocated by the share of platform capacity used, and spread over the on-prem components so it grows with them. Platforms are sized for the base scenario at the horizon month; if the share is above 1, add another platform. One-off: the share of `setup_one_off_eur` goes into migration cost; the share of capex is paid up front, so it counts against the one-off budget and in payback, but not twice in the expected total. |
| Availability | critical path = product of component availabilities. A component in *z* ≥ 2 zones uses `multi_az_availability_pct` when the catalog gives one, otherwise `1-(1-a)^z` |
| Expected outage loss | `(1 - availability) * 8760 * downtime_cost_per_hour_eur` per year, using the per-stack override where given |
| Risk | mean `risk_factor` of the moved components, weighted by their monthly cost (0 when nothing moves) |
| Effort | Σ migration hours |

**Expected total cost** = horizon run cost + migration cost + ops cost + expected outage loss. Pricing availability in euros is what lets cost and HA be compared directly: "+EUR 400/month buys −EUR 2,100/month of expected outage loss."

## 4. Decide

1. **Hard constraints** on each candidate's end state, `do_nothing` included: data residency, budget (base scenario at the horizon month), `min_availability_pct`, allowed/forbidden providers, `max_migration_effort_hours`, `max_cutover_downtime_hours`, security gates. Record every violation along with the component that causes it.
2. **Pareto frontier** over (expected total cost, risk, effort) among the feasible candidates.
3. **Score**: `w_cost*norm(cost) + w_risk*norm(risk) + w_effort*norm(effort)`, min-max normalised across the feasible candidates, with the weights re-normalised to sum to 1. Ties are broken by `tie_break`.
4. **Payback** = migration cost / monthly saving against `do_nothing`. A winner that doesn't pay back within the horizon loses to `do_nothing`.
5. **Robustness**: rerun the ranking for low, base and high separately and report the winner's rank in each. A winner that drops to last place in one scenario gets a warning.
6. **Nothing feasible**: rank candidates by how far they miss the constraints (sum of normalised violations), show the closest one, and say exactly which constraint blocks it and by how much. The tool should never answer "no result".
7. Every losing candidate gets one line saying why it lost (constraint, cost, risk or payback).

## 5. Decisions to settle before coding

**Security gates make every candidate infeasible.** In the mock, almost every datastore is public, unencrypted and without backups, and no strategy changes that, so all candidates are dropped. **Proposal:** add a `security_remediation` layer to every candidate except `do_nothing`. It encrypts datastores, enables backups, closes ports 22/3389 to the world and turns on audit logging, and is priced as effort plus any catalog cost difference. Report that layer separately so the CTO can see what it costs. This also answers open question 5 in the contract README.

**The example budget can't be met.** `max_monthly_run_cost_eur: 90000` applies to the base scenario at month 36. Base traffic at month 36 is ×1.02^36 × 1.4 (marketplace launch) ≈ **×2.86**, and data is ×1.03^36 × 1.5 ≈ **×4.35**. Removing all the waste listed in `expected-signals.md` (GPU 32.9k + staging 12.4k + idle/orphan 9.2k) brings EUR 133k down to roughly EUR 79k today, and growth takes that well past 90k. Either the engine shows "nothing feasible, closest is X" (step 6 above), or the example forecast relaxes the budget. **Proposal:** keep the example as it is, since it demos step 6, and add a second forecast with a reachable budget.

**The mock is a scale-up, not a start-up.** EUR 133k/month with GPU clusters is a good stress test, but the PRD's MVP targets start-ups. Add a second mock at about EUR 3–8k/month with around 10 components (oversized RDS, NAT gateway, single-AZ everything, a managed-Postgres-friendly database). That is where Supabase/Vercel-type moves show up best.

**Proposed answers to the contract README's open questions:**
1. Keep node groups as separate components with a `parent` link.
2. Keep 14-day hourly summaries, with p95 computed by the extractor.
3. The engine prices everything itself; `cost` stays optional and is used only to cross-check. Keep synthetic `gb_month` in the mocks.
4. Regions set by hand in the mock are enough; no `--region-override`.
5. See "Security gates" above (a priced remediation layer).
6. Report `do_nothing` as an infeasible baseline and keep it in the comparison.
7. Kinds without a catalog option stay unchanged; extend the catalog only as the demo needs.
8. One `infra.json` per project.

## 6. Output: `result.json`

To be formalised as `contracts/result.schema.json`, so the dashboard and LLM work can start against it before the engine is finished. Sketch (the values are placeholders, not results):

```json
{
  "schema_version": "1.0",
  "inputs": { "infra": "demo-shop", "forecast": "demo-shop-2027-plan", "catalog_illustrative": true },
  "baseline": { "monthly_eur": 133308, "availability_pct": 99.2, "violations": [ { "constraint": "data_residency", "component": "s3-legacy-reports", "detail": "us-east-1, pii" } ] },
  "candidates": [
    {
      "id": "rightsize_in_place",
      "feasible": true,
      "violations": [],
      "actions": [ { "component": "ng-data-gpu", "action": "delete", "saving_eur_month": 32882, "confidence": "low", "confidence_reason": "gpu_pct synthetic" } ],
      "cost": { "run_eur_month_now": 0, "horizon_by_scenario": { "low": 0, "base": 0, "high": 0 }, "migration_eur": 0, "ops_eur_month": 0, "expected_outage_loss_eur_year": 0 },
      "availability_pct": 99.9,
      "risk": 0.2, "effort_hours": 140, "payback_months": 0.4,
      "score": 0.18, "pareto": true, "rank_by_scenario": { "low": 1, "base": 1, "high": 2 },
      "lost_because": null,
      "flags": ["egress_unpriced"]
    }
  ],
  "winner": "rightsize_in_place",
  "closest_if_none_feasible": null
}
```

## 7. Build order and how we know it works

Each step can be demoed on its own. Tests come from `contracts/mock/demo-shop.expected-signals.md`: the engine passes when they pass. Never test against `ground_truth/`, which is the agent's answer key.

| # | Build | Test on the mock |
|---|---|---|
| a | loaders, normalisation, baseline pricing | baseline ≈ EUR 133k; cross-check differences listed |
| b | `do_nothing` + constraint checks | infeasible: `s3-legacy-reports` residency, single-AZ RDS under 99.9% |
| c | `cleanup_orphans` | about EUR 9.2k/month from `rds-orders-clone`, `ebs-orphans`, `nat-dev`, `vm-dev-jump`, `vm-bastion`, `cache-legacy-mc`, `efs-legacy`; high confidence |
| d | `rightsize_in_place` | `ng-data-gpu` and `ng-shop-staging` cut; **`rds-analytics` grows**; `ddb-orders` flagged as a design problem with no capacity added |
| e | `managed_services` + feature check | `neon-launch` rejected for `rds-analytics` (`pg_partman`, `logical_replication`), `rds-orders`, `pg-lake`; `rds-erp` allowed but kept with `erp-core` |
| f | `move_to_onprem` | the full platform cost shown (capex, cooling, disks, staff) |
| g | scoring, Pareto, payback, robustness, nothing-feasible fallback | deterministic winner; every loser has a reason |
| h | run on `real/floci-estate.infra.json` | no crash; the flags from "Gaps in real data" appear |

Then the LLM layer, built on numbers that already work: roadmap text → `forecast.json`, the critic pass, the written explanation and migration plan, and an `evaluate_candidate` tool for `apps/agent/`.

# Infrared data contract (v1.0)

Everything the extractor side and the decision-engine side must agree on, plus a hand-written bad project to build against.

| File | Role |
|---|---|
| `infra.schema.json` | **The contract.** Extractor output: facts about one project's infrastructure. |
| `forecast.schema.json` / `forecast.example.json` | Roadmap + CTO settings turned into numbers (hand-written for now). |
| `catalog.schema.json` / `catalog.example.json` | Priced options per `kind` and provider. **Illustrative prices and SLAs.** |
| `real/catalog.json` | The same catalog with real, dated prices and SLA commitments: built by `apps/pricing` from its committed snapshots (AWS Price List, ECB rate, checked vendor quotes and SLA pages). `x_price_sources` and `x_sla_sources` trace every value; `x_unsourced` and `x_sla_unsourced` list what is still illustrative. Migration and feature figures remain estimates. Generated: do not edit by hand. |
| `rehearsal.schema.json` / `rehearsal.example.json` | Sandbox output: traffic profile, failure injected, measured availability/latency, pass/fail verdict. All provenance is `synthetic` on Floci. |
| `result.schema.json` | Engine output: every candidate priced, checked, scored and ranked, with the winner. |
| `result.example.json` / `result.example.nothing-feasible.json` | Sample engine output on `demo-shop`: one with a winner, one where no candidate passes the hard constraints. **Sample values, not engine results.** |
| `mock/demo-shop.infra.json` | The deliberately bad mock project (38 components, 30 edges, 4 stacks). |
| `mock/demo-shop.expected-signals.md` | What a competent engine should notice in the mock. Engine-side, not input. |
| `mock/build_demo_shop.py` | Authoring helper for the mock. All numbers typed by hand; reads nothing from `ground_truth/`. |
| `mock/startup.infra.json` | A second mock: a 10-component start-up, EUR 3,269/month, single-AZ, with deliberate constraints. |
| `mock/startup.forecast.json` | The start-up's forecast: EUR 12k budget, EU-only, 99.5% availability, 24 months. |
| `mock/startup.expected-signals.md` | What a competent engine should notice in the start-up mock. Engine-side, not input. |
| `mock/build_startup.py` | Authoring helper for the start-up mock. All numbers typed by hand. |
| `mock/clinic-booking.*` | A third mock: a clinic booking SaaS, 14 components, EUR 4,305/month, with dev, staging and prod (`build_clinic.py`, `.infra.json`, `.forecast.json`, `.expected-signals.md`). |
| `mock/fleet-telemetry.*` | A fourth mock: GPS telemetry for courier vans, 13 components, EUR 6,913/month, prod and dev only (`build_fleet.py`, `.infra.json`, `.forecast.json`, `.expected-signals.md`). |
| `mock/demo-shop.forecast.json` | A copy of `forecast.example.json` under the name the orchestrator looks for; `check_mock.py` fails if the two differ. |
| `project.schema.json` | **Project profile.** What the product is, which environments it runs (dev/staging/prod), users today and expected users by month. |
| `mock/<project>.project.json` / `mock/build_profiles.py` | One profile per mock project. The builder writes all four and derives the expected users from each forecast. |
| `project_integrity.py` / `test_project_contract.py` | The profile rules a JSON Schema can't express, and a test per rule. |
| `candidates.schema.json` / `candidates.example.json` | The agent's proposals: what changes, never what it costs. Input to `engine evaluate --candidates`. |
| `candidates_integrity.py` / `test_candidates_contract.py` | The candidate rules a JSON Schema can't express, and a test per rule. |
| `run.schema.json` / `run.example.json` | One run of the workflow: its state and its event log. Written by the orchestrator, read by the surfaces and the flow test. |
| `run_integrity.py` / `test_run_contract.py` | The run rules a JSON Schema can't express, and a test per rule. |
| `check_mock.py` | Schema + referential-integrity checker (run it on real extractor output too). |

## Who owns what

```
 EXTRACTOR (colleague A)                      ENGINE (colleague B)
 ───────────────────────                      ────────────────────
 Floci / AWS APIs                             forecast.json   catalog.json
   │ boto3 describe_* + CloudWatch               │               │
   ▼                                             ▼               ▼
 infra.json  ── the contract ──────────►  1. generate candidates (always incl. do_nothing)
 (facts only, with provenance)            2. drop those breaking hard constraints (record why)
                                          3. per candidate: run cost per scenario, migration cost,
                                             ops cost, availability, expected outage loss
                                          4. Pareto frontier, winner (explicit weights), payback,
                                             why each alternative lost
                                          5. later: LLM reads roadmap -> forecast.json, critic pass,
                                             written explanation (on top of numbers that already work)
```

**The extractor never emits findings, scores, recommendations or issue lists.** The schema rejects a top-level `findings`/`signals` key and any unknown component field. Reason: if the extractor decides "this RDS is oversized", the engine is just echoing it, and the two halves can't be tested or compared independently. The extractor reports `cpu_pct avg 8`, `status: orphan`, `public_exposure: internet`; the engine decides what that means. (`status` is the one semantic label allowed, and only because it is derived from API facts: attachment state, zero connections over the window.)

Do **not** build the mock from `ground_truth/planted_issues.json`; that is the answer key for the *agent*. The mock here is independent, so the engine is not graded against its own key.

## Field rules (infra.json)

- **IDs**: lowercase slugs, unique in the file; edges, `parent`, `stack`, `stay_together` refer to them.
- **`quantity`**: N identical units in one component (12 nodes, 3 NAT gateways, 8 tasks). `capacity` and `usage` are **per unit**; `cost.monthly_eur` is the **total** for all units.
- **`kind`** (closed list, must match catalog): `postgres nosql cache stream queue object_storage block_storage file_system container kubernetes_cluster node_group virtual_machine function load_balancer nat cdn dns other`. `node_group.parent` must be a `kubernetes_cluster`.
- **`status`**: `active` in use · `idle` running but ~nothing happening over the window · `orphan` not attached/referenced. Set from API facts, not judgement.
- **`zones`**: AZs it **actually** runs in, not what the service could do (an RDS with `MultiAZ=false` is 1).
- **Metrics** (three shapes, all carry `provenance`):
  - `capacity.*`, `data_gb`, `cost.monthly_eur`, `edges[].gb_month`: point value (`value`, `unit`, `provenance`, optional `basis`).
  - `usage.*`: series summary (`unit`, `window_days`, `provenance`, any of `avg min p50 p95 max sum`). `sum` is over the window; the engine scales by `30/window_days`.
  - Conventional keys are listed in the schema descriptions; add new ones freely, the engine must ignore keys it doesn't know.
- **Unknown = omit or `null`**, never a guessed number. Booleans in `security` are `null` when undeterminable.
- **`world_open_ports`**: `-1` = every port.
- **`data_classification`**: from tags only; default `unknown`. The forecast's residency rule can cover `unknown` explicitly.
- **`features_used`**: extensions/capabilities the workload relies on (`pgvector`, `pg_partman`, `logical_replication`, `postgis`). The engine rejects a target whose catalog `features_supported` isn't a superset.
- **Edges**: `from` depends on `to`. `kind` ∈ network/data/event/traffic/dns/config. `evidence` ∈ declared/observed/inferred. `gb_month` optional: **Floci produces no traffic data**, so there it is estimated or synthetic. Omit rather than invent. Kind and `stay_together` decide what moves together; `gb_month` only prices egress.
- **`stay_together`**: optional owner/extractor hints. The engine should also derive groups from `data`/`traffic` edges with `latency_sensitive` or large volume; hints win.
- **Extensions**: new fields must start with `x_`.

## Field rules (project.json)

- **One per project**, `mock/<project>.project.json`, next to `<project>.infra.json` and `<project>.forecast.json`. `project` equals the infra's `project`; `forecast_id` equals the forecast's `id`.
- **`environments`**: only the ones that exist, each `dev`, `staging` or `prod` at most once. `stacks` lists infra stack ids. Every infra stack whose `environment` is dev, staging or prod must be listed under that environment; a stack may also appear under another one (demo-shop's staging cluster lives in the `shop` stack). `data` says where the data comes from: `copy_of_production` means real customer data outside prod.
- **`users.current`**: an integer with `as_of` and `provenance`. `metric` says whether it counts monthly or daily active users, `definition` who counts. `peak_concurrent` is optional and sizes the sandbox's traffic.
- **`users.expected`**: rows by month from `as_of`, months increasing, the last at the forecast's `horizon_months`. Each scenario is `current x traffic^month x every event traffic_multiplier up to that month`, rounded to the nearest 100. Users are assumed to drive traffic one-for-one, so the profile and the engine never disagree on growth. Change the forecast, then rerun `python3 mock/build_profiles.py`.

| Project | What it is | Environments | Users now | Expected (base, at horizon) |
|---|---|---|---|---|
| `startup` | Receipt scanner for freelancers and small accounting firms | prod | 6,500 MAU | 13,600 at month 24 |
| `demo-shop` | EU e-commerce: storefront, data platform, legacy ERP | prod, staging, dev | 1,200,000 MAU | 3,427,000 at month 36 |
| `clinic-booking` | Booking platform for private clinics | prod, staging, dev | 41,000 MAU | 112,500 at month 24 |
| `fleet-telemetry` | GPS tracking for courier vans | prod, dev | 3,200 DAU | 10,700 at month 18 |

For the surfaces (not built yet): the orchestrator already finds a project by `<project>.forecast.json` in `ORCHESTRATOR_PROJECTS_DIR`; a `GET /projects` returning each `<project>.project.json` would let the dashboard and the Slack bot show what a project is before a run starts.

## Field rules (candidates.json)

- **No numbers from the model.** No field carries money, a score, availability or confidence, and `x_` extensions are not allowed. The only numbers are configuration: `quantity`, `zones`, `vcpu`, `memory_gb`.
- **`candidates[].id`**: unique in the file, never an engine strategy name (the `strategies_enabled` enum in `forecast.schema.json`). Kept as-is in `result.json`.
- **`builds_on`**: an engine strategy, a candidate earlier in the file, or `null` for today's estate. The candidate lists only its own actions; the engine adds the parent's, and the candidate's action replaces the parent's on the same component.
- **`actions[]`**: one per component per candidate, each with a `reason` (the evidence read). `delete`, `stop`, `autoscale`, `remediate` carry no `to`; `resize` needs a `tier`, `vcpu` or `memory_gb`; `scale` needs `quantity` or `zones`; `move` needs an `option`. `account` is allowed only for `remediate`.
- **`to`**, checked against the catalog and the infra when the project matches: the option exists and is for the component's kind, the region matches one of the option's regions, the tier is one the option offers. Breaking a hard constraint is not an error here: that is the engine's job, and the sample does it on purpose (`rds-orders`, pii, to `us-east-1`).
- **`revision`**: the run's revision. `revises` only above 0.
- **At most 10 candidates** per file.

## Field rules (run.json)

- **The events are the truth.** `status`, `step`, `revision`, `awaiting`, `started_at`, `updated_at` and `finished_at` summarise the log. A run whose summary disagrees with its events fails the checker.
- **`events[].seq`**: 1, 2, 3, with no gaps. Events are only ever appended. A surface holding events up to N asks for the ones after N.
- **Timestamps**: RFC 3339 in UTC, ending in `Z`, never going backwards.
- **Event `status`**: `started`, `completed`, `failed` say what happened to the step; `awaiting_approval` opens a gate; `approved` records a person's decision at an open gate.
- **Gates**: `present` opens `layout`, `rehearse` opens `plan`. One gate at a time, and nothing but a person's decision happens while it is open. `keep_analyses` is allowed at the `layout` gate and leaves it open; `pick_layout` closes it; `approve_plan` closes `plan` and completes the run.
- **`actor`**: `orchestrator` for everything automatic, `human` with `id` and `surface` (`dashboard`, `slack`) for an `approved` event.
- **`decision`**: always with a `reason`. `evaluate` and `rehearse` complete with `proceed` or `revise`; a `failed` event carries `stop`. `revise` sends the run back to propose and raises `revision` by one on the next event.
- **`max_revisions`**: the cap. The log never holds more `revise` decisions than this; a run that needs another fails with `stop`.
- **Files** (`inputs`, `events[].output`): `path` relative to the run's directory, plus the `sha256` of the bytes. Never inlined.
- **`decision.layout`**: a feasible candidate id from the run's latest `result.json`. **`decision.analyses`**: ids the CTO keeps; `result.json` has no analyses yet, so what they point to is still open. Neither is cross-checked against the result file yet.
- **Version 1.0** stops at step 6. `migrate`, `verify` and the pull-request gate come as 1.1.

In `run.example.json` the forecast, catalog and infra hashes are those of `forecast.example.json`, `catalog.example.json` and `mock/demo-shop.infra.json`. The result and rehearsal hashes are placeholders until those samples exist.

## Provenance (the part that keeps the demo honest)

| Value | Meaning | Floci reality |
|---|---|---|
| `observed` | read as-is from an API/metric | resource configuration (sizes, counts, flags, engine versions) |
| `estimated` | computed by the extractor from observed inputs with a stated formula | cost (list price x 730 h), `gb_month` derived from a byte counter |
| `synthetic` | injected fake data | **all CloudWatch usage** (`synth/metrics.py`), invented traffic, any billing |

The engine must propagate the **weakest provenance of the inputs behind a recommendation** into a confidence field, so a "shut down the GPU nodes" finding backed by synthetic usage says so. The mock mixes all three on purpose (data stack usage is synthetic, shop/legacy observed).

## What the extractor can fill from Floci / AWS APIs

Floci is us-east-1 only and generates no billing. Concretely (boto3, endpoint `http://localhost:4566`):

| Contract field | Source |
|---|---|
| components `postgres` | `rds.describe_db_instances` / `describe_db_clusters`: class, engine+version, `MultiAZ`, `PubliclyAccessible`, `StorageEncrypted`, `BackupRetentionPeriod`, `DeletionProtection`, `AllocatedStorage`; subnet group -> `zones` |
| `kubernetes_cluster`, `node_group` | `eks.describe_cluster` (version, endpoint access, logging), `list_nodegroups`/`describe_nodegroup` (instance types, `scalingConfig`, disk, capacity type) |
| `container` | `ecs.list_services`/`describe_services`/`describe_task_definition` (cpu, memory, desiredCount, env var names for secret heuristics) |
| `virtual_machine` | `ec2.describe_instances` (type, subnet, state, tags), `autoscaling.describe_auto_scaling_groups` |
| `block_storage` orphans | `ec2.describe_volumes` (`State: available` -> `orphan`), `describe_addresses` |
| `nat` | `ec2.describe_nat_gateways` |
| `nosql` | `dynamodb.describe_table` (billing mode, provisioned RCU/WCU, GSIs, key schema), `describe_time_to_live`, `describe_continuous_backups` |
| `queue`, `stream`, `function`, `cache`, `load_balancer`, `object_storage`, `file_system` | `sqs.get_queue_attributes`, `kinesis.describe_stream_summary`, `lambda.get_function_configuration`, `elasticache.describe_cache_clusters`, `elbv2.describe_*`, `s3.get_bucket_*`, `efs.describe_file_systems` |
| `usage.*` | `cloudwatch.get_metric_statistics` (period 3600, 14 d, Statistics Average/Maximum; p95 via `ExtendedStatistics` or computed from the hourly points). **Mark `synthetic` on Floci.** |
| `security.public_exposure`, `world_open_ports` | security-group rules, `PubliclyAccessible`, bucket policy/ACL, LB scheme |
| `edges` | declared: target groups, event source mappings, S3 notifications, EventBridge targets, env vars; inferred: security-group references |
| `controls` | `cloudtrail`, `guardduty`, `config`, `backup`, flow-log describe calls (Floci may return nothing: use `null`, not `false`, if the API is unsupported) |
| `cost.monthly_eur` | **not extractable**; compute from list prices, `provenance: estimated`, optional field |

Known Floci gaps: no `CreateSnapshot`, ASG/ECS/EKS resources are real Docker containers, all DB endpoints share one address (differ by port), EKS pods are not simulated (cluster/nodegroup facts only).

### Mapping from the existing Floci estate to `kind`

| Floci resource (synth/) | `kind` | Notes |
|---|---|---|
| RDS instance, Aurora cluster (+instances as `quantity`) | `postgres` | |
| EKS cluster / managed nodegroup | `kubernetes_cluster` / `node_group` | nodegroup `quantity` = node count |
| ECS service on Fargate | `container` | `quantity` = desiredCount |
| EC2 instance, ASG | `virtual_machine` | ASG = one component, `quantity` = size |
| EBS volume (available), Elastic IP | `block_storage` / `other` | unattached -> `status: orphan` |
| NAT gateway | `nat` | |
| DynamoDB table | `nosql` | include GSIs in `config` |
| ElastiCache redis/memcached | `cache` | |
| SQS queue, SNS topic | `queue` | SNS as `queue` with `service: sns` |
| Kinesis stream | `stream` | shards in `capacity` |
| Lambda | `function` | memory/timeout in `capacity` |
| ALB | `load_balancer` | |
| S3 bucket | `object_storage` | |
| EFS | `file_system` | |
| Route53 zone, ECR, KMS, IAM, log groups, secrets | `dns` / `other` / omit | IAM facts go into `security`/`controls`, not components |

## The start-up mock

`mock/startup.infra.json` is a small, deliberately imperfect start-up estate: 10 components, EUR 3,269/month, web and database in one zone, an orphan volume and an idle bastion. `mock/startup.forecast.json` is its forecast. `mock/startup.expected-signals.md` lists what the engine should notice; it is not input. The mock is built in Floci by `apps/estate/startup/` and compared against the extractor output by `apps/estate/compare_startup.py`.

## The engine's job (suggested, not part of the contract)

- **Sizing**: smallest catalog tier with `vcpu*(1-headroom) >= capacity.vcpu * usage.cpu_pct.p95/100` (same for memory); keep `p95`, not `avg`, in the headroom test.
- **Run cost**: sum catalog price for every component under the candidate, per scenario: month n uses `multiplier^n`, `traffic` on request-driven drivers, `data` on storage drivers, plus edge egress where an edge crosses a provider/region boundary (`gb_month * egress_per_gb_eur`).
- **On-prem**: monthly = `capex/(amortization_years*12) + power_cooling + colocation + disks.count*AFR*(replacement_eur + labor_hours*rate)/12 + staff_hours*rate + capex*maintenance_pct_of_capex_year/100/12 + network + licences`, plus `contingency_pct` of every line except capex, allocated by share of platform capacity used. The new lines (catalog 1.1) are optional and default to 0. Platforms are sized for the base scenario at the horizon. `setup_one_off_eur` is a one-off; the capex share is also paid up front.
- **Availability**: series of the critical path (product of availabilities); parallel zones raise it. Expected outage loss = `(1 - availability) * 8760 * downtime_cost_per_hour_eur`.
- **Score** (lower better): `w_cost*norm(total cost over horizon) + w_risk*norm(risk) + w_effort*norm(effort hours)` with min-max across surviving candidates; ties by `cto_settings.tie_break`. Payback = migration cost / monthly saving vs `do_nothing`.
- Constraints are evaluated on each candidate's **end state, including `do_nothing`** (the mock's `s3-legacy-reports` in `us-east-1` makes `do_nothing` infeasible under the example EU-only rule; show it as a baseline, flagged).

## Field rules (result.json)

- **Every candidate is listed**, `do_nothing` included, feasible or not, ordered by `rank`, then `violation_distance`, then `id`. Candidates are cumulative: `builds_on` names the candidate whose actions this one extends, and each action's `layer` names the strategy that added it.
- **`feasible`** is true exactly when `violations` is empty. Only feasible candidates have `score`, `rank` and `rank_by_scenario`; on the others these are `null` and `pareto` is false.
- **Violation**: `{ constraint, component, detail, actual, limit, distance }`, all six always present. `constraint` is the forecast's hard-constraint key; `budget` is the monthly run-cost ceiling, `migration_budget` the one-off ceiling, `security.<gate>` one key of `security_gates`. `component` is `null` for estate-wide violations. `actual` and `limit` are numbers, strings (a region, a provider) or `null`. `distance` is the normalised shortfall; `violation_distance` on the candidate is their sum.
- **`winner`** is the feasible candidate with `rank` 1. When nothing is feasible, `winner` is `null` and `closest_if_none_feasible` names the candidate with the smallest `violation_distance` and repeats what blocks it. Exactly one of the two is set.
- **`lost_because`** is `null` for the winner only. Every other candidate carries `{ reason, detail }`, with `reason` one of `constraint`, `cost`, `risk`, `effort`, `payback`.
- **Actions**: `saving_eur_month` is positive when the action saves money and negative when it costs more (growing an undersized database). `flag` is a finding with no priced change. Each action carries `confidence` (`high`/`medium`/`low` = weakest provenance observed/estimated/synthetic) and `confidence_reason`.
- **Cost**: `expected_total_eur` = `horizon_run_eur` + `migration_eur` + ops and expected outage loss over the horizon; it is the cost term of the score. `security_remediation` and `onprem_platform` are breakdowns of amounts already inside the totals, except `onprem_platform.upfront_hardware_eur`: the cash paid on day one, which the totals carry only as the monthly write-off (it counts against the one-off budget and in payback). `onprem_platform.setup_eur` is inside `migration_eur`.
- **`flags`** is an open list of caveats (`egress_unpriced`, `catalog_illustrative`, `usage_synthetic`); show the ones you know, keep the rest as text.

## Validate

```bash
python3 -m venv .venv && .venv/bin/pip install -r contracts/requirements.txt
.venv/bin/python contracts/check_mock.py                                       # mock + forecast + catalog + result + candidates + run + rehearsal + start-up examples
.venv/bin/python contracts/check_mock.py contracts/real/floci-estate.infra.json  # extractor output
.venv/bin/python contracts/check_mock.py path/to/result.json                     # engine output
.venv/bin/python contracts/check_mock.py path/to/candidates.json                 # agent output
.venv/bin/python -m unittest discover -s contracts -p "test_*.py"              # the run and candidates contracts' rules
```

Last run on this tree: all ten example files pass their schemas (infra, forecast, catalog, two results, candidates, run, rehearsal, start-up infra and forecast), 38 + 10 components, 21 run events, 0 integrity errors, 0 warnings; 67 contract tests pass (39 run, 28 candidates). The checker also fails correctly on a broken copy (duplicate id, dangling edge, missing provenance, unknown field, bad enum, node_group with a wrong parent, top-level `findings`).

## Schema 1.1 additions (optional fields)

`infra.schema.json` is 1.1; `infra.schema.1.0.json` is the saved 1.0. All three additions are optional, so every 1.0 document is a valid 1.1 document. The extractor emits them only with `--extensions` and then writes `"schema_version": "1.1"`.

| Field | Placement | Filled from | Provenance | Why it sits there |
|---|---|---|---|---|
| `components[].db_stats` | on a `postgres` component | `pg_stat_user_tables`, `pg_total_relation_size`, `pg_stat_user_indexes` over psycopg (read-only session; never table rows) | per table `observed` | statistics of one database belong to that database, next to its `capacity`/`usage`, where the engine reads them for sizing or splitting ("hot tables" = the engine ranks by `seq_scans`/`idx_scans`/`n_tup_*`; the extractor only orders by activity, it does not label) |
| `ci_runners` | top level | GitHub Actions API: runs in the window, their jobs; hours per runner type scaled to 30 days | `estimated` (computed from job start/end) | GitHub-hosted CI is not a resource in the scanned account; self-hosted runner machines already appear as `virtual_machine` components |
| `ai_consumption` | top level | optional input file named by `AI_CONSUMPTION_FILE` | `synthetic` (injected, not observed through an API) | model spend is billed by an external provider, not tied to one component; GPU utilisation already exists as `usage.gpu_pct` |

Proposed schema changes (not applied; for Vlad's review):

1. `db_stats.indexes` is a bare integer without provenance, unlike every other number in the contract. Make it a `static_metric`, or add a `provenance` to `db_stats`.
2. `pg_stat_*` counters are cumulative since the last statistics reset, not over `window_days`. Add `db_stats.stats_since` (date-time, from `pg_stat_database.stats_reset`) so the engine can turn counters into rates.
3. `pg_stat_user_tables` is per database and an instance can host several. Add an optional `database` to each table entry (the extractor reads one database per instance today: `DBName` or `postgres`).
4. `db_stats.connection` is extraction metadata and repeats `config.endpoint`; rename it `database` or drop it.
5. `ai_consumption.tokens_by_model[].cost_usd` is the only money field not in EUR. Either `monthly_eur` as a `static_metric` (with basis) or keep USD and say so in the description.
6. `ai_consumption` describes "GPU utilization" but has no GPU field; GPU stays in `usage.gpu_pct`, so drop it from the description.
7. `ci_runners.runners[]` has `hours_month` but no window and no per-workflow split; the spec asks for "workflow history". Add `window_days` and an optional `workflows: [{name, runs, hours_month}]`.
8. Allow a `basis` on `ci_runners.runners[]` and `tokens_by_model[]`, like `static_metric`, so `estimated` values state their formula.

## Versioning

`schema_version` is `major.minor`. Adding optional fields or enum values = minor. The engine must tolerate unknown `x_` fields, ignore unknown `usage`/`capacity` keys, and treat a `kind` it doesn't recognise (from a newer 1.x) as `other` (keep as-is). Removing/renaming/retyping a field or tightening a rule = major. Both schemas use `additionalProperties: false`, so a new minor version ships a new schema file together with the extractor change.

## Open questions to settle with the colleague

1. **Kind list**: is `kubernetes_cluster` + `node_group` (child component) OK, or should node groups live inside the cluster object? (Chosen: separate components, one `parent` link.)
2. **Usage windows**: fixed 14 days / hourly (what `synth/metrics.py` backfills) with `p95` computed by the extractor from hourly points, or should the extractor emit raw series?
3. **Who produces the numbers Floci can't?** Cost: extractor `estimated` from a price list, or engine only? (Current rule: optional in the JSON; the engine prices itself.) Traffic `gb_month`: keep inventing it for mocks, or derive from the byte metrics already pushed (`NetworkOut`, ALB `ProcessedBytes`)?
4. **Region**: Floci is us-east-1; mocks set `eu-west-1` by hand. Should the extractor accept a `--region-override` for demos, or is mock-only enough?
5. **Security scope**: security gates are hard constraints only; the engine does not "fix" security. Is that the intended product scope, or should it also rank security remediation?
6. **Constraints on `do_nothing`**: report as infeasible-baseline (proposed) or exclude from the frontier?
7. **Catalog coverage**: the starter catalog covers 8 kinds. For kinds without an option (`cache`, `queue`, `stream`, `function`, `load_balancer`, `file_system`) the engine keeps the component as-is and only flags waste/idle. Extend per demo need.
8. **Components per account**: one `infra.json` per project; for a multi-account estate, use `stacks[]` or several files?

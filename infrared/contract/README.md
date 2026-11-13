# InfraRed data contract (v1.0)

Everything the extractor side and the decision-engine side must agree on, plus a hand-written bad project to build against.

| File | Role |
|---|---|
| `infra.schema.json` | **The contract.** Extractor output: facts about one project's infrastructure. |
| `forecast.schema.json` / `forecast.example.json` | Roadmap + CTO settings turned into numbers (hand-written for now). |
| `catalog.schema.json` / `catalog.example.json` | Priced options per `kind` and provider. **Illustrative prices.** |
| `mock/demo-shop.infra.json` | The deliberately bad mock project (38 components, 30 edges, 4 stacks). |
| `mock/demo-shop.expected-signals.md` | What a competent engine should notice in the mock. Engine-side, not input. |
| `mock/build_demo_shop.py` | Authoring helper for the mock. All numbers typed by hand; reads nothing from `ground_truth/`. |
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

## The engine's job (suggested, not part of the contract)

- **Sizing**: smallest catalog tier with `vcpu*(1-headroom) >= capacity.vcpu * usage.cpu_pct.p95/100` (same for memory); keep `p95`, not `avg`, in the headroom test.
- **Run cost**: sum catalog price for every component under the candidate, per scenario: month n uses `multiplier^n`, `traffic` on request-driven drivers, `data` on storage drivers, plus edge egress where an edge crosses a provider/region boundary (`gb_month * egress_per_gb_eur`).
- **On-prem**: monthly = `capex/(amortization_years*12) + power_cooling + colocation + disks.count*AFR*(replacement_eur + labor_hours*rate)/12 + staff_hours*rate`, allocated by share of platform capacity used.
- **Availability**: series of the critical path (product of availabilities); parallel zones raise it. Expected outage loss = `(1 - availability) * 8760 * downtime_cost_per_hour_eur`.
- **Score** (lower better): `w_cost*norm(total cost over horizon) + w_risk*norm(risk) + w_effort*norm(effort hours)` with min-max across surviving candidates; ties by `cto_settings.tie_break`. Payback = migration cost / monthly saving vs `do_nothing`.
- Constraints are evaluated on each candidate's **end state, including `do_nothing`** (the mock's `s3-legacy-reports` in `us-east-1` makes `do_nothing` infeasible under the example EU-only rule; show it as a baseline, flagged).

## Validate

```bash
python3 -m venv /tmp/ir-venv && /tmp/ir-venv/bin/pip install jsonschema
/tmp/ir-venv/bin/python contract/check_mock.py                    # mock + forecast + catalog examples
/tmp/ir-venv/bin/python contract/check_mock.py path/to/real.json  # extractor output
# one-liner, schema only:
/tmp/ir-venv/bin/python -c "import json,jsonschema;jsonschema.Draft202012Validator(json.load(open('contract/infra.schema.json'))).validate(json.load(open('contract/mock/demo-shop.infra.json')));print('ok')"
```

Last run on this tree: all three example files pass their schemas, 38 components / 30 edges, 0 integrity errors, 0 warnings. The checker also fails correctly on a broken copy (duplicate id, dangling edge, missing provenance, unknown field, bad enum, node_group with a wrong parent, top-level `findings`).

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

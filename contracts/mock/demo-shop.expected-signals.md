# demo-shop: what a competent engine should notice

> **ENGINE-SIDE EXPECTATIONS. NOT PART OF THE INPUT.** The extractor never emits findings
> (the schema rejects a top-level `findings`/`signals` key). This file exists only so the engine
> author can sanity-check output on `demo-shop.infra.json`. It was written by hand from the mock,
> not from `ground_truth/`. Euro figures are the mock's own `cost.monthly_eur` (estimated).
> Current estimated run cost: **EUR 133,308 / month** (shop 59.6k, data 63.6k, legacy 8.7k, dev 1.4k).

## Waste the engine should find without any migration
| # | Signal | Components | Evidence in the JSON | Size |
|---|---|---|---|---|
| 1 | Idle GPU nodes | `ng-data-gpu` | `gpu_pct` avg 0.4 / p95 1.0, three short bursts; fixed `scaling` 4/4/4; 4 x p3.8xlarge | EUR 32.9k/mo, largest single line |
| 2 | Orphan database copy | `rds-orders-clone` | status `orphan`, 0.4 connections, no inbound edges | EUR 2.9k/mo, plus holds 1.4 TB of PII |
| 3 | Orphan volumes | `ebs-orphans` | status `orphan`, 6 x 1 TB, zero IOPS | EUR 552/mo |
| 4 | Idle NAT gateways | `nat-dev` | status `idle`, 0.4 GB out in 14 d across 3 gateways | EUR 91/mo |
| 5 | Forgotten dev instances | `vm-dev-jump` | status `idle`, cpu avg 1% | EUR 769/mo |
| 6 | Idle bastion | `vm-bastion` | cpu avg 0.6%, ports 22/3389 open to world | EUR 562/mo |
| 7 | Unused cache cluster | `cache-legacy-mc` | status `idle`, 0 connections, hit rate 0, edge `config` with 0 GB | EUR 1.5k/mo |
| 8 | Idle provisioned EFS throughput | `efs-legacy` | 512 MiB/s provisioned, utilisation 0.4%, 38 GB stored | EUR 2.8k/mo |
| 9 | Dead queue | `q-legacy-jobs` | 840 visible avg, 0 received, `consumers_detected` 0 | small, but an ops signal |

Idle + orphan total (rows 2-8): **EUR 9.2k/mo**.

## Oversizing (rightsize in place)
- `ng-shop-staging`: 12 x m5.8xlarge at cpu avg 2% / p95 6%: same size as prod. EUR 12.4k/mo.
- `ng-shop-general`, `ng-shop-cpu`: cpu p95 31% / 24% with autoscaling off (min=max=desired). Candidates for smaller or autoscaled pools.
- `ng-data-spark`: cpu p95 61%, fine on average but static; autoscaling candidate rather than a shrink.
- `rds-orders`: db.r5.8xlarge at cpu avg 8% / p95 22% (the "oversized RDS" case), 2 TB allocated vs 1.45 TB used.
- `rds-erp`: cpu avg 4%, on an old db.r4 class. `pg-lake`: 2 x r5.4xlarge at 3% cpu.
- `cache-sessions`: 105 GB cache at 2% memory.
- ECS services (`svc-*`): 2-4 vCPU tasks at 1-4% cpu, fixed counts.
- `stream-clicks`: 50 shards for ~0.1 MB/s (capacity is 50 MB/s).
- `fn-resize` / `fn-cron`: 3 GB / 2 GB memory and 900 s timeout for sub-second work.

## The opposite problem
- `rds-analytics`: cpu avg 88% / p95 97%, db.m5.4xlarge. It is under-sized and a reliability risk. A cost-only engine will miss it; it must be flagged as a candidate to grow, not shrink.

## Reliability / structure
- Single-AZ stateful components: `rds-orders`, `rds-analytics`, `rds-erp`, `pg-lake` (both instances in one zone), `cache-sessions`. Against `ha_level: multi_az, min_zones: 2` these fail the CTO setting.
- `ddb-orders`: `partition_key: status` with throttling (avg 140/h, max 2100/h) while consuming under 10% of provisioned RCU. This is a design problem, not a capacity problem, so adding capacity should NOT be recommended. 8000/4000 provisioned with 2 GSIs at ALL projection.
- `q-orders`: visibility timeout 0, no DLQ, 30M empty receives (short polling).
- `eks-shop-staging` has a `data` edge into the production `rds-orders` (e09): environment isolation problem.
- No autoscaling anywhere (all `scaling.autoscaling_enabled` false).
- EKS 1.28/1.29 clusters are old; engine versions Postgres 11.x are end of life.

## Security gates (with the example forecast's gates on)
Public datastores: `rds-orders`, `rds-orders-clone`, `rds-analytics`, `rds-erp`, `pg-lake`, `s3-uploads`, `s3-legacy-reports`.
No encryption at rest: almost everything stateful except `ddb-orders`. No backups (`backup_retention_days` 0/1) on all RDS. `controls`: no audit logging, no threat detection, no backup plans. World-open admin ports: `vm-bastion`, `vm-dev-jump`, `vmfleet-web`, `vm-batch`. Plaintext secrets / admin privileges: `fn-resize`, `fn-cron`, all `svc-*`.

## Hard constraints from `forecast.example.json`
- **Data residency (EU only for pii/confidential/unknown):** `s3-legacy-reports` is `us-east-1` + `pii` -> the current estate already violates it. `do_nothing` must be reported infeasible but still shown as the baseline.
- **Budget ceiling EUR 90k/mo on the base scenario at month 36:** current EUR 133k is already above it; with 2-3%/month growth, the ceiling is only reachable by removing GPU/staging/orphan waste AND rightsizing. A good engine says which combination is the cheapest way to get under it.
- **Provider allow-list** `aws, managed_pg, onprem`; **99.9% availability** is not met by single-AZ RDS at 99.5%.

## Migration blockers (catalog feature check)
- `rds-analytics` uses `pg_partman` and `logical_replication`: **`neon-launch` lacks both**, so moving it there must be rejected with that reason. `aws-rds-postgres`, `aws-aurora-postgres` and `onprem-postgres` support them.
- `rds-orders` uses `logical_replication`: also blocked from `neon-launch`.
- `pg-lake` uses `pgvector`, `pg_partman`: blocked from `neon-launch` (pg_partman).
- `rds-erp` (`hstore`, `pg_trgm`): the only Postgres the managed provider can take without feature loss. A cheap-looking win that is still constrained by the `erp-core` stay-together group (moving it alone makes `svc-orders-api` / `svc-invoice-worker` pay egress and latency).

## Stay-together and egress
- `orders-core` (`rds-orders`, `vmfleet-web`, `cache-sessions`): latency-bound; moving the DB alone adds ~380 + 220 GB/mo of egress and per-request latency.
- `orders-replication` (`rds-orders`, `rds-analytics`): same provider (logical replication, 600 GB/mo).
- `erp-core`: `svc-orders-api`, `svc-invoice-worker`, `rds-erp`.

## Provenance behaviour
The data stack (`eks-data`, `ng-data-*`, `pg-lake`, `stream-clicks`, `s3-lake`) uses **synthetic** usage, and most `gb_month` edges are **estimated or synthetic**. Recommendations built on them (notably the GPU finding, the single biggest saving) should come out with a lower confidence than the ones built on observed usage (shop, legacy), and say why.

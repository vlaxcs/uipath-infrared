# startup: what a competent engine should notice

> **ENGINE-SIDE EXPECTATIONS. NOT PART OF THE INPUT.** This file documents the deliberate poor choices
> in `startup.infra.json` that the engine should detect.
> Current estimated run cost: **EUR 3,269 / month**

## Waste without migration
| # | Signal | Components | Evidence | Size |
|---|---|---|---|---|
| 1 | Orphan volume | `logs-volume` | status `orphan`, 500 GB, zero IOPS | EUR 46/mo |
| 2 | Idle bastion | `old-bastion` | status `idle`, cpu avg 0.8%, SSH open to world | EUR 60/mo |

Idle + orphan total: **EUR 106/mo**

## Reliability
- Single-AZ stateful components: `app-db` (zones: 1), `cache` (zones: 1)
- `app-db`: no backups (`backup_retention_days: 0`), no deletion protection, single-AZ
- Against `ha_level: multi_az, min_zones: 2` these fail the CTO setting
- `queue`: visibility timeout 30s but short polling (`receive_wait_s: 0`), no DLQ

## Security gates (from startup.forecast.json)
- Public datastores: `app-db` has `public_exposure: internet` (violates `forbid_public_datastores`)
- No encryption at rest: `app-db`, `cache`, `queue`, `logs-volume` (violates `require_encryption_at_rest`)
- `uploads` and `backup-storage` report `encryption_at_rest: true`: S3 applies SSE-S3 by default (AWS since 2023, Floci too), so their risk is exposure and residency, not encryption
- `web-server` and `old-bastion` report `encryption_at_rest: null`: the instance API does not show EBS encryption; the extractor leaves it unknown
- World-open admin ports: `web-server` ports [80, 443, 22], `old-bastion` port 22 (violates `forbid_world_open_admin_ports` for SSH/RDP)
- No backups: `app-db` has 0 retention, `cache` has 0 retention (violates `require_backups`)
- Plaintext secrets: `worker` has `plaintext_secrets_suspected: true`

## Hard constraints from startup.forecast.json
- **Data residency (EU only for pii/confidential/unknown):** `backup-storage` is `us-east-1` + `pii` classification -> violates the rule. This is the deliberate constraint violation for demo path step 3. The current estate (`do_nothing`) is infeasible.
- **Budget ceiling EUR 12k/mo:** current ~EUR 3.3k leaves headroom, but with growth the engine should verify the candidate stays within it
- **99.5% availability:** single-AZ RDS at 99.5% barely meets it, but with no backups and no multi-AZ it's a reliability risk

## Oversizing (rightsize in place)
- `web-server`: 3 x m5.4xlarge (16 vCPU each) at cpu avg 12% / p95 28%. Oversized, candidate for smaller instances or fewer replicas
- `app-db`: db.r5.4xlarge at cpu avg 18% / p95 42%. Reasonably sized but single-AZ

## Design problems
- `queue`: short polling (3.2M empty receives) wastes requests/cost. Long polling (`receive_wait_s > 0`) would reduce cost
- `uploads`: public exposure to internet without versioning or lifecycle rules
- `backup-storage`: in us-east-1 when everything else is eu-west-1, cross-region egress + violates residency
- No autoscaling on `web-server` (static quantity: 2)

## provenance
All usage is `observed`, costs are `estimated`. Mix of observed config facts and estimated costs, as a start-up would extract.

## Total monthly cost breakdown
- web-server: EUR 1,575
- app-db: EUR 1,267
- cache: EUR 265
- queue: EUR 3
- uploads: EUR 10
- worker: EUR 6
- backup-storage: EUR 6
- nat: EUR 31
- logs-volume: EUR 46
- old-bastion: EUR 60

**Total: EUR 3,269/month** (in the EUR 3-8k target range)

# fleet-telemetry: what a competent engine should notice

> **ENGINE-SIDE EXPECTATIONS. NOT PART OF THE INPUT.** This file documents the deliberate poor choices
> in `fleet-telemetry.infra.json` that the engine should detect.
> Current estimated run cost: **EUR 6,913 / month** (prod 6,496, dev 417)

Who it is for: `fleet-telemetry.project.json`. 3,200 daily active users today (dispatchers and drivers; about 6,000 vans send positions), 10,700 expected at month 18 on the base scenario. Two courier networks onboard in month 4 (traffic x1.8).

## Environments
| Environment | Stack | EUR/month | Point |
|---|---|---|---|
| prod | `prod` | 6,496 | 78% of it is one DynamoDB table provisioned ahead of the onboarding |
| dev | `dev` | 417 | A dev stream nobody writes to, an idle replay box, a public database with a prod copy |
| staging | none | - | Releases go from dev to prod; there is nothing to test the onboarding load on |

## Over-provisioned ahead of growth
| # | Signal | Components | Evidence | Size |
|---|---|---|---|---|
| 1 | Provisioned table at a fraction of use | `prod-positions` | 3,000 RCU / 5,000 WCU provisioned, consumed avg 410 / 860 (p95 980 / 1,900); one GSI at the same provisioning, ALL projection; no TTL, so 900 GB keeps growing | EUR 5,096/mo |
| 2 | Stream with 24 shards for ~2 shards of traffic | `prod-ingest-stream` | 180 KB/s avg, 410 KB/s p95; one shard takes 1 MB/s | EUR 277/mo |
| 3 | Dev stream with no traffic | `dev-ingest-stream` | 8 shards, 11,000 records in 14 days | EUR 81/mo |
| 4 | Idle replay box | `dev-replay` | status `idle`, cpu avg 0.9%, SSH open to the world | EUR 233/mo |

Even after the month-4 onboarding (x1.8) the table's p95 write use is about 3,400 WCU: on-demand or auto scaling covers it.

## Security gates (from fleet-telemetry.forecast.json)
- Public datastore: `dev-db` has `public_exposure: internet` and holds `pii` restored from a prod snapshot (`tags.restored_from`) (violates `forbid_public_datastores`)
- No encryption at rest: `prod-ingest-stream`, `dev-ingest-stream`, `prod-geofence`, `prod-alerts`, `dev-db` (violates `require_encryption_at_rest`)
- No backups: `prod-positions` (PITR off), `prod-geofence`, `dev-db` (violates `require_backups`)
- World-open admin port: `dev-replay` port 22
- `prod-dashboard-api` tasks have public IPs (`public_exposure: internet`) and a map API key in plain environment variables (`plaintext_secrets_suspected: true`)
- `prod-ingest` runs with an administrator role (`admin_privileges: true`)

## Reliability
- `prod-accounts-db` is single-AZ; `prod-dashboard-api` runs in one subnet; `prod-geofence` is one node on the ingest path (`stay_together: ingest-path`)
- `prod-alerts`: no DLQ, short polling

## Hard constraints
- **Budget EUR 28k/mo at month 18 (base):** traffic grows ~3.3x with the onboarding; with the table left provisioned the bill grows with it
- **Cutover downtime 2 h, residency EU-only:** all in `eu-west-1` today

## Expected engine outcome on the mock
`do_nothing` is infeasible (security gates). `cleanup_orphans` fails `min_availability_pct` (99.478% on the prod path). `managed_services` and `rightsize_in_place` are feasible; the engine picks `managed_services`.

## Provenance
All usage `observed`, costs `estimated`. On Floci (`apps/estate/projects`) the same estate reads back with synthetic usage.

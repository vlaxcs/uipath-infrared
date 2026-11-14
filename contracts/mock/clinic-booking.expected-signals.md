# clinic-booking: what a competent engine should notice

> **ENGINE-SIDE EXPECTATIONS. NOT PART OF THE INPUT.** This file documents the deliberate poor choices
> in `clinic-booking.infra.json` that the engine should detect.
> Current estimated run cost: **EUR 4,305 / month** (prod 2,446, staging 1,527, dev 332)

Who it is for: `clinic-booking.project.json`. 41,000 monthly active users today, 112,500 expected at month 24 on the base scenario (Hungary launch in month 9).

## Environments
| Environment | Stack | EUR/month | Point |
|---|---|---|---|
| prod | `prod` | 2,446 | Multi-AZ database with backups and deletion protection; the API tasks sit in one subnet |
| staging | `staging` | 1,527 | 35% of the bill for a copy of prod at full size, always on, at 2-3% CPU |
| dev | `dev` | 332 | An always-on CI runner, a public database and a loose volume |

## Waste without migration
| # | Signal | Components | Evidence | Size |
|---|---|---|---|---|
| 1 | Orphan volume | `dev-scratch` | status `orphan`, 200 GB gp3, zero IOPS | EUR 15/mo |
| 2 | Idle CI runner | `dev-runner` | status `idle`, cpu avg 1.6%, m5.2xlarge always on, SSH open to the world | EUR 267/mo |
| 3 | Staging sized like prod | `staging-api`, `staging-db` | 6 x 4 vCPU tasks at cpu avg 2.4%; db.r5.2xlarge at cpu avg 3%, 6 connections | EUR 1,510/mo |

## Security gates (from clinic-booking.forecast.json)
- Public datastore: `dev-db` has `public_exposure: internet` (violates `forbid_public_datastores`)
- No encryption at rest: `staging-db`, `dev-db`, `prod-cache`, `dev-scratch` (violates `require_encryption_at_rest`)
- `staging-db` holds `pii`: it is restored weekly from a prod snapshot, unmasked (`tags.restored_from`), unencrypted, 1-day backups. The profile says so too (`data: copy_of_production`)
- World-open admin port: `dev-runner` port 22 (violates `forbid_world_open_admin_ports`)
- No backups: `dev-db` 0 days, `prod-cache` 0 days (violates `require_backups`)
- Audit logging is on (`controls.audit_logging_enabled: true`), so `require_audit_logging` passes on the mock

## Reliability
- `prod-api`: 6 tasks in one subnet (`zones: 1`) behind a two-zone load balancer; against `ha_level: multi_az, min_zones: 2` this is the weak link of the booking path
- `prod-cache`: single node, single zone, on the latency-bound path (`stay_together: booking-path`)
- `prod-db` is the good example: Multi-AZ (`zones: 2`), encrypted, 7-day backups, deletion protection

## Hard constraints
- **Data residency (EU only for pii/confidential/unknown):** everything is in `eu-central-1`; no violation today. A candidate that moves `prod-documents` or either database out of the EU must be dropped
- **Budget EUR 16k/mo at month 24 (base):** traffic grows ~2.7x with the Hungary launch; the engine should check the winner stays under it
- **Cutover downtime 1 h:** rules out a dump-and-restore of `prod-db` (140 GB) without replication

## Expected engine outcome on the mock
`do_nothing` is infeasible (security gates). `cleanup_orphans` fails `min_availability_pct`. `managed_services` and `rightsize_in_place` are feasible; the engine picks `managed_services`.

## Provenance
All usage `observed`, costs `estimated`. On Floci (`apps/estate/projects`) the same estate reads back with synthetic usage.

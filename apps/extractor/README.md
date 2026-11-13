# Extractor

`extract_floci.py` reads the running estate through API calls only and writes `contracts/real/floci-estate.infra.json`.
Same schema as `contracts/mock/demo-shop.infra.json` (`contracts/infra.schema.json`), so the engine reads either file unchanged.
Endpoint, region and credentials come from the repo-root `.env`.

Run from `apps/extractor/`:

    python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # once
    .venv/bin/python extract_floci.py --out /tmp/floci.infra.json         # re-extract (needs floci up)
    .venv/bin/python extract_floci.py --extensions --out /tmp/floci.infra.json   # schema 1.1 fields too
    python ../../contracts/check_mock.py /tmp/floci.infra.json            # validate
    ../../.venv/bin/python -m pytest -q tests                             # unit tests + baseline comparison

Without `--out` it overwrites `contracts/real/floci-estate.infra.json`, which CI validates; only do that on purpose.

## Layout

`extract_floci.py` is a shim over the `extractor` package (spec section 4):

| Layer | Holds | Rule |
|---|---|---|
| `extractor/cli/` | argument parsing, wiring adapters, writing the file, the printed summary | entry point only |
| `extractor/application/` | one module per extraction step: fetch through an adapter, map through the domain, add to the inventory; the `Warnings` collector | orchestrates |
| `extractor/domain/` | component mapping per service, status derivation, cost estimation, series summaries (p95), stacks, edges, the 1.1 mappings | never imports an adapter, no I/O |
| `extractor/adapters/` | boto3 per AWS service, CloudWatch, psycopg, the GitHub API, the AI consumption file | the only code that talks to the outside |
| `extractor/settings.py` | reads the repo-root `.env` | stops naming a missing required variable |

`tests/test_extraction.py` re-runs the extractor against Floci and compares it with `tests/fixtures/baseline.normalized.json`, restricted to the stacks in the baseline (shop, data, legacy, dev), so the start-up and sandbox estates can come and go without breaking it. It is skipped when Floci is unreachable. Every other test uses plain data.

EC2 instances in state `terminated` or `shutting-down` are not components (Floci keeps them listed forever); they are named in one `x_extraction_warnings` entry.

## Mock vs real

| | `mock/demo-shop.infra.json` | `real/floci-estate.infra.json` |
|---|---|---|
| `source.is_mock` | true (hand-written) | false (API calls) |
| components / edges | 38 / 30 | 57 / 25 |
| regions | eu-west-1 + us-east-1 (set by hand) | us-east-1 only (Floci) |
| stay_together groups | 3 hand-written | none (extractor leaves it to the engine) |
| `features_used` (pg extensions) | filled by hand | **omitted** (RDS API cannot show extensions) |
| usage series | mixed observed/synthetic | all `synthetic` (injected by synth/metrics.py) |
| cost | estimated | estimated, approximate list prices |
| stacks | hand-written | derived from VPC + name prefix (no tags exist) |
| edges | hand-written, some `inferred` | only `declared` (config refs); no flow logs, so no `gb_month` |

## Things the engine must tolerate (these are real-data properties, not bugs)
- Node-group `cpu_pct`/`memory_pct`/`gpu_pct` are **cluster-level** series copied onto every node group of that cluster.
- Some components have no edges because nothing in the API links them (EKS workloads, `shop-sessions` Redis, DynamoDB tables, most S3 buckets).
- `status` is derived: `orphan` = referenced by nothing and ~no load, `idle` = referenced/running but ~no load. Queues are judged on traffic, not edges.
- Components without `cost`: usage-priced (Lambda, SQS, SNS, Firehose, DNS, EventBridge, ECR, on-demand DynamoDB).
- Floci-created EKS backing instances (`*-node`) and `awslambda-*` buckets are skipped; see `x_extraction_warnings`.
- `x_extraction_warnings` at the top level lists every skipped or failed call.

## Schema 1.1 extensions (`--extensions`)

Off by default, so the default output stays schema 1.0 and identical to the baseline. With `--extensions` the document says `"schema_version": "1.1"` and adds three optional fields. Each source is optional; when it is not configured or not reachable the extractor writes one `x_extraction_warnings` entry and carries on.

| Field | Where | Source | Provenance | Setting |
|---|---|---|---|---|
| `db_stats` | on each `postgres` component | psycopg against the endpoint the RDS API reports (`Address:Port`; on Floci all DBs share one address and differ by port), user = `MasterUsername`, database = `DBName` or `postgres`. Reads `pg_stat_user_tables`, `pg_total_relation_size`, `pg_stat_user_indexes` in a read-only session. Never table rows. Tables are ranked by activity (scans + tuple writes) and capped at 100, with a warning if cut. | `observed` (counters come straight from Postgres) | `RDS_STATS_PASSWORD` |
| `ci_runners` | top level | GitHub REST API: workflow runs created in the window (`/actions/runs`, up to 500), then their jobs. Hours per runner type are summed from job start/end and scaled to 30 days; `self-hosted` wins over other labels. | `estimated` (hours are computed and scaled, not read) | `GITHUB_TOKEN`, `GITHUB_REPOSITORY` (`owner/name`) |
| `ai_consumption` | top level | an optional JSON file, see below | always `synthetic`: it is injected input, not something the extractor observed through an API | `AI_CONSUMPTION_FILE` |

Why there: `db_stats` describes one database, so it lives on that component next to its `capacity` and `usage`, where the engine already looks when sizing or splitting it. CI runners and model spend are not resources in the scanned cloud account (GitHub-hosted runners and a model provider bill separately), so they sit at the top level instead of being forced into a component `kind`. GPU utilisation already exists as `usage.gpu_pct` on node groups and is not repeated.

AI consumption input file (example: `examples/ai-consumption.example.json`):

    {"window_days": 30,
     "models": [{"model": "claude-sonnet-4", "provider": "anthropic", "input_tokens": 182000000, "output_tokens": 21000000, "cost_usd": 861.0}]}

`window_days` and each entry's `model` and `provider` are required; `input_tokens`, `output_tokens`, `cost_usd` are optional; other keys are ignored. An invalid file is a warning, not a crash.

On Floci, the RDS endpoint address (`172.17.0.2`) is a Docker bridge address: reachable from a container on Floci's network, not from a macOS host (the host run times out per DB and records a warning). To read the statistics from a laptop, run the extractor inside Floci's network namespace:

    docker run --rm --network container:floci -e RDS_STATS_PASSWORD=... -v "$PWD/../..":/repo:ro -v /tmp:/out \
      -w /repo/apps/extractor python:latest sh -c 'pip install -q -r requirements.txt && python extract_floci.py --extensions --out /out/floci.infra.json'

The Floci estate databases currently hold no user tables, so their `db_stats.tables` is an empty list.

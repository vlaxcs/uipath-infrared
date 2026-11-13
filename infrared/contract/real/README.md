# Real extractor output (live Floci estate)

`floci-estate.infra.json` is what `../extract_floci.py` produced from the running Floci estate.
Same schema as `../mock/demo-shop.infra.json` (`infra.schema.json`), so the engine reads either file unchanged.

    ../.venv/bin/python ../extract_floci.py            # re-extract (needs floci up on :4566)
    python3 ../check_mock.py real/floci-estate.infra.json   # validate (needs jsonschema)

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

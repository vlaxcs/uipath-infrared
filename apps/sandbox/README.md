# Infrared Sandbox

The sandbox rehearses the layout the CTO picked, in Floci: it builds the end state of one `result.json` candidate applied to `infra.json`, sends HTTP traffic from inside the VPC, injects one failure into something it built, measures availability and latency before, during and after, records what happened to every component, tears everything down and proves it, and writes `rehearsal.json`.

## Usage

```bash
./apps/sandbox/sandbox.sh rehearse \
  --result apps/sandbox/sample/result.json \
  --candidate rightsize_multi_az \
  --infra contracts/mock/startup.infra.json \
  --forecast contracts/mock/startup.forecast.json \
  --out rehearsal.json

./apps/sandbox/sandbox.sh inventory              # every sandbox- resource in Floci
./apps/sandbox/sandbox.sh teardown --prefix sandbox-abc123-
```

Without the wrapper: `PYTHONPATH=apps .venv/bin/python -m sandbox rehearse ...` from the repo root.

`--candidate` is the id the CTO picked: `decision.layout` of the `pick_layout` event in `run.json`. `--forecast` gives `hard_constraints.min_availability_pct` (99.9 without it). `--phase-seconds` sets the baseline, failure and recovery windows (15 s each by default; the failure window also waits for Floci to report the failure in effect, up to 45 s).

Exit codes: 0 the rehearsal held, 1 it did not, 2 refused (unknown candidate, or `sandbox-` resources already in Floci).

## Input: from result.json to an end state

Every `infra.json` component is in the end state. The picked candidate's actions change it, in order:

| action | effect |
|---|---|
| none, `keep` | built as `infra.json` describes it |
| `delete`, `stop` | nothing built |
| `resize`, `scale`, `move` | count, size and zones from `to` when it states them (`2 x m5.2xlarge`, `db.r5.2xlarge`, `2 zones`, `3 nodes`), otherwise from the component |
| `autoscale`, `remediate`, `flag` | not rehearsed, recorded in `x_actions_skipped` |

A `to` the sandbox cannot read, a `move`'s provider, product or region change, and an action on something that is not an `infra.json` component are recorded in `x_actions_skipped` with the reason. Kinds it does not build are recorded in `x_actions_not_built`.

| kind | built in Floci |
|---|---|
| `virtual_machine` | `quantity` EC2 instances spread round-robin over `zones` subnets, each serving HTTP on 8080 from UserData |
| `load_balancer` | ALB over the subnets, target group on 8080 with 5 s health checks, listener on 80, every VM registered |
| `postgres` | RDS postgres, `MultiAZ` when `zones` > 1, with a DB subnet group |
| `cache` | ElastiCache redis, one node, with a cache subnet group |
| `queue` | SQS queue |
| `object_storage` | S3 bucket |
| `function` | Lambda from `sku` (`python3.9/1024MB`), invoked once at build |
| `nat` | one EIP and NAT gateway per zone |

Everything lives in one VPC with at least two subnets, named `sandbox-<run id>-...`. Everything is built in the Floci region from `.env`, whatever region `infra.json` names.

## How it measures

- Traffic: a load-generator instance in the VPC (`sandbox-<run>-loadgen`) sends 5 requests/s to the ALB, or round-robin to the web instances when the end state has no load balancer. The host cannot do this: Floci serves ALB listeners inside its own container and does not publish them, and instance IPs are not routable from the host.
- It also checks postgres (SSLRequest) and redis (PING) every second with a protocol handshake.
- The sandbox writes the phase (`warmup`, `baseline`, `failure`, `recovery`, `stop`) to an S3 control object; the generator labels each sample with it and uploads its samples to S3.
- From the host, every 3 s: instance state and target health, ALB, RDS, cache and NAT state, and real calls to queues (`send_message`), buckets (`put_object`) and functions (`invoke`).
- Failure: stop one instance of the web tier with the most instances (behind the ALB if there is one), else reboot the postgres primary with a forced failover, else stop the only instance. The instance is started again at the end of the failure window.
- All values have provenance `synthetic`. Metrics with no samples are left out, never filled in.

## Output

`rehearsal.json`, valid against `contracts/rehearsal.schema.json`, plus `x_` fields:

| field | content |
|---|---|
| `x_decision` | `{kind: proceed \| revise, reason}`, the shape of `decision` on the rehearse `completed` event in `run.json`. `proceed` exactly when `verdict.passed` |
| `x_actions_skipped` | actions not rehearsed, with the reason |
| `x_actions_not_built` | components not built: deleted, stopped, unsupported kind, or failed to build on Floci |
| `x_components_built` | every resource built per component |
| `x_readiness` | how long instances, targets and the load generator took to be ready |
| `x_measurement_notes` | what is real and what Floci cannot do |
| `x_teardown` | the prefix, the resource types checked and anything left |

## Safety

- The sandbox only ever touches Floci: `settings.py` refuses an `AWS_ENDPOINT_URL` that is not localhost, 127.x or a localstack host.
- It only creates names starting with `sandbox-<run id>-`, and refuses to start when any `sandbox-` resource already exists.
- Teardown runs even when the rehearsal fails, deletes everything under the run prefix in dependency order, re-lists every resource type and retries until nothing is left.

## What Floci does not do

- No standby behind RDS `MultiAZ`: a forced failover restarts the single postgres container.
- A stopped instance takes 20 to 40 s to stop, and does not rerun UserData when started again, so its web server stays down.
- NAT gateways are control-plane only; no egress is sent through them.

## Tests

```bash
.venv/bin/python -m pytest -q apps/sandbox/tests
```

`sample/result.json` is a hand-written result for the start-up mock (valid against `result.schema.json`, sample values, not engine output). `sample/rehearsal.json` is the real output of the command above against Floci.

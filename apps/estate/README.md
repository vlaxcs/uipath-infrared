# Infrared synthetic AWS estate (floci)

Deliberately badly-built infrastructure for testing an observer/advisor agent.

    ./run.sh        # wipe floci, rebuild resources, backfill 14d of metrics, start live pusher
    ./stop-live.sh  # stop the background live-metrics pusher (logs/live.log)
    ./reset.sh      # wipe only

Endpoint `http://localhost:4566`, region `us-east-1`, creds `test/test`.

## Stacks
| stack | clusters | notes |
|---|---|---|
| shop-prod | EKS `shop-prod`, `shop-staging` | oversized fixed nodegroups, ASG, ALB, RDS, Redis, DynamoDB, S3 |
| data-platform | EKS `data-platform` (GPU nodes), `ml-experiments`; Aurora cluster | Kinesis, DynamoDB, data-lake S3 |
| legacy | ECS `legacy-ecs` (4 services), `legacy-ecs-ec2` | overlapping CIDR, ALB, RDS, memcached |
| dev / shared | - | 3 NAT GWs, forgotten EC2, orphan EBS/EIPs, IAM, logs, secrets |

## How things connect (`synth/wiring.py`, `ground_truth/topology.json`)
- Traffic: Route53 CNAME -> ALB -> target group -> ASG instances (shop) / ECS `orders-api` tasks (legacy). Floci registers
  targets asynchronously (~1 min after build), so target groups fill gradually.
- Data: RDS in DB subnet groups + SGs; Lambda/ECS env vars hold the real DB `host:port` (all DBs share 172.17.0.2, differ by port).
- Events: SNS -> SQS `shop-emails` -> Lambda `shop-send-email`; S3 `shop-prod-uploads` -> Lambda `shop-resize-image`;
  EventBridge rate(1 min) -> `legacy-cron`; Kinesis `clickstream` -> Firehose -> S3 `data-lake-raw`.
- Deliberately unconnected: `legacy-jobs` queue has no consumer, `shop-orders-db-copy`, `legacy-memcache`, `legacy-ecs-ec2` are orphans.
- EKS pods/workloads are not simulated; EKS links are network + intent only (topology.json).
- `topology.json` = ~68 intended edges (network/data/event/traffic/dns/config) for scoring dependency discovery.

## Graph view (`synth/graph.py`)
    .venv/bin/python -m synth.graph && open graph/graph.html
Builds `graph/graph.json` (nodes+edges), `graph/graph.dot` (Graphviz) and a self-contained `graph/graph.html` (force layout
clustered by stack; filter by stack / connection kind / status; click a node for attributes + connections).
Nodes come from live floci state; edges = `topology.json` + relationships read from the API (placement, roles, containment).
Stack, idle and orphan are derived from naming and observed metrics, not from the planted-issue ledger. `run.sh` regenerates it.

## Start-up estate (`startup/`)
A second, smaller estate (~10 components, every resource prefixed `startup-`) that mirrors
`contracts/mock/startup.infra.json`: one production stack, about EUR 3k/month. The engine is tested on it as a
start-up-sized project. Run everything from `apps/estate` with the repo-root `.env` exported.

    cd apps/estate
    set -a && source ../../.env && set +a
    ../../.venv/bin/python -m startup.build     # creates what is missing, reuses the rest (safe to re-run)
    ../../.venv/bin/python -m startup.metrics   # 14 days of hourly CloudWatch points for the startup- resources
    ../../.venv/bin/python -m startup.teardown  # deletes every startup- resource (ask before running it)

`build` looks every resource up by its Name tag or identifier before creating it, so a second run creates nothing.
The three web servers are one Auto Scaling Group `startup-web` (desired 3), which the extractor reports as one
`virtual_machine` with quantity 3. `metrics` gives the statuses the mock declares: steady SQS traffic keeps
`startup-queue` active, and ~0.8% CPU with no network out makes `startup-old-bastion` idle. Re-running it adds a
second point per hour; averages stay the same.

Compare against the mock (write the extraction outside the repo, never to `contracts/real/`):

    cd apps/extractor && ../../.venv/bin/python extract_floci.py --out /tmp/startup-extraction.json
    cd ../estate && ../../.venv/bin/python compare_startup.py /tmp/startup-extraction.json ../../contracts/mock/startup.infra.json
    ../../.venv/bin/python -m pytest -q test_compare_startup.py

The comparison keeps extractor components whose name contains `startup`, plus the orphan volume. The extractor
names that volume after its type and size (`vol-orphan-gp2-500gb`), so it is matched by kind, type and size. Other
components match by kind and name: `startup-<mock id>` first, then name similarity. It compares `quantity`, `zones` and `status`, and
`security.public_exposure`, `encryption_at_rest` and `backup_retention_days` only where the extractor emits the key.
An omitted value equals `null`. The run passes only with nothing missing, nothing mismatched and no extra
`startup` component.

Floci keeps terminated instances listed forever, and the extractor does not skip them yet. Instances from an
earlier build therefore show up as extra `startup-web-*` / `startup-old-bastion` components until the extractor
filters `terminated` instances or Floci is reset.

## Clinic-booking and fleet-telemetry estates (`projects/`)
Two more estates that mirror `contracts/mock/clinic-booking.infra.json` (prefix `clinic-`, one VPC per environment:
prod, staging, dev) and `contracts/mock/fleet-telemetry.infra.json` (prefix `fleet-`, prod and dev). Resource names
follow `<prefix>-<environment>-<component>`, which is how the extractor derives the stacks and their environments.

    cd apps/estate
    set -a; . ../../.env; set +a; export AWS_DEFAULT_REGION=us-east-1
    ../../.venv/bin/python -m projects build clinic-booking      # creates what is missing, reuses the rest
    ../../.venv/bin/python -m projects metrics clinic-booking    # 14 days of hourly CloudWatch points
    ../../.venv/bin/python -m projects teardown clinic-booking   # deletes every clinic- resource (ask before running it)

Same for `fleet-telemetry`. Each ECS task, RDS instance, cache node and EC2 instance is a Docker container in Floci:
clinic-booking adds 12 tasks, 3 databases, 1 cache, 1 instance; fleet-telemetry 6 tasks, 2 databases, 1 cache, 1
instance. `metrics` sends 10 points per call: Floci cannot read the gzip bodies boto3 sends above 10 KB.

Compare with the mock (the extractor scopes to the project's prefix when given its name):

    cd ../extractor && ../../.venv/bin/python extract_floci.py --project clinic-booking --out /tmp/clinic-extraction.json
    cd ../estate && ../../.venv/bin/python compare_startup.py /tmp/clinic-extraction.json ../../contracts/mock/clinic-booking.infra.json clinic

The third argument of `compare_startup.py` is the name prefix (default `startup`). ECS services are named
`<cluster>/<service>` (`clinic-prod/api`); the comparison reads `/` as `-`. Verified 2026-11-14: clinic-booking 14/14,
fleet-telemetry 13/13, startup still 10/10.

## Extractor (`apps/extractor/`)
Reads the live estate through API calls only and writes `contracts/real/floci-estate.infra.json` in the `contracts/infra.schema.json`
format. See `apps/extractor/README.md` for how it differs from the mock. It never reads `ground_truth/`.

## Configuration
Endpoint, region and credentials come from the repo-root `.env` (copy `.env.example`). The scripts are bash: on Windows, run them in Git Bash or WSL.

## Ground truth
`ground_truth/planted_issues.json` lists every planted flaw (stack, service, resource, issue, category,
severity). **Keep it out of the agent's reach**; use it only to score findings. Only resources that
were actually created get a ledger entry.

## floci limits
- EKS needs k8s >= 1.28, so "old" = 1.28/1.29. EC2 CreateSnapshot unsupported (no stale snapshots).
- EC2/ECS/EKS/RDS/ElastiCache are real Docker containers (~40 running). `floci aws reset` times out
  with them present, hence `reset.sh`.
- floci generates no CloudWatch metrics itself, so `synth/metrics.py` pushes synthetic ones: 14 days hourly
  backfill (270 series) + 1-minute live points. PutMetricData bodies over ~50 datapoints are rejected.

## Metrics (`synth/metrics.py`)
Namespaces: EC2, EBS, NATGateway, RDS, ElastiCache, DynamoDB, ApplicationELB, ECS, ContainerInsights (EKS),
SQS, Lambda, Kinesis, EFS, S3, Billing. Profiles encode the story behind the flaws (idle GPUs, 90% CPU
analytics DB, hot-partition throttling, growing SQS backlog, ~0 NAT/EBS traffic) plus one incident
3 days ago at 02:00 UTC (ALB 5xx burst, latency, RDS connection exhaustion). Series are not keyed to the ledger.

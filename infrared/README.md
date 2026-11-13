# InfraRed synthetic AWS estate (floci)

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
Builds `graph/graph.json` (nodes+edges), `graph/graph.dot` (Graphviz) and a self-contained `graph/graph.html`: an architecture diagram
rather than a force graph. One card per stack (the VPC is the card header with its CIDR); resources sit in fixed tiers (Edge & DNS, Compute,
Data stores, Messaging, Storage, Network & security, Identity). Idle / orphan / exposed resources carry text pills and the KPI tiles at the top
filter by them. Hover or click a resource to draw its dependencies (colour = kind) and open a detail panel with "Depends on" / "Used by";
"All links" draws the rest. Light and dark themes. Design rules live in `.claude/skills/estate-diagram/SKILL.md`.
Nodes come from live floci state; edges = `topology.json` + relationships read from the API (placement, roles, containment).
Stack, idle and orphan are derived from naming and observed metrics, not from the planted-issue ledger. `run.sh` regenerates it.

## Extractor (`contract/extract_floci.py`)
Reads the live estate through API calls only and writes `contract/real/floci-estate.infra.json` in the `contract/infra.schema.json`
format. See `contract/real/README.md` for how it differs from the mock. It never reads `ground_truth/`.

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

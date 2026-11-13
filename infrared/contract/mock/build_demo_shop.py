"""Authoring helper for demo-shop.infra.json.

Every number below is typed in by hand to describe a plausible, deliberately badly run estate.
Nothing is read from ground_truth/ or from Floci, so an engine tested on the output is not being
graded against the project's own answer key. Run: python3 build_demo_shop.py > demo-shop.infra.json
"""
import json
import sys

EU = "eu-west-1"
FX = 0.92  # EUR per USD used for the 'estimated' list-price costs


def eur(usd):
    return round(usd * FX)


def sm(value, unit=None, prov="observed", basis=None):
    d = {"value": value, "provenance": prov}
    if unit:
        d["unit"] = unit
    if basis:
        d["basis"] = basis
    return d


def ser(unit, prov, avg=None, p95=None, mx=None, mn=None, total=None, basis=None, days=14):
    d = {"unit": unit, "window_days": days, "resolution_seconds": 3600, "provenance": prov}
    for k, v in (("avg", avg), ("p95", p95), ("max", mx), ("min", mn), ("sum", total)):
        if v is not None:
            d[k] = v
    if basis:
        d["basis"] = basis
    return d


def comp(id, kind, provider, service, sku, qty, zones, status, stateful, stack, region=EU, **o):
    c = {"id": id, "kind": kind, "provider": provider, "service": service, "quantity": qty,
         "region": region, "zones": zones, "status": status, "stateful": stateful, "stack": stack}
    if sku:
        c["sku"] = sku
    for k in ("name", "parent", "scaling", "engine", "tags", "config"):
        if k in o:
            c[k] = o[k]
    if "features" in o:
        c["features_used"] = o["features"]
    if "data_gb" in o:
        c["data_gb"] = sm(o["data_gb"], "GB")
    if "classification" in o:
        c["data_classification"] = o["classification"]
    if "cap" in o:
        c["capacity"] = {k: sm(v[0], v[1]) for k, v in o["cap"].items()}
    if "usage" in o:
        c["usage"] = o["usage"]
    if "sec" in o:
        c["security"] = o["sec"]
    if "usd" in o:
        c["cost"] = {"monthly_eur": sm(eur(o["usd"]), "EUR/month", "estimated",
                                        o.get("basis", "list price (USD, on-demand, no discounts) x 730 h x 0.92 EUR/USD"))}
    return c


C = []

# ───────────────────────── stack: shop (production web shop, eu-west-1) ─────────────────────────
C.append(comp("eks-shop-main", "kubernetes_cluster", "aws", "eks", "k8s-1.28", 1, 2, "active", False, "shop",
              engine={"name": "kubernetes", "version": "1.28"}, usd=73,
              sec={"public_exposure": "internet", "encryption_at_rest": False, "encryption_in_transit": True},
              config={"endpoint_public": True, "control_plane_logging": False, "secrets_kms_encryption": False}))
C.append(comp("ng-shop-general", "node_group", "aws", "eks-managed-nodegroup", "m5.8xlarge", 12, 1, "active", False, "shop",
              parent="eks-shop-main",
              cap={"vcpu": (32, "count"), "memory_gb": (128, "GB"), "disk_gb": (500, "GB")},
              usage={"cpu_pct": ser("percent", "observed", avg=14, p95=31, mx=52, basis="CloudWatch ContainerInsights node_cpu_utilization"),
                     "memory_pct": ser("percent", "observed", avg=38, p95=51, mx=63)},
              scaling={"min": 12, "max": 12, "desired": 12, "autoscaling_enabled": False},
              usd=12 * 1.536 * 730, config={"capacity_type": "on_demand", "ami": "AL2"}))
C.append(comp("ng-shop-cpu", "node_group", "aws", "eks-managed-nodegroup", "c5.12xlarge", 6, 1, "active", False, "shop",
              parent="eks-shop-main",
              cap={"vcpu": (48, "count"), "memory_gb": (96, "GB"), "disk_gb": (500, "GB")},
              usage={"cpu_pct": ser("percent", "observed", avg=11, p95=24, mx=40),
                     "memory_pct": ser("percent", "observed", avg=22, p95=30, mx=41)},
              scaling={"min": 6, "max": 6, "desired": 6, "autoscaling_enabled": False},
              usd=6 * 2.04 * 730, config={"capacity_type": "on_demand", "ami": "AL2"}))
C.append(comp("eks-shop-staging", "kubernetes_cluster", "aws", "eks", "k8s-1.28", 1, 2, "active", False, "shop",
              engine={"name": "kubernetes", "version": "1.28"}, usd=73, tags={"env": "staging"},
              sec={"public_exposure": "internet", "encryption_at_rest": False},
              config={"endpoint_public": True, "control_plane_logging": False}))
C.append(comp("ng-shop-staging", "node_group", "aws", "eks-managed-nodegroup", "m5.8xlarge", 12, 1, "active", False, "shop",
              parent="eks-shop-staging", tags={"env": "staging"},
              cap={"vcpu": (32, "count"), "memory_gb": (128, "GB"), "disk_gb": (500, "GB")},
              usage={"cpu_pct": ser("percent", "observed", avg=2, p95=6, mx=14),
                     "memory_pct": ser("percent", "observed", avg=9, p95=13, mx=19)},
              scaling={"min": 12, "max": 12, "desired": 12, "autoscaling_enabled": False},
              usd=12 * 1.536 * 730, config={"capacity_type": "on_demand", "ami": "AL2"}))

C.append(comp("rds-orders", "postgres", "aws", "rds", "db.r5.8xlarge", 1, 1, "active", True, "shop",
              engine={"name": "postgres", "version": "11.22"}, data_gb=1450, classification="pii",
              features=["pg_trgm", "uuid-ossp", "logical_replication"],
              cap={"vcpu": (32, "count"), "memory_gb": (256, "GB"), "storage_gb": (2000, "GB"), "provisioned_iops": (6000, "iops")},
              usage={"cpu_pct": ser("percent", "observed", avg=8, p95=22, mx=41, basis="CloudWatch AWS/RDS CPUUtilization"),
                     "connections": ser("count", "observed", avg=120, p95=210, mx=480),
                     "read_iops": ser("iops", "observed", avg=800, p95=2100, mx=3900),
                     "write_iops": ser("iops", "observed", avg=320, p95=900, mx=1700)},
              sec={"public_exposure": "internet", "encryption_at_rest": False, "encryption_in_transit": False,
                   "backup_retention_days": 0, "deletion_protection": False},
              usd=4.032 * 730 + 2000 * 0.115, tags={"app": "orders"}))
C.append(comp("rds-orders-clone", "postgres", "aws", "rds", "db.r5.8xlarge", 1, 1, "orphan", True, "shop",
              engine={"name": "postgres", "version": "11.22"}, data_gb=1450, classification="pii",
              features=["pg_trgm", "uuid-ossp"],
              cap={"vcpu": (32, "count"), "memory_gb": (256, "GB"), "storage_gb": (2000, "GB")},
              usage={"cpu_pct": ser("percent", "observed", avg=0.8, p95=1.6, mx=7),
                     "connections": ser("count", "observed", avg=0.4, p95=1, mx=3)},
              sec={"public_exposure": "internet", "encryption_at_rest": False, "backup_retention_days": 0, "deletion_protection": False},
              usd=4.032 * 730 + 2000 * 0.115, tags={"purpose": "migration-test"}))
C.append(comp("rds-analytics", "postgres", "aws", "rds", "db.m5.4xlarge", 1, 1, "active", True, "shop",
              engine={"name": "postgres", "version": "12.18"}, data_gb=640, classification="confidential",
              features=["postgis", "pg_partman", "logical_replication"],
              cap={"vcpu": (16, "count"), "memory_gb": (64, "GB"), "storage_gb": (1000, "GB")},
              usage={"cpu_pct": ser("percent", "observed", avg=88, p95=97, mx=100),
                     "connections": ser("count", "observed", avg=55, p95=60, mx=64),
                     "read_iops": ser("iops", "observed", avg=3900, p95=5200, mx=6000)},
              sec={"public_exposure": "internet", "encryption_at_rest": False, "backup_retention_days": 1, "deletion_protection": False},
              usd=1.46 * 730 + 1000 * 0.115))
C.append(comp("cache-sessions", "cache", "aws", "elasticache-redis", "cache.r5.4xlarge", 1, 1, "active", True, "shop",
              engine={"name": "redis", "version": "6.2"}, data_gb=2,
              cap={"vcpu": (16, "count"), "memory_gb": (105, "GB")},
              usage={"cpu_pct": ser("percent", "observed", avg=2.5, p95=6, mx=12),
                     "memory_pct": ser("percent", "observed", avg=2.0, p95=3.1, mx=3.4),
                     "connections": ser("count", "observed", avg=45, p95=80, mx=120),
                     "hit_rate_pct": ser("percent", "observed", avg=62)},
              sec={"public_exposure": "vpc_only", "encryption_at_rest": False, "encryption_in_transit": False, "backup_retention_days": 0},
              usd=1.97 * 730))
C.append(comp("alb-shop", "load_balancer", "aws", "alb", "application", 1, 2, "active", False, "shop",
              usage={"requests": ser("count", "observed", total=9_800_000, basis="CloudWatch AWS/ApplicationELB RequestCount, Sum over window"),
                     "latency_ms": ser("ms", "observed", avg=450, p95=1900)},
              sec={"public_exposure": "internet", "encryption_in_transit": False},
              usd=22 + 40, config={"listeners": ["HTTP:80"], "health_check_interval_s": 300, "idle_timeout_s": 4000}))
C.append(comp("vmfleet-web", "virtual_machine", "aws", "ec2-asg", "m5.8xlarge", 8, 1, "active", False, "shop",
              cap={"vcpu": (32, "count"), "memory_gb": (128, "GB"), "disk_gb": (500, "GB")},
              usage={"cpu_pct": ser("percent", "observed", avg=6, p95=14, mx=33),
                     "network_out_gb": ser("gb", "observed", avg=1.4, p95=3.2)},
              scaling={"min": 8, "max": 8, "desired": 8, "autoscaling_enabled": False},
              sec={"public_exposure": "internet", "world_open_ports": [-1], "encryption_at_rest": False},
              usd=8 * 1.536 * 730 + 8 * 500 * 0.10))
C.append(comp("vm-bastion", "virtual_machine", "aws", "ec2", "m5.4xlarge", 1, 1, "idle", False, "shop",
              cap={"vcpu": (16, "count"), "memory_gb": (64, "GB"), "disk_gb": (500, "GB")},
              usage={"cpu_pct": ser("percent", "observed", avg=0.6, p95=1.2, mx=9)},
              sec={"public_exposure": "internet", "world_open_ports": [22, 3389], "encryption_at_rest": False, "admin_privileges": False},
              usd=0.768 * 730 + 500 * 0.10))
C.append(comp("vm-batch", "virtual_machine", "aws", "ec2", "c5.9xlarge", 1, 1, "active", False, "shop",
              cap={"vcpu": (36, "count"), "memory_gb": (72, "GB"), "disk_gb": (500, "GB")},
              usage={"cpu_pct": ser("percent", "observed", avg=1.5, p95=3, mx=62, basis="spikes nightly ~02:00 for ~10 minutes")},
              sec={"public_exposure": "vpc_only", "world_open_ports": [-1], "encryption_at_rest": False},
              usd=1.53 * 730 + 500 * 0.10))
C.append(comp("s3-uploads", "object_storage", "aws", "s3", "standard", 1, 3, "active", True, "shop",
              data_gb=800, classification="confidential",
              cap={"object_count": (3_100_000, "count")},
              usage={"requests": ser("count", "observed", total=2_400_000)},
              sec={"public_exposure": "internet", "encryption_at_rest": False, "backup_retention_days": 0},
              usd=800 * 0.023 + 40, config={"anonymous_put_allowed": True, "lifecycle_rules": 0, "versioning": False}))
C.append(comp("s3-backups", "object_storage", "aws", "s3", "standard", 1, 3, "active", True, "shop",
              data_gb=9000, classification="pii",
              cap={"object_count": (4200, "count")},
              usage={"requests": ser("count", "observed", total=3000)},
              sec={"public_exposure": "none", "encryption_at_rest": False},
              usd=9000 * 0.023, config={"lifecycle_rules": 0, "versioning": False, "oldest_object_age_days": 1900}))
C.append(comp("ddb-orders", "nosql", "aws", "dynamodb", "provisioned", 1, 3, "active", True, "shop",
              data_gb=410, classification="confidential",
              cap={"provisioned_rcu": (8000, "rcu"), "provisioned_wcu": (4000, "wcu")},
              usage={"consumed_rcu": ser("per_second", "observed", avg=220, p95=640, mx=1500),
                     "consumed_wcu": ser("per_second", "observed", avg=90, p95=260, mx=700),
                     "throttled_requests": ser("per_hour", "observed", avg=140, p95=600, mx=2100, basis="ReadThrottleEvents+WriteThrottleEvents")},
              sec={"public_exposure": "none", "encryption_at_rest": True, "backup_retention_days": 0, "deletion_protection": False},
              usd=((8000 * 0.00013 + 4000 * 0.00065) * 730) * 3 + 410 * 0.25 * 3,
              basis="table + 2 GSIs at identical provisioning, USD list prices x 0.92",
              config={"partition_key": "status", "gsi_count": 2, "gsi_projection": "ALL", "autoscaling": False, "ttl_enabled": False}))
C.append(comp("q-orders", "queue", "aws", "sqs", "standard", 1, 3, "active", True, "shop",
              usage={"messages_sent": ser("messages", "observed", total=806_000),
                     "messages_received": ser("messages", "observed", total=1_040_000),
                     "empty_receives": ser("count", "observed", total=30_200_000)},
              sec={"public_exposure": "none", "encryption_at_rest": False},
              usd=14, config={"visibility_timeout_s": 0, "receive_wait_s": 0, "dlq": False, "retention_days": 14}))
C.append(comp("fn-resize", "function", "aws", "lambda", "python3.8/3008MB", 1, 1, "active", False, "shop",
              engine={"name": "python", "version": "3.8"},
              cap={"memory_gb": (3, "GB"), "timeout_s": (900, "s")},
              usage={"invocations": ser("count", "observed", total=302_400),
                     "duration_ms": ser("ms", "observed", avg=420, p95=900, mx=4800),
                     "concurrency": ser("count", "observed", avg=1.5, p95=6, mx=18)},
              sec={"public_exposure": "vpc_only", "plaintext_secrets_suspected": True, "admin_privileges": True},
              usd=15, config={"vpc_attached": True, "subnets": 1, "dlq": False, "reserved_concurrency": None}))

# ───────────────────────── stack: data (data platform, eu-west-1) ─────────────────────────
S = "synthetic"
C.append(comp("eks-data", "kubernetes_cluster", "aws", "eks", "k8s-1.29", 1, 1, "active", False, "data",
              engine={"name": "kubernetes", "version": "1.29"}, usd=73,
              sec={"public_exposure": "internet", "encryption_at_rest": False},
              config={"endpoint_public": True, "control_plane_logging": False}))
C.append(comp("ng-data-spark", "node_group", "aws", "eks-managed-nodegroup", "r5.16xlarge", 10, 1, "active", False, "data",
              parent="eks-data",
              cap={"vcpu": (64, "count"), "memory_gb": (512, "GB"), "disk_gb": (1000, "GB")},
              usage={"cpu_pct": ser("percent", S, avg=22, p95=61, mx=88),
                     "memory_pct": ser("percent", S, avg=35, p95=58, mx=79)},
              scaling={"min": 10, "max": 10, "desired": 10, "autoscaling_enabled": False},
              usd=10 * 4.032 * 730, config={"capacity_type": "on_demand", "ami": "AL2"}))
C.append(comp("ng-data-gpu", "node_group", "aws", "eks-managed-nodegroup", "p3.8xlarge", 4, 1, "active", False, "data",
              parent="eks-data",
              cap={"vcpu": (32, "count"), "memory_gb": (244, "GB"), "gpus": (4, "count"), "disk_gb": (500, "GB")},
              usage={"gpu_pct": ser("percent", S, avg=0.4, p95=1.0, mx=71, basis="3 training bursts of ~3 h in 14 days"),
                     "cpu_pct": ser("percent", S, avg=1.2, p95=2.5, mx=48)},
              scaling={"min": 4, "max": 4, "desired": 4, "autoscaling_enabled": False},
              usd=4 * 12.24 * 730, config={"capacity_type": "on_demand", "ami": "AL2"}))
C.append(comp("pg-lake", "postgres", "aws", "aurora-postgresql", "db.r5.4xlarge", 2, 1, "active", True, "data",
              engine={"name": "aurora-postgresql", "version": "11.21"}, data_gb=520, classification="internal",
              features=["pgvector", "pg_partman", "pg_trgm"],
              cap={"vcpu": (16, "count"), "memory_gb": (128, "GB"), "storage_gb": (520, "GB")},
              usage={"cpu_pct": ser("percent", S, avg=3, p95=9, mx=22),
                     "connections": ser("count", S, avg=14, p95=19, mx=31)},
              sec={"public_exposure": "internet", "encryption_at_rest": False, "backup_retention_days": 1, "deletion_protection": False},
              usd=2 * 1.16 * 730 + 520 * 0.10 + 300))
C.append(comp("stream-clicks", "stream", "aws", "kinesis", "provisioned", 1, 3, "active", False, "data",
              cap={"shards": (50, "count")},
              usage={"incoming_bytes_per_s": ser("bytes", S, avg=100_000, p95=400_000, mx=1_200_000),
                     "write_throttled": ser("count", S, avg=0, mx=0)},
              sec={"public_exposure": "none", "encryption_at_rest": False},
              usd=50 * 0.015 * 730 + 25))
C.append(comp("s3-lake", "object_storage", "aws", "s3", "standard", 1, 3, "active", True, "data",
              data_gb=48000, classification="internal",
              cap={"object_count": (190_000_000, "count")},
              usage={"requests": ser("count", S, total=96_000_000)},
              sec={"public_exposure": "none", "encryption_at_rest": False},
              usd=48000 * 0.023 + 150, config={"lifecycle_rules": 0, "avg_object_size_kb": 252, "key_layout": "flat"}))

# ───────────────────────── stack: legacy (old ERP + ECS, partly outside the EU) ─────────────────────────
for sid, tasks, vcpu, gb, cpu, mem, usd_each in (
        ("svc-orders-api", 8, 4, 16, (4, 11, 29), (9, 14, 22), 0.2332),
        ("svc-invoice-worker", 5, 4, 30, (2, 5, 17), (6, 9, 15), 0.2953),
        ("svc-admin-portal", 4, 2, 8, (1, 3, 8), (5, 7, 11), 0.1166),
        ("svc-report-gen", 3, 4, 16, (1.5, 4, 55), (4, 6, 38), 0.2332)):
    C.append(comp(sid, "container", "aws", "ecs-fargate", f"{vcpu}vcpu/{gb}GB", tasks, 1, "active", False, "legacy",
                  cap={"vcpu": (vcpu, "count"), "memory_gb": (gb, "GB")},
                  usage={"cpu_pct": ser("percent", "observed", avg=cpu[0], p95=cpu[1], mx=cpu[2]),
                         "memory_pct": ser("percent", "observed", avg=mem[0], p95=mem[1], mx=mem[2])},
                  scaling={"min": tasks, "max": tasks, "desired": tasks, "autoscaling_enabled": False},
                  sec={"public_exposure": "internet", "plaintext_secrets_suspected": True, "admin_privileges": True},
                  usd=usd_each * 730 * tasks, config={"image_tag": "latest", "runs_as_root": True, "container_insights": False}))
C.append(comp("alb-legacy", "load_balancer", "aws", "alb", "application", 1, 2, "active", False, "legacy",
              usage={"requests": ser("count", "observed", total=1_300_000)},
              sec={"public_exposure": "internet", "encryption_in_transit": False}, usd=22 + 8,
              config={"listeners": ["HTTP:80"], "health_check_interval_s": 300}))
C.append(comp("rds-erp", "postgres", "aws", "rds", "db.r4.4xlarge", 1, 1, "active", True, "legacy",
              engine={"name": "postgres", "version": "11.22"}, data_gb=310, classification="confidential",
              features=["hstore", "pg_trgm"],
              cap={"vcpu": (16, "count"), "memory_gb": (122, "GB"), "storage_gb": (500, "GB")},
              usage={"cpu_pct": ser("percent", "observed", avg=4, p95=10, mx=24),
                     "connections": ser("count", "observed", avg=15, p95=24, mx=40)},
              sec={"public_exposure": "internet", "encryption_at_rest": False, "backup_retention_days": 0, "deletion_protection": False},
              usd=1.92 * 730 + 500 * 0.115))
C.append(comp("cache-legacy-mc", "cache", "aws", "elasticache-memcached", "cache.m4.2xlarge", 4, 1, "idle", False, "legacy",
              engine={"name": "memcached", "version": "1.6"},
              cap={"vcpu": (8, "count"), "memory_gb": (30, "GB")},
              usage={"cpu_pct": ser("percent", "observed", avg=0.1, p95=0.2, mx=0.6),
                     "connections": ser("count", "observed", avg=0, mx=1),
                     "hit_rate_pct": ser("percent", "observed", avg=0)},
              sec={"public_exposure": "vpc_only", "encryption_at_rest": False},
              usd=4 * 0.56 * 730))
C.append(comp("efs-legacy", "file_system", "aws", "efs", "provisioned-throughput", 1, 3, "idle", True, "legacy",
              data_gb=38, cap={"throughput_mibps": (512, "MiB/s")},
              usage={"throughput_utilization_pct": ser("percent", "observed", avg=0.4, p95=1.1, mx=6)},
              sec={"public_exposure": "vpc_only", "encryption_at_rest": False, "backup_retention_days": 0},
              usd=512 * 6.0 + 38 * 0.30))
C.append(comp("fn-cron", "function", "aws", "lambda", "python3.7/2048MB", 1, 1, "active", False, "legacy",
              engine={"name": "python", "version": "3.7"},
              cap={"memory_gb": (2, "GB"), "timeout_s": (900, "s")},
              usage={"invocations": ser("count", "observed", total=20_160),
                     "duration_ms": ser("ms", "observed", avg=1100, p95=2300, mx=9000)},
              sec={"public_exposure": "none", "plaintext_secrets_suspected": True, "admin_privileges": True}, usd=2,
              config={"schedule": "rate(1 minute)"}))
C.append(comp("s3-legacy-reports", "object_storage", "aws", "s3", "standard", 1, 3, "active", True, "legacy",
              region="us-east-1", data_gb=25, classification="pii",
              cap={"object_count": (900, "count")},
              sec={"public_exposure": "internet", "encryption_at_rest": False}, usd=2))
C.append(comp("q-legacy-jobs", "queue", "aws", "sqs", "standard", 1, 3, "active", True, "legacy",
              usage={"messages_sent": ser("messages", "observed", total=1_700),
                     "messages_received": ser("messages", "observed", total=0),
                     "messages_visible": ser("messages", "observed", avg=840, mx=1721)},
              sec={"public_exposure": "none", "encryption_at_rest": False}, usd=1,
              config={"consumers_detected": 0, "dlq": False}))

# ───────────────────────── stack: dev (forgotten sandbox) ─────────────────────────
C.append(comp("nat-dev", "nat", "aws", "nat-gateway", "per-az", 3, 3, "idle", False, "dev",
              usage={"network_out_gb": ser("gb", "observed", avg=0.02, total=0.4, mx=0.05)},
              usd=3 * (0.045 * 730 + 0.1)))
C.append(comp("vm-dev-jump", "virtual_machine", "aws", "ec2", "r5.2xlarge", 2, 1, "idle", False, "dev",
              cap={"vcpu": (8, "count"), "memory_gb": (64, "GB"), "disk_gb": (500, "GB")},
              usage={"cpu_pct": ser("percent", "observed", avg=1.0, p95=3.2, mx=8)},
              sec={"public_exposure": "internet", "world_open_ports": [22], "encryption_at_rest": False},
              usd=2 * (0.504 * 730 + 500 * 0.10)))
C.append(comp("ebs-orphans", "block_storage", "aws", "ebs", "gp2", 6, 1, "orphan", True, "dev",
              cap={"storage_gb": (1000, "GB")},
              usage={"read_iops": ser("iops", "observed", avg=0, mx=0), "write_iops": ser("iops", "observed", avg=0, mx=0)},
              sec={"encryption_at_rest": False}, usd=6 * 1000 * 0.10,
              config={"attached": False, "size_gb_each": 1000}))

# ───────────────────────── edges ─────────────────────────
E = []


def e(src, dst, kind, evidence, gb=None, gb_prov="estimated", note=None, lat=None):
    d = {"id": f"e{len(E) + 1:02d}", "from": src, "to": dst, "kind": kind, "evidence": evidence}
    if gb is not None:
        d["gb_month"] = sm(gb, "GB", gb_prov,
                           "ALB ProcessedBytes x 30/14" if gb_prov == "estimated" else "invented for the mock")
    if lat is not None:
        d["latency_sensitive"] = lat
    if note:
        d["note"] = note
    E.append(d)


e("alb-shop", "vmfleet-web", "traffic", "declared", 1800, lat=True, note="ASG attached to ALB target group")
e("vmfleet-web", "rds-orders", "data", "declared", 380, lat=True, note="DB host in launch template user-data")
e("vmfleet-web", "cache-sessions", "data", "declared", 220, lat=True)
e("vmfleet-web", "ddb-orders", "data", "declared", 150, lat=True)
e("vmfleet-web", "q-orders", "event", "declared", 12)
e("eks-shop-main", "rds-orders", "data", "inferred", 410, "synthetic", lat=True, note="pods use the orders DB; inferred from SG rules")
e("eks-shop-main", "ddb-orders", "data", "inferred", 160, "synthetic")
e("eks-shop-main", "q-orders", "event", "inferred", 20, "synthetic")
e("eks-shop-staging", "rds-orders", "data", "declared", 30, "synthetic", note="staging connects to the PRODUCTION database (config env var)")
e("s3-uploads", "fn-resize", "event", "declared", 40, note="S3 ObjectCreated notification")
e("fn-resize", "rds-orders", "data", "declared", 5)
e("rds-orders", "rds-analytics", "data", "declared", 600, "synthetic", note="logical replication feeds analytics")
e("vm-batch", "rds-orders", "data", "declared", 40)
e("vm-batch", "s3-backups", "data", "declared", 500, note="nightly dump upload")
e("vm-bastion", "rds-orders", "network", "declared", 0.1, "synthetic")
e("eks-data", "pg-lake", "data", "declared", 900, "synthetic", lat=True)
e("eks-data", "s3-lake", "data", "declared", 6000, "synthetic")
e("stream-clicks", "s3-lake", "data", "declared", 3000, "synthetic", note="delivery stream, small buffer")
e("rds-analytics", "pg-lake", "data", "declared", 250, "synthetic", note="cross-stack nightly export")
e("eks-data", "ddb-orders", "data", "inferred", 80, "synthetic", note="reads orders for feature building")
e("alb-legacy", "svc-orders-api", "traffic", "declared", 300, lat=True)
e("svc-orders-api", "rds-erp", "data", "declared", 120, lat=True)
e("svc-invoice-worker", "rds-erp", "data", "declared", 80, lat=True)
e("svc-invoice-worker", "q-legacy-jobs", "event", "declared", 2)
e("svc-admin-portal", "rds-erp", "data", "declared", 10)
e("svc-report-gen", "rds-erp", "data", "declared", 45)
e("svc-report-gen", "s3-legacy-reports", "data", "declared", 15)
e("svc-orders-api", "cache-legacy-mc", "config", "declared", 0, note="cache endpoint configured, never connected")
e("fn-cron", "rds-erp", "data", "declared", 30)
e("nat-dev", "vm-dev-jump", "network", "declared", 0.4, "synthetic")

# ───────────────────────── document ─────────────────────────
DOC = {
    "schema_version": "1.0",
    "project": "demo-shop",
    "source": {"extractor": "hand-written-mock", "extractor_version": "0", "generated_at": "2026-11-13T18:00:00Z",
               "endpoint": None, "regions_scanned": [EU, "us-east-1"], "is_mock": True,
               "notes": "Hand-written. Mixes observed/estimated/synthetic provenance on purpose. Regions are set by hand (Floci is us-east-1 only) so EU-residency rules have something to bite on."},
    "stacks": [
        {"id": "shop", "name": "Web shop", "environment": "prod", "description": "Storefront, orders DB, queues; also hosts the staging cluster."},
        {"id": "data", "name": "Data platform", "environment": "prod", "description": "Spark/ML on Kubernetes, lake and clickstream."},
        {"id": "legacy", "name": "Legacy ERP", "environment": "prod", "description": "Old ECS services and ERP database."},
        {"id": "dev", "name": "Dev sandbox", "environment": "dev", "description": "Forgotten test infrastructure."}],
    "controls": {"audit_logging_enabled": False, "threat_detection_enabled": False, "config_recording_enabled": False,
                 "backup_plans_exist": False, "vpc_flow_logs_enabled": False, "mfa_enforced": False},
    "components": C,
    "edges": E,
    "stay_together": [
        {"id": "orders-core", "members": ["rds-orders", "vmfleet-web", "cache-sessions"], "scope": "region",
         "reason": "Latency-bound request path; every web request touches DB and cache."},
        {"id": "orders-replication", "members": ["rds-orders", "rds-analytics"], "scope": "provider",
         "reason": "Logical replication; split providers means cross-provider replication and egress."},
        {"id": "erp-core", "members": ["svc-orders-api", "svc-invoice-worker", "rds-erp"], "scope": "region",
         "reason": "Chatty ERP transactions."}],
}

if __name__ == "__main__":
    json.dump(DOC, sys.stdout, indent=2, ensure_ascii=False)
    sys.stdout.write("\n")

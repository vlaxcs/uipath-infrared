#!/usr/bin/env python3
import json
import sys

from build_startup import comp, ser, sm

EU = "eu-west-1"

C = []

C.append(comp("prod-ingest-stream", "stream", "aws", "kinesis", "provisioned", 1, None, "active", True, "prod", region=EU,
              name="fleet-prod-ingest-stream", data_gb=310, classification="pii",
              cap={"shards": (24, "count")},
              usage={"incoming_bytes_per_s": ser("bytes_per_s", "observed", avg=180_000, p95=410_000, mx=690_000),
                     "incoming_records": ser("count", "observed", total=1_090_000_000)},
              sec={"encryption_at_rest": False},
              usd=24 * 0.015 * 730 + 38, config={"mode": "PROVISIONED", "retention_hours": 168}))

C.append(comp("prod-ingest", "function", "aws", "lambda", "python3.12/256MB", 1, None, "active", False, "prod", region=EU,
              name="fleet-prod-ingest", engine={"name": "python", "version": "3.12"},
              cap={"memory_gb": (0.25, "GB"), "timeout_s": (30, "s")},
              usage={"invocations": ser("count", "observed", total=9_600_000),
                     "duration_ms": ser("ms", "observed", avg=95, p95=240, mx=1800),
                     "concurrency": ser("count", "observed", avg=24, p95=48, mx=96)},
              sec={"public_exposure": "unknown", "plaintext_secrets_suspected": False, "admin_privileges": True},
              usd=95, config={"vpc_attached": False, "dlq": False}))

C.append(comp("prod-positions", "nosql", "aws", "dynamodb", "provisioned", 1, None, "active", True, "prod", region=EU,
              name="fleet-prod-positions", data_gb=900, classification="pii",
              cap={"provisioned_rcu": (3000, "count"), "provisioned_wcu": (5000, "count")},
              usage={"consumed_rcu": ser("count", "observed", avg=410, p95=980, mx=1600),
                     "consumed_wcu": ser("count", "observed", avg=860, p95=1900, mx=2700)},
              sec={"public_exposure": "none", "encryption_at_rest": True, "backup_retention_days": 0, "deletion_protection": False},
              usd=(3000 * 0.00013 + 5000 * 0.00065) * 730 * 2 + 900 * 0.25,
              config={"partition_key": "vehicle_id", "billing_mode": "provisioned", "gsi_count": 1, "gsi_projection_all": 1,
                      "ttl_enabled": False, "pitr_enabled": False}))

C.append(comp("prod-accounts-db", "postgres", "aws", "rds", "db.r5.xlarge", 1, 1, "active", True, "prod", region=EU,
              name="fleet-prod-accounts-db", engine={"name": "postgres", "version": "14.11"}, data_gb=60, classification="pii",
              features=["postgis"],
              cap={"vcpu": (4, "count"), "memory_gb": (32, "GB"), "storage_gb": (200, "GB")},
              usage={"cpu_pct": ser("percent", "observed", avg=21, p95=47, mx=70),
                     "connections": ser("count", "observed", avg=54, p95=96, mx=130),
                     "read_iops": ser("iops", "observed", avg=380, p95=900, mx=1500),
                     "write_iops": ser("iops", "observed", avg=120, p95=300, mx=520)},
              sec={"public_exposure": "vpc_only", "encryption_at_rest": True, "encryption_in_transit": True,
                   "backup_retention_days": 7, "deletion_protection": True},
              usd=0.50 * 730 + 200 * 0.115))

C.append(comp("prod-dashboard-api", "container", "aws", "ecs-fargate", "2vcpu/4GB", 6, 1, "active", False, "prod", region=EU,
              name="fleet-prod/dashboard-api", scaling={"desired": 6},
              cap={"vcpu": (2, "count"), "memory_gb": (4, "GB")},
              usage={"cpu_pct": ser("percent", "observed", avg=27, p95=58, mx=79),
                     "memory_pct": ser("percent", "observed", avg=48, p95=61, mx=70)},
              sec={"public_exposure": "internet", "plaintext_secrets_suspected": True},
              usd=(0.04048 * 2 + 0.004445 * 4) * 730 * 6))

C.append(comp("prod-alb", "load_balancer", "aws", "elbv2", "application", 1, 2, "active", False, "prod", region=EU,
              name="fleet-prod-alb",
              usage={"requests": ser("count", "observed", total=38_000_000)},
              sec={"public_exposure": "internet"},
              usd=0.0225 * 730 + 14))

C.append(comp("prod-geofence", "cache", "aws", "elasticache-redis", "cache.r5.large", 1, 1, "active", True, "prod", region=EU,
              name="fleet-prod-geofence", engine={"name": "redis", "version": "7.1"}, data_gb=3.5,
              cap={"vcpu": (2, "count"), "memory_gb": (13, "GB")},
              usage={"cpu_pct": ser("percent", "observed", avg=34, p95=66, mx=88),
                     "connections": ser("count", "observed", avg=40, p95=72, mx=96),
                     "hit_rate_pct": ser("percent", "observed", avg=97)},
              sec={"public_exposure": "vpc_only", "encryption_at_rest": False, "backup_retention_days": 0},
              usd=0.216 * 730))

C.append(comp("prod-alerts", "queue", "aws", "sqs", "standard", 1, None, "active", True, "prod", region=EU,
              name="fleet-prod-alerts",
              usage={"messages_sent": ser("messages", "observed", total=520_000),
                     "messages_received": ser("messages", "observed", total=515_000)},
              sec={"public_exposure": "none", "encryption_at_rest": False},
              usd=2, config={"visibility_timeout_s": 30, "receive_wait_s": 0, "dlq": False, "retention_days": 4}))

C.append(comp("prod-archive", "object_storage", "aws", "s3", "standard", 1, None, "active", True, "prod", region=EU,
              name="fleet-prod-archive", data_gb=2400, classification="pii",
              cap={"object_count": (41_000_000, "count")},
              usage={"requests": ser("count", "observed", total=7_400_000)},
              sec={"public_exposure": "none", "encryption_at_rest": True},
              usd=2400 * 0.023 + 5, config={"versioning": False, "lifecycle_rules": 0}))

C.append(comp("prod-nat", "nat", "aws", "nat-gateway", "per-az", 1, 1, "active", False, "prod", region=EU,
              name="1 NAT gateway(s) in fleet-prod-vpc",
              usage={"network_out_gb": ser("gb", "observed", avg=1.3, total=420, mx=3.8)},
              usd=0.048 * 730 + 420 * 0.048))

C.append(comp("dev-ingest-stream", "stream", "aws", "kinesis", "provisioned", 1, None, "active", True, "dev", region=EU,
              name="fleet-dev-ingest-stream",
              cap={"shards": (8, "count")},
              usage={"incoming_bytes_per_s": ser("bytes_per_s", "observed", avg=40, p95=0, mx=52_000),
                     "incoming_records": ser("count", "observed", total=11_000)},
              sec={"encryption_at_rest": False},
              usd=8 * 0.015 * 730, config={"mode": "PROVISIONED", "retention_hours": 24}))

C.append(comp("dev-replay", "virtual_machine", "aws", "ec2", "c5.2xlarge", 1, 1, "idle", False, "dev", region=EU,
              name="fleet-dev-replay",
              cap={"vcpu": (8, "count"), "memory_gb": (16, "GB"), "disk_gb": (50, "GB")},
              usage={"cpu_pct": ser("percent", "observed", avg=0.9, p95=2, mx=64)},
              sec={"public_exposure": "internet", "world_open_ports": [22], "encryption_at_rest": None},
              usd=0.34 * 730 + 50 * 0.10, config={"role": "replays recorded GPS traces into the dev stream"}))

C.append(comp("dev-db", "postgres", "aws", "rds", "db.t3.large", 1, 1, "active", True, "dev", region=EU,
              name="fleet-dev-db", engine={"name": "postgres", "version": "14.11"}, data_gb=55, classification="pii",
              features=["postgis"],
              cap={"vcpu": (2, "count"), "memory_gb": (8, "GB"), "storage_gb": (50, "GB")},
              usage={"cpu_pct": ser("percent", "observed", avg=5, p95=21, mx=60),
                     "connections": ser("count", "observed", avg=4, p95=11, mx=18)},
              sec={"public_exposure": "internet", "encryption_at_rest": False, "encryption_in_transit": False,
                   "backup_retention_days": 0, "deletion_protection": False},
              usd=0.145 * 730 + 50 * 0.115, tags={"restored_from": "fleet-prod-accounts-db snapshot, 2026-03"}))

E = []


def e(src, dst, kind, evidence, gb=None, note=None, lat=None):
    d = {"id": f"e{len(E) + 1:02d}", "from": src, "to": dst, "kind": kind, "evidence": evidence}
    if gb is not None:
        d["gb_month"] = sm(gb, "GB", "estimated")
    if lat is not None:
        d["latency_sensitive"] = lat
    if note:
        d["note"] = note
    E.append(d)


e("prod-ingest-stream", "prod-ingest", "event", "declared", 460, note="Event source mapping, batch 500")
e("prod-ingest", "prod-positions", "data", "declared", 380, lat=True, note="Latest position per vehicle")
e("prod-ingest", "prod-geofence", "data", "declared", 25, lat=True, note="Geofence lookup per point")
e("prod-ingest", "prod-alerts", "event", "declared", 1, note="Late delivery and geofence alerts")
e("prod-ingest", "prod-archive", "data", "declared", 290, note="Raw points, one object per vehicle-minute")
e("prod-alb", "prod-dashboard-api", "traffic", "declared", 140, lat=True, note="Target group -> ECS service")
e("prod-dashboard-api", "prod-positions", "data", "declared", 120, lat=True, note="Live map")
e("prod-dashboard-api", "prod-accounts-db", "data", "declared", 30, lat=True, note="Customers, vehicles, routes")
e("prod-dashboard-api", "prod-alerts", "event", "declared", 1)
e("prod-dashboard-api", "prod-nat", "network", "inferred", 420, note="Map tiles and routing provider")
e("dev-replay", "dev-ingest-stream", "event", "declared", 0.1)
e("dev-replay", "dev-db", "data", "declared", 0.1)

DOC = {
    "schema_version": "1.0",
    "project": "fleet-telemetry",
    "source": {"extractor": "hand-written-mock", "extractor_version": "0", "generated_at": "2026-11-14T10:00:00Z",
               "endpoint": None, "regions_scanned": [EU], "is_mock": True,
               "notes": "Event-driven GPS telemetry mock with prod and dev, no staging. Over-provisioned stream and table ahead of a large customer onboarding."},
    "stacks": [
        {"id": "prod", "name": "Production", "environment": "prod", "description": "Ingest pipeline, live map API, accounts."},
        {"id": "dev", "name": "Development", "environment": "dev", "description": "Dev stream, trace replay box and a dev database."}],
    "controls": {"audit_logging_enabled": True, "threat_detection_enabled": True, "config_recording_enabled": False,
                 "backup_plans_exist": False, "vpc_flow_logs_enabled": False, "mfa_enforced": False},
    "components": C,
    "edges": E,
    "stay_together": [
        {"id": "ingest-path", "members": ["prod-ingest-stream", "prod-ingest", "prod-positions", "prod-geofence"], "scope": "region",
         "reason": "A position must reach the live map within two seconds."}],
}

if __name__ == "__main__":
    json.dump(DOC, sys.stdout, indent=2, ensure_ascii=False)
    sys.stdout.write("\n")

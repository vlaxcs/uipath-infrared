#!/usr/bin/env python3
import json
import sys

from build_startup import comp, ser, sm

EU = "eu-central-1"

C = []

C.append(comp("prod-alb", "load_balancer", "aws", "elbv2", "application", 1, 2, "active", False, "prod", region=EU,
              name="clinic-prod-alb",
              usage={"requests": ser("count", "observed", total=61_000_000)},
              sec={"public_exposure": "internet"},
              usd=0.0225 * 730 + 30))

C.append(comp("prod-api", "container", "aws", "ecs-fargate", "4vcpu/8GB", 6, 1, "active", False, "prod", region=EU,
              name="clinic-prod/api", scaling={"desired": 6},
              cap={"vcpu": (4, "count"), "memory_gb": (8, "GB")},
              usage={"cpu_pct": ser("percent", "observed", avg=31, p95=64, mx=82),
                     "memory_pct": ser("percent", "observed", avg=44, p95=58, mx=66)},
              sec={"public_exposure": "vpc_only", "plaintext_secrets_suspected": False},
              usd=(0.04048 * 4 + 0.004445 * 8) * 730 * 6))

C.append(comp("prod-db", "postgres", "aws", "rds", "db.r5.2xlarge", 1, 2, "active", True, "prod", region=EU,
              name="clinic-prod-db", engine={"name": "postgres", "version": "15.6"}, data_gb=140, classification="pii",
              features=["pg_trgm", "btree_gist"],
              cap={"vcpu": (8, "count"), "memory_gb": (64, "GB"), "storage_gb": (400, "GB")},
              usage={"cpu_pct": ser("percent", "observed", avg=24, p95=51, mx=77),
                     "connections": ser("count", "observed", avg=118, p95=190, mx=240),
                     "read_iops": ser("iops", "observed", avg=900, p95=2100, mx=3400),
                     "write_iops": ser("iops", "observed", avg=310, p95=760, mx=1300)},
              sec={"public_exposure": "vpc_only", "encryption_at_rest": True, "encryption_in_transit": True,
                   "backup_retention_days": 7, "deletion_protection": True},
              usd=2 * 1.00 * 730 + 400 * 0.23,
              basis="list price (USD, on-demand, Multi-AZ doubles the instance, gp2 Multi-AZ storage) x 730 h x 0.92 EUR/USD"))

C.append(comp("prod-cache", "cache", "aws", "elasticache-redis", "cache.m5.large", 1, 1, "active", True, "prod", region=EU,
              name="clinic-prod-cache", engine={"name": "redis", "version": "7.1"}, data_gb=1.2,
              cap={"vcpu": (2, "count"), "memory_gb": (6.4, "GB")},
              usage={"cpu_pct": ser("percent", "observed", avg=11, p95=24, mx=38),
                     "connections": ser("count", "observed", avg=64, p95=110, mx=140),
                     "hit_rate_pct": ser("percent", "observed", avg=91)},
              sec={"public_exposure": "vpc_only", "encryption_at_rest": False, "backup_retention_days": 0},
              usd=0.156 * 730))

C.append(comp("prod-reminders", "queue", "aws", "sqs", "standard", 1, None, "active", True, "prod", region=EU,
              name="clinic-prod-reminders",
              usage={"messages_sent": ser("messages", "observed", total=1_260_000),
                     "messages_received": ser("messages", "observed", total=1_262_000)},
              sec={"public_exposure": "none", "encryption_at_rest": True},
              usd=2, config={"visibility_timeout_s": 120, "receive_wait_s": 20, "dlq": False, "retention_days": 4}))

C.append(comp("prod-notifier", "function", "aws", "lambda", "python3.12/512MB", 1, None, "active", False, "prod", region=EU,
              name="clinic-prod-notifier", engine={"name": "python", "version": "3.12"},
              cap={"memory_gb": (0.5, "GB"), "timeout_s": (60, "s")},
              usage={"invocations": ser("count", "observed", total=1_262_000),
                     "duration_ms": ser("ms", "observed", avg=340, p95=900, mx=2400)},
              sec={"public_exposure": "vpc_only", "plaintext_secrets_suspected": False, "admin_privileges": False},
              usd=9, config={"vpc_attached": True, "dlq": False}))

C.append(comp("prod-documents", "object_storage", "aws", "s3", "standard", 1, None, "active", True, "prod", region=EU,
              name="clinic-prod-documents", data_gb=640, classification="pii",
              cap={"object_count": (2_300_000, "count")},
              usage={"requests": ser("count", "observed", total=4_100_000)},
              sec={"public_exposure": "none", "encryption_at_rest": True},
              usd=640 * 0.0245 + 6, config={"versioning": True, "lifecycle_rules": 0}))

C.append(comp("prod-nat", "nat", "aws", "nat-gateway", "per-az", 1, 1, "active", False, "prod", region=EU,
              name="1 NAT gateway(s) in clinic-prod-vpc",
              usage={"network_out_gb": ser("gb", "observed", avg=0.55, total=185, mx=1.9)},
              usd=0.052 * 730 + 185 * 0.052))

C.append(comp("staging-alb", "load_balancer", "aws", "elbv2", "application", 1, 2, "active", False, "staging", region=EU,
              name="clinic-staging-alb",
              usage={"requests": ser("count", "observed", total=210_000)},
              sec={"public_exposure": "internet"},
              usd=0.0225 * 730 + 2))

C.append(comp("staging-api", "container", "aws", "ecs-fargate", "4vcpu/8GB", 6, 1, "active", False, "staging", region=EU,
              name="clinic-staging/api", scaling={"desired": 6},
              cap={"vcpu": (4, "count"), "memory_gb": (8, "GB")},
              usage={"cpu_pct": ser("percent", "observed", avg=2.4, p95=9, mx=31),
                     "memory_pct": ser("percent", "observed", avg=19, p95=22, mx=30)},
              sec={"public_exposure": "vpc_only", "plaintext_secrets_suspected": False},
              usd=(0.04048 * 4 + 0.004445 * 8) * 730 * 6))

C.append(comp("staging-db", "postgres", "aws", "rds", "db.r5.2xlarge", 1, 1, "active", True, "staging", region=EU,
              name="clinic-staging-db", engine={"name": "postgres", "version": "15.6"}, data_gb=138, classification="pii",
              features=["pg_trgm", "btree_gist"],
              cap={"vcpu": (8, "count"), "memory_gb": (64, "GB"), "storage_gb": (400, "GB")},
              usage={"cpu_pct": ser("percent", "observed", avg=3, p95=11, mx=40),
                     "connections": ser("count", "observed", avg=6, p95=14, mx=22)},
              sec={"public_exposure": "vpc_only", "encryption_at_rest": False, "encryption_in_transit": False,
                   "backup_retention_days": 1, "deletion_protection": False},
              usd=1.00 * 730 + 400 * 0.115, tags={"restored_from": "clinic-prod-db snapshot, weekly, unmasked"}))

C.append(comp("dev-db", "postgres", "aws", "rds", "db.t3.medium", 1, 1, "active", True, "dev", region=EU,
              name="clinic-dev-db", engine={"name": "postgres", "version": "15.6"}, data_gb=4, classification="internal",
              cap={"vcpu": (2, "count"), "memory_gb": (4, "GB"), "storage_gb": (20, "GB")},
              usage={"cpu_pct": ser("percent", "observed", avg=4, p95=18, mx=55),
                     "connections": ser("count", "observed", avg=3, p95=9, mx=14)},
              sec={"public_exposure": "internet", "encryption_at_rest": False, "encryption_in_transit": False,
                   "backup_retention_days": 0, "deletion_protection": False},
              usd=0.072 * 730 + 20 * 0.115))

C.append(comp("dev-runner", "virtual_machine", "aws", "ec2", "m5.2xlarge", 1, 1, "idle", False, "dev", region=EU,
              name="clinic-dev-runner",
              cap={"vcpu": (8, "count"), "memory_gb": (32, "GB"), "disk_gb": (100, "GB")},
              usage={"cpu_pct": ser("percent", "observed", avg=1.6, p95=6, mx=71)},
              sec={"public_exposure": "internet", "world_open_ports": [22], "encryption_at_rest": None},
              usd=0.384 * 730 + 100 * 0.10, config={"role": "self-hosted CI runner, always on"}))

C.append(comp("dev-scratch", "block_storage", "aws", "ebs", "gp3", 1, 1, "orphan", True, "dev", region=EU,
              cap={"storage_gb": (200, "GB")},
              usage={"read_iops": ser("iops", "observed", avg=0, mx=0),
                     "write_iops": ser("iops", "observed", avg=0, mx=0)},
              sec={"encryption_at_rest": False}, usd=200 * 0.08,
              config={"attached": False, "size_gb_each": 200}))

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


e("prod-alb", "prod-api", "traffic", "declared", 210, lat=True, note="Target group -> ECS service")
e("prod-api", "prod-db", "data", "declared", 95, lat=True, note="Bookings, patients, schedules")
e("prod-api", "prod-cache", "data", "declared", 40, lat=True, note="Sessions and slot availability")
e("prod-api", "prod-documents", "data", "declared", 60, note="Referral letters, scanned results")
e("prod-api", "prod-reminders", "event", "declared", 2, note="Reminder jobs 24 h and 2 h before a visit")
e("prod-reminders", "prod-notifier", "event", "declared", 2, note="Event source mapping")
e("prod-notifier", "prod-db", "data", "declared", 3)
e("prod-notifier", "prod-nat", "network", "inferred", 18, note="SMS and e-mail providers over the internet")
e("prod-api", "prod-nat", "network", "inferred", 160, note="Payment and calendar integrations")
e("staging-alb", "staging-api", "traffic", "declared", 1)
e("staging-api", "staging-db", "data", "declared", 1)

DOC = {
    "schema_version": "1.0",
    "project": "clinic-booking",
    "source": {"extractor": "hand-written-mock", "extractor_version": "0", "generated_at": "2026-11-14T10:00:00Z",
               "endpoint": None, "regions_scanned": [EU], "is_mock": True,
               "notes": "Mid-sized B2B SaaS mock with dev, staging and prod. Staging is a full-size, always-on copy of prod holding unmasked patient data."},
    "stacks": [
        {"id": "prod", "name": "Production", "environment": "prod", "description": "Booking API, patient database, reminders."},
        {"id": "staging", "name": "Staging", "environment": "staging", "description": "Release candidate copy of prod, refreshed weekly from a prod snapshot."},
        {"id": "dev", "name": "Development", "environment": "dev", "description": "Shared dev database and the CI runner."}],
    "controls": {"audit_logging_enabled": True, "threat_detection_enabled": False, "config_recording_enabled": False,
                 "backup_plans_exist": True, "vpc_flow_logs_enabled": False, "mfa_enforced": True},
    "components": C,
    "edges": E,
    "stay_together": [
        {"id": "booking-path", "members": ["prod-api", "prod-db", "prod-cache"], "scope": "region",
         "reason": "Slot search and booking are latency-bound."}],
}

if __name__ == "__main__":
    json.dump(DOC, sys.stdout, indent=2, ensure_ascii=False)
    sys.stdout.write("\n")

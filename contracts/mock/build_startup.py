#!/usr/bin/env python3
import json
import sys

EU = "eu-west-1"
FX = 0.92

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
    if zones is None:
        del c["zones"]
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

C.append(comp("web-server", "virtual_machine", "aws", "ec2", "m5.4xlarge", 3, 1, "active", False, "main",
              cap={"vcpu": (16, "count"), "memory_gb": (64, "GB"), "disk_gb": (100, "GB")},
              usage={"cpu_pct": ser("percent", "observed", avg=12, p95=28, mx=45),
                     "memory_pct": ser("percent", "observed", avg=22, p95=35, mx=48),
                     "network_out_gb": ser("gb", "observed", avg=0.8, p95=2.1)},
              sec={"public_exposure": "internet", "world_open_ports": [80, 443, 22], "encryption_at_rest": None,
                   "admin_privileges": False},
              usd=3 * (0.768 * 730 + 100 * 0.10), tags={"env": "prod"}))

C.append(comp("app-db", "postgres", "aws", "rds", "db.r5.4xlarge", 1, 1, "active", True, "main",
              engine={"name": "postgres", "version": "12.18"}, data_gb=85, classification="pii",
              features=["pg_trgm", "uuid-ossp"],
              cap={"vcpu": (16, "count"), "memory_gb": (128, "GB"), "storage_gb": (300, "GB")},
              usage={"cpu_pct": ser("percent", "observed", avg=18, p95=42, mx=68),
                     "connections": ser("count", "observed", avg=35, p95=58, mx=92),
                     "read_iops": ser("iops", "observed", avg=420, p95=890, mx=1600),
                     "write_iops": ser("iops", "observed", avg=180, p95=410, mx=720)},
              sec={"public_exposure": "internet", "encryption_at_rest": False, "encryption_in_transit": False,
                   "backup_retention_days": 0, "deletion_protection": False},
              usd=1.84 * 730 + 300 * 0.115, tags={"app": "main"}))

C.append(comp("cache", "cache", "aws", "elasticache-redis", "cache.r5.xlarge", 1, 1, "active", True, "main",
              engine={"name": "redis", "version": "6.2"}, data_gb=0.8,
              cap={"vcpu": (4, "count"), "memory_gb": (26, "GB")},
              usage={"cpu_pct": ser("percent", "observed", avg=8, p95=19, mx=34),
                     "memory_pct": ser("percent", "observed", avg=14, p95=22, mx=31),
                     "connections": ser("count", "observed", avg=18, p95=32, mx=48),
                     "hit_rate_pct": ser("percent", "observed", avg=78)},
              sec={"public_exposure": "vpc_only", "encryption_at_rest": False, "encryption_in_transit": False,
                   "backup_retention_days": 0},
              usd=0.394 * 730))

C.append(comp("queue", "queue", "aws", "sqs", "standard", 1, None, "active", True, "main",
              usage={"messages_sent": ser("messages", "observed", total=142_000),
                     "messages_received": ser("messages", "observed", total=145_000),
                     "empty_receives": ser("count", "observed", total=3_200_000)},
              sec={"public_exposure": "none", "encryption_at_rest": False},
              usd=3, config={"visibility_timeout_s": 30, "receive_wait_s": 0, "dlq": False, "retention_days": 14}))

C.append(comp("uploads", "object_storage", "aws", "s3", "standard", 1, None, "active", True, "main",
              data_gb=120, classification="confidential",
              cap={"object_count": (48_000, "count")},
              usage={"requests": ser("count", "observed", total=380_000)},
              sec={"public_exposure": "internet", "encryption_at_rest": True, "backup_retention_days": 0},
              usd=120 * 0.023 + 8, config={"anonymous_put_allowed": False, "lifecycle_rules": 0, "versioning": False}))

C.append(comp("worker", "function", "aws", "lambda", "python3.9/1024MB", 1, None, "active", False, "main",
              engine={"name": "python", "version": "3.9"},
              cap={"memory_gb": (1, "GB"), "timeout_s": (300, "s")},
              usage={"invocations": ser("count", "observed", total=68_400),
                     "duration_ms": ser("ms", "observed", avg=820, p95=1900, mx=3200),
                     "concurrency": ser("count", "observed", avg=2.1, p95=5, mx=8)},
              sec={"public_exposure": "unknown", "plaintext_secrets_suspected": True, "admin_privileges": False},
              usd=6, config={"vpc_attached": False, "subnets": 0, "dlq": False, "reserved_concurrency": None}))

C.append(comp("backup-storage", "object_storage", "aws", "s3", "standard", 1, None, "active", True, "main",
              region="us-east-1", data_gb=220, classification="pii",
              cap={"object_count": (850, "count")},
              usage={"requests": ser("count", "observed", total=2_400)},
              sec={"public_exposure": "none", "encryption_at_rest": True},
              usd=220 * 0.023 + 1, config={"lifecycle_rules": 0, "versioning": False, "oldest_object_age_days": 240}))

C.append(comp("nat", "nat", "aws", "nat-gateway", "per-az", 1, 1, "active", False, "main",
              usage={"network_out_gb": ser("gb", "observed", avg=1.8, total=25, mx=4.2)},
              usd=0.045 * 730 + 25 * 0.045))

C.append(comp("logs-volume", "block_storage", "aws", "ebs", "gp2", 1, 1, "orphan", True, "main",
              cap={"storage_gb": (500, "GB")},
              usage={"read_iops": ser("iops", "observed", avg=0, mx=0),
                     "write_iops": ser("iops", "observed", avg=0, mx=0)},
              sec={"encryption_at_rest": False}, usd=500 * 0.10,
              config={"attached": False, "size_gb_each": 500}))

C.append(comp("old-bastion", "virtual_machine", "aws", "ec2", "t3.large", 1, 1, "idle", False, "main",
              cap={"vcpu": (2, "count"), "memory_gb": (8, "GB"), "disk_gb": (50, "GB")},
              usage={"cpu_pct": ser("percent", "observed", avg=0.8, p95=2.1, mx=8)},
              sec={"public_exposure": "internet", "world_open_ports": [22], "encryption_at_rest": None},
              usd=0.0832 * 730 + 50 * 0.10))

E = []

def e(src, dst, kind, evidence, gb=None, gb_prov="estimated", note=None, lat=None):
    d = {"id": f"e{len(E) + 1:02d}", "from": src, "to": dst, "kind": kind, "evidence": evidence}
    if gb is not None:
        d["gb_month"] = sm(gb, "GB", gb_prov)
    if lat is not None:
        d["latency_sensitive"] = lat
    if note:
        d["note"] = note
    E.append(d)

e("web-server", "app-db", "data", "declared", 28, lat=True, note="DB connection from web tier")
e("web-server", "cache", "data", "declared", 12, lat=True, note="Session cache access")
e("web-server", "uploads", "data", "declared", 85, note="Object storage writes")
e("web-server", "queue", "event", "declared", 4, note="Background job queue")
e("uploads", "worker", "event", "declared", 18, note="S3 event trigger")
e("worker", "app-db", "data", "declared", 6)
e("worker", "backup-storage", "data", "declared", 45, note="Cross-region backup writes")
e("web-server", "nat", "network", "inferred", 25)
e("old-bastion", "app-db", "network", "declared", 0.1, "synthetic")

DOC = {
    "schema_version": "1.0",
    "project": "startup",
    "source": {"extractor": "hand-written-mock", "extractor_version": "0", "generated_at": "2026-11-13T20:00:00Z",
               "endpoint": None, "regions_scanned": [EU, "us-east-1"], "is_mock": True,
               "notes": "Start-up-sized mock. Single production stack with ~10 components, EUR 3-8k/month range, deliberate poor choices for engine testing."},
    "stacks": [
        {"id": "main", "name": "Main application", "environment": "prod", "description": "Core web app and database."}],
    "controls": {"audit_logging_enabled": False, "threat_detection_enabled": False, "config_recording_enabled": False,
                 "backup_plans_exist": False, "vpc_flow_logs_enabled": False, "mfa_enforced": False},
    "components": C,
    "edges": E,
    "stay_together": [
        {"id": "web-tier", "members": ["web-server", "app-db", "cache"], "scope": "region",
         "reason": "Latency-bound request path."}],
}

if __name__ == "__main__":
    json.dump(DOC, sys.stdout, indent=2, ensure_ascii=False)
    sys.stdout.write("\n")

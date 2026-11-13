"""CloudWatch metric generator: 14d hourly backfill + a live loop pushing 1-minute points.

Usage:  python -m synth.metrics backfill | live
Each series is fn(t, p) -> value for the window of p seconds starting at t, so the same
definition feeds both the hourly backfill (p=3600) and the live loop (p=60).
Profiles are tuned to the flaws in the ledger (idle GPUs, oversized RDS, hot DDB partition, ...)
but the ledger itself is never consulted: the agent only sees the numbers.
"""
import hashlib
import math
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from .common import client

cw = client("cloudwatch")
BACKFILL_DAYS = 14
BATCH = 25  # floci rejects PutMetricData bodies over ~50 datapoints
INCIDENT = datetime.now(timezone.utc).replace(hour=2, minute=0, second=0, microsecond=0) - timedelta(days=3)


def noise(key, t, amp):
    h = hashlib.md5(f"{key}{int(t.timestamp()) // 60}".encode()).digest()
    return (int.from_bytes(h[:4], "big") / 2**32 - 0.5) * 2 * amp


def diurnal(t, peak=14, width=5.0):
    """0..1 bump around peak hour (UTC), damped on weekends."""
    d = min(abs(t.hour + t.minute / 60 - peak), 24 - abs(t.hour + t.minute / 60 - peak))
    v = math.exp(-(d / width) ** 2)
    return v * (0.55 if t.weekday() >= 5 else 1.0)


def gauge(key, base, amp=0.0, jitter=0.0, lo=0.0, hi=None, peak=14):
    def f(t, p):
        v = base + amp * diurnal(t, peak) + noise(key, t, jitter)
        v = max(lo, v)
        return min(hi, v) if hi is not None else v
    return f


def count(key, per_hour, amp=0.0, jitter=0.1, peak=14):
    """Counter: events in the p-second window."""
    def f(t, p):
        r = (per_hour + amp * diurnal(t, peak)) * (1 + noise(key, t, jitter))
        return max(0.0, r * p / 3600)
    return f


def spike(f, times, add, dur_h=1):
    """Overlay an incident window on another series."""
    def g(t, p):
        v = f(t, p)
        if any(s <= t < s + timedelta(hours=dur_h) for s in times):
            v += add * (p / 3600 if add > 1000 else 1)
        return v
    return g


def ramp(start, per_day, key):
    """Monotonic backlog growth from `start` (queue nobody drains)."""
    def f(t, p):
        return start + per_day * max(0.0, (t - (datetime.now(timezone.utc) - timedelta(days=BACKFILL_DAYS))).total_seconds() / 86400) + noise(key, t, 0.5)
    return f


S = []  # (namespace, name, dims, unit, fn)


def add(ns, name, dims, unit, fn):
    S.append((ns, name, [{"Name": k, "Value": v} for k, v in dims.items()], unit, fn))


def discover():
    ec2, rds, ddb, sqs = client("ec2"), client("rds"), client("dynamodb"), client("sqs")
    elb, ecs, eks, lam = client("elbv2"), client("ecs"), client("eks"), client("lambda")
    asg, efs, kin, ec = client("autoscaling"), client("efs"), client("kinesis"), client("elasticache")
    s3 = client("s3")
    P, B = "Percent", "Bytes"
    inc = [INCIDENT]

    # ---- EC2: everything idle, batch box spikes at 02:00 ----
    asg_ids = {i["InstanceId"] for g in asg.describe_auto_scaling_groups()["AutoScalingGroups"] for i in g["Instances"]}
    for r in ec2.describe_instances()["Reservations"]:
        for i in r["Instances"]:
            iid = i["InstanceId"]
            name = next((t["Value"] for t in i.get("Tags", []) if t["Key"] == "Name"), "")
            if iid in asg_ids:
                cpu = gauge(iid, 6, 7, 1.5)
            elif name == "shop-legacy-batch":
                cpu = spike(gauge(iid, 1.5, 0, 0.5), [INCIDENT + timedelta(days=d) for d in range(-11, 4)], 60)
            elif name == "shop-bastion":
                cpu = gauge(iid, 0.6, 0, 0.3)
            else:
                cpu = gauge(iid, 1.0, 1.5, 0.4)
            add("AWS/EC2", "CPUUtilization", {"InstanceId": iid}, P, cpu)
            add("AWS/EC2", "NetworkIn", {"InstanceId": iid}, B, count(iid, 2e5 if iid in asg_ids else 2e4, 1e5 if iid in asg_ids else 0))
            add("AWS/EC2", "NetworkOut", {"InstanceId": iid}, B, count(iid + "o", 3e5 if iid in asg_ids else 2e4, 1e5 if iid in asg_ids else 0))
    add("AWS/EC2", "CPUUtilization", {"AutoScalingGroupName": "web-asg"}, P, gauge("web-asg", 6, 7, 1.5))

    # orphan volumes: zero I/O. burst balance irrelevant
    for v in ec2.describe_volumes()["Volumes"]:
        add("AWS/EBS", "VolumeReadOps", {"VolumeId": v["VolumeId"]}, "Count", gauge(v["VolumeId"], 0))
        add("AWS/EBS", "VolumeWriteOps", {"VolumeId": v["VolumeId"]}, "Count", gauge(v["VolumeId"] + "w", 0))
    for n in ec2.describe_nat_gateways()["NatGateways"]:
        add("AWS/NATGateway", "BytesOutToDestination", {"NatGatewayId": n["NatGatewayId"]}, B, count(n["NatGatewayId"], 5e3, 0))
        add("AWS/NATGateway", "ActiveConnectionCount", {"NatGatewayId": n["NatGatewayId"]}, "Count", gauge(n["NatGatewayId"], 1, 0, 0.5))

    # ---- RDS ----
    rds_prof = {  # cpu base, amp, conns, free GB, IOPS, mem GB freeable
        "shop-orders-db": (9, 25, 120, 1700, 800, 180),
        "shop-orders-db-copy": (0.8, 0, 0, 1900, 3, 200),
        "shop-analytics-db": (88, 10, 40, 700, 4000, 6),
        "legacy-erp-db": (4, 6, 15, 420, 60, 90),
        "data-aurora-0": (3, 4, 10, 800, 30, 100),
        "data-aurora-1": (1, 0, 0, 800, 5, 100),
    }
    for d in rds.describe_db_instances()["DBInstances"]:
        n = d["DBInstanceIdentifier"]
        cpu, amp, conns, free, iops, mem = rds_prof.get(n, (5, 5, 10, 500, 50, 50))
        dim = {"DBInstanceIdentifier": n}
        f = gauge(n, cpu, amp, 1.5, hi=100)
        if n == "shop-orders-db":  # analytics job + incident
            g = spike(spike(f, [INCIDENT], 70), [INCIDENT + timedelta(days=d) for d in range(-10, 3)], 55)
            f = lambda t, p, g=g: min(100.0, g(t, p))
        add("AWS/RDS", "CPUUtilization", dim, P, f)
        c = gauge(n + "c", conns, conns * 0.5, 3)
        if n == "shop-orders-db":
            c = spike(c, [INCIDENT], 400)  # connection exhaustion during incident
        add("AWS/RDS", "DatabaseConnections", dim, "Count", c)
        add("AWS/RDS", "FreeStorageSpace", dim, B, gauge(n + "s", free * 2**30, 0, 2**28))
        add("AWS/RDS", "ReadIOPS", dim, "Count/Second", gauge(n + "r", iops, iops * .6, iops * .1))
        add("AWS/RDS", "WriteIOPS", dim, "Count/Second", gauge(n + "w", iops * .4, iops * .3, iops * .05))
        add("AWS/RDS", "FreeableMemory", dim, B, gauge(n + "m", mem * 2**30, 0, 2**27))
        add("AWS/RDS", "ReplicaLag", dim, "Seconds", gauge(n + "l", 0))

    # ---- ElastiCache ----
    for cname, cpu, mem, conns in (("shop-sessions", 2.5, 2.0, 45), ("legacy-memcache", 0.1, 0.2, 0)):
        for node in ("0001",):
            dim = {"CacheClusterId": cname, "CacheNodeId": node}
            add("AWS/ElastiCache", "CPUUtilization", dim, P, gauge(cname, cpu, cpu, 0.3))
            add("AWS/ElastiCache", "DatabaseMemoryUsagePercentage", dim, P, gauge(cname + "m", mem, 0.5, 0.1))
            add("AWS/ElastiCache", "CurrConnections", dim, "Count", gauge(cname + "c", conns, conns * .3, 2))
            add("AWS/ElastiCache", "Evictions", dim, "Count", gauge(cname + "e", 0))
            add("AWS/ElastiCache", "CacheHitRate", dim, P, gauge(cname + "h", 62 if cname == "shop-sessions" else 0, 0, 5))

    # ---- DynamoDB: low consumption vs. provisioned; throttling on hot key ----
    ddb_prof = {  # provR, provW, consR/s, consW/s, throttle/hr
        "shop-orders": (8000, 4000, 220, 90, 140),
        "shop-sessions": (2000, 2000, 60, 35, 0),
        "events-raw": (0, 0, 15, 250, 80),
        "legacy-audit": (1000, 1000, 0, 4, 0),
    }
    for t in ddb.list_tables()["TableNames"]:
        pr, pw, cr, cwr, thr = ddb_prof.get(t, (100, 100, 5, 5, 0))
        dim = {"TableName": t}
        add("AWS/DynamoDB", "ConsumedReadCapacityUnits", dim, "Count", count(t + "r", cr * 3600, cr * 1800, 0.1))
        add("AWS/DynamoDB", "ConsumedWriteCapacityUnits", dim, "Count", count(t + "w", cwr * 3600, cwr * 1800, 0.1))
        if pr:
            add("AWS/DynamoDB", "ProvisionedReadCapacityUnits", dim, "Count", gauge(t + "pr", pr))
            add("AWS/DynamoDB", "ProvisionedWriteCapacityUnits", dim, "Count", gauge(t + "pw", pw))
        add("AWS/DynamoDB", "WriteThrottleEvents", dim, "Count", count(t + "t", thr, thr * 2, 0.3))
        add("AWS/DynamoDB", "ReadThrottleEvents", dim, "Count", count(t + "rt", thr * .3, thr, 0.3))

    # ---- ALB: modest traffic, incident 5xx burst, slow health ejection ----
    for lb in elb.describe_load_balancers()["LoadBalancers"]:
        suffix = lb["LoadBalancerArn"].split("loadbalancer/")[1]
        dim = {"LoadBalancer": suffix}
        busy = lb["LoadBalancerName"] == "shop-alb"
        add("AWS/ApplicationELB", "RequestCount", dim, "Count", count(suffix, 9000 if busy else 600, 25000 if busy else 900))
        add("AWS/ApplicationELB", "TargetResponseTime", dim, "Seconds", spike(gauge(suffix + "rt", 0.45, 0.6, 0.08), [INCIDENT], 3.5))
        add("AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", dim, "Count",
            spike(count(suffix + "5", 8, 10, 0.5), [INCIDENT + timedelta(minutes=0)], 9000 if busy else 0, dur_h=2))
        add("AWS/ApplicationELB", "HTTPCode_Target_2XX_Count", dim, "Count", count(suffix + "2", 8800 if busy else 590, 24000 if busy else 880))
        add("AWS/ApplicationELB", "UnHealthyHostCount", dim, "Count", spike(gauge(suffix + "u", 0), [INCIDENT], 3, dur_h=3))

    # ---- ECS: tiny usage vs huge task sizes ----
    for svc, cpu, mem in (("orders-api", 4, 9), ("invoice-worker", 2, 6), ("admin-portal", 1, 4), ("report-gen", 1.5, 3)):
        dim = {"ClusterName": "legacy-ecs", "ServiceName": svc}
        add("AWS/ECS", "CPUUtilization", dim, P, gauge(svc, cpu, cpu, 0.5))
        add("AWS/ECS", "MemoryUtilization", dim, P, gauge(svc + "m", mem, 1.5, 0.3))

    # ---- EKS (Container Insights) ----
    eks_prof = {"shop-prod": (14, 38, 18), "shop-staging": (2, 9, 12), "data-platform": (5, 22, 14), "ml-experiments": (0.8, 6, 6)}
    for c in eks.list_clusters()["clusters"]:
        cpu, mem, nodes = eks_prof.get(c, (5, 20, 5))
        dim = {"ClusterName": c}
        add("ContainerInsights", "node_cpu_utilization", dim, P, gauge(c, cpu, cpu * .8, 1))
        add("ContainerInsights", "node_memory_utilization", dim, P, gauge(c + "m", mem, 6, 1))
        add("ContainerInsights", "cluster_node_count", dim, "Count", gauge(c + "n", nodes))
        add("ContainerInsights", "pod_cpu_reserved_capacity", dim, P, gauge(c + "r", cpu * 2.2, 5, 1))
    add("ContainerInsights", "node_gpu_utilization", {"ClusterName": "data-platform"}, P,
        spike(gauge("gpu", 0.4, 0, 0.3), [INCIDENT + timedelta(days=d, hours=10) for d in (-9, -6, -2)], 70, dur_h=3))

    # ---- SQS ----
    sqs_prof = {"shop-orders": (2400, 3, 70), "shop-emails": (300, 0, 12), "legacy-jobs": (0, 120, 0)}
    for q in [u.split("/")[-1] for u in sqs.list_queues()["QueueUrls"]]:
        rate, growth, _ = sqs_prof.get(q, (10, 0, 0))
        dim = {"QueueName": q}
        add("AWS/SQS", "NumberOfMessagesSent", dim, "Count", count(q, rate, rate * .8))
        add("AWS/SQS", "NumberOfMessagesDeleted", dim, "Count", count(q + "d", rate, rate * .8))
        add("AWS/SQS", "ApproximateNumberOfMessagesVisible", dim, "Count",
            ramp(50, growth, q) if growth else gauge(q + "v", 4, 6, 2))
        add("AWS/SQS", "ApproximateAgeOfOldestMessage", dim, "Seconds",
            ramp(3600, 86400, q + "a") if growth else gauge(q + "age", 2, 3, 1))
        add("AWS/SQS", "NumberOfEmptyReceives", dim, "Count", count(q + "e", 90000 if rate else 0, 30000, 0.05))
        add("AWS/SQS", "NumberOfMessagesReceived", dim, "Count", count(q + "rv", rate * 1.3, rate, .1))

    # ---- Lambda ----
    lam_prof = {"shop-resize-image": (900, 420, 0.8), "shop-send-email": (1500, 230, 2.0), "legacy-cron": (60, 1100, 0.2)}
    for f in [x["FunctionName"] for x in lam.list_functions()["Functions"]]:
        inv, dur, err = lam_prof.get(f, (100, 300, 1))
        dim = {"FunctionName": f}
        add("AWS/Lambda", "Invocations", dim, "Count", count(f, inv, inv * .5))
        add("AWS/Lambda", "Duration", dim, "Milliseconds", gauge(f + "d", dur, dur * .2, dur * .1))
        add("AWS/Lambda", "Errors", dim, "Count", count(f + "e", inv * err / 100, 0.3))
        add("AWS/Lambda", "Throttles", dim, "Count", gauge(f + "t", 0))
        add("AWS/Lambda", "ConcurrentExecutions", dim, "Count", gauge(f + "c", 1, 2, 0.5))

    # ---- Kinesis: 50 shards, trickle of data ----
    add("AWS/Kinesis", "IncomingBytes", {"StreamName": "clickstream"}, B, count("kin", 3.6e8, 1e8))
    add("AWS/Kinesis", "IncomingRecords", {"StreamName": "clickstream"}, "Count", count("kinr", 360000, 100000))
    add("AWS/Kinesis", "WriteProvisionedThroughputExceeded", {"StreamName": "clickstream"}, "Count", gauge("kine", 0))

    # ---- EFS: mostly idle ----
    for fs in efs.describe_file_systems()["FileSystems"]:
        dim = {"FileSystemId": fs["FileSystemId"]}
        add("AWS/EFS", "PercentIOLimit", dim, P, gauge(fs["FileSystemId"], 0.4, 1, 0.2))
        add("AWS/EFS", "MeteredIOBytes", dim, B, count(fs["FileSystemId"] + "b", 5e6, 5e6))
        add("AWS/EFS", "PermittedThroughput", dim, "Bytes/Second", gauge(fs["FileSystemId"] + "p", fs["ProvisionedThroughputInMibps"] * 2**20))

    # ---- S3 storage metrics (daily in AWS; hourly here) ----
    for b in [x["Name"] for x in s3.list_buckets()["Buckets"] if not x["Name"].startswith("awslambda")]:
        size = {"data-lake-raw": 48e12, "shop-prod-backups": 9e12, "data-lake-logs": 3e12}.get(b, 2e11)
        add("AWS/S3", "BucketSizeBytes", {"BucketName": b, "StorageType": "StandardStorage"}, B, ramp(size, size * 0.02, b))
        add("AWS/S3", "NumberOfObjects", {"BucketName": b, "StorageType": "AllStorageTypes"}, "Count", ramp(size / 4e4, size / 4e6, b + "n"))

    # ---- Billing (monthly-to-date style estimates by service) ----
    bill = {"AmazonEKS": 4100, "AmazonEC2": 31800, "AmazonRDS": 24300, "AmazonElastiCache": 3900, "AmazonDynamoDB": 9100,
            "AmazonKinesis": 560, "AmazonEFS": 9200, "AmazonS3": 1450, "AWSLambda": 85, "AmazonCloudWatch": 740, "AmazonVPC": 330}
    for svc, total in bill.items():
        add("AWS/Billing", "EstimatedCharges", {"ServiceName": svc, "Currency": "USD"}, "None",
            lambda t, p, total=total: total * (t.day - 1 + t.hour / 24 + 1) / 30)


def push(points):
    """points: list of (ns, name, dims, unit, ts, value); batches per namespace."""
    by_ns = {}
    for ns, name, dims, unit, ts, v in points:
        by_ns.setdefault(ns, []).append({"MetricName": name, "Dimensions": dims, "Timestamp": ts, "Value": float(v), "Unit": unit})
    jobs = [(ns, data[i:i + BATCH]) for ns, data in by_ns.items() for i in range(0, len(data), BATCH)]
    with ThreadPoolExecutor(8) as ex:  # floci rejects big requests; many small ones in parallel
        for _ in ex.map(lambda j: cw.put_metric_data(Namespace=j[0], MetricData=j[1]), jobs):
            pass


def backfill():
    discover()
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    hours = [now - timedelta(hours=h) for h in range(BACKFILL_DAYS * 24, 0, -1)]
    print(f"backfilling {len(S)} series x {len(hours)} points")
    for ns in dict.fromkeys(s[0] for s in S):
        pts = [(n, name, d, u, t, fn(t, 3600)) for n, name, d, u, fn in S if n == ns for t in hours]
        push(pts)
        print(f"  {ns}: {len(pts)} points")


def live(interval=60):
    discover()
    print(f"live: pushing {len(S)} series every {interval}s (Ctrl-C to stop)", flush=True)
    while True:
        t = datetime.now(timezone.utc).replace(second=0, microsecond=0)
        try:
            push([(n, name, d, u, t, fn(t, 60)) for n, name, d, u, fn in S])
        except Exception as e:  # noqa: BLE001 - keep looping through floci hiccups
            print("push failed:", str(e)[:120], flush=True)
        time.sleep(interval - (time.time() % interval))


if __name__ == "__main__":
    {"backfill": backfill, "live": live}[sys.argv[1] if len(sys.argv) > 1 else "backfill"]()

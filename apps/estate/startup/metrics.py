from collections import defaultdict
from datetime import datetime, timedelta, timezone

from synth.common import client

WINDOW_HOURS = 14 * 24
BATCH = 25
GB = 2**30

cw = client("cloudwatch")
ec2 = client("ec2")


def business_hours(hour):
    return 8 <= hour < 20


def shaped(base):
    return lambda ts: base * (1.4 if business_hours(ts.hour) else 0.6)


def flat(base):
    return lambda ts: base


def bastion_id():
    reservations = ec2.describe_instances(Filters=[
        {"Name": "tag:Name", "Values": ["startup-old-bastion"]},
        {"Name": "instance-state-name", "Values": ["pending", "running", "stopping", "stopped"]}])["Reservations"]
    return reservations[0]["Instances"][0]["InstanceId"]


def nat_id():
    gateways = ec2.describe_nat_gateways(Filters=[
        {"Name": "tag:Name", "Values": ["startup-nat"]},
        {"Name": "state", "Values": ["pending", "available"]}])["NatGateways"]
    return gateways[0]["NatGatewayId"]


def series():
    bastion = {"InstanceId": bastion_id()}
    web = {"AutoScalingGroupName": "startup-web"}
    db = {"DBInstanceIdentifier": "startup-app-db"}
    cache = {"CacheClusterId": "startup-cache", "CacheNodeId": "0001"}
    queue = {"QueueName": "startup-queue"}
    worker = {"FunctionName": "startup-worker"}
    return [
        ("AWS/EC2", "CPUUtilization", web, "Percent", shaped(12)),
        ("AWS/EC2", "NetworkOut", web, "Bytes", shaped(0.8 * GB)),
        ("AWS/EC2", "CPUUtilization", bastion, "Percent", flat(0.8)),
        ("AWS/EC2", "NetworkOut", bastion, "Bytes", flat(0)),
        ("AWS/RDS", "CPUUtilization", db, "Percent", shaped(18)),
        ("AWS/RDS", "DatabaseConnections", db, "Count", shaped(35)),
        ("AWS/RDS", "ReadIOPS", db, "Count/Second", shaped(420)),
        ("AWS/RDS", "WriteIOPS", db, "Count/Second", shaped(180)),
        ("AWS/ElastiCache", "CPUUtilization", cache, "Percent", shaped(8)),
        ("AWS/ElastiCache", "CurrConnections", cache, "Count", shaped(18)),
        ("AWS/ElastiCache", "CacheHitRate", cache, "Percent", flat(78)),
        ("AWS/SQS", "NumberOfMessagesSent", queue, "Count", shaped(142_000 / WINDOW_HOURS)),
        ("AWS/SQS", "NumberOfMessagesReceived", queue, "Count", shaped(145_000 / WINDOW_HOURS)),
        ("AWS/SQS", "NumberOfEmptyReceives", queue, "Count", flat(3_200_000 / WINDOW_HOURS)),
        ("AWS/Lambda", "Invocations", worker, "Count", shaped(68_400 / WINDOW_HOURS)),
        ("AWS/Lambda", "Duration", worker, "Milliseconds", flat(820)),
        ("AWS/NATGateway", "BytesOutToDestination", {"NatGatewayId": nat_id()}, "Bytes", shaped(0.075 * GB)),
    ]


def datapoints_by_namespace(now):
    hours = [now - timedelta(hours=h) for h in range(1, WINDOW_HOURS)]
    grouped = defaultdict(list)
    for namespace, name, dims, unit, value in series():
        dimensions = [{"Name": k, "Value": v} for k, v in dims.items()]
        grouped[namespace].extend({"MetricName": name, "Dimensions": dimensions, "Timestamp": ts,
                                   "Value": value(ts), "Unit": unit} for ts in hours)
    return grouped


def push_metrics():
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    sent = 0
    for namespace, points in datapoints_by_namespace(now).items():
        for start in range(0, len(points), BATCH):
            cw.put_metric_data(Namespace=namespace, MetricData=points[start:start + BATCH])
        sent += len(points)
        print(f"  {namespace}: {len(points)} datapoints")
    print(f"Pushed {sent} datapoints over {WINDOW_HOURS // 24} days.")


if __name__ == "__main__":
    push_metrics()

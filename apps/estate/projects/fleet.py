from startup.build import owned, security_group, world_open
from startup.metrics import GB, WINDOW_HOURS, flat, shaped

from projects import floci

PREFIX = "fleet"


def prod():
    vid, subnets = floci.network("fleet-prod", "10.40")
    sg_alb = security_group(vid, "fleet-prod-alb", "Public load balancer", world_open(80, 443))
    sg_app = security_group(vid, "fleet-prod-app", "Dashboard API tasks", floci.from_group(sg_alb, 8080))
    sg_data = security_group(vid, "fleet-prod-data", "Accounts database and geofence cache", floci.from_group(sg_app, 5432, 6379))
    target_group = floci.load_balancer("fleet-prod-alb", vid, subnets, sg_alb)
    ingest_stream = floci.stream("fleet-prod-ingest-stream", 24, retention_hours=168)
    floci.provisioned_table("fleet-prod-positions", "vehicle_id", 3000, 5000, "customer_id")
    floci.postgres("fleet-prod-accounts-db", "db.r5.xlarge", "14.11", 200, subnets, sg_data, deletion_protection=True)
    floci.redis("fleet-prod-geofence", "cache.r5.large", subnets)
    floci.queue("fleet-prod-alerts", encrypted=False, visibility_s=30, wait_s=0, retention_s=345_600)
    floci.bucket("fleet-prod-archive")
    floci.function("fleet-prod-ingest", "python3.12", 256, 30, floci.role("fleet-prod-ingest-role", "lambda.amazonaws.com", admin=True),
                   {"POSITIONS_TABLE": "fleet-prod-positions", "GEOFENCE_HOST": "fleet-prod-geofence",
                    "ALERTS_QUEUE": "fleet-prod-alerts", "ARCHIVE_BUCKET": "fleet-prod-archive"})
    floci.event_source("fleet-prod-ingest", ingest_stream, 500, StartingPosition="LATEST")
    floci.fargate_service("fleet-prod", "dashboard-api", 2048, 4096, 6, subnets, sg_app, True,
                          floci.role("fleet-prod-task-role", "ecs-tasks.amazonaws.com"),
                          {"DB_HOST": "fleet-prod-accounts-db", "POSITIONS_TABLE": "fleet-prod-positions",
                           "ALERTS_QUEUE": "fleet-prod-alerts", "MAPS_API_KEY": "fake-maps-key-for-floci"}, target_group)
    floci.nat("fleet-prod", subnets[0])


def dev():
    vid, subnets = floci.network("fleet-dev", "10.41")
    sg_db = security_group(vid, "fleet-dev-db", "Dev database, open for laptops", world_open(5432))
    sg_replay = security_group(vid, "fleet-dev-replay", "Trace replay box", world_open(22))
    floci.stream("fleet-dev-ingest-stream", 8)
    floci.postgres("fleet-dev-db", "db.t3.large", "14.11", 50, subnets, sg_db, public=True, encrypted=False, backup_days=0)
    floci.instance("fleet-dev-replay", "c5.2xlarge", 50, subnets[0], sg_replay)


def build():
    print("Building the fleet-telemetry estate (fleet- prefix)...")
    with owned("fleet", "prod"):
        prod()
    with owned("fleet", "dev"):
        dev()
    print("Fleet-telemetry estate built.")


def series():
    db = lambda name: {"DBInstanceIdentifier": name}
    geofence = {"CacheClusterId": "fleet-prod-geofence", "CacheNodeId": "0001"}
    positions = {"TableName": "fleet-prod-positions"}
    api = {"ClusterName": "fleet-prod", "ServiceName": "dashboard-api"}
    return [
        ("AWS/Kinesis", "IncomingBytes", {"StreamName": "fleet-prod-ingest-stream"}, "Bytes", shaped(180_000 * 3600)),
        ("AWS/Kinesis", "IncomingRecords", {"StreamName": "fleet-prod-ingest-stream"}, "Count", shaped(1_090_000_000 / WINDOW_HOURS)),
        ("AWS/Lambda", "Invocations", {"FunctionName": "fleet-prod-ingest"}, "Count", shaped(9_600_000 / WINDOW_HOURS)),
        ("AWS/Lambda", "Duration", {"FunctionName": "fleet-prod-ingest"}, "Milliseconds", flat(95)),
        ("AWS/DynamoDB", "ConsumedReadCapacityUnits", positions, "Count", shaped(410 * 3600)),
        ("AWS/DynamoDB", "ConsumedWriteCapacityUnits", positions, "Count", shaped(860 * 3600)),
        ("AWS/RDS", "CPUUtilization", db("fleet-prod-accounts-db"), "Percent", shaped(21)),
        ("AWS/RDS", "DatabaseConnections", db("fleet-prod-accounts-db"), "Count", shaped(54)),
        ("AWS/RDS", "ReadIOPS", db("fleet-prod-accounts-db"), "Count/Second", shaped(380)),
        ("AWS/RDS", "WriteIOPS", db("fleet-prod-accounts-db"), "Count/Second", shaped(120)),
        ("AWS/ECS", "CPUUtilization", api, "Percent", shaped(27)),
        ("AWS/ECS", "MemoryUtilization", api, "Percent", flat(48)),
        ("AWS/ApplicationELB", "RequestCount", {"LoadBalancer": floci.load_balancer_dimension("fleet-prod-alb")}, "Count",
         shaped(38_000_000 / WINDOW_HOURS)),
        ("AWS/ElastiCache", "CPUUtilization", geofence, "Percent", shaped(34)),
        ("AWS/ElastiCache", "CurrConnections", geofence, "Count", shaped(40)),
        ("AWS/ElastiCache", "CacheHitRate", geofence, "Percent", flat(97)),
        ("AWS/SQS", "NumberOfMessagesSent", {"QueueName": "fleet-prod-alerts"}, "Count", shaped(520_000 / WINDOW_HOURS)),
        ("AWS/SQS", "NumberOfMessagesReceived", {"QueueName": "fleet-prod-alerts"}, "Count", shaped(515_000 / WINDOW_HOURS)),
        ("AWS/NATGateway", "BytesOutToDestination", {"NatGatewayId": floci.nat_id("fleet-prod")}, "Bytes", shaped(420 / WINDOW_HOURS * GB)),
        ("AWS/Kinesis", "IncomingBytes", {"StreamName": "fleet-dev-ingest-stream"}, "Bytes", flat(40 * 3600)),
        ("AWS/Kinesis", "IncomingRecords", {"StreamName": "fleet-dev-ingest-stream"}, "Count", flat(11_000 / WINDOW_HOURS)),
        ("AWS/RDS", "CPUUtilization", db("fleet-dev-db"), "Percent", shaped(5)),
        ("AWS/RDS", "DatabaseConnections", db("fleet-dev-db"), "Count", shaped(4)),
        ("AWS/EC2", "CPUUtilization", {"InstanceId": floci.instance_id("fleet-dev-replay")}, "Percent", flat(0.9)),
    ]

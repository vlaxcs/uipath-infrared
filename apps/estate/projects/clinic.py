from startup.build import security_group, world_open
from startup.metrics import GB, WINDOW_HOURS, flat, shaped

from projects import floci

PREFIX = "clinic"


def prod():
    vid, subnets = floci.network("clinic-prod", "10.30")
    sg_alb = security_group(vid, "clinic-prod-alb", "Public load balancer", world_open(80, 443))
    sg_app = security_group(vid, "clinic-prod-app", "API tasks and notifier", floci.from_group(sg_alb, 8080))
    sg_data = security_group(vid, "clinic-prod-data", "Database and cache", floci.from_group(sg_app, 5432, 6379))
    target_group = floci.load_balancer("clinic-prod-alb", vid, subnets, sg_alb)
    floci.postgres("clinic-prod-db", "db.r5.2xlarge", "15.6", 400, subnets, sg_data, multi_az=True, deletion_protection=True)
    floci.redis("clinic-prod-cache", "cache.m5.large", subnets)
    reminders = floci.queue("clinic-prod-reminders", encrypted=True, visibility_s=120, wait_s=20, retention_s=345_600)
    floci.bucket("clinic-prod-documents", versioned=True)
    task_role = floci.role("clinic-prod-task-role", "ecs-tasks.amazonaws.com")
    floci.fargate_service("clinic-prod", "api", 4096, 8192, 6, subnets, sg_app, False, task_role,
                          {"DB_HOST": "clinic-prod-db", "CACHE_HOST": "clinic-prod-cache", "DOCUMENTS_BUCKET": "clinic-prod-documents",
                           "REMINDERS_QUEUE": "clinic-prod-reminders"}, target_group)
    floci.function("clinic-prod-notifier", "python3.12", 512, 60, floci.role("clinic-prod-notifier-role", "lambda.amazonaws.com"),
                   {"DB_HOST": "clinic-prod-db"}, subnets, sg_app)
    floci.event_source("clinic-prod-notifier", reminders, 10)
    floci.nat("clinic-prod", subnets[0])


def staging():
    vid, subnets = floci.network("clinic-staging", "10.31")
    sg_alb = security_group(vid, "clinic-staging-alb", "Public load balancer", world_open(80, 443))
    sg_app = security_group(vid, "clinic-staging-app", "API tasks", floci.from_group(sg_alb, 8080))
    sg_data = security_group(vid, "clinic-staging-data", "Database", floci.from_group(sg_app, 5432))
    target_group = floci.load_balancer("clinic-staging-alb", vid, subnets, sg_alb)
    floci.postgres("clinic-staging-db", "db.r5.2xlarge", "15.6", 400, subnets, sg_data, encrypted=False, backup_days=1)
    floci.fargate_service("clinic-staging", "api", 4096, 8192, 6, subnets, sg_app, False,
                          floci.role("clinic-staging-task-role", "ecs-tasks.amazonaws.com"), {"DB_HOST": "clinic-staging-db"}, target_group)


def dev():
    vid, subnets = floci.network("clinic-dev", "10.32")
    sg_db = security_group(vid, "clinic-dev-db", "Dev database, open for laptops", world_open(5432))
    sg_runner = security_group(vid, "clinic-dev-runner", "CI runner", world_open(22))
    floci.postgres("clinic-dev-db", "db.t3.medium", "15.6", 20, subnets, sg_db, public=True, encrypted=False, backup_days=0)
    floci.instance("clinic-dev-runner", "m5.2xlarge", 100, subnets[0], sg_runner)
    floci.loose_volume("clinic-dev-scratch", 200, "gp3")


def build():
    print("Building the clinic-booking estate (clinic- prefix)...")
    prod()
    staging()
    dev()
    print("Clinic-booking estate built.")


def series():
    api = lambda env: {"ClusterName": f"clinic-{env}", "ServiceName": "api"}
    db = lambda env: {"DBInstanceIdentifier": f"clinic-{env}-db"}
    alb = lambda env: {"LoadBalancer": floci.load_balancer_dimension(f"clinic-{env}-alb")}
    return [
        ("AWS/ApplicationELB", "RequestCount", alb("prod"), "Count", shaped(61_000_000 / WINDOW_HOURS)),
        ("AWS/ECS", "CPUUtilization", api("prod"), "Percent", shaped(31)),
        ("AWS/ECS", "MemoryUtilization", api("prod"), "Percent", flat(44)),
        ("AWS/RDS", "CPUUtilization", db("prod"), "Percent", shaped(24)),
        ("AWS/RDS", "DatabaseConnections", db("prod"), "Count", shaped(118)),
        ("AWS/RDS", "ReadIOPS", db("prod"), "Count/Second", shaped(900)),
        ("AWS/RDS", "WriteIOPS", db("prod"), "Count/Second", shaped(310)),
        ("AWS/ElastiCache", "CPUUtilization", {"CacheClusterId": "clinic-prod-cache", "CacheNodeId": "0001"}, "Percent", shaped(11)),
        ("AWS/ElastiCache", "CurrConnections", {"CacheClusterId": "clinic-prod-cache", "CacheNodeId": "0001"}, "Count", shaped(64)),
        ("AWS/ElastiCache", "CacheHitRate", {"CacheClusterId": "clinic-prod-cache", "CacheNodeId": "0001"}, "Percent", flat(91)),
        ("AWS/SQS", "NumberOfMessagesSent", {"QueueName": "clinic-prod-reminders"}, "Count", shaped(1_260_000 / WINDOW_HOURS)),
        ("AWS/SQS", "NumberOfMessagesReceived", {"QueueName": "clinic-prod-reminders"}, "Count", shaped(1_262_000 / WINDOW_HOURS)),
        ("AWS/Lambda", "Invocations", {"FunctionName": "clinic-prod-notifier"}, "Count", shaped(1_262_000 / WINDOW_HOURS)),
        ("AWS/Lambda", "Duration", {"FunctionName": "clinic-prod-notifier"}, "Milliseconds", flat(340)),
        ("AWS/NATGateway", "BytesOutToDestination", {"NatGatewayId": floci.nat_id("clinic-prod")}, "Bytes", shaped(185 / WINDOW_HOURS * GB)),
        ("AWS/ApplicationELB", "RequestCount", alb("staging"), "Count", flat(210_000 / WINDOW_HOURS)),
        ("AWS/ECS", "CPUUtilization", api("staging"), "Percent", flat(2.4)),
        ("AWS/ECS", "MemoryUtilization", api("staging"), "Percent", flat(19)),
        ("AWS/RDS", "CPUUtilization", db("staging"), "Percent", flat(3)),
        ("AWS/RDS", "DatabaseConnections", db("staging"), "Count", flat(6)),
        ("AWS/RDS", "CPUUtilization", db("dev"), "Percent", shaped(4)),
        ("AWS/RDS", "DatabaseConnections", db("dev"), "Count", shaped(3)),
        ("AWS/EC2", "CPUUtilization", {"InstanceId": floci.instance_id("clinic-dev-runner")}, "Percent", flat(1.6)),
    ]

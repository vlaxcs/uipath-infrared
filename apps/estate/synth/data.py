"""Databases, caches, storage, messaging, serverless, observability. Classic data-tier mistakes."""
import json
from .common import client, attempt, plant, link, lambda_zip

rds = client("rds")
ec = client("elasticache")
ddb = client("dynamodb")
s3 = client("s3")
sqs = client("sqs")
sns = client("sns")
kin = client("kinesis")
lam = client("lambda")
logs = client("logs")
cw = client("cloudwatch")
sm = client("secretsmanager")
ssm = client("ssm")
kms = client("kms")
efs = client("efs")


def databases(ctx):
    ctx["db"] = {}
    groups = {"shop": ("shop-db-subnets", ctx["shop_subnets"], ctx["db_sg"]),
              "data": ("data-db-subnets", ctx["data_subnets"], ctx["data_sg"]),
              "legacy": ("legacy-db-subnets", ctx["legacy_subnets"], ctx["legacy_sg"])}
    for key, (gname, subnets, _) in groups.items():
        attempt(f"db subnet group {gname}", rds.create_db_subnet_group, DBSubnetGroupName=gname,
                DBSubnetGroupDescription=gname, SubnetIds=subnets)
        link(gname, ctx[f"{key}_vpc"], "network", "DB subnet group lives in this VPC")
    plant("data-platform", "rds", "data-db-subnets", "DB subnet group spans only one AZ (all 3 subnets in us-east-1a): Multi-AZ/failover impossible", "reliability", "high")
    plant("shop-prod", "rds", "shop-db-subnets", "DB subnet group uses public subnets (route to IGW) with PubliclyAccessible=true", "security", "high")

    def dbkw(key):
        gname, _, sgid = groups[key]
        return dict(DBSubnetGroupName=gname, VpcSecurityGroupIds=[sgid])

    common = dict(MasterUsername="admin_user", MasterUserPassword="Password123", PubliclyAccessible=True,
                  MultiAZ=False, BackupRetentionPeriod=0, StorageEncrypted=False, DeletionProtection=False,
                  AutoMinorVersionUpgrade=False, EnablePerformanceInsights=False)
    specs = [  # id, class, storage, engine, version, stack, vpc key, extra issue
        ("shop-orders-db", "db.r5.8xlarge", 2000, "postgres", "11.22", "shop-prod", "shop", "Engine 11.x is EOL (RDS Extended Support billing)"),
        ("shop-orders-db-copy", "db.r5.8xlarge", 2000, "postgres", "11.22", "shop-prod", "shop", "Full-size 'temporary' copy of prod DB left running 24/7, referenced by nothing"),
        ("shop-analytics-db", "db.m4.4xlarge", 1000, "postgres", "12.18", "shop-prod", "shop", "Analytics queries hit the OLTP primary; no read replica; previous-gen m4 class"),
        ("legacy-erp-db", "db.r4.4xlarge", 500, "postgres", "11.22", "legacy", "legacy", "Previous-gen r4 class, EOL engine"),
    ]
    for ident, klass, size, eng, ver, stack, key, extra in specs:
        r = attempt(f"rds {ident}", rds.create_db_instance, DBInstanceIdentifier=ident, DBInstanceClass=klass,
                    Engine=eng, EngineVersion=ver, AllocatedStorage=size, StorageType="gp2", **dbkw(key), **common)
        if not r:
            continue
        ep = r["DBInstance"].get("Endpoint", {})
        ctx["db"][ident] = f"{ep.get('Address', ident)}:{ep.get('Port', 5432)}"
        link(ident, groups[key][0], "network", "placed via DB subnet group")
        link(ident, groups[key][2], "network", "VPC security group")
        plant(stack, "rds", ident, f"{klass} with {size}GB gp2 - heavily oversized for observed load (<10% CPU); gp2 not gp3", "cost", "high")
        plant(stack, "rds", ident, "Single-AZ (MultiAZ=false), backup retention 0 (no PITR), no deletion protection", "reliability", "critical")
        plant(stack, "rds", ident, "PubliclyAccessible=true, StorageEncrypted=false, weak master password", "security", "critical")
        plant(stack, "rds", ident, "Performance Insights and enhanced monitoring off; auto minor upgrades disabled", "ops", "medium")
        plant(stack, "rds", ident, extra, "cost" if "copy" in ident or "m4" in extra else "reliability", "high")

    # Aurora cluster: oversized instances for tiny load
    if attempt("aurora cluster", rds.create_db_cluster, DBClusterIdentifier="data-aurora", Engine="aurora-postgresql",
               EngineVersion="11.21", MasterUsername="admin_user", MasterUserPassword="Password123",
               BackupRetentionPeriod=1, StorageEncrypted=False, DeletionProtection=False,
               DBSubnetGroupName=groups["data"][0]):
        for i, k in enumerate(["db.r5.4xlarge", "db.r5.4xlarge"]):
            r = attempt(f"aurora inst {i}", rds.create_db_instance, DBInstanceIdentifier=f"data-aurora-{i}", DBInstanceClass=k,
                        Engine="aurora-postgresql", DBClusterIdentifier="data-aurora", PubliclyAccessible=True)
            if r:
                link(f"data-aurora-{i}", "data-aurora", "data", "cluster member")
                ep = r["DBInstance"].get("Endpoint", {})
                ctx["db"].setdefault("data-aurora", f"{ep.get('Address', 'data-aurora')}:{ep.get('Port', 5432)}")
        link("data-aurora", "data-db-subnets", "network", "cluster subnet group")
        plant("data-platform", "rds", "data-aurora", "Cluster runs in the default security group (sg-00000000), not a dedicated least-privilege SG", "security", "medium")
        plant("data-platform", "rds", "data-aurora", "Aurora cluster of 2x r5.4xlarge for a few QPS (Serverless v2 would fit); unencrypted, public instances, 1-day backups", "cost", "high")


def cache(ctx):
    if attempt("redis", ec.create_cache_cluster, CacheClusterId="shop-sessions", Engine="redis", CacheNodeType="cache.r5.4xlarge",
               NumCacheNodes=1, AutoMinorVersionUpgrade=False, SnapshotRetentionLimit=0):
        plant("shop-prod", "elasticache", "shop-sessions", "Single-node Redis cache.r5.4xlarge (~104GB) for small session data: no replica/failover, no snapshots, no TLS/AUTH, oversized", "reliability", "high")
    if attempt("memcached", ec.create_cache_cluster, CacheClusterId="legacy-memcache", Engine="memcached",
               CacheNodeType="cache.m4.2xlarge", NumCacheNodes=4):
        plant("legacy", "elasticache", "legacy-memcache", "4-node previous-gen memcached, unauthenticated, unused by the app after migration", "cost", "medium")


def dynamo(ctx):
    def table(name, pk, rcu, wcu, gsis=(), mode="PROVISIONED"):
        attrs = {pk} | {g[1] for g in gsis}
        kw = dict(TableName=name, AttributeDefinitions=[{"AttributeName": a, "AttributeType": "S"} for a in attrs],
                  KeySchema=[{"AttributeName": pk, "KeyType": "HASH"}])
        if mode == "PROVISIONED":
            kw["ProvisionedThroughput"] = {"ReadCapacityUnits": rcu, "WriteCapacityUnits": wcu}
        else:
            kw["BillingMode"] = "PAY_PER_REQUEST"
        if gsis:
            kw["GlobalSecondaryIndexes"] = [dict(IndexName=g[0], KeySchema=[{"AttributeName": g[1], "KeyType": "HASH"}],
                                                 Projection={"ProjectionType": "ALL"},
                                                 **({"ProvisionedThroughput": {"ReadCapacityUnits": rcu, "WriteCapacityUnits": wcu}} if mode == "PROVISIONED" else {}))
                                            for g in gsis]
        return attempt(f"ddb {name}", ddb.create_table, **kw)

    if table("shop-orders", "status", 8000, 4000, [("by-customer", "customer_id"), ("by-created", "created_day")]):
        plant("shop-prod", "dynamodb", "shop-orders", "Partition key 'status' has ~5 distinct values -> hot partitions/throttling", "performance", "critical")
        plant("shop-prod", "dynamodb", "shop-orders", "8000 RCU/4000 WCU provisioned, no auto scaling, replicated on 2 GSIs with ALL projection (3x write cost)", "cost", "high")
        plant("shop-prod", "dynamodb", "shop-orders", "No PITR, no TTL, no deletion protection, default (AWS-owned) encryption only", "reliability", "medium")
    if table("shop-sessions", "session_id", 2000, 2000):
        plant("shop-prod", "dynamodb", "shop-sessions", "Session table has no TTL attribute -> unbounded growth; provisioned far above use", "cost", "medium")
    if table("events-raw", "event_type", 0, 0, [("by-user", "user_id"), ("by-device", "device_id"), ("by-ip", "ip")], mode="PAY_PER_REQUEST"):
        plant("data-platform", "dynamodb", "events-raw", "On-demand table with low-cardinality key 'event_type' (hot partition) and 3 ALL-projection GSIs (4x write amplification)", "performance", "high")
    if table("legacy-audit", "id", 1000, 1000):
        plant("legacy", "dynamodb", "legacy-audit", "Write-once audit log provisioned at 1000/1000 with zero reads - candidate for on-demand/S3", "cost", "medium")


def storage(ctx):
    pol_public = lambda b: json.dumps({"Version": "2012-10-17", "Statement": [{
        "Effect": "Allow", "Principal": "*", "Action": ["s3:GetObject", "s3:PutObject"], "Resource": f"arn:aws:s3:::{b}/*"}]})
    buckets = {
        "shop-prod-assets": ("shop-prod", "public-read policy, no versioning, no lifecycle, no encryption config, no access logging"),
        "shop-prod-uploads": ("shop-prod", "Public PutObject+GetObject via bucket policy (anonymous uploads), no encryption"),
        "shop-prod-backups": ("shop-prod", "DB backups in STANDARD forever, no lifecycle to Glacier/expiry, no versioning/MFA delete"),
        "data-lake-raw": ("data-platform", "Raw data in STANDARD, millions of small objects, flat prefix (no date partitioning), no lifecycle/intelligent tiering"),
        "data-lake-logs": ("data-platform", "Access logs accumulating forever with no expiration"),
        "legacy-reports": ("legacy", "Public bucket, reports contain customer data, no encryption"),
    }
    for b, (stack, why) in buckets.items():
        if not attempt(f"s3 {b}", s3.create_bucket, Bucket=b):
            continue
        plant(stack, "s3", b, why, "security" if "ublic" in why else "cost", "critical" if "ublic" in why else "medium")
        if "ublic" in why or "assets" in b:
            attempt(f"policy {b}", s3.put_bucket_policy, Bucket=b, Policy=pol_public(b))
    # many small objects, flat keys
    for i in range(300):
        s3.put_object(Bucket="data-lake-raw", Key=f"event-{i:06d}.json", Body=b'{"e":%d}' % i)
    for i in range(40):
        s3.put_object(Bucket="shop-prod-backups", Key=f"db-dump-2020-{i:03d}.sql", Body=b"-- dump " * 1000)
    s3.put_object(Bucket="legacy-reports", Key="customers_export.csv", Body=b"name,email,ssn\nJane,jane@example.com,000-00-0000\n")
    plant("legacy", "s3", "legacy-reports/customers_export.csv", "PII (SSN column) in a publicly readable bucket", "security", "critical")
    # 2 EFS file systems
    for n, mode in (("shop-shared", 1024), ("legacy-nfs", 512)):
        if attempt(f"efs {n}", efs.create_file_system, CreationToken=n, ThroughputMode="provisioned",
                   ProvisionedThroughputInMibps=mode, Encrypted=False):
            plant("shop-prod" if "shop" in n else "legacy", "efs", n, f"Provisioned throughput {mode} MiB/s (~${mode*6}/mo) on a mostly idle FS; unencrypted; no lifecycle to IA, no backup", "cost", "high")


def messaging(ctx):
    ctx["queues"] = {}
    for q, why in {"shop-orders": "no DLQ, 0s visibility timeout (duplicate processing), short polling (ReceiveMessageWaitTimeSeconds=0), 14d retention",
                   "shop-emails": "no DLQ, short polling, unencrypted",
                   "legacy-jobs": "no DLQ; backlog never drained; short polling"}.items():
        if attempt(f"sqs {q}", sqs.create_queue, QueueName=q, Attributes={
                "VisibilityTimeout": "0", "ReceiveMessageWaitTimeSeconds": "0", "MessageRetentionPeriod": "1209600"}):
            plant("shop-prod" if "shop" in q else "legacy", "sqs", q, why, "reliability", "high")
            ctx["queues"][q] = sqs.get_queue_url(QueueName=q)["QueueUrl"]
    url = sqs.get_queue_url(QueueName="legacy-jobs")["QueueUrl"]
    for i in range(50):
        sqs.send_message(QueueUrl=url, MessageBody=json.dumps({"job": i, "stale": True}))
    plant("legacy", "sqs", "legacy-jobs", "Backlog of unprocessed messages with no consumer or alarm", "ops", "medium")
    t = attempt("sns", sns.create_topic, Name="shop-alerts")
    if t:
        ctx["topic_arn"] = t["TopicArn"]
        sns.subscribe(TopicArn=t["TopicArn"], Protocol="http", Endpoint="http://alerts.example.com/hook")
        plant("shop-prod", "sns", "shop-alerts", "Plain-HTTP subscription, topic unencrypted, no DLQ on subscription", "security", "medium")
    if attempt("kinesis", kin.create_stream, StreamName="clickstream", ShardCount=50):
        plant("data-platform", "kinesis", "clickstream", "50 provisioned shards (~$550/mo) for ~100 KB/s; on-demand or 1-2 shards would do; no enhanced fan-out, no encryption", "cost", "high")


def serverless(ctx):
    db = ctx.get("db", {})
    fns = {  # runtime, mem, timeout, why, db host, stack, in_vpc
        "shop-resize-image": ("python3.8", 3008, 900, "Max memory, 15-min timeout for a task that takes seconds; deprecated python3.8", "shop-orders-db", "shop-prod", True),
        "shop-send-email": ("nodejs14.x", 3008, 900, "Deprecated Node 14, max memory", "shop-orders-db", "shop-prod", True),
        "legacy-cron": ("python3.7", 2048, 900, "Deprecated python3.7; runs every minute via cron", "legacy-erp-db", "legacy", False),
    }
    ctx["lambda_arns"] = {}
    for n, (rt, mem, to, why, dbname, stack, in_vpc) in fns.items():
        kw = {}
        if in_vpc:  # one public subnet, wide-open SG; no NAT so it cannot reach the internet anyway
            kw["VpcConfig"] = {"SubnetIds": ctx["shop_subnets"][:1], "SecurityGroupIds": [ctx["shop_sg"]]}
        r = attempt(f"lambda {n}", lam.create_function, FunctionName=n, Runtime=rt, Role=ctx["lambda_role"], Handler="index.handler",
                    Code={"ZipFile": lambda_zip()}, MemorySize=mem, Timeout=to,
                    Environment={"Variables": {"DB_HOST": db.get(dbname, ""), "DB_USER": "admin_user", "DB_PASSWORD": "Password123",
                                               "STRIPE_KEY": "sk_live_51H8EXAMPLEEXAMPLE", "DEBUG": "true"}}, **kw)
        if not r:
            continue
        ctx["lambda_arns"][n] = r.get("FunctionArn", f"arn:aws:lambda:us-east-1:000000000000:function:{n}")
        link(n, dbname, "data", "DB_HOST env var, connects with admin credentials")
        link(n, ctx["lambda_role"], "config", "execution role (AdministratorAccess)")
        if in_vpc:
            link(n, ctx["shop_sg"], "network", "VPC-attached Lambda")
            plant(stack, "lambda", n, "VPC-attached into a single public subnet with wide-open SG and no NAT/endpoints: no internet or AWS API egress, single-AZ", "reliability", "high")
        plant(stack, "lambda", n, why, "cost", "medium")
        plant(stack, "lambda", n, "Secrets in plaintext env vars, no DLQ/destinations, no reserved concurrency, shares admin role, no X-Ray", "security", "high")


def observability(ctx):
    for g in ["/ecs/orders-api", "/ecs/invoice-worker", "/aws/lambda/shop-resize-image", "/aws/eks/shop-prod/cluster",
              "/shop/app/debug", "/legacy/app", "/data/spark-driver"]:
        attempt(f"log group {g}", logs.create_log_group, logGroupName=g)
    plant("shared", "logs", "7 log groups", "No retention policy (never expire), DEBUG-level app logging, no metric filters, not encrypted with KMS", "cost", "medium")
    # alarm that notifies nobody, on the wrong metric, plus nothing on RDS/ALB 5xx/EKS
    attempt("alarm", cw.put_metric_alarm, AlarmName="cpu-high-maybe", MetricName="CPUUtilization", Namespace="AWS/EC2",
            Statistic="Average", Period=3600, EvaluationPeriods=1, Threshold=99.9, ComparisonOperator="GreaterThanThreshold")
    plant("shared", "cloudwatch", "cpu-high-maybe", "Only alarm in the account: 1h period, 99.9% threshold, no actions. No alarms on RDS, ALB 5xx, SQS depth, DynamoDB throttles, EKS", "ops", "high")
    plant("shared", "cloudtrail/guardduty/config", "account", "No CloudTrail, GuardDuty, AWS Config or Security Hub enabled", "security", "critical")
    plant("shared", "backup", "account", "No AWS Backup plans, no cross-region copies", "reliability", "high")
    plant("shared", "tagging", "account", "No cost-allocation tags (owner/env/cost-center) on anything", "ops", "medium")
    # secrets & params
    for n in ("shop/db-password", "shop/stripe-key", "legacy/ftp-creds"):
        attempt(f"secret {n}", sm.create_secret, Name=n, SecretString="hunter2")
    plant("shared", "secretsmanager", "3 secrets", "No rotation, default KMS key, same weak value reused", "security", "medium")
    for n in ("/shop/prod/db_password", "/shop/prod/api_key", "/legacy/admin_pass"):
        attempt(f"ssm {n}", ssm.put_parameter, Name=n, Value="Summer2019!", Type="String")
    plant("shared", "ssm", "3 parameters", "Credentials stored as plain String (not SecureString)", "security", "high")
    for i in range(3):
        attempt(f"kms {i}", kms.create_key, Description=f"unused-key-{i}")
    plant("shared", "kms", "3 CMKs", "Customer keys with no rotation, no alias, no usage ($1/mo each)", "cost", "low")


def build(ctx):
    for fn in (databases, cache, dynamo, storage, messaging, serverless, observability):
        print(f"-- {fn.__name__}")
        fn(ctx)

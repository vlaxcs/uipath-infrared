"""Cross-service connections: event sources, targets, delivery streams, DNS. Runs last."""
import json
from .common import client, attempt, plant, link

elb = client("elbv2")
ec2 = client("ec2")
ecs = client("ecs")
lam = client("lambda")
sqs = client("sqs")
sns = client("sns")
s3 = client("s3")
events = client("events")
firehose = client("firehose")
r53 = client("route53")
iam = client("iam")
ACCOUNT = "000000000000"


def queue_arn(ctx, q):
    return sqs.get_queue_attributes(QueueUrl=ctx["queues"][q], AttributeNames=["QueueArn"])["Attributes"]["QueueArn"]


def alb_targets(ctx):
    # Floci registers targets itself and asynchronously (ASG reconciler -> shop-alb-tg, ECS registrar -> legacy-alb-tg),
    # and would deregister anything added by hand, so only record the intent here.
    if ctx.get("shop_tg"):
        plant("shop-prod", "elbv2", "shop-alb", "All ASG targets live in one subnet/AZ although the ALB spans 2: an AZ failure takes the web tier down", "reliability", "high")


def events_and_lambdas(ctx):
    arns = ctx.get("lambda_arns", {})
    # SNS shop-alerts -> SQS shop-emails -> Lambda shop-send-email (batch 1, no partial-batch response)
    if ctx.get("topic_arn") and "shop-emails" in ctx.get("queues", {}):
        if attempt("sns->sqs", sns.subscribe, TopicArn=ctx["topic_arn"], Protocol="sqs", Endpoint=queue_arn(ctx, "shop-emails")):
            link("shop-alerts", "shop-emails", "event", "SNS fan-out into SQS (no filter policy, no raw delivery)")
    if "shop-send-email" in arns and "shop-emails" in ctx.get("queues", {}):
        if attempt("sqs->lambda shop-emails", lam.create_event_source_mapping, EventSourceArn=queue_arn(ctx, "shop-emails"),
                   FunctionName="shop-send-email", BatchSize=1):
            link("shop-emails", "shop-send-email", "event", "event source mapping, BatchSize=1")
            plant("shop-prod", "lambda", "shop-send-email", "SQS event source mapping BatchSize=1 (one invocation per message), no partial-batch failure reporting, no maximum concurrency; queue visibility 0 < function timeout 900s causes redelivery storms", "performance", "high")
    # EventBridge schedule -> legacy-cron every minute
    if "legacy-cron" in arns:
        if attempt("events rule", events.put_rule, Name="legacy-cron-every-minute", ScheduleExpression="rate(1 minute)", State="ENABLED"):
            attempt("events target", events.put_targets, Rule="legacy-cron-every-minute",
                    Targets=[{"Id": "1", "Arn": arns["legacy-cron"]}])
            attempt("lambda perm events", lam.add_permission, FunctionName="legacy-cron", StatementId="events",
                    Action="lambda:InvokeFunction", Principal="events.amazonaws.com")
            link("legacy-cron-every-minute", "legacy-cron", "event", "EventBridge schedule rate(1 minute)")
            link("legacy-cron", "legacy-erp-db", "data", "cron job hits the legacy ERP DB every minute")
            plant("legacy", "events", "legacy-cron-every-minute", "Runs every minute (1440/day) a job whose work changes daily; each run is a cold-start-prone 2GB Lambda", "cost", "medium")
    # S3 uploads -> Lambda shop-resize-image
    if "shop-resize-image" in arns:
        attempt("lambda perm s3", lam.add_permission, FunctionName="shop-resize-image", StatementId="s3",
                Action="lambda:InvokeFunction", Principal="s3.amazonaws.com", SourceArn="arn:aws:s3:::shop-prod-uploads")
        if attempt("s3 notification", s3.put_bucket_notification_configuration, Bucket="shop-prod-uploads",
                   NotificationConfiguration={"LambdaFunctionConfigurations": [
                       {"LambdaFunctionArn": arns["shop-resize-image"], "Events": ["s3:ObjectCreated:*"]}]}):
            link("shop-prod-uploads", "shop-resize-image", "event", "S3 ObjectCreated notification (bucket allows anonymous PutObject)")
            plant("shop-prod", "s3", "shop-prod-uploads", "Anonymous uploads trigger a 3GB Lambda: unauthenticated users can drive compute cost / DoS", "security", "critical")
    # app config referencing the infra
    for cluster in ("shop-prod",):
        link(cluster, "shop-orders-db", "data", "pods use the orders DB (node role has admin, DB is public)")
        link(cluster, "shop-sessions", "data", "session store (Redis)")
        link(cluster, "shop-orders", "event", "order queue producer/consumer")
    link("shop-sessions", ctx["shop_sg"], "network", "cache SG")


def streaming(ctx):
    role = f"arn:aws:iam::{ACCOUNT}:role/eks-node-role"
    if attempt("firehose", firehose.create_delivery_stream, DeliveryStreamName="clickstream-to-lake",
               DeliveryStreamType="KinesisStreamAsSource",
               KinesisStreamSourceConfiguration={"KinesisStreamARN": f"arn:aws:kinesis:us-east-1:{ACCOUNT}:stream/clickstream", "RoleARN": role},
               ExtendedS3DestinationConfiguration={
                   "RoleARN": role, "BucketARN": "arn:aws:s3:::data-lake-raw",
                   "BufferingHints": {"IntervalInSeconds": 60, "SizeInMBs": 1},
                   "CompressionFormat": "UNCOMPRESSED"}):
        link("clickstream", "clickstream-to-lake", "data", "Kinesis -> Firehose")
        link("clickstream-to-lake", "data-lake-raw", "data", "Firehose -> S3, 60s/1MB buffer, uncompressed, no prefix")
        plant("data-platform", "firehose", "clickstream-to-lake", "1MB/60s buffer, uncompressed, no date-partitioned prefix or Parquet conversion -> endless tiny objects in data-lake-raw", "performance", "high")
    link("data-platform", "data-aurora", "data", "Spark jobs read/write Aurora")
    link("data-platform", "data-lake-raw", "data", "Spark reads the raw lake")
    link("data-platform", "events-raw", "data", "ingest target")


def dns(ctx):
    for zone, dnsname, stack in (("shop-example.com", ctx.get("shop_alb_dns"), "shop-prod"),
                                 ("legacy-example.com", ctx.get("legacy_alb_dns"), "legacy")):
        z = attempt(f"hosted zone {zone}", r53.create_hosted_zone, Name=zone, CallerReference=zone)
        if not z or "HostedZone" not in z or not dnsname:
            continue
        attempt(f"record www.{zone}", r53.change_resource_record_sets, HostedZoneId=z["HostedZone"]["Id"],
                ChangeBatch={"Changes": [{"Action": "UPSERT", "ResourceRecordSet": {
                    "Name": f"www.{zone}", "Type": "CNAME", "TTL": 5, "ResourceRecords": [{"Value": dnsname}]}}]})
        link(f"www.{zone}", "shop-alb" if "shop" in zone else "legacy-alb", "dns", "CNAME, TTL 5s")
        plant(stack, "route53", f"www.{zone}", "5s TTL (no caching benefit, resolver load), CNAME instead of alias, no health check/failover record", "performance", "low")


def build(ctx):
    for fn in (alb_targets, events_and_lambdas, streaming, dns):
        print(f"-- {fn.__name__}")
        try:
            fn(ctx)
        except Exception as e:  # noqa: BLE001 - one failing link shouldn't stop the others
            print(f"  FAIL {fn.__name__}: {str(e)[:200]}")

import re
import statistics
from datetime import datetime, timedelta, timezone
from typing import Any

from agent.adapters.aws import client
from agent.application.tools import Tool, answer, refuse

READ_ONLY = re.compile(r"^(describe|list|get|batch_get|lookup)_")


def aws_read(arguments: dict[str, Any]) -> dict:
    operation = arguments["operation"]
    if not READ_ONLY.match(operation):
        return refuse(f"'{operation}' rejected: only describe_/list_/get_/batch_get_/lookup_ operations are allowed")
    try:
        response = getattr(client(arguments["service"]), operation)(**(arguments.get("params") or {}))
    except Exception as error:
        return refuse(f"{type(error).__name__}: {error}")
    response.pop("ResponseMetadata", None)
    return answer(response)


def list_metrics(arguments: dict[str, Any]) -> dict:
    cloudwatch = client("cloudwatch")
    namespace = {"Namespace": arguments["namespace"]} if arguments.get("namespace") else {}
    needle = (arguments.get("dimension_contains") or "").lower()
    series = []
    for page in cloudwatch.get_paginator("list_metrics").paginate(**namespace):
        for metric in page["Metrics"]:
            dimensions = {d["Name"]: d["Value"] for d in metric.get("Dimensions", [])}
            if needle and not any(needle in value.lower() for value in dimensions.values()):
                continue
            series.append({"ns": metric["Namespace"], "metric": metric["MetricName"], "dims": dimensions})
    return answer(series)


def metric_summary(arguments: dict[str, Any]) -> dict:
    days = int(arguments.get("days") or 14)
    stat = arguments.get("stat") or "Average"
    end = datetime.now(timezone.utc)
    try:
        response = client("cloudwatch").get_metric_statistics(
            Namespace=arguments["namespace"], MetricName=arguments["metric"],
            Dimensions=[{"Name": k, "Value": v} for k, v in (arguments.get("dimensions") or {}).items()],
            StartTime=end - timedelta(days=days), EndTime=end, Period=3600, Statistics=[stat],
        )
    except Exception as error:
        return refuse(f"{type(error).__name__}: {error}")
    points = sorted(response["Datapoints"], key=lambda p: p["Timestamp"])
    values = [p[stat] for p in points]
    if not values:
        return answer({"n": 0, "note": "no datapoints; check list_metrics for exact dimensions"})
    quantiles = statistics.quantiles(values, n=20) if len(values) >= 2 else [values[0]] * 19
    half = len(values) // 2 or 1
    return answer({
        "n": len(values), "stat": stat, "unit": points[0].get("Unit"), "window_days": days,
        "avg": statistics.fmean(values), "min": min(values), "p50": statistics.median(values), "p95": quantiles[18],
        "max": max(values), "sum": sum(values),
        "first_half_avg": statistics.fmean(values[:half]), "second_half_avg": statistics.fmean(values[half:]),
        "provenance": "synthetic",
    })


READ_TOOLS = (
    Tool(
        "aws_read",
        "Call a read-only boto3 operation against the estate. service e.g. ec2, rds, eks, ecs, elbv2, "
        "elasticache, dynamodb, s3, sqs, lambda, kinesis, efs, iam, route53. operation is the snake_case "
        "boto3 method (describe_*, list_*, get_*). params is a JSON object of kwargs. Responses are "
        "truncated at ~20k chars, so filter with params where possible.",
        {"service": str, "operation": str, "params": dict},
        aws_read,
    ),
    Tool(
        "list_metrics",
        "List CloudWatch metric series (namespace, name, dimensions). Filter by namespace and/or a "
        "substring that must appear in a dimension value (e.g. a resource id or name).",
        {"namespace": str, "dimension_contains": str},
        list_metrics,
    ),
    Tool(
        "metric_summary",
        "Summarise one CloudWatch series over the last N days (default 14): avg, min, p50, p95, max, "
        "sum, n, plus a first-half vs second-half average to show trend. dimensions is {Name: Value}. "
        "NOTE: data is synthetic (floci produces none), so cite provenance 'synthetic'.",
        {"namespace": str, "metric": str, "dimensions": dict, "stat": str, "days": int},
        metric_summary,
    ),
)

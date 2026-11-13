"""Read-only AWS tools for the optimizer agent, exposed as an in-process MCP server.

The agent can observe the estate and record findings; it can never mutate AWS. Proposed changes are
stored as dry-run scripts on disk for a human to review.
"""
import json
import re
import statistics
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from claude_agent_sdk import create_sdk_mcp_server, tool

from agent.aws import client

OUT = Path(__file__).resolve().parent.parent / "out"
FINDINGS = OUT / "findings.jsonl"
DRYRUN = OUT / "dryrun"

READ_ONLY = re.compile(r"^(describe|list|get|batch_get|lookup)_")
MAX_CHARS = 20000


def _text(obj: Any) -> dict:
    s = obj if isinstance(obj, str) else json.dumps(obj, default=str, indent=1)
    if len(s) > MAX_CHARS:
        s = s[:MAX_CHARS] + f"\n...[truncated {len(s) - MAX_CHARS} chars; narrow the call or use params]"
    return {"content": [{"type": "text", "text": s}]}


def _err(msg: str) -> dict:
    return {**_text(msg), "is_error": True}


@tool(
    "aws_read",
    "Call a read-only boto3 operation against the estate. service e.g. ec2, rds, eks, ecs, elbv2, "
    "elasticache, dynamodb, s3, sqs, lambda, kinesis, efs, iam, route53. operation is the snake_case "
    "boto3 method (describe_*, list_*, get_*). params is a JSON object of kwargs. Responses are "
    "truncated at ~20k chars, so filter with params where possible.",
    {"service": str, "operation": str, "params": dict},
)
async def aws_read(args: dict[str, Any]) -> dict:
    op = args["operation"]
    if not READ_ONLY.match(op):
        return _err(f"'{op}' rejected: only describe_/list_/get_/batch_get_/lookup_ operations are allowed")
    try:
        c = client(args["service"])
        fn = getattr(c, op)
        res = fn(**(args.get("params") or {}))
        res.pop("ResponseMetadata", None)
        return _text(res)
    except Exception as e:  # surface to the model so it can adjust
        return _err(f"{type(e).__name__}: {e}")


@tool(
    "list_metrics",
    "List CloudWatch metric series (namespace, name, dimensions). Filter by namespace and/or a "
    "substring that must appear in a dimension value (e.g. a resource id or name).",
    {"namespace": str, "dimension_contains": str},
)
async def list_metrics(args: dict[str, Any]) -> dict:
    cw = client("cloudwatch")
    kw = {"Namespace": args["namespace"]} if args.get("namespace") else {}
    needle = (args.get("dimension_contains") or "").lower()
    out, token = [], None
    while True:
        res = cw.list_metrics(**kw, **({"NextToken": token} if token else {}))
        for m in res["Metrics"]:
            dims = {d["Name"]: d["Value"] for d in m.get("Dimensions", [])}
            if needle and not any(needle in v.lower() for v in dims.values()):
                continue
            out.append({"ns": m["Namespace"], "metric": m["MetricName"], "dims": dims})
        token = res.get("NextToken")
        if not token:
            break
    return _text(out)


@tool(
    "metric_summary",
    "Summarise one CloudWatch series over the last N days (default 14): avg, min, p50, p95, max, "
    "sum, n, plus a first-half vs second-half average to show trend. dimensions is {Name: Value}. "
    "NOTE: data is synthetic (floci produces none), so cite provenance 'synthetic'.",
    {"namespace": str, "metric": str, "dimensions": dict, "stat": str, "days": int},
)
async def metric_summary(args: dict[str, Any]) -> dict:
    days = int(args.get("days") or 14)
    stat = args.get("stat") or "Average"
    end = datetime.now(timezone.utc)
    try:
        res = client("cloudwatch").get_metric_statistics(
            Namespace=args["namespace"], MetricName=args["metric"],
            Dimensions=[{"Name": k, "Value": v} for k, v in (args.get("dimensions") or {}).items()],
            StartTime=end - timedelta(days=days), EndTime=end, Period=3600, Statistics=[stat],
        )
    except Exception as e:
        return _err(f"{type(e).__name__}: {e}")
    pts = sorted(res["Datapoints"], key=lambda p: p["Timestamp"])
    vals = [p[stat] for p in pts]
    if not vals:
        return _text({"n": 0, "note": "no datapoints; check list_metrics for exact dimensions"})
    q = statistics.quantiles(vals, n=20) if len(vals) >= 2 else [vals[0]] * 19
    half = len(vals) // 2 or 1
    return _text({
        "n": len(vals), "stat": stat, "unit": pts[0].get("Unit"), "window_days": days,
        "avg": statistics.fmean(vals), "min": min(vals), "p50": statistics.median(vals), "p95": q[18],
        "max": max(vals), "sum": sum(vals),
        "first_half_avg": statistics.fmean(vals[:half]), "second_half_avg": statistics.fmean(vals[half:]),
        "provenance": "synthetic",
    })


@tool(
    "record_finding",
    "Record ONE optimization finding. Call once per distinct issue after you have evidence. "
    "category: rightsize|delete_idle|consolidate|migrate|modernize|storage_tiering|network|reliability|security. "
    "resources: ids/names affected. evidence: list of concrete observations (config values, metric numbers). "
    "monthly_saving_usd: rough estimate with the basis stated in saving_basis. confidence: low|medium|high "
    "(cap at medium when the evidence is only synthetic metrics). risk: what could break. "
    "migration_notes: for migrate/consolidate, what must move together and in what order. "
    "dry_run_script: bash with aws CLI (--endpoint-url) commands implementing the change, "
    "or empty. It is saved for human review and NEVER executed.",
    {
        "title": str, "category": str, "stack": str, "resources": list, "evidence": list,
        "recommendation": str, "monthly_saving_usd": float, "saving_basis": str, "confidence": str,
        "risk": str, "migration_notes": str, "dry_run_script": str,
    },
)
async def record_finding(args: dict[str, Any]) -> dict:
    OUT.mkdir(exist_ok=True)
    DRYRUN.mkdir(exist_ok=True)
    n = sum(1 for _ in FINDINGS.open()) + 1 if FINDINGS.exists() else 1
    fid = f"F{n:03d}"
    script = args.pop("dry_run_script", "") or ""
    rec = {"id": fid, **args}
    if script.strip():
        path = DRYRUN / f"{fid}.sh"
        path.write_text(
            "#!/usr/bin/env bash\n# DRY-RUN PROPOSAL - review before running. Not executed by the agent.\n"
            f"# {args.get('title', '')}\nset -euo pipefail\n"
            ': "${AWS_ENDPOINT_URL:?load the repo .env first: set -a; . ./.env; set +a}"\n' + script + "\n"
        )
        rec["dry_run_script"] = str(path.relative_to(OUT.parent))
    with FINDINGS.open("a") as f:
        f.write(json.dumps(rec) + "\n")
    return _text(f"recorded {fid}")


server = create_sdk_mcp_server("infra", tools=[aws_read, list_metrics, metric_summary, record_finding])
TOOL_NAMES = [f"mcp__infra__{t.name}" for t in (aws_read, list_metrics, metric_summary, record_finding)]

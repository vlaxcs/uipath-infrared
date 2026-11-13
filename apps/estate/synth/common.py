"""Shared helpers: boto3 clients pointed at floci, and the planted-issue ledger."""
import io
import json
import os
import zipfile

import boto3
from botocore.config import Config

from synth import settings

ACCOUNT = "000000000000"

_cfg = Config(retries={"max_attempts": 2}, connect_timeout=5, read_timeout=60)


def client(service):
    aws = settings.aws()
    return boto3.client(
        service,
        endpoint_url=aws.endpoint_url,
        region_name=aws.region,
        aws_access_key_id=aws.access_key_id,
        aws_secret_access_key=aws.secret_access_key,
        config=_cfg,
    )


LEDGER = []   # every deliberately planted flaw (ground truth for scoring the agent)
FAILURES = []  # things floci refused to create
EDGES = []     # intended dependencies between resources (ground truth for dependency discovery)


def plant(stack, service, resource, issue, category, severity="medium"):
    """Record a deliberately planted flaw. category: cost|performance|security|reliability|ops"""
    LEDGER.append(dict(stack=stack, service=service, resource=resource, issue=issue,
                       category=category, severity=severity))


def link(src, dst, kind, note=""):
    """Record a deliberate dependency: kind = network|traffic|event|data|config|dns"""
    EDGES.append(dict(src=src, dst=dst, kind=kind, note=note))


def attempt(label, fn, *a, **kw):
    """Run a create call; tolerate 'already exists' and record emulator gaps instead of dying."""
    try:
        r = fn(*a, **kw)
        print(f"  ok   {label}")
        return r
    except Exception as e:  # noqa: BLE001
        msg = str(e)
        if "AlreadyExist" in msg or "already exist" in msg or "InUse" in msg or "Conflict" in msg:
            print(f"  skip {label} (exists)")
            return {"_exists": True}
        print(f"  FAIL {label}: {msg[:160]}")
        FAILURES.append(dict(label=label, error=msg[:400]))
        return None


def lambda_zip(code="def handler(event, context):\n    return {'ok': True}\n"):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("index.py", code)
    return buf.getvalue()


def write_ledger(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(dict(issues=LEDGER, emulator_failures=FAILURES), f, indent=2)
    with open(os.path.join(os.path.dirname(path), "topology.json"), "w") as f:
        json.dump(dict(edges=EDGES), f, indent=2)

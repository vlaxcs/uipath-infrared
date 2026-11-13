import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

import pytest

from normalize_baseline import normalize

EXTRACTOR_DIR = Path(__file__).parent.parent
BASELINE = Path(__file__).parent / "fixtures" / "baseline.normalized.json"
STABLE_FIELDS = ("id", "name", "kind", "service", "parent", "stack", "sku", "quantity", "status", "stateful",
                 "zones", "engine", "security", "config", "tags", "provider", "region")


def floci_reachable():
    endpoint = os.environ.get("AWS_ENDPOINT_URL", "http://localhost:4566")
    try:
        with urllib.request.urlopen(f"{endpoint}/_localstack/health", timeout=3):
            return True
    except OSError:
        return False


def baseline_stacks(doc):
    return {s["id"] for s in doc.get("stacks", [])}


def restricted_to(doc, stacks):
    components = [c for c in doc["components"] if c.get("stack") in stacks]
    ids = {c["id"] for c in components}
    edges = [e for e in doc["edges"] if e["from"] in ids and e["to"] in ids]
    return components, edges


def comparable(component):
    view = {k: component.get(k) for k in STABLE_FIELDS}
    view["usage_keys"] = sorted(component.get("usage", {}))
    view["capacity_keys"] = sorted(component.get("capacity", {}))
    view["has_cost"] = "cost" in component
    if component.get("service") not in ("s3",):
        view["cost"] = component.get("cost")
    return view


def by_id(components):
    return {c["id"]: comparable(c) for c in components}


@pytest.mark.skipif(not floci_reachable(), reason="Floci is not reachable")
def test_extraction_matches_baseline_on_baseline_stacks(tmp_path):
    output = tmp_path / "extracted.json"
    subprocess.run([sys.executable, "extract_floci.py", "--out", str(output)], check=True, cwd=EXTRACTOR_DIR)

    baseline = normalize(json.loads(BASELINE.read_text()))
    extracted = normalize(json.loads(output.read_text()))
    stacks = baseline_stacks(baseline)

    assert extracted["schema_version"] == baseline["schema_version"]
    assert extracted["project"] == baseline["project"]
    assert extracted["controls"] == baseline["controls"]
    assert stacks <= baseline_stacks(extracted)

    baseline_components, baseline_edges = restricted_to(baseline, stacks)
    extracted_components, extracted_edges = restricted_to(extracted, stacks)

    assert by_id(extracted_components) == by_id(baseline_components)
    key = lambda e: json.dumps(e, sort_keys=True)
    assert sorted(map(key, extracted_edges)) == sorted(map(key, baseline_edges))

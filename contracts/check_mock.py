#!/usr/bin/env python3
"""Validate the contract files and the mock.

  python3 check_mock.py                       # all example files against their schemas + integrity checks
  python3 check_mock.py path/to/infra.json    # validate any extractor output (infra) instead of the mock

Needs `jsonschema` (pip install jsonschema). Exit code 0 = everything passed.
Checks beyond JSON Schema: unique ids, edge/parent/stack/stay_together references, node_group has a
kubernetes_cluster parent, every metric carries provenance (also enforced by schema), orphan/idle
components are not the target of 'traffic' edges, forecast scenario probabilities sum to 1,
catalog kinds/platform references are consistent, and every kind in the infra has a catalog option.
"""
import json
import sys
from collections import Counter
from pathlib import Path

try:
    from jsonschema import Draft202012Validator
except ImportError:
    sys.exit("jsonschema missing: pip install jsonschema")

HERE = Path(__file__).parent
errors, warnings = [], []


def load(p):
    return json.loads(Path(p).read_text())


def schema_check(label, doc, schema_file):
    v = Draft202012Validator(load(HERE / schema_file))
    errs = sorted(v.iter_errors(doc), key=lambda e: list(e.absolute_path))
    for e in errs:
        errors.append(f"[schema] {label}: /{'/'.join(map(str, e.absolute_path))}: {e.message[:200]}")
    print(f"  {'ok  ' if not errs else 'FAIL'} {label} vs {schema_file}" + (f" ({len(errs)} errors)" if errs else ""))


def infra_integrity(d):
    comps = d["components"]
    ids = [c["id"] for c in comps]
    for i, n in Counter(ids).items():
        if n > 1:
            errors.append(f"[integrity] duplicate component id {i}")
    idset = set(ids)
    by_id = {c["id"]: c for c in comps}
    stacks = {s["id"] for s in d.get("stacks", [])}
    for c in comps:
        if c.get("stack") and stacks and c["stack"] not in stacks:
            errors.append(f"[integrity] {c['id']}: unknown stack {c['stack']}")
        p = c.get("parent")
        if p:
            if p not in idset:
                errors.append(f"[integrity] {c['id']}: parent {p} does not exist")
            elif c["kind"] == "node_group" and by_id[p]["kind"] != "kubernetes_cluster":
                errors.append(f"[integrity] {c['id']}: node_group parent must be a kubernetes_cluster")
        if c["kind"] == "node_group" and not p:
            errors.append(f"[integrity] {c['id']}: node_group without parent")
        if c["status"] != "active" and not c.get("usage") and c["kind"] not in ("block_storage",):
            warnings.append(f"{c['id']}: status {c['status']} but no usage metrics to back it up")
        for k, m in c.get("usage", {}).items():
            if "provenance" not in m:
                errors.append(f"[integrity] {c['id']}.usage.{k}: no provenance")
        for k, m in c.get("capacity", {}).items():
            if "provenance" not in m:
                errors.append(f"[integrity] {c['id']}.capacity.{k}: no provenance")
        if c["quantity"] == 0 and c["status"] == "active":
            warnings.append(f"{c['id']}: quantity 0 but active")
    eids = [e.get("id") for e in d["edges"] if e.get("id")]
    for i, n in Counter(eids).items():
        if n > 1:
            errors.append(f"[integrity] duplicate edge id {i}")
    for e in d["edges"]:
        for end in ("from", "to"):
            if e[end] not in idset:
                errors.append(f"[integrity] edge {e.get('id', '?')}: {end}={e[end]} does not exist")
        if e["from"] == e["to"]:
            errors.append(f"[integrity] edge {e.get('id', '?')}: self loop")
        if e["kind"] == "traffic" and e["to"] in by_id and by_id[e["to"]]["status"] == "orphan":
            errors.append(f"[integrity] edge {e.get('id', '?')}: traffic into an orphan")
        if "gb_month" in e and "provenance" not in e["gb_month"]:
            errors.append(f"[integrity] edge {e.get('id', '?')}: gb_month without provenance")
    for g in d.get("stay_together", []):
        for m in g["members"]:
            if m not in idset:
                errors.append(f"[integrity] stay_together {g['id']}: member {m} does not exist")
    print(f"  {len(comps)} components, {len(d['edges'])} edges, {len(d.get('stay_together', []))} stay_together groups")
    prov = Counter()
    for c in comps:
        for sec in ("usage", "capacity"):
            for m in c.get(sec, {}).values():
                prov[f"{sec}:{m['provenance']}"] += 1
        if "cost" in c:
            prov[f"cost:{c['cost']['monthly_eur']['provenance']}"] += 1
    for e in d["edges"]:
        if "gb_month" in e:
            prov[f"edge_gb:{e['gb_month']['provenance']}"] += 1
    print("  provenance mix:", dict(sorted(prov.items())))
    tot = sum(c.get("cost", {}).get("monthly_eur", {}).get("value", 0) for c in comps)
    by_stack = Counter()
    for c in comps:
        by_stack[c.get("stack", "-")] += c.get("cost", {}).get("monthly_eur", {}).get("value", 0)
    print(f"  estimated current run cost: EUR {tot:,.0f}/month  by stack: {dict(by_stack)}")


def forecast_integrity(f):
    s = sum(v["probability"] for v in f["scenarios"].values())
    if abs(s - 1) > 1e-6:
        errors.append(f"[integrity] forecast scenario probabilities sum to {s}, expected 1")
    if "do_nothing" not in f["cto_settings"]["strategies_enabled"]:
        errors.append("[integrity] strategies_enabled must contain do_nothing")
    w = f["cto_settings"]["weights"]
    if sum(w.values()) <= 0:
        errors.append("[integrity] cto weights sum to 0")


def catalog_integrity(cat, infra=None):
    ids = [o["id"] for o in cat["options"]]
    for i, n in Counter(ids).items():
        if n > 1:
            errors.append(f"[integrity] duplicate catalog option {i}")
    plats = {p["id"] for p in cat.get("onprem_platforms", [])}
    for o in cat["options"]:
        if o["provider"] == "onprem":
            if o.get("platform") not in plats:
                errors.append(f"[integrity] {o['id']}: onprem option needs a known platform")
            if o["pricing"]["model"] != "onprem_allocated":
                errors.append(f"[integrity] {o['id']}: onprem option must use onprem_allocated pricing")
        elif o["pricing"]["model"] == "onprem_allocated":
            errors.append(f"[integrity] {o['id']}: onprem_allocated pricing on a non-onprem option")
        if o["pricing"]["model"] == "tiered_instance" and not o["pricing"].get("tiers"):
            errors.append(f"[integrity] {o['id']}: tiered_instance without tiers")
    if infra:
        have = {o["kind"] for o in cat["options"]}
        need = {c["kind"] for c in infra["components"]}
        miss = sorted(need - have - {"kubernetes_cluster", "stream", "queue", "cache", "block_storage", "file_system", "function", "load_balancer", "cdn", "dns", "other"})
        if miss:
            warnings.append(f"catalog has no option for kinds used in the infra: {miss}")
        uncovered = sorted(need - have)
        print(f"  kinds in infra without any catalog option (engine keeps them as-is): {uncovered}")


def main():
    args = sys.argv[1:]
    infra_path = Path(args[0]) if args else HERE / "mock/demo-shop.infra.json"
    print("infra")
    infra = load(infra_path)
    schema_check(infra_path.name, infra, "infra.schema.json")
    if not errors:
        infra_integrity(infra)
    if not args:
        print("forecast")
        f = load(HERE / "forecast.example.json")
        schema_check("forecast.example.json", f, "forecast.schema.json")
        forecast_integrity(f)
        print("catalog")
        c = load(HERE / "catalog.example.json")
        schema_check("catalog.example.json", c, "catalog.schema.json")
        catalog_integrity(c, infra)
    for w in warnings:
        print("  warn:", w)
    for e in errors:
        print("  ERROR", e)
    print("RESULT:", "FAILED" if errors else "OK", f"({len(errors)} errors, {len(warnings)} warnings)")
    sys.exit(1 if errors else 0)


main()

#!/usr/bin/env python3
"""Validate the contract files and the mock.

  python3 check_mock.py                       # all example files against their schemas + integrity checks
  python3 check_mock.py path/to/infra.json    # validate any extractor output (infra) instead of the mock
  python3 check_mock.py path/to/result.json   # validate any engine output (a file with `candidates`)
  python3 check_mock.py path/to/candidates.json   # validate agent proposals (a file with `proposed_by`)

Needs `jsonschema` (pip install jsonschema). Exit code 0 = everything passed.
Checks beyond JSON Schema: unique ids, edge/parent/stack/stay_together references, node_group has a
kubernetes_cluster parent, every metric carries provenance (also enforced by schema), orphan/idle
components are not the target of 'traffic' edges, forecast scenario probabilities sum to 1,
catalog kinds/platform references are consistent, and every kind in the infra has a catalog option.
Result: unique candidate ids, do_nothing present, feasible exactly when there are no violations,
violation_distance is the sum of the distances, exactly one of winner / closest_if_none_feasible,
only feasible candidates are scored and ranked, every loser says why, and component ids exist in the infra.
For the run example: the summary fields agree with the event log (see run_integrity.py).
Candidates: ids, builds_on, components, catalog options, regions and tiers (see candidates_integrity.py).
"""
import json
import sys
from collections import Counter
from pathlib import Path

try:
    from jsonschema import Draft202012Validator
except ImportError:
    sys.exit("jsonschema missing: pip install jsonschema")

from candidates_integrity import candidates_integrity_errors
from run_integrity import run_integrity_errors

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


def result_integrity(label, r, infra=None):
    def err(msg):
        errors.append(f"[integrity] {label}: {msg}")

    cands = r["candidates"]
    ids = [c["id"] for c in cands]
    for i, n in Counter(ids).items():
        if n > 1:
            err(f"duplicate candidate id {i}")
    by_id = {c["id"]: c for c in cands}
    if "do_nothing" not in by_id:
        err("candidates must contain do_nothing")
    known = {c["id"] for c in infra["components"]} if infra and infra["project"] == r["inputs"]["infra"] else None

    def check_component(where, comp):
        if known is not None and comp is not None and comp not in known:
            err(f"{where}: component {comp} is not in the infra")

    for v in r["baseline"]["violations"]:
        check_component("baseline", v["component"])
    for c in cands:
        cid = c["id"]
        if c["feasible"] != (not c["violations"]):
            err(f"{cid}: feasible must be true exactly when violations is empty")
        dist = sum(v["distance"] for v in c["violations"])
        if abs(dist - c["violation_distance"]) > 0.01:
            err(f"{cid}: violation_distance {c['violation_distance']} is not the sum of the distances ({dist:.3f})")
        if c.get("builds_on") and c["builds_on"] not in by_id:
            err(f"{cid}: builds_on {c['builds_on']} does not exist")
        if cid == "do_nothing" and c["actions"]:
            err("do_nothing must have no actions")
        for v in c["violations"]:
            check_component(cid, v["component"])
        for a in c["actions"]:
            if a["component"] != "account":
                check_component(cid, a["component"])
        ranked = [c["score"] is not None, c["rank"] is not None, c["rank_by_scenario"] is not None]
        if c["feasible"] and not all(ranked):
            err(f"{cid}: a feasible candidate needs score, rank and rank_by_scenario")
        if not c["feasible"] and (any(ranked) or c["pareto"]):
            err(f"{cid}: an infeasible candidate has no score, rank, rank_by_scenario or pareto")
        if (c["lost_because"] is None) != (cid == r["winner"]):
            err(f"{cid}: lost_because is null for the winner and set for every other candidate")
        if not c["feasible"] and c["lost_because"] and c["lost_because"]["reason"] != "constraint":
            err(f"{cid}: an infeasible candidate loses on a constraint")
    feasible = [c for c in cands if c["feasible"]]
    ranks = sorted(c["rank"] for c in feasible if c["rank"] is not None)
    if ranks != list(range(1, len(feasible) + 1)):
        err(f"ranks of the feasible candidates must be 1..{len(feasible)}, got {ranks}")
    for s in ("low", "base", "high"):
        got = sorted(c["rank_by_scenario"][s] for c in feasible if c["rank_by_scenario"])
        if got != list(range(1, len(feasible) + 1)):
            err(f"rank_by_scenario.{s} must be 1..{len(feasible)}, got {got}")
    order = [(c["rank"] is None, c["rank"] or 0, c["violation_distance"], c["id"]) for c in cands]
    if order != sorted(order):
        err("candidates must be ordered by rank, then violation_distance, then id")
    closest = r["closest_if_none_feasible"]
    if feasible:
        if r["winner"] not in by_id or by_id[r["winner"]]["rank"] != 1:
            err("winner must be the feasible candidate with rank 1")
        if closest is not None:
            err("closest_if_none_feasible must be null when there is a winner")
    else:
        if r["winner"] is not None:
            err("winner must be null when no candidate is feasible")
        if closest is None:
            err("closest_if_none_feasible must be set when no candidate is feasible")
        elif closest["candidate"] not in by_id:
            err(f"closest_if_none_feasible: candidate {closest['candidate']} does not exist")
        else:
            c = by_id[closest["candidate"]]
            if c["violation_distance"] != min(x["violation_distance"] for x in cands):
                err("closest_if_none_feasible must be the candidate with the smallest violation_distance")
            if closest["violation_distance"] != c["violation_distance"] or closest["blocked_by"] != c["violations"]:
                err("closest_if_none_feasible must repeat the candidate's violation_distance and violations")
    print(f"  {len(cands)} candidates, {len(feasible)} feasible, winner: {r['winner']}, closest: {closest['candidate'] if closest else None}")


def main():
    args = sys.argv[1:]
    if args and "proposed_by" in load(args[0]):
        print("candidates")
        check_candidates(Path(args[0]).name, load(args[0]))
        finish()
    if args and "candidates" in load(args[0]):
        print("result")
        r = load(args[0])
        schema_check(Path(args[0]).name, r, "result.schema.json")
        if not errors:
            result_integrity(Path(args[0]).name, r)
        finish()
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
        print("result")
        for name in ("result.example.json", "result.example.nothing-feasible.json"):
            r = load(HERE / name)
            before = len(errors)
            schema_check(name, r, "result.schema.json")
            if len(errors) == before:
                result_integrity(name, r, infra)
        print("candidates")
        check_candidates("candidates.example.json", load(HERE / "candidates.example.json"), infra, c)
        print("run")
        run = load(HERE / "run.example.json")
        schema_errors_before = len(errors)
        schema_check("run.example.json", run, "run.schema.json")
        if len(errors) == schema_errors_before:
            errors.extend(f"[integrity] run: {e}" for e in run_integrity_errors(run))
            print(f"  {len(run['events'])} events, {run['revision']} revision(s), status {run['status']}")
        print("rehearsal")
        r = load(HERE / "rehearsal.example.json")
        schema_check("rehearsal.example.json", r, "rehearsal.schema.json")

        print("\n=== startup ===")
        print("infra")
        infra_startup = load(HERE / "mock/startup.infra.json")
        schema_check("startup.infra.json", infra_startup, "infra.schema.json")
        if not errors:
            infra_integrity(infra_startup)
        print("forecast")
        f_startup = load(HERE / "mock/startup.forecast.json")
        schema_check("startup.forecast.json", f_startup, "forecast.schema.json")
        forecast_integrity(f_startup)
        print("catalog check")
        catalog_integrity(c, infra_startup)
    finish()


def check_candidates(label, doc, infra=None, catalog=None):
    before = len(errors)
    schema_check(label, doc, "candidates.schema.json")
    if len(errors) > before:
        return
    strategies = set(load(HERE / "forecast.schema.json")["properties"]["cto_settings"]["properties"]["strategies_enabled"]["items"]["enum"])
    errors.extend(f"[integrity] {label}: {e}" for e in candidates_integrity_errors(doc, strategies, infra, catalog))
    actions = sum(len(candidate["actions"]) for candidate in doc["candidates"])
    print(f"  {len(doc['candidates'])} candidates, {actions} actions, revision {doc['revision']}")


def finish():
    for w in warnings:
        print("  warn:", w)
    for e in errors:
        print("  ERROR", e)
    print("RESULT:", "FAILED" if errors else "OK", f"({len(errors)} errors, {len(warnings)} warnings)")
    sys.exit(1 if errors else 0)


main()

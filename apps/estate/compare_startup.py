#!/usr/bin/env python3
import json
import sys
from pathlib import Path

PREFIX = "startup"
SECURITY_FIELDS = ("public_exposure", "encryption_at_rest", "backup_retention_days")


def orphan_volume_signature(component):
    storage = component.get("capacity", {}).get("storage_gb", {}).get("value")
    return component["kind"], component.get("sku"), storage


def is_orphan_volume(component):
    return component["kind"] == "block_storage" and component.get("status") == "orphan"


def in_scope(component, mock_volume_signatures):
    if is_orphan_volume(component):
        return orphan_volume_signature(component) in mock_volume_signatures
    return PREFIX in component.get("name", "")


def similar_name(ext_name, mock_id):
    ext_lower = ext_name.lower()
    parts = mock_id.lower().replace("_", "-").split("-")
    return any(len(part) >= 3 and part in ext_lower for part in parts)


def find_match(mock, candidates):
    if is_orphan_volume(mock):
        return next((c for c in candidates if is_orphan_volume(c)
                     and orphan_volume_signature(c) == orphan_volume_signature(mock)), None)
    same_kind = [c for c in candidates if c["kind"] == mock["kind"]]
    exact = f"{PREFIX}-{mock['id']}"
    return (next((c for c in same_kind if c.get("name") == exact), None)
            or next((c for c in same_kind if similar_name(c.get("name", ""), mock["id"])), None))


def compare_component(mock, extractor):
    diffs = []
    for key in ("quantity", "zones", "status"):
        if mock.get(key) != extractor.get(key):
            diffs.append(f"{key}: mock={mock.get(key)} extractor={extractor.get(key)}")
    mock_sec = mock.get("security", {})
    ext_sec = extractor.get("security", {})
    for key in SECURITY_FIELDS:
        if key in mock_sec and key in ext_sec and mock_sec[key] != ext_sec[key]:
            diffs.append(f"security.{key}: mock={mock_sec[key]} extractor={ext_sec[key]}")
    return {"ok": not diffs, "diffs": diffs}


def compare_docs(extractor, mock):
    volume_signatures = {orphan_volume_signature(c) for c in mock["components"] if is_orphan_volume(c)}
    unmatched = [c for c in extractor["components"] if in_scope(c, volume_signatures)]
    results = {"matched": [], "missing_in_extractor": [], "extra_in_extractor": [], "mismatches": []}
    for mc in mock["components"]:
        ec = find_match(mc, unmatched)
        if ec is None:
            results["missing_in_extractor"].append(mc["id"])
            continue
        unmatched.remove(ec)
        outcome = compare_component(mc, ec)
        if outcome["ok"]:
            results["matched"].append({"id": mc["id"], "extractor_id": ec["id"]})
        else:
            results["mismatches"].append({"mock_id": mc["id"], "extractor_id": ec["id"], "diffs": outcome["diffs"]})
    results["extra_in_extractor"] = [c["id"] for c in unmatched]
    return results


def passed(results):
    return not (results["missing_in_extractor"] or results["extra_in_extractor"] or results["mismatches"])


def print_results(results):
    print("=== Startup Estate Comparison ===\n")
    print(f"Matched components: {len(results['matched'])}")
    for m in results["matched"]:
        print(f"  ok {m['id']} -> {m['extractor_id']}")
    if results["missing_in_extractor"]:
        print(f"\nMissing in extractor: {len(results['missing_in_extractor'])}")
        for m in results["missing_in_extractor"]:
            print(f"  -  {m}")
    if results["extra_in_extractor"]:
        print(f"\nExtra in extractor (not in mock): {len(results['extra_in_extractor'])}")
        for e in results["extra_in_extractor"]:
            print(f"  +  {e}")
    if results["mismatches"]:
        print(f"\nMismatches: {len(results['mismatches'])}")
        for mm in results["mismatches"]:
            print(f"  ~  {mm['mock_id']} <-> {mm['extractor_id']}")
            for d in mm["diffs"]:
                print(f"       {d}")
    ok = passed(results)
    print(f"\nResult: {'PASS' if ok else 'FAIL'}")
    return 0 if ok else 1


def main(argv):
    if len(argv) != 3:
        print("Usage: compare_startup.py <extractor_output.json> <mock.json>")
        return 2
    extractor, mock = (json.loads(Path(p).read_text()) for p in argv[1:])
    return print_results(compare_docs(extractor, mock))


if __name__ == "__main__":
    sys.exit(main(sys.argv))

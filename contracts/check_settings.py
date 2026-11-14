#!/usr/bin/env python3
"""Validate the account settings example against its schema.

  python3 check_settings.py                          # settings.example.json
  python3 check_settings.py path/to/settings.json    # any settings document

Needs `jsonschema` (pip install -r requirements.txt). Exit code 0 = everything passed.
Checks beyond JSON Schema: selected repos are listed in availableRepos, a connected GitHub
installation has an org, installation id and install time, a not_connected one has none of them.
"""
import json
import sys
from pathlib import Path

try:
    from jsonschema import Draft202012Validator
except ImportError:
    sys.exit("jsonschema missing: pip install jsonschema")

HERE = Path(__file__).parent
errors = []


def load(p):
    return json.loads(Path(p).read_text())


def schema_check(label, doc, schema_file):
    v = Draft202012Validator(load(HERE / schema_file))
    errs = sorted(v.iter_errors(doc), key=lambda e: list(e.absolute_path))
    for e in errs:
        errors.append(f"[schema] {label}: /{'/'.join(map(str, e.absolute_path))}: {e.message[:200]}")
    print(f"  {'ok  ' if not errs else 'FAIL'} {label} vs {schema_file}" + (f" ({len(errs)} errors)" if errs else ""))


def github_integrity(g):
    selection = g["repoSelection"]
    if selection["kind"] == "selected":
        for repo in selection["repos"]:
            if repo not in g["availableRepos"]:
                errors.append(f"[integrity] github: selected repo {repo} is not in availableRepos")
    linked = ("org", "installationId", "installedAt")
    if g["status"] == "connected":
        for field in linked:
            if g[field] is None:
                errors.append(f"[integrity] github: connected but {field} is null")
        if not g["permissions"]:
            errors.append("[integrity] github: connected without permissions")
    if g["status"] == "not_connected":
        for field in linked:
            if g[field] is not None:
                errors.append(f"[integrity] github: not_connected but {field} is set")
        if g["extensionReady"]:
            errors.append("[integrity] github: not_connected but extensionReady")


def main():
    path = Path(sys.argv[1]) if sys.argv[1:] else HERE / "settings.example.json"
    print("settings")
    doc = load(path)
    schema_check(path.name, doc, "settings.schema.json")
    if not errors:
        github_integrity(doc["github"])
    for e in errors:
        print("  ERROR", e)
    print("RESULT:", "FAILED" if errors else "OK", f"({len(errors)} errors)")
    sys.exit(1 if errors else 0)


main()

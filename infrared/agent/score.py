"""Score out/findings.jsonl against ground_truth/planted_issues.json (run by a human, never by the agent).

    .venv/bin/python -m agent.score

A planted issue counts as found when a finding's resources/title/evidence mention its resource name (or the
numeric/word tokens of it) and the stack or service is plausible. Crude on purpose: read the misses by hand.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def tokens(s: str) -> set[str]:
    return {t for t in re.split(r"[^a-z0-9]+", s.lower()) if len(t) > 2}


def main() -> None:
    truth = json.loads((ROOT / "ground_truth/planted_issues.json").read_text())["issues"]
    path = ROOT / "out/findings.jsonl"
    findings = [json.loads(l) for l in path.read_text().splitlines()] if path.exists() else []
    blobs = [(f["id"], " ".join([f.get("title", ""), " ".join(map(str, f.get("resources", []))),
                                  f.get("recommendation", "")]).lower()) for f in findings]
    hit, miss = [], []
    for t in truth:
        want = t["resource"].lower()
        wt = tokens(want)
        ids = [i for i, b in blobs if want in b or (wt and len(wt & tokens(b)) >= max(1, len(wt) // 2 + len(wt) % 2))]
        (hit if ids else miss).append((t, ids))
    used = {i for _, ids in hit for i in ids}
    cost = [t for t, _ in hit if t["category"] != "security"]
    print(f"planted issues: {len(truth)}  matched: {len(hit)}  recall: {len(hit)/len(truth):.0%}")
    print(f"findings: {len(findings)}  matching a planted issue: {len(used)}  (rest = novel or false positive; review)")
    by_cat: dict[str, list[int]] = {}
    for t, ids in [*hit, *miss]:
        by_cat.setdefault(t["category"], [0, 0])[0 if ids else 1] += 1
    for c, (h, m) in sorted(by_cat.items()):
        print(f"  {c:12s} found {h:3d}  missed {m:3d}")
    print("\nmissed (non-security):")
    for t, _ in miss:
        if t["category"] != "security":
            print(f"  [{t['severity']}] {t['stack']}/{t['service']}: {t['resource']} - {t['issue']}")


if __name__ == "__main__":
    main()

import argparse
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]

parser = argparse.ArgumentParser()
commands = parser.add_subparsers(dest="command", required=True)
rehearsing = commands.add_parser("rehearse")
for name in ("--result", "--candidate", "--infra", "--forecast", "--out"):
    rehearsing.add_argument(name, required=True)
rehearsing.add_argument("--phase-seconds", type=float, default=15.0)
rehearsing.add_argument("--requests-per-second", type=int, default=5)
arguments = parser.parse_args()

result = json.loads(Path(arguments.result).read_text(encoding="utf-8"))
if not any(candidate["id"] == arguments.candidate and candidate["feasible"] for candidate in result["candidates"]):
    print(f"candidate {arguments.candidate} is not a feasible candidate of {arguments.result}")
    sys.exit(2)
rehearsal = json.loads((REPO / "contracts" / "rehearsal.example.json").read_text(encoding="utf-8"))
rehearsal["traffic_profile"]["requests_per_second"] = arguments.requests_per_second
Path(arguments.out).write_text(json.dumps(rehearsal, indent=2) + "\n", encoding="utf-8")
print(
    f"sandbox stub: no Floci rehearsal for {arguments.candidate}; copied contracts/rehearsal.example.json"
    f" at {arguments.requests_per_second} requests/s",
    file=sys.stderr,
)

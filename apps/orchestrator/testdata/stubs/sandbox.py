import argparse
import json
import shutil
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]

parser = argparse.ArgumentParser()
commands = parser.add_subparsers(dest="command", required=True)
rehearsing = commands.add_parser("rehearse")
for name in ("--result", "--candidate", "--infra", "--forecast", "--out"):
    rehearsing.add_argument(name, required=True)
arguments = parser.parse_args()

result = json.loads(Path(arguments.result).read_text(encoding="utf-8"))
if not any(candidate["id"] == arguments.candidate and candidate["feasible"] for candidate in result["candidates"]):
    print(f"candidate {arguments.candidate} is not a feasible candidate of {arguments.result}")
    sys.exit(2)
shutil.copyfile(REPO / "contracts" / "rehearsal.example.json", arguments.out)
print(f"sandbox stub: no Floci rehearsal for {arguments.candidate}; copied contracts/rehearsal.example.json", file=sys.stderr)

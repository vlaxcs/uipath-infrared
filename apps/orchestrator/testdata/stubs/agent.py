import argparse
import json
import sys
from pathlib import Path

FLOW = Path(__file__).resolve().parents[1] / "flow"


def investigate(arguments):
    Path(arguments.out).write_text(json.dumps({"findings": []}) + "\n", encoding="utf-8")
    print("agent stub: no model call; wrote no findings", file=sys.stderr)
    return 0


def propose(arguments):
    if arguments.revision > 0:
        feedback = json.loads(Path(arguments.feedback).read_text(encoding="utf-8"))
        if feedback["revision"] != arguments.revision or not feedback["reason"]:
            print(f"feedback is for revision {feedback['revision']}, asked for {arguments.revision}", file=sys.stderr)
            return 1
    proposal = FLOW / f"candidates.{arguments.revision}.json"
    if not proposal.exists():
        print(f"the stub has no proposal for revision {arguments.revision}", file=sys.stderr)
        return 1
    document = json.loads(proposal.read_text(encoding="utf-8"))
    infra = json.loads(Path(arguments.infra).read_text(encoding="utf-8"))
    ids = [component["id"] for component in infra["components"]]
    if infra["project"] != document["project"]:
        document["project"] = infra["project"]
        for candidate in document["candidates"]:
            for action in candidate["actions"]:
                action["component"] = next((i for i in ids if i == action["component"] or i.endswith("-" + action["component"])), action["component"])
    Path(arguments.out).write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")
    print(f"agent stub: no model call; proposed {proposal.name} for {infra['project']}", file=sys.stderr)
    return 0


parser = argparse.ArgumentParser()
commands = parser.add_subparsers(dest="command", required=True)
investigating = commands.add_parser("investigate")
investigating.add_argument("--infra", required=True)
investigating.add_argument("--out", required=True)
investigating.set_defaults(handler=investigate)
proposing = commands.add_parser("propose")
for name in ("--infra", "--forecast", "--catalog", "--findings", "--out"):
    proposing.add_argument(name, required=True)
proposing.add_argument("--revision", type=int, required=True)
proposing.add_argument("--feedback")
proposing.set_defaults(handler=propose)
arguments = parser.parse_args()
sys.exit(arguments.handler(arguments))

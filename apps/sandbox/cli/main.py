import argparse
import json
import sys
from pathlib import Path

from .. import settings
from ..adapters.aws_clients import connect
from ..adapters.inventory import list_inventory
from ..adapters.teardown import teardown_prefix
from ..application.document import build_document
from ..application.rehearsal import LeftoverResources, Rehearsal
from ..domain.end_state import CandidateNotFound, candidate_actions, end_state, infra_actions
from ..domain.naming import BASE_PREFIX
from ..domain.teardown_selection import select_owned

DEFAULT_MIN_AVAILABILITY_PCT = 99.9


def load_forecast(path: str):
    data = json.loads(Path(path).read_text())
    return float(data["hard_constraints"]["min_availability_pct"]), str(data.get("id", Path(path).stem))


def load_json(path: str):
    return json.loads(Path(path).read_text())


def rehearse(arguments) -> int:
    try:
        actions = candidate_actions(load_json(arguments.result), arguments.candidate)
    except CandidateNotFound as missing:
        print(missing)
        return 2
    state = end_state(arguments.candidate, infra_actions(load_json(arguments.infra)), actions)
    candidate = state.candidate
    min_availability_pct, forecast_id = load_forecast(arguments.forecast) if arguments.forecast else (DEFAULT_MIN_AVAILABILITY_PCT, "default")
    aws = settings.aws()
    print(f"rehearsing candidate {candidate.id} on Floci at {aws.endpoint_url}, target availability {min_availability_pct}%")
    try:
        outcome = Rehearsal(aws, phase_seconds=arguments.phase_seconds).run(state, min_availability_pct, forecast_id)
    except LeftoverResources as leftovers:
        print(f"refusing to run: {BASE_PREFIX} resources already exist in Floci: {leftovers}")
        print("inspect them with `sandbox inventory`; remove them with `sandbox teardown` only if they are yours")
        return 2
    document = build_document(outcome)
    Path(arguments.out).write_text(json.dumps(document, indent=2) + "\n")
    verdict = document["verdict"]
    print(f"decision {document['x_decision']['kind']}: {document['x_decision']['reason']}")
    print(f"measured availability {verdict['measured_availability_pct']}% -> {'PASS' if verdict['passed'] else 'FAIL'}: {verdict['reason']}")
    print(f"teardown {document['infrastructure']['teardown_status']}, remaining {len(outcome.remaining)}")
    print(f"wrote {arguments.out}")
    return 0 if verdict["passed"] else 1


def inventory(arguments) -> int:
    items = select_owned(list_inventory(connect(settings.aws())), arguments.prefix)
    for item in items:
        print(f"{item.resource_type}\t{item.name}\t{item.resource_id}")
    print(f"{len(items)} resource(s) under {arguments.prefix}")
    return 0


def teardown(arguments) -> int:
    if not arguments.prefix.startswith(BASE_PREFIX):
        print(f"refusing: the sandbox only tears down names starting with {BASE_PREFIX}")
        return 2
    remaining = teardown_prefix(connect(settings.aws()), arguments.prefix, print)
    print(f"{len(remaining)} resource(s) left under {arguments.prefix}")
    return 0 if not remaining else 1


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="sandbox")
    commands = root.add_subparsers(dest="command", required=True)
    rehearse_command = commands.add_parser("rehearse")
    rehearse_command.add_argument("--result", required=True)
    rehearse_command.add_argument("--candidate", required=True)
    rehearse_command.add_argument("--infra", required=True)
    rehearse_command.add_argument("--forecast")
    rehearse_command.add_argument("--out", default="rehearsal.json")
    rehearse_command.add_argument("--phase-seconds", type=float, default=15.0)
    rehearse_command.set_defaults(handler=rehearse)
    for name, handler in (("inventory", inventory), ("teardown", teardown)):
        command = commands.add_parser(name)
        command.add_argument("--prefix", default=BASE_PREFIX)
        command.set_defaults(handler=handler)
    return root


def main() -> None:
    arguments = parser().parse_args()
    sys.exit(arguments.handler(arguments))

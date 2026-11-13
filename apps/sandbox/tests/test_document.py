import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

from sandbox.application.document import build_document
from sandbox.application.run_outcome import RunOutcome
from sandbox.domain.built import BuiltComponent, BuiltResource
from sandbox.domain.end_state import SkippedAction
from sandbox.domain.failure_target import choose_failure_target
from sandbox.domain.traffic_record import TrafficRecord

SCHEMA = json.loads((Path(__file__).parents[3] / "contracts" / "rehearsal.schema.json").read_text())
WEB = BuiltComponent("web", "virtual_machine", "t3", 2, [BuiltResource("instance", "i-1", "w", "us-east-1a"), BuiltResource("instance", "i-2", "w", "us-east-1b")])


def outcome(records):
    started = datetime(2026, 11, 13, tzinfo=timezone.utc)
    run = RunOutcome("pick", "f", 99.5, "sandbox-abc123-", "http://localhost:4566", started, components=[WEB], records=records)
    run.failure_target = choose_failure_target([WEB])
    run.phase_seconds = {"baseline": 15.0, "failure": 40.0, "recovery": 15.0}
    run.requests_per_second = 5
    run.completed_at = started + timedelta(seconds=200)
    run.skipped = [SkippedAction("files", "move", "aws-s3 eu-west-1", "not rehearsed")]
    return run


def record(phase, ok):
    return TrafficRecord(1.0, phase, "http", "web", ok, 5.0, "ok i-1" if ok else "timeout")


def test_document_is_valid_and_revises_on_a_measured_gap():
    document = build_document(outcome([record("baseline", True), record("failure", False), record("recovery", True), record("recovery", True)]))

    assert list(Draft202012Validator(SCHEMA, format_checker=FormatChecker()).iter_errors(document)) == []
    assert document["verdict"]["measured_availability_pct"] == 75.0
    assert document["x_decision"]["kind"] == "revise"
    assert "falls short" in document["x_decision"]["reason"]
    assert document["x_actions_skipped"][0]["component"] == "files"
    assert document["failure"]["target_component"] == "web"


def test_document_proceeds_when_availability_holds():
    document = build_document(outcome([record(phase, True) for phase in ("baseline", "failure", "recovery")]))

    assert document["x_decision"]["kind"] == "proceed"


def test_no_traffic_never_proceeds_and_invents_no_metrics():
    document = build_document(outcome([]))

    assert document["x_decision"]["kind"] == "revise"
    assert "availability_pct" not in document["phases"]["failure"]
    assert "latency_p50_ms" not in document["phases"]["failure"]

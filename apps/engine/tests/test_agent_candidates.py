import copy
import json
import subprocess
import sys

import pytest

from engine.cli import EXIT_INVALID_INPUT, main
from tests.conftest import CATALOG, CONTRACTS, FORECAST, MOCK_INFRA

SAMPLE = json.loads((CONTRACTS / "candidates.example.json").read_text())
REMEDIATION = "security_remediation"


def evaluate_with(tmp_path, candidates):
    path = tmp_path / "candidates.json"
    path.write_text(json.dumps(candidates))
    out = tmp_path / "result.json"
    code = main(["evaluate", str(MOCK_INFRA), str(FORECAST), str(CATALOG), "--candidates", str(path), "--out", str(out)])
    return code, (json.loads(out.read_text()) if code == 0 else None)


def candidate(result, cid):
    return next(c for c in result["candidates"] if c["id"] == cid)


def changes(entry):
    return {(a["component"], a["action"]) for a in entry["actions"] if a["layer"] != REMEDIATION}


def sample():
    return copy.deepcopy(SAMPLE)


def test_agent_candidates_are_priced_next_to_the_engine_ones(tmp_path):
    code, result = evaluate_with(tmp_path, SAMPLE)
    assert code == 0
    ids = {c["id"] for c in result["candidates"]}
    assert {"do_nothing", "cleanup_orphans", "agent-orders-serverless", "agent-quiet-pools", "agent-quiet-pools-ha"} <= ids
    for proposed in SAMPLE["candidates"]:
        entry = candidate(result, proposed["id"])
        assert entry["source"] == "agent"
        assert entry["builds_on"] == proposed["builds_on"]
    assert candidate(result, "cleanup_orphans")["source"] == "engine"


def test_the_result_passes_the_contract_checker(tmp_path):
    code, _ = evaluate_with(tmp_path, SAMPLE)
    assert code == 0
    checker = subprocess.run(
        [sys.executable, str(CONTRACTS / "check_mock.py"), str(tmp_path / "result.json")], capture_output=True, text=True,
    )
    assert checker.returncode == 0, checker.stdout


def test_moving_pii_out_of_the_eu_is_rejected_for_residency(tmp_path):
    _, result = evaluate_with(tmp_path, SAMPLE)
    entry = candidate(result, "agent-orders-serverless")
    assert not entry["feasible"]
    assert any(v["constraint"] == "data_residency" and v["component"] == "rds-orders" for v in entry["violations"])


def test_the_same_move_inside_the_eu_has_no_residency_violation(tmp_path):
    candidates = sample()
    candidates["candidates"][0]["actions"][0]["to"]["region"] = "eu-west-1"
    _, result = evaluate_with(tmp_path, candidates)
    entry = candidate(result, "agent-orders-serverless")
    assert not any(v["constraint"] == "data_residency" and v["component"] == "rds-orders" for v in entry["violations"])


def test_a_candidate_carries_the_actions_it_builds_on(tmp_path):
    _, result = evaluate_with(tmp_path, SAMPLE)
    cleanup = changes(candidate(result, "cleanup_orphans"))
    orders = changes(candidate(result, "agent-orders-serverless"))
    assert cleanup <= orders
    assert ("rds-orders", "move") in orders
    pools = changes(candidate(result, "agent-quiet-pools"))
    assert pools <= changes(candidate(result, "agent-quiet-pools-ha"))
    assert ("rds-analytics", "scale") in changes(candidate(result, "agent-quiet-pools-ha"))


def test_builds_on_null_starts_from_today(tmp_path):
    _, result = evaluate_with(tmp_path, SAMPLE)
    assert changes(candidate(result, "agent-quiet-pools")) == {
        ("ng-data-gpu", "stop"), ("ng-shop-staging", "scale"), ("rds-orders-clone", "delete"),
    }


def test_the_agent_action_replaces_the_parent_one_on_the_same_component(tmp_path):
    candidates = sample()
    candidates["candidates"] = [{
        "id": "agent-keep-eks-data",
        "builds_on": "rightsize_in_place",
        "rationale": "stop the data cluster instead of shrinking it",
        "actions": [{"component": "eks-data", "action": "stop", "reason": "no jobs scheduled"}],
    }]
    _, result = evaluate_with(tmp_path, candidates)
    parent = changes(candidate(result, "rightsize_in_place"))
    entry = changes(candidate(result, "agent-keep-eks-data"))
    assert ("eks-data", "scale") in parent
    assert {a for a in entry if a[0] == "eks-data"} == {("eks-data", "stop")}
    assert {a for a in parent if a[0] != "eks-data"} <= entry


def test_security_remediation_is_recomputed_on_the_agent_end_state(tmp_path):
    _, result = evaluate_with(tmp_path, SAMPLE)
    entry = candidate(result, "agent-quiet-pools")
    assert any(a["layer"] == REMEDIATION for a in entry["actions"])
    assert not any(a["layer"] == REMEDIATION and a["component"] == "rds-orders-clone" for a in entry["actions"])


def test_confidence_comes_from_the_component_data_not_the_agent(tmp_path):
    _, result = evaluate_with(tmp_path, SAMPLE)
    stop = next(a for a in candidate(result, "agent-quiet-pools")["actions"] if a["component"] == "ng-data-gpu")
    assert stop["confidence"] == "low"
    assert "synthetic" in stop["confidence_reason"]


def test_evaluate_with_candidates_is_byte_for_byte_deterministic(tmp_path):
    path = tmp_path / "candidates.json"
    path.write_text(json.dumps(SAMPLE))
    first, second = tmp_path / "a.json", tmp_path / "b.json"
    for out in (first, second):
        main(["evaluate", str(MOCK_INFRA), str(FORECAST), str(CATALOG), "--candidates", str(path), "--out", str(out)])
    assert first.read_bytes() == second.read_bytes()


def broken(mutate):
    candidates = sample()
    mutate(candidates)
    return candidates


@pytest.mark.parametrize("mutate, expected", [
    (lambda c: c["candidates"][1]["actions"][0].update(saving_eur_month=32882), "candidates.schema.json"),
    (lambda c: c.update(project="other-shop"), "candidates are for other-shop, the infra is demo-shop"),
    (lambda c: c["candidates"][1]["actions"][0].update(component="ng-data-tpu"), "component ng-data-tpu is not in the infra"),
    (lambda c: c["candidates"][0].update(id="rightsize_in_place"), "is the name of an engine strategy"),
    (lambda c: c["candidates"][0].update(builds_on="multi_region_ha"), "builds_on multi_region_ha was not built"),
])
def test_invalid_candidates_stop_with_the_reason(tmp_path, capsys, mutate, expected):
    code, _ = evaluate_with(tmp_path, broken(mutate))
    assert code == EXIT_INVALID_INPUT
    assert expected in capsys.readouterr().err
    assert not (tmp_path / "result.json").exists()

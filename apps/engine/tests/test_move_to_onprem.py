from dataclasses import replace

import pytest

from engine.application.evaluate import evaluate
from engine.domain.baseline import price_baseline
from engine.domain.candidate import DO_NOTHING, ActionKind
from engine.domain.end_state import apply_candidate
from engine.domain.evaluation import evaluate_candidate
from engine.domain.strategies.cleanup_orphans import cleanup_orphans
from engine.domain.strategies.managed_services import managed_services
from engine.domain.strategies.move_to_onprem import REJECTED_SIGNAL, move_to_onprem
from engine.domain.strategies.rightsize_in_place import rightsize_in_place
from tests.conftest import CATALOG, FORECAST, MOCK_INFRA
from tests.test_onprem import PLATFORM_MONTHLY_EUR

LAYERS = ("cleanup_orphans", "rightsize_in_place", "managed_services", "move_to_onprem")


def layered(infra, catalog, forecast):
    previous = DO_NOTHING
    for builder in (cleanup_orphans, rightsize_in_place, managed_services):
        previous = builder(previous, infra, catalog, forecast)
    return previous, move_to_onprem(previous, infra, catalog, forecast)


@pytest.fixture(scope="module")
def layers(mock_infra, catalog, forecast):
    return layered(mock_infra, catalog, forecast)


def own(layers, component, kind=None):
    previous, candidate = layers
    return [a for a in candidate.own_actions(previous) if a.component == component and (kind is None or a.kind == kind)]


def test_it_builds_on_managed_services(layers):
    previous, candidate = layers
    assert (candidate.id, candidate.builds_on) == ("move_to_onprem", "managed_services")
    assert candidate.actions[: len(previous.actions)] == previous.actions


def test_the_spark_pool_moves_to_the_onprem_cluster_when_it_saves(layers, mock_infra, catalog):
    [move] = own(layers, "ng-data-spark", ActionKind.MOVE)
    assert move.option == "onprem-k8s-nodes"
    assert "platform share and ops" in move.reason
    placement = apply_candidate(mock_infra, catalog, layers[1]).placements["ng-data-spark"]
    assert (placement.provider, placement.region) == ("onprem", "onprem-dc1")


def test_gpu_work_stays_off_a_platform_without_gpus(layers):
    [flag] = own(layers, "ng-data-gpu")
    assert (flag.kind, flag.signal) == (ActionKind.FLAG, REJECTED_SIGNAL)
    assert "onprem-dc1 has no GPUs" in flag.reason


@pytest.mark.parametrize("component, group", [
    ("rds-orders", "orders-core"),
    ("rds-analytics", "orders-replication"),
])
def test_a_group_with_a_member_that_cannot_move_stays_together(layers, component, group):
    assert not own(layers, component, ActionKind.MOVE)
    [flag] = own(layers, component, ActionKind.FLAG)
    assert f"{group} moves as one unit" in flag.reason


def test_onprem_outside_the_allow_list_moves_nothing(mock_infra, catalog, forecast):
    constraints = replace(forecast.constraints, allowed_providers=frozenset({"aws", "managed_pg"}))
    previous, candidate = layered(mock_infra, catalog, replace(forecast, constraints=constraints))
    own_actions = candidate.own_actions(previous)
    assert not [a for a in own_actions if a.kind == ActionKind.MOVE]
    assert any("provider onprem is not allowed" in a.reason for a in own_actions)


def test_the_platform_share_is_part_of_the_run_cost(layers, mock_infra, catalog, forecast):
    previous, candidate = layers
    baseline = price_baseline(mock_infra, catalog)
    evaluation = evaluate_candidate(candidate, LAYERS, mock_infra, catalog, forecast, baseline)
    onprem = evaluation.onprem
    assert onprem.platform == "onprem-dc1"
    assert onprem.capacity_share == pytest.approx(320 / 768)
    assert onprem.allocated_monthly_eur == pytest.approx(PLATFORM_MONTHLY_EUR * 320 / 768)
    components = sum(c.monthly_eur for c in evaluation.costs if c.component != "ng-data-spark")
    run_now = evaluation.projection.monthly_now_eur
    assert run_now == pytest.approx(components + onprem.allocated_monthly_eur + evaluation.egress_eur_month)


def test_without_an_onprem_move_there_is_no_platform_cost(layers, mock_infra, catalog, forecast):
    previous, _ = layers
    baseline = price_baseline(mock_infra, catalog)
    evaluation = evaluate_candidate(previous, LAYERS[:3], mock_infra, catalog, forecast, baseline)
    assert evaluation.onprem is None


def test_the_result_shows_the_full_platform_cost():
    document = evaluate(MOCK_INFRA, FORECAST, CATALOG)
    by_id = {c["id"]: c for c in document["candidates"]}
    platform = by_id["move_to_onprem"]["cost"]["onprem_platform"]
    share = platform["capacity_share"]
    assert platform["platform"] == "onprem-dc1"
    assert (platform["platforms_needed"], platform["capex_eur"]) == (1, 310000)
    assert platform["capex_amortised_eur_month"] == pytest.approx(310000 / 60 * share, abs=0.01)
    assert platform["power_cooling_eur_month"] == pytest.approx(2400 * share, abs=0.01)
    assert platform["colocation_eur_month"] == pytest.approx(1800 * share, abs=0.01)
    assert platform["disk_replacement_eur_month"] == pytest.approx(94.4 * share, abs=0.01)
    assert platform["staff_eur_month"] == pytest.approx(106.08 * 85 * share, abs=0.01)
    assert all("onprem_platform" not in c["cost"] for c in document["candidates"] if c["id"] != "move_to_onprem")

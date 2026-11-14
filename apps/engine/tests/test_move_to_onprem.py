from dataclasses import replace

import pytest

from engine.application.evaluate import evaluate
from engine.domain.baseline import price_baseline
from engine.domain.candidate import DO_NOTHING, ActionKind
from engine.domain.end_state import apply_candidate
from engine.domain.evaluation import evaluate_candidate
from engine.domain.growth import growth_split
from engine.domain.pricing import Growth
from engine.domain.provenance import confidence_of
from engine.domain.strategies.cleanup_orphans import cleanup_orphans
from engine.domain.strategies.managed_services import managed_services
from engine.domain.strategies.move_to_onprem import REJECTED_SIGNAL, move_to_onprem
from engine.domain.strategies.rightsize_in_place import rightsize_in_place
from tests.conftest import CATALOG, FORECAST, MOCK_INFRA
from tests.test_onprem import BASE_TRAFFIC_AT_HORIZON, CAPEX_MONTH, CONTINGENCY_MONTH, PLATFORM_MONTHLY_EUR

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


def test_the_move_inherits_the_evidence_that_sized_the_pool(layers):
    [autoscale] = [a for a in layers[0].actions if a.component == "ng-data-spark" and a.kind == ActionKind.AUTOSCALE]
    [move] = own(layers, "ng-data-spark", ActionKind.MOVE)
    assert confidence_of(autoscale.evidence).level == "low"
    assert set(autoscale.evidence) <= set(move.evidence)
    assert confidence_of(move.evidence).level == "low"


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


@pytest.fixture(scope="module")
def evaluated(layers, mock_infra, catalog, forecast):
    previous, candidate = layers
    baseline = price_baseline(mock_infra, catalog)
    return (
        evaluate_candidate(previous, LAYERS[:3], mock_infra, catalog, forecast, baseline),
        evaluate_candidate(candidate, LAYERS, mock_infra, catalog, forecast, baseline),
    )


def spark(evaluation):
    [cost] = [c for c in evaluation.costs if c.component == "ng-data-spark"]
    return cost


def test_the_platform_share_is_the_on_prem_component_cost(evaluated):
    before, after = evaluated
    onprem = after.onprem
    assert onprem.platform == "onprem-dc1"
    assert onprem.capacity_share == pytest.approx(320 / 768)
    assert onprem.allocated_monthly_eur == pytest.approx(PLATFORM_MONTHLY_EUR * 320 / 768)
    assert spark(after).monthly_eur == pytest.approx(onprem.allocated_monthly_eur)
    assert after.run_eur_month_now == pytest.approx(
        before.run_eur_month_now - spark(before).monthly_eur + onprem.allocated_monthly_eur
    )


def test_the_move_saving_counts_the_platform_share(evaluated):
    before, after = evaluated
    [move] = [o for o in after.outcomes if o.action.component == "ng-data-spark" and o.action.kind == ActionKind.MOVE]
    assert move.saving_eur_month == pytest.approx(spark(before).monthly_eur - after.onprem.allocated_monthly_eur)
    assert move.saving_eur_month < spark(before).monthly_eur


def test_the_on_prem_cost_grows_with_traffic(evaluated):
    _, after = evaluated
    placement = after.end_state.placements["ng-data-spark"]
    assert growth_split(spark(after), placement) == {Growth.TRAFFIC: pytest.approx(after.onprem.allocated_monthly_eur)}
    assert after.onprem.capacity_share_at_horizon == pytest.approx(320 / 768 * BASE_TRAFFIC_AT_HORIZON)
    assert (after.onprem.platforms_needed, after.onprem.capex_eur) == (2, 620000)


def test_setup_is_a_one_off_and_hardware_counts_against_the_one_off_budget(evaluated):
    before, after = evaluated
    onprem = after.onprem
    assert onprem.setup_eur == pytest.approx(30000 * 320 / 768)
    assert after.upfront_hardware_eur == pytest.approx(310000 * 320 / 768)
    [budget] = [v for v in after.check.violations if v.constraint == "migration_budget"]
    assert budget.actual == pytest.approx(after.migration_eur + after.upfront_hardware_eur)
    assert "of on-prem hardware paid up front" in budget.detail
    assert not [v for v in before.check.violations if v.constraint == "migration_budget"]


def test_the_expected_total_carries_the_hardware_only_once(evaluated):
    _, after = evaluated
    assert after.expected_total_eur == pytest.approx(
        after.projection.expected_horizon_eur + after.migration_eur + after.ops_horizon_eur + after.outage_horizon_eur
    )


def test_without_an_onprem_move_there_is_no_platform_cost(evaluated):
    before, _ = evaluated
    assert before.onprem is None
    assert (before.upfront_hardware_eur, before.capex_amortised_eur_month) == (0, 0)


def test_the_result_shows_the_full_platform_cost():
    document = evaluate(MOCK_INFRA, FORECAST, CATALOG)
    by_id = {c["id"]: c for c in document["candidates"]}
    platform = by_id["move_to_onprem"]["cost"]["onprem_platform"]
    share = 320 / 768
    assert platform["platform"] == "onprem-dc1"
    assert (platform["platforms_needed"], platform["capex_eur"]) == (2, 620000)
    expected = {
        "capex_amortised_eur_month": CAPEX_MONTH,
        "power_cooling_eur_month": 2400,
        "colocation_eur_month": 1800,
        "disk_replacement_eur_month": 94.4,
        "staff_eur_month": 106.08 * 85,
        "maintenance_eur_month": 310000 * 0.08 / 12,
        "network_eur_month": 600,
        "licences_eur_month": 900,
        "contingency_eur_month": CONTINGENCY_MONTH,
        "total_eur_month": PLATFORM_MONTHLY_EUR,
        "setup_eur": 30000,
        "upfront_hardware_eur": 310000,
    }
    for key, full in expected.items():
        assert platform[key] == pytest.approx(full * share, abs=0.01), key
    [move] = [a for a in by_id["move_to_onprem"]["actions"] if a["action"] == "move" and a["component"] == "ng-data-spark"]
    assert move["saving_eur_month"] == pytest.approx(14700 - PLATFORM_MONTHLY_EUR * share, abs=1)
    assert all("onprem_platform" not in c["cost"] for c in document["candidates"] if c["id"] != "move_to_onprem")

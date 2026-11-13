from dataclasses import replace

import pytest

from engine.application.evaluate import evaluate
from engine.domain.candidate import DO_NOTHING, ActionKind
from engine.domain.end_state import apply_candidate
from engine.domain.strategies.cleanup_orphans import cleanup_orphans
from engine.domain.strategies.managed_services import (
    REJECTED_SIGNAL, VERIFY_EXTENSIONS_SIGNAL, managed_services,
)
from engine.domain.strategies.rightsize_in_place import rightsize_in_place
from tests.conftest import CATALOG, FORECAST, MOCK_INFRA


def layered(infra, catalog, forecast):
    rightsize = rightsize_in_place(cleanup_orphans(DO_NOTHING, infra, catalog, forecast), infra, catalog, forecast)
    return rightsize, managed_services(rightsize, infra, catalog, forecast)


@pytest.fixture(scope="module")
def layers(mock_infra, catalog, forecast):
    return layered(mock_infra, catalog, forecast)


def own(layers, component, kind=None):
    previous, candidate = layers
    return [a for a in candidate.own_actions(previous) if a.component == component and (kind is None or a.kind == kind)]


def test_it_builds_on_rightsize_in_place(layers):
    previous, candidate = layers
    assert candidate.id == "managed_services"
    assert candidate.builds_on == "rightsize_in_place"
    assert candidate.actions[: len(previous.actions)] == previous.actions


@pytest.mark.parametrize("component, missing", [
    ("rds-analytics", "logical_replication, pg_partman"),
    ("rds-orders", "logical_replication"),
    ("pg-lake", "pg_partman"),
])
def test_serverless_is_rejected_where_features_are_missing(layers, component, missing):
    reasons = " ".join(a.reason for a in own(layers, component))
    assert f"managed-pg-serverless lacks {missing}" in reasons
    assert not any(a.kind == ActionKind.MOVE and a.option == "managed-pg-serverless" for a in own(layers, component))


def test_rds_erp_moves_to_the_managed_provider_and_stays_with_erp_core(layers, mock_infra, catalog):
    [move] = own(layers, "rds-erp", ActionKind.MOVE)
    assert move.option == "managed-pg-serverless"
    assert "erp-core" in move.reason
    placement = apply_candidate(mock_infra, catalog, layers[1]).placements["rds-erp"]
    assert (placement.provider, placement.region) == ("managed_pg", "eu-west-1")


def test_a_provider_scoped_group_moves_together_or_not_at_all(layers):
    for component in ("rds-orders", "rds-analytics"):
        assert not own(layers, component, ActionKind.MOVE)
        [flag] = own(layers, component, ActionKind.FLAG)
        assert flag.signal == REJECTED_SIGNAL
        assert "orders-replication moves as one unit" in flag.reason


def test_a_move_keeps_the_size_rightsizing_chose(layers):
    [move] = own(layers, "pg-lake", ActionKind.MOVE)
    assert (move.option, move.tier) == ("managed-pg-branching", "cu-16")


def test_unknown_extensions_allow_the_move_but_flag_it(mock_infra, catalog, forecast):
    components = tuple(
        replace(c, features_used=None) if c.id == "rds-erp" else c for c in mock_infra.components
    )
    layers = layered(replace(mock_infra, components=components), catalog, forecast)
    signals = {a.signal for a in own(layers, "rds-erp")}
    assert signals == {"managed_service", VERIFY_EXTENSIONS_SIGNAL}


def test_a_provider_outside_the_allow_list_is_never_a_target(mock_infra, catalog, forecast):
    constraints = replace(forecast.constraints, allowed_providers=frozenset({"aws", "onprem"}))
    previous, candidate = layered(mock_infra, catalog, replace(forecast, constraints=constraints))
    own_actions = candidate.own_actions(previous)
    assert not [a for a in own_actions if a.kind == ActionKind.MOVE]
    assert any("provider managed_pg is not allowed" in a.reason for a in own_actions)


def test_residency_blocks_moves_that_keep_data_outside_the_allowed_regions(real_infra, catalog, forecast):
    previous, candidate = layered(real_infra, catalog, forecast)
    own_actions = candidate.own_actions(previous)
    assert own_actions
    assert all(a.kind == ActionKind.FLAG and "data in us-east-1" in a.reason for a in own_actions)


def test_evaluate_prices_the_cross_provider_move():
    document = evaluate(MOCK_INFRA, FORECAST, CATALOG)
    by_id = {c["id"]: c for c in document["candidates"]}
    managed, rightsize = by_id["managed_services"], by_id["rightsize_in_place"]
    assert managed["cost"]["run_eur_month_now"] < rightsize["cost"]["run_eur_month_now"]
    assert managed["cost"]["migration_eur"] > rightsize["cost"]["migration_eur"]
    moves = [a for a in managed["actions"] if a["action"] == "move"]
    assert {a["component"] for a in moves} == {"rds-erp", "pg-lake"}
    assert all(a["saving_eur_month"] > 0 for a in moves)

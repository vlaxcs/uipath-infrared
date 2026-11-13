import pytest

from engine.domain.candidate import DO_NOTHING, Action, ActionKind, Candidate
from engine.domain.costing import cost_placement
from engine.domain.end_state import apply_candidate
from engine.domain.migration import migration_of
from engine.domain.ops import ops_monthly_eur

REPORTED = {"rds-erp": 1342.0, "rds-orders": 2919.0}


def migrate(infra, catalog, forecast, *actions):
    end_state = apply_candidate(infra, catalog, Candidate("probe", actions))
    return migration_of(end_state, catalog, forecast.business, REPORTED, {"rds-erp": 500.0, "rds-orders": 1500.0})


def test_nothing_changed_means_no_migration(mock_infra, catalog, forecast):
    migration = migrate(mock_infra, catalog, forecast)
    assert (migration.steps, migration.eur, migration.risk) == ((), 0, 0)


def test_cross_provider_move_pays_effort_side_by_side_month_and_data_transfer(mock_infra, catalog, forecast):
    migration = migrate(mock_infra, catalog, forecast, Action("rds-erp", ActionKind.MOVE, "probe", option="managed-pg-serverless"))
    step = migration.steps[0]
    assert step.hours == pytest.approx(50 + 4 * 310 / 100)
    assert step.eur == pytest.approx(step.hours * 85 + 1342 + (310 - 100) * 0.085)
    assert (step.cutover_hours, step.risk_factor) == (2, 0.45)


def test_same_provider_move_is_discounted_and_pays_no_transfer(mock_infra, catalog, forecast):
    migration = migrate(mock_infra, catalog, forecast, Action("rds-orders", ActionKind.MOVE, "probe", option="aws-aurora-postgres"))
    step = migration.steps[0]
    assert step.kind == "move"
    assert step.hours == pytest.approx((60 + 3 * 1450 / 100) * 0.5)
    assert step.eur == pytest.approx(step.hours * 85 + 2919)


def test_same_provider_move_is_priced_as_a_change_not_at_the_old_bill(mock_infra, catalog):
    end_state = apply_candidate(mock_infra, catalog, Candidate("probe", (Action("rds-orders", ActionKind.MOVE, "probe", option="aws-aurora-postgres"),)))
    cost = cost_placement(end_state.placements["rds-orders"], catalog)
    assert cost.source == "catalog"
    assert cost.catalog.option_id == "aws-aurora-postgres"


def test_in_place_resize_costs_the_discounted_fixed_effort(mock_infra, catalog, forecast):
    migration = migrate(mock_infra, catalog, forecast, Action("rds-orders", ActionKind.RESIZE, "probe", tier="db.m5.2xlarge"))
    step = migration.steps[0]
    assert (step.kind, step.hours, step.cutover_hours) == ("in_place", pytest.approx(40 * 0.3), 1)
    assert migration.risk == pytest.approx(0.3 * 0.3)


def test_deleting_or_stopping_needs_no_migration(mock_infra, catalog, forecast):
    migration = migrate(
        mock_infra, catalog, forecast,
        Action("rds-orders-clone", ActionKind.DELETE, "orphan"),
        Action("vm-dev-jump", ActionKind.STOP, "idle"),
    )
    assert migration.steps == ()


def test_risk_is_the_mean_risk_weighted_by_the_new_monthly_cost(mock_infra, catalog, forecast):
    migration = migrate(
        mock_infra, catalog, forecast,
        Action("rds-erp", ActionKind.MOVE, "probe", option="managed-pg-serverless"),
        Action("rds-orders", ActionKind.RESIZE, "probe", tier="db.m5.2xlarge"),
    )
    assert migration.risk == pytest.approx((0.45 * 500 + 0.09 * 1500) / 2000)
    assert migration.cutover_hours == 2


def test_deleting_a_component_removes_its_ops_hours(mock_infra, catalog, forecast):
    before = ops_monthly_eur(apply_candidate(mock_infra, catalog, DO_NOTHING), catalog, forecast.business)
    after = ops_monthly_eur(
        apply_candidate(mock_infra, catalog, Candidate("probe", (Action("rds-orders-clone", ActionKind.DELETE, "orphan"),))),
        catalog, forecast.business,
    )
    assert before - after == pytest.approx(4 * 85)

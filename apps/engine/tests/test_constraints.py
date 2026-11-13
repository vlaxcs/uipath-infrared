from dataclasses import replace

import pytest

from engine.domain.candidate import DO_NOTHING, Action, ActionKind
from engine.domain.constraints import CandidateFigures, check_constraints
from engine.domain.end_state import apply_candidate
from engine.domain.forecast import HardConstraints, Residency, SecurityGates
from engine.domain.violation import Violation, total_distance

BASELINE_EUR = 133308.0


def check(infra, catalog, forecast, *actions, figures=CandidateFigures(BASELINE_EUR)):
    end_state = apply_candidate(infra, catalog, DO_NOTHING.extend("test", tuple(actions)))
    return check_constraints(end_state, infra, catalog, forecast, figures)


def only(forecast, **constraints):
    return replace(forecast, constraints=HardConstraints(**constraints))


def components(result, constraint, rule=None):
    return sorted(
        v.component for v in result.violations
        if v.constraint == constraint and v.rule == rule and v.component is not None
    )


def test_do_nothing_is_infeasible_on_residency(mock_infra, catalog, forecast):
    result = check(mock_infra, catalog, forecast)
    assert not result.feasible
    assert components(result, "data_residency") == ["s3-legacy-reports"]
    violation = next(v for v in result.violations if v.constraint == "data_residency")
    assert "us-east-1" in violation.detail and "pii" in violation.detail


def test_do_nothing_is_infeasible_on_single_zone_rds(mock_infra, catalog, forecast):
    result = check(mock_infra, catalog, forecast)
    below = components(result, "min_availability_pct")
    assert {"rds-orders", "rds-erp", "pg-lake", "cache-sessions"} <= set(below)
    rds = next(v for v in result.violations if v.component == "rds-orders" and v.constraint == "min_availability_pct")
    assert (rds.actual, rds.limit, rds.unit) == (99.5, 99.9, "pct")
    assert rds.distance == pytest.approx(4.0)


def test_a_second_zone_clears_the_availability_violation(mock_infra, catalog, forecast):
    result = check(mock_infra, catalog, forecast, Action("rds-erp", ActionKind.SCALE, "test", zones=2))
    assert "rds-erp" not in components(result, "min_availability_pct")


def test_a_path_that_misses_with_no_single_weak_component_is_reported_for_the_stack(mock_infra, catalog, forecast):
    strict = only(forecast, min_availability_pct=99.4)
    result = check(mock_infra, catalog, strict)
    assert components(result, "min_availability_pct") == []
    stacks = [v for v in result.violations if v.constraint == "min_availability_pct"]
    assert stacks and all(v.component is None and v.actual < 99.4 for v in stacks)


def test_security_gates_list_the_components_the_mock_expects(mock_infra, catalog, forecast):
    result = check(mock_infra, catalog, forecast)
    assert components(result, "security_gates", "forbid_public_datastores") == [
        "pg-lake", "rds-analytics", "rds-erp", "rds-orders", "rds-orders-clone", "s3-legacy-reports", "s3-uploads",
    ]
    assert components(result, "security_gates", "forbid_world_open_admin_ports") == [
        "vm-bastion", "vm-batch", "vm-dev-jump", "vmfleet-web",
    ]
    unencrypted = components(result, "security_gates", "require_encryption_at_rest")
    assert "rds-orders" in unencrypted and "ddb-orders" not in unencrypted
    rds = {"rds-orders", "rds-orders-clone", "rds-analytics", "rds-erp"}
    assert rds <= set(components(result, "security_gates", "require_backups"))
    audit = [v for v in result.violations if v.rule == "require_audit_logging"]
    assert len(audit) == 1 and audit[0].component is None


def test_gates_that_are_off_report_nothing(mock_infra, catalog, forecast):
    result = check(mock_infra, catalog, only(forecast, security_gates=SecurityGates()))
    assert result.feasible


def test_deleting_a_component_removes_its_violations(mock_infra, catalog, forecast):
    result = check(mock_infra, catalog, forecast, Action("s3-legacy-reports", ActionKind.DELETE, "test"))
    assert components(result, "data_residency") == []
    assert "s3-legacy-reports" not in components(result, "security_gates", "forbid_public_datastores")


def test_residency_only_applies_to_the_listed_classifications(mock_infra, catalog, forecast):
    internal_only = only(forecast, residency=Residency(("eu-*",), frozenset({"internal"})))
    assert check(mock_infra, catalog, internal_only).feasible


def test_providers_outside_the_allow_list_or_on_the_forbidden_list(mock_infra, catalog, forecast):
    assert components(check(mock_infra, catalog, forecast), "allowed_providers") == []
    not_allowed = check(mock_infra, catalog, only(forecast, allowed_providers=frozenset({"onprem"})))
    assert len(components(not_allowed, "allowed_providers")) == len(mock_infra.components)
    forbidden = check(mock_infra, catalog, only(forecast, forbidden_providers=frozenset({"aws"})))
    assert len(components(forbidden, "forbidden_providers")) == len(mock_infra.components)


def test_figures_are_checked_against_their_ceilings(mock_infra, catalog, forecast):
    figures = CandidateFigures(
        run_eur_month_at_horizon_base=99000.0, migration_eur=150000.0, effort_hours=1500.0, cutover_hours=6.0,
    )
    result = check(mock_infra, catalog, forecast, figures=figures)
    by_rule = {(v.constraint, v.rule): v for v in result.violations if v.unit in {"eur_month", "eur", "hours"}}
    budget = by_rule[("budget", "max_monthly_run_cost_eur")]
    assert (budget.actual, budget.limit, budget.unit, budget.component) == (99000.0, 90000.0, "eur_month", None)
    assert budget.distance == pytest.approx(0.1)
    assert by_rule[("budget", "max_one_off_migration_cost_eur")].distance == pytest.approx(0.25)
    assert by_rule[("max_migration_effort_hours", None)].distance == pytest.approx(0.25)
    assert by_rule[("max_cutover_downtime_hours", None)].distance == pytest.approx(0.5)


def test_figures_inside_their_ceilings_pass(mock_infra, catalog, forecast):
    result = check(mock_infra, catalog, forecast, figures=CandidateFigures(90000.0, 120000.0, 1200.0, 4.0))
    assert not [v for v in result.violations if v.unit in {"eur_month", "eur", "hours"}]


def test_a_violation_without_numbers_counts_one(mock_infra, catalog, forecast):
    assert Violation("data_residency", "x", "detail").distance == 1.0
    result = check(mock_infra, catalog, forecast)
    assert total_distance(result.violations) == pytest.approx(sum(v.distance for v in result.violations))


def test_the_real_estate_is_checked_without_crashing(real_infra, catalog, forecast):
    result = check(real_infra, catalog, forecast)
    assert not result.feasible
    assert components(result, "data_residency")


def test_the_same_inputs_give_the_same_violations(mock_infra, catalog, forecast):
    assert check(mock_infra, catalog, forecast).violations == check(mock_infra, catalog, forecast).violations

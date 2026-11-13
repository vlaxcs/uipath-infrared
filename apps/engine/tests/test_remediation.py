from engine.domain.baseline import price_baseline
from engine.domain.candidate import ACCOUNT_SCOPE, DO_NOTHING, Action, ActionKind
from engine.domain.constraints import CandidateFigures, check_constraints
from engine.domain.costing import cost_placement
from engine.domain.end_state import apply_candidate
from engine.domain.remediation import (
    EFFORT_HOURS_BY_GATE, remediation_actions, remediation_effort_hours,
)


def remediated(infra, catalog, forecast, *before):
    base = DO_NOTHING.extend("base", tuple(before))
    actions = remediation_actions(apply_candidate(infra, catalog, base), infra, forecast)
    return actions, apply_candidate(infra, catalog, base.extend("security_remediation", actions))


def constraints_broken(end_state, infra, catalog, forecast):
    result = check_constraints(end_state, infra, catalog, forecast, CandidateFigures(0.0))
    return {v.constraint for v in result.violations}


def test_remediation_on_top_of_do_nothing_clears_every_gate(mock_infra, catalog, forecast):
    actions, end_state = remediated(mock_infra, catalog, forecast)
    assert len(actions) == 35
    assert constraints_broken(end_state, mock_infra, catalog, forecast) == {"data_residency", "min_availability_pct"}


def test_each_action_names_its_gate_and_the_fix(mock_infra, catalog, forecast):
    actions, _ = remediated(mock_infra, catalog, forecast)
    assert all(a.kind == ActionKind.REMEDIATE and a.signal in EFFORT_HOURS_BY_GATE for a in actions)
    by_target = {(a.component, a.signal): a for a in actions}
    assert "close the admin ports" in by_target[("vm-bastion", "forbid_world_open_admin_ports")].reason
    assert (ACCOUNT_SCOPE, "require_audit_logging") in by_target
    assert all(a.confidence.level == "high" for a in actions)


def test_effort_is_the_sum_of_the_per_gate_hours(mock_infra, catalog, forecast):
    actions, _ = remediated(mock_infra, catalog, forecast)
    assert remediation_effort_hours(actions) == 7 * 4 + 14 * 8 + 4 * 1 + 9 * 1 + 2
    assert remediation_effort_hours(actions + (Action("rds-orders", ActionKind.DELETE, "test"),)) == 155


def test_a_deleted_component_needs_no_fix(mock_infra, catalog, forecast):
    actions, end_state = remediated(
        mock_infra, catalog, forecast, Action("rds-orders-clone", ActionKind.DELETE, "test"),
    )
    assert "rds-orders-clone" not in {a.component for a in actions}
    assert not any(c.startswith("security.") for c in constraints_broken(end_state, mock_infra, catalog, forecast))


def test_nothing_left_to_fix_gives_no_actions(mock_infra, catalog, forecast):
    _, end_state = remediated(mock_infra, catalog, forecast)
    assert remediation_actions(end_state, mock_infra, forecast) == ()


def test_remediation_does_not_change_what_a_component_costs(mock_infra, catalog, forecast):
    _, end_state = remediated(mock_infra, catalog, forecast)
    assert all(p.unchanged for p in end_state.placements.values())
    total = sum(cost_placement(p, catalog).monthly_eur for p in end_state.placements.values())
    assert total == price_baseline(mock_infra, catalog).monthly_eur


def test_the_real_estate_is_remediated_too(real_infra, catalog, forecast):
    actions, end_state = remediated(real_infra, catalog, forecast)
    assert actions
    assert not any(c.startswith("security.") for c in constraints_broken(end_state, real_infra, catalog, forecast))

import pytest

from engine.domain.candidate import DO_NOTHING, ActionKind
from engine.domain.costing import cost_placement
from engine.domain.end_state import apply_candidate
from engine.domain.strategies.cleanup_orphans import cleanup_orphans
from engine.domain.strategies.rightsize_in_place import rightsize_in_place


@pytest.fixture(scope="module")
def cleanup(mock_infra, catalog, forecast):
    return cleanup_orphans(DO_NOTHING, mock_infra, catalog, forecast)


@pytest.fixture(scope="module")
def rightsize(cleanup, mock_infra, catalog, forecast):
    return rightsize_in_place(cleanup, mock_infra, catalog, forecast)


def costs(candidate, infra, catalog):
    end_state = apply_candidate(infra, catalog, candidate)
    return {cid: cost_placement(p, catalog).monthly_eur for cid, p in end_state.placements.items()}


def saving(before, after, infra, catalog, component=None):
    old, new = costs(before, infra, catalog), costs(after, infra, catalog)
    if component:
        return old[component] - new[component]
    return sum(old.values()) - sum(new.values())


def own(candidate, parent, component=None, kind=None):
    return [
        a for a in candidate.own_actions(parent)
        if (component is None or a.component == component) and (kind is None or a.kind == kind)
    ]


def test_cleanup_acts_on_the_seven_idle_and_orphan_components(cleanup):
    assert cleanup.builds_on == "do_nothing"
    assert {a.component: a.kind for a in cleanup.actions} == {
        "rds-orders-clone": ActionKind.DELETE,
        "ebs-orphans": ActionKind.DELETE,
        "nat-dev": ActionKind.DELETE,
        "cache-legacy-mc": ActionKind.DELETE,
        "efs-legacy": ActionKind.STOP,
        "vm-bastion": ActionKind.STOP,
        "vm-dev-jump": ActionKind.STOP,
    }


def test_cleanup_saves_about_9300_a_month_at_high_confidence(cleanup, mock_infra, catalog):
    assert 9200 <= saving(DO_NOTHING, cleanup, mock_infra, catalog) <= 9400
    assert all(a.confidence.level == "high" for a in cleanup.actions)


def test_a_stopped_vm_still_pays_for_its_disks(cleanup, mock_infra, catalog):
    assert costs(cleanup, mock_infra, catalog)["vm-bastion"] == pytest.approx(40.0)


def test_cleanup_twice_adds_nothing(cleanup, mock_infra, catalog, forecast):
    again = cleanup_orphans(cleanup, mock_infra, catalog, forecast)
    assert again.own_actions(cleanup) == ()


def test_rightsize_leaves_cleaned_up_components_alone(cleanup, rightsize):
    cleaned = {a.component for a in cleanup.actions}
    assert not cleaned & {a.component for a in rightsize.own_actions(cleanup)}


def test_the_idle_gpu_pool_is_cut_at_low_confidence(cleanup, rightsize, mock_infra, catalog):
    action, = own(rightsize, cleanup, "ng-data-gpu")
    assert action.kind == ActionKind.AUTOSCALE and action.quantity < 4
    assert saving(cleanup, rightsize, mock_infra, catalog, "ng-data-gpu") > 10000
    assert action.confidence.level == "low"
    assert "gpu_pct" in action.confidence.reason and "synthetic" in action.confidence.reason


def test_the_staging_pool_is_cut_at_high_confidence(cleanup, rightsize, mock_infra, catalog):
    action, = own(rightsize, cleanup, "ng-shop-staging")
    assert action.quantity == 2
    assert saving(cleanup, rightsize, mock_infra, catalog, "ng-shop-staging") > 9000
    assert action.confidence.level == "high"


def test_a_production_pool_keeps_one_unit_per_zone(cleanup, rightsize):
    action, = own(rightsize, cleanup, "vmfleet-web", ActionKind.AUTOSCALE)
    assert action.kind == ActionKind.AUTOSCALE and action.quantity == 2
    assert "floor" in action.reason


def test_the_undersized_database_grows(cleanup, rightsize, mock_infra, catalog):
    action, = own(rightsize, cleanup, "rds-analytics", ActionKind.RESIZE)
    assert action.signal == "undersized" and action.tier == "db.r6g.8xlarge"
    assert saving(cleanup, rightsize, mock_infra, catalog, "rds-analytics") < 0


def test_the_hot_partition_table_is_flagged_and_gets_no_capacity(cleanup, rightsize, mock_infra, catalog):
    action, = own(rightsize, cleanup, "ddb-orders")
    assert action.kind == ActionKind.FLAG and action.signal == "design_problem"
    assert saving(cleanup, rightsize, mock_infra, catalog, "ddb-orders") == 0


def test_stateful_production_goes_to_two_zones(cleanup, rightsize, mock_infra, catalog):
    scaled = {a.component for a in own(rightsize, cleanup, kind=ActionKind.SCALE) if a.signal == "single_zone_stateful"}
    assert scaled == {"rds-orders", "rds-analytics", "rds-erp", "pg-lake", "cache-sessions"}
    end_state = apply_candidate(mock_infra, catalog, rightsize)
    assert all(end_state.placements[c].zones == 2 for c in scaled)


def test_a_database_with_unknown_memory_use_is_flagged_not_shrunk(cleanup, rightsize):
    action, = [a for a in own(rightsize, cleanup, "rds-orders") if a.signal == "oversized"]
    assert action.kind == ActionKind.FLAG and "memory use is not reported" in action.reason


def test_every_shrink_saves_money(cleanup, rightsize, mock_infra, catalog):
    shrinks = [
        a for a in rightsize.own_actions(cleanup)
        if a.kind == ActionKind.AUTOSCALE or (a.kind == ActionKind.RESIZE and a.signal == "oversized")
    ]
    assert shrinks
    only_shrunk = {a.component for a in shrinks} - {a.component for a in own(rightsize, cleanup, kind=ActionKind.SCALE)}
    assert all(saving(cleanup, rightsize, mock_infra, catalog, c) > 0 for c in only_shrunk)


def test_the_layers_are_deterministic(cleanup, rightsize, mock_infra, catalog, forecast):
    assert cleanup_orphans(DO_NOTHING, mock_infra, catalog, forecast) == cleanup
    assert rightsize_in_place(cleanup, mock_infra, catalog, forecast) == rightsize


def test_the_real_estate_runs_and_caps_copied_node_group_usage(real_infra, catalog, forecast):
    cleanup = cleanup_orphans(DO_NOTHING, real_infra, catalog, forecast)
    rightsize = rightsize_in_place(cleanup, real_infra, catalog, forecast)
    action, = own(rightsize, cleanup, "ng-shop-prod-general")
    assert action.confidence.level == "low"
    assert "copied from the cluster" in action.confidence.reason
    scaled = {a.component for a in own(rightsize, cleanup, kind=ActionKind.SCALE)}
    assert not any(real_infra.component(c).zones is None for c in scaled)


def test_single_zone_pools_on_a_critical_path_are_spread(cleanup, rightsize, mock_infra, catalog):
    spread = {a.component: a for a in own(rightsize, cleanup, kind=ActionKind.SCALE) if a.signal == "single_zone_pool"}
    assert set(spread) == {"eks-data", "vmfleet-web"}
    end_state = apply_candidate(mock_infra, catalog, rightsize)
    assert end_state.placements["vmfleet-web"].zones == 2
    assert end_state.placements["vmfleet-web"].quantity == 2
    assert saving(cleanup, cleanup.extend("spread", (spread["eks-data"],)), mock_infra, catalog, "eks-data") == 0


def test_a_staging_pool_is_not_spread(cleanup, rightsize):
    assert not own(rightsize, cleanup, "ng-shop-staging", ActionKind.SCALE)


def test_data_outside_its_residency_moves_to_the_region_of_its_stack(cleanup, rightsize, mock_infra, catalog):
    move, = own(rightsize, cleanup, "s3-legacy-reports", ActionKind.MOVE)
    assert (move.signal, move.option, move.region) == ("residency", "aws-s3", "eu-west-1")
    assert "legacy components already run" in move.reason
    placement = apply_candidate(mock_infra, catalog, rightsize).placements["s3-legacy-reports"]
    assert (placement.provider, placement.region, placement.moved) == ("aws", "eu-west-1", True)


def test_rightsize_is_blocked_only_by_the_budget(rightsize, mock_infra, catalog, forecast):
    from engine.domain.constraints import CandidateFigures, check_constraints
    from engine.domain.remediation import remediation_actions
    fixes = remediation_actions(apply_candidate(mock_infra, catalog, rightsize), mock_infra, forecast)
    end_state = apply_candidate(mock_infra, catalog, rightsize.extend("fixed", fixes))
    result = check_constraints(end_state, mock_infra, catalog, forecast, CandidateFigures(0.0))
    assert result.feasible
    assert result.availability.availability_pct >= 99.9

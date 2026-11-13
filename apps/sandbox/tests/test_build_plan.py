from sandbox.domain.build_plan import plan_build, units_per_zone, zone_spread
from sandbox.domain.candidate import Action, Candidate


def action(component_id, kind, verb="keep", zones=1, quantity=1):
    return Action(component_id, verb, kind, "sku", quantity, zones)


def test_delete_builds_nothing():
    plan = plan_build(Candidate("c", [action("old-bastion", "virtual_machine", "delete")]))

    assert plan.actions == []
    assert plan.not_built[0].component_id == "old-bastion"
    assert "delete" in plan.not_built[0].reason


def test_stop_builds_nothing():
    plan = plan_build(Candidate("c", [action("jump", "virtual_machine", "stop")]))

    assert plan.actions == []
    assert "stop" in plan.not_built[0].reason


def test_unknown_kind_is_recorded_as_skipped():
    plan = plan_build(Candidate("c", [action("logs", "block_storage"), action("web", "virtual_machine")]))

    assert [item.component_id for item in plan.actions] == ["web"]
    assert plan.not_built[0].kind == "block_storage"
    assert "not supported" in plan.not_built[0].reason


def test_machines_are_built_before_the_load_balancer():
    plan = plan_build(Candidate("c", [action("lb", "load_balancer"), action("db", "postgres"), action("web", "virtual_machine")]))

    assert [item.component_id for item in plan.actions] == ["web", "lb", "db"]


def test_network_zones_follow_zonal_kinds_only():
    plan = plan_build(Candidate("c", [action("web", "virtual_machine", zones=3), action("queue", "queue", zones=6)]))

    assert plan.network_zones == 3


def test_network_has_at_least_two_zones():
    assert plan_build(Candidate("c", [action("web", "virtual_machine")])).network_zones == 2


def test_quantity_spreads_round_robin_over_zones():
    assert zone_spread(5, 2) == [0, 1, 0, 1, 0]
    assert units_per_zone(5, 2) == [3, 2]
    assert units_per_zone(1, 3) == [1, 0, 0]

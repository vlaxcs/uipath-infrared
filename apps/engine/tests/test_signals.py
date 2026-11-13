from engine.domain.signals import SignalKind, detect_signals, usage_caveats
from engine.domain.sizing import MEMORY_UNKNOWN, grow_target, shrink_target


def kinds(infra, catalog, forecast):
    found = {}
    for signal in detect_signals(infra, catalog, forecast):
        found.setdefault(signal.component, set()).add(signal.kind)
    return found


def test_status_becomes_orphan_or_idle_and_nothing_else(mock_infra, catalog, forecast):
    found = kinds(mock_infra, catalog, forecast)
    assert found["rds-orders-clone"] == {SignalKind.ORPHAN}
    assert found["vm-bastion"] == {SignalKind.IDLE}


def test_undersized_wins_over_oversized(mock_infra, catalog, forecast):
    found = kinds(mock_infra, catalog, forecast)["rds-analytics"]
    assert SignalKind.UNDERSIZED in found and SignalKind.OVERSIZED not in found


def test_static_pools_and_single_zone_databases_are_seen(mock_infra, catalog, forecast):
    found = kinds(mock_infra, catalog, forecast)
    assert SignalKind.STATIC_SCALING in found["ng-data-spark"]
    assert SignalKind.SINGLE_ZONE_STATEFUL in found["rds-erp"]
    assert SignalKind.SINGLE_ZONE_STATEFUL not in found.get("s3-uploads", set())
    assert SignalKind.SINGLE_ZONE_STATEFUL not in found.get("ebs-orphans", set())


def test_throttling_under_low_consumption_is_a_design_problem(mock_infra, catalog, forecast):
    assert kinds(mock_infra, catalog, forecast)["ddb-orders"] == {SignalKind.DESIGN_PROBLEM}


def test_a_pool_shrinks_by_its_busiest_resource_with_headroom(mock_infra, catalog):
    staging = mock_infra.component("ng-shop-staging")
    option = catalog.current_option(staging)
    assert shrink_target(staging, option).quantity == 3
    assert shrink_target(staging, option, "avg").quantity == 2
    assert shrink_target(staging, option, "avg", min_units=5).quantity == 5


def test_unknown_memory_blocks_a_unit_shrink(mock_infra, catalog):
    orders = mock_infra.component("rds-orders")
    target = shrink_target(orders, catalog.current_option(orders))
    assert target.blocked == MEMORY_UNKNOWN and target.tier is None


def test_grow_covers_p95_with_headroom(mock_infra, catalog):
    analytics = mock_infra.component("rds-analytics")
    assert grow_target(analytics, catalog.current_option(analytics)).tier == "db.r6g.8xlarge"
    orders = mock_infra.component("rds-orders")
    assert grow_target(orders, catalog.current_option(orders)) is None


def test_only_node_groups_sharing_identical_usage_are_copies(mock_infra, real_infra):
    assert usage_caveats(mock_infra) == {}
    assert set(usage_caveats(real_infra)) == {"ng-shop-prod-cpu-heavy", "ng-shop-prod-general"}


def test_residency_finds_no_allowed_region_on_the_real_estate(real_infra, catalog, forecast):
    found = kinds(real_infra, catalog, forecast)
    assert not any(SignalKind.RESIDENCY in signals for signals in found.values())


def test_a_component_inside_its_residency_is_left_alone(mock_infra, catalog, forecast):
    found = kinds(mock_infra, catalog, forecast)
    assert [c for c, signals in found.items() if SignalKind.RESIDENCY in signals] == ["s3-legacy-reports"]

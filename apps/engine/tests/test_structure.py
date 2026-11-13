from dataclasses import replace

from engine.domain.structure import critical_paths, environment_leaks, stay_together_groups


def paths_by_stack(infra):
    return {path.stack: path for path in critical_paths(infra)}


def test_a_traffic_path_runs_from_the_load_balancer_into_its_datastores(mock_infra):
    shop = paths_by_stack(mock_infra)["shop"]
    assert shop.entry == "traffic"
    assert shop.components == ("alb-shop", "cache-sessions", "ddb-orders", "rds-orders", "vmfleet-web")


def test_a_stack_without_traffic_edges_starts_from_its_data_roots(mock_infra):
    data = paths_by_stack(mock_infra)["data"]
    assert data.entry == "data"
    assert {"eks-data", "pg-lake", "s3-lake"} <= set(data.components)


def test_dev_and_staging_are_never_on_a_critical_path(mock_infra):
    paths = paths_by_stack(mock_infra)
    assert "dev" not in paths
    on_a_path = {component for path in paths.values() for component in path.components}
    assert not {"eks-shop-staging", "ng-shop-staging", "vm-dev-jump"} & on_a_path


def test_dns_entries_lead_into_the_stack_on_the_real_estate(real_infra):
    shop = paths_by_stack(real_infra)["shop"]
    assert shop.entry == "traffic"
    assert {"dns-shop-example-com", "alb-shop-alb", "asg-web-asg"} <= set(shop.components)


def test_hints_win_over_derived_groups(mock_infra):
    assert stay_together_groups(mock_infra) == mock_infra.stay_together


def test_groups_are_derived_from_latency_bound_and_heavy_edges_without_hints(mock_infra):
    groups = stay_together_groups(replace(mock_infra, stay_together=()))
    assert all(group.derived and group.scope == "region" for group in groups)
    shop = next(group for group in groups if "rds-orders" in group.members)
    assert {"vmfleet-web", "cache-sessions", "rds-analytics", "alb-shop"} <= set(shop.members)
    erp = next(group for group in groups if "rds-erp" in group.members)
    assert set(erp.members) == {"alb-legacy", "rds-erp", "svc-invoice-worker", "svc-orders-api"}
    assert not any("s3-legacy-reports" in group.members for group in groups)


def test_the_real_estate_has_no_evidence_to_derive_groups_from(real_infra):
    assert stay_together_groups(real_infra) == ()


def test_staging_reading_a_production_database_is_a_leak(mock_infra):
    leaks = environment_leaks(mock_infra)
    assert [(leak.edge, leak.source, leak.target) for leak in leaks] == [("e09", "eks-shop-staging", "rds-orders")]
    assert leaks[0].source_environment == "staging"
    assert leaks[0].target_environment == "prod"

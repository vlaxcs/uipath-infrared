from extractor.domain.inventory import Inventory
from extractor.domain.projects import belongs, owner_of, scope_to_project
from extractor.domain.stacks import stack_entries, stack_of


def inventory(*components, edges=()):
    found = Inventory("us-east-1")
    found.components = [dict(c) for c in components]
    found.edges = [{"from": a, "to": b, "kind": "data"} for a, b in edges]
    return found


def component(component_id, name, stack=None, kind="postgres"):
    return {"id": component_id, "name": name, "stack": stack, "kind": kind}


def test_names_are_claimed_by_their_prefix_also_inside_aggregate_names():
    assert owner_of("clinic-prod-db") == "clinic-booking"
    assert owner_of("1 NAT gateway(s) in fleet-prod-vpc") == "fleet-telemetry"
    assert owner_of("clinic-prod/api") == "clinic-booking"
    assert owner_of("shop-orders-db") is None


def test_demo_shop_keeps_what_no_other_project_claims_and_unknown_projects_keep_everything():
    assert belongs("shop-orders-db", "demo-shop") and not belongs("startup-app-db", "demo-shop")
    assert belongs("startup-app-db", "floci-estate") and belongs("shop-orders-db", "floci-estate")


def test_scoping_drops_other_projects_and_their_edges_and_localises_stacks():
    found = inventory(component("rds-clinic-prod-db", "clinic-prod-db", "clinic-prod"),
                      component("svc-clinic-prod-api", "clinic-prod/api", "clinic-prod"),
                      component("rds-fleet-dev-db", "fleet-dev-db", "fleet-dev"),
                      edges=[("svc-clinic-prod-api", "rds-clinic-prod-db"), ("svc-clinic-prod-api", "rds-fleet-dev-db")])
    scope_to_project(found, "clinic-booking")
    assert [c["id"] for c in found.components] == ["rds-clinic-prod-db", "svc-clinic-prod-api"]
    assert {c["stack"] for c in found.components} == {"prod"}
    assert found.edges == [{"from": "svc-clinic-prod-api", "to": "rds-clinic-prod-db", "kind": "data"}]


def test_unscoped_extraction_is_left_alone():
    found = inventory(component("a", "clinic-prod-db", "clinic-prod"), component("b", "shop-orders-db", "shop"))
    scope_to_project(found, "floci-estate")
    assert [c["stack"] for c in found.components] == ["clinic-prod", "shop"]


def test_environment_stacks_come_from_names_and_vpcs():
    assert stack_of(None, "clinic-staging-db") == "clinic-staging"
    assert stack_of("fleet-prod-vpc") == "fleet-prod"
    assert stack_of(None, "shop-prod-assets") == "shop"
    assert stack_of(None, "startup-app-db") is None


def test_environment_stacks_are_labelled_with_their_environment():
    entries = stack_entries([{"stack": "prod"}, {"stack": "clinic-staging"}, {"stack": "shop"}])
    assert [(e["id"], e["environment"]) for e in entries] == [("clinic-staging", "staging"), ("prod", "prod"), ("shop", "unknown")]


def test_orphan_volume_groups_are_kept_because_their_volumes_were_filtered_by_tag_before_grouping():
    volume = {"id": "vol-orphan-gp3-200gb", "name": "1 unattached gp3 volume(s) of 200 GB", "kind": "block_storage", "status": "orphan"}
    found = inventory(volume, component("rds-fleet-dev-db", "fleet-dev-db"))
    scope_to_project(found, "clinic-booking")
    assert [c["id"] for c in found.components] == ["vol-orphan-gp3-200gb"]

from extractor.domain.roadmap import attribute_to_roadmap, roadmap_projects


def component(component_id, name, stack=None, tags=None):
    found = {"id": component_id, "name": name, "kind": "postgres"}
    if stack:
        found["stack"] = stack
    if tags:
        found["tags"] = tags
    return found


def attribute(components, projects):
    return attribute_to_roadmap(components, lambda c: c.get("tags") or {}, roadmap_projects({"projects": projects}))


def test_a_tag_wins_over_a_name_and_both_are_case_insensitive():
    projects = [{"id": "booking", "stacks": ["x"], "users": {}, "match": {"tags": ["Booking"], "names": ["clinic-"]}},
                {"id": "fleet", "stacks": ["y"], "users": {}, "match": {"names": ["FLEET-"]}}]
    found, x_projects, unassigned = attribute([component("a", "fleet-db", tags={"APP": "booking"}), component("b", "Fleet-Cache"),
                                               component("c", "1 NAT gateway(s) in clinic-prod-vpc")], projects)
    assert x_projects == {"booking": {"components": ["a", "c"], "by_tag": 1, "by_name": 1},
                          "fleet": {"components": ["b"], "by_tag": 0, "by_name": 1}}
    assert unassigned == []


def test_defaults_are_the_id_as_tag_and_the_id_dash_as_name_prefix():
    projects = [{"id": "shop", "stacks": ["shop"], "users": {}}]
    _, x_projects, unassigned = attribute([component("a", "shop-db"), component("b", "orders", tags={"project": "SHOP"}),
                                           component("c", "shopping-cart")], projects)
    assert x_projects["shop"] == {"components": ["a", "b"], "by_tag": 1, "by_name": 1}
    assert unassigned == ["c"]


def test_each_project_gets_stacks_of_its_own():
    projects = [{"id": "data-platform", "stacks": ["data"], "users": {}, "match": {"names": ["data-"]}},
                {"id": "ml", "stacks": ["ml"], "users": {}, "match": {"names": ["ml-"]}},
                {"id": "startup", "stacks": ["startup"], "users": {}}]
    found, _, _ = attribute([component("a", "data-db", "data"), component("b", "data-lake", "data"), component("c", "ml-gpu", "data"),
                             component("d", "startup-db"), component("e", "jumpbox", "data"), component("f", "data-dns")], projects)
    assert {c["id"]: c.get("stack") for c in found} == {"a": "data", "b": "data", "c": "ml", "d": "startup", "e": "data", "f": "data"}


def test_without_roadmap_projects_nothing_changes():
    components = [component("a", "shop-db", "shop")]
    assert attribute_to_roadmap(components, lambda c: {}, ()) == (components, None, None)

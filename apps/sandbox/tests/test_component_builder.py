from sandbox.application.component_builder import build_components, instance_ids
from sandbox.domain.build_plan import BUILD_ORDER
from sandbox.domain.built import BuiltComponent, BuiltResource
from sandbox.domain.candidate import Action


def fake_builder(calls):
    def build(action, built):
        calls.append((action.kind, [component.component_id for component in built]))
        if action.kind == "cache":
            raise RuntimeError("engine not supported")
        resource_type = "instance" if action.kind == "virtual_machine" else action.kind
        return BuiltComponent(action.component_id, action.kind, action.sku, action.zones, [BuiltResource(resource_type, f"id-{action.component_id}", action.component_id)])

    return build


def test_each_action_goes_to_the_builder_for_its_kind_and_sees_earlier_components():
    calls = []
    builders = {kind: fake_builder(calls) for kind in BUILD_ORDER}
    actions = [Action("web", "keep", "virtual_machine", "t3", 2, 2), Action("lb", "add", "load_balancer", "app", 1, 2), Action("redis", "keep", "cache", "c", 1, 1)]

    built, failed = build_components(actions, builders, lambda line: None)

    assert calls == [("virtual_machine", []), ("load_balancer", ["web"]), ("cache", ["web", "lb"])]
    assert [component.component_id for component in built] == ["web", "lb"]
    assert failed[0].component_id == "redis"
    assert "engine not supported" in failed[0].reason


def test_instance_ids_come_from_machines_only():
    components = [
        BuiltComponent("web", "virtual_machine", "t3", 1, [BuiltResource("instance", "i-1", "w")]),
        BuiltComponent("loadgen", "load_generator", "t3", 1, [BuiltResource("instance", "i-9", "g")]),
    ]

    assert instance_ids(components) == ["i-1"]


def test_floci_wiring_covers_every_buildable_kind():
    from sandbox.application.floci_builders import floci_builders

    assert set(floci_builders(None, None, "sandbox-x-", "ami")) == set(BUILD_ORDER)

from sandbox.domain.built import BuiltComponent, BuiltResource
from sandbox.domain.failure import FailureType
from sandbox.domain.failure_target import choose_failure_target


def machines(component_id, count):
    return BuiltComponent(component_id, "virtual_machine", "t3.small", 2, [BuiltResource("instance", f"i-{component_id}-{n}", "n", f"us-east-1{'ab'[n % 2]}") for n in range(count)])


def balancer():
    return BuiltComponent("lb", "load_balancer", "application", 2, [BuiltResource("load_balancer", "arn:lb", "lb")])


def database():
    return BuiltComponent("db", "postgres", "db.t3.medium", 2, [BuiltResource("db_subnet_group", "g", "g"), BuiltResource("db_instance", "sandbox-x-db", "sandbox-x-db")])


def test_stops_one_of_the_redundant_instances_behind_the_load_balancer():
    target = choose_failure_target([machines("solo", 1), machines("web", 3), balancer(), database()])

    assert target.component_id == "web"
    assert target.resource.resource_id == "i-web-0"
    assert target.type == FailureType.INSTANCE_STOP
    assert "behind the load balancer" in target.reason


def test_reboots_the_database_when_no_instance_is_redundant():
    target = choose_failure_target([machines("web", 1), balancer(), database()])

    assert target.component_id == "db"
    assert target.resource.resource_type == "db_instance"


def test_redundant_instances_without_a_balancer_are_still_the_target():
    target = choose_failure_target([machines("web", 2), database()])

    assert target.component_id == "web"
    assert "no load balancer" in target.reason


def test_lone_machine_is_the_last_resort():
    assert choose_failure_target([machines("web", 1)]).resource.resource_id == "i-web-0"


def test_nothing_built_means_no_target():
    queue = BuiltComponent("q", "queue", "standard", 1, [BuiltResource("queue", "url", "q")])

    assert choose_failure_target([queue]) is None

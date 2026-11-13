from sandbox.adapters.data_plane_targets import http_targets, tcp_targets
from sandbox.domain.built import BuiltComponent, BuiltResource

WEB = BuiltComponent("web", "virtual_machine", "t3", 2, [BuiltResource("instance", "i-1", "w", address="10.1.1.10"), BuiltResource("instance", "i-2", "w", address="10.1.2.10")])
LB = BuiltComponent("lb", "load_balancer", "app", 2, [BuiltResource("load_balancer", "arn", "lb", address="http://lb.elb.localhost.floci.io/"), BuiltResource("target_group", "tg", "tg")])
DB = BuiltComponent("db", "postgres", "db", 2, [BuiltResource("db_subnet_group", "g", "g"), BuiltResource("db_instance", "d", "d", address="172.17.0.2:7008")])
CACHE = BuiltComponent("cache", "cache", "c", 1, [BuiltResource("cache_cluster", "c", "c", address="localhost.floci.io:6380")])


def test_traffic_goes_through_the_load_balancer_when_one_is_built():
    assert http_targets([WEB, LB]) == [{"component_id": "lb", "url": "http://lb.elb.localhost.floci.io/"}]


def test_traffic_hits_instances_directly_without_a_load_balancer():
    assert [target["url"] for target in http_targets([WEB])] == ["http://10.1.1.10:8080/", "http://10.1.2.10:8080/"]


def test_database_and_cache_get_protocol_handshakes():
    targets = tcp_targets([WEB, DB, CACHE])

    assert [(target["component_id"], target["host"], target["port"]) for target in targets] == [("db", "172.17.0.2", 7008), ("cache", "localhost.floci.io", 6380)]
    assert bytes.fromhex(targets[1]["send_hex"]) == b"*1\r\n$4\r\nPING\r\n"

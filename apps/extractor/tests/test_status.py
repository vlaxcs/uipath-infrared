from extractor.domain.status import apply_status


def component(component_id, kind, service="x", status="active", **usage):
    return {"id": component_id, "kind": kind, "service": service, "status": status,
            "usage": {name: {"avg": value} for name, value in usage.items()}}


def status_of(components, edges=()):
    apply_status(components, list(edges))
    return {c["id"]: c["status"] for c in components}


def edge(source, target):
    return {"from": source, "to": target, "kind": "data"}


def test_database_without_connections_and_without_inbound_edge_is_orphan():
    assert status_of([component("db", "postgres", connections=0.5)]) == {"db": "orphan"}


def test_database_without_connections_but_referenced_is_idle():
    assert status_of([component("app", "container"), component("db", "postgres", connections=0.5)], [edge("app", "db")])["db"] == "idle"


def test_database_with_connections_stays_active():
    assert status_of([component("db", "postgres", connections=40)]) == {"db": "active"}


def test_unreferenced_memcached_is_orphan_without_connections_and_idle_with_them():
    assert status_of([component("mc", "cache", "elasticache-memcached")]) == {"mc": "orphan"}
    assert status_of([component("mc", "cache", "elasticache-memcached", connections=10)]) == {"mc": "idle"}


def test_quiet_vm_is_idle_but_quiet_autoscaling_group_is_not():
    result = status_of([component("vm", "virtual_machine", "ec2", cpu_pct=1.0),
                        component("asg", "virtual_machine", "ec2-autoscaling", cpu_pct=1.0)])
    assert result == {"vm": "idle", "asg": "active"}


def test_cpu_threshold_is_exclusive():
    assert status_of([component("vm", "virtual_machine", "ec2", cpu_pct=3)]) == {"vm": "active"}


def test_node_group_with_unused_gpus_is_idle():
    assert status_of([component("gpu", "node_group", cpu_pct=50, gpu_pct=2)]) == {"gpu": "idle"}


def test_nat_without_traffic_is_idle_and_without_metric_stays_active():
    result = status_of([component("quiet", "nat", bytes_out=0.0001), {"id": "unknown", "kind": "nat", "status": "active"}])
    assert result == {"quiet": "idle", "unknown": "active"}


def test_queue_is_judged_on_traffic_and_edges():
    quiet = component("q", "queue", "sqs", messages_sent=0, messages_received=0)
    busy = component("b", "queue", "sqs", messages_sent=5)
    wired = component("w", "queue", "sqs")
    result = status_of([quiet, busy, wired, component("fn", "function")], [edge("w", "fn")])
    assert result == {"q": "idle", "b": "active", "w": "active", "fn": "active"}


def test_orphan_set_by_api_facts_is_never_changed():
    assert status_of([component("vol", "block_storage", status="orphan", cpu_pct=90)]) == {"vol": "orphan"}

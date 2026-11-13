from typing import Dict, List, Sequence

from ..domain.built import BuiltComponent
from .network_builder import APP_PORT

POSTGRES_SSL_REQUEST = "0000000804d2162f"
POSTGRES_REPLIES = ["53", "4e"]
REDIS_PING = "2a310d0a24340d0a50494e470d0a"
REDIS_PONG = ["2b504f4e47"]


def split_address(address: str):
    host, _, port = address.rpartition(":")
    return host, int(port) if port.isdigit() else 0


def tcp_targets(components: Sequence[BuiltComponent]) -> List[Dict]:
    targets = []
    for component in components:
        protocol = {"postgres": (POSTGRES_SSL_REQUEST, POSTGRES_REPLIES, "db_instance"), "cache": (REDIS_PING, REDIS_PONG, "cache_cluster")}.get(component.kind)
        if not protocol:
            continue
        for resource in component.resources_of(protocol[2]):
            host, port = split_address(resource.address)
            if host and port:
                targets.append({"component_id": component.component_id, "host": host, "port": port, "send_hex": protocol[0], "expect_hex": protocol[1]})
    return targets


def http_targets(components: Sequence[BuiltComponent]) -> List[Dict]:
    balancers = [
        {"component_id": component.component_id, "url": resource.address}
        for component in components
        if component.kind == "load_balancer"
        for resource in component.resources_of("load_balancer")
    ]
    if balancers:
        return balancers
    return [
        {"component_id": component.component_id, "url": f"http://{resource.address}:{APP_PORT}/"}
        for component in components
        if component.kind == "virtual_machine"
        for resource in component.resources_of("instance")
        if resource.address
    ]

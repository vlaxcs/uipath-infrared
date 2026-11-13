from dataclasses import dataclass
from typing import List, Sequence

TEARDOWN_ORDER = (
    "auto_scaling_group",
    "load_balancer",
    "target_group",
    "instance",
    "function",
    "queue",
    "bucket",
    "cache_cluster",
    "db_instance",
    "nat_gateway",
    "cache_subnet_group",
    "db_subnet_group",
    "elastic_ip",
    "security_group",
    "subnet",
    "vpc",
)


@dataclass(frozen=True)
class InventoryItem:
    resource_type: str
    resource_id: str
    name: str


def select_owned(items: Sequence[InventoryItem], prefix: str) -> List[InventoryItem]:
    return [item for item in items if item.name.startswith(prefix)]


def teardown_order(items: Sequence[InventoryItem]) -> List[InventoryItem]:
    rank = {resource_type: index for index, resource_type in enumerate(TEARDOWN_ORDER)}
    return sorted(items, key=lambda item: rank.get(item.resource_type, len(TEARDOWN_ORDER)))

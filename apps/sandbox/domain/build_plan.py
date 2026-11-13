from dataclasses import dataclass
from typing import List

from .candidate import Action, Candidate

BUILD_ORDER = ("nat", "virtual_machine", "load_balancer", "postgres", "cache", "queue", "object_storage", "function")
MIN_NETWORK_ZONES = 2
ZONAL_KINDS = ("nat", "virtual_machine", "load_balancer", "postgres", "cache")


@dataclass(frozen=True)
class NotBuilt:
    component_id: str
    kind: str
    action: str
    reason: str


@dataclass(frozen=True)
class BuildPlan:
    actions: List[Action]
    not_built: List[NotBuilt]
    network_zones: int


def zone_spread(quantity: int, zones: int) -> List[int]:
    return [unit % zones for unit in range(quantity)]


def units_per_zone(quantity: int, zones: int) -> List[int]:
    spread = zone_spread(quantity, zones)
    return [spread.count(zone) for zone in range(zones)]


def plan_build(candidate: Candidate) -> BuildPlan:
    buildable = []
    not_built = []
    for action in candidate.actions:
        if action.action in ("delete", "stop"):
            not_built.append(NotBuilt(action.component_id, action.kind, action.action, f"action is {action.action}: nothing to build"))
        elif action.kind not in BUILD_ORDER:
            not_built.append(NotBuilt(action.component_id, action.kind, action.action, f"kind {action.kind} is not supported by the sandbox: skipped"))
        else:
            buildable.append(action)
    buildable.sort(key=lambda action: BUILD_ORDER.index(action.kind))
    network_zones = max([MIN_NETWORK_ZONES] + [action.zones for action in buildable if action.kind in ZONAL_KINDS])
    return BuildPlan(actions=buildable, not_built=not_built, network_zones=network_zones)

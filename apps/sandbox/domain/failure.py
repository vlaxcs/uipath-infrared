from dataclasses import dataclass
from enum import Enum


class FailureType(str, Enum):
    INSTANCE_STOP = "instance_stop"
    TASK_STOP = "task_stop"
    ZONE_DOWN = "zone_down"
    NETWORK_PARTITION = "network_partition"
    RESOURCE_EXHAUSTION = "resource_exhaustion"


@dataclass(frozen=True)
class FailureInjection:
    type: FailureType
    target_component: str
    injected_at_s: float
    duration_s: float
    detail: str = ""

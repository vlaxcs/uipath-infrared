from dataclasses import dataclass
from enum import Enum


class TrafficPattern(str, Enum):
    CONSTANT = "constant"
    RAMP = "ramp"
    BURST = "burst"
    DIURNAL = "diurnal"


@dataclass(frozen=True)
class TrafficProfile:
    pattern: TrafficPattern
    duration_s: int
    target_endpoint: str
    requests_per_second: float

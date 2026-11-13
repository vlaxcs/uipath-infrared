from dataclasses import dataclass
from typing import List


@dataclass(frozen=True)
class Action:
    component_id: str
    action: str
    kind: str
    sku: str
    quantity: int
    zones: int


@dataclass(frozen=True)
class Candidate:
    id: str
    actions: List[Action]

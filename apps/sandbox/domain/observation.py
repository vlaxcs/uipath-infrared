from dataclasses import dataclass


@dataclass(frozen=True)
class Observation:
    component_id: str
    resource_id: str
    phase: str
    ok: bool
    source: str
    detail: str = ""

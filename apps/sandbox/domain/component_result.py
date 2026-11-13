from collections import Counter
from dataclasses import dataclass
from typing import Optional, Sequence

from .built import BuiltComponent
from .failure_target import FailureTarget
from .observation import Observation
from .traffic_record import PHASES


@dataclass(frozen=True)
class ComponentResult:
    component_id: str
    kind: str
    status: str
    availability_pct: Optional[float]
    basis: str
    note: str


def component_status(observations: Sequence[Observation]) -> str:
    if all(observation.ok for observation in observations):
        return "healthy"
    last_by_resource = {}
    for observation in observations:
        last_by_resource[observation.resource_id] = observation.ok
    return "failed" if not any(last_by_resource.values()) else "degraded"


def summarize_component(
    component: BuiltComponent,
    observations: Sequence[Observation],
    failure_target: Optional[FailureTarget],
    extra_note: str = "",
) -> ComponentResult:
    own = [observation for observation in observations if observation.component_id == component.component_id]
    targeted = failure_target is not None and failure_target.component_id == component.component_id
    prefix = f"failure injected here: {failure_target.reason}. " if targeted else ""
    if not own:
        return ComponentResult(component.component_id, component.kind, "degraded", None, "", f"{prefix}not observed during the run")
    ok = sum(1 for observation in own if observation.ok)
    per_phase = ", ".join(
        f"{phase} {sum(1 for o in own if o.phase == phase and o.ok)}/{sum(1 for o in own if o.phase == phase)}"
        for phase in PHASES
    )
    sources = Counter(observation.source for observation in own)
    basis = " + ".join(f"{count} {source} checks" for source, count in sorted(sources.items()))
    failures = Counter(observation.detail for observation in own if not observation.ok)
    failure_text = "; ".join(f"{detail} x{count}" for detail, count in failures.most_common(3))
    parts = [f"{prefix}{ok}/{len(own)} checks ok ({per_phase})"]
    if failure_text:
        parts.append(f"failures: {failure_text}")
    if extra_note:
        parts.append(extra_note)
    return ComponentResult(
        component.component_id,
        component.kind,
        component_status(own),
        ok / len(own) * 100.0,
        basis,
        ". ".join(parts),
    )

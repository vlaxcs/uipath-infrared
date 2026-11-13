from dataclasses import dataclass
from typing import List, Sequence

from .measurement import Sample

PHASES = ("baseline", "failure", "recovery")


@dataclass(frozen=True)
class TrafficRecord:
    elapsed_s: float
    phase: str
    protocol: str
    component_id: str
    ok: bool
    latency_ms: float
    detail: str


def measured_records(records: Sequence[TrafficRecord]) -> List[TrafficRecord]:
    http = [record for record in records if record.protocol == "http" and record.phase in PHASES]
    return http or [record for record in records if record.phase in PHASES]


def samples_for_phase(records: Sequence[TrafficRecord], phase: str) -> List[Sample]:
    return [Sample(record.elapsed_s, record.ok, record.latency_ms) for record in records if record.phase == phase]

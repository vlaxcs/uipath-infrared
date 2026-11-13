from collections import Counter
from typing import List, Sequence

from .observation import Observation
from .traffic_record import PHASES, TrafficRecord


def record_observations(records: Sequence[TrafficRecord]) -> List[Observation]:
    return [
        Observation(record.component_id, f"{record.protocol}:{record.component_id}", record.phase, record.ok, f"data-plane {record.protocol}", "ok" if record.ok else record.detail)
        for record in records
        if record.phase in PHASES
    ]


def served_by(records: Sequence[TrafficRecord]) -> Counter:
    return Counter(
        record.detail.split()[-1]
        for record in records
        if record.protocol == "http" and record.ok and record.phase in PHASES and record.detail.startswith("ok ")
    )

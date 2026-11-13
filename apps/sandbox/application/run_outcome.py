from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional

from ..domain.build_plan import NotBuilt
from ..domain.built import BuiltComponent
from ..domain.end_state import SkippedAction
from ..domain.failure_target import FailureTarget
from ..domain.observation import Observation
from ..domain.teardown_selection import InventoryItem
from ..domain.traffic_record import TrafficRecord


@dataclass
class RunOutcome:
    candidate_id: str
    forecast_id: str
    min_availability_pct: float
    prefix: str
    endpoint: str
    started_at: datetime
    vpc_id: str = ""
    components: List[BuiltComponent] = field(default_factory=list)
    not_built: List[NotBuilt] = field(default_factory=list)
    skipped: List[SkippedAction] = field(default_factory=list)
    failure_target: Optional[FailureTarget] = None
    injected_at_s: float = 0.0
    restored_at_s: float = 0.0
    effective_after_s: float = 0.0
    inject_detail: str = ""
    restore_detail: str = ""
    phase_seconds: Dict[str, float] = field(default_factory=dict)
    requests_per_second: int = 0
    target_endpoint: str = ""
    records: List[TrafficRecord] = field(default_factory=list)
    observations: List[Observation] = field(default_factory=list)
    readiness: Dict = field(default_factory=dict)
    notes: List[str] = field(default_factory=list)
    completed_at: Optional[datetime] = None
    remaining: List[InventoryItem] = field(default_factory=list)

from dataclasses import dataclass

from engine.domain.end_state import Placement
from engine.domain.provenance import Evidence

SECONDS_PER_HOUR = 3600
STORAGE_KEYS = ("storage_gb", "disk_gb")


@dataclass(frozen=True)
class Demand:
    quantity: float
    basis: str
    evidence: tuple[Evidence, ...]


def driver_demand(placement: Placement, driver: str, hours_per_month: float) -> Demand | None:
    match driver:
        case "storage_gb_month":
            return _storage(placement)
        case "task_vcpu_month":
            return _per_task(placement, placement.unit_vcpu(), "vcpu")
        case "task_gb_month":
            return _per_task(placement, placement.unit_memory_gb(), "memory_gb")
        case "gateway_month":
            return Demand(placement.quantity, f"{placement.quantity:g} gateways", ())
        case "requests_million":
            return _requests(placement, hours_per_month)
        case "iops_month":
            return _iops(placement, hours_per_month)
    return None


def _storage(placement: Placement) -> Demand | None:
    component = placement.component
    for key in STORAGE_KEYS:
        metric = component.capacity.get(key)
        if metric is not None:
            total = metric.value * placement.quantity
            return Demand(total, f"{key} {metric.value:g} x {placement.quantity:g}", (metric.evidence,))
    if component.data_gb is not None:
        return Demand(component.data_gb.value, f"data_gb {component.data_gb.value:g}", (component.data_gb.evidence,))
    return None


def _per_task(placement: Placement, unit_value: float | None, key: str) -> Demand | None:
    if unit_value is None:
        return None
    metric = placement.component.capacity.get(key)
    evidence = (metric.evidence,) if metric is not None else ()
    return Demand(unit_value * placement.quantity, f"{key} {unit_value:g} x {placement.quantity:g} tasks", evidence)


def _requests(placement: Placement, hours_per_month: float) -> Demand | None:
    usage = placement.component.usage
    requests = usage.get("requests")
    if requests is not None and requests.monthly_sum is not None:
        return Demand(requests.monthly_sum / 1e6, "requests sum x 30 / window_days", (requests.evidence,))
    read, write = usage.get("consumed_rcu"), usage.get("consumed_wcu")
    if read is not None and write is not None and read.avg is not None and write.avg is not None:
        per_month = (read.avg + write.avg) * SECONDS_PER_HOUR * hours_per_month
        return Demand(per_month / 1e6, "consumed RCU+WCU avg per second over the month", (read.evidence, write.evidence))
    return None


def _iops(placement: Placement, hours_per_month: float) -> Demand | None:
    usage = placement.component.usage
    series = [usage[key] for key in ("read_iops", "write_iops") if key in usage and usage[key].avg is not None]
    if not series:
        return None
    per_second = sum(u.avg for u in series)
    total = per_second * SECONDS_PER_HOUR * hours_per_month * placement.quantity
    return Demand(total, "read+write IOPS avg over the month", tuple(u.evidence for u in series))

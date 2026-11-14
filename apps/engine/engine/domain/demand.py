from dataclasses import dataclass

from engine.domain.end_state import Placement
from engine.domain.provenance import Evidence

SECONDS_PER_HOUR = 3600
STORAGE_KEYS = ("storage_gb", "disk_gb")
MILLION = 1e6


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
            return _per_quantity(placement, "gateways")
        case "cluster_month":
            return _per_quantity(placement, "clusters")
        case "load_balancer_month":
            return _per_quantity(placement, "load balancers")
        case "address_month":
            return _per_quantity(placement, "addresses")
        case "zone_month":
            return _per_quantity(placement, "zones")
        case "shard_month":
            return _capacity(placement, "shards")
        case "throughput_mibps_month":
            return _capacity(placement, "throughput_mibps")
        case "provisioned_rcu_month":
            return _capacity(placement, "provisioned_rcu")
        case "provisioned_wcu_month":
            return _capacity(placement, "provisioned_wcu")
        case "messages_million":
            return _usage_sum_million(placement, ("messages_sent", "messages_received", "empty_receives"))
        case "invocations_million":
            return _usage_million(placement, "invocations")
        case "gb_s_month":
            return _gb_s(placement)
        case "consumed_rcu_million":
            return _usage_rate_million(placement, "consumed_rcu", hours_per_month)
        case "consumed_wcu_million":
            return _usage_rate_million(placement, "consumed_wcu", hours_per_month)
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


def _per_quantity(placement: Placement, unit_name: str) -> Demand:
    return Demand(placement.quantity, f"{placement.quantity:g} {unit_name}", ())


def _capacity(placement: Placement, key: str) -> Demand | None:
    metric = placement.component.capacity.get(key)
    if metric is None:
        return None
    total = metric.value * placement.quantity
    return Demand(total, f"{key} {metric.value:g} x {placement.quantity:g}", (metric.evidence,))


def _usage_million(placement: Placement, key: str) -> Demand | None:
    usage = placement.component.usage.get(key)
    if usage is None or usage.monthly_sum is None:
        return None
    return Demand(usage.monthly_sum / MILLION, f"{key} sum x 30 / window_days", (usage.evidence,))


def _usage_sum_million(placement: Placement, keys: tuple[str, ...]) -> Demand | None:
    parts = []
    evidence = []
    for key in keys:
        usage = placement.component.usage.get(key)
        if usage is not None and usage.monthly_sum is not None:
            parts.append((key, usage.monthly_sum))
            evidence.append(usage.evidence)
    if not parts:
        return None
    total = sum(monthly for _, monthly in parts)
    basis = " + ".join(f"{key} sum x 30 / window_days" for key, _ in parts)
    return Demand(total / MILLION, basis, tuple(evidence))


def _usage_rate_million(placement: Placement, key: str, hours_per_month: float) -> Demand | None:
    usage = placement.component.usage.get(key)
    if usage is None or usage.avg is None:
        return None
    per_month = usage.avg * SECONDS_PER_HOUR * hours_per_month * placement.quantity
    return Demand(per_month / MILLION, f"{key} avg per second over the month", (usage.evidence,))


def _gb_s(placement: Placement) -> Demand | None:
    component = placement.component
    memory = component.capacity.get("memory_gb")
    invocations = component.usage.get("invocations")
    duration = component.usage.get("duration_ms")
    if memory is None or invocations is None or duration is None:
        return None
    if invocations.monthly_sum is None or duration.avg is None:
        return None
    seconds = duration.avg / 1000.0
    gb_s = memory.value * seconds * invocations.monthly_sum * placement.quantity
    basis = (
        f"memory_gb {memory.value:g} x duration_ms avg {duration.avg:g} / 1000 "
        f"x invocations sum x 30 / window_days x {placement.quantity:g}"
    )
    return Demand(gb_s, basis, (memory.evidence, invocations.evidence, duration.evidence))


def _iops(placement: Placement, hours_per_month: float) -> Demand | None:
    usage = placement.component.usage
    series = [usage[key] for key in ("read_iops", "write_iops") if key in usage and usage[key].avg is not None]
    if not series:
        return None
    per_second = sum(u.avg for u in series)
    total = per_second * SECONDS_PER_HOUR * hours_per_month * placement.quantity
    return Demand(total, "read+write IOPS avg over the month", tuple(u.evidence for u in series))

import math
from dataclasses import dataclass

from engine.domain.catalog import Option, Tier
from engine.domain.model import Component
from engine.domain.provenance import Evidence
from engine.domain.tiers import resolve_tier

HEADROOM = 0.3
UNDERSIZED_CPU_P95_PCT = 80.0
UNDERSIZED_MEMORY_P95_PCT = 85.0
UNPRICED_OVERSIZE_MAX_NEED = 0.5
RESOURCES = (("cpu_pct", "vcpu"), ("memory_pct", "memory_gb"), ("gpu_pct", "gpus"))
MEMORY_UNKNOWN = "memory use is not reported, so memory cannot be cut safely"
NO_SMALLER_OPTION = "the catalog has no option to price a smaller size"
ROUNDING_SLACK = 1e-9


@dataclass(frozen=True)
class Load:
    usage_key: str
    capacity_key: str
    pct: float
    evidence: tuple[Evidence, ...]


@dataclass(frozen=True)
class Target:
    basis: str
    evidence: tuple[Evidence, ...]
    quantity: int | None = None
    tier: str | None = None
    vcpu: float | None = None
    memory_gb: float | None = None
    blocked: str | None = None


def is_pool(component: Component) -> bool:
    return not component.stateful and component.quantity > 1


def loads(component: Component, stat: str) -> tuple[Load, ...]:
    found = []
    for usage_key, capacity_key in RESOURCES:
        usage = component.usage.get(usage_key)
        pct = None if usage is None else getattr(usage, stat)
        if pct is None:
            continue
        capacity = component.capacity.get(capacity_key)
        evidence = (usage.evidence,) + ((capacity.evidence,) if capacity is not None else ())
        found.append(Load(usage_key, capacity_key, pct, evidence))
    return tuple(found)


def is_undersized(component: Component) -> bool:
    by_key = {load.usage_key: load.pct for load in loads(component, "p95")}
    return (
        by_key.get("cpu_pct", 0.0) > UNDERSIZED_CPU_P95_PCT
        or by_key.get("memory_pct", 0.0) > UNDERSIZED_MEMORY_P95_PCT
    )


def shrink_target(
    component: Component, option: Option | None, stat: str = "p95", min_units: int = 1,
) -> Target | None:
    found = loads(component, stat)
    if not found:
        return None
    if is_pool(component):
        target = _pool_target(component, found, stat, min_units)
        return target if target.quantity < component.quantity else None
    return _smaller_unit(component, option, found, stat)


def grow_target(component: Component, option: Option | None) -> Target | None:
    if not is_undersized(component):
        return None
    found = loads(component, "p95")
    if is_pool(component):
        return _pool_target(component, found, "p95", 1)
    need_vcpu, need_memory, evidence, _ = _unit_need(component, found)
    basis = _unit_basis(found, "p95")
    tiers = option.pricing.tiers if option else ()
    choice = resolve_tier(tiers, None, need_vcpu, need_memory, component.capacity_value("gpus"))
    if choice is not None and choice.units == 1:
        return Target(f"{basis}: {choice.tier.id}", evidence, tier=choice.tier.id)
    return Target(basis, evidence, vcpu=need_vcpu, memory_gb=need_memory)


def _pool_target(component: Component, found: tuple[Load, ...], stat: str, min_units: int) -> Target:
    busiest = max(found, key=lambda load: (load.pct, load.usage_key))
    needed = max(1, math.ceil(component.quantity * _with_headroom(busiest.pct) - ROUNDING_SLACK))
    units = max(needed, min_units)
    floor = f", kept at the floor of {min_units}" if units > needed else ""
    basis = (
        f"{busiest.usage_key} {stat} {busiest.pct:g}% across {component.quantity} units, "
        f"{HEADROOM:.0%} headroom: {units} units{floor}"
    )
    return Target(basis, tuple(e for load in found for e in load.evidence), quantity=units)


def _smaller_unit(
    component: Component, option: Option | None, found: tuple[Load, ...], stat: str,
) -> Target | None:
    vcpu, memory = component.capacity_value("vcpu"), component.capacity_value("memory_gb")
    if vcpu is None or memory is None or not any(load.usage_key == "cpu_pct" for load in found):
        return None
    need_vcpu, need_memory, evidence, memory_known = _unit_need(component, found)
    basis = _unit_basis(found, stat)
    tiers = option.pricing.tiers if option else ()
    if not tiers:
        small = max(need_vcpu / vcpu, need_memory / memory) <= UNPRICED_OVERSIZE_MAX_NEED
        return Target(basis, evidence, blocked=NO_SMALLER_OPTION) if small else None
    choice = resolve_tier(tiers, None, need_vcpu, need_memory, component.capacity_value("gpus"))
    if choice is not None and choice.units == 1 and _is_smaller(choice.tier, vcpu, memory):
        return Target(f"{basis}: {choice.tier.id}", evidence, tier=choice.tier.id)
    if not memory_known and any(need_vcpu <= tier.vcpu < vcpu for tier in tiers):
        return Target(basis, evidence, blocked=MEMORY_UNKNOWN)
    return None


def _unit_need(component: Component, found: tuple[Load, ...]) -> tuple[float, float, tuple[Evidence, ...], bool]:
    by_key = {load.usage_key: load for load in found}
    vcpu, memory = component.capacity_value("vcpu") or 0.0, component.capacity_value("memory_gb") or 0.0
    cpu, mem = by_key.get("cpu_pct"), by_key.get("memory_pct")
    need_vcpu = vcpu * _with_headroom(cpu.pct) if cpu else vcpu
    need_memory = memory * _with_headroom(mem.pct) if mem else memory
    return need_vcpu, need_memory, tuple(e for load in found for e in load.evidence), mem is not None


def _unit_basis(found: tuple[Load, ...], stat: str) -> str:
    used = ", ".join(f"{load.usage_key} {stat} {load.pct:g}%" for load in found)
    return f"{used}, {HEADROOM:.0%} headroom"


def _with_headroom(pct: float) -> float:
    return pct / 100 / (1 - HEADROOM)


def _is_smaller(tier: Tier, vcpu: float, memory_gb: float) -> bool:
    return tier.vcpu <= vcpu and tier.memory_gb <= memory_gb and (tier.vcpu < vcpu or tier.memory_gb < memory_gb)

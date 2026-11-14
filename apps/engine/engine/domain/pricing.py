from dataclasses import dataclass
from enum import StrEnum

from engine.domain.catalog import Option
from engine.domain.demand import driver_demand
from engine.domain.end_state import Placement
from engine.domain.provenance import Evidence
from engine.domain.tiers import resolve_tier


class Growth(StrEnum):
    TRAFFIC = "traffic"
    DATA = "data"
    FIXED = "fixed"


DRIVER_GROWTH = {
    "storage_gb_month": Growth.DATA,
    "throughput_mibps_month": Growth.DATA,
    "iops_month": Growth.TRAFFIC,
    "task_vcpu_month": Growth.TRAFFIC,
    "task_gb_month": Growth.TRAFFIC,
    "messages_million": Growth.TRAFFIC,
    "invocations_million": Growth.TRAFFIC,
    "gb_s_month": Growth.TRAFFIC,
    "ingested_gb_month": Growth.DATA,
    "consumed_rcu_million": Growth.TRAFFIC,
    "consumed_wcu_million": Growth.TRAFFIC,
    "provisioned_rcu_month": Growth.TRAFFIC,
    "provisioned_wcu_month": Growth.TRAFFIC,
    "gateway_month": Growth.FIXED,
    "cluster_month": Growth.FIXED,
    "load_balancer_month": Growth.FIXED,
    "address_month": Growth.FIXED,
    "shard_month": Growth.FIXED,
}


@dataclass(frozen=True)
class PriceLine:
    driver: str
    growth: Growth
    quantity: float
    eur_per_unit: float
    basis: str

    @property
    def monthly_eur(self) -> float:
        return self.quantity * self.eur_per_unit


@dataclass(frozen=True)
class Price:
    option_id: str
    lines: tuple[PriceLine, ...]
    gaps: tuple[str, ...]
    evidence: tuple[Evidence, ...]

    @property
    def monthly_eur(self) -> float:
        return sum(line.monthly_eur for line in self.lines)

    @property
    def complete(self) -> bool:
        return not self.gaps

    @property
    def basis(self) -> str:
        return "; ".join(f"{line.driver}: {line.basis}" for line in self.lines)

    def monthly_by_growth(self) -> dict[Growth, float]:
        totals = {growth: 0.0 for growth in Growth}
        for line in self.lines:
            totals[line.growth] += line.monthly_eur
        return totals


def catalog_price(placement: Placement, option: Option, hours_per_month: float) -> Price:
    if option.pricing.model == "onprem_allocated":
        return Price(option.id, (), ("onprem_allocated",), ())
    lines: list[PriceLine] = []
    gaps: list[str] = []
    evidence: list[Evidence] = []
    if option.pricing.model == "tiered_instance":
        instance = _instance_line(placement, option)
        if instance is None:
            gaps.append("instance_size_unknown")
        else:
            line, used = instance
            lines.append(line)
            evidence.extend(used)
    for unit_price in option.pricing.per_unit:
        demand = driver_demand(placement, unit_price.driver, hours_per_month)
        if demand is None:
            gaps.append(unit_price.driver)
            continue
        lines.append(PriceLine(
            unit_price.driver,
            DRIVER_GROWTH.get(unit_price.driver, Growth.TRAFFIC),
            demand.quantity,
            unit_price.eur_per_unit,
            demand.basis,
        ))
        evidence.extend(demand.evidence)
    if not placement.running:
        lines = [line for line in lines if line.growth == Growth.DATA]
    return Price(option.id, tuple(lines), tuple(gaps), tuple(evidence))


def _instance_line(placement: Placement, option: Option) -> tuple[PriceLine, list[Evidence]] | None:
    component = placement.component
    sku = placement.tier_id or (None if placement.moved else component.sku)
    choice = resolve_tier(
        option.pricing.tiers,
        sku,
        placement.unit_vcpu(),
        placement.unit_memory_gb(),
        component.capacity_value("gpus"),
    )
    if choice is None:
        return None
    multiplier = option.pricing.multi_az_multiplier if placement.zones >= 2 else 1.0
    basis = choice.basis if multiplier == 1.0 else f"{choice.basis}, multi-AZ x{multiplier:g}"
    used = [component.capacity[key].evidence for key in ("vcpu", "memory_gb") if key in component.capacity]
    return (
        PriceLine("instance", Growth.TRAFFIC, choice.units * placement.quantity, choice.tier.monthly_eur * multiplier, basis),
        used,
    )

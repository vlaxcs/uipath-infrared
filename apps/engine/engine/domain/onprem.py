import math
from dataclasses import dataclass

from engine.domain.catalog import Catalog, Platform
from engine.domain.end_state import EndState, Placement
from engine.domain.forecast import Business
from engine.domain.placement_size import unit_size

ONPREM_PROVIDER = "onprem"
MONTHS_PER_YEAR = 12
GB_PER_TB = 1000
VCPU_PER_STAFF_STEP = 100


@dataclass(frozen=True)
class PlatformUse:
    vcpu: float
    memory_gb: float
    storage_tb: float


@dataclass(frozen=True)
class OnpremPlatformCost:
    platform: str
    use: PlatformUse
    capacity_share: float
    platforms_needed: int
    capex_eur: float
    capex_amortised_eur_month: float
    power_cooling_eur_month: float
    colocation_eur_month: float
    disk_replacement_eur_month: float
    staff_hours_month: float
    staff_eur_month: float

    @property
    def full_monthly_eur(self) -> float:
        return (
            self.capex_amortised_eur_month + self.power_cooling_eur_month + self.colocation_eur_month
            + self.disk_replacement_eur_month + self.staff_eur_month
        )

    @property
    def allocated_monthly_eur(self) -> float:
        return self.full_monthly_eur * self.capacity_share


def onprem_placements(end_state: EndState) -> tuple[Placement, ...]:
    return tuple(
        p for p in end_state.live()
        if p.running and p.provider == ONPREM_PROVIDER and not p.unchanged
    )


def platform_cost(end_state: EndState, catalog: Catalog, business: Business) -> OnpremPlatformCost | None:
    placements = onprem_placements(end_state)
    if not placements:
        return None
    platform = _platform_of(placements, catalog)
    use = platform_use(placements, catalog)
    return platform_cost_for(platform, use, business)


def platform_use(placements: tuple[Placement, ...], catalog: Catalog) -> PlatformUse:
    vcpu = memory_gb = storage_tb = 0.0
    for placement in placements:
        unit_vcpu, unit_memory_gb = unit_size(placement, catalog)
        vcpu += (unit_vcpu or 0.0) * placement.quantity
        memory_gb += (unit_memory_gb or 0.0) * placement.quantity
        data = placement.component.data_gb
        storage_tb += data.value / GB_PER_TB if data else 0.0
    return PlatformUse(vcpu, memory_gb, storage_tb)


def platform_cost_for(platform: Platform, use: PlatformUse, business: Business) -> OnpremPlatformCost:
    share = capacity_share(platform, use)
    platforms_needed = max(1, math.ceil(share))
    disks = platform.disks
    failures_per_year = disks.get("count", 0) * disks.get("annual_failure_rate_pct", 0) / 100
    per_failure = disks.get("replacement_eur", 0) + disks.get("replacement_labor_hours", 0) * business.engineer_hourly_eur
    staff_hours = (
        platform.staff.get("base_hours_month", 0)
        + platform.staff.get("hours_per_100_vcpu_month", 0) * platform.capacity.get("vcpu", 0) / VCPU_PER_STAFF_STEP
    )
    return OnpremPlatformCost(
        platform=platform.id,
        use=use,
        capacity_share=share,
        platforms_needed=platforms_needed,
        capex_eur=platform.hardware_capex_eur * platforms_needed,
        capex_amortised_eur_month=platform.hardware_capex_eur / (platform.amortization_years * MONTHS_PER_YEAR),
        power_cooling_eur_month=platform.power_cooling_eur_month,
        colocation_eur_month=platform.colocation_eur_month,
        disk_replacement_eur_month=failures_per_year * per_failure / MONTHS_PER_YEAR,
        staff_hours_month=staff_hours,
        staff_eur_month=staff_hours * business.engineer_hourly_eur,
    )


def capacity_share(platform: Platform, use: PlatformUse) -> float:
    shares = [
        _ratio(use.vcpu, platform.capacity.get("vcpu")),
        _ratio(use.memory_gb, platform.capacity.get("memory_gb")),
        _ratio(use.storage_tb, platform.capacity.get("storage_tb")),
    ]
    return max(shares)


def _ratio(used: float, capacity: float | None) -> float:
    return used / capacity if capacity else 0.0


def _platform_of(placements: tuple[Placement, ...], catalog: Catalog) -> Platform:
    ids = sorted({catalog.option(p.option_id).platform for p in placements if p.option_id} - {None})
    return catalog.platforms[ids[0]]

import math
from dataclasses import dataclass, fields, replace
from typing import Mapping

from engine.domain.catalog import Catalog, Platform
from engine.domain.end_state import EndState, Placement
from engine.domain.forecast import Forecast
from engine.domain.growth import growth_factor
from engine.domain.placement_size import unit_size
from engine.domain.pricing import Growth

ONPREM_PROVIDER = "onprem"
MONTHS_PER_YEAR = 12
GB_PER_TB = 1000
VCPU_PER_STAFF_STEP = 100
PERCENT = 100
SIZING_SCENARIO = "base"


@dataclass(frozen=True)
class PlatformUse:
    vcpu: float
    memory_gb: float
    storage_tb: float

    def grown(self, traffic: float, data: float) -> "PlatformUse":
        return PlatformUse(self.vcpu * traffic, self.memory_gb * traffic, self.storage_tb * data)


@dataclass(frozen=True)
class PlatformLines:
    capex_amortised_eur_month: float
    power_cooling_eur_month: float
    colocation_eur_month: float
    disk_replacement_eur_month: float
    staff_eur_month: float
    maintenance_eur_month: float
    network_eur_month: float
    licences_eur_month: float
    contingency_eur_month: float

    @property
    def total_eur_month(self) -> float:
        return sum(getattr(self, f.name) for f in fields(self))

    def scaled(self, factor: float) -> "PlatformLines":
        return replace(self, **{f.name: getattr(self, f.name) * factor for f in fields(self)})


@dataclass(frozen=True)
class OnpremPlatformCost:
    platform: str
    use: PlatformUse
    capacity_share: float
    capacity_share_at_horizon: float
    platforms_needed: int
    capex_eur: float
    staff_hours_month: float
    full: PlatformLines
    setup_one_off_eur: float
    hardware_capex_eur: float
    component_eur_month: Mapping[str, float]

    @property
    def full_monthly_eur(self) -> float:
        return self.full.total_eur_month

    @property
    def allocated(self) -> PlatformLines:
        return self.full.scaled(self.capacity_share)

    @property
    def allocated_monthly_eur(self) -> float:
        return self.full_monthly_eur * self.capacity_share

    @property
    def setup_eur(self) -> float:
        return self.setup_one_off_eur * self.capacity_share

    @property
    def upfront_hardware_eur(self) -> float:
        return self.hardware_capex_eur * self.capacity_share


def onprem_placements(end_state: EndState) -> tuple[Placement, ...]:
    return tuple(
        p for p in end_state.live()
        if p.running and p.provider == ONPREM_PROVIDER and not p.unchanged
    )


def platform_cost(end_state: EndState, catalog: Catalog, forecast: Forecast) -> OnpremPlatformCost | None:
    placements = onprem_placements(end_state)
    if not placements:
        return None
    platform = _platform_of(placements, catalog)
    cost = platform_cost_for(platform, platform_use(placements, catalog), forecast)
    return replace(cost, component_eur_month=_by_component(cost, platform, placements, catalog))


def platform_use(placements: tuple[Placement, ...], catalog: Catalog) -> PlatformUse:
    vcpu = memory_gb = storage_tb = 0.0
    for placement in placements:
        unit_vcpu, unit_memory_gb = unit_size(placement, catalog)
        vcpu += (unit_vcpu or 0.0) * placement.quantity
        memory_gb += (unit_memory_gb or 0.0) * placement.quantity
        data = placement.component.data_gb
        storage_tb += data.value / GB_PER_TB if data else 0.0
    return PlatformUse(vcpu, memory_gb, storage_tb)


def platform_cost_for(platform: Platform, use: PlatformUse, forecast: Forecast) -> OnpremPlatformCost:
    rate = forecast.business.engineer_hourly_eur
    share = capacity_share(platform, use)
    at_horizon = capacity_share(platform, horizon_use(use, forecast))
    platforms_needed = max(1, math.ceil(max(share, at_horizon)))
    disks = platform.disks
    failures_per_year = disks.get("count", 0) * disks.get("annual_failure_rate_pct", 0) / PERCENT
    per_failure = disks.get("replacement_eur", 0) + disks.get("replacement_labor_hours", 0) * rate
    staff_hours = (
        platform.staff.get("base_hours_month", 0)
        + platform.staff.get("hours_per_100_vcpu_month", 0) * platform.capacity.get("vcpu", 0) / VCPU_PER_STAFF_STEP
    )
    running = PlatformLines(
        capex_amortised_eur_month=platform.hardware_capex_eur / (platform.amortization_years * MONTHS_PER_YEAR),
        power_cooling_eur_month=platform.power_cooling_eur_month,
        colocation_eur_month=platform.colocation_eur_month,
        disk_replacement_eur_month=failures_per_year * per_failure / MONTHS_PER_YEAR,
        staff_eur_month=staff_hours * rate,
        maintenance_eur_month=platform.hardware_capex_eur * platform.maintenance_pct_of_capex_year / PERCENT / MONTHS_PER_YEAR,
        network_eur_month=platform.network_eur_month,
        licences_eur_month=platform.licences_eur_month,
        contingency_eur_month=0.0,
    )
    margin = (running.total_eur_month - running.capex_amortised_eur_month) * platform.contingency_pct / PERCENT
    return OnpremPlatformCost(
        platform=platform.id,
        use=use,
        capacity_share=share,
        capacity_share_at_horizon=at_horizon,
        platforms_needed=platforms_needed,
        capex_eur=platform.hardware_capex_eur * platforms_needed,
        staff_hours_month=staff_hours,
        full=replace(running, contingency_eur_month=margin),
        setup_one_off_eur=platform.setup_one_off_eur,
        hardware_capex_eur=platform.hardware_capex_eur,
        component_eur_month={},
    )


def horizon_use(use: PlatformUse, forecast: Forecast) -> PlatformUse:
    scenario = forecast.scenarios[SIZING_SCENARIO]
    month = forecast.horizon_months
    return use.grown(
        growth_factor(scenario, forecast.events, Growth.TRAFFIC, month),
        growth_factor(scenario, forecast.events, Growth.DATA, month),
    )


def capacity_share(platform: Platform, use: PlatformUse) -> float:
    shares = [
        _ratio(use.vcpu, platform.capacity.get("vcpu")),
        _ratio(use.memory_gb, platform.capacity.get("memory_gb")),
        _ratio(use.storage_tb, platform.capacity.get("storage_tb")),
    ]
    return max(shares)


def _by_component(
    cost: OnpremPlatformCost, platform: Platform, placements: tuple[Placement, ...], catalog: Catalog,
) -> dict[str, float]:
    own = {p.component.id: capacity_share(platform, platform_use((p,), catalog)) for p in placements}
    total = sum(own.values())
    return {cid: cost.allocated_monthly_eur * s / total if total else 0.0 for cid, s in own.items()}


def _ratio(used: float, capacity: float | None) -> float:
    return used / capacity if capacity else 0.0


def _platform_of(placements: tuple[Placement, ...], catalog: Catalog) -> Platform:
    ids = sorted({catalog.option(p.option_id).platform for p in placements if p.option_id} - {None})
    return catalog.platforms[ids[0]]

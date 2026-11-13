from dataclasses import dataclass
from math import prod

from engine.domain.catalog import Catalog, Option
from engine.domain.end_state import EndState, Placement
from engine.domain.model import Infra
from engine.domain.structure import critical_paths

DEFAULT_SINGLE_ZONE_AVAILABILITY_PCT = 99.5
SINGLE_ZONE_SCOPE = "single_zone"
FULL_AVAILABILITY_PCT = 100.0


@dataclass(frozen=True)
class ComponentAvailability:
    component: str
    availability_pct: float
    zones: int
    basis: str


@dataclass(frozen=True)
class PathAvailability:
    stack: str
    entry: str
    components: tuple[ComponentAvailability, ...]

    @property
    def availability_pct(self) -> float:
        return prod(c.availability_pct / 100 for c in self.components) * 100


@dataclass(frozen=True)
class Availability:
    paths: tuple[PathAvailability, ...]

    @property
    def availability_pct(self) -> float:
        return min((p.availability_pct for p in self.paths), default=FULL_AVAILABILITY_PCT)


def availability_of(end_state: EndState, infra: Infra, catalog: Catalog) -> Availability:
    paths = []
    for path in critical_paths(infra):
        serving = [
            end_state.placements[component_id] for component_id in path.components
            if _serves(end_state.placements[component_id])
        ]
        if serving:
            paths.append(PathAvailability(
                path.stack, path.entry, tuple(placement_availability(p, catalog) for p in serving),
            ))
    return Availability(tuple(paths))


def placement_availability(placement: Placement, catalog: Catalog) -> ComponentAvailability:
    option = catalog.option(placement.option_id) if placement.option_id else None
    pct, basis = _from_option(placement.zones, option) if option else _from_default(placement.zones)
    return ComponentAvailability(placement.component.id, pct, placement.zones, basis)


def _serves(placement: Placement) -> bool:
    return placement.running and not placement.removed


def _from_option(zones: int, option: Option) -> tuple[float, str]:
    sla = option.sla
    if sla.failure_domain_scope != SINGLE_ZONE_SCOPE:
        return sla.availability_pct, f"{option.id} SLA, {sla.failure_domain_scope}"
    if zones < 2:
        return sla.availability_pct, f"{option.id} SLA, 1 zone"
    if sla.multi_az_availability_pct is not None:
        return sla.multi_az_availability_pct, f"{option.id} multi-AZ SLA, {zones} zones"
    return _across_zones(sla.availability_pct, zones), f"{option.id} SLA across {zones} zones"


def _from_default(zones: int) -> tuple[float, str]:
    if zones < 2:
        return DEFAULT_SINGLE_ZONE_AVAILABILITY_PCT, "no catalog option, default for 1 zone"
    return (
        _across_zones(DEFAULT_SINGLE_ZONE_AVAILABILITY_PCT, zones),
        f"no catalog option, default across {zones} zones",
    )


def _across_zones(single_zone_pct: float, zones: int) -> float:
    return (1 - (1 - single_zone_pct / 100) ** zones) * 100

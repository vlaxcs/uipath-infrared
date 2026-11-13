from dataclasses import dataclass, replace
from typing import Mapping

from engine.domain.candidate import ACCOUNT_SCOPE, Action, ActionKind, Candidate
from engine.domain.catalog import Catalog, Option
from engine.domain.model import Component, Infra


@dataclass(frozen=True)
class Placement:
    component: Component
    option_id: str | None
    provider: str
    region: str
    zones: int
    quantity: float
    tier_id: str | None = None
    vcpu: float | None = None
    memory_gb: float | None = None
    running: bool = True
    autoscaled: bool = False
    removed: bool = False
    origin_option_id: str | None = None
    remediated: frozenset[str] = frozenset()

    @property
    def unchanged(self) -> bool:
        return _footprint(self) == _footprint(initial_placement(self.component, self.origin_option_id))

    @property
    def switched_option(self) -> bool:
        return self.option_id != self.origin_option_id

    @property
    def moved(self) -> bool:
        return self.provider != self.component.provider or self.region != self.component.region

    def unit_vcpu(self) -> float | None:
        return self.vcpu if self.vcpu is not None else self.component.capacity_value("vcpu")

    def unit_memory_gb(self) -> float | None:
        return self.memory_gb if self.memory_gb is not None else self.component.capacity_value("memory_gb")


@dataclass(frozen=True)
class EndState:
    candidate: Candidate
    placements: Mapping[str, Placement]
    remediated_controls: frozenset[str] = frozenset()

    def live(self) -> tuple[Placement, ...]:
        return tuple(p for p in self.placements.values() if not p.removed)


def initial_placement(component: Component, option_id: str | None) -> Placement:
    return Placement(
        component=component,
        option_id=option_id,
        provider=component.provider,
        region=component.region,
        zones=component.zones or 1,
        quantity=component.quantity,
        origin_option_id=option_id,
    )


def _footprint(placement: Placement) -> tuple:
    return (
        placement.option_id, placement.provider, placement.region, placement.zones, placement.quantity,
        placement.tier_id, placement.vcpu, placement.memory_gb, placement.running, placement.autoscaled,
        placement.removed,
    )


def apply_candidate(infra: Infra, catalog: Catalog, candidate: Candidate) -> EndState:
    placements = {}
    for component in infra.components:
        current = catalog.current_option(component)
        placements[component.id] = initial_placement(component, current.id if current else None)
    controls = set()
    for action in candidate.actions:
        if action.component == ACCOUNT_SCOPE:
            controls.add(action.signal)
        else:
            placements[action.component] = apply_action(placements[action.component], action, catalog)
    return EndState(candidate, placements, frozenset(controls))


def apply_action(placement: Placement, action: Action, catalog: Catalog) -> Placement:
    match action.kind:
        case ActionKind.DELETE:
            return replace(placement, removed=True)
        case ActionKind.STOP:
            return replace(placement, running=False)
        case ActionKind.RESIZE:
            return replace(
                placement,
                tier_id=action.tier or placement.tier_id,
                quantity=placement.quantity if action.quantity is None else action.quantity,
                vcpu=placement.vcpu if action.vcpu is None else action.vcpu,
                memory_gb=placement.memory_gb if action.memory_gb is None else action.memory_gb,
            )
        case ActionKind.SCALE:
            return replace(placement, zones=action.zones or placement.zones)
        case ActionKind.AUTOSCALE:
            return replace(
                placement,
                autoscaled=True,
                quantity=placement.quantity if action.quantity is None else action.quantity,
            )
        case ActionKind.REMEDIATE:
            return replace(placement, remediated=placement.remediated | {action.signal})
        case ActionKind.MOVE:
            return _move(placement, catalog.option(action.option), action, catalog)
    return placement


def _move(placement: Placement, option: Option, action: Action, catalog: Catalog) -> Placement:
    return replace(
        placement,
        option_id=option.id,
        provider=option.provider,
        region=action.region or _target_region(placement.region, option, catalog),
        tier_id=action.tier,
        zones=action.zones or placement.zones,
    )


def _target_region(region: str, option: Option, catalog: Catalog) -> str:
    if option.platform and option.platform in catalog.platforms:
        return catalog.platforms[option.platform].region
    if option.serves_region(region):
        return region
    concrete = [r for r in option.regions if "*" not in r]
    return concrete[0] if concrete else region

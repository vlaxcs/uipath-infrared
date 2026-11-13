from dataclasses import dataclass
from typing import Mapping

from engine.domain.catalog import Catalog, Option
from engine.domain.end_state import EndState, Placement
from engine.domain.forecast import Business

GB_PER_100 = 100
SIDE_BY_SIDE_MONTHS = 1


@dataclass(frozen=True)
class MigrationStep:
    component: str
    kind: str
    option_from: str | None
    option_to: str | None
    hours: float
    eur: float
    cutover_hours: float
    risk_factor: float
    weight_eur: float


@dataclass(frozen=True)
class Migration:
    steps: tuple[MigrationStep, ...]

    @property
    def hours(self) -> float:
        return sum(s.hours for s in self.steps)

    @property
    def eur(self) -> float:
        return sum(s.eur for s in self.steps)

    @property
    def cutover_hours(self) -> float:
        return max((s.cutover_hours for s in self.steps), default=0.0)

    @property
    def risk(self) -> float:
        weight = sum(s.weight_eur for s in self.steps)
        if weight == 0:
            return max((s.risk_factor for s in self.steps), default=0.0)
        return sum(s.risk_factor * s.weight_eur for s in self.steps) / weight


def migration_of(
    end_state: EndState,
    catalog: Catalog,
    business: Business,
    current_monthly_eur: Mapping[str, float],
    new_monthly_eur: Mapping[str, float],
) -> Migration:
    steps = []
    for placement in end_state.placements.values():
        step = _step(placement, catalog, business, current_monthly_eur, new_monthly_eur)
        if step is not None:
            steps.append(step)
    return Migration(tuple(steps))


def _step(
    placement: Placement,
    catalog: Catalog,
    business: Business,
    current_monthly_eur: Mapping[str, float],
    new_monthly_eur: Mapping[str, float],
) -> MigrationStep | None:
    if placement.removed or not placement.running or placement.unchanged:
        return None
    component = placement.component
    weight = new_monthly_eur.get(component.id, 0.0)
    if placement.switched_option or placement.moved:
        return _move(placement, catalog, business, current_monthly_eur.get(component.id, 0.0), weight)
    if placement.option_id is None:
        return None
    option = catalog.option(placement.option_id)
    hours = option.migration.effort_hours_fixed * option.migration.same_provider_factor
    return MigrationStep(
        component=component.id,
        kind="in_place",
        option_from=option.id,
        option_to=option.id,
        hours=hours,
        eur=hours * business.engineer_hourly_eur,
        cutover_hours=option.migration.cutover_downtime_hours,
        risk_factor=option.migration.risk_factor * option.migration.same_provider_factor,
        weight_eur=weight,
    )


def _move(
    placement: Placement,
    catalog: Catalog,
    business: Business,
    current_eur: float,
    weight: float,
) -> MigrationStep:
    component = placement.component
    target = catalog.option(placement.option_id)
    source = catalog.option(placement.origin_option_id) if placement.origin_option_id else None
    data_gb = component.data_gb.value if component.data_gb else 0.0
    factor = target.migration.same_provider_factor if target.provider == component.provider else 1.0
    hours = (
        target.migration.effort_hours_fixed + target.migration.effort_hours_per_100gb * data_gb / GB_PER_100
    ) * factor
    side_by_side = current_eur * SIDE_BY_SIDE_MONTHS if component.stateful else 0.0
    transfer = _transfer_eur(source, data_gb) if placement.moved else 0.0
    return MigrationStep(
        component=component.id,
        kind="move",
        option_from=placement.origin_option_id,
        option_to=target.id,
        hours=hours,
        eur=hours * business.engineer_hourly_eur + side_by_side + transfer,
        cutover_hours=target.migration.cutover_downtime_hours,
        risk_factor=target.migration.risk_factor,
        weight_eur=weight,
    )


def _transfer_eur(source: Option | None, data_gb: float) -> float:
    if source is None:
        return 0.0
    billable = max(0.0, data_gb - source.pricing.free_egress_gb)
    return billable * source.pricing.egress_per_gb_eur


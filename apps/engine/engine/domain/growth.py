from typing import Iterable, Mapping

from engine.domain.costing import ComponentCost
from engine.domain.end_state import Placement
from engine.domain.forecast import Event, Forecast, ProjectGrowth, Scenario
from engine.domain.pricing import Growth

DATA_KINDS = frozenset({"object_storage", "block_storage", "file_system"})


def growth_split(cost: ComponentCost, placement: Placement) -> dict[Growth, float]:
    if cost.monthly_eur == 0:
        return {}
    if placement.component.status != "active":
        return {Growth.FIXED: cost.monthly_eur}
    if cost.catalog is not None and cost.catalog.monthly_eur > 0:
        by_growth = cost.catalog.monthly_by_growth()
        return {
            growth: cost.monthly_eur * share / cost.catalog.monthly_eur
            for growth, share in by_growth.items() if share
        }
    growth = Growth.DATA if placement.component.kind in DATA_KINDS else Growth.TRAFFIC
    return {growth: cost.monthly_eur}


CurveKey = tuple[str | None, Growth]


def curve_split(parts: Iterable[tuple[ProjectGrowth | None, Mapping[Growth, float]]]) -> dict[CurveKey, float]:
    totals: dict[CurveKey, float] = {}
    for project, split in parts:
        for growth, eur in split.items():
            key = (project.id if project else None, growth)
            totals[key] = totals.get(key, 0.0) + eur
    return totals


def curve_factor(forecast: Forecast, scenario_id: str, key: CurveKey | Growth, month: int) -> float:
    project_id, growth = key if isinstance(key, tuple) else (None, key)
    if project_id is None:
        return growth_factor(forecast.scenarios[scenario_id], forecast.events, growth, month)
    if growth == Growth.FIXED:
        return 1.0
    project = next(p for p in forecast.projects if p.id == project_id)
    return project.monthly_by_scenario[scenario_id] ** month


def growth_factor(scenario: Scenario, events: tuple[Event, ...], growth: Growth, month: int) -> float:
    if growth == Growth.FIXED:
        return 1.0
    traffic = growth == Growth.TRAFFIC
    factor = (scenario.traffic_multiplier if traffic else scenario.data_multiplier) ** month
    for event in events:
        if event.month <= month:
            factor *= event.traffic_multiplier if traffic else event.data_multiplier
    return factor

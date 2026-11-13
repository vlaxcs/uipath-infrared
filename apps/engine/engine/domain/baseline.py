from dataclasses import dataclass

from engine.domain.catalog import Catalog
from engine.domain.costing import ComponentCost, cost_placement
from engine.domain.end_state import EndState, apply_candidate
from engine.domain.candidate import DO_NOTHING
from engine.domain.model import Infra

MISMATCH_THRESHOLD_PCT = 15.0


@dataclass(frozen=True)
class CrossCheck:
    component: str
    reported_eur: float
    catalog_eur: float
    diff_pct: float
    catalog_basis: str


@dataclass(frozen=True)
class Baseline:
    end_state: EndState
    costs: tuple[ComponentCost, ...]
    cross_checks: tuple[CrossCheck, ...]

    @property
    def monthly_eur(self) -> float:
        return sum(c.monthly_eur for c in self.costs)

    @property
    def reported_monthly_eur(self) -> float:
        return sum(c.reported_eur or 0.0 for c in self.costs)

    @property
    def catalog_monthly_eur(self) -> float:
        return sum(c.catalog.monthly_eur for c in self.costs if c.catalog is not None)

    @property
    def unpriced(self) -> tuple[str, ...]:
        return tuple(c.component for c in self.costs if c.source == "unpriced")

    def mismatches(self) -> tuple[CrossCheck, ...]:
        return tuple(c for c in self.cross_checks if abs(c.diff_pct) > MISMATCH_THRESHOLD_PCT)


def price_baseline(infra: Infra, catalog: Catalog) -> Baseline:
    end_state = apply_candidate(infra, catalog, DO_NOTHING)
    costs = tuple(cost_placement(p, catalog) for p in end_state.placements.values())
    return Baseline(end_state, costs, tuple(_cross_checks(costs)))


def _cross_checks(costs: tuple[ComponentCost, ...]) -> list[CrossCheck]:
    checks = []
    for cost in costs:
        if cost.reported_eur and cost.catalog is not None and cost.catalog.complete:
            catalog_eur = cost.catalog.monthly_eur
            diff = (catalog_eur - cost.reported_eur) / cost.reported_eur * 100
            checks.append(CrossCheck(cost.component, cost.reported_eur, catalog_eur, diff, cost.catalog.basis))
    return checks

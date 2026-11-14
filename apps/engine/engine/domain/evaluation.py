from dataclasses import dataclass, replace
from typing import Mapping

from engine.domain.action_savings import ActionOutcome, action_outcomes
from engine.domain.baseline import Baseline
from engine.domain.candidate import ActionKind, Candidate
from engine.domain.catalog import Catalog
from engine.domain.constraints import CandidateFigures, ConstraintCheck, check_constraints
from engine.domain.costing import ONPREM_SOURCE, ComponentCost, cost_placement
from engine.domain.egress import new_boundary_egress
from engine.domain.end_state import EndState, apply_candidate
from engine.domain.forecast import Forecast
from engine.domain.growth import growth_split, total_split
from engine.domain.migration import Migration, migration_of
from engine.domain.model import Infra
from engine.domain.onprem import OnpremPlatformCost, platform_cost
from engine.domain.ops import ops_monthly_eur
from engine.domain.outage import expected_outage_loss_eur_year
from engine.domain.pricing import Growth
from engine.domain.projection import Projection, discounted_months, project
from engine.domain.provenance import Confidence, Evidence, confidence_of
from engine.domain.remediation import remediation_effort_hours

MONTHS_PER_YEAR = 12
COST_FLAGS = ("unpriced", "partially_priced", "change_unpriced")
VERIFY_EXTENSIONS = "verify_extensions"
VERIFY_EXTENSIONS_RISK = 0.15
MAX_RISK = 1.0


@dataclass(frozen=True)
class Evaluation:
    candidate: Candidate
    layers: tuple[str, ...]
    end_state: EndState
    costs: tuple[ComponentCost, ...]
    projection: Projection
    migration: Migration
    outcomes: tuple[ActionOutcome, ...]
    check: ConstraintCheck
    ops_eur_month: float
    outage_eur_year: float
    egress_eur_month: float
    onprem: OnpremPlatformCost | None
    remediation_hours: float
    remediation_eur: float
    migration_eur: float
    effort_hours: float
    ops_horizon_eur: float
    outage_horizon_eur: float
    confidence: Confidence
    flags: tuple[str, ...]

    @property
    def id(self) -> str:
        return self.candidate.id

    @property
    def feasible(self) -> bool:
        return self.check.feasible

    @property
    def risk(self) -> float:
        penalty = VERIFY_EXTENSIONS_RISK if VERIFY_EXTENSIONS in self.flags else 0.0
        return min(MAX_RISK, self.migration.risk + penalty)

    @property
    def run_eur_month_now(self) -> float:
        return self.projection.monthly_now_eur

    @property
    def monthly_now_total_eur(self) -> float:
        return self.projection.monthly_now_eur + self.ops_eur_month

    @property
    def upfront_hardware_eur(self) -> float:
        return self.onprem.upfront_hardware_eur if self.onprem else 0.0

    @property
    def capex_amortised_eur_month(self) -> float:
        return self.onprem.allocated.capex_amortised_eur_month if self.onprem else 0.0

    @property
    def monthly_now_cash_eur(self) -> float:
        return self.monthly_now_total_eur - self.capex_amortised_eur_month

    @property
    def expected_total_eur(self) -> float:
        return self.total_for(None)

    def total_for(self, scenario_id: str | None) -> float:
        run = (
            self.projection.expected_horizon_eur if scenario_id is None
            else self.projection.horizon_by_scenario[scenario_id]
        )
        return run + self.migration_eur + self.ops_horizon_eur + self.outage_horizon_eur


def evaluate_candidate(
    candidate: Candidate,
    layers: tuple[str, ...],
    infra: Infra,
    catalog: Catalog,
    forecast: Forecast,
    baseline: Baseline,
) -> Evaluation:
    business = forecast.business
    end_state = apply_candidate(infra, catalog, candidate)
    onprem = platform_cost(end_state, catalog, forecast)
    onprem_eur = onprem.component_eur_month if onprem else {}
    costs = tuple(_with_onprem(cost_placement(p, catalog), onprem_eur) for p in end_state.placements.values())
    egress = new_boundary_egress(end_state, infra, catalog)
    split = total_split(growth_split(c, end_state.placements[c.component]) for c in costs)
    split[Growth.TRAFFIC] += egress.monthly_eur
    projection = project(split, forecast)
    migration = migration_of(
        end_state, catalog, business,
        {c.component: c.monthly_eur for c in baseline.costs},
        {c.component: c.monthly_eur for c in costs},
    )
    remediation = tuple(a for a in candidate.actions if a.kind == ActionKind.REMEDIATE)
    remediation_hours = remediation_effort_hours(remediation)
    remediation_eur = remediation_hours * business.engineer_hourly_eur
    migration_eur = migration.eur + remediation_eur + (onprem.setup_eur if onprem else 0.0)
    effort_hours = migration.hours + remediation_hours
    check = check_constraints(end_state, infra, catalog, forecast, CandidateFigures(
        run_eur_month_at_horizon_base=projection.at_horizon_by_scenario["base"],
        migration_eur=migration_eur,
        effort_hours=effort_hours,
        cutover_hours=migration.cutover_hours,
        upfront_hardware_eur=onprem.upfront_hardware_eur if onprem else 0.0,
    ))
    ops = ops_monthly_eur(end_state, catalog, business)
    outage = expected_outage_loss_eur_year(check.availability, business)
    months = discounted_months(forecast)
    return Evaluation(
        candidate=candidate,
        layers=layers,
        end_state=end_state,
        costs=costs,
        projection=projection,
        migration=migration,
        outcomes=action_outcomes(candidate, baseline.end_state, catalog, onprem_eur),
        check=check,
        ops_eur_month=ops,
        outage_eur_year=outage,
        egress_eur_month=egress.monthly_eur,
        onprem=onprem,
        remediation_hours=remediation_hours,
        remediation_eur=remediation_eur,
        migration_eur=migration_eur,
        effort_hours=effort_hours,
        ops_horizon_eur=ops * months,
        outage_horizon_eur=outage / MONTHS_PER_YEAR * months,
        confidence=confidence_of(_evidence(candidate, baseline)),
        flags=_flags(candidate, costs, catalog, baseline, egress.unpriced_edges),
    )


def _with_onprem(cost: ComponentCost, onprem_eur: Mapping[str, float]) -> ComponentCost:
    if cost.source != ONPREM_SOURCE or cost.component not in onprem_eur:
        return cost
    return replace(cost, monthly_eur=onprem_eur[cost.component])


def baseline_evidence(baseline: Baseline) -> tuple[Evidence, ...]:
    return tuple(
        p.component.reported_cost.evidence
        for p in baseline.end_state.placements.values() if p.component.reported_cost
    )


def _evidence(candidate: Candidate, baseline: Baseline) -> tuple[Evidence, ...]:
    return baseline_evidence(baseline) + tuple(e for a in candidate.actions for e in a.evidence)


def _flags(
    candidate: Candidate,
    costs: tuple[ComponentCost, ...],
    catalog: Catalog,
    baseline: Baseline,
    unpriced_edges: tuple[str, ...],
) -> tuple[str, ...]:
    flags = {flag for cost in costs for flag in cost.flags if flag in COST_FLAGS}
    if catalog.illustrative:
        flags.add("catalog_illustrative")
    if unpriced_edges:
        flags.add("egress_unpriced")
    if any(a.signal == VERIFY_EXTENSIONS for a in candidate.actions):
        flags.add(VERIFY_EXTENSIONS)
    mismatched = {m.component for m in baseline.mismatches()}
    if any(a.component in mismatched and a.kind != ActionKind.FLAG for a in candidate.actions):
        flags.add("catalog_mismatch")
    return tuple(sorted(flags))

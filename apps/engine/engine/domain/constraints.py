from dataclasses import dataclass

from engine.domain.availability import Availability, availability_of
from engine.domain.catalog import Catalog
from engine.domain.end_state import EndState
from engine.domain.forecast import Forecast, HardConstraints
from engine.domain.model import Infra
from engine.domain.regions import region_matches
from engine.domain.security_gates import check_security_gates
from engine.domain.violation import Violation


@dataclass(frozen=True)
class CandidateFigures:
    run_eur_month_at_horizon_base: float
    migration_eur: float = 0.0
    effort_hours: float = 0.0
    cutover_hours: float = 0.0


@dataclass(frozen=True)
class ConstraintCheck:
    violations: tuple[Violation, ...]
    availability: Availability

    @property
    def feasible(self) -> bool:
        return not self.violations


def check_constraints(
    end_state: EndState, infra: Infra, catalog: Catalog, forecast: Forecast, figures: CandidateFigures,
) -> ConstraintCheck:
    constraints = forecast.constraints
    availability = availability_of(end_state, infra, catalog)
    violations = (
        _residency(end_state, constraints)
        + _providers(end_state, constraints)
        + _availability(availability, constraints)
        + _figures(figures, constraints)
        + check_security_gates(end_state, infra, constraints.security_gates)
    )
    return ConstraintCheck(violations, availability)


def _residency(end_state: EndState, constraints: HardConstraints) -> tuple[Violation, ...]:
    residency = constraints.residency
    if residency is None:
        return ()
    return tuple(
        Violation(
            "data_residency", p.component.id,
            f"{p.component.data_classification} data in {p.region}, allowed: {', '.join(residency.allowed_regions)}",
        )
        for p in end_state.live()
        if p.component.stateful
        and p.component.data_classification in residency.applies_to
        and not region_matches(p.region, residency.allowed_regions)
    )


def _providers(end_state: EndState, constraints: HardConstraints) -> tuple[Violation, ...]:
    violations = []
    for placement in end_state.live():
        allowed = constraints.allowed_providers
        if allowed is not None and placement.provider not in allowed:
            violations.append(Violation(
                "allowed_providers", placement.component.id,
                f"{placement.provider} is not in {', '.join(sorted(allowed))}",
            ))
        if placement.provider in constraints.forbidden_providers:
            violations.append(Violation(
                "forbidden_providers", placement.component.id, f"{placement.provider} is forbidden",
            ))
    return tuple(violations)


def _availability(availability: Availability, constraints: HardConstraints) -> tuple[Violation, ...]:
    limit = constraints.min_availability_pct
    if limit is None:
        return ()
    violations: dict[str | None, Violation] = {}
    for path in availability.paths:
        if path.availability_pct >= limit:
            continue
        weak = [c for c in path.components if c.availability_pct < limit]
        for component in weak:
            violations.setdefault(component.component, Violation(
                "min_availability_pct", component.component,
                f"{component.availability_pct:g}% on the {path.stack} critical path ({component.basis})",
                component.availability_pct, limit,
            ))
        if not weak:
            violations[f"stack:{path.stack}"] = Violation(
                "min_availability_pct", None,
                f"{path.stack} critical path reaches {path.availability_pct:.3f}% across {len(path.components)} components",
                path.availability_pct, limit,
            )
    return tuple(violations.values())


def _figures(figures: CandidateFigures, constraints: HardConstraints) -> tuple[Violation, ...]:
    checks = (
        ("budget", figures.run_eur_month_at_horizon_base, constraints.max_monthly_run_cost_eur,
         "EUR {actual:,.0f} a month at the horizon on the base scenario, ceiling EUR {limit:,.0f}"),
        ("migration_budget", figures.migration_eur, constraints.max_one_off_migration_cost_eur,
         "one-off migration EUR {actual:,.0f}, ceiling EUR {limit:,.0f}"),
        ("max_migration_effort_hours", figures.effort_hours, constraints.max_migration_effort_hours,
         "{actual:,.0f} migration hours, limit {limit:,.0f}"),
        ("max_cutover_downtime_hours", figures.cutover_hours, constraints.max_cutover_downtime_hours,
         "{actual:g} hours of cutover downtime, limit {limit:g}"),
    )
    return tuple(
        Violation(constraint, None, text.format(actual=actual, limit=limit), actual, limit)
        for constraint, actual, limit, text in checks
        if limit is not None and actual > limit
    )

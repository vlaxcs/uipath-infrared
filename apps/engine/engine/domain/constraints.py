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
    upfront_hardware_eur: float = 0.0


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
        _residency(end_state, constraints, forecast)
        + _providers(end_state, constraints)
        + _availability(availability, constraints, forecast)
        + _figures(figures, constraints)
        + check_security_gates(end_state, infra, constraints.security_gates)
    )
    return ConstraintCheck(violations, availability)


DEFAULT_RESIDENCY_CLASSES = frozenset({"pii", "confidential", "unknown"})


def _residency(end_state: EndState, constraints: HardConstraints, forecast: Forecast) -> tuple[Violation, ...]:
    residency = constraints.residency
    violations = []
    for p in end_state.live():
        if not p.component.stateful:
            continue
        project = forecast.project_of(p.component.stack)
        if project is not None and project.allowed_regions:
            allowed, classes, owner = project.allowed_regions, residency.applies_to if residency else DEFAULT_RESIDENCY_CLASSES, f" for {project.name}"
        elif residency is not None:
            allowed, classes, owner = residency.allowed_regions, residency.applies_to, ""
        else:
            continue
        if p.component.data_classification in classes and not region_matches(p.region, allowed):
            violations.append(Violation(
                "data_residency", p.component.id,
                f"{p.component.data_classification} data in {p.region}, allowed{owner}: {', '.join(allowed)}",
            ))
    return tuple(violations)


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


def _availability_limit(stack: str | None, constraints: HardConstraints, forecast: Forecast) -> float | None:
    project = forecast.project_of(stack)
    own = project.min_availability_pct if project is not None else None
    limits = [limit for limit in (constraints.min_availability_pct, own) if limit is not None]
    return max(limits) if limits else None


def _availability(availability: Availability, constraints: HardConstraints, forecast: Forecast) -> tuple[Violation, ...]:
    violations: dict[str | None, Violation] = {}
    for path in availability.paths:
        limit = _availability_limit(path.stack, constraints, forecast)
        if limit is None or path.availability_pct >= limit:
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
        ("migration_budget", figures.migration_eur + figures.upfront_hardware_eur,
         constraints.max_one_off_migration_cost_eur,
         _one_off_text(figures)),
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


def _one_off_text(figures: CandidateFigures) -> str:
    if not figures.upfront_hardware_eur:
        return "one-off migration EUR {actual:,.0f}, ceiling EUR {limit:,.0f}"
    return (
        f"one-off EUR {{actual:,.0f}}: migration EUR {figures.migration_eur:,.0f} plus "
        f"EUR {figures.upfront_hardware_eur:,.0f} of on-prem hardware paid up front, ceiling EUR {{limit:,.0f}}"
    )

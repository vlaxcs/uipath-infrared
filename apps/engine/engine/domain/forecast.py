from dataclasses import dataclass, field
from typing import Any, Mapping

from engine.domain.normalise import require_supported_version


@dataclass(frozen=True)
class Scenario:
    id: str
    probability: float
    traffic_multiplier: float
    data_multiplier: float


@dataclass(frozen=True)
class Event:
    month: int
    description: str
    traffic_multiplier: float = 1.0
    data_multiplier: float = 1.0


@dataclass(frozen=True)
class Residency:
    allowed_regions: tuple[str, ...]
    applies_to: frozenset[str]


@dataclass(frozen=True)
class SecurityGates:
    forbid_public_datastores: bool = False
    require_encryption_at_rest: bool = False
    forbid_world_open_admin_ports: bool = False
    require_audit_logging: bool = False
    require_backups: bool = False


@dataclass(frozen=True)
class HardConstraints:
    residency: Residency | None = None
    max_monthly_run_cost_eur: float | None = None
    max_one_off_migration_cost_eur: float | None = None
    min_availability_pct: float | None = None
    allowed_providers: frozenset[str] | None = None
    forbidden_providers: frozenset[str] = frozenset()
    max_migration_effort_hours: float | None = None
    max_cutover_downtime_hours: float | None = None
    security_gates: SecurityGates = field(default_factory=SecurityGates)


@dataclass(frozen=True)
class CtoSettings:
    ha_level: str
    min_zones: int
    weights: Mapping[str, float]
    tie_break: str
    strategies_enabled: tuple[str, ...]


@dataclass(frozen=True)
class Business:
    downtime_cost_per_hour_eur: float
    downtime_cost_by_stack: Mapping[str, float]
    engineer_hourly_eur: float
    discount_rate_annual: float

    def downtime_cost_for(self, stack: str | None) -> float:
        return self.downtime_cost_by_stack.get(stack or "", self.downtime_cost_per_hour_eur)


USER_COLUMNS = ("low", "base", "high")


@dataclass(frozen=True)
class ProjectGrowth:
    id: str
    name: str
    stacks: frozenset[str]
    monthly_by_scenario: Mapping[str, float]
    focus: str | None = None
    min_availability_pct: float | None = None
    allowed_regions: tuple[str, ...] | None = None


@dataclass(frozen=True)
class Forecast:
    id: str
    horizon_months: int
    scenarios: Mapping[str, Scenario]
    events: tuple[Event, ...]
    constraints: HardConstraints
    cto: CtoSettings
    business: Business
    projects: tuple[ProjectGrowth, ...] = ()

    def project_of(self, stack: str | None) -> ProjectGrowth | None:
        if stack is None:
            return None
        return next((project for project in self.projects if stack in project.stacks), None)


def forecast_from_document(document: Mapping[str, Any]) -> Forecast:
    require_supported_version(document, "forecast")
    return Forecast(
        id=document["id"],
        horizon_months=int(document["horizon_months"]),
        scenarios={
            key: Scenario(
                key,
                value["probability"],
                value["monthly_multiplier"].get("traffic", 1.0),
                value["monthly_multiplier"].get("data", 1.0),
            )
            for key, value in sorted(document["scenarios"].items())
        },
        events=tuple(
            Event(e["month"], e.get("description", ""), e.get("traffic_multiplier", 1.0), e.get("data_multiplier", 1.0))
            for e in sorted(document.get("events", []), key=lambda e: e["month"])
        ),
        constraints=_constraints(document["hard_constraints"]),
        cto=_cto(document["cto_settings"]),
        business=_business(document["business"]),
        projects=_projects(document.get("projects", []), sorted(document["scenarios"])),
    )


def _projects(raw: list[Mapping[str, Any]], scenario_ids: list[str]) -> tuple[ProjectGrowth, ...]:
    projects = []
    owner: dict[str, str] = {}
    for entry in raw:
        users = entry["users"]
        current = float(users["current"])
        last = max(users["expected"], key=lambda row: row["month"])
        if current <= 0 or last["month"] <= 0:
            raise ValueError(f"project {entry['id']}: users now and the expected month must be above 0")
        monthly = {}
        for scenario_id in scenario_ids:
            column = scenario_id if scenario_id in USER_COLUMNS and scenario_id in last else "base"
            expected = float(last[column])
            if expected <= 0:
                raise ValueError(f"project {entry['id']}: expected users must be above 0")
            monthly[scenario_id] = (expected / current) ** (1 / last["month"])
        for stack in entry["stacks"]:
            if stack in owner:
                raise ValueError(f"stack {stack} belongs to both {owner[stack]} and {entry['id']}")
            owner[stack] = entry["id"]
        focus = entry.get("focus") or {}
        regions = focus.get("allowed_regions")
        projects.append(ProjectGrowth(
            entry["id"], entry.get("name", entry["id"]), frozenset(entry["stacks"]), monthly,
            focus.get("focus"), focus.get("min_availability_pct"), tuple(regions) if regions else None,
        ))
    return tuple(projects)


def _constraints(raw: Mapping[str, Any]) -> HardConstraints:
    residency = raw.get("data_residency")
    budget = raw.get("budget", {})
    allowed = raw.get("allowed_providers")
    return HardConstraints(
        residency=None if residency is None else Residency(
            tuple(residency["allowed_regions"]),
            frozenset(residency.get("applies_to", ["pii", "confidential", "unknown"])),
        ),
        max_monthly_run_cost_eur=budget.get("max_monthly_run_cost_eur"),
        max_one_off_migration_cost_eur=budget.get("max_one_off_migration_cost_eur"),
        min_availability_pct=raw.get("min_availability_pct"),
        allowed_providers=None if allowed is None else frozenset(allowed),
        forbidden_providers=frozenset(raw.get("forbidden_providers", [])),
        max_migration_effort_hours=raw.get("max_migration_effort_hours"),
        max_cutover_downtime_hours=raw.get("max_cutover_downtime_hours"),
        security_gates=SecurityGates(**raw.get("security_gates", {})),
    )


def _cto(raw: Mapping[str, Any]) -> CtoSettings:
    return CtoSettings(
        ha_level=raw.get("ha_level", "single_zone"),
        min_zones=int(raw.get("min_zones", 1)),
        weights=dict(raw["weights"]),
        tie_break=raw.get("tie_break", "lower_risk"),
        strategies_enabled=tuple(raw["strategies_enabled"]),
    )


def _business(raw: Mapping[str, Any]) -> Business:
    return Business(
        downtime_cost_per_hour_eur=raw["downtime_cost_per_hour_eur"],
        downtime_cost_by_stack=dict(raw.get("downtime_cost_by_stack", {})),
        engineer_hourly_eur=raw["engineer_hourly_eur"],
        discount_rate_annual=raw.get("discount_rate_annual", 0.0),
    )

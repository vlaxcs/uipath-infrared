from dataclasses import dataclass, field
from typing import Any, Mapping

from engine.domain.model import Component
from engine.domain.normalise import require_supported_version
from engine.domain.regions import region_matches


@dataclass(frozen=True)
class Tier:
    id: str
    vcpu: float
    memory_gb: float
    monthly_eur: float
    gpus: float = 0


@dataclass(frozen=True)
class UnitPrice:
    driver: str
    eur_per_unit: float


@dataclass(frozen=True)
class Pricing:
    model: str
    tiers: tuple[Tier, ...] = ()
    per_unit: tuple[UnitPrice, ...] = ()
    egress_per_gb_eur: float = 0.0
    free_egress_gb: float = 0.0
    multi_az_multiplier: float = 1.0


@dataclass(frozen=True)
class Sla:
    availability_pct: float
    failure_domain_scope: str
    failure_domains: int
    multi_az_availability_pct: float | None = None


@dataclass(frozen=True)
class MigrationCost:
    effort_hours_fixed: float
    effort_hours_per_100gb: float
    same_provider_factor: float
    cutover_downtime_hours: float
    risk_factor: float


@dataclass(frozen=True)
class Option:
    id: str
    kind: str
    provider: str
    service: str
    regions: tuple[str, ...]
    pricing: Pricing
    sla: Sla
    features_supported: frozenset[str]
    migration: MigrationCost
    ops_hours_month_per_unit: float
    platform: str | None = None

    def serves_region(self, region: str) -> bool:
        return region_matches(region, self.regions)

    def lacks_features(self, features: frozenset[str] | None) -> frozenset[str]:
        return frozenset() if features is None else features - self.features_supported


@dataclass(frozen=True)
class Platform:
    id: str
    region: str
    zones: int
    availability_pct: float
    capacity: Mapping[str, float]
    hardware_capex_eur: float
    amortization_years: float
    power_cooling_eur_month: float
    colocation_eur_month: float
    disks: Mapping[str, float]
    staff: Mapping[str, float]
    maintenance_pct_of_capex_year: float = 0.0
    network_eur_month: float = 0.0
    licences_eur_month: float = 0.0
    setup_one_off_eur: float = 0.0
    contingency_pct: float = 0.0


@dataclass(frozen=True)
class Catalog:
    illustrative: bool
    hours_per_month: float
    options: tuple[Option, ...]
    platforms: Mapping[str, Platform]
    _by_id: Mapping[str, Option] = field(init=False, repr=False, compare=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "_by_id", {o.id: o for o in self.options})

    def option(self, option_id: str) -> Option:
        return self._by_id[option_id]

    def options_for(self, kind: str) -> tuple[Option, ...]:
        return tuple(o for o in self.options if o.kind == kind)

    def current_option(self, component: Component) -> Option | None:
        same_provider = [
            o for o in self.options_for(component.kind) if o.provider == component.provider
        ]
        exact = [o for o in same_provider if o.service == component.service]
        if len(exact) > 1:
            preferred = _provisioned_options(exact) if _has_provisioned_capacity(component) else _ondemand_options(exact)
            return preferred[0] if preferred else exact[0]
        if exact:
            return exact[0]
        if len(same_provider) == 1 and component.kind != "other":
            return same_provider[0]
        return None


def _has_provisioned_capacity(component: Component) -> bool:
    return any(key in component.capacity for key in ("provisioned_rcu", "provisioned_wcu"))


def _provisioned_options(options: tuple[Option, ...]) -> tuple[Option, ...]:
    return tuple(o for o in options if o.id.endswith("-provisioned"))


def _ondemand_options(options: tuple[Option, ...]) -> tuple[Option, ...]:
    return tuple(o for o in options if not o.id.endswith("-provisioned"))


def catalog_from_document(document: Mapping[str, Any]) -> Catalog:
    require_supported_version(document, "catalog")
    return Catalog(
        illustrative=bool(document.get("illustrative", True)),
        hours_per_month=float(document.get("hours_per_month", 730)),
        options=tuple(sorted((_option(raw) for raw in document["options"]), key=lambda o: o.id)),
        platforms={raw["id"]: _platform(raw) for raw in document.get("onprem_platforms", [])},
    )


def _option(raw: Mapping[str, Any]) -> Option:
    pricing = raw["pricing"]
    sla = raw["sla"]
    migration = raw.get("migration", {})
    return Option(
        id=raw["id"],
        kind=raw["kind"],
        provider=raw["provider"],
        service=raw.get("service", ""),
        regions=tuple(raw.get("regions", [])),
        pricing=Pricing(
            model=pricing["model"],
            tiers=tuple(
                Tier(t["id"], t["vcpu"], t["memory_gb"], t["monthly_eur"], t.get("gpus", 0))
                for t in pricing.get("tiers", [])
            ),
            per_unit=tuple(UnitPrice(u["driver"], u["eur_per_unit"]) for u in pricing.get("per_unit", [])),
            egress_per_gb_eur=pricing.get("egress_per_gb_eur", 0.0),
            free_egress_gb=pricing.get("free_egress_gb", 0.0),
            multi_az_multiplier=pricing.get("multi_az_multiplier", 1.0),
        ),
        sla=Sla(
            availability_pct=sla["availability_pct"],
            failure_domain_scope=sla.get("failure_domain_scope", "single_zone"),
            failure_domains=sla.get("failure_domains", 1),
            multi_az_availability_pct=sla.get("multi_az_availability_pct"),
        ),
        features_supported=frozenset(raw.get("features_supported", [])),
        migration=MigrationCost(
            effort_hours_fixed=migration.get("effort_hours_fixed", 0.0),
            effort_hours_per_100gb=migration.get("effort_hours_per_100gb", 0.0),
            same_provider_factor=migration.get("same_provider_factor", 1.0),
            cutover_downtime_hours=migration.get("cutover_downtime_hours", 0.0),
            risk_factor=migration.get("risk_factor", 0.0),
        ),
        ops_hours_month_per_unit=raw.get("ops_hours_month_per_unit", 0.0),
        platform=raw.get("platform"),
    )


def _platform(raw: Mapping[str, Any]) -> Platform:
    return Platform(
        id=raw["id"],
        region=raw["region"],
        zones=raw.get("zones", 1),
        availability_pct=raw["availability_pct"],
        capacity=dict(raw.get("capacity", {})),
        hardware_capex_eur=raw["hardware_capex_eur"],
        amortization_years=raw["amortization_years"],
        power_cooling_eur_month=raw.get("power_cooling_eur_month", 0.0),
        colocation_eur_month=raw.get("colocation_eur_month", 0.0),
        disks=dict(raw.get("disks", {})),
        staff=dict(raw.get("staff", {})),
        maintenance_pct_of_capex_year=raw.get("maintenance_pct_of_capex_year", 0.0),
        network_eur_month=raw.get("network_eur_month", 0.0),
        licences_eur_month=raw.get("licences_eur_month", 0.0),
        setup_one_off_eur=raw.get("setup_one_off_eur", 0.0),
        contingency_pct=raw.get("contingency_pct", 0.0),
    )

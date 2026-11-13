from dataclasses import dataclass
from enum import StrEnum

from engine.domain.catalog import Catalog
from engine.domain.forecast import Forecast
from engine.domain.model import Component, Infra
from engine.domain.provenance import Evidence, Provenance
from engine.domain.sizing import Target, grow_target, shrink_target
from engine.domain.structure import serves_production

DESIGN_PROBLEM_MAX_CONSUMED_SHARE = 0.2
THROTTLE_KEYS = ("throttled_requests", "write_throttled", "read_throttled")
CONSUMED_PREFIX = "consumed_"
PROVISIONED_PREFIX = "provisioned_"
NODE_GROUP = "node_group"
SINGLE_ZONE_SCOPE = "single_zone"
CLUSTER_LEVEL_COPY = "node-group usage copied from the cluster"


class SignalKind(StrEnum):
    ORPHAN = "orphan"
    IDLE = "idle"
    OVERSIZED = "oversized"
    UNDERSIZED = "undersized"
    STATIC_SCALING = "static_scaling"
    SINGLE_ZONE_STATEFUL = "single_zone_stateful"
    DESIGN_PROBLEM = "design_problem"


@dataclass(frozen=True)
class Signal:
    component: str
    kind: SignalKind
    detail: str
    evidence: tuple[Evidence, ...] = ()
    target: Target | None = None


def detect_signals(infra: Infra, catalog: Catalog, forecast: Forecast) -> tuple[Signal, ...]:
    caveats = usage_caveats(infra)
    signals: list[Signal] = []
    for component in infra.components:
        found = _status(component) or (
            _sizing(component, catalog, pool_floor(component, infra, forecast))
            + _static_scaling(component)
            + _single_zone(component, infra, catalog, forecast)
            + _design_problem(component)
        )
        extra = caveats.get(component.id, ())
        signals += [_with_evidence(signal, extra) for signal in found]
    return tuple(signals)


def usage_caveats(infra: Infra) -> dict[str, tuple[Evidence, ...]]:
    seen: dict[tuple, list[str]] = {}
    for component in infra.components:
        if component.kind == NODE_GROUP and component.parent and component.usage:
            key = (component.parent, tuple(sorted(component.usage.items())))
            seen.setdefault(key, []).append(component.id)
    caveat = (Evidence(CLUSTER_LEVEL_COPY, Provenance.SYNTHETIC),)
    return {member: caveat for members in seen.values() if len(members) > 1 for member in members}


def usage_evidence(component: Component) -> tuple[Evidence, ...]:
    return tuple(component.usage[key].evidence for key in sorted(component.usage))


def _with_evidence(signal: Signal, extra: tuple[Evidence, ...]) -> Signal:
    if not extra or not signal.evidence:
        return signal
    return Signal(signal.component, signal.kind, signal.detail, signal.evidence + extra, signal.target)


def _status(component: Component) -> list[Signal]:
    if component.status not in (SignalKind.ORPHAN, SignalKind.IDLE):
        return []
    evidence = (Evidence("status", Provenance.OBSERVED),) + usage_evidence(component)
    return [Signal(component.id, SignalKind(component.status), f"status is {component.status}", evidence)]


def pool_floor(component: Component, infra: Infra, forecast: Forecast) -> int:
    return max(1, forecast.cto.min_zones) if serves_production(infra, component) else 1


def _sizing(component: Component, catalog: Catalog, min_units: int) -> list[Signal]:
    option = catalog.current_option(component)
    grow = grow_target(component, option)
    if grow is not None:
        return [Signal(component.id, SignalKind.UNDERSIZED, grow.basis, grow.evidence, grow)]
    shrink = shrink_target(component, option, min_units=min_units)
    if shrink is not None:
        return [Signal(component.id, SignalKind.OVERSIZED, shrink.basis, shrink.evidence, shrink)]
    return []


def _static_scaling(component: Component) -> list[Signal]:
    scaling = component.scaling
    if scaling is None or not scaling.is_static:
        return []
    return [Signal(component.id, SignalKind.STATIC_SCALING, f"fixed at {scaling.desired} units, autoscaling off")]


def _single_zone(component: Component, infra: Infra, catalog: Catalog, forecast: Forecast) -> list[Signal]:
    zones, wanted = component.zones, forecast.cto.min_zones
    if not component.stateful or zones is None or zones >= wanted or not serves_production(infra, component):
        return []
    option = catalog.current_option(component)
    if option is not None and option.sla.failure_domain_scope != SINGLE_ZONE_SCOPE:
        return []
    return [Signal(component.id, SignalKind.SINGLE_ZONE_STATEFUL, f"stateful in {zones} zone, the CTO asks for {wanted}")]


def _design_problem(component: Component) -> list[Signal]:
    throttles = [
        component.usage[key] for key in THROTTLE_KEYS
        if key in component.usage and (component.usage[key].avg or 0) > 0
    ]
    shares = []
    for key in sorted(component.usage):
        usage = component.usage[key]
        provisioned = component.capacity_value(PROVISIONED_PREFIX + key.removeprefix(CONSUMED_PREFIX))
        if key.startswith(CONSUMED_PREFIX) and provisioned and usage.p95 is not None:
            shares.append((usage.p95 / provisioned, usage))
    if not throttles or not shares or max(share for share, _ in shares) >= DESIGN_PROBLEM_MAX_CONSUMED_SHARE:
        return []
    busiest = max(share for share, _ in shares)
    detail = (
        f"throttled {throttles[0].avg:g} times an hour on average while using at most "
        f"{busiest:.0%} of provisioned capacity: a design problem, more capacity will not help"
    )
    evidence = tuple(u.evidence for u in throttles) + tuple(u.evidence for _, u in shares)
    return [Signal(component.id, SignalKind.DESIGN_PROBLEM, detail, evidence)]

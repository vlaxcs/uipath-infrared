from engine.domain.candidate import Action, ActionKind, Candidate
from engine.domain.catalog import Catalog
from engine.domain.costing import cost_placement
from engine.domain.end_state import apply_candidate
from engine.domain.forecast import Forecast
from engine.domain.model import Component, Infra
from engine.domain.signals import Signal, SignalKind, detect_signals, pool_floor, usage_caveats
from engine.domain.sizing import Target, is_pool, shrink_target

CANDIDATE_ID = "rightsize_in_place"


def rightsize_in_place(previous: Candidate, infra: Infra, catalog: Catalog, forecast: Forecast) -> Candidate:
    end_state = apply_candidate(infra, catalog, previous)
    caveats = usage_caveats(infra)
    by_component: dict[str, dict[SignalKind, Signal]] = {}
    for signal in detect_signals(infra, catalog, forecast):
        by_component.setdefault(signal.component, {})[signal.kind] = signal
    actions: list[Action] = []
    for component_id in sorted(by_component):
        placement = end_state.placements[component_id]
        if placement.removed or not placement.running:
            continue
        signals = by_component[component_id]
        floor = pool_floor(placement.component, infra, forecast)
        sizing = _sizing_action(placement.component, signals, catalog, caveats.get(component_id, ()), floor)
        if sizing is not None and (sizing.signal == SignalKind.UNDERSIZED or sizing.kind == ActionKind.FLAG
                                   or _saves(previous, sizing, infra, catalog)):
            actions.append(sizing)
        if SignalKind.SINGLE_ZONE_STATEFUL in signals:
            signal = signals[SignalKind.SINGLE_ZONE_STATEFUL]
            actions.append(Action(
                component_id, ActionKind.SCALE, f"{signal.detail}: run it in {forecast.cto.min_zones} zones",
                signal=signal.kind, zones=forecast.cto.min_zones,
            ))
        if SignalKind.SINGLE_ZONE_POOL in signals:
            signal = signals[SignalKind.SINGLE_ZONE_POOL]
            actions.append(Action(
                component_id, ActionKind.SCALE, f"{signal.detail}: spread it over {forecast.cto.min_zones} zones",
                signal=signal.kind, zones=forecast.cto.min_zones,
            ))
        if SignalKind.RESIDENCY in signals:
            signal = signals[SignalKind.RESIDENCY]
            actions.append(Action(
                component_id, ActionKind.MOVE, signal.detail, signal=signal.kind,
                option=signal.relocation.option, region=signal.relocation.region,
            ))
        if SignalKind.DESIGN_PROBLEM in signals:
            signal = signals[SignalKind.DESIGN_PROBLEM]
            actions.append(Action(component_id, ActionKind.FLAG, signal.detail, signal=signal.kind, evidence=signal.evidence))
    return previous.extend(CANDIDATE_ID, tuple(actions))


def _sizing_action(
    component: Component, signals: dict[SignalKind, Signal], catalog: Catalog, caveat: tuple, floor: int,
) -> Action | None:
    if SignalKind.UNDERSIZED in signals:
        signal = signals[SignalKind.UNDERSIZED]
        return _resize(signal.component, SignalKind.UNDERSIZED, f"undersized, grow it: {signal.detail}", signal.target, signal.evidence)
    if SignalKind.STATIC_SCALING in signals and is_pool(component):
        target = shrink_target(component, catalog.current_option(component), "avg", floor)
        if target is not None:
            return Action(
                component.id, ActionKind.AUTOSCALE,
                f"fixed size, autoscale it and pay for the average load: {target.basis}",
                signal=SignalKind.STATIC_SCALING, evidence=target.evidence + caveat, quantity=target.quantity,
            )
    if SignalKind.OVERSIZED in signals:
        signal = signals[SignalKind.OVERSIZED]
        if signal.target.blocked:
            return Action(
                signal.component, ActionKind.FLAG, f"looks oversized ({signal.detail}), but {signal.target.blocked}",
                signal=SignalKind.OVERSIZED, evidence=signal.evidence,
            )
        return _resize(signal.component, SignalKind.OVERSIZED, f"oversized, shrink it: {signal.detail}", signal.target, signal.evidence)
    return None


def _resize(component: str, signal: SignalKind, reason: str, target: Target, evidence: tuple) -> Action:
    return Action(
        component, ActionKind.RESIZE, reason, signal=signal, evidence=evidence,
        tier=target.tier, quantity=target.quantity, vcpu=target.vcpu, memory_gb=target.memory_gb,
    )


def _saves(previous: Candidate, action: Action, infra: Infra, catalog: Catalog) -> bool:
    before = apply_candidate(infra, catalog, previous).placements[action.component]
    after = apply_candidate(infra, catalog, previous.extend("trial", (action,))).placements[action.component]
    return cost_placement(after, catalog).monthly_eur < cost_placement(before, catalog).monthly_eur

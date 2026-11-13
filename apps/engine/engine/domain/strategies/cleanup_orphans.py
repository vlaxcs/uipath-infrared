from engine.domain.candidate import Action, ActionKind, Candidate
from engine.domain.catalog import Catalog
from engine.domain.end_state import apply_candidate
from engine.domain.forecast import Forecast
from engine.domain.model import Component, Infra
from engine.domain.signals import Signal, SignalKind, detect_signals

CANDIDATE_ID = "cleanup_orphans"
STOPPABLE_KINDS = frozenset({"virtual_machine"})


def cleanup_orphans(previous: Candidate, infra: Infra, catalog: Catalog, forecast: Forecast) -> Candidate:
    end_state = apply_candidate(infra, catalog, previous)
    actions = []
    for signal in detect_signals(infra, catalog, forecast):
        placement = end_state.placements[signal.component]
        if placement.removed or not placement.running:
            continue
        if signal.kind == SignalKind.ORPHAN:
            actions.append(_action(signal, ActionKind.DELETE, "orphan: nothing uses it, delete it"))
        elif signal.kind == SignalKind.IDLE and keeps_something_when_stopped(placement.component):
            actions.append(_action(signal, ActionKind.STOP, "idle: stop it and keep its data and disks"))
        elif signal.kind == SignalKind.IDLE:
            actions.append(_action(signal, ActionKind.DELETE, "idle and holds nothing: delete it"))
    return previous.extend(CANDIDATE_ID, tuple(actions))


def keeps_something_when_stopped(component: Component) -> bool:
    return component.stateful or component.kind in STOPPABLE_KINDS


def _action(signal: Signal, kind: ActionKind, reason: str) -> Action:
    return Action(signal.component, kind, reason, signal=signal.kind, evidence=signal.evidence)

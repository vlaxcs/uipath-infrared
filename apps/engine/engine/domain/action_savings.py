from dataclasses import dataclass
from typing import Mapping

from engine.domain.candidate import ACCOUNT_SCOPE, Action, Candidate
from engine.domain.catalog import Catalog
from engine.domain.costing import ONPREM_SOURCE, cost_placement
from engine.domain.end_state import EndState, Placement, apply_action


@dataclass(frozen=True)
class ActionOutcome:
    action: Action
    saving_eur_month: float
    before: str
    after: str


def action_outcomes(
    candidate: Candidate, initial: EndState, catalog: Catalog, onprem_eur: Mapping[str, float],
) -> tuple[ActionOutcome, ...]:
    placements = dict(initial.placements)
    outcomes = []
    for action in candidate.actions:
        if action.component == ACCOUNT_SCOPE:
            outcomes.append(ActionOutcome(action, 0.0, "off", "on"))
            continue
        before = placements[action.component]
        after = apply_action(before, action, catalog)
        placements[action.component] = after
        saving = _monthly(before, catalog, onprem_eur) - _monthly(after, catalog, onprem_eur)
        outcomes.append(ActionOutcome(action, saving, describe(before), describe(after)))
    return tuple(outcomes)


def _monthly(placement: Placement, catalog: Catalog, onprem_eur: Mapping[str, float]) -> float:
    cost = cost_placement(placement, catalog)
    return onprem_eur.get(cost.component, 0.0) if cost.source == ONPREM_SOURCE else cost.monthly_eur


def describe(placement: Placement) -> str:
    if placement.removed:
        return "deleted"
    size = placement.tier_id or placement.component.sku or placement.component.service
    text = f"{placement.option_id or placement.provider} {size} x{placement.quantity:g}, {placement.zones} zone"
    text += "" if placement.zones == 1 else "s"
    if placement.autoscaled:
        text += ", autoscaled"
    if not placement.running:
        text += ", stopped"
    return text

from dataclasses import dataclass

from engine.domain.candidate import Action, ActionKind, Candidate
from engine.domain.catalog import Catalog, Option
from engine.domain.costing import cost_placement
from engine.domain.end_state import EndState, Placement, apply_candidate
from engine.domain.forecast import Business, Forecast, HardConstraints
from engine.domain.model import Infra, StayTogether
from engine.domain.onprem import ONPREM_PROVIDER, platform_cost_for, platform_use
from engine.domain.regions import region_matches
from engine.domain.structure import stay_together_groups

CANDIDATE_ID = "move_to_onprem"
MOVE_SIGNAL = "onprem"
REJECTED_SIGNAL = "move_rejected"


@dataclass(frozen=True)
class OnpremMove:
    component: str
    option: Option
    before_eur: float
    after_eur: float

    @property
    def saving_eur(self) -> float:
        return self.before_eur - self.after_eur


def move_to_onprem(previous: Candidate, infra: Infra, catalog: Catalog, forecast: Forecast) -> Candidate:
    end_state = apply_candidate(infra, catalog, previous)
    moves: dict[str, OnpremMove] = {}
    rejected: dict[str, str] = {}
    for placement in _movable(end_state, catalog):
        option = _target(placement, catalog)
        reason = _rejection(placement, option, catalog, forecast.constraints)
        if reason:
            rejected[placement.component.id] = reason
        else:
            moves[placement.component.id] = _price(placement, option, catalog, forecast)
    wanted = {cid for cid, move in moves.items() if move.saving_eur > 0}
    _hold_groups(stay_together_groups(infra), end_state, moves, wanted, rejected)
    actions: list[Action] = []
    for component_id in sorted(set(moves) | set(rejected)):
        if component_id in wanted:
            actions.append(_move_action(moves[component_id], end_state.placements[component_id]))
        elif component_id in rejected:
            actions.append(Action(component_id, ActionKind.FLAG, f"stays off-prem: {rejected[component_id]}", signal=REJECTED_SIGNAL))
    return previous.extend(CANDIDATE_ID, tuple(actions))


def _movable(end_state: EndState, catalog: Catalog) -> tuple[Placement, ...]:
    return tuple(
        p for p in sorted(end_state.live(), key=lambda p: p.component.id)
        if p.running and p.provider != ONPREM_PROVIDER and _target(p, catalog) is not None
    )


def _target(placement: Placement, catalog: Catalog) -> Option | None:
    options = [
        o for o in catalog.options_for(placement.component.kind)
        if o.provider == ONPREM_PROVIDER and o.platform in catalog.platforms
    ]
    return min(options, key=lambda o: o.id, default=None)


def _rejection(placement: Placement, option: Option, catalog: Catalog, constraints: HardConstraints) -> str | None:
    component = placement.component
    lacking = option.lacks_features(component.features_used)
    if lacking:
        return f"{option.id} lacks {', '.join(sorted(lacking))}"
    allowed = constraints.allowed_providers
    if (allowed is not None and ONPREM_PROVIDER not in allowed) or ONPREM_PROVIDER in constraints.forbidden_providers:
        return f"provider {ONPREM_PROVIDER} is not allowed"
    platform = catalog.platforms[option.platform]
    if (component.capacity_value("gpus") or 0) > 0 and not platform.capacity.get("gpus"):
        return f"{platform.id} has no GPUs"
    region = platform.region
    residency = constraints.residency
    if (
        residency is not None and component.stateful
        and component.data_classification in residency.applies_to
        and not region_matches(region, residency.allowed_regions)
    ):
        return f"{option.id} would put {component.data_classification} data in {region}"
    return None


def _price(placement: Placement, option: Option, catalog: Catalog, forecast: Forecast) -> OnpremMove:
    business = forecast.business
    before = cost_placement(placement, catalog).monthly_eur + _ops_eur(placement.option_id, placement, catalog, business)
    platform = catalog.platforms[option.platform]
    share = platform_cost_for(platform, platform_use((placement,), catalog), forecast).allocated_monthly_eur
    after = share + _ops_eur(option.id, placement, catalog, business)
    return OnpremMove(placement.component.id, option, before, after)


def _ops_eur(option_id: str | None, placement: Placement, catalog: Catalog, business: Business) -> float:
    if option_id is None:
        return 0.0
    return catalog.option(option_id).ops_hours_month_per_unit * placement.quantity * business.engineer_hourly_eur


def _hold_groups(
    groups: tuple[StayTogether, ...],
    end_state: EndState,
    moves: dict[str, OnpremMove],
    wanted: set[str],
    rejected: dict[str, str],
) -> None:
    changed = True
    while changed:
        changed = False
        for group in groups:
            members = [m for m in group.members if m in end_state.placements and not end_state.placements[m].removed]
            if not any(m in wanted for m in members):
                continue
            stuck = sorted(m for m in members if m not in moves or m in rejected)
            saving = sum(moves[m].saving_eur for m in members if m in moves)
            if not stuck and saving > 0:
                if any(m not in wanted for m in members):
                    wanted.update(members)
                    changed = True
                continue
            why = f"{', '.join(stuck)} cannot move" if stuck else f"the group would cost EUR {-saving:,.0f} a month more"
            for member in members:
                if member in wanted:
                    wanted.discard(member)
                    changed = True
                if member in moves:
                    rejected.setdefault(member, f"{group.id} moves as one unit and {why}")


def _move_action(move: OnpremMove, placement: Placement) -> Action:
    component = placement.component
    evidence = tuple(component.capacity[key].evidence for key in ("vcpu", "memory_gb") if key in component.capacity)
    reason = (
        f"move to {move.option.id}: EUR {move.before_eur:,.0f} to EUR {move.after_eur:,.0f} a month "
        "with its platform share and ops"
    )
    return Action(
        component.id, ActionKind.MOVE, reason, signal=MOVE_SIGNAL, evidence=evidence,
        tier=placement.tier_id, option=move.option.id,
    )

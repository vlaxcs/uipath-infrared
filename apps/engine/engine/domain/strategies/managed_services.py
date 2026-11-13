from dataclasses import dataclass

from engine.domain.candidate import Action, ActionKind, Candidate
from engine.domain.catalog import Catalog, Option
from engine.domain.costing import cost_placement
from engine.domain.end_state import EndState, Placement, apply_action, apply_candidate
from engine.domain.forecast import Forecast, HardConstraints
from engine.domain.model import Infra, StayTogether
from engine.domain.placement_size import unit_size
from engine.domain.regions import region_matches
from engine.domain.structure import stay_together_groups
from engine.domain.tiers import resolve_tier

CANDIDATE_ID = "managed_services"
EXCLUDED_PROVIDERS = frozenset({"onprem"})
WHOLE_UNIT_SCOPES = frozenset({"provider", "zone"})
MOVE_SIGNAL = "managed_service"
REJECTED_SIGNAL = "move_rejected"
VERIFY_EXTENSIONS_SIGNAL = "verify_extensions"


@dataclass(frozen=True)
class Move:
    component: str
    option: Option
    tier: str | None
    before_eur: float
    after_eur: float
    evidence: tuple

    @property
    def saving_eur(self) -> float:
        return self.before_eur - self.after_eur


@dataclass(frozen=True)
class Assessment:
    component: str
    moves: tuple[Move, ...]
    rejected: tuple[str, ...]

    def cheapest(self, provider: str | None = None) -> Move | None:
        pool = [m for m in self.moves if provider is None or m.option.provider == provider]
        return min(pool, key=lambda m: (m.after_eur, m.option.id), default=None)


def managed_services(previous: Candidate, infra: Infra, catalog: Catalog, forecast: Forecast) -> Candidate:
    end_state = apply_candidate(infra, catalog, previous)
    groups = stay_together_groups(infra)
    assessments = {
        a.component: a
        for a in (_assess(p, end_state, catalog, forecast.constraints, groups) for p in _movable(end_state, catalog))
    }
    chosen = {cid: a.cheapest() for cid, a in assessments.items()}
    chosen = {cid: m for cid, m in chosen.items() if m is not None and m.saving_eur > 0}
    blocked: dict[str, str] = {}
    for group in groups:
        if group.scope in WHOLE_UNIT_SCOPES:
            _resolve_whole_unit(group, end_state, assessments, chosen, blocked)
    actions: list[Action] = []
    for component_id in sorted(assessments):
        assessment = assessments[component_id]
        move = chosen.get(component_id)
        if move is not None:
            actions.extend(_move_actions(move, assessment, end_state, groups))
        elif assessment.rejected or component_id in blocked:
            reasons = list(assessment.rejected) + ([blocked[component_id]] if component_id in blocked else [])
            actions.append(Action(component_id, ActionKind.FLAG, "stays: " + "; ".join(reasons), signal=REJECTED_SIGNAL))
    return previous.extend(CANDIDATE_ID, tuple(actions))


def _movable(end_state: EndState, catalog: Catalog) -> tuple[Placement, ...]:
    return tuple(
        p for p in sorted(end_state.live(), key=lambda p: p.component.id)
        if p.running and _targets(p, catalog)
    )


def _targets(placement: Placement, catalog: Catalog) -> tuple[Option, ...]:
    return tuple(
        o for o in catalog.options_for(placement.component.kind)
        if o.provider != placement.provider and o.provider not in EXCLUDED_PROVIDERS
    )


def _assess(
    placement: Placement,
    end_state: EndState,
    catalog: Catalog,
    constraints: HardConstraints,
    groups: tuple[StayTogether, ...],
) -> Assessment:
    component = placement.component
    before = cost_placement(placement, catalog).monthly_eur
    vcpu, memory_gb = unit_size(placement, catalog)
    moves, rejected = [], []
    for option in _targets(placement, catalog):
        lacking = option.lacks_features(component.features_used)
        if lacking:
            rejected.append(f"{option.id} lacks {', '.join(sorted(lacking))}")
            continue
        if not _provider_allowed(option.provider, constraints):
            rejected.append(f"{option.id}: provider {option.provider} is not allowed")
            continue
        choice = resolve_tier(option.pricing.tiers, None, vcpu, memory_gb, component.capacity_value("gpus"))
        tier = choice.tier.id if choice else None
        after = apply_action(placement, _move_action(component.id, option, tier, ""), catalog)
        if not _residency_ok(after, constraints):
            rejected.append(f"{option.id} would put {component.data_classification} data in {after.region}")
            continue
        split = _region_group_split(after, end_state, groups)
        if split:
            rejected.append(f"{option.id} would split {split} across regions")
            continue
        cost = cost_placement(after, catalog)
        if cost.source != "catalog" or "partially_priced" in cost.flags:
            rejected.append(f"{option.id} cannot price it")
            continue
        evidence = cost.catalog.evidence if cost.catalog else ()
        moves.append(Move(component.id, option, tier, before, cost.monthly_eur, evidence))
    return Assessment(component.id, tuple(moves), tuple(rejected))


def _provider_allowed(provider: str, constraints: HardConstraints) -> bool:
    allowed = constraints.allowed_providers
    return (allowed is None or provider in allowed) and provider not in constraints.forbidden_providers


def _residency_ok(placement: Placement, constraints: HardConstraints) -> bool:
    residency = constraints.residency
    component = placement.component
    if residency is None or not component.stateful or component.data_classification not in residency.applies_to:
        return True
    return region_matches(placement.region, residency.allowed_regions)


def _region_group_split(placement: Placement, end_state: EndState, groups: tuple[StayTogether, ...]) -> str | None:
    for group in groups:
        if group.scope != "region" or placement.component.id not in group.members:
            continue
        for member in group.members:
            other = end_state.placements.get(member)
            if other is None or other.removed or member == placement.component.id:
                continue
            if other.region != placement.region:
                return group.id
    return None


def _resolve_whole_unit(
    group: StayTogether,
    end_state: EndState,
    assessments: dict[str, Assessment],
    chosen: dict[str, Move],
    blocked: dict[str, str],
) -> None:
    members = [m for m in group.members if m in end_state.placements and not end_state.placements[m].removed]
    if not any(m in chosen for m in members):
        return
    providers = sorted({chosen[m].option.provider for m in members if m in chosen})
    best: tuple[float, str, dict[str, Move]] | None = None
    for provider in providers:
        plan = {m: assessments[m].cheapest(provider) if m in assessments else None for m in members}
        if any(move is None for move in plan.values()):
            continue
        saving = sum(move.saving_eur for move in plan.values())
        if saving > 0 and (best is None or (-saving, provider) < (-best[0], best[1])):
            best = (saving, provider, plan)
    if best is not None:
        chosen.update(best[2])
        return
    stuck = sorted(m for m in members if not any(
        assessments.get(m) and assessments[m].cheapest(p) for p in providers
    ))
    reason = (
        f"{group.id} moves as one unit ({group.scope} scope) and "
        f"{', '.join(stuck) or 'the group'} cannot move to {', '.join(providers)}"
    )
    for member in members:
        if chosen.pop(member, None) is not None or member in assessments:
            blocked[member] = reason


def _move_actions(
    move: Move, assessment: Assessment, end_state: EndState, groups: tuple[StayTogether, ...],
) -> tuple[Action, ...]:
    placement = end_state.placements[move.component]
    reason = (
        f"move to {move.option.id}"
        + (f" {move.tier}" if move.tier else "")
        + f": EUR {move.before_eur:,.0f} to EUR {move.after_eur:,.0f} a month"
    )
    together = sorted(g.id for g in groups if g.scope == "region" and move.component in g.members)
    if together:
        reason += f", stays in {placement.region} with {', '.join(together)}"
    if assessment.rejected:
        reason += f"; rejected: {'; '.join(assessment.rejected)}"
    actions = [_move_action(move.component, move.option, move.tier, reason, move.evidence)]
    if placement.component.features_used is None:
        actions.append(Action(
            move.component, ActionKind.FLAG,
            f"extensions in use are unknown: check them against {move.option.id} before moving",
            signal=VERIFY_EXTENSIONS_SIGNAL,
        ))
    return tuple(actions)


def _move_action(component: str, option: Option, tier: str | None, reason: str, evidence: tuple = ()) -> Action:
    return Action(component, ActionKind.MOVE, reason, signal=MOVE_SIGNAL, evidence=evidence, tier=tier, option=option.id)

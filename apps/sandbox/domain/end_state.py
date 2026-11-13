from dataclasses import dataclass, replace
from typing import Any, Dict, List, Mapping, Sequence

from .candidate import Action, Candidate
from .target_text import parse_target

NOT_BUILT_ACTIONS = ("delete", "stop")
RESHAPING_ACTIONS = ("resize", "scale", "move")
UNREHEARSED_ACTIONS = {
    "autoscale": "autoscaling is not rehearsed: built at the fixed count",
    "remediate": "security remediation is not rehearsed on Floci",
    "flag": "a flag changes nothing to build",
}


@dataclass(frozen=True)
class ResultAction:
    component: str
    action: str
    to: str = ""


@dataclass(frozen=True)
class SkippedAction:
    component: str
    action: str
    to: str
    reason: str


@dataclass(frozen=True)
class EndState:
    candidate: Candidate
    skipped: List[SkippedAction]


class CandidateNotFound(LookupError):
    pass


def infra_actions(infra: Mapping[str, Any]) -> List[Action]:
    return [
        Action(
            component_id=str(component["id"]),
            action="keep",
            kind=str(component["kind"]),
            sku=str(component.get("sku") or ""),
            quantity=max(1, int(component.get("quantity") or 1)),
            zones=max(1, int(component.get("zones") or 1)),
        )
        for component in infra["components"]
    ]


def candidate_actions(result: Mapping[str, Any], candidate_id: str) -> List[ResultAction]:
    for candidate in result["candidates"]:
        if candidate["id"] == candidate_id:
            return [ResultAction(str(item["component"]), str(item["action"]), str(item.get("to") or "")) for item in candidate["actions"]]
    raise CandidateNotFound(f"candidate {candidate_id} is not in result.json; it has {', '.join(item['id'] for item in result['candidates'])}")


def label(current: str, applied: str) -> str:
    return applied if current == "keep" else f"{current}+{applied}"


def apply_action(component: Action, item: ResultAction, skipped: List[SkippedAction]) -> Action:
    if item.action in NOT_BUILT_ACTIONS:
        return replace(component, action=item.action)
    if item.action in UNREHEARSED_ACTIONS:
        skipped.append(SkippedAction(item.component, item.action, item.to, UNREHEARSED_ACTIONS[item.action]))
        return component
    if item.action not in RESHAPING_ACTIONS:
        return component
    spec = parse_target(item.to)
    unrehearsed = "the provider, product or region change is not rehearsed on Floci"
    if spec.is_empty():
        reason = f"{unrehearsed}; built as in infra.json" if item.action == "move" else "`to` states no count, size or zones the sandbox can build; built as in infra.json"
        skipped.append(SkippedAction(item.component, item.action, item.to, reason))
        return component
    if item.action == "move":
        skipped.append(SkippedAction(item.component, item.action, item.to, f"{unrehearsed}; applied {spec.describe()}"))
    return replace(
        component,
        action=label(component.action, item.action),
        quantity=spec.quantity or component.quantity,
        sku=spec.sku or component.sku,
        zones=spec.zones or component.zones,
    )


def end_state(candidate_id: str, components: Sequence[Action], actions: Sequence[ResultAction]) -> EndState:
    state: Dict[str, Action] = {component.component_id: component for component in components}
    skipped: List[SkippedAction] = []
    for item in actions:
        if item.component not in state:
            skipped.append(SkippedAction(item.component, item.action, item.to, "not an infra.json component, nothing to build"))
            continue
        if state[item.component].action in NOT_BUILT_ACTIONS:
            continue
        state[item.component] = apply_action(state[item.component], item, skipped)
    return EndState(Candidate(candidate_id, list(state.values())), skipped)

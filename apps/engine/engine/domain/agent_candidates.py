from typing import Any, Mapping, Sequence

from engine.domain.candidate import ACCOUNT_SCOPE, Action, ActionKind, Candidate
from engine.domain.catalog import Catalog
from engine.domain.end_state import apply_candidate
from engine.domain.forecast import Forecast
from engine.domain.model import Infra
from engine.domain.proposals import REMEDIATION_LAYER, Proposal
from engine.domain.remediation import remediation_actions
from engine.domain.signals import usage_evidence

AGENT_SOURCE = "agent"
AGENT_LAYER = "agent"
TARGET_FIELDS = ("option", "region", "tier", "quantity", "zones", "vcpu", "memory_gb")


class UnbuiltParent(ValueError):
    pass


def agent_candidates_from_document(document: Mapping[str, Any], infra: Infra) -> tuple[Candidate, ...]:
    return tuple(
        Candidate(
            entry["id"],
            tuple(_action(action, infra) for action in entry["actions"]),
            builds_on=entry["builds_on"],
            source=AGENT_SOURCE,
        )
        for entry in document["candidates"]
    )


def _action(entry: Mapping[str, Any], infra: Infra) -> Action:
    component = entry["component"]
    evidence = () if component == ACCOUNT_SCOPE else usage_evidence(infra.component(component))
    target = entry.get("to", {})
    return Action(
        component=component,
        kind=ActionKind(entry["action"]),
        reason=entry["reason"],
        signal=entry.get("signal"),
        evidence=evidence,
        **{field: target[field] for field in TARGET_FIELDS if field in target},
    )


def agent_proposals(
    agent_candidates: Sequence[Candidate],
    engine_proposals: Sequence[Proposal],
    infra: Infra,
    catalog: Catalog,
    forecast: Forecast,
) -> tuple[Proposal, ...]:
    layered = {p.candidate.id: _without_remediation(p) for p in engine_proposals}
    proposals = []
    for agent in agent_candidates:
        if agent.builds_on is not None and agent.builds_on not in layered:
            raise UnbuiltParent(f"{agent.id}: builds_on {agent.builds_on} was not built for this forecast")
        touched = {action.component for action in agent.actions}
        kept = [pair for pair in layered.get(agent.builds_on, ()) if pair[0].component not in touched]
        own = kept + [(action, AGENT_LAYER) for action in agent.actions]
        actions = tuple(action for action, _ in own)
        fixes = remediation_actions(apply_candidate(infra, catalog, Candidate(agent.id, actions)), infra, forecast)
        proposals.append(Proposal(
            Candidate(agent.id, actions + fixes, builds_on=agent.builds_on, source=AGENT_SOURCE),
            tuple(layer for _, layer in own) + (REMEDIATION_LAYER,) * len(fixes),
        ))
        layered[agent.id] = tuple(own)
    return tuple(proposals)


def _without_remediation(proposal: Proposal) -> tuple[tuple[Action, str], ...]:
    return tuple(
        (action, layer)
        for action, layer in zip(proposal.candidate.actions, proposal.layers)
        if layer != REMEDIATION_LAYER
    )

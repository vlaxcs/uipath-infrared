from dataclasses import dataclass
from enum import StrEnum

from engine.domain.provenance import Confidence, Evidence, confidence_of


class ActionKind(StrEnum):
    KEEP = "keep"
    DELETE = "delete"
    STOP = "stop"
    RESIZE = "resize"
    SCALE = "scale"
    AUTOSCALE = "autoscale"
    MOVE = "move"
    FLAG = "flag"
    REMEDIATE = "remediate"


@dataclass(frozen=True)
class Action:
    component: str
    kind: ActionKind
    reason: str
    signal: str | None = None
    evidence: tuple[Evidence, ...] = ()
    tier: str | None = None
    quantity: float | None = None
    vcpu: float | None = None
    memory_gb: float | None = None
    zones: int | None = None
    option: str | None = None
    region: str | None = None

    @property
    def confidence(self) -> Confidence:
        return confidence_of(self.evidence)


@dataclass(frozen=True)
class Candidate:
    id: str
    actions: tuple[Action, ...]
    builds_on: str | None = None
    source: str = "engine"

    def extend(self, candidate_id: str, actions: tuple[Action, ...]) -> "Candidate":
        return Candidate(candidate_id, self.actions + actions, builds_on=self.id)

    def own_actions(self, parent: "Candidate | None") -> tuple[Action, ...]:
        return self.actions[len(parent.actions):] if parent else self.actions


ACCOUNT_SCOPE = "account"
DO_NOTHING = Candidate("do_nothing", ())

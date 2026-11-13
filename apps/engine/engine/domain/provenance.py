from dataclasses import dataclass
from enum import IntEnum
from typing import Iterable


class Provenance(IntEnum):
    SYNTHETIC = 0
    ESTIMATED = 1
    OBSERVED = 2

    @classmethod
    def parse(cls, label: str) -> "Provenance":
        return cls[label.upper()]

    @property
    def label(self) -> str:
        return self.name.lower()


CONFIDENCE_BY_PROVENANCE = {
    Provenance.OBSERVED: "high",
    Provenance.ESTIMATED: "medium",
    Provenance.SYNTHETIC: "low",
}


@dataclass(frozen=True)
class Evidence:
    name: str
    provenance: Provenance


@dataclass(frozen=True)
class Confidence:
    level: str
    provenance: Provenance
    reason: str


def confidence_of(evidence: Iterable[Evidence]) -> Confidence:
    items = sorted(set(evidence), key=lambda e: (e.provenance, e.name))
    if not items:
        return Confidence("high", Provenance.OBSERVED, "based on configuration facts only")
    weakest = items[0].provenance
    names = sorted({e.name for e in items if e.provenance == weakest})
    verb = "is" if len(names) == 1 else "are"
    return Confidence(
        CONFIDENCE_BY_PROVENANCE[weakest],
        weakest,
        f"{', '.join(names)} {verb} {weakest.label}",
    )

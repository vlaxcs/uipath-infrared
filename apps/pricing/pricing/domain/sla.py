from dataclasses import dataclass, field
from datetime import date
from typing import Mapping

SLA_SOURCE = "sla"
SLA_FIELDS = ("availability_pct", "multi_az_availability_pct")


@dataclass(frozen=True)
class SlaEntry:
    key: str
    url: str
    value: float
    read_on: date
    quote: str
    note: str = ""

    @property
    def owner(self) -> str:
        return self.key.rsplit("/", 1)[0]

    @property
    def field(self) -> str:
        return self.key.rsplit("/", 1)[1]


@dataclass(frozen=True)
class SlaSnapshot:
    source: str
    url: str
    version: str
    fetched_on: date
    entries: Mapping[str, SlaEntry]
    unverified: Mapping[str, str] = field(default_factory=dict)

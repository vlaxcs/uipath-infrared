from dataclasses import dataclass, field
from datetime import date
from typing import Mapping

from pricing.domain.price import Price


@dataclass(frozen=True)
class Snapshot:
    source: str
    url: str
    version: str
    fetched_on: date
    prices: Mapping[str, Price]
    unverified: Mapping[str, str] = field(default_factory=dict)

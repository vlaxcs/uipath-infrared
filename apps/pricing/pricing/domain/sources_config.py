from dataclasses import dataclass
from typing import Mapping

from pricing.domain.selector import Selector


@dataclass(frozen=True)
class SourcesConfig:
    region: str
    aws_offers: Mapping[str, Mapping[str, Selector]]

from datetime import datetime
from pathlib import Path
from typing import Protocol, Sequence

from agent.application.tools import Tool
from agent.domain.prompts import Specialist
from agent.domain.sites import Listing, NearbyOption, Point, SiteKind


class EngineRefused(Exception):
    pass


class SiteStoreUnavailable(Exception):
    pass


class ListingSourceUnavailable(Exception):
    pass


class SiteStore(Protocol):
    def nearby(self, center: Point, radius_km: float, kinds: Sequence[SiteKind], fresh_since: datetime) -> dict[SiteKind, list[NearbyOption]]: ...

    def save(self, listings: Sequence[Listing]) -> None: ...


class ListingSource(Protocol):
    def search(self, center: Point, radius_km: float, kind: SiteKind) -> list[Listing]: ...


class Session(Protocol):
    model: str

    def run(self, system_prompt: str, prompt: str, tools: Sequence[Tool], specialists: Sequence[Specialist]) -> None: ...


class Engine(Protocol):
    def evaluate(self, candidates: dict, infra: Path, forecast: Path, catalog: Path) -> dict: ...


class CandidatesChecker(Protocol):
    def errors(self, document: dict, infra: dict, catalog: dict) -> list[str]: ...

from pathlib import Path
from typing import Protocol, Sequence

from agent.application.tools import Tool
from agent.domain.prompts import Specialist


class EngineRefused(Exception):
    pass


class Session(Protocol):
    model: str

    def run(self, system_prompt: str, prompt: str, tools: Sequence[Tool], specialists: Sequence[Specialist]) -> None: ...


class Engine(Protocol):
    def evaluate(self, candidates: dict, infra: Path, forecast: Path, catalog: Path) -> dict: ...


class CandidatesChecker(Protocol):
    def errors(self, document: dict, infra: dict, catalog: dict) -> list[str]: ...

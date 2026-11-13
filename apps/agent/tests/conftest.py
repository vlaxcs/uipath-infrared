import json
import shutil
import sys
from dataclasses import dataclass, field
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]
FLOW = REPO / "apps" / "orchestrator" / "testdata" / "flow"
MOCK = REPO / "contracts" / "mock"


@dataclass
class FakeSession:
    script: object = None
    model: str = "fake-model"
    prompts: list = field(default_factory=list)

    def run(self, system_prompt, prompt, tools, specialists):
        self.prompts.append(prompt)
        if self.script:
            self.script({t.name: t.handler for t in tools})


def answer_of(reply: dict):
    return json.loads(reply["content"][0]["text"])


@pytest.fixture
def run_dir(tmp_path):
    shutil.copyfile(MOCK / "startup.infra.json", tmp_path / "infra.json")
    shutil.copyfile(MOCK / "startup.forecast.json", tmp_path / "forecast.json")
    shutil.copyfile(REPO / "contracts" / "real" / "catalog.json", tmp_path / "catalog.json")
    (tmp_path / "findings.json").write_text('{"findings": []}', encoding="utf-8")
    return tmp_path


@pytest.fixture
def engine_command(monkeypatch):
    monkeypatch.setenv("PYTHONPATH", str(REPO / "apps" / "engine"))
    return [sys.executable, "-m", "engine"]


def candidate(revision: int) -> dict:
    return json.loads((FLOW / f"candidates.{revision}.json").read_text(encoding="utf-8"))["candidates"][0]

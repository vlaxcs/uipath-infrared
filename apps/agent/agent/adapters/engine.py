import json
import subprocess
import tempfile
from pathlib import Path

from agent.application.ports import EngineRefused

TIMEOUT_SECONDS = 120


class EngineCli:
    def __init__(self, command: list[str]):
        self.command = command

    def evaluate(self, candidates: dict, infra: Path, forecast: Path, catalog: Path) -> dict:
        with tempfile.TemporaryDirectory(prefix="agent-evaluate-") as scratch:
            candidates_file = Path(scratch) / "candidates.json"
            result_file = Path(scratch) / "result.json"
            candidates_file.write_text(json.dumps(candidates), encoding="utf-8")
            try:
                completed = subprocess.run(
                    [*self.command, "evaluate", str(infra), str(forecast), str(catalog), "--candidates", str(candidates_file), "--out", str(result_file)],
                    capture_output=True, text=True, timeout=TIMEOUT_SECONDS,
                )
            except subprocess.TimeoutExpired:
                raise EngineRefused(f"the engine took longer than {TIMEOUT_SECONDS} s")
            if completed.returncode != 0:
                raise EngineRefused(_last_line(completed.stderr) or f"the engine exited {completed.returncode}")
            return json.loads(result_file.read_text(encoding="utf-8"))


def _last_line(text: str) -> str:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return lines[-1][:300] if lines else ""

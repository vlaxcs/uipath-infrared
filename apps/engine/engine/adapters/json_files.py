import json
from pathlib import Path
from typing import Any

DECIMALS = 2


def read_json(path: Path) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def dumps_deterministic(document: Any) -> str:
    return json.dumps(_rounded(document), indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def write_json(path: Path, document: Any) -> None:
    Path(path).write_text(dumps_deterministic(document), encoding="utf-8")


def _rounded(value: Any) -> Any:
    if isinstance(value, float):
        rounded = round(value, DECIMALS)
        return 0.0 if rounded == 0 else rounded
    if isinstance(value, dict):
        return {key: _rounded(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_rounded(item) for item in value]
    return value

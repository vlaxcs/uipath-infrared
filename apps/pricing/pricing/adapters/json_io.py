import json
from pathlib import Path
from typing import Any


def read_json(path: Path) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def dumps(document: Any, sort_keys: bool) -> str:
    return json.dumps(document, indent=2, sort_keys=sort_keys, ensure_ascii=False) + "\n"


def write_json(path: Path, document: Any, sort_keys: bool = True) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(dumps(document, sort_keys), encoding="utf-8")

import importlib.util
from functools import cache
from pathlib import Path
from typing import Any, Callable

from engine.adapters.contracts import CONTRACTS_DIR, InvalidContract, validate
from engine.adapters.json_files import read_json

INTEGRITY_MODULE = "candidates_integrity"
MAX_REPORTED_ERRORS = 5


def read_candidates(path: Path, infra_path: Path, catalog_path: Path) -> dict[str, Any]:
    document = read_json(path)
    label = Path(path).name
    validate(document, "candidates.schema.json", label)
    infra, catalog = read_json(infra_path), read_json(catalog_path)
    if document["project"] != infra["project"]:
        raise InvalidContract(f"{label}: candidates are for {document['project']}, the infra is {infra['project']}")
    errors = _integrity_check()(document, _strategy_names(), infra, catalog)
    if errors:
        raise InvalidContract(f"{label} breaks the candidates rules ({len(errors)} errors): {'; '.join(errors[:MAX_REPORTED_ERRORS])}")
    return document


@cache
def _integrity_check() -> Callable[..., list[str]]:
    spec = importlib.util.spec_from_file_location(INTEGRITY_MODULE, CONTRACTS_DIR / f"{INTEGRITY_MODULE}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.candidates_integrity_errors


@cache
def _strategy_names() -> frozenset[str]:
    schema = read_json(CONTRACTS_DIR / "forecast.schema.json")
    return frozenset(schema["properties"]["cto_settings"]["properties"]["strategies_enabled"]["items"]["enum"])

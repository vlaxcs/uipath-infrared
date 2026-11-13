import importlib.util
import json
from pathlib import Path

from jsonschema import Draft202012Validator

CONTRACTS = Path(__file__).resolve().parents[4] / "contracts"


class ContractChecker:
    def __init__(self, contracts: Path = CONTRACTS):
        self.integrity = _module(contracts / "candidates_integrity.py").candidates_integrity_errors
        self.validator = Draft202012Validator(_read(contracts / "candidates.schema.json"))
        forecast_schema = _read(contracts / "forecast.schema.json")
        self.strategies = set(forecast_schema["properties"]["cto_settings"]["properties"]["strategies_enabled"]["items"]["enum"])

    def errors(self, document: dict, infra: dict, catalog: dict) -> list[str]:
        schema_errors = [
            f"{'/'.join(str(part) for part in error.absolute_path) or '(root)'}: {error.message}"
            for error in self.validator.iter_errors(document)
        ]
        if schema_errors:
            return schema_errors
        return self.integrity(document, self.strategies, infra, catalog)


def _module(path: Path):
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _read(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))

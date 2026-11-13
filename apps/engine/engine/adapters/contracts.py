from functools import cache
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

from engine.adapters.json_files import read_json

CONTRACTS_DIR = Path(__file__).resolve().parents[4] / "contracts"
MAX_REPORTED_ERRORS = 5


class InvalidContract(ValueError):
    pass


@cache
def _validator(schema_name: str) -> Draft202012Validator:
    return Draft202012Validator(read_json(CONTRACTS_DIR / schema_name))


def validate(document: Any, schema_name: str, label: str) -> None:
    errors = sorted(_validator(schema_name).iter_errors(document), key=lambda e: list(e.absolute_path))
    if errors:
        details = "; ".join(
            f"/{'/'.join(map(str, e.absolute_path))}: {e.message[:160]}" for e in errors[:MAX_REPORTED_ERRORS]
        )
        raise InvalidContract(f"{label} does not match {schema_name} ({len(errors)} errors): {details}")

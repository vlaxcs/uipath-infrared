from functools import cache
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

from pricing.adapters.json_io import dumps, read_json
from pricing.domain.errors import BuildError

MAX_REPORTED_ERRORS = 5


def read_skeleton(path: Path) -> dict[str, Any]:
    return read_json(path)


def catalog_text(document: dict[str, Any]) -> str:
    return dumps(document, sort_keys=False)


def validate_catalog(document: dict[str, Any], schema_path: Path) -> None:
    errors = sorted(_validator(str(schema_path)).iter_errors(document), key=lambda e: list(e.absolute_path))
    if errors:
        details = "; ".join(f"/{'/'.join(map(str, e.absolute_path))}: {e.message[:160]}" for e in errors[:MAX_REPORTED_ERRORS])
        raise BuildError(f"the built catalog does not match {schema_path.name} ({len(errors)} errors): {details}")


@cache
def _validator(schema_path: str) -> Draft202012Validator:
    return Draft202012Validator(read_json(Path(schema_path)))

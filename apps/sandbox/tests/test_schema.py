import json
from pathlib import Path

from jsonschema import Draft202012Validator


def test_sample_rehearsal_validates_against_schema():
    repo_root = Path(__file__).parent.parent.parent.parent
    schema_path = repo_root / "contracts" / "rehearsal.schema.json"
    sample_path = Path(__file__).parent.parent / "sample" / "rehearsal.json"

    schema = json.loads(schema_path.read_text())
    sample = json.loads(sample_path.read_text())

    validator = Draft202012Validator(schema)
    errors = list(validator.iter_errors(sample))

    assert len(errors) == 0, f"Schema validation failed: {errors}"

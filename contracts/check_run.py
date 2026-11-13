import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

from run_integrity import run_integrity_errors

HERE = Path(__file__).resolve().parent


def run_errors(run):
    validator = Draft202012Validator(json.loads((HERE / "run.schema.json").read_text(encoding="utf-8")))
    schema_errors = [
        f"[schema] {'/'.join(str(part) for part in error.absolute_path) or '(root)'}: {error.message}"
        for error in sorted(validator.iter_errors(run), key=lambda error: list(error.absolute_path))
    ]
    if schema_errors:
        return schema_errors
    return [f"[integrity] {error}" for error in run_integrity_errors(run)]


def main(argv):
    if len(argv) != 1:
        print("usage: check_run.py <run.json>", file=sys.stderr)
        return 2
    errors = run_errors(json.loads(Path(argv[0]).read_text(encoding="utf-8")))
    for error in errors:
        print(error)
    print(f"RESULT: {'OK' if not errors else 'FAIL'} ({len(errors)} errors)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

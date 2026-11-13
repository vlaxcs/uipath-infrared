import argparse
import sys
from pathlib import Path

from engine.adapters.contracts import InvalidContract
from engine.adapters.json_files import dumps_deterministic
from engine.application.baseline import baseline_report
from engine.domain.normalise import UnsupportedSchemaVersion

EXIT_INVALID_INPUT = 2


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="engine")
    commands = parser.add_subparsers(dest="command", required=True)
    baseline = commands.add_parser("baseline", help="price the current estate and cross-check it")
    baseline.add_argument("infra", type=Path)
    baseline.add_argument("catalog", type=Path)
    baseline.add_argument("--out", type=Path)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        document = baseline_report(args.infra, args.catalog)
    except (InvalidContract, UnsupportedSchemaVersion, FileNotFoundError) as error:
        print(f"engine: {error}", file=sys.stderr)
        return EXIT_INVALID_INPUT
    text = dumps_deterministic(document)
    if args.out:
        args.out.write_text(text, encoding="utf-8")
    else:
        sys.stdout.write(text)
    return 0

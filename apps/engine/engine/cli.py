import argparse
import sys
from pathlib import Path

from engine.adapters.contracts import InvalidContract
from engine.adapters.json_files import dumps_deterministic
from engine.application.baseline import baseline_report
from engine.application.evaluate import evaluate
from engine.domain.agent_candidates import UnbuiltParent
from engine.domain.normalise import UnsupportedSchemaVersion

EXIT_INVALID_INPUT = 2


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="engine")
    commands = parser.add_subparsers(dest="command", required=True)
    baseline = commands.add_parser("baseline", help="price the current estate and cross-check it")
    baseline.add_argument("infra", type=Path)
    baseline.add_argument("catalog", type=Path)
    baseline.add_argument("--out", type=Path)
    evaluation = commands.add_parser("evaluate", help="price, check and rank the candidates; write result.json")
    evaluation.add_argument("infra", type=Path)
    evaluation.add_argument("forecast", type=Path)
    evaluation.add_argument("catalog", type=Path)
    evaluation.add_argument("--candidates", type=Path, help="the agent's proposals, a candidates.json")
    evaluation.add_argument("--out", type=Path)
    return parser


def summary(command: str, document: dict, out: Path) -> str:
    if command != "evaluate":
        return f"engine: baseline EUR {document.get('monthly_eur')}/month; wrote {out}"
    candidates = document.get("candidates") or []
    feasible = sum(1 for candidate in candidates if candidate.get("feasible"))
    winner = f"winner {document['winner']}" if document.get("winner") else "no winner"
    return f"engine: {len(candidates)} candidates, {feasible} feasible, {winner}; wrote {out}"


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        document = (
            baseline_report(args.infra, args.catalog) if args.command == "baseline"
            else evaluate(args.infra, args.forecast, args.catalog, args.candidates)
        )
    except (InvalidContract, UnsupportedSchemaVersion, UnbuiltParent, FileNotFoundError) as error:
        print(f"engine: {error}", file=sys.stderr)
        return EXIT_INVALID_INPUT
    text = dumps_deterministic(document)
    if args.out:
        args.out.write_text(text, encoding="utf-8")
        print(summary(args.command, document, args.out), file=sys.stderr)
    else:
        sys.stdout.write(text)
    return 0

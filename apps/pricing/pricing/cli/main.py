import argparse
import sys
from datetime import date
from pathlib import Path

from pricing.adapters.http_fetch import HttpFetcher
from pricing.application.build import build
from pricing.application.paths import Paths
from pricing.application.refresh import refresh
from pricing.application.status import status
from pricing.domain.errors import PricingError

DEFAULT_MAX_AGE_DAYS = 30
EXIT_FAILED = 1


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    paths = Paths()
    try:
        if args.command == "refresh":
            only = frozenset(args.only) if args.only else None
            for path in refresh(paths, HttpFetcher(), date.today(), only):
                print(f"wrote {path}")
            return 0
        if args.command == "build":
            return _build(paths, args.out, args.check)
        return _status(paths, args.max_age_days)
    except PricingError as error:
        print(f"pricing {args.command}: {error}", file=sys.stderr)
        return EXIT_FAILED


def _build(paths: Paths, out: Path | None, check: bool) -> int:
    target = out or paths.catalog
    built, text = build(paths)
    if check:
        current = target.read_text(encoding="utf-8") if target.exists() else ""
        if current != text:
            print(f"{target} is out of date with the snapshots: run pricing build", file=sys.stderr)
            return EXIT_FAILED
        print(f"{target} matches the snapshots")
        return 0
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")
    print(
        f"wrote {target}: {len(built.sourced)} prices from snapshots, {len(built.unsourced)} illustrative; "
        f"{len(built.sla_sourced)} SLAs from vendor pages, {len(built.sla_unsourced)} estimated"
    )
    return 0


def _status(paths: Paths, max_age_days: int) -> int:
    ages = status(paths, date.today(), max_age_days)
    for age in ages:
        state = "ok" if age.healthy else "STALE" if age.age_days > max_age_days else "CHECK"
        print(f"{state:5} {age.source:22} fetched {age.fetched_on.isoformat()} ({age.age_days} days)")
        for problem in age.problems:
            print(f"      {problem}")
    return 0 if all(a.healthy for a in ages) else EXIT_FAILED


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="pricing", description="collect prices offline and build catalog.json from them")
    commands = parser.add_subparsers(dest="command", required=True)
    refresh_cmd = commands.add_parser("refresh", help="fetch every price source and rewrite its snapshot")
    refresh_cmd.add_argument("--only", nargs="+", metavar="SOURCE", help="refresh only these sources, e.g. ecb-fx aws-AmazonRDS manual")
    build_cmd = commands.add_parser("build", help="write catalog.json from the skeleton and the snapshots, offline")
    build_cmd.add_argument("--out", type=Path, help="where to write it (default contracts/real/catalog.json)")
    build_cmd.add_argument("--check", action="store_true", help="fail if the written catalog differs from a fresh build")
    status_cmd = commands.add_parser("status", help="how old each snapshot is; fails when one is stale or a quote is missing")
    status_cmd.add_argument("--max-age-days", type=int, default=DEFAULT_MAX_AGE_DAYS)
    return parser

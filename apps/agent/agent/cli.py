import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from agent import settings
from agent.adapters.aws_tools import READ_TOOLS
from agent.adapters.contracts import ContractChecker
from agent.adapters.engine import EngineCli
from agent.adapters.colocation_offers import DEFAULT_OFFERS, ColocationOffers
from agent.adapters.listing_sources import ListingsByKind, eur_per_unit
from agent.adapters.polite_http import PoliteFetcher
from agent.adapters.sdk import ClaudeSession
from agent.adapters.site_store import PostgresSiteStore
from agent.adapters.storia import StoriaLeases
from agent.application.investigate import investigate
from agent.application.propose import Proposal, ProposalInputs
from agent.application.site_options import site_options
from agent.domain.sites import Point, SiteKind


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="agent")
    root.add_argument("--model", default="sonnet")
    root.add_argument("--max-turns", type=int, default=150)
    commands = root.add_subparsers(dest="command", required=True)
    investigating = commands.add_parser("investigate", help="review the estate; write the findings")
    investigating.add_argument("--infra", type=Path, required=True)
    investigating.add_argument("--out", type=Path, required=True)
    proposing = commands.add_parser("propose", help="propose candidates the engine evaluates; write candidates.json")
    for name in ("--infra", "--forecast", "--catalog", "--findings", "--out"):
        proposing.add_argument(name, type=Path, required=True)
    proposing.add_argument("--revision", type=int, required=True)
    proposing.add_argument("--feedback", type=Path)
    searching = commands.add_parser("sites-search", help="find rentable spaces and colocation near a pin; keep them in the site store")
    searching.add_argument("--lat", type=float, required=True)
    searching.add_argument("--lng", type=float, required=True)
    searching.add_argument("--radius-km", type=float, default=25)
    return root


def main(argv: list[str] | None = None) -> int:
    arguments = parser().parse_args(argv)
    if arguments.command == "sites-search":
        return sites_search(Point(arguments.lat, arguments.lng), arguments.radius_km)
    settings.llm()
    session = ClaudeSession(arguments.model, arguments.max_turns, arguments.out.resolve().parent)
    if arguments.command == "investigate":
        return investigate(arguments.infra, arguments.out, session, READ_TOOLS)
    engine = EngineCli(settings.engine_command())
    inputs = ProposalInputs(arguments.infra, arguments.forecast, arguments.catalog, arguments.findings, arguments.revision, arguments.feedback, arguments.out)
    return Proposal(inputs, session, engine, ContractChecker()).run()


def sites_search(center: Point, radius_km: float) -> int:
    store = PostgresSiteStore(settings.sites_database_url())
    fetcher, rates = PoliteFetcher(), eur_per_unit()
    sources = ListingsByKind({
        SiteKind.LEASE: StoriaLeases(fetcher, rates),
        SiteKind.COLOCATION: ColocationOffers(DEFAULT_OFFERS, fetcher, rates),
    })
    found = site_options(store, sources, center, radius_km, datetime.now(timezone.utc))
    print(json.dumps({kind.value: [_summary(option) for option in found.get(kind, [])] for kind in SiteKind}, indent=1, ensure_ascii=False))
    return 0


def _summary(option) -> dict:
    listing = option.listing
    return {
        "label": listing.label, "distance_km": round(option.distance_km, 1), "area_m2": listing.area_m2, "racks": listing.racks,
        "rent_eur_month": listing.rent_eur_month, "source_url": listing.source_url, "read_at": listing.read_at.isoformat(),
    }

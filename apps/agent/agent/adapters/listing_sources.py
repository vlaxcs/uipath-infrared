import json
from pathlib import Path

from agent.application.ports import ListingSource
from agent.domain.sites import Listing, Point, SiteKind

ECB_SNAPSHOT = Path(__file__).resolve().parents[3] / "pricing" / "snapshots" / "ecb-fx.json"


class ListingsByKind:
    def __init__(self, sources: dict[SiteKind, ListingSource]):
        self.sources = sources

    def search(self, center: Point, radius_km: float, kind: SiteKind) -> list[Listing]:
        source = self.sources.get(kind)
        return source.search(center, radius_km, kind) if source else []


def eur_per_unit(snapshot: Path = ECB_SNAPSHOT) -> dict[str, float]:
    rates = json.loads(snapshot.read_text(encoding="utf-8"))
    return {"EUR": 1.0, "USD": 1 / rates["usd_per_eur"]}

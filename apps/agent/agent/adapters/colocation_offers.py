import html
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from agent.adapters.polite_http import PageMissing
from agent.adapters.storia import Fetcher
from agent.domain.listing_search import distance_km
from agent.domain.sites import Listing, Point, SiteKind

DEFAULT_OFFERS = Path(__file__).resolve().parents[2] / "config" / "colocation.json"
HIDDEN = re.compile(r"<(script|style)\b.*?</\1\s*>", re.S | re.I)
TAG = re.compile(r"<[^>]+>")


class ColocationOffers:
    def __init__(
        self, path: Path, fetcher: Fetcher, eur_per_unit: dict[str, float],
        now: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
    ):
        self.offers = json.loads(path.read_text(encoding="utf-8"))["offers"]
        self.fetcher = fetcher
        self.eur_per_unit = eur_per_unit
        self.now = now

    def search(self, center: Point, radius_km: float, kind: SiteKind) -> list[Listing]:
        if kind != SiteKind.COLOCATION:
            return []
        near = [offer for offer in self.offers if distance_km(center, Point(offer["lat"], offer["lng"])) <= radius_km]
        return [listing for listing in map(self._still_quoted, near) if listing is not None]

    def _still_quoted(self, offer: dict) -> Listing | None:
        rate = self.eur_per_unit.get(offer["currency"])
        if rate is None:
            return None
        try:
            page = self.fetcher.text(offer["source_url"])
        except PageMissing:
            return None
        if _squeezed(offer["quote"]) not in _squeezed(_visible_text(page)):
            return None
        return Listing(
            SiteKind.COLOCATION, offer["label"], Point(offer["lat"], offer["lng"]), None, offer["racks"],
            round(offer["rent_original"] * rate, 2), offer["currency"], offer["rent_original"], offer["source_url"], self.now(),
        )


def _visible_text(page: str) -> str:
    return html.unescape(TAG.sub(" ", HIDDEN.sub(" ", page)))


def _squeezed(text: str) -> str:
    return "".join(text.split()).casefold()

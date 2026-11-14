import json
import re
from datetime import datetime, timezone
from typing import Callable, Protocol

from agent.adapters.polite_http import PageMissing
from agent.application.ports import ListingSourceUnavailable
from agent.domain.listing_search import Offer, distance_km, lease_listing, nearest_city, storia_radius_km
from agent.domain.sites import MAX_OPTIONS_PER_KIND, Listing, Point, SiteKind

BASE = "https://www.storia.ro"
SEARCH = BASE + "/ro/rezultate/inchiriere/spatiu-comercial/{city}?distanceRadius={radius}"
AD = BASE + "/ro/oferta/{slug}"
NEXT_DATA = re.compile(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.S)


class Fetcher(Protocol):
    def text(self, url: str) -> str: ...


def parse_offers(html: str) -> list[Offer]:
    try:
        items = _next_data(html)["props"]["pageProps"]["data"]["searchAds"]["items"]
    except (KeyError, TypeError) as missing:
        raise ListingSourceUnavailable(f"Storia's search page layout changed: no search results at {missing}")
    return [offer for offer in map(_offer, items) if offer is not None]


def parse_coordinates(html: str) -> Point | None:
    try:
        coordinates = _next_data(html)["props"]["pageProps"]["ad"]["location"]["coordinates"]
        return Point(float(coordinates["latitude"]), float(coordinates["longitude"]))
    except (KeyError, TypeError, ValueError, ListingSourceUnavailable):
        return None


class StoriaLeases:
    def __init__(
        self, fetcher: Fetcher, eur_per_unit: dict[str, float],
        now: Callable[[], datetime] = lambda: datetime.now(timezone.utc), limit: int = MAX_OPTIONS_PER_KIND,
    ):
        self.fetcher = fetcher
        self.eur_per_unit = eur_per_unit
        self.now = now
        self.limit = limit

    def search(self, center: Point, radius_km: float, kind: SiteKind) -> list[Listing]:
        city = nearest_city(center)
        if kind != SiteKind.LEASE or city is None:
            return []
        radius = storia_radius_km(radius_km + distance_km(center, city.centre))
        offers = parse_offers(self.fetcher.text(SEARCH.format(city=city.slug, radius=radius)))
        listings: list[Listing] = []
        for offer in offers:
            if len(listings) >= self.limit:
                break
            listing = self._listing_near(offer, center, radius_km)
            if listing is not None:
                listings.append(listing)
        return listings

    def _listing_near(self, offer: Offer, center: Point, radius_km: float) -> Listing | None:
        try:
            location = parse_coordinates(self.fetcher.text(offer.url))
        except PageMissing:
            return None
        if location is None or distance_km(center, location) > radius_km:
            return None
        return lease_listing(offer, location, self.eur_per_unit, self.now())


def _next_data(html: str) -> dict:
    match = NEXT_DATA.search(html)
    if match is None:
        raise ListingSourceUnavailable("Storia's page layout changed: no __NEXT_DATA__ script")
    return json.loads(match.group(1))


def _offer(item: dict) -> Offer | None:
    price = item.get("totalPrice") or {}
    slug = (item.get("href") or "").rsplit("/ad/", 1)[-1]
    if item.get("hidePrice") or not price.get("value") or not price.get("currency") or not item.get("areaInSquareMeters") or not slug:
        return None
    return Offer(AD.format(slug=slug), item.get("title") or slug, float(price["value"]), price["currency"], float(item["areaInSquareMeters"]))

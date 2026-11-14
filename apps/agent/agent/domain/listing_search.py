import math
from dataclasses import dataclass
from datetime import datetime

from agent.domain.sites import Listing, Point, SiteKind

EARTH_RADIUS_KM = 6371.0088
MAX_CITY_DISTANCE_KM = 50
STORIA_RADII_KM = (0, 5, 10, 15, 25, 50, 75)


@dataclass(frozen=True)
class City:
    slug: str
    name: str
    centre: Point


STORIA_CITIES = (
    City("bucuresti", "Bucuresti", Point(44.4268, 26.1025)),
    City("cluj/cluj--napoca", "Cluj-Napoca", Point(46.7712, 23.6236)),
    City("timis/timisoara", "Timisoara", Point(45.7489, 21.2087)),
    City("iasi/iasi", "Iasi", Point(47.1585, 27.6014)),
    City("brasov/brasov", "Brasov", Point(45.6427, 25.5887)),
    City("constanta/constanta", "Constanta", Point(44.1598, 28.6348)),
)


@dataclass(frozen=True)
class Offer:
    url: str
    label: str
    rent: float
    currency: str
    area_m2: float


def distance_km(a: Point, b: Point) -> float:
    lat_a, lat_b = math.radians(a.lat), math.radians(b.lat)
    half_chord = (
        math.sin((lat_b - lat_a) / 2) ** 2
        + math.cos(lat_a) * math.cos(lat_b) * math.sin(math.radians(b.lng - a.lng) / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(half_chord))


def nearest_city(center: Point, cities: tuple[City, ...] = STORIA_CITIES) -> City | None:
    city = min(cities, key=lambda candidate: distance_km(center, candidate.centre))
    return city if distance_km(center, city.centre) <= MAX_CITY_DISTANCE_KM else None


def storia_radius_km(needed_km: float) -> int:
    return next((radius for radius in STORIA_RADII_KM if radius >= needed_km), STORIA_RADII_KM[-1])


def lease_listing(offer: Offer, location: Point, eur_per_unit: dict[str, float], read_at: datetime) -> Listing | None:
    rate = eur_per_unit.get(offer.currency)
    if rate is None:
        return None
    return Listing(
        SiteKind.LEASE, offer.label, location, offer.area_m2, None,
        round(offer.rent * rate, 2), offer.currency, offer.rent, offer.url, read_at,
    )

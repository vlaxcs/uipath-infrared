from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum

FRESH_FOR = timedelta(days=7)
ENOUGH_FRESH_PER_KIND = 5
MAX_OPTIONS_PER_KIND = 20


class SiteKind(str, Enum):
    COLOCATION = "colocation"
    LEASE = "lease"


@dataclass(frozen=True)
class Point:
    lat: float
    lng: float

    def __post_init__(self):
        if not -90 <= self.lat <= 90 or not -180 <= self.lng <= 180:
            raise ValueError(f"not a point on Earth: {self.lat}, {self.lng}")


@dataclass(frozen=True)
class Listing:
    kind: SiteKind
    label: str
    location: Point
    area_m2: float | None
    racks: int | None
    rent_eur_month: float
    currency: str
    rent_original: float
    source_url: str
    read_at: datetime

    def __post_init__(self):
        if self.kind == SiteKind.LEASE and not self.area_m2:
            raise ValueError(f"a lease needs its area: {self.source_url}")
        if self.kind == SiteKind.COLOCATION and not self.racks:
            raise ValueError(f"a colocation offer needs its racks: {self.source_url}")


@dataclass(frozen=True)
class NearbyOption:
    id: int
    listing: Listing
    distance_km: float


def latest_per_url(listings: list[Listing]) -> list[Listing]:
    latest: dict[str, Listing] = {}
    for listing in listings:
        kept = latest.get(listing.source_url)
        if kept is None or listing.read_at > kept.read_at:
            latest[listing.source_url] = listing
    return list(latest.values())

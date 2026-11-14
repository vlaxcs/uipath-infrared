from datetime import datetime

from agent.application.ports import ListingSource, SiteStore
from agent.domain.sites import ENOUGH_FRESH_PER_KIND, FRESH_FOR, NearbyOption, Point, SiteKind


def site_options(
    store: SiteStore, source: ListingSource, center: Point, radius_km: float, now: datetime,
) -> dict[SiteKind, list[NearbyOption]]:
    kinds = tuple(SiteKind)
    fresh_since = now - FRESH_FOR
    found = store.nearby(center, radius_km, kinds, fresh_since)
    short = [kind for kind in kinds if len(found.get(kind, [])) < ENOUGH_FRESH_PER_KIND]
    if not short:
        return found
    searched = [listing for kind in short for listing in source.search(center, radius_km, kind)]
    if searched:
        store.save(searched)
    return {**found, **store.nearby(center, radius_km, short, fresh_since)}

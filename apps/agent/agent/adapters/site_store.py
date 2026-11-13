from datetime import datetime
from typing import Sequence

import psycopg

from agent.application.ports import SiteStoreUnavailable
from agent.domain.sites import MAX_OPTIONS_PER_KIND, Listing, NearbyOption, Point, SiteKind, latest_per_url

CONNECT_TIMEOUT_SECONDS = 5

NEARBY = """
select o.id, o.kind, o.label, o.lat, o.lng, o.distance_m, o.area_m2, o.racks,
       o.rent_eur_month, o.currency, o.rent_original, o.source_url, o.read_at
from unnest(%(kinds)s::text[]) as wanted(kind)
cross join lateral (
  select id, kind, label,
         st_y(location::geometry) as lat, st_x(location::geometry) as lng,
         st_distance(location, center.point) as distance_m,
         area_m2, racks, rent_eur_month, currency, rent_original, source_url, read_at
  from site_options,
       (select st_setsrid(st_makepoint(%(lng)s, %(lat)s), 4326)::geography as point) as center
  where site_options.kind = wanted.kind
    and gone_at is null
    and read_at > %(fresh_since)s
    and st_dwithin(location, center.point, %(radius_m)s)
  order by location <-> center.point
  limit %(limit)s
) as o
order by o.kind, o.distance_m
"""

UPSERT = """
insert into site_options (kind, label, location, area_m2, racks, rent_eur_month, currency, rent_original, source_url, read_at)
select kind, label, st_setsrid(st_makepoint(lng, lat), 4326)::geography, area_m2, racks,
       rent_eur_month, currency, rent_original, source_url, read_at
from unnest(
  %(kinds)s::text[], %(labels)s::text[], %(lats)s::float8[], %(lngs)s::float8[], %(areas)s::numeric[],
  %(racks)s::int[], %(rents)s::numeric[], %(currencies)s::text[], %(originals)s::numeric[],
  %(urls)s::text[], %(read_ats)s::timestamptz[]
) as incoming(kind, label, lat, lng, area_m2, racks, rent_eur_month, currency, rent_original, source_url, read_at)
on conflict (source_url) do update set
  kind = excluded.kind, label = excluded.label, location = excluded.location,
  area_m2 = excluded.area_m2, racks = excluded.racks, rent_eur_month = excluded.rent_eur_month,
  currency = excluded.currency, rent_original = excluded.rent_original,
  read_at = excluded.read_at, gone_at = null
where excluded.read_at >= site_options.read_at
"""


class PostgresSiteStore:
    def __init__(self, url: str):
        self.url = url

    def nearby(
        self, center: Point, radius_km: float, kinds: Sequence[SiteKind], fresh_since: datetime,
    ) -> dict[SiteKind, list[NearbyOption]]:
        parameters = {
            "kinds": [kind.value for kind in kinds], "lat": center.lat, "lng": center.lng,
            "radius_m": radius_km * 1000, "fresh_since": fresh_since, "limit": MAX_OPTIONS_PER_KIND,
        }
        found: dict[SiteKind, list[NearbyOption]] = {kind: [] for kind in kinds}
        for row in self._fetch(NEARBY, parameters):
            option = _option(row)
            found[option.listing.kind].append(option)
        return found

    def save(self, listings: Sequence[Listing]) -> None:
        batch = latest_per_url(list(listings))
        if not batch:
            return
        parameters = {
            "kinds": [l.kind.value for l in batch], "labels": [l.label for l in batch],
            "lats": [l.location.lat for l in batch], "lngs": [l.location.lng for l in batch],
            "areas": [l.area_m2 for l in batch], "racks": [l.racks for l in batch],
            "rents": [l.rent_eur_month for l in batch], "currencies": [l.currency for l in batch],
            "originals": [l.rent_original for l in batch], "urls": [l.source_url for l in batch],
            "read_ats": [l.read_at for l in batch],
        }
        with self._connect() as connection:
            connection.execute(UPSERT, parameters)

    def _fetch(self, query: str, parameters: dict) -> list[tuple]:
        with self._connect() as connection:
            return connection.execute(query, parameters).fetchall()

    def _connect(self) -> psycopg.Connection:
        try:
            return psycopg.connect(self.url, connect_timeout=CONNECT_TIMEOUT_SECONDS)
        except psycopg.OperationalError as error:
            raise SiteStoreUnavailable(f"the site store is unreachable: {_first_line(error)}") from error


def _option(row: tuple) -> NearbyOption:
    (option_id, kind, label, lat, lng, distance_m, area_m2, racks,
     rent_eur_month, currency, rent_original, source_url, read_at) = row
    listing = Listing(
        kind=SiteKind(kind), label=label, location=Point(lat, lng),
        area_m2=float(area_m2) if area_m2 is not None else None, racks=racks,
        rent_eur_month=float(rent_eur_month), currency=currency, rent_original=float(rent_original),
        source_url=source_url, read_at=read_at,
    )
    return NearbyOption(option_id, listing, distance_m / 1000)


def _first_line(error: Exception) -> str:
    return str(error).strip().splitlines()[0] if str(error).strip() else type(error).__name__

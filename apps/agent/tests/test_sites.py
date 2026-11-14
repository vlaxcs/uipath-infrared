from datetime import datetime, timezone

import pytest

from agent import settings
from agent.application.site_options import site_options
from agent.domain.sites import Listing, NearbyOption, Point, SiteKind, latest_per_url

NOW = datetime(2026, 11, 14, tzinfo=timezone.utc)
CENTER = Point(44.43, 26.10)


def lease(url: str, read_at: datetime = NOW) -> Listing:
    return Listing(SiteKind.LEASE, url, CENTER, 100, None, 1000, "EUR", 1000, url, read_at)


def test_a_lease_without_its_area_is_refused():
    with pytest.raises(ValueError, match="area"):
        Listing(SiteKind.LEASE, "x", CENTER, None, None, 1000, "EUR", 1000, "u", NOW)


def test_a_colocation_offer_without_its_racks_is_refused():
    with pytest.raises(ValueError, match="racks"):
        Listing(SiteKind.COLOCATION, "x", CENTER, None, None, 1000, "EUR", 1000, "u", NOW)


@pytest.mark.parametrize("lat, lng", [(91, 0), (0, 181), (-90.5, 10)])
def test_a_point_off_the_earth_is_refused(lat, lng):
    with pytest.raises(ValueError):
        Point(lat, lng)


def test_the_latest_read_of_a_url_wins():
    older, newer = lease("u", datetime(2026, 11, 1, tzinfo=timezone.utc)), lease("u")
    assert latest_per_url([newer, older]) == [newer]


def test_a_search_that_finds_nothing_saves_nothing():
    store = FakeStore()
    found = site_options(store, EmptySource(), CENTER, 10, NOW)
    assert store.saved == []
    assert found == {SiteKind.COLOCATION: [], SiteKind.LEASE: []}


def test_a_missing_database_url_stops_naming_the_variable(monkeypatch):
    monkeypatch.delenv("SITES_DATABASE_URL", raising=False)
    with pytest.raises(SystemExit, match="SITES_DATABASE_URL"):
        settings.sites_database_url()


class FakeStore:
    def __init__(self):
        self.saved = []

    def nearby(self, center, radius_km, kinds, fresh_since) -> dict[SiteKind, list[NearbyOption]]:
        return {kind: [] for kind in kinds}

    def save(self, listings):
        self.saved.append(list(listings))


class EmptySource:
    def search(self, center, radius_km, kind):
        return []
